import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, Subscription, interval, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { WhatsAppApiService } from './whatsapp-api.service';
import { InternalChatMessage, InternalChatService } from './internal-chat.service';
import { UserService } from './user.service';

interface WhatsAppConversationSummary {
  id: number;
  last_message?: string;
  last_message_time?: number | null;
  last_message_type?: number;
  unread_count?: number;
  assignee_id?: string | null;
  assignee_name?: string;
  assignee_email?: string;
  contact?: {
    name?: string;
    phone?: string;
    email?: string;
    avatar?: string;
  };
}

interface ConversationNotificationState {
  fingerprint: string;
  unreadCount: number;
  lastMessageFingerprint: string;
}

export interface CommunicationFloatingMessage {
  source?: 'whatsapp' | 'internal';
  conversationId: number;
  groupId?: string;
  contactName: string;
  contactPhone: string;
  message: string;
  time: number | null;
  assigneeName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CommunicationNotificationService implements OnDestroy {
  private pendingCountSubject = new BehaviorSubject<number>(0);
  pendingCount$ = this.pendingCountSubject.asObservable();
  private esterPendingCountSubject = new BehaviorSubject<number>(0);
  esterPendingCount$ = this.esterPendingCountSubject.asObservable();
  private internalPendingCountSubject = new BehaviorSubject<number>(0);
  internalPendingCount$ = this.internalPendingCountSubject.asObservable();
  private internalChatMutedSubject = new BehaviorSubject<boolean>(false);
  internalChatMuted$ = this.internalChatMutedSubject.asObservable();
  private floatingMessageSubject = new Subject<CommunicationFloatingMessage>();
  floatingMessage$ = this.floatingMessageSubject.asObservable();

  private pollingSubscription?: Subscription;
  private internalPollingSubscription?: Subscription;
  private authSubscription?: Subscription;
  private audio?: HTMLAudioElement;
  private otherConversationAudio?: HTMLAudioElement;
  private internalAudio?: HTMLAudioElement;
  private initialized = false;
  private internalInitialized = false;
  private currentUserId = '';
  private loadingUserId = '';
  private inboxId = 0;
  private agentId = '';
  private conversationState = new Map<number, ConversationNotificationState>();
  private lastInternalMessageId = '';
  private internalPendingCount = 0;
  private whatsappPendingCount = 0;
  private internalChatMuted = false;

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private whatsappApi: WhatsAppApiService,
    private internalChatService: InternalChatService,
  ) {}

  start(): void {
    this.prepareAudio();

    if (!this.authSubscription) {
      this.authSubscription = this.authService.authState$.subscribe((isAuthenticated) => {
        if (isAuthenticated) {
          this.refreshAndStartPolling();
        } else {
          this.stopPolling();
        }
      });
    }

    if (this.authService.isAuthenticated()) {
      this.refreshAndStartPolling();
    }
  }

  stop(): void {
    this.authSubscription?.unsubscribe();
    this.authSubscription = undefined;
    this.stopPolling();
  }

  ngOnDestroy(): void {
    this.stop();
  }

  private refreshAndStartPolling(): void {
    const currentUser = this.authService.getCurrentUser();
    const userId = currentUser?.id || '';

    if (!userId) {
      this.stopPolling();
      return;
    }

    if (this.currentUserId === userId || this.loadingUserId === userId) {
      return;
    }

    this.stopPolling();
    this.loadingUserId = userId;
    this.currentUserId = userId;
    this.loadInternalChatMutePreference(userId);

    this.userService.getById(userId).pipe(
      catchError(() => of(null)),
    ).subscribe((user: any) => {
      if (this.loadingUserId !== userId) return;

      this.loadingUserId = '';
      if (user?.affiliation_type_id !== 'empleado') {
        this.stopPolling();
        return;
      }

      this.agentId = String(user?._id || user?.id || userId).trim();
      this.inboxId = 5;
      this.startInternalChatPolling();

      if (!this.agentId || !this.inboxId) {
        this.stopWhatsAppPolling();
        return;
      }

      this.startPolling();
    });
  }

  private startPolling(): void {
    this.initialized = false;
    this.conversationState.clear();

    this.pollingSubscription = interval(5000).pipe(
      switchMap(() => this.whatsappApi.getConversations(this.inboxId, 1, this.agentId, true).pipe(
        catchError(() => of(null)),
      )),
    ).subscribe((response: any) => {
      if (!response?.success) return;
      this.processConversations(response.conversations || []);
    });

    this.whatsappApi.getConversations(this.inboxId, 1, this.agentId, true).pipe(
      catchError(() => of(null)),
    ).subscribe((response: any) => {
      if (!response?.success) return;
      this.processConversations(response.conversations || []);
    });
  }

