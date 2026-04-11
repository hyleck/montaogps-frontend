import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { ChatwootApiService } from '@core/services/chatwoot-api.service';
import { AuthService } from '@core/services/auth.service';
import { UserService } from '@core/services/user.service';
import { TargetsService } from '@core/services/targets.service';
import { InteraccionesService, UserList } from '../../../../interacciones/presentation/services/interacciones.service';
import { FirebaseNotificationsService } from '@core/services/firebase-notifications.service';
import { SystemService } from '@core/services/system.service';
import { InventoryService } from '@core/services/inventory.service';
import { MessageService, MenuItem } from 'primeng/api';

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

interface ChatAttachment {
  data_url: string;
  file_type: string;
  content_type: string;
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

  // Chat
  messages: ChatMessage[] = [];
  chatInput: string = '';
  sendingMessage: boolean = false;
  replyingTo: ChatMessage | null = null;
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

    this.loadUserInbox();
    this.interaccionesService.getAll().subscribe({
      next: (lists) => this.allUserLists = lists
    });
    this.route.params.subscribe(params => {
      const tab = params['tab'];
      if (tab === 'chat' || tab === 'correo' || tab === 'foro') {
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

  navigateToTab(tab: 'chat' | 'correo' | 'foro'): void {
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
  // EMAIL (INBOX 2)
  // ============================

  loadEmailConversations(): void {
    // Attempt to load from cache for instant initial rendering
    const cacheKey = `chatwoot_email_convs_${this.emailInboxIds.join('_')}`;
    if (!this.emailConversations.length && this.emailInboxIds.length > 0) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          this.emailConversations = JSON.parse(cached);
          this.filterEmailConversations();
          
          if (!this.pendingConversationId && this.activeTab === 'correo' && !this.selectedEmail) {
            const lastId = localStorage.getItem(`last_opened_email_${this.currentUserId}`);
            if (lastId) {
              const lastConv = this.emailConversations.find(c => c.id === Number(lastId));
              if (lastConv) this.selectEmail(lastConv, true);
            }
          }
        } catch (e) { }
      }
    }

    this.loadingEmailConversations = this.emailConversations.length === 0;
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
        localStorage.setItem(cacheKey, JSON.stringify(this.emailConversations));
        
        this.filterEmailConversations();
        if (this.pendingConversationId && this.activeTab === 'correo') {
          const conv = this.emailConversations.find(c => c.id === this.pendingConversationId);
          if (conv) this.selectEmail(conv, false);
          this.pendingConversationId = null;
        } else if (!this.selectedEmail && this.activeTab === 'correo') {
          const lastId = localStorage.getItem(`last_opened_email_${this.currentUserId}`);
          if (lastId) {
            const lastConv = this.emailConversations.find(c => c.id === Number(lastId));
            if (lastConv) this.selectEmail(lastConv, true);
          }
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
    if (!this.selectedConversation || (!this.selectedTransferAgentId && !isEster) || !this.transferSummary.trim()) return;
    
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

  selectEmail(conv: ChatConversation, navigate: boolean = true): void {
    conv.unread_count = 0; // Clear indicator instantly mimicking visual read receipts
    this.selectedEmail = conv;
    if (this.currentUserId) {
      localStorage.setItem(`last_opened_email_${this.currentUserId}`, conv.id.toString());
    }
    this.loadEmailMessages();
    if (navigate) {
      this.location.go(`/admin/communication/correo/${conv.id}`);
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
    this.chatwootApi.sendMessage(this.composeEmail.trim(), fullMessage, undefined, this.composeFromInboxId || this.userInbox2Id, files, this.chatwootAgentId).subscribe({
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
      { label: 'Documento', icon: 'pi pi-file', command: () => this.docFileInput.nativeElement.click() }
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
        template_name: 'simple_mensaje',
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
