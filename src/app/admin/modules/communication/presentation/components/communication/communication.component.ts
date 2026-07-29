import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { WhatsAppApiService } from '@core/services/whatsapp-api.service';
import { AuthService } from '@core/services/auth.service';
import { UserService } from '@core/services/user.service';
import { TargetsService } from '@core/services/targets.service';
import { InteraccionesService, UserList } from '../../../../interacciones/presentation/services/interacciones.service';
import { FirebaseNotificationsService } from '@core/services/firebase-notifications.service';
import { SystemService } from '@core/services/system.service';
import { InventoryService } from '@core/services/inventory.service';
import { ProtocolsService } from '@core/services/protocols.service';
import { Protocol } from '@core/interfaces/protocol.interface';
import { CommunicationNotificationService } from '@core/services/communication-notification.service';
import { InternalChatAttachment, InternalChatMessage, InternalChatService } from '@core/services/internal-chat.service';
import { MessageService, MenuItem } from 'primeng/api';
import { environment } from '../../../../../../../environments/environment';
import { finalize, Subscription, timeout } from 'rxjs';
import {
  buildAgentSignatureLabel,
  compactAgentSignatureLabel,
} from './agent-signature';

interface ChatConversation {
  id: number;
  status: string;
  contact: {
    id: number | string;
    name: string;
    phone: string;
    email: string;
    avatar: string;
    user_id?: string | null;
    satisfaction_level?: number | null;
  };
  last_message: string;
  last_message_time: number | null;
  unread_count: number;
  inbox_id?: number;
  last_message_type?: number;
  labels?: string[];
  assignee_id?: string | null;
  assignee_name?: string;
  assignee_email?: string;
  assignee_avatar?: string;
  contact_last_seen_at?: number | null;
  assignee_online?: boolean;
  assignee_typing?: boolean;
  reminder_eligible?: boolean;
  reminder_waiting_since?: number | null;
  campaign_id?: string;
  campaign_execution_id?: string;
  campaign_recipient_id?: string;
  campaign_name?: string;
  campaign_objective?: string;
  campaign_objectives?: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
  campaign_active?: boolean;
}

interface ChatMessage {
  id?: number;
  from: 'me' | 'incoming' | 'system';
  text?: string;
  transcription?: string;
  parsedHtml?: string;
  time: Date;
  attachments?: ChatAttachment[];
  replyTo?: {
    id: number;
    text: string;
    from: string;
    type?: string;
    attachments?: ChatAttachment[];
  };
  reaction?: {
    emoji: string;
    sender: string;
    from: string;
  };
  safeRealtimeUrl?: SafeResourceUrl;
  googleMapsUrl?: string;
  wazeUrl?: string;
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
  private readonly failedAvatarUrls = new Set<string>();

  // Conversations
  conversations: ChatConversation[] = [];
  filteredConversations: ChatConversation[] = [];
  searchTerm: string = '';
  loadingConversations: boolean = false;
  selectedConversation: ChatConversation | null = null;
  noInbox: boolean = false;
  sidebarDisplayed = true;
  activeTab: 'chat' | 'correo' | 'foro' | 'grupo' = 'chat';
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
  sendingEsterReply: boolean = false;
  sendingConversationReminder: boolean = false;
  replyingTo: ChatMessage | null = null;
  readonly messageReactionOptions = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  reactionPickerMessageId: number | null = null;
  reactingMessageId: number | null = null;
  stickers: WhatsAppSticker[] = [];
  loadingStickers: boolean = false;
  showStickerPicker: boolean = false;
  savingStickerUrl: string | null = null;
  uploadingSticker: boolean = false;
  sendingStickerId: string | null = null;
  deletingStickerId: string | null = null;
  recordingVoice: boolean = false;
  recordingVoiceContext: 'chat' | 'grupo' | null = null;
  recordingVoiceSeconds = 0;
  private voiceRecorder: MediaRecorder | null = null;
  private voiceStream: MediaStream | null = null;
  private voiceChunks: Blob[] = [];
  private voiceRecordingTimer?: ReturnType<typeof setInterval>;
  private voiceRecordingShouldSend = false;
  private voiceRecordingMimeType = '';
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
  loadingOlderMessages: boolean = false;
  hasOlderMessages: boolean = true;
  messagesLoadError: string = '';
  private activeMessagesRequestId = 0;
  private readonly messagesPageSize = 50;
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('internalMessagesContainer') internalMessagesContainer!: ElementRef;
  @ViewChild('internalMediaFileInput') internalMediaFileInput!: ElementRef;
  @ViewChild('internalStickerUploadInput') internalStickerUploadInput!: ElementRef;
  @ViewChild('mediaFileInput') mediaFileInput!: ElementRef;
  @ViewChild('docFileInput') docFileInput!: ElementRef;
  @ViewChild('messageInput') messageInput!: ElementRef;
  @ViewChild('whatsappTemplateNameEditor') whatsappTemplateNameEditor?: ElementRef<HTMLElement>;
  @ViewChild('whatsappTemplateBodyEditor') whatsappTemplateBodyEditor?: ElementRef<HTMLElement>;

  attachmentMenuItems: MenuItem[] = [];

  // Transfer Modal
  showTransferModal: boolean = false;
  transferAgents: any[] = [];
  selectedTransferAgentId: string | null = null;
  isTransferring: boolean = false;
  loadingTransferAgents: boolean = false;
  private readonly esterTransferAgentId = '__ester_assistant__';

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
  private internalChatPollingInterval: any = null;
  private activeEmployeesPollingInterval: any = null;
  private conversationPresenceHeartbeatInterval: any = null;
  private conversationPresencePollingInterval: any = null;
  private conversationTypingIdleTimer: any = null;
  private readonly POLL_INTERVAL = 5000;
  private readonly ACTIVE_EMPLOYEES_POLL_INTERVAL = 30000;
  private readonly CONVERSATION_PRESENCE_HEARTBEAT_MS = 4000;
  private readonly CONVERSATION_PRESENCE_POLL_MS = 2000;
  private readonly CONVERSATION_TYPING_IDLE_MS = 2200;

  // User inbox
  private userInboxId: number | undefined;
  private currentUserId: string = '';
  currentUserEmail: string = '';
  private lastApiMessageId: number | null = null;
  private conversationsFingerprint: string = '';
  private pendingConversationId: number | null = null;
  private pendingFocusedMessageId: number | null = null;
  focusedMessageId: number | null = null;
  private whatsappAgentId: string = '';
  private currentUserName: string = '';
  private currentUserDepartment: string = '';
  private playableAudioUrls = new Map<string, string>();
  private playableAudioLoading = new Set<string>();
  private playableAudioErrors = new Set<string>();
  private presenceConversationId: number | null = null;
  private conversationTypingActive = false;
  private presenceOwnedByCurrentUser = false;
  private lastTypingSignalAt = 0;

