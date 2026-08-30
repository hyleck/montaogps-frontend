import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, Subscription, forkJoin, interval, of } from 'rxjs';
import { catchError, filter, map, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { WhatsAppApiService } from './whatsapp-api.service';
import { InternalChatMessage, InternalChatService } from './internal-chat.service';
import { UserService } from './user.service';

interface WhatsAppConversationSummary {
  id: number;
  status?: string;
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
  esterAssigned: boolean;
}

export interface CommunicationFloatingMessage {
  source?: 'whatsapp' | 'internal';
  conversationId: number;
  groupId?: string;
  contactName: string;
  contactPhone: string;
  avatar?: string;
  message: string;
  time: number | null;
  assigneeName?: string;
}

export interface AssignedCommunicationChat {
  conversationId: number;
  contactName: string;
  contactPhone: string;
  avatar: string;
  lastMessage: string;
  time: number | null;
  unreadCount: number;
}

export interface FloatingAssignedChatRequest {
  conversationId: number;
  chat?: AssignedCommunicationChat;
}

@Injectable({
  providedIn: 'root'
})
export class CommunicationNotificationService implements OnDestroy {
  private pendingCountSubject = new BehaviorSubject<number>(0);
  // Este contador alimenta el badge del sidebar. Solo incluye WhatsApp,
  // porque son las conversaciones que se muestran al abrir Comunicación.
  pendingCount$ = this.pendingCountSubject.asObservable();
  private esterPendingCountSubject = new BehaviorSubject<number>(0);
  esterPendingCount$ = this.esterPendingCountSubject.asObservable();
  private internalPendingCountSubject = new BehaviorSubject<number>(0);
  internalPendingCount$ = this.internalPendingCountSubject.asObservable();
  private technicianPendingCountSubject = new BehaviorSubject<number>(0);
  technicianPendingCount$ = this.technicianPendingCountSubject.asObservable();
  private adminPendingCountSubject = new BehaviorSubject<number>(0);
  adminPendingCount$ = this.adminPendingCountSubject.asObservable();
  private internalChatMutedSubject = new BehaviorSubject<boolean>(false);
  internalChatMuted$ = this.internalChatMutedSubject.asObservable();
  private floatingMessageSubject = new BehaviorSubject<CommunicationFloatingMessage | null>(null);
  floatingMessage$ = this.floatingMessageSubject.asObservable().pipe(
    filter((message): message is CommunicationFloatingMessage => message !== null),
  );
  private assignedChatsSubject = new BehaviorSubject<AssignedCommunicationChat[]>([]);
  assignedChats$ = this.assignedChatsSubject.asObservable();
  private floatingAssignedChatRequestedSubject = new Subject<FloatingAssignedChatRequest>();
  floatingAssignedChatRequested$ = this.floatingAssignedChatRequestedSubject.asObservable();
  private floatingTechniciansRequestedSubject = new Subject<string | null>();
  floatingTechniciansRequested$ = this.floatingTechniciansRequestedSubject.asObservable();
  private floatingAdminRequestedSubject = new Subject<string | null>();
  floatingAdminRequested$ = this.floatingAdminRequestedSubject.asObservable();

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
  private technicianPendingCount = 0;
  private adminPendingCount = 0;
  private whatsappPendingCount = 0;
  private internalChatMuted = false;
  private assignedChatsFingerprint = '';
  private floatingMessageTimer?: ReturnType<typeof setTimeout>;

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

  openFloatingAssignedChat(
    conversationId?: number,
    chat?: AssignedCommunicationChat | null,
  ): void {
    const normalizedConversationId = Number(conversationId || chat?.conversationId || 0);
    if (!normalizedConversationId) return;
    this.floatingAssignedChatRequestedSubject.next({
      conversationId: normalizedConversationId,
      ...(chat ? { chat: { ...chat, conversationId: normalizedConversationId } } : {}),
    });
  }

  openFloatingTechnicians(groupId?: string): void {
    this.floatingTechniciansRequestedSubject.next(
      String(groupId || '').trim() || null,
    );
  }

  openFloatingAdmin(groupId?: string): void {
    this.floatingAdminRequestedSubject.next(
      String(groupId || '').trim() || null,
    );
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
      switchMap(() => this.loadConversationNotificationSnapshot()),
    ).subscribe((snapshot) => {
      if (!snapshot.all?.success) return;
      this.processConversations(
        snapshot.all.conversations || [],
        snapshot.assigned?.success ? snapshot.assigned.conversations || [] : undefined,
      );
    });

    this.loadConversationNotificationSnapshot().subscribe((snapshot) => {
      if (!snapshot.all?.success) return;
      this.processConversations(
        snapshot.all.conversations || [],
        snapshot.assigned?.success ? snapshot.assigned.conversations || [] : undefined,
      );
    });
  }

  private loadConversationNotificationSnapshot() {
    return forkJoin({
      all: this.whatsappApi.getConversations(
        this.inboxId,
        1,
        this.agentId,
        true,
      ).pipe(catchError(() => of(null))),
      assigned: this.loadAllAssignedConversations()
        .pipe(catchError(() => of(null))),
    });
  }

  private loadAllAssignedConversations() {
    const loadPage = (page: number) => this.whatsappApi.getConversations(
      this.inboxId,
      page,
      undefined,
      true,
      '',
      'all',
      true,
    );

    return loadPage(1).pipe(
      switchMap((firstPage: any) => {
        if (!firstPage?.success) return of(firstPage);
        const totalPages = Math.max(1, Number(firstPage?.meta?.total_pages) || 1);
        if (totalPages === 1) return of(firstPage);

        const remainingPages = Array.from(
          { length: totalPages - 1 },
          (_, index) => index + 2,
        );
        return forkJoin(
          remainingPages.map(page => loadPage(page).pipe(catchError(() => of(null)))),
        ).pipe(
          map((responses: any[]) => ({
            ...firstPage,
            conversations: [
              ...(firstPage.conversations || []),
              ...responses.flatMap(response => (
                response?.success ? response.conversations || [] : []
              )),
            ],
          })),
        );
      }),
    );
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
    this.assignedChatsFingerprint = '';
    this.assignedChatsSubject.next([]);
    this.clearFloatingMessage();
    this.stopInternalChatPolling();
    this.internalPendingCount = 0;
    this.technicianPendingCount = 0;
    this.adminPendingCount = 0;
    this.whatsappPendingCount = 0;
    this.lastInternalMessageId = '';
    this.internalPendingCountSubject.next(0);
    this.technicianPendingCountSubject.next(0);
    this.adminPendingCountSubject.next(0);
  }

  private stopWhatsAppPolling(): void {
    this.pollingSubscription?.unsubscribe();
    this.pollingSubscription = undefined;
    this.whatsappPendingCount = 0;
    this.pendingCountSubject.next(0);
  }

  private processConversations(
    conversations: WhatsAppConversationSummary[],
    assignedConversations?: WhatsAppConversationSummary[],
  ): void {
    const nextState = new Map<number, ConversationNotificationState>();
    const assignedChats: AssignedCommunicationChat[] = (
      assignedConversations || conversations
    )
      .filter(conversation => (
        Boolean(String(conversation?.assignee_id || '').trim())
        && this.isActiveAssignedConversation(conversation)
      ))
      .map(conversation => ({
        conversationId: Number(conversation.id),
        contactName: conversation.contact?.name
          || conversation.contact?.phone
          || 'Contacto sin nombre',
        contactPhone: conversation.contact?.phone || '',
        avatar: conversation.contact?.avatar || '',
        lastMessage: conversation.last_message || 'Sin mensajes recientes',
        time: conversation.last_message_time || null,
        unreadCount: Number(conversation.unread_count || 0),
      }))
      .filter(chat => Boolean(chat.conversationId));
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

      nextState.set(id, {
        fingerprint,
        unreadCount,
        lastMessageFingerprint,
        esterAssigned: !conversation.assignee_id,
      });

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
    this.publishAssignedChats(assignedChats);
    this.whatsappPendingCount = totalPending;
    this.emitWhatsAppPendingCount();
    this.esterPendingCountSubject.next(esterPending);

    if (!this.initialized) {
      this.initialized = true;
      const latestUnreadConversation = conversations
        .filter(conversation => (
          Number(conversation.unread_count || 0) > 0
          && this.isIncomingMessage(conversation)
        ))
        .sort((left, right) => (
          Number(right.last_message_time || 0) - Number(left.last_message_time || 0)
        ))[0];
      if (latestUnreadConversation) {
        this.emitFloatingMessage(latestUnreadConversation);
      }
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
      const technicianMessages = incomingMessages.filter((message) =>
        String(message?.groupId || '').startsWith('technician:'),
      );
      if (technicianMessages.length) {
        this.technicianPendingCount += technicianMessages.length;
        this.technicianPendingCountSubject.next(this.technicianPendingCount);
      }
      const adminMessages = incomingMessages.filter((message) =>
        !String(message?.groupId || '').startsWith('technician:'),
      );
      if (adminMessages.length) {
        this.adminPendingCount += adminMessages.length;
        this.adminPendingCountSubject.next(this.adminPendingCount);
      }
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
  }

  markWhatsAppConversationRead(conversationId: number): void {
    const normalizedConversationId = Number(conversationId || 0);
    const currentState = this.conversationState.get(normalizedConversationId);
    if (!normalizedConversationId || !currentState || currentState.unreadCount <= 0) {
      return;
    }

    const readCount = currentState.unreadCount;
    this.conversationState.set(normalizedConversationId, {
      ...currentState,
      unreadCount: 0,
      fingerprint: currentState.fingerprint.replace(/\|[^|]*$/, '|0'),
    });
    this.whatsappPendingCount = Math.max(0, this.whatsappPendingCount - readCount);
    this.emitWhatsAppPendingCount();
    this.publishAssignedChats(
      this.assignedChatsSubject.value.map(chat =>
        chat.conversationId === normalizedConversationId
          ? { ...chat, unreadCount: 0 }
          : chat,
      ),
    );

    if (currentState.esterAssigned) {
      this.esterPendingCountSubject.next(
        Math.max(0, this.esterPendingCountSubject.value - readCount),
      );
    }
  }

  syncInternalPendingCount(count: number): void {
    this.internalPendingCount = this.internalChatMuted
      ? 0
      : Math.max(0, Number(count) || 0);
    this.internalPendingCountSubject.next(this.internalPendingCount);
  }

  syncTechnicianPendingCount(count: number): void {
    this.technicianPendingCount = this.internalChatMuted
      ? 0
      : Math.max(0, Number(count) || 0);
    this.technicianPendingCountSubject.next(this.technicianPendingCount);
  }

  syncAdminPendingCount(count: number): void {
    this.adminPendingCount = this.internalChatMuted
      ? 0
      : Math.max(0, Number(count) || 0);
    this.adminPendingCountSubject.next(this.adminPendingCount);
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
      this.syncTechnicianPendingCount(0);
      this.syncAdminPendingCount(0);
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

  private emitWhatsAppPendingCount(): void {
    this.pendingCountSubject.next(this.whatsappPendingCount);
  }

  private loadInternalChatMutePreference(userId: string): void {
    const muted = localStorage.getItem(this.getInternalChatMuteStorageKey(userId)) === 'true';
    this.internalChatMuted = muted;
    this.internalChatMutedSubject.next(muted);
    if (muted) {
      this.internalPendingCount = 0;
      this.internalPendingCountSubject.next(0);
      this.technicianPendingCount = 0;
      this.technicianPendingCountSubject.next(0);
      this.adminPendingCount = 0;
      this.adminPendingCountSubject.next(0);
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

    this.publishFloatingMessage({
      source: 'whatsapp',
      conversationId: Number(conversation.id),
      contactName: conversation.contact?.name || conversation.contact?.phone || 'Contacto sin nombre',
      contactPhone: conversation.contact?.phone || '',
      avatar: conversation.contact?.avatar || '',
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

  private isActiveAssignedConversation(conversation: WhatsAppConversationSummary): boolean {
    const status = String(conversation.status || '').trim().toLowerCase();
    return status !== 'resolved' && status !== 'closed';
  }

  private publishAssignedChats(chats: AssignedCommunicationChat[]): void {
    const ordered = [...chats].sort((left, right) =>
      Number(right.unreadCount > 0) - Number(left.unreadCount > 0)
      || (Number(right.time || 0) - Number(left.time || 0))
      || left.contactName.localeCompare(right.contactName, 'es'),
    );
    const fingerprint = ordered.map(chat => [
      chat.conversationId,
      chat.contactName,
      chat.contactPhone,
      chat.avatar,
      chat.lastMessage,
      chat.time || '',
      chat.unreadCount,
    ].join('|')).join('::');
    if (fingerprint === this.assignedChatsFingerprint) return;
    this.assignedChatsFingerprint = fingerprint;
    this.assignedChatsSubject.next(ordered);
  }

  private emitInternalFloatingMessage(message: InternalChatMessage): void {
    if (this.isEsterEmployeeGroupMessage(message)) return;

    this.publishFloatingMessage({
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

  private isEsterEmployeeGroupMessage(message: InternalChatMessage): boolean {
    if (String(message?.groupId || 'admin') !== 'admin') return false;
    const authorId = String(message?.author?._id || '').trim().toLowerCase();
    const affiliation = String(
      message?.author?.affiliation_type_id || '',
    ).trim().toLowerCase();
    return authorId === 'ester-assistant' || affiliation === 'assistant';
  }

  private publishFloatingMessage(message: CommunicationFloatingMessage): void {
    this.floatingMessageSubject.next(message);
    if (this.floatingMessageTimer) clearTimeout(this.floatingMessageTimer);
    this.floatingMessageTimer = setTimeout(() => {
      this.floatingMessageSubject.next(null);
      this.floatingMessageTimer = undefined;
    }, 10000);
  }

  private clearFloatingMessage(): void {
    this.floatingMessageSubject.next(null);
    if (!this.floatingMessageTimer) return;
    clearTimeout(this.floatingMessageTimer);
    this.floatingMessageTimer = undefined;
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