  private stopPolling(): void {
    this.stopWhatsAppPolling();
    this.initialized = false;
    this.currentUserId = '';
    this.loadingUserId = '';
    this.inboxId = 0;
    this.agentId = '';
    this.conversationState.clear();
    this.pendingCountSubject.next(0);
    this.esterPendingCountSubject.next(0);
    this.stopInternalChatPolling();
    this.internalPendingCount = 0;
    this.whatsappPendingCount = 0;
    this.lastInternalMessageId = '';
    this.internalPendingCountSubject.next(0);
  }

  private stopWhatsAppPolling(): void {
    this.pollingSubscription?.unsubscribe();
    this.pollingSubscription = undefined;
    this.whatsappPendingCount = 0;
    this.pendingCountSubject.next(this.internalPendingCount);
  }

  private processConversations(conversations: WhatsAppConversationSummary[]): void {
    const nextState = new Map<number, ConversationNotificationState>();
    let shouldPlayAssignedToMe = false;
    let shouldPlayOtherConversation = false;
    let totalPending = 0;
    let esterPending = 0;

    for (const conversation of conversations) {
      const id = Number(conversation.id);
      if (!id) continue;

      const unreadCount = Number(conversation.unread_count || 0);
      totalPending += unreadCount;
      if (!conversation.assignee_id) {
        esterPending += unreadCount;
      }
      const fingerprint = [
        conversation.last_message || '',
        conversation.last_message_time || '',
        unreadCount,
      ].join('|');
      const lastMessageFingerprint = [
        conversation.last_message || '',
        conversation.last_message_time || '',
        conversation.last_message_type ?? '',
      ].join('|');

      nextState.set(id, { fingerprint, unreadCount, lastMessageFingerprint });

      if (!this.initialized) continue;

      const previousState = this.conversationState.get(id);
      const hasNewLastMessage = previousState
        ? previousState.lastMessageFingerprint !== lastMessageFingerprint
        : Boolean(conversation.last_message || conversation.last_message_time);
      const isIncoming = this.isIncomingMessage(conversation);

      if (hasNewLastMessage && isIncoming) {
        if (this.isAssignedToCurrentUser(conversation)) {
          shouldPlayAssignedToMe = true;
        } else {
          shouldPlayOtherConversation = true;
        }
        this.emitFloatingMessage(conversation);
        continue;
      }

      if (
        unreadCount > 0 &&
        previousState &&
        previousState.fingerprint !== fingerprint &&
        unreadCount >= previousState.unreadCount
      ) {
        if (this.isAssignedToCurrentUser(conversation)) {
          shouldPlayAssignedToMe = true;
        } else {
          shouldPlayOtherConversation = true;
        }
        this.emitFloatingMessage(conversation);
      }

      if (unreadCount > 0 && !previousState) {
        if (this.isAssignedToCurrentUser(conversation)) {
          shouldPlayAssignedToMe = true;
        } else {
          shouldPlayOtherConversation = true;
        }
        this.emitFloatingMessage(conversation);
      }
    }

    this.conversationState = nextState;
    this.whatsappPendingCount = totalPending;
    this.emitTotalPendingCount();
    this.esterPendingCountSubject.next(esterPending);

    if (!this.initialized) {
      this.initialized = true;
      return;
    }

    if (shouldPlayOtherConversation) {
      this.playOtherConversationNotificationSound();
    } else if (shouldPlayAssignedToMe) {
      this.playNotificationSound();
    }
  }

  private startInternalChatPolling(): void {
    this.stopInternalChatPolling();
    this.internalInitialized = false;
    this.lastInternalMessageId = '';

    this.internalChatService.getMessages({ limit: 1, allGroups: true }).pipe(
      catchError(() => of(null)),
    ).subscribe((response) => {
      const latest = response?.messages?.[response.messages.length - 1];
      this.lastInternalMessageId = latest?._id || '';
      this.internalInitialized = true;
    });

    this.internalPollingSubscription = interval(5000).pipe(
      switchMap(() => {
        const options: {
          limit?: number;
          after?: string;
          allGroups?: boolean;
        } = this.lastInternalMessageId
          ? {
            limit: 50,
            after: this.lastInternalMessageId,
            allGroups: true,
          }
          : { limit: 1, allGroups: true };
        return this.internalChatService.getMessages(options).pipe(catchError(() => of(null)));
      }),
    ).subscribe((response) => {
      const messages = response?.messages || [];
      if (!messages.length) return;

      this.lastInternalMessageId = messages[messages.length - 1]?._id || this.lastInternalMessageId;
      if (!this.internalInitialized) {
        this.internalInitialized = true;
        return;
      }

      const incomingMessages = messages.filter((message) => !this.isMyInternalMessage(message));
      if (!incomingMessages.length) return;

      if (this.internalChatMuted) {
        return;
      }

      this.internalPendingCount += incomingMessages.length;
      this.internalPendingCountSubject.next(this.internalPendingCount);
      this.emitTotalPendingCount();
      this.emitInternalFloatingMessage(incomingMessages[incomingMessages.length - 1]);
      this.playInternalNotificationSound();
    });
  }

  private stopInternalChatPolling(): void {
    this.internalPollingSubscription?.unsubscribe();
    this.internalPollingSubscription = undefined;
    this.internalInitialized = false;
  }