  constructor(
    private whatsappApi: WhatsAppApiService,
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
    private protocolsService: ProtocolsService,
    private internalChatService: InternalChatService,
    private communicationNotifications: CommunicationNotificationService,
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

  showGpsDetailsModal: boolean = false;
  gpsDetailsLoading: boolean = false;
  gpsDetailsTargets: any[] = [];
  gpsDetailsOffset: number = 0;
  gpsDetailsLimit: number = 10;
  gpsDetailsTotal: number = 0;
  gpsDetailsProtocols: Protocol[] = [];
  private gpsDetailsProtocolsLoading: boolean = false;

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

  internalMessages: InternalChatMessage[] = [];
  internalChatInput: string = '';
  loadingInternalMessages: boolean = false;
  sendingInternalMessage: boolean = false;
  internalChatError: string = '';
  internalChatMuted: boolean = false;
  activeEmployeesCount: number | null = null;
  activeEmployees: any[] = [];
  showActiveEmployeesDialog: boolean = false;
  uploadingInternalAttachment: boolean = false;
  showInternalEmojiPicker: boolean = false;
  readonly internalEmojiOptions: string[] = ['😀', '😂', '😊', '😍', '👍', '🙏', '👏', '🔥', '✅', '🚗', '📍', '⚠️', '🛠️', '📞', '❤️', '💪'];
  private internalChatMutedSubscription?: Subscription;

  ngOnInit(): void {
    this.updateAttachmentMenu();
    this.loadStickers();
    this.loadGpsDetailsProtocols();
    this.internalChatMuted = this.communicationNotifications.isInternalChatMuted();
    this.internalChatMutedSubscription = this.communicationNotifications.internalChatMuted$.subscribe((muted) => {
      this.internalChatMuted = muted;
    });

    this.loadUserInbox();
    this.interaccionesService.getAll().subscribe({
      next: (lists) => this.allUserLists = lists
    });
    this.route.params.subscribe(params => {
      const tab = params['tab'];
      if (tab === 'chat' || tab === 'grupo') {
        this.activeTab = tab;
        if (tab === 'grupo') {
          this.loadInternalChat();
        } else {
          this.stopActiveEmployeesPolling();
        }
      } else if (tab === 'correo' || tab === 'foro') {
        this.navigateToTab('chat');
        return;
      }
      const convId = params['conversationId'];
      if (convId) {
        this.pendingConversationId = +convId;
      }
    });
    this.route.queryParamMap.subscribe(params => {
      const messageId = Number(params.get('messageId') || 0);
      this.pendingFocusedMessageId = messageId > 0 ? messageId : null;
    });
  }

  ngOnDestroy(): void {
    this.stopConversationPresenceSession();
    this.stopChatPolling();
    this.stopConversationsPolling();
    this.stopInternalChatPolling();
    this.stopActiveEmployeesPolling();
    this.cancelVoiceRecording();
    this.internalChatMutedSubscription?.unsubscribe();
    this.resetPlayableAudio();
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
        this.whatsappAgentId = String(user?._id || user?.id || currentUser.id);
        this.currentUserName = user?.name || 'Agente';
        this.currentUserDepartment = this.normalizeAgentDepartment(user?.department_id);
        
        // WhatsApp usa una bandeja local única respaldada por Meta y MongoDB.
        this.userInboxId = 5;
        this.noInbox = false;
        this.loadConversations();
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

  navigateToTab(tab: 'chat' | 'correo' | 'foro' | 'grupo'): void {
    if (tab === 'correo' || tab === 'foro') {
      this.activeTab = 'chat';
      this.router.navigate(['/admin/communication', 'chat']);
      return;
    }

    this.activeTab = tab;
    if (tab === 'grupo') {
      this.stopConversationPresenceSession();
      this.stopChatPolling();
      this.loadInternalChat();
    } else {
      this.stopInternalChatPolling();
      this.stopActiveEmployeesPolling();
      if (this.selectedConversation) {
        this.startConversationPresenceSession();
      }
    }
    this.router.navigate(['/admin/communication', tab]);
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
    if (!this.isConversationAssignedToMe()) return;
    this.showTransferModal = true;
    this.selectedTransferAgentId = null;
    this.isTransferring = false;
    
    // Si ya cargamos los agentes, no lo hacemos de nuevo
    if (this.transferAgents.length === 0) {
      this.loadingTransferAgents = true;
      this.userService.getEmployees().subscribe({
        next: (employees: any[]) => {
          this.transferAgents = employees
            .filter((employee: any) => {
              const employeeId = this.getTransferAgentId(employee);
              return this.isConversationTransferAgent(employee)
                && !!employeeId
                && employeeId !== this.currentUserId;
            })
            .sort((first: any, second: any) =>
              this.getActiveEmployeeName(first).localeCompare(
                this.getActiveEmployeeName(second),
                'es',
                { sensitivity: 'base' },
              ),
            );
          this.loadingTransferAgents = false;
        },
        error: (err: any) => {
          this.loadingTransferAgents = false;
          console.error('Error cargando empleados para transferencia', err);
          this.messageService.add({
            severity: 'error',
            summary: 'No se pudieron cargar los empleados',
            detail: 'Intenta abrir la transferencia nuevamente.',
          });
        },
      });
    } else {
      this.transferAgents = this.transferAgents.filter((employee: any) =>
        this.isConversationTransferAgent(employee)
        && this.getTransferAgentId(employee) !== this.currentUserId
      );
      this.loadingTransferAgents = false;
    }
  }

  getTransferAgentId(agent: any): string {
    return String(agent?._id || agent?.id || '');
  }

  private isConversationTransferAgent(agent: any): boolean {
    const affiliationType = String(
      agent?.affiliation_type_id
      || agent?.affiliation_type
      || agent?.settings?.affiliation_type
      || ''
    ).trim().toLowerCase();

    return affiliationType === 'empleado';
  }

  selectTransferAgent(agent: any): void {
    if (this.isTransferring || !this.isConversationAssignedToMe()) return;

    const agentId = this.getTransferAgentId(agent);
    if (!agentId) return;

    this.selectedTransferAgentId = agentId;
    this.confirmTransfer();
  }

  selectEsterForTransfer(): void {
    if (this.isTransferring || !this.isConversationAssignedToMe()) return;

    this.selectedTransferAgentId = this.esterTransferAgentId;
    this.confirmTransfer();
  }

  getSelectedTransferAgentName(): string {
    if (this.selectedTransferAgentId === this.esterTransferAgentId) {
      return 'Ester Assistant';
    }

    const selectedAgent = this.transferAgents.find(
      (agent: any) => this.getTransferAgentId(agent) === this.selectedTransferAgentId,
    );
    return selectedAgent ? this.getActiveEmployeeName(selectedAgent) : 'el empleado';
  }

  confirmTransfer(): void {
    if (
      !this.selectedConversation
      || !this.isConversationAssignedToMe(this.selectedConversation)
      || !this.selectedTransferAgentId
    ) return;
    
    this.isTransferring = true;
    const conversationId = this.selectedConversation.id;
    const transferToEster = this.selectedTransferAgentId === this.esterTransferAgentId;
    const targetAgentId = transferToEster
      ? ''
      : String(this.selectedTransferAgentId);

    const processSuccess = () => {
        this.showTransferModal = false;
        this.isTransferring = false;
        const assignedAgent = transferToEster
          ? null
          : this.transferAgents.find(
              (agent: any) => this.getTransferAgentId(agent) === targetAgentId,
            );
        this.selectedConversation!.assignee_id = transferToEster
          ? null
          : targetAgentId;
        this.selectedConversation!.assignee_name = transferToEster
          ? 'Ester Assistant'
          : assignedAgent
            ? this.getActiveEmployeeName(assignedAgent)
            : `Agente ${targetAgentId}`;

        // Buscar el agente en memoria para sacar su ID de Mongo y enviarle el Push
        const contactName = this.selectedConversation?.contact.name || 'un cliente';
        
        if (assignedAgent && (assignedAgent.id || assignedAgent._id)) {
          const topic = assignedAgent.id || assignedAgent._id;
          this.firebaseNotifications.sendTestNotification({
            topic: topic,
            title: 'Nueva Conversación Transferida',
            body: `Se te ha transferido el chat de ${contactName}.`,
            data: {
              type: 'chat_transfer',
              tab: 'chat',
              conversationId: conversationId.toString(),
              targetAgentId,
              sourceAgentId: this.whatsappAgentId || this.currentUserId,
            },
          }).subscribe({
            error: (err) => console.error('Error enviando push de transferencia', err)
          });
        }

        // Mostramos Toast / System Message y actualizamos la vista
        // Y cerramos la interfaz de inmediato para bloquear acceso a continuar escribiendo
        this.selectedConversation = null;
        this.messages = []; // Clear current feed array
        this.messageService.add({
          severity: 'success',
          summary: 'Transferencia completa',
          detail: transferToEster
            ? 'La conversación ahora será gestionada por Ester Assistant.'
            : `La conversación fue transferida a ${
                assignedAgent ? this.getActiveEmployeeName(assignedAgent) : 'otro empleado'
              }.`,
        });
        this.loadConversations(); // Recargar lista para reflejar salida
    };

    this.whatsappApi.assignAgentToConversation(conversationId, targetAgentId).subscribe({
      next: (res) => {
        if (res.success) {
           processSuccess();
        } else {
           this.isTransferring = false;
           this.messageService.add({
             severity: 'error',
             summary: 'No se pudo transferir',
             detail: 'La conversación no cambió de empleado. Inténtalo nuevamente.',
           });
        }
      },
      error: () => {
        this.isTransferring = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error de conexión',
          detail: 'No se pudo transferir la conversación. Inténtalo nuevamente.',
        });
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
        this.whatsappApi.assignAgentToConversation(conv.id, '').subscribe({
          next: () => {
             completed++;
             this.checkTransferAllProgress(completed + fails, activeConvs.length, fails);
          },
          error: () => {
             completed++;
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
    const cacheKey = `whatsapp_convs_${this.userInboxId}_all`;
    if (!this.conversations.length) {
      this.filteredConversations = [];
      this.selectedConversation = null;
    }

    this.loadingConversations = true;
    this.whatsappApi.getConversations(this.userInboxId, 1, this.whatsappAgentId, true).subscribe({
      next: (res: any) => {
        this.loadingConversations = false;
        if (res.success) {
          this.conversations = this.sortConversations(res.conversations || []);
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
      c.last_message.toLowerCase().includes(term) ||
      this.getConversationAssigneeLabel(c).toLowerCase().includes(term)
    );
  }

  getConversationAssigneeLabel(conv: ChatConversation): string {
    if (!conv.assignee_id) return 'Ester Assistant';
    return (conv.assignee_name || conv.assignee_email || `Agente ${conv.assignee_id}`).trim();
  }

  isConversationAssignedToMe(
    conv: ChatConversation | null = this.selectedConversation,
  ): boolean {
    const assigneeId = String(conv?.assignee_id || '').trim();
    if (!assigneeId) return false;

    return [this.whatsappAgentId, this.currentUserId]
      .map(id => String(id || '').trim())
      .filter(Boolean)
      .includes(assigneeId);
  }

  getConversationManagerLabel(
    conv: ChatConversation | null = this.selectedConversation,
  ): string {
    if (!conv?.assignee_id) return 'Ester Assistant';
    return String(
      conv.assignee_name
      || conv.assignee_email
      || 'otro empleado',
    ).trim();
  }

  private sortConversations(conversations: ChatConversation[]): ChatConversation[] {
    return [...conversations].sort((a, b) => {
      const assignmentPriorityDifference =
        Number(this.isConversationAssignedToMe(b))
        - Number(this.isConversationAssignedToMe(a));

      if (assignmentPriorityDifference !== 0) {
        return assignmentPriorityDifference;
      }

      const aTime = Number(a.last_message_time || a.contact_last_seen_at || 0);
      const bTime = Number(b.last_message_time || b.contact_last_seen_at || 0);
      const activityDifference = bTime - aTime;

      if (activityDifference !== 0) {
        return activityDifference;
      }

      return Number(b.id || 0) - Number(a.id || 0);
    });
  }

  selectConversation(conv: ChatConversation, navigate: boolean = true): void {
    this.stopConversationPresenceSession();
    this.stopChatPolling();
    conv.unread_count = 0; // Clear indicator instantly mimicking visual read receipts
    this.resetPlayableAudio();
    this.selectedConversation = conv;
    if (navigate) {
      this.pendingFocusedMessageId = null;
    }
    this.focusedMessageId = null;
    if (this.currentUserId) {
      localStorage.setItem(`last_opened_chat_${this.currentUserId}`, conv.id.toString());
    }
    this.messages = [];
    this.loadingOlderMessages = false;
    this.hasOlderMessages = true;
    this.lastApiMessageId = null;
    this.chatInput = '';
    this.sendingEsterReply = false;
    this.sendingConversationReminder = false;
    this.replyingTo = null;
    this.reactionPickerMessageId = null;
    this.showContactInfo = false;
    this.gpsUser = null;
    this.startConversationPresenceSession();
    this.loadMessages();
    this.loadGpsUser(conv.contact.phone);
    if (navigate) {
      this.location.go(`/admin/communication/chat/${conv.id}`);
    }
  }

  openInternalMessageReference(message: InternalChatMessage): void {
    const conversationId = Number(message.referenceConversationId || 0);
    if (!conversationId) return;

    const messageId = Number(message.referenceMessageId || 0);
    this.pendingConversationId = conversationId;
    this.pendingFocusedMessageId = messageId > 0 ? messageId : null;
    this.focusedMessageId = null;
    this.activeTab = 'chat';
    this.stopInternalChatPolling();
    this.stopActiveEmployeesPolling();

    this.router.navigate(
      ['/admin/communication', 'chat', conversationId],
      {
        queryParams: messageId > 0 ? { messageId } : undefined,
      },
    ).then(() => {
      const conversation = this.conversations.find(
        item => item.id === conversationId,
      );
      if (conversation) {
        this.pendingConversationId = null;
        this.selectConversation(conversation, false);
        return;
      }

      if (this.userInboxId) {
        this.loadConversations();
      }
    });
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

  getGpsUserDeviceCount(): number {
    const directCount = Number(this.gpsUser?.device_count);
    if (Number.isFinite(directCount) && directCount >= 0) {
      return directCount;
    }

    const paginatedTotal = Number(this.targetsTotal);
    if (Number.isFinite(paginatedTotal) && paginatedTotal >= 0) {
      return paginatedTotal;
    }

    return this.userTargets?.length || 0;
  }

  hasCustomerSatisfaction(): boolean {
    return Boolean(
      this.gpsUser?._id
      || this.selectedConversation?.contact?.user_id,
    );
  }

  getCustomerSatisfactionLevel(): number {
    const suppliedLevel =
      this.selectedConversation?.contact?.satisfaction_level
      ?? this.gpsUser?.customer_satisfaction_level
      ?? 10;
    const numericLevel = Number(suppliedLevel);
    if (!Number.isFinite(numericLevel)) return 10;
    return Math.min(10, Math.max(0, Math.round(numericLevel)));
  }

  getCustomerSatisfactionClass(): string {
    const level = this.getCustomerSatisfactionLevel();
    if (level >= 8) return 'comm-customer-satisfaction--high';
    if (level >= 5) return 'comm-customer-satisfaction--medium';
    return 'comm-customer-satisfaction--low';
  }

  openGpsDetailsModal(event?: Event): void {
    event?.stopPropagation();
    if (!this.gpsUser?._id) return;

    this.showGpsDetailsModal = true;
    this.gpsDetailsOffset = 0;
    this.loadGpsDetails();
  }

  goToGpsUserAccount(event?: Event): void {
    event?.stopPropagation();
    if (!this.gpsUser?._id) return;

    this.router.navigate(['/admin/management', 'u', this.gpsUser._id]);
  }

  async loadGpsDetails(): Promise<void> {
    if (!this.gpsUser?._id) return;

    this.gpsDetailsLoading = true;
    try {
      const res = await this.targetsService.getTargetsWithPagination(
        this.gpsUser._id,
        this.gpsDetailsOffset,
        this.gpsDetailsLimit
      );
      this.gpsDetailsTargets = res.devices || [];
      this.gpsDetailsTotal = res.totalCount || this.gpsDetailsTargets.length;
    } catch (error) {
      console.error('[Communication] Error loading GPS details:', error);
      this.gpsDetailsTargets = [];
      this.gpsDetailsTotal = 0;
      this.messageService.add({
        severity: 'error',
        summary: 'No se pudieron cargar los GPS',
        detail: 'Intenta abrir los detalles nuevamente.'
      });
    } finally {
      this.gpsDetailsLoading = false;
      this.cdr.detectChanges();
    }
  }

  onGpsDetailsPageChange(event: any): void {
    this.gpsDetailsOffset = event.first;
    this.gpsDetailsLimit = event.rows;
    this.loadGpsDetails();
  }

  getGpsDetailsVisibleEnd(): number {
    return Math.min(this.gpsDetailsOffset + this.gpsDetailsTargets.length, this.gpsDetailsTotal);
  }

  getGpsDetailsTargetName(target: any): string {
    return target?.name || target?.device_name || target?.title || target?.plate || 'Vehículo sin nombre';
  }

  getGpsDetailsTargetImei(target: any): string {
    return target?.device_imei || target?.imei || target?.imei_number || 'N/A';
  }

  isGpsDetailsTargetVerified(target: any): boolean {
    const source = target?.originalTarget || target || {};
    const device = source?.device || target?.device || {};
    const values = [
      target?.verificado,
      target?.verified,
      target?.is_verified,
      target?.vehicle_verified,
      source?.verificado,
      source?.verified,
      source?.is_verified,
      source?.vehicle_verified,
      device?.verificado,
      device?.verified,
      device?.is_verified,
      device?.vehicle_verified
    ];

    return values.some(value => {
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === 'true'
          || normalized === '1'
          || normalized === 'yes'
          || normalized === 'si'
          || normalized === 'sí';
      }

      return value === true || value === 1;
    });
  }

  getGpsDetailsExpirationLabel(target: any): string {
    const source = target?.originalTarget || target || {};
    const rawDate = target?.expiration_date
      || source?.expiration_date
      || target?.expirationDate
      || source?.expirationDate
      || target?.expires_at
      || source?.expires_at
      || target?.expiration
      || source?.expiration;

    if (!rawDate) return 'Expira: -';

    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return 'Expira: -';

    const formatted = date.toLocaleDateString('es-DO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    return `Expira: ${formatted}`;
  }

  private loadGpsDetailsProtocols(): void {
    if (this.gpsDetailsProtocolsLoading || this.gpsDetailsProtocols.length > 0) return;

    this.gpsDetailsProtocolsLoading = true;
    this.protocolsService.getAllProtocols()
      .pipe(finalize(() => {
        this.gpsDetailsProtocolsLoading = false;
      }))
      .subscribe({
        next: (protocols) => {
          this.gpsDetailsProtocols = Array.isArray(protocols) ? protocols : [];
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.warn('[Communication] No se pudo cargar el catálogo de protocolos:', error);
        }
      });
  }

  isGpsDetailsTag(target: any): boolean {
    const rawStatus = String(
      target?.traccarInfo?.status
      || target?.traccarStatus
      || target?.statusText
      || ''
    ).trim().toLowerCase();
    if (['localizado', 'no localizado', 'located', 'not located'].includes(rawStatus)) {
      return true;
    }

    const rawType = target?.type || target?.originalTarget?.type;
    const protocolObj = target?.protocol
      || target?.originalTarget?.protocol
      || (rawType && typeof rawType === 'object' ? rawType : null);
    if (protocolObj && typeof protocolObj === 'object') {
      if (protocolObj.isAirtag !== undefined) return !!protocolObj.isAirtag;
      const protocolName = String(protocolObj.name || protocolObj.model || protocolObj.title || '').toLowerCase();
      if (protocolName.includes('tag') || protocolName.includes('airtag') || protocolName.includes('mtag')) return true;
    }

    const protocolId = typeof rawType === 'object'
      ? String(rawType?._id || rawType?.id || '')
      : String(rawType || '');
    if (protocolId) {
      const matchedProtocol = this.gpsDetailsProtocols.find((protocol) => String(protocol?._id) === protocolId);
      if (matchedProtocol) return matchedProtocol.isAirtag === true;
    }

    const fields = [
      target?.protocol,
      target?.protocol_name,
      target?.type,
      target?.device_type,
      target?.model,
      target?.gps_model,
      target?.device_model,
      target?.originalTarget?.type
    ];

    return fields.some((field: any) => {
      if (!field) return false;
      const text = typeof field === 'object'
        ? String(field.name || field.model || field.title || '')
        : String(field);
      const normalized = text.toLowerCase();
      return normalized.includes('tag') || normalized.includes('airtag') || normalized.includes('mtag');
    });
  }

  getGpsDetailsStatus(target: any): { label: string; tone: string; icon: string } {
    const rawStatus = String(
      target?.traccarInfo?.status
      || target?.traccarStatus
      || target?.statusText
      || target?.status
      || ''
    ).trim().toLowerCase();
    const offlineMinutes = this.getGpsDetailsOfflineMinutes(target);

    if (this.isGpsDetailsTag(target)) {
      const isExplicitlyNotLocated = rawStatus === 'no localizado' || rawStatus === 'not located';
      const isLocated = !isExplicitlyNotLocated && (
        rawStatus === 'online'
        || rawStatus === 'localizado'
        || rawStatus === 'located'
        || (offlineMinutes !== null && offlineMinutes <= (15 * 24 * 60))
      );

      return isLocated
        ? { label: 'Localizado', tone: 'located', icon: 'pi pi-map-marker' }
        : { label: 'No localizado', tone: 'not-located', icon: 'pi pi-ban' };
    }

    if (rawStatus.includes('señal') || rawStatus.includes('senal') || rawStatus.includes('weak')) {
      return { label: 'Señal débil', tone: 'weak', icon: 'pi pi-wifi' };
    }

    if (rawStatus === 'online' || rawStatus === 'en línea' || rawStatus === 'en linea') {
      return { label: 'En línea', tone: 'online', icon: 'pi pi-circle-fill' };
    }

    if (offlineMinutes !== null && offlineMinutes <= 10) {
      return { label: 'En línea', tone: 'online', icon: 'pi pi-circle-fill' };
    }

    if (offlineMinutes !== null && offlineMinutes <= 60) {
      return { label: 'Señal débil', tone: 'weak', icon: 'pi pi-wifi' };
    }

    return { label: 'Fuera de línea', tone: 'offline', icon: 'pi pi-ban' };
  }

  getCommunicationTargetListStatus(target: any): { label: string; tone: string; icon: string } {
    const status = this.getGpsDetailsStatus(target);
    if (this.isGpsDetailsTag(target)) return status;

    if (status.label === 'En línea') {
      return { ...status, label: 'Conectado' };
    }

    if (status.label === 'Fuera de línea') {
      return { ...status, label: 'Desconectado' };
    }

    return status;
  }

  getGpsDetailsLastUpdateLabel(target: any): string {
    const date = this.getGpsDetailsLastUpdateDate(target);
    if (!date) return '';

    return `Última actualización hace ${this.formatGpsDetailsTimeAgo(date)}`;
  }

  private getGpsDetailsOfflineMinutes(target: any): number | null {
    const lastUpdate = this.getGpsDetailsLastUpdateDate(target);
    if (!lastUpdate) return null;

    const diffMs = Date.now() - lastUpdate.getTime();
    if (diffMs < 0) return 0;

    return Math.floor(diffMs / 60000);
  }

  private getGpsDetailsLastUpdateDate(target: any): Date | null {
    const source = target?.originalTarget || target || {};
    const rawDate = target?.traccarInfo?.lastUpdate
      || source?.traccarInfo?.lastUpdate
      || target?.lastUpdate
      || source?.lastUpdate
      || target?.last_connection
      || target?.lastConnection
      || target?.position?.serverTime
      || target?.position?.deviceTime
      || target?.updatedAt;

    if (!rawDate) return null;

    const date = new Date(rawDate);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private formatGpsDetailsTimeAgo(date: Date): string {
    const diffMs = Math.max(0, Date.now() - date.getTime());
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 1) return 'un momento';
    if (diffMinutes < 60) return `${diffMinutes} minuto${diffMinutes === 1 ? '' : 's'}`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hora${diffHours === 1 ? '' : 's'}`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays} día${diffDays === 1 ? '' : 's'}`;

    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths} mes${diffMonths === 1 ? '' : 'es'}`;

    const diffYears = Math.floor(diffDays / 365);
    return `${diffYears} año${diffYears === 1 ? '' : 's'}`;
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

           const textToSend = `${this.getAgentSignature()}\nhttps://tracker.montao.net/realtimelink?data=${encodedData}`;

           const pendingMsg: ChatMessage = { from: 'me', text: textToSend, parsedHtml: this.parseMessageContent(textToSend), time: new Date() };
           this.enrichWithAppUrls(pendingMsg);
           this.messages.push(pendingMsg);
           this.scrollToBottom();

           this.whatsappApi.sendConversationMessage(
             this.selectedConversation!.id,
             textToSend,
             undefined,
             undefined,
             this.whatsappAgentId
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
      const textToSend = `${this.getAgentSignature()}\n${url}`;

      const pendingMsg: ChatMessage = { from: 'me', text: textToSend, parsedHtml: this.parseMessageContent(textToSend), time: new Date() };
      this.enrichWithAppUrls(pendingMsg);
      this.messages.push(pendingMsg);
      this.scrollToBottom();

      this.whatsappApi.sendConversationMessage(
         this.selectedConversation!.id,
         textToSend,
         undefined,
         undefined,
         this.whatsappAgentId
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
      this.whatsappApi.getConversations(this.userInboxId, 1, this.whatsappAgentId, true).subscribe({
        next: (res: any) => {
          if (res.success) {
            const newConvs = this.sortConversations(res.conversations || []);
            const newFingerprint = this.getConversationsFingerprint(newConvs);
            if (newFingerprint !== this.conversationsFingerprint) {
              const wasAssignedToMe = this.isConversationAssignedToMe();
              this.conversations = newConvs;
              this.conversationsFingerprint = newFingerprint;
              if (this.selectedConversation) {
                const refreshedConversation = newConvs.find(
                  conversation => conversation.id === this.selectedConversation?.id,
                );
                if (refreshedConversation) {
                  this.selectedConversation = refreshedConversation;
                  if (wasAssignedToMe && !this.isConversationAssignedToMe(refreshedConversation)) {
                    this.replyingTo = null;
                    this.showStickerPicker = false;
                    if (this.recordingVoice && this.recordingVoiceContext === 'chat') {
                      this.cancelVoiceRecording();
                    }
                  }
                }
              }
              this.filterConversations();
            }
          }
        }
      });
    }, 5000);
  }

  private getConversationsFingerprint(convs: ChatConversation[]): string {
    return convs.map(c => `${c.id}:${c.last_message}:${c.last_message_time}:${c.unread_count}:${c.assignee_id || ''}:${c.assignee_name || ''}:${c.assignee_online ? 1 : 0}:${c.assignee_typing ? 1 : 0}:${c.reminder_eligible ? 1 : 0}:${c.reminder_waiting_since || ''}:${c.contact.satisfaction_level ?? ''}:${c.campaign_execution_id || ''}:${c.campaign_active ? 1 : 0}`).join('|');
  }

  openActiveCampaign(): void {
    const conversation = this.selectedConversation;
    if (!conversation?.campaign_id) return;
    this.router.navigate(['/admin/interacciones'], {
      queryParams: {
        listId: conversation.campaign_id,
        executionId: conversation.campaign_execution_id || null,
      },
    });
  }

  private stopConversationsPolling(): void {
    if (this.conversationsPollingInterval) {
      clearInterval(this.conversationsPollingInterval);
      this.conversationsPollingInterval = null;
    }
  }

  private normalizeAgentDepartment(department?: string | null): string {
    const normalized = String(department || '').trim();
    if (!normalized || normalized.toLowerCase() === 'exampledepartmentid') {
      return normalized ? 'Operaciones' : '';
    }
    return normalized;
  }

  private getAgentSignature(): string {
    const department = this.normalizeAgentDepartment(this.currentUserDepartment);
    return `> ${buildAgentSignatureLabel(this.currentUserName, department)}`;
  }

  // ============================
  // MESSAGES
  // ============================

  loadInternalChat(): void {
    this.communicationNotifications.markInternalChatRead();
    this.loadingInternalMessages = true;
    this.internalChatError = '';
    this.internalChatService.getMessages({ limit: 50 }).subscribe({
      next: (res) => {
        this.loadingInternalMessages = false;
        this.internalMessages = res.messages || [];
        this.scrollInternalChatToBottom();
        this.startInternalChatPolling();
        this.startActiveEmployeesPolling();
      },
      error: (error) => {
        this.loadingInternalMessages = false;
        this.internalChatError = error?.error?.message || 'No se pudo cargar el grupo Montao GPS.';
        this.stopInternalChatPolling();
        this.stopActiveEmployeesPolling();
      }
    });
  }

  toggleInternalChatMuted(): void {
    const muted = this.communicationNotifications.toggleInternalChatMuted();
    this.messageService.add({
      severity: muted ? 'info' : 'success',
      summary: muted ? 'Grupo silenciado' : 'Grupo activo',
      detail: muted
        ? 'No recibirás sonido, badge ni notificaciones flotantes de este chat.'
        : 'Volverás a recibir notificaciones del chat grupal.'
    });
  }

  sendInternalMessage(): void {
    const text = this.internalChatInput.trim();
    if (!text || this.sendingInternalMessage) return;

    this.sendingInternalMessage = true;
    this.internalChatInput = '';
    this.internalChatService.sendMessage(text).subscribe({
      next: (res) => {
        this.sendingInternalMessage = false;
        if (res.message && !this.internalMessages.some(message => message._id === res.message._id)) {
          this.internalMessages = [...this.internalMessages, res.message];
        }
        this.scrollInternalChatToBottom();
      },
      error: (error) => {
        this.sendingInternalMessage = false;
        this.internalChatInput = text;
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo enviar',
          detail: error?.error?.message || 'Intenta nuevamente.'
        });
      }
    });
  }

  sendInternalAttachment(file: File, forcedText?: string): void {
    if (!file || this.uploadingInternalAttachment || !!this.internalChatError) return;

    this.uploadingInternalAttachment = true;
    this.internalChatService.uploadAttachment(file).subscribe({
      next: (res) => {
        const attachment = res?.attachment;
        if (!attachment?.url) {
          this.uploadingInternalAttachment = false;
          this.messageService.add({ severity: 'error', summary: 'No se pudo subir', detail: 'El archivo no retornó una URL válida.' });
          return;
        }
        const text = forcedText ?? this.internalChatInput.trim();
        if (!forcedText) this.internalChatInput = '';
        this.internalChatService.sendMessage(text, [attachment], attachment.fileType || 'file').subscribe({
          next: (messageRes) => {
            this.uploadingInternalAttachment = false;
            if (messageRes.message && !this.internalMessages.some(message => message._id === messageRes.message._id)) {
              this.internalMessages = [...this.internalMessages, messageRes.message];
            }
            this.scrollInternalChatToBottom();
          },
          error: (error) => {
            this.uploadingInternalAttachment = false;
            if (!forcedText) this.internalChatInput = text;
            this.messageService.add({
              severity: 'error',
              summary: 'No se pudo enviar',
              detail: error?.error?.message || 'El archivo subió, pero no se pudo enviar el mensaje.'
            });
          }
        });
      },
      error: (error) => {
        this.uploadingInternalAttachment = false;
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo subir',
          detail: error?.error?.message || 'Intenta con otro archivo.'
        });
      }
    });
  }

  onInternalMediaSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.sendInternalAttachment(file);
  }

  addInternalEmoji(emoji: string): void {
    this.internalChatInput = `${this.internalChatInput || ''}${emoji}`;
    this.showInternalEmojiPicker = false;
  }

  sendInternalSticker(sticker: WhatsAppSticker): void {
    if (!sticker?.url || this.sendingStickerId) return;

    this.sendingStickerId = sticker.id;
    const attachment: InternalChatAttachment = {
      url: sticker.url,
      name: sticker.name,
      mimeType: 'image/webp',
      fileType: 'sticker',
      fileId: sticker.id,
    };
    this.internalChatService.sendMessage('', [attachment], 'sticker').subscribe({
      next: (res) => {
        this.sendingStickerId = null;
        if (res.message && !this.internalMessages.some(message => message._id === res.message._id)) {
          this.internalMessages = [...this.internalMessages, res.message];
        }
        this.showStickerPicker = false;
        this.scrollInternalChatToBottom();
      },
      error: (error) => {
        this.sendingStickerId = null;
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo enviar',
          detail: error?.error?.message || 'Error de conexión al enviar el sticker.'
        });
      }
    });
  }

  saveInternalImageAsSticker(attachment: InternalChatAttachment, message: InternalChatMessage): void {
    if (!attachment?.url || this.savingStickerUrl) return;

    this.savingStickerUrl = attachment.url;
    const fallbackName = message?._id ? `sticker-grupo-${message._id}` : 'sticker-grupo';
    this.whatsappApi.saveStickerFromImage({
      image_url: attachment.url,
      name: fallbackName
    }).pipe(
      timeout(45000),
      finalize(() => this.savingStickerUrl = null)
    ).subscribe({
      next: (res: any) => {
        if (res?.success && res.sticker) {
          this.stickers = [res.sticker, ...this.stickers.filter(sticker => sticker.id !== res.sticker.id)];
          this.showStickerPicker = true;
          this.messageService.add({
            severity: res.duplicated ? 'info' : 'success',
            summary: res.duplicated ? 'Sticker ya guardado' : 'Sticker guardado',
            detail: res.duplicated ? 'Esta imagen ya estaba en tu lista de stickers' : 'La imagen se guardó como sticker'
          });
          return;
        }
        this.messageService.add({ severity: 'error', summary: 'No se pudo guardar', detail: res?.error || 'Intenta con otra imagen' });
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'No se pudo guardar', detail: 'Error de conexión al guardar el sticker' });
      }
    });
  }

