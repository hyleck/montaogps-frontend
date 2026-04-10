import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
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
  inbox_id?: number;
  last_message_type?: number;
  labels?: string[];
}

interface EmailInbox {
  id: number;
  email: string;
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
  parsedHtml?: string;
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
  activeTab: 'chat' | 'correo' = 'chat';
  autoResponse: boolean = false;
  showContactInfo: boolean = false;
  gpsUser: any = null;

  // Email (merged from all email inboxes)
  emailConversations: ChatConversation[] = [];
  filteredEmailConversations: ChatConversation[] = [];
  emailSearchTerm: string = '';
  loadingEmailConversations: boolean = false;
  selectedEmail: ChatConversation | null = null;
  emailMessages: ChatMessage[] = [];
  loadingEmailMessages: boolean = false;
  hasEmailInbox: boolean = false;
  emailInboxes: EmailInbox[] = [];
  selectedInboxFilter: number = 0; // 0 = all
  selectedTypeFilter: 'received' | 'sent' | 'spam' = 'received';
  composeFromInboxId: number = 0;
  showCompose: boolean = false;
  composeEmail: string = '';
  composeSubject: string = '';
  composeBody: string = '';
  sendingEmail: boolean = false;
  emailReplyInput: string = '';
  sendingEmailReply: boolean = false;
  composeFiles: File[] = [];
  emailReplyFile: File | null = null;

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
  private userInbox2Id: number | undefined;
  private userInbox3Id: number | undefined;
  private emailInboxIds: number[] = [];
  private currentUserId: string = '';
  currentUserEmail: string = '';
  inboxEmail: string = '';
  private lastApiMessageId: number | null = null;
  private conversationsFingerprint: string = '';
  private pendingConversationId: number | null = null;
  private chatwootAgentId: string = '';
  private currentUserName: string = '';
  private currentUserDepartment: string = '';

