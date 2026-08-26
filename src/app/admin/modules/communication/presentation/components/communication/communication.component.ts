import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { ConversationObjective, WhatsAppApiService } from '@core/services/whatsapp-api.service';
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
import {
  InternalChatAttachment,
  InternalChatGroup,
  InternalChatMessage,
  InternalChatService,
} from '@core/services/internal-chat.service';
import { EsterMessageFeedback, EsterService } from '@core/services/ester.service';
import { ConfirmationService, MessageService, MenuItem } from 'primeng/api';
import { environment } from '../../../../../../../environments/environment';
import { catchError, finalize, firstValueFrom, forkJoin, of, Subscription, timeout, timer } from 'rxjs';
import {
  buildAgentSignatureLabel,
  parseAgentSignedMessage,
} from './agent-signature';
import { buildCustomerSignatureLabel } from './customer-signature';
import { resolveConversationMessageTranslationLanguage } from './conversation-translation';
import { orderConversationsByAttention } from './conversation-order';
import {
  buildConversationListPreview,
  ConversationLastMessagePreview,
  ConversationListPreviewView,
} from './conversation-list-preview';
import { getApiErrorMessage } from '../../../../../../core/utils/api-error.util';
import {
  canParticipateInConversation as canParticipateInTeamAwareConversation,
  canViewConversationInTeamSection,
  formatConversationContactName,
  formatConversationDisplayName,
  isTeamConversation,
  toTitleCaseName,
} from './conversation-team-filter';

interface ChatConversation {
  id: number;
  status: string;
  shared_team_conversation?: boolean;
  team_chat_name?: string;
  contact: {
    id: number | string;
    name: string;
    phone: string;
    email: string;
    avatar: string;
    user_id?: string | null;
    satisfaction_level?: number | null;
    affiliation_type_id?: string | null;
    status?: boolean | null;
  };
  last_message: string;
  last_message_time: number | null;
  unread_count: number;
  has_unread?: boolean;
  waiting_for_reply?: boolean;
  priority_urgent?: boolean;
  inbox_id?: number;
  last_message_type?: number;
  last_message_preview?: ConversationLastMessagePreview | null;
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
  conversation_objectives?: ConversationObjective[];
  translation_language?: string;
  translation_language_name?: string;
}

interface MessageTranslation {
  text: string;
  source_language: string;
  target_language: string;
  target_language_name: string;
  model?: string;
  translated_at?: string;
}

interface ChatMessage {
  id?: number;
  from: 'me' | 'incoming' | 'system';
  status?: string;
  type?: string;
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
  contacts?: WhatsAppSharedContact[];
  unsupported?: {
    kind: 'poll' | 'unknown';
    subtype?: string;
    provider_type?: string;
    errors?: Array<{
      code?: number;
      title?: string;
      details?: string;
    }>;
  };
  senderName?: string;
  esterFeedback?: EsterMessageFeedback;
  translations?: Record<string, MessageTranslation>;
  translation?: MessageTranslation;
}

interface WhatsAppSharedContact {
  name: string;
  first_name?: string;
  last_name?: string;
  phones?: Array<{ phone?: string; wa_id?: string; type?: string }>;
  emails?: Array<{ email?: string; type?: string }>;
  addresses?: Array<{ address?: string; type?: string }>;
  organization?: { company?: string; department?: string; title?: string };
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
  conversationFilter: 'all' | 'team' = 'all';
  conversationAttentionFilter: 'all' | 'urgent' | 'waiting' | 'unread' = 'all';
  readonly conversationAttentionFilters = [
    { id: 'all' as const, label: 'Todos', icon: 'pi-inbox' },
    { id: 'urgent' as const, label: 'Urgentes', icon: 'pi-exclamation-circle' },
    { id: 'waiting' as const, label: 'Por responder', icon: 'pi-reply' },
    { id: 'unread' as const, label: 'Sin leer', icon: 'pi-envelope' },
  ];
  private conversationSearchTimer: ReturnType<typeof setTimeout> | null = null;
  autoResponse: boolean = false;
  esterAutoReplyActive: boolean | null = null;
  showContactInfo: boolean = false;
  editingTeamChatName = false;
  teamChatNameDraft = '';
  updatingTeamChatName = false;
  canManageConversationHistory = false;
  managingConversationHistory = false;
  gpsUser: any = null;
  showTranslationLanguageMenu = false;
  updatingConversationLanguage = false;
  readonly conversationLanguageOptions = [
    { code: '', name: 'Sin traducción', shortName: 'Original' },
    { code: 'es', name: 'Español', shortName: 'ES' },
    { code: 'en', name: 'Inglés', shortName: 'EN' },
    { code: 'fr', name: 'Francés', shortName: 'FR' },
    { code: 'ht', name: 'Criollo haitiano', shortName: 'HT' },
    { code: 'pt', name: 'Portugués', shortName: 'PT' },
    { code: 'it', name: 'Italiano', shortName: 'IT' },
    { code: 'de', name: 'Alemán', shortName: 'DE' },
    { code: 'nl', name: 'Neerlandés', shortName: 'NL' },
    { code: 'zh', name: 'Chino mandarín', shortName: 'ZH' },
    { code: 'ar', name: 'Árabe', shortName: 'AR' },
  ];
  private readonly supportTranslationLanguage = 'es';
  private translatingMessageKeys = new Set<string>();
  private translationRetryAfter = new Map<string, number>();

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
  improveResponseEnabled: boolean = false;
  improvingResponse: boolean = false;
  waitingToSendImprovedResponse: boolean = false;
  improvedResponseSuggestion: string = '';
  improveResponseStatus: string = '';
  improveResponseError: string = '';
  private improveResponseDebounceTimer?: ReturnType<typeof setTimeout>;
  private improveResponseRequestId = 0;
  private improvedResponseAnalyzedDraft = '';
  private pendingImprovedSend: {
    draft: string;
    conversationId: number;
    replyMsg: ChatMessage | null;
  } | null = null;
  private readonly IMPROVE_RESPONSE_DEBOUNCE_MS = 900;
  isRootUser = false;
  conversationObjectivesLoading = false;
  savingConversationObjective = false;
  showConversationObjectivesModal = false;
  showConversationObjectiveDialog = false;
  editingConversationObjective: ConversationObjective | null = null;
  conversationObjectiveDraft: {
    title: string;
    description: string;
    type: ConversationObjective['type'];
    required: boolean;
    completion_mode: ConversationObjective['completion_mode'];
  } = {
    title: '',
    description: '',
    type: 'result',
    required: true,
    completion_mode: 'both',
  };
  readonly conversationObjectiveTypeOptions = [
    { label: 'Resultado', value: 'result' },
    { label: 'Dato por obtener', value: 'data' },
    { label: 'Respuesta esperada', value: 'response' },
    { label: 'Acción por realizar', value: 'action' },
  ];
  readonly conversationObjectiveModeOptions = [
    { label: 'Ester o root', value: 'both' },
    { label: 'Automático por Ester', value: 'automatic' },
    { label: 'Solo manual por root', value: 'manual' },
  ];
  showEsterFeedbackModal = false;
  selectedEsterFeedbackMessage: ChatMessage | null = null;
  esterFeedbackText = '';
  submittingEsterFeedback = false;
  esterLearningStage = 0;
  esterLearningRulePreview: {
    title: string;
    content: string;
    version: number;
    changeSummary?: string;
  } | null = null;
  private esterLearningTimers: number[] = [];
  private esterFeedbackByMessageId = new Map<number, EsterMessageFeedback>();
  sendingConversationReminder: boolean = false;
  openingSharedContactPhone: string = '';
  openingTechnicianGroupId: string | null = null;
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
  private internalGroupsPollingInterval: any = null;
  private internalChatRequestId: number = 0;
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
  private technicianConversationIndexSource: ChatConversation[] | null = null;
  private technicianConversationByPhone = new Map<string, ChatConversation>();
  private technicianConversationByUserId = new Map<string, ChatConversation>();
  private pendingConversationId: number | null = null;
  private pendingFocusedMessageId: number | null = null;
  focusedMessageId: number | null = null;
  private whatsappAgentId: string = '';
  private currentUserName: string = '';
  private currentUserDepartment: string = '';
  private canOpenTechnicianWhatsAppConversations = false;
  private playableAudioUrls = new Map<string, string>();
  private playableAudioLoading = new Set<string>();
  private playableAudioErrors = new Set<string>();
  private presenceConversationId: number | null = null;
  private conversationTypingActive = false;
  private presenceOwnedByCurrentUser = false;
  private lastTypingSignalAt = 0;
  private esterAutoReplyStatusLoading = false;
  private esterAutoReplyStatusLoadedAt = 0;
  private readonly ESTER_AUTO_REPLY_STATUS_TTL_MS = 30000;

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
    private esterService: EsterService,
    private communicationNotifications: CommunicationNotificationService,
    private confirmationService: ConfirmationService,
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
  internalGroups: InternalChatGroup[] = [];
  selectedInternalGroupId: string = 'admin';
  loadingInternalGroups: boolean = false;
  canClearInternalMessages: boolean = false;
  clearingInternalGroupId: string | null = null;
  showInternalGroupMenu: boolean = false;
  internalGroupSearchTerm: string = '';
  internalGroupChatOpen: boolean = false;
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
  showChatEmojiPicker: boolean = false;
  readonly internalEmojiOptions: string[] = ['😀', '😂', '😊', '😍', '👍', '🙏', '👏', '🔥', '✅', '🚗', '📍', '⚠️', '🛠️', '📞', '❤️', '💪'];
  private internalChatMutedSubscription?: Subscription;
  private loadInternalChatAfterGroups: boolean = false;

