// Angular imports
import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { Router, ActivatedRoute } from '@angular/router';
import { EMPTY, Observable, Subscription, Subject, forkJoin, from, lastValueFrom, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, filter, switchMap, map, tap } from 'rxjs/operators';

// Third-party imports
import { MenuItem, ConfirmationService, MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';

// Application imports
import { User, BasicUser, ExtendedUser, convertToExtendedUser } from '@core/interfaces';
import { Target } from '@core/interfaces/target.interface';
import { Tag } from '@core/interfaces/tag.interface';
import { AuthService } from '@core/services/auth.service';
import { UserLatestLocation, UserService, UsersResponse } from '@core/services/user.service';
import { HistoryBlockResponse, TargetsService, TargetsResponse } from '@core/services/targets.service';
import { StatusService } from '@shared/services/status.service';
import { ManagementService } from '@management/presentation/services/management.service';
import { ScreenService } from '@management/presentation/services/screen.service';

// Servicios especializados
import { MapProviderService } from '@management/presentation/services/map-provider.service';
import { BreadcrumbService } from '@management/presentation/services/breadcrumb.service';
import { VehicleDataService } from '@management/presentation/services/vehicle-data.service';
import { ManagementUIService } from '@management/presentation/services/management-ui.service';
import { SelectionService } from '@core/services/selection.service';
import { TagsService } from '@core/services/tags.service';
import { WhatsAppApiService } from '@core/services/whatsapp-api.service';
import { ProtocolsService } from '@core/services/protocols.service';
import { InventoryService, Warehouse, InventoryItem } from '@core/services/inventory.service';
import { SolicitudesService } from '@core/services/solicitudes.service';
import { UserActivity, UserActivityService } from '@core/services/user-activity.service';
import {
  UserConsoleLevel,
  UserConsoleLog,
  UserConsoleLogService,
} from '@core/services/user-console-log.service';
import { Protocol } from '@core/interfaces/protocol.interface';
import { SIM_CARD_TYPES } from '@core/constants/sim-card-types.constant';
import {
  DEVICE_CANCELLATION_REASONS,
  getDeviceCancellationReasonLabel,
} from '@core/constants/device-cancellation-reasons.constant';
import { MapUtils, type MapProvider } from '@shared/helpers/map.helper';
import { getGpsDisplayConnectionStatus } from '@shared/helpers/device-connection-status.helper';
import {
  isEmployeeLocationSubjectValue,
  sanitizeManagementLocationSubject,
} from './location-subject-privacy';
import * as maplibregl from 'maplibre-gl';
import { getApiErrorMessage } from '../../../../../../core/utils/api-error.util';
import { environment } from '../../../../../../../environments/environment';

@Component({
  selector: 'app-management',
  templateUrl: './management.component.html',
  styleUrls: ['./management.component.css'],
  standalone: false,
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-20px)' }),
        animate('400ms ease-in-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class ManagementComponent implements OnInit, OnDestroy {

  // Evita volver a renderizar URLs que ya fallaron y permite mostrar el fallback.
  private readonly unavailableImageUrls = new Set<string>();

  // ====================================
  // PROPIEDADES PÚBLICAS - DATOS
  // ====================================
  selectedUser: User | undefined;
  users: User[] = [];
  userToEdit: ExtendedUser | null = null;
  transferUserBranchDialogVisible: boolean = false;
  userBranchToTransfer: User | null = null;
  transferUserBranchEmail: string = '';
  transferUserBranchFoundParent: User | null = null;
  transferUserBranchError: string = '';
  searchingTransferUserBranchParent: boolean = false;
  transferringUserBranch: boolean = false;
  targets: Target[] = [];
  private targetsListValue: any[] = [];
  targetsCardList: any[] = [];

  get targetsList(): any[] {
    return this.targetsListValue;
  }

  set targetsList(value: any[]) {
    this.targetsListValue = Array.isArray(value) ? value : [];
    this.targetsCardList = this.buildLinkedTargetCardRows(this.targetsListValue);
  }
  generatingAITargets: Set<string> = new Set();
  activatingTargets: Set<string> = new Set();
  activatingTargetStatus: Map<string, any> = new Map();
  private readonly onlineActivationAudioSrc = 'assets/online.mp3';
  private onlineActivationAudio: HTMLAudioElement | null = null;
  private playedOnlineActivationSounds: Set<string> = new Set();
  showTargetFormImageModal: boolean = false;
  targetFormFullImageUrl: string | null = null;
  targetsSelected: any[] = [];
  pendingCreateUserTransferTargets: any[] = [];
  transferCreatedAccountSummaryVisible: boolean = false;
  transferCreatedAccountUser: any | null = null;
  transferCreatedAccountTargets: any[] = [];
  transferCreatedAccountSuccessCount: number = 0;
  transferCreatedAccountErrorCount: number = 0;
  userLocationDialogVisible: boolean = false;
  userLocationDialogLoading: boolean = false;
  userLocationDialogError: string = '';
  userActivityMonitorLoading: boolean = false;
  userActivityMonitorTab: 'activity' | 'console' = 'activity';
  userActivityMonitorActivities: UserActivity[] = [];
  userActivityMonitorGroupedActivities: Array<UserActivity & { groupCount?: number }> = [];
  userActivityMonitorConsoleLogs: UserConsoleLog[] = [];
  userActivityConsoleFilter: UserConsoleLevel | 'all' = 'all';
  userConsoleCaptureEnabled: boolean = false;
  userConsoleCaptureForced: boolean = false;
  userConsoleCaptureUpdating: boolean = false;
  userConsoleCaptureStatusLoading: boolean = false;
  selectedActivityUser: User | null = null;
  private userActivityMonitorPoll?: ReturnType<typeof setInterval>;
  private userActivityMonitorBusy = false;
  private readonly targetMapViewRecordedAt = new Map<string, number>();
  mainAccountId: string = '';
  selectedLocationUser: User | null = null;
  userLocationMapInstance: any = null;
  userLocationMarker: any = null;
  @ViewChild('userLocationMap') userLocationMap?: ElementRef<HTMLDivElement>;
  createAccountTransferMethodDialogVisible: boolean = false;
  registrationLinkAffiliationDialogVisible: boolean = false;
  registrationLinkDialogVisible: boolean = false;
  creatingRegistrationLink: boolean = false;
  registrationLinkFlow: 'create' | 'transfer' = 'transfer';
  selectedRegistrationLinkAffiliation: 'cliente' | 'subcliente' = 'cliente';
  registrationLinkParentEmail: string = '';
  registrationLinkParentSuggestions: User[] = [];
  registrationLinkUrl: string = '';
  registrationLinkExpiresAt: string = '';
  registrationLinkTargetCount: number = 0;
  targetToEdit: any | null = null;
  @ViewChild('targetFormRef') targetFormRef: any;
  selectedTargetForMap: any | null = null;
  selectedTargetOwnerLocation: {
    userId: string;
    name: string;
    latitude: number;
    longitude: number;
    recordedAt?: string | Date;
  } | null = null;
  selectedTargetStopTime: string | undefined = undefined;
  targetIdFromUrl: string | null = null;
  private targetOwnerLocationCache = new Map<string, {
    userId: string;
    name: string;
    latitude: number;
    longitude: number;
    recordedAt?: string | Date;
  } | null>();

  // Dialogo de prioridad
  showPriorityDialog: boolean = false;
  priorityDevices: any[] = [];
  loadingPriorityDevices: boolean = false;

  // Warehouse
  userWarehouse: Warehouse | null = null;
  userWarehouseDevices: InventoryItem[] = [];
  warehouseModalVisible: boolean = false;
  loadingWarehouseDevices: boolean = false;

  // Shortcuts
  shortcuts: any[] = [];
  showShortcutsDialog: boolean = false;
  showMassActionButtons: boolean = false;

  loadedProtocols: Protocol[] = [];

  // Mass Transfer shortcuts properties
  displayTransferDialog: boolean = false;
  transferEmailInput: string = '';
  transferEmailError: string = '';
  foundUserForTransfer: User | null = null;
  searchingUserForTransfer: boolean = false;
  isTransferring: boolean = false;


  // ====================================
  // PROPIEDADES PARA CANCELACIÓN
  // ====================================
  cancelDialogVisible: boolean = false;
  targetToCancel: any | null = null;
  isMassCancelMode: boolean = false;
  massCancelSource: 'shortcuts' | 'selected' = 'shortcuts';
  cancelForm = {
    reason: '',
    description: '',
    disposition: 'return_to_company' as 'return_to_company' | 'retained_by_client' | 'not_recovered',
  };
  readonly cancellationDispositionOptions = [
    { label: 'Regresa a Montao para revisión', value: 'return_to_company' },
    { label: 'Lo conserva el cliente para reinstalarlo', value: 'retained_by_client' },
    { label: 'No fue recuperado', value: 'not_recovered' },
  ];
  cancelReasons = DEVICE_CANCELLATION_REASONS;

  // Suspend dialog state
  suspendDialogVisible = false;
  suspendForm = {
    reason: '',
    description: ''
  };
  suspendReasons = [
    { label: 'Falta de pago', value: 'non_payment' },
    { label: 'Solicitud del cliente', value: 'customer_request' },
    { label: 'Vehículo en el taller', value: 'vehicle_in_shop' },
    { label: 'Mantenimiento de dispositivo', value: 'device_maintenance' },
    { label: 'Investigación en curso', value: 'investigation' },
    { label: 'Suspensión temporal', value: 'temporary_suspension' },
    { label: 'Otro motivo', value: 'other' }
  ];

  // ====================================
  // PROPIEDADES PARA PERMISOS DE ROOT
  // ====================================
  isCurrentUserRoot: boolean = false;
  supportAccessDialogVisible: boolean = false;
  supportAccessTarget: User | null = null;
  supportAccessReason: string = '';
  supportAccessDestination: 'desktop' | 'mobile' = 'desktop';
  startingSupportAccess: boolean = false;

  // Estado específico de carga de targets
  private loadingTargets: boolean = false;
  private targetsLoadCompletedFlag: boolean = false;

  // Lista completa de targets para el mapa (sin paginación)
  allTargets: any[] = [];
  loadingAllTargets: boolean = false;

  // Propiedades para scroll infinito de targets
  private readonly initialPageSize: number = 60;
  private currentOffset: number = 0;
  private readonly pageSize: number = 30;
  private hasMoreTargets: boolean = true;
  private loadingMoreTargets: boolean = false;
  private totalTargetsCount: number = 0;

  // Propiedades para scroll infinito de usuarios
  private currentUsersOffset: number = 0;
  private readonly usersPageSize: number = 30;
  private hasMoreUsers: boolean = true;
  private loadingMoreUsers: boolean = false;
  private totalUsersCount: number = 0;
  private directUsersCount: number = 0;
  private userRouteLoadRequestId: number = 0;
  private loadingUserRouteId = '';
  private usersListLoadRequestId: number = 0;
  private targetsLoadRequestId: number = 0;
  private userPathLoadRequestId: number = 0;
  private managementSummaryLoadRequestId: number = 0;
  private managementSummaryLoading: boolean = false;
  private warehouseLoadRequestId: number = 0;

  // Getters para el template
  get isLoadingMoreTargets(): boolean {
    return this.loadingMoreTargets;
  }

  get hasMoreTargetsToLoad(): boolean {
    return this.hasMoreTargets;
  }

  get totalTargetsCountDisplay(): number | string {
    return this.managementSummaryLoading ? '…' : this.totalTargetsCount;
  }

  // Getters para usuarios
  get isLoadingMoreUsers(): boolean {
    return this.loadingMoreUsers;
  }

  get hasMoreUsersToLoad(): boolean {
    return this.hasMoreUsers;
  }

  get totalUsersCountDisplay(): number | string {
    return this.managementSummaryLoading ? '…' : this.directUsersCount;
  }

  // ====================================
  // PROPIEDADES PÚBLICAS - BÚSQUEDA
  // ====================================
  // Flag to track if we are installing a device from inventory
  private pendingInventoryTargetId = '';
  private pendingInventoryAction: 'reserve' | 'install' | 'review' | '' = '';
  private openingInventoryTarget = false;
  // Flag to track if we have already executed the initial search from URL params
  private initialSearchExecuted: boolean = false;
  // Store pending search term to execute after data load
  private pendingInitialSearchTerm: string = '';

  searchUsersTerm: string = '';
  searchTargetsTerm: string = '';

  // Propiedad local para el ngModel del select de mapas
  currentMapSelection: string = 'mapbox-light';

  // Propiedad para el tipo de afiliación del usuario actual
  currentUserAffiliationTypeId: string = '';

  // ====================================
  // PROPIEDADES PARA ETIQUETAS
  // ====================================
  tagDialogVisible: boolean = false;
  availableTags: Tag[] = [];
  selectedItemForTag: any = null;
  itemTypeForTag: 'user' | 'target' | null = null;
  selectedTagId: string | null = null;
  loadingTags: boolean = false;

  // Bloqueo privado de rangos del historial de recorrido
  historyPasswordDialogVisible: boolean = false;
  historyRangeDialogVisible: boolean = false;
  historyBlockTarget: any = null;
  historyBlockPassword: string = '';
  historyBlockStartsAt: Date | null = null;
  historyBlockEndsAt: Date | null = null;
  verifyingHistoryPassword: boolean = false;
  blockingHistory: boolean = false;
  loadingHistoryBlocks: boolean = false;
  historyBlocks: HistoryBlockResponse[] = [];
  editingHistoryBlockId: string | null = null;
  historyBlockActionId: string | null = null;

  // ====================================
  // PROPIEDADES PÚBLICAS - TRADUCCIONES
  // ====================================
  translations = {
    users: 'management.users.title',
    targets: 'management.targets',
    searchUsers: 'management.searchUsers',
    searchTargets: 'management.searchTargets',
    newUser: 'management.newUser',
    newTarget: 'management.newTarget',
    showMap: 'management.showMap',
    back: 'management.back'
  };

  // ====================================
  // MÉTODOS PÚBLICOS - UTILIDADES
  // ====================================

  /**
   * Determina si un usuario es compartido basándose en profile_type_id
   * @param user Usuario a verificar
   * @returns true si el usuario es compartido
   */
  isSharedUser(user: User): boolean {
    return user.profile_type_id === 'compartido';
  }

  hasRenouncedAssistance(user: User | null | undefined): boolean {
    const acceptance = user?.noDocumentsAcceptance;
    const documentType = String(acceptance?.document_type || '').toLowerCase();
    const title = String(acceptance?.title || '');

    if (documentType === 'vehicle' || /certificaci[oó]n de veh[ií]culos/i.test(title)) {
      return false;
    }

    return user?.no_assistance === true || (
      user?.noDocuments === true && (
        documentType === 'identity' ||
        /verificaci[oó]n de identidad/i.test(title)
      )
    );
  }

  shouldShowNoAssistanceState(user: User | null | undefined): boolean {
    return this.currentUserAffiliationTypeId === 'empleado' && this.hasRenouncedAssistance(user);
  }

  isUserVerified(user: User | null | undefined): boolean {
    return user?.verificado === true || !!user?.cedula_img;
  }

  /**
   * Determina el estado de expiración de un target basado en la fecha de expiración
   * @param expirationDate Fecha de expiración del target
   * @returns 'expired' | 'warning' | 'normal' | null
   */
  getExpirationStatus(expirationDate: string | null | undefined): 'expired' | 'warning' | 'normal' | null {
    if (!expirationDate) return null;

    const now = new Date();
    const expDate = new Date(expirationDate);
    const timeDiff = expDate.getTime() - now.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    if (daysDiff < 0) {
      return 'expired'; // Ya vencido
    } else if (daysDiff <= 15) {
      return 'warning'; // Menos de 15 días
    } else if (daysDiff > 30) {
      return 'normal'; // Más de 1 mes
    } else {
      return null; // Entre 15 días y 1 mes
    }
  }

  /**
   * Determina si un target es de un protocolo Airtag
   * @param target El target a evaluar
   * @returns true si es un Airtag
   */
  isTargetAirtag(target: any): boolean {
    if (!target) return false;
    
    // Si el protocolo ya viene enriquecido como objeto
    const protocolObj = target.protocol || target.originalTarget?.protocol;
    if (protocolObj && typeof protocolObj === 'object' && protocolObj.isAirtag !== undefined) {
      return !!protocolObj.isAirtag;
    }

    // Si solo tenemos el ID del protocolo en target.type o target.originalTarget?.type
    const rawType = target.type || target.originalTarget?.type;
    const protocolId = typeof rawType === 'string' ? rawType : rawType?._id;
    if (!protocolId) return false;

    // Buscar en la lista de protocolos cargados
    const matchedProtocol = this.loadedProtocols.find(p => p._id === protocolId);
    return !!matchedProtocol?.isAirtag;
  }

  private getDisplayTraccarStatus(target: any): string {
    const rawStatus = target?.traccarInfo?.status || target?.traccarStatus || 'offline';

    if (this.isTargetAirtag(target)) {
      const normalizedStatus = String(rawStatus).trim().toLowerCase();
      return normalizedStatus === 'online' || normalizedStatus === 'localizado'
        ? 'Localizado'
        : 'No localizado';
    }

    const lastUpdate = target?.traccarInfo?.lastUpdate || target?.originalTarget?.traccarInfo?.lastUpdate;
    return getGpsDisplayConnectionStatus(rawStatus, lastUpdate);
  }

  private normalizeConnectionStatus(status?: string | null): string {
    return (status || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private isOnlineLikeStatus(status?: string | null): boolean {
    const normalized = this.normalizeConnectionStatus(status);
    return normalized === 'online' || normalized === 'senal debil';
  }

  private isConnectionFilterActive(): boolean {
    return this.filterStatus === 'online' || this.filterStatus === 'offline';
  }

  private matchesConnectionFilter(target: any): boolean {
    if (this.filterStatus === 'all') return true;

    const displayStatus = this.getDisplayTraccarStatus(target);
    const isOnlineLike = this.isOnlineLikeStatus(displayStatus);

    return this.filterStatus === 'online' ? isOnlineLike : !isOnlineLike;
  }

  private applyConnectionFilterToView(targets: any[]): any[] {
    if (this.filterStatus === 'all') return targets;

    return targets.filter(target => {
      const status = target?.traccarStatus || this.getDisplayTraccarStatus(target);
      const isOnlineLike = this.isOnlineLikeStatus(status);
      return this.filterStatus === 'online' ? isOnlineLike : !isOnlineLike;
    });
  }

  private buildTargetsView(targets: Target[] | any[]): any[] {
    return this.applyConnectionFilterToView(this.mapTargetsToView(targets as Target[]));
  }

  private buildLinkedTargetCardRows(targets: any[]): any[] {
    if (!Array.isArray(targets) || targets.length === 0) {
      return [];
    }

    const byImei = new Map<string, any>();
    targets.forEach(target => {
      const imei = this.getTargetImei(target);
      if (imei) {
        byImei.set(imei, target);
      }
    });

    const linkedGroups = new Map<string, any[]>();
    targets.forEach(target => {
      const linkedImei = this.getTargetLinkedGpsImei(target);
      if (!linkedImei || !byImei.has(linkedImei)) {
        return;
      }

      const group = linkedGroups.get(linkedImei) || [];
      group.push(target);
      linkedGroups.set(linkedImei, group);
    });

    const consumed = new Set<string>();
    const rows: any[] = [];

    targets.forEach(target => {
      const targetId = String(target?._id || '');
      if (!targetId || consumed.has(targetId)) {
        return;
      }

      const linkedImei = this.getTargetLinkedGpsImei(target);
      if (linkedImei && byImei.has(linkedImei)) {
        return;
      }

      const currentImei = this.getTargetImei(target);
      const linkedTargets = (linkedGroups.get(currentImei) || [])
        .filter(linkedTarget => {
          const linkedTargetId = String(linkedTarget?._id || '');
          return linkedTargetId && linkedTargetId !== targetId && !consumed.has(linkedTargetId);
        });

      if (linkedTargets.length > 0) {
        const groupTargets = [target, ...linkedTargets];

        rows.push({
          ...target,
          _id: `linked-card-${groupTargets.map(groupTarget => groupTarget._id).join('-')}`,
          isLinkedPairCard: true,
          primaryTarget: target,
          secondaryTarget: groupTargets[1],
          linkedTargets: groupTargets,
          originalTarget: target.originalTarget || target,
          isShared: groupTargets.every(groupTarget => groupTarget.isShared),
        });

        groupTargets.forEach(groupTarget => consumed.add(String(groupTarget?._id || '')));
        return;
      }

      rows.push(target);
      consumed.add(targetId);
    });

    return rows;
  }

  private getTargetImei(target: any): string {
    const source = target?.originalTarget || target || {};
    return String(target?.imei || target?.device_imei || source.device_imei || source.imei || '').trim();
  }

  private getTargetLinkedGpsImei(target: any): string {
    const source = target?.originalTarget || target || {};
    return String(target?.gps_adicional || source.gps_adicional || target?.additional_gps || source.additional_gps || '').trim();
  }

  private refreshTargetsCardList(): void {
    this.targetsCardList = this.buildLinkedTargetCardRows(this.targetsList || []);
  }

  // ====================================
  // PROPIEDADES PÚBLICAS - DELEGADAS A SERVICIOS
  // ====================================

  // UI State (delegado a ManagementUIService)
  get loading(): boolean { return this.uiService.isLoading(); }
  get loadingTargetsState(): boolean { return this.loadingTargets; }
  get targetsLoadCompleted(): boolean { return this.targetsLoadCompletedFlag; }
  get userFormDisplay(): boolean { return this.uiService.isUserFormVisible(); }
  get targetFormDisplay(): boolean { return this.uiService.isTargetFormVisible(); }
  get showMaps(): boolean { return this.uiService.areMapsVisible(); }
  get isUserSearchActive(): boolean { return this.isSearchingUsers; }
  get isTargetSearchActive(): boolean { return this.isSearchingTargets; }
  // Mobile/responsive state
  isMobileView: boolean = false;
  showMobileMapFullscreen: boolean = false;

  // Map Provider (delegado a MapProviderService)
  get selectedMap(): string { return this.mapProviderService.selectedMap; }
  get providerType(): MapProvider { return this.mapProviderService.providerType; }
  get providerTheme(): 'light' | 'dark' { return this.mapProviderService.providerTheme; }
  get mapsKey(): string | null { return this.mapProviderService.mapsKey; }
  get showAdvancedMapOptions(): boolean { return !!this.selectedTargetForMap; }

  // Breadcrumb (delegado a BreadcrumbService)
  get items(): MenuItem[] { return this.breadcrumbService.getItems(); }
  get home(): MenuItem { return this.breadcrumbService.getHome(); }

  // Target selection helpers
  get currentTargetFromUrl(): string | null { return this.targetIdFromUrl; }

  trackUserBy(_index: number, user: User): string {
    return String(user?._id || _index);
  }

  trackTargetBy(_index: number, target: any): string {
    return String(target?._id || target?.originalTarget?._id || _index);
  }

  trackWarehouseDeviceBy(_index: number, device: InventoryItem): string {
    return String((device as any)?._id || (device as any)?.IMEI || (device as any)?.imei || _index);
  }

  isTargetSelectedFromUrl(targetId: string): boolean {
    return this.targetIdFromUrl === targetId;
  }

  isTargetPairSelected(row: any): boolean {
    if (!row?.isLinkedPairCard) {
      return !!this.selectedTargetForMap && this.selectedTargetForMap._id === row?._id;
    }

    return this.getLinkedCardTargets(row).some((target: any) =>
      !!target?._id && !!this.selectedTargetForMap && this.selectedTargetForMap._id === target._id
    );
  }

  getLinkedCardTargets(row: any): any[] {
    if (!row?.isLinkedPairCard) {
      return row ? [row] : [];
    }

    return Array.isArray(row.linkedTargets)
      ? row.linkedTargets.filter(Boolean)
      : [row.primaryTarget, row.secondaryTarget].filter(Boolean);
  }

  getLinkedGroupCardHeight(row: any): number {
    return Math.max(2, this.getLinkedCardTargets(row).length) * 64;
  }

  hasLinkedGroupVehicleInfoIncomplete(row: any): boolean {
    return this.getLinkedCardTargets(row).some((linkedTarget: any) =>
      this.isTargetVehicleInfoIncomplete(linkedTarget)
    );
  }

  isTargetSelected(target: any): boolean {
    const targetId = String(target?._id || '');
    return !!targetId && this.targetsSelected.some((selected: any) => String(selected?._id || '') === targetId);
  }

  toggleTargetSelection(target: any, event?: Event): void {
    event?.stopPropagation();
    if (!target || target.isShared || !this.canUpdateDevices()) {
      return;
    }

    const targetId = String(target._id || '');
    if (!targetId) {
      return;
    }

    if (this.isTargetSelected(target)) {
      this.targetsSelected = this.targetsSelected.filter((selected: any) => String(selected?._id || '') !== targetId);
    } else {
      this.targetsSelected = [...this.targetsSelected, target];
    }
    this.onTargetsSelectionChange();
  }

  isTargetPairSelectedForActions(row: any): boolean {
    if (!row?.isLinkedPairCard) {
      return this.isTargetSelected(row);
    }

    const groupTargets = this.getLinkedCardTargets(row);
    return groupTargets.length > 0 && groupTargets.every((target: any) => this.isTargetSelected(target));
  }

  toggleTargetPairSelection(row: any, event?: Event): void {
    event?.stopPropagation();
    if (!row?.isLinkedPairCard || row.isShared || !this.canUpdateDevices()) {
      return;
    }

    const pairTargets = this.getLinkedCardTargets(row);
    const pairIds = new Set(pairTargets.map((target: any) => String(target?._id || '')).filter(Boolean));
    if (pairIds.size === 0) {
      return;
    }

    if (this.isTargetPairSelectedForActions(row)) {
      this.targetsSelected = this.targetsSelected.filter((selected: any) =>
        !pairIds.has(String(selected?._id || ''))
      );
      this.onTargetsSelectionChange();
      return;
    }

    const selectedIds = new Set(this.targetsSelected.map((selected: any) => String(selected?._id || '')));
    const missingTargets = pairTargets.filter((target: any) => !selectedIds.has(String(target?._id || '')));
    this.targetsSelected = [...this.targetsSelected, ...missingTargets];
    this.onTargetsSelectionChange();
  }

  // ====================================
  // PROPIEDADES PRIVADAS - SUSCRIPCIONES
  // ====================================
  private subscriptions: Subscription[] = [];

  // ====================================
  // PROPIEDADES PRIVADAS - POLLING
  // ====================================
  private pollingInterval: any = null;
  private readonly POLLING_INTERVAL_MS = 10000; // 10 segundos

  // Estado para seguimiento de cambios de status de targets
  // (integrado en el polling principal de 10s, no requiere polling separado)
  private previousTargetsStatus: Map<string, string> = new Map(); // targetId -> status

  // ====================================
  // PROPIEDADES PRIVADAS - BÚSQUEDA
  // ====================================
  private searchUsersSubject = new Subject<string>();
  private isSearchingUsers = false;
  private pendingUserSearchTerm = '';
  private searchTargetsSubject = new Subject<string>();
  private isSearchingTargets = false;

  // ====================================
  // CONSTRUCTOR
  // ====================================
  constructor(
    public router: Router,
    public route: ActivatedRoute,
    private status: StatusService,
    private authService: AuthService,
    private userService: UserService,
    private targetsService: TargetsService,
    private tagsService: TagsService,
    public translate: TranslateService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    public managementService: ManagementService,
    private screenService: ScreenService,
    // Servicios especializados
    private mapProviderService: MapProviderService,
    private breadcrumbService: BreadcrumbService,
    private vehicleDataService: VehicleDataService,
    private uiService: ManagementUIService,
    private cdr: ChangeDetectorRef,
    private selectionService: SelectionService,
    private whatsappApi: WhatsAppApiService,
    private protocolsService: ProtocolsService,
    private inventoryService: InventoryService,
    private solicitudesService: SolicitudesService,
    private userActivityService: UserActivityService,
    private userConsoleLogService: UserConsoleLogService
  ) { }

  // ====================================
  // MÉTODOS DE VALIDACIÓN DE PRIVILEGIOS
  // ====================================

  // Métodos de validación de privilegios para usuarios
  canCreateUsers(): boolean {
    return this.authService.hasPrivilege('users', 'create');
  }

  canReadUsers(): boolean {
    return this.authService.hasPrivilege('users', 'read');
  }

  canUpdateUsers(): boolean {
    return this.authService.hasPrivilege('users', 'update');
  }

  canDeleteUsers(): boolean {
    return this.authService.hasPrivilege('users', 'delete');
  }

  // Métodos de validación de privilegios para devices (targets)
  canCreateDevices(): boolean {
    return this.authService.hasPrivilege('devices', 'create');
  }

  canReadDevices(): boolean {
    return this.authService.hasPrivilege('devices', 'read');
  }

  canReadInventory(): boolean {
    return this.authService.hasPrivilege('inventory', 'read');
  }

  canUpdateDevices(): boolean {
    return this.authService.hasPrivilege('devices', 'update');
  }

  canDeleteDevices(): boolean {
    return this.authService.hasPrivilege('devices', 'delete');
  }

  canCancelDevices(): boolean {
    return this.canUpdateDevices();
  }

  // ====================================
  // MÉTODOS PARA PERMISOS DE ROOT
  // ====================================

  /**
   * Verifica si el usuario actual tiene permisos de root
   */
  checkCurrentUserRootStatus(): void {
    const currentUser = this.authService.getCurrentUser();
    this.isCurrentUserRoot = !!(currentUser?.root === true || String(currentUser?.root) === 'true');
    console.log('🔍 Verificando estado root del usuario:', {
      currentUser: currentUser?.name,
      isRoot: this.isCurrentUserRoot,
      rootValue: currentUser?.root
    });
  }

  /**
   * Elimina permanentemente un target (solo para usuarios root)
   */
  async deleteTarget(target: any): Promise<void> {
    if (!this.isCurrentUserRoot) {
      console.warn('⚠️ Solo usuarios root pueden eliminar targets permanentemente');
      return;
    }

    console.log('🗑️ Iniciando eliminación permanente de target:', target);

    try {
      // Mostrar confirmación más estricta para eliminación permanente
      this.confirmationService.confirm({
        message: `¿Está seguro de que desea ELIMINAR PERMANENTEMENTE el target "${target.name}"? Esta acción no se puede deshacer.`,
        header: 'Confirmar eliminación permanente',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Sí, eliminar permanentemente',
        rejectLabel: 'Cancelar',
        acceptButtonStyleClass: 'p-button-danger',
        accept: async () => {
          try {
            // Llamar al servicio para eliminar
            console.log('📡 Ejecutando eliminación permanente...');
            await this.targetsService.deleteTarget(target._id);

            // Mostrar mensaje de éxito
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Target eliminado permanentemente'
            });

            // Actualizar la lista de targets
            if (this.selectedUser) {
              await this.loadTargetsForUser(this.selectedUser._id);
            }

            // Notificar que se han actualizado objetivos
            this.selectionService.notifyTargetsUpdated();

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

  // ====================================
  // LIFECYCLE HOOKS
  // ====================================

  ngOnInit(): void {
    // Sincronizar la selección actual con el servicio
    this.currentMapSelection = this.mapProviderService.selectedMap;

    // Verificar permisos de root del usuario actual
    this.checkCurrentUserRootStatus();
    this.loadMainAccount();

    this.checkMobileView();
    this.setupInitialState();
    this.setupSubscriptions();
    this.setupRouting();
    this.checkUserInbox();
    // Nota: El status polling ahora está integrado en el polling principal de 10s

    // Verificar si hay datos de instalación de dispositivo en sessionStorage
    // Verificar si hay datos de instalación de dispositivo en sessionStorage

    // Cargar etiquetas disponibles para el filtro
    this.loadAvailableTags();
    
    // Cargar mapa
    // this.loadMap();

    // Cargar dispositivos con prioridad excedida una sola vez al inicio

    // Load shortcuts from localStorage
    this.loadShortcuts();

    // Cargar protocolos para verificaciones dinámicas (ej: Airtags)
    this.protocolsService.getAllProtocols().subscribe({
      next: (protocols) => {
        this.loadedProtocols = protocols;
      },
      error: (err) => console.error('Error al cargar protocolos:', err)
    });
  }

  ngOnDestroy(): void {
    this.stopUserActivityMonitorPolling();
    this.userLocationMarker?.remove?.();
    this.userLocationMapInstance?.remove?.();
    this.cleanupSubscriptions();
    this.breadcrumbService.clear();
    this.stopPolling();
    // Nota: El status polling ahora está integrado en el polling principal

    // Limpiar subjects
    this.searchUsersSubject.complete();
    this.searchTargetsSubject.complete();

    // Limpiar timeout del scroll infinito
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    this.stopChatPolling();
  }

  // ====================================
  // EVENT HANDLERS
  // ====================================

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.uiService.updateScreenSize();
    this.checkMobileView();
  }

  private checkMobileView(): void {
    const previousMobileView = this.isMobileView;
    this.isMobileView = window.innerWidth <= 760; // Cambio a 760px para coincidir con CSS

    // Si cambió de escritorio a móvil, ocultar el mapa full screen
    if (!previousMobileView && this.isMobileView) {
      this.showMobileMapFullscreen = false;
    }

    // Si cambió de móvil a escritorio y hay target seleccionado, asegurar que maps esté visible
    if (previousMobileView && !this.isMobileView && this.selectedTargetForMap && !this.uiService.areMapsVisible()) {
      this.uiService.toggleMaps();
    }
  }

  hideMobileMapFullscreen(): void {
    this.showMobileMapFullscreen = false;

    // IMPORTANTE: Mantener showMaps en true para que el mapa siga disponible
    // Solo cambiar el estado de pantalla completa, no ocultar los mapas completamente

    this.cdr.detectChanges(); // Forzar detección de cambios

  }

  get mapDisplayStyle(): string {
    // En móvil: mostrar solo si está en modo pantalla completa
    // En escritorio: siempre mostrar
    if (this.isMobileView) {
      return this.showMobileMapFullscreen ? 'block' : 'none';
    } else {
      return 'block'; // En escritorio siempre visible
    }
  }

  window = window; // Para acceder a window desde el template

  // ====================================
  // MÉTODOS PÚBLICOS - NAVEGACIÓN
  // ====================================


  goToParent() {
    if (this.selectedUser) {
      const managementState: any = this.status.getState('management');
      this.breadcrumbService.navigateToParent(managementState);
    }
  }

  canNavigateBack(): boolean {
    const managementState: any = this.status.getState('management');
    return this.breadcrumbService.canNavigateBack(managementState);
  }

  enterUser(user: User): void {
    const currentOp = this.managementService.getOp() || 'u';
    this.managementService.setOp(currentOp, user._id);
  }

  canStartSupportAccess(user: User): boolean {
    const currentUser = this.authService.getCurrentUser();
    return this.isCurrentUserRoot
      && !this.authService.isSupportImpersonating()
      && !!user?._id
      && user._id !== currentUser?.id
      && !this.isMainAccount(user);
  }

  openSupportAccess(user: User): void {
    if (!this.canStartSupportAccess(user)) return;
    this.supportAccessTarget = user;
    this.supportAccessReason = '';
    this.supportAccessDestination = 'desktop';
    this.supportAccessDialogVisible = true;
  }

  closeSupportAccess(): void {
    if (this.startingSupportAccess) return;
    this.supportAccessDialogVisible = false;
    this.supportAccessTarget = null;
    this.supportAccessReason = '';
    this.supportAccessDestination = 'desktop';
  }

  confirmSupportAccess(): void {
    const targetId = this.supportAccessTarget?._id;
    const reason = this.supportAccessReason.trim();
    if (!targetId || reason.length < 10 || this.startingSupportAccess) return;

    this.startingSupportAccess = true;
    try {
      const accessRequest$ = this.supportAccessDestination === 'mobile'
        ? this.authService.startMobileSupportImpersonation(targetId, reason)
        : this.authService.startSupportImpersonation(targetId, reason);

      accessRequest$.subscribe({
        next: (response) => {
          if (this.supportAccessDestination === 'mobile') {
            const mobileUrl = new URL('/login', environment.mobileAppUrl);
            mobileUrl.searchParams.set(
              'supportCode',
              String(response.mobile_handoff_code),
            );
            window.location.assign(mobileUrl.toString());
            return;
          }
          window.location.assign('/admin/dashboard');
        },
        error: (error) => {
          this.startingSupportAccess = false;
          this.messageService.add({
            severity: 'error',
            summary: 'No se pudo iniciar el acceso de soporte',
            detail: getApiErrorMessage(error, 'Verifique la cuenta e inténtelo nuevamente.'),
          });
        },
      });
    } catch (error) {
      this.startingSupportAccess = false;
      this.messageService.add({
        severity: 'error',
        summary: 'Acceso no permitido',
        detail: error instanceof Error ? error.message : 'No se pudo iniciar la sesión de soporte.',
      });
    }
  }

  setOp(op: string) {
    // Obtener la operación actual antes del cambio
    const currentOp = this.managementService.getOp();
    const currentUserId = this.managementService.getCurrentUserId();

    // Limpiar selección si se cambia de targets a otra sección
    if (currentOp === 't' && op !== 't') {
      this.targetsSelected = [];
      this.selectionService.clearSelection();
    }

    // Solo actualizar la operación en el servicio, sin recargar datos
    this.managementService.setOp(op);

    // Si cambia a targets, verificar si necesita cargar datos
    // Solo cargar si no hay datos O si cambió el usuario desde la última carga
    if (op === 't' && this.selectedUser) {
      const hasNoTargets = this.targetsList.length === 0;
      const userChanged = currentUserId !== this.selectedUser._id;

      if (hasNoTargets || userChanged) {
        this.targetsLoadCompletedFlag = false; // Solo aquí, cuando realmente se van a cargar datos
        this.loadTargetsForUser(this.selectedUser._id);
      }
    }

    // Si cambia a usuarios, verificar si necesita cargar datos
    if (op === 'u' && this.selectedUser) {
      const hasNoUsers = this.users.length === 0;
      const userChanged = currentUserId !== this.selectedUser._id;

      if (hasNoUsers || userChanged) {
        this.loadUsersForUser(this.selectedUser._id);
      }
    }
  }

  // ====================================
  // MÉTODOS PÚBLICOS - BÚSQUEDA
  // ====================================

  searchUser() {
    // Actualizar el término en el servicio de management para mantener la URL sincronizada
    this.managementService.setSearchUsersTerm(this.searchUsersTerm);
    this.managementService.searchUser();

    // Ejecutar búsqueda con debounce a través del subject
    this.searchUsersSubject.next(this.searchUsersTerm);
  }

  clearUserSearch() {
    this.searchUsersTerm = '';
    this.managementService.setSearchUsersTerm('');
    this.searchUsersSubject.next('');
  }

  clearTargetSearch() {
    this.searchTargetsTerm = '';
    this.managementService.setSearchTargetsTerm('');
    this.searchTargetsSubject.next('');
  }

  searchTargets() {
    // Actualizar el término en el servicio de management para mantener la URL sincronizada
    this.managementService.setSearchTargetsTerm(this.searchTargetsTerm);
    this.managementService.searchTargets();

    // Ejecutar búsqueda con debounce a través del subject
    this.searchTargetsSubject.next(this.searchTargetsTerm);
  }

  // ====================================
  // MÉTODOS PÚBLICOS - UI STATE
  // ====================================

  showMapsToggle() {
    // Si los mapas están visibles, al ocultarlos quitamos el parámetro target de la URL
    if (this.uiService.areMapsVisible()) {
      this.removeTargetFromUrl();
      this.selectedTargetForMap = null;
      this.selectedTargetOwnerLocation = null;
      this.targetIdFromUrl = null;
      this.enforceDefaultMapWhenNoTarget();
    } else {
      // Al mostrar el mapa, cargar todos los targets si hay un usuario seleccionado
      if (this.selectedUser) {
        this.loadAllTargetsForMap();
      }
    }

    this.uiService.toggleMaps();
  }

  get shouldShowMapToggleButton(): boolean {
    return true; // Siempre mostrar el botón del mapa, independientemente de si hay targets
  }

  toggleShortcutsMenu() {
    this.showShortcutsDialog = true;
    this.showMassActionButtons = false;
  }

  loadShortcuts() {
    const saved = localStorage.getItem('targetShortcuts');
    if (saved) {
      try {
        this.shortcuts = JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing shortcuts', e);
        this.shortcuts = [];
      }
    }
  }

  addToShortcuts(target: any, event: Event) {
    event.stopPropagation();

    if (this.isTargetInShortcuts(target)) {
      // Remove
      this.shortcuts = this.shortcuts.filter(s => s._id !== target._id);
      this.messageService.add({ severity: 'info', summary: 'Eliminado', detail: 'Acceso directo eliminado' });
    } else {
      // Resolve parentId from current URL (this is what the user wants)
      // The user wants to save the current ID from the URL: /admin/management/t/[currentId]
      let parentId = this.route.snapshot.params['id'];

      // Fallback if not found in params (e.g. if we are in a different view)
      if (!parentId) {
        const originalTarget = target.originalTarget || target;
        parentId = target.parent_id || target.parentId || target.user_id ||
          originalTarget.parent_id || originalTarget.parentId || originalTarget.user_id ||
          (this.selectedUser ? this.selectedUser._id : null);
      }

      if (!parentId) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Usuario no identificado',
          detail: 'El objetivo no contiene parent_id, parentId ni user_id y tampoco hay un usuario seleccionado.',
        });
        return;
      }

      // Try to get user name
      let userName = 'Usuario desconocido';
      if (this.selectedUser && this.selectedUser._id === parentId) {
        userName = `${this.selectedUser.name} ${this.selectedUser.last_name || ''}`.trim();
      } else if (target.parentName) {
        userName = target.parentName; // Assuming this is already full name or we can't do much
      } else {
        // Try to find in loaded users if available
        const user = this.users.find(u => u._id === parentId);
        if (user) {
          userName = `${user.name} ${user.last_name || ''}`.trim();
        }
      }

      // Add
      const shortcut = {
        _id: target._id,
        name: target.name,
        imei: target.imei || target.device_imei,
        parentId: parentId, // This is now the ID from the URL
        parentName: userName,
        addedAt: new Date().toISOString()
      };
      this.shortcuts.push(shortcut);
      this.messageService.add({ severity: 'success', summary: 'Agregado', detail: 'Acceso directo creado' });
    }

    // Save to localStorage
    localStorage.setItem('targetShortcuts', JSON.stringify(this.shortcuts));
  }

  isTargetInShortcuts(target: any): boolean {
    return this.shortcuts.some(s => s._id === target._id);
  }

  removeFromShortcuts(shortcut: any, event?: Event) {
    if (event) event.stopPropagation();
    this.shortcuts = this.shortcuts.filter(s => s._id !== shortcut._id);
    localStorage.setItem('targetShortcuts', JSON.stringify(this.shortcuts));
    this.messageService.add({ severity: 'info', summary: 'Eliminado', detail: 'Acceso directo eliminado' });
  }

  navigateToShortcut(shortcut: any, event?: MouseEvent) {
    if (shortcut.parentId) {
      const url = `/admin/management/t/${shortcut.parentId}?search=${shortcut.imei}`;

      // Check for Ctrl (Windows/Linux) or Meta (Mac Command) keys
      if (event && (event.ctrlKey || event.metaKey)) {
        window.open(url, '_blank');
      } else {
        // Force reload in current tab
        window.location.href = url;
      }

      this.showShortcutsDialog = false;
    } else {
      this.messageService.add({ severity: 'warn', summary: 'Error', detail: 'Acceso directo inválido' });
    }
  }

  // ====================================
  // MÉTODOS PÚBLICOS - MAPAS
  // ====================================

  onMapProviderChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const value = target.value;
    this.setMapProvider(value);
  }

  async setMapProvider(value: string): Promise<void> {


    const newKey = await this.mapProviderService.changeProviderWithRecreation(value);



    // Forzar detección de cambios
    this.cdr.detectChanges();
  }

  // ====================================
  // MÉTODOS PÚBLICOS - ETIQUETAS
  // ====================================

  managementTags(item: any, type: 'user' | 'target') {
    this.selectedItemForTag = item;
    this.itemTypeForTag = type;
    this.selectedTagId = item.tag || null;
    this.loadAvailableTags();
    this.tagDialogVisible = true;
  }

  loadAvailableTags() {
    this.loadingTags = true;
    this.tagsService.getAllTags().subscribe({
      next: (tags) => {
        this.availableTags = tags;
        this.loadingTags = false;
      },
      error: (err) => {
        console.error('Error loading tags:', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: getApiErrorMessage(err, 'No se pudieron cargar las etiquetas') });
        this.loadingTags = false;
      }
    });
  }

  getTagColor(tagId: string | undefined | null): string {
    if (!tagId) return '';
    const tag = this.availableTags.find(t => t._id === tagId);
    return tag ? tag.color : '';
  }

  async saveTagSelection() {
    if (!this.selectedItemForTag || !this.itemTypeForTag) return;

    try {
      if (this.itemTypeForTag === 'user') {
        await lastValueFrom(this.userService.update(this.selectedItemForTag._id, { tag: this.selectedTagId || null } as any));
        this.selectedItemForTag.tag = this.selectedTagId;
      } else {
        await this.targetsService.updateTarget(this.selectedItemForTag._id, { tag: this.selectedTagId || null } as any);
        this.selectedItemForTag.tag = this.selectedTagId;
        // También actualizar el objeto original para que no se pierda al re-mapear
        if (this.selectedItemForTag.originalTarget) {
          this.selectedItemForTag.originalTarget.tag = this.selectedTagId;
        }
      }

      this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Etiqueta actualizada correctamente' });
      this.tagDialogVisible = false;
    } catch (error: any) {
      console.error('Error saving tag:', error);
      this.messageService.add({ severity: 'error', summary: 'Error', detail: getApiErrorMessage(error, 'No se pudo actualizar la etiqueta') });
    }
  }

  // Método para manejar cambios del ngModel
  onMapSelectionChange(value: string): void {
    this.setMapProvider(value);
  }

  // ====================================
  // MÉTODOS PÚBLICOS - GESTIÓN DE USUARIOS
  // ====================================

  showUserForm() {
    // Validar permisos antes de permitir crear usuarios
    if (!this.canCreateUsers()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('management.users.no_create_permission'),
        detail: this.translate.instant('management.users.contact_admin')
      });
      return;
    }

    this.pendingCreateUserTransferTargets = [];
    this.userToEdit = null;
    this.registrationLinkFlow = 'create';
    this.createAccountTransferMethodDialogVisible = true;
  }

  openCreateUserAndTransferSelected() {
    if (!this.targetsSelected || this.targetsSelected.length === 0) return;

    if (!this.canCreateUsers()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('management.users.no_create_permission'),
        detail: this.translate.instant('management.users.contact_admin')
      });
      return;
    }

    this.pendingCreateUserTransferTargets = [...this.targetsSelected];
    this.registrationLinkFlow = 'transfer';
    this.createAccountTransferMethodDialogVisible = true;
  }

  openManualCreateAccountTransfer() {
    this.createAccountTransferMethodDialogVisible = false;
    this.userToEdit = null;
    this.uiService.showUserForm();
  }

  openRegistrationLinkAffiliationDialog() {
    if (this.creatingRegistrationLink) return;
    if (this.registrationLinkFlow === 'transfer' && this.pendingCreateUserTransferTargets.length === 0) return;
    const currentUser: any = this.authService.getCurrentUser();

    if (!this.isLoggedEmployee()) {
      this.selectedRegistrationLinkAffiliation = 'subcliente';
      this.registrationLinkParentEmail = this.selectedUser?.email || currentUser?.email || '';
      this.createAccountTransferMethodDialogVisible = false;
      this.createRegistrationLinkForSelectedTargets();
      return;
    }

    this.selectedRegistrationLinkAffiliation = 'cliente';
    this.registrationLinkParentEmail = this.selectedUser?.email || currentUser?.email || '';
    this.registrationLinkParentSuggestions = [];
    this.createAccountTransferMethodDialogVisible = false;
    this.registrationLinkAffiliationDialogVisible = true;
  }

  searchRegistrationLinkParents(event: { query?: string }) {
    const query = String(event?.query || '').trim();
    if (query.length < 2) {
      this.registrationLinkParentSuggestions = [];
      return;
    }

    this.userService.getMainAccount().subscribe({
      next: (mainAccount) => {
        const mainAccountId = String(mainAccount?.account?._id || '').trim();
        if (!mainAccountId) {
          this.registrationLinkParentSuggestions = [];
          return;
        }
        this.userService.search(query, mainAccountId, 0, 10).subscribe({
          next: (response) => {
            this.registrationLinkParentSuggestions = response?.users || [];
          },
          error: () => {
            this.registrationLinkParentSuggestions = [];
          }
        });
      },
      error: () => {
        this.registrationLinkParentSuggestions = [];
      }
    });
  }

  onRegistrationLinkParentSelected(event: any) {
    const selectedUser = event?.value;
    if (selectedUser?.email) {
      this.registrationLinkParentEmail = selectedUser.email;
    }
  }

  private isLoggedEmployee(): boolean {
    const currentUser: any = this.authService.getCurrentUser();
    return String(currentUser?.affiliation_type_id || '').toLowerCase() === 'empleado';
  }

  async createRegistrationLinkForSelectedTargets() {
    if (this.creatingRegistrationLink) return;
    if (this.registrationLinkFlow === 'transfer' && this.pendingCreateUserTransferTargets.length === 0) return;

    const isEmployee = this.isLoggedEmployee();
    const parentEmail = String(this.registrationLinkParentEmail || '').trim();
    if (isEmployee && !parentEmail) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Correo requerido',
        detail: 'Indica debajo de cual cuenta se creara el usuario.'
      });
      return;
    }

    const currentUser: any = this.authService.getCurrentUser();
    const accessLevelId = typeof currentUser?.access_level_id === 'string'
      ? currentUser.access_level_id
      : currentUser?.access_level_id?._id;
    const targetIds = this.pendingCreateUserTransferTargets
      .map(target => target?._id)
      .filter(Boolean);

    this.creatingRegistrationLink = true;
    try {
      let parentId = this.route.snapshot.params['user'] || this.selectedUser?._id || '';

      if (isEmployee) {
        const selectedEmail = String(this.selectedUser?.email || '').trim().toLowerCase();
        const normalizedParentEmail = parentEmail.toLowerCase();
        parentId = normalizedParentEmail === selectedEmail
          ? (this.selectedUser?._id || parentId)
          : '';
      }

      if (isEmployee && !parentId) {
        const parentUser = await lastValueFrom(this.userService.getByEmail(parentEmail));
        parentId = parentUser?._id;
      }

      if (!parentId) {
        throw new Error('No se encontro la cuenta indicada');
      }

      const response = await lastValueFrom(this.userService.createRegistrationLink({
        parent_id: parentId,
        target_ids: targetIds,
        access_level_id: accessLevelId,
        affiliation_type_id: this.selectedRegistrationLinkAffiliation
      }));
      const registrationCode = response.short_code || response.token;
      if (!registrationCode) {
        throw new Error('El backend no devolvió un código para el link de registro');
      }
      this.registrationLinkUrl = `${window.location.origin}/registro/${registrationCode}`;
      this.registrationLinkExpiresAt = response.expires_at;
      this.registrationLinkTargetCount = response.target_count;
      this.createAccountTransferMethodDialogVisible = false;
      this.registrationLinkAffiliationDialogVisible = false;
      this.registrationLinkDialogVisible = true;
    } catch (error: any) {
      console.error('Error creando link de registro:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'No se pudo crear el link',
        detail: getApiErrorMessage(error, 'No se pudo crear el enlace de registro; puede usar el método manual')
      });
    } finally {
      this.creatingRegistrationLink = false;
    }
  }

  async copyRegistrationLink() {
    if (!this.registrationLinkUrl) return;
    try {
      await navigator.clipboard.writeText(this.registrationLinkUrl);
      this.messageService.add({
        severity: 'success',
        summary: 'Link copiado',
        detail: 'El link de registro fue copiado al portapapeles.'
      });
    } catch (error) {
      this.messageService.add({
        severity: 'info',
        summary: 'Link listo',
        detail: this.registrationLinkUrl,
        life: 8000
      });
    }
  }

  editUser(user: User) {
    // Validar permisos antes de permitir editar usuarios
    if (!this.canUpdateUsers()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('management.users.no_update_permission'),
        detail: this.translate.instant('management.users.contact_admin')
      });
      return;
    }

    this.userToEdit = convertToExtendedUser(user);
    this.uiService.showUserForm();
  }

  openTransferUserBranch(user: User): void {
    if (!this.canUpdateUsers()) return;
    this.userBranchToTransfer = user;
    this.transferUserBranchEmail = '';
    this.transferUserBranchFoundParent = null;
    this.transferUserBranchError = '';
    this.transferUserBranchDialogVisible = true;
  }

  async verifyTransferUserBranchParent(): Promise<void> {
    const email = this.transferUserBranchEmail.trim().toLowerCase();
    this.transferUserBranchFoundParent = null;
    this.transferUserBranchError = '';
    if (!email) {
      this.transferUserBranchError = 'El correo es requerido.';
      return;
    }
    try {
      this.searchingTransferUserBranchParent = true;
      const user = await lastValueFrom(this.userService.getByEmail(email));
      if (!user) {
        this.transferUserBranchError = 'No se encontró una cuenta con ese correo.';
        return;
      }
      this.transferUserBranchFoundParent = user;
    } catch (error: any) {
      this.transferUserBranchError = error?.status === 404
        ? 'No se encontró una cuenta con ese correo.'
        : 'No se pudo verificar la cuenta destino.';
    } finally {
      this.searchingTransferUserBranchParent = false;
    }
  }

  async transferUserBranch(): Promise<void> {
    const source = this.userBranchToTransfer;
    const parent = this.transferUserBranchFoundParent;
    if (!source || !parent) {
      this.messageService.add({ severity: 'warn', summary: 'Cuenta requerida', detail: 'Indica el correo de la nueva cuenta padre.' });
      return;
    }
    this.transferringUserBranch = true;
    try {
      const result = await lastValueFrom(this.userService.transferBranch(source._id, parent._id));
      this.messageService.add({
        severity: 'success',
        summary: 'Rama transferida',
        detail: `${result.usersUpdated} usuario(s) y ${result.devicesUpdated} GPS fueron actualizados.`,
      });
      this.transferUserBranchDialogVisible = false;
      if (this.selectedUser) this.loadUsersForUser(this.selectedUser._id);
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'No se pudo transferir la rama', detail: error?.error?.message || error?.message || 'Verifica la cuenta destino.' });
    } finally {
      this.transferringUserBranch = false;
    }
  }

  onHideUserForm() {
    this.uiService.hideUserForm();
    this.userToEdit = null;
    this.pendingCreateUserTransferTargets = [];
  }

  async onUserCreated(createdUser?: any) {
    const shouldTransferToCreatedUser = !!createdUser && this.pendingCreateUserTransferTargets.length > 0;
    const targetsPendingTransfer = [...this.pendingCreateUserTransferTargets];
    this.uiService.hideUserForm();
    this.userToEdit = null;

    if (shouldTransferToCreatedUser) {
      await this.transferPendingTargetsToCreatedUser(createdUser, targetsPendingTransfer);
      return;
    }

    if (this.selectedUser) {
      this.loadUsersForUser(this.selectedUser._id);
    }
  }

  isMainAccount(user: User | any | null | undefined): boolean {
    const userId = String(user?._id || user?.id || '').trim();
    return !!userId && userId === this.mainAccountId;
  }

  onMainAccountChanged(accountId: string): void {
    this.mainAccountId = String(accountId || '').trim();
  }

  private loadMainAccount(): void {
    this.userService.getMainAccount().subscribe({
      next: (response) => {
        this.mainAccountId = String(response?.account?._id || '').trim();
        this.cdr.detectChanges();
      },
      error: () => {
        this.mainAccountId = '';
      },
    });
  }

  private async transferPendingTargetsToCreatedUser(createdUser: any, pendingTargets: any[] = this.pendingCreateUserTransferTargets): Promise<void> {
    const newUserId = createdUser?._id || createdUser?.id || createdUser?.user?._id || createdUser?.data?._id;
    const targetsToTransfer = [...pendingTargets];
    this.pendingCreateUserTransferTargets = [];

    if (!newUserId || targetsToTransfer.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Transferencia pendiente',
        detail: 'La cuenta fue creada, pero no se pudo identificar el ID del usuario para transferir los GPS.',
        life: 6000
      });
      return;
    }

    this.messageService.add({
      severity: 'info',
      summary: 'Transferencia iniciada',
      detail: `Transfiriendo ${targetsToTransfer.length} GPS a la cuenta creada...`,
      life: 3000
    });

    let successCount = 0;
    let errorCount = 0;

    for (const target of targetsToTransfer) {
      try {
        await this.targetsService.transferTarget(target._id, newUserId);
        successCount++;
      } catch (error) {
        errorCount++;
        console.error('Error transfiriendo GPS a cuenta creada:', { target, error });
      }
    }

    const createdAccountUser = await this.getCreatedAccountUser(createdUser, newUserId);

    this.targetsSelected = [];
    this.selectionService.clearSelection();
    this.transferCreatedAccountUser = createdAccountUser || createdUser;
    this.transferCreatedAccountTargets = targetsToTransfer;
    this.transferCreatedAccountSuccessCount = successCount;
    this.transferCreatedAccountErrorCount = errorCount;
    this.transferCreatedAccountSummaryVisible = true;
    this.managementService.setOp('t', newUserId);

    this.messageService.add({
      severity: errorCount > 0 ? 'warn' : 'success',
      summary: errorCount > 0 ? 'Transferencia parcial' : 'Transferencia completada',
      detail: errorCount > 0
        ? `Se transfirieron ${successCount} GPS y fallaron ${errorCount}.`
        : `Se transfirieron ${successCount} GPS a la cuenta creada.`,
      life: 6000
    });
  }

  private async getCreatedAccountUser(createdUser: any, userId: string): Promise<any> {
    const directUser = createdUser?.email || createdUser?.name ? createdUser : (createdUser?.user || createdUser?.data);
    if (directUser?.email || directUser?.name) {
      return directUser;
    }

    try {
      return await lastValueFrom(this.userService.getById(userId));
    } catch (error) {
      console.error('No se pudo cargar la cuenta creada para el resumen:', error);
      return createdUser;
    }
  }

  confirmDeleteUser(user: User) {
    // Validar permisos antes de permitir eliminar usuarios
    if (!this.canDeleteUsers()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('management.users.no_delete_permission'),
        detail: this.translate.instant('management.users.contact_admin')
      });
      return;
    }

    this.confirmationService.confirm({
      message: this.translate.instant('management.confirmDeleteUser'),
      header: this.translate.instant('management.userForm.confirmDeleteHeader'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('management.userForm.yes'),
      rejectLabel: this.translate.instant('management.userForm.no'),
      accept: () => {
        this.deleteUser(user);
      },
      reject: () => {
        // Opcional: manejar el rechazo si es necesario
        console.log('Usuario canceló la eliminación');
      }
    });
  }

  // ====================================
  // MÉTODOS PÚBLICOS - GESTIÓN DE TARGETS
  // ====================================

  async showTargetForm(target?: any) {
    // Validar permisos antes de permitir crear/editar targets
    if (target && !this.canUpdateDevices()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('management.devices.no_update_permission'),
        detail: this.translate.instant('management.devices.contact_admin')
      });
      return;
    }

    if (!target && !this.canCreateDevices()) {
      this.messageService.add({
        detail: this.translate.instant('management.devices.contact_admin')
      });
      return;
    }

    this.targetToEdit = target || null;
    this.initialFormTab = 0;
    this.uiService.showTargetForm();
  }

  openHistoryBlockPassword(target: any, event?: Event): void {
    event?.stopPropagation();
    if (!this.isCurrentUserRoot) {
      this.messageService.add({
        severity: 'error',
        summary: 'Acceso restringido',
        detail: 'Solo los usuarios root pueden bloquear rangos del historial.'
      });
      return;
    }
    if (!this.canUpdateDevices()) {
      this.messageService.add({
        severity: 'error',
        summary: 'Sin permiso',
        detail: 'No tienes permiso para modificar este objetivo.'
      });
      return;
    }

    this.historyBlockTarget = target?.originalTarget || target;
    this.historyBlockPassword = '';
    this.historyBlockStartsAt = null;
    this.historyBlockEndsAt = null;
    this.historyRangeDialogVisible = false;
    this.historyPasswordDialogVisible = true;
  }

  async verifyHistoryPassword(): Promise<void> {
    if (!this.historyBlockPassword.trim() || this.verifyingHistoryPassword) return;

    this.verifyingHistoryPassword = true;
    try {
      await this.targetsService.verifyHistoryBlockPassword(this.historyBlockPassword);
      this.historyPasswordDialogVisible = false;
      this.historyRangeDialogVisible = true;
      await this.loadHistoryBlocks();
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Clave incorrecta',
        detail: this.getHistoryBlockError(error, 'La clave ingresada no corresponde al usuario logueado.')
      });
    } finally {
      this.verifyingHistoryPassword = false;
    }
  }

  canBlockSelectedHistoryRange(): boolean {
    if (!this.historyBlockStartsAt || !this.historyBlockEndsAt) return false;
    return this.historyBlockStartsAt.getTime() < this.historyBlockEndsAt.getTime();
  }

  async blockHistoryRange(): Promise<void> {
    const targetId = String(this.historyBlockTarget?._id || '').trim();
    if (!targetId || !this.canBlockSelectedHistoryRange() || this.blockingHistory) {
      if (this.historyBlockStartsAt && this.historyBlockEndsAt &&
          this.historyBlockStartsAt.getTime() >= this.historyBlockEndsAt.getTime()) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Rango inválido',
          detail: 'La fecha final debe ser posterior a la fecha inicial.'
        });
      }
      return;
    }

    this.blockingHistory = true;
    try {
      const payload = {
        starts_at: this.historyBlockStartsAt!.toISOString(),
        ends_at: this.historyBlockEndsAt!.toISOString(),
        password: this.historyBlockPassword
      };
      if (this.editingHistoryBlockId) {
        await this.targetsService.updateHistoryBlock(
          targetId,
          this.editingHistoryBlockId,
          payload
        );
      } else {
        await this.targetsService.createHistoryBlock(targetId, payload);
      }

      this.messageService.add({
        severity: 'success',
        summary: this.editingHistoryBlockId ? 'Bloqueo actualizado' : 'Historial bloqueado',
        detail: 'La configuración de privacidad del historial fue guardada.'
      });
      this.cancelHistoryBlockEdit();
      await this.loadHistoryBlocks();
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'No se pudo bloquear el historial',
        detail: this.getHistoryBlockError(error, 'Verifica el rango e inténtalo nuevamente.')
      });
    } finally {
      this.blockingHistory = false;
    }
  }

  async loadHistoryBlocks(): Promise<void> {
    const targetId = String(this.historyBlockTarget?._id || '').trim();
    if (!targetId || !this.historyBlockPassword) return;

    this.loadingHistoryBlocks = true;
    try {
      this.historyBlocks = await this.targetsService.getHistoryBlocks(
        targetId,
        this.historyBlockPassword
      );
    } catch (error: any) {
      this.historyBlocks = [];
      this.messageService.add({
        severity: 'error',
        summary: 'No se pudieron cargar los bloqueos',
        detail: this.getHistoryBlockError(error, 'Inténtalo nuevamente.')
      });
    } finally {
      this.loadingHistoryBlocks = false;
    }
  }

  editHistoryBlock(block: HistoryBlockResponse): void {
    this.editingHistoryBlockId = block.id;
    this.historyBlockStartsAt = new Date(block.starts_at);
    this.historyBlockEndsAt = new Date(block.ends_at);
  }

  cancelHistoryBlockEdit(): void {
    this.editingHistoryBlockId = null;
    this.historyBlockStartsAt = null;
    this.historyBlockEndsAt = null;
  }

  async toggleHistoryBlock(block: HistoryBlockResponse): Promise<void> {
    const targetId = String(this.historyBlockTarget?._id || '').trim();
    if (!targetId || this.historyBlockActionId) return;

    this.historyBlockActionId = block.id;
    try {
      await this.targetsService.setHistoryBlockStatus(
        targetId,
        block.id,
        !block.active,
        this.historyBlockPassword
      );
      await this.loadHistoryBlocks();
      this.messageService.add({
        severity: 'success',
        summary: block.active ? 'Bloqueo desactivado' : 'Bloqueo activado',
        detail: block.active
          ? 'Ese rango volverá a estar disponible en los historiales.'
          : 'Ese rango volverá a omitirse de los historiales.'
      });
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'No se pudo cambiar el bloqueo',
        detail: this.getHistoryBlockError(error, 'Inténtalo nuevamente.')
      });
    } finally {
      this.historyBlockActionId = null;
    }
  }

  confirmDeleteHistoryBlock(block: HistoryBlockResponse): void {
    if (this.historyBlockActionId) return;
    this.confirmationService.confirm({
      header: 'Eliminar bloqueo',
      message: '¿Deseas eliminar permanentemente este bloqueo del historial?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => void this.deleteHistoryBlock(block)
    });
  }

  private async deleteHistoryBlock(block: HistoryBlockResponse): Promise<void> {
    const targetId = String(this.historyBlockTarget?._id || '').trim();
    if (!targetId || this.historyBlockActionId) return;

    this.historyBlockActionId = block.id;
    try {
      await this.targetsService.deleteHistoryBlock(
        targetId,
        block.id,
        this.historyBlockPassword
      );
      if (this.editingHistoryBlockId === block.id) {
        this.cancelHistoryBlockEdit();
      }
      await this.loadHistoryBlocks();
      this.messageService.add({
        severity: 'success',
        summary: 'Bloqueo eliminado',
        detail: 'El rango fue eliminado de la configuración de privacidad.'
      });
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'No se pudo eliminar el bloqueo',
        detail: this.getHistoryBlockError(error, 'Inténtalo nuevamente.')
      });
    } finally {
      this.historyBlockActionId = null;
    }
  }

  closeHistoryBlockDialogs(force: boolean = false): void {
    if (!force && (this.verifyingHistoryPassword || this.blockingHistory || !!this.historyBlockActionId)) return;
    this.historyPasswordDialogVisible = false;
    this.historyRangeDialogVisible = false;
    this.historyBlockTarget = null;
    this.historyBlockPassword = '';
    this.historyBlockStartsAt = null;
    this.historyBlockEndsAt = null;
    this.historyBlocks = [];
    this.editingHistoryBlockId = null;
    this.historyBlockActionId = null;
  }

  private getHistoryBlockError(error: any, fallback: string): string {
    const message = error?.error?.message;
    return Array.isArray(message) ? message.join(' ') : (message || error?.message || fallback);
  }

  initialFormTab: number = 0;

  async showTargetFormOnTab(target: any, tabIndex: number, event?: Event) {
    if (event) event.stopPropagation();
    this.initialFormTab = tabIndex;
    this.targetToEdit = target || null;
    this.uiService.showTargetForm();
  }

  showFiltersDialog: boolean = false;
  filterStatus: 'all' | 'online' | 'offline' = 'all';
  filterTag: string | null = null;
  filterSimCompany: string | null = null;
  availableSimCompanies = SIM_CARD_TYPES;

  toggleFilters() {
    this.showFiltersDialog = true;
  }

  onFilterChange() {
    this.showFiltersDialog = false;
    if (this.selectedUser) {
      this.loadingTargets = true;
      this.loadTargetsForUser(this.selectedUser._id, true);
    }
  }

  onStatusFilterChange(status: 'all' | 'online' | 'offline') {
    this.filterStatus = status;
    this.onFilterChange();
  }

  clearFilters() {
    this.filterStatus = 'all';
    this.filterTag = null;
    this.filterSimCompany = null;
    this.showFiltersDialog = false;
    if (this.selectedUser) {
      this.loadingTargets = true;
      this.loadTargetsForUser(this.selectedUser._id, true);
    }
  }

  // Método auxiliar para mapear targets a la vista
  private mapTargetsToView(targets: Target[]): any[] {
    if (!targets || targets.length === 0) {
      return [];
    }

    // Crear un Set con los IDs de targets compartidos para verificación rápida (si es posible obtenerlo aquí, 
    // si no, asumimos que ya viene marcado o lo calculamos de nuevo si es necesario, pero idealmente usamos el que ya tenemos)
    // Para simplificar y dado que mapTargetsToView se llama despues de cargar, 
    // podemos re-utilizar la logica de isShared si ya está en el objeto o recalcularla.
    // En loadTargetsForUser ya se identificaron los compartidos.
    // Sin embargo, targets contiene los objetos "crudos".
    // Necesitamos saber cuales son compartidos.
    // Una opción es que 'targets' ya tenga la propiedad isShared? No, targets es Target[].

    // Solución: Recalcular isShared basándonos en si el usuario logueado es el dueño o no, 
    // o confiar en que esta info viene del backend o de la carga inicial.
    // En loadTargetsForUser se hace `const isShared = sharedTargetIds.has(target._id);`

    // Para no complicar el refactor, pasaremos 'allTargets' o asumiremos que podemos determinar 'isShared' de otra forma.
    // O mejor, dejemos que mapTargetsToView reciba el set de sharedIds si es necesario, 
    // PERO 'targets' en 'this.targets' son los objetos originales.

    // Vamos a iterar y usar una logica genérica o recalcular.
    // Afortunadamente, 'this.targets' es acumulativo.
    // Cuando cargamos targets, calculamos 'isShared'. 
    // Sería mejor guardar esa info en el objeto 'target' en 'this.targets' si fuera extensible,
    // o mantener 'this.targets' limpio y recalcular.

    // Revisando loadTargetsForUser, 'combinedTargets' se asigna a 'this.targets'.
    // 'combinedTargets' son objetos Target.

    // IMPORTANTE: En el código original de loadTargetsForUser, se calculaba 'isShared' usando 'uniqueSharedTargets'.
    // Si queremos filtrar posteriomente, necesitamos mantener esa info.
    // Lo mejor es que 'this.targets' guarde objetos que YA tengan esa metadata si es posible, 
    // o que mapTargetsToView pueda acceder a ello.

    // VOY A MODIFICAR loadTargetsForUser para que extienda los objetos en 'this.targets' con 'isShared' 
    // antes de guardarlos, así mapTargetsToView es simple.

    const currentUserEmail = this.selectedUser?.email;

    return targets.map(target => {
      const traccarStatus = this.getDisplayTraccarStatus(target);
      const isOnline = traccarStatus === 'online';
      const isLocalizado = traccarStatus === 'Localizado';
      const isWeakSignal = traccarStatus === 'Señal débil';

      const targetAny = target as any;

      // Intentamos recuperar isShared si fue inyectado, o lo deducimos (menos fiable sin el contexto de sharedTargets original)
      // Pero espera, en loadTargetsForUser original:
      // const isShared = sharedTargetIds.has(target._id);
      // Si guardamos 'isShared' en el target dentro de 'this.targets', todo es más fácil.
      // Asumiremos que 'target' tiene la propiedad 'isShared' inyectada (lo haré en el siguiente paso).
      const isShared = targetAny.isShared === true;

      // Calcular tiempo offline
      let offlineTimeText = '';
      let offlineDateText = '';
      if (isWeakSignal && target.traccarInfo?.['lastUpdate']) {
        const offlineInfo = this.calculateOfflineTime(target.traccarInfo['lastUpdate']);
        offlineTimeText = 'Señal débil';
        offlineDateText = offlineInfo.dateText;
      } else if (!isOnline && target.traccarInfo?.['lastUpdate']) {
        const offlineInfo = this.calculateOfflineTime(target.traccarInfo['lastUpdate'], isLocalizado);
        offlineTimeText = offlineInfo.timeText;
        offlineDateText = offlineInfo.dateText;
      }

      let translatedStatus = '';
      if (isOnline) {
        translatedStatus = this.translate.instant('management.status.online');
      } else if (isWeakSignal) {
        translatedStatus = 'Señal débil';
      } else if (isLocalizado) {
        translatedStatus = 'Localizado';
      } else {
        translatedStatus = this.translate.instant('management.status.offline');
      }

      return {
        name: target.name,
        status: translatedStatus,
        imei: target.device_imei || target.imei,
        sim: target.sim_card_number || target.sim_card,
        expiration_date: target.expiration_date,
        _id: target._id,
        traccarStatus: traccarStatus,
        traccarInfo: target.traccarInfo,
        ignition_sensor: targetAny.ignition_sensor,
        connection_priority: target.connection_priority,
        verificado: targetAny.verificado,
        verified: targetAny.verified,
        matricula_img: targetAny.matricula_img,
        originalTarget: target,
        isShared: isShared,
        offlineTimeText: offlineTimeText,
        offlineDateText: offlineDateText,
        tag: target.tag,
        historicalLocation: target.historicalLocation
      };
    });
  }

  onHideTargetForm() {
    this.uiService.hideTargetForm();
    this.targetToEdit = null;
  }

  onTargetCreated(target?: any) {
    this.uiService.hideTargetForm();
    this.targetToEdit = null;

    if (this.selectedUser) {
      this.loadTargetsForUser(this.selectedUser._id);
    }
  }

  onTargetUpdatedWithoutClose(target?: any) {
    if (target && target._activationPollUpdateOnly) {
       const viewIndex = this.targetsList.findIndex((t: any) => t._id === target._id);
       if (viewIndex !== -1) {
           // Create new object references so Angular change detection picks up the change
           const updatedOriginal = {
               ...this.targetsList[viewIndex].originalTarget,
               activation_status: target.activation_status
           };
           this.targetsList[viewIndex] = {
               ...this.targetsList[viewIndex],
               originalTarget: updatedOriginal
           };
           // Force array reference change for OnPush / template re-evaluation
           this.targetsList = [...this.targetsList];
       }
       return;
    }

    if (this.selectedUser) {
      this.loadTargetsForUser(this.selectedUser._id);
    }
  }

  onTargetVehicleVerified(target?: any) {
    this.uiService.hideTargetForm();
    this.targetToEdit = null;

    if (this.selectedUser) {
      this.loadTargetsForUser(this.selectedUser._id);
    }

    this.confirmationService.confirm({
      header: 'Vehículo verificado',
      message: 'Se ha verificado el vehículo correctamente.',
      icon: 'pi pi-check-circle',
      acceptLabel: 'Cerrar',
      rejectVisible: false,
      acceptButtonStyleClass: 'p-button-success',
      accept: () => undefined,
    });
  }

  handleTargetClick(target: any, event: MouseEvent) {
    // Check if target is suspended before any other status.
    if (this.isTargetSuspended(target)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Dispositivo Suspendido',
        detail: 'Este dispositivo está suspendido y no se puede seleccionar.',
        life: 5000
      });
      return;
    }

    // Check if target is expired
    if (this.getExpirationStatus(target.expiration_date) === 'expired') {
      // Show toast message and prevent normal action
      this.messageService.add({
        severity: 'warn',
        summary: 'Dispositivo Expirado',
        detail: 'Este dispositivo está expirado y no se puede seleccionar.',
        life: 5000
      });
      return; // Prevent any further action
    }

    if (event.ctrlKey) {
      this.openTargetInNewTab(target);
    } else {
      // Click normal: agregar el query parameter 'target' a la URL actual
      this.addTargetToUrl(target);

      // Si el target es diferente al actual, cambiar selección y actualizar polling
      if (!this.selectedTargetForMap || this.selectedTargetForMap._id !== target._id) {
        this.stopPolling();

        // ✅ REINICIAR tiempo de parada cuando se cambia de target
        this.selectedTargetStopTime = undefined;

        this.selectedTargetForMap = target;
        this.recordTargetMapView(target);
        this.loadTargetOwnerLocation(target);
        this.startPolling();

        // Scroll automático hacia el target seleccionado
        this.scrollToSelectedTarget();
      }

      // En vista móvil, mostrar el mapa en pantalla completa
      if (this.isMobileView) {
        // Asegurar que los mapas estén visibles
        if (!this.uiService.areMapsVisible()) {
          this.uiService.toggleMaps();
        }

        this.showMobileMapFullscreen = true;
        this.cdr.detectChanges(); // Forzar detección de cambios



      }
    }
  }

  showAdditionalTargetOnMap(target: any): void {
    if (!target?._id) {
      return;
    }

    const listedTarget = this.targetsList.find((item: any) => item._id === target._id);
    const mappedTarget = listedTarget || this.mapTargetsToView([target as Target])[0] || target;

    this.addTargetToUrl(mappedTarget);

    if (!this.selectedTargetForMap || this.selectedTargetForMap._id !== mappedTarget._id) {
      this.stopPolling();
      this.selectedTargetStopTime = undefined;
      this.selectedTargetForMap = mappedTarget;
      this.recordTargetMapView(mappedTarget);
      this.loadTargetOwnerLocation(mappedTarget);
      this.startPolling();
      this.scrollToSelectedTarget();
    }

    if (this.isMobileView) {
      if (!this.uiService.areMapsVisible()) {
        this.uiService.toggleMaps();
      }
      this.showMobileMapFullscreen = true;
      this.cdr.detectChanges();
    }
  }

  private async loadTargetOwnerLocation(target: any): Promise<void> {
    if (!this.isLoggedEmployee()) {
      this.selectedTargetOwnerLocation = null;
      this.cdr.detectChanges();
      return;
    }

    const ownerId = this.getTargetOwnerId(target);
    if (!ownerId) {
      this.selectedTargetOwnerLocation = null;
      this.cdr.detectChanges();
      return;
    }

    if (this.targetOwnerLocationCache.has(ownerId)) {
      this.selectedTargetOwnerLocation = this.targetOwnerLocationCache.get(ownerId) || null;
      this.cdr.detectChanges();
      return;
    }

    try {
      const owner = await this.resolveTargetOwnerUser(ownerId);
      if (!this.isEmployeeLocationSubject(owner)) {
        this.targetOwnerLocationCache.set(ownerId, null);
        this.selectedTargetOwnerLocation = null;
        this.cdr.detectChanges();
        return;
      }

      const ownerName = await this.getTargetOwnerName(ownerId, target);
      const location = await lastValueFrom(this.userService.getLatestLocation(ownerId));
      const normalized = this.normalizeOwnerLocation(ownerId, ownerName, location);
      this.targetOwnerLocationCache.set(ownerId, normalized);
      this.selectedTargetOwnerLocation = normalized;
      this.cdr.detectChanges();
    } catch (error) {
      console.warn('No se pudo cargar la ubicación del usuario padre del objetivo:', error);
      this.targetOwnerLocationCache.set(ownerId, null);
      this.selectedTargetOwnerLocation = null;
      this.cdr.detectChanges();
    }
  }

  private async resolveTargetOwnerUser(ownerId: string): Promise<User | null> {
    if (this.selectedUser?._id === ownerId) {
      return this.selectedUser;
    }

    const listedUser = this.users.find(user => user._id === ownerId);
    if (listedUser) {
      return listedUser;
    }

    return await lastValueFrom(this.userService.getById(ownerId));
  }

  private getTargetOwnerId(target: any): string {
    const originalTarget = target?.originalTarget || target || {};
    return String(
      target?.parent_id ||
      target?.parentId ||
      target?.user_id ||
      originalTarget?.parent_id ||
      originalTarget?.parentId ||
      originalTarget?.user_id ||
      this.selectedUser?._id ||
      ''
    ).trim();
  }

  private async getTargetOwnerName(ownerId: string, target: any): Promise<string> {
    if (this.selectedUser?._id === ownerId) {
      return `${this.selectedUser.name || ''} ${this.selectedUser.last_name || ''}`.trim() || 'Usuario';
    }

    const originalTarget = target?.originalTarget || target || {};
    const directName = target?.parentName || originalTarget?.parentName || target?.user_name || originalTarget?.user_name;
    if (directName) {
      return String(directName);
    }

    const listedUser = this.users.find(user => user._id === ownerId);
    if (listedUser) {
      return `${listedUser.name || ''} ${listedUser.last_name || ''}`.trim() || 'Usuario';
    }

    const owner = await lastValueFrom(this.userService.getById(ownerId));
    return `${owner?.name || ''} ${owner?.last_name || ''}`.trim() || owner?.email || 'Usuario';
  }

  private normalizeOwnerLocation(
    userId: string,
    name: string,
    location: UserLatestLocation | null
  ): { userId: string; name: string; latitude: number; longitude: number; recordedAt?: string | Date } | null {
    const fallbackUser = this.selectedUser?._id === userId ? this.selectedUser : null;
    const realtime = (fallbackUser as any)?.realtime_location;
    const latitude = Number(location?.latitude ?? realtime?.latitude ?? fallbackUser?.latitude);
    const longitude = Number(location?.longitude ?? realtime?.longitude ?? fallbackUser?.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    return {
      userId,
      name,
      latitude,
      longitude,
      recordedAt: location?.recordedAt || realtime?.recordedAt || fallbackUser?.locationUpdatedAt,
    };
  }

  private addTargetToUrl(target: any) {
    const currentUserId = this.selectedUser?._id;
    if (currentUserId) {
      // Navegar a la misma ruta pero agregando el query parameter 'target'
      this.router.navigate(
        ['/admin/management', this.managementService.getOp(), currentUserId],
        {
          queryParams: { target: target._id },
          queryParamsHandling: 'merge' // Mantener otros query params existentes
        }
      );
    }
  }

  private removeTargetFromUrl() {
    const currentUserId = this.selectedUser?._id;
    if (currentUserId) {
      // Navegar a la misma ruta pero quitando el query parameter 'target'
      this.router.navigate(
        ['/admin/management', this.managementService.getOp(), currentUserId],
        {
          queryParams: { target: null },
          queryParamsHandling: 'merge' // Mantener otros query params existentes
        }
      );
    }
  }

  openTargetInNewTab(target: any) {
    const currentUserId = this.selectedUser?._id;
    if (currentUserId) {
      const url = this.router.serializeUrl(
        this.router.createUrlTree(['/admin/management', 't', currentUserId], {
          queryParams: { target: target._id }
        })
      );
      window.open(url, '_blank');
    }
  }

  hasOfflineActivationStatus(target: any): boolean {
    // Check live activating targets first
    if (this.activatingTargets.has(target._id)) return true;
    // Then check persisted activation_status
    if (target?.traccarStatus === 'online') return false;
    if (target?.traccarStatus === 'Señal débil') return false;
    const activation = target?.originalTarget?.activation_status;
    return !!(activation && activation.steps && activation.steps.length > 0);
  }

  getLastActivationStep(target: any): any {
    // Prefer live status from the activating target map
    const liveStatus = this.activatingTargetStatus.get(target._id);
    if (liveStatus && liveStatus.steps && liveStatus.steps.length > 0) {
      // Find the running step first
      const runningStep = liveStatus.steps.find((s: any) => s.status === 'running');
      if (runningStep) return runningStep;
      // Return the last step that has a meaningful status
      for (let i = liveStatus.steps.length - 1; i >= 0; i--) {
        if (liveStatus.steps[i].status !== 'pending') return liveStatus.steps[i];
      }
      return liveStatus.steps[0];
    }
    // If target is activating but no poll data yet, return synthetic running step
    if (this.activatingTargets.has(target._id)) {
      return { status: 'running', description: 'Iniciando activación...' };
    }
    // Fall back to persisted data
    const steps = target?.originalTarget?.activation_status?.steps;
    if (!steps || steps.length === 0) return null;
    return steps[steps.length - 1];
  }

  async startActivationFromList(target: any, event: Event): Promise<void> {
    event.stopPropagation();
    try {
      this.prepareOnlineActivationSound(target._id);
      // Start the activation in the backend
      await this.targetsService.startActivation(target._id);
      // Track it in the activating set for live badge updates
      this.activatingTargets.add(target._id);
      this.activatingTargetStatus.set(target._id, null);
      // Start polling for this target
      this.pollActivationStatus(target._id);
    } catch (e: any) {
      console.error('Error starting activation from list:', e);
      this.messageService.add({
        severity: 'warn',
        summary: 'No se pudo iniciar la activación',
        detail: getApiErrorMessage(e, 'Registra la instalación o inicia una revisión de oficina.')
      });
    }
  }

  private pollActivationStatus(targetId: string): void {
    const interval = setInterval(async () => {
      try {
        const updated = await this.targetsService.getTargetById(targetId);
        if (updated?.activation_status) {
          this.activatingTargetStatus.set(targetId, updated.activation_status);
          // Update persisted data in the list
          const viewIndex = this.targetsList.findIndex((t: any) => t._id === targetId);
          if (viewIndex !== -1) {
            this.targetsList[viewIndex].originalTarget = {
              ...this.targetsList[viewIndex].originalTarget,
              activation_status: updated.activation_status
            };
          }
          if (updated.activation_status.completed || updated.activation_status.cancelled) {
            this.playOnlineActivationSoundIfNeeded(targetId, updated.activation_status);
            this.activatingTargets.delete(targetId);
            this.activatingTargetStatus.delete(targetId);
            clearInterval(interval);
          }
        }
      } catch (e) {
        clearInterval(interval);
        this.activatingTargets.delete(targetId);
      }
    }, 3000);
  }

  onActivationEvent(event: { targetId: string, type: string, activation_status?: any }) {
    if (event.type === 'started') {
      this.prepareOnlineActivationSound(event.targetId);
      this.activatingTargets.add(event.targetId);
      this.activatingTargetStatus.set(event.targetId, null);
    } else if (event.type === 'progress') {
      this.activatingTargets.add(event.targetId);
      this.activatingTargetStatus.set(event.targetId, event.activation_status);
    } else if (event.type === 'completed' || event.type === 'error') {
      this.playOnlineActivationSoundIfNeeded(event.targetId, event.activation_status);
      this.activatingTargets.delete(event.targetId);
      this.activatingTargetStatus.delete(event.targetId);
      // Update the persisted data in the list
      const viewIndex = this.targetsList.findIndex((t: any) => t._id === event.targetId);
      if (viewIndex !== -1) {
        const updatedOriginal = {
          ...this.targetsList[viewIndex].originalTarget,
          activation_status: event.activation_status
        };
        this.targetsList[viewIndex] = {
          ...this.targetsList[viewIndex],
          originalTarget: updatedOriginal
        };
        this.targetsList = [...this.targetsList];
      }
    }
  }

  private prepareOnlineActivationSound(targetId?: string): void {
    if (targetId) this.playedOnlineActivationSounds.delete(targetId);
    if (typeof Audio === 'undefined') return;

    let audio: HTMLAudioElement | null = null;
    let originalVolume = 1;
    try {
      if (!this.onlineActivationAudio) {
        this.onlineActivationAudio = new Audio(this.onlineActivationAudioSrc);
        this.onlineActivationAudio.preload = 'auto';
      }

      const preparedAudio = this.onlineActivationAudio;
      audio = preparedAudio;
      originalVolume = preparedAudio.volume;
      preparedAudio.load();

      preparedAudio.volume = 0;
      const playPromise = preparedAudio.play();
      if (playPromise) {
        playPromise
          .then(() => {
            preparedAudio.pause();
            preparedAudio.currentTime = 0;
            preparedAudio.volume = originalVolume;
          })
          .catch(() => {
            preparedAudio.volume = originalVolume;
          });
      } else {
        preparedAudio.volume = originalVolume;
      }
    } catch (error) {
      if (audio) audio.volume = originalVolume;
      console.warn('No se pudo preparar el audio de activación online', error);
    }
  }

  private playOnlineActivationSoundIfNeeded(targetId: string, activationStatus: any): void {
    if (!targetId || this.playedOnlineActivationSounds.has(targetId)) return;
    if (!this.isSuccessfulOnlineActivation(activationStatus)) return;

    this.playedOnlineActivationSounds.add(targetId);
    const targetName = this.getActivationTargetName(targetId);
    this.messageService.add({
      severity: 'success',
      summary: 'Vehículo en línea',
      detail: `${targetName || 'El vehículo'} entró en línea y finalizó la activación.`,
      life: 6000
    });

    if (typeof Audio === 'undefined') return;

    try {
      const audio = this.onlineActivationAudio || new Audio(this.onlineActivationAudioSrc);
      this.onlineActivationAudio = audio;
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 1;
      audio.play().catch(error => {
        console.warn('No se pudo reproducir online.mp3', error);
      });
    } catch (error) {
      console.warn('No se pudo reproducir online.mp3', error);
    }
  }

  private getActivationTargetName(targetId: string): string {
    const target = this.targetsList.find((item: any) => item?._id === targetId);
    return target?.name || target?.originalTarget?.name || '';
  }

  private isSuccessfulOnlineActivation(activationStatus: any): boolean {
    if (!activationStatus?.completed || activationStatus?.cancelled) return false;

    const steps = Array.isArray(activationStatus.steps) ? activationStatus.steps : [];
    if (steps.some((step: any) => step?.status === 'error')) return false;

    const hasSuccessfulOnlineStep = steps.some((step: any) => {
      const label = this.normalizeActivationText(step?.label);
      const description = this.normalizeActivationText(step?.description);
      const isConnectionStep = label.includes('verificar conexion') || label.includes('mover el vehiculo');
      const saysOnline = description.includes('conexion exitosamente') || description.includes('dispositivo se conecto');
      return step?.status === 'success' && (isConnectionStep || saysOnline);
    });

    if (hasSuccessfulOnlineStep) return true;

    const logs = Array.isArray(activationStatus.logs) ? activationStatus.logs : [];
    return logs.some((log: any) => {
      if (log?.type !== 'success') return false;
      const message = this.normalizeActivationText(log?.message);
      return message.includes('dispositivo en linea') || message.includes('se ha conectado');
    });
  }

  private normalizeActivationText(value: any): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  async loadTargetDetails(target: any) {
    try {
      const targetDetails = await this.targetsService.getTargetById(target._id);

      this.messageService.add({
        severity: 'info',
        summary: `Datos de ${targetDetails.name}`,
        detail: `IMEI: ${targetDetails.device_imei || targetDetails.imei} | Estado: ${targetDetails.traccarInfo?.status || 'desconocido'}`,
        life: 5000
      });

    } catch (error) {
      console.error('Error al obtener datos del target:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: getApiErrorMessage(error, 'No se pudieron obtener los datos del dispositivo'),
        life: 3000
      });
    }
  }



  /**
   * Cambia la URL para navegar al usuario padre del target
   * @param target Target con parent_id diferente al usuario actual
   */
  navigateToParentUser(target: any, event?: MouseEvent) {
    // Buscar parent_id en el target principal o en originalTarget
    const originalTarget = target.originalTarget || target;
    const parentId = target.parent_id || target.parentId || target.user_id ||
      originalTarget.parent_id || originalTarget.parentId || originalTarget.user_id;

    if (parentId) {
      // Obtener el parámetro 'op' actual para mantenerlo en la navegación
      const currentOp = this.route.snapshot.params['op'] || 't';

      // Construir la URL completa con parámetros de consulta actuales
      const currentQueryParams = this.route.snapshot.queryParams;
      const queryString = new URLSearchParams(currentQueryParams).toString();
      const newUrl = `/admin/management/${currentOp}/${parentId}${queryString ? '?' + queryString : ''}`;

      if (event?.ctrlKey) {
        window.open(newUrl, '_blank');
      } else {
        this.router.navigate(['/admin/management', currentOp, parentId], {
          queryParams: currentQueryParams
        });
      }
    } else {
      console.error('❌ No se encontró parent_id/parentId/user_id en el target ni en originalTarget:', {
        target: target,
        originalTarget: originalTarget
      });
    }
  }

  /**
   * Obtiene el ID del usuario actual desde la URL
   * @returns El ID del usuario actual o null si no existe
   */
  getCurrentUserId(): string | null {
    // El routing es /:op/:user, así que 'user' es el segundo parámetro
    const userId = this.route.snapshot.params['user'];

    // Log simplificado para debugging

    // Si no hay userId en params, intentar desde selectedUser
    return userId || this.selectedUser?._id || null;
  }

  /**
   * Verifica si el target pertenece a un usuario diferente al actual
   * @param target Target a verificar
   * @returns true si el parent_id es diferente al usuario actual
   */
  shouldShowParentUserButton(target: any): boolean {
    const currentUserId = this.getCurrentUserId();

    // Buscar parent_id en el target principal o en originalTarget
    const originalTarget = target.originalTarget || target;
    const targetParentId = target.parent_id || target.parentId || target.user_id ||
      originalTarget.parent_id || originalTarget.parentId || originalTarget.user_id;

    // Log simplificado para debugging cuando sea necesario


    return !!(targetParentId && currentUserId && targetParentId !== currentUserId);
  }

  // ====================================
  // MÉTODOS PÚBLICOS - DATOS DE VEHÍCULOS (DELEGADOS)
  // ====================================

  public getVehicleTypeByModelId(modelId: string): string {
    return this.vehicleDataService.getVehicleTypeByModelId(modelId);
  }

  public getVehicleTypeImage(modelId: string): string | null {
    return this.vehicleDataService.getVehicleTypeImage(modelId);
  }

  public getDeviceSpeed(target: any): string {
    return this.vehicleDataService.getDeviceSpeed(target);
  }

  public isTargetVehicleInfoIncomplete(target: any): boolean {
    const source = target?.originalTarget || target || {};

    const hasBrand = this.hasVehicleFieldValue(
      source.target_brand_id,
      source.brand_id,
      source.brand,
      source.marca,
      source.marca_id
    );
    const hasModel = this.hasVehicleFieldValue(
      source.target_model_id,
      source.model_id,
      source.model,
      source.modelo,
      source.modelo_id
    );
    const hasYear = this.hasVehicleFieldValue(
      source.target_year,
      source.year,
      source.anio,
      source.ano,
      source['año']
    );
    const hasColor = this.hasVehicleFieldValue(
      source.target_color,
      source.color,
      source.color_id
    );

    return !(hasBrand && hasModel && hasYear && hasColor);
  }

  public isTargetMissingTechnician(target: any): boolean {
    const source = target?.originalTarget || target || {};
    const mechanicId = target?.mechanic_id
      ?? source.mechanic_id
      ?? target?.technician_id
      ?? source.technician_id
      ?? target?.mechanic
      ?? source.mechanic;

    if (mechanicId === null || mechanicId === undefined) {
      return true;
    }

    if (typeof mechanicId === 'string') {
      const normalized = mechanicId.trim().toLowerCase();
      return !normalized || normalized === 'null' || normalized === 'undefined' || normalized === 'no asignado';
    }

    if (typeof mechanicId === 'object') {
      return !(mechanicId._id || mechanicId.id || mechanicId.value);
    }

    return false;
  }

  public isTargetVerified(target: any): boolean {
    const source = target?.originalTarget || target || {};
    const device = source.device || target?.device || {};
    const linkedPrimaryTarget = this.findLinkedPrimaryTarget(target);
    const explicitValues = [
      target?.verificado,
      target?.verified,
      target?.is_verified,
      target?.vehicle_verified,
      source.verificado,
      source.verified,
      source.is_verified,
      source.vehicle_verified,
      device.verificado,
      device.verified,
      device.is_verified,
      device.vehicle_verified
    ];

    if (explicitValues.some(value => this.isBooleanLikeTrue(value))) {
      return true;
    }

    if (linkedPrimaryTarget && this.isTargetVerified(linkedPrimaryTarget)) {
      return true;
    }

    if (explicitValues.some(value => this.isBooleanLikeFalse(value))) {
      return false;
    }

    return this.hasVerificationMetadata(target?.matricula_img)
      || this.hasVerificationMetadata(source.matricula_img)
      || this.hasVerificationMetadata(device.matricula_img);
  }

  private findLinkedPrimaryTarget(target: any): any | null {
    const source = target?.originalTarget || target || {};
    const linkedImei = target?.gps_adicional ?? source.gps_adicional ?? target?.additional_gps ?? source.additional_gps;
    if (typeof linkedImei !== 'string' || !linkedImei.trim()) {
      return null;
    }

    const normalizedLinkedImei = linkedImei.trim();
    const allTargets = [...(this.targets || []), ...(this.allTargets || [])];
    return allTargets.find((candidate: any) => {
      const candidateSource = candidate?.originalTarget || candidate || {};
      const candidateImei = candidate?.device_imei || candidate?.imei || candidateSource.device_imei || candidateSource.imei;
      const candidateId = candidate?._id || candidateSource._id;
      const currentId = target?._id || source._id;
      return candidateId !== currentId && String(candidateImei || '').trim() === normalizedLinkedImei;
    }) || null;
  }

  public hasLinkedAdditionalGps(target: any): boolean {
    const source = target?.originalTarget || target || {};
    const linkedGps = target?.gps_adicional ?? source.gps_adicional ?? target?.additional_gps ?? source.additional_gps;

    if (typeof linkedGps === 'string') {
      return linkedGps.trim().length > 0;
    }

    return !!linkedGps;
  }

  public isTargetSuspended(target: any): boolean {
    const source = target?.originalTarget || target || {};
    const status = source.status ?? target?.status;

    return status === false
      || status === 'inactive'
      || status === 'suspended'
      || source.suspended === true;
  }

  public getTargetMovementLabel(target: any): string {
    if (this.isTargetSuspended(target)) {
      return 'Suspendido';
    }

    if (this.isTargetExpiredForMovement(target)) {
      return 'Expirado';
    }

    const status = this.getTargetUiTraccarStatus(target);
    if (this.isTargetAirtag(target)) {
      return status === 'Localizado' ? 'Localizado' : 'No localizado';
    }

    if (this.isTargetOfflineForMovement(status)) {
      return this.getTargetOfflineMovementLabel(target);
    }

    if (status === 'Señal débil') {
      return 'Señal débil';
    }

    const speedData = this.vehicleDataService.getDeviceSpeedData(target);
    return speedData.speedInKmh >= 1 ? `Moviendo · ${speedData.displayText}` : 'En línea';
  }

  public getTargetMovementClass(target: any): string {
    const status = this.getTargetUiTraccarStatus(target);
    const classes: string[] = [];

    if (this.isTargetSuspended(target)) {
      classes.push('target-inactive');
    } else if (this.isTargetExpiredForMovement(target)) {
      classes.push('target-expired');
    } else if (this.isTargetOfflineForMovement(status)) {
      classes.push('target-movement-status--offline', 'target-offline');
    } else if (status === 'Señal débil') {
      classes.push('target-movement-status--weak', 'target-weak-signal');
    } else {
      const speedData = this.vehicleDataService.getDeviceSpeedData(target);
      classes.push(speedData.speedInKmh >= 1 ? 'target-movement-status--moving' : 'target-movement-status--parked');
      classes.push(this.getTargetStatusColorClass(target));
    }

    if (this.selectedTargetForMap && this.selectedTargetForMap._id === target?._id) {
      classes.push('target-showing-on-map');
    }

    if (this.isTargetSuspended(target)) {
      classes.push('target-inactive');
    }

    return classes.join(' ');
  }

  public getTargetMovementIcon(target: any): string {
    if (this.isTargetSuspended(target)) {
      return 'pi pi-pause-circle';
    }

    if (this.isTargetExpiredForMovement(target)) {
      return 'pi pi-calendar-times';
    }

    const status = this.getTargetUiTraccarStatus(target);
    if (this.isTargetAirtag(target)) {
      return status === 'Localizado' ? 'pi pi-map-marker' : 'pi pi-ban';
    }

    if (this.isTargetOfflineForMovement(status)) {
      return 'pi pi-ban';
    }

    if (status === 'Señal débil') {
      return 'pi pi-wifi';
    }

    const speedData = this.vehicleDataService.getDeviceSpeedData(target);
    return speedData.speedInKmh >= 1 ? 'pi pi-car' : 'pi pi-circle-fill';
  }

  private getTargetStatusColorClass(target: any): string {
    const status = this.getTargetUiTraccarStatus(target);
    if (status === 'online') return 'target-online';
    if (status === 'Señal débil') return 'target-weak-signal';
    if (status === 'Localizado') return 'target-localizado';
    return 'target-offline';
  }

  private getTargetUiTraccarStatus(target: any): string {
    return this.isTargetAirtag(target)
      ? this.getDisplayTraccarStatus(target)
      : (target?.traccarStatus || this.getDisplayTraccarStatus(target));
  }

  private isTargetOfflineForMovement(status?: string | null): boolean {
    return status !== 'online' && status !== 'Señal débil' && status !== 'Localizado';
  }

  private getTargetOfflineMovementLabel(target: any): string {
    const existingText = String(target?.offlineTimeText || '').trim();
    if (existingText && existingText.toLowerCase().startsWith('fuera de línea hace')) {
      return existingText;
    }

    const source = target?.originalTarget || target || {};
    const lastUpdate = target?.traccarInfo?.lastUpdate
      || source?.traccarInfo?.lastUpdate
      || target?.lastUpdate
      || source?.lastUpdate;

    if (!lastUpdate) {
      return 'Fuera de línea';
    }

    const offlineInfo = this.calculateOfflineTime(lastUpdate);
    return offlineInfo.timeText || 'Fuera de línea';
  }

  private isTargetExpiredForMovement(target: any): boolean {
    return this.getExpirationStatus(target?.expiration_date) === 'expired';
  }

  private hasVehicleFieldValue(...values: any[]): boolean {
    return values.some(value => {
      if (value === null || value === undefined) return false;
      if (typeof value === 'string') return value.trim().length > 0;
      if (typeof value === 'object') return !!(value._id || value.id || value.value || value.name || value.nombre);
      return true;
    });
  }

  private isBooleanLikeTrue(value: any): boolean {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'si' || normalized === 'sí';
    }

    return value === true || value === 1;
  }

  private isBooleanLikeFalse(value: any): boolean {
    if (value === null || value === undefined || value === '') {
      return false;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return normalized === 'false' || normalized === '0' || normalized === 'no';
    }

    return value === false || value === 0;
  }

  private hasVerificationMetadata(value: any): boolean {
    if (!value) {
      return false;
    }

    if (typeof value === 'string') {
      return value.trim().length > 0;
    }

    if (typeof value !== 'object') {
      return false;
    }

    return !!(
      value.path
      || value.url
      || value.file_path
      || value.route
      || value.verified_at
      || value.metadata
      || value.extracted_data
    );
  }

  public getTargetImageUrl(target: any): string | null {
    const t = target?.originalTarget;
    const img = t?.target_image_thumbnail || t?.target_image;
    if (!img) return null;
    if (img.startsWith('http')) return img;
    return `https://back-montao.dorhu.com${img}`;
  }

  public isImageAvailable(url: string | null | undefined): boolean {
    return !!url && !this.unavailableImageUrls.has(url);
  }

  public hasTargetImage(target: any): boolean {
    return this.isImageAvailable(this.getTargetImageUrl(target));
  }

  public handleImageLoadError(url: string | null | undefined): void {
    if (url) {
      this.unavailableImageUrls.add(url);
    }
  }

  public getTargetFormImageUrl(fullSize: boolean = false): string | null {
    // Delegate to target-form component if available (handles change detection)
    if (!fullSize && this.targetFormRef?.getTargetImageUrl) {
      return this.targetFormRef.getTargetImageUrl();
    }
    const t = this.targetToEdit;
    const img = fullSize
      ? (t?.target_image || t?.originalTarget?.target_image || t?.target_image_thumbnail || t?.originalTarget?.target_image_thumbnail)
      : (t?.target_image_thumbnail || t?.target_image || t?.originalTarget?.target_image_thumbnail || t?.originalTarget?.target_image);
    if (!img) return null;
    if (img.startsWith('http')) return img;
    return `https://back-montao.dorhu.com${img}`;
  }

  public async generateAIImage(target: any): Promise<void> {
    const originalTarget = target.originalTarget;
    if (!originalTarget) return;

    const targetId = target._id;
    if (this.generatingAITargets.has(targetId)) return;

    const brandId = originalTarget.target_brand_id;
    const modelId = originalTarget.target_model_id;
    const colorName = this.vehicleDataService.getColorName(originalTarget.target_color);
    const year = parseInt(originalTarget.target_year, 10) || new Date().getFullYear();

    // Resolve brand and model names from IDs
    const brandName = this.vehicleDataService.getVehicleBrandName(brandId);
    const modelName = this.vehicleDataService.getVehicleModelName(modelId);

    if (!brandName || brandName === 'Marca no especificada' || brandName === 'Marca no encontrada') {
      this.messageService.add({ severity: 'warn', summary: 'Datos incompletos', detail: 'El target necesita una marca válida para generar la imagen.' });
      return;
    }

    if (!colorName) {
      this.messageService.add({ severity: 'warn', summary: 'Datos incompletos', detail: 'El target necesita un color válido para generar la imagen.' });
      return;
    }

    this.generatingAITargets.add(targetId);
    this.cdr.detectChanges();

    try {
      const result = await this.targetsService.generateAIImage({
        brand: brandName,
        model: modelName || 'sedan',
        color: colorName,
        year,
      });

      if (result?.url) {
        // Save image URLs to the device
        const imageData: any = { target_image: result.url };
        if (result.thumbnailUrl) imageData.target_image_thumbnail = result.thumbnailUrl;
        await this.targetsService.updateTarget(targetId, imageData);

        // Update local data
        originalTarget.target_image = result.url;
        originalTarget.target_image_thumbnail = result.thumbnailUrl || result.url;
        
        const msg = result.fromCache ? 'Imagen encontrada en cache' : 'Imagen generada con IA exitosamente';
        this.messageService.add({ severity: 'success', summary: 'Imagen lista', detail: msg });
      }
    } catch (error: any) {
      console.error('Error generating AI image:', error);
      this.messageService.add({ severity: 'error', summary: 'Error', detail: error?.error?.message || 'No se pudo generar la imagen con IA.' });
    } finally {
      this.generatingAITargets.delete(targetId);
      this.cdr.detectChanges();
    }
  }

  /**
   * Checks cache for targets without images, saves found thumbnails to devices
   */
  private async populateDeviceImagesFromCache(targetsList: any[]): Promise<void> {
    try {
      const cacheHits = await this.vehicleDataService.loadAICacheForTargets(targetsList);
      // El catálogo de las marcas visibles ya está disponible para nombres e imágenes.
      this.cdr.detectChanges();
      if (cacheHits.size === 0) return;

      // Save images to devices in parallel
      const savePromises = Array.from(cacheHits.entries()).map(async ([deviceId, { url, thumbnailUrl }]) => {
        try {
          await this.targetsService.updateTarget(deviceId, {
            target_image: url,
            target_image_thumbnail: thumbnailUrl,
          } as any);

          // Update local data
          const target = targetsList.find(t => t._id === deviceId);
          if (target?.originalTarget) {
            target.originalTarget.target_image = url;
            target.originalTarget.target_image_thumbnail = thumbnailUrl;
          }
        } catch (err) {
          // Silently ignore save errors
        }
      });

      await Promise.all(savePromises);
      this.cdr.detectChanges();
    } catch (err) {
      // Silently ignore
    }
  }

  public formatSpeedDisplay(speedInKmh: number): string {
    return this.vehicleDataService.formatSpeedDisplay(speedInKmh);
  }

  // ====================================
  // MÉTODOS PRIVADOS - INICIALIZACIÓN
  // ====================================

  private setupInitialState(): void {
    this.uiService.setLoading(true);
    this.screenService.checkScreenSize();
    this.uiService.updateScreenSize();
  }

  private setupSubscriptions(): void {
    // Suscribirse a notificaciones de actualización de targets (ej: cuando se restaura un target)
    this.subscriptions.push(
      this.selectionService.targetsUpdated$.subscribe(updated => {
        if (updated && this.selectedUser) {
          console.log('🔄 Targets actualizados desde navbar, recargando lista...');
          this.loadTargetsForUser(this.selectedUser._id);
        }
      })
    );

    // Suscribirse a cambios en la selección desde el servicio (para limpiar desde navbar)
    this.subscriptions.push(
      this.selectionService.selectedTargets$.subscribe(selectedTargets => {
        // Si el servicio reporta 0 seleccionados pero localmente tenemos seleccionados,
        // significa que se limpió desde otro componente (ej: Navbar)
        if (selectedTargets.length === 0 && this.targetsSelected.length > 0) {
          console.log('🧹 Limpiando selección local de targets (sincronización con servicio)');
          this.targetsSelected = [];
        }
      })
    );

    this.subscriptions.push(
      this.selectionService.selectedTargetsBulkAction$.subscribe(action => {
        if (!this.targetsSelected || this.targetsSelected.length === 0) return;

        if ((action === 'cancel' || action === 'suspend') && (!this.canCancelDevices() || this.currentUserAffiliationTypeId !== 'empleado')) {
          return;
        }

        if (action === 'cancel') {
          this.confirmMassCancelSelected();
        } else if (action === 'suspend') {
          this.openMassSuspendSelected();
        } else if (action === 'create-transfer') {
          this.openCreateUserAndTransferSelected();
        }
      })
    );

    // Suscribirse a cambios de UI state
    this.subscriptions.push(
      this.uiService.uiState$.subscribe(uiState => {
        // Reaccionar a cambios de estado si es necesario
      })
    );

    // Suscribirse a cambios responsive
    this.subscriptions.push(
      this.uiService.responsiveState$.subscribe(responsiveState => {
        this.uiService.autoShowMapsIfMobileAndHasTargets(this.targetsList.length > 0);
      })
    );

    // Configurar búsqueda de usuarios con debounce
    this.subscriptions.push(
      this.searchUsersSubject.pipe(
        debounceTime(300), // Esperar 300ms después de que el usuario deje de escribir
        // distinctUntilChanged() removed to allow re-triggering search with same term after user modifications
        switchMap(searchTerm => {
          const requestedUserId = String(this.selectedUser?._id || '').trim();
          if (!this.isValidManagementUserId(requestedUserId) || this.loadingUserRouteId) {
            // La ruta y los query params pueden emitirse antes de que termine de
            // cargar el usuario. Conservamos la búsqueda y evitamos enviar un
            // `parent` vacío al backend.
            this.pendingUserSearchTerm = searchTerm;
            this.isSearchingUsers = false;
            return of({
              response: null as UsersResponse | null,
              requestedUserId,
              settlesPageLoading: false,
            });
          }

          this.pendingUserSearchTerm = '';
          let request$: Observable<UsersResponse>;
          if (searchTerm.trim() === '') {
            // Si no hay término de búsqueda, cargar usuarios normales con paginación
            this.isSearchingUsers = false;
            // Resetear paginación y cargar usuarios con scroll infinito
            this.currentUsersOffset = 0;
            this.hasMoreUsers = true;
            this.users = [];
            request$ = this.userService
              .getAllWithPagination(requestedUserId, 0, this.usersPageSize);
          } else {
            // Realizar búsqueda con paginación
            this.isSearchingUsers = true;
            // Resetear paginación para búsqueda
            this.currentUsersOffset = 0;
            this.hasMoreUsers = true;
            this.users = [];
            request$ = this.userService
              .search(searchTerm, requestedUserId, 0, this.usersPageSize);
          }

          return request$.pipe(
            map(response => ({ response, requestedUserId, settlesPageLoading: true })),
            catchError(error => {
              console.error('❌ Error en búsqueda de usuarios:', error);
              this.messageService.add({
                severity: 'error',
                summary: 'Error de búsqueda',
                detail: getApiErrorMessage(error, 'No se pudieron buscar los usuarios'),
                life: 3000
              });
              // El error de una petición no debe cerrar el stream del buscador.
              return of({
                response: null as UsersResponse | null,
                requestedUserId,
                settlesPageLoading: true,
              });
            })
          );
        })
      ).subscribe({
        next: ({ response, requestedUserId, settlesPageLoading }) => {
          if (this.selectedUser?._id !== requestedUserId) return;
          if (settlesPageLoading) {
            this.initialSearchExecuted = true;
            this.uiService.setLoading(false);
          }
          if (!response) return;
          // Siempre recibimos un objeto con users y totalCount
          const sanitizedUsers = this.sanitizeManagementUsers(response.users);
          const selfMatches = sanitizedUsers.filter(
            user => String(user?._id || '') === requestedUserId,
          ).length;
          this.users = sanitizedUsers.filter(
            user => String(user?._id || '') !== requestedUserId,
          );
          this.totalUsersCount = Math.max(0, response.totalCount - selfMatches);
          this.currentUsersOffset = response.users.length;
          this.hasMoreUsers = this.currentUsersOffset < this.totalUsersCount;
        },
        error: error => console.error('❌ Error inesperado en el buscador de usuarios:', error)
      })
    );

    // Configurar búsqueda de targets con debounce
    this.subscriptions.push(
      this.searchTargetsSubject.pipe(
        debounceTime(300), // Esperar 300ms después de que el usuario deje de escribir
        // distinctUntilChanged() removed to allow re-triggering search with same term after target modifications
        switchMap(searchTerm => {
          const requestedUserId = this.selectedUser?._id || '';
          if (searchTerm.trim() === '') {
            // Si no hay término de búsqueda, cargar targets normales con paginación
            this.isSearchingTargets = false;
            if (this.selectedUser) {
              // Resetear paginación y cargar targets con scroll infinito
              this.currentOffset = 0;
              this.hasMoreTargets = true;
              this.targets = [];
              const parentId = this.managementService.getCurrentUserId();
              return from(this.targetsService.getTargetsByUserId(
                requestedUserId,
                parentId,
                0,
                this.pageSize,
                this.filterStatus,
                this.filterTag || undefined,
                this.filterSimCompany || undefined
              )).pipe(map(response => ({ response, requestedUserId })));
            }
            return from([{ response: { devices: [], totalCount: 0 }, requestedUserId }]);
          } else {
            // Realizar búsqueda con paginación
            this.isSearchingTargets = true;
            // Resetear paginación para búsqueda
            this.currentOffset = 0;
            this.hasMoreTargets = true;
            this.targets = [];
            const parentId = this.managementService.getCurrentUserId();
            return from(this.targetsService.searchTargets(
              searchTerm,
              parentId,
              0,
              this.pageSize,
              this.filterStatus,
              this.filterTag || undefined,
              this.filterSimCompany || undefined
            )).pipe(map(response => ({ response, requestedUserId })));
          }
        })
      ).subscribe({
        next: ({ response, requestedUserId }) => {
          if (this.selectedUser?._id !== requestedUserId) return;
          // Siempre recibimos un objeto con devices y totalCount
          this.targets = response.devices || [];

          // Transformar targets para la lista usando el helper
          if (this.targets && this.targets.length > 0) {
            this.targetsList = this.buildTargetsView(this.targets);
            // Check cache and save images to devices that don't have one
            this.populateDeviceImagesFromCache(this.targetsList);
          } else {
            this.targetsList = [];
          }

          this.totalTargetsCount = response.totalCount;
          this.hasMoreTargets = this.targets.length < this.totalTargetsCount;
          this.currentOffset = this.targets.length;
          this.showNoTargetMessage = this.targetsList.length === 0;
          this.tryOpenInventoryAssignedTarget();


          // Actualizar estado de polling después de búsqueda/carga
          this.initializePreviousTargetsStatus();

          // Iniciar polling si hay targets y aún no está activo
          if (this.targets.length > 0 && !this.pollingInterval) {
            this.startPolling();
          }
        },
        error: (error) => {
          console.error('❌ Error en búsqueda de targets:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error de búsqueda',
            detail: getApiErrorMessage(error, 'No se pudieron buscar los dispositivos'),
            life: 3000
          });
        }
      })
    );
  }

  private setupRouting(): void {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      this.router.navigate(['auth/login']);
      return;
    }

    // Obtener el tipo de afiliación del usuario actual
    this.currentUserAffiliationTypeId = currentUser?.affiliation_type_id || '';

    // Resolver una sola vez cada usuario de ruta. switchMap cancela el HTTP
    // anterior si el usuario navega a otra cuenta antes de que termine.
    this.subscriptions.push(
      this.route.params.pipe(
        tap(params => this.managementService.verifyURLStatus(params)),
        map(params => String(params['user'] || '').trim()),
        filter(userId => this.isValidManagementUserId(userId)),
        distinctUntilChanged(),
        tap(userId => {
          this.loadingUserRouteId = userId;
          this.uiService.setLoading(true);
        }),
        switchMap(userId => this.managementService.loadUserData$(userId).pipe(
          map(user => ({ userId, user })),
          catchError(error => {
            console.error('Error al cargar los datos del usuario:', error);
            this.loadingUserRouteId = '';
            this.uiService.setLoading(false);
            void this.router.navigate(['/admin/dashboard']);
            return EMPTY;
          }),
        )),
      ).subscribe(({ userId, user }) => {
        if (String(user._id) !== userId) return;
        this.loadingUserRouteId = '';
        this.handleUserLoaded(user);
      })
    );

    // Configurar suscripciones a query parameters
    this.subscriptions.push(
      this.route.queryParams.subscribe(queryParams => {
        this.handleQueryParams(queryParams);
      })
    );
  }

  /**
   * Indica si el usuario seleccionado es el mismo que el usuario logueado
   */
  get isSelectedUserCurrentUser(): boolean {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.selectedUser?._id) {
      return false;
    }

    return currentUser.id === this.selectedUser._id;
  }

  get isUserSearchReady(): boolean {
    const selectedUserId = String(this.selectedUser?._id || '').trim();
    return !this.loadingUserRouteId && this.isValidManagementUserId(selectedUserId);
  }

  private cleanupSubscriptions(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
  }

  /**
   * Maneja cambios en la selección de targets
   */
  onTargetsSelectionChange(): void {
    // Actualizar el servicio de selección con los targets seleccionados
    this.selectionService.updateSelectedTargets(this.targetsSelected || []);

    console.log('🔄 Selección de targets actualizada:', {
      count: this.targetsSelected?.length || 0,
      targets: this.targetsSelected?.map(t => ({ id: t._id, name: t.name })) || []
    });
  }

  // ====================================
  // MÉTODOS PRIVADOS - ROUTING
  // ====================================

  private handleRouteParams(params: any, currentUser: any): void {
    const newUserId = params['user'];
    const currentSelectedUserId = this.selectedUser?._id;

    // Solo cargar datos del usuario si realmente cambió
    if (newUserId && newUserId !== currentSelectedUserId) {
      this.loadUserFromParams(newUserId);
    } else if (!newUserId && !this.selectedUser) {
      this.loadUserFromState(currentUser);
    }

    this.managementService.verifyURLStatus(params);
  }

  private handleQueryParams(queryParams: any): void {
    const inventoryTargetId = String(queryParams['inventoryTargetId'] || '').trim();
    const inventoryAction = String(queryParams['inventoryAction'] || '').trim();
    if (inventoryTargetId && ['reserve', 'install', 'review'].includes(inventoryAction)) {
      this.pendingInventoryTargetId = inventoryTargetId;
      this.pendingInventoryAction = inventoryAction as 'reserve' | 'install' | 'review';
    }

    if (this.managementService.getOp() === 'u') {
      this.searchUsersTerm = queryParams['search'] || '';
      // Always sync with service state (even if empty to clear)
      this.managementService.setSearchUsersTerm(this.searchUsersTerm);

      // Execute search if it's the first load and we have a search term
      if (this.searchUsersTerm && !this.initialSearchExecuted) {
        this.searchUsersSubject.next(this.searchUsersTerm);
      }
    } else if (this.managementService.getOp() === 't') {
      this.searchTargetsTerm = queryParams['search'] || '';
      // Always sync with service state (even if empty to clear)
      this.managementService.setSearchTargetsTerm(this.searchTargetsTerm);

      // Execute search if it's the first load and we have a search term
      if (this.searchTargetsTerm && !this.initialSearchExecuted) {
        // Defer execution until data is loaded
        this.pendingInitialSearchTerm = this.searchTargetsTerm;
      }
    }

    // Persist URL status after updating terms
    this.managementService.setURLStatus();

    // Note: initialSearchExecuted will be set to true after the search is actually performed
    // or if no search was pending, in loadTargetsForUser completion

    // Si hay un parámetro 'target' en la URL, mostrar automáticamente los mapas y seleccionar el target
    if (queryParams['target']) {
      this.uiService.showMaps();
      this.selectTargetFromUrl(queryParams['target']);

      // Si estamos en móvil, activar también el mapa en pantalla completa
      if (this.isMobileView) {
        this.showMobileMapFullscreen = true;
      }
    } else {
      // Si no hay target en la URL, limpiar la selección y detener polling
      this.targetIdFromUrl = null;
      this.selectedTargetForMap = null;
      this.selectedTargetOwnerLocation = null;
      this.stopPolling();
      this.enforceDefaultMapWhenNoTarget();
    }
  }

  private tryOpenInventoryAssignedTarget(): void {
    if (!this.pendingInventoryTargetId || this.openingInventoryTarget) return;
    const listedTarget = this.targets.find(
      (target: any) => String(target?._id || '') === this.pendingInventoryTargetId,
    ) || this.targetsList.find(
      (target: any) => String(target?._id || target?.originalTarget?._id || '') === this.pendingInventoryTargetId,
    );
    if (!listedTarget) return;

    const rawTarget = (listedTarget as any).originalTarget || listedTarget;
    const action = this.pendingInventoryAction;
    this.openingInventoryTarget = true;
    this.pendingInventoryTargetId = '';
    this.pendingInventoryAction = '';

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { inventoryTargetId: null, inventoryAction: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    void this.showTargetForm({
      ...rawTarget,
      _openInstallationRegistration: action === 'install',
      _openOfficeReview: action === 'review',
    }).finally(() => {
      this.openingInventoryTarget = false;
    });
  }

  private selectTargetFromUrl(targetId: string): void {
    this.targetIdFromUrl = targetId;

    // Si ya tenemos la lista de targets cargada, seleccionar inmediatamente
    if (this.targetsList && this.targetsList.length > 0) {
      this.findAndSelectTarget(targetId);
    }
    // Si no, el target se seleccionará cuando se cargue la lista en loadTargetsForUser
  }

  private findAndSelectTarget(targetId: string): void {
    const target = this.targetsList.find(t => t._id === targetId);
    if (target) {
      // Detener polling anterior si existe
      this.stopPolling();

      // ✅ REINICIAR tiempo de parada cuando se selecciona target desde URL
      this.selectedTargetStopTime = undefined;

      this.selectedTargetForMap = target;
      this.recordTargetMapView(target);
      this.loadTargetOwnerLocation(target);

      // Iniciar polling para el nuevo target seleccionado
      this.startPolling();

      // Scroll automático hacia el target seleccionado
      this.scrollToSelectedTarget();
    } else {
      console.warn('⚠️ Target no encontrado en la lista:', targetId);
    }
  }

  private recordTargetMapView(target: any): void {
    const targetId = String(target?._id || target?.id || '').trim();
    if (!targetId) return;

    const now = Date.now();
    const lastRecordedAt = this.targetMapViewRecordedAt.get(targetId) || 0;
    if (now - lastRecordedAt < 30000) return;

    this.targetMapViewRecordedAt.set(targetId, now);
    this.userActivityService.recordGpsMapView(target).subscribe({
      error: () => undefined,
    });
  }

  private loadUserFromParams(userId: string): void {
    const requestId = ++this.userRouteLoadRequestId;
    this.loadingUserRouteId = userId;
    this.managementService.loadUserData(userId)
      .then(user => {
        if (requestId !== this.userRouteLoadRequestId || user._id !== userId) {
          return;
        }
        this.loadingUserRouteId = '';
        this.handleUserLoaded(user);
      })
      .catch(() => {
        if (requestId === this.userRouteLoadRequestId) {
          this.loadingUserRouteId = '';
          this.uiService.setLoading(false);
        }
      });
  }

  private loadUserFromState(currentUser: any): void {
    const managementState: any = this.status.getState('management');
    const storedUserId = managementState?.url_route ? managementState.url_route[2] : null;
    const currentUserId = currentUser.id || currentUser._id;

    if (storedUserId && storedUserId === currentUserId) {
      this.loadUserFromParams(storedUserId);
    } else {
      this.loadUserFromParams(currentUserId);
    }
  }

  private handleUserLoaded(user: User): void {
    this.closeUserLocationDialog();
    this.targetOwnerLocationCache.clear();
    this.selectedUser = this.sanitizeManagementUserLocation(user);
    // La cabecera puede mostrarse de inmediato; cada panel administra su propio loading.
    this.uiService.setLoading(false);
    // Limpiar datos anteriores y resetear bandera de carga completada
    this.users = [];
    this.targetsList = [];
    this.refreshTargetsCardList();
    this.targets = [];
    this.targetsSelected = [];
    this.targetsLoadCompletedFlag = false;

    // Limpiar selección cuando se cambia de usuario
    this.selectionService.clearSelection();

    // ✅ REINICIAR tiempo de parada cuando se cambia de usuario
    this.selectedTargetStopTime = undefined;
    this.selectedTargetForMap = null;
    this.selectedTargetOwnerLocation = null;

    const activeSearch = this.route.snapshot.queryParamMap.get('search')
      || this.pendingUserSearchTerm
      || '';
    const activeOp = this.managementService.getOp();
    this.searchUsersTerm = activeOp === 'u' ? activeSearch : '';
    this.searchTargetsTerm = activeOp === 't' ? activeSearch : '';
    this.initialSearchExecuted = false;
    this.pendingInitialSearchTerm = this.searchTargetsTerm;
    this.pendingUserSearchTerm = '';

    this.loadUserPath(user._id);
    this.loadManagementSummary(user._id);
    this.userWarehouse = null;
    if (activeOp === 't') {
      this.loadTargetsForUser(user._id);
    } else {
      this.stopPolling();
      this.loadUsersForUser(user._id);
    }
  }

  private isValidManagementUserId(value: unknown): boolean {
    return /^[a-f\d]{24}$/i.test(String(value || '').trim());
  }

  private loadManagementSummary(userId: string): void {
    const requestId = ++this.managementSummaryLoadRequestId;
    this.managementSummaryLoading = true;
    this.userService.getManagementSummary(userId).subscribe({
      next: summary => {
        if (
          requestId !== this.managementSummaryLoadRequestId ||
          this.selectedUser?._id !== userId
        ) return;
        this.totalUsersCount = summary.usersCount;
        this.directUsersCount = summary.usersCount;
        this.totalTargetsCount = summary.targetsCount;
        this.managementSummaryLoading = false;
      },
      error: () => {
        if (
          requestId !== this.managementSummaryLoadRequestId ||
          this.selectedUser?._id !== userId
        ) return;

        // Compatibilidad durante despliegues escalonados: si el backend todavía
        // no expone el resumen liviano, obtenemos únicamente los conteos de la
        // primera página y nunca mostramos un cero engañoso.
        forkJoin({
          users: this.userService.getAllWithPagination(userId, 0, 1),
          targets: from(this.targetsService.getTargetsWithPagination(userId, 0, 1)),
        }).subscribe({
          next: ({ users, targets }) => {
            if (
              requestId !== this.managementSummaryLoadRequestId ||
              this.selectedUser?._id !== userId
            ) return;
            this.totalUsersCount = users.totalCount;
            this.directUsersCount = users.totalCount;
            this.totalTargetsCount = targets.totalCount;
            this.managementSummaryLoading = false;
          },
          error: () => {
            if (requestId === this.managementSummaryLoadRequestId) {
              this.managementSummaryLoading = false;
            }
          },
        });
      },
    });
  }

  // ====================================
  // WAREHOUSE METHODS
  // ====================================

  private loadUserWarehouse(onLoaded?: (warehouse: Warehouse | null) => void): void {
    const requestId = ++this.warehouseLoadRequestId;
    if (!this.selectedUser?.email) {
      this.userWarehouse = null;
      onLoaded?.(null);
      return;
    }
    const email = this.selectedUser.email;

    this.inventoryService.getAssignedWarehouse(email).subscribe({
      next: (warehouse) => {
        if (
          requestId !== this.warehouseLoadRequestId ||
          this.selectedUser?.email !== email
        ) return;
        this.userWarehouse = warehouse;
        onLoaded?.(warehouse);
      },
      error: () => {
        if (requestId !== this.warehouseLoadRequestId) return;
        this.userWarehouse = null;
        onLoaded?.(null);
      }
    });
  }

  openWarehouseModal(): void {
    if (!this.canReadInventory()) return;
    if (!this.userWarehouse?._id) {
      this.loadUserWarehouse((warehouse) => {
        if (warehouse?._id) {
          this.openWarehouseModal();
          return;
        }
        this.messageService.add({
          severity: 'info',
          summary: 'Sin almacén',
          detail: 'Esta cuenta no tiene un almacén asignado.',
          life: 3000,
        });
      });
      return;
    }
    this.warehouseModalVisible = true;
    this.loadingWarehouseDevices = true;
    this.userWarehouseDevices = [];
    this.inventoryService.searchAllDevices('', this.userWarehouse._id, 1, 200, 'available').subscribe({
      next: (response) => {
        this.userWarehouseDevices = response.data || [];
        this.loadingWarehouseDevices = false;
      },
      error: () => {
        this.userWarehouseDevices = [];
        this.loadingWarehouseDevices = false;
      }
    });
  }

  closeWarehouseModal(): void {
    this.warehouseModalVisible = false;
    this.userWarehouseDevices = [];
  }

  installFromWarehouse(device: InventoryItem): void {
    const imei = (device.IMEI || device.imei || '').trim();
    const sim = (device.SIM || device.sim || '').trim();

    const solicitud: any = {
      type: 'instalacion',
      status: 'pendiente',
      quantity: 1,
      client_name: this.selectedUser?.name ? `${this.selectedUser.name} ${this.selectedUser.last_name || ''}`.trim() : '',
      client_phone: this.selectedUser?.phone || '',
      client_email: this.selectedUser?.email || '',
      user_id: this.selectedUser?._id || '',
      installations: [{
        device_imei: imei,
        sim_card_number: sim
      }]
    };

    this.solicitudesService.create(solicitud).subscribe({
      next: () => {
        this.warehouseModalVisible = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Solicitud creada',
          detail: `Solicitud de instalación creada para IMEI ${imei}`
        });
        this.router.navigate(['/admin/solicitudes']);
      },
      error: (error) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: getApiErrorMessage(error, 'No se pudo crear la solicitud')
        });
      }
    });
  }

  // ====================================
  // MÉTODOS PRIVADOS - GESTIÓN DE DATOS
  // ====================================

  /**
   * Calcula el tiempo transcurrido desde la última actualización y formatea la fecha
   * @param lastUpdate Fecha de la última actualización
   * @returns Objeto con el tiempo transcurrido y la fecha formateada
   */
  private calculateOfflineTime(lastUpdate: string | Date, isLocalizado: boolean = false): { timeText: string; dateText: string } {
    try {
      const lastUpdateDate = new Date(lastUpdate);
      const now = new Date();
      const diffInMs = now.getTime() - lastUpdateDate.getTime();

      // Verificar que la fecha sea válida
      if (isNaN(lastUpdateDate.getTime())) {
        return { timeText: 'Fecha inválida', dateText: 'Fecha inválida' };
      }

      // Verificar que no sea una fecha futura
      if (diffInMs < 0) {
        return { timeText: 'Fecha futura', dateText: 'Fecha futura' };
      }

      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
      const diffInWeeks = Math.floor(diffInDays / 7);
      const diffInMonths = Math.floor(diffInDays / 30);
      const diffInYears = Math.floor(diffInDays / 365);

      // Formatear tiempo transcurrido
      let timeText = '';
      const prefix = isLocalizado ? 'Última ubicación hace' : 'Fuera de línea hace';
      if (diffInYears > 0) {
        timeText = `${prefix} ${diffInYears} año${diffInYears > 1 ? 's' : ''}`;
      } else if (diffInMonths > 0) {
        timeText = `${prefix} ${diffInMonths} mes${diffInMonths > 1 ? 'es' : ''}`;
      } else if (diffInWeeks > 0) {
        timeText = `${prefix} ${diffInWeeks} semana${diffInWeeks > 1 ? 's' : ''}`;
      } else if (diffInDays > 0) {
        timeText = `${prefix} ${diffInDays} día${diffInDays > 1 ? 's' : ''}`;
      } else if (diffInHours > 0) {
        timeText = `${prefix} ${diffInHours} hora${diffInHours > 1 ? 's' : ''}`;
      } else if (diffInMinutes > 0) {
        timeText = `${prefix} ${diffInMinutes} minuto${diffInMinutes > 1 ? 's' : ''}`;
      } else {
        timeText = `${prefix} menos de 1 minuto`;
      }

      // Formatear fecha de última ubicación
      const dateText = lastUpdateDate.toLocaleString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      return { timeText, dateText };
    } catch (error) {
      console.error('Error calculando tiempo offline:', error);
      const detail = error instanceof Error ? error.message : String(error);
      return {
        timeText: `No se pudo calcular el tiempo: ${detail}`,
        dateText: 'La fecha de la última ubicación no es válida',
      };
    }
  }

  private loadUserPath(userId: string): void {
    const requestId = ++this.userPathLoadRequestId;
    this.userService.getUserPath(userId).subscribe({
      next: (pathData) => {
        if (
          requestId !== this.userPathLoadRequestId ||
          this.selectedUser?._id !== userId
        ) return;
        this.breadcrumbService.updateFromUserPath(
          pathData,
          this.selectedUser,
          this.authService.getCurrentUser(),
        );
      },
      error: (error) => {
        if (requestId !== this.userPathLoadRequestId) return;
        console.error('Error al obtener ruta del usuario:', error);
        this.breadcrumbService.updateFromUserPath(
          [],
          this.selectedUser,
          this.authService.getCurrentUser(),
        );
      }
    });
  }

  /**
   * Obtiene el color de la prioridad de conexión basado en el tiempo fuera de línea
   */
  getConnectionPriorityColor(target: any): string {
    if (!target.connection_priority || target.connection_priority === 'normal') {
      return '';
    }

    // Si está online, color verde seguro
    if (target.traccarStatus === 'online') {
      return '#22c55e'; // Green
    }

    try {
      const lastUpdateStr = target.traccarInfo?.lastUpdate;
      if (!lastUpdateStr) {
        return '#9ca3af'; // Gray (unknown)
      }

      const lastUpdate = new Date(lastUpdateStr);
      const now = new Date();
      // Diferencia en horas
      const diffInHours = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);

      let thresholdHours = 0;

      switch (target.connection_priority) {
        case 'maximum': // 6 horas
          thresholdHours = 6;
          break;
        case 'important': // 1 día (24 horas)
          thresholdHours = 24;
          break;
        case 'standard': // 3 días (72 horas)
          thresholdHours = 72;
          break;
        default:
          return '#9ca3af';
      }

      // Si supera el límite -> Rojo
      if (diffInHours >= thresholdHours) {
        return '#ef4444'; // Red
      }
      // Si está cerca del límite (ej. > 75%) -> Naranja
      else if (diffInHours >= thresholdHours * 0.75) {
        return '#f97316'; // Orange
      }
      // Si está a medio camino (ej. > 50%) -> Amarillo
      else if (diffInHours >= thresholdHours * 0.5) {
        return '#eab308'; // Yellow
      }

      return '#22c55e'; // Green
    } catch (e) {
      console.error('Error calculando color de prioridad:', e);
      return '#9ca3af';
    }
  }

  private async loadUsersForUser(userId: string, resetPagination: boolean = true): Promise<void> {
    const requestId = ++this.usersListLoadRequestId;
    // Validar permisos antes de cargar usuarios
    if (!this.canReadUsers()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('management.users.no_permissions'),
        detail: this.translate.instant('management.users.contact_admin')
      });
      this.uiService.setLoading(false);
      return;
    }

    // Si hay un término de búsqueda activo, usar la búsqueda en lugar de cargar todos
    if (this.searchUsersTerm && this.searchUsersTerm.trim() !== '') {
      this.searchUsersSubject.next(this.searchUsersTerm);
      return;
    }

    console.log(`[USUARIOS] 📋 Cargando usuarios para user: ${userId} - resetPagination: ${resetPagination}`);

    try {
      // Resetear paginación si es necesario
      if (resetPagination) {
        this.currentUsersOffset = 0;
        this.hasMoreUsers = true;
        this.users = [];
      }

      // Obtener el usuario logueado
      const loggedUser = this.authService.getCurrentUser();
      const loggedUserId = loggedUser?.id;

      // Verificar si el usuario logueado es el mismo que está en la URL
      const shouldLoadSharedUsers = loggedUserId === userId;

      if (shouldLoadSharedUsers) {
        // Cargar usuarios normales con paginación y compartidos en paralelo
        const [usersResponse, sharedUsers] = await Promise.all([
          this.userService.getAllWithPagination(userId, this.currentUsersOffset, this.usersPageSize).toPromise(),
          this.userService.getSharedUsers().toPromise()
        ]);

        if (requestId !== this.usersListLoadRequestId || this.selectedUser?._id !== userId) {
          return;
        }

        if (usersResponse) {
          // Unir las dos listas, eliminando duplicados por ID
          const allUsers = [...(usersResponse.users || [])];

          // Agregar usuarios compartidos que no estén ya en la lista
          (sharedUsers || []).forEach(sharedUser => {
            if (!allUsers.find(user => user._id === sharedUser._id)) {
              allUsers.push(sharedUser);
            }
          });

          // Agregar usuarios a la lista existente
          this.users = this.deduplicateUsers([
            ...this.users,
            ...this.sanitizeManagementUsers(allUsers),
          ]);
          this.totalUsersCount = usersResponse.totalCount;
          this.directUsersCount = usersResponse.totalCount;

          // Verificar si hay más usuarios disponibles
          this.currentUsersOffset += usersResponse.users.length;
          this.hasMoreUsers = this.currentUsersOffset < this.totalUsersCount;

          console.log(`[USUARIOS] ✅ Usuarios cargados exitosamente:`, {
            totalEnLista: this.users.length,
            totalEnBD: this.totalUsersCount,
            hasMore: this.hasMoreUsers,
            offset: this.currentUsersOffset
          });
        }
      } else {
        // Solo cargar usuarios normales con paginación si no es el usuario logueado
        const usersResponse = await this.userService.getAllWithPagination(
          userId,
          this.currentUsersOffset,
          this.usersPageSize
        ).toPromise();

        if (requestId !== this.usersListLoadRequestId || this.selectedUser?._id !== userId) {
          return;
        }

        if (usersResponse) {
          // Agregar usuarios a la lista existente
          this.users = this.deduplicateUsers([
            ...this.users,
            ...this.sanitizeManagementUsers(usersResponse.users),
          ]);
          this.totalUsersCount = usersResponse.totalCount;
          this.directUsersCount = usersResponse.totalCount;

          // Verificar si hay más usuarios disponibles
          this.currentUsersOffset += usersResponse.users.length;
          this.hasMoreUsers = this.currentUsersOffset < this.totalUsersCount;

          console.log(`[USUARIOS] ✅ Usuarios cargados exitosamente:`, {
            totalEnLista: this.users.length,
            totalEnBD: this.totalUsersCount,
            hasMore: this.hasMoreUsers,
            offset: this.currentUsersOffset
          });
        }
      }

      this.uiService.setLoading(false);
    } catch (error) {
      console.error('❌ Error al cargar usuarios:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('management.error'),
        detail: getApiErrorMessage(error, 'Error al cargar usuarios')
      });
      this.uiService.setLoading(false);
    }
  }
  showNoTargetMessage = false;

  selectingAllTargets = false;

  get areAllTargetsSelected(): boolean {
    const selectableTargets = this.targetsList.filter(t => !t.isShared);
    return selectableTargets.length > 0 && this.targetsSelected.length === selectableTargets.length && !this.hasMoreTargets;
  }

  async selectAllTargets() {
    if (!this.canUpdateDevices() || !this.selectedUser) return;
    
    // Verificar si ya están todos seleccionados (de los que se pueden seleccionar)
    if (this.areAllTargetsSelected) {
      // Si ya están todos seleccionados y no hay más por cargar, quitamos la selección
      this.targetsSelected = [];
      return;
    }

    const selectableTargets = this.targetsList.filter(t => !t.isShared);

    // Si ya no hay más targets por cargar, o si ya están todos cargados localmente
    if (!this.hasMoreTargets) {
      this.targetsSelected = selectableTargets;
      return;
    }

    this.selectingAllTargets = true;
    try {
      console.log('[SELECT ALL] 🚀 Cargando TODOS los targets faltantes para seleccionar...');
      const parentId = this.managementService.getCurrentUserId();
      const userEmail = this.selectedUser.email;
      const LIMIT = 9999; 
      const activeSearchTerm = this.searchTargetsTerm.trim();

      let targetsPromise;
      if (activeSearchTerm) {
        targetsPromise = this.targetsService.searchTargets(
          activeSearchTerm,
          parentId,
          0,
          LIMIT,
          'all',
          this.filterTag || undefined,
          this.filterSimCompany || undefined
        );
      } else {
        targetsPromise = this.targetsService.getTargetsByUserId(
          this.selectedUser._id,
          parentId,
          0,
          LIMIT,
          'all',
          this.filterTag || undefined,
          this.filterSimCompany || undefined
        );
      }

      const sharedPromise = !activeSearchTerm && userEmail
        ? this.targetsService.getSharedTargets(userEmail)
        : Promise.resolve([]);
      
      const [targetsResponse, sharedTargets] = await Promise.all([targetsPromise, sharedPromise]);

      // Filtrar targets compartidos manualmente (frontend)
      let filteredSharedTargets = sharedTargets;
      if (this.filterStatus !== 'all') {
        filteredSharedTargets = sharedTargets.filter(t => this.matchesConnectionFilter(t));
      }

      if (this.filterTag) {
        filteredSharedTargets = filteredSharedTargets.filter(t => t.tag === this.filterTag);
      }

      if (this.filterSimCompany) {
        filteredSharedTargets = filteredSharedTargets.filter(t => t.sim_company?.toLowerCase() === this.filterSimCompany?.toLowerCase());
      }

      const fetchedTargets = targetsResponse.devices || [];
      
      // Combinar targets: compartidos primero, luego propios (evitando duplicados)
      const ownTargetIds = new Set(fetchedTargets.map((t: any) => t._id));
      const uniqueSharedTargets = filteredSharedTargets.filter(t => !ownTargetIds.has(t._id));
      const combinedTargets = [...uniqueSharedTargets, ...fetchedTargets];

      // Verificar y marcar isShared
      const sharedTargetIds = new Set(uniqueSharedTargets.map(t => t._id));
      combinedTargets.forEach(t => {
        (t as any).isShared = sharedTargetIds.has(t._id);
      });

      this.targets = combinedTargets;
      this.totalTargetsCount = targetsResponse.totalCount || combinedTargets.length;
      
      // Ya no hay más targets para este filtro
      this.hasMoreTargets = false;
      this.currentOffset = fetchedTargets.length;
      
      // Mapear y aplicar un filtro final ya con estados normalizados.
      this.targetsList = this.buildTargetsView(this.targets);
      this.totalTargetsCount = this.isConnectionFilterActive() ? this.targetsList.length : this.totalTargetsCount;
      this.showNoTargetMessage = this.targetsList.length === 0;
      
      // Check cache and save images to devices that don't have one
      this.populateDeviceImagesFromCache(this.targetsList);

      // Ahora que tenemos la lista completa que coincide con el filtro, seleccionamos
      this.targetsSelected = this.targetsList.filter(t => !t.isShared);
      
      console.log(`[SELECT ALL] ✅ ${this.targetsSelected.length} targets seleccionados exitosamente.`);

    } catch (error) {
      console.error('[SELECT ALL] ❌ Error al cargar todos los targets:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: getApiErrorMessage(error, 'No se pudieron cargar todos los dispositivos para seleccionarlos')
      });
    } finally {
      this.selectingAllTargets = false;
    }
  }

  // Método para cargar más targets (scroll infinito)
  private async loadMoreTargets() {
    // Verificaciones de seguridad para evitar cargas múltiples
    if (!this.selectedUser || this.loadingMoreTargets || !this.hasMoreTargets || this.loadingTargets) {
      return;
    }

    console.log(`[SCROLL INFINITO] 🚀 Cargando más targets - offset: ${this.currentOffset}, hasMore: ${this.hasMoreTargets}`);

    this.loadingMoreTargets = true;
    try {
      let response;
      const activeSearchTerm = this.searchTargetsTerm.trim();
      if (activeSearchTerm) {
        // Si estamos en modo búsqueda, usar el endpoint de búsqueda
        const parentId = this.managementService.getCurrentUserId();
        response = await this.targetsService.searchTargets(
          activeSearchTerm,
          parentId,
          this.currentOffset,
          this.pageSize,
          this.filterStatus,
          this.filterTag || undefined,
          this.filterSimCompany || undefined
        );
      } else {
        // Si no estamos buscando, usar el endpoint normal
        const parentId = this.managementService.getCurrentUserId();
        await this.loadTargetsForUser(this.selectedUser._id, false);
        console.log(`[SCROLL INFINITO] ✅ Targets cargados exitosamente - total: ${this.targets.length}`);

        // Subir el scroll 300px después de cargar nuevos targets
        setTimeout(() => {
          this.scrollUpAfterLoad();
        }, 100);

        this.loadingMoreTargets = false;
        return;
      }

      if (response) {
        // Marcar los nuevos targets como no compartidos (ya que el scroll infinito trae targets propios)
        const newDevices = response.devices.map((d: any) => {
          d.isShared = false;
          return d;
        });

        this.targets = [...this.targets, ...newDevices];
        this.totalTargetsCount = response.totalCount;
        this.hasMoreTargets = this.targets.length < this.totalTargetsCount;
        this.currentOffset += newDevices.length;

        console.log(`[SCROLL INFINITO] ✅ Cargados ${response.devices.length} targets más. Total: ${this.targets.length}/${this.totalTargetsCount}`);

        // Transformar targets para la lista directamente
        if (this.targets && this.targets.length > 0) {
          this.targetsList = this.buildTargetsView(this.targets);
        }
      }

      // Subir el scroll 300px después de cargar nuevos targets
      setTimeout(() => {
        this.scrollUpAfterLoad();
      }, 100);

    } catch (error) {
      console.error('[SCROLL INFINITO] ❌ Error cargando más targets:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: getApiErrorMessage(error, 'No se pudieron cargar más dispositivos')
      });
    } finally {
      this.loadingMoreTargets = false;
    }
  }

  // Método para cargar más usuarios (scroll infinito)
  private async loadMoreUsers() {
    // Verificaciones de seguridad para evitar cargas múltiples
    if (!this.selectedUser || this.loadingMoreUsers || !this.hasMoreUsers) {
      return;
    }

    console.log(`[SCROLL INFINITO USUARIOS] 🚀 Cargando más usuarios - offset: ${this.currentUsersOffset}, hasMore: ${this.hasMoreUsers}`);

    this.loadingMoreUsers = true;
    const userId = this.selectedUser._id;
    const requestId = this.usersListLoadRequestId;
    try {
      let response;
      if (this.isSearchingUsers && this.searchUsersTerm.trim() !== '') {
        // Si estamos en modo búsqueda, usar el endpoint de búsqueda
        response = await this.userService.search(
          this.searchUsersTerm,
          this.selectedUser._id,
          this.currentUsersOffset,
          this.usersPageSize
        ).toPromise();
      } else {
        // Si no estamos buscando, usar el endpoint normal
        response = await this.userService.getAllWithPagination(
          this.selectedUser._id,
          this.currentUsersOffset,
          this.usersPageSize
        ).toPromise();
      }

      if (requestId !== this.usersListLoadRequestId || this.selectedUser?._id !== userId) {
        return;
      }

      if (response) {
        this.users = this.deduplicateUsers([
          ...this.users,
          ...this.sanitizeManagementUsers(response.users),
        ]);
        this.totalUsersCount = response.totalCount;
        if (!this.isSearchingUsers) {
          this.directUsersCount = response.totalCount;
        }
        this.currentUsersOffset += response.users.length;
        this.hasMoreUsers = this.currentUsersOffset < this.totalUsersCount;

        console.log(`[SCROLL INFINITO USUARIOS] ✅ Cargados ${response.users.length} usuarios más. Total: ${this.users.length}/${this.totalUsersCount}`);
      }

      // Ajustar scroll después de cargar
      setTimeout(() => {
        this.scrollUpAfterLoad();
      }, 100);
    } catch (error) {
      console.error('[SCROLL INFINITO USUARIOS] ❌ Error al cargar más usuarios:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: getApiErrorMessage(error, 'No se pudieron cargar más usuarios')
      });
    } finally {
      this.loadingMoreUsers = false;
    }
  }

  private deduplicateUsers(users: User[]): User[] {
    const seenIds = new Set<string>();

    return users.filter(user => {
      const userId = String(user?._id || '').trim();
      if (!userId || seenIds.has(userId)) {
        return false;
      }

      seenIds.add(userId);
      return true;
    });
  }

  // Método para subir el scroll después de cargar nuevos targets
  private scrollUpAfterLoad() {
    const scrollContainer = document.querySelector('.management__content-body');
    if (scrollContainer) {
      const currentScrollTop = scrollContainer.scrollTop;
      const newScrollTop = Math.max(0, currentScrollTop - 100);
      scrollContainer.scrollTo({
        top: newScrollTop,
        behavior: 'smooth'
      });
      console.log(`[SCROLL INFINITO] 📈 Scroll ajustado: ${currentScrollTop}px → ${newScrollTop}px`);
    }
  }

  // Método para hacer scroll automático hacia el target seleccionado
  private scrollToSelectedTarget() {
    if (!this.selectedTargetForMap) {
      return;
    }

    // Esperar un poco para que el DOM se actualice
    setTimeout(() => {
      const selectedTargetElement = document.querySelector('.target-selected-for-map');
      const scrollContainer = document.querySelector('.management__content-body');

      if (selectedTargetElement && scrollContainer) {
        const containerRect = scrollContainer.getBoundingClientRect();
        const targetRect = selectedTargetElement.getBoundingClientRect();

        // Calcular la posición relativa del target dentro del contenedor
        const targetTop = targetRect.top - containerRect.top + scrollContainer.scrollTop;
        const targetBottom = targetRect.bottom - containerRect.top + scrollContainer.scrollTop;
        const containerHeight = containerRect.height;

        // Calcular la posición de scroll para centrar el target
        const scrollPosition = targetTop - (containerHeight / 2) + (targetRect.height / 2);

        scrollContainer.scrollTo({
          top: Math.max(0, scrollPosition),
          behavior: 'smooth'
        });

        console.log(`[SCROLL TARGET] 🎯 Scroll hacia target seleccionado: ${this.selectedTargetForMap.name}`);
      }
    }, 100);
  }

  // Propiedad para controlar el debounce del scroll
  private scrollTimeout: any;

  // Método para detectar scroll y cargar más contenido
  onScroll(event: any) {
    // Limpiar timeout anterior si existe
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }

    // Aplicar debounce de 100ms para evitar múltiples llamadas
    this.scrollTimeout = setTimeout(() => {
      const element = event.target;
      const threshold = 150; // Aumentar threshold para evitar cargas prematuras

      // Verificar si estamos cerca del final y no estamos ya cargando
      if (element.scrollTop + element.clientHeight >= element.scrollHeight - threshold) {
        // Cargar más contenido según la operación actual
        if (this.managementService.getOp() === 't') {
          this.loadMoreTargets();
        } else if (this.managementService.getOp() === 'u') {
          this.loadMoreUsers();
        }
      }
    }, 100);
  }
  private async loadTargetsForUser(userId: string, resetPagination: boolean = true) {
    const requestId = ++this.targetsLoadRequestId;
    const activeSearchTerm = this.searchTargetsTerm.trim();
    // Validar permisos antes de cargar targets/devices
    if (!this.canReadDevices()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('management.devices.no_permissions'),
        detail: this.translate.instant('management.devices.contact_admin')
      });
      this.loadingTargets = false;
      this.targetsLoadCompletedFlag = true;
      return;
    }


    try {
      // Resetear paginación si es necesario
      if (resetPagination) {
        this.currentOffset = 0;
        this.hasMoreTargets = true;
        this.targets = [];
      }

      const parentId = this.managementService.getCurrentUserId();
      this.loadingTargets = true;

      // Cargar targets propios y compartidos en paralelo
      const userEmail = this.selectedUser?.email;

      const pageSizeForRequest = resetPagination ? this.initialPageSize : this.pageSize;
      const requestOffset = this.currentOffset;

      // Toda recarga debe respetar el texto visible en el buscador. Esto cubre
      // las recargas posteriores a editar, verificar o restaurar un objetivo,
      // incluso si el flag de búsqueda todavía no fue actualizado por debounce.
      this.isSearchingTargets = activeSearchTerm.length > 0;
      const targetsPromise = activeSearchTerm
        ? this.targetsService.searchTargets(
            activeSearchTerm,
            parentId,
            requestOffset,
            pageSizeForRequest,
            this.filterStatus,
            this.filterTag || undefined,
            this.filterSimCompany || undefined
          )
        : this.targetsService.getTargetsByUserId(
            userId,
            parentId,
            requestOffset,
            pageSizeForRequest,
            this.filterStatus,
            this.filterTag || undefined,
            this.filterSimCompany || undefined
          );
      // La búsqueda del backend ya representa el conjunto filtrado. No se
      // deben anteponer objetivos compartidos sin filtrar porque volverían a
      // aparecer GPS que no coinciden con el query.
      const sharedPromise = !activeSearchTerm && userEmail
        ? this.targetsService.getSharedTargets(userEmail)
        : Promise.resolve([]);

      const [targetsResponse, sharedTargets] = await Promise.all([targetsPromise, sharedPromise]);

      if (
        requestId !== this.targetsLoadRequestId ||
        this.selectedUser?._id !== userId ||
        activeSearchTerm !== this.searchTargetsTerm.trim()
      ) {
        return;
      }

      // Filtrar targets compartidos manualmente (frontend) ya que la API de shared no soporta filtro por status aún
      let filteredSharedTargets = sharedTargets;
      if (this.filterStatus !== 'all') {
        filteredSharedTargets = sharedTargets.filter(t => this.matchesConnectionFilter(t));
      }

      if (this.filterTag) {
        filteredSharedTargets = filteredSharedTargets.filter(t => t.tag === this.filterTag);
      }

      if (this.filterSimCompany) {
        filteredSharedTargets = filteredSharedTargets.filter(t => t.sim_company?.toLowerCase() === this.filterSimCompany?.toLowerCase());
      }

      // Extraer devices y totalCount de la respuesta
      const targets = targetsResponse.devices || [];
      const backendTotalCount = targetsResponse.totalCount || targets.length;
      this.totalTargetsCount = backendTotalCount;

      // Combinar targets: compartidos primero, luego propios (evitando duplicados)
      const ownTargetIds = new Set(targets.map(t => t._id));
      const uniqueSharedTargets = filteredSharedTargets.filter(t => !ownTargetIds.has(t._id));
      const combinedTargets = [...uniqueSharedTargets, ...targets];

      // Si es la primera carga, reemplazar. Si es scroll infinito, agregar
      if (resetPagination) {
        this.targets = combinedTargets;
      } else {
        // Para scroll infinito, solo agregar los targets propios (no los compartidos)
        this.targets = [...this.targets, ...targets];
      }

      // Verificar si hay más targets disponibles
      const newOffset = requestOffset + targets.length;
      if (typeof this.totalTargetsCount === 'number' && this.totalTargetsCount > 0) {
        this.hasMoreTargets = newOffset < this.totalTargetsCount;
        this.currentOffset = newOffset;
      } else {
        this.hasMoreTargets = targets.length === pageSizeForRequest;
        this.currentOffset = newOffset;
      }

      if (this.targets && this.targets.length > 0) {
        // Crear un Set con los IDs de targets compartidos para verificación rápida
        const sharedTargetIds = new Set(uniqueSharedTargets.map(t => t._id));

        // Inyectar propiedad isShared en los objetos raw para que mapTargetsToView pueda usarla
        this.targets.forEach(t => {
          (t as any).isShared = sharedTargetIds.has(t._id);
        });

        // Mapear y aplicar un filtro final ya con estados normalizados.
        this.targetsList = this.buildTargetsView(this.targets);
        this.totalTargetsCount = backendTotalCount;
        // Check cache and save images to devices that don't have one
        this.populateDeviceImagesFromCache(this.targetsList);
      } else {
        this.targetsList = [];
        this.totalTargetsCount = backendTotalCount;
      }

      this.showNoTargetMessage = this.targetsList.length === 0;



      // Actualizar visibilidad de mapas si es necesario
      this.uiService.autoShowMapsIfMobileAndHasTargets(this.targetsList.length > 0);

      // Reinicializar el estado de polling de status después de cargar targets
      this.initializePreviousTargetsStatus();

      // Iniciar polling de status si hay targets cargados
      if (this.targetsList.length > 0) {
        this.startPolling();
      }

      if (this.targetIdFromUrl) {
        this.findAndSelectTarget(this.targetIdFromUrl);
      }

      this.tryOpenInventoryAssignedTarget();

      // Si no había término al iniciar la carga, todavía puede existir una
      // búsqueda diferida proveniente de la URL. Cuando sí había término, la
      // consulta ya se ejecutó directamente arriba y no debe repetirse.
      if (!activeSearchTerm && this.pendingInitialSearchTerm && !this.initialSearchExecuted) {
        console.log('🔍 Ejecutando búsqueda inicial diferida:', this.pendingInitialSearchTerm);
        this.searchTargetsSubject.next(this.pendingInitialSearchTerm);
        this.pendingInitialSearchTerm = '';
      }
      if (activeSearchTerm) {
        this.pendingInitialSearchTerm = '';
      }
      // Always mark as executed after data load to prevent future auto-searches
      this.initialSearchExecuted = true;

    } catch (error) {
      if (requestId !== this.targetsLoadRequestId) return;
      console.error('❌ Error al cargar objetivos:', error);

      if (!this.selectedTargetForMap) {
        this.enforceDefaultMapWhenNoTarget();
      }

      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('management.error'),
        detail: this.translate.instant('management.targetsLoadError')
      });
    } finally {
      if (requestId === this.targetsLoadRequestId) {
        this.loadingTargets = false;
        this.targetsLoadCompletedFlag = true;
      }
    }
  }

  private async loadAllTargetsForMap() {
    if (!this.selectedUser) return;

    // Si ya estamos cargando, no hacer nada
    if (this.loadingAllTargets) return;

    console.log('🗺️ Cargando TODOS los targets para el mapa...');
    this.loadingAllTargets = true;

    try {
      const parentId = this.managementService.getCurrentUserId();
      const userEmail = this.selectedUser?.email;
      const LIMIT = 9999; // Límite alto para traer "todos"

      // Cargar targets propios y compartidos en paralelo con límite alto
      const targetsPromise = this.targetsService.getTargetsByUserId(
        this.selectedUser._id,
        parentId,
        0,
        LIMIT,
        'all',
        this.filterTag || undefined,
        this.filterSimCompany || undefined
      );

      const sharedPromise = userEmail ? this.targetsService.getSharedTargets(userEmail) : Promise.resolve([]);

      const [targetsResponse, sharedTargets] = await Promise.all([targetsPromise, sharedPromise]);

      // Para el mapa no aplicamos el filtro de conexión, porque debe poder mostrar
      // también objetivos fuera de línea con última ubicación.
      let filteredSharedTargets = sharedTargets;

      if (this.filterTag) {
        filteredSharedTargets = filteredSharedTargets.filter(t => t.tag === this.filterTag);
      }

      if (this.filterSimCompany) {
        filteredSharedTargets = filteredSharedTargets.filter(t => t.sim_company?.toLowerCase() === this.filterSimCompany?.toLowerCase());
      }

      const targets = targetsResponse.devices;

      // Combinar targets
      const ownTargetIds = new Set(targets.map(t => t._id));
      const uniqueSharedTargets = filteredSharedTargets.filter(t => !ownTargetIds.has(t._id));
      const combinedTargets = [...uniqueSharedTargets, ...targets];

      // Marcar compartidos
      const sharedTargetIds = new Set(uniqueSharedTargets.map(t => t._id));
      combinedTargets.forEach(t => {
        (t as any).isShared = sharedTargetIds.has(t._id);
      });

      // Mapear para el mapa sin aplicar el filtro de conexión del listado.
      // El mapa debe poder pintar también objetivos fuera de línea con última ubicación.
      this.allTargets = this.mapTargetsToView(combinedTargets);

      console.log(`🗺️ ✅ ${this.allTargets.length} targets cargados para el mapa (de ${combinedTargets.length} combinados)`);
      if (this.allTargets.length > 0) {
        console.log('🗺️ Muestra de targets:', this.allTargets.slice(0, 3));
      } else {
        console.warn('🗺️ ⚠️ No se encontraron targets para mostrar en el mapa');
      }

    } catch (error) {
      console.error('❌ Error al cargar todos los targets para el mapa:', error);
    } finally {
      this.loadingAllTargets = false;
    }
  }

  private enforceDefaultMapWhenNoTarget(): void {
    if (!this.selectedTargetForMap && this.selectedMap !== 'google-light' && this.selectedMap !== 'osm-light') {
      this.setMapProvider('osm-light');
    }
  }


  private deleteUser(user: User): void {
    this.userService.delete(user._id).subscribe({
      next: () => {
        this.users = this.users.filter(u => u._id !== user._id);
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('management.userDeleted'),
          detail: `${user.name} ${user.last_name}`,
          life: 3000
        });
      },
      error: (error) => {
        console.error('Error al eliminar usuario:', error);
        const backendMessage = Array.isArray(error?.error?.message)
          ? error.error.message.join(' ')
          : error?.error?.message;
        const detail = error?.status === 409
          ? (backendMessage || 'Este usuario no se puede eliminar porque tiene GPS/usuarios dentro.')
          : this.translate.instant('management.errorDeleteUser');
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('management.error'),
          detail,
          life: 5000
        });
      }
    });
  }

  // ====================================
  // MÉTODOS PRIVADOS - POLLING
  // ====================================

  private initializePreviousTargetsStatus(): void {
    // Inicializar el mapa con el status actual de todos los targets
    this.previousTargetsStatus.clear();
    this.targetsList.forEach(target => {
      this.previousTargetsStatus.set(target._id, target.traccarStatus || 'offline');
    });
  }

  private startPolling(): void {
    // Detener cualquier polling previo
    this.stopPolling();

    // Iniciar polling si hay un target seleccionado O si hay targets cargados (para actualizar status)
    if (this.selectedTargetForMap || (this.selectedUser && this.targetsList.length > 0)) {
      const pollingType = this.selectedTargetForMap ?
        `target ${this.selectedTargetForMap.name} y status de todos` :
        'status de todos los targets';


      this.pollingInterval = setInterval(async () => {
        await this.updateSelectedTargetData();
      }, this.POLLING_INTERVAL_MS);

      // Actualizar inmediatamente
      this.updateSelectedTargetData();
    }
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private async updateSelectedTargetData(): Promise<void> {
    // Si no hay usuario seleccionado o targets cargados, detener polling
    if (!this.selectedUser || this.targetsList.length === 0) {
      this.stopPolling();
      return;
    }

    try {
      let logMessage = '📡 Actualizando ';
      let selectedTargetName = '';

      // Los objetivos propios se actualizan en bloque debajo. Para un objetivo
      // compartido conservamos la consulta individual porque pertenece a otra cuenta.
      if (this.selectedTargetForMap?.isShared) {
        logMessage += 'target seleccionado y ';
        const updatedTarget = await this.targetsService.getTargetById(this.selectedTargetForMap._id);

        // Actualizar el target seleccionado con la nueva información
        this.selectedTargetForMap = {
          ...this.selectedTargetForMap,
          ...updatedTarget,
          // Preservar información adicional que pueda tener el target local
          traccarInfo: updatedTarget.traccarInfo || this.selectedTargetForMap.traccarInfo,
          // IMPORTANTE: Sincronizar traccarStatus para que el mapa lo detecte
          traccarStatus: this.getDisplayTraccarStatus(updatedTarget),
          isShared: this.selectedTargetForMap.isShared
        };

        selectedTargetName = updatedTarget.name;
      } else if (this.selectedTargetForMap) {
        selectedTargetName = this.selectedTargetForMap.name;
      }

      logMessage += 'status de todos los targets';

      // 2. Actualizar status de TODOS los targets
      await this.updateAllTargetsStatusInPolling();

      // Forzar detección de cambios para actualizar la UI
      this.cdr.detectChanges();

      // Timeout adicional para asegurar que el mapa detecte los cambios en selectedTarget
      setTimeout(() => {
        this.cdr.detectChanges();
      }, 50);

      const summary: any = {
        lastUpdate: new Date().toLocaleTimeString()
      };

      if (selectedTargetName) {
        summary.selectedTarget = selectedTargetName;
      }


    } catch (error) {
      console.error('❌ Error en polling:', error);
      // No mostrar error al usuario para evitar spam, solo log en consola
    }
  }

  private async updateAllTargetsStatusInPolling(): Promise<void> {
    if (!this.selectedUser || this.targetsList.length === 0) {
      return;
    }

    try {
      const ownTargetIds = this.targetsList
        .filter(target => !target.isShared)
        .map(target => String(target._id || ''))
        .filter(Boolean);
      if (ownTargetIds.length === 0) return;

      const statuses = await this.targetsService.getTargetStatuses(
        this.selectedUser._id,
        ownTargetIds,
      );
      const statusesById = new Map(statuses.map(status => [String(status._id), status]));

      this.targetsList = this.targetsList.map(previousTarget => {
        const targetId = String(previousTarget._id || '');
        const liveStatus = statusesById.get(targetId);
        if (!liveStatus) return previousTarget;

        const previousOriginalTarget = previousTarget.originalTarget || previousTarget;
        const mergedTarget = {
          ...previousOriginalTarget,
          traccarInfo: liveStatus.traccarInfo,
        };
        const newStatus = this.getDisplayTraccarStatus({
          ...previousTarget,
          ...mergedTarget,
          originalTarget: mergedTarget,
        });
        const previousStatus = this.previousTargetsStatus.get(targetId);

        if (previousStatus === 'offline' && newStatus === 'online') {
          this.messageService.add({
            severity: 'success',
            summary: 'Dispositivo conectado',
            detail: `${previousTarget.name} ahora está en línea`,
            life: 5000,
          });
        }
        this.previousTargetsStatus.set(targetId, newStatus);

        const isOnline = newStatus === 'online';
        const isWeakSignal = newStatus === 'Señal débil';
        let offlineTimeText = previousTarget.offlineTimeText;
        let offlineDateText = previousTarget.offlineDateText;
        const lastUpdate = liveStatus.traccarInfo?.['lastUpdate'];
        if (isOnline) {
          offlineTimeText = '';
          offlineDateText = '';
        } else if (isWeakSignal && lastUpdate) {
          offlineTimeText = 'Señal débil';
          offlineDateText = this.calculateOfflineTime(lastUpdate).dateText;
        } else if (lastUpdate) {
          const offlineInfo = this.calculateOfflineTime(lastUpdate, newStatus === 'Localizado');
          offlineTimeText = offlineInfo.timeText;
          offlineDateText = offlineInfo.dateText;
        }

        return {
          ...previousTarget,
          status: isOnline
            ? this.translate.instant('management.status.online')
            : isWeakSignal
              ? 'Señal débil'
              : this.translate.instant('management.status.offline'),
          traccarStatus: newStatus,
          traccarInfo: liveStatus.traccarInfo,
          originalTarget: mergedTarget,
          offlineTimeText,
          offlineDateText,
        };
      });

      this.targets = this.targets.map(target => {
        const liveStatus = statusesById.get(String(target._id || ''));
        return liveStatus
          ? { ...target, traccarInfo: liveStatus.traccarInfo } as Target
          : target;
      });
      this.refreshTargetsCardList();

      if (this.selectedTargetForMap) {
        const selectedUpdate = this.targetsList.find(
          target => target._id === this.selectedTargetForMap._id,
        );
        if (selectedUpdate) {
          this.selectedTargetForMap = {
            ...this.selectedTargetForMap,
            ...selectedUpdate,
          };
        }
      }
    } catch (error) {
      console.error('❌ Error actualizando status en polling:', error);
    }
  }

  confirmCancelTarget(target: any) {
    // Validar permisos antes de permitir cancelar targets
    if (!this.canCancelDevices()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('management.devices.no_update_permission'),
        detail: this.translate.instant('management.devices.contact_admin')
      });
      return;
    }

    this.confirmationService.confirm({
      message: this.translate.instant('management.cancelTargetInfo'),
      header: this.translate.instant('management.cancelTarget'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('management.targetForm.yes'),
      rejectLabel: this.translate.instant('management.targetForm.no'),
      accept: () => {
        this.targetToCancel = target;
        this.cancelForm = {
          reason: '',
          description: '',
          disposition: 'return_to_company'
        };
        this.cancelDialogVisible = true;
      },
      reject: () => {
        // Opcional: manejar el rechazo si es necesario
        console.log('Usuario canceló la cancelación del target');
      }
    });
  }

  confirmCancelation() {
    if (!this.cancelForm.reason || !this.cancelForm.description.trim()) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('management.validationError'),
        detail: this.translate.instant('management.cancelTargetValidation'),
        life: 3000
      });
      return;
    }

    if (this.isMassCancelMode) {
      this.massCancelTargets();
    } else {
      this.cancelTarget();
    }
  }

  cancelCancelation() {
    this.cancelDialogVisible = false;
    this.isMassCancelMode = false;
    this.massCancelSource = 'shortcuts';
    this.targetToCancel = null;
    this.cancelForm = {
      reason: '',
      description: '',
      disposition: 'return_to_company'
    };
  }

  async verifyConnectionPriority() {
    this.showPriorityDialog = true;
    await this.refreshPriorityDevices();
  }

  async refreshPriorityDevices(isBackground: boolean = false) {
    if (!isBackground) {
      this.loadingPriorityDevices = true;
    }
    try {
      this.priorityDevices = await this.targetsService.getExpiredConnectionPriorityTargets();
    } catch (error) {
      console.error('Error cargando prioridad:', error);
    } finally {
      if (!isBackground) {
        this.loadingPriorityDevices = false;
      }
    }
  }

  navigateToTargetFromPriority(device: any, event?: MouseEvent) {
    this.showPriorityDialog = false;
    if (device.parent_id && device.device_imei) {

      const url = `/admin/management/t/${device.parent_id}?search=${device.device_imei}`;

      // Check for new tab via Ctrl/Cmd key
      if (event && (event.ctrlKey || event.metaKey)) {
        window.open(url, '_blank');
        return;
      }

      // Force reload to ensure clean state
      window.location.href = url;
    } else {
      console.warn('Faltan datos para navegar al target:', device);
    }
  }

  private async cancelTarget(): Promise<void> {
    if (!this.targetToCancel) return;

    try {
      // 1. Cancelar el target usando el nuevo endpoint
      await this.targetsService.cancelTarget(this.targetToCancel._id, {
        reason: this.cancelForm.reason,
        description: this.cancelForm.description,
        disposition: this.cancelForm.disposition,
      });

      // 2. Registrar el proceso de cancelación
      await this.createCancelationProcess();

      // 3. Actualizar la lista de targets
      this.targets = this.targets.filter(t => t._id !== this.targetToCancel!._id);
      this.targetsList = this.targetsList.filter(t => t._id !== this.targetToCancel!._id);

      // 4. Mostrar mensaje de éxito
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('management.targetCanceled'),
        detail: this.translate.instant('management.targetCanceledDetail'),
        life: 3000
      });

      // 5. Cerrar el modal
      this.cancelDialogVisible = false;
      this.targetToCancel = null;
      this.cancelForm = {
        reason: '',
        description: '',
        disposition: 'return_to_company'
      };

    } catch (error) {
      console.error('Error al cancelar objetivo:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('management.error'),
        detail: this.translate.instant('management.errorCancelTarget'),
        life: 3000
      });
    }
  }

  private async createCancelationProcess(customTarget?: any): Promise<void> {
    const target = customTarget || this.targetToCancel;
    if (!target) return;

    const reasonLabel = getDeviceCancellationReasonLabel(this.cancelForm.reason);

    const processData = {
      type: 8, // Tipo 8 para cancelación
      registrationDate: new Date().toISOString(),
      description: `Dispositivo cancelado - Razón: ${reasonLabel}`,
      details: this.cancelForm.description,
      target: {
        _id: target._id,
        name: target.name,
        device_imei: target.device_imei || target.imei,
        sim_card_number: target.sim_card_number || target.sim
      },
      user: {
        _id: this.authService.getCurrentUser()?.id || "ejemplo_user_id",
        name: this.authService.getCurrentUser()?.name || "Usuario Ejemplo",
        email: this.authService.getCurrentUser()?.email || "usuario@ejemplo.com"
      },
      reference: target._id,
      before: {
        status: "active",
        canceled: false
      },
      after: {
        status: "canceled",
        canceled: true,
        cancelReason: this.cancelForm.reason,
        cancelDescription: this.cancelForm.description,
        cancellationDisposition: this.cancelForm.disposition,
      },
      creator: this.authService.getCurrentUser()?.id || "creator_ejemplo_id"
    };

    await this.targetsService.createProcess(processData);
  }

  confirmMassSuspendShortcuts() {
    if (!this.shortcuts || this.shortcuts.length === 0) {
      return;
    }

    this.confirmationService.confirm({
      message: `¿Estás seguro de que deseas suspender (desactivar) los ${this.shortcuts.length} dispositivos en tus accesos directos de forma masiva?`,
      header: 'Suspender Accesos Directos',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('management.targetForm.yes'),
      rejectLabel: this.translate.instant('management.targetForm.no'),
      accept: () => {
        this.massSuspendTargets();
      }
    });
  }

  private async massSuspendTargets(): Promise<void> {
    if (!this.shortcuts || this.shortcuts.length === 0) return;

    this.messageService.add({
      severity: 'info',
      summary: 'Iniciando',
      detail: `Suspendiendo ${this.shortcuts.length} dispositivos...`,
      life: 3000
    });

    let successCount = 0;
    let errorCount = 0;

    this.showShortcutsDialog = false;

    const targetsToProcess = [...this.shortcuts];

    try {
      for (const target of targetsToProcess) {
        try {
          // Prepare the update payload for suspension
          const updateData = {
            status: false,
            last_change_date: new Date()
          };

          await this.targetsService.updateTarget(target._id, updateData);

          // Optionally, create a process out of it, or just let status update be enough.
          // Suspensions don't typically have a specific process in the form other than regular update,
          // However, we can create an empty 'ACTUALIZADO' process if needed, but simple update is sufficient.

          // Actualizar UI para reflejar status falso
          const uiTarget = this.targetsList.find(t => t._id === target._id) as any;
          if (uiTarget && uiTarget.originalTarget) {
            uiTarget.originalTarget.status = false;
          }
          const masterTarget = this.targets.find(t => t._id === target._id) as any;
          if (masterTarget && masterTarget.originalTarget) {
            masterTarget.originalTarget.status = false;
          }

          successCount++;
        } catch (err) {
          console.error(`Error suspendiendo el objetivo ${target._id}:`, err);
          errorCount++;
        }
      }

      if (successCount > 0) {
        this.messageService.add({
          severity: 'success',
          summary: 'Completado',
          detail: `Se han suspendido ${successCount} objetivos correctamente.`,
          life: 5000
        });

        // Vaciar la lista de accesos directos (opcional, pero consistente con cancelar)
        this.shortcuts = [];
        localStorage.setItem('targetShortcuts', JSON.stringify([]));
      }

      if (errorCount > 0) {
        this.messageService.add({
          severity: 'error',
          summary: 'Atención',
          detail: `Hubo problemas al suspender ${errorCount} objetivos.`,
          life: 5000
        });
      }
    } catch (globalErr) {
      console.error('Error global durante la suspensión masiva:', globalErr);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: getApiErrorMessage(globalErr, 'Hubo un error del sistema durante el proceso de suspensión masiva.'),
        life: 5000
      });
    }
  }

  // --- MASS TRANSFER METHODS ---

  confirmMassTransferShortcuts() {
    if (!this.shortcuts || this.shortcuts.length === 0) {
      return;
    }

    this.transferEmailInput = '';
    this.transferEmailError = '';
    this.foundUserForTransfer = null;
    this.searchingUserForTransfer = false;
    this.isTransferring = false;
    this.displayTransferDialog = true;
    this.showShortcutsDialog = false; // Close shortcuts list to focus on transfer
  }

  cancelMassTransfer() {
    this.displayTransferDialog = false;
    this.transferEmailInput = '';
    this.transferEmailError = '';
    this.foundUserForTransfer = null;
    this.searchingUserForTransfer = false;
    this.isTransferring = false;
  }

  onTransferEmailInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.transferEmailInput = target.value;
  }

  onTransferEmailInputKeypress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.searchUserForTransfer();
    }
  }

  async searchUserForTransfer() {
    const email = this.transferEmailInput.trim();
    this.transferEmailError = '';
    this.foundUserForTransfer = null;

    if (!email) {
      this.transferEmailError = 'El correo electrónico es requerido';
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.transferEmailError = 'Por favor ingrese un correo electrónico válido';
      return;
    }

    try {
      this.searchingUserForTransfer = true;
      const user = await lastValueFrom(
        this.userService.getDeviceRecipientByEmail(email)
      );

      if (!user) {
        this.transferEmailError = 'No se encontró ningún usuario con ese correo electrónico';
        return;
      }
      this.foundUserForTransfer = user;
    } catch (error: any) {
      console.error('Error al buscar usuario para transferencia:', error);
      if (error.status === 404) {
        this.transferEmailError = 'No se encontró ningún usuario con ese correo electrónico';
      } else if (error.status === 400) {
        this.transferEmailError = 'Formato de correo electrónico inválido';
      } else {
        this.transferEmailError = getApiErrorMessage(error, 'No se pudo buscar el usuario para la transferencia');
      }
    } finally {
      this.searchingUserForTransfer = false;
    }
  }

  async processMassTransfer() {
    if (!this.foundUserForTransfer) {
      this.transferEmailError = 'Debe buscar y seleccionar un usuario primero';
      return;
    }

    if (!this.shortcuts || this.shortcuts.length === 0) return;

    this.messageService.add({
      severity: 'info',
      summary: 'Iniciando Transferencia',
      detail: `Transfiriendo ${this.shortcuts.length} dispositivos a ${this.foundUserForTransfer.name}...`,
      life: 3000
    });

    let successCount = 0;
    let errorCount = 0;
    this.isTransferring = true;

    try {
      // Create a copy of the array we are processing
      const targetsToProcess = [...this.shortcuts];

      for (const target of targetsToProcess) {
        try {
          await this.targetsService.transferTarget(target._id, this.foundUserForTransfer._id);

          // Remove from local lists since it no longer belongs to the current parent context
          this.targets = this.targets.filter(t => t._id !== target._id);
          this.targetsList = this.targetsList.filter(t => t._id !== target._id);

          successCount++;
        } catch (err) {
          console.error(`Error transfiriendo el objetivo ${target._id}:`, err);
          errorCount++;
        }
      }

      if (successCount > 0) {
        this.messageService.add({
          severity: 'success',
          summary: 'Transferencia Exitosa',
          detail: `Se han transferido ${successCount} objetivos a ${this.foundUserForTransfer.name} ${this.foundUserForTransfer.last_name || ''}`,
          life: 5000
        });

        // Clear shortcuts after transfer
        this.shortcuts = [];
        localStorage.setItem('targetShortcuts', JSON.stringify([]));
      }

      if (errorCount > 0) {
        this.messageService.add({
          severity: 'error',
          summary: 'Atención',
          detail: `Hubo problemas al transferir ${errorCount} objetivos.`,
          life: 5000
        });
      }
    } catch (globalErr) {
      console.error('Error global durante la transferencia masiva:', globalErr);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: getApiErrorMessage(globalErr, 'No se pudo completar la transferencia masiva.'),
        life: 5000
      });
    } finally {
      this.isTransferring = false;
      this.displayTransferDialog = false;
    }
  }

  confirmMassCancelSelected() {
    if (!this.targetsSelected || this.targetsSelected.length === 0) return;

    this.confirmationService.confirm({
      message: `¿Estás seguro de que deseas cancelar permanentemente los ${this.targetsSelected.length} dispositivos seleccionados?`,
      header: 'Cancelar Dispositivos Seleccionados',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('management.targetForm.yes'),
      rejectLabel: this.translate.instant('management.targetForm.no'),
      accept: () => {
        this.isMassCancelMode = true;
        this.massCancelSource = 'selected';
        this.targetToCancel = { name: `${this.targetsSelected.length} Dispositivos (Seleccionados)`, device_imei: 'Múltiples IMEI' };
        this.cancelForm = {
          reason: '',
          description: '',
          disposition: 'return_to_company'
        };
        this.cancelDialogVisible = true;
      }
    });
  }

  openMassSuspendSelected() {
    if (!this.targetsSelected || this.targetsSelected.length === 0) return;
    this.suspendForm = { reason: '', description: '' };
    this.suspendDialogVisible = true;
  }

  async confirmSuspendSelected() {
    if (!this.targetsSelected || this.targetsSelected.length === 0) return;
    if (!this.suspendForm.reason || !this.suspendForm.description.trim()) return;

    this.suspendDialogVisible = false;

    this.messageService.add({
      severity: 'info',
      summary: 'Iniciando',
      detail: `Suspendiendo ${this.targetsSelected.length} dispositivos...`,
      life: 3000
    });

    let successCount = 0;
    let errorCount = 0;
    const targetsToProcess = [...this.targetsSelected];

    try {
      for (const target of targetsToProcess) {
        try {
          const updateData = {
            status: false,
            last_change_date: new Date()
          };
          await this.targetsService.updateTarget(target._id, updateData);

          // Register suspension process
          const suspendReasonLabels: { [key: string]: string } = {
            'non_payment': 'Falta de pago',
            'customer_request': 'Solicitud del cliente',
            'vehicle_in_shop': 'Vehículo en el taller',
            'device_maintenance': 'Mantenimiento de dispositivo',
            'investigation': 'Investigación en curso',
            'temporary_suspension': 'Suspensión temporal',
            'other': 'Otro motivo'
          };
          const reasonLabel = suspendReasonLabels[this.suspendForm.reason] || this.suspendForm.reason;

          const processData = {
            type: 9, // Tipo 9 para suspensión manual
            registrationDate: new Date().toISOString(),
            description: `Dispositivo suspendido - Razón: ${reasonLabel}`,
            details: this.suspendForm.description,
            target: {
              _id: target._id,
              name: target.name,
              device_imei: target.device_imei || target.imei,
              sim_card_number: target.sim_card_number || target.sim
            },
            user: {
              _id: this.authService.getCurrentUser()?.id || '',
              name: this.authService.getCurrentUser()?.name || '',
              email: this.authService.getCurrentUser()?.email || ''
            },
            reference: target._id,
            before: {
              status: true
            },
            after: {
              status: false,
              suspendReason: this.suspendForm.reason,
              suspendDescription: this.suspendForm.description
            },
            creator: this.authService.getCurrentUser()?.id || ''
          };
          await this.targetsService.createProcess(processData);

          // Update UI
          const uiTarget = this.targetsList.find(t => t._id === target._id) as any;
          if (uiTarget && uiTarget.originalTarget) {
            uiTarget.originalTarget.status = false;
          }
          const masterTarget = this.targets.find(t => t._id === target._id) as any;
          if (masterTarget && masterTarget.originalTarget) {
            masterTarget.originalTarget.status = false;
          }

          successCount++;
        } catch (err) {
          console.error(`Error suspendiendo el objetivo ${target._id}:`, err);
          errorCount++;
        }
      }

      if (successCount > 0) {
        this.messageService.add({
          severity: 'success',
          summary: 'Completado',
          detail: `Se han suspendido ${successCount} objetivos correctamente.`,
          life: 5000
        });
        this.targetsSelected = [];
      }

      if (errorCount > 0) {
        this.messageService.add({
          severity: 'error',
          summary: 'Atención',
          detail: `Hubo problemas al suspender ${errorCount} objetivos.`,
          life: 5000
        });
      }
    } catch (globalErr) {
      console.error('Error global durante la suspensión masiva:', globalErr);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: getApiErrorMessage(globalErr, 'Error inesperado durante la suspensión masiva.'),
        life: 5000
      });
    }
  }

  confirmMassCancelShortcuts() {
    if (!this.canCancelDevices() || this.currentUserAffiliationTypeId !== 'empleado') {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('management.devices.no_update_permission'),
        detail: this.translate.instant('management.devices.contact_admin')
      });
      return;
    }

    if (!this.shortcuts || this.shortcuts.length === 0) {
      return;
    }

    this.confirmationService.confirm({
      message: `¿Estás seguro de que deseas cancelar los ${this.shortcuts.length} dispositivos en tus accesos directos de forma masiva?`,
      header: 'Cancelar Accesos Directos',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('management.targetForm.yes'),
      rejectLabel: this.translate.instant('management.targetForm.no'),
      accept: () => {
        this.isMassCancelMode = true;
        this.massCancelSource = 'shortcuts';
        this.targetToCancel = { name: `${this.shortcuts.length} Dispositivos (Múltiple)`, device_imei: 'Múltiples IMEI' };
        this.cancelForm = {
          reason: '',
          description: '',
          disposition: 'return_to_company'
        };
        this.cancelDialogVisible = true;
      }
    });
  }

  private async massCancelTargets(): Promise<void> {
    const isShortcuts = this.massCancelSource === 'shortcuts';
    const sourceArray = isShortcuts ? this.shortcuts : this.targetsSelected;
    
    if (!sourceArray || sourceArray.length === 0) return;

    this.messageService.add({
      severity: 'info',
      summary: 'Iniciando',
      detail: `Cancelando ${sourceArray.length} dispositivos...`,
      life: 3000
    });

    let successCount = 0;
    let errorCount = 0;

    this.cancelDialogVisible = false;

    // We keep a secondary copy since we are going to modify the arrays
    const targetsToProcess = [...sourceArray];

    try {
      for (const target of targetsToProcess) {
        try {
          await this.targetsService.cancelTarget(target._id, {
            reason: this.cancelForm.reason,
            description: this.cancelForm.description,
            disposition: this.cancelForm.disposition,
          });

          await this.createCancelationProcess(target);

          // Actualizar UI para removerlo inmediatamente de la vista principal si estuviese ahi
          this.targets = this.targets.filter(t => t._id !== target._id);
          this.targetsList = this.targetsList.filter(t => t._id !== target._id);

          successCount++;
        } catch (err) {
          console.error(`Error cancelando el objetivo ${target._id}:`, err);
          errorCount++;
        }
      }

      if (successCount > 0) {
        this.messageService.add({
          severity: 'success',
          summary: 'Completado',
          detail: `Se han cancelado ${successCount} objetivos correctamente.`,
          life: 5000
        });

        // Vaciar la lista correspondiente
        if (isShortcuts) {
          this.shortcuts = [];
          localStorage.setItem('targetShortcuts', JSON.stringify([]));
          this.showShortcutsDialog = false;
        } else {
          this.targetsSelected = [];
        }
      }

      if (errorCount > 0) {
        this.messageService.add({
          severity: 'error',
          summary: 'Atención',
          detail: `Hubo problemas al cancelar ${errorCount} objetivos.`,
          life: 5000
        });
      }
    } catch (globalErr) {
      console.error('Error global durante la cancelación masiva:', globalErr);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: getApiErrorMessage(globalErr, 'Hubo un error del sistema durante el proceso de cancelación masiva.'),
        life: 5000
      });
    } finally {
      this.isMassCancelMode = false;
      this.massCancelSource = 'shortcuts';
      this.targetToCancel = null;
      this.cancelForm = {
        reason: '',
        description: '',
        disposition: 'return_to_company',
      };
    }
  }

  /**
   * Navega a la página de monitoreo del usuario seleccionado
   * @param userId ID del usuario para monitorear
   */
  navigateToMonitoring(userId: string): void {
    if (this.currentUserAffiliationTypeId !== 'empleado') {
      return;
    }
    this.router.navigate(['/admin/monitoring', userId]);
  }

  // ====================================
  // COMUNICACIÓN POR WHATSAPP
  // ====================================
  chatDialogVisible: boolean = false;
  chatUser: any = null;
  chatMessages: { from: 'me' | 'incoming' | 'system'; text: string; time: Date }[] = [];
  chatInput: string = '';
  sendingChat: boolean = false;
  loadingChat: boolean = false;
  hasUserInbox: boolean = false;
  userInboxId?: number;
  @ViewChild('chatMessagesContainer') chatMessagesContainer: any;
  private chatPollingInterval: any = null;

  private checkUserInbox(): void {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser?.id) return;
    this.userService.getById(currentUser.id).subscribe({
      next: (user: any) => {
        this.hasUserInbox = !!user?.inbox;
        this.userInboxId = user?.inbox;
      }
    });
  }

  private scrollChatToBottom() {
    setTimeout(() => {
      if (this.chatMessagesContainer?.nativeElement) {
        this.chatMessagesContainer.nativeElement.scrollTop = this.chatMessagesContainer.nativeElement.scrollHeight;
      }
    }, 50);
  }

  private startChatPolling() {
    this.stopChatPolling();
    this.chatPollingInterval = setInterval(() => {
      if (!this.chatUser?.phone || !this.chatDialogVisible) return;

      this.whatsappApi.getMessages(this.chatUser.phone, this.userInboxId).subscribe({
        next: (res) => {
          console.log('📨 Polling chat messages:', res);
          if (res.success && res.messages) {
            const apiMessages = res.messages.map((msg: any) => ({
              from: msg.from === 'incoming' ? 'incoming' as const : 'me' as const,
              text: msg.content,
              time: new Date(msg.created_at * 1000),
            }));

            // Always update with latest from API
            this.chatMessages = apiMessages;
            // Scroll only if there are new messages
            this.scrollChatToBottom();
          }
        },
        error: (err) => {
          console.error('❌ Chat polling error:', err);
        }
      });
    }, 5000);
  }

  private stopChatPolling() {
    if (this.chatPollingInterval) {
      clearInterval(this.chatPollingInterval);
      this.chatPollingInterval = null;
    }
  }

  openChat(user: any) {
    this.chatUser = user;
    this.chatMessages = [];
    this.chatInput = '';
    this.chatDialogVisible = true;

    const phone = user.phone || '';
    if (!phone) return;

    this.loadingChat = true;
    this.whatsappApi.getMessages(phone, this.userInboxId).subscribe({
      next: (res) => {
        this.loadingChat = false;
        if (res.success && res.messages?.length) {
          this.chatMessages = res.messages.map((msg: any) => ({
            from: msg.from === 'incoming' ? 'incoming' : 'me',
            text: msg.content,
            time: new Date(msg.created_at * 1000),
          }));
          this.scrollChatToBottom();
        }
        this.startChatPolling();
      },
      error: () => {
        this.loadingChat = false;
        this.startChatPolling();
      }
    });
  }

  closeChatDialog() {
    this.stopChatPolling();
    this.chatDialogVisible = false;
    this.chatUser = null;
    this.chatMessages = [];
    this.chatInput = '';
  }

  sendChatMessage() {
    if (!this.chatInput.trim() || !this.chatUser || this.sendingChat) return;

    const messageText = this.chatInput.trim();
    this.chatMessages.push({ from: 'me', text: messageText, time: new Date() });
    this.chatInput = '';
    this.sendingChat = true;
    this.scrollChatToBottom();

    const contactName = `${this.chatUser.name || ''} ${this.chatUser.last_name || ''}`.trim();
    const phone = this.chatUser.phone || '';

    this.whatsappApi.sendMessage(phone, messageText, contactName, this.userInboxId).subscribe({
      next: (res) => {
        this.sendingChat = false;
        if (res.success) {
          this.chatMessages.push({ from: 'system', text: '✓ Mensaje enviado', time: new Date() });
        } else {
          this.chatMessages.push({ from: 'system', text: '✗ Error: ' + (res.error || 'No se pudo enviar'), time: new Date() });
        }
        this.scrollChatToBottom();
      },
      error: (err) => {
        this.sendingChat = false;
        this.chatMessages.push({ from: 'system', text: getApiErrorMessage(err, '✗ Error de conexión'), time: new Date() });
        this.scrollChatToBottom();
      }
    });
  }

  getUserLastLocationDate(user: User | any): Date | null {
    if (!this.canViewSubjectLocation(user)) return null;

    const rawDate = user?.realtime_location?.recordedAt
      || user?.locationUpdatedAt
      || user?.last_location_at
      || user?.lastLocationAt
      || user?.latest_location?.recordedAt
      || user?.last_location?.recordedAt
      || user?.location?.recordedAt;

    if (!rawDate) return null;

    const date = new Date(rawDate);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  getUserActiveAgo(user: User | any): string {
    const date = this.getUserLastLocationDate(user);
    if (!date) return '';

    const diffMs = Math.max(0, Date.now() - date.getTime());
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 1) return 'ahora';
    if (diffMinutes < 60) return `hace ${diffMinutes} minuto${diffMinutes === 1 ? '' : 's'}`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `hace ${diffHours} hora${diffHours === 1 ? '' : 's'}`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `hace ${diffDays} día${diffDays === 1 ? '' : 's'}`;

    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `hace ${diffMonths} mes${diffMonths === 1 ? '' : 'es'}`;

    const diffYears = Math.floor(diffDays / 365);
    return `hace ${diffYears} año${diffYears === 1 ? '' : 's'}`;
  }

  isUserLocationOlderThanFiveHours(user: User | any): boolean {
    const date = this.getUserLastLocationDate(user);
    if (!date) return false;

    const fiveHoursMs = 5 * 60 * 60 * 1000;
    return Date.now() - date.getTime() > fiveHoursMs;
  }

  openUserLocationDialog(user: User | any): void {
    if (!this.canViewSubjectLocation(user)) {
      this.closeUserLocationDialog();
      return;
    }

    const position = this.getUserLocationPosition(user);
    if (!position) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sin ubicación',
        detail: 'Este usuario no tiene una ubicación válida registrada.'
      });
      return;
    }

    this.selectedLocationUser = user;
    this.userLocationDialogVisible = true;
    this.userLocationDialogLoading = true;
    this.userLocationDialogError = '';
    this.startUserActivityMonitor(user);

    setTimeout(() => this.renderUserLocationMap(position), 0);
  }

  closeUserLocationDialog(): void {
    this.resetUserActivityMonitor();
    this.userLocationDialogVisible = false;
    this.userLocationDialogLoading = false;
    this.userLocationDialogError = '';
    this.selectedLocationUser = null;
    this.userLocationMarker?.remove?.();
    this.userLocationMarker = null;
    this.userLocationMapInstance?.remove?.();
    this.userLocationMapInstance = null;
  }

  private getUserLocationPosition(user: User | any): { lat: number; lng: number } | null {
    if (!this.canViewSubjectLocation(user)) return null;

    const realtime = user?.realtime_location || {};
    const location = user?.location || user?.latest_location || user?.last_location || {};
    const lat = Number(
      realtime?.latitude
      ?? realtime?.lat
      ?? location?.latitude
      ?? location?.lat
      ?? user?.latitude
    );
    const lng = Number(
      realtime?.longitude
      ?? realtime?.lng
      ?? realtime?.lon
      ?? location?.longitude
      ?? location?.lng
      ?? location?.lon
      ?? user?.longitude
    );

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

    return { lat, lng };
  }

  private async renderUserLocationMap(position: { lat: number; lng: number }): Promise<void> {
    try {
      const mapElement = this.userLocationMap?.nativeElement;
      if (!mapElement) {
        this.userLocationDialogError = 'No se pudo preparar el mapa.';
        return;
      }

      this.userLocationMarker?.remove?.();
      this.userLocationMapInstance?.remove?.();
      this.userLocationMapInstance = MapUtils.createMap(
        'osm',
        mapElement,
        '',
        'light',
        position.lat,
        position.lng,
        16,
      );

      this.userLocationMarker = new maplibregl.Marker({ color: '#ef4444' })
        .setLngLat([position.lng, position.lat])
        .addTo(this.userLocationMapInstance);
      this.userLocationMarker.getElement().title = this.selectedLocationUser
        ? `${this.selectedLocationUser.name || ''} ${this.selectedLocationUser.last_name || ''}`.trim()
        : 'Usuario';

      this.userLocationDialogLoading = false;
    } catch (error) {
      console.error('Error mostrando ubicación del usuario:', error);
      this.userLocationDialogError = 'No se pudo mostrar la ubicación.';
      this.userLocationDialogLoading = false;
    }
  }

  isEmployeeLocationSubject(user: User | any): boolean {
    return isEmployeeLocationSubjectValue(user);
  }

  canViewSubjectLocation(user: User | any): boolean {
    return this.isLoggedEmployee() && this.isEmployeeLocationSubject(user);
  }

  canMonitorUserActivity(): boolean {
    return this.isCurrentUserRoot || this.isLoggedEmployee();
  }

  private startUserActivityMonitor(user: User): void {
    if (!this.canMonitorUserActivity()) return;
    const userId = String(user?._id || '').trim();
    if (!userId) return;

    this.resetUserActivityMonitor();
    this.selectedActivityUser = user;
    this.userActivityMonitorTab = 'activity';
    this.userActivityConsoleFilter = 'all';
    this.userConsoleCaptureStatusLoading = true;
    this.loadUserConsoleCaptureStatus();
    this.loadUserActivityMonitor(true);
    this.userActivityMonitorPoll = setInterval(() => this.loadUserActivityMonitor(false), 3_000);
  }

  private resetUserActivityMonitor(): void {
    this.stopUserActivityMonitorPolling();
    this.userActivityMonitorLoading = false;
    this.userActivityMonitorActivities = [];
    this.userActivityMonitorGroupedActivities = [];
    this.userActivityMonitorConsoleLogs = [];
    this.userConsoleCaptureEnabled = false;
    this.userConsoleCaptureForced = false;
    this.userConsoleCaptureUpdating = false;
    this.userConsoleCaptureStatusLoading = false;
    this.selectedActivityUser = null;
  }

  selectUserActivityMonitorTab(tab: 'activity' | 'console'): void {
    this.userActivityMonitorTab = tab;
  }

  onUserActivityConsoleFilterChange(): void {
    this.loadUserActivityMonitor(true);
  }

  async toggleUserConsoleCapture(): Promise<void> {
    const userId = String(this.selectedActivityUser?._id || '').trim();
    if (
      !userId ||
      this.userConsoleCaptureUpdating ||
      this.userConsoleCaptureStatusLoading ||
      this.userConsoleCaptureForced
    ) return;

    const enabled = !this.userConsoleCaptureEnabled;
    this.userConsoleCaptureUpdating = true;
    try {
      const status = await lastValueFrom(this.userConsoleLogService.setCaptureStatus(userId, enabled));
      this.userConsoleCaptureEnabled = status?.enabled === true;
      this.userConsoleCaptureForced = status?.forced === true;
      this.messageService.add({
        severity: 'success',
        summary: this.userConsoleCaptureEnabled ? 'Captura activada' : 'Captura desactivada',
        detail: this.userConsoleCaptureEnabled
          ? 'La consola de este usuario comenzará a guardarse durante 24 horas.'
          : 'Los nuevos mensajes de consola de este usuario no se guardarán.',
      });
    } catch (error) {
      console.error('Error actualizando captura de consola:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'No se pudo cambiar la captura',
        detail: 'Inténtalo nuevamente.',
      });
    } finally {
      this.userConsoleCaptureUpdating = false;
    }
  }

  getConsoleLogTime(log: UserConsoleLog): string {
    const date = new Date(log.occurred_at);
    return Number.isNaN(date.getTime())
      ? ''
      : date.toLocaleString('es-DO', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
  }

  getConsoleLevelLabel(level: UserConsoleLevel): string {
    const labels: Record<UserConsoleLevel, string> = {
      log: 'Log',
      info: 'Info',
      warn: 'Advertencia',
      error: 'Error',
      debug: 'Debug',
    };
    return labels[level] || level;
  }

  private async loadUserActivityMonitor(showLoading: boolean): Promise<void> {
    const userId = String(this.selectedActivityUser?._id || '').trim();
    if (!userId || this.userActivityMonitorBusy) return;

    this.userActivityMonitorBusy = true;
    if (showLoading) this.userActivityMonitorLoading = true;
    try {
      const activitySince = showLoading
        ? undefined
        : this.getNewestObservabilityTimestamp(this.userActivityMonitorActivities);
      const consoleSince = showLoading
        ? undefined
        : this.getNewestObservabilityTimestamp(this.userActivityMonitorConsoleLogs);
      const [activityResponse, consoleResponse] = await Promise.all([
        lastValueFrom(this.userActivityService.getByUser(userId, 5_000, activitySince || this.getObservabilitySince())),
        lastValueFrom(this.userConsoleLogService.getByUser(userId, 5_000, this.userActivityConsoleFilter, consoleSince)),
      ]);
      this.userActivityMonitorActivities = showLoading
        ? activityResponse?.activities || []
        : this.mergeObservabilityRecords(this.userActivityMonitorActivities, activityResponse?.activities || []);
      this.userActivityMonitorGroupedActivities = this.groupConsecutiveActivities(this.userActivityMonitorActivities);
      this.userActivityMonitorConsoleLogs = showLoading
        ? consoleResponse?.logs || []
        : this.mergeObservabilityRecords(this.userActivityMonitorConsoleLogs, consoleResponse?.logs || []);
    } catch (error) {
      console.error('Error cargando actividad y consola del usuario:', error);
      if (showLoading) {
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo cargar el monitoreo',
          detail: 'Verifica la conexión e inténtalo nuevamente.',
        });
      }
    } finally {
      this.userActivityMonitorBusy = false;
      this.userActivityMonitorLoading = false;
    }
  }

  private async loadUserConsoleCaptureStatus(): Promise<void> {
    const userId = String(this.selectedActivityUser?._id || '').trim();
    if (!userId) return;
    this.userConsoleCaptureStatusLoading = true;
    try {
      const status = await lastValueFrom(this.userConsoleLogService.getCaptureStatus(userId));
      this.userConsoleCaptureEnabled = status?.enabled === true;
      this.userConsoleCaptureForced = status?.forced === true;
    } catch (error) {
      console.error('Error consultando captura de consola:', error);
      this.userConsoleCaptureEnabled = false;
      this.userConsoleCaptureForced = false;
    } finally {
      this.userConsoleCaptureStatusLoading = false;
    }
  }

  private stopUserActivityMonitorPolling(): void {
    if (this.userActivityMonitorPoll) clearInterval(this.userActivityMonitorPoll);
    this.userActivityMonitorPoll = undefined;
  }

  private getObservabilitySince(): string {
    return new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString();
  }

  private getNewestObservabilityTimestamp(records: Array<{ occurred_at: string | Date }>): string | undefined {
    const timestamp = records.reduce((latest, record) => {
      const value = new Date(record.occurred_at).getTime();
      return Number.isFinite(value) ? Math.max(latest, value) : latest;
    }, 0);
    return timestamp ? new Date(timestamp).toISOString() : undefined;
  }

  private mergeObservabilityRecords<T extends { _id?: string; occurred_at: string | Date }>(
    current: T[],
    incoming: T[],
  ): T[] {
    const records = new Map<string, T>();
    [...incoming, ...current].forEach((record) => {
      const key = String(record._id || `${new Date(record.occurred_at).getTime()}-${JSON.stringify(record)}`);
      if (!records.has(key)) records.set(key, record);
    });
    const since = Date.now() - 24 * 60 * 60 * 1_000;
    return Array.from(records.values())
      .filter((record) => new Date(record.occurred_at).getTime() >= since)
      .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
      .slice(0, 5_000);
  }

  private sanitizeManagementUsers(users: User[] | null | undefined): User[] {
    return (users || []).map(user => this.sanitizeManagementUserLocation(user));
  }

  private sanitizeManagementUserLocation<T extends User | any>(user: T): T {
    return sanitizeManagementLocationSubject(user);
  }

  private groupConsecutiveActivities(activities: UserActivity[]): Array<UserActivity & { groupCount?: number }> {
    const grouped: Array<UserActivity & { groupCount?: number }> = [];

    for (const activity of activities || []) {
      const last = grouped[grouped.length - 1];
      const activityKey = this.getActivityGroupKey(activity);

      if (last && this.getActivityGroupKey(last) === activityKey) {
        last.groupCount = (last.groupCount || 1) + 1;
        continue;
      }

      grouped.push({ ...activity, groupCount: 1 });
    }

    return grouped;
  }

  private getActivityGroupKey(activity: UserActivity): string {
    return [
      activity.platform || '',
      this.getActivityTitle(activity),
      this.getActivitySubtitle(activity),
    ]
      .map((value) => String(value || '').trim().toLowerCase())
      .join('|');
  }

  getActivityDisplayTitle(activity: UserActivity & { groupCount?: number }): string {
    const title = this.getActivityTitle(activity);
    const count = activity.groupCount || 1;
    if (count > 1 && this.isGpsViewDisplay(activity, title)) {
      return title;
    }
    return count > 1 ? `${title} ${count} veces` : title;
  }

  getActivityTitle(activity: UserActivity): string {
    if (activity.type === 'screen') {
      return this.formatActivityScreen(activity.screen || activity.route || '');
    }

    return this.formatActivityAction(activity.action || 'accion');
  }

  getActivitySubtitle(activity: UserActivity): string {
    const metadata = activity.metadata || {};
    if (String(activity.action || '').toLowerCase() === 'click') {
      return String(metadata['label'] || activity.element || '').trim();
    }
    const target = this.getActivityTargetDetail(activity);
    if (target) return target;

    const action = String(activity.action || '').toLowerCase();
    if (action === 'view gps' || action === 'view gps by imei') {
      return 'GPS consultado';
    }

    const route = String(activity.route || activity.screen || '').toLowerCase();
    if (/^\/devices\/[a-f0-9]{24}$/i.test(route) || route.startsWith('/devices/by-imei/')) {
      return 'GPS consultado';
    }

    return this.formatActivityRoute(activity.route || activity.screen || '');
  }

  getActivityAgo(activity: UserActivity): string {
    const date = new Date(activity.occurred_at);
    if (Number.isNaN(date.getTime())) return '';
    if ((activity as any).groupCount > 1 && this.isGpsViewActivity(activity)) {
      return `${this.formatActivitySeenDay(date)} · ${this.formatRelativeDate(date)}`;
    }
    return this.formatRelativeDate(date);
  }

  private isGpsViewActivity(activity: UserActivity): boolean {
    const action = String(activity.action || '').toLowerCase();
    const route = String(activity.route || activity.screen || '').toLowerCase();
    return action === 'view gps'
      || action === 'view gps by imei'
      || /^\/devices\/[a-f0-9]{24}/i.test(route)
      || route.startsWith('/devices/by-imei/');
  }

  private isGpsViewDisplay(activity: UserActivity, title: string): boolean {
    return this.isGpsViewActivity(activity) || String(title || '').trim().toLowerCase().startsWith('vio un gps');
  }

  private formatActivitySeenDay(date: Date): string {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (this.isSameCalendarDay(date, today)) return 'Lo vio hoy';
    if (this.isSameCalendarDay(date, yesterday)) return 'Lo vio ayer';

    return `Lo vio el ${date.toLocaleDateString('es-DO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })}`;
  }

  private isSameCalendarDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }

  private formatActivityAction(action: string): string {
    const rawValue = String(action || '').trim();
    const value = rawValue.toLowerCase();
    if (value === 'view gps') return 'Vio un GPS';
    if (value === 'view gps by imei') return 'Vio un GPS por IMEI';
    if (value.startsWith('create ')) return `Creó ${this.formatActivityResource(value.replace(/^create\s+/, ''))}`;
    if (value.startsWith('update ')) return `Editó ${this.formatActivityResource(value.replace(/^update\s+/, ''))}`;
    if (value.startsWith('delete ')) return `Eliminó ${this.formatActivityResource(value.replace(/^delete\s+/, ''))}`;
    if (value === 'create') return 'Creó';
    if (value === 'update' || value === 'edit') return 'Editó';
    if (value === 'delete') return 'Eliminó';
    if (value === 'view') return 'Vio';
    if (value === 'search') return 'Buscó';
    if (value === 'click') return 'Hizo clic';
    if (value === 'navigation') return 'Cambió de pantalla';
    return rawValue || 'Registró una acción';
  }

  private formatActivityScreen(screen: string): string {
    const value = String(screen || '').trim();
    if (!value) return 'Entró a una pantalla';
    return `Entró a ${this.formatActivityResource(value)}`;
  }

  private formatActivityRoute(route: string): string {
    const value = String(route || '').trim();
    if (!value || value === 'api') return '';
    return this.formatActivityResource(value);
  }

  private formatActivityResource(resource: string): string {
    const normalized = String(resource || '')
      .trim()
      .toLowerCase()
      .replace(/^\/+/, '')
      .replace(/\/:id$/, '')
      .replace(/\/[a-f0-9]{24}$/i, '')
      .replace(/\/by-imei\/.+$/i, '');

    const resourceMap: Record<string, string> = {
      devices: 'un GPS',
      users: 'un usuario',
      solicitudes: 'una solicitud',
      commands: 'comandos',
      simcards: 'una SIM',
      monitoring: 'monitoreo',
      dashboard: 'el dashboard',
      management: 'management',
    };

    const firstSegment = normalized.split('/').filter(Boolean)[0] || normalized;
    return resourceMap[firstSegment] || 'el sistema';
  }

  private getActivityTargetDetail(activity: UserActivity): string {
    const metadata = activity.metadata || {};
    const resource = String(metadata['resource'] || activity.route || activity.screen || '').toLowerCase();
    const targetName = this.cleanActivityText(metadata['targetName'] || metadata['target'] || metadata['deviceName']);
    const userName = this.cleanActivityText(metadata['userName']);
    const email = this.cleanActivityText(metadata['email']);
    const imei = this.cleanActivityText(metadata['imei']);
    const targetId = this.cleanActivityText(metadata['targetId'] || this.extractIdFromActivityRoute(activity.route));

    if (resource.includes('devices') || String(activity.action || '').toLowerCase().includes('gps')) {
      const label = targetName || (targetId ? `GPS no identificado (${this.shortenActivityId(targetId)})` : '');
      return [label, imei ? `IMEI: ${imei}` : ''].filter(Boolean).join(' · ');
    }

    if (resource.includes('users')) {
      const label = userName || email || (targetId ? `Usuario no identificado (${this.shortenActivityId(targetId)})` : '');
      return [label, email && email !== label ? email : ''].filter(Boolean).join(' · ');
    }

    if (targetName) return targetName;
    if (targetId) return `${this.formatActivityResource(resource)} ${this.shortenActivityId(targetId)}`;
    return '';
  }

  private extractIdFromActivityRoute(route?: string): string {
    const value = String(route || '').trim();
    const idMatch = value.match(/[a-f0-9]{24}/i);
    if (idMatch) return idMatch[0];
    const imeiMatch = value.match(/\/devices\/by-imei\/([^/]+)/i);
    return imeiMatch?.[1] || '';
  }

  private shortenActivityId(value: string): string {
    const text = String(value || '').trim();
    return text.length > 12 ? `${text.slice(0, 8)}...` : text;
  }

  private cleanActivityText(value: any): string {
    return String(value || '').trim();
  }

  private formatRelativeDate(date: Date): string {
    const diffMs = Math.max(0, Date.now() - date.getTime());
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 1) return 'ahora';
    if (diffMinutes < 60) return `hace ${diffMinutes} min`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `hace ${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    return `hace ${diffDays} d`;
  }
}
