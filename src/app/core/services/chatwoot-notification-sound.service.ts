import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subscription, interval, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { ChatwootApiService } from './chatwoot-api.service';
import { UserService } from './user.service';

interface ChatwootConversationSummary {
  id: number;
  last_message?: string;
  last_message_time?: number | null;
  unread_count?: number;
  assignee_id?: number | null;
}

interface ConversationNotificationState {
  fingerprint: string;
  unreadCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class ChatwootNotificationSoundService implements OnDestroy {
  private pendingCountSubject = new BehaviorSubject<number>(0);
  pendingCount$ = this.pendingCountSubject.asObservable();
  private esterPendingCountSubject = new BehaviorSubject<number>(0);
  esterPendingCount$ = this.esterPendingCountSubject.asObservable();

  private pollingSubscription?: Subscription;
  private authSubscription?: Subscription;
  private audio?: HTMLAudioElement;
  private initialized = false;
  private currentUserId = '';
  private loadingUserId = '';
  private inboxId = 0;
  private agentId = '';
  private conversationState = new Map<number, ConversationNotificationState>();

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private chatwootApi: ChatwootApiService,
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

    this.userService.getById(userId).pipe(
      catchError(() => of(null)),
    ).subscribe((user: any) => {
      if (this.loadingUserId !== userId) return;

      this.loadingUserId = '';
      this.agentId = String(user?.idchatwoot || '').trim();
      this.inboxId = Number(user?.inbox || 0);

      if (!this.agentId || !this.inboxId) {
        this.stopPolling();
        return;
      }

      this.startPolling();
    });
  }

  private startPolling(): void {
    this.initialized = false;
    this.conversationState.clear();

    this.pollingSubscription = interval(5000).pipe(
      switchMap(() => this.chatwootApi.getConversations(this.inboxId, 1, this.agentId).pipe(
        catchError(() => of(null)),
      )),
    ).subscribe((response: any) => {
      if (!response?.success) return;
      this.processConversations(response.conversations || []);
    });

    this.chatwootApi.getConversations(this.inboxId, 1, this.agentId).pipe(
      catchError(() => of(null)),
    ).subscribe((response: any) => {
      if (!response?.success) return;
      this.processConversations(response.conversations || []);
    });
  }

  private stopPolling(): void {
    this.pollingSubscription?.unsubscribe();
    this.pollingSubscription = undefined;
    this.initialized = false;
    this.currentUserId = '';
    this.loadingUserId = '';
    this.inboxId = 0;
    this.agentId = '';
    this.conversationState.clear();
    this.pendingCountSubject.next(0);
    this.esterPendingCountSubject.next(0);
  }

  private processConversations(conversations: ChatwootConversationSummary[]): void {
    const nextState = new Map<number, ConversationNotificationState>();
    let shouldPlay = false;
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

      nextState.set(id, { fingerprint, unreadCount });

      if (!this.initialized) continue;

      const previousState = this.conversationState.get(id);
      if (
        unreadCount > 0 &&
        previousState &&
        previousState.fingerprint !== fingerprint &&
        unreadCount >= previousState.unreadCount
      ) {
        shouldPlay = true;
      }

      if (unreadCount > 0 && !previousState) {
        shouldPlay = true;
      }
    }

    this.conversationState = nextState;
    this.pendingCountSubject.next(totalPending);
    this.esterPendingCountSubject.next(esterPending);

    if (!this.initialized) {
      this.initialized = true;
      return;
    }

    if (shouldPlay) {
      this.playNotificationSound();
    }
  }

  private prepareAudio(): void {
    if (this.audio) return;

    this.audio = new Audio('/assets/notificacion.mp3');
    this.audio.preload = 'auto';
    this.audio.load();
  }

  private playNotificationSound(): void {
    this.prepareAudio();
    if (!this.audio) return;

    this.audio.currentTime = 0;
    this.audio.play().catch(() => undefined);
  }
}
