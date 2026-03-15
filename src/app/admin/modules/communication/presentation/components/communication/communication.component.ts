import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ChatwootApiService } from '@core/services/chatwoot-api.service';
import { AuthService } from '@core/services/auth.service';
import { UserService } from '@core/services/user.service';

interface ChatConversation {
  id: number;
  status: string;
  contact: {
    id: number;
    name: string;
    phone: string;
    email: string;
    avatar: string;
  };
  last_message: string;
  last_message_time: number | null;
  unread_count: number;
}

interface ChatAttachment {
  data_url: string;
  file_type: string;
  content_type: string;
}

interface ChatMessage {
  id?: number;
  from: 'me' | 'incoming' | 'system';
  text: string;
  time: Date;
  attachments?: ChatAttachment[];
  replyTo?: { id: number; text: string; from: string };
}

@Component({
  selector: 'app-communication',
  templateUrl: './communication.component.html',
  styleUrls: ['./communication.component.css'],
  standalone: false
})
export class CommunicationComponent implements OnInit, OnDestroy {

  // Conversations
  conversations: ChatConversation[] = [];
  filteredConversations: ChatConversation[] = [];
  searchTerm: string = '';
  loadingConversations: boolean = false;
  selectedConversation: ChatConversation | null = null;
  noInbox: boolean = false;
  autoResponse: boolean = false;
  showContactInfo: boolean = false;
  gpsUser: any = null;

  // Chat
  messages: ChatMessage[] = [];
  chatInput: string = '';
  sendingMessage: boolean = false;
  replyingTo: ChatMessage | null = null;
  // Lightbox
  lightboxUrl: string | null = null;
  lightboxType: 'image' | 'video' = 'image';
  loadingMessages: boolean = false;
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('fileInput') fileInput!: ElementRef;

  // Polling
  private chatPollingInterval: any = null;
  private conversationsPollingInterval: any = null;
  private readonly POLL_INTERVAL = 5000;

  // User inbox
  private userInboxId: number | undefined;
  private currentUserId: string = '';
  private lastApiMessageId: number | null = null;
  private conversationsFingerprint: string = '';

  constructor(
    private chatwootApi: ChatwootApiService,
    private authService: AuthService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    this.loadUserInbox();
  }

  ngOnDestroy(): void {
    this.stopChatPolling();
    this.stopConversationsPolling();
  }

  // ============================
  // USER INBOX
  // ============================

