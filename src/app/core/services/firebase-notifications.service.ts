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
import { firstValueFrom } from 'rxjs';
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

@Injectable({
  providedIn: 'root'
})
export class FirebaseNotificationsService {
  private firebaseApp: FirebaseApp | null = null;
  private messaging: Messaging | null = null;
  private initialized = false;
  private subscribedTopic: string | null = null;

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
      if (typeof window === 'undefined' || typeof Notification === 'undefined') {
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

      const title =
        payload.data?.['title'] ||
        payload.notification?.title ||
        'Notificación';
      const body =
        payload.data?.['body'] ||
        payload.notification?.body ||
        '';

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
    } catch (error) {
      console.error('Error mostrando notificación en primer plano', error);
    }
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