  isMyInternalMessage(message: InternalChatMessage): boolean {
    return String(message?.author?._id || '') === String(this.currentUserId || '');
  }

  getInternalAuthorName(message: InternalChatMessage): string {
    const author = message?.author;
    const fullName = `${author?.name || ''} ${author?.last_name || ''}`.trim();
    return fullName || author?.email || 'Empleado';
  }

  getInternalAuthorInitials(message: InternalChatMessage): string {
    return this.getInitials(this.getInternalAuthorName(message));
  }

  isInternalImageAttachment(attachment: InternalChatAttachment): boolean {
    const mimeType = String(attachment?.mimeType || '').toLowerCase();
    const url = String(attachment?.url || '').toLowerCase().split('?')[0];
    return mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/.test(url);
  }

  isInternalVideoAttachment(attachment: InternalChatAttachment): boolean {
    const mimeType = String(attachment?.mimeType || '').toLowerCase();
    const url = String(attachment?.url || '').toLowerCase().split('?')[0];
    return mimeType.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/.test(url);
  }

  isInternalAudioAttachment(attachment: InternalChatAttachment): boolean {
    const mimeType = String(attachment?.mimeType || '').toLowerCase();
    const url = String(attachment?.url || '').toLowerCase().split('?')[0];
    return attachment?.fileType === 'audio' || mimeType.startsWith('audio/') || /\.(mp3|m4a|aac|ogg|oga|wav|webm)$/.test(url);
  }