  private loadUserInbox(): void {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser?.id) {
      this.noInbox = true;
      return;
    }
    this.currentUserId = currentUser.id;
    this.userService.getById(currentUser.id).subscribe({
      next: (user: any) => {
        this.autoResponse = user?.auto_response || false;
        if (user?.inbox) {
          this.userInboxId = user.inbox;
          this.noInbox = false;
          this.loadConversations();
        } else {
          this.noInbox = true;
        }
      },
      error: () => {
        this.noInbox = true;
      }
    });
  }

  toggleAutoResponse(): void {
    if (!this.currentUserId) return;
    this.userService.update(this.currentUserId, { auto_response: this.autoResponse } as any).subscribe({
      error: () => {
        // Revert on error
        this.autoResponse = !this.autoResponse;
      }
    });
  }

  // ============================
  // CONVERSATIONS
  // ============================

  loadConversations(): void {
    this.loadingConversations = true;
    this.chatwootApi.getConversations(this.userInboxId).subscribe({
      next: (res: any) => {
        this.loadingConversations = false;
        if (res.success) {
          this.conversations = res.conversations || [];
          this.conversationsFingerprint = this.getConversationsFingerprint(this.conversations);
          this.filterConversations();
          this.startConversationsPolling();
        } else {
          this.noInbox = true;
        }
      },
      error: () => {
        this.loadingConversations = false;
        this.noInbox = true;
      }
    });
  }

  filterConversations(): void {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) {
      this.filteredConversations = [...this.conversations];
      return;
    }
    this.filteredConversations = this.conversations.filter(c =>
      c.contact.name.toLowerCase().includes(term) ||
      c.contact.phone.includes(term) ||
      c.last_message.toLowerCase().includes(term)
    );
  }

  selectConversation(conv: ChatConversation): void {
    this.selectedConversation = conv;
    this.messages = [];
    this.chatInput = '';
    this.showContactInfo = false;
    this.gpsUser = null;
    this.loadMessages();
    this.loadGpsUser(conv.contact.phone);
  }

  private loadGpsUser(phone: string): void {
    if (!phone) return;
    this.userService.getByPhone(phone).subscribe({
      next: (user: any) => {
        console.log('[Contact Panel] by-phone response:', user);
        this.gpsUser = user?._id ? user : null;
      },
      error: (err: any) => {
        console.error('[Contact Panel] by-phone error:', err);
        this.gpsUser = null;
      }
    });
  }

  private startConversationsPolling(): void {
    this.stopConversationsPolling();
    this.conversationsPollingInterval = setInterval(() => {
      this.chatwootApi.getConversations(this.userInboxId).subscribe({
        next: (res: any) => {
          if (res.success) {
            const newConvs = res.conversations || [];
            const newFingerprint = this.getConversationsFingerprint(newConvs);
            if (newFingerprint !== this.conversationsFingerprint) {
              this.conversations = newConvs;
              this.conversationsFingerprint = newFingerprint;
              this.filterConversations();
            }
          }
        }
      });
    }, 5000);
  }

  private getConversationsFingerprint(convs: ChatConversation[]): string {
    return convs.map(c => `${c.id}:${c.last_message}:${c.last_message_time}:${c.unread_count}`).join('|');
  }

  private stopConversationsPolling(): void {
    if (this.conversationsPollingInterval) {
      clearInterval(this.conversationsPollingInterval);
      this.conversationsPollingInterval = null;
    }
  }

  // ============================
  // MESSAGES
  // ============================

  loadMessages(): void {
    if (!this.selectedConversation) return;

    this.loadingMessages = true;
    this.chatwootApi.getConversationMessages(this.selectedConversation.id).subscribe({
      next: (res: any) => {
        this.loadingMessages = false;
        if (res.success && res.messages?.length) {
          // Build a quick lookup for reply references
          const msgMap = new Map<number, { text: string; from: string }>();
          for (const msg of res.messages) {
            msgMap.set(msg.id, {
              text: msg.content || '📎 Adjunto',
              from: msg.from === 'incoming' ? 'incoming' : 'me',
            });
          }
          this.messages = res.messages.map((msg: any) => {
            const mapped: ChatMessage = {
              id: msg.id,
              from: msg.from === 'incoming' ? 'incoming' as const : 'me' as const,
              text: msg.content,
              time: new Date(msg.created_at * 1000),
              attachments: msg.attachments || [],
            };
            if (msg.in_reply_to && msgMap.has(msg.in_reply_to)) {
              const ref = msgMap.get(msg.in_reply_to)!;
              mapped.replyTo = { id: msg.in_reply_to, text: ref.text, from: ref.from };
            }
            return mapped;
          });
          this.lastApiMessageId = res.messages[res.messages.length - 1].id;
        } else {
          this.lastApiMessageId = null;
        }
        this.scrollToBottom();
        this.startChatPolling();
      },
      error: () => {
        this.loadingMessages = false;
        this.startChatPolling();
      }
    });
  }

  sendMessage(): void {
    if (!this.chatInput.trim() || !this.selectedConversation || this.sendingMessage) return;

    const text = this.chatInput.trim();
    const replyMsg = this.replyingTo;
    const newMsg: ChatMessage = { from: 'me', text, time: new Date() };
    if (replyMsg) {
      newMsg.replyTo = { id: replyMsg.id!, text: replyMsg.text, from: replyMsg.from };
    }
    this.messages.push(newMsg);
    this.chatInput = '';
    this.replyingTo = null;
    this.sendingMessage = true;
    this.scrollToBottom();

    this.chatwootApi.sendConversationMessage(
      this.selectedConversation.id,
      text,
      replyMsg?.id
    ).subscribe({
      next: (res) => {
        this.sendingMessage = false;
        if (!res.success) {
          this.messages.push({ from: 'system', text: '✗ Error al enviar', time: new Date() });
        }
        this.scrollToBottom();
      },
      error: () => {
        this.sendingMessage = false;
        this.messages.push({ from: 'system', text: '✗ Error de conexión', time: new Date() });
        this.scrollToBottom();
      }
    });
  }

  setReplyTo(msg: ChatMessage): void {
    this.replyingTo = msg;
  }

  cancelReply(): void {
    this.replyingTo = null;
  }

  openMedia(url: string, type: 'image' | 'video'): void {
    this.lightboxUrl = url;
    this.lightboxType = type;
  }

  closeMedia(): void {
    this.lightboxUrl = null;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length || !this.selectedConversation) return;

    const file = input.files[0];
    input.value = ''; // Reset so same file can be selected again

    this.sendingMessage = true;
    this.messages.push({ from: 'me', text: `📎 ${file.name}`, time: new Date() });
    this.scrollToBottom();

    this.chatwootApi.sendAttachment(this.selectedConversation.id, file).subscribe({
      next: (res) => {
        this.sendingMessage = false;
        if (!res.success) {
          this.messages.push({ from: 'system', text: '✗ Error al enviar archivo', time: new Date() });
        }
        this.scrollToBottom();
      },
      error: () => {
        this.sendingMessage = false;
        this.messages.push({ from: 'system', text: '✗ Error de conexión', time: new Date() });
        this.scrollToBottom();
      }
    });
  }

  // ============================
  // POLLING
  // ============================

  private startChatPolling(): void {
    this.stopChatPolling();
    this.chatPollingInterval = setInterval(() => {
      if (!this.selectedConversation) return;

      this.chatwootApi.getConversationMessages(this.selectedConversation.id).subscribe({
        next: (res: any) => {
          if (res.success && res.messages?.length) {
            const newestId = res.messages[res.messages.length - 1].id;
            if (newestId !== this.lastApiMessageId) {
              // New messages detected — replace with latest from API
              this.messages = res.messages.map((msg: any) => ({
                from: msg.from === 'incoming' ? 'incoming' as const : 'me' as const,
                text: msg.content,
                time: new Date(msg.created_at * 1000),
                attachments: msg.attachments || [],
              }));
              this.lastApiMessageId = newestId;
              this.scrollToBottom();
            }
          }
        }
      });
    }, this.POLL_INTERVAL);
  }

  private stopChatPolling(): void {
    if (this.chatPollingInterval) {
      clearInterval(this.chatPollingInterval);
      this.chatPollingInterval = null;
    }
  }

  // ============================
  // UTILS
  // ============================

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.messagesContainer?.nativeElement) {
        this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
      }
    }, 100);
    // Second attempt after images/attachments may have loaded
    setTimeout(() => {
      if (this.messagesContainer?.nativeElement) {
        this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
      }
    }, 400);
  }

  getInitials(name: string): string {
    const parts = name.split(' ');
    return parts.map(p => p[0] || '').slice(0, 2).join('').toUpperCase();
  }

  getTimeAgo(timestamp: number | null): string {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'ahora';
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d`;
  }

  goBack(): void {
    this.stopChatPolling();
    this.selectedConversation = null;
    this.messages = [];
  }
}
