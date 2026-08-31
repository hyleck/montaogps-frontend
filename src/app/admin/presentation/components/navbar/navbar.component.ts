import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, HostListener } from '@angular/core';
import { ThemesService } from '../../../../shareds/services/themes.service';
import { MenuItem, ConfirmationService, MessageService } from 'primeng/api';
import { StatusService } from '../../../../shareds/services/status.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { LangService } from '../../../../shareds/services/langi18/lang.service';
import { TranslateService } from '@ngx-translate/core';
import { SelectionService } from '../../../../core/services/selection.service';
import { TargetsService } from '../../../../core/services/targets.service';
import { Target, CreateProcessDto, UpdateTargetDto } from '../../../../core/interfaces/target.interface';
import { UserService } from '../../../../core/services/user.service';
import { User } from '../../../../core/interfaces/user.interface';
import { SystemService } from '../../../../core/services/system.service';
import { AppUpdateService } from '../../../../core/services/app-update.service';
import { ProtocolsService } from '../../../../core/services/protocols.service';
import { SIM_CARD_TYPES } from '../../../../core/constants/sim-card-types.constant';
import { Subject, takeUntil, debounceTime, distinctUntilChanged, filter, firstValueFrom } from 'rxjs';
import { AlertsService, AlertResponse, AlertStatus, CreateAlertDto } from '../../../../core/services/alerts.service';
import * as XLSX from 'xlsx-js-style';

// ... (inside NavbarComponent class)

import { MapAlertComponent } from '../map-alert/map-alert.component';
import { FirebaseNotificationsService, NotificationLog } from '../../../../core/services/firebase-notifications.service';
import { SupportService } from '../../../../core/services/support.service';
import {
  AssignedCommunicationChat,
  CommunicationNotificationService,
} from '../../../../core/services/communication-notification.service';
import { WhatsAppApiService } from '../../../../core/services/whatsapp-api.service';
import {
  InternalChatAttachment,
  InternalChatGroup,
  InternalChatMessage,
  InternalChatService,
} from '../../../../core/services/internal-chat.service';
import {
  CreateTicketDto,
  SupportDiagnosticCapture,
  SupportAssistantMessage,
  Ticket,
} from '../../../../core/interfaces/support.interface';
import { getApiErrorMessage } from '../../../../core/utils/api-error.util';
import {
  formatChatTimelineDate,
  shouldShowChatDateSeparator,
} from '../../../../core/utils/chat-timeline.util';
import {
  FloatingCommunicationAttachment,
  FloatingCommunicationMessage,
  mapFloatingCommunicationMessage,
} from './floating-communication-message';
import {
  ALERT_PRESET_CATEGORIES,
  ALERT_PRESETS,
  AlertEngine,
  AlertPresetCard,
  AlertPresetCategory,
} from './alert-presets.catalog';

interface RealtimeGeneratedTargetLink {
  target_id: string;
  target_name: string;
  target_imei: string;
  url: string;
  expires_at: string;
}

type BulkProcessType =
  | 'installation'
  | 'expiration'
  | 'renewal'
  | 'technician_change'
  | 'installation_details_change'
  | 'gps_model_change'
  | 'sim_type_change';

interface BulkProcessOption {
  value: BulkProcessType;
  labelKey: string;
  icon: string;
}

interface BulkProcessResult {
  target_id: string;
  target_name: string;
  target_imei: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
}

interface BulkProcessChange {
  update: UpdateTargetDto;
  before: Record<string, any>;
  after: Record<string, any>;
  details: string;
}

interface ManualAlertOption {
  type: AlertEngine;
  label: string;
  description: string;
  icon: string;
}

interface AquilesChatMessage extends SupportAssistantMessage {
  id: number;
  createdAt: Date;
}

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
  standalone: false
})
export class NavbarComponent implements OnInit, OnDestroy {
  items: MenuItem[] = [];
  selectedActionItems: MenuItem[] = [];
  userMenuItems: MenuItem[] = [];
  languageItems: MenuItem[] = [];
  loadingTheme: boolean = false;
  currentTheme: string = 'light';
  currentUser: any;

  // Control de suscripciones
  private destroy$ = new Subject<void>();
  private searchCanceledSubject$ = new Subject<string>();

  // Estado de la selección
  selectedTargetsCount: number = 0;
  hasSelectedTargets: boolean = false;

  // Control de visibilidad del botón cancelados
  showCanceledButton: boolean = false;

  // Drawer de objetivos cancelados
  canceledDrawerVisible: boolean = false;
  canceledTargets: Target[] = [];
  loadingCanceledTargets: boolean = false;

  // Paginación para targets cancelados
  canceledTargetsOffset: number = 0;
  canceledTargetsPageSize: number = 20;
  totalCanceledTargetsCount: number = 0;
  hasMoreCanceledTargets: boolean = true;
  loadingMoreCanceledTargets: boolean = false;
  lastLoadedParentId: string | null = null;

  // Búsqueda de objetivos cancelados
  canceledSearchTerm: string = '';
  canceledSearchResults: Target[] = [];
  isSearchingCanceled: boolean = false;

  // Filtro por fecha de activación
  canceledDateFrom: Date | null = null;
  canceledDateTo: Date | null = null;

  // Filtro por fecha de última modificación
  canceledModDateFrom: Date | null = null;
  canceledModDateTo: Date | null = null;

  // Filtro por compañía de SIM
  canceledSimCompany: string = '';

  // Toggle para mostrar/ocultar filtros
  showCanceledFilters: boolean = false;
  showActivationDateFilter: boolean = false;
  showModDateFilter: boolean = false;

  // Contador de filtros activos
  get activeFilterCount(): number {
    let count = 0;
    if (this.canceledDateFrom) count++;
    if (this.canceledDateTo) count++;
    if (this.canceledModDateFrom) count++;
    if (this.canceledModDateTo) count++;
    if (this.canceledSimCompany) count++;
    return count;
  }

  // Modal de detalles del target
  targetDetailsVisible: boolean = false;
  selectedTargetDetails: Target | null = null;
  targetProcesses: any[] = [];
  loadingTargetProcesses: boolean = false;

  // Modal de compartir targets
  shareMethodDialogVisible: boolean = false;
  shareDialogVisible: boolean = false;
  newEmailInput: string = '';
  selectedEmails: string[] = [];
  targetsToShare: Target[] = [];
  emailInputError: string = '';
  loadingSharedEmails: boolean = false;
  verifyingShareRecipient: boolean = false;
  autoSaving: boolean = false;
  realtimeLinkDialogVisible: boolean = false;
  realtimeExpirationTime: string = '24h';
  realtimeGeneratedLink: string = '';
  realtimeGeneratedLinks: RealtimeGeneratedTargetLink[] = [];
  realtimeCopySuccess: boolean = false;
  generatingRealtimeLink: boolean = false;

  // Modal de procesos masivos para objetivos seleccionados
  bulkProcessDialogVisible: boolean = false;
  bulkProcessCatalogLoading: boolean = false;
  applyingBulkProcess: boolean = false;
  bulkProcessProgress: number = 0;
  bulkProcessResults: BulkProcessResult[] = [];
  bulkProcessTechnicians: Array<{ label: string; value: string }> = [];
  bulkProcessGpsModels: Array<{ label: string; value: string }> = [];
  readonly bulkProcessSimTypes = [...SIM_CARD_TYPES];
  readonly bulkProcessOptions: BulkProcessOption[] = [
    {
      value: 'installation',
      labelKey: 'management.targetForm.processTypeInstallationDateChange',
      icon: 'pi pi-calendar'
    },
    {
      value: 'expiration',
      labelKey: 'management.targetForm.processTypeExpirationDateChange',
      icon: 'pi pi-calendar-times'
    },
    {
      value: 'renewal',
      labelKey: 'management.targetForm.processTypeServiceRenewal',
      icon: 'pi pi-refresh'
    },
    {
      value: 'technician_change',
      labelKey: 'management.targetForm.processTypeTechnicianChange',
      icon: 'pi pi-user-edit'
    },
    {
      value: 'installation_details_change',
      labelKey: 'management.targetForm.processTypeInstallationDetailsChange',
      icon: 'pi pi-file-edit'
    },
    {
      value: 'gps_model_change',
      labelKey: 'management.targetForm.processTypeGpsModelChange',
      icon: 'pi pi-wifi'
    },
    {
      value: 'sim_type_change',
      labelKey: 'management.targetForm.processTypeSimTypeChange',
      icon: 'pi pi-credit-card'
    }
  ];
  bulkProcessForm: {
    type: BulkProcessType | '';
    registrationDate: string;
    description: string;
    newInstallationDate: string;
    newExpirationDate: string;
    renewalYears: number | null;
    newTechnician: string;
    newInstallationDetails: string;
    newGpsModel: string;
    newSimType: string;
  } = {
    type: '',
    registrationDate: this.getLocalDateInputValue(),
    description: '',
    newInstallationDate: '',
    newExpirationDate: '',
    renewalYears: 1,
    newTechnician: '',
    newInstallationDetails: '',
    newGpsModel: '',
    newSimType: ''
  };

  // Modal de alertas
  alertsDialogVisible: boolean = false;
  speedAlertDialogVisible: boolean = false;
  perimeterAlertDialogVisible: boolean = false;
  readonly alertPresetCategories = ALERT_PRESET_CATEGORIES;
  readonly alertPresets = ALERT_PRESETS;
  readonly manualAlertOptions: ManualAlertOption[] = [
    { type: 'speed', label: 'Velocidad personalizada', description: 'Define un límite exacto en km/h.', icon: 'pi pi-gauge' },
    { type: 'perimeter', label: 'Zona personalizada', description: 'Dibuja un perímetro de entrada o salida.', icon: 'pi pi-map-marker' },
    { type: 'ignition', label: 'Encendido personalizado', description: 'Elige si avisar al encender o apagar.', icon: 'pi pi-power-off' },
    { type: 'movement', label: 'Movimiento personalizado', description: 'Avisa al detectar movimiento.', icon: 'pi pi-arrows-alt' },
    { type: 'connection', label: 'Conexión personalizada', description: 'Avisa al conectar o desconectar el GPS.', icon: 'pi pi-wifi' },
  ];
  alertPresetCategory: 'all' | AlertPresetCategory = 'all';
  alertPresetView: 'available' | 'premium' = 'available';
  alertPresetSearch = '';
  activeAlertPreset: AlertPresetCard | null = null;
  alertScheduleStart = '';
  alertScheduleEnd = '';
  perimeterRadiusMeters = 150;
  alertAdvancedOptionsVisible = false;
  alertHistoryVisible = false;
  currentSelectedTargets: Target[] = [];
  maxSpeedValue: number | null = null;
  creatingAlert: boolean = false;
  notificationEmail: string = '';
  notificationEmailUserId: string | null = null;
  verifyingNotificationEmail: boolean = false;
  deletingAlertId: string | null = null;
  speedAlerts: AlertResponse[] = [];
  visibleSpeedAlerts: AlertResponse[] = [];
  loadingSpeedAlerts: boolean = false;
  togglingAlertId: string | null = null;
  speedAlertMessage: string = '';
  speedAlertFiveHourLimit: boolean = false;

  // Perimeter alert variables
  perimeterNotificationTrigger: string = 'enter';
  perimeterNotificationEmail: string = '';
  perimeterNotificationEmailUserId: string | null = null;
  perimeterNotificationMessage: string = '';
  verifyingPerimeterNotificationEmail: boolean = false;
  creatingPerimeterAlert: boolean = false;

  // Perimeter alerts list
  perimeterAlerts: AlertResponse[] = [];
  loadingPerimeterAlerts: boolean = false;
  visiblePerimeterAlerts: AlertResponse[] = [];
  togglingPerimeterAlertId: string | null = null;
  deletingPerimeterAlertId: string | null = null;

  // Perimeter alert edit mode
  editingPerimeterAlertId: string | null = null;
  editingPerimeterCoordinates: any[] = [];
  savingPerimeterAlert: boolean = false;

  /**
   * Entra en modo de edición para una alerta de perímetro
   */
  editPerimeterAlert(alert: AlertResponse): void {
    this.editingPerimeterAlertId = alert._id;
    this.editingPerimeterCoordinates = [...(alert.config?.['coordinates'] || [])];

    // Cargar el trigger (entrada/salida) desde la configuración de la alerta
    this.perimeterNotificationTrigger = alert.config?.['trigger'] || 'enter';
    this.perimeterNotificationMessage = alert.config?.['message'] || '';

    // Cargar el email de notificación si existe
    const userTopic = alert.userTopic;
    if (userTopic && typeof userTopic === 'object' && 'email' in userTopic) {
      this.perimeterNotificationEmail = userTopic.email || '';
      this.perimeterNotificationEmailUserId = userTopic._id || null;
    } else {
      this.perimeterNotificationEmail = '';
      this.perimeterNotificationEmailUserId = null;
    }

    // Dibujar el perímetro existente en el mapa para edición
    if (this.mapAlertComponent && this.editingPerimeterCoordinates.length >= 3) {
      setTimeout(() => {
        this.mapAlertComponent.setPerimeter(this.editingPerimeterCoordinates);
      }, 100);
    }

    this.messageService.add({
      severity: 'info',
      summary: 'Modo de edición',
      detail: 'Modifica el perímetro en el mapa arrastrando los puntos o dibuja uno nuevo'
    });
  }