  isInternalStickerAttachment(attachment: InternalChatAttachment): boolean {
    const mimeType = String(attachment?.mimeType || '').toLowerCase();
    const url = String(attachment?.url || '').toLowerCase().split('?')[0];
    return attachment?.fileType === 'sticker' || mimeType === 'image/webp' || url.endsWith('.webp');
  }

  isInternalStickerOnlyMessage(message: InternalChatMessage): boolean {
    const text = String(message?.text || '').trim();
    const attachments = message?.attachments || [];
    return !text && attachments.length > 0 && attachments.every(attachment => this.isInternalStickerAttachment(attachment));
  }

  getInternalAttachmentName(attachment: InternalChatAttachment): string {
    return attachment?.name || attachment?.url?.split('/').pop() || 'Archivo';
  }

  private startInternalChatPolling(): void {
    this.stopInternalChatPolling();
    this.internalChatPollingInterval = setInterval(() => {
      if (this.activeTab !== 'grupo') return;
      const lastId = this.internalMessages[this.internalMessages.length - 1]?._id;
      this.internalChatService.getMessages({ limit: 50, after: lastId }).subscribe({
        next: (res) => {
          const newMessages = (res.messages || []).filter(
            message => !this.internalMessages.some(existing => existing._id === message._id)
          );
          if (newMessages.length) {
            this.internalMessages = [...this.internalMessages, ...newMessages];
            this.scrollInternalChatToBottom();
          }
        },
        error: () => {}
      });
    }, this.POLL_INTERVAL);
  }

