import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { ChatwootApiService } from '@core/services/chatwoot-api.service';
import { AuthService } from '@core/services/auth.service';
import { UserService } from '@core/services/user.service';
import { TargetsService } from '@core/services/targets.service';
import { InteraccionesService, UserList } from '../../../../interacciones/presentation/services/interacciones.service';
import { FirebaseNotificationsService } from '@core/services/firebase-notifications.service';
import { SystemService } from '@core/services/system.service';
import { InventoryService } from '@core/services/inventory.service';
import { MessageService, MenuItem } from 'primeng/api';
import { environment } from '../../../../../../../environments/environment';

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
  assignee_id?: number | null;
  contact_last_seen_at?: number | null;
}

interface ChatMessage {
  id?: number;
  from: 'me' | 'incoming' | 'system';
  text?: string;
  parsedHtml?: string;
  time: Date;
  attachments?: ChatAttachment[];
  replyTo?: { id: number; text: string; from: string };
  safeRealtimeUrl?: SafeResourceUrl;
  googleMapsUrl?: string;
  wazeUrl?: string;
}

interface EmailInbox {
  id: number;
  email: string;
}

interface MailAddress {
  name: string;
  address: string;
}

interface MailboxOption {
  email: string;
  label: string;
  own: boolean;
  delegated: boolean;
}

interface MailboxStatus {
  configured: boolean;
  email: string;
  selectedMailboxEmail: string;
  mailboxes: MailboxOption[];
  folders?: MailFolderItem[];
  domain: string;
  imapHost: string;
  smtpHost: string;
  messages: number;
  unseen: number;
}

interface MailMessageSummary {
  uid: number;
  mailboxEmail?: string;
  subject: string;
  from: MailAddress[];
  date: string | null;
  unread: boolean;
  flagged: boolean;
  size: number;
}

interface MailMessageDetail extends MailMessageSummary {
  to: MailAddress[];
  cc: MailAddress[];
  bcc: MailAddress[];
  text: string;
  html: string;
  attachments: Array<{
    filename: string;
    contentType: string;
    size: number;
  }>;
}

interface MailMessageListResponse {
  box: string;
  mailboxEmail: string;
  total: number;
  messages: MailMessageSummary[];
}

interface MailFolderItem {
  id: string;
  label: string;
  icon: string;
}

interface ChatAttachment {
  data_url: string;
  file_type: string;
  content_type: string;
  file_name?: string;
}

interface WhatsAppSticker {
  id: string;
  name: string;
  url: string;
  mimetype: string;
  file_size: number;
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
  sidebarDisplayed = true;
  activeTab: 'chat' | 'correo' | 'foro' = 'chat';
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

  private readonly mailboxApiUrl = `${environment.apiUrl}/mailbox`;
  private readonly MAILBOX_STATUS_TIMEOUT_MS = 60000;
  mailConfigPassword: string = '';
  mailConfigLoading: boolean = false;
  mailConfigError: string = '';
  mailboxStatus: MailboxStatus | null = null;
  mailboxLoading: boolean = false;
  mailReading: boolean = false;
  mailError: string = '';
  mailMessage: string = '';
  selectedMailboxEmail: string = '';
  selectedMailBox: string = 'INBOX';
  mailMessages: MailMessageSummary[] = [];
  mailMessagesTotal: number = 0;
  selectedMailMessage: MailMessageDetail | null = null;
  mailFolders: MailFolderItem[] = [
    { id: 'INBOX', label: 'Entrada', icon: 'pi-inbox' },
  ];

  // Chat
  messages: ChatMessage[] = [];
  chatInput: string = '';
  sendingMessage: boolean = false;
  replyingTo: ChatMessage | null = null;
  stickers: WhatsAppSticker[] = [];
  loadingStickers: boolean = false;
  showStickerPicker: boolean = false;
  savingStickerUrl: string | null = null;
  uploadingSticker: boolean = false;
  sendingStickerId: string | null = null;
  deletingStickerId: string | null = null;
  // Lightbox
  lightboxUrl: string | null = null;
  lightboxType: 'image' | 'video' = 'image';

  // Realtime Modal
  showRealtimeModal: boolean = false;
  currentRealtimeUrl: SafeResourceUrl | null = null;
  
  // Realtime Expiration Config
  showExpirationModal: boolean = false;
  expirationHours: number = 24;
  pendingRealtimeTarget: any = null;

  // New Compose Modal
  showComposeModal: boolean = false;
  loadingMessages: boolean = false;
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('mediaFileInput') mediaFileInput!: ElementRef;
  @ViewChild('docFileInput') docFileInput!: ElementRef;
  @ViewChild('messageInput') messageInput!: ElementRef;

  attachmentMenuItems: MenuItem[] = [];

  // Transfer Modal
  showTransferModal: boolean = false;
  transferAgents: any[] = [];
  selectedTransferAgentId: number | null = null;
  isTransferring: boolean = false;
  transferSummary: string = '';