  /**
   * Guarda los cambios de una alerta de perímetro editada
   */
  async savePerimeterAlert(): Promise<void> {
    if (!this.editingPerimeterAlertId) return;

    // Obtener las coordenadas actuales del mapa
    const updatedCoordinates = this.mapAlertComponent?.getPolygonCoordinates();

    if (!updatedCoordinates || updatedCoordinates.length < 3) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('common.warning'),
        detail: 'Debes dibujar un perímetro válido con al menos 3 puntos'
      });
      return;
    }

    this.savingPerimeterAlert = true;
    try {
      await firstValueFrom(
        this.alertsService.updateAlert(this.editingPerimeterAlertId, {
          config: {
            coordinates: updatedCoordinates,
            trigger: this.perimeterNotificationTrigger,
            message: this.perimeterNotificationMessage?.trim() || ''
          },
          userTopic: this.perimeterNotificationEmailUserId || undefined,
        })
      );

      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('common.success'),
        detail: 'Alerta de perímetro actualizada correctamente'
      });

      this.cancelPerimeterEdit();
      await this.loadPerimeterAlerts();
    } catch (error) {
      console.error('Error updating perimeter alert:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail: getApiErrorMessage(error, 'Error al actualizar la alerta')
      });
    } finally {
      this.savingPerimeterAlert = false;
    }
  }

  /**
   * Cancela el modo de edición de alerta de perímetro
   */
  cancelPerimeterEdit(): void {
    this.editingPerimeterAlertId = null;
    this.editingPerimeterCoordinates = [];
    this.perimeterNotificationMessage = '';
    this.resetPerimeterNotificationEmail();

    // Limpiar el perímetro del mapa
    if (this.mapAlertComponent) {
      this.mapAlertComponent.clearPerimeter();
    }
  }

  // Ignition alert variables
  ignitionAlertDialogVisible: boolean = false;
  ignitionTrigger: string = 'on';
  ignitionNotificationEmail: string = '';
  ignitionNotificationEmailUserId: string | null = null;
  verifyingIgnitionNotificationEmail: boolean = false;
  creatingIgnitionAlert: boolean = false;

  // Ignition alerts list
  ignitionAlerts: AlertResponse[] = [];
  loadingIgnitionAlerts: boolean = false;
  visibleIgnitionAlerts: AlertResponse[] = [];
  togglingIgnitionAlertId: string | null = null;
  deletingIgnitionAlertId: string | null = null;
  ignitionAlertMessage: string = '';
  ignitionAlertFiveHourLimit: boolean = false;

  // Movement alert variables
  movementAlertDialogVisible: boolean = false;
  movementNotificationEmail: string = '';
  movementNotificationEmailUserId: string | null = null;
  verifyingMovementNotificationEmail: boolean = false;
  creatingMovementAlert: boolean = false;

  // Movement alerts list
  movementAlerts: AlertResponse[] = [];
  loadingMovementAlerts: boolean = false;
  visibleMovementAlerts: AlertResponse[] = [];
  togglingMovementAlertId: string | null = null;
  deletingMovementAlertId: string | null = null;
  movementAlertMessage: string = '';

  // Connection alert variables
  connectionAlertDialogVisible: boolean = false;
  connectionAlertType: 'online' | 'offline' = 'online';
  connectionNotificationEmail: string = '';
  connectionNotificationEmailUserId: string | null = null;
  verifyingConnectionNotificationEmail: boolean = false;
  creatingConnectionAlert: boolean = false;

  // Connection alerts list
  connectionAlerts: AlertResponse[] = [];
  loadingConnectionAlerts: boolean = false;
  visibleConnectionAlerts: AlertResponse[] = [];
  togglingConnectionAlertId: string | null = null;
  deletingConnectionAlertId: string | null = null;
  connectionAlertMessage: string = '';
  connectionAlertFiveHourLimit: boolean = false;

  // Modal de transferir targets
  transferDialogVisible: boolean = false;
  transferEmailInput: string = '';
  transferEmailError: string = '';
  targetsToTransfer: Target[] = [];
  foundUser: User | null = null;
  searchingUser: boolean = false;
  transferring: boolean = false;

  // Referencias a elementos del DOM
  @ViewChild('transferEmailRef') transferEmailRef!: ElementRef<HTMLInputElement>;
  @ViewChild(MapAlertComponent) mapAlertComponent!: MapAlertComponent;

  // Mapeo de tipos de proceso a números
  private processTypeMap: { [key: string]: number } = {
    'restoration': 16, // Nuevo tipo de proceso para restauración
    'deletion': 17 // Nuevo tipo de proceso para eliminación permanente
  };

  // Notificaciones
  notificationsDialogVisible: boolean = false;
  notifications: NotificationLog[] = [];
  loadingNotifications: boolean = false;

  // Soporte técnico
  supportDialogVisible: boolean = false;
  savingTicket: boolean = false;
  newTicket: CreateTicketDto = {
    title: '',
    description: '',
    priority: 'medium'
  };
  priorities: any[] = [];
  activeSupportTab: 'create' | 'list' = 'create';
  userTickets: Ticket[] = [];
  loadingTickets: boolean = false;
  supportChatMessages: AquilesChatMessage[] = [];
  supportChatInput: string = '';
  supportAssistantThinking: boolean = false;
  floatingAquilesVisible: boolean = false;
  supportDiagnosticCapture: SupportDiagnosticCapture | null = null;
  capturingSupportDiagnostics: boolean = false;
  private supportChatMessageSequence: number = 0;
  private supportDiagnosticRequestSequence: number = 0;
  private supportCaptureRequestSequence: number = 0;
  private lastSupportUserAction: string = '';
  private supportGreetingTimeout?: ReturnType<typeof setTimeout>;
  private readonly supportGreetingDelayMs = 1200;
  @ViewChild('supportChatScroll') supportChatScroll?: ElementRef<HTMLDivElement>;
  @ViewChild('floatingSupportChatScroll') floatingSupportChatScroll?: ElementRef<HTMLDivElement>;

  // Chat flotante de conversaciones asignadas
  assignedCommunicationChats: AssignedCommunicationChat[] = [];
  floatingCommunicationVisible: boolean = false;
  selectedFloatingCommunicationChat: AssignedCommunicationChat | null = null;
  floatingCommunicationMessages: FloatingCommunicationMessage[] = [];
  floatingCommunicationInput: string = '';
  loadingFloatingCommunication: boolean = false;
  loadingOlderFloatingCommunication: boolean = false;
  floatingCommunicationHasOlder: boolean = true;
  floatingCommunicationOlderError: string = '';
  sendingFloatingCommunication: boolean = false;
  floatingCommunicationError: string = '';
  private floatingCommunicationRequestSequence: number = 0;
  private floatingCommunicationFallbackChat: AssignedCommunicationChat | null = null;
  private readonly floatingCommunicationPageSize: number = 20;
  private floatingCommunicationPinnedToBottom: boolean = true;
  private floatingCommunicationLastScrollTop: number = 0;
  private readonly floatingCommunicationAvatarErrors = new Set<string>();
  @ViewChild('floatingCommunicationScroll') floatingCommunicationScroll?: ElementRef<HTMLDivElement>;

  // Chat flotante de grupos de instalación por técnico
  floatingTechniciansVisible: boolean = false;
  floatingInternalGroupType: 'installation' | 'admin' = 'installation';
  floatingTechnicianGroups: InternalChatGroup[] = [];
  selectedFloatingTechnicianGroup: InternalChatGroup | null = null;
  floatingTechnicianMessages: InternalChatMessage[] = [];
  floatingTechnicianInput: string = '';
  loadingFloatingTechnicianGroups: boolean = false;
  loadingFloatingTechnicianMessages: boolean = false;
  loadingOlderFloatingTechnicianMessages: boolean = false;
  floatingTechnicianHasOlder: boolean = true;
  floatingTechnicianOlderError: string = '';
  sendingFloatingTechnicianMessage: boolean = false;
  floatingTechnicianError: string = '';
  private floatingTechnicianRequestSequence: number = 0;
  private floatingTechnicianPollingInterval?: ReturnType<typeof setInterval>;
  private floatingTechnicianScrollTimeout?: ReturnType<typeof setTimeout>;
  private floatingTechnicianScrollSequence: number = 0;
  private readonly floatingTechnicianPageSize: number = 20;
  private floatingTechnicianPinnedToBottom: boolean = true;
  private floatingTechnicianLastScrollTop: number = 0;
  private readonly floatingTechnicianAvatarErrors = new Set<string>();
  @ViewChild('floatingTechnicianScroll') floatingTechnicianScroll?: ElementRef<HTMLDivElement>;

  get isFloatingAdminChat(): boolean {
    return this.floatingInternalGroupType === 'admin';
  }

  // Detalles del ticket
  ticketDetailsDialogVisible: boolean = false;
  selectedTicket: Ticket | null = null;
  private returnToSupportAfterTicketDetails: boolean = false;

  openTicketDetails(ticket: Ticket) {
    this.returnToSupportAfterTicketDetails = this.supportDialogVisible;
    this.supportDialogVisible = false;
    this.selectedTicket = ticket;
    this.ticketDetailsDialogVisible = true;
  }

  onTicketDetailsHidden(): void {
    if (!this.returnToSupportAfterTicketDetails) return;
    this.returnToSupportAfterTicketDetails = false;
    this.activeSupportTab = 'list';
    this.supportDialogVisible = true;
  }

  get activeTicketsCount(): number {
    return this.userTickets.filter(ticket =>
      ticket.status === 'open' || ticket.status === 'in_progress'
    ).length;
  }

  get completedTicketsCount(): number {
    return this.userTickets.filter(ticket =>
      ticket.status === 'resolved' || ticket.status === 'closed'
    ).length;
  }

  get supportResolutionRate(): number {
    if (!this.userTickets.length) return 0;
    return Math.round((this.completedTicketsCount / this.userTickets.length) * 100);
  }

  getTicketProgress(status: Ticket['status']): number {
    switch (status) {
      case 'open': return 20;
      case 'in_progress': return 60;
      case 'resolved':
      case 'closed': return 100;
      default: return 0;
    }
  }

  getTicketStatusIcon(status: Ticket['status']): string {
    switch (status) {
      case 'open': return 'pi pi-inbox';
      case 'in_progress': return 'pi pi-spin pi-spinner';
      case 'resolved': return 'pi pi-check-circle';
      case 'closed': return 'pi pi-lock';
      default: return 'pi pi-circle';
    }
  }

  getPriorityClass(priority: Ticket['priority']): string {
    return `ticket-priority-${priority}`;
  }

  trackTicketById(_index: number, ticket: Ticket): string {
    return ticket._id || `${ticket.title}-${ticket.createdAt || ''}`;
  }

  initializePriorities() {
    this.priorities = [
      { label: this.translate.instant('support.priorities.low'), value: 'low' },
      { label: this.translate.instant('support.priorities.medium'), value: 'medium' },
      { label: this.translate.instant('support.priorities.high'), value: 'high' },
      { label: this.translate.instant('support.priorities.critical'), value: 'critical' }
    ];
  }

  openNotificationsModal() {
    this.notificationsDialogVisible = true;
    this.loadNotifications();
  }

  loadNotifications() {
    this.loadingNotifications = true;
    this.firebaseNotificationsService.getMyNotifications().subscribe({
      next: (notifications) => {
        this.notifications = notifications;
        this.loadingNotifications = false;
      },
      error: (error) => {
        console.error('Error loading notifications', error);
        this.loadingNotifications = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: getApiErrorMessage(error, 'No se pudieron cargar las notificaciones')
        });
      }
    });
  }

  openSupportModal() {
    this.activeSupportTab = 'list';
    this.floatingAquilesVisible = false;
    this.floatingCommunicationVisible = false;
    this.closeFloatingTechnicians();
    this.supportDialogVisible = true;
    this.loadUserTickets();
  }

  openFloatingAquiles(): void {
    if (!this.supportChatMessages.length) {
      this.resetSupportChat();
    }
    this.supportDialogVisible = false;
    this.floatingCommunicationVisible = false;
    this.closeFloatingTechnicians();
    this.activeSupportTab = 'create';
    this.floatingAquilesVisible = true;
    this.scrollSupportChatToBottom();
  }

  closeFloatingAquiles(): void {
    this.floatingAquilesVisible = false;
  }

  expandFloatingAquiles(): void {
    this.floatingAquilesVisible = false;
    this.activeSupportTab = 'list';
    this.supportDialogVisible = true;
    this.loadUserTickets();
  }

  openFloatingCommunication(
    conversationId?: number | null,
    fallbackChat?: AssignedCommunicationChat | null,
  ): void {
    const requestedId = Number(conversationId || 0);
    const chat = this.assignedCommunicationChats.find(
      item => item.conversationId === requestedId,
    ) || (
      fallbackChat?.conversationId === requestedId
        ? fallbackChat
        : null
    ) || this.assignedCommunicationChats[0];
    if (!chat) return;
    this.floatingCommunicationFallbackChat = this.assignedCommunicationChats.some(
      item => item.conversationId === chat.conversationId,
    ) ? null : chat;
    this.floatingAquilesVisible = false;
    this.supportDialogVisible = false;
    this.closeFloatingTechnicians();
    this.floatingCommunicationVisible = true;
    this.selectFloatingCommunicationChat(chat, true);
  }

  closeFloatingCommunication(): void {
    this.floatingCommunicationVisible = false;
    this.floatingCommunicationFallbackChat = null;
    this.floatingCommunicationRequestSequence += 1;
    this.loadingOlderFloatingCommunication = false;
    this.floatingCommunicationLastScrollTop = 0;
  }

  get floatingCommunicationChatTabs(): AssignedCommunicationChat[] {
    const selected = this.selectedFloatingCommunicationChat;
    if (
      !selected
      || this.assignedCommunicationChats.some(
        chat => chat.conversationId === selected.conversationId,
      )
    ) {
      return this.assignedCommunicationChats;
    }
    return [selected, ...this.assignedCommunicationChats];
  }

  expandFloatingCommunication(): void {
    const conversationId = this.selectedFloatingCommunicationChat?.conversationId;
    this.closeFloatingCommunication();
    if (!conversationId) return;
    void this.router.navigate([
      '/admin/communication',
      'chat',
      conversationId,
    ]);
  }

  selectFloatingCommunicationChat(
    chat: AssignedCommunicationChat,
    forceReload = false,
  ): void {
    if (!chat?.conversationId) return;
    const changed = this.selectedFloatingCommunicationChat?.conversationId
      !== chat.conversationId;
    this.selectedFloatingCommunicationChat = chat;
    if (changed) {
      this.floatingCommunicationMessages = [];
      this.floatingCommunicationError = '';
      this.floatingCommunicationOlderError = '';
      this.floatingCommunicationHasOlder = true;
      this.floatingCommunicationPinnedToBottom = true;
      this.floatingCommunicationLastScrollTop = 0;
    }
    this.communicationNotifications.markWhatsAppConversationRead(chat.conversationId);
    if (changed || forceReload || !this.floatingCommunicationMessages.length) {
      this.loadFloatingCommunicationMessages();
    }
  }

  sendFloatingCommunicationMessage(): void {
    const chat = this.selectedFloatingCommunicationChat;
    const message = this.floatingCommunicationInput.trim();
    if (!chat || !message || this.sendingFloatingCommunication) return;

    const optimisticMessage: FloatingCommunicationMessage = {
      id: `local-${Date.now()}`,
      from: 'me',
      text: message,
      createdAt: new Date(),
      authorName: 'Tú',
      isCurrentUser: true,
      attachments: [],
      transcription: '',
    };
    this.floatingCommunicationMessages = [
      ...this.floatingCommunicationMessages,
      optimisticMessage,
    ];
    this.floatingCommunicationInput = '';
    this.sendingFloatingCommunication = true;
    this.floatingCommunicationError = '';
    this.scrollFloatingCommunicationToBottom();

    const firstName = String(this.currentUser?.name || 'Agente')
      .trim()
      .split(/\s+/)[0] || 'Agente';
    const apiMessage = `> ${firstName}\n${message.replace(/[¿¡]/g, '')}`;
    this.whatsappApi.sendConversationMessage(
      chat.conversationId,
      apiMessage,
      undefined,
      undefined,
      String(this.currentUser?.id || ''),
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          this.sendingFloatingCommunication = false;
          if (response?.success === false) {
            this.floatingCommunicationMessages = [
              ...this.floatingCommunicationMessages.filter(
                item => item.id !== optimisticMessage.id,
              ),
              {
                id: `error-${Date.now()}`,
                from: 'system',
                text: getApiErrorMessage(response, 'No se pudo enviar el mensaje'),
                createdAt: new Date(),
                authorName: '',
                isCurrentUser: false,
                attachments: [],
                transcription: '',
              },
            ];
            this.scrollFloatingCommunicationToBottom();
            return;
          }
          this.scrollFloatingCommunicationToBottom();
        },
        error: error => {
          this.sendingFloatingCommunication = false;
          this.floatingCommunicationMessages = [
            ...this.floatingCommunicationMessages.filter(
              item => item.id !== optimisticMessage.id,
            ),
            {
              id: `error-${Date.now()}`,
              from: 'system',
              text: getApiErrorMessage(error, 'No se pudo enviar el mensaje'),
              createdAt: new Date(),
              authorName: '',
              isCurrentUser: false,
              attachments: [],
              transcription: '',
            },
          ];
          this.scrollFloatingCommunicationToBottom();
        },
      });
  }

  onFloatingCommunicationKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    this.sendFloatingCommunicationMessage();
  }

  getFloatingCommunicationInitials(chat?: AssignedCommunicationChat | null): string {
    const name = String(chat?.contactName || '').trim();
    if (!name) return '??';
    return name.split(/\s+/).slice(0, 2)
      .map(part => part.charAt(0).toUpperCase()).join('');
  }

  hasFloatingCommunicationAvatar(chat?: AssignedCommunicationChat | null): boolean {
    const avatar = String(chat?.avatar || '').trim();
    return !!avatar && !this.floatingCommunicationAvatarErrors.has(avatar);
  }

  onFloatingCommunicationAvatarError(chat?: AssignedCommunicationChat | null): void {
    const avatar = String(chat?.avatar || '').trim();
    if (avatar) this.floatingCommunicationAvatarErrors.add(avatar);
  }

  shouldShowFloatingCommunicationDate(index: number): boolean {
    return shouldShowChatDateSeparator(
      this.floatingCommunicationMessages[index]?.createdAt,
      this.floatingCommunicationMessages[index - 1]?.createdAt,
    );
  }

  formatFloatingCommunicationDate(value: Date): string {
    return formatChatTimelineDate(value);
  }

  trackAssignedCommunicationChat(
    _index: number,
    chat: AssignedCommunicationChat,
  ): number {
    return chat.conversationId;
  }

  trackFloatingCommunicationMessage(
    _index: number,
    message: FloatingCommunicationMessage,
  ): number | string {
    return message.id;
  }

  isFloatingCommunicationImage(attachment: FloatingCommunicationAttachment): boolean {
    return attachment.fileType === 'image';
  }

  isFloatingCommunicationVideo(attachment: FloatingCommunicationAttachment): boolean {
    return attachment.fileType === 'video';
  }

  isFloatingCommunicationAudio(attachment: FloatingCommunicationAttachment): boolean {
    return attachment.fileType === 'audio';
  }

  isFloatingCommunicationPdf(attachment: FloatingCommunicationAttachment): boolean {
    return attachment.mimeType === 'application/pdf'
      || attachment.name.toLowerCase().endsWith('.pdf');
  }

  getFloatingCommunicationAttachmentType(attachment: FloatingCommunicationAttachment): string {
    if (this.isFloatingCommunicationPdf(attachment)) return 'Documento PDF';
    if (attachment.mimeType) return attachment.mimeType;
    return 'Archivo';
  }

  onFloatingCommunicationMediaReady(): void {
    if (this.floatingCommunicationPinnedToBottom) {
      this.scrollFloatingCommunicationToBottom();
    }
  }

  onFloatingCommunicationScroll(event: Event): void {
    const element = event.currentTarget as HTMLElement | null;
    if (!element) return;
    const scrollTop = Math.max(0, element.scrollTop);
    const isScrollingUp = scrollTop < this.floatingCommunicationLastScrollTop - 1;
    this.floatingCommunicationLastScrollTop = scrollTop;
    this.floatingCommunicationPinnedToBottom = this.isFloatingChatNearBottom(element);
    if (isScrollingUp && scrollTop <= 80) {
      this.loadOlderFloatingCommunicationMessages();
    }
  }

  loadOlderFloatingCommunicationMessages(): void {
    const conversationId = this.selectedFloatingCommunicationChat?.conversationId;
    if (
      !conversationId
      || this.loadingFloatingCommunication
      || this.loadingOlderFloatingCommunication
      || !this.floatingCommunicationHasOlder
      || !this.floatingCommunicationMessages.length
    ) return;

    const oldestMessageId = this.floatingCommunicationMessages
      .map(message => typeof message.id === 'number' ? message.id : Number.NaN)
      .find(id => Number.isFinite(id) && id > 0);
    if (!oldestMessageId) {
      this.floatingCommunicationHasOlder = false;
      return;
    }

    const requestId = this.floatingCommunicationRequestSequence;
    const element = this.floatingCommunicationScroll?.nativeElement;
    const previousScrollHeight = element?.scrollHeight || 0;
    const previousScrollTop = element?.scrollTop || 0;
    this.loadingOlderFloatingCommunication = true;
    this.floatingCommunicationOlderError = '';
    this.floatingCommunicationPinnedToBottom = false;

    this.whatsappApi.getConversationMessages(
      conversationId,
      this.floatingCommunicationPageSize,
      oldestMessageId,
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          if (
            requestId !== this.floatingCommunicationRequestSequence
            || conversationId !== this.selectedFloatingCommunicationChat?.conversationId
          ) return;
          this.loadingOlderFloatingCommunication = false;
          if (response?.success === false) {
            this.floatingCommunicationOlderError = getApiErrorMessage(
              response,
              'No se pudieron cargar los mensajes anteriores',
            );
            return;
          }

          const rawMessages = Array.isArray(response?.messages) ? response.messages : [];
          const existingIds = new Set(this.floatingCommunicationMessages.map(message => String(message.id)));
          const olderMessages: FloatingCommunicationMessage[] = rawMessages
            .map((message: any) => mapFloatingCommunicationMessage(
              message,
              this.currentUser,
              this.selectedFloatingCommunicationChat?.contactName || 'Contacto',
            ))
            .filter((message: FloatingCommunicationMessage) => !existingIds.has(String(message.id)));
          this.floatingCommunicationMessages = [
            ...olderMessages,
            ...this.floatingCommunicationMessages,
          ];
          this.floatingCommunicationHasOlder = rawMessages.length >= this.floatingCommunicationPageSize;
          setTimeout(() => {
            const currentElement = this.floatingCommunicationScroll?.nativeElement;
            if (!currentElement || conversationId !== this.selectedFloatingCommunicationChat?.conversationId) return;
            const restoredScrollTop = currentElement.scrollHeight
              - previousScrollHeight
              + previousScrollTop;
            currentElement.scrollTop = restoredScrollTop;
            this.floatingCommunicationLastScrollTop = restoredScrollTop;
          });
        },
        error: error => {
          if (requestId !== this.floatingCommunicationRequestSequence) return;
          this.loadingOlderFloatingCommunication = false;
          this.floatingCommunicationOlderError = getApiErrorMessage(
            error,
            'No se pudieron cargar los mensajes anteriores',
          );
        },
      });
  }

  private loadFloatingCommunicationMessages(replaceMessages = true): void {
    const conversationId = this.selectedFloatingCommunicationChat?.conversationId;
    if (!conversationId) return;
    const requestId = ++this.floatingCommunicationRequestSequence;
    this.loadingOlderFloatingCommunication = false;
    if (replaceMessages) {
      this.loadingFloatingCommunication = true;
      this.floatingCommunicationError = '';
      this.floatingCommunicationOlderError = '';
    }

    this.whatsappApi.getConversationMessages(
      conversationId,
      this.floatingCommunicationPageSize,
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          if (
            requestId !== this.floatingCommunicationRequestSequence
            || this.selectedFloatingCommunicationChat?.conversationId !== conversationId
          ) return;
          this.loadingFloatingCommunication = false;
          if (response?.success === false) {
            this.floatingCommunicationError = getApiErrorMessage(
              response,
              'No se pudieron cargar los mensajes',
            );
            return;
          }
          const messages = Array.isArray(response?.messages) ? response.messages : [];
          const mappedMessages: FloatingCommunicationMessage[] = messages.map((message: any) =>
            mapFloatingCommunicationMessage(
              message,
              this.currentUser,
              this.selectedFloatingCommunicationChat?.contactName || 'Contacto',
            )
          );
          const wasPinnedToBottom = this.floatingCommunicationPinnedToBottom;
          if (replaceMessages || !this.floatingCommunicationMessages.length) {
            this.floatingCommunicationMessages = mappedMessages;
            this.floatingCommunicationHasOlder = messages.length >= this.floatingCommunicationPageSize;
          } else {
            const latestById = new Map(mappedMessages.map(
              (message: FloatingCommunicationMessage) => [String(message.id), message],
            ));
            const retainedMessages = this.floatingCommunicationMessages.filter(message =>
              !latestById.has(String(message.id)),
            );
            this.floatingCommunicationMessages = [...retainedMessages, ...mappedMessages]
              .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
          }
          this.communicationNotifications.markWhatsAppConversationRead(conversationId);
          if (replaceMessages || wasPinnedToBottom) {
            this.scrollFloatingCommunicationToBottom();
          }
        },
        error: error => {
          if (requestId !== this.floatingCommunicationRequestSequence) return;
          this.loadingFloatingCommunication = false;
          this.floatingCommunicationError = getApiErrorMessage(
            error,
            'No se pudieron cargar los mensajes',
          );
        },
      });
  }

  private scrollFloatingCommunicationToBottom(): void {
    this.floatingCommunicationPinnedToBottom = true;
    const scroll = () => {
      const element = this.floatingCommunicationScroll?.nativeElement;
      if (element) {
        element.scrollTop = element.scrollHeight;
        this.floatingCommunicationLastScrollTop = element.scrollTop;
      }
    };
    setTimeout(scroll);
    setTimeout(scroll, 120);
  }

  private isFloatingChatNearBottom(element: HTMLElement): boolean {
    return element.scrollHeight - element.scrollTop - element.clientHeight <= 100;
  }

  openFloatingTechnicians(groupId?: string | null): void {
    this.openFloatingInternalChat('installation', groupId);
  }

  openFloatingAdmin(groupId?: string | null): void {
    this.openFloatingInternalChat('admin', groupId);
  }

  private openFloatingInternalChat(
    groupType: 'installation' | 'admin',
    groupId?: string | null,
  ): void {
    this.floatingAquilesVisible = false;
    this.floatingCommunicationVisible = false;
    this.supportDialogVisible = false;
    const modeChanged = this.floatingInternalGroupType !== groupType;
    if (modeChanged) {
      this.floatingInternalGroupType = groupType;
      this.floatingTechnicianRequestSequence += 1;
      this.stopFloatingTechnicianPolling();
      this.stopFloatingTechnicianAutoScroll();
      this.selectedFloatingTechnicianGroup = null;
      this.floatingTechnicianMessages = [];
      this.floatingTechnicianInput = '';
      this.floatingTechnicianError = '';
      this.floatingTechnicianOlderError = '';
      this.floatingTechnicianHasOlder = true;
      this.floatingTechnicianPinnedToBottom = true;
      this.floatingTechnicianLastScrollTop = 0;
    }
    this.floatingTechniciansVisible = true;
    this.loadFloatingTechnicianGroups(groupId || null, true);
  }

  closeFloatingTechnicians(): void {
    this.floatingTechniciansVisible = false;
    this.floatingTechnicianRequestSequence += 1;
    this.stopFloatingTechnicianPolling();
    this.stopFloatingTechnicianAutoScroll();
    this.loadingOlderFloatingTechnicianMessages = false;
    this.floatingTechnicianLastScrollTop = 0;
  }

  expandFloatingTechnicians(): void {
    const groupId = this.selectedFloatingTechnicianGroup?.id;
    this.closeFloatingTechnicians();
    void this.router.navigate(['/admin/communication', 'grupo'], {
      queryParams: groupId ? { groupId } : undefined,
    });
  }

  selectFloatingTechnicianGroup(
    group: InternalChatGroup,
    forceReload = false,
  ): void {
    if (!group?.id) return;
    const changed = this.selectedFloatingTechnicianGroup?.id !== group.id;
    this.selectedFloatingTechnicianGroup = group;
    if (changed) {
      this.floatingTechnicianMessages = [];
      this.floatingTechnicianInput = '';
      this.floatingTechnicianError = '';
      this.floatingTechnicianOlderError = '';
      this.floatingTechnicianHasOlder = true;
      this.floatingTechnicianPinnedToBottom = true;
      this.floatingTechnicianLastScrollTop = 0;
    }
    this.setFloatingTechnicianGroupRead(group.id);
    if (changed || forceReload || !this.floatingTechnicianMessages.length) {
      this.loadFloatingTechnicianMessages();
    }
  }

  sendFloatingTechnicianMessage(): void {
    const groupId = this.selectedFloatingTechnicianGroup?.id;
    const text = this.floatingTechnicianInput.trim();
    if (!groupId || !text || this.sendingFloatingTechnicianMessage) return;

    this.sendingFloatingTechnicianMessage = true;
    this.floatingTechnicianInput = '';
    this.floatingTechnicianError = '';
    this.internalChatService.sendMessage(text, [], 'text', groupId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          this.sendingFloatingTechnicianMessage = false;
          const message = response?.message;
          if (
            message
            && groupId === this.selectedFloatingTechnicianGroup?.id
            && !this.floatingTechnicianMessages.some(item => item._id === message._id)
          ) {
            this.floatingTechnicianMessages = [...this.floatingTechnicianMessages, message];
          }
          this.scrollFloatingTechnicianToBottom();
        },
        error: error => {
          this.sendingFloatingTechnicianMessage = false;
          if (groupId === this.selectedFloatingTechnicianGroup?.id) {
            this.floatingTechnicianInput = text;
          }
          this.floatingTechnicianError = getApiErrorMessage(
            error,
            this.isFloatingAdminChat
              ? 'No se pudo enviar el mensaje al grupo de empleados'
              : 'No se pudo enviar el mensaje al técnico',
          );
        },
      });
  }

  onFloatingTechnicianKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    this.sendFloatingTechnicianMessage();
  }

  getFloatingTechnicianGroupName(group?: InternalChatGroup | null): string {
    if (group?.type === 'admin') return 'Admin';
    const technicianName = `${group?.technician?.name || ''} ${group?.technician?.lastName || ''}`.trim();
    return technicianName
      || String(group?.name || '').replace(/^Instalaciones\s*-\s*/i, '').trim()
      || 'Técnico';
  }

  getFloatingTechnicianGroupInitials(group?: InternalChatGroup | null): string {
    return this.getFloatingChatInitials(this.getFloatingTechnicianGroupName(group));
  }

  hasFloatingTechnicianAvatar(group?: InternalChatGroup | null): boolean {
    const avatar = String(group?.technician?.photo || '').trim();
    return !!avatar && !this.floatingTechnicianAvatarErrors.has(avatar);
  }

  onFloatingTechnicianAvatarError(group?: InternalChatGroup | null): void {
    const avatar = String(group?.technician?.photo || '').trim();
    if (avatar) this.floatingTechnicianAvatarErrors.add(avatar);
  }

  isMyFloatingTechnicianMessage(message: InternalChatMessage): boolean {
    const currentUserId = String(this.currentUser?.id || this.currentUser?._id || '');
    return String(message?.author?._id || '') === currentUserId;
  }

  getFloatingTechnicianAuthorName(message: InternalChatMessage): string {
    const author = message?.author;
    return `${author?.name || ''} ${author?.last_name || ''}`.trim()
      || author?.email
      || 'Técnico';
  }

  getFloatingTechnicianAuthorInitials(message: InternalChatMessage): string {
    return this.getFloatingChatInitials(this.getFloatingTechnicianAuthorName(message));
  }

  openFloatingInternalMessageReference(message: InternalChatMessage): void {
    const conversationId = Number(message?.referenceConversationId || 0);
    if (!conversationId) return;

    const messageId = Number(message?.referenceMessageId || 0);
    this.closeFloatingTechnicians();
    void this.router.navigate(
      ['/admin/communication', 'chat', conversationId],
      {
        queryParams: messageId > 0 ? { messageId } : undefined,
      },
    );
  }

  shouldShowFloatingTechnicianDate(index: number): boolean {
    return shouldShowChatDateSeparator(
      this.floatingTechnicianMessages[index]?.createdAt,
      this.floatingTechnicianMessages[index - 1]?.createdAt,
    );
  }

  formatFloatingTechnicianDate(value: Date | string | number | null | undefined): string {
    return formatChatTimelineDate(value);
  }

  isFloatingTechnicianImage(attachment: InternalChatAttachment): boolean {
    const mimeType = String(attachment?.mimeType || '').toLowerCase();
    const url = String(attachment?.url || '').toLowerCase().split('?')[0];
    return mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/.test(url);
  }

  isFloatingTechnicianVideo(attachment: InternalChatAttachment): boolean {
    const mimeType = String(attachment?.mimeType || '').toLowerCase();
    const url = String(attachment?.url || '').toLowerCase().split('?')[0];
    return mimeType.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/.test(url);
  }

  isFloatingTechnicianAudio(attachment: InternalChatAttachment): boolean {
    const mimeType = String(attachment?.mimeType || '').toLowerCase();
    const url = String(attachment?.url || '').toLowerCase().split('?')[0];
    return attachment?.fileType === 'audio'
      || mimeType.startsWith('audio/')
      || /\.(mp3|m4a|aac|ogg|oga|wav|webm)$/.test(url);
  }

  getFloatingTechnicianAttachmentName(attachment: InternalChatAttachment): string {
    return attachment?.name || attachment?.url?.split('/').pop() || 'Archivo';
  }

  onFloatingTechnicianMediaReady(): void {
    if (!this.floatingTechniciansVisible) return;
    if (this.floatingTechnicianPinnedToBottom) {
      this.scrollFloatingTechnicianToBottom();
    }
  }

  onFloatingTechnicianScroll(event: Event): void {
    const element = event.currentTarget as HTMLElement | null;
    if (!element) return;
    const scrollTop = Math.max(0, element.scrollTop);
    const isScrollingUp = scrollTop < this.floatingTechnicianLastScrollTop - 1;
    this.floatingTechnicianLastScrollTop = scrollTop;
    this.floatingTechnicianPinnedToBottom = this.isFloatingChatNearBottom(element);
    if (isScrollingUp && scrollTop <= 80) {
      this.loadOlderFloatingTechnicianMessages();
    }
  }

  loadOlderFloatingTechnicianMessages(): void {
    const groupId = this.selectedFloatingTechnicianGroup?.id;
    const oldestMessageId = this.floatingTechnicianMessages[0]?._id;
    if (
      !groupId
      || !oldestMessageId
      || this.loadingFloatingTechnicianMessages
      || this.loadingOlderFloatingTechnicianMessages
      || !this.floatingTechnicianHasOlder
    ) return;

    const requestId = this.floatingTechnicianRequestSequence;
    const element = this.floatingTechnicianScroll?.nativeElement;
    const previousScrollHeight = element?.scrollHeight || 0;
    const previousScrollTop = element?.scrollTop || 0;
    this.loadingOlderFloatingTechnicianMessages = true;
    this.floatingTechnicianOlderError = '';
    this.floatingTechnicianPinnedToBottom = false;

    this.internalChatService.getMessages({
      limit: this.floatingTechnicianPageSize,
      before: oldestMessageId,
      groupId,
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          if (
            requestId !== this.floatingTechnicianRequestSequence
            || groupId !== this.selectedFloatingTechnicianGroup?.id
          ) return;
          this.loadingOlderFloatingTechnicianMessages = false;
          const existingIds = new Set(this.floatingTechnicianMessages.map(message => message._id));
          const olderMessages = (response?.messages || []).filter(
            message => !existingIds.has(message._id),
          );
          this.floatingTechnicianMessages = [
            ...olderMessages,
            ...this.floatingTechnicianMessages,
          ];
          this.floatingTechnicianHasOlder = this.floatingTechnicianMessages.length
            < Math.max(0, Number(response?.total || 0));
          setTimeout(() => {
            const currentElement = this.floatingTechnicianScroll?.nativeElement;
            if (!currentElement || groupId !== this.selectedFloatingTechnicianGroup?.id) return;
            const restoredScrollTop = currentElement.scrollHeight
              - previousScrollHeight
              + previousScrollTop;
            currentElement.scrollTop = restoredScrollTop;
            this.floatingTechnicianLastScrollTop = restoredScrollTop;
          });
        },
        error: error => {
          if (requestId !== this.floatingTechnicianRequestSequence) return;
          this.loadingOlderFloatingTechnicianMessages = false;
          this.floatingTechnicianOlderError = getApiErrorMessage(
            error,
            'No se pudieron cargar los mensajes anteriores',
          );
        },
      });
  }

  trackFloatingTechnicianGroup(_index: number, group: InternalChatGroup): string {
    return group.id;
  }

  trackFloatingTechnicianMessage(_index: number, message: InternalChatMessage): string {
    return message._id;
  }

  private loadFloatingTechnicianGroups(
    requestedGroupId: string | null = null,
    loadMessages = false,
    silent = false,
  ): void {
    if (!silent) this.loadingFloatingTechnicianGroups = true;
    this.internalChatService.getGroups()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          this.loadingFloatingTechnicianGroups = false;
          const allGroups = response?.groups || [];
          const groups = allGroups.filter(
            group => group.type === this.floatingInternalGroupType,
          );
          this.communicationNotifications.syncTechnicianPendingCount(
            allGroups
              .filter(group => group.type === 'installation')
              .reduce((total, group) => total + Math.max(0, Number(group.unreadCount) || 0), 0),
          );
          this.communicationNotifications.syncAdminPendingCount(
            allGroups
              .filter(group => group.type === 'admin')
              .reduce((total, group) => total + Math.max(0, Number(group.unreadCount) || 0), 0),
          );
          const previousId = this.selectedFloatingTechnicianGroup?.id || '';
          this.floatingTechnicianGroups = groups;

          const selected = groups.find(group => group.id === requestedGroupId)
            || groups.find(group => group.id === previousId)
            || groups[0]
            || null;
          const changed = selected?.id !== previousId;
          this.selectedFloatingTechnicianGroup = selected;

          if (!selected) {
            this.floatingTechnicianMessages = [];
            this.floatingTechnicianHasOlder = false;
            this.stopFloatingTechnicianPolling();
            return;
          }
          if (
            this.floatingTechniciansVisible
            && (loadMessages || changed || !this.floatingTechnicianMessages.length)
          ) {
            this.selectFloatingTechnicianGroup(selected, true);
          }
        },
        error: error => {
          this.loadingFloatingTechnicianGroups = false;
          if (this.floatingTechniciansVisible) {
            this.floatingTechnicianError = getApiErrorMessage(
              error,
              this.isFloatingAdminChat
                ? 'No se pudo cargar el chat administrativo'
                : 'No se pudieron cargar los chats de técnicos',
            );
          }
        },
      });
  }

  private loadFloatingTechnicianMessages(): void {
    const groupId = this.selectedFloatingTechnicianGroup?.id;
    if (!groupId) return;
    const requestId = ++this.floatingTechnicianRequestSequence;
    this.loadingOlderFloatingTechnicianMessages = false;
    this.loadingFloatingTechnicianMessages = true;
    this.floatingTechnicianError = '';

    this.internalChatService.getMessages({
      limit: this.floatingTechnicianPageSize,
      groupId,
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          if (
            requestId !== this.floatingTechnicianRequestSequence
            || groupId !== this.selectedFloatingTechnicianGroup?.id
          ) return;
          this.loadingFloatingTechnicianMessages = false;
          this.floatingTechnicianMessages = response?.messages || [];
          this.floatingTechnicianHasOlder = this.floatingTechnicianMessages.length
            < Math.max(0, Number(response?.total || 0));
          this.setFloatingTechnicianGroupRead(groupId);
          this.scrollFloatingTechnicianToBottom();
          this.startFloatingTechnicianPolling();
        },
        error: error => {
          if (requestId !== this.floatingTechnicianRequestSequence) return;
          this.loadingFloatingTechnicianMessages = false;
          this.floatingTechnicianError = getApiErrorMessage(
            error,
            this.isFloatingAdminChat
              ? 'No se pudieron cargar los mensajes administrativos'
              : 'No se pudieron cargar los mensajes del técnico',
          );
          this.stopFloatingTechnicianPolling();
        },
      });
  }

  private setFloatingTechnicianGroupRead(groupId: string): void {
    this.floatingTechnicianGroups = this.floatingTechnicianGroups.map(group =>
      group.id === groupId ? { ...group, unreadCount: 0 } : group,
    );
    const unreadCount = this.floatingTechnicianGroups.reduce(
      (total, group) => total + Math.max(0, Number(group.unreadCount) || 0),
      0,
    );
    if (this.isFloatingAdminChat) {
      this.communicationNotifications.syncAdminPendingCount(unreadCount);
    } else {
      this.communicationNotifications.syncTechnicianPendingCount(unreadCount);
    }
    this.internalChatService.markGroupRead(groupId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({ error: () => undefined });
  }

  private startFloatingTechnicianPolling(): void {
    this.stopFloatingTechnicianPolling();
    this.floatingTechnicianPollingInterval = setInterval(() => {
      if (!this.floatingTechniciansVisible) return;
      this.loadFloatingTechnicianGroups(null, false, true);
      const groupId = this.selectedFloatingTechnicianGroup?.id;
      if (!groupId) return;
      const lastId = this.floatingTechnicianMessages[this.floatingTechnicianMessages.length - 1]?._id;
      this.internalChatService.getMessages({ limit: 50, after: lastId, groupId })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: response => {
            if (groupId !== this.selectedFloatingTechnicianGroup?.id) return;
            const newMessages = (response?.messages || []).filter(
              message => !this.floatingTechnicianMessages.some(existing => existing._id === message._id),
            );
            if (!newMessages.length) return;
            const wasPinnedToBottom = this.floatingTechnicianPinnedToBottom;
            this.floatingTechnicianMessages = [...this.floatingTechnicianMessages, ...newMessages];
            this.setFloatingTechnicianGroupRead(groupId);
            if (wasPinnedToBottom) this.scrollFloatingTechnicianToBottom();
          },
          error: () => undefined,
        });
    }, 6000);
  }

  private stopFloatingTechnicianPolling(): void {
    if (!this.floatingTechnicianPollingInterval) return;
    clearInterval(this.floatingTechnicianPollingInterval);
    this.floatingTechnicianPollingInterval = undefined;
  }

  private scrollFloatingTechnicianToBottom(): void {
    this.floatingTechnicianPinnedToBottom = true;
    this.stopFloatingTechnicianAutoScroll();
    const sequence = ++this.floatingTechnicianScrollSequence;
    let previousHeight = -1;
    let stablePasses = 0;
    let attempts = 0;

    const scrollWhenStable = () => {
      if (sequence !== this.floatingTechnicianScrollSequence) return;
      const element = this.floatingTechnicianScroll?.nativeElement;
      if (!element || !this.floatingTechniciansVisible) return;

      const currentHeight = element.scrollHeight;
      element.scrollTop = currentHeight;
      this.floatingTechnicianLastScrollTop = element.scrollTop;
      stablePasses = currentHeight === previousHeight ? stablePasses + 1 : 0;
      previousHeight = currentHeight;
      attempts += 1;

      if (attempts < 14 && stablePasses < 3) {
        this.floatingTechnicianScrollTimeout = setTimeout(scrollWhenStable, 60);
      } else {
        this.floatingTechnicianScrollTimeout = undefined;
      }
    };

    this.floatingTechnicianScrollTimeout = setTimeout(scrollWhenStable);
  }

  private stopFloatingTechnicianAutoScroll(): void {
    this.floatingTechnicianScrollSequence += 1;
    if (!this.floatingTechnicianScrollTimeout) return;
    clearTimeout(this.floatingTechnicianScrollTimeout);
    this.floatingTechnicianScrollTimeout = undefined;
  }

  private getFloatingChatInitials(name: string): string {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'TC';
    return parts.slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('');
  }

  showTicketList() {
    this.activeSupportTab = 'list';
    this.loadUserTickets();
  }

  showCreateForm() {
    this.activeSupportTab = 'create';
    if (!this.supportChatMessages.length) {
      this.resetSupportChat();
    }
    this.scrollSupportChatToBottom();
  }

  resetSupportChat(): void {
    const firstName = String(this.currentUser?.name || '').trim().split(/\s+/)[0];
    this.clearSupportGreetingTimeout();
    this.newTicket = {
      title: '',
      description: '',
      priority: 'medium'
    };
    this.supportChatInput = '';
    this.supportAssistantThinking = false;
    this.supportDiagnosticCapture = null;
    this.capturingSupportDiagnostics = false;
    this.supportDiagnosticRequestSequence += 1;
    this.supportCaptureRequestSequence += 1;
    this.supportChatMessages = [];
    this.supportChatMessageSequence = 0;
    this.supportAssistantThinking = true;
    this.scrollSupportChatToBottom();
    this.supportGreetingTimeout = setTimeout(() => {
      this.supportGreetingTimeout = undefined;
      this.supportAssistantThinking = false;
      this.addSupportChatMessage(
        'assistant',
        `Hola${firstName ? `, ${firstName}` : ''}. Cuéntame qué pasó y te ayudo a dejar el ticket bien explicado.`
      );
      this.scrollSupportChatToBottom();
    }, this.supportGreetingDelayMs);
  }

  private clearSupportGreetingTimeout(): void {
    if (!this.supportGreetingTimeout) return;
    clearTimeout(this.supportGreetingTimeout);
    this.supportGreetingTimeout = undefined;
  }

  sendSupportChatMessage(): void {
    const content = this.supportChatInput.trim();
    if (!content || this.supportAssistantThinking || this.savingTicket) return;

    this.addSupportChatMessage('user', content);
    this.supportChatInput = '';
    this.supportAssistantThinking = true;
    this.scrollSupportChatToBottom();

    const diagnosticRequestId = ++this.supportDiagnosticRequestSequence;
    this.requestAquilesResponse(diagnosticRequestId);
  }

  captureSupportScreen(): void {
    if (this.capturingSupportDiagnostics) return;
    const captureRequestId = ++this.supportCaptureRequestSequence;
    this.capturingSupportDiagnostics = true;

    // Let Angular paint the pressed/loading state before html2canvas starts its
    // expensive DOM traversal. Capturing is optional and never blocks a message.
    requestAnimationFrame(() => {
      setTimeout(() => {
        void this.supportService.captureAquilesDiagnostics()
          .then(capture => {
            if (captureRequestId !== this.supportCaptureRequestSequence) return;
            this.supportDiagnosticCapture = capture;
            this.capturingSupportDiagnostics = false;
          })
          .catch(() => {
            if (captureRequestId !== this.supportCaptureRequestSequence) return;
            this.capturingSupportDiagnostics = false;
            this.messageService.add({
              severity: 'warn',
              summary: 'Captura no disponible',
              detail: 'Puedes continuar hablando con Aquiles sin adjuntar la pantalla.',
            });
          });
      });
    });
  }

  private requestAquilesResponse(diagnosticRequestId: number): void {
    const capture = this.supportDiagnosticCapture;

    this.supportService.chatWithAquiles({
      messages: this.supportChatMessages.map(message => ({
        role: message.role,
        content: message.content,
      })),
      route: this.router.url,
      browser: this.getSupportBrowserContext(),
      page_context: this.buildSupportPageContext(),
      screenshot_data_url: capture?.screenshotDataUrl,
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          if (diagnosticRequestId !== this.supportDiagnosticRequestSequence) return;
          this.supportAssistantThinking = false;
          this.addSupportChatMessage('assistant', response.message);
          const ticketReady = Boolean(
            response.ready && response.title?.trim() && response.description?.trim()
          );
          if (ticketReady) {
            this.newTicket = {
              title: response.title.trim(),
              description: response.description.trim(),
              priority: response.priority || 'medium',
            };
            this.createSupportTicketInBackground(this.supportDiagnosticCapture);
          }
          this.scrollSupportChatToBottom();
        },
        error: error => {
          if (diagnosticRequestId !== this.supportDiagnosticRequestSequence) return;
          this.supportAssistantThinking = false;
          this.addSupportChatMessage(
            'assistant',
            'No pude procesar ese mensaje en este momento. Tu explicación no se perdió; intenta enviarla nuevamente.'
          );
          this.scrollSupportChatToBottom();
        },
      });
  }

  @HostListener('document:click', ['$event'])
  captureSupportUserAction(event: MouseEvent): void {
    const source = event.target as HTMLElement | null;
    if (!source || source.closest('.aquiles-floating-chat')) return;
    const actionable = source.closest<HTMLElement>(
      'button, a, [role="button"], [role="tab"], [role="menuitem"]',
    );
    if (!actionable) return;
    const label = this.normalizeSupportContextText(
      actionable.getAttribute('aria-label')
      || actionable.getAttribute('title')
      || actionable.innerText,
      180,
    );
    if (!label || /^(?:ayuda|aquiles|soporte(?: técnico)?)$/i.test(label)) return;
    this.lastSupportUserAction = label;
  }

  @HostListener('document:change', ['$event'])
  captureSupportFieldAction(event: Event): void {
    const field = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
    if (
      !field
      || !field.matches('input, select, textarea')
      || field.closest('.aquiles-floating-chat')
      || (field instanceof HTMLInputElement && field.type === 'password')
    ) return;
    const label = this.normalizeSupportContextText(
      field.getAttribute('aria-label')
      || field.labels?.[0]?.innerText
      || field.getAttribute('placeholder')
      || field.getAttribute('name'),
      160,
    );
    if (label) this.lastSupportUserAction = `Modificó el campo ${label}`;
  }

  private buildSupportPageContext(): string {
    const route = String(this.router.url || '/').split('?')[0];
    const selectedTargets = (this.currentSelectedTargets?.length
      ? this.currentSelectedTargets
      : this.selectionService.selectedTargetsValue || [])
      .slice(0, 12);
    const focusedTargets = [
      ...(this.targetDetailsVisible && this.selectedTargetDetails
        ? [this.selectedTargetDetails]
        : []),
      ...selectedTargets,
    ].filter((target, index, targets) => {
      const id = String(target?._id || target?.device_imei || target?.imei || '');
      return !!id && targets.findIndex(item =>
        String(item?._id || item?.device_imei || item?.imei || '') === id,
      ) === index;
    });
    const visibleHeadings = this.collectVisibleSupportContext(
      'h1, h2, h3, .page-title, .p-dialog-title, [aria-current="page"]',
      8,
      () => true,
    );
    const visibleGpsRows = this.collectVisibleSupportContext(
      [
        '.management__content-table-tr',
        '.target-linked-pair-card',
        '.target-card',
        '.target-info',
        '.device-preview-item',
        '.device-info',
        '[data-support-context]',
        'tr[role="row"]',
      ].join(', '),
      10,
      text => /\b(?:IMEI|GPS|SIM)\b/i.test(text),
    );
    const activeView = this.getSupportActiveView();
    const lines = [
      'CONTEXTO ACTUAL DE LA INTERFAZ',
      `- Ruta: ${route}`,
      `- Módulo: ${this.getSupportModuleName(route)}`,
      visibleHeadings.length
        ? `- Títulos visibles: ${visibleHeadings.join(' | ')}`
        : '',
      activeView ? `- Acción o ventana activa: ${activeView}` : '',
      this.lastSupportUserAction
        ? `- Última acción relevante: ${this.lastSupportUserAction}`
        : '',
      focusedTargets.length
        ? '- GPS enfocados o seleccionados:'
        : '- No hay GPS seleccionados ni un detalle de GPS abierto.',
      ...focusedTargets.map(target => `  ${this.getSupportTargetContext(target)}`),
      visibleGpsRows.length ? '- GPS visibles en pantalla:' : '',
      ...visibleGpsRows.map(text => `  - ${text}`),
    ].filter(Boolean);
    return lines.join('\n').slice(0, 12_000);
  }

  private collectVisibleSupportContext(
    selector: string,
    limit: number,
    include: (text: string) => boolean,
  ): string[] {
    if (typeof document === 'undefined') return [];
    const values: string[] = [];
    const seen = new Set<string>();
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(selector),
    ).slice(0, 250);
    for (const element of candidates) {
      if (element.closest('.aquiles-floating-chat')) continue;
      const rect = element.getBoundingClientRect();
      if (
        rect.width <= 0
        || rect.height <= 0
        || rect.bottom <= 0
        || rect.right <= 0
        || rect.top >= window.innerHeight
        || rect.left >= window.innerWidth
      ) continue;
      const text = this.normalizeSupportContextText(element.innerText, 520);
      if (!text || !include(text) || seen.has(text)) continue;
      seen.add(text);
      values.push(text);
      if (values.length >= limit) break;
    }
    return values;
  }

  private getSupportTargetContext(target: Target): string {
    const name = this.normalizeSupportContextText(target?.name, 120) || 'Sin nombre';
    const imei = this.normalizeSupportContextText(
      target?.device_imei || target?.imei,
      40,
    ) || 'no disponible';
    const sim = this.normalizeSupportContextText(
      target?.sim_card_number || target?.sim_card,
      40,
    ) || 'no disponible';
    const connection = this.normalizeSupportContextText(
      target?.traccarInfo?.status,
      40,
    ) || 'no disponible';
    const expiration = this.normalizeSupportContextText(target?.expiration_date, 60)
      || 'no disponible';
    return `- ${name} | IMEI: ${imei} | SIM: ${sim} | Conexión: ${connection} | Expira: ${expiration}`;
  }

  private getSupportActiveView(): string {
    if (this.targetDetailsVisible && this.selectedTargetDetails) {
      return `Detalles del GPS ${this.selectedTargetDetails.name || this.selectedTargetDetails.device_imei}`;
    }
    if (this.bulkProcessDialogVisible) return 'Formulario de procesos para objetivos seleccionados';
    if (this.realtimeLinkDialogVisible) return 'Compartiendo ubicación en tiempo real';
    if (this.shareDialogVisible || this.shareMethodDialogVisible) return 'Compartiendo acceso a objetivos';
    if (this.transferDialogVisible) return 'Transfiriendo objetivos';
    if (this.canceledDrawerVisible) return 'Consultando objetivos cancelados';
    if (
      this.alertsDialogVisible
      || this.speedAlertDialogVisible
      || this.perimeterAlertDialogVisible
      || this.ignitionAlertDialogVisible
      || this.movementAlertDialogVisible
      || this.connectionAlertDialogVisible
    ) return 'Configurando una alerta';
    return '';
  }

  private getSupportModuleName(route: string): string {
    const match = [
      ['/management', 'Management'],
      ['/monitoring', 'Monitoreo'],
      ['/communication', 'Comunicación'],
      ['/inventory', 'Inventario'],
      ['/solicitudes', 'Solicitudes'],
      ['/process', 'Procesos'],
      ['/settings', 'Configuración'],
      ['/empleados', 'Empleados'],
    ].find(([segment]) => route.includes(segment));
    return match?.[1] || 'Montao GPS';
  }

  private normalizeSupportContextText(value: unknown, limit: number): string {
    return String(value || '')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .replace(/((?:password|contrase(?:ña|na)|token|secret|api[_-]?key|cookie)\s*[:=]\s*)\S+/gi, '$1[OCULTO]')
      .trim()
      .slice(0, limit);
  }

  onSupportChatKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    this.sendSupportChatMessage();
  }

  private addSupportChatMessage(role: 'user' | 'assistant', content: string): void {
    this.supportChatMessageSequence += 1;
    this.supportChatMessages = [
      ...this.supportChatMessages,
      {
        id: this.supportChatMessageSequence,
        role,
        content,
        createdAt: new Date(),
      },
    ];
  }

  private scrollSupportChatToBottom(): void {
    const scroll = () => {
      const elements = [
        this.supportChatScroll?.nativeElement,
        this.floatingSupportChatScroll?.nativeElement,
      ];
      elements.forEach(element => {
        if (element) element.scrollTop = element.scrollHeight;
      });
    };
    setTimeout(scroll);
    setTimeout(scroll, 120);
  }

  private getSupportBrowserContext(): string {
    if (typeof navigator === 'undefined') return '';
    return String(navigator.userAgent || '').slice(0, 280);
  }

  loadUserTickets() {
    this.loadingTickets = true;
    this.supportService.getTickets().subscribe({
      next: (tickets) => {
        this.userTickets = tickets;
        this.loadingTickets = false;
      },
      error: (err) => {
        console.error('Error loading user tickets:', err);
        this.loadingTickets = false;
      }
    });
  }

  getStatusLabel(status: string): string {
    const statusKeys: any = {
      'open': 'support.status.open',
      'in_progress': 'support.status.in_progress',
      'resolved': 'support.status.resolved',
      'closed': 'support.status.closed'
    };
    return statusKeys[status] || status;
  }

  getPriorityLabel(priority: string): string {
    const priorityKeys: any = {
      'low': 'support.priorities.low',
      'medium': 'support.priorities.medium',
      'high': 'support.priorities.high',
      'critical': 'support.priorities.critical'
    };
    return priorityKeys[priority] || priority;
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'open': return 'status-badge-open';
      case 'in_progress': return 'status-badge-progress';
      case 'resolved': return 'status-badge-resolved';
      case 'closed': return 'status-badge-closed';
      default: return '';
    }
  }

  private createSupportTicketInBackground(
    capture: SupportDiagnosticCapture | null,
  ): void {
    if (this.savingTicket || !this.newTicket.title || !this.newTicket.description) return;
    this.savingTicket = true;
    this.supportService.createTicket(this.newTicket, capture)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
      next: () => {
        this.loadUserTickets();
        this.addSupportChatMessage(
          'assistant',
          'Listo, ya creé el ticket y lo envié al equipo de soporte.'
        );
        this.scrollSupportChatToBottom();
        this.savingTicket = false;
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: getApiErrorMessage(err, 'No se pudo crear el ticket de soporte')
        });
        this.addSupportChatMessage(
          'assistant',
          'Entendí el caso, pero no pude crear el ticket ahora mismo. Escríbeme “intenta de nuevo” y vuelvo a enviarlo.'
        );
        this.scrollSupportChatToBottom();
        this.savingTicket = false;
      }
    });
  }

  // ... existing properties
  userPhotoUrl: string | null = null;
  appUpdateAvailable = false;
  applyingAppUpdate = false;

  constructor(
    private status: StatusService,
    private themes: ThemesService,
    public authService: AuthService, // Changed to public to access it in template if needed, though we use currentUser
    private router: Router,
    private route: ActivatedRoute,
    private langService: LangService,
    public translate: TranslateService,
    private selectionService: SelectionService,
    private targetsService: TargetsService,
    private userService: UserService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private alertsService: AlertsService,
    private firebaseNotificationsService: FirebaseNotificationsService,
    private supportService: SupportService,
    private communicationNotifications: CommunicationNotificationService,
    private whatsappApi: WhatsAppApiService,
    private internalChatService: InternalChatService,
    private protocolsService: ProtocolsService,
    private systemService: SystemService,
    private appUpdateService: AppUpdateService
  ) {
    this.currentTheme = status.getState('theme') as string;
    this.currentUser = this.authService.getCurrentUser();
    this.resetNotificationEmailToCurrentUser();
    this.resetPerimeterNotificationEmail();
    this.resetConnectionNotificationEmail();

    // Load user profile to get photo
    this.loadUserProfile();
  }

  private loadUserProfile() {
    const currentUser = this.authService.getCurrentUser();

    if (currentUser && currentUser.id) {
      this.userService.getById(currentUser.id).subscribe({
        next: (userData: any) => {
          if (userData.photo) {
            this.userPhotoUrl = userData.photo;
          }
        },
        error: (error) => {
          console.error('Error loading user profile for navbar:', error);
        }
      });
    }
  }

  /**
   * Verifica si todos los targets seleccionados tienen sensor de ignición
   */
  get allSelectedTargetsHaveIgnitionSensor(): boolean {
    if (!this.currentSelectedTargets || this.currentSelectedTargets.length === 0) {
      return false;
    }
    return this.currentSelectedTargets.every(target => target.ignition_sensor?.toLowerCase() === 'yes');
  }

  ngOnInit() {
    this.communicationNotifications.assignedChats$
      .pipe(takeUntil(this.destroy$))
      .subscribe(chats => {
        const previous = this.selectedFloatingCommunicationChat;
        this.assignedCommunicationChats = chats;
        if (!this.floatingCommunicationVisible) return;
        const selected = chats.find(
          chat => chat.conversationId === previous?.conversationId,
        );
        if (!selected) {
          if (
            previous
            && this.floatingCommunicationFallbackChat?.conversationId
              === previous.conversationId
          ) {
            return;
          }
          if (chats.length) this.selectFloatingCommunicationChat(chats[0], true);
          else this.closeFloatingCommunication();
          return;
        }
        this.floatingCommunicationFallbackChat = null;
        const hasChanged = selected.time !== previous?.time
          || selected.lastMessage !== previous?.lastMessage;
        this.selectedFloatingCommunicationChat = selected;
        if (hasChanged) this.loadFloatingCommunicationMessages(false);
      });

    this.communicationNotifications.floatingAssignedChatRequested$
      .pipe(takeUntil(this.destroy$))
      .subscribe(request => this.openFloatingCommunication(
        request.conversationId,
        request.chat,
      ));

    this.communicationNotifications.floatingTechniciansRequested$
      .pipe(takeUntil(this.destroy$))
      .subscribe(groupId => this.openFloatingTechnicians(groupId));

    this.communicationNotifications.floatingAdminRequested$
      .pipe(takeUntil(this.destroy$))
      .subscribe(groupId => this.openFloatingAdmin(groupId));

    this.loadFloatingTechnicianGroups();

    this.supportService.floatingAquilesRequested$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.openFloatingAquiles());

    this.appUpdateService.updateAvailable$
      .pipe(takeUntil(this.destroy$))
      .subscribe(available => {
        this.appUpdateAvailable = available;
      });
    this.appUpdateService.applyingUpdate$
      .pipe(takeUntil(this.destroy$))
      .subscribe(applying => {
        this.applyingAppUpdate = applying;
      });

    this.status.statusChanges$.subscribe((newStatus) => {
      if (newStatus && newStatus.theme) {
        this.currentTheme = newStatus.theme as string;
      }
    });

    this.initializeMenus();
    this.initializePriorities();

    // Suscribirse a cambios de idioma para actualizar los menús
    this.translate.onLangChange.subscribe(() => {
      this.initializeMenus();
      this.initializePriorities();
    });

    // Suscribirse a cambios en la selección de objetivos
    this.selectionService.selectedTargets$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(targets => {
      this.currentSelectedTargets = targets || [];
      this.selectedTargetsCount = this.currentSelectedTargets.length;
      this.hasSelectedTargets = this.selectedTargetsCount > 0;
      this.updateMenuItems();
      this.filterSpeedAlertsForSelection();
      this.filterVisiblePerimeterAlerts();
      this.filterVisibleIgnitionAlerts();
      this.filterVisibleMovementAlerts();
      this.filterConnectionAlertsForSelection();
    });

    // Configurar debounce para búsqueda de objetivos cancelados
    this.searchCanceledSubject$
      .pipe(
        debounceTime(300), // Esperar 300ms después de la última tecla
        distinctUntilChanged(), // Solo buscar si el término cambió
        takeUntil(this.destroy$)
      )
      .subscribe(searchTerm => {
        this.performCanceledSearch(searchTerm);
      });



    // Suscribirse a cambios de ruta para controlar visibilidad del botón cancelados
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.updateCanceledButtonVisibility();
    });

    // Verificar visibilidad inicial del botón cancelados y cargar targets si es necesario
    this.updateCanceledButtonVisibility();
  }

  ngOnDestroy() {
    this.clearSupportGreetingTimeout();
    this.stopFloatingTechnicianPolling();
    this.stopFloatingTechnicianAutoScroll();
    this.destroy$.next();
    this.destroy$.complete();
  }

  applyAvailableAppUpdate(): void {
    this.appUpdateService.applyUpdate();
  }

  /**
   * Actualiza la visibilidad del botón "Cancelados" basado en si existe el ID del usuario en la URL
   * y carga automáticamente los targets cancelados si es necesario
   */
  private async updateCanceledButtonVisibility() {
    const parentId = this.getParentIdFromUrl();
    const wasVisible = this.showCanceledButton;
    this.showCanceledButton = !!parentId; // Convertir a boolean: true si existe parentId, false si es null

    console.log('🔄 Actualizando visibilidad del botón cancelados:', {
      url: this.router.url,
      parentId,
      showCanceledButton: this.showCanceledButton,
      wasVisible
    });

    if (wasVisible !== this.showCanceledButton) {
      this.initializeMenus();
    }

    // El listado se carga únicamente al abrir el drawer. Mantener este trabajo
    // fuera de la navegación evita competir con usuarios y objetivos.
    if (this.showCanceledButton && parentId) {
      if (this.lastLoadedParentId !== parentId) {
        this.canceledTargets = [];
        this.totalCanceledTargetsCount = 0;
        this.hasMoreCanceledTargets = true;
        this.lastLoadedParentId = parentId;
      }
    } else if (!this.showCanceledButton) {
      // Si el botón se oculta, limpiar los datos
      this.canceledTargets = [];
      this.totalCanceledTargetsCount = 0;
      this.hasMoreCanceledTargets = true;
      this.lastLoadedParentId = null;
    }
  }

  private initializeMenus() {
    // Menú principal de acciones generales
    this.items = [
      {
        label: this.translate.instant('navbar.notifications'),
        icon: 'pi pi-bell',
        command: () => this.openNotificationsModal()
      },
      {
        label: this.translate.instant('navbar.canceled'),
        icon: 'pi pi-trash',
        visible: this.showCanceledButton,
        command: () => this.openCanceledTargetsDrawer()
      },
      {
        label: this.translate.instant('navbar.support'),
        icon: 'pi pi-question-circle',
        command: () => this.openSupportModal()
      }
    ];

    this.selectedActionItems = [
      {
        label: this.translate.instant('navbar.alerts'),
        icon: 'pi pi-cog',
        command: () => this.openAlertsModal()
      },
      {
        label: this.translate.instant('navbar.transfer'),
        icon: 'pi pi-reply',
        command: () => this.transferSelectedTargets()
      },
      {
        label: 'Crear cuenta y transferir',
        icon: 'pi pi-user-plus',
        command: () => this.selectionService.requestSelectedTargetsBulkAction('create-transfer')
      },
      {
        label: this.translate.instant('navbar.share'),
        icon: 'pi pi-share-alt',
        command: () => this.shareSelectedTargets()
      },
      {
        label: 'Realizar proceso',
        icon: 'pi pi-list-check',
        command: () => this.openBulkProcessDialog()
      },
      {
        separator: true
      },
      {
        label: 'Cancelar',
        icon: 'pi pi-ban',
        command: () => this.selectionService.requestSelectedTargetsBulkAction('cancel')
      },
      {
        label: 'Suspender',
        icon: 'pi pi-pause-circle',
        command: () => this.selectionService.requestSelectedTargetsBulkAction('suspend')
      }
    ];

    // Menú de usuario
    this.userMenuItems = [
      {
        label: this.currentUser ? `${this.currentUser.name} ${this.currentUser.last_name}` : this.translate.instant('navbar.myProfile'),
        icon: 'pi pi-user',
        command: () => this.router.navigate(['/admin/profile'])
      },
      {
        label: 'Instructivos',
        icon: 'pi pi-book',
        command: () => this.router.navigate(['/admin/instructivos'])
      },
      // {
      //   separator: true
      // },
      // {
      //   label: this.currentTheme === 'light' ? this.translate.instant('theme.toggleDark') : this.translate.instant('theme.toggleLight'),
      //   icon: this.currentTheme === 'light' ? 'pi pi-moon' : 'pi pi-sun',
      //   command: () => this.toggleTheme()
      // },
      {
        separator: true
      },
      {
        label: this.translate.instant('navbar.logout'),
        icon: 'pi pi-sign-out',
        command: () => this.logout()
      }
    ];

    // Menú de idiomas
    const languages = this.langService.getLanguages();
    this.languageItems = languages.map(lang => ({
      label: this.translate.instant('language.' + lang.code),
      icon: 'pi pi-flag',
      command: () => {
        this.langService.setLanguage(lang.code);
        this.translate.use(lang.code);
      }
    }));
  }

  toggleTheme() {
    this.loadingTheme = true;
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.themes.setTheme(newTheme);
    this.currentTheme = newTheme;

    // Actualizar el menú después de cambiar el tema
    this.initializeMenus();
  }

  openAlertsModal(): void {
    this.alertPresetView = 'available';
    this.alertsDialogVisible = true;
  }

  get filteredAlertPresets(): AlertPresetCard[] {
    const term = this.normalizeAlertPresetText(this.alertPresetSearch);
    return this.alertPresets.filter((preset) => {
      const matchesView = this.alertPresetView === 'available'
        ? preset.availability === 'ready'
        : preset.availability !== 'ready';
      if (!matchesView) return false;
      const matchesCategory =
        this.alertPresetCategory === 'all' || preset.category === this.alertPresetCategory;
      if (!matchesCategory) return false;
      if (!term) return true;
      return this.normalizeAlertPresetText(
        `${preset.name} ${preset.description} ${this.getAlertPresetAvailabilityLabel(preset)}`,
      ).includes(term);
    });
  }

  get readyAlertPresetCount(): number {
    return this.alertPresets.filter((preset) => preset.availability === 'ready').length;
  }

  get premiumAlertPresetCount(): number {
    return this.alertPresets.length - this.readyAlertPresetCount;
  }

  get activeAlertDialogTitle(): string {
    return this.activeAlertPreset?.name || 'Configurar alerta';
  }

  get activeAlertPresetDescription(): string {
    return this.activeAlertPreset?.description || 'Personaliza esta alerta para los dispositivos seleccionados.';
  }

  get activeAlertUsesSchedule(): boolean {
    return this.activeAlertPreset?.usesSchedule === true;
  }

  get activeAlertPresetMetadata(): Partial<CreateAlertDto> {
    if (!this.activeAlertPreset) return {};
    const metadata: Partial<CreateAlertDto> = {
      presetKey: this.activeAlertPreset.key,
      presetName: this.activeAlertPreset.name,
    };
    if (this.activeAlertUsesSchedule && this.alertScheduleStart && this.alertScheduleEnd) {
      metadata.scheduleStart = this.alertScheduleStart;
      metadata.scheduleEnd = this.alertScheduleEnd;
      metadata.scheduleTimezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Santo_Domingo';
    }
    return metadata;
  }

  get activeAlertEngine(): AlertEngine | null {
    return this.activeAlertPreset?.engine || null;
  }

  get activeAlertBehaviorSummary(): string {
    switch (this.activeAlertEngine) {
      case 'speed':
        return this.maxSpeedValue
          ? `Te avisaremos cuando supere ${this.maxSpeedValue} km/h.`
          : 'Define la velocidad máxima permitida.';
      case 'perimeter':
        return this.perimeterNotificationTrigger === 'exit'
          ? `Te avisaremos cuando salga del radio de ${this.perimeterRadiusMeters} metros.`
          : `Te avisaremos cuando entre al radio de ${this.perimeterRadiusMeters} metros.`;
      case 'ignition':
        return this.ignitionTrigger === 'off'
          ? 'Te avisaremos cuando el motor se apague.'
          : 'Te avisaremos cuando el motor se encienda.';
      case 'movement':
        return 'Te avisaremos una vez cuando el vehículo comience a moverse.';
      case 'connection':
        return this.connectionAlertType === 'offline'
          ? 'Te avisaremos cuando el GPS pierda la conexión.'
          : 'Te avisaremos cuando el GPS vuelva a estar en línea.';
      default:
        return 'Personaliza la regla y crea la alerta.';
    }
  }

  selectAlertPresetCategory(category: 'all' | AlertPresetCategory): void {
    this.alertPresetCategory = category;
  }

  selectAlertPresetView(view: 'available' | 'premium'): void {
    this.alertPresetView = view;
  }

  getAlertPresetAvailabilityLabel(preset: AlertPresetCard): string {
    return preset.availability === 'ready' ? 'Disponible ahora' : 'Premium';
  }

  getAlertPresetDisabledReason(preset: AlertPresetCard): string | null {
    if (preset.availability !== 'ready') {
      return 'Esta alerta forma parte del catálogo Premium y todavía no está disponible en tu plan.';
    }
    if (!this.currentSelectedTargets.length) {
      return 'Selecciona al menos un dispositivo para configurarla.';
    }
    if (preset.requiresIgnition && !this.allSelectedTargetsHaveIgnitionSensor) {
      return 'Todos los dispositivos seleccionados deben tener sensor de ignición.';
    }
    return null;
  }

  openAlertPreset(preset: AlertPresetCard): void {
    const disabledReason = this.getAlertPresetDisabledReason(preset);
    if (disabledReason) {
      this.messageService.add({
        severity: preset.availability === 'ready' ? 'warn' : 'info',
        summary: preset.name,
        detail: disabledReason,
      });
      return;
    }

    if (!preset.engine) return;

    this.activeAlertPreset = preset;
    this.alertAdvancedOptionsVisible = false;
    this.alertHistoryVisible = false;
    this.alertScheduleStart = preset.scheduleStart || '';
    this.alertScheduleEnd = preset.scheduleEnd || '';
    this.perimeterRadiusMeters = preset.defaultRadius || 150;
    this.applyAlertPresetDefaults(preset);
    this.openAlertEngine(preset.engine);
  }

  openManualAlertOption(option: ManualAlertOption): void {
    if (!this.currentSelectedTargets.length) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Selecciona un dispositivo',
        detail: 'Debes seleccionar al menos un dispositivo antes de configurar una alerta.',
      });
      return;
    }
    if (option.type === 'ignition' && !this.allSelectedTargetsHaveIgnitionSensor) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sensor no disponible',
        detail: 'Todos los dispositivos seleccionados deben tener sensor de ignición.',
      });
      return;
    }
    this.activeAlertPreset = null;
    this.alertAdvancedOptionsVisible = true;
    this.alertHistoryVisible = false;
    this.alertScheduleStart = '';
    this.alertScheduleEnd = '';
    this.openAlertEngine(option.type);
  }

  private openAlertEngine(engine: AlertEngine): void {
    this.alertsDialogVisible = false;
    switch (engine) {
      case 'speed':
        this.openSpeedAlertModal();
        break;
      case 'perimeter':
        this.openPerimeterAlertModal();
        break;
      case 'ignition':
        this.openIgnitionAlertModal();
        break;
      case 'movement':
        this.openMovementAlertModal();
        break;
      case 'connection':
        this.openConnectionAlertModal();
        break;
    }
  }

  private applyAlertPresetDefaults(preset: AlertPresetCard): void {
    if (preset.engine === 'speed') {
      this.maxSpeedValue = preset.defaultSpeed || null;
      this.speedAlertMessage = preset.defaultMessage || '';
    }
    if (preset.engine === 'perimeter') {
      this.perimeterNotificationTrigger = preset.perimeterTrigger || 'enter';
      this.perimeterNotificationMessage = preset.defaultMessage || '';
    }
    if (preset.engine === 'ignition') {
      this.ignitionTrigger = preset.key === 'trip-ended' ? 'off' : 'on';
      this.ignitionAlertMessage = preset.defaultMessage || '';
    }
    if (preset.engine === 'movement') {
      this.movementAlertMessage = preset.defaultMessage || '';
    }
    if (preset.engine === 'connection') {
      this.connectionAlertType = preset.key === 'gps-disconnected' || preset.key === 'offline-working'
        ? 'offline'
        : 'online';
      this.connectionAlertMessage = preset.defaultMessage || '';
    }
  }

  backToAlertCatalog(): void {
    this.speedAlertDialogVisible = false;
    this.perimeterAlertDialogVisible = false;
    this.ignitionAlertDialogVisible = false;
    this.movementAlertDialogVisible = false;
    this.connectionAlertDialogVisible = false;
    this.alertAdvancedOptionsVisible = false;
    this.alertHistoryVisible = false;
    setTimeout(() => this.alertsDialogVisible = true);
  }

  toggleAlertAdvancedOptions(): void {
    this.alertAdvancedOptionsVisible = !this.alertAdvancedOptionsVisible;
  }

  toggleAlertHistory(): void {
    this.alertHistoryVisible = !this.alertHistoryVisible;
  }

  startCircularPerimeter(): void {
    this.mapAlertComponent?.startRadiusPlacement(this.perimeterRadiusMeters);
  }

  onPerimeterDialogShow(): void {
    void this.loadPerimeterAlerts();
  }

  private normalizeAlertPresetText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private ensureAlertScheduleValid(): boolean {
    if (!this.activeAlertUsesSchedule) return true;
    if (this.alertScheduleStart && this.alertScheduleEnd) return true;
    this.messageService.add({
      severity: 'warn',
      summary: 'Horario incompleto',
      detail: 'Selecciona la hora de inicio y la hora de fin de esta alerta.',
    });
    return false;
  }

  openSpeedAlertModal(): void {
    this.loadSpeedAlerts();
    this.speedAlertDialogVisible = true;
  }

  openPerimeterAlertModal(): void {
    this.perimeterAlertDialogVisible = true;
  }

  openIgnitionAlertModal(): void {
    this.ignitionAlertDialogVisible = true;
    if (this.currentUser?.email) {
      this.ignitionNotificationEmail = this.currentUser.email;
      // Verificar automáticamente si es el usuario actual
      if (this.currentUser.id) {
        this.ignitionNotificationEmailUserId = this.currentUser.id;
      }
    }
  }

  onNotificationEmailChange(): void {
    if (
      this.notificationEmail &&
      this.currentUser?.email &&
      this.notificationEmail.trim().toLowerCase() ===
      this.currentUser.email.toLowerCase() &&
      this.currentUser?.id
    ) {
      this.notificationEmailUserId = this.currentUser.id;
    } else {
      this.notificationEmailUserId = null;
    }
  }

  async verifyNotificationEmail(): Promise<void> {
    const email = this.notificationEmail?.trim();
    if (!email) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('common.warning'),
        detail: this.translate.instant('navbar.verifyEmailRequired')
      });
      return;
    }

    // Si coincide con el usuario actual, marcar como verificado sin consultar API
    if (
      this.currentUser?.email &&
      email.toLowerCase() === this.currentUser.email.toLowerCase() &&
      this.currentUser?.id
    ) {
      this.notificationEmailUserId = this.currentUser.id;
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('common.success'),
        detail: this.translate.instant('navbar.verifyEmailSuccess')
      });
      return;
    }

    this.verifyingNotificationEmail = true;
    try {
      const user = await firstValueFrom(this.userService.getByEmail(email));
      const userId = user?._id || (user as any)?.id;

      if (userId) {
        this.notificationEmailUserId = userId;
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('common.success'),
          detail: this.translate.instant('navbar.verifyEmailSuccess')
        });
      } else {
        this.notificationEmailUserId = null;
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('common.warning'),
          detail: this.translate.instant('navbar.verifyEmailNotFound')
        });
      }
    } catch (error) {
      this.notificationEmailUserId = null;
      console.error('❌ Error verificando correo para alerta:', error);
      const detail =
        (error as any)?.error?.message ||
        this.translate.instant('navbar.verifyEmailError');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail
      });
    } finally {
      this.verifyingNotificationEmail = false;
    }
  }

  async createSpeedAlert(): Promise<void> {
    if (this.maxSpeedValue === null || this.maxSpeedValue <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('common.warning'),
        detail: this.translate.instant('navbar.maxSpeedRequired')
      });
      return;
    }

    const targetIds = this.getSelectedAlertTargetIds();
    if (!this.ensureAlertTargetsSelected(targetIds)) return;
    if (!this.ensureAlertScheduleValid()) return;

    if (this.notificationEmail?.trim() && !this.notificationEmailUserId) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('common.warning'),
        detail: this.translate.instant('navbar.verifyEmailPending')
      });
      return;
    }

    const payload = {
      type: 'speed' as const,
      maxSpeed: this.maxSpeedValue,
      targetIds,
      userTopic: this.notificationEmailUserId || undefined,
      message: this.speedAlertMessage?.trim() || undefined,
      oneNotificationEveryFiveHours: this.speedAlertFiveHourLimit,
      ...this.activeAlertPresetMetadata,
    };

    this.creatingAlert = true;

    try {
      await firstValueFrom(this.alertsService.createAlert(payload));

      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('navbar.createAlert'),
        detail: `${this.translate.instant('navbar.alertOptionSpeed')} - ${this.maxSpeedValue} km/h`
      });

      this.maxSpeedValue = null;
      this.speedAlertMessage = '';
      this.speedAlertFiveHourLimit = false;
      this.resetNotificationEmailToCurrentUser();
      await this.loadSpeedAlerts();
    } catch (error: any) {
      console.error('❌ Error al crear la alerta de velocidad:', error);
      const detail =
        error?.error?.message ||
        this.translate.instant('navbar.createAlertError');

      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail
      });
    } finally {
      this.creatingAlert = false;
    }
  }

  private resetNotificationEmailToCurrentUser(): void {
    if (this.currentUser?.email && this.currentUser?.id) {
      this.notificationEmail = this.currentUser.email;
      this.notificationEmailUserId = this.currentUser.id;
    } else {
      this.notificationEmail = '';
      this.notificationEmailUserId = null;
    }
  }

  private getSelectedAlertTargetIds(): string[] {
    return [
      ...new Set(
        (this.currentSelectedTargets || [])
          .map(target => String(target?._id || (target as any)?.id || '').trim())
          .filter(Boolean)
      )
    ];
  }

  private ensureAlertTargetsSelected(targetIds = this.getSelectedAlertTargetIds()): boolean {
    if (targetIds.length) return true;
    this.messageService.add({
      severity: 'warn',
      summary: this.translate.instant('common.warning'),
      detail: this.translate.instant('navbar.noDevicesSelected')
    });
    return false;
  }

  onPerimeterNotificationEmailChange(): void {
    if (
      this.perimeterNotificationEmail &&
      this.currentUser?.email &&
      this.perimeterNotificationEmail.trim().toLowerCase() ===
      this.currentUser.email.toLowerCase() &&
      this.currentUser?.id
    ) {
      this.perimeterNotificationEmailUserId = this.currentUser.id;
    } else {
      this.perimeterNotificationEmailUserId = null;
    }
  }

  async verifyPerimeterNotificationEmail(): Promise<void> {
    const email = this.perimeterNotificationEmail?.trim();
    if (!email) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('common.warning'),
        detail: this.translate.instant('navbar.verifyEmailRequired')
      });
      return;
    }

    // Si coincide con el usuario actual, marcar como verificado sin consultar API
    if (
      this.currentUser?.email &&
      email.toLowerCase() === this.currentUser.email.toLowerCase() &&
      this.currentUser?.id
    ) {
      this.perimeterNotificationEmailUserId = this.currentUser.id;
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('common.success'),
        detail: this.translate.instant('navbar.verifyEmailSuccess')
      });
      return;
    }

    this.verifyingPerimeterNotificationEmail = true;
    try {
      const user = await firstValueFrom(this.userService.getByEmail(email));
      const userId = user?._id || (user as any)?.id;

      if (userId) {
        this.perimeterNotificationEmailUserId = userId;
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('common.success'),
          detail: this.translate.instant('navbar.verifyEmailSuccess')
        });
      } else {
        this.perimeterNotificationEmailUserId = null;
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('common.warning'),
          detail: this.translate.instant('navbar.verifyEmailNotFound')
        });
      }
    } catch (error) {
      this.perimeterNotificationEmailUserId = null;
      console.error('❌ Error verificando correo para alerta de perímetro:', error);
      const detail =
        (error as any)?.error?.message ||
        this.translate.instant('navbar.verifyEmailError');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail
      });
    } finally {
      this.verifyingPerimeterNotificationEmail = false;
    }
  }

  onIgnitionNotificationEmailChange(): void {
    if (
      this.ignitionNotificationEmail &&
      this.ignitionNotificationEmailUserId
    ) {
      this.ignitionNotificationEmailUserId = null;
    }
  }

  async verifyIgnitionNotificationEmail(): Promise<void> {
    const email = this.ignitionNotificationEmail?.trim();
    if (!email) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('common.warning'),
        detail: this.translate.instant('navbar.verifyEmailRequired')
      });
      return;
    }

    // Si coincide con el usuario actual, marcar como verificado sin consultar API
    if (
      this.currentUser?.email &&
      email.toLowerCase() === this.currentUser.email.toLowerCase() &&
      this.currentUser?.id
    ) {
      this.ignitionNotificationEmailUserId = this.currentUser.id;
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('common.success'),
        detail: this.translate.instant('navbar.verifyEmailSuccess')
      });
      return;
    }

    this.verifyingIgnitionNotificationEmail = true;
    try {
      const user = await firstValueFrom(this.userService.getByEmail(email));
      const userId = user?._id || (user as any)?.id;

      if (userId) {
        this.ignitionNotificationEmailUserId = userId;
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('common.success'),
          detail: this.translate.instant('navbar.verifyEmailSuccess')
        });
      } else {
        this.ignitionNotificationEmailUserId = null;
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('common.warning'),
          detail: this.translate.instant('navbar.verifyEmailNotFound')
        });
      }
    } catch (error) {
      this.ignitionNotificationEmailUserId = null;
      console.error('❌ Error verificando correo para alerta de encendido:', error);
      const detail =
        (error as any)?.error?.message ||
        this.translate.instant('navbar.verifyEmailError');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail
      });
    } finally {
      this.verifyingIgnitionNotificationEmail = false;
    }
  }

  async createPerimeterAlert(): Promise<void> {
    // Validar que hay un polígono dibujado
    const coordinates = this.mapAlertComponent?.getPolygonCoordinates();

    if (!coordinates || coordinates.length < 3) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('common.warning'),
        detail: 'Debe dibujar un perímetro en el mapa'
      });
      return;
    }

    // Validar email si está presente
    if (this.perimeterNotificationEmail?.trim() && !this.perimeterNotificationEmailUserId) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('common.warning'),
        detail: this.translate.instant('navbar.verifyEmailPending')
      });
      return;
    }

    const targetIds = this.getSelectedAlertTargetIds();
    if (!this.ensureAlertTargetsSelected(targetIds)) return;
    if (!this.ensureAlertScheduleValid()) return;

    const payload: CreateAlertDto = {
      type: 'perimeter',
      coordinates,
      trigger: this.perimeterNotificationTrigger as 'enter' | 'exit',
      targetIds,
      userTopic: this.perimeterNotificationEmailUserId || undefined,
      message: this.perimeterNotificationMessage?.trim() || undefined,
      ...this.activeAlertPresetMetadata,
    };

    this.creatingPerimeterAlert = true;

    try {
      await firstValueFrom(this.alertsService.createAlert(payload));

      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('navbar.createAlert'),
        detail: `${this.translate.instant('navbar.alertOptionPerimeter')} creada exitosamente`
      });

      // Resetear formulario
      this.perimeterNotificationTrigger = 'enter';
      this.perimeterNotificationMessage = '';
      this.resetPerimeterNotificationEmail();
      this.mapAlertComponent?.clearPerimeter();

      // Recargar lista de alertas
      await this.loadPerimeterAlerts();
    } catch (error: any) {
      console.error('❌ Error al crear la alerta de perímetro:', error);
      const detail = error?.error?.message ||
        this.translate.instant('navbar.createAlertError');

      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail
      });
    } finally {
      this.creatingPerimeterAlert = false;
    }
  }

  private resetPerimeterNotificationEmail(): void {
    if (this.currentUser?.email && this.currentUser?.id) {
      this.perimeterNotificationEmail = this.currentUser.email;
      this.perimeterNotificationEmailUserId = this.currentUser.id;
    } else {
      this.perimeterNotificationEmail = '';
      this.perimeterNotificationEmailUserId = null;
    }
  }

  async loadPerimeterAlerts(): Promise<void> {
    this.loadingPerimeterAlerts = true;
    try {
      const allAlerts = await firstValueFrom(
        this.alertsService.getAlerts(this.getSelectedAlertTargetIds())
      );

      // Filtrar solo alertas de perímetro
      this.perimeterAlerts = allAlerts.filter(alert => alert.type === 'perimeter');

      // Filtrar por targets seleccionados
      this.filterVisiblePerimeterAlerts();
    } catch (error) {
      console.error('❌ Error al cargar alertas de perímetro:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail: getApiErrorMessage(error, 'Error al cargar las alertas de perímetro')
      });
    } finally {
      this.loadingPerimeterAlerts = false;
    }
  }

  private filterVisiblePerimeterAlerts(): void {
    const selectedIds = (this.currentSelectedTargets || [])
      .map(t => t?._id || (t as any)?.id)
      .filter((id): id is string => !!id);

    if (!selectedIds.length) {
      this.visiblePerimeterAlerts = [];
      return;
    }

    this.visiblePerimeterAlerts = this.perimeterAlerts.filter(alert => {
      if (!Array.isArray(alert.targetIds) || alert.targetIds.length === 0) {
        return false;
      }
      return alert.targetIds.some(targetId => selectedIds.includes(targetId));
    });
  }

  async togglePerimeterAlertStatus(alert: AlertResponse): Promise<void> {
    if (!alert._id) {
      return;
    }

    const newStatus: AlertStatus = alert.status === 'active' ? 'inactive' : 'active';
    this.togglingPerimeterAlertId = alert._id;

    try {
      await firstValueFrom(
        this.alertsService.updateAlertStatus(alert._id, newStatus)
      );

      alert.status = newStatus;

      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('common.success'),
        detail: `Alerta ${newStatus === 'active' ? 'activada' : 'desactivada'}`
      });
    } catch (error) {
      console.error('❌ Error al cambiar estado de alerta:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail: getApiErrorMessage(error, 'Error al cambiar el estado de la alerta')
      });
    } finally {
      this.togglingPerimeterAlertId = null;
    }
  }

  async deletePerimeterAlert(alert: AlertResponse): Promise<void> {
    if (!alert._id) {
      return;
    }

    this.confirmationService.confirm({
      message: '¿Está seguro de eliminar esta alerta de perímetro?',
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      accept: async () => {
        try {
          await firstValueFrom(this.alertsService.deleteAlert(alert._id!));

          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('common.success'),
            detail: 'Alerta eliminada correctamente'
          });

          await this.loadPerimeterAlerts();
        } catch (error) {
          console.error('❌ Error al eliminar alerta:', error);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('common.error'),
            detail: getApiErrorMessage(error, 'Error al eliminar la alerta')
          });
        }
      }
    });
  }

  async createIgnitionAlert(): Promise<void> {
    if (this.ignitionNotificationEmail && !this.ignitionNotificationEmailUserId) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('common.warning'),
        detail: 'Debe verificar el correo electrónico antes de crear la alerta'
      });
      return;
    }

    const targetIds = this.getSelectedAlertTargetIds();
    if (!this.ensureAlertTargetsSelected(targetIds)) return;
    if (!this.ensureAlertScheduleValid()) return;

    this.creatingIgnitionAlert = true;

    try {
      const payload: CreateAlertDto = {
        type: 'ignition',
        ignitionTrigger: this.ignitionTrigger as 'on' | 'off',
        targetIds,
        userTopic: this.ignitionNotificationEmailUserId || undefined,
        message: this.ignitionAlertMessage?.trim() || undefined,
        oneNotificationEveryFiveHours: this.ignitionAlertFiveHourLimit,
        ...this.activeAlertPresetMetadata,
      };

      await firstValueFrom(this.alertsService.createAlert(payload));

      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('common.success'),
        detail: 'Alerta de encendido creada exitosamente'
      });

      await this.loadIgnitionAlerts();

      this.ignitionTrigger = 'on';
      this.ignitionAlertMessage = '';
      this.ignitionAlertFiveHourLimit = false;
      this.ignitionNotificationEmail = '';
      this.ignitionNotificationEmailUserId = null;
    } catch (error) {
      console.error('❌ Error creando alerta de encendido:', error);
      const detail = (error as any)?.error?.message || 'Error al crear la alerta';
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail
      });
    } finally {
      this.creatingIgnitionAlert = false;
    }
  }

  async loadIgnitionAlerts(): Promise<void> {
    this.loadingIgnitionAlerts = true;
    try {
      const allAlerts = await firstValueFrom(
        this.alertsService.getAlerts(this.getSelectedAlertTargetIds())
      );
      this.ignitionAlerts = allAlerts.filter(alert => alert.type === 'ignition');
      this.filterVisibleIgnitionAlerts();
    } catch (error) {
      console.error('❌ Error al cargar alertas de encendido:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail: getApiErrorMessage(error, 'Error al cargar las alertas de encendido')
      });
    } finally {
      this.loadingIgnitionAlerts = false;
    }
  }

  private filterVisibleIgnitionAlerts(): void {
    const selectedIds = (this.currentSelectedTargets || [])
      .map(t => t?._id || (t as any)?.id)
      .filter((id): id is string => !!id);

    if (!selectedIds.length) {
      this.visibleIgnitionAlerts = [];
      return;
    }

    this.visibleIgnitionAlerts = this.ignitionAlerts.filter(alert => {
      if (!Array.isArray(alert.targetIds) || alert.targetIds.length === 0) {
        return false;
      }
      return alert.targetIds.some(targetId => selectedIds.includes(targetId));
    });
  }

  // Métodos para alertas de movimiento
  openMovementAlertModal(): void {
    this.movementAlertDialogVisible = true;
    if (this.currentUser?.email) {
      this.movementNotificationEmail = this.currentUser.email;
      if (this.currentUser.id) {
        this.movementNotificationEmailUserId = this.currentUser.id;
      }
    }
  }

  onMovementNotificationEmailChange(): void {
    if (
      this.movementNotificationEmail &&
      this.currentUser?.email &&
      this.movementNotificationEmail.trim().toLowerCase() ===
      this.currentUser.email.toLowerCase() &&
      this.currentUser?.id
    ) {
      this.movementNotificationEmailUserId = this.currentUser.id;
    } else {
      this.movementNotificationEmailUserId = null;
    }
  }

  async verifyMovementNotificationEmail(): Promise<void> {
    if (!this.movementNotificationEmail) return;

    this.verifyingMovementNotificationEmail = true;
    try {
      const user = await firstValueFrom(
        this.userService.getByEmail(this.movementNotificationEmail.trim())
      );
      const userId = user?._id || (user as any)?.id;
      if (userId) {
        this.movementNotificationEmailUserId = userId;
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('common.success'),
          detail: this.translate.instant('navbar.emailVerified')
        });
      } else {
        this.movementNotificationEmailUserId = null;
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('common.warning'),
          detail: this.translate.instant('navbar.emailNotFound')
        });
      }
    } catch (error) {
      console.error('Error verifying email:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail: this.translate.instant('navbar.errorVerifyingEmail')
      });
    } finally {
      this.verifyingMovementNotificationEmail = false;
    }
  }

  async createMovementAlert(): Promise<void> {
    if (!this.movementNotificationEmail) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('common.warning'),
        detail: this.translate.instant('navbar.emailRequired')
      });
      return;
    }

    if (!this.movementNotificationEmailUserId) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('common.warning'),
        detail: this.translate.instant('navbar.verifyEmailPending')
      });
      return;
    }

    const targetIds = this.getSelectedAlertTargetIds();
    if (!this.ensureAlertTargetsSelected(targetIds)) return;
    if (!this.ensureAlertScheduleValid()) return;

    this.creatingMovementAlert = true;
    try {
      const alertData: CreateAlertDto = {
        type: 'movement',
        targetIds,
        userTopic: this.movementNotificationEmailUserId,
        email: this.movementNotificationEmail,
        message: this.movementAlertMessage?.trim() || undefined,
        ...this.activeAlertPresetMetadata,
      };

      await firstValueFrom(this.alertsService.createAlert(alertData));

      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('common.success'),
        detail: 'Alerta de movimiento creada correctamente'
      });

      this.movementNotificationEmail = '';
      this.movementAlertMessage = '';
      this.movementNotificationEmailUserId = null;
      this.loadMovementAlerts();
    } catch (error) {
      console.error('Error creating movement alert:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail: getApiErrorMessage(error, 'Error al crear la alerta de movimiento')
      });
    } finally {
      this.creatingMovementAlert = false;
    }
  }

  async loadMovementAlerts(): Promise<void> {
    if (!this.currentUser?.id) return;

    this.loadingMovementAlerts = true;
    try {
      const alerts = await firstValueFrom(
        this.alertsService.getAlerts(this.getSelectedAlertTargetIds())
      );
      this.movementAlerts = alerts.filter(alert => alert.type === 'movement');
      this.filterVisibleMovementAlerts();
    } catch (error) {
      console.error('Error loading movement alerts:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail: getApiErrorMessage(error, 'Error al cargar las alertas de movimiento')
      });
    } finally {
      this.loadingMovementAlerts = false;
    }
  }

  private filterVisibleMovementAlerts(): void {
    const selectedIds = (this.currentSelectedTargets || [])
      .map(t => t?._id || (t as any)?.id)
      .filter((id): id is string => !!id);

    if (!selectedIds.length) {
      this.visibleMovementAlerts = [];
      return;
    }

    this.visibleMovementAlerts = this.movementAlerts.filter(alert => {
      if (!Array.isArray(alert.targetIds) || alert.targetIds.length === 0) {
        return false;
      }
      return alert.targetIds.some(targetId => selectedIds.includes(targetId));
    });
  }

  async toggleMovementAlertStatus(alert: AlertResponse): Promise<void> {
    if (!alert._id) return;

    this.togglingMovementAlertId = alert._id;
    const newStatus = alert.status === 'active' ? 'inactive' : 'active';

    try {
      await firstValueFrom(this.alertsService.updateAlertStatus(alert._id, newStatus));
      alert.status = newStatus;
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('common.success'),
        detail: `Alerta ${newStatus === 'active' ? 'activada' : 'desactivada'} correctamente`
      });
    } catch (error) {
      console.error('Error updating alert status:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail: getApiErrorMessage(error, 'Error al actualizar el estado de la alerta')
      });
    } finally {
      this.togglingMovementAlertId = null;
    }
  }

  deleteMovementAlert(alertId: string): void {
    this.confirmationService.confirm({
      message: '¿Estás seguro de que deseas eliminar esta alerta?',
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      accept: async () => {
        this.deletingMovementAlertId = alertId;
        try {
          await firstValueFrom(this.alertsService.deleteAlert(alertId));
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('common.success'),
            detail: 'Alerta eliminada correctamente'
          });
          this.loadMovementAlerts();
        } catch (error) {
          console.error('Error deleting alert:', error);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('common.error'),
            detail: getApiErrorMessage(error, 'Error al eliminar la alerta')
          });
        } finally {
          this.deletingMovementAlertId = null;
        }
      }
    });
  }

  async toggleIgnitionAlertStatus(alert: AlertResponse): Promise<void> {
    if (!alert._id) return;

    const newStatus: AlertStatus = alert.status === 'active' ? 'inactive' : 'active';
    this.togglingIgnitionAlertId = alert._id;

    try {
      await firstValueFrom(this.alertsService.updateAlertStatus(alert._id, newStatus));
      alert.status = newStatus;
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('common.success'),
        detail: `Alerta ${newStatus === 'active' ? 'activada' : 'desactivada'}`
      });
    } catch (error) {
      console.error('❌ Error al cambiar estado de alerta:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail: getApiErrorMessage(error, 'Error al cambiar el estado de la alerta')
      });
    } finally {
      this.togglingIgnitionAlertId = null;
    }
  }

  async deleteIgnitionAlert(alert: AlertResponse): Promise<void> {
    if (!alert._id) return;

    this.confirmationService.confirm({
      message: '¿Está seguro de eliminar esta alerta de encendido?',
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      accept: async () => {
        this.deletingIgnitionAlertId = alert._id!;
        try {
          await firstValueFrom(this.alertsService.deleteAlert(alert._id!));
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('common.success'),
            detail: 'Alerta eliminada correctamente'
          });
          await this.loadIgnitionAlerts();
        } catch (error) {
          console.error('❌ Error al eliminar alerta:', error);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('common.error'),
            detail: getApiErrorMessage(error, 'Error al eliminar la alerta')
          });
        } finally {
          this.deletingIgnitionAlertId = null;
        }
      }
    });
  }

  private async loadSpeedAlerts(): Promise<void> {
    this.loadingSpeedAlerts = true;
    try {
      const alerts = await firstValueFrom(
        this.alertsService.getAlerts(this.getSelectedAlertTargetIds())
      );
      this.speedAlerts = (alerts || []).filter(alert => alert.type === 'speed');
      this.filterSpeedAlertsForSelection();
    } catch (error) {
      console.error('❌ Error al cargar las alertas de velocidad:', error);
    } finally {
      this.loadingSpeedAlerts = false;
    }
  }

  private async logCurrentUserDetails(): Promise<User | null> {
    try {
      const currentUserId = this.currentUser?.id;
      if (!currentUserId) {
        console.warn('⚠️ No se pudo obtener el ID del usuario actual');
        return null;
      }
      const user = await firstValueFrom(this.userService.getById(currentUserId));
      console.log('ℹ️ Usuario logueado sin objetivos seleccionados:', user);
      return user;
    } catch (error) {
      console.error('❌ Error al obtener datos del usuario logueado:', error);
      return null;
    }
  }

  private filterSpeedAlertsForSelection(): void {
    const currentTargetIds = this.getSelectedAlertTargetIds();

    if (!currentTargetIds.length) {
      this.visibleSpeedAlerts = [];
      return;
    }

    this.visibleSpeedAlerts = (this.speedAlerts || []).filter(alert => {
      if (!alert.targetIds || alert.targetIds.length === 0) {
        return false;
      }
      return alert.targetIds.some(targetId => currentTargetIds.includes(targetId));
    });
  }

  getAlertRecipientEmail(alert: AlertResponse): string | null {
    if (!alert?.userTopic) {
      return null;
    }

    if (typeof alert.userTopic === 'string') {
      return null;
    }

    return alert.userTopic.email ?? null;
  }

  getCreatorName(alert: AlertResponse): string {
    if (!alert.createdBy) {
      return 'Desconocido';
    }

    const creator = alert.createdBy as any;
    const firstName = creator.name || '';
    const lastName = creator.last_name || '';

    return `${firstName} ${lastName}`.trim() || 'Desconocido';
  }

  getCreatorEmail(alert: AlertResponse): string | null {
    if (!alert.createdBy) {
      return null;
    }

    const creator = alert.createdBy as any;
    return creator.email || null;
  }

  async toggleAlertStatus(alert: AlertResponse): Promise<void> {
    const nextStatus: AlertStatus =
      alert.status === 'active' ? 'inactive' : 'active';

    this.togglingAlertId = alert._id;

    try {
      const updatedAlert = await firstValueFrom(
        this.alertsService.updateAlertStatus(alert._id, nextStatus),
      );

      alert.status = updatedAlert.status;

      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('navbar.alertStatusUpdated'),
        detail:
          alert.status === 'active'
            ? this.translate.instant('navbar.alertEnabled')
            : this.translate.instant('navbar.alertDisabled'),
      });
    } catch (error: any) {
      console.error('❌ Error al actualizar estado de alerta:', error);
      const detail =
        error?.error?.message ||
        this.translate.instant('navbar.toggleAlertError');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail,
      });
    } finally {
      this.togglingAlertId = null;
    }
  }

  confirmDeleteAlert(alert: AlertResponse): void {
    this.confirmationService.confirm({
      message: this.translate.instant('navbar.deleteAlertConfirm'),
      header: this.translate.instant('navbar.deleteAlert'),
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.deleteAlert(alert._id)
    });
  }

  private async deleteAlert(alertId: string): Promise<void> {
    this.deletingAlertId = alertId;
    try {
      await firstValueFrom(this.alertsService.deleteAlert(alertId));
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('navbar.deleteAlert'),
        detail: this.translate.instant('navbar.deleteAlertSuccess')
      });
      await this.loadSpeedAlerts();
    } catch (error: any) {
      console.error('❌ Error eliminando alerta:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail:
          error?.error?.message ||
          this.translate.instant('navbar.deleteAlertError')
      });
    } finally {
      this.deletingAlertId = null;
    }
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/auth/login']).then(() => {
      // Forzar un refresh de la página para asegurar que todo se limpie
      window.location.reload();
    });
  }

  /**
   * Actualiza solo los elementos del menú que dependen del estado de selección
   */
  private updateMenuItems() {
    this.selectedActionItems = this.selectedActionItems.map(item => ({
      ...item,
      disabled: !this.hasSelectedTargets
    }));
  }

  get bulkProcessSuccessCount(): number {
    return this.bulkProcessResults.filter(result => result.status === 'success').length;
  }

  get bulkProcessErrorCount(): number {
    return this.bulkProcessResults.filter(result => result.status === 'error').length;
  }

  get bulkProcessIsFinished(): boolean {
    return this.bulkProcessResults.length > 0
      && this.bulkProcessResults.every(result => result.status === 'success' || result.status === 'error');
  }

  get canApplyBulkProcess(): boolean {
    if (
      this.applyingBulkProcess
      || this.bulkProcessCatalogLoading
      || !this.bulkProcessForm.type
      || !this.bulkProcessForm.registrationDate
      || this.currentSelectedTargets.length === 0
    ) {
      return false;
    }

    switch (this.bulkProcessForm.type) {
      case 'installation':
        return !!this.bulkProcessForm.newInstallationDate;
      case 'expiration':
        return !!this.bulkProcessForm.newExpirationDate;
      case 'renewal':
        return Number(this.bulkProcessForm.renewalYears) > 0;
      case 'technician_change':
        return !!this.bulkProcessForm.newTechnician;
      case 'installation_details_change':
        return !!this.bulkProcessForm.newInstallationDetails.trim();
      case 'gps_model_change':
        return !!this.bulkProcessForm.newGpsModel;
      case 'sim_type_change':
        return !!this.bulkProcessForm.newSimType;
      default:
        return false;
    }
  }

  async openBulkProcessDialog(): Promise<void> {
    const selectedTargets = this.selectionService.selectedTargetsValue || [];
    if (!selectedTargets.length) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sin objetivos',
        detail: 'Seleccione al menos un objetivo para realizar el proceso.'
      });
      return;
    }

    this.resetBulkProcessForm();
    this.bulkProcessResults = selectedTargets.map(target => ({
      target_id: String(target?._id || target?.id || ''),
      target_name: target?.name || 'Objetivo sin nombre',
      target_imei: target?.device_imei || target?.imei || '',
      status: 'pending'
    }));
    this.bulkProcessDialogVisible = true;
    await this.loadBulkProcessCatalogs();
  }

  onBulkProcessTypeChange(): void {
    this.bulkProcessResults = this.bulkProcessResults.map(result => ({
      ...result,
      status: 'pending',
      error: undefined
    }));
    this.bulkProcessProgress = 0;
  }

  closeBulkProcessDialog(): void {
    if (this.applyingBulkProcess) {
      return;
    }
    this.bulkProcessDialogVisible = false;
  }

  async applyBulkProcess(): Promise<void> {
    if (!this.canApplyBulkProcess) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Datos incompletos',
        detail: 'Complete los datos requeridos para aplicar el proceso.'
      });
      return;
    }

    const selectedTargets = [...this.currentSelectedTargets];
    if (!selectedTargets.length) {
      return;
    }

    this.applyingBulkProcess = true;
    this.bulkProcessProgress = 0;
    this.bulkProcessResults = selectedTargets.map(target => ({
      target_id: String(target?._id || (target as any)?.id || ''),
      target_name: target?.name || 'Objetivo sin nombre',
      target_imei: target?.device_imei || target?.imei || '',
      status: 'pending'
    }));

    for (let index = 0; index < selectedTargets.length; index++) {
      const selectedTarget = selectedTargets[index];
      const targetId = String(selectedTarget?._id || (selectedTarget as any)?.id || '');
      const result = this.bulkProcessResults[index];
      result.status = 'processing';

      try {
        if (!targetId) {
          throw new Error('El objetivo no tiene un identificador válido.');
        }

        const target = await this.targetsService.getTargetById(targetId);
        const change = this.buildBulkProcessChange(target);
        const currentUser = this.authService.getCurrentUser();
        const processType = this.bulkProcessForm.type as BulkProcessType;

        await this.targetsService.updateTarget(targetId, change.update);

        const processData: CreateProcessDto = {
          type: this.getBulkProcessTypeId(processType),
          registrationDate: this.bulkProcessForm.registrationDate,
          description: this.bulkProcessForm.description.trim() || 'Proceso masivo',
          details: change.details,
          target: {
            _id: targetId,
            name: target.name,
            device_imei: target.device_imei || target.imei,
            sim_card_number: target.sim_card_number || target.sim_card
          },
          user: {
            _id: currentUser?.id || 'sistema',
            name: currentUser?.name || 'Sistema',
            email: currentUser?.email || 'sistema@montao.net'
          },
          reference: targetId,
          before: change.before,
          after: {
            ...change.after,
            status: 'completed',
            processType,
            processDate: this.bulkProcessForm.registrationDate,
            bulk: true
          },
          creator: currentUser?.id || 'sistema'
        };

        await this.targetsService.createProcess(processData);
        Object.assign(selectedTarget as any, change.update);
        result.status = 'success';
      } catch (error: any) {
        console.error(`Error aplicando proceso masivo al objetivo ${targetId}:`, error);
        result.status = 'error';
        result.error = this.getBulkProcessErrorMessage(error);
      }

      this.bulkProcessProgress = Math.round(((index + 1) / selectedTargets.length) * 100);
    }

    this.applyingBulkProcess = false;

    if (this.bulkProcessSuccessCount > 0) {
      this.selectionService.notifyTargetsUpdated();
    }

    const allSuccessful = this.bulkProcessErrorCount === 0;
    this.messageService.add({
      severity: allSuccessful ? 'success' : (this.bulkProcessSuccessCount > 0 ? 'warn' : 'error'),
      summary: allSuccessful ? 'Proceso masivo completado' : 'Proceso masivo finalizado',
      detail: `${this.bulkProcessSuccessCount} aplicados, ${this.bulkProcessErrorCount} con error.`
    });
  }

  private resetBulkProcessForm(): void {
    this.bulkProcessForm = {
      type: '',
      registrationDate: this.getLocalDateInputValue(),
      description: '',
      newInstallationDate: '',
      newExpirationDate: '',
      renewalYears: 1,
      newTechnician: '',
      newInstallationDetails: '',
      newGpsModel: '',
      newSimType: ''
    };
    this.bulkProcessProgress = 0;
    this.bulkProcessResults = [];
  }

  private async loadBulkProcessCatalogs(): Promise<void> {
    this.bulkProcessCatalogLoading = true;
    const [techniciansResult, protocolsResult] = await Promise.allSettled([
      firstValueFrom(this.userService.getTechnicians()),
      firstValueFrom(this.protocolsService.getAllProtocols())
    ]);

    if (techniciansResult.status === 'fulfilled') {
      this.bulkProcessTechnicians = techniciansResult.value
        .map((technician: User) => ({
          label: `${technician.name || ''} ${technician.last_name || ''}`.trim(),
          value: String(technician._id || (technician as any).id || '')
        }))
        .filter(option => !!option.value)
        .sort((a, b) => a.label.localeCompare(b.label));
    } else {
      console.error('No se pudieron cargar los técnicos para el proceso masivo:', techniciansResult.reason);
      this.bulkProcessTechnicians = [];
    }

    if (protocolsResult.status === 'fulfilled') {
      this.bulkProcessGpsModels = protocolsResult.value
        .map(protocol => ({
          label: protocol.name,
          value: protocol._id
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
    } else {
      console.error('No se pudieron cargar los modelos GPS para el proceso masivo:', protocolsResult.reason);
      this.bulkProcessGpsModels = [];
    }

    this.bulkProcessCatalogLoading = false;
  }

  private buildBulkProcessChange(target: Target): BulkProcessChange {
    const targetData = target as any;
    const targetName = target.name || target.device_imei || target.imei || 'objetivo';
    const currentUser = this.authService.getCurrentUser();
    const actorName = currentUser?.name || currentUser?.email || 'Usuario';
    const reason = this.bulkProcessForm.description.trim()
      ? ` Motivo: ${this.bulkProcessForm.description.trim()}.`
      : '';

    switch (this.bulkProcessForm.type) {
      case 'installation': {
        const previousDate = targetData.activation_date || target.installation_date || 'no definida';
        const newDate = this.bulkProcessForm.newInstallationDate;
        return {
          update: { activation_date: newDate, last_change_date: new Date() },
          before: { activation_date: previousDate },
          after: { activation_date: newDate },
          details: `El usuario ${actorName} cambió la fecha de instalación de ${targetName} de ${previousDate} a ${newDate}.${reason}`
        };
      }
      case 'expiration': {
        const previousDate = target.expiration_date || 'no definida';
        const newDate = this.bulkProcessForm.newExpirationDate;
        return {
          update: { expiration_date: newDate, last_change_date: new Date() },
          before: { expiration_date: previousDate },
          after: { expiration_date: newDate },
          details: `El usuario ${actorName} cambió la fecha de expiración de ${targetName} de ${previousDate} a ${newDate}.${reason}`
        };
      }
      case 'renewal': {
        if (!target.expiration_date) {
          throw new Error('El objetivo no tiene una fecha de expiración para renovar.');
        }
        const years = Number(this.bulkProcessForm.renewalYears);
        const newDate = this.addYearsToDateInput(target.expiration_date, years);
        return {
          update: { expiration_date: newDate, last_change_date: new Date() },
          before: { expiration_date: target.expiration_date },
          after: { expiration_date: newDate, renewalYears: years },
          details: `El usuario ${actorName} renovó el servicio de ${targetName} por ${years} ${years === 1 ? 'año' : 'años'}, cambiando la expiración de ${target.expiration_date} a ${newDate}.${reason}`
        };
      }
      case 'technician_change': {
        const previousTechnicianId = targetData.mechanic_id || '';
        const previousTechnician = this.getBulkTechnicianLabel(previousTechnicianId) || 'no asignado';
        const newTechnicianId = this.bulkProcessForm.newTechnician;
        const newTechnician = this.getBulkTechnicianLabel(newTechnicianId) || 'técnico seleccionado';
        return {
          update: { mechanic_id: newTechnicianId, last_change_date: new Date() },
          before: { mechanic_id: previousTechnicianId, technician: previousTechnician },
          after: { mechanic_id: newTechnicianId, technician: newTechnician },
          details: `El usuario ${actorName} cambió el técnico de ${targetName} de ${previousTechnician} a ${newTechnician}.${reason}`
        };
      }
      case 'installation_details_change': {
        const previousDetails = target.installation_details || 'no definidos';
        const newDetails = this.bulkProcessForm.newInstallationDetails.trim();
        return {
          update: { installation_details: newDetails, last_change_date: new Date() },
          before: { installation_details: previousDetails },
          after: { installation_details: newDetails },
          details: `El usuario ${actorName} actualizó los detalles de instalación de ${targetName} de "${previousDetails}" a "${newDetails}".${reason}`
        };
      }
      case 'gps_model_change': {
        const previousModelId = targetData.type || targetData.protocol?._id || '';
        const previousModel = this.getBulkGpsModelLabel(previousModelId) || targetData.protocol?.name || 'no definido';
        const newModelId = this.bulkProcessForm.newGpsModel;
        const newModel = this.getBulkGpsModelLabel(newModelId) || 'modelo seleccionado';
        return {
          update: { type: newModelId, last_change_date: new Date() },
          before: { type: previousModelId, gps_model: previousModel },
          after: { type: newModelId, gps_model: newModel },
          details: `El usuario ${actorName} cambió el modelo de GPS de ${targetName} de ${previousModel} a ${newModel}.${reason}`
        };
      }
      case 'sim_type_change': {
        if (targetData.protocol?.isAirtag) {
          throw new Error('El tipo de SIM no aplica para objetivos AirTag.');
        }
        const previousType = target.sim_company || 'no definido';
        const newType = this.bulkProcessForm.newSimType;
        const newTypeLabel = this.bulkProcessSimTypes.find(option => option.value === newType)?.label || newType;
        return {
          update: { sim_company: newType, last_change_date: new Date() },
          before: { sim_company: previousType },
          after: { sim_company: newType },
          details: `El usuario ${actorName} cambió el tipo de SIM de ${targetName} de ${previousType} a ${newTypeLabel}.${reason}`
        };
      }
      default:
        throw new Error('Seleccione un tipo de proceso válido.');
    }
  }

  private getBulkProcessTypeId(type: BulkProcessType): number {
    const processTypes: Record<BulkProcessType, number> = {
      installation: 2,
      expiration: 3,
      renewal: 4,
      technician_change: 8,
      installation_details_change: 10,
      gps_model_change: 11,
      sim_type_change: 15
    };
    return processTypes[type];
  }

  private getBulkTechnicianLabel(id: string): string {
    return this.bulkProcessTechnicians.find(option => option.value === String(id || ''))?.label || '';
  }

  private getBulkGpsModelLabel(id: string): string {
    return this.bulkProcessGpsModels.find(option => option.value === String(id || ''))?.label || '';
  }

  private addYearsToDateInput(dateValue: string, years: number): string {
    const normalizedYears = Number(years);
    if (!Number.isInteger(normalizedYears) || normalizedYears <= 0) {
      throw new Error('La duración de la renovación no es válida.');
    }

    const datePart = String(dateValue).substring(0, 10);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
    if (!match) {
      throw new Error(`La fecha de expiración "${dateValue}" no es válida.`);
    }

    const newDate = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (Number.isNaN(newDate.getTime())) {
      throw new Error(`La fecha de expiración "${dateValue}" no es válida.`);
    }
    newDate.setFullYear(newDate.getFullYear() + normalizedYears);
    return this.getLocalDateInputValue(newDate);
  }

  private getLocalDateInputValue(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getBulkProcessErrorMessage(error: any): string {
    const message = error?.error?.message || error?.message || 'No se pudo aplicar el proceso.';
    return Array.isArray(message) ? message.join(', ') : String(message);
  }

  /**
   * Abre el modal de transferencia de targets
   */
  transferSelectedTargets() {
    const selectedTargets = this.selectionService.selectedTargetsValue || [];
    // Crear una copia para evitar referencias residuales
    this.targetsToTransfer = [...selectedTargets];
    if (!this.targetsToTransfer.length) {
      return;
    }
    this.transferEmailInput = '';
    this.transferEmailError = '';
    this.foundUser = null;
    this.searchingUser = false;
    this.transferring = false;
    this.transferDialogVisible = true;

    // Enfocar el input después de que el modal se abra
    setTimeout(() => {
      this.focusTransferEmailInput();
    }, 300);
  }

  /**
   * Maneja la acción de compartir objetivos seleccionados
   */
  shareSelectedTargets() {
    const selectedTargets = this.selectionService.selectedTargetsValue;
    if (!selectedTargets?.length) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sin objetivos',
        detail: 'Selecciona al menos un objetivo para compartir.'
      });
      return;
    }

    this.targetsToShare = [...selectedTargets];
    this.realtimeGeneratedLink = '';
    this.realtimeGeneratedLinks = [];
    this.realtimeCopySuccess = false;
    this.shareMethodDialogVisible = true;
  }

  async openDeviceAccessShare() {
    this.shareMethodDialogVisible = false;
    const selectedTargets = this.targetsToShare.length ? this.targetsToShare : this.selectionService.selectedTargetsValue;
    console.log('🔗 Compartiendo acceso a objetivos seleccionados:', selectedTargets);

    this.targetsToShare = [...selectedTargets];

    // Resetear estado del modal
    this.newEmailInput = '';
    this.emailInputError = '';
    this.selectedEmails = [];

    // Abrir modal primero
    this.shareDialogVisible = true;

    // Si solo hay un target seleccionado, consultar sus emails compartidos específicos
    if (selectedTargets.length === 1 && selectedTargets[0]._id) {
      await this.loadSharedEmailsFromAPI(selectedTargets[0]._id);
    } else if (selectedTargets.length > 0) {
      // Para múltiples targets, usar los emails del primer target como referencia (legacy)
      if (selectedTargets[0].shared && Array.isArray(selectedTargets[0].shared)) {
        this.selectedEmails = [...selectedTargets[0].shared];
        console.log('📧 Emails compartidos (múltiples targets - referencia):', this.selectedEmails);
      }
    }
  }

  openRealtimeShare() {
    if (!this.targetsToShare.length) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sin objetivos',
        detail: 'Selecciona al menos un objetivo para generar los links.'
      });
      return;
    }

    this.shareMethodDialogVisible = false;
    this.realtimeLinkDialogVisible = true;
    this.realtimeExpirationTime = '24h';
    this.realtimeGeneratedLink = '';
    this.realtimeGeneratedLinks = [];
    this.realtimeCopySuccess = false;
  }

  async generateSelectedRealtimeLink() {
    const uniqueTargets = [...new Map(
      this.targetsToShare
        .map(target => [
          String(target?._id || (target as any)?.id || '').trim(),
          target
        ] as const)
        .filter(([targetId]) => !!targetId)
    ).entries()].map(([targetId, target]) => ({ targetId, target }));

    if (!uniqueTargets.length) {
      this.messageService.add({
        severity: 'error',
        summary: 'Sin objetivos válidos',
        detail: 'No se pudieron identificar los objetivos seleccionados.'
      });
      return;
    }

    try {
      this.generatingRealtimeLink = true;
      this.realtimeGeneratedLink = '';
      this.realtimeGeneratedLinks = [];
      this.realtimeCopySuccess = false;
      const systems = await firstValueFrom(this.systemService.getAll());
      const mapConfig = systems?.[0]?.map_api1 || systems?.[0]?.map_api2;
      const expirationDate = this.getRealtimeExpirationDate(this.realtimeExpirationTime);
      const generatedResults = await Promise.all(
        uniqueTargets.map(async ({ targetId, target }): Promise<RealtimeGeneratedTargetLink | null> => {
          try {
            const shortLink = await this.targetsService.createRealtimeShortLink({
              target_id: targetId,
              expires_at: expirationDate.toISOString(),
              map_key: mapConfig?.key || ''
            });
            if (!shortLink?.short_code) {
              throw new Error('El backend no devolvió un código');
            }
            return {
              target_id: targetId,
              target_name: target.name || 'Objetivo sin nombre',
              target_imei: String(target.device_imei || target.imei || ''),
              url: `${window.location.origin}/realtimelink?c=${encodeURIComponent(shortLink.short_code)}`,
              expires_at: shortLink.expires_at
            };
          } catch (error) {
            console.error(`Error generando link en tiempo real para ${targetId}:`, error);
            return null;
          }
        })
      );

      this.realtimeGeneratedLinks = generatedResults.filter(
        (item): item is RealtimeGeneratedTargetLink => item !== null
      );
      this.realtimeGeneratedLink = this.realtimeGeneratedLinks[0]?.url || '';

      if (!this.realtimeGeneratedLinks.length) {
        throw new Error('No se pudo generar ninguno de los links en tiempo real');
      }

      const failedCount = uniqueTargets.length - this.realtimeGeneratedLinks.length;
      if (failedCount > 0) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Generación parcial',
          detail: `Se generaron ${this.realtimeGeneratedLinks.length} de ${uniqueTargets.length} links. ${failedCount} no pudieron generarse.`
        });
      }
      await this.copyRealtimeLinkToClipboard();
    } catch (error) {
      console.error('Error generando link en tiempo real:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: getApiErrorMessage(error, 'No se pudieron generar los links en tiempo real.')
      });
    } finally {
      this.generatingRealtimeLink = false;
    }
  }

  async copyRealtimeLinkToClipboard(link?: RealtimeGeneratedTargetLink) {
    const clipboardText = link?.url || this.getRealtimeLinksClipboardText();
    if (!clipboardText) return;

    try {
      await navigator.clipboard.writeText(clipboardText);
      this.realtimeCopySuccess = true;
      this.messageService.add({
        severity: 'success',
        summary: link || this.realtimeGeneratedLinks.length === 1
          ? 'Link copiado'
          : 'Links copiados',
        detail: link || this.realtimeGeneratedLinks.length === 1
          ? 'El link en tiempo real fue copiado al portapapeles.'
          : `${this.realtimeGeneratedLinks.length} links fueron copiados al portapapeles.`,
        life: 2500
      });
      setTimeout(() => this.realtimeCopySuccess = false, 3000);
    } catch (error) {
      console.error('Error copiando link:', error);
      this.messageService.add({
        severity: 'warn',
        summary: 'Link generado',
        detail: getApiErrorMessage(error, 'No se pudo copiar automáticamente. Puedes copiarlo manualmente.')
      });
    }
  }

  getRealtimeLinksClipboardText(): string {
    if (!this.realtimeGeneratedLinks.length) {
      return this.realtimeGeneratedLink;
    }
    if (this.realtimeGeneratedLinks.length === 1) {
      return this.realtimeGeneratedLinks[0].url;
    }
    return this.realtimeGeneratedLinks.map(item => [
      `${item.target_name}${item.target_imei ? ` · IMEI ${item.target_imei}` : ''}`,
      item.url
    ].join('\n')).join('\n\n');
  }

  closeRealtimeShare() {
    this.realtimeLinkDialogVisible = false;
    this.realtimeGeneratedLink = '';
    this.realtimeGeneratedLinks = [];
    this.realtimeCopySuccess = false;
    this.generatingRealtimeLink = false;
  }

  getRealtimeExpirationText(timeValue: string): string {
    const expirationTexts: Record<string, string> = {
      '15m': '15 minutos',
      '30m': '30 minutos',
      '1h': '1 hora',
      '2h': '2 horas',
      '8h': '8 horas',
      '15h': '15 horas',
      '24h': '24 horas',
      '2d': '2 días',
      '3d': '3 días',
      '1w': '1 semana',
      '1M': '1 mes'
    };
    return expirationTexts[timeValue] || timeValue;
  }

  private getRealtimeExpirationDate(timeValue: string): Date {
    const expirationDate = new Date();
    const amount = parseInt(timeValue, 10);

    if (timeValue.endsWith('m')) {
      expirationDate.setMinutes(expirationDate.getMinutes() + amount);
    } else if (timeValue.endsWith('h')) {
      expirationDate.setHours(expirationDate.getHours() + amount);
    } else if (timeValue.endsWith('d')) {
      expirationDate.setDate(expirationDate.getDate() + amount);
    } else if (timeValue.endsWith('w')) {
      expirationDate.setDate(expirationDate.getDate() + (amount * 7));
    } else if (timeValue.endsWith('M')) {
      expirationDate.setMonth(expirationDate.getMonth() + amount);
    }

    return expirationDate;
  }

  /**
   * Carga los emails compartidos de un target específico desde la API
   */
  async loadSharedEmailsFromAPI(targetId: string) {
    try {
      this.loadingSharedEmails = true;

      console.log('🔍 Consultando emails compartidos para target:', targetId);

      const response = await this.targetsService.getSharedEmails(targetId);

      console.log('✅ Respuesta de emails compartidos:', response);

      // Cargar los emails compartidos
      if (response.shared && Array.isArray(response.shared)) {
        this.selectedEmails = [...response.shared];
        console.log('📧 Emails compartidos cargados desde API:', this.selectedEmails);
      } else {
        this.selectedEmails = [];
        console.log('📭 No hay emails compartidos para este target');
      }

    } catch (error) {
      console.error('❌ Error al cargar emails compartidos:', error);
      this.selectedEmails = [];

      // Mostrar mensaje de error si es necesario
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: getApiErrorMessage(error, 'No se pudieron cargar los emails compartidos actuales')
      });
    } finally {
      this.loadingSharedEmails = false;
    }
  }

  /**
   * Valida si un email es válido
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Agrega un email a la lista de emails compartidos y auto-guarda
   */
  async addEmail() {
    if (this.verifyingShareRecipient) return;

    const email = this.newEmailInput.trim().toLowerCase();

    // Limpiar error previo
    this.emailInputError = '';

    // Validaciones
    if (!email) {
      this.emailInputError = 'El correo electrónico es requerido';
      return;
    }

    if (!this.isValidEmail(email)) {
      this.emailInputError = 'Por favor ingrese un correo electrónico válido';
      return;
    }

    if (this.selectedEmails.some(selectedEmail => selectedEmail.toLowerCase() === email)) {
      this.emailInputError = 'Este correo ya está en la lista';
      return;
    }

    try {
      this.verifyingShareRecipient = true;
      const recipient = await firstValueFrom(
        this.userService.getDeviceRecipientByEmail(email)
      );
      const recipientEmail = String(recipient?.email || email).trim().toLowerCase();

      if (this.selectedEmails.some(selectedEmail => selectedEmail.toLowerCase() === recipientEmail)) {
        this.emailInputError = 'Este correo ya está en la lista';
        return;
      }

      this.selectedEmails.push(recipientEmail);
      this.newEmailInput = '';

      console.log('➕ Email agregado:', recipientEmail);
      console.log('📧 Lista actual:', this.selectedEmails);

      await this.autoSaveEmailChanges();
    } catch (error: any) {
      this.emailInputError = error?.status === 404
        ? 'No existe un usuario registrado con ese correo electrónico'
        : getApiErrorMessage(error, 'No se pudo verificar el usuario para compartir');
    } finally {
      this.verifyingShareRecipient = false;
    }
  }

  /**
   * Elimina un email de la lista y auto-guarda
   */
  async removeEmail(email: string) {
    this.selectedEmails = this.selectedEmails.filter(e => e !== email);
    console.log('➖ Email eliminado:', email);
    console.log('📧 Lista actual:', this.selectedEmails);

    // Auto-guardar cambios
    await this.autoSaveEmailChanges();
  }

  /**
   * Maneja el evento keypress en el input de email (Enter para agregar)
   */
  onEmailKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addEmail();
    }
  }

  /**
   * Auto-guarda los cambios de emails compartidos
   */
  async autoSaveEmailChanges() {
    // No auto-guardar si ya se está guardando o cargando emails
    if (this.autoSaving || this.loadingSharedEmails) {
      return;
    }

    try {
      this.autoSaving = true;

      console.log('💾 Auto-guardando cambios de emails:', {
        targets: this.targetsToShare.map(t => t._id),
        sharedEmails: this.selectedEmails
      });

      // Actualizar cada target con los emails compartidos
      for (const target of this.targetsToShare) {
        await this.targetsService.updateSharedUsers(target._id!, this.selectedEmails);
      }

      console.log('✅ Cambios auto-guardados exitosamente');

      // Mostrar mensaje sutil de confirmación
      this.messageService.add({
        severity: 'success',
        summary: 'Guardado',
        detail: `Emails actualizados automáticamente`,
        life: 2000 // Mensaje más corto
      });

    } catch (error: any) {
      console.error('❌ Error al auto-guardar emails:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: error.message || 'No se pudieron guardar los cambios automáticamente'
      });
    } finally {
      this.autoSaving = false;
    }
  }

  /**
   * Limpia todos los emails seleccionados y auto-guarda
   */
  async clearAllEmails() {
    this.selectedEmails = [];
    console.log('🗑️ Todos los emails eliminados');

    // Auto-guardar cambios
    await this.autoSaveEmailChanges();
  }

  /**
   * Cancela la acción de compartir
   */
  cancelShareTargets() {
    this.shareDialogVisible = false;
    this.selectedEmails = [];
    this.targetsToShare = [];
    this.newEmailInput = '';
    this.emailInputError = '';
    this.loadingSharedEmails = false;
    this.verifyingShareRecipient = false;
    this.autoSaving = false;
  }

  /**
   * Busca un usuario por email para transferencia
   */
  async searchUserForTransfer() {
    const email = this.transferEmailInput.trim();

    // Limpiar error previo
    this.transferEmailError = '';
    this.foundUser = null;

    // Validaciones
    if (!email) {
      this.transferEmailError = 'El correo electrónico es requerido';
      return;
    }

    if (!this.isValidEmail(email)) {
      this.transferEmailError = 'Por favor ingrese un correo electrónico válido';
      return;
    }

    try {
      this.searchingUser = true;

      // Buscar usuario por email usando endpoint específico
      const user = await firstValueFrom(
        this.userService.getDeviceRecipientByEmail(email)
      );

      if (!user) {
        this.transferEmailError = 'No se encontró ningún usuario con ese correo electrónico';
        return;
      }

      this.foundUser = user;

    } catch (error: any) {
      console.error('❌ Error al buscar usuario:', error);

      // Manejar diferentes tipos de error
      if (error.status === 404) {
        this.transferEmailError = 'No se encontró ningún usuario con ese correo electrónico';
      } else if (error.status === 400) {
        this.transferEmailError = 'Formato de correo electrónico inválido';
      } else {
        this.transferEmailError = getApiErrorMessage(error, 'No se pudo buscar el usuario para la transferencia');
      }
    } finally {
      this.searchingUser = false;
    }
  }

  /**
   * Confirma la transferencia de targets al usuario encontrado
   */
  async confirmTransferTargets() {
    if (!this.foundUser) {
      this.transferEmailError = 'Debe buscar y seleccionar un usuario primero';
      return;
    }

    try {
      this.transferring = true;

      console.log('🔄 Transfiriendo targets:', {
        targets: this.targetsToTransfer.map(t => t._id),
        targetUserId: this.foundUser._id,
        targetUserEmail: this.foundUser.email
      });

      // Transferir cada target
      for (const target of this.targetsToTransfer) {
        await this.targetsService.transferTarget(target._id!, this.foundUser._id);
      }

      // Mostrar mensaje de éxito
      this.messageService.add({
        severity: 'success',
        summary: 'Transferencia Exitosa',
        detail: `${this.targetsToTransfer.length} objetivo(s) transferido(s) a ${this.foundUser.name} ${this.foundUser.last_name}`
      });

      // Cerrar modal y limpiar selección
      this.transferDialogVisible = false;
      this.selectionService.clearSelection();
      this.targetsToTransfer = [];

      // Notificar que los targets han sido actualizados para recargar en management
      this.selectionService.notifyTargetsUpdated();

      console.log('✅ Transferencia completada exitosamente');

    } catch (error: any) {
      console.error('❌ Error al transferir targets:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error en Transferencia',
        detail: error.message || 'No se pudieron transferir los objetivos'
      });
    } finally {
      this.transferring = false;
    }
  }

  /**
   * Cancela la acción de transferir
   */
  cancelTransferTargets() {
    this.transferDialogVisible = false;
    this.targetsToTransfer = [];
    this.transferEmailInput = '';
    this.transferEmailError = '';
    this.foundUser = null;
    this.searchingUser = false;
    this.transferring = false;
  }

  /**
   * Manejo de eventos del input de email de transferencia
   */
  onTransferEmailInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.transferEmailInput = target.value;
  }

  onTransferEmailInputKeypress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.searchUserForTransfer();
    }
  }

  onTransferEmailInputClick(event: Event) {
    event.stopPropagation();

    // Asegurar focus
    const target = event.target as HTMLInputElement;
    target.focus();
  }

  onTransferEmailInputFocus(event: Event) {
    // Posicionar cursor al final del texto
    const target = event.target as HTMLInputElement;
    target.setSelectionRange(target.value.length, target.value.length);
  }

  /**
   * Enfoca el input de email de transferencia
   */
  focusTransferEmailInput() {
    try {
      if (this.transferEmailRef && this.transferEmailRef.nativeElement) {
        const input = this.transferEmailRef.nativeElement;

        // Asegurar que el input esté habilitado y enfocado
        input.disabled = false;
        input.readOnly = false;
        input.focus();
        input.click();
      }
    } catch (error) {
      console.error('Error al enfocar input de transferencia:', error);
    }
  }

  /**
   * Abre el drawer de objetivos cancelados
   */
  async openCanceledTargetsDrawer() {
    this.canceledDrawerVisible = true;
    this.canceledSearchTerm = '';
    this.canceledSearchResults = [];
    await this.loadCanceledTargets();
  }

  /**
   * Carga los objetivos cancelados desde la API con paginación
   */
  async loadCanceledTargets() {
    try {
      this.loadingCanceledTargets = true;

      // Resetear paginación
      this.canceledTargetsOffset = 0;
      this.canceledTargets = [];
      this.hasMoreCanceledTargets = true;

      // Obtener el parent ID desde la URL
      const parentId = this.getParentIdFromUrl();

      if (!parentId) {
        console.warn('⚠️ No se pudo obtener el parent ID desde la URL, cancelando carga de objetivos cancelados');
        this.canceledTargets = [];
        return;
      }

      console.log('🚀 Cargando objetivos cancelados para parent ID:', parentId);

      // Cargar primera página de objetivos cancelados
      const dateFromISO = this.canceledDateFrom ? this.canceledDateFrom.toISOString() : undefined;
      const dateToISO = this.canceledDateTo ? this.canceledDateTo.toISOString() : undefined;
      const modDateFromISO = this.canceledModDateFrom ? this.canceledModDateFrom.toISOString() : undefined;
      const modDateToISO = this.canceledModDateTo ? this.canceledModDateTo.toISOString() : undefined;

      const response = await this.targetsService.getCanceledTargetsWithPagination(
        parentId,
        this.canceledTargetsOffset,
        this.canceledTargetsPageSize,
        dateFromISO,
        dateToISO,
        this.canceledSimCompany || undefined,
        modDateFromISO,
        modDateToISO
      );

      this.canceledTargets = response.devices;
      this.totalCanceledTargetsCount = response.totalCount;
      this.hasMoreCanceledTargets = this.canceledTargets.length < this.totalCanceledTargetsCount;
      this.canceledTargetsOffset += this.canceledTargetsPageSize;

      console.log('✅ Objetivos cancelados cargados exitosamente:', {
        cantidad: this.canceledTargets.length,
        total: this.totalCanceledTargetsCount,
        hasMore: this.hasMoreCanceledTargets
      });

    } catch (error) {
      console.error('❌ Error al cargar objetivos cancelados:', error);
      this.canceledTargets = [];
      this.totalCanceledTargetsCount = 0;
      this.hasMoreCanceledTargets = false;
    } finally {
      this.loadingCanceledTargets = false;
    }
  }

  /**
   * Carga más objetivos cancelados para el scroll infinito
   */
  async loadMoreCanceledTargets() {
    if (!this.hasMoreCanceledTargets || this.loadingMoreCanceledTargets) {
      return;
    }

    try {
      this.loadingMoreCanceledTargets = true;

      // Obtener el parent ID desde la URL
      const parentId = this.getParentIdFromUrl();

      if (!parentId) {
        console.warn('⚠️ No se pudo obtener el parent ID desde la URL para cargar más objetivos cancelados');
        return;
      }

      console.log('🔄 Cargando más objetivos cancelados:', {
        parentId,
        offset: this.canceledTargetsOffset,
        pageSize: this.canceledTargetsPageSize
      });

      // Cargar siguiente página de objetivos cancelados
      const dateFromISO = this.canceledDateFrom ? this.canceledDateFrom.toISOString() : undefined;
      const dateToISO = this.canceledDateTo ? this.canceledDateTo.toISOString() : undefined;
      const modDateFromISO = this.canceledModDateFrom ? this.canceledModDateFrom.toISOString() : undefined;
      const modDateToISO = this.canceledModDateTo ? this.canceledModDateTo.toISOString() : undefined;

      const response = await this.targetsService.getCanceledTargetsWithPagination(
        parentId,
        this.canceledTargetsOffset,
        this.canceledTargetsPageSize,
        dateFromISO,
        dateToISO,
        this.canceledSimCompany || undefined,
        modDateFromISO,
        modDateToISO
      );

      // Agregar nuevos targets a la lista existente
      this.canceledTargets = [...this.canceledTargets, ...response.devices];
      this.totalCanceledTargetsCount = response.totalCount;
      this.hasMoreCanceledTargets = this.canceledTargets.length < this.totalCanceledTargetsCount;
      this.canceledTargetsOffset += this.canceledTargetsPageSize;

      console.log('✅ Más objetivos cancelados cargados:', {
        nuevos: response.devices.length,
        total: this.canceledTargets.length,
        hasMore: this.hasMoreCanceledTargets
      });

    } catch (error) {
      console.error('❌ Error al cargar más objetivos cancelados:', error);
    } finally {
      this.loadingMoreCanceledTargets = false;
    }
  }

  /**
   * Maneja el evento de scroll en la lista de targets cancelados
   */
  onCanceledTargetsScroll(event: Event) {
    const element = event.target as HTMLElement;
    const threshold = 50; // pixels desde el final

    const atBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + threshold;

    if (atBottom && this.hasMoreCanceledTargets && !this.loadingMoreCanceledTargets) {
      console.log('🔄 Scroll infinito detectado - cargando más targets cancelados');
      this.loadMoreCanceledTargets();
    }
  }

  /**
   * Obtiene el parent ID desde la URL actual
   */
  private getParentIdFromUrl(): string | null {
    const url = this.router.url;
    console.log('🔍 URL actual para extraer parent ID:', url);

    // El routing de management es /admin/management/:op/:user
    // Necesitamos extraer el parámetro 'user' que es el segundo después de 'management'
    const managementPattern = /\/admin\/management\/([^\/\?]+)\/([^\/\?]+)/;
    const match = url.match(managementPattern);

    if (match && match[2]) {
      const parentId = match[2];
      console.log('✅ Parent ID extraído de la URL:', parentId);
      return parentId;
    }

    // Fallback: Si no se encuentra el patrón, intentar obtener desde route.snapshot.params
    try {
      const routeParams = this.route.snapshot.params;
      console.log('📋 Route params como fallback:', routeParams);

      if (routeParams['user']) {
        console.log('✅ Parent ID desde route params:', routeParams['user']);
        return routeParams['user'];
      }
    } catch (error) {
      console.warn('⚠️ Error al obtener parámetros de ruta:', error);
    }

    console.warn('❌ No se pudo extraer parent ID desde la URL:', url);
    return null;
  }

  /**
   * Maneja la entrada de búsqueda (con debounce)
   */
  onCanceledSearch() {
    const searchTerm = this.canceledSearchTerm.trim();
    this.searchCanceledSubject$.next(searchTerm);
  }

  /**
   * Realiza la búsqueda de objetivos cancelados (llamado por el debounce)
   */
  async performCanceledSearch(searchTerm: string) {
    if (!searchTerm) {
      // Si no hay término de búsqueda, mostrar todos los objetivos cancelados
      this.canceledSearchResults = [];
      return;
    }

    if (searchTerm.length < 2) {
      // Requiere al menos 2 caracteres para buscar
      return;
    }

    try {
      this.isSearchingCanceled = true;

      const parentId = this.getParentIdFromUrl();
      if (!parentId) {
        console.warn('⚠️ No se puede buscar sin parent ID');
        return;
      }

      console.log('🔍 Buscando objetivos cancelados:', {
        parentId,
        searchTerm
      });

      this.canceledSearchResults = await this.targetsService.searchCanceledTargets(parentId, searchTerm);

      console.log('✅ Resultados de búsqueda de objetivos cancelados:', {
        cantidad: this.canceledSearchResults.length,
        resultados: this.canceledSearchResults
      });

    } catch (error) {
      console.error('❌ Error al buscar objetivos cancelados:', error);
      this.canceledSearchResults = [];
    } finally {
      this.isSearchingCanceled = false;
    }
  }

  /**
   * Limpia la búsqueda de objetivos cancelados
   */
  clearCanceledSearch() {
    this.canceledSearchTerm = '';
    this.canceledSearchResults = [];
  }

  /**
   * Obtiene los objetivos a mostrar (resultados de búsqueda o todos)
   */
  get displayedCanceledTargets(): Target[] {
    return this.canceledSearchResults.length > 0 || this.canceledSearchTerm.trim()
      ? this.canceledSearchResults
      : this.canceledTargets;
  }

  /**
   * Filtra los objetivos cancelados por rango de fecha de activación
   */
  onCanceledDateFilter() {
    this.canceledSearchTerm = '';
    this.canceledSearchResults = [];
    this.loadCanceledTargets();
  }

  /**
   * Limpia los filtros de fecha
   */
  clearCanceledDateFilter() {
    this.canceledDateFrom = null;
    this.canceledDateTo = null;
    this.canceledModDateFrom = null;
    this.canceledModDateTo = null;
    this.loadCanceledTargets();
  }

  /**
   * Filtra los objetivos cancelados por compañía de SIM
   */
  onCanceledSimCompanyFilter() {
    this.canceledSearchTerm = '';
    this.canceledSearchResults = [];
    this.loadCanceledTargets();
  }

  /**
   * Exporta los dispositivos cancelados a Excel
   */
  async exportCanceledExcel() {
    try {
      const parentId = this.getParentIdFromUrl() || '';
      const dateFromISO = this.canceledDateFrom ? this.canceledDateFrom.toISOString() : undefined;
      const dateToISO = this.canceledDateTo ? this.canceledDateTo.toISOString() : undefined;
      const modDateFromISO = this.canceledModDateFrom ? this.canceledModDateFrom.toISOString() : undefined;
      const modDateToISO = this.canceledModDateTo ? this.canceledModDateTo.toISOString() : undefined;

      // Traer todos los registros con los filtros actuales
      const response = await this.targetsService.getCanceledTargetsWithPagination(
        parentId, 0, 10000, dateFromISO, dateToISO, this.canceledSimCompany || undefined, modDateFromISO, modDateToISO
      );

      const targets = response.devices;
      if (!targets.length) {
        this.messageService.add({ severity: 'warn', summary: 'Sin datos', detail: 'No hay dispositivos cancelados para exportar' });
        return;
      }

      const data = targets.map((t: any) => ({
        'Nombre': t.name || '',
        'IMEI': t.device_imei || t.imei || '',
        'SIM Card': t.sim_card_number || t.sim_card || '',
        'Compañía SIM': (t.sim_company || '').toUpperCase(),
        'Placa': t.target_plate_number || t.plate || '',
        'Tipo': t.type || '',
        'Fecha Activación': t.activation_date ? new Date(t.activation_date).toLocaleDateString('es-DO') : '',
        'Color': t.target_color || t.color || '',
        'Año': t.target_year || t.year || '',
        'Descripción': t.description || '',
      }));

      const ws = XLSX.utils.json_to_sheet(data);

      // Ancho de columnas
      ws['!cols'] = [
        { wch: 25 }, // Nombre
        { wch: 18 }, // IMEI
        { wch: 20 }, // SIM Card
        { wch: 14 }, // Compañía SIM
        { wch: 12 }, // Placa
        { wch: 14 }, // Tipo
        { wch: 16 }, // Fecha Activación
        { wch: 12 }, // Color
        { wch: 8 },  // Año
        { wch: 30 }, // Descripción
      ];

      // Estilo del header
      const headerStyle = {
        fill: { fgColor: { rgb: 'CC0000' } },
        font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 11 },
        alignment: { horizontal: 'center' }
      };
      const colLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
      colLetters.forEach(col => {
        const cell = ws[`${col}1`];
        if (cell) cell.s = headerStyle;
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Cancelados');
      XLSX.writeFile(wb, `dispositivos_cancelados_${new Date().toISOString().split('T')[0]}.xlsx`);

      this.messageService.add({ severity: 'success', summary: 'Exportado', detail: `${targets.length} dispositivos exportados` });
    } catch (error) {
      console.error('Error exportando Excel:', error);
      this.messageService.add({ severity: 'error', summary: 'Error', detail: getApiErrorMessage(error, 'No se pudo exportar el archivo') });
    }
  }

  /**
   * Muestra los detalles de un target cancelado
   */
  async showTargetDetails(target: Target) {
    this.selectedTargetDetails = target;
    this.targetDetailsVisible = true;
    await this.loadTargetProcesses(target);
  }

  /**
   * Restaura un target cancelado
   */
  async restoreTarget(targetId: string) {
    console.log('🔄 Iniciando restauración de target:', targetId);

    if (!targetId) {
      console.error('❌ ID del target es requerido para restaurar');
      return;
    }

    try {
      // Mostrar confirmación
      this.confirmationService.confirm({
        message: '¿Está seguro de que desea restaurar este target?',
        header: 'Confirmar restauración',
        icon: 'pi pi-refresh',
        acceptLabel: 'Sí, restaurar',
        rejectLabel: 'Cancelar',
        accept: async () => {
          try {
            // Llamar al servicio para restaurar
            console.log('📡 Ejecutando restauración...');
            await this.targetsService.restoreTarget(targetId);

            // Mostrar mensaje de éxito
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Target restaurado correctamente'
            });

            // Registrar proceso de restauración
            await this.registerRestorationProcess(targetId);

            // Actualizar la lista de cancelados
            await this.loadCanceledTargets();

            // Notificar que se han actualizado objetivos para refrescar management
            this.selectionService.notifyTargetsUpdated();

            // Cerrar el modal de detalles si está abierto
            if (this.targetDetailsVisible && this.selectedTargetDetails?._id === targetId) {
              this.closeTargetDetails();
            }

          } catch (error: any) {
            console.error('❌ Error al restaurar target:', error);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: error.message || 'Error al restaurar el target'
            });
          }
        }
      });

    } catch (error: any) {
      console.error('❌ Error en el proceso de restauración:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: getApiErrorMessage(error, 'Error al procesar la restauración')
      });
    }
  }

  /**
   * Elimina permanentemente un target cancelado
   */
  async deleteTarget(targetId: string) {
    console.log('🗑️ Iniciando eliminación permanente de target:', targetId);

    if (!targetId) {
      console.error('❌ ID del target es requerido para eliminar');
      return;
    }

    try {
      // Mostrar confirmación más estricta para eliminación permanente
      this.confirmationService.confirm({
        message: '¿Está seguro de que desea ELIMINAR PERMANENTEMENTE este target? Esta acción no se puede deshacer.',
        header: 'Confirmar eliminación permanente',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Sí, eliminar permanentemente',
        rejectLabel: 'Cancelar',
        acceptButtonStyleClass: 'p-button-danger',
        accept: async () => {
          try {
            // Llamar al servicio para eliminar
            console.log('📡 Ejecutando eliminación permanente...');
            await this.targetsService.deleteTarget(targetId);

            // Mostrar mensaje de éxito
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Target eliminado permanentemente'
            });

            // Registrar proceso de eliminación
            await this.registerDeletionProcess(targetId);

            // Actualizar la lista de cancelados
            await this.loadCanceledTargets();

            // Notificar que se han actualizado objetivos para refrescar management
            this.selectionService.notifyTargetsUpdated();

            // Cerrar el modal de detalles si está abierto
            if (this.targetDetailsVisible && this.selectedTargetDetails?._id === targetId) {
              this.closeTargetDetails();
            }

          } catch (error: any) {
            console.error('❌ Error al eliminar target:', error);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: error.message || 'Error al eliminar el target'
            });
          }
        }
      });

    } catch (error: any) {
      console.error('❌ Error en el proceso de eliminación:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: getApiErrorMessage(error, 'Error al procesar la eliminación')
      });
    }
  }

  /**
   * Registra un proceso de restauración para el target
   */
  private async registerRestorationProcess(targetId: string): Promise<void> {
    try {
      console.log('📝 Registrando proceso de restauración para target:', targetId);

      // Obtener información del target restaurado
      const targetDetails = this.selectedTargetDetails || this.canceledTargets.find(t => t._id === targetId);
      if (!targetDetails) {
        console.warn('⚠️ No se encontró información del target para registrar el proceso');
        return;
      }

      const currentUser = this.authService.getCurrentUser();
      const currentDate = new Date().toISOString();

      // Preparar los datos del proceso de restauración
      const processData: CreateProcessDto = {
        type: this.processTypeMap['restoration'] || 16,
        registrationDate: currentDate,
        description: 'Target restaurado desde cancelados',
        details: `El target "${targetDetails.name}" fue restaurado desde el estado cancelado por el usuario ${currentUser?.name || 'Sistema'}.`,
        target: {
          _id: targetDetails._id,
          name: targetDetails.name,
          device_imei: targetDetails.device_imei || targetDetails.imei,
          sim_card_number: targetDetails.sim_card_number || targetDetails.sim_card
        },
        user: {
          _id: currentUser?.id || "sistema_id",
          name: currentUser?.name || "Sistema",
          email: currentUser?.email || "sistema@montao.com"
        },
        reference: targetDetails._id,
        before: {
          status: "canceled",
          lastProcess: null
        },
        after: {
          status: "restored",
          processType: 'restoration',
          processDate: currentDate
        },
        creator: currentUser?.id || "sistema_id"
      };

      // Registrar el proceso
      await this.targetsService.createProcess(processData);
      console.log('✅ Proceso de restauración registrado exitosamente');

    } catch (error: any) {
      console.error('❌ Error al registrar proceso de restauración:', error);
      // No mostramos error al usuario para no interrumpir el flujo, solo lo logueamos
    }
  }

  /**
   * Registra un proceso de eliminación para el target
   */
  private async registerDeletionProcess(targetId: string): Promise<void> {
    try {
      console.log('📝 Registrando proceso de eliminación para target:', targetId);

      // Obtener información del target eliminado
      const targetDetails = this.selectedTargetDetails || this.canceledTargets.find(t => t._id === targetId);
      if (!targetDetails) {
        console.warn('⚠️ No se encontró información del target para registrar el proceso');
        return;
      }

      const currentUser = this.authService.getCurrentUser();
      const currentDate = new Date().toISOString();

      // Preparar los datos del proceso de eliminación
      const processData: CreateProcessDto = {
        type: this.processTypeMap['deletion'] || 17, // Tipo de eliminación
        registrationDate: currentDate,
        description: 'Target eliminado permanentemente',
        details: `El target "${targetDetails.name}" fue eliminado permanentemente del sistema por el usuario ${currentUser?.name || 'Sistema'}.`,
        target: {
          _id: targetDetails._id,
          name: targetDetails.name,
          device_imei: targetDetails.device_imei || targetDetails.imei,
          plate: targetDetails.plate || 'N/A'
        },
        user: {
          _id: currentUser?.id || 'system',
          name: currentUser?.name || 'Sistema',
          email: currentUser?.email || 'system@montaogps.com'
        },
        reference: targetId,
        before: {
          status: 'canceled',
          name: targetDetails.name
        },
        after: {
          status: 'deleted',
          name: targetDetails.name
        },
        creator: currentUser?.id || 'system'
      };

      // Crear el proceso
      await this.targetsService.createProcess(processData);

      console.log('✅ Proceso de eliminación registrado exitosamente');

    } catch (error: any) {
      console.error('❌ Error al registrar proceso de eliminación:', error);
      // No mostramos error al usuario para no interrumpir el flujo, solo lo logueamos
    }
  }

  /**
   * Carga los procesos de un target específico
   */
  async loadTargetProcesses(target: Target) {
    try {
      this.loadingTargetProcesses = true;
      this.targetProcesses = [];

      const targetId = target._id;
      console.log('🔍 Cargando procesos para target:', targetId);

      // Cargar procesos usando el ID del target
      this.targetProcesses = await this.targetsService.getProcessesByReference(targetId);

      console.log('✅ Procesos del objetivo cargados:', {
        targetId,
        cantidad: this.targetProcesses.length,
        procesos: this.targetProcesses
      });

    } catch (error) {
      console.error('❌ Error al cargar procesos del target:', error);
      this.targetProcesses = [];
    } finally {
      this.loadingTargetProcesses = false;
    }
  }

  /**
   * Cierra el modal de detalles
   */
  closeTargetDetails() {
    this.targetDetailsVisible = false;
    this.selectedTargetDetails = null;
    this.targetProcesses = [];
    this.loadingTargetProcesses = false;
  }

  /**
   * Obtiene el texto de visualización de los contactos
   */
  getContactsDisplayText(contacts: any): string {
    if (!contacts) return 'No especificado';

    if (Array.isArray(contacts)) {
      return contacts.join(', ');
    }

    if (typeof contacts === 'string') {
      return contacts;
    }

    return JSON.stringify(contacts);
  }

  /**
   * Obtiene la clase CSS para el estado de Traccar
   */
  getTraccarStatusClass(status: string): string {
    if (!status) return '';

    switch (status.toLowerCase()) {
      case 'online':
        return 'online';
      case 'offline':
        return 'canceled';
      default:
        return '';
    }
  }

  /**
   * Obtiene el texto de visualización para Yes/No
   */
  getYesNoDisplayText(value: any): string {
    if (!value) return 'No especificado';

    if (typeof value === 'string') {
      switch (value.toLowerCase()) {
        case 'yes':
        case 'sí':
        case 'si':
        case 'true':
          return 'Sí';
        case 'no':
        case 'false':
          return 'No';
        default:
          return value;
      }
    }

    if (typeof value === 'boolean') {
      return value ? 'Sí' : 'No';
    }

    return String(value);
  }

  /**
   * Obtiene el texto de visualización del estado
   */
  getStatusDisplayText(status: any): string {
    if (!status) return 'No especificado';

    if (typeof status === 'string') {
      switch (status.toLowerCase()) {
        case 'active':
          return 'Activo';
        case 'inactive':
          return 'Inactivo';
        default:
          return status;
      }
    }

    if (typeof status === 'boolean') {
      return status ? 'Activo' : 'Inactivo';
    }

    return String(status);
  }

  /**
   * Obtiene el texto de visualización de la marca
   */
  getBrandDisplayText(brandId: string): string {
    if (!brandId) return '';
    // Aquí podrías hacer una búsqueda en un array de marcas si tienes los datos
    // Por ahora devolvemos el ID
    return brandId;
  }

  /**
   * Obtiene el texto de visualización del modelo
   */
  getModelDisplayText(modelId: string): string {
    if (!modelId) return '';
    // Aquí podrías hacer una búsqueda en un array de modelos si tienes los datos
    // Por ahora devolvemos el ID
    return modelId;
  }

  /**
   * Obtiene el texto de visualización del color
   */
  getColorDisplayText(colorValue: string): string {
    if (!colorValue) return '';

    // Si es un valor hex, podrías convertirlo a nombre
    const colorNames: { [key: string]: string } = {
      '#FFFFFF': 'Blanco',
      '#000000': 'Negro',
      '#FF0000': 'Rojo',
      '#0000FF': 'Azul',
      '#008000': 'Verde',
      '#FFFF00': 'Amarillo',
      '#FFA500': 'Naranja',
      '#800080': 'Púrpura',
      '#A0A0A0': 'Gris',
      '#C0C0C0': 'Plata'
    };

    return colorNames[colorValue] || colorValue;
  }

  // Connection Alert Methods

  openConnectionAlertModal(): void {
    this.connectionAlertDialogVisible = true;
    if (this.currentUser?.email) {
      this.connectionNotificationEmail = this.currentUser.email;
      if (this.currentUser.id) {
        this.connectionNotificationEmailUserId = this.currentUser.id;
      }
    }
  }

  onConnectionNotificationEmailChange(): void {
    if (
      this.connectionNotificationEmail &&
      this.currentUser?.email &&
      this.connectionNotificationEmail.trim().toLowerCase() ===
      this.currentUser.email.toLowerCase() &&
      this.currentUser?.id
    ) {
      this.connectionNotificationEmailUserId = this.currentUser.id;
    } else {
      this.connectionNotificationEmailUserId = null;
    }
  }

  async verifyConnectionNotificationEmail(): Promise<void> {
    const email = this.connectionNotificationEmail?.trim();
    if (!email) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('common.warning'),
        detail: this.translate.instant('navbar.verifyEmailRequired')
      });
      return;
    }

    if (
      this.currentUser?.email &&
      email.toLowerCase() === this.currentUser.email.toLowerCase() &&
      this.currentUser?.id
    ) {
      this.connectionNotificationEmailUserId = this.currentUser.id;
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('common.success'),
        detail: this.translate.instant('navbar.verifyEmailSuccess')
      });
      return;
    }

    this.verifyingConnectionNotificationEmail = true;
    try {
      const user = await firstValueFrom(this.userService.getByEmail(email));
      const userId = user?._id || (user as any)?.id;

      if (userId) {
        this.connectionNotificationEmailUserId = userId;
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('common.success'),
          detail: this.translate.instant('navbar.verifyEmailSuccess')
        });
      } else {
        this.connectionNotificationEmailUserId = null;
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('common.warning'),
          detail: this.translate.instant('navbar.verifyEmailNotFound')
        });
      }
    } catch (error) {
      this.connectionNotificationEmailUserId = null;
      console.error('❌ Error verificando correo para alerta de conexión:', error);
      const detail =
        (error as any)?.error?.message ||
        this.translate.instant('navbar.verifyEmailError');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail
      });
    } finally {
      this.verifyingConnectionNotificationEmail = false;
    }
  }

  async createConnectionAlert(): Promise<void> {
    const targetIds = this.getSelectedAlertTargetIds();
    if (!this.ensureAlertTargetsSelected(targetIds)) return;
    if (!this.ensureAlertScheduleValid()) return;

    if (this.connectionNotificationEmail?.trim() && !this.connectionNotificationEmailUserId) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('common.warning'),
        detail: this.translate.instant('navbar.verifyEmailPending')
      });
      return;
    }

    const payload = {
      type: 'connection' as const,
      connectionAlertType: this.connectionAlertType,
      targetIds,
      userTopic: this.connectionNotificationEmailUserId || undefined,
      email: this.connectionNotificationEmail || undefined,
      message: this.connectionAlertMessage?.trim() || undefined,
      oneNotificationEveryFiveHours: this.connectionAlertFiveHourLimit,
      ...this.activeAlertPresetMetadata,
    };

    this.creatingConnectionAlert = true;

    try {
      await firstValueFrom(this.alertsService.createAlert(payload));

      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('navbar.createAlert'),
        detail: `${this.translate.instant('navbar.alertOptionConnection')} creada exitosamente`
      });

      this.connectionAlertMessage = '';
      this.connectionAlertFiveHourLimit = false;
      this.resetConnectionNotificationEmail();
      await this.loadConnectionAlerts();
    } catch (error: any) {
      console.error('❌ Error al crear la alerta de conexión:', error);
      const detail = error?.error?.message ||
        this.translate.instant('navbar.createAlertError');

      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail
      });
    } finally {
      this.creatingConnectionAlert = false;
    }
  }

  private resetConnectionNotificationEmail(): void {
    if (this.currentUser?.email && this.currentUser?.id) {
      this.connectionNotificationEmail = this.currentUser.email;
      this.connectionNotificationEmailUserId = this.currentUser.id;
    } else {
      this.connectionNotificationEmail = '';
      this.connectionNotificationEmailUserId = null;
    }
  }

  async loadConnectionAlerts(): Promise<void> {
    this.loadingConnectionAlerts = true;
    try {
      const allAlerts = await firstValueFrom(
        this.alertsService.getAlerts(this.getSelectedAlertTargetIds())
      );
      this.connectionAlerts = allAlerts.filter(alert => alert.type === 'connection');
      this.filterConnectionAlertsForSelection();
    } catch (error) {
      console.error('Error loading connection alerts:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: getApiErrorMessage(error, 'No se pudieron cargar las alertas de conexión')
      });
    } finally {
      this.loadingConnectionAlerts = false;
    }
  }

  filterConnectionAlertsForSelection(): void {
    if (!this.connectionAlerts.length) {
      this.visibleConnectionAlerts = [];
      return;
    }

    const selectedIds = new Set(
      this.currentSelectedTargets
        .map(t => t._id || (t as any).id)
        .filter(id => !!id)
    );

    if (selectedIds.size === 0) {
      this.visibleConnectionAlerts = [];
      return;
    }

    this.visibleConnectionAlerts = this.connectionAlerts.filter(alert => {
      if (!alert.targetIds || alert.targetIds.length === 0) return false;
      return alert.targetIds.some(id => selectedIds.has(id));
    });
  }

  async toggleConnectionAlert(alert: AlertResponse): Promise<void> {
    if (!alert._id) return;

    this.togglingConnectionAlertId = alert._id;
    const newStatus = alert.status === 'active' ? 'inactive' : 'active';

    try {
      await firstValueFrom(this.alertsService.updateAlertStatus(alert._id, newStatus));
      alert.status = newStatus;
      this.messageService.add({
        severity: 'success',
        summary: 'Actualizado',
        detail: `Alerta ${newStatus === 'active' ? 'activada' : 'desactivada'}`
      });
    } catch (error) {
      console.error('Error toggling alert:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: getApiErrorMessage(error, 'No se pudo actualizar el estado de la alerta')
      });
    } finally {
      this.togglingConnectionAlertId = null;
    }
  }

  async deleteConnectionAlert(alertId: string): Promise<void> {
    this.deletingConnectionAlertId = alertId;
    try {
      await firstValueFrom(this.alertsService.deleteAlert(alertId));
      this.connectionAlerts = this.connectionAlerts.filter(a => a._id !== alertId);
      this.filterConnectionAlertsForSelection();
      this.messageService.add({
        severity: 'success',
        summary: 'Eliminado',
        detail: 'Alerta eliminada exitosamente'
      });
    } catch (error) {
      console.error('Error deleting alert:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: getApiErrorMessage(error, 'No se pudo eliminar la alerta')
      });
    } finally {
      this.deletingConnectionAlertId = null;
    }
  }
}
// Force Rebuild Sat Feb 14 19:23:32 AST 2026
// Force Cache Bust Sat Feb 14 19:27:29 AST 2026
// Force Rebuild Spacing Sat Feb 14 19:32:47 AST 2026