  private startActiveEmployeesPolling(): void {
    this.stopActiveEmployeesPolling();
    this.loadActiveEmployeesCount();
    this.activeEmployeesPollingInterval = setInterval(() => {
      if (this.activeTab === 'grupo') {
        this.loadActiveEmployeesCount();
      }
    }, this.ACTIVE_EMPLOYEES_POLL_INTERVAL);
  }

  private stopActiveEmployeesPolling(): void {
    if (this.activeEmployeesPollingInterval) {
      clearInterval(this.activeEmployeesPollingInterval);
      this.activeEmployeesPollingInterval = null;
    }
  }

  private loadActiveEmployeesCount(): void {
    this.userService.getActiveUsers(15).subscribe({
      next: (users) => {
        this.activeEmployees = (users || []).filter((user: any) =>
          ['empleado', 'tecnico_empleado'].includes(String(user?.affiliation_type_id || '').toLowerCase()) &&
          String(user?._id || user?.id || '') !== this.currentUserId
        ).sort((first: any, second: any) => this.getActiveEmployeeName(first).localeCompare(this.getActiveEmployeeName(second)));
        this.activeEmployeesCount = this.activeEmployees.length;
      },
      error: () => {
        this.activeEmployeesCount = null;
        this.activeEmployees = [];
      }
    });
  }

  openActiveEmployeesDialog(): void {
    if (this.activeEmployeesCount === null) return;
    this.showActiveEmployeesDialog = true;
  }

  getActiveEmployeeName(employee: any): string {
    return [employee?.name, employee?.last_name]
      .filter(Boolean)
      .join(' ')
      .trim() || employee?.email || 'Empleado';
  }