  markInternalChatRead(): void {
    this.internalPendingCount = 0;
    this.internalPendingCountSubject.next(0);
    this.emitTotalPendingCount();
  }

  isInternalChatMuted(): boolean {
    return this.internalChatMuted;
  }

  setInternalChatMuted(muted: boolean): void {
    this.internalChatMuted = muted;
    this.internalChatMutedSubject.next(muted);
    this.saveInternalChatMutePreference(muted);

    if (muted) {
      this.markInternalChatRead();
    }
  }

  toggleInternalChatMuted(): boolean {
    const next = !this.internalChatMuted;
    this.setInternalChatMuted(next);
    return next;
  }

  playReminderBuzz(): void {
    this.playNotificationSound();
  }

  private emitTotalPendingCount(): void {
    this.pendingCountSubject.next(this.whatsappPendingCount + this.internalPendingCount);
  }

  private loadInternalChatMutePreference(userId: string): void {
    const muted = localStorage.getItem(this.getInternalChatMuteStorageKey(userId)) === 'true';
    this.internalChatMuted = muted;
    this.internalChatMutedSubject.next(muted);
    if (muted) {
      this.internalPendingCount = 0;
      this.internalPendingCountSubject.next(0);
      this.emitTotalPendingCount();
    }
  }

  private saveInternalChatMutePreference(muted: boolean): void {
    if (!this.currentUserId) return;
    localStorage.setItem(this.getInternalChatMuteStorageKey(this.currentUserId), String(muted));
  }

  private getInternalChatMuteStorageKey(userId: string): string {
    return `montao_internal_chat_muted_${userId}`;
  }

  private prepareAudio(): void {
    if (!this.audio) {
      this.audio = new Audio('/assets/notificacion.mp3');
      this.audio.preload = 'auto';
      this.audio.load();
    }

    if (!this.otherConversationAudio) {
      this.otherConversationAudio = new Audio('/assets/other-conversation-notification.mp3');
      this.otherConversationAudio.preload = 'auto';
      this.otherConversationAudio.load();
    }

    if (!this.internalAudio) {
      this.internalAudio = new Audio('/assets/internal-chat-notification.mp3');
      this.internalAudio.preload = 'auto';
      this.internalAudio.load();
    }
  }

  private playNotificationSound(): void {
    this.prepareAudio();
    if (!this.audio) return;

    this.audio.currentTime = 0;
    this.audio.play().catch(() => undefined);
  }

  private playOtherConversationNotificationSound(): void {
    this.prepareAudio();
    if (!this.otherConversationAudio) return;

    this.otherConversationAudio.currentTime = 0;
    this.otherConversationAudio.play().catch(() => undefined);
  }

  private playInternalNotificationSound(): void {
    this.prepareAudio();
    if (!this.internalAudio) return;

    this.internalAudio.currentTime = 0;
    this.internalAudio.play().catch(() => undefined);
  }

  private emitFloatingMessage(conversation: WhatsAppConversationSummary): void {
    if (!this.isIncomingMessage(conversation)) return;

    this.floatingMessageSubject.next({
      source: 'whatsapp',
      conversationId: Number(conversation.id),
      contactName: conversation.contact?.name || conversation.contact?.phone || 'Contacto sin nombre',
      contactPhone: conversation.contact?.phone || '',
      message: conversation.last_message || 'Nuevo mensaje recibido',
      time: conversation.last_message_time || null,
      assigneeName: conversation.assignee_name || conversation.assignee_email || undefined,
    });
  }

  private isIncomingMessage(conversation: WhatsAppConversationSummary): boolean {
    const lastMessageType = conversation.last_message_type;
    return lastMessageType === undefined || lastMessageType === null || Number(lastMessageType) === 0;
  }

  private isAssignedToCurrentUser(conversation: WhatsAppConversationSummary): boolean {
    const assigneeId = String(conversation.assignee_id || '').trim();
    return Boolean(assigneeId && assigneeId === String(this.agentId || '').trim());
  }

  private emitInternalFloatingMessage(message: InternalChatMessage): void {
    this.floatingMessageSubject.next({
      source: 'internal',
      conversationId: 0,
      groupId: message.groupId,
      contactName: this.getInternalAuthorName(message),
      contactPhone: String(message.groupId || '').startsWith('technician:')
        ? 'Grupo de instalaciones'
        : 'Montao GPS',
      message: message.text || 'Nuevo mensaje en el grupo',
      time: message.createdAt ? Math.floor(new Date(message.createdAt).getTime() / 1000) : null,
    });
  }

  private isMyInternalMessage(message: InternalChatMessage): boolean {
    return String(message?.author?._id || '') === String(this.currentUserId || '');
  }

  private getInternalAuthorName(message: InternalChatMessage): string {
    const author = message?.author;
    const fullName = `${author?.name || ''} ${author?.last_name || ''}`.trim();
    return fullName || author?.email || 'Empleado';
  }
}
