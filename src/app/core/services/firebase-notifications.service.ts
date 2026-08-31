import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getMessaging,
  getToken,
  Messaging,
  MessagePayload,
  onMessage,
} from 'firebase/messaging';
import { firstValueFrom, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface NotificationLog {
  _id: string;
  topic: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  alertId?: string;
  messageId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicRegistrationNotification {
  userId?: string;
  parentId?: string;
  parentName?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientDni?: string;
  credentialsEmail?: string;
  credentialsPassword?: string;
  affiliationType?: string;
  whatsappStatus?: string;
  transferred?: string;
  failed?: string;
}

export interface ConversationReminderMessage {
  from: 'customer' | 'employee';
  text: string;
  time: number;
}

export interface ConversationReminderNotification {
  conversationId: string;
  contactName: string;
  senderName: string;
  targetAgentId: string;
  messages: ConversationReminderMessage[];
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseNotificationsService {
  private firebaseApp: FirebaseApp | null = null;
  private messaging: Messaging | null = null;
  private initialized = false;
  private subscribedTopic: string | null = null;
  public chatTransferReceived$ = new Subject<{
    conversationId?: string;
    summary?: string;
    targetAgentId?: string;
  }>();
  public conversationReminderReceived$ =
    new Subject<ConversationReminderNotification>();
  public publicRegistrationCompleted$ = new Subject<PublicRegistrationNotification>();

  constructor(
    private readonly http: HttpClient,
    private readonly authService: AuthService
  ) { }

  private ensureInitialized(): void {
    if (this.initialized) {
      return;
    }

    this.firebaseApp = initializeApp(environment.firebase);
    this.messaging = getMessaging(this.firebaseApp);
    this.initialized = true;

    onMessage(this.messaging, (payload) => {
      console.log('📩 Notificación recibida en primer plano:', payload);
      this.displayForegroundNotification(payload);
    });
  }

  async subscribeLoggedUserToTopic(): Promise<void> {
    if (
      typeof window === 'undefined' ||
      typeof Notification === 'undefined' ||
      !('serviceWorker' in navigator)
    ) {
      return;
    }

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      return;
    }
    const legacyId = (currentUser as any)._id;
    if (!currentUser.id && !legacyId) {
      return;
    }

    const rawTopic = currentUser.id ?? legacyId;
    const topic = String(rawTopic ?? '').trim();
    if (!topic || this.subscribedTopic === topic) {
      return;
    }

    this.ensureInitialized();

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('🔕 Notificaciones denegadas por el usuario');
      return;
    }

    if (!this.messaging) {
      return;
    }

    try {
      const registration =
        (await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js')) ??
        (await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
          scope: '/',
        }));

      const token = await getToken(this.messaging, {
        vapidKey: environment.firebase.vapidKey,
        serviceWorkerRegistration: registration
      });

      if (!token) {
        console.warn('No se pudo obtener un token de Firebase Messaging');
        return;
      }

      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/notifications/subscribe`, {
          token,
          topic
        })
      );

      this.subscribedTopic = topic;
      console.log(`🔔 Suscrito al tópico ${topic}`);
    } catch (error) {
      console.error('Error suscribiendo al tópico de notificaciones', error);
    }
  }

  private async displayForegroundNotification(
    payload: MessagePayload
  ): Promise<void> {
    try {
      if (typeof window === 'undefined') {
        return;
      }

      const title =
        payload.data?.['title'] ||
        payload.notification?.title ||
        'Notificación';
      const body =
        payload.data?.['body'] ||
        payload.notification?.body ||
        '';
      const notificationType = String(payload.data?.['type'] || '').trim();
      const targetAgentId = String(
        payload.data?.['targetAgentId']
        || payload.data?.['agentId']
        || '',
      ).trim();

      if (
        ['chat_transfer', 'conversation_reminder_buzz'].includes(notificationType)
        && (!targetAgentId || !this.isNotificationForCurrentUser(targetAgentId))
      ) {
        return;
      }

      if (notificationType === 'conversation_reminder_buzz') {
        this.conversationReminderReceived$.next({
          conversationId: String(payload.data?.['conversationId'] || ''),
          contactName: String(payload.data?.['contactName'] || 'Cliente'),
          senderName: String(payload.data?.['senderName'] || 'Otro empleado'),
          targetAgentId,
          messages: this.parseConversationReminderMessages(
            payload.data?.['messages'],
          ),
        });
        return;
      }

      if (typeof Notification === 'undefined') {
        return;
      }

      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          return;
        }
      }

      const registration =
        (await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js')) ??
        (await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
          scope: '/',
        }));

      if (registration) {
        await registration.showNotification(title, {
          body,
          data: payload.data ?? {},
        });
      } else if ('Notification' in window) {
        new Notification(title, {
          body,
          data: payload.data ?? {},
        });
      }



      // Emitir Subject de Transferencia Global si aplica
      if (payload.data?.['tab'] === 'chat') {
        const titleMatch = title.toLowerCase().includes('transferi');
        const isTransfer = notificationType === 'chat_transfer' || titleMatch;
        if (
          isTransfer
          && targetAgentId
          && this.isNotificationForCurrentUser(targetAgentId)
        ) {
          this.chatTransferReceived$.next({ 
            conversationId: payload.data?.['conversationId'],
            summary: payload.data?.['summary'],
            targetAgentId,
          });
        }
      }

      if (payload.data?.['type'] === 'public_registration_completed') {
        this.publicRegistrationCompleted$.next({
          userId: payload.data?.['userId'],
          parentId: payload.data?.['parentId'],
          parentName: payload.data?.['parentName'],
          clientName: payload.data?.['clientName'],
          clientEmail: payload.data?.['clientEmail'],
          clientPhone: payload.data?.['clientPhone'],
          clientDni: payload.data?.['clientDni'],
          credentialsEmail: payload.data?.['credentialsEmail'],
          credentialsPassword: payload.data?.['credentialsPassword'],
          affiliationType: payload.data?.['affiliationType'],
          whatsappStatus: payload.data?.['whatsappStatus'],
          transferred: payload.data?.['transferred'],
          failed: payload.data?.['failed'],
        });
      }

    } catch (error) {
      console.error('Error mostrando notificación en primer plano', error);
    }
  }

  private parseConversationReminderMessages(
    rawMessages?: string,
  ): ConversationReminderMessage[] {
    try {
      const messages = JSON.parse(String(rawMessages || '[]'));
      if (!Array.isArray(messages)) return [];

      return messages.slice(-3).map((message: any) => ({
        from: message?.from === 'employee' ? 'employee' : 'customer',
        text: String(message?.text || 'Mensaje'),
        time: Number(message?.time || 0),
      }));
    } catch {
      return [];
    }
  }

  private isNotificationForCurrentUser(targetAgentId: string): boolean {
    const currentUser = this.authService.getCurrentUser() as any;
    if (!currentUser) return false;

    const normalizedTarget = String(targetAgentId || '').trim();
    if (!normalizedTarget) return false;

    return [currentUser.id, currentUser._id]
      .map(value => String(value || '').trim())
      .filter(Boolean)
      .includes(normalizedTarget);
  }

  sendMassNotification(data: { title: string; body: string; data?: Record<string, string>; profileTypes?: string[]; affiliationTypes?: string[]; companyTypes?: string[]; }) {
    return this.http.post<{ success: boolean; sentCount: number; errorCount: number }>(
      `${environment.apiUrl}/notifications/mass`,
      data
    );
  }

  sendTestNotification(data: { topic: string; title: string; body: string; data?: Record<string, string> }) {
    return this.http.post<{ success: boolean; messageId?: string }>(
      `${environment.apiUrl}/notifications/test`,
      data
    );
  }

  getMyNotifications() {
    return this.http.get<NotificationLog[]>(`${environment.apiUrl}/notifications/my-notifications`);
  }
}