  getActiveEmployeeInitials(employee: any): string {
    return this.getActiveEmployeeName(employee)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  private stopInternalChatPolling(): void {
    if (this.internalChatPollingInterval) {
      clearInterval(this.internalChatPollingInterval);
      this.internalChatPollingInterval = null;
    }
  }

  private scrollInternalChatToBottom(): void {
    setTimeout(() => {
      if (this.internalMessagesContainer?.nativeElement) {
        this.internalMessagesContainer.nativeElement.scrollTop = this.internalMessagesContainer.nativeElement.scrollHeight;
      }
    }, 80);
  }

  private parseMessageContent(text: string): string {
    if (!text) return '';
    
    // Procesar Markdown de WhatsApp (negrita con asteriscos)
    let parsedText = text.replace(/\*(.*?)\*/g, '<b>$1</b>');

    // Match signature that might or might not have a body
    const match = parsedText.match(/^>\s*([^\n]+)(?:\n([\s\S]*))?$/);
    if (match) {
        const sig = compactAgentSignatureLabel(match[1]);
        const body = (match[2] || '').trim().replace(/\n/g, '<br/>');
        return `<div class="comm-msg-sig"><i class="pi pi-user comm-msg-sig-icon"></i> <span>${sig}</span></div>` +
               (body ? `<div class="comm-msg-body">${body}</div>` : '');
    }
    return parsedText.trim().replace(/\n/g, '<br/>');
  }

  getCleanPreview(text: string | undefined): string {
    if (!text) return 'Sin mensajes';
    if (this.isTechnicalStickerLabel(text)) return 'Sticker';

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

      const hasStickerAttachment = (msg.attachments || []).some(att => this.isStickerAttachment(att));
      if (hasStickerAttachment && this.isTechnicalStickerLabel(msg.text)) {
          msg.text = '';
          msg.parsedHtml = '';
          return msg;
      }

      const mediaMatch = msg.text.match(/^\[Archivo enviado por WhatsApp\]\s*\n(image|video|audio|document)\s*\n([^\n]*)\n(https?:\/\/\S+)/i);
      if (mediaMatch) {
          const rawType = mediaMatch[1].toLowerCase();
          const mediaType = rawType === 'document' ? 'file' : rawType;
          msg.attachments = [
              ...(msg.attachments || []),
              {
                  data_url: mediaMatch[3],
                  file_type: mediaType,
                  content_type: mediaType === 'video'
                    ? 'video/mp4'
                    : (mediaType === 'audio'
                      ? 'audio/mpeg'
                      : (mediaType === 'file' ? 'application/octet-stream' : 'image/jpeg')),
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

    const conversationId = this.selectedConversation.id;
    const requestId = ++this.activeMessagesRequestId;
    this.loadingMessages = true;
    this.loadingOlderMessages = false;
    this.hasOlderMessages = true;
    this.messagesLoadError = '';
    this.whatsappApi.getConversationMessages(conversationId, this.messagesPageSize).pipe(timeout(20000)).subscribe({
      next: (res: any) => {
        if (requestId !== this.activeMessagesRequestId || this.selectedConversation?.id !== conversationId) return;
        this.loadingMessages = false;
        if (res.success && res.messages?.length) {
          this.messages = this.mapApiMessages(res.messages);
          this.preparePlayableAudio(this.messages);
          this.lastApiMessageId = res.messages[res.messages.length - 1].id;
          this.hasOlderMessages = res.messages.length >= this.messagesPageSize;
        } else {
          this.lastApiMessageId = null;
          this.hasOlderMessages = false;
        }
        if (this.pendingFocusedMessageId) {
          this.focusReferencedMessage(this.pendingFocusedMessageId);
        } else {
          this.scrollToBottom();
        }
        this.startChatPolling();
      },
      error: (error) => {
        if (requestId !== this.activeMessagesRequestId || this.selectedConversation?.id !== conversationId) return;
        console.error('[Communication] Error loading conversation messages:', error);
        this.messagesLoadError = 'No se pudieron cargar los mensajes. Intenta actualizar.';
        this.loadingMessages = false;
        this.startChatPolling();
      }
    });
  }

  canAskEsterToReply(): boolean {
    const conversation = this.selectedConversation;
    const latestMessage = this.messages[this.messages.length - 1];
    return !!(
      conversation
      && this.isConversationAssignedToMe(conversation)
      && !this.isOutside24hWindow(conversation)
      && latestMessage?.from === 'incoming'
      && latestMessage.id
    );
  }

  askEsterToReply(): void {
    if (!this.canAskEsterToReply() || this.sendingEsterReply) return;

    const conversationId = this.selectedConversation!.id;
    this.sendingEsterReply = true;
    this.whatsappApi
      .sendEmployeeEsterReply(conversationId)
      .pipe(timeout(210000))
      .subscribe({
        next: response => {
          this.sendingEsterReply = false;
          if (this.selectedConversation?.id !== conversationId) return;

          if (response?.success) {
            this.chatInput = '';
            this.stopConversationTyping();
            this.replyingTo = null;
            this.loadMessages();
            return;
          }
          this.messageService.add({
            severity: 'error',
            summary: 'Ester no pudo responder',
            detail:
              response?.error
              || 'Intenta nuevamente en unos segundos.',
          });
        },
        error: () => {
          this.sendingEsterReply = false;
          if (this.selectedConversation?.id !== conversationId) return;
          this.messageService.add({
            severity: 'error',
            summary: 'Ester no pudo responder',
            detail: 'Intenta nuevamente en unos segundos.',
          });
        },
      });
  }

  onMessagesScroll(event: Event): void {
    const container = event.currentTarget as HTMLElement | null;
    if (
      !container ||
      container.scrollTop > 100 ||
      this.loadingMessages ||
      this.loadingOlderMessages ||
      !this.hasOlderMessages
    ) {
      return;
    }

    this.loadOlderMessages(container);
  }

  private loadOlderMessages(container: HTMLElement): void {
    if (!this.selectedConversation) return;

    const conversationId = this.selectedConversation.id;
    const oldestMessageId = this.messages.find((message) => !!message.id)?.id;
    if (!oldestMessageId) {
      this.hasOlderMessages = false;
      return;
    }

    const previousScrollHeight = container.scrollHeight;
    const previousScrollTop = container.scrollTop;
    this.loadingOlderMessages = true;

    this.whatsappApi
      .getConversationMessages(conversationId, this.messagesPageSize, oldestMessageId)
      .pipe(timeout(20000))
      .subscribe({
        next: (res: any) => {
          if (this.selectedConversation?.id !== conversationId) return;

          this.loadingOlderMessages = false;
          const apiMessages = res.success && Array.isArray(res.messages) ? res.messages : [];
          this.hasOlderMessages = apiMessages.length >= this.messagesPageSize;
          if (!apiMessages.length) return;

          const existingIds = new Set(
            this.messages
              .map((message) => message.id)
              .filter((id): id is number => typeof id === 'number')
          );
          const olderMessages = this.mapApiMessages(apiMessages)
            .filter((message) => !message.id || !existingIds.has(message.id));

          if (!olderMessages.length) {
            this.hasOlderMessages = false;
            return;
          }

          this.messages = [...olderMessages, ...this.messages];
          this.preparePlayableAudio(olderMessages);

          setTimeout(() => {
            if (this.selectedConversation?.id !== conversationId) return;
            const currentContainer = this.messagesContainer?.nativeElement as HTMLElement | undefined;
            if (!currentContainer) return;
            currentContainer.scrollTop =
              currentContainer.scrollHeight - previousScrollHeight + previousScrollTop;
          });
        },
        error: (error) => {
          if (this.selectedConversation?.id !== conversationId) return;
          console.warn('[Communication] Error loading older conversation messages:', error);
          this.loadingOlderMessages = false;
        }
      });
  }

  private mapApiMessages(apiMessages: any[]): ChatMessage[] {
    const msgMap = new Map<number, { text: string; from: string }>();
    for (const msg of apiMessages) {
      msgMap.set(msg.id, {
        text: msg.content || '📎 Adjunto',
        from: msg.from === 'incoming' ? 'incoming' : 'me',
      });
    }

    return apiMessages.map((msg: any) => {
      const mapped: ChatMessage = {
        id: msg.id,
        from: msg.from === 'incoming' ? 'incoming' as const : 'me' as const,
        text: msg.content,
        transcription: msg.transcription,
        parsedHtml: this.parseMessageContent(msg.content),
        time: new Date(msg.created_at * 1000),
        attachments: msg.attachments || [],
        reaction: msg.reaction?.emoji
          ? {
              emoji: msg.reaction.emoji,
              sender: msg.reaction.sender || 'Ester Assistant',
              from: msg.reaction.from || 'me',
            }
          : undefined,
      };

      this.enrichWithAppUrls(mapped);
      if (msg.reply_to?.id) {
        mapped.replyTo = {
          id: msg.reply_to.id,
          text: this.getApiReplyPreviewText(msg.reply_to),
          from: msg.reply_to.from === 'incoming' ? 'incoming' : 'me',
          type: msg.reply_to.type,
          attachments: msg.reply_to.attachments || [],
        };
      } else if (msg.in_reply_to && msgMap.has(msg.in_reply_to)) {
        const ref = msgMap.get(msg.in_reply_to)!;
        mapped.replyTo = { id: msg.in_reply_to, text: ref.text, from: ref.from };
      }

      return mapped;
    });
  }

  private focusReferencedMessage(
    messageId: number,
    remainingPages = 20,
  ): void {
    if (
      !this.selectedConversation
      || this.pendingFocusedMessageId !== messageId
    ) {
      return;
    }

    setTimeout(() => {
      const container = this.messagesContainer?.nativeElement as
        | HTMLElement
        | undefined;
      const target = container?.querySelector<HTMLElement>(
        `[data-message-id="${messageId}"]`,
      );
      if (target) {
        this.focusedMessageId = messageId;
        this.pendingFocusedMessageId = null;
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.focus({ preventScroll: true });
        return;
      }

      if (
        remainingPages <= 0
        || !this.hasOlderMessages
        || this.loadingOlderMessages
      ) {
        this.pendingFocusedMessageId = null;
        this.scrollToBottom();
        this.messageService.add({
          severity: 'warn',
          summary: 'Mensaje no disponible',
          detail:
            'Abrimos la conversación, pero el mensaje referido ya no está disponible.',
        });
        return;
      }

      this.loadOlderMessagesForReference(messageId, remainingPages);
    }, 120);
  }

  private loadOlderMessagesForReference(
    messageId: number,
    remainingPages: number,
  ): void {
    if (!this.selectedConversation) return;

    const conversationId = this.selectedConversation.id;
    const oldestMessageId = this.messages.find(message => !!message.id)?.id;
    if (!oldestMessageId) {
      this.hasOlderMessages = false;
      this.focusReferencedMessage(messageId, 0);
      return;
    }

    this.loadingOlderMessages = true;
    this.whatsappApi
      .getConversationMessages(
        conversationId,
        this.messagesPageSize,
        oldestMessageId,
      )
      .pipe(timeout(20000))
      .subscribe({
        next: (res: any) => {
          if (this.selectedConversation?.id !== conversationId) return;

          this.loadingOlderMessages = false;
          const apiMessages =
            res.success && Array.isArray(res.messages) ? res.messages : [];
          this.hasOlderMessages =
            apiMessages.length >= this.messagesPageSize;
          const existingIds = new Set(
            this.messages
              .map(message => message.id)
              .filter((id): id is number => typeof id === 'number'),
          );
          const olderMessages = this.mapApiMessages(apiMessages)
            .filter(message => !message.id || !existingIds.has(message.id));
          this.messages = [...olderMessages, ...this.messages];
          this.preparePlayableAudio(olderMessages);
          if (!olderMessages.length) {
            this.hasOlderMessages = false;
          }
          this.focusReferencedMessage(messageId, remainingPages - 1);
        },
        error: () => {
          if (this.selectedConversation?.id !== conversationId) return;
          this.loadingOlderMessages = false;
          this.hasOlderMessages = false;
          this.focusReferencedMessage(messageId, 0);
        },
      });
  }

  sendMessage(): void {
    if (
      !this.chatInput.trim()
      || !this.selectedConversation
      || !this.isConversationAssignedToMe(this.selectedConversation)
      || this.sendingMessage
    ) return;

    const text = this.chatInput.trim();
    const replyMsg = this.replyingTo;
    const newMsg: ChatMessage = { from: 'me', text, parsedHtml: this.parseMessageContent(text), time: new Date() };
    this.enrichWithAppUrls(newMsg);
    if (replyMsg?.id) {
      newMsg.replyTo = {
        id: replyMsg.id,
        text: this.getReplyPreviewText(replyMsg),
        from: replyMsg.from,
        attachments: replyMsg.attachments,
      };
    }
    this.messages.push(newMsg);
    
    // Incluye el nombre del agente en el mensaje saliente.
    const finalApiText = `${this.getAgentSignature()}\n${text}`;

    this.chatInput = '';
    this.stopConversationTyping();
    this.replyingTo = null;
    this.sendingMessage = true;
    this.scrollToBottom();

    this.whatsappApi.sendConversationMessage(
      this.selectedConversation.id,
      finalApiText,
      replyMsg?.id,
      undefined,
      this.whatsappAgentId
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
    if (!msg.id || !this.isConversationAssignedToMe()) return;
    this.replyingTo = msg;
    this.reactionPickerMessageId = null;
    this.showStickerPicker = false;
    this.refocusInput();
  }

  toggleReactionPicker(msg: ChatMessage, event: Event): void {
    event.stopPropagation();
    if (
      !msg.id
      || !this.isConversationAssignedToMe()
      || this.reactingMessageId === msg.id
    ) return;
    this.reactionPickerMessageId =
      this.reactionPickerMessageId === msg.id ? null : msg.id;
  }

  reactToMessage(msg: ChatMessage, emoji: string, event: Event): void {
    event.stopPropagation();
    if (
      !msg.id
      || !this.selectedConversation
      || !this.isConversationAssignedToMe(this.selectedConversation)
      || this.reactingMessageId !== null
    ) {
      return;
    }

    const conversationId = this.selectedConversation.id;
    this.reactionPickerMessageId = null;
    this.reactingMessageId = msg.id;
    this.whatsappApi
      .reactToConversationMessage(conversationId, msg.id, emoji)
      .pipe(finalize(() => this.reactingMessageId = null))
      .subscribe({
        next: (res: any) => {
          if (!res?.success) {
            this.messageService.add({
              severity: 'error',
              summary: 'No se pudo reaccionar',
              detail: res?.error || 'Inténtalo nuevamente',
            });
            return;
          }
          msg.reaction = {
            emoji,
            sender: this.currentUserName || 'Tú',
            from: 'me',
          };
        },
        error: (error: any) => {
          this.messageService.add({
            severity: 'error',
            summary: 'No se pudo reaccionar',
            detail:
              error?.error?.message
              || error?.error?.error
              || 'Error de conexión',
          });
        },
      });
  }

  cancelReply(): void {
    this.replyingTo = null;
  }

  getReplyPreviewText(msg: ChatMessage | ChatMessage['replyTo'] | null | undefined): string {
    const text = String(msg?.text || '').trim();
    if (text && !this.isTechnicalStickerLabel(text)) return text;
    const attachment = msg?.attachments?.[0];
    if (!attachment) return 'Mensaje';
    if (this.isStickerAttachment(attachment)) return 'Sticker';
    if (attachment.file_type === 'image') return 'Imagen';
    if (attachment.file_type === 'video') return 'Video';
    if (attachment.file_type === 'audio') return 'Nota de voz';
    return attachment.file_name || 'Documento';
  }

  hasAudioAttachment(msg: ChatMessage | null | undefined): boolean {
    return Boolean(msg?.attachments?.some(
      attachment => String(attachment?.file_type || '').toLowerCase() === 'audio'
    ));
  }

  getAudioTranscript(msg: ChatMessage | null | undefined): string {
    if (!this.hasAudioAttachment(msg)) return '';

    let transcript = String(msg?.transcription || msg?.text || '')
      .replace(/\s*\[audio\s*:[^\]]+\]\s*/gi, '\n')
      .trim();

    if (!transcript) return '';

    const signatureMatch = transcript.match(/^>\s*[^\n]+(?:\r?\n([\s\S]*))?$/);
    if (signatureMatch) {
      transcript = String(signatureMatch[1] || '').trim();
    }

    return transcript;
  }

  private getApiReplyPreviewText(reply: any): string {
    const text = String(reply?.content || '').trim();
    return this.getReplyPreviewText({
      id: Number(reply?.id || 0),
      from: reply?.from === 'incoming' ? 'incoming' : 'me',
      text,
      time: new Date(),
      attachments: reply?.attachments || [],
    });
  }

  loadStickers(): void {
    this.loadingStickers = true;
    this.whatsappApi.getStickers().subscribe({
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
    const fallbackName = msg.id ? `sticker-whatsapp-${msg.id}` : 'sticker-whatsapp';
    this.whatsappApi.saveStickerFromImage({
      image_url: att.data_url,
      name: fallbackName
    }).pipe(
      timeout(45000),
      finalize(() => this.savingStickerUrl = null)
    ).subscribe({
      next: (res: any) => {
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
    this.whatsappApi.uploadStickerImage(file, file.name).pipe(
      timeout(45000),
      finalize(() => this.uploadingSticker = false)
    ).subscribe({
      next: (res: any) => {
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

  private isTechnicalStickerLabel(text: string | undefined): boolean {
    const normalized = String(text || '').trim();
    return /^\[Sticker(?::[^\]]*)?\]$/i.test(normalized);
  }

  getPlayableAudioUrl(att: ChatAttachment): string {
    return this.playableAudioUrls.get(
      String(att?.data_url || '').trim()
    ) || '';
  }

  getPlayableVideoUrl(mediaUrl: string): string {
    return this.whatsappApi.getPlayableVideoUrl(mediaUrl);
  }

  isPlayableAudioLoading(att: ChatAttachment): boolean {
    return this.playableAudioLoading.has(
      String(att?.data_url || '').trim()
    );
  }

  hasPlayableAudioError(att: ChatAttachment): boolean {
    return this.playableAudioErrors.has(
      String(att?.data_url || '').trim()
    );
  }

  retryPlayableAudio(att: ChatAttachment): void {
    const sourceUrl = String(att?.data_url || '').trim();
    if (!sourceUrl) return;
    this.playableAudioErrors.delete(sourceUrl);
    this.loadPlayableAudio(sourceUrl);
  }

  onPlayableAudioError(att: ChatAttachment): void {
    const sourceUrl = String(att?.data_url || '').trim();
    if (!sourceUrl) return;
    this.playableAudioUrls.delete(sourceUrl);
    this.playableAudioErrors.add(sourceUrl);
    this.cdr.markForCheck();
  }

  private preparePlayableAudio(messages: ChatMessage[]): void {
    const sourceUrls = new Set(
      messages.flatMap(message =>
        (message.attachments || [])
          .filter(attachment => attachment.file_type === 'audio')
          .map(attachment => String(attachment.data_url || '').trim())
          .filter(Boolean)
      )
    );

    for (const sourceUrl of sourceUrls) {
      this.loadPlayableAudio(sourceUrl);
    }
  }

  private loadPlayableAudio(sourceUrl: string): void {
    if (
      !sourceUrl ||
      this.playableAudioUrls.has(sourceUrl)
    ) {
      return;
    }

    this.playableAudioErrors.delete(sourceUrl);
    const playableUrl = this.whatsappApi.getPlayableAudioUrl(sourceUrl);
    if (!playableUrl) {
      this.playableAudioErrors.add(sourceUrl);
      return;
    }
    this.playableAudioUrls.set(sourceUrl, playableUrl);
    this.cdr.markForCheck();
  }

  private resetPlayableAudio(): void {
    this.playableAudioUrls.clear();
    this.playableAudioLoading.clear();
    this.playableAudioErrors.clear();
  }

  isStickerOnlyMessage(msg: ChatMessage): boolean {
    const text = String(msg?.text || '').trim();
    const attachments = msg?.attachments || [];
    const hasVisibleText = Boolean(text) && !this.isTechnicalStickerLabel(text);
    return !hasVisibleText
      && attachments.length > 0
      && attachments.every(att => this.isStickerAttachment(att));
  }

  sendSticker(sticker: WhatsAppSticker): void {
    if (this.activeTab === 'grupo') {
      this.sendInternalSticker(sticker);
      return;
    }

    if (
      !this.isConversationAssignedToMe()
      || !this.selectedConversation?.contact?.phone
      || !sticker?.id
      || this.sendingStickerId
    ) return;

    const replyMsg = this.replyingTo;
    this.replyingTo = null;
    this.sendingStickerId = sticker.id;
    this.whatsappApi.sendSticker({
      phone: this.selectedConversation.contact.phone,
      sticker_id: sticker.id,
      conversation_id: this.selectedConversation.id,
      agent_id: this.whatsappAgentId || undefined,
      in_reply_to: replyMsg?.id,
    }).subscribe({
      next: (res: any) => {
        this.sendingStickerId = null;
        if (res?.success) {
          const pendingMsg: ChatMessage = {
            from: 'me',
            text: '',
            parsedHtml: '',
            time: new Date(),
            attachments: [{ data_url: sticker.url, file_type: 'image', content_type: 'image/webp' }],
            ...(replyMsg?.id
              ? {
                  replyTo: {
                    id: replyMsg.id,
                    text: this.getReplyPreviewText(replyMsg),
                    from: replyMsg.from,
                    attachments: replyMsg.attachments,
                  },
                }
              : {}),
          };
          this.messages.push(pendingMsg);
          this.showStickerPicker = false;
          this.messageService.add({
            severity: 'success',
            summary: 'Sticker enviado',
            detail: 'Se envió por WhatsApp y quedó registrado en el historial'
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
    this.whatsappApi.deleteSticker(sticker.id).subscribe({
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
    if (
      !input.files?.length
      || !this.selectedConversation
      || !this.isConversationAssignedToMe(this.selectedConversation)
    ) return;

    const file = input.files[0];
    const replyMsg = this.replyingTo;
    this.replyingTo = null;
    input.value = ''; // Reset so same file can be selected again

    this.sendingMessage = true;
    this.messages.push({
      from: 'me',
      text: `📎 ${file.name}`,
      time: new Date(),
      ...(replyMsg?.id
        ? {
            replyTo: {
              id: replyMsg.id,
              text: this.getReplyPreviewText(replyMsg),
              from: replyMsg.from,
              attachments: replyMsg.attachments,
            },
          }
        : {}),
    });
    this.scrollToBottom();

    const attachmentMessage = `${this.getAgentSignature()}\nTe ha enviado un archivo adjunto.`;

    this.whatsappApi.sendAttachment(
      this.selectedConversation.id,
      file,
      attachmentMessage,
      this.whatsappAgentId,
      replyMsg?.id,
    ).subscribe({
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

  async toggleVoiceRecording(context: 'chat' | 'grupo'): Promise<void> {
    if (this.recordingVoice && this.recordingVoiceContext === context) {
      this.stopVoiceRecording(true);
      return;
    }

    if (this.recordingVoice) {
      this.messageService.add({
        severity: 'info',
        summary: 'Grabación activa',
        detail: 'Detén o cancela la nota actual antes de iniciar otra.'
      });
      return;
    }

    await this.startVoiceRecording(context);
  }

  async startVoiceRecording(context: 'chat' | 'grupo'): Promise<void> {
    if (
      context === 'chat'
      && (!this.isConversationAssignedToMe() || this.sendingMessage)
    ) return;
    if (context === 'grupo' && (this.sendingInternalMessage || this.uploadingInternalAttachment || !!this.internalChatError)) return;

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      this.messageService.add({
        severity: 'warn',
        summary: 'Micrófono no disponible',
        detail: 'Este navegador no permite grabar notas de voz.'
      });
      return;
    }

    try {
      const mimeType = this.getSupportedVoiceMimeType();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.voiceStream = stream;
      this.voiceChunks = [];
      this.voiceRecordingShouldSend = false;
      this.voiceRecordingMimeType = mimeType || 'audio/webm';
      this.voiceRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      this.recordingVoice = true;
      this.recordingVoiceContext = context;
      this.recordingVoiceSeconds = 0;

      this.voiceRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.voiceChunks.push(event.data);
        }
      };

      this.voiceRecorder.onstop = () => {
        const chunks = [...this.voiceChunks];
        const shouldSend = this.voiceRecordingShouldSend;
        const stoppedContext = this.recordingVoiceContext;
        const stoppedMime = this.voiceRecordingMimeType || 'audio/webm';
        this.cleanupVoiceRecorder();

        if (!shouldSend || !stoppedContext || chunks.length === 0) return;
        const extension = stoppedMime.includes('ogg') ? 'ogg' : stoppedMime.includes('mp4') ? 'm4a' : 'webm';
        const blob = new Blob(chunks, { type: stoppedMime });
        const file = new File([blob], `nota-voz-${Date.now()}.${extension}`, { type: stoppedMime });
        this.sendVoiceNoteFile(stoppedContext, file);
      };

      this.voiceRecorder.start();
      this.voiceRecordingTimer = setInterval(() => this.recordingVoiceSeconds += 1, 1000);
    } catch (error) {
      this.cleanupVoiceRecorder();
      this.messageService.add({
        severity: 'error',
        summary: 'No se pudo grabar',
        detail: 'Revisa el permiso del micrófono e intenta nuevamente.'
      });
    }
  }

  stopVoiceRecording(send: boolean = true): void {
    if (!this.voiceRecorder || !this.recordingVoice) return;
    this.voiceRecordingShouldSend = send;
    if (this.voiceRecorder.state !== 'inactive') {
      this.voiceRecorder.stop();
      return;
    }
    this.cleanupVoiceRecorder();
  }

  cancelVoiceRecording(): void {
    this.stopVoiceRecording(false);
  }

  getVoiceRecordingTime(): string {
    const minutes = Math.floor(this.recordingVoiceSeconds / 60);
    const seconds = this.recordingVoiceSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  private sendVoiceNoteFile(context: 'chat' | 'grupo', file: File): void {
    if (context === 'grupo') {
      this.sendInternalAttachment(file, 'Nota de voz');
      return;
    }

    if (!this.selectedConversation || !this.isConversationAssignedToMe(this.selectedConversation)) return;
    const replyMsg = this.replyingTo;
    this.replyingTo = null;
    this.sendingMessage = true;
    const localUrl = URL.createObjectURL(file);
    this.messages.push({
      from: 'me',
      text: '',
      time: new Date(),
      attachments: [{
        data_url: localUrl,
        file_type: 'audio',
        content_type: file.type,
        file_name: file.name
      }],
      ...(replyMsg?.id
        ? {
            replyTo: {
              id: replyMsg.id,
              text: this.getReplyPreviewText(replyMsg),
              from: replyMsg.from,
              attachments: replyMsg.attachments,
            },
          }
        : {}),
    });
    this.scrollToBottom();

    const attachmentMessage = `${this.getAgentSignature()}\nTe ha enviado una nota de voz.`;
    this.whatsappApi.sendAttachment(
      this.selectedConversation.id,
      file,
      attachmentMessage,
      this.whatsappAgentId,
      replyMsg?.id,
    ).subscribe({
      next: (res) => {
        this.sendingMessage = false;
        if (!res.success) {
          const detail = res.error || 'Error al enviar nota de voz';
          this.messages.push({ from: 'system', text: `✗ ${detail}`, time: new Date() });
          this.messageService.add({ severity: 'error', summary: 'No se pudo enviar', detail });
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

  private cleanupVoiceRecorder(): void {
    if (this.voiceRecordingTimer) {
      clearInterval(this.voiceRecordingTimer);
      this.voiceRecordingTimer = undefined;
    }
    this.voiceStream?.getTracks().forEach(track => track.stop());
    this.voiceStream = null;
    this.voiceRecorder = null;
    this.voiceChunks = [];
    this.recordingVoice = false;
    this.recordingVoiceContext = null;
    this.recordingVoiceSeconds = 0;
    this.voiceRecordingShouldSend = false;
    this.voiceRecordingMimeType = '';
  }

  private getSupportedVoiceMimeType(): string {
    const candidates = [
      'audio/ogg;codecs=opus',
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4'
    ];
    return candidates.find(type => MediaRecorder.isTypeSupported(type)) || '';
  }

  assignToMe(): void {
    if (!this.selectedConversation || !this.whatsappAgentId) return;

    this.whatsappApi.assignAgentToConversation(this.selectedConversation.id, this.whatsappAgentId).subscribe({
      next: (res) => {
        if (res.success) {
          this.selectedConversation!.assignee_id = this.whatsappAgentId;
          this.selectedConversation!.assignee_name = this.currentUserName || 'Agente';
          this.conversations = this.sortConversations(this.conversations);
          this.filterConversations();
          this.startConversationPresenceSession();
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

  sendConversationReminder(): void {
    const conversation = this.selectedConversation;
    if (
      !conversation?.reminder_eligible
      || !conversation.assignee_id
      || this.isConversationAssignedToMe(conversation)
      || this.sendingConversationReminder
    ) {
      return;
    }

    this.sendingConversationReminder = true;
    this.whatsappApi.sendConversationReminder(conversation.id)
      .pipe(finalize(() => {
        this.sendingConversationReminder = false;
      }))
      .subscribe({
        next: (response) => {
          conversation.reminder_eligible = false;
          const listedConversation = this.conversations.find(
            item => item.id === conversation.id,
          );
          if (listedConversation) {
            listedConversation.reminder_eligible = false;
          }
          this.conversationsFingerprint =
            this.getConversationsFingerprint(this.conversations);
          this.messageService.add({
            severity: 'success',
            summary: 'Zumbido enviado',
            detail: `Se notificó a ${response.sentTo || this.getConversationManagerLabel(conversation)}.`,
          });
        },
        error: (error) => {
          const detail = Array.isArray(error?.error?.message)
            ? error.error.message.join(' ')
            : error?.error?.message
              || 'No se pudo enviar el recordatorio.';
          this.messageService.add({
            severity: 'error',
            summary: 'No se pudo enviar el zumbido',
            detail,
          });
        },
      });
  }

  isOutside24hWindow(conv: ChatConversation): boolean {
    if (!conv) return false;
    
    // Buscamos el último mensaje físico enviado por el usuario
    // Las políticas 24h asumen que la ventana inicia cuando el usuario final envió algo.
    const incomingMessages = this.messages.filter(m => m.from === 'incoming');
    
    // Si no encontramos ningún mensaje del usuario en el lote descargado,
    // usamos la fecha de respaldo del historial local.
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
    if (!this.selectedConversation || !this.isConversationAssignedToMe(this.selectedConversation)) return;
    this.whatsappTemplateVars.headerUser = this.currentUserName || 'Asesor';
    
    const gpsName = this.gpsUser ? `${this.gpsUser.name} ${this.gpsUser.last_name || ''}`.trim() : null;
    const whatsappName = this.selectedConversation.contact.name !== 'Sin nombre' ? this.selectedConversation.contact.name : '';
    this.whatsappTemplateVars.name = gpsName || whatsappName;
    
    this.whatsappTemplateVars.body = '';
    
    const hour = new Date().getHours();
    if (hour < 12) this.whatsappTemplateVars.bodySaludos = 'uenos días';
    else if (hour < 19) this.whatsappTemplateVars.bodySaludos = 'uenas tardes';
    else this.whatsappTemplateVars.bodySaludos = 'uenas noches';

    this.showTemplateModal = true;
  }

  updateWhatsAppTemplatePreview(field: 'name' | 'body', event: Event): void {
    const editable = event.currentTarget as HTMLElement | null;
    if (!editable) return;
    const value = String(editable.innerText || editable.textContent || '')
      .replace(/\u00a0/g, ' ');
    this.whatsappTemplateVars[field] = field === 'name'
      ? value.replace(/\s+/g, ' ')
      : value;
  }

  initializeWhatsAppTemplateEditors(): void {
    if (this.whatsappTemplateNameEditor?.nativeElement) {
      this.whatsappTemplateNameEditor.nativeElement.textContent = this.whatsappTemplateVars.name;
    }
    if (this.whatsappTemplateBodyEditor?.nativeElement) {
      this.whatsappTemplateBodyEditor.nativeElement.textContent = this.whatsappTemplateVars.body;
    }
  }

  sendTemplateMessage(): void {
    if (
      !this.selectedConversation
      || !this.isConversationAssignedToMe(this.selectedConversation)
      || !this.selectedConversation.contact.phone
    ) {
      this.messageService.add({severity:'error', summary:'Error', detail:'El contacto no tiene número de teléfono registrado.'});
      return;
    }
    this.sendingTemplate = true;
    
    this.whatsappApi.sendWhatsAppTemplateToUser({
        phone: this.selectedConversation.contact.phone,
        template_name: 'simple',
        variables: [
          this.whatsappTemplateVars.headerUser,
          this.whatsappTemplateVars.bodySaludos,
          this.whatsappTemplateVars.name,
          this.whatsappTemplateVars.body
        ],
        agent_id: this.whatsappAgentId ? this.whatsappAgentId.toString() : undefined,
        conversation_id: this.selectedConversation.id,
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
      const conversationId = this.selectedConversation.id;

      this.whatsappApi.getConversationMessages(conversationId, this.messagesPageSize).pipe(timeout(20000)).subscribe({
        next: (res: any) => {
          if (this.selectedConversation?.id !== conversationId) return;
          if (res.success && res.messages?.length) {
            const newestId = res.messages[res.messages.length - 1].id;
            if (newestId !== this.lastApiMessageId) {
              const shouldScrollToBottom = this.isNearBottom();
              const latestMessages = this.mapApiMessages(res.messages);
              const latestById = new Map(
                latestMessages
                  .filter((message): message is ChatMessage & { id: number } => typeof message.id === 'number')
                  .map((message) => [message.id, message])
              );

              const retainedMessages = this.messages
                .filter((message) => !this.isConfirmedOptimisticMessage(message, latestMessages))
                .map((message) => {
                  if (typeof message.id !== 'number') return message;
                  return latestById.get(message.id) || message;
                });
              const retainedIds = new Set(
                retainedMessages
                  .map((message) => message.id)
                  .filter((id): id is number => typeof id === 'number')
              );
              const newMessages = latestMessages.filter(
                (message) => typeof message.id !== 'number' || !retainedIds.has(message.id)
              );

              this.messages = [...retainedMessages, ...newMessages];
              this.preparePlayableAudio(newMessages);
              this.lastApiMessageId = newestId;
              if (shouldScrollToBottom) {
                this.scrollToBottom();
              }
            }
          }
        },
        error: (error) => {
          console.warn('[Communication] Error polling conversation messages:', error);
        }
      });
    }, this.POLL_INTERVAL);
  }

  private isConfirmedOptimisticMessage(message: ChatMessage, confirmedMessages: ChatMessage[]): boolean {
    if (message.id || message.from !== 'me' || !message.text) return false;

    const optimisticText = this.getCleanPreview(message.text).trim().toLowerCase();
    if (!optimisticText) return false;

    return confirmedMessages.some((confirmed) => {
      if (!confirmed.id || confirmed.from !== 'me' || !confirmed.text) return false;
      const confirmedText = this.getCleanPreview(confirmed.text).trim().toLowerCase();
      return confirmedText === optimisticText &&
        Math.abs(confirmed.time.getTime() - message.time.getTime()) < 5 * 60 * 1000;
    });
  }

  private stopChatPolling(): void {
    if (this.chatPollingInterval) {
      clearInterval(this.chatPollingInterval);
      this.chatPollingInterval = null;
    }
  }

  onChatInputChange(value: string): void {
    if (
      !this.selectedConversation
      || !this.isConversationAssignedToMe(this.selectedConversation)
    ) {
      this.stopConversationTyping();
      return;
    }

    if (!String(value || '').trim()) {
      this.stopConversationTyping();
      return;
    }

    this.conversationTypingActive = true;
    const now = Date.now();
    if ((now - this.lastTypingSignalAt) >= 1500) {
      this.lastTypingSignalAt = now;
      this.publishConversationPresence(true, true);
    }

    if (this.conversationTypingIdleTimer) {
      clearTimeout(this.conversationTypingIdleTimer);
    }
    this.conversationTypingIdleTimer = setTimeout(
      () => this.stopConversationTyping(),
      this.CONVERSATION_TYPING_IDLE_MS,
    );
  }

  getConversationTypingLabel(
    conv: ChatConversation | null = this.selectedConversation,
  ): string {
    if (!conv) return 'El empleado';
    const label = this.getConversationAssigneeLabel(conv);
    const firstName = label.split(/\s+/).find(Boolean);
    return firstName && !firstName.includes('@') ? firstName : 'El empleado';
  }

  private startConversationPresenceSession(): void {
    if (!this.selectedConversation || this.activeTab !== 'chat') return;
    if (this.presenceConversationId === this.selectedConversation.id) {
      this.refreshConversationPresence();
      if (this.isConversationAssignedToMe(this.selectedConversation)) {
        this.publishConversationPresence(true, this.conversationTypingActive);
      }
      return;
    }

    this.stopConversationPresenceSession();
    this.presenceConversationId = this.selectedConversation.id;
    this.refreshConversationPresence();
    if (this.isConversationAssignedToMe(this.selectedConversation)) {
      this.publishConversationPresence(true, false);
    }

    this.conversationPresenceHeartbeatInterval = setInterval(() => {
      if (
        this.selectedConversation?.id === this.presenceConversationId
        && this.isConversationAssignedToMe(this.selectedConversation)
      ) {
        this.publishConversationPresence(true, this.conversationTypingActive);
      }
    }, this.CONVERSATION_PRESENCE_HEARTBEAT_MS);

    this.conversationPresencePollingInterval = setInterval(
      () => this.refreshConversationPresence(),
      this.CONVERSATION_PRESENCE_POLL_MS,
    );
  }

  private stopConversationPresenceSession(): void {
    const conversationId = this.presenceConversationId;
    if (conversationId && this.presenceOwnedByCurrentUser) {
      this.whatsappApi
        .updateConversationPresence(conversationId, false, false)
        .subscribe({ error: () => undefined });
    }

    if (this.conversationPresenceHeartbeatInterval) {
      clearInterval(this.conversationPresenceHeartbeatInterval);
      this.conversationPresenceHeartbeatInterval = null;
    }
    if (this.conversationPresencePollingInterval) {
      clearInterval(this.conversationPresencePollingInterval);
      this.conversationPresencePollingInterval = null;
    }
    if (this.conversationTypingIdleTimer) {
      clearTimeout(this.conversationTypingIdleTimer);
      this.conversationTypingIdleTimer = null;
    }
    this.presenceConversationId = null;
    this.presenceOwnedByCurrentUser = false;
    this.conversationTypingActive = false;
    this.lastTypingSignalAt = 0;
  }

  private stopConversationTyping(): void {
    if (this.conversationTypingIdleTimer) {
      clearTimeout(this.conversationTypingIdleTimer);
      this.conversationTypingIdleTimer = null;
    }
    const wasTyping = this.conversationTypingActive;
    this.conversationTypingActive = false;
    this.lastTypingSignalAt = 0;
    if (wasTyping && this.presenceConversationId) {
      this.publishConversationPresence(true, false);
    }
  }

  private publishConversationPresence(active: boolean, typing: boolean): void {
    const conversationId = this.presenceConversationId;
    if (!conversationId) return;
    if (
      active
      && (
        this.selectedConversation?.id !== conversationId
        || !this.isConversationAssignedToMe(this.selectedConversation)
      )
    ) {
      return;
    }

    if (active) {
      this.presenceOwnedByCurrentUser = true;
    }
    this.whatsappApi
      .updateConversationPresence(conversationId, active, typing)
      .subscribe({ error: () => undefined });
  }

  private refreshConversationPresence(): void {
    const conversationId = this.presenceConversationId;
    if (!conversationId) return;

    this.whatsappApi.getConversationPresence(conversationId).subscribe({
      next: (response: any) => {
        if (
          !response?.success
          || this.presenceConversationId !== conversationId
        ) {
          return;
        }
        const presence = response.presence || {};
        this.applyConversationPresence(
          conversationId,
          Boolean(presence.online),
          Boolean(presence.typing),
        );
      },
      error: () => undefined,
    });
  }

  private applyConversationPresence(
    conversationId: number,
    online: boolean,
    typing: boolean,
  ): void {
    const conversation = this.conversations.find(item => item.id === conversationId);
    if (conversation) {
      conversation.assignee_online = online;
      conversation.assignee_typing = typing;
    }
    if (this.selectedConversation?.id === conversationId) {
      this.selectedConversation.assignee_online = online;
      this.selectedConversation.assignee_typing = typing;
    }
  }

  // ============================
  // UTILS
  // ============================

  private isNearBottom(): boolean {
    const container = this.messagesContainer?.nativeElement as HTMLElement | undefined;
    if (!container) return true;
    return container.scrollHeight - container.scrollTop - container.clientHeight < 140;
  }

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

  getUsableAvatarUrl(url?: string | null): string | null {
    const normalizedUrl = String(url || '').trim();
    return normalizedUrl && !this.failedAvatarUrls.has(normalizedUrl)
      ? normalizedUrl
      : null;
  }

  getSelectedConversationAvatarUrl(): string | null {
    return this.getUsableAvatarUrl(this.gpsUser?.photo)
      || this.getUsableAvatarUrl(this.selectedConversation?.contact?.avatar);
  }

  onAvatarImageError(url?: string | null): void {
    const normalizedUrl = String(url || '').trim();
    if (normalizedUrl) this.failedAvatarUrls.add(normalizedUrl);
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
    this.stopConversationPresenceSession();
    this.stopChatPolling();
    this.resetPlayableAudio();
    this.selectedConversation = null;
    this.messages = [];
    this.loadingOlderMessages = false;
    this.hasOlderMessages = true;
    this.lastApiMessageId = null;
  }
}