  ngOnInit(): void {
    this.updateAttachmentMenu();
    this.loadStickers();
    this.loadGpsDetailsProtocols();
    this.refreshEsterAutoReplyStatus(true);
    this.internalChatMuted = this.communicationNotifications.isInternalChatMuted();
    this.internalChatMutedSubscription = this.communicationNotifications.internalChatMuted$.subscribe((muted) => {
      this.internalChatMuted = muted;
      if (this.internalGroups.length) {
        this.syncInternalUnreadCount();
      }
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
          this.selectedInternalGroupId = 'admin';
          this.internalGroupChatOpen = true;
          this.loadInternalGroups(true);
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
      const requestedConversationFilter = params.get('view') === 'team'
        ? 'team'
        : 'all';
      if (
        this.activeTab === 'chat'
        && this.conversationFilter !== requestedConversationFilter
      ) {
        this.conversationFilter = requestedConversationFilter;
        this.filterConversations();
      }
      const messageId = Number(params.get('messageId') || 0);
      this.pendingFocusedMessageId = messageId > 0 ? messageId : null;
      const requestedGroupId = String(params.get('groupId') || '').trim();
      if (requestedGroupId) {
        this.internalGroupChatOpen = true;
        const changed = this.selectedInternalGroupId !== requestedGroupId;
        this.selectedInternalGroupId = requestedGroupId;
        if (changed && this.activeTab === 'grupo' && this.internalGroups.length) {
          this.ensureSelectedInternalGroup();
          this.internalMessages = [];
          this.stopInternalChatPolling();
          this.loadInternalChat();
        } else if (this.activeTab === 'grupo' && !this.internalGroups.length) {
          this.loadInternalGroups(true);
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.stopConversationPresenceSession();
    this.stopChatPolling();
    this.stopConversationsPolling();
    this.stopInternalChatPolling();
    this.stopInternalGroupsPolling();
    this.stopActiveEmployeesPolling();
    this.cancelVoiceRecording();
    this.internalChatMutedSubscription?.unsubscribe();
    this.resetPlayableAudio();
    this.clearEsterLearningTimers();
    this.clearImprovedResponseState();
    if (this.conversationSearchTimer) {
      clearTimeout(this.conversationSearchTimer);
    }
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
    this.isRootUser = currentUser.root === true
      || String(currentUser.root) === 'true';
    this.hasEmailInbox = true;
    this.noInbox = false;
    this.userService.getById(currentUser.id).subscribe({
      next: (user: any) => {
        this.autoResponse = user?.auto_response || false;
        this.currentUserEmail = user?.email || '';
        this.whatsappAgentId = String(user?._id || user?.id || currentUser.id);
        this.currentUserName = user?.name || 'Agente';
        this.currentUserDepartment = this.normalizeAgentDepartment(user?.department_id);
        const affiliation = String(user?.affiliation_type_id || '')
          .trim()
          .toLowerCase();
        const isDeveloper = user?.developer === true
          || String(user?.developer).toLowerCase() === 'true';
        const isDetailedRoot = user?.root === true
          || String(user?.root).toLowerCase() === 'true';
        this.isRootUser = this.isRootUser || isDetailedRoot;
        this.canManageConversationHistory = isDetailedRoot
          && !String(user?.parent_id || '').trim();
        this.canOpenTechnicianWhatsAppConversations =
          affiliation === 'empleado' || isDeveloper || this.isRootUser;
        
        // WhatsApp usa una bandeja local única respaldada por Meta y MongoDB.
        this.userInboxId = 5;
        this.noInbox = false;
        this.loadConversations();
        this.loadInternalGroups(false, true);
        this.startInternalGroupsPolling();
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

    if (tab === 'chat') {
      this.showConversationFilter('all');
      return;
    }

    this.activeTab = tab;
    if (tab === 'grupo') {
      this.stopConversationPresenceSession();
      this.stopChatPolling();
      const changedGroup = this.selectedInternalGroupId !== 'admin';
      this.selectedInternalGroupId = 'admin';
      this.internalGroupChatOpen = true;
      this.stopInternalChatPolling();
      this.stopActiveEmployeesPolling();
      if (changedGroup) {
        this.internalMessages = [];
        this.internalChatInput = '';
      }
      this.loadInternalGroups(true);
    } else {
      this.stopInternalChatPolling();
      this.stopActiveEmployeesPolling();
      if (this.selectedConversation) {
        this.startConversationPresenceSession();
      }
    }
    this.router.navigate(['/admin/communication', tab]);
  }

  showConversationFilter(filter: 'all' | 'team'): void {
    this.activeTab = 'chat';
    this.conversationFilter = filter;
    this.stopInternalChatPolling();
    this.stopActiveEmployeesPolling();

    if (
      this.selectedConversation
      && filter === 'team'
      && !canViewConversationInTeamSection(
        this.selectedConversation,
        this.isRootUser,
      )
    ) {
      this.goBack();
    } else if (this.selectedConversation) {
      this.startConversationPresenceSession();
    }

    this.filterConversations();
    this.router.navigate(
      ['/admin/communication', 'chat'],
      { queryParams: filter === 'team' ? { view: 'team' } : {} },
    );
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
          const payload = await response.json().catch((error) => ({ message: getApiErrorMessage(error, 'No se pudo configurar el buzon') }));
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
          const payload = await response.json().catch((error) => ({ message: getApiErrorMessage(error, 'No se pudo cargar el buzon') }));
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
          const payload = await response.json().catch((error) => ({ message: getApiErrorMessage(error, 'No se pudieron cargar los correos') }));
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
          const payload = await response.json().catch((error) => ({ message: getApiErrorMessage(error, 'No se pudo abrir el correo') }));
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
          const payload = await response.json().catch((error) => ({ message: getApiErrorMessage(error, 'No se pudo marcar el correo') }));
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
    if (
      !this.isConversationAssignedToMe()
      || this.isInternalTeamConversation()
    ) return;
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
    if (
      this.isTransferring
      || !this.isConversationAssignedToMe()
      || this.isInternalTeamConversation()
    ) return;

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
    
    const transferToEster = this.selectedTransferAgentId === this.esterTransferAgentId;
    if (
      transferToEster
      && this.isInternalTeamConversation(this.selectedConversation)
    ) {
      this.selectedTransferAgentId = null;
      return;
    }
    this.isTransferring = true;
    const conversationId = this.selectedConversation.id;
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
            : 'otro empleado';

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
      error: (error) => {
        this.isTransferring = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error de conexión',
          detail: getApiErrorMessage(error, 'No se pudo transferir la conversación. Inténtalo nuevamente.'),
        });
      }
    });
  }

  transferAllToEster(): void {
    const activeConvs = this.conversations.filter(c =>
      c.assignee_id !== null && !isTeamConversation(c)
    );
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
          const payload = await response.json().catch((error) => ({ message: getApiErrorMessage(error, 'No se pudo enviar el correo') }));
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
    this.refreshEsterAutoReplyStatus();
    const cacheKey = `whatsapp_convs_${this.userInboxId}_all`;
    const querySignature = this.getConversationListQuerySignature();
    if (!this.conversations.length) {
      this.filteredConversations = [];
      this.selectedConversation = null;
    }

    this.loadingConversations = true;
    this.whatsappApi.getConversations(
      this.userInboxId,
      1,
      this.whatsappAgentId,
      true,
      this.searchTerm,
      this.conversationAttentionFilter,
    ).subscribe({
      next: (res: any) => {
        if (querySignature !== this.getConversationListQuerySignature()) return;
        this.loadingConversations = false;
        if (res.success) {
          this.conversations = this.sortConversations(res.conversations || []);
          if (
            this.userInboxId
            && !this.searchTerm.trim()
            && this.conversationAttentionFilter === 'all'
          ) {
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
              if (
                lastConv
                && (
                  this.conversationFilter === 'all'
                  || isTeamConversation(lastConv)
                )
              ) {
                this.selectConversation(lastConv, true);
              }
            }
          }
        } else {
          this.noInbox = true;
        }
      },
      error: () => {
        if (querySignature !== this.getConversationListQuerySignature()) return;
        this.loadingConversations = false;
        this.noInbox = true;
      }
    });
  }

  onConversationSearchChange(): void {
    if (this.conversationSearchTimer) {
      clearTimeout(this.conversationSearchTimer);
    }
    this.conversationSearchTimer = setTimeout(() => {
      this.conversationSearchTimer = null;
      this.loadConversations();
    }, 300);
  }

  clearConversationSearch(): void {
    if (!this.searchTerm) return;
    this.searchTerm = '';
    this.onConversationSearchChange();
  }

  setConversationAttentionFilter(
    filter: 'all' | 'urgent' | 'waiting' | 'unread',
  ): void {
    if (this.conversationAttentionFilter === filter) return;
    this.conversationAttentionFilter = filter;
    this.loadConversations();
  }

  getConversationEmptyMessage(): string {
    if (this.searchTerm.trim()) {
      return 'No encontramos contactos ni mensajes con esa búsqueda';
    }
    if (this.conversationAttentionFilter !== 'all') {
      return 'No hay conversaciones para este filtro';
    }
    return this.conversationFilter === 'team'
      ? 'No hay conversaciones de empleados'
      : 'No hay conversaciones en la bandeja';
  }

  filterConversations(): void {
    this.filteredConversations = this.conversations.filter(c => {
      if (
        this.conversationFilter === 'team'
        && !canViewConversationInTeamSection(c, this.isRootUser)
      ) {
        return false;
      }
      return true;
    });
  }

  private getConversationListQuerySignature(): string {
    return [
      this.searchTerm.trim().toLocaleLowerCase(),
      this.conversationAttentionFilter,
    ].join('|');
  }

  getConversationAssigneeLabel(conv: ChatConversation): string {
    if (!conv.assignee_id) {
      return isTeamConversation(conv) ? 'Sin asignar' : 'Ester Assistant';
    }
    return (conv.assignee_name || conv.assignee_email || 'otro empleado').trim();
  }

  isInternalTeamConversation(
    conv: ChatConversation | null = this.selectedConversation,
  ): boolean {
    return isTeamConversation(conv);
  }

  canParticipateInConversation(
    conv: ChatConversation | null = this.selectedConversation,
  ): boolean {
    return canParticipateInTeamAwareConversation(
      conv,
      [this.whatsappAgentId, this.currentUserId],
    );
  }

  isEsterAutoReplyDisabled(
    conv: ChatConversation | null = this.selectedConversation,
  ): boolean {
    return !!conv
      && !conv.assignee_id
      && (
        isTeamConversation(conv)
        || this.esterAutoReplyActive === false
      );
  }

  private refreshEsterAutoReplyStatus(force = false): void {
    const now = Date.now();
    if (
      this.esterAutoReplyStatusLoading
      || (
        !force
        && now - this.esterAutoReplyStatusLoadedAt
          < this.ESTER_AUTO_REPLY_STATUS_TTL_MS
      )
    ) {
      return;
    }

    this.esterAutoReplyStatusLoading = true;
    this.esterService.getCommunicationStatus()
      .pipe(finalize(() => {
        this.esterAutoReplyStatusLoading = false;
        this.esterAutoReplyStatusLoadedAt = Date.now();
      }))
      .subscribe({
        next: status => {
          this.esterAutoReplyActive =
            status?.whatsappAutoReplyActive !== false;
        },
        error: () => {
          // Conserva el último estado conocido si la consulta temporalmente falla.
        },
      });
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
    if (!conv?.assignee_id) {
      return isTeamConversation(conv) ? 'Sin asignar' : 'Ester Assistant';
    }
    return String(
      conv.assignee_name
      || conv.assignee_email
      || 'otro empleado',
    ).trim();
  }

  private sortConversations(conversations: ChatConversation[]): ChatConversation[] {
    const selectedConversationId = this.selectedConversation?.id || null;
    const selectedConversationIndex = selectedConversationId
      ? this.conversations.findIndex(
        conversation => conversation.id === selectedConversationId,
      )
      : -1;

    return orderConversationsByAttention(conversations, {
      pinnedConversationId: selectedConversationId,
      pinnedIndex: selectedConversationIndex,
    });
  }

  selectConversation(conv: ChatConversation, navigate: boolean = true): void {
    this.stopConversationPresenceSession();
    this.stopChatPolling();
    this.communicationNotifications.markWhatsAppConversationRead(conv.id);
    conv.unread_count = 0;
    conv.has_unread = false;
    this.conversationsFingerprint = this.getConversationsFingerprint(
      this.conversations,
    );
    this.resetPlayableAudio();
    this.selectedConversation = conv;
    this.editingTeamChatName = false;
    this.teamChatNameDraft = '';
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
    this.clearImprovedResponseState();
    this.sendingEsterReply = false;
    this.sendingConversationReminder = false;
    this.replyingTo = null;
    this.reactionPickerMessageId = null;
    this.showChatEmojiPicker = false;
    this.showTranslationLanguageMenu = false;
    this.showContactInfo = false;
    this.gpsUser = null;
    this.loadConversationObjectives(conv.id);
    this.startConversationPresenceSession();
    this.loadMessages();
    this.loadGpsUser(conv.contact.phone, conv.contact.user_id);
    if (navigate) {
      const filterQuery = this.conversationFilter === 'team'
        ? '?view=team'
        : '';
      this.location.go(`/admin/communication/chat/${conv.id}${filterQuery}`);
    }
  }

  toggleTranslationLanguageMenu(): void {
    if (this.updatingConversationLanguage) return;
    this.showTranslationLanguageMenu = !this.showTranslationLanguageMenu;
    this.showContactInfo = false;
  }

  startEditingTeamChatName(event?: MouseEvent): void {
    event?.stopPropagation();
    const conversation = this.selectedConversation;
    if (!conversation || !this.isInternalTeamConversation(conversation)) return;

    this.teamChatNameDraft = String(
      conversation.team_chat_name || this.getSelectedContactDisplayName(),
    )
      .replace(/^grupo\s+de\s+/i, '')
      .trim();
    this.editingTeamChatName = true;
    this.showTranslationLanguageMenu = false;
    this.showContactInfo = false;
  }

  cancelEditingTeamChatName(): void {
    if (this.updatingTeamChatName) return;
    this.editingTeamChatName = false;
    this.teamChatNameDraft = '';
  }

  saveTeamChatName(): void {
    const conversation = this.selectedConversation;
    if (
      !conversation
      || !this.isInternalTeamConversation(conversation)
      || this.updatingTeamChatName
    ) {
      return;
    }

    const conversationId = conversation.id;
    const name = String(this.teamChatNameDraft || '')
      .replace(/^\s*grupo\s+de\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    this.updatingTeamChatName = true;
    this.whatsappApi.setConversationTeamName(conversationId, name)
      .pipe(finalize(() => {
        this.updatingTeamChatName = false;
      }))
      .subscribe({
        next: response => {
          const savedName = String(response?.team_chat_name || '').trim();
          const listConversation = this.conversations.find(
            item => item.id === conversationId,
          );
          if (listConversation) {
            listConversation.team_chat_name = savedName;
          }
          if (this.selectedConversation?.id === conversationId) {
            this.selectedConversation.team_chat_name = savedName;
          }
          this.conversationsFingerprint = this.getConversationsFingerprint(
            this.conversations,
          );
          this.filterConversations();
          this.editingTeamChatName = false;
          this.teamChatNameDraft = '';
          this.messageService.add({
            severity: 'success',
            summary: savedName ? 'Nombre actualizado' : 'Nombre restablecido',
            detail: savedName
              ? `Ahora se muestra como Grupo De ${toTitleCaseName(savedName)}`
              : 'El chat volvió a usar el nombre del empleado.',
          });
        },
        error: error => {
          this.messageService.add({
            severity: 'error',
            summary: 'No se cambió el nombre',
            detail: getApiErrorMessage(
              error,
              'No se pudo guardar el nombre de este chat',
            ),
          });
        },
      });
  }

  confirmClearSelectedConversation(): void {
    const conversation = this.selectedConversation;
    if (!this.canManageConversationHistory || !conversation) return;

    this.confirmationService.confirm({
      header: 'Vaciar chat',
      message: `Se eliminarán permanentemente todos los mensajes de “${this.getSelectedConversationDisplayName()}”, pero el chat y el contacto se conservarán.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Vaciar chat',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.clearSelectedConversation(conversation.id),
    });
  }

  private clearSelectedConversation(conversationId: number): void {
    if (
      !this.canManageConversationHistory
      || this.managingConversationHistory
      || this.selectedConversation?.id !== conversationId
    ) return;

    this.managingConversationHistory = true;
    this.stopChatPolling();
    this.activeMessagesRequestId += 1;
    this.whatsappApi.clearConversation(conversationId).pipe(
      finalize(() => {
        this.managingConversationHistory = false;
      }),
    ).subscribe({
      next: response => {
        if (this.selectedConversation?.id !== conversationId) return;
        this.messages = [];
        this.lastApiMessageId = null;
        this.hasOlderMessages = false;
        this.selectedConversation.last_message = '';
        this.selectedConversation.last_message_time = null;
        this.selectedConversation.last_message_type = undefined;
        this.selectedConversation.unread_count = 0;
        this.selectedConversation.has_unread = false;
        this.selectedConversation.waiting_for_reply = false;
        this.selectedConversation.priority_urgent = false;
        this.conversationsFingerprint = this.getConversationsFingerprint(
          this.conversations,
        );
        this.filterConversations();
        this.startChatPolling();
        this.messageService.add({
          severity: 'success',
          summary: 'Chat vaciado',
          detail: `${response?.deleted_messages || 0} mensajes eliminados. El contacto se conservó.`,
        });
      },
      error: error => {
        if (this.selectedConversation?.id === conversationId) {
          this.startChatPolling();
        }
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo vaciar el chat',
          detail: getApiErrorMessage(error, 'No se pudo eliminar el historial de esta conversación.'),
        });
      },
    });
  }

  confirmDeleteSelectedConversation(): void {
    const conversation = this.selectedConversation;
    if (!this.canManageConversationHistory || !conversation) return;

    this.confirmationService.confirm({
      header: 'Borrar chat',
      message: `Se eliminarán permanentemente “${this.getSelectedConversationDisplayName()}” y todos sus mensajes. Esta acción no se puede deshacer.`,
      icon: 'pi pi-trash',
      acceptLabel: 'Borrar definitivamente',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deleteSelectedConversation(conversation.id),
    });
  }

  private deleteSelectedConversation(conversationId: number): void {
    if (
      !this.canManageConversationHistory
      || this.managingConversationHistory
      || this.selectedConversation?.id !== conversationId
    ) return;

    this.managingConversationHistory = true;
    this.stopConversationPresenceSession();
    this.stopChatPolling();
    this.activeMessagesRequestId += 1;
    this.whatsappApi.deleteConversation(conversationId).pipe(
      finalize(() => {
        this.managingConversationHistory = false;
      }),
    ).subscribe({
      next: response => {
        this.conversations = this.conversations.filter(
          conversation => conversation.id !== conversationId,
        );
        this.filteredConversations = this.filteredConversations.filter(
          conversation => conversation.id !== conversationId,
        );
        this.selectedConversation = null;
        this.messages = [];
        this.lastApiMessageId = null;
        this.loadingOlderMessages = false;
        this.hasOlderMessages = true;
        this.conversationsFingerprint = this.getConversationsFingerprint(
          this.conversations,
        );
        if (
          this.currentUserId
          && localStorage.getItem(`last_opened_chat_${this.currentUserId}`) === String(conversationId)
        ) {
          localStorage.removeItem(`last_opened_chat_${this.currentUserId}`);
        }
        this.messageService.add({
          severity: 'success',
          summary: 'Chat eliminado',
          detail: `${response?.deleted_messages || 0} mensajes y la conversación fueron eliminados.`,
        });
      },
      error: error => {
        if (this.selectedConversation?.id === conversationId) {
          this.startConversationPresenceSession();
          this.startChatPolling();
        }
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo borrar el chat',
          detail: getApiErrorMessage(error, 'No se pudo eliminar esta conversación.'),
        });
      },
    });
  }

  getConversationLanguageLabel(
    conversation: ChatConversation | null = this.selectedConversation,
  ): string {
    const language = String(conversation?.translation_language || '').trim();
    if (!language) return 'Idioma';
    return this.conversationLanguageOptions.find(option => option.code === language)?.shortName
      || language.toUpperCase();
  }

  isConversationLanguageSelected(language: string): boolean {
    return String(this.selectedConversation?.translation_language || '') === language;
  }

  selectConversationLanguage(language: string): void {
    const conversation = this.selectedConversation;
    if (!conversation || this.updatingConversationLanguage) return;

    const normalizedLanguage = String(language || '').trim().toLowerCase();
    if (this.isConversationLanguageSelected(normalizedLanguage)) {
      this.showTranslationLanguageMenu = false;
      return;
    }

    const option = this.conversationLanguageOptions.find(
      item => item.code === normalizedLanguage,
    );
    if (!option) return;

    const conversationId = conversation.id;
    this.updatingConversationLanguage = true;
    this.whatsappApi
      .setConversationTranslationLanguage(conversationId, normalizedLanguage)
      .pipe(finalize(() => {
        this.updatingConversationLanguage = false;
      }))
      .subscribe({
        next: response => {
          if (this.selectedConversation?.id !== conversationId) return;

          const languageCode = String(response?.translation_language || '');
          const languageName = String(response?.translation_language_name || '');
          this.selectedConversation.translation_language = languageCode;
          this.selectedConversation.translation_language_name = languageName;
          const listConversation = this.conversations.find(item => item.id === conversationId);
          if (listConversation) {
            listConversation.translation_language = languageCode;
            listConversation.translation_language_name = languageName;
          }
          this.showTranslationLanguageMenu = false;
          this.applySelectedTranslations(this.messages);

          if (languageCode) {
            this.translationRetryAfter.delete(`${conversationId}:${languageCode}`);
            this.translateVisibleMessages(this.messages, true);
          }
        },
        error: error => {
          this.messageService.add({
            severity: 'error',
            summary: 'No se cambió el idioma',
            detail: getApiErrorMessage(
              error,
              'No se pudo guardar el idioma de esta conversación',
            ),
          });
        },
      });
  }

  private applySelectedTranslations(messages: ChatMessage[]): void {
    for (const message of messages) {
      const language = this.getMessageTranslationLanguage(message);
      message.translation = language
        ? message.translations?.[language]
        : undefined;
    }
  }

  private getMessageTranslationLanguage(
    message: ChatMessage,
    conversation: ChatConversation | null = this.selectedConversation,
  ): string {
    return resolveConversationMessageTranslationLanguage(
      conversation?.translation_language,
      message.from,
      this.supportTranslationLanguage,
    );
  }

  private translateVisibleMessages(
    messages: ChatMessage[],
    force = false,
  ): void {
    const conversation = this.selectedConversation;
    const customerLanguage = String(conversation?.translation_language || '').trim();
    if (!conversation || !customerLanguage) return;

    const candidatesByLanguage = new Map<string, ChatMessage[]>();
    for (const message of messages) {
      const language = this.getMessageTranslationLanguage(message, conversation);
      if (!language || !message.id) continue;
      if (message.translations?.[language]?.text) continue;
      if (!String(message.text || message.transcription || '').trim()) continue;
      if (this.translatingMessageKeys.has(
        `${conversation.id}:${language}:${message.id}`,
      )) continue;

      const retryKey = `${conversation.id}:${language}`;
      if (!force && Number(this.translationRetryAfter.get(retryKey) || 0) > Date.now()) {
        continue;
      }
      candidatesByLanguage.set(language, [
        ...(candidatesByLanguage.get(language) || []),
        message,
      ]);
    }

    if (!candidatesByLanguage.size) {
      this.applySelectedTranslations(messages);
      return;
    }

    for (const [language, candidates] of candidatesByLanguage.entries()) {
      this.translateVisibleMessageGroup(
        conversation,
        customerLanguage,
        language,
        candidates,
        force,
      );
    }
  }

  private translateVisibleMessageGroup(
    conversation: ChatConversation,
    customerLanguage: string,
    language: string,
    candidates: ChatMessage[],
    force: boolean,
  ): void {
    const retryKey = `${conversation.id}:${language}`;

    const messageIds = candidates
      .map(message => Number(message.id))
      .filter(id => Number.isFinite(id) && id > 0);
    for (const messageId of messageIds) {
      this.translatingMessageKeys.add(
        `${conversation.id}:${language}:${messageId}`,
      );
    }

    this.whatsappApi
      .translateConversationMessages(conversation.id, language, messageIds)
      .pipe(finalize(() => {
        for (const messageId of messageIds) {
          this.translatingMessageKeys.delete(
            `${conversation.id}:${language}:${messageId}`,
          );
        }
      }))
      .subscribe({
        next: response => {
          if (
            this.selectedConversation?.id !== conversation.id
            || this.selectedConversation?.translation_language !== customerLanguage
          ) return;

          const translations = response?.translations || {};
          for (const message of this.messages) {
            if (!message.id || !translations[String(message.id)]) continue;
            message.translations = {
              ...(message.translations || {}),
              [language]: translations[String(message.id)],
            };
          }
          this.applySelectedTranslations(this.messages);
          this.translationRetryAfter.delete(retryKey);
        },
        error: error => {
          this.translationRetryAfter.set(retryKey, Date.now() + 30000);
          if (force) {
            this.messageService.add({
              severity: 'error',
              summary: 'No se pudo traducir',
              detail: getApiErrorMessage(
                error,
                'La IA no pudo traducir los mensajes de esta conversación',
              ),
            });
          }
        },
      });
  }

  openInternalMessageReference(message: InternalChatMessage): void {
    const conversationId = Number(message.referenceConversationId || 0);
    if (!conversationId) return;

    const messageId = Number(message.referenceMessageId || 0);
    this.pendingConversationId = conversationId;
    this.pendingFocusedMessageId = messageId > 0 ? messageId : null;
    this.focusedMessageId = null;
    this.activeTab = 'chat';
    this.conversationFilter = 'all';
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

  private loadGpsUser(phone: string, userId?: string | null): void {
    const normalizedUserId = String(userId || '').trim();
    if (!normalizedUserId && !phone) return;

    const conversationId = this.selectedConversation?.id;
    const userLookup$ = normalizedUserId
      ? this.userService.getById(normalizedUserId).pipe(
          catchError(() => phone ? this.userService.getByPhone(phone) : of({})),
        )
      : this.userService.getByPhone(phone);

    this.userChecklistsDetails = [];
    this.userTargets = [];
    userLookup$.subscribe({
      next: async (user: any) => {
        if (this.selectedConversation?.id !== conversationId) return;
        this.gpsUser = user?._id ? user : null;
        this.calculateUserChecklistsDetails(phone);
        
        if (this.gpsUser && this.gpsUser._id) {
          this.targetsOffset = 0;
          this.targetsSearchTerm = '';
          this.loadTargetsBox();
        }
      },
      error: (err: any) => {
        if (this.selectedConversation?.id !== conversationId) return;
        console.error('[Contact Panel] user lookup error:', err);
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
      const mainAccount = await firstValueFrom(this.userService.getMainAccount());
      const mainAccountId = String(mainAccount?.account?._id || '').trim();
      if (!mainAccountId) throw new Error('No hay una cuenta principal configurada.');
      let res;
      if (this.globalTargetsSearchTerm.trim()) {
        res = await this.targetsService.searchTargets(this.globalTargetsSearchTerm.trim(), mainAccountId, this.globalTargetsOffset, this.globalTargetsLimit);
      } else {
        res = await this.targetsService.getTargetsWithPagination(mainAccountId, this.globalTargetsOffset, this.globalTargetsLimit);
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
             error: (error) => {
               this.messages.push({ from: 'system', text: getApiErrorMessage(error, '✗ Error de conexión'), time: new Date() });
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
         error: (error) => {
             this.messages.push({ from: 'system', text: getApiErrorMessage(error, '✗ Error de conexión'), time: new Date() });
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
            error: (error) => this.messageService.add({ severity: 'error', summary: 'Error', detail: getApiErrorMessage(error, 'No se pudo guardar avance.') })
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
            error: (error) => this.messageService.add({ severity: 'error', summary: 'Error', detail: getApiErrorMessage(error, 'No se pudo guardar avance.') })
        });
    }
  }


  private startConversationsPolling(): void {
    this.stopConversationsPolling();
    this.conversationsPollingInterval = setInterval(() => {
      this.refreshEsterAutoReplyStatus();
      if (this.searchTerm.trim()) return;
      const querySignature = this.getConversationListQuerySignature();
      this.whatsappApi.getConversations(
        this.userInboxId,
        1,
        this.whatsappAgentId,
        true,
        this.searchTerm,
        this.conversationAttentionFilter,
      ).subscribe({
        next: (res: any) => {
          if (querySignature !== this.getConversationListQuerySignature()) return;
          if (res.success) {
            const newConvs = this.sortConversations(res.conversations || []);
            const newFingerprint = this.getConversationsFingerprint(newConvs);
            if (newFingerprint !== this.conversationsFingerprint) {
              const couldParticipate = this.canParticipateInConversation();
              this.conversations = newConvs;
              this.conversationsFingerprint = newFingerprint;
              if (this.selectedConversation) {
                const refreshedConversation = newConvs.find(
                  conversation => conversation.id === this.selectedConversation?.id,
                );
                if (refreshedConversation) {
                  this.selectedConversation = refreshedConversation;
                  if (
                    couldParticipate
                    && !this.canParticipateInConversation(refreshedConversation)
                  ) {
                    this.replyingTo = null;
                    this.showStickerPicker = false;
                    this.clearImprovedResponseState();
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
    return convs.map(c => `${c.id}:${c.team_chat_name || ''}:${c.last_message}:${c.last_message_time}:${c.last_message_type ?? ''}:${this.getConversationPreviewFingerprint(c)}:${c.unread_count}:${c.has_unread ? 1 : 0}:${c.waiting_for_reply ? 1 : 0}:${c.priority_urgent ? 1 : 0}:${c.assignee_id || ''}:${c.assignee_name || ''}:${c.assignee_online ? 1 : 0}:${c.assignee_typing ? 1 : 0}:${c.reminder_eligible ? 1 : 0}:${c.reminder_waiting_since || ''}:${c.contact.satisfaction_level ?? ''}:${c.campaign_execution_id || ''}:${c.campaign_active ? 1 : 0}:${(c.conversation_objectives || []).map(objective => `${objective.id}-${objective.status}-${objective.updated_at || ''}`).join(',')}`).join('|');
  }

  private getConversationPreviewFingerprint(conversation: ChatConversation): string {
    const preview = conversation.last_message_preview;
    if (!preview) return '';
    return [
      preview.id || '',
      preview.type || '',
      preview.direction || '',
      preview.content || '',
      preview.transcription || '',
      preview.image_analysis || '',
      preview.video_analysis || '',
      preview.video_transcription || '',
      preview.reaction?.emoji || '',
      (preview.attachments || [])
        .map(attachment => `${attachment.file_type || ''}-${attachment.content_type || ''}-${attachment.name || ''}`)
        .join(','),
    ].join('~');
  }

  get conversationObjectives(): ConversationObjective[] {
    return this.selectedConversation?.conversation_objectives || [];
  }

  get pendingConversationObjectivesCount(): number {
    return this.conversationObjectives.filter(
      objective => objective.status === 'pending',
    ).length;
  }

  loadConversationObjectives(conversationId = this.selectedConversation?.id): void {
    if (!conversationId) return;
    this.conversationObjectivesLoading = true;
    this.whatsappApi.getConversationObjectives(conversationId).subscribe({
      next: response => {
        if (this.selectedConversation?.id !== conversationId) return;
        this.selectedConversation.conversation_objectives = response.objectives || [];
        const listed = this.conversations.find(item => item.id === conversationId);
        if (listed) listed.conversation_objectives = response.objectives || [];
        this.conversationObjectivesLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        if (this.selectedConversation?.id === conversationId) {
          this.conversationObjectivesLoading = false;
        }
      },
    });
  }

  openNewConversationObjective(): void {
    if (!this.isRootUser || !this.selectedConversation) return;
    this.showConversationObjectivesModal = false;
    this.editingConversationObjective = null;
    this.conversationObjectiveDraft = {
      title: '',
      description: '',
      type: 'result',
      required: true,
      completion_mode: 'both',
    };
    this.showConversationObjectiveDialog = true;
  }

  openEditConversationObjective(objective: ConversationObjective): void {
    if (!this.isRootUser) return;
    this.showConversationObjectivesModal = false;
    this.editingConversationObjective = objective;
    this.conversationObjectiveDraft = {
      title: objective.title,
      description: objective.description || '',
      type: objective.type || 'result',
      required: objective.required !== false,
      completion_mode: objective.completion_mode || 'both',
    };
    this.showConversationObjectiveDialog = true;
  }

  openConversationObjectivesModal(): void {
    if (!this.selectedConversation || !this.conversationObjectives.length) return;
    this.showConversationObjectivesModal = true;
  }

  saveConversationObjective(): void {
    const conversationId = this.selectedConversation?.id;
    const title = this.conversationObjectiveDraft.title.trim();
    if (!this.isRootUser || !conversationId || title.length < 3) return;
    this.savingConversationObjective = true;
    const payload = {
      ...this.conversationObjectiveDraft,
      title,
      description: this.conversationObjectiveDraft.description.trim(),
    };
    const request = this.editingConversationObjective
      ? this.whatsappApi.updateConversationObjective(
          conversationId,
          this.editingConversationObjective.id,
          payload,
        )
      : this.whatsappApi.createConversationObjective(conversationId, payload);
    request.pipe(finalize(() => {
      this.savingConversationObjective = false;
    })).subscribe({
      next: () => {
        this.showConversationObjectiveDialog = false;
        this.loadConversationObjectives(conversationId);
        this.messageService.add({
          severity: 'success',
          summary: this.editingConversationObjective ? 'Objetivo actualizado' : 'Objetivo agregado',
          detail: 'Ester lo tendrá en cuenta en los próximos mensajes.',
        });
      },
      error: error => this.messageService.add({
        severity: 'error',
        summary: 'No se pudo guardar',
        detail: getApiErrorMessage(error, 'No se pudo guardar el objetivo.'),
      }),
    });
  }

  toggleConversationObjective(objective: ConversationObjective): void {
    const conversationId = this.selectedConversation?.id;
    if (!this.isRootUser || !conversationId || objective.status === 'archived') return;
    const completed = objective.status !== 'completed';
    this.whatsappApi
      .setConversationObjectiveProgress(conversationId, objective.id, completed)
      .subscribe({
        next: () => this.loadConversationObjectives(conversationId),
        error: error => this.messageService.add({
          severity: 'error',
          summary: 'No se pudo actualizar',
          detail: getApiErrorMessage(error, 'No se pudo actualizar el objetivo.'),
        }),
      });
  }

  confirmDeleteConversationObjective(objective: ConversationObjective): void {
    const conversationId = this.selectedConversation?.id;
    if (!this.isRootUser || !conversationId) return;
    this.confirmationService.confirm({
      header: 'Eliminar objetivo',
      message: `Se eliminará “${objective.title}”. Ester dejará de tomarlo en cuenta en esta conversación.`,
      icon: 'pi pi-trash',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.whatsappApi.deleteConversationObjective(conversationId, objective.id)
          .subscribe({
            next: () => {
              this.loadConversationObjectives(conversationId);
              this.messageService.add({
                severity: 'success',
                summary: 'Objetivo eliminado',
                detail: 'Ester ya no lo tendrá en cuenta en esta conversación.',
              });
            },
            error: error => this.messageService.add({
              severity: 'error',
              summary: 'No se pudo eliminar',
              detail: getApiErrorMessage(error, 'No se pudo eliminar el objetivo.'),
            }),
          });
      },
    });
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

  get selectedInternalGroup(): InternalChatGroup | undefined {
    return this.internalGroups.find(
      group => group.id === this.selectedInternalGroupId,
    );
  }

  get selectedInternalGroupName(): string {
    return this.selectedInternalGroup?.name || 'Montao GPS';
  }

  get filteredInternalGroups(): InternalChatGroup[] {
    const search = this.normalizeSearchText(this.internalGroupSearchTerm);
    if (!search) return this.internalGroups;

    return this.internalGroups.filter((group) => {
      const searchable = [
        this.getTeamEntryName(group),
        this.getTeamEntrySubtitle(group),
        group.type === 'admin'
          ? 'empleados administrativos'
          : 'técnico whatsapp conversación teléfono',
        group.technician?.name,
        group.technician?.lastName,
        group.technician?.email,
        group.technician?.phone,
        group.technician?.phone2,
      ]
        .filter(Boolean)
        .join(' ');
      return this.normalizeSearchText(searchable).includes(search);
    });
  }

  private normalizeSearchText(value: unknown): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  get totalInternalUnreadCount(): number {
    if (this.internalChatMuted) return 0;
    return this.internalGroups.reduce(
      (total, group) => total + (
        this.isTechnicianWhatsAppEntry(group)
          ? 0
          : Math.max(0, Number(group.unreadCount) || 0)
      ),
      0,
    );
  }

  get totalTeamUnreadCount(): number {
    return this.conversations.reduce(
      (total, conversation) => total + (
        isTeamConversation(conversation)
          ? Math.max(0, Number(conversation.unread_count) || 0)
          : 0
      ),
      0,
    );
  }

  isTechnicianWhatsAppEntry(group: InternalChatGroup): boolean {
    return this.canOpenTechnicianWhatsAppConversations
      && group?.type === 'installation';
  }

  getTeamEntryName(group: InternalChatGroup): string {
    if (!this.isTechnicianWhatsAppEntry(group)) return group?.name || 'Grupo';

    const technicianName = [
      group.technician?.name,
      group.technician?.lastName,
    ].filter(Boolean).join(' ').trim();
    return technicianName || group?.name || 'Técnico';
  }

  getTeamEntrySubtitle(group: InternalChatGroup): string {
    if (!this.isTechnicianWhatsAppEntry(group)) {
      return group?.type === 'admin'
        ? 'Grupo interno · Empleados administrativos'
        : 'Grupo interno · Técnico y empleados administrativos';
    }

    const phone = this.getTechnicianWhatsAppPhone(group);
    const phoneLabel = phone
      ? `WhatsApp ${this.formatWhatsAppPhone(phone)}`
      : 'WhatsApp sin número configurado';
    const conversation = this.getTechnicianWhatsAppConversation(group);
    const preview = conversation
      ? this.getCleanPreview(conversation.last_message)
      : 'Iniciar conversación';
    return `${phoneLabel} · ${preview}`;
  }

  getTeamEntryTime(group: InternalChatGroup): string {
    if (!this.isTechnicianWhatsAppEntry(group)) return '';
    return this.getTimeAgo(
      this.getTechnicianWhatsAppConversation(group)?.last_message_time || null,
    );
  }

  getTeamEntryUnreadCount(group: InternalChatGroup): number {
    const unreadCount = this.isTechnicianWhatsAppEntry(group)
      ? this.getTechnicianWhatsAppConversation(group)?.unread_count
      : group?.unreadCount;
    return Math.max(0, Number(unreadCount) || 0);
  }

  isOpeningTechnicianConversation(group: InternalChatGroup): boolean {
    return this.openingTechnicianGroupId === group?.id;
  }

  refreshTeamEntries(): void {
    this.loadInternalGroups(false, true);
    if (this.canOpenTechnicianWhatsAppConversations) {
      this.loadConversations();
    }
  }

  toggleInternalGroupMenu(): void {
    this.showInternalGroupMenu = !this.showInternalGroupMenu;
    if (this.showInternalGroupMenu) {
      this.loadInternalGroups(false, true);
    }
  }

  loadInternalGroups(loadSelectedChat = true, force = false): void {
    if (loadSelectedChat) {
      this.loadInternalChatAfterGroups = true;
    }
    if (this.loadingInternalGroups) return;

    if (this.internalGroups.length && !force) {
      this.ensureSelectedInternalGroup();
      if (this.loadInternalChatAfterGroups && this.internalGroupChatOpen) {
        this.loadInternalChatAfterGroups = false;
        this.loadInternalChat();
      }
      return;
    }

    this.loadingInternalGroups = true;
    this.internalChatService.getGroups().subscribe({
      next: (response) => {
        this.loadingInternalGroups = false;
        this.internalGroups = response?.groups || [];
        this.canClearInternalMessages = response?.canClearMessages === true;
        this.ensureSelectedInternalGroup();
        this.syncInternalUnreadCount();
        if (this.loadInternalChatAfterGroups && this.internalGroupChatOpen) {
          this.loadInternalChatAfterGroups = false;
          this.loadInternalChat();
        }
      },
      error: (error) => {
        this.loadingInternalGroups = false;
        this.loadInternalChatAfterGroups = false;
        this.internalChatError =
          error?.error?.message || 'No se pudieron cargar los grupos.';
      },
    });
  }

  selectInternalGroup(group: InternalChatGroup): void {
    if (!group?.id) return;

    if (this.isTechnicianWhatsAppEntry(group)) {
      this.openTechnicianWhatsAppConversation(group);
      return;
    }

    this.showInternalGroupMenu = false;
    this.activeTab = 'grupo';
    this.internalGroupChatOpen = true;
    const changed = this.selectedInternalGroupId !== group.id;
    this.selectedInternalGroupId = group.id;
    this.setInternalGroupUnreadCount(group.id, 0);
    if (changed) {
      this.internalMessages = [];
      this.internalChatInput = '';
      this.stopInternalChatPolling();
    }
    this.router.navigate(['/admin/communication', 'grupo'], {
      queryParams: { groupId: group.id },
    });
    this.loadInternalChat();
  }

  openTechnicianWhatsAppConversation(group: InternalChatGroup): void {
    if (!this.isTechnicianWhatsAppEntry(group)) return;

    const existingConversation = this.getTechnicianWhatsAppConversation(group);
    if (existingConversation) {
      this.activateTechnicianWhatsAppConversation(existingConversation);
      return;
    }

    const phone = this.getTechnicianWhatsAppPhone(group);
    if (!this.normalizeSharedContactPhone(phone)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Técnico sin WhatsApp',
        detail: 'Configura un número de teléfono válido en el perfil del técnico.',
      });
      return;
    }
    if (this.openingTechnicianGroupId) return;

    this.openingTechnicianGroupId = group.id;
    const contactName = this.getTeamEntryName(group);
    this.whatsappApi.ensureConversation({
      phone,
      contact_name: contactName,
      claim_if_unassigned: false,
    }).pipe(
      finalize(() => {
        this.openingTechnicianGroupId = null;
      }),
    ).subscribe({
      next: response => {
        const ensured = response?.conversation;
        if (!response?.success || !ensured?.id) {
          this.messageService.add({
            severity: 'error',
            summary: 'No se pudo abrir WhatsApp',
            detail: response?.error || 'No se pudo preparar la conversación con el técnico.',
          });
          return;
        }

        const ensuredPhone = String(ensured.phone || phone).trim();
        const existing = this.conversations.find(conversation => (
          conversation.id === Number(ensured.id)
          || this.normalizeSharedContactPhone(conversation.contact?.phone)
            === this.normalizeSharedContactPhone(ensuredPhone)
        ));
        const sharedContact: WhatsAppSharedContact = {
          name: contactName,
          phones: [{ phone: ensuredPhone }],
        };
        const conversation = existing || this.buildSharedContactConversation(
          sharedContact,
          ensured,
        );

        conversation.assignee_id = ensured.assignee_id
          ?? conversation.assignee_id
          ?? null;
        conversation.contact.name = String(
          ensured.contact_name || contactName,
        ).trim();
        conversation.contact.phone = ensuredPhone;
        conversation.contact.user_id = group.technicianId || null;
        conversation.contact.affiliation_type_id = 'tecnico';

        if (!existing) {
          conversation.assignee_name = this.isConversationAssignedToMe(conversation)
            ? this.currentUserName
            : conversation.assignee_name;
          this.conversations = this.sortConversations([
            conversation,
            ...this.conversations,
          ]);
          this.conversationsFingerprint = this.getConversationsFingerprint(
            this.conversations,
          );
          this.filterConversations();
        }

        this.activateTechnicianWhatsAppConversation(conversation);
      },
      error: error => {
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo abrir WhatsApp',
          detail: error?.error?.error
            || error?.error?.message
            || 'No se pudo preparar la conversación con el técnico.',
        });
      },
    });
  }

  private activateTechnicianWhatsAppConversation(
    conversation: ChatConversation,
  ): void {
    this.showInternalGroupMenu = false;
    this.internalGroupChatOpen = false;
    this.stopInternalChatPolling();
    this.stopActiveEmployeesPolling();
    this.activeTab = 'chat';
    this.conversationFilter = 'team';
    this.selectConversation(conversation);
  }

  private getTechnicianWhatsAppConversation(
    group: InternalChatGroup,
  ): ChatConversation | undefined {
    this.ensureTechnicianConversationIndex();
    const technicianId = String(group?.technicianId || '').trim();
    const byUserId = technicianId
      ? this.technicianConversationByUserId.get(technicianId)
      : undefined;
    if (byUserId) return byUserId;

    const phones = [group?.technician?.phone, group?.technician?.phone2]
      .map(phone => this.normalizeSharedContactPhone(phone))
      .filter(Boolean);
    return phones
      .map(phone => this.technicianConversationByPhone.get(phone))
      .find((conversation): conversation is ChatConversation => !!conversation);
  }

  private ensureTechnicianConversationIndex(): void {
    if (this.technicianConversationIndexSource === this.conversations) return;

    this.technicianConversationIndexSource = this.conversations;
    this.technicianConversationByPhone.clear();
    this.technicianConversationByUserId.clear();
    for (const conversation of this.conversations) {
      const phone = this.normalizeSharedContactPhone(
        conversation?.contact?.phone,
      );
      const userId = String(conversation?.contact?.user_id || '').trim();
      if (phone && !this.technicianConversationByPhone.has(phone)) {
        this.technicianConversationByPhone.set(phone, conversation);
      }
      if (userId && !this.technicianConversationByUserId.has(userId)) {
        this.technicianConversationByUserId.set(userId, conversation);
      }
    }
  }

  private getTechnicianWhatsAppPhone(group: InternalChatGroup): string {
    const conversationPhone = this.getTechnicianWhatsAppConversation(group)
      ?.contact?.phone;
    const candidates = [
      group?.technician?.phone,
      group?.technician?.phone2,
      conversationPhone,
    ].map(phone => String(phone || '').trim());
    return candidates.find(phone => !!this.normalizeSharedContactPhone(phone))
      || candidates.find(Boolean)
      || '';
  }

  private formatWhatsAppPhone(value: unknown): string {
    const phone = this.normalizeSharedContactPhone(value);
    if (/^1\d{10}$/.test(phone)) {
      return `+1 ${phone.slice(1, 4)}-${phone.slice(4, 7)}-${phone.slice(7)}`;
    }
    return phone ? `+${phone}` : '';
  }

  showInternalGroupList(): void {
    this.internalGroupChatOpen = false;
    this.stopInternalChatPolling();
    this.stopActiveEmployeesPolling();
    this.showInternalEmojiPicker = false;
    this.showStickerPicker = false;
    this.router.navigate(['/admin/communication', 'grupo']);
  }

  confirmClearInternalGroup(
    group: InternalChatGroup,
    event?: Event,
  ): void {
    event?.stopPropagation();
    if (
      !this.canClearInternalMessages
      || !group?.id
      || this.clearingInternalGroupId
    ) return;

    this.showInternalGroupMenu = false;
    this.confirmationService.confirm({
      header: `Limpiar ${group.name}`,
      message:
        `Se eliminarán permanentemente todos los mensajes de “${group.name}”. Los demás grupos no serán afectados.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Limpiar grupo',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.clearInternalGroup(group),
    });
  }

  private clearInternalGroup(group: InternalChatGroup): void {
    this.clearingInternalGroupId = group.id;
    this.internalChatService.clearMessages(group.id).pipe(
      finalize(() => {
        this.clearingInternalGroupId = null;
      }),
    ).subscribe({
      next: (response) => {
        this.setInternalGroupUnreadCount(group.id, 0);
        if (group.id === this.selectedInternalGroupId) {
          this.internalMessages = [];
          this.stopInternalChatPolling();
          this.loadInternalChat();
        }
        this.messageService.add({
          severity: 'success',
          summary: 'Conversación limpiada',
          detail:
            `${response?.deleted || 0} mensajes eliminados de ${group.name}.`,
        });
      },
      error: (error) => {
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo limpiar la conversación',
          detail:
            error?.error?.message || 'Inténtalo nuevamente.',
        });
      },
    });
  }

  private ensureSelectedInternalGroup(): void {
    if (
      !this.internalGroups.some(
        group => group.id === this.selectedInternalGroupId,
      )
    ) {
      this.selectedInternalGroupId =
        this.internalGroups[0]?.id || 'admin';
    }
  }

  private setInternalGroupUnreadCount(
    groupId: string,
    unreadCount: number,
  ): void {
    this.internalGroups = this.internalGroups.map((group) =>
      group.id === groupId
        ? { ...group, unreadCount: Math.max(0, unreadCount) }
        : group
    );
    this.syncInternalUnreadCount();
  }

  private syncInternalUnreadCount(): void {
    this.communicationNotifications.syncInternalPendingCount(
      this.totalInternalUnreadCount,
    );
  }

  private markSelectedInternalGroupRead(groupId: string): void {
    if (!groupId || this.activeTab !== 'grupo') return;

    this.setInternalGroupUnreadCount(groupId, 0);
    this.internalChatService.markGroupRead(groupId).subscribe({
      next: () => this.setInternalGroupUnreadCount(groupId, 0),
      error: () => this.loadInternalGroups(false, true),
    });
  }

  private startInternalGroupsPolling(): void {
    this.stopInternalGroupsPolling();
    this.internalGroupsPollingInterval = setInterval(() => {
      if (!this.noInbox) {
        this.loadInternalGroups(false, true);
      }
    }, this.POLL_INTERVAL);
  }

  private stopInternalGroupsPolling(): void {
    if (this.internalGroupsPollingInterval) {
      clearInterval(this.internalGroupsPollingInterval);
      this.internalGroupsPollingInterval = null;
    }
  }

  loadInternalChat(): void {
    this.loadingInternalMessages = true;
    this.internalChatError = '';
    const groupId = this.selectedInternalGroupId;
    const requestId = ++this.internalChatRequestId;
    this.internalChatService.getMessages({
      limit: 50,
      groupId,
    }).subscribe({
      next: (res) => {
        if (
          requestId !== this.internalChatRequestId
          || groupId !== this.selectedInternalGroupId
        ) return;
        this.loadingInternalMessages = false;
        this.internalMessages = res.messages || [];
        this.markSelectedInternalGroupRead(groupId);
        this.scrollInternalChatToBottom();
        this.startInternalChatPolling();
        this.startActiveEmployeesPolling();
      },
      error: (error) => {
        if (
          requestId !== this.internalChatRequestId
          || groupId !== this.selectedInternalGroupId
        ) return;
        this.loadingInternalMessages = false;
        this.internalChatError =
          error?.error?.message || 'No se pudo cargar el grupo seleccionado.';
        this.stopInternalChatPolling();
        this.stopActiveEmployeesPolling();
      }
    });
  }

  toggleInternalChatMuted(): void {
    const muted = this.communicationNotifications.toggleInternalChatMuted();
    this.internalChatMuted = muted;
    this.syncInternalUnreadCount();
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

    const groupId = this.selectedInternalGroupId;
    this.sendingInternalMessage = true;
    this.internalChatInput = '';
    this.internalChatService.sendMessage(
      text,
      [],
      'text',
      groupId,
    ).subscribe({
      next: (res) => {
        this.sendingInternalMessage = false;
        if (
          groupId === this.selectedInternalGroupId
          && res.message
          && !this.internalMessages.some(message => message._id === res.message._id)
        ) {
          this.internalMessages = [...this.internalMessages, res.message];
        }
        this.scrollInternalChatToBottom();
      },
      error: (error) => {
        this.sendingInternalMessage = false;
        if (groupId === this.selectedInternalGroupId) {
          this.internalChatInput = text;
        }
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo enviar',
          detail: getApiErrorMessage(error, 'No se pudo enviar el mensaje al grupo')
        });
      }
    });
  }

  sendInternalAttachment(file: File, forcedText?: string): void {
    if (!file || this.uploadingInternalAttachment || !!this.internalChatError) return;

    const groupId = this.selectedInternalGroupId;
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
        this.internalChatService.sendMessage(
          text,
          [attachment],
          attachment.fileType || 'file',
          groupId,
        ).subscribe({
          next: (messageRes) => {
            this.uploadingInternalAttachment = false;
            if (
              groupId === this.selectedInternalGroupId
              && messageRes.message
              && !this.internalMessages.some(message => message._id === messageRes.message._id)
            ) {
              this.internalMessages = [...this.internalMessages, messageRes.message];
            }
            this.scrollInternalChatToBottom();
          },
          error: (error) => {
            this.uploadingInternalAttachment = false;
            if (!forcedText && groupId === this.selectedInternalGroupId) {
              this.internalChatInput = text;
            }
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

    const groupId = this.selectedInternalGroupId;
    this.sendingStickerId = sticker.id;
    const attachment: InternalChatAttachment = {
      url: sticker.url,
      name: sticker.name,
      mimeType: 'image/webp',
      fileType: 'sticker',
      fileId: sticker.id,
    };
    this.internalChatService.sendMessage(
      '',
      [attachment],
      'sticker',
      groupId,
    ).subscribe({
      next: (res) => {
        this.sendingStickerId = null;
        if (
          groupId === this.selectedInternalGroupId
          && res.message
          && !this.internalMessages.some(message => message._id === res.message._id)
        ) {
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
      error: (error) => {
        this.messageService.add({ severity: 'error', summary: 'No se pudo guardar', detail: getApiErrorMessage(error, 'Error de conexión al guardar el sticker') });
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
      this.internalChatService.getMessages({
        limit: 50,
        after: lastId,
        groupId: this.selectedInternalGroupId,
      }).subscribe({
        next: (res) => {
          const newMessages = (res.messages || []).filter(
            message => !this.internalMessages.some(existing => existing._id === message._id)
          );
          if (newMessages.length) {
            this.internalMessages = [...this.internalMessages, ...newMessages];
            this.markSelectedInternalGroupRead(this.selectedInternalGroupId);
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
        const selectedGroup = this.selectedInternalGroup;
        this.activeEmployees = (users || []).filter((user: any) => {
          const affiliation = String(
            user?.affiliation_type_id || '',
          ).toLowerCase();
          const userId = String(user?._id || user?.id || '');
          const isAdministrativeEmployee = affiliation === 'empleado';
          const isSelectedTechnician =
            selectedGroup?.type === 'installation'
            && userId === selectedGroup.technicianId;
          return (
            userId !== this.currentUserId
            && (isAdministrativeEmployee || isSelectedTechnician)
          );
        }).sort((first: any, second: any) =>
          this.getActiveEmployeeName(first).localeCompare(
            this.getActiveEmployeeName(second),
          ),
        );
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

    const signedMessage = parseAgentSignedMessage(text);
    const formattedBody = signedMessage.body
      .replace(/\*(.*?)\*/g, '<b>$1</b>')
      .replace(/\n/g, '<br/>');
    if (signedMessage.signed) {
        return `<div class="comm-msg-sig"><i class="pi pi-user comm-msg-sig-icon"></i> <span>${signedMessage.signature}</span></div>` +
               (formattedBody ? `<div class="comm-msg-body">${formattedBody}</div>` : '');
    }
    return formattedBody;
  }

  getCleanPreview(text: string | undefined): string {
    if (!text) return 'Sin mensajes';
    if (this.isTechnicalStickerLabel(text)) return 'Sticker';
    if (/^\[Mensaje de WhatsApp tipo (?:unsupported|unknown)\]$/i.test(text.trim())) {
      return 'Encuesta o mensaje no compatible';
    }

    let clean = text;
    const match = text.match(/^>\s*([^\n]+)(?:\n([\s\S]*))?$/);
    if (match) {
        clean = match[2] ? match[2] : 'Monitoreo / Adjunto';
    }
    // Opcionalmente quitar asteriscos para la vista previa
    clean = clean.replace(/\*(.*?)\*/g, '$1');
    return clean.replace(/\n/g, ' ').trim() || 'Sin mensajes';
  }

  getConversationListPreview(
    conversation: ChatConversation,
  ): ConversationListPreviewView {
    return buildConversationListPreview(conversation);
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
    forkJoin({
      messagesResponse: this.whatsappApi
        .getConversationMessages(conversationId, this.messagesPageSize)
        .pipe(timeout(20000)),
      feedback: this.isRootUser
        ? this.esterService.getConversationFeedback(conversationId).pipe(
            catchError(() => of([] as EsterMessageFeedback[])),
          )
        : of([] as EsterMessageFeedback[]),
    }).subscribe({
      next: ({ messagesResponse: res, feedback }) => {
        if (requestId !== this.activeMessagesRequestId || this.selectedConversation?.id !== conversationId) return;
        this.esterFeedbackByMessageId = new Map(
          feedback.map(entry => [Number(entry.message_id), entry]),
        );
        this.loadingMessages = false;
        if (res.success && res.messages?.length) {
          this.messages = this.mapApiMessages(res.messages);
          this.preparePlayableAudio(this.messages);
          this.translateVisibleMessages(this.messages);
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
        this.messagesLoadError = getApiErrorMessage(error, 'No se pudieron cargar los mensajes');
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
      && !isTeamConversation(conversation)
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
              getApiErrorMessage(response, 'Ester no confirmó el envío de la respuesta'),
          });
        },
        error: (error) => {
          this.sendingEsterReply = false;
          if (this.selectedConversation?.id !== conversationId) return;
          this.messageService.add({
            severity: 'error',
            summary: 'Ester no pudo responder',
            detail: getApiErrorMessage(error, 'No se pudo solicitar la respuesta de Ester'),
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
          this.translateVisibleMessages(olderMessages);

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
        status: String(msg.status || 'sent').trim().toLowerCase(),
        type: msg.type || 'text',
        text: msg.type === 'contacts' || ['unsupported', 'unknown'].includes(msg.type)
          ? ''
          : msg.content,
        transcription: msg.transcription,
        parsedHtml: this.parseMessageContent(msg.content),
        time: new Date(msg.created_at * 1000),
        attachments: msg.attachments || [],
        contacts: Array.isArray(msg.contacts) ? msg.contacts : [],
        unsupported: msg.unsupported || (
          ['unsupported', 'unknown'].includes(msg.type)
            ? { kind: 'unknown' as const }
            : undefined
        ),
        reaction: msg.reaction?.emoji
          ? {
              emoji: msg.reaction.emoji,
              sender: msg.reaction.sender || 'Ester Assistant',
              from: msg.reaction.from || 'me',
            }
          : undefined,
        senderName: String(msg.sender || ''),
        esterFeedback: this.esterFeedbackByMessageId.get(Number(msg.id)),
        translations: msg.translations || {},
      };
      const activeLanguage = String(
        this.selectedConversation?.translation_language || '',
      ).trim();
      mapped.translation = activeLanguage
        ? mapped.translations?.[
            this.getMessageTranslationLanguage(mapped)
          ]
        : undefined;

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

  shouldShowConversationDate(messageIndex: number): boolean {
    const currentDateKey = this.getConversationDateKey(
      this.messages[messageIndex]?.time,
    );
    if (!currentDateKey) return false;
    if (messageIndex === 0) return true;

    return currentDateKey !== this.getConversationDateKey(
      this.messages[messageIndex - 1]?.time,
    );
  }

  formatConversationDate(value: Date | string | number | null | undefined): string {
    const date = this.toValidConversationDate(value);
    if (!date) return 'Fecha desconocida';

    const today = new Date();
    const dayDifference = this.getLocalCalendarDayNumber(today)
      - this.getLocalCalendarDayNumber(date);

    if (dayDifference === 0) return 'Hoy';
    if (dayDifference === 1) return 'Ayer';

    const formatted = new Intl.DateTimeFormat('es-DO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
    }).format(date);

    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  private getConversationDateKey(
    value: Date | string | number | null | undefined,
  ): string {
    const date = this.toValidConversationDate(value);
    if (!date) return '';

    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }

  private toValidConversationDate(
    value: Date | string | number | null | undefined,
  ): Date | null {
    if (value === null || value === undefined) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private getLocalCalendarDayNumber(date: Date): number {
    return Math.floor(Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    ) / 86_400_000);
  }

  getIncomingCustomerSignature(): string {
    return buildCustomerSignatureLabel(
      this.gpsUser,
      this.selectedConversation?.contact?.name || 'Cliente',
    );
  }

  shouldShowMessageTranslation(message: ChatMessage): boolean {
    const translatedText = this.getMessageTranslationText(message);
    if (!translatedText) return false;

    const originalText = parseAgentSignedMessage(
      String(message.text || message.transcription || ''),
    ).body;
    return translatedText.localeCompare(originalText, undefined, {
      sensitivity: 'accent',
    }) !== 0;
  }

  getMessageTranslationText(message: ChatMessage): string {
    return parseAgentSignedMessage(
      String(message.translation?.text || ''),
    ).body;
  }

  getMessageTranslationSignature(message: ChatMessage): string {
    return parseAgentSignedMessage(
      String(message.translation?.text || ''),
    ).signature;
  }

  isEsterMessage(message: ChatMessage): boolean {
    if (message.from !== 'me' || !message.id) return false;
    return /ester/i.test(String(message.senderName || ''))
      || /^>\s*Ester Assistant\b/i.test(String(message.text || '').trim());
  }

  openEsterFeedback(message: ChatMessage): void {
    if (!this.isRootUser || !this.isEsterMessage(message) || message.esterFeedback) return;
    this.clearEsterLearningTimers();
    this.selectedEsterFeedbackMessage = message;
    this.esterFeedbackText = '';
    this.esterLearningStage = 0;
    this.esterLearningRulePreview = null;
    this.showEsterFeedbackModal = true;
  }

  closeEsterFeedback(): void {
    if (this.submittingEsterFeedback) return;
    this.showEsterFeedbackModal = false;
    this.selectedEsterFeedbackMessage = null;
    this.esterFeedbackText = '';
    this.esterLearningStage = 0;
    this.esterLearningRulePreview = null;
    this.clearEsterLearningTimers();
  }

  submitEsterFeedback(): void {
    const conversationId = Number(this.selectedConversation?.id || 0);
    const messageId = Number(this.selectedEsterFeedbackMessage?.id || 0);
    const feedback = this.esterFeedbackText.replace(/\s+/g, ' ').trim();
    if (!conversationId || !messageId || feedback.length < 10) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Feedback incompleto',
        detail: 'Explica con claridad qué debió hacer Ester.',
      });
      return;
    }

    this.submittingEsterFeedback = true;
    this.esterLearningRulePreview = null;
    this.startEsterLearningAnimation();
    forkJoin({
      result: this.esterService.submitMessageFeedback({
        conversationId,
        messageId,
        feedback,
      }),
      minimumAnimation: timer(3800),
    }).subscribe({
      next: ({ result }) => {
        this.clearEsterLearningTimers();
        this.submittingEsterFeedback = false;
        this.esterLearningStage = 4;
        this.esterLearningRulePreview = {
          title: result.rule.title,
          content: result.rule.content,
          version: result.rule.version,
          changeSummary: result.rule.change_summary,
        };
        const evaluatedMessage = this.messages.find(message => message.id === messageId);
        if (evaluatedMessage) evaluatedMessage.esterFeedback = result.feedback;
        this.esterFeedbackByMessageId.set(messageId, result.feedback);
        this.messageService.add({
          severity: 'success',
          summary: result.updated ? 'Aprendizaje optimizado' : 'Nuevo aprendizaje',
          detail: `${result.rule.title} · v${result.rule.version}`,
        });
        this.esterLearningTimers.push(window.setTimeout(() => {
          this.closeEsterFeedback();
        }, 2400));
      },
      error: error => {
        this.clearEsterLearningTimers();
        this.submittingEsterFeedback = false;
        this.esterLearningStage = 0;
        this.messageService.add({
          severity: 'error',
          summary: 'Ester no pudo aprender el feedback',
          detail: error?.error?.message || 'Inténtalo nuevamente.',
        });
      },
    });
  }

  private startEsterLearningAnimation(): void {
    this.clearEsterLearningTimers();
    this.esterLearningStage = 1;
    this.esterLearningTimers.push(
      window.setTimeout(() => this.esterLearningStage = 2, 1050),
      window.setTimeout(() => this.esterLearningStage = 3, 2250),
    );
  }

  private clearEsterLearningTimers(): void {
    this.esterLearningTimers.forEach(timerId => window.clearTimeout(timerId));
    this.esterLearningTimers = [];
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
          this.translateVisibleMessages(olderMessages);
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
      || !this.canParticipateInConversation(this.selectedConversation)
      || this.sendingMessage
      || this.waitingToSendImprovedResponse
    ) return;

    const draft = this.chatInput.trim();

    if (!this.improveResponseEnabled) {
      this.sendResolvedMessage(draft, this.replyingTo);
      return;
    }

    if (this.improvedResponseAnalyzedDraft === draft) {
      this.sendResolvedMessage(
        this.improvedResponseSuggestion.trim() || draft,
        this.replyingTo,
      );
      return;
    }

    this.pendingImprovedSend = {
      draft,
      conversationId: this.selectedConversation.id,
      replyMsg: this.replyingTo,
    };
    this.waitingToSendImprovedResponse = true;
    this.improveResponseError = '';
    this.improveResponseStatus = 'Revisando el mensaje antes de enviarlo…';

    // Si ya hay una revisión en curso para este borrador, su respuesta
    // completará el envío. Si solo estaba pendiente el debounce, la
    // ejecutamos de inmediato.
    if (!this.improvingResponse) {
      this.scheduleImprovedResponse(draft, 0, true);
      this.improveResponseStatus = 'Revisando el mensaje antes de enviarlo…';
    }
  }

  private sendResolvedMessage(text: string, replyMsg: ChatMessage | null): void {
    const conversation = this.selectedConversation;
    const outgoingText = this.removeMessageOpeningPunctuation(text);
    if (
      !outgoingText.trim()
      || !conversation
      || !this.canParticipateInConversation(conversation)
      || this.sendingMessage
    ) {
      this.pendingImprovedSend = null;
      this.waitingToSendImprovedResponse = false;
      return;
    }

    const newMsg: ChatMessage = {
      from: 'me',
      text: outgoingText,
      parsedHtml: this.parseMessageContent(outgoingText),
      time: new Date(),
    };
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
    const finalApiText = `${this.getAgentSignature()}\n${outgoingText}`;

    this.chatInput = '';
    this.clearImprovedResponseState();
    this.showChatEmojiPicker = false;
    this.stopConversationTyping();
    this.replyingTo = null;
    this.sendingMessage = true;
    this.scrollToBottom();

    this.whatsappApi.sendConversationMessage(
      conversation.id,
      finalApiText,
      replyMsg?.id,
      undefined,
      this.whatsappAgentId
    ).subscribe({
      next: (res) => {
        this.sendingMessage = false;
        if (!res.success) {
          this.messages.push({
            from: 'system',
            text: `✗ ${getApiErrorMessage(res, 'No se pudo enviar el mensaje')}`,
            time: new Date(),
          });
        } else if (res.translation?.text) {
          const language = String(res.translation.target_language || '').trim();
          newMsg.translations = language
            ? { [language]: res.translation }
            : {};
          newMsg.translation = res.translation;
        }
        this.scrollToBottom();
        this.refocusInput();
      },
      error: (error) => {
        this.sendingMessage = false;
        this.messages.push({ from: 'system', text: getApiErrorMessage(error, '✗ Error de conexión'), time: new Date() });
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

  private removeMessageOpeningPunctuation(value: string): string {
    return String(value || '').replace(/[¿¡]/g, '');
  }

  onImproveResponseToggle(enabled: boolean): void {
    this.improveResponseEnabled = enabled;
    this.clearImprovedResponseState();
    if (enabled) {
      this.scheduleImprovedResponse(this.chatInput, 150);
    }
  }

  useImprovedResponse(): void {
    if (this.waitingToSendImprovedResponse) return;

    const suggestion = this.improvedResponseSuggestion.trim();
    if (!suggestion) return;

    this.chatInput = suggestion;
    this.clearImprovedResponseState();
    this.improveResponseStatus = 'Sugerencia aplicada. Puedes editarla antes de enviar.';
    this.refocusInput();
  }

  private scheduleImprovedResponse(
    value: string,
    delay = this.IMPROVE_RESPONSE_DEBOUNCE_MS,
    force = false,
  ): void {
    if (this.improveResponseDebounceTimer) {
      clearTimeout(this.improveResponseDebounceTimer);
      this.improveResponseDebounceTimer = undefined;
    }

    const requestId = ++this.improveResponseRequestId;
    this.improvingResponse = false;
    this.improvedResponseAnalyzedDraft = '';
    this.improvedResponseSuggestion = '';
    this.improveResponseStatus = '';
    this.improveResponseError = '';

    const draft = String(value || '').trim();
    const conversation = this.selectedConversation;
    if (
      !this.improveResponseEnabled
      || (!force && draft.length < 3)
      || !conversation
      || !this.canParticipateInConversation(conversation)
      || this.sendingMessage
    ) {
      return;
    }

    const conversationId = conversation.id;
    this.improveResponseDebounceTimer = setTimeout(() => {
      this.improveResponseDebounceTimer = undefined;
      if (
        requestId !== this.improveResponseRequestId
        || this.selectedConversation?.id !== conversationId
        || this.chatInput.trim() !== draft
      ) {
        return;
      }

      this.improvingResponse = true;
      this.whatsappApi
        .improveEmployeeReply(conversationId, draft)
        .pipe(timeout(45000))
        .subscribe({
          next: response => {
            if (
              requestId !== this.improveResponseRequestId
              || this.selectedConversation?.id !== conversationId
              || this.chatInput.trim() !== draft
            ) {
              return;
            }

            this.improvingResponse = false;
            if (!response?.enabled) {
              this.handleImprovedResponseFailure(
                draft,
                conversationId,
                'La mejora de respuestas no está disponible.',
              );
              return;
            }
            if (!response?.success || !response.suggestion?.trim()) {
              this.handleImprovedResponseFailure(
                draft,
                conversationId,
                'No se pudo preparar una recomendación. Puedes enviar tu mensaje normalmente.',
              );
              return;
            }

            const suggestion = response.suggestion.trim();
            this.improvedResponseAnalyzedDraft = draft;
            if (response.changed === false || suggestion === draft) {
              if (this.sendPendingImprovedResponse(draft, conversationId, draft)) {
                return;
              }
              this.improveResponseStatus = 'No se detectaron errores en el mensaje.';
              return;
            }
            if (this.sendPendingImprovedResponse(draft, conversationId, suggestion)) {
              return;
            }
            this.improvedResponseSuggestion = suggestion;
          },
          error: () => {
            if (
              requestId !== this.improveResponseRequestId
              || this.selectedConversation?.id !== conversationId
            ) {
              return;
            }
            this.improvingResponse = false;
            this.handleImprovedResponseFailure(
              draft,
              conversationId,
              'No se pudo preparar una recomendación. Puedes enviar tu mensaje normalmente.',
            );
          },
        });
    }, delay);
  }

  private sendPendingImprovedResponse(
    draft: string,
    conversationId: number,
    resolvedText: string,
  ): boolean {
    const pending = this.pendingImprovedSend;
    if (
      !pending
      || pending.draft !== draft
      || pending.conversationId !== conversationId
    ) {
      return false;
    }

    this.pendingImprovedSend = null;
    this.waitingToSendImprovedResponse = false;
    this.sendResolvedMessage(resolvedText, pending.replyMsg);
    return true;
  }

  private handleImprovedResponseFailure(
    draft: string,
    conversationId: number,
    fallbackMessage: string,
  ): void {
    this.improvedResponseAnalyzedDraft = '';
    this.improvedResponseSuggestion = '';
    this.improveResponseStatus = '';

    const pending = this.pendingImprovedSend;
    if (
      pending
      && pending.draft === draft
      && pending.conversationId === conversationId
    ) {
      this.pendingImprovedSend = null;
      this.waitingToSendImprovedResponse = false;
      this.improveResponseError = 'No se pudo analizar el mensaje y no fue enviado. Inténtalo nuevamente.';
      this.refocusInput();
      return;
    }

    this.improveResponseError = fallbackMessage;
  }

  private clearImprovedResponseState(): void {
    if (this.improveResponseDebounceTimer) {
      clearTimeout(this.improveResponseDebounceTimer);
      this.improveResponseDebounceTimer = undefined;
    }
    this.improveResponseRequestId += 1;
    this.improvingResponse = false;
    this.waitingToSendImprovedResponse = false;
    this.improvedResponseAnalyzedDraft = '';
    this.pendingImprovedSend = null;
    this.improvedResponseSuggestion = '';
    this.improveResponseStatus = '';
    this.improveResponseError = '';
  }

  toggleChatEmojiPicker(): void {
    if (this.sendingMessage || this.waitingToSendImprovedResponse) return;
    this.showChatEmojiPicker = !this.showChatEmojiPicker;
  }

  addChatEmoji(emoji: string): void {
    if (!emoji || this.sendingMessage || this.waitingToSendImprovedResponse) return;

    const input = this.messageInput?.nativeElement as HTMLTextAreaElement | undefined;
    const start = input?.selectionStart ?? this.chatInput.length;
    const end = input?.selectionEnd ?? start;
    this.chatInput = `${this.chatInput.slice(0, start)}${emoji}${this.chatInput.slice(end)}`;
    this.onChatInputChange(this.chatInput);

    const caretPosition = start + emoji.length;
    setTimeout(() => {
      if (!input) return;
      input.focus();
      input.setSelectionRange(caretPosition, caretPosition);
    });
  }

  setReplyTo(msg: ChatMessage): void {
    if (!msg.id || !this.canParticipateInConversation()) return;
    this.replyingTo = msg;
    this.reactionPickerMessageId = null;
    this.showStickerPicker = false;
    this.refocusInput();
  }

  toggleReactionPicker(msg: ChatMessage, event: Event): void {
    event.stopPropagation();
    if (
      !msg.id
      || !this.canParticipateInConversation()
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
      || !this.canParticipateInConversation(this.selectedConversation)
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
    if ('contacts' in (msg || {}) && (msg as ChatMessage)?.contacts?.length) {
      const contacts = (msg as ChatMessage).contacts || [];
      return contacts.length === 1
        ? `Contacto: ${contacts[0].name}`
        : `${contacts.length} contactos compartidos`;
    }
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

  getSharedContactInitials(contact: WhatsAppSharedContact): string {
    return String(contact?.name || 'Contacto')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('') || 'C';
  }

  getSharedContactPhone(phone: { phone?: string; wa_id?: string } | null | undefined): string {
    return String(phone?.phone || phone?.wa_id || '').trim();
  }

  getSharedContactWhatsAppUrl(phone: { phone?: string; wa_id?: string } | null | undefined): string {
    const normalized = String(phone?.wa_id || phone?.phone || '').replace(/\D/g, '');
    return normalized ? `https://wa.me/${normalized}` : '';
  }

  isOpeningSharedContactConversation(
    phone: { phone?: string; wa_id?: string } | null | undefined,
  ): boolean {
    return this.openingSharedContactPhone === this.normalizeSharedContactPhone(
      phone?.wa_id || phone?.phone,
    );
  }

  startSharedContactConversation(
    contact: WhatsAppSharedContact,
    phone: { phone?: string; wa_id?: string },
  ): void {
    const rawPhone = this.getSharedContactPhone(phone);
    const normalizedPhone = this.normalizeSharedContactPhone(rawPhone);
    if (!normalizedPhone) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Número no disponible',
        detail: 'Este contacto no tiene un número válido para WhatsApp.',
      });
      return;
    }
    if (this.openingSharedContactPhone) return;

    this.openingSharedContactPhone = normalizedPhone;
    this.whatsappApi.ensureConversation({
      phone: rawPhone,
      contact_name: String(contact?.name || 'Contacto compartido').trim(),
      claim_if_unassigned: true,
    }).pipe(
      finalize(() => {
        this.openingSharedContactPhone = '';
      }),
    ).subscribe({
      next: response => {
        const ensured = response?.conversation;
        if (!response?.success || !ensured?.id) {
          this.showSharedContactConversationError(
            response?.error || 'No se pudo preparar la conversación.',
          );
          return;
        }

        const ensuredPhone = String(ensured.phone || rawPhone).trim();
        const existingConversation = this.conversations.find(conversation => (
          conversation.id === Number(ensured.id)
          || this.normalizeSharedContactPhone(conversation.contact?.phone)
            === this.normalizeSharedContactPhone(ensuredPhone)
        ));
        const conversation = existingConversation || this.buildSharedContactConversation(
          contact,
          ensured,
        );

        conversation.assignee_id = ensured.assignee_id ?? conversation.assignee_id ?? null;
        conversation.contact.name = String(
          ensured.contact_name || contact?.name || conversation.contact.name,
        ).trim();
        conversation.contact.phone = ensuredPhone;

        if (!existingConversation) {
          conversation.assignee_name = this.isConversationAssignedToMe(conversation)
            ? this.currentUserName
            : conversation.assignee_name;
          this.conversations = this.sortConversations([
            conversation,
            ...this.conversations,
          ]);
          this.conversationsFingerprint = this.getConversationsFingerprint(
            this.conversations,
          );
          this.filterConversations();
        }

        this.selectConversation(conversation);
        if (this.isConversationAssignedToMe(conversation)) {
          setTimeout(() => {
            if (
              this.selectedConversation?.id === conversation.id
              && this.isOutside24hWindow(conversation)
            ) {
              this.openTemplateModal();
            }
          });
        } else if (conversation.assignee_id) {
          this.messageService.add({
            severity: 'info',
            summary: 'Conversación abierta',
            detail: 'Este contacto ya está siendo atendido por otro empleado.',
          });
        }
      },
      error: error => {
        this.showSharedContactConversationError(
          error?.error?.error
          || error?.error?.message
          || 'No se pudo abrir la conversación.',
        );
      },
    });
  }

  private normalizeSharedContactPhone(value: unknown): string {
    let phone = String(value || '').replace(/\D/g, '');
    if (/^[2-9]\d{2}[2-9]\d{6}$/.test(phone)) {
      phone = `1${phone}`;
    }
    return phone;
  }

  private buildSharedContactConversation(
    contact: WhatsAppSharedContact,
    ensured: {
      id: number;
      phone: string;
      contact_name: string;
      assignee_id?: string | null;
    },
  ): ChatConversation {
    return {
      id: Number(ensured.id),
      status: 'open',
      contact: {
        id: ensured.phone,
        name: ensured.contact_name || contact?.name || 'Contacto compartido',
        phone: ensured.phone,
        email: contact?.emails?.[0]?.email || '',
        avatar: '',
      },
      last_message: '',
      last_message_time: null,
      unread_count: 0,
      inbox_id: this.userInboxId,
      assignee_id: ensured.assignee_id ?? null,
      assignee_name: '',
    };
  }

  private showSharedContactConversationError(detail: string): void {
    this.messageService.add({
      severity: 'error',
      summary: 'No se pudo iniciar la conversación',
      detail,
    });
  }

  async copySharedContactPhone(phone: { phone?: string; wa_id?: string }): Promise<void> {
    const value = this.getSharedContactPhone(phone);
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      this.messageService.add({
        severity: 'success',
        summary: 'Número copiado',
        detail: value,
      });
    } catch {
      this.messageService.add({
        severity: 'warn',
        summary: 'No se pudo copiar',
        detail: 'Copia el número manualmente.',
      });
    }
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
      error: (error) => {
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo guardar',
          detail: getApiErrorMessage(error, 'Error de conexión al guardar el sticker')
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
      error: (error) => {
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo crear',
          detail: getApiErrorMessage(error, 'Error de conexión al subir la imagen')
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
      !this.canParticipateInConversation()
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
      error: (error) => {
        this.sendingStickerId = null;
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo enviar',
          detail: getApiErrorMessage(error, 'Error de conexión al enviar el sticker')
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
          detail: getApiErrorMessage(res, 'El servidor no confirmó la eliminación del sticker')
        });
      },
      error: (error) => {
        this.deletingStickerId = null;
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo borrar',
          detail: getApiErrorMessage(error, 'Error de conexión al borrar el sticker')
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
      || !this.canParticipateInConversation(this.selectedConversation)
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
      error: (error) => {
        this.sendingMessage = false;
        this.messages.push({ from: 'system', text: getApiErrorMessage(error, '✗ Error de conexión'), time: new Date() });
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
      && (!this.canParticipateInConversation() || this.sendingMessage)
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

    if (
      !this.selectedConversation
      || !this.canParticipateInConversation(this.selectedConversation)
    ) return;
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
      error: (error) => {
        this.sendingMessage = false;
        this.messages.push({ from: 'system', text: getApiErrorMessage(error, '✗ Error de conexión'), time: new Date() });
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
    if (
      !this.selectedConversation
      || !this.whatsappAgentId
      || this.isInternalTeamConversation(this.selectedConversation)
    ) return;

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
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: getApiErrorMessage(res, 'No se pudo asignar el chat'),
          });
        }
      },
      error: (error) => {
        this.messageService.add({severity:'error', summary:'Error', detail:getApiErrorMessage(error, 'Problema en la red al asignar.')});
      }
    });
  }

  sendConversationReminder(): void {
    const conversation = this.selectedConversation;
    if (
      !conversation?.reminder_eligible
      || this.isInternalTeamConversation(conversation)
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
    if (
      !this.selectedConversation
      || !this.canParticipateInConversation(this.selectedConversation)
    ) return;
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
      || !this.canParticipateInConversation(this.selectedConversation)
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
      error: (error) => {
        this.sendingTemplate = false;
        this.messageService.add({severity:'error', summary:'Error en Red', detail:getApiErrorMessage(error, 'No se pudo conectar con el servidor para emitir plantilla.')});
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
            const latestMessages = this.mapApiMessages(res.messages);
            const currentMessagesById = new Map(
              this.messages
                .filter((message): message is ChatMessage & { id: number } => typeof message.id === 'number')
                .map((message) => [message.id, message])
            );
            const hasDeliveryStatusUpdates = latestMessages.some((message) => {
              if (typeof message.id !== 'number') return false;
              const currentMessage = currentMessagesById.get(message.id);
              return Boolean(
                currentMessage
                && currentMessage.status !== message.status
              );
            });

            if (newestId !== this.lastApiMessageId || hasDeliveryStatusUpdates) {
              const shouldScrollToBottom = this.isNearBottom();
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
              this.translateVisibleMessages(newMessages);
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

  getMessageDeliveryLabel(message: ChatMessage): string {
    switch (String(message.status || '').toLowerCase()) {
      case 'read':
        return 'Visto';
      case 'delivered':
        return 'Entregado';
      case 'failed':
        return 'No se pudo enviar';
      default:
        return 'Enviado';
    }
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
    this.scheduleImprovedResponse(value);
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

  getConversationDisplayName(conversation: ChatConversation): string {
    return formatConversationDisplayName(conversation);
  }

  getConversationContactDisplayName(conversation: ChatConversation): string {
    return formatConversationContactName(conversation);
  }

  getSelectedContactDisplayName(): string {
    const name = this.gpsUser
      ? `${this.gpsUser.name || ''} ${this.gpsUser.last_name || ''}`
      : this.selectedConversation?.contact?.name;
    return formatConversationContactName({
      contact: {
        name: toTitleCaseName(name) || 'Sin Nombre',
        affiliation_type_id:
          this.selectedConversation?.contact?.affiliation_type_id,
      },
    });
  }

  getSelectedConversationDisplayName(): string {
    const conversation = this.selectedConversation;
    if (!conversation) return 'Sin Nombre';
    return formatConversationDisplayName({
      team_chat_name: conversation.team_chat_name,
      contact: {
        name: this.getSelectedContactDisplayName(),
        affiliation_type_id: conversation.contact.affiliation_type_id,
      },
    });
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