  constructor(
    private chatwootApi: ChatwootApiService,
    private authService: AuthService,
    private userService: UserService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadUserInbox();
    this.route.params.subscribe(params => {
      const tab = params['tab'];
      if (tab === 'chat' || tab === 'correo') {
        this.activeTab = tab;
      }
      const convId = params['conversationId'];
      if (convId) {
        this.pendingConversationId = +convId;
      }
    });
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
        this.currentUserEmail = user?.email || '';
        this.chatwootAgentId = user?.idchatwoot || '';
        this.currentUserName = user?.name || 'Agente';
        this.currentUserDepartment = user?.department_id || '';
        
        if (user?.inbox) {
          this.userInboxId = user.inbox;
          this.noInbox = false;
          this.loadConversations();
        } else {
          this.noInbox = true;
        }
        if (user?.inbox2) {
          this.userInbox2Id = user.inbox2;
          this.emailInboxIds.push(user.inbox2);
          this.loadInboxEmail();
        }
        if (user?.inbox3) {
          this.userInbox3Id = user.inbox3;
          this.emailInboxIds.push(user.inbox3);
        }
        this.hasEmailInbox = this.emailInboxIds.length > 0;
        if (this.hasEmailInbox) {
          this.loadEmailConversations();
          this.loadAllInboxEmails();
        }
      },
      error: () => {
        this.noInbox = true;
        this.hasEmailInbox = false;
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

  navigateToTab(tab: 'chat' | 'correo'): void {
    this.router.navigate(['/admin/communication', tab]);
  }

  private loadInboxEmail(): void {
    if (!this.userInbox2Id) return;
    this.chatwootApi.getInboxDetails(this.userInbox2Id).subscribe({
      next: (res: any) => {
        if (res.success && res.inbox?.email) {
          this.inboxEmail = res.inbox.email;
        }
      }
    });
  }

  private loadAllInboxEmails(): void {
    this.emailInboxes = [];
    for (const inboxId of this.emailInboxIds) {
      this.chatwootApi.getInboxDetails(inboxId).subscribe({
        next: (res: any) => {
          if (res.success && res.inbox) {
            this.emailInboxes.push({
              id: inboxId,
              email: res.inbox.email || `Bandeja ${inboxId}`
            });
            // Default compose inbox to first one
            if (!this.composeFromInboxId && this.emailInboxes.length === 1) {
              this.composeFromInboxId = inboxId;
            }
          }
        }
      });
    }
  }

  // ============================
  // EMAIL (INBOX 2)
  // ============================

  loadEmailConversations(): void {
    this.loadingEmailConversations = true;
    const requests = this.emailInboxIds.map(id =>
      this.chatwootApi.getConversations(id)
    );
    if (requests.length === 0) {
      this.loadingEmailConversations = false;
      return;
    }
    forkJoin(requests).subscribe({
      next: (results: any[]) => {
        this.loadingEmailConversations = false;
        let allConversations: ChatConversation[] = [];
        results.forEach((res, index) => {
          if (res.success) {
            const convs = (res.conversations || []).map((c: ChatConversation) => ({
              ...c,
              inbox_id: this.emailInboxIds[index]
            }));
            allConversations = allConversations.concat(convs);
          }
        });
        // Sort by most recent message
        allConversations.sort((a, b) => (b.last_message_time || 0) - (a.last_message_time || 0));
        this.emailConversations = allConversations;
        this.filterEmailConversations();
        if (this.pendingConversationId && this.activeTab === 'correo') {
          const conv = this.emailConversations.find(c => c.id === this.pendingConversationId);
          if (conv) this.selectEmail(conv, false);
          this.pendingConversationId = null;
        }
      },
      error: () => {
        this.loadingEmailConversations = false;
      }
    });
  }

  filterEmailConversations(): void {
    let source = this.emailConversations;

    // Filter by Inbox
    if (this.selectedInboxFilter !== 0) {
      source = source.filter(c => c.inbox_id === this.selectedInboxFilter);
    }

    // Filter by Type (received vs sent vs spam)
    if (this.selectedTypeFilter === 'spam') {
      source = source.filter(c => c.labels?.includes('spam') || c.labels?.includes('Spam'));
    } else if (this.selectedTypeFilter === 'sent') {
      source = source.filter(c => c.last_message_type === 1 && !c.labels?.includes('spam') && !c.labels?.includes('Spam'));
    } else { // 'received' as default
      source = source.filter(c => c.last_message_type !== 1 && !c.labels?.includes('spam') && !c.labels?.includes('Spam'));
    }

    if (!this.emailSearchTerm.trim()) {
      this.filteredEmailConversations = [...source];
    } else {
      const term = this.emailSearchTerm.toLowerCase();
      this.filteredEmailConversations = source.filter(c =>
        c.contact.name.toLowerCase().includes(term) ||
        (c.last_message || '').toLowerCase().includes(term)
      );
    }
  }

  setTypeFilter(type: 'received' | 'sent' | 'spam'): void {
    this.selectedTypeFilter = type;
    this.filterEmailConversations();
  }

  selectEmail(conv: ChatConversation, navigate: boolean = true): void {
    this.selectedEmail = conv;
    this.loadEmailMessages();
    if (navigate) {
      this.router.navigate(['/admin/communication', 'correo', conv.id]);
    }
  }

  loadEmailMessages(): void {
    if (!this.selectedEmail) return;
    this.loadingEmailMessages = true;
    this.chatwootApi.getConversationMessages(this.selectedEmail.id).subscribe({
      next: (res: any) => {
        this.loadingEmailMessages = false;
        if (res.success && res.messages?.length) {
          this.emailMessages = res.messages.map((msg: any) => ({
            id: msg.id,
            from: msg.from === 'incoming' ? 'incoming' as const : 'me' as const,
            text: msg.content,
            time: new Date(msg.created_at * 1000),
            attachments: msg.attachments || [],
          }));
        } else {
          this.emailMessages = [];
        }
      },
      error: () => {
        this.loadingEmailMessages = false;
      }
    });
  }

  goBackEmail(): void {
    this.selectedEmail = null;
    this.emailMessages = [];
    this.router.navigate(['/admin/communication', 'correo']);
  }

  openCompose(): void {
    this.showCompose = true;
    this.sendingEmail = false;
    this.composeEmail = '';
    this.composeSubject = '';
    this.composeBody = '';
    this.composeFiles = [];
    if (this.emailInboxes.length > 0) {
      this.composeFromInboxId = this.emailInboxes[0].id;
    }
  }

  closeCompose(): void {
    this.showCompose = false;
    this.sendingEmail = false;
    this.composeFiles = [];
  }

  sendComposedEmail(): void {
    if (!this.composeEmail.trim() || !this.composeBody.trim()) return;
    this.sendingEmail = true;
    const fullMessage = this.composeSubject.trim()
      ? `${this.composeSubject.trim()}\n\n${this.composeBody.trim()}`
      : this.composeBody.trim();

    const files = this.composeFiles.length > 0 ? this.composeFiles : undefined;
    this.chatwootApi.sendMessage(this.composeEmail.trim(), fullMessage, undefined, this.composeFromInboxId || this.userInbox2Id, files).subscribe({
      next: () => {
        this.sendingEmail = false;
        this.showCompose = false;
        this.composeFiles = [];
        this.loadEmailConversations();
      },
      error: () => {
        this.sendingEmail = false;
      }
    });
  }

  sendEmailReply(): void {
    if (!this.selectedEmail) return;
    // Allow sending file without text or text without file
    if (!this.emailReplyInput.trim() && !this.emailReplyFile) return;
    this.sendingEmailReply = true;

    const sendTextAndFile = () => {
      // Send text message
      const replyText = this.emailReplyInput.trim();
      const textObs = replyText
        ? this.chatwootApi.sendConversationMessage(this.selectedEmail!.id, replyText, undefined, undefined, this.chatwootAgentId)
        : of(null);

      textObs.subscribe({
        next: () => {
          if (this.emailReplyInput.trim()) {
            const sentMsg: ChatMessage = {
              id: Date.now(),
              from: 'me',
              text: this.emailReplyInput.trim(),
              time: new Date(),
              attachments: []
            };
            this.emailMessages.push(sentMsg);
          }
          this.emailReplyInput = '';

          // Send file if any
          if (this.emailReplyFile && this.selectedEmail) {
            this.chatwootApi.sendAttachment(this.selectedEmail.id, this.emailReplyFile).subscribe({
              next: () => {
                this.sendingEmailReply = false;
                const fileMsg: ChatMessage = {
                  id: Date.now() + 1,
                  from: 'me',
                  text: '📎 Archivo adjunto enviado',
                  time: new Date(),
                  attachments: []
                };
                this.emailMessages.push(fileMsg);
                this.emailReplyFile = null;
              },
              error: () => {
                this.sendingEmailReply = false;
                this.emailReplyFile = null;
              }
            });
          } else {
            this.sendingEmailReply = false;
          }
        },
        error: () => {
          this.sendingEmailReply = false;
        }
      });
    };

    sendTextAndFile();
  }

  onComposeFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      for (let i = 0; i < input.files.length; i++) {
        this.composeFiles.push(input.files[i]);
      }
      input.value = '';
    }
  }

  removeComposeFile(index: number): void {
    this.composeFiles.splice(index, 1);
  }

  onEmailReplyFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.emailReplyFile = input.files[0];
      input.value = '';
    }
  }

  removeEmailReplyFile(): void {
    this.emailReplyFile = null;
  }

  // ============================
  // CONVERSATIONS
  // ============================

  loadConversations(): void {
    this.loadingConversations = true;
    this.chatwootApi.getConversations(this.userInboxId, 1, this.chatwootAgentId).subscribe({
      next: (res: any) => {
        this.loadingConversations = false;
        if (res.success) {
          this.conversations = res.conversations || [];
          this.conversationsFingerprint = this.getConversationsFingerprint(this.conversations);
          this.filterConversations();
          this.startConversationsPolling();
          if (this.pendingConversationId && this.activeTab === 'chat') {
            const conv = this.conversations.find(c => c.id === this.pendingConversationId);
            if (conv) this.selectConversation(conv, false);
            this.pendingConversationId = null;
          }
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

  selectConversation(conv: ChatConversation, navigate: boolean = true): void {
    this.selectedConversation = conv;
    this.messages = [];
    this.chatInput = '';
    this.showContactInfo = false;
    this.gpsUser = null;
    this.loadMessages();
    this.loadGpsUser(conv.contact.phone);
    if (navigate) {
      this.router.navigate(['/admin/communication', 'chat', conv.id]);
    }
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
      this.chatwootApi.getConversations(this.userInboxId, 1, this.chatwootAgentId).subscribe({
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

  private parseMessageContent(text: string): string {
    if (!text) return '';
    const match = text.match(/^>\s*(.*?)\s*\n(.*)$/s);
    if (match) {
        return `<div class="comm-msg-sig"><i class="pi pi-user comm-msg-sig-icon"></i> <span>${match[1]}</span></div><div class="comm-msg-body">${match[2].replace(/\n/g, '<br/>')}</div>`;
    }
    return text.replace(/\n/g, '<br/>');
  }

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
              parsedHtml: this.parseMessageContent(msg.content),
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
    const newMsg: ChatMessage = { from: 'me', text, parsedHtml: this.parseMessageContent(text), time: new Date() };
    if (replyMsg) {
      newMsg.replyTo = { id: replyMsg.id!, text: replyMsg.text, from: replyMsg.from };
    }
    this.messages.push(newMsg);
    
    // Inject the internal agent name prefix for Chatwoot outbound delivery
    const deptStr = this.currentUserDepartment ? ` - ${this.currentUserDepartment}` : '';
    const finalApiText = `> ${this.currentUserName}${deptStr}\n\n${text}`;

    this.chatInput = '';
    this.replyingTo = null;
    this.sendingMessage = true;
    this.scrollToBottom();

    this.chatwootApi.sendConversationMessage(
      this.selectedConversation.id,
      finalApiText,
      replyMsg?.id,
      undefined,
      this.chatwootAgentId
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

    const deptStr = this.currentUserDepartment ? ` - ${this.currentUserDepartment}` : '';
    const attachmentMessage = `> ${this.currentUserName}${deptStr}\nTe ha enviado un archivo adjunto.`;

    this.chatwootApi.sendAttachment(this.selectedConversation.id, file, attachmentMessage, this.chatwootAgentId).subscribe({
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
                id: msg.id,
                from: msg.from === 'incoming' ? 'incoming' as const : 'me' as const,
                text: msg.content,
                parsedHtml: this.parseMessageContent(msg.content),
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