  // WhatsApp Template Modal
  showTemplateModal: boolean = false;
  sendingTemplate: boolean = false;
  whatsappTemplateVars = {
    headerUser: 'Cliente',
    bodySaludos: 'Buenas tardes',
    name: '',
    body: ''
  };

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
    private router: Router,
    private location: Location,
    private messageService: MessageService,
    private firebaseNotifications: FirebaseNotificationsService,
    private interaccionesService: InteraccionesService,
    private targetsService: TargetsService,
    private inventoryService: InventoryService,
    private systemService: SystemService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer
  ) {}

  allUserLists: UserList[] = [];
  userChecklistsDetails: { listName: string, listId: string, completedCount: number, totalCount: number, isExternal: boolean, externalContactId: string, objectives: { title: string, completed: boolean, id: string, description?: string }[] }[] = [];
  userTargets: any[] = [];

  showChecklistModal: boolean = false;
  showTargetsModal: boolean = false;
  loadingTargets: boolean = false;
  targetMenuModel: MenuItem[] = [];

  targetsSearchTerm: string = '';
  targetsOffset: number = 0;
  targetsLimit: number = 30;
  targetsTotal: number = 0;

  showInventoryModal: boolean = false;
  inventorySearchTerm: string = '';
  inventoryItems: any[] = [];
  loadingInventory: boolean = false;

  showGlobalTargetsModal: boolean = false;
  globalTargetsSearchTerm: string = '';
  globalTargetsItems: any[] = [];
  loadingGlobalTargets: boolean = false;
  globalTargetsOffset: number = 0;
  globalTargetsLimit: number = 30;
  globalTargetsTotal: number = 0;

  ngOnInit(): void {
    this.updateAttachmentMenu();
    this.loadStickers();

    this.loadUserInbox();
    this.interaccionesService.getAll().subscribe({
      next: (lists) => this.allUserLists = lists
    });
    this.route.params.subscribe(params => {
      const tab = params['tab'];
      if (tab === 'chat') {
        this.activeTab = tab;
      } else if (tab === 'correo' || tab === 'foro') {
        this.navigateToTab('chat');
        return;
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
    this.currentUserEmail = currentUser.email || '';
    this.hasEmailInbox = true;
    this.noInbox = false;
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
          this.noInbox = false;
        }
        this.hasEmailInbox = true;
        if (this.activeTab === 'correo') {
          this.initializeMailbox();
        }
      },
      error: () => {
        this.noInbox = false;
        this.hasEmailInbox = true;
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

  navigateToTab(tab: 'chat' | 'correo' | 'foro'): void {
    if (tab === 'correo' || tab === 'foro') {
      this.activeTab = 'chat';
      this.router.navigate(['/admin/communication', 'chat']);
      return;
    }

    this.activeTab = tab;
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
  // GPS MAILBOX
  // ============================

  get isMailboxSessionAvailable(): boolean {
    return !!this.mailboxAuthToken();
  }

  get mailboxOptions(): MailboxOption[] {
    return this.mailboxStatus?.mailboxes || [];
  }

  get mailboxDomain(): string {
    return (this.mailboxStatus?.domain || 'montao.net').toLowerCase();
  }

  get mailConfigEmailIsCompatible(): boolean {
    const email = this.currentUserEmail.trim().toLowerCase();
    return !!email && email.endsWith(`@${this.mailboxDomain}`);
  }

  get visibleMailMessages(): MailMessageSummary[] {
    const term = this.emailSearchTerm.trim().toLowerCase();
    if (!term) return this.mailMessages;

    return this.mailMessages.filter(message =>
      [
        message.subject,
        this.mailAddressLine(message.from),
        this.formatMailDate(message.date)
      ].join(' ').toLowerCase().includes(term)
    );
  }

  initializeMailbox(): void {
    if (!this.isMailboxSessionAvailable || this.mailboxLoading) {
      return;
    }

    this.loadMailboxStatus(true);
  }

  saveMailboxConfig(): void {
    const password = this.mailConfigPassword;

    if (!this.mailConfigEmailIsCompatible) {
      this.mailConfigError = `El usuario logueado debe ser un correo @${this.mailboxDomain}.`;
      return;
    }

    if (!password) {
      this.mailConfigError = 'Escribe la contrasena del buzon.';
      return;
    }

    this.mailConfigLoading = true;
    this.mailConfigError = '';

    fetch(`${this.mailboxApiUrl}/config`, {
      method: 'POST',
      headers: {
        ...this.mailboxHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password })
    })
      .then(async response => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({ message: 'No se pudo configurar el buzon' }));
          throw new Error(payload.message || 'No se pudo configurar el buzon');
        }
        return response.json();
      })
      .then((status: MailboxStatus) => {
        this.mailboxStatus = status;
        this.selectedMailboxEmail = status.selectedMailboxEmail || status.email || status.mailboxes?.[0]?.email || '';
        this.mailConfigPassword = '';
        this.loadMailboxStatus(true);
      })
      .catch(error => {
        this.mailConfigError = error instanceof Error ? error.message : 'No se pudo configurar el buzon';
      })
      .finally(() => {
        this.mailConfigLoading = false;
        this.cdr.detectChanges();
      });
  }

  resetMailboxView(): void {
    this.mailboxStatus = null;
    this.mailMessages = [];
    this.mailMessagesTotal = 0;
    this.selectedMailMessage = null;
    this.selectedMailboxEmail = '';
    this.selectedMailBox = 'INBOX';
    this.mailError = '';
    this.mailMessage = '';
  }

  loadMailboxStatus(loadMessages: boolean = false): void {
    if (!this.isMailboxSessionAvailable) return;

    this.mailboxLoading = true;
    this.mailError = '';
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), this.MAILBOX_STATUS_TIMEOUT_MS);

    fetch(`${this.mailboxApiUrl}/status${this.mailboxQuery()}`, {
      headers: this.mailboxHeaders(),
      signal: controller.signal
    })
      .then(async response => {
        if (response.status === 401) {
          this.resetMailboxView();
          throw new Error('La sesion expiro. Inicia sesion de nuevo.');
        }
        if (!response.ok) {
          const payload = await response.json().catch(() => ({ message: 'No se pudo cargar el buzon' }));
          throw new Error(payload.message || 'No se pudo cargar el buzon');
        }
        return response.json();
      })
      .then((status: MailboxStatus) => {
        this.mailboxStatus = status;
        this.selectedMailboxEmail = status.selectedMailboxEmail || status.email || status.mailboxes?.[0]?.email || '';
        this.mailFolders = status.folders?.length ? status.folders : [{ id: 'INBOX', label: 'Entrada', icon: 'pi-inbox' }];
        if (!this.mailFolders.some(folder => folder.id === this.selectedMailBox)) {
          this.selectedMailBox = this.mailFolders[0]?.id || 'INBOX';
        }
        if (loadMessages && status.configured) {
          this.loadMailMessages();
        }
      })
      .catch(error => {
        this.mailError = error?.name === 'AbortError'
          ? 'El servidor tardo demasiado preparando el buzon. Intenta de nuevo.'
          : error instanceof Error ? error.message : 'No se pudo cargar el buzon';
      })
      .finally(() => {
        window.clearTimeout(timeout);
        this.mailboxLoading = false;
        this.cdr.detectChanges();
      });
  }

  updateSelectedMailbox(email: string): void {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || cleanEmail === this.selectedMailboxEmail) return;

    this.selectedMailboxEmail = cleanEmail;
    this.selectedMailBox = 'INBOX';
    this.selectedMailMessage = null;
    this.mailMessages = [];
    this.mailMessagesTotal = 0;
    this.loadMailboxStatus(true);
  }

  updateMailFolder(folderId: string): void {
    const nextFolder = this.mailFolders.find(folder => folder.id === folderId)?.id || 'INBOX';
    if (nextFolder === this.selectedMailBox) return;

    this.selectedMailBox = nextFolder;
    this.selectedMailMessage = null;
    this.mailMessages = [];
    this.mailMessagesTotal = 0;
    this.loadMailMessages();
  }

  loadMailMessages(): void {
    if (!this.isMailboxSessionAvailable || !this.mailboxStatus?.configured) return;

    this.mailboxLoading = true;
    this.mailError = '';

    fetch(`${this.mailboxApiUrl}/messages${this.mailboxQuery({ limit: '50' })}`, {
      headers: this.mailboxHeaders()
    })
      .then(async response => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({ message: 'No se pudieron cargar los correos' }));
          throw new Error(payload.message || 'No se pudieron cargar los correos');
        }
        return response.json();
      })
      .then((payload: MailMessageListResponse) => {
        this.mailMessages = payload.messages || [];
        this.mailMessagesTotal = payload.total || 0;
        this.selectedMailBox = payload.box || this.selectedMailBox;
        this.selectedMailboxEmail = payload.mailboxEmail || this.selectedMailboxEmail;
        this.selectedMailMessage = null;
      })
      .catch(error => {
        this.mailError = error instanceof Error ? error.message : 'No se pudieron cargar los correos';
      })
      .finally(() => {
        this.mailboxLoading = false;
        this.cdr.detectChanges();
      });
  }

  openMailMessage(message: MailMessageSummary): void {
    if (!this.isMailboxSessionAvailable) return;

    this.mailReading = true;
    this.mailError = '';

    fetch(`${this.mailboxApiUrl}/messages/${message.uid}${this.mailboxQuery()}`, {
      headers: this.mailboxHeaders()
    })
      .then(async response => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({ message: 'No se pudo abrir el correo' }));
          throw new Error(payload.message || 'No se pudo abrir el correo');
        }
        return response.json();
      })
      .then((detail: MailMessageDetail) => {
        this.selectedMailMessage = detail;
        if (message.unread) {
          this.markMailRead(message.uid);
          this.mailMessages = this.mailMessages.map(item =>
            item.uid === message.uid ? { ...item, unread: false } : item
          );
          if (this.mailboxStatus) {
            this.mailboxStatus = {
              ...this.mailboxStatus,
              unseen: Math.max(0, (this.mailboxStatus.unseen || 0) - 1)
            };
          }
        }
      })
      .catch(error => {
        this.mailError = error instanceof Error ? error.message : 'No se pudo abrir el correo';
      })
      .finally(() => {
        this.mailReading = false;
        this.cdr.detectChanges();
      });
  }

  goBackEmail(): void {
    this.selectedMailMessage = null;
  }

  moveSelectedMail(targetBox: string, label: string): void {
    const selected = this.selectedMailMessage;
    if (!this.isMailboxSessionAvailable || !selected) return;

    this.mailReading = true;
    this.clearMailFeedback();

    fetch(`${this.mailboxApiUrl}/messages/${selected.uid}/move${this.mailboxQuery()}`, {
      method: 'PATCH',
      headers: {
        ...this.mailboxHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ targetBox })
    })
      .then(async response => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({ message: `No se pudo mover a ${label}` }));
          throw new Error(payload.message || `No se pudo mover a ${label}`);
        }
      })
      .then(() => {
        this.mailMessages = this.mailMessages.filter(message => message.uid !== selected.uid);
        this.mailMessagesTotal = Math.max(0, this.mailMessagesTotal - 1);
        this.selectedMailMessage = null;
        this.mailMessage = `Correo movido a ${label}`;
      })
      .catch(error => {
        this.mailError = error instanceof Error ? error.message : `No se pudo mover a ${label}`;
      })
      .finally(() => {
        this.mailReading = false;
        this.cdr.detectChanges();
      });
  }

  toggleSelectedMailReadState(): void {
    const selected = this.selectedMailMessage;
    if (!this.isMailboxSessionAvailable || !selected) return;

    const read = selected.unread;
    this.clearMailFeedback();

    fetch(`${this.mailboxApiUrl}/messages/${selected.uid}/read-state${this.mailboxQuery()}`, {
      method: 'PATCH',
      headers: {
        ...this.mailboxHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ read })
    })
      .then(async response => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({ message: 'No se pudo marcar el correo' }));
          throw new Error(payload.message || 'No se pudo marcar el correo');
        }
      })
      .then(() => {
        const nextUnread = !read;
        this.selectedMailMessage = { ...selected, unread: nextUnread };
        this.mailMessages = this.mailMessages.map(message =>
          message.uid === selected.uid ? { ...message, unread: nextUnread } : message
        );
        this.mailMessage = read ? 'Correo marcado como leido' : 'Correo marcado como no leido';
      })
      .catch(error => {
        this.mailError = error instanceof Error ? error.message : 'No se pudo marcar el correo';
      })
      .finally(() => this.cdr.detectChanges());
  }

  replyToSelected(): void {
    const selected = this.selectedMailMessage;
    if (!selected) return;

    this.openCompose();
    this.composeEmail = selected.from[0]?.address || '';
    this.composeSubject = selected.subject.toLowerCase().startsWith('re:') ? selected.subject : `Re: ${selected.subject}`;
    this.composeBody = `\n\n---\n${selected.text || ''}`.trimStart();
  }

  replyAllToSelected(): void {
    const selected = this.selectedMailMessage;
    if (!selected) return;

    const currentMailbox = this.selectedMailboxEmail.toLowerCase();
    const recipients = [...selected.from, ...selected.to, ...selected.cc]
      .map(address => address.address || address.name)
      .filter(Boolean)
      .filter((address, index, list) => {
        const normalized = address.toLowerCase();
        return normalized !== currentMailbox && list.findIndex(item => item.toLowerCase() === normalized) === index;
      });

    this.openCompose();
    this.composeEmail = recipients.join(', ');
    this.composeSubject = selected.subject.toLowerCase().startsWith('re:') ? selected.subject : `Re: ${selected.subject}`;
    this.composeBody = `\n\n---\n${selected.text || ''}`.trimStart();
  }

  forwardSelected(): void {
    const selected = this.selectedMailMessage;
    if (!selected) return;

    this.openCompose();
    this.composeEmail = '';
    this.composeSubject = selected.subject.toLowerCase().startsWith('fwd:') ? selected.subject : `Fwd: ${selected.subject}`;
    this.composeBody = `\n\n--- Mensaje reenviado ---\nDe: ${this.mailAddressLine(selected.from)}\nPara: ${this.mailAddressLine(selected.to)}\nFecha: ${this.formatMailDate(selected.date)}\nAsunto: ${this.mailSubject(selected)}\n\n${selected.text || ''}`.trimStart();
  }

  mailFolderBadge(folderId: string): string {
    if (folderId === 'INBOX') {
      const unseen = this.mailboxStatus?.unseen || 0;
      return unseen > 0 ? String(unseen) : '';
    }

    if (folderId === this.selectedMailBox && this.mailMessagesTotal > 0) {
      return String(this.mailMessagesTotal);
    }

    return '';
  }

  setTypeFilter(type: 'received' | 'sent' | 'spam'): void {
    this.selectedTypeFilter = type;
    const labelByType = {
      received: 'Entrada',
      sent: 'Enviados',
      spam: 'SPAM'
    } as const;
    const folder = this.mailFolders.find(item => item.label === labelByType[type]);
    this.updateMailFolder(folder?.id || 'INBOX');
  }

  filterEmailConversations(): void {
    this.cdr.detectChanges();
  }

  private markMailRead(uid: number): void {
    if (!this.isMailboxSessionAvailable) return;

    fetch(`${this.mailboxApiUrl}/messages/${uid}/read${this.mailboxQuery()}`, {
      method: 'PATCH',
      headers: this.mailboxHeaders()
    }).catch(() => undefined);
  }

  private mailboxQuery(extra: Record<string, string> = {}): string {
    const params = new URLSearchParams();

    if (this.selectedMailBox) {
      params.set('box', this.selectedMailBox);
    }

    if (this.selectedMailboxEmail) {
      params.set('mailboxEmail', this.selectedMailboxEmail);
    }

    for (const [key, value] of Object.entries(extra)) {
      params.set(key, value);
    }

    const query = params.toString();
    return query ? `?${query}` : '';
  }

  private mailboxHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.mailboxAuthToken()}` };
  }

  private mailboxAuthToken(): string {
    return localStorage.getItem('authtoken') || '';
  }

  private clearMailFeedback(): void {
    this.mailError = '';
    this.mailMessage = '';
    this.mailConfigError = '';
  }

  mailAddressLine(addresses: MailAddress[] = []): string {
    return addresses
      .map(address => address.name || address.address)
      .filter(Boolean)
      .join(', ');
  }

  mailSenderName(addresses: MailAddress[] = []): string {
    return this.mailAddressLine(addresses) || 'Remitente desconocido';
  }

  mailSenderInitial(addresses: MailAddress[] = []): string {
    const sender = this.mailSenderName(addresses).trim();
    return (sender[0] || 'C').toUpperCase();
  }

  mailSubject(message: Pick<MailMessageSummary, 'subject'>): string {
    return message.subject?.trim() || '(sin asunto)';
  }

  mailBodyHtml(message: MailMessageDetail): SafeHtml {
    const text = message.text?.trim() || 'Este correo no tiene contenido de texto.';
    const linked = this.linkifyMailBody(this.escapeHtml(text));

    return this.sanitizer.bypassSecurityTrustHtml(linked.replace(/\n/g, '<br>'));
  }

  private linkifyMailBody(escapedText: string): string {
    const anchors: string[] = [];
    const addAnchor = (url: string, label = url): string => {
      const cleanUrl = url.trim();
      const href = cleanUrl.toLowerCase().startsWith('www.') ? `https://${cleanUrl}` : cleanUrl;
      const token = `__MAIL_LINK_${anchors.length}__`;
      anchors.push(`<a href="${href}" target="_blank" rel="noopener noreferrer">${label.trim()}</a>`);
      return token;
    };

    let linked = escapedText.replace(
      /\[([^\]]+)\]\(((?:https?:\/\/|www\.)[^)\s]+)\)/gi,
      (_match, label: string, url: string) => addAnchor(url, label),
    );

    linked = linked.replace(
      /\[((?:https?:\/\/|www\.)[^\]\s]+)\]/gi,
      (_match, url: string) => addAnchor(url),
    );

    linked = linked.replace(
      /((?:https?:\/\/|www\.)[^\s<]+)/gi,
      (match) => {
        const clean = match.replace(/[.,;:!?)]*$/, '');
        const trailing = match.slice(clean.length);
        return `${addAnchor(clean)}${trailing}`;
      },
    );

    return anchors.reduce(
      (body, anchor, index) => body.replace(`__MAIL_LINK_${index}__`, anchor),
      linked,
    );
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  mailRowPreview(message: MailMessageSummary): string {
    return message.unread ? 'Sin leer' : 'Leido';
  }

  formatMailDate(value: string | null): string {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isSameYear = date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString('es-DO', {
        hour: 'numeric',
        minute: '2-digit'
      });
    }

    return date.toLocaleDateString('es-DO', {
      day: 'numeric',
      month: 'short',
      ...(isSameYear ? {} : { year: 'numeric' })
    });
  }

  formatAttachmentSize(size: number): string {
    if (!Number.isFinite(size) || size <= 0) return '0 KB';
    if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ============================
  // TRANSFER CONVERSATION
  // ============================
  
  openTransferModal(): void {
    if (!this.selectedConversation) return;
    this.showTransferModal = true;
    this.selectedTransferAgentId = null;
    this.isTransferring = false;
    this.transferSummary = '';
    
    // Si ya cargamos los agentes, no lo hacemos de nuevo
    if (this.transferAgents.length === 0) {
      this.userService.getEmployees().subscribe({
        next: (employees: any[]) => {
          // Filtrar los empleados que tengan un ID de Chatwoot y no sean el propio usuario actual
          const agents = employees.filter((e: any) => e.idchatwoot && e.id !== this.currentUserId);
          
          // Inyectamos a Ester Assistant estáticamente con ID 0 para representar desasignación
          agents.unshift({
             name: 'Ester',
             last_name: 'Assistant (IA)',
             email: 'system@n8n.bot',
             idchatwoot: 0
          });

          this.transferAgents = agents;
        },
        error: (err: any) => console.error('Error cargando empleados para transferencia', err)
      });
    }
  }

  confirmTransfer(): void {
    const isEster = this.selectedTransferAgentId === 0;
    if (!this.selectedConversation || (!this.selectedTransferAgentId && !isEster)) return;
    
    this.isTransferring = true;
    const conversationId = this.selectedConversation.id;
    const targetAgentId = this.selectedTransferAgentId as number;

    const processSuccess = () => {
        this.showTransferModal = false;
        this.isTransferring = false;
        
        if (targetAgentId === 0) {
            this.selectedConversation!.assignee_id = null;
        }
        
        // Buscar el agente en memoria para sacar su ID de Mongo y enviarle el Push (si es humano)
        const assignedAgent = this.transferAgents.find((a: any) => a.idchatwoot === targetAgentId);
        const contactName = this.selectedConversation?.contact.name || 'un cliente';
        
        if (assignedAgent && (assignedAgent.id || assignedAgent._id)) {
          const topic = assignedAgent.id || assignedAgent._id;
          this.firebaseNotifications.sendTestNotification({
            topic: topic,
            title: 'Nueva Conversación Transferida',
            body: `Se te ha transferido el chat de ${contactName}.`,
            data: { tab: 'chat', conversationId: conversationId.toString(), summary: this.transferSummary.trim() }
          }).subscribe({
            error: (err) => console.error('Error enviando push de transferencia', err)
          });
        }

        // Mostramos Toast / System Message y actualizamos la vista
        // Y cerramos la interfaz de inmediato para bloquear acceso a continuar escribiendo
        this.selectedConversation = null;
        this.messages = []; // Clear current feed array
        this.messageService.add({ severity: 'success', summary: targetAgentId === 0 ? 'Chat Cedido a IA' : 'Transferencia Completa', detail: targetAgentId === 0 ? 'Control devuelto a Ester Assistant correctamente.' : 'La conversación ha sido transferida exitosamente.' });
        this.loadConversations(); // Recargar lista para reflejar salida
    };

    this.chatwootApi.assignAgentToConversation(conversationId, targetAgentId).subscribe({
      next: (res) => {
        if (res.success || targetAgentId === 0) {
           processSuccess();
        } else {
           this.isTransferring = false;
           this.messages.push({ from: 'system', text: '✗ Error interno al transferir', time: new Date() });
        }
      },
      error: () => {
        if (targetAgentId === 0) {
           processSuccess();
        } else {
           this.isTransferring = false;
           this.showTransferModal = false;
           this.messages.push({ from: 'system', text: '✗ Error de conexión al transferir', time: new Date() });
        }
      }
    });
  }

  transferAllToEster(): void {
    const activeConvs = this.conversations.filter(c => c.assignee_id !== null);
    if (activeConvs.length === 0) {
      this.messageService.add({ severity: 'info', summary: 'Bandeja limpia', detail: 'No tienes conversaciones activas pendientes por devolver.' });
      return;
    }

    if (confirm(`¿Estás seguro de transferir las ${activeConvs.length} conversaciones activas a Ester Assistant?`)) {
      this.isTransferring = true;
      let completed = 0;
      let fails = 0;

      activeConvs.forEach(conv => {
        this.chatwootApi.assignAgentToConversation(conv.id, 0).subscribe({
          next: () => {
             completed++;
             this.checkTransferAllProgress(completed + fails, activeConvs.length, fails);
          },
          error: () => {
             // For agent 0, the API might return 404 or fail in some strict chatwoot setups if not handled, but we assume success if response
             completed++; // Treat as completed due to chatwoot null unassingment quirk
             this.checkTransferAllProgress(completed + fails, activeConvs.length, fails);
          }
        });
      });
    }
  }

  private checkTransferAllProgress(processed: number, total: number, fails: number): void {
    if (processed === total) {
      this.isTransferring = false;
      if (fails > 0) {
        this.messageService.add({ severity: 'warn', summary: 'Traspaso Múltiple Completado', detail: `Se devolvieron a Ester, aunque advirtió de fallos técnicos en ${fails} de ellas.` });
      } else {
        this.messageService.add({ severity: 'success', summary: 'Desligamiento Masivo', detail: 'Se han revocado tus asignaciones, todas volvieron a manos de Ester Assistant.' });
      }
      this.selectedConversation = null;
      this.messages = [];
      this.loadConversations();
    }
  }

  openCompose(): void {
    if (!this.mailboxStatus?.configured) {
      this.mailError = 'No hay buzon disponible para enviar correos.';
      return;
    }

    this.showCompose = true;
    this.sendingEmail = false;
    this.composeEmail = '';
    this.composeSubject = '';
    this.composeBody = '';
    this.composeFiles = [];
    this.clearMailFeedback();
  }

  closeCompose(): void {
    if (this.sendingEmail) return;

    this.showCompose = false;
    this.sendingEmail = false;
    this.composeEmail = '';
    this.composeSubject = '';
    this.composeBody = '';
    this.composeFiles = [];
    this.clearMailFeedback();
  }

  sendComposedEmail(): void {
    if (!this.isMailboxSessionAvailable) {
      this.mailError = 'Tu sesion expiro. Inicia sesion de nuevo.';
      return;
    }

    const recipients = this.composeEmail.trim();
    const hasContent = this.composeSubject.trim() || this.composeBody.trim() || this.composeFiles.length;

    if (!recipients) {
      this.mailError = 'Agrega al menos un destinatario.';
      return;
    }

    if (!hasContent) {
      this.mailError = 'Escribe un asunto, mensaje o adjunta un archivo.';
      return;
    }

    this.sendingEmail = true;
    this.clearMailFeedback();

    const formData = new FormData();
    formData.append('mailboxEmail', this.selectedMailboxEmail);
    formData.append('to', recipients);
    formData.append('subject', this.composeSubject.trim());
    formData.append('text', this.composeBody);

    for (const file of this.composeFiles) {
      formData.append('attachments', file, file.name);
    }

    fetch(`${this.mailboxApiUrl}/send`, {
      method: 'POST',
      headers: this.mailboxHeaders(),
      body: formData
    })
      .then(async response => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({ message: 'No se pudo enviar el correo' }));
          throw new Error(payload.message || 'No se pudo enviar el correo');
        }
      })
      .then(() => {
        this.sendingEmail = false;
        this.closeCompose();
        this.mailMessage = 'Correo enviado';
        if (this.mailFolders.find(folder => folder.id === this.selectedMailBox)?.label === 'Enviados') {
          this.loadMailMessages();
        }
      })
      .catch(error => {
        this.mailError = error instanceof Error ? error.message : 'No se pudo enviar el correo';
      })
      .finally(() => {
        this.sendingEmail = false;
        this.cdr.detectChanges();
      });
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
    // Attempt to load from cache for instant initial rendering
    const cacheKey = `chatwoot_convs_${this.userInboxId}_${this.chatwootAgentId}`;
    if (!this.conversations.length && this.userInboxId) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          this.conversations = JSON.parse(cached);
          this.filterConversations();

          if (!this.pendingConversationId && this.activeTab === 'chat' && !this.selectedConversation) {
            const lastId = localStorage.getItem(`last_opened_chat_${this.currentUserId}`);
            if (lastId) {
              const lastConv = this.conversations.find(c => c.id === Number(lastId));
              if (lastConv) this.selectConversation(lastConv, true);
            }
          }
        } catch (e) { }
      }
    }

    this.loadingConversations = this.conversations.length === 0;
    this.chatwootApi.getConversations(this.userInboxId, 1, this.chatwootAgentId).subscribe({
      next: (res: any) => {
        this.loadingConversations = false;
        if (res.success) {
          this.conversations = res.conversations || [];
          if (this.userInboxId) {
            localStorage.setItem(cacheKey, JSON.stringify(this.conversations));
          }
          this.conversationsFingerprint = this.getConversationsFingerprint(this.conversations);
          this.filterConversations();
          this.startConversationsPolling();
          if (this.pendingConversationId && this.activeTab === 'chat') {
            const conv = this.conversations.find(c => c.id === this.pendingConversationId);
            if (conv) this.selectConversation(conv, false);
            this.pendingConversationId = null;
          } else if (!this.selectedConversation && this.activeTab === 'chat') {
            const lastId = localStorage.getItem(`last_opened_chat_${this.currentUserId}`);
            if (lastId) {
              const lastConv = this.conversations.find(c => c.id === Number(lastId));
              if (lastConv) this.selectConversation(lastConv, true);
            }
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
    conv.unread_count = 0; // Clear indicator instantly mimicking visual read receipts
    this.selectedConversation = conv;
    if (this.currentUserId) {
      localStorage.setItem(`last_opened_chat_${this.currentUserId}`, conv.id.toString());
    }
    this.messages = [];
    this.chatInput = '';
    this.showContactInfo = false;
    this.gpsUser = null;
    this.loadMessages();
    this.loadGpsUser(conv.contact.phone);
    if (navigate) {
      this.location.go(`/admin/communication/chat/${conv.id}`);
    }
  }

  private loadGpsUser(phone: string): void {
    if (!phone) return;
    this.userChecklistsDetails = [];
    this.userTargets = [];
    this.userService.getByPhone(phone).subscribe({
      next: async (user: any) => {
        console.log('[Contact Panel] by-phone response:', user);
        this.gpsUser = user?._id ? user : null;
        this.calculateUserChecklistsDetails(phone);
        
        if (this.gpsUser && this.gpsUser._id) {
          this.targetsOffset = 0;
          this.targetsSearchTerm = '';
          this.loadTargetsBox();
        }
      },
      error: (err: any) => {
        console.error('[Contact Panel] by-phone error:', err);
        this.gpsUser = null;
        this.calculateUserChecklistsDetails(phone);
      }
    });
  }

  async loadTargetsBox() {
    if (!this.gpsUser?._id) return;
    this.loadingTargets = true;
    try {
      let res;
      if (this.targetsSearchTerm.trim()) {
        res = await this.targetsService.searchTargets(this.targetsSearchTerm.trim(), this.gpsUser._id, this.targetsOffset, this.targetsLimit);
      } else {
        res = await this.targetsService.getTargetsWithPagination(this.gpsUser._id, this.targetsOffset, this.targetsLimit);
      }
      this.userTargets = res.devices || [];
      this.targetsTotal = res.totalCount || 0;
      this.updateAttachmentMenu();
    } catch(e) {
      console.error(e);
    } finally {
      this.loadingTargets = false;
      this.cdr.detectChanges();
    }
  }

  onTargetsPageChange(event: any) {
    this.targetsOffset = event.first;
    this.targetsLimit = event.rows;
    this.loadTargetsBox();
  }

  onTargetsSearch() {
    this.targetsOffset = 0;
    this.loadTargetsBox();
  }

  private updateAttachmentMenu() {
    this.attachmentMenuItems = [
      { label: 'Fotos y Videos', icon: 'pi pi-image', command: () => this.mediaFileInput.nativeElement.click() },
      { label: 'Documento', icon: 'pi pi-file', command: () => this.docFileInput.nativeElement.click() },
      { label: 'Stickers', icon: 'pi pi-send', command: () => this.toggleStickerPicker() }
    ];

    let hasSeparated = false;

    if (this.userChecklistsDetails.length > 0) {
      if (!hasSeparated) { this.attachmentMenuItems.push({ separator: true }); hasSeparated = true; }
      this.attachmentMenuItems.push({
        label: 'Checklists de Campaña',
        icon: 'pi pi-check-square',
        command: () => this.showChecklistModal = true
      });
    }

    if (!hasSeparated) { this.attachmentMenuItems.push({ separator: true }); hasSeparated = true; }
    this.attachmentMenuItems.push({
      label: 'Buscar en Inventario',
      icon: 'pi pi-box',
      command: () => this.openInventoryModal()
    });

    this.attachmentMenuItems.push({
      label: 'Búsqueda Global (Vehículos)',
      icon: 'pi pi-globe',
      command: () => this.openGlobalTargetsModal()
    });

    if (this.userTargets && this.userTargets.length > 0) {
      if (!hasSeparated) { this.attachmentMenuItems.push({ separator: true }); hasSeparated = true; }
      this.attachmentMenuItems.push({
        label: 'Objetivos del Cliente',
        icon: 'pi pi-car',
        command: () => this.showTargetsModal = true
      });
    }
  }

  openTargetSendMenu(target: any, event: Event, menu: any) {
    const baseUrl = window.location.origin;
    const lat = target.traccarInfo?.geolocation?.latitude ?? target.traccarInfo?.lastLocation?.latitude ?? target.traccarInfo?.latitude;
    const lng = target.traccarInfo?.geolocation?.longitude ?? target.traccarInfo?.lastLocation?.longitude ?? target.traccarInfo?.longitude;
    const imei = target.device_imei || target.imei || 'N/A';
    
    this.targetMenuModel = [
      {
        label: 'Link en tiempo real',
        icon: 'pi pi-compass',
        command: () => {
             this.pendingRealtimeTarget = target;
             this.expirationHours = 24;
             this.showExpirationModal = true;
        }
      },
      {
        label: 'Link de Google Maps',
        icon: 'pi pi-map',
        command: () => {
             if (lat !== undefined && lng !== undefined) {
                 this.sendAppUrlAuto(`https://www.google.com/maps?q=${lat},${lng}`);
             } else this.messageService.add({ severity: 'warn', summary: 'Ubicación faltante', detail: 'El dispositivo no posee coordenadas activas.'});
        }
      },
      {
        label: 'Link de Waze',
        icon: 'pi pi-car',
        command: () => {
             if (lat !== undefined && lng !== undefined) {
                 this.sendAppUrlAuto(`https://www.waze.com/ul?ll=${lat}%2C${lng}&navigate=yes&zoom=17`);
             } else this.messageService.add({ severity: 'warn', summary: 'Ubicación faltante', detail: 'El dispositivo no posee coordenadas activas.'});
        }
      },
      {
        label: 'Detalles del objetivo',
        icon: 'pi pi-list',
        command: () => this.injectIntoChat(`Vehículo: ${target.name || target.device_name || 'Sin nombre'}\nIMEI: ${imei}\nLínea: ${target.sim_card_number || target.simCard?.phone || 'N/A'}`)
      },
      {
        label: 'Solo el IMEI',
        icon: 'pi pi-hashtag',
        command: () => this.injectIntoChat(imei)
      }
    ];
    menu.toggle(event);
  }

  injectIntoChat(text: string) {
    if (this.chatInput) {
       this.chatInput += '\n' + text;
    } else {
       this.chatInput = text;
    }
    this.showTargetsModal = false;
  }

  // ============================
  // INVENTORY MODAL
  // ============================
  openInventoryModal() {
    this.showInventoryModal = true;
    this.inventorySearchTerm = '';
    this.inventoryItems = [];
    // Start with a generic load
    this.searchInventory();
  }

  searchInventory() {
    this.loadingInventory = true;
    this.inventoryService.searchAllDevices(this.inventorySearchTerm, undefined, 1, 30).subscribe({
      next: (res: any) => {
        this.inventoryItems = res.data || [];
        this.loadingInventory = false;
      },
      error: () => {
        this.loadingInventory = false;
      }
    });
  }

  sendInventoryItem(item: any) {
    if (!this.selectedConversation) return;

    this.showInventoryModal = false;
    // Format what to send to the chat input automatically
    const imei = item.imei || item.IMEI || '!N/A!';
    const sim = item.sim || item.SIM || '!N/A!';
    const protocolId = item.protocol ? (item.protocol.name || item.protocol) : '!N/A!';

    let text = `Información de Equipo:\n- IMEI: ${imei}\n- SIM: ${sim}`;
    if (protocolId && protocolId !== '!N/A!') text += `\n- Protocolo: ${protocolId}`;

    this.injectIntoChat(text);
  }

  // ============================
  // GLOBAL TARGETS MODAL
  // ============================
  openGlobalTargetsModal() {
    this.showGlobalTargetsModal = true;
    this.globalTargetsSearchTerm = '';
    this.globalTargetsOffset = 0;
    this.globalTargetsItems = [];
    this.loadGlobalTargetsBox();
  }

  async loadGlobalTargetsBox() {
    this.loadingGlobalTargets = true;
    try {
      let res;
      if (this.globalTargetsSearchTerm.trim()) {
        res = await this.targetsService.searchTargets(this.globalTargetsSearchTerm.trim(), '68a9ccf19bb280482272477f', this.globalTargetsOffset, this.globalTargetsLimit);
      } else {
        res = await this.targetsService.getTargetsWithPagination('68a9ccf19bb280482272477f', this.globalTargetsOffset, this.globalTargetsLimit);
      }
      this.globalTargetsItems = res.devices || [];
      this.globalTargetsTotal = res.totalCount || 0;
    } catch(e) {
      console.error(e);
    } finally {
      this.loadingGlobalTargets = false;
      this.cdr.detectChanges();
    }
  }

  onGlobalTargetsPageChange(event: any) {
    this.globalTargetsOffset = event.first;
    this.globalTargetsLimit = event.rows;
    this.loadGlobalTargetsBox();
  }

  onGlobalTargetsSearch() {
    this.globalTargetsOffset = 0;
    this.loadGlobalTargetsBox();
  }

  sendRealtimeLinkAuto() {
      if (!this.pendingRealtimeTarget || !this.selectedConversation) return;

      this.showExpirationModal = false;
      this.showTargetsModal = false;
      const target = this.pendingRealtimeTarget;
      const hours = this.expirationHours || 24;
      const baseUrl = window.location.origin;

      this.systemService.getAll().subscribe({
        next: (systems: any) => {
           const googleConfig = systems && systems[0] ? systems[0].map_api1 : null;
           const mapboxConfig = systems && systems[0] ? systems[0].map_api2 : null;
           const key = googleConfig?.key || mapboxConfig?.key || 'AIzaSyDTcpHcDElgnEB8fXzoZ5Ee30H_kpIwEjI';
           
           const expirationDate = new Date();
           expirationDate.setHours(expirationDate.getHours() + hours);
           const linkData = { trgt: target._id, exprcn: expirationDate.toISOString(), gkey: key };
           const encodedData = btoa(JSON.stringify(linkData));
           const realtimeUrl = `${baseUrl}/realtimelink?data=${encodedData}`;

           const deptStr = this.currentUserDepartment ? ` - ${this.currentUserDepartment}` : '';
           const textToSend = `> ${this.currentUserName}${deptStr}\nhttps://tracker.montao.net/realtimelink?data=${encodedData}`;

           const pendingMsg: ChatMessage = { from: 'me', text: textToSend, parsedHtml: this.parseMessageContent(textToSend), time: new Date() };
           this.enrichWithAppUrls(pendingMsg);
           this.messages.push(pendingMsg);
           this.scrollToBottom();

           this.chatwootApi.sendConversationMessage(
             this.selectedConversation!.id,
             textToSend,
             undefined,
             undefined,
             this.chatwootAgentId
           ).subscribe({
             next: (res) => {
               if (!res.success) {
                 this.messages.push({ from: 'system', text: '✗ Error al enviar enlace', time: new Date() });
               } else {
                 this.loadMessages();
               }
               this.scrollToBottom();
               this.pendingRealtimeTarget = null;
             },
             error: () => {
               this.messages.push({ from: 'system', text: '✗ Error de conexión', time: new Date() });
               this.scrollToBottom();
               this.pendingRealtimeTarget = null;
             }
           });
        }
      });
  }

  sendAppUrlAuto(url: string) {
      if (!this.selectedConversation) return;

      this.showTargetsModal = false;
      const deptStr = this.currentUserDepartment ? ` - ${this.currentUserDepartment}` : '';
      const textToSend = `> ${this.currentUserName}${deptStr}\n${url}`;

      const pendingMsg: ChatMessage = { from: 'me', text: textToSend, parsedHtml: this.parseMessageContent(textToSend), time: new Date() };
      this.enrichWithAppUrls(pendingMsg);
      this.messages.push(pendingMsg);
      this.scrollToBottom();

      this.chatwootApi.sendConversationMessage(
         this.selectedConversation!.id,
         textToSend,
         undefined,
         undefined,
         this.chatwootAgentId
      ).subscribe({
         next: (res) => {
             if (!res.success) {
                 this.messages.push({ from: 'system', text: '✗ Error al enviar enlace', time: new Date() });
             } else {
                 this.loadMessages();
             }
             this.scrollToBottom();
         },
         error: () => {
             this.messages.push({ from: 'system', text: '✗ Error de conexión', time: new Date() });
             this.scrollToBottom();
         }
      });
  }

  calculateUserChecklistsDetails(phone: string) {
    this.userChecklistsDetails = [];
    const cleanPhone = phone ? phone.replace(/[^\d]/g, '') : '';
    if (!cleanPhone || !this.allUserLists) {
       this.updateAttachmentMenu();
       return;
    }

    for (const list of this.allUserLists) {
      if (!list.objectives || list.objectives.length === 0) continue;

      let applies = false;
      let completedIds: string[] = [];
      let isExternal = false;
      let externalContactId = '';

      // 1. External Contacts matching logic
      const extMatch = list.external_contacts?.find(e => {
         if (!e.phone) return false;
         const ep = e.phone.replace(/[^\d]/g, '');
         if (!ep) return false;
         return ep === cleanPhone || ep.endsWith(cleanPhone.slice(-10)) || cleanPhone.endsWith(ep.slice(-10));
      });

      if (extMatch) {
         applies = true;
         isExternal = true;
         externalContactId = (extMatch as any)._id;
         completedIds = extMatch.completed_objectives || [];
      } else if (this.gpsUser) {
         // 2. Registered User Filters matching logic
         let belongsToFilters = false;
         
         if (list.filters && !list.filters.force_empty) {
            const activeKeys = Object.keys(list.filters).filter(k => 
                k !== 'manual_user_ids' && 
                k !== 'force_empty' && 
                k !== 'exclude_notified' &&
                (list.filters as any)[k] !== undefined && 
                (list.filters as any)[k] !== ''
            );
            
            if (activeKeys.length > 0 || (list.filters.status !== undefined && list.filters.status !== null)) {
               let matches = true;
               if (list.filters.affiliation_type_id && this.gpsUser.affiliation_type_id !== list.filters.affiliation_type_id) matches = false;
               if (list.filters.company_type_id && this.gpsUser.company_type_id !== list.filters.company_type_id) matches = false;
               if (list.filters.profile_type_id && this.gpsUser.profile_type_id !== list.filters.profile_type_id) matches = false;
               if (list.filters.status !== undefined && list.filters.status !== null && this.gpsUser.status !== list.filters.status) matches = false;
               
               if (matches) belongsToFilters = true;
            } else if (!list.external_contacts || list.external_contacts.length === 0) {
               // General broadcast list applies if no external contacts & no semantic filters exist
               belongsToFilters = true;
            }
         }

         // Check explicit manual assignment
         const belongsToManual = list.filters?.manual_user_ids?.includes(this.gpsUser._id) || false;

         if (belongsToFilters || belongsToManual) {
            applies = true;
         }

         if (applies) {
             const progress = this.gpsUser.interaction_progress?.find((p: any) => p.listId === list._id);
             if (progress) completedIds = progress.completed_objectives || [];
         }
      }

      if (applies) {
        const objectivesDetail = list.objectives.map(obj => ({
          title: obj.title,
          description: (obj as any).description,
          id: obj.id,
          completed: completedIds.includes(obj.id)
        }));

        this.userChecklistsDetails.push({
          listName: list.name,
          listId: list._id,
          completedCount: completedIds.length,
          totalCount: list.objectives.length,
          isExternal,
          externalContactId,
          objectives: objectivesDetail
        } as any);
      }
    }
    this.updateAttachmentMenu();
  }

  toggleChecklistObjective(checklistIndex: number, objectiveId: string, completed: boolean) {
    const detail: any = this.userChecklistsDetails[checklistIndex];
    if (!detail) return;

    // Optimistic Update Array Mutation
    const obj = detail.objectives.find((o: any) => o.id === objectiveId);
    if (obj) obj.completed = completed;
    detail.completedCount = detail.objectives.filter((o: any) => o.completed).length;

    if (detail.isExternal) {
        if (!detail.externalContactId) return;
        this.interaccionesService.toggleExternalInteractionProgress(detail.listId, detail.externalContactId, objectiveId, completed).subscribe({
            error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar avance.' })
        });
    } else {
        if (!this.gpsUser) return;
        if (!this.gpsUser.interaction_progress) this.gpsUser.interaction_progress = [];
        
        let listProgress = this.gpsUser.interaction_progress.find((p: any) => p.listId === detail.listId);
        if (!listProgress) {
            listProgress = { listId: detail.listId, completed_objectives: [] };
            this.gpsUser.interaction_progress.push(listProgress);
        }

        if (completed && !listProgress.completed_objectives.includes(objectiveId)) listProgress.completed_objectives.push(objectiveId);
        if (!completed) listProgress.completed_objectives = listProgress.completed_objectives.filter((id: string) => id !== objectiveId);

        this.userService.toggleInteractionProgress(this.gpsUser._id, detail.listId, objectiveId, completed).subscribe({
            error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar avance.' })
        });
    }
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
    
    // Procesar Markdown de WhatsApp (negrita con asteriscos)
    let parsedText = text.replace(/\*(.*?)\*/g, '<b>$1</b>');

    // Match signature that might or might not have a body
    const match = parsedText.match(/^>\s*([^\n]+)(?:\n([\s\S]*))?$/);
    if (match) {
        const sig = match[1].trim();
        const body = (match[2] || '').trim().replace(/\n/g, '<br/>');
        return `<div class="comm-msg-sig"><i class="pi pi-user comm-msg-sig-icon"></i> <span>${sig}</span></div>` +
               (body ? `<div class="comm-msg-body">${body}</div>` : '');
    }
    return parsedText.trim().replace(/\n/g, '<br/>');
  }

  getCleanPreview(text: string | undefined): string {
    if (!text) return 'Sin mensajes';
    let clean = text;
    const match = text.match(/^>\s*([^\n]+)(?:\n([\s\S]*))?$/);
    if (match) {
        clean = match[2] ? match[2] : 'Monitoreo / Adjunto';
    }
    // Opcionalmente quitar asteriscos para la vista previa
    clean = clean.replace(/\*(.*?)\*/g, '$1');
    return clean.replace(/\n/g, ' ').trim() || 'Sin mensajes';
  }

  private enrichWithAppUrls(msg: ChatMessage): ChatMessage {
      if (!msg.text) return msg;

      const mediaMatch = msg.text.match(/^\[Archivo enviado por WhatsApp\]\s*\n(image|video|document)\s*\n([^\n]*)\n(https?:\/\/\S+)/i);
      if (mediaMatch) {
          const rawType = mediaMatch[1].toLowerCase();
          const mediaType = rawType === 'document' ? 'file' : (rawType === 'video' ? 'video' : 'image');
          msg.attachments = [
              ...(msg.attachments || []),
              {
                  data_url: mediaMatch[3],
                  file_type: mediaType,
                  content_type: mediaType === 'video' ? 'video/mp4' : (mediaType === 'file' ? 'application/octet-stream' : 'image/jpeg'),
                  file_name: mediaMatch[2] || 'Archivo enviado por WhatsApp'
              }
          ];
          msg.text = '';
          msg.parsedHtml = '';
          return msg;
      }

      const stickerMatch = msg.text.match(/^\[Sticker enviado por WhatsApp\][\s\S]*?(https?:\/\/\S+\.webp(?:\?\S*)?)/i);
      if (stickerMatch) {
          msg.attachments = [
              ...(msg.attachments || []),
              {
                  data_url: stickerMatch[1],
                  file_type: 'image',
                  content_type: 'image/webp'
              }
          ];
          msg.text = '';
          msg.parsedHtml = '';
          return msg;
      }

      // Realtime Link
      const rtMatch = msg.text.match(/(https?:\/\/[^\s<]+realtimelink\?[^\s<]+)/);
      if (rtMatch) {
          const url = rtMatch[1];
          msg.safeRealtimeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
          msg.text = msg.text.replace(url, '').trim();
          msg.parsedHtml = this.parseMessageContent(msg.text);
          return msg;
      }

      // Google Maps Link
      const gmMatch = msg.text.match(/(https?:\/\/[^\s<]+google\.com\/maps[^\s<]+)/);
      if (gmMatch) {
          msg.googleMapsUrl = gmMatch[1];
          msg.text = msg.text.replace(gmMatch[1], '').trim();
          msg.parsedHtml = this.parseMessageContent(msg.text);
          return msg;
      }

      // Waze Link
      const wMatch = msg.text.match(/(https?:\/\/[^\s<]+waze\.com\/ul[^\s<]+)/);
      if (wMatch) {
          msg.wazeUrl = wMatch[1];
          msg.text = msg.text.replace(wMatch[1], '').trim();
          msg.parsedHtml = this.parseMessageContent(msg.text);
          return msg;
      }

      return msg;
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
            this.enrichWithAppUrls(mapped);
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
    this.enrichWithAppUrls(newMsg);
    if (replyMsg) {
      newMsg.replyTo = { id: replyMsg.id!, text: replyMsg.text || '📎 Adjunto', from: replyMsg.from };
    }
    this.messages.push(newMsg);
    
    // Inject the internal agent name prefix for Chatwoot outbound delivery
    const deptStr = this.currentUserDepartment ? ` - ${this.currentUserDepartment}` : '';
    const finalApiText = `> ${this.currentUserName}${deptStr}\n${text}`;

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
        this.refocusInput();
      },
      error: () => {
        this.sendingMessage = false;
        this.messages.push({ from: 'system', text: '✗ Error de conexión', time: new Date() });
        this.scrollToBottom();
        this.refocusInput();
      }
    });
  }

  private refocusInput(): void {
    setTimeout(() => {
      if (this.messageInput && this.messageInput.nativeElement) {
        this.messageInput.nativeElement.focus();
      }
    }, 50);
  }

  setReplyTo(msg: ChatMessage): void {
    this.replyingTo = msg;
  }

  cancelReply(): void {
    this.replyingTo = null;
  }

  loadStickers(): void {
    this.loadingStickers = true;
    this.chatwootApi.getStickers().subscribe({
      next: (res: any) => {
        this.loadingStickers = false;
        this.stickers = res?.success ? (res.stickers || []) : [];
      },
      error: () => {
        this.loadingStickers = false;
        this.stickers = [];
      }
    });
  }

  saveImageAsSticker(att: ChatAttachment, msg: ChatMessage): void {
    if (!att?.data_url || this.savingStickerUrl) return;

    this.savingStickerUrl = att.data_url;
    const fallbackName = msg.id ? `sticker-chatwoot-${msg.id}` : 'sticker-chatwoot';
    this.chatwootApi.saveStickerFromImage({
      image_url: att.data_url,
      name: fallbackName
    }).subscribe({
      next: (res: any) => {
        this.savingStickerUrl = null;
        if (res?.success && res.sticker) {
          this.stickers = [res.sticker, ...this.stickers.filter(sticker => sticker.id !== res.sticker.id)];
          this.showStickerPicker = true;
          this.messageService.add({
            severity: res.duplicated ? 'info' : 'success',
            summary: res.duplicated ? 'Sticker ya guardado' : 'Sticker guardado',
            detail: res.duplicated
              ? 'Esta imagen ya estaba en tu lista de stickers'
              : 'La imagen se guardó como sticker de WhatsApp'
          });
          return;
        }
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo guardar',
          detail: res?.error || 'Intenta con otra imagen'
        });
      },
      error: () => {
        this.savingStickerUrl = null;
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo guardar',
          detail: 'Error de conexión al guardar el sticker'
        });
      }
    });
  }

  onStickerUploadSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.uploadingSticker) return;

    if (!file.type?.startsWith('image/')) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Archivo no válido',
        detail: 'Solo puedes subir imágenes para crear stickers'
      });
      return;
    }

    this.uploadingSticker = true;
    this.chatwootApi.uploadStickerImage(file, file.name).subscribe({
      next: (res: any) => {
        this.uploadingSticker = false;
        if (res?.success && res.sticker) {
          this.stickers = [res.sticker, ...this.stickers.filter(sticker => sticker.id !== res.sticker.id)];
          this.showStickerPicker = true;
          this.messageService.add({
            severity: res.duplicated ? 'info' : 'success',
            summary: res.duplicated ? 'Sticker ya guardado' : 'Sticker creado',
            detail: res.duplicated
              ? 'Esa imagen ya estaba guardada como sticker'
              : 'La imagen se convirtió en sticker de WhatsApp'
          });
          return;
        }
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo crear',
          detail: res?.error || 'Intenta con otra imagen'
        });
      },
      error: () => {
        this.uploadingSticker = false;
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo crear',
          detail: 'Error de conexión al subir la imagen'
        });
      }
    });
  }

  toggleStickerPicker(): void {
    this.showStickerPicker = !this.showStickerPicker;
    if (this.showStickerPicker && !this.stickers.length && !this.loadingStickers) {
      this.loadStickers();
    }
  }

  isStickerAttachment(att: ChatAttachment): boolean {
    const contentType = String(att?.content_type || '').toLowerCase();
    const dataUrl = String(att?.data_url || '').toLowerCase().split('?')[0];
    return contentType === 'image/webp' || dataUrl.endsWith('.webp');
  }

  isStickerOnlyMessage(msg: ChatMessage): boolean {
    const text = String(msg?.text || '').trim();
    const attachments = msg?.attachments || [];
    return !text && attachments.length > 0 && attachments.every(att => this.isStickerAttachment(att));
  }

  sendSticker(sticker: WhatsAppSticker): void {
    if (!this.selectedConversation?.contact?.phone || !sticker?.id || this.sendingStickerId) return;

    this.sendingStickerId = sticker.id;
    this.chatwootApi.sendSticker({
      phone: this.selectedConversation.contact.phone,
      sticker_id: sticker.id,
      conversation_id: this.selectedConversation.id,
      agent_id: this.chatwootAgentId || undefined
    }).subscribe({
      next: (res: any) => {
        this.sendingStickerId = null;
        if (res?.success) {
          const pendingMsg: ChatMessage = {
            from: 'me',
            text: '',
            parsedHtml: '',
            time: new Date(),
            attachments: [{ data_url: sticker.url, file_type: 'image', content_type: 'image/webp' }]
          };
          this.messages.push(pendingMsg);
          this.showStickerPicker = false;
          this.messageService.add({
            severity: 'success',
            summary: 'Sticker enviado',
            detail: 'Se envió por WhatsApp y quedó registrado en Chatwoot'
          });
          this.loadMessages();
          return;
        }
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo enviar',
          detail: res?.error || 'WhatsApp no aceptó el sticker'
        });
      },
      error: () => {
        this.sendingStickerId = null;
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo enviar',
          detail: 'Error de conexión al enviar el sticker'
        });
      }
    });
  }

  deleteSticker(sticker: WhatsAppSticker, event: Event): void {
    event.stopPropagation();
    if (!sticker?.id || this.deletingStickerId) return;

    this.deletingStickerId = sticker.id;
    this.chatwootApi.deleteSticker(sticker.id).subscribe({
      next: (res: any) => {
        this.deletingStickerId = null;
        if (res?.success) {
          this.stickers = this.stickers.filter(item => item.id !== sticker.id);
          this.messageService.add({
            severity: 'success',
            summary: 'Sticker borrado',
            detail: 'El sticker fue eliminado de la lista'
          });
          return;
        }
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo borrar',
          detail: res?.error || 'Intenta nuevamente'
        });
      },
      error: () => {
        this.deletingStickerId = null;
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo borrar',
          detail: 'Error de conexión al borrar el sticker'
        });
      }
    });
  }

  openMedia(url: string, type: 'image' | 'video'): void {
    this.lightboxUrl = url;
    this.lightboxType = type;
  }

  closeMedia(): void {
    this.lightboxUrl = null;
  }

  openRealtimeModal(url: SafeResourceUrl): void {
      this.currentRealtimeUrl = url;
      this.showRealtimeModal = true;
  }

  closeRealtimeModal(): void {
      this.showRealtimeModal = false;
      this.currentRealtimeUrl = null;
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
          const detail = res.error || 'Error al enviar archivo';
          this.messages.push({ from: 'system', text: `✗ ${detail}`, time: new Date() });
          this.messageService.add({ severity: 'error', summary: 'No se pudo enviar archivo', detail });
        } else {
          this.loadMessages();
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

  assignToMe(): void {
    if (!this.selectedConversation || !this.chatwootAgentId) return;

    const agentIdNum = Number(this.chatwootAgentId);

    this.chatwootApi.assignAgentToConversation(this.selectedConversation.id, agentIdNum).subscribe({
      next: (res) => {
        if (res.success) {
          this.selectedConversation!.assignee_id = agentIdNum;
          this.messageService.add({severity:'success', summary:'Control Tomado', detail:'Te has asignado esta conversación. Ester Assistant está desactivado para este flujo.'});
        } else {
          this.messageService.add({severity:'error', summary:'Error', detail:'No se pudo asignar el chat.'});
        }
      },
      error: () => {
        this.messageService.add({severity:'error', summary:'Error', detail:'Problema en la red al asignar.'});
      }
    });
  }

  isOutside24hWindow(conv: ChatConversation): boolean {
    if (!conv) return false;
    
    // Buscamos el último mensaje físico enviado por el usuario
    // Las políticas 24h asumen que la ventana inicia cuando el usuario final envió algo.
    const incomingMessages = this.messages.filter(m => m.from === 'incoming');
    
    // Si no encontramos ningún mensaje del usuario en el lote descargado,
    // usamos la fecha de fallback del sistema Chatwoot.
    if (incomingMessages.length === 0) {
      const timeRef = conv.contact_last_seen_at || conv.last_message_time;
      if (!timeRef) return true; // Failsafe cerrado total
      
      let lastSeenMs = 0;
      if (typeof timeRef === 'string') {
        const parsed = new Date(timeRef).getTime();
        lastSeenMs = isNaN(parsed) ? 0 : parsed;
      } else if (typeof timeRef === 'number') {
        lastSeenMs = timeRef < 10000000000 ? timeRef * 1000 : timeRef;
      }
      if (lastSeenMs === 0) return true;
      return (Date.now() - lastSeenMs) > 86400000;
    }

    // Si encontramos mensajes físicos del cliente, usamos el más reciente
    const lastIncoming = incomingMessages[incomingMessages.length - 1];
    const diff = Date.now() - lastIncoming.time.getTime();
    
    return diff > 86400000;
  }

  openTemplateModal(): void {
    if (!this.selectedConversation) return;
    this.whatsappTemplateVars.headerUser = this.currentUserName || 'Asesor';
    
    const gpsName = this.gpsUser ? `${this.gpsUser.name} ${this.gpsUser.last_name || ''}`.trim() : null;
    const chatwootName = this.selectedConversation.contact.name !== 'Sin nombre' ? this.selectedConversation.contact.name : '';
    this.whatsappTemplateVars.name = gpsName || chatwootName;
    
    this.whatsappTemplateVars.body = '';
    
    const hour = new Date().getHours();
    if (hour < 12) this.whatsappTemplateVars.bodySaludos = 'uenos días';
    else if (hour < 19) this.whatsappTemplateVars.bodySaludos = 'uenas tardes';
    else this.whatsappTemplateVars.bodySaludos = 'uenas noches';

    this.showTemplateModal = true;
  }

  sendTemplateMessage(): void {
    if (!this.selectedConversation || !this.selectedConversation.contact.phone) {
      this.messageService.add({severity:'error', summary:'Error', detail:'El contacto no tiene número de teléfono registrado.'});
      return;
    }
    this.sendingTemplate = true;
    
    this.chatwootApi.sendWhatsAppTemplateToUser({
        phone: this.selectedConversation.contact.phone,
        template_name: 'simple',
        variables: [
          this.whatsappTemplateVars.headerUser,
          this.whatsappTemplateVars.bodySaludos,
          this.whatsappTemplateVars.name,
          this.whatsappTemplateVars.body
        ],
        agent_id: this.chatwootAgentId ? this.chatwootAgentId.toString() : undefined
    }).subscribe({
      next: (res) => {
        this.sendingTemplate = false;
        if (res.success) {
          this.showTemplateModal = false;
          this.messageService.add({severity:'success', summary:'Enviado', detail:'Plantilla enviada exitosamente.'});
        } else {
          this.messageService.add({severity:'error', summary:'Error', detail:'Hubo un inconveniente al emitir la plantilla en Meta.'});
        }
      },
      error: () => {
        this.sendingTemplate = false;
        this.messageService.add({severity:'error', summary:'Error en Red', detail:'No se pudo conectar con el servidor para emitir plantilla.'});
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
              this.messages = res.messages.map((msg: any) => {
                const mapped: ChatMessage = {
                  id: msg.id,
                  from: msg.from === 'incoming' ? 'incoming' as const : 'me' as const,
                  text: msg.content,
                  parsedHtml: this.parseMessageContent(msg.content),
                  time: new Date(msg.created_at * 1000),
                  attachments: msg.attachments || [],
                };
                return this.enrichWithAppUrls(mapped);
              });
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
