import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MenuItem, MessageService, ConfirmationService } from 'primeng/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx-js-style';
import {
    InstallationDetail,
    SolicitudesService,
    Solicitud,
    TechnicianRecommendation,
    TechnicianScheduleConflict,
    VapiCallDetails,
} from '../../../../../../core/services/solicitudes.service';
import { VehicleBrandsService } from '../../../../../../core/services/vehicle-brands.service';
import { ColorsService } from '../../../../../../core/services/colors.service';
import { UserLatestLocation, UserService } from '../../../../../../core/services/user.service';
import { TargetsService } from '../../../../../../core/services/targets.service';
import { ProtocolsService } from '../../../../../../core/services/protocols.service';
import { PlansService } from '../../../../../../core/services/plans.service';
import { AuthService } from '../../../../../../core/services/auth.service';
import { InventoryItem, InventoryService } from '../../../../../../core/services/inventory.service';
import { User } from '../../../../../../core/interfaces/user.interface';
import { Protocol } from '../../../../../../core/interfaces/protocol.interface';
import { Plan } from '../../../../../../core/interfaces/plan.interface';
import { SIM_CARD_TYPES } from '../../../../../../core/constants/sim-card-types.constant';
import {
    DEVICE_CANCELLATION_REASONS,
    getDeviceCancellationReasonLabel,
} from '../../../../../../core/constants/device-cancellation-reasons.constant';
import { INSTALLATION_LOCATIONS } from '../../../../management/presentation/components/management/target-form/constants/target-form-data.constants';
import { SystemService } from '../../../../../../core/services/system.service';
import { MapUtils } from '../../../../../../shareds/helpers/map.helper';
import * as maplibregl from 'maplibre-gl';
interface SelectOption {
    label: string;
    value: string;
}

interface SolicitudStartedToast {
    solicitud: Solicitud;
    clientName: string;
    technicianName: string;
    typeLabel: string;
    deviceLabel: string;
}

interface AvailabilityTranscriptMessage {
    speaker: string;
    text: string;
    side: 'ester' | 'technician';
}

type SolicitudLocationConfigTarget = 'root' | 'installation';
type SolicitudLocationConfigMethod = 'search' | 'coordinates' | 'link';
type SolicitudExportFormat = 'pdf' | 'excel';

interface SolicitudLocationSuggestion {
    description: string;
    placeId: string;
    mainText: string;
    secondaryText: string;
    placePrediction?: any;
}

interface SolicitudCalendarDay {
    dateKey: string;
    dayNumber: number;
    inCurrentMonth: boolean;
    isToday: boolean;
    solicitudes: Solicitud[];
}

interface SolicitudCalendarWorkItem {
    label: string;
    detail: string;
    state: 'pending' | 'completed' | 'cancelled';
}

interface ProcessDeviceEvidence {
    label: string;
    url: string;
    uploadedAt?: string | Date;
}

interface ProcessActivationStep {
    label: string;
    description?: string;
    status?: string;
}

interface ProcessActivationLog {
    message: string;
    type?: string;
    time?: string | Date;
}

interface ProcessTimelineDetail {
    label: string;
    value: string;
}

interface ProcessTechnicianTimelineItem {
    title: string;
    description: string;
    icon: string;
    state: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
    timestamp?: string | Date;
    details: ProcessTimelineDetail[];
    evidence?: ProcessDeviceEvidence[];
    audio?: string;
    showLocationAction?: boolean;
}

@Component({
    selector: 'app-solicitudes',
    templateUrl: './solicitudes.component.html',
    styleUrls: ['./solicitudes.component.css'],
    standalone: false,
    encapsulation: ViewEncapsulation.None
})
export class SolicitudesComponent implements OnInit, OnDestroy {
    @ViewChild('solicitudLocationSearchInput')
    solicitudLocationSearchInput?: ElementRef<HTMLInputElement>;

    private readonly solicitudAutocompleteUserId = '68a9ccf19bb280482272477f';
    items: MenuItem[] = [{ label: 'Solicitudes' }];
    home: MenuItem = { icon: 'pi pi-home', routerLink: '/admin/dashboard' };

    solicitudes: Solicitud[] = [];
    private filteredSolicitudesCacheSource: Solicitud[] | null = null;
    private filteredSolicitudesCacheKey = '';
    private filteredSolicitudesCache: Solicitud[] = [];
    private kanbanColumnsCacheSource: Solicitud[] | null = null;
    private kanbanColumnsCache = {
        pendientes: [] as Solicitud[],
        enProgreso: [] as Solicitud[],
        porConfirmar: [] as Solicitud[],
        completadas: [] as Solicitud[],
    };
    private topFilterClientOptionsCacheSource: Solicitud[] | null = null;
    private topFilterClientOptionsCache: SelectOption[] = [];
    private topFilterTechnicianOptionsCacheTechnicians: User[] | null = null;
    private topFilterTechnicianOptionsCacheSolicitudes: Solicitud[] | null = null;
    private topFilterTechnicianOptionsCache: SelectOption[] = [];
    private calendarTechnicianOptionsCacheSource: SelectOption[] | null = null;
    private calendarTechnicianOptionsCache: SelectOption[] = [];
    private technicianByIdCacheSource: User[] | null = null;
    private technicianByIdCache = new Map<string, User>();
    private technicianSelectionCacheSource: User[] | null = null;
    private technicianSelectionCacheQuery = '';
    private technicianSelectionCache: User[] = [];

    get pendientes(): Solicitud[] { return this.getKanbanColumns().pendientes; }
    get enProgreso(): Solicitud[] { return this.getKanbanColumns().enProgreso; }
    get porConfirmar(): Solicitud[] { return this.getKanbanColumns().porConfirmar; }
    get completadas(): Solicitud[] { return this.getKanbanColumns().completadas; }
    
    // Drag and Drop
    draggedSolicitud: Solicitud | null = null;
    dragSuppressClick = false;

    onDragStart(event: DragEvent, sol: Solicitud): void {
        if (this.isSolicitudClosed(sol)) {
            event.preventDefault();
            event.stopPropagation();
            this.draggedSolicitud = null;
            this.showClosedSolicitudLockedFeedback();
            return;
        }

        this.draggedSolicitud = sol;
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', sol._id || '');
        }
        (event.target as HTMLElement).classList.add('sol-dragging');
    }

    onDragEnd(event: DragEvent): void {
        (event.target as HTMLElement).classList.remove('sol-dragging');
        this.draggedSolicitud = null;
        document.querySelectorAll('.sol-drop-before, .sol-drop-after').forEach(el => {
            el.classList.remove('sol-drop-before', 'sol-drop-after');
        });
    }

    onDragOver(event: DragEvent): void {
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
        const column = (event.target as HTMLElement).closest('.sol-kanban-column');
        if (column) column.classList.add('sol-drag-over');

        const card = (event.target as HTMLElement).closest('.sol-kanban-card');
        if (card && column) {
            const cards = column.querySelectorAll('.sol-kanban-card');
            cards.forEach(c => c.classList.remove('sol-drop-before', 'sol-drop-after'));
            const rect = card.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            if (event.clientY < midY) {
                card.classList.add('sol-drop-before');
            } else {
                card.classList.add('sol-drop-after');
            }
        }
    }

    onDragLeave(event: DragEvent): void {
        const column = (event.target as HTMLElement).closest('.sol-kanban-column');
        const relatedColumn = (event.relatedTarget as HTMLElement)?.closest?.('.sol-kanban-column');
        if (column && column !== relatedColumn) {
            column.classList.remove('sol-drag-over');
            column.querySelectorAll('.sol-kanban-card').forEach(c => {
                c.classList.remove('sol-drop-before', 'sol-drop-after');
            });
        }
    }

    onDrop(event: DragEvent, newStatus: string): void {
        event.preventDefault();
        const column = (event.target as HTMLElement).closest('.sol-kanban-column');
        if (column) {
            column.classList.remove('sol-drag-over');
            column.querySelectorAll('.sol-kanban-card').forEach(c => {
                c.classList.remove('sol-drop-before', 'sol-drop-after');
            });
        }

        if (!this.draggedSolicitud) return;

        const sol = this.draggedSolicitud;
        const oldStatus = sol.status;
        this.draggedSolicitud = null;

        if (this.isSolicitudClosed(sol)) {
            this.showClosedSolicitudLockedFeedback();
            return;
        }
        if (sol.type === 'desinstalacion' && !this.hasValidDeinstallationReason(sol)) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Razón requerida',
                detail: 'Abra la solicitud y seleccione una razón de desinstalación antes de cambiar su estado.'
            });
            return;
        }

        this.dragSuppressClick = true;
        setTimeout(() => this.dragSuppressClick = false, 200);

        // Determine drop position
        let dropIndex = -1;
        const targetCard = (event.target as HTMLElement).closest('.sol-kanban-card');
        if (targetCard && column) {
            const cards = Array.from(column.querySelectorAll('.sol-kanban-card'));
            const cardIdx = cards.indexOf(targetCard);
            const rect = targetCard.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            dropIndex = event.clientY < midY ? cardIdx : cardIdx + 1;
        }

        // Get current column items (excluding the dragged card)
        const columnItems = this.solicitudes
            .filter(s => s.status === newStatus && s._id !== sol._id)
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        // If same column and no valid drop target, skip
        if (oldStatus === newStatus && dropIndex === -1) return;

        const applyDrop = () => {
            // Only mutate the card after any required confirmation has been accepted.
            sol.status = newStatus;

            if (dropIndex >= 0 && dropIndex <= columnItems.length) {
                columnItems.splice(dropIndex, 0, sol);
            } else {
                columnItems.push(sol);
            }

            columnItems.forEach((item, idx) => {
                item.order = idx;
                this.solicitudesService.update(item._id!, { order: idx, status: item.status }).subscribe();
            });
            this.solicitudes = [...this.solicitudes];

            if (oldStatus !== newStatus) {
                this.messageService.add({
                    severity: 'success',
                    summary: 'Movido',
                    detail: `Solicitud movida a ${this.statusLabels[newStatus] || newStatus}`
                });
            }
        };

        if (newStatus === 'completada' && oldStatus !== 'completada') {
            this.confirmSolicitudCompletion(sol, applyDrop);
            return;
        }

        applyDrop();
    }

    selectedSolicitud: Solicitud | null = null;
    private selectedSolicitudOriginalStatus = '';
    dialogVisible = false;
    closedInfoDialogVisible = false;
    closedSolicitud: Solicitud | null = null;
    closedSolicitudLocation = '';
    processDetailsDialogVisible = false;
    processDetailsSolicitud: Solicitud | null = null;
    processDetailsInstallation: InstallationDetail | null = null;
    processDetailsIndex = 0;
    processDetailsDevice: any | null = null;
    processDetailsDeviceLoading = false;
    processDetailsDeviceError = '';
    processDetailsTimeline: ProcessTechnicianTimelineItem[] = [];
    private processDetailsDeviceRequestId = 0;
    processLocationMapDialogVisible = false;
    processLocationMapLoading = false;
    processLocationMapError = '';
    processLocationMapAddress = '';
    processLocationMapCoordinates: { lat: number; lng: number } | null = null;
    processLocationMap: any = null;
    processLocationMapMarker: any = null;
    completionConfirmDialogVisible = false;
    completionSolicitud: Solicitud | null = null;
    private pendingCompletionAction: (() => void) | null = null;
    cancellationDialogVisible = false;
    cancellationSolicitud: Solicitud | null = null;
    cancellationReason = '';
    cancellationReasonSubmitted = false;
    cancellingSolicitud = false;
    installationModalVisible = false;
    editingInstallationIndex: number = 0;
    existingGpsTargetByInstallation: Record<number, any> = {};
    checkingExistingGpsTargetByInstallation: Record<number, boolean> = {};
    isEditMode = false;
    
    showVehicleData = false;
    showLocationData = false;
    showDeviceData = false;
    showRootLocationData = false;
    rootLocationMap: any = null;
    rootLocationMarker: any = null;
    rootGoogleMapsLink = '';
    locationConfigDialogVisible = false;
    locationConfigTarget: SolicitudLocationConfigTarget = 'root';
    locationConfigMethod: SolicitudLocationConfigMethod = 'search';
    locationConfigGoogleMapsLink = '';
    locationConfigResolvingLink = false;
    locationConfigMap: any = null;
    locationConfigMarker: any = null;
    locationConfigSearchQuery = '';
    locationConfigSelectedAddress = '';
    locationConfigSuggestions: SolicitudLocationSuggestion[] = [];
    locationConfigSearching = false;
    locationConfigSearchAttempted = false;
    locationConfigSearchUnavailable = false;
    private locationConfigAutocompleteService: any;
    private locationConfigAutocompleteSessionToken: any;
    private locationConfigSearchTimer?: ReturnType<typeof setTimeout>;
    private locationConfigSearchRequestId = 0;
    showInstallData = false;
    showDetailsData = false;
    showDiagnosisData = false;
    showGpsChangeData = false;
    
    locationMap: any = null;
    locationMarker: any = null;
    availableTechnicians: any[] = [];
    showRootDetailsData = false;
    showInstallationsCards = false;
    loading = false;
    totalItems = 0;
    currentPage = 1;
    private readonly solicitudesPageSize = 500;
    private solicitudesLoadSequence = 0;
    private readonly realtimeRefreshMs = 5000;
    private realtimeRefreshTimer?: ReturnType<typeof setInterval>;
    private realtimeStateVersion = '';
    private realtimeStateInFlight = false;
    private solicitudStatusSnapshot = new Map<string, string>();
    private solicitudStartedToastTimer?: ReturnType<typeof setTimeout>;
    solicitudStartedToast: SolicitudStartedToast | null = null;
    technicianDialogVisible = false;
    selectedTechnicianSolicitud: Solicitud | null = null;
    private readonly failedTechnicianPhotos = new Set<string>();
    verifyingAvailabilityId = '';
    availabilityCallLoadingId = '';
    availabilityTranscriptDialogVisible = false;
    availabilityTranscriptText = '';
    availabilityTranscriptMessages: AvailabilityTranscriptMessage[] = [];
    availabilityCallAudioDialogVisible = false;
    availabilityCallRecordingUrl = '';
    availabilityCallStatus = '';
    availabilityCallDuration?: number;
    technicianLocationDialogVisible = false;
    technicianLocationLoading = false;
    technicianLocationError = '';
    technicianLocation: UserLatestLocation | null = null;
    technicianLocationMap: any = null;
    technicianLocationMarker: any = null;
    techniciansMapDialogVisible = false;
    techniciansMapLoading = false;
    techniciansMapError = '';
    techniciansWithLocation: Array<{ technician: User; location: UserLatestLocation }> = [];
    techniciansMap: any = null;
    techniciansMapMarkers: any[] = [];
    missingClientDialogVisible = false;
    missingClientChecking = false;
    private skipMissingClientCheckOnce = false;
    deinstallationReasonError = false;
    technicianScheduleChecking = false;
    technicianScheduleConflict: TechnicianScheduleConflict | null = null;
    technicianScheduleValidationError = '';
    private technicianScheduleValidationSequence = 0;
    technicianRecommendationLoading = false;
    technicianRecommendation: TechnicianRecommendation | null = null;
    technicianRecommendationMessage = '';
    private technicianRecommendationSequence = 0;

    // Filters
    filterType = '';
    filterStatus = '';
    searchQuery = '';
    topFilterTechnician = '';
    topFilterClient = '';
    topFilterType = '';
    topFilterDateFrom = '';
    topFilterDateTo = '';
    filtersExpanded = false;
    exportingSolicitudesFormat: SolicitudExportFormat | null = null;
    calendarDialogVisible = false;
    calendarCurrentMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1,
    );
    calendarMonthLabel = '';
    calendarTechnicianFilter = '';
    calendarDays: SolicitudCalendarDay[] = [];
    calendarMonthRequestCount = 0;
    calendarUnscheduledSolicitudes: Solicitud[] = [];
    calendarBreakdownDialogVisible = false;
    calendarBreakdownDateLabel = '';
    calendarBreakdownTechnicianName = '';
    calendarBreakdownTechnicianPhoto: string | null = null;
    calendarBreakdownSolicitudes: Solicitud[] = [];
    readonly calendarWeekdayLabels = [
        'Lunes',
        'Martes',
        'Miércoles',
        'Jueves',
        'Viernes',
        'Sábado',
        'Domingo',
    ];
    clientEmailSuggestions: User[] = [];
    clientSelectionDialogVisible = false;
    newClientDialogVisible = false;
    clientSearchQuery = '';
    clientSearchResults: User[] = [];
    clientSearchTotal = 0;
    clientSearchLoading = false;
    selectedClient: User | null = null;
    technicianSelectionDialogVisible = false;
    technicianSearchQuery = '';
    newClientWhatsapp = '';
    newClientLookupLoading = false;
    newClientLookupAttempted = false;
    existingNewClientUser: User | null = null;
    private clientSearchRequestId = 0;
    private clientSearchTimer?: ReturnType<typeof setTimeout>;
    private newClientLookupRequestId = 0;
    private newClientLookupTimer?: ReturnType<typeof setTimeout>;
    inventoryDeviceSuggestions: any[] = [];

    // Select options for vehicle
    availableBrands: SelectOption[] = [];
    availableModels: SelectOption[] = [];

    private initialDataPromise: Promise<void> | null = null;
    availableYears: SelectOption[] = [];

    // Province/Municipality for Root (Ubicación del Cliente)
    rootAvailableMunicipalities: SelectOption[] = [];
    rootAvailableSectors: SelectOption[] = [];

    // Province/Municipality for Installation form
    availableProvinces: SelectOption[] = [];
    availableMunicipalities: SelectOption[] = [];
    availableSectors: SelectOption[] = [];

    // Model name cache for table display
    modelNameCache: Record<string, string> = {};
    userNameCache: Record<string, string> = {};

    // Color selector
    availableColors: SelectOption[] = [];
    filteredColors: SelectOption[] = [];
    private _displayColorName = '';
    get displayColorName(): string { return this._displayColorName; }
    set displayColorName(value: string) {
        const normalized = (value || '').toLowerCase();
        this._displayColorName = normalized;
        if (normalized) {
            this.filteredColors = this.availableColors.filter(color =>
                color.label.toLowerCase().includes(normalized) ||
                color.value.toLowerCase().includes(normalized)
            );
        } else {
            this.filteredColors = [...this.availableColors];
            if (this.selectedSolicitud && this.editingInstallationIndex !== -1 && this.selectedSolicitud.installations) {
                this.selectedSolicitud.installations[this.editingInstallationIndex].color = '';
            }
        }
    }

    typeOptions = [
        { label: 'Todas', value: '' },
        { label: 'Instalación', value: 'instalacion' },
        { label: 'Reinstalación', value: 'reinstalacion' },
        { label: 'Desinstalación', value: 'desinstalacion' },
        { label: 'Chequeo', value: 'chequeo' },
        { label: 'Cambio de GPS', value: 'cambio' },
        { label: 'Mixta', value: 'mixta' }
    ];
    readonly topFilterTypeOptions = this.typeOptions.slice(1);
    readonly mixedProcessOptions = this.typeOptions.filter(option =>
        ['instalacion', 'reinstalacion', 'desinstalacion', 'chequeo', 'cambio'].includes(option.value)
    );
    readonly deinstallationReasons = DEVICE_CANCELLATION_REASONS;

    getEntityName(plural: boolean = false): string {
        const t = this.selectedSolicitud?.type || 'instalacion';
        if (t === 'chequeo') return plural ? 'Chequeos' : 'Chequeo';
        if (t === 'reinstalacion') return plural ? 'Reinstalaciones' : 'Reinstalación';
        if (t === 'desinstalacion') return plural ? 'Desinstalaciones' : 'Desinstalación';
        if (t === 'cambio') return plural ? 'Cambios' : 'Cambio';
        if (t === 'mixta') return plural ? 'Procesos' : 'Proceso';
        if (t === 'otro') return plural ? 'Procesos' : 'Proceso';
        return plural ? 'Instalaciones' : 'Instalación';
    }

    statusOptions = [
        { label: 'Todos', value: '' },
        { label: 'Pendiente', value: 'pendiente' },
        { label: 'Aceptada', value: 'aceptada' },
        { label: 'Rechazada', value: 'rechazada' },
        { label: 'En Progreso', value: 'en_progreso' },
        { label: 'Por Confirmar', value: 'por_confirmar' },
        { label: 'Completada', value: 'completada' },
        { label: 'Cancelada', value: 'cancelada' }
    ];

    get editableStatusOptions(): SelectOption[] {
        return this.statusOptions.filter(option =>
            Boolean(option.value) && option.value !== 'cancelada'
        );
    }

    typeLabels: Record<string, string> = {
        instalacion: 'Instalación',
        reinstalacion: 'Reinstalación',
        chequeo: 'Chequeo',
        cambio: 'Cambio',
        desinstalacion: 'Desinstalación',
        mixta: 'Mixta',
        otro: 'Otro'
    };

    statusLabels: Record<string, string> = {
        pendiente: 'Pendiente',
        aceptada: 'Aceptada',
        rechazada: 'Rechazada',
        en_progreso: 'En Progreso',
        por_confirmar: 'Por Confirmar',
        completada: 'Completada',
        cancelada: 'Cancelada'
    };

    // Install dialog
    installDialogVisible = false;
    installing = false;
    solicitudToInstall: Solicitud | null = null;
    availableProtocols: Protocol[] = [];
    availablePlans: Plan[] = [];
    simCardTypes = SIM_CARD_TYPES;
    installationLocations = INSTALLATION_LOCATIONS;
    installData = {
        name: '',
        type: '',
        activation_date: '',
        expiration_date: '',
        plan_id: '',
        plan_price_id: '',
        device_imei: '',
        sim_card_number: '',
        sim_company: '',
        installation_details: '',
        parent_id: '',
        parentEmail: '',
        parentUserName: '',
        searchingUser: false,
        userFound: false
    };

    constructor(
        private solicitudesService: SolicitudesService,
        private vehicleBrandsService: VehicleBrandsService,
        private colorsService: ColorsService,
        private userService: UserService,
        private targetsService: TargetsService,
        private protocolsService: ProtocolsService,
        private plansService: PlansService,
        private inventoryService: InventoryService,
        private authService: AuthService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService,
        private systemService: SystemService,
        private router: Router,
        private cdr: ChangeDetectorRef
    ) { }

    get isRootUser(): boolean {
        const root = this.authService.getCurrentUser()?.root;
        return root === true || String(root).toLowerCase() === 'true';
    }

    ngOnInit(): void {
        this.initializeTopDateFilters();
        this.loadSolicitudes(false);
        this.startRealtimeRefresh();
        this.initialDataPromise = this.loadInitialData();
    }

    ngOnDestroy(): void {
        this.destroyLocationConfigMap();
        this.destroyProcessLocationMap();
        this.destroyTechnicianLocationMap();
        this.destroyTechniciansMap();
        this.rootLocationMarker?.remove?.();
        this.rootLocationMap?.remove?.();
        this.locationMarker?.remove?.();
        this.locationMap?.remove?.();
        this.solicitudesLoadSequence += 1;
        this.stopRealtimeRefresh();
        this.clearSolicitudStartedToastTimer();
        if (this.clientSearchTimer) {
            clearTimeout(this.clientSearchTimer);
        }
        if (this.newClientLookupTimer) {
            clearTimeout(this.newClientLookupTimer);
        }
        if (this.locationConfigSearchTimer) {
            clearTimeout(this.locationConfigSearchTimer);
        }
    }

    async loadInitialData(): Promise<void> {
        try {
            // Generate years (current year down to 30 years ago)
            const currentYear = new Date().getFullYear();
            this.availableYears = Array.from({ length: 30 }, (_, i) => {
                const year = currentYear - i;
                return { label: year.toString(), value: year.toString() };
            });

            // Load brands from service
            const brands = await this.vehicleBrandsService.getAllBrands();
            this.availableBrands = brands.map((brand: any) => ({
                label: brand.nombre,
                value: brand._id
            })).sort((a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label));

            // Load colors from service
            const colors = await this.colorsService.getAllColors();
            this.availableColors = colors.map((color: any) => ({
                label: color.nombre,
                value: color.hex
            })).sort((a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label));
            this.filteredColors = [...this.availableColors];

            // Load provinces
            const provinces = await this.vehicleBrandsService.getProvinces();
            this.availableProvinces = provinces.map((p: any) => ({
                label: p.name,
                value: String(p.code)
            }));
            
            // Load technicians
            this.userService.getTechnicians().subscribe({
                next: (techs: any) => this.availableTechnicians = techs,
                error: () => this.availableTechnicians = []
            });
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    }

    async onProvinceChange(): Promise<void> {
        if (!this.selectedSolicitud || this.editingInstallationIndex === -1) return;
        const currentInst = this.selectedSolicitud.installations![this.editingInstallationIndex];
        currentInst.municipality = '';
        currentInst.sector = '';
        this.availableMunicipalities = [];
        this.availableSectors = [];
        if (currentInst.province) {
            try {
                const municipalities = await this.vehicleBrandsService.getMunicipalities(currentInst.province);
                this.availableMunicipalities = municipalities.map((m: any) => ({
                    label: m.name,
                    value: String(m.code)
                }));
                this.focusInstMapOnSelection('province');
            } catch (e) {
            }
        }
    }
    
    async onMunicipalityChange(): Promise<void> {
        if (!this.selectedSolicitud || this.editingInstallationIndex === -1) return;
        const currentInst = this.selectedSolicitud.installations![this.editingInstallationIndex];
        currentInst.sector = '';
        this.availableSectors = [];
        if (currentInst.municipality && currentInst.province) {
            try {
                const sectors = await this.vehicleBrandsService.getSectors(currentInst.municipality, currentInst.province);
                this.availableSectors = sectors.map((s: any) => ({
                    label: s.name,
                    value: String(s.code)
                }));
                this.focusInstMapOnSelection('municipality');
            } catch (e) {}
        }
    }

    onSectorChange(): void {
        this.focusInstMapOnSelection('sector');
    }

    async geocodeInstLocation(address: string, zoomLevel: number): Promise<void> {
        if (!this.locationMap) return;
        if (typeof google === 'undefined' || !google.maps?.Geocoder) {
            await this.initializeSolicitudLocationPlaces();
        }
        if (typeof google === 'undefined' || !google.maps?.Geocoder) return;

        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: address + ', República Dominicana' }, (results: any, status: any) => {
            if (status === 'OK' && results && results[0]) {
                const location = results[0].geometry.location;
                this.locationMap.panTo([location.lng(), location.lat()]);
                this.locationMap.setZoom(zoomLevel);
            } else {
                console.warn('Geocoding failed for: ', address, 'Status: ', status);
            }
        });
    }

    focusInstMapOnSelection(level: 'province' | 'municipality' | 'sector') {
        if (!this.selectedSolicitud || this.editingInstallationIndex === -1) return;
        let address = '';
        let zoom = 12;

        const currentInst = this.selectedSolicitud.installations![this.editingInstallationIndex];
        const pVal = currentInst.province;
        const mVal = currentInst.municipality;
        const sVal = currentInst.sector;

        const prov = this.availableProvinces.find(p => p.value === pVal);
        const mun = this.availableMunicipalities.find(m => m.value === mVal);
        const sec = this.availableSectors?.find(s => s.value === sVal);

        switch (level) {
            case 'province':
                if (prov) address = prov.label;
                zoom = 10;
                break;
            case 'municipality':
                if (prov && mun) address = `${mun.label}, ${prov.label}`;
                zoom = 12;
                break;
            case 'sector':
                if (prov && mun && sec) address = `${sec.label}, ${mun.label}, ${prov.label}`;
                zoom = 15;
                break;
        }

        if (address) {
            this.geocodeInstLocation(address, zoom);
        }
    }

    async onBrandChange(): Promise<void> {
        if (!this.selectedSolicitud || this.editingInstallationIndex === -1) return;
        const currentInst = this.selectedSolicitud.installations![this.editingInstallationIndex];
        try {
            if (currentInst.brand) {
                currentInst.model = '';
                this.availableModels = [];
                const models = await this.vehicleBrandsService.getAllModelsByBrand(currentInst.brand);
                if (models && models.length > 0) {
                    this.availableModels = models.map((model: any) => ({
                        label: model.nombre,
                        value: model._id
                    })).sort((a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label));
                    this.availableModels.forEach(m => this.modelNameCache[m.value] = m.label);
                }
            } else {
                this.availableModels = [];
                currentInst.model = '';
            }
        } catch (error) {
            this.availableModels = [];
        }
    }

    private async loadModelNamesForTable(): Promise<void> {
        const brandIds = [...new Set(this.solicitudes.map(s => s.installations?.[0]?.brand).filter(b => b))];
        for (const brandId of brandIds as string[]) {
            const alreadyCached = false;
            if (alreadyCached) continue;
            try {
                const models = await this.vehicleBrandsService.getAllModelsByBrand(brandId);
                (models || []).forEach((m: any) => {
                    this.modelNameCache[m._id] = m.nombre;
                });
            } catch { }
        }
    }

    selectColor(color: SelectOption): void {
        if (this.selectedSolicitud && this.editingInstallationIndex !== -1) {
            if(!this.selectedSolicitud.installations) return;
            this.selectedSolicitud.installations[this.editingInstallationIndex].color = color.value;
            this._displayColorName = color.label;
            this.filteredColors = [color];
        }
    }

    async loadSolicitudes(resetPage = true, options: { silent?: boolean } = {}): Promise<void> {
        if (resetPage) this.currentPage = 1;
        const silent = options.silent === true;
        const loadSequence = ++this.solicitudesLoadSequence;
        if (!silent) {
            this.loading = true;
        }

        try {
            const solicitudes: Solicitud[] = [];
            let page = 1;
            let loadedRecords = 0;
            let total = 0;

            do {
                const response = await firstValueFrom(this.solicitudesService.getAll({
                    type: this.filterType || undefined,
                    status: this.filterStatus || undefined,
                    search: this.searchQuery || undefined,
                    page,
                    limit: this.solicitudesPageSize
                }));

                if (loadSequence !== this.solicitudesLoadSequence) {
                    return;
                }

                const pageData = response?.data || [];
                total = Number(response?.total) || 0;
                solicitudes.push(...pageData);
                loadedRecords += pageData.length;

                if (!pageData.length) {
                    break;
                }
                page += 1;
            } while (loadedRecords < total);

            const uniqueSolicitudes = new Map<string, Solicitud>();
            solicitudes.forEach((solicitud, index) => {
                uniqueSolicitudes.set(
                    solicitud._id || `solicitud-sin-id-${index}`,
                    solicitud
                );
            });
            const completeData = [...uniqueSolicitudes.values()];

            this.detectSolicitudesStarted(completeData, silent);
            this.solicitudes = completeData;
            this.totalItems = total;
            if (this.calendarDialogVisible) {
                this.refreshSolicitudCalendar();
            }
            void this.loadModelNamesForTable();
            this.resolveUserNames();
        } catch {
            if (loadSequence !== this.solicitudesLoadSequence) {
                return;
            }
            if (!silent) {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No se pudieron cargar las solicitudes'
                });
            }
        } finally {
            if (loadSequence === this.solicitudesLoadSequence && !silent) {
                this.loading = false;
            }
        }
    }

    private detectSolicitudesStarted(nextSolicitudes: Solicitud[], silent: boolean): void {
        const previousSnapshot = this.solicitudStatusSnapshot;
        const hasPreviousSnapshot = previousSnapshot.size > 0;
        const nextSnapshot = new Map<string, string>();
        let startedSolicitud: Solicitud | null = null;

        for (const solicitud of nextSolicitudes) {
            const id = solicitud._id || '';
            if (!id) continue;

            const nextStatus = solicitud.status || '';
            const previousStatus = previousSnapshot.get(id);
            nextSnapshot.set(id, nextStatus);

            if (
                silent &&
                hasPreviousSnapshot &&
                nextStatus === 'en_progreso' &&
                (previousStatus === 'pendiente' || previousStatus === 'aceptada')
            ) {
                startedSolicitud = solicitud;
            }
        }

        this.solicitudStatusSnapshot = nextSnapshot;

        if (startedSolicitud) {
            this.showSolicitudStartedToast(startedSolicitud);
        }
    }

    private showSolicitudStartedToast(solicitud: Solicitud): void {
        this.solicitudStartedToast = {
            solicitud,
            clientName: this.getClientDisplayName(solicitud) || 'Cliente sin nombre',
            technicianName: this.getTechnicianDisplayName(solicitud),
            typeLabel: this.typeLabels[solicitud.type] || solicitud.type || 'Solicitud',
            deviceLabel: this.getSolicitudPrimaryDeviceLabel(solicitud),
        };

        this.clearSolicitudStartedToastTimer();
        this.solicitudStartedToastTimer = setTimeout(() => {
            this.solicitudStartedToast = null;
            this.solicitudStartedToastTimer = undefined;
        }, 9000);
    }

    closeSolicitudStartedToast(event?: Event): void {
        event?.stopPropagation();
        this.solicitudStartedToast = null;
        this.clearSolicitudStartedToastTimer();
    }

    openSolicitudStartedToast(): void {
        const solicitud = this.solicitudStartedToast?.solicitud;
        if (!solicitud) return;

        this.closeSolicitudStartedToast();
        this.editSolicitud(solicitud);
    }

    private clearSolicitudStartedToastTimer(): void {
        if (!this.solicitudStartedToastTimer) return;
        clearTimeout(this.solicitudStartedToastTimer);
        this.solicitudStartedToastTimer = undefined;
    }

    private startRealtimeRefresh(): void {
        if (this.realtimeRefreshTimer) return;
        this.realtimeRefreshTimer = setInterval(() => {
            this.checkRealtimeSolicitudChanges();
        }, this.realtimeRefreshMs);
    }

    private stopRealtimeRefresh(): void {
        if (!this.realtimeRefreshTimer) return;
        clearInterval(this.realtimeRefreshTimer);
        this.realtimeRefreshTimer = undefined;
    }

    private restartRealtimeRefresh(): void {
        this.stopRealtimeRefresh();
        this.startRealtimeRefresh();
    }

    private checkRealtimeSolicitudChanges(): void {
        if (this.realtimeStateInFlight || this.loading || this.draggedSolicitud) {
            return;
        }

        this.realtimeStateInFlight = true;
        this.solicitudesService.getRealtimeState({
            type: this.filterType || undefined,
            status: this.filterStatus || undefined,
            search: this.searchQuery || undefined,
        }).subscribe({
            next: (state) => {
                if (state.version && state.version !== this.realtimeStateVersion) {
                    this.realtimeStateVersion = state.version;
                    this.loadSolicitudes(false, { silent: true });
                }
                this.realtimeStateInFlight = false;
            },
            error: () => {
                this.realtimeStateInFlight = false;
            }
        });
    }

    async openNew(status: string = 'pendiente'): Promise<void> {
        if (this.initialDataPromise) await this.initialDataPromise;
        
        this.selectedSolicitud = {
            client_name: '',
            client_phone: '',
            client_email: '',
            quantity: 1,
            scheduled_date: this.getCurrentDateTimeLocalValue(),
            installations: [{}],
            type: 'instalacion',
            status: status
        } as Solicitud;
        this.availableModels = [];
        this.availableMunicipalities = [];
        this.availableSectors = [];
        this._displayColorName = '';
        this.filteredColors = [...this.availableColors];
        this.isEditMode = false;
        this.selectedSolicitudOriginalStatus = '';
        this.deinstallationReasonError = false;
        this.resetTechnicianScheduleValidation();
        this.resetTechnicianRecommendation();
        
        this.showRootLocationData = false;
        this.showRootDetailsData = false;
        this.showInstallationsCards = false;
        
        this.rootLocationMap = null;
        this.locationMap = null;
        this.rootGoogleMapsLink = '';
        this.selectedClient = null;
        this.closeClientDialogs();
        this.closeTechnicianSelection();

        this.dialogVisible = true;
        void this.refreshTechnicianRecommendation();
    }

    onTypeChange(): void {
        if (!this.selectedSolicitud) return;
        if (this.selectedSolicitud.type !== 'desinstalacion') {
            this.selectedSolicitud.deinstallation_reason = undefined;
        }
        if (this.selectedSolicitud.type === 'mixta') {
            this.selectedSolicitud.installations?.forEach(installation => {
                installation.process_type ||= 'instalacion';
            });
        }
        this.deinstallationReasonError = false;
        this.onQuantityChange();

        if (this.isDeviceRequiredForSolicitud()) {
            this.showInstallationsCards = true;
        }
    }

    onDeinstallationReasonChange(): void {
        this.deinstallationReasonError = false;
    }

    getDeinstallationReasonLabel(value?: string): string {
        return getDeviceCancellationReasonLabel(value);
    }

    get completionDeinstallationReasonLabel(): string {
        if (!this.completionSolicitud) return '';
        if (this.completionSolicitud.type === 'desinstalacion') {
            return this.getDeinstallationReasonLabel(this.completionSolicitud.deinstallation_reason);
        }
        if (this.completionSolicitud.type !== 'mixta') return '';

        const labels = (this.completionSolicitud.installations || [])
            .filter(installation => this.getProcessTypeForSolicitud(this.completionSolicitud!, installation) === 'desinstalacion')
            .map(installation => this.getDeinstallationReasonLabel(installation.deinstallation_reason))
            .filter(Boolean);
        return [...new Set(labels)].join(', ');
    }

    private hasValidDeinstallationReason(solicitud: Solicitud): boolean {
        if (solicitud.type === 'desinstalacion') {
            const selectedReason = String(solicitud.deinstallation_reason || '').trim();
            return this.deinstallationReasons.some(reason => reason.value === selectedReason);
        }
        if (solicitud.type !== 'mixta') return true;

        return (solicitud.installations || []).every(installation => {
            if (this.getProcessTypeForSolicitud(solicitud, installation) !== 'desinstalacion') {
                return true;
            }
            const selectedReason = String(installation.deinstallation_reason || '').trim();
            return this.deinstallationReasons.some(reason => reason.value === selectedReason);
        });
    }

    isDeviceRequiredForSolicitud(): boolean {
        if (!this.selectedSolicitud) return false;
        return (this.selectedSolicitud.installations || []).some(installation =>
            this.isDeviceRequiredForProcess(this.getProcessTypeForSolicitud(this.selectedSolicitud!, installation))
        );
    }

    getProcessTypeForSolicitud(
        solicitud: Solicitud,
        installation?: InstallationDetail | null,
    ): string {
        if (solicitud.type !== 'mixta') return solicitud.type;
        return installation?.process_type || 'instalacion';
    }

    getInstallationProcessType(installation?: InstallationDetail | null): string {
        if (!this.selectedSolicitud) return 'instalacion';
        return this.getProcessTypeForSolicitud(this.selectedSolicitud, installation);
    }

    getKanbanProcessLabel(
        solicitud: Solicitud,
        installation: InstallationDetail,
        index: number,
    ): string {
        if (solicitud.type !== 'mixta') {
            return installation.plate || `Vehículo #${index + 1}`;
        }
        const processType = this.getProcessTypeForSolicitud(solicitud, installation);
        return `${this.typeLabels[processType] || 'Proceso'} #${index + 1}`;
    }

    getCurrentInstallationProcessType(): string {
        const installation = this.selectedSolicitud?.installations?.[this.editingInstallationIndex];
        return this.getInstallationProcessType(installation);
    }

    getInstallationEntityName(installation?: InstallationDetail | null): string {
        const type = this.getInstallationProcessType(installation);
        return this.typeLabels[type] || 'Proceso';
    }

    onInstallationProcessTypeChange(installation: InstallationDetail): void {
        if (installation.process_type !== 'desinstalacion') {
            installation.deinstallation_reason = undefined;
        }
        this.deinstallationReasonError = false;
    }

    private isDeviceRequiredForProcess(type: string): boolean {
        return ['chequeo', 'desinstalacion', 'cambio'].includes(type);
    }

    isSelectedSolicitudFinalized(): boolean {
        if (this.selectedSolicitudOriginalStatus === 'completada' || this.selectedSolicitudOriginalStatus === 'cancelada') {
            return true;
        }

        const selectedId = this.selectedSolicitud?._id;
        const currentSolicitud = selectedId
            ? this.solicitudes.find(solicitud => solicitud._id === selectedId)
            : null;
        return this.isSolicitudClosed(currentSolicitud);
    }

    isSolicitudClosed(solicitud: Solicitud | null | undefined): boolean {
        return solicitud?.status === 'completada'
            || solicitud?.status === 'cancelada'
            || this.isAdministrativeRejection(solicitud);
    }

    isAdministrativeRejection(solicitud: Solicitud | null | undefined): boolean {
        return solicitud?.status === 'rechazada'
            && String(solicitud.cancellation_reason || '').trim().length > 0;
    }

    isInstallationFlow(type?: string): boolean {
        return ['instalacion', 'reinstalacion'].includes(type || '');
    }

    getInstallActionLabel(solicitud: Solicitud | null = this.solicitudToInstall): string {
        return solicitud?.type === 'reinstalacion' ? 'Reinstalar' : 'Instalar';
    }
    
    onQuantityChange(): void {
        if (!this.selectedSolicitud) return;
        const qty = Number(this.selectedSolicitud.quantity) || 1;
        if (!this.selectedSolicitud.installations) {
            this.selectedSolicitud.installations = [];
        }
        
        while (this.selectedSolicitud.installations.length < qty) {
            this.selectedSolicitud.installations.push(
                this.selectedSolicitud.type === 'mixta'
                    ? {
                        ...this.getPrimarySolicitudLocationDefaults(),
                        process_type: 'instalacion',
                    }
                    : this.getPrimarySolicitudLocationDefaults()
            );
        }
        if (this.selectedSolicitud.installations.length > qty) {
            this.selectedSolicitud.installations = this.selectedSolicitud.installations.slice(0, qty);
        }
    }

    openInstallationModal(index: number, showModal: boolean = true): void {
        this.editingInstallationIndex = index;
        this.showVehicleData = false;
        this.showLocationData = false;
        this.showDeviceData = false;
        this.showInstallData = false;
        this.showDetailsData = false;
        this.showDiagnosisData = false;
        this.showGpsChangeData = false;
        
        this.availableModels = [];
        this.availableMunicipalities = [];
        this.availableSectors = [];
        this.locationMap = null;
        
        const inst = this.selectedSolicitud?.installations?.[index];
        if (inst) {
            const savedModel = inst.model;
            const savedMunicipality = inst.municipality;
            const savedSector = inst.sector;

            if (inst.brand) {
                this.vehicleBrandsService.getAllModelsByBrand(inst.brand).then((models: any) => {
                    this.availableModels = models.map((m: any) => ({ label: m.nombre, value: m._id })).sort((a: any, b: any) => a.label.localeCompare(b.label));
                    setTimeout(() => { inst.model = savedModel; }, 0);
                }).catch(() => {});
            }
            if (inst.province) {
                this.vehicleBrandsService.getMunicipalities(inst.province).then((muns: any) => {
                    this.availableMunicipalities = muns.map((m: any) => ({ label: m.name, value: String(m.code) }));
                    setTimeout(() => { inst.municipality = savedMunicipality; }, 0);
                }).catch(() => {});
            }
            if (inst.municipality && inst.province) {
                this.vehicleBrandsService.getSectors(inst.municipality, inst.province).then((secs: any) => {
                    this.availableSectors = secs.map((s: any) => ({ label: s.name, value: String(s.code) }));
                    setTimeout(() => { inst.sector = savedSector; }, 0);
                }).catch(() => {});
            }
            this.displayColorName = inst.color || '';
        } else {
            this.displayColorName = '';
            this.filteredColors = [...this.availableColors];
        }

        if (showModal) {
            this.installationModalVisible = true;
        }
        this.lookupExistingGpsTarget(index, false);
    }
    
    toggleSection(section: string) {
        const currentlyOpen = this[('show' + section.charAt(0).toUpperCase() + section.slice(1) + 'Data') as keyof this];
        this.showVehicleData = false;
        this.showLocationData = false;
        this.showDeviceData = false;
        this.showInstallData = false;
        this.showDetailsData = false;
        this.showDiagnosisData = false;
        this.showGpsChangeData = false;

        switch (section) {
            case 'vehicle': this.showVehicleData = !currentlyOpen; break;
            case 'location':
                this.openSolicitudLocationConfig('installation');
                break;
            case 'device': this.showDeviceData = !currentlyOpen; break;
            case 'install': this.showInstallData = !currentlyOpen; break;
            case 'details': this.showDetailsData = !currentlyOpen; break;
            case 'diagnosis': this.showDiagnosisData = !currentlyOpen; break;
            case 'gpsChange': this.showGpsChangeData = !currentlyOpen; break;
        }
    }

    getGpsChangeInstallation(
        solicitud: Solicitud | null | undefined,
        sourceInstallation: InstallationDetail | null | undefined,
        sourceIndex: number,
    ): InstallationDetail | null {
        const gpsChangeInstallations = solicitud?.gps_change?.installations || [];
        const sourceImei = String(sourceInstallation?.device_imei || '').trim();
        if (gpsChangeInstallations.length && sourceImei) {
            const imeiMatch = gpsChangeInstallations.find(installation =>
                String(installation?.device_imei || '').trim() === sourceImei,
            );
            if (imeiMatch) return imeiMatch;
        }

        if (gpsChangeInstallations[sourceIndex]) {
            return gpsChangeInstallations[sourceIndex];
        }

        const recovery = sourceInstallation?.checkup_recovery;
        const replacementImei = String(
            recovery?.replacement_device_imei
            || sourceInstallation?.new_device_imei
            || '',
        ).trim();
        if (!replacementImei) return null;

        return {
            ...sourceInstallation,
            device_imei: recovery?.previous_device_imei || sourceInstallation?.device_imei,
            new_device_imei: replacementImei,
            sim_card_number:
                recovery?.previous_sim_card_number
                || sourceInstallation?.sim_card_number,
            new_sim_card_number:
                recovery?.replacement_sim_card_number
                || sourceInstallation?.new_sim_card_number,
            new_sim_company:
                recovery?.replacement_sim_company
                || sourceInstallation?.new_sim_company,
        };
    }

    getGpsChangeStatusLabel(solicitud: Solicitud | null | undefined): string {
        const status = solicitud?.gps_change?.status || solicitud?.status || '';
        return this.statusLabels[status] || status || 'Registrado';
    }

    getGpsChangeTitle(solicitud: Solicitud | null | undefined): string {
        const status = solicitud?.gps_change?.status || solicitud?.status || '';
        if (status === 'completada' || status === 'por_confirmar') return 'Cambio de GPS realizado';
        if (status === 'cancelada' || status === 'rechazada') return 'Cambio de GPS cancelado';
        return 'Cambio de GPS en proceso';
    }

    getGpsChangeStatusIcon(solicitud: Solicitud | null | undefined): string {
        const status = solicitud?.gps_change?.status || solicitud?.status || '';
        if (status === 'completada' || status === 'por_confirmar') return 'pi pi-check-circle';
        if (status === 'cancelada' || status === 'rechazada') return 'pi pi-times-circle';
        return 'pi pi-spin pi-spinner';
    }

    isGpsChangeCompleted(solicitud: Solicitud | null | undefined): boolean {
        const status = solicitud?.gps_change?.status || solicitud?.status || '';
        return status === 'completada' || status === 'por_confirmar';
    }

    isGpsChangeCancelled(solicitud: Solicitud | null | undefined): boolean {
        const status = solicitud?.gps_change?.status || solicitud?.status || '';
        return status === 'cancelada' || status === 'rechazada';
    }
    
    
    toggleRootLocation(): void {
        this.showRootLocationData = false;
        this.showRootDetailsData = false;
        this.showInstallationsCards = false;
        this.openSolicitudLocationConfig('root');
    }

    openSolicitudLocationConfig(target: SolicitudLocationConfigTarget): void {
        if (!this.selectedSolicitud) return;
        if (target === 'installation' && !this.getCurrentLocationInstallation()) return;

        this.locationConfigTarget = target;
        this.locationConfigMethod = 'search';
        this.locationConfigResolvingLink = false;
        this.locationConfigGoogleMapsLink = target === 'root'
            ? String(this.selectedSolicitud.google_maps_url || this.rootGoogleMapsLink || '')
            : String(this.getCurrentLocationInstallation()?.google_maps_url || '');
        this.locationConfigSelectedAddress = this.getSolicitudLocationAddress();
        this.locationConfigSearchQuery = this.locationConfigSelectedAddress;
        this.locationConfigSuggestions = [];
        this.locationConfigSearching = false;
        this.locationConfigSearchAttempted = false;
        this.locationConfigSearchUnavailable = false;
        this.locationConfigSearchRequestId += 1;
        if (this.locationConfigSearchTimer) {
            clearTimeout(this.locationConfigSearchTimer);
            this.locationConfigSearchTimer = undefined;
        }
        this.destroyLocationConfigMap();
        this.locationConfigDialogVisible = true;
    }

    selectSolicitudLocationMethod(method: SolicitudLocationConfigMethod): void {
        this.locationConfigMethod = method;
        if (method === 'search') {
            setTimeout(() => {
                void this.initializeSolicitudLocationPlaces();
                this.solicitudLocationSearchInput?.nativeElement?.focus();
            });
        } else if (method === 'coordinates') {
            setTimeout(() => void this.initSolicitudLocationConfigMap());
        }
    }

    get solicitudLocationConfigTitle(): string {
        return this.locationConfigTarget === 'root'
            ? 'Ubicación del cliente'
            : `Ubicación de ${this.getEntityName()}`;
    }

    get solicitudLocationCoordinates(): { latitude?: number; longitude?: number } {
        if (this.locationConfigTarget === 'root') {
            return {
                latitude: this.selectedSolicitud?.latitude,
                longitude: this.selectedSolicitud?.longitude,
            };
        }

        const installation = this.getCurrentLocationInstallation();
        return {
            latitude: installation?.latitude,
            longitude: installation?.longitude,
        };
    }

    get hasSolicitudLocationCoordinates(): boolean {
        const { latitude, longitude } = this.solicitudLocationCoordinates;
        return this.isValidCoordinatePair(Number(latitude), Number(longitude));
    }

    get solicitudLocationZoneLabel(): string {
        const source = this.locationConfigTarget === 'root'
            ? this.selectedSolicitud
            : this.getCurrentLocationInstallation();
        if (!source) return 'Sin zona configurada';

        const parts = [source.sector, source.municipality, source.province]
            .map(value => String(value || '').trim())
            .filter(Boolean);
        return parts.length ? parts.join(', ') : 'Sin zona configurada';
    }

    onSolicitudLocationConfigShow(): void {
        if (this.locationConfigMethod === 'search') {
            setTimeout(() => {
                void this.initializeSolicitudLocationPlaces();
                this.solicitudLocationSearchInput?.nativeElement?.focus();
            });
        } else if (this.locationConfigMethod === 'coordinates') {
            setTimeout(() => void this.initSolicitudLocationConfigMap());
        }
    }

    onSolicitudLocationSearchInput(value: string): void {
        const query = String(value || '').trim();
        this.locationConfigSuggestions = [];
        this.locationConfigSearchAttempted = false;
        this.locationConfigSearchUnavailable = false;
        this.locationConfigSearchRequestId += 1;

        if (this.locationConfigSearchTimer) {
            clearTimeout(this.locationConfigSearchTimer);
            this.locationConfigSearchTimer = undefined;
        }

        if (query.length < 3) {
            this.locationConfigSearching = false;
            return;
        }

        this.locationConfigSearching = true;
        this.locationConfigSearchTimer = setTimeout(() => {
            this.locationConfigSearchTimer = undefined;
            void this.searchSolicitudLocationSuggestions(query);
        }, 3000);
    }

    onSolicitudLocationSearchKeydown(event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            this.locationConfigSuggestions = [];
            return;
        }

        if (event.key === 'Enter' && this.locationConfigSuggestions.length) {
            event.preventDefault();
            void this.selectSolicitudLocationSuggestion(this.locationConfigSuggestions[0]);
        }
    }

    clearSolicitudLocationSearch(): void {
        this.locationConfigSearchQuery = '';
        this.locationConfigSuggestions = [];
        this.locationConfigSearching = false;
        this.locationConfigSearchAttempted = false;
        this.locationConfigSearchUnavailable = false;
        this.locationConfigSearchRequestId += 1;
        if (this.locationConfigSearchTimer) {
            clearTimeout(this.locationConfigSearchTimer);
            this.locationConfigSearchTimer = undefined;
        }
        this.solicitudLocationSearchInput?.nativeElement?.focus();
    }

    private async initializeSolicitudLocationPlaces(): Promise<void> {
        try {
            const systemConfigsResponse = await this.systemService.getAll().toPromise();
            const systemConfigs = systemConfigsResponse?.[0];
            const key = systemConfigs?.map_api1?.key;
            if (!key) return;

            await MapUtils.loadMapScript(
                'google',
                key,
                systemConfigs?.map_api1?.url || 'https://maps.googleapis.com/maps/api/js'
            );
            if (!google.maps.places && typeof google.maps.importLibrary === 'function') {
                await google.maps.importLibrary('places');
            }
            this.setupSolicitudLocationAutocomplete();
        } catch (error) {
            console.error('Error cargando Google Places para solicitudes:', error);
        }
    }

    private setupSolicitudLocationAutocomplete(): void {
        if (typeof google === 'undefined' || !google.maps?.places) return;
        if (google.maps.places.AutocompleteService) {
            this.locationConfigAutocompleteService ??=
                new google.maps.places.AutocompleteService();
        }
        if (
            !this.locationConfigAutocompleteSessionToken &&
            google.maps.places.AutocompleteSessionToken
        ) {
            this.locationConfigAutocompleteSessionToken =
                new google.maps.places.AutocompleteSessionToken();
        }
    }

    private async searchSolicitudLocationSuggestions(query: string): Promise<void> {
        if (
            query !== String(this.locationConfigSearchQuery || '').trim() ||
            query.length < 3
        ) {
            return;
        }

        await this.initializeSolicitudLocationPlaces();
        const autocompleteSuggestion =
            typeof google !== 'undefined'
                ? google.maps?.places?.AutocompleteSuggestion
                : null;

        if (
            !autocompleteSuggestion?.fetchAutocompleteSuggestions &&
            !this.locationConfigAutocompleteService
        ) {
            this.locationConfigSearching = false;
            this.locationConfigSearchAttempted = true;
            this.locationConfigSearchUnavailable = true;
            this.cdr.detectChanges();
            return;
        }

        const requestId = ++this.locationConfigSearchRequestId;
        const request = {
            input: query,
            language: 'es',
            region: 'do',
            locationBias: {
                west: -72.2,
                south: 17.3,
                east: -68.0,
                north: 20.2
            },
            sessionToken: this.locationConfigAutocompleteSessionToken
        };

        if (autocompleteSuggestion?.fetchAutocompleteSuggestions) {
            try {
                const response =
                    await autocompleteSuggestion.fetchAutocompleteSuggestions(request);
                if (
                    requestId !== this.locationConfigSearchRequestId ||
                    query !== String(this.locationConfigSearchQuery || '').trim()
                ) {
                    return;
                }

                this.locationConfigSuggestions = (response?.suggestions || [])
                    .map((suggestion: any) => {
                        const prediction = suggestion.placePrediction;
                        const description = prediction?.text?.toString?.() || '';
                        return {
                            description,
                            placeId: prediction?.placeId || '',
                            mainText:
                                prediction?.mainText?.toString?.() || description,
                            secondaryText:
                                prediction?.secondaryText?.toString?.() || '',
                            placePrediction: prediction
                        };
                    })
                    .filter((suggestion: SolicitudLocationSuggestion) =>
                        suggestion.description && suggestion.placeId
                    );
                this.locationConfigSearching = false;
                this.locationConfigSearchAttempted = true;
                this.cdr.detectChanges();
                return;
            } catch (error) {
                console.warn(
                    'La API moderna de Places no respondió en solicitudes; se usará la compatible.',
                    error
                );
            }
        }

        if (!this.locationConfigAutocompleteService) {
            this.locationConfigSearching = false;
            this.locationConfigSearchAttempted = true;
            this.locationConfigSearchUnavailable = true;
            this.cdr.detectChanges();
            return;
        }

        this.locationConfigAutocompleteService.getPlacePredictions(
            request,
            (predictions: any[] | null, status: any) => {
                if (
                    requestId !== this.locationConfigSearchRequestId ||
                    query !== String(this.locationConfigSearchQuery || '').trim()
                ) {
                    return;
                }

                const okStatus =
                    google.maps.places.PlacesServiceStatus?.OK || 'OK';
                const zeroResultsStatus =
                    google.maps.places.PlacesServiceStatus?.ZERO_RESULTS ||
                    'ZERO_RESULTS';
                const requestSucceeded = status === okStatus;
                this.locationConfigSuggestions =
                    requestSucceeded && predictions
                        ? predictions.map(prediction => ({
                            description: prediction.description,
                            placeId: prediction.place_id,
                            mainText:
                                prediction.structured_formatting?.main_text ||
                                prediction.description,
                            secondaryText:
                                prediction.structured_formatting?.secondary_text ||
                                ''
                        }))
                        : [];
                this.locationConfigSearching = false;
                this.locationConfigSearchAttempted = true;
                this.locationConfigSearchUnavailable =
                    !requestSucceeded && status !== zeroResultsStatus;
                this.cdr.detectChanges();
            }
        );
    }

    async selectSolicitudLocationSuggestion(
        suggestion: SolicitudLocationSuggestion
    ): Promise<void> {
        if (typeof google === 'undefined' || !suggestion?.placeId) return;

        this.locationConfigSearchQuery = suggestion.description;
        this.locationConfigSuggestions = [];
        this.locationConfigSearching = true;
        this.locationConfigSearchAttempted = false;
        this.locationConfigSearchUnavailable = false;
        this.locationConfigSearchRequestId += 1;

        if (suggestion.placePrediction?.toPlace) {
            try {
                const place = suggestion.placePrediction.toPlace();
                await place.fetchFields({
                    fields: ['formattedAddress', 'location']
                });
                if (place.location) {
                    this.applySolicitudLocationPlace(
                        place.location.lat(),
                        place.location.lng(),
                        place.formattedAddress || suggestion.description
                    );
                    return;
                }
            } catch (error) {
                console.warn(
                    'No se pudo cargar el detalle moderno del lugar en solicitudes.',
                    error
                );
            }
        }

        const geocoder = new google.maps.Geocoder();
        geocoder.geocode(
            { placeId: suggestion.placeId },
            (results: any[] | null, status: any) => {
                if (status === 'OK' && results?.[0]?.geometry?.location) {
                    const result = results[0];
                    this.applySolicitudLocationPlace(
                        result.geometry.location.lat(),
                        result.geometry.location.lng(),
                        suggestion.description || result.formatted_address
                    );
                    return;
                }

                this.locationConfigSearching = false;
                this.messageService.add({
                    severity: 'warn',
                    summary: 'Ubicación no disponible',
                    detail: 'No fue posible obtener las coordenadas de la ubicación seleccionada.'
                });
                this.cdr.detectChanges();
            }
        );
    }

    private applySolicitudLocationPlace(
        latitude: number,
        longitude: number,
        address: string,
        googleMapsUrl?: string
    ): void {
        const normalizedAddress = String(address || '').trim();
        this.locationConfigSelectedAddress = normalizedAddress;
        this.locationConfigSearchQuery = normalizedAddress;
        this.setSolicitudLocationAddress(normalizedAddress);
        this.setSolicitudLocationCoordinates(latitude, longitude, true);

        const mapsUrl =
            String(googleMapsUrl || '').trim() ||
            `https://www.google.com/maps?q=${latitude},${longitude}`;
        this.locationConfigGoogleMapsLink = mapsUrl;
        this.setSolicitudLocationLink(mapsUrl);
        this.locationConfigSearching = false;
        this.locationConfigAutocompleteSessionToken = null;
        this.setupSolicitudLocationAutocomplete();
        this.cdr.detectChanges();
    }

    applySolicitudLocationCoordinates(): void {
        const { latitude, longitude } = this.solicitudLocationCoordinates;
        const lat = Number(latitude);
        const lng = Number(longitude);
        if (!this.isValidCoordinatePair(lat, lng)) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Coordenadas inválidas',
                detail: 'La latitud debe estar entre -90 y 90, y la longitud entre -180 y 180.'
            });
            return;
        }

        this.setSolicitudLocationCoordinates(lat, lng, true);
        this.reverseGeocodeSolicitudLocation(lat, lng);
    }

    async initSolicitudLocationConfigMap(): Promise<void> {
        try {
            const mapElement = document.getElementById('solicitudLocationConfigMap');
            if (!mapElement) return;

            const coordinates = this.solicitudLocationCoordinates;
            const hasCoordinates = this.hasSolicitudLocationCoordinates;
            const centerLat = hasCoordinates ? Number(coordinates.latitude) : 18.7357;
            const centerLng = hasCoordinates ? Number(coordinates.longitude) : -70.1627;

            this.destroyLocationConfigMap();
            this.locationConfigMap = MapUtils.createMap(
                'osm',
                mapElement,
                '',
                'light',
                centerLat,
                centerLng,
                hasCoordinates ? 16 : 8
            );

            if (hasCoordinates) {
                this.locationConfigMarker = new maplibregl.Marker({ color: '#ef4444' })
                    .setLngLat([centerLng, centerLat])
                    .addTo(this.locationConfigMap);
            }

            this.locationConfigMap.on('click', (event: maplibregl.MapMouseEvent) => {
                const latitude = event.lngLat.lat;
                const longitude = event.lngLat.lng;
                this.setSolicitudLocationCoordinates(
                    latitude,
                    longitude,
                    false
                );
                this.reverseGeocodeSolicitudLocation(latitude, longitude);
            });
        } catch (error) {
            console.error('Error inicializando el selector de ubicación:', error);
        }
    }

    private destroyLocationConfigMap(): void {
        this.locationConfigMarker?.remove?.();
        this.locationConfigMarker = null;
        this.locationConfigMap?.remove?.();
        this.locationConfigMap = null;
    }

    applySolicitudGoogleMapsLink(): void {
        const normalizedLink = this.normalizeGoogleMapsUrl(this.locationConfigGoogleMapsLink);
        if (!normalizedLink) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Link no válido',
                detail: 'Debe ser un enlace HTTPS oficial de Google Maps.'
            });
            return;
        }

        const coordinates = this.extractCoordinatesFromGoogleMapsLink(normalizedLink);
        if (coordinates) {
            this.setSolicitudLocationLink(normalizedLink);
            this.setSolicitudLocationCoordinates(coordinates.lat, coordinates.lng, true);
            this.reverseGeocodeSolicitudLocation(coordinates.lat, coordinates.lng);
            return;
        }

        this.locationConfigResolvingLink = true;
        this.userService.resolveGoogleMapsLink(normalizedLink).subscribe({
            next: (resolved) => {
                this.locationConfigResolvingLink = false;
                this.locationConfigGoogleMapsLink = resolved.resolved_url || normalizedLink;
                this.setSolicitudLocationLink(this.locationConfigGoogleMapsLink);
                this.setSolicitudLocationCoordinates(resolved.latitude, resolved.longitude, true);
                if (resolved.address) {
                    this.locationConfigSelectedAddress = resolved.address;
                    this.locationConfigSearchQuery = resolved.address;
                    this.setSolicitudLocationAddress(resolved.address);
                } else {
                    this.reverseGeocodeSolicitudLocation(
                        resolved.latitude,
                        resolved.longitude
                    );
                }
                this.messageService.add({
                    severity: 'success',
                    summary: 'Ubicación aplicada',
                    detail: 'Se obtuvieron las coordenadas del enlace de Google Maps.'
                });
            },
            error: (error) => {
                this.locationConfigResolvingLink = false;
                this.messageService.add({
                    severity: 'warn',
                    summary: 'No se pudo resolver el enlace',
                    detail: error?.error?.message || 'El enlace no contiene coordenadas que puedan identificarse.'
                });
            }
        });
    }

    clearSolicitudLocationConfig(): void {
        if (!this.selectedSolicitud) return;

        if (this.locationConfigTarget === 'root') {
            this.selectedSolicitud.latitude = undefined;
            this.selectedSolicitud.longitude = undefined;
            this.selectedSolicitud.google_maps_url = undefined;
            this.selectedSolicitud.location_address = undefined;
            this.rootGoogleMapsLink = '';
            this.selectedSolicitud.installations?.forEach(installation => {
                installation.latitude = undefined;
                installation.longitude = undefined;
                installation.google_maps_url = undefined;
                installation.location_address = undefined;
            });
        } else {
            const installation = this.getCurrentLocationInstallation();
            if (installation) {
                installation.latitude = undefined;
                installation.longitude = undefined;
                installation.google_maps_url = undefined;
                installation.location_address = undefined;
            }
        }

        this.locationConfigGoogleMapsLink = '';
        this.locationConfigSelectedAddress = '';
        this.locationConfigSearchQuery = '';
        this.locationConfigSuggestions = [];
        this.locationConfigSearchAttempted = false;
        this.locationConfigSearchUnavailable = false;
        this.locationConfigSearching = false;
        this.locationConfigSearchRequestId += 1;
        if (this.locationConfigSearchTimer) {
            clearTimeout(this.locationConfigSearchTimer);
            this.locationConfigSearchTimer = undefined;
        }
        this.locationConfigMarker?.remove?.();
        this.locationConfigMarker = null;
        if (this.locationConfigTarget === 'root') {
            void this.refreshTechnicianRecommendation();
        }
    }

    private getCurrentLocationInstallation(): InstallationDetail | undefined {
        return this.selectedSolicitud?.installations?.[this.editingInstallationIndex];
    }

    private getSolicitudLocationAddress(): string {
        if (!this.selectedSolicitud) return '';

        const installation = this.locationConfigTarget === 'root'
            ? this.selectedSolicitud.installations?.[0]
            : this.getCurrentLocationInstallation();
        const address = this.locationConfigTarget === 'root'
            ? this.selectedSolicitud.location_address || installation?.location_address
            : installation?.location_address;
        if (String(address || '').trim()) {
            return String(address).trim();
        }

        const legacyAddress = String(installation?.installation_location || '').trim();
        const isPhysicalInstallationLocation = this.installationLocations.some(
            option => option.value === legacyAddress
        );
        return legacyAddress && !isPhysicalInstallationLocation ? legacyAddress : '';
    }

    private setSolicitudLocationAddress(address: string): void {
        if (!this.selectedSolicitud) return;
        const normalizedAddress = String(address || '').trim() || undefined;

        if (this.locationConfigTarget === 'root') {
            this.selectedSolicitud.location_address = normalizedAddress;
            this.selectedSolicitud.installations?.forEach(installation => {
                installation.location_address = normalizedAddress;
            });
            return;
        }

        const installation = this.getCurrentLocationInstallation();
        if (installation) {
            installation.location_address = normalizedAddress;
        }
    }

    onSolicitudLocationConfigHide(): void {
        this.destroyLocationConfigMap();
    }

    private async reverseGeocodeSolicitudLocation(latitude: number, longitude: number): Promise<void> {
        if (typeof google === 'undefined' || !google.maps?.Geocoder) {
            await this.initializeSolicitudLocationPlaces();
        }
        if (typeof google === 'undefined' || !google.maps?.Geocoder) return;

        const requestId = this.locationConfigSearchRequestId;
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode(
            { location: { lat: latitude, lng: longitude } },
            (results: any[] | null, status: any) => {
                if (
                    requestId !== this.locationConfigSearchRequestId ||
                    status !== 'OK' ||
                    !results?.[0]?.formatted_address
                ) {
                    return;
                }

                const address = results[0].formatted_address;
                this.locationConfigSelectedAddress = address;
                this.locationConfigSearchQuery = address;
                this.setSolicitudLocationAddress(address);
                this.cdr.detectChanges();
            }
        );
    }

    private setSolicitudLocationLink(link: string): void {
        if (!this.selectedSolicitud) return;

        if (this.locationConfigTarget === 'root') {
            this.rootGoogleMapsLink = link;
            this.selectedSolicitud.google_maps_url = link;
            this.selectedSolicitud.installations?.forEach(installation => {
                installation.google_maps_url = link;
            });
            return;
        }

        const installation = this.getCurrentLocationInstallation();
        if (installation) {
            installation.google_maps_url = link;
        }
    }

    private setSolicitudLocationCoordinates(lat: number, lng: number, centerMap: boolean): void {
        if (!this.selectedSolicitud || !this.isValidCoordinatePair(Number(lat), Number(lng))) return;

        const latitude = Number(Number(lat).toFixed(6));
        const longitude = Number(Number(lng).toFixed(6));
        if (this.locationConfigTarget === 'root') {
            this.selectedSolicitud.latitude = latitude;
            this.selectedSolicitud.longitude = longitude;
            this.selectedSolicitud.installations?.forEach(installation => {
                installation.latitude = latitude;
                installation.longitude = longitude;
            });
            void this.refreshTechnicianRecommendation();
        } else {
            const installation = this.getCurrentLocationInstallation();
            if (!installation) return;
            installation.latitude = latitude;
            installation.longitude = longitude;
        }

        const position = { lat: latitude, lng: longitude };
        if (this.locationConfigMarker) {
            this.locationConfigMarker.setLngLat([longitude, latitude]);
        } else if (this.locationConfigMap) {
            this.locationConfigMarker = new maplibregl.Marker({ color: '#ef4444' })
                .setLngLat([longitude, latitude])
                .addTo(this.locationConfigMap);
        }
        if (centerMap && this.locationConfigMap) {
            this.locationConfigMap.setCenter([longitude, latitude]);
        }
    }

    toggleRootDetails(): void {
        const currentlyOpen = this.showRootDetailsData;
        this.showRootLocationData = false;
        this.showRootDetailsData = false;
        this.showInstallationsCards = false;

        this.showRootDetailsData = !currentlyOpen;
    }

    toggleInstallationsCards(): void {
        const currentlyOpen = this.showInstallationsCards;
        this.showRootLocationData = false;
        this.showRootDetailsData = false;
        this.showInstallationsCards = false;

        this.showInstallationsCards = !currentlyOpen;
    }

    async onClientEmailBlur(): Promise<void> {
        if (!this.selectedSolicitud) return;
        const email = this.selectedSolicitud.client_email?.trim();
        if (!email) return;

        try {
            const user = await this.userService.getByEmail(email).toPromise();
            if (user) {
                this.selectedSolicitud.client_name = `${user.name || ''} ${user.last_name || ''}`.trim() || this.selectedSolicitud.client_name;
                if (user.phone) {
                    this.selectedSolicitud.client_phone = user.phone;
                }
            }
        } catch (error) {
            // Se ignora si no existe
        }
    }

    openClientSelection(): void {
        this.newClientDialogVisible = false;
        this.clientSearchQuery = '';
        this.clientSelectionDialogVisible = true;
        void this.loadSolicitudClients();
    }

    openNewClient(): void {
        this.clientSelectionDialogVisible = false;
        this.newClientWhatsapp = '';
        this.resetNewClientLookup();
        this.newClientDialogVisible = true;
    }

    closeClientDialogs(): void {
        this.clientSelectionDialogVisible = false;
        this.newClientDialogVisible = false;
        this.clientSearchResults = [];
        this.clientSearchLoading = false;
        this.clientSearchRequestId += 1;
        if (this.clientSearchTimer) {
            clearTimeout(this.clientSearchTimer);
            this.clientSearchTimer = undefined;
        }
        this.resetNewClientLookup();
    }

    get selectedSolicitudTechnician(): User | null {
        return this.getTechnicianById(
            this.selectedSolicitud?.mechanic_id,
        );
    }

    get filteredTechniciansForSelection(): User[] {
        const query = this.normalizeFilterText(this.technicianSearchQuery);
        if (
            this.technicianSelectionCacheSource === this.availableTechnicians
            && this.technicianSelectionCacheQuery === query
        ) {
            return this.technicianSelectionCache;
        }

        this.technicianSelectionCacheSource = this.availableTechnicians;
        this.technicianSelectionCacheQuery = query;
        this.technicianSelectionCache = this.availableTechnicians
            .filter(technician => {
                if (!query) return true;
                return this.normalizeFilterText([
                    this.getTechnicianName(technician),
                    technician.email,
                    technician.phone,
                    technician.phone2,
                ].filter(Boolean).join(' ')).includes(query);
            })
            .sort((first, second) =>
                this.getTechnicianName(first).localeCompare(
                    this.getTechnicianName(second),
                    'es',
                )
            );
        return this.technicianSelectionCache;
    }

    openTechnicianSelection(): void {
        this.technicianSearchQuery = '';
        this.technicianSelectionDialogVisible = true;
    }

    closeTechnicianSelection(): void {
        this.technicianSelectionDialogVisible = false;
        this.technicianSearchQuery = '';
    }

    selectSolicitudTechnician(technician: User): void {
        if (!this.selectedSolicitud) return;
        const technicianId = String(
            technician._id || (technician as any).id || '',
        ).trim();
        if (!technicianId) return;

        this.selectedSolicitud.mechanic_id = technicianId;
        this.closeTechnicianSelection();
        this.onSelectedTechnicianChange();
    }

    clearSolicitudTechnician(): void {
        if (!this.selectedSolicitud) return;
        this.selectedSolicitud.mechanic_id = undefined;
        this.closeTechnicianSelection();
        this.onSelectedTechnicianChange();
    }

    getTechnicianSelectionPhoto(technician: User | null): string | null {
        const photo = String(technician?.photo || '').trim();
        return photo && !this.failedTechnicianPhotos.has(photo)
            ? photo
            : null;
    }

    getTechnicianSelectionInitials(technician: User | null): string {
        if (!technician) return 'T';
        const words = this.getTechnicianName(technician)
            .split(/\s+/)
            .filter(Boolean);
        return `${words[0]?.[0] || 'T'}${words[1]?.[0] || ''}`.toUpperCase();
    }

    getTechnicianSelectionId(technician: User): string {
        return String(
            technician?._id || (technician as any)?.id || '',
        ).trim();
    }

    onClientSearchQueryChange(): void {
        if (this.clientSearchTimer) {
            clearTimeout(this.clientSearchTimer);
        }
        this.clientSearchTimer = setTimeout(() => {
            this.clientSearchTimer = undefined;
            void this.loadSolicitudClients();
        }, 250);
    }

    async loadSolicitudClients(): Promise<void> {
        const requestId = ++this.clientSearchRequestId;
        this.clientSearchLoading = true;

        try {
            const response = await firstValueFrom(
                this.userService.searchSolicitudClients(
                    this.clientSearchQuery.trim(),
                    0,
                    60
                )
            );
            if (requestId !== this.clientSearchRequestId) return;
            this.clientSearchResults = response.users || [];
            this.clientSearchTotal = response.totalCount || 0;
        } catch {
            if (requestId !== this.clientSearchRequestId) return;
            this.clientSearchResults = [];
            this.clientSearchTotal = 0;
            this.messageService.add({
                severity: 'error',
                summary: 'No se pudieron cargar los clientes',
                detail: 'Verifica tu conexión e inténtalo nuevamente.'
            });
        } finally {
            if (requestId === this.clientSearchRequestId) {
                this.clientSearchLoading = false;
            }
        }
    }

    async selectSolicitudClient(user: User): Promise<void> {
        if (!this.selectedSolicitud) return;

        this.selectedClient = user;
        this.selectedSolicitud.client_id = user._id;
        this.selectedSolicitud.client_name =
            `${user.name || ''} ${user.last_name || ''}`.trim();
        this.selectedSolicitud.client_email = user.email || '';
        this.selectedSolicitud.client_phone = user.phone || user.phone2 || '';
        await this.applySolicitudClientLocation(user);

        this.closeClientDialogs();
        const locationWasApplied = this.hasPrimarySolicitudLocation;
        this.messageService.add({
            severity: 'success',
            summary: 'Cliente seleccionado',
            detail: locationWasApplied
                ? 'La ubicación guardada del cliente fue establecida como ubicación principal de la solicitud.'
                : this.selectedSolicitud.client_name || 'Los datos del cliente fueron aplicados.'
        });
    }

    onNewClientWhatsappChange(): void {
        this.existingNewClientUser = null;
        this.newClientLookupAttempted = false;
        this.newClientLookupLoading = false;
        this.newClientLookupRequestId += 1;

        if (this.newClientLookupTimer) {
            clearTimeout(this.newClientLookupTimer);
            this.newClientLookupTimer = undefined;
        }

        const digits = this.normalizePhoneDigits(this.newClientWhatsapp);
        if (digits.length < 8) return;

        this.newClientLookupTimer = setTimeout(() => {
            this.newClientLookupTimer = undefined;
            void this.lookupNewClientByWhatsapp();
        }, 350);
    }

    async confirmNewClientWhatsapp(): Promise<void> {
        if (!this.selectedSolicitud) return;

        if (this.newClientLookupTimer) {
            clearTimeout(this.newClientLookupTimer);
            this.newClientLookupTimer = undefined;
        }

        const digits = this.normalizePhoneDigits(this.newClientWhatsapp);
        if (digits.length < 8 || digits.length > 15) {
            this.messageService.add({
                severity: 'warn',
                summary: 'WhatsApp no válido',
                detail: 'Ingresa un número de WhatsApp válido, incluyendo el código de país si aplica.'
            });
            return;
        }

        const matchingUser = (
            this.phoneNumbersMatch(this.existingNewClientUser?.phone || '', digits)
            || this.phoneNumbersMatch(this.existingNewClientUser?.phone2 || '', digits)
        )
            ? this.existingNewClientUser
            : await this.lookupNewClientByWhatsapp(true);

        if (matchingUser === undefined) return;
        if (matchingUser) {
            await this.selectSolicitudClient(matchingUser);
            return;
        }

        this.selectedClient = null;
        this.selectedSolicitud.client_id = undefined;
        this.selectedSolicitud.client_name = '';
        this.selectedSolicitud.client_email = '';
        this.selectedSolicitud.client_phone = digits;
        this.clearSolicitudClientLocation();
        this.closeClientDialogs();

        this.messageService.add({
            severity: 'info',
            summary: 'Cliente nuevo',
            detail: 'Cuando el técnico acepte la solicitud, este WhatsApp recibirá los datos del servicio y el enlace de registro.'
        });
    }

    private async lookupNewClientByWhatsapp(showError = false): Promise<User | null | undefined> {
        const digits = this.normalizePhoneDigits(this.newClientWhatsapp);
        if (digits.length < 8 || digits.length > 15) {
            this.existingNewClientUser = null;
            this.newClientLookupAttempted = false;
            return null;
        }

        const requestId = ++this.newClientLookupRequestId;
        this.newClientLookupLoading = true;
        this.newClientLookupAttempted = false;

        try {
            const response = await firstValueFrom(
                this.userService.searchSolicitudClients(digits, 0, 20)
            );
            if (requestId !== this.newClientLookupRequestId) return null;

            const matchingUser = (response.users || []).find((user) =>
                this.phoneNumbersMatch(user.phone || '', digits)
                || this.phoneNumbersMatch(user.phone2 || '', digits)
            ) || null;

            this.existingNewClientUser = matchingUser;
            this.newClientLookupAttempted = true;
            return matchingUser;
        } catch {
            if (requestId !== this.newClientLookupRequestId) return null;
            this.existingNewClientUser = null;
            this.newClientLookupAttempted = false;
            if (showError) {
                this.messageService.add({
                    severity: 'error',
                    summary: 'No se pudo verificar el WhatsApp',
                    detail: 'No se guardó como cliente nuevo. Verifica tu conexión e inténtalo nuevamente.'
                });
            }
            return undefined;
        } finally {
            if (requestId === this.newClientLookupRequestId) {
                this.newClientLookupLoading = false;
            }
        }
    }

    private resetNewClientLookup(): void {
        this.newClientLookupRequestId += 1;
        this.newClientLookupLoading = false;
        this.newClientLookupAttempted = false;
        this.existingNewClientUser = null;
        if (this.newClientLookupTimer) {
            clearTimeout(this.newClientLookupTimer);
            this.newClientLookupTimer = undefined;
        }
    }

    private normalizePhoneDigits(value: unknown): string {
        return String(value || '').replace(/\D/g, '');
    }

    private phoneNumbersMatch(left: unknown, right: unknown): boolean {
        const leftDigits = this.normalizePhoneDigits(left);
        const rightDigits = this.normalizePhoneDigits(right);
        if (!leftDigits || !rightDigits) return false;
        if (leftDigits === rightDigits) return true;
        if (leftDigits.length >= 10 && rightDigits.length >= 10) {
            return leftDigits.slice(-10) === rightDigits.slice(-10);
        }
        return false;
    }

    get selectedSolicitudClientLabel(): string {
        if (!this.selectedSolicitud) return '';
        return String(this.selectedSolicitud.client_name || '').trim()
            || String(this.selectedSolicitud.client_email || '').trim()
            || String(this.selectedSolicitud.client_phone || '').trim();
    }

    get hasSelectedSolicitudClient(): boolean {
        return !!this.selectedSolicitudClientLabel;
    }

    get hasPrimarySolicitudLocation(): boolean {
        if (!this.selectedSolicitud) return false;

        const mainInstallation = this.selectedSolicitud.installations?.[0];
        return this.isValidCoordinatePair(
            Number(this.selectedSolicitud.latitude),
            Number(this.selectedSolicitud.longitude),
        )
            || !!String(
                this.selectedSolicitud.google_maps_url
                || mainInstallation?.google_maps_url
                || this.selectedSolicitud.location_address
                || mainInstallation?.location_address
                || mainInstallation?.installation_location
                || this.selectedSolicitud.sector
                || this.selectedSolicitud.municipality
                || this.selectedSolicitud.province
                || '',
            ).trim();
    }

    private async applySolicitudClientLocation(user: User): Promise<void> {
        if (!this.selectedSolicitud) return;

        this.clearSolicitudClientLocation();
        const province = String(user.province || '').trim();
        const municipality = String(user.municipality || '').trim();
        const sector = String(user.sector || '').trim();
        const address = String(user.static_location_address || '').trim();
        const mapsUrl = String(user.static_location_url || '').trim();
        const normalizedMapsUrl = mapsUrl
            ? this.normalizeGoogleMapsUrl(mapsUrl) || mapsUrl
            : '';
        const latitude = Number(user.static_latitude);
        const longitude = Number(user.static_longitude);
        const hasCoordinates = this.isValidCoordinatePair(latitude, longitude);

        this.selectedSolicitud.province = province;
        this.selectedSolicitud.municipality = municipality;
        this.selectedSolicitud.sector = sector;
        this.selectedSolicitud.latitude = hasCoordinates ? latitude : undefined;
        this.selectedSolicitud.longitude = hasCoordinates ? longitude : undefined;
        this.selectedSolicitud.google_maps_url = normalizedMapsUrl || undefined;
        this.selectedSolicitud.location_address = address || undefined;
        this.rootGoogleMapsLink = normalizedMapsUrl;
        this.selectedSolicitud.installations?.forEach(installation => {
            installation.province = province;
            installation.municipality = municipality;
            installation.sector = sector;
            installation.latitude = hasCoordinates ? latitude : undefined;
            installation.longitude = hasCoordinates ? longitude : undefined;
            installation.google_maps_url = normalizedMapsUrl || undefined;
            installation.location_address = address || undefined;
        });

        if (province) {
            try {
                const municipalities = await this.vehicleBrandsService.getMunicipalities(province);
                this.rootAvailableMunicipalities = municipalities.map((item: any) => ({
                    label: item.name,
                    value: String(item.code)
                }));
            } catch {
                this.rootAvailableMunicipalities = [];
            }
        }

        if (province && municipality) {
            try {
                const sectors = await this.vehicleBrandsService.getSectors(municipality, province);
                this.rootAvailableSectors = sectors.map((item: any) => ({
                    label: item.name,
                    value: String(item.code)
                }));
            } catch {
                this.rootAvailableSectors = [];
            }
        }

        if (hasCoordinates) {
            this.onRootLatitudeLongitudeChange();
        } else {
            void this.refreshTechnicianRecommendation();
        }
    }

    private clearSolicitudClientLocation(): void {
        if (!this.selectedSolicitud) return;

        this.rootGoogleMapsLink = '';
        this.rootAvailableMunicipalities = [];
        this.rootAvailableSectors = [];
        this.selectedSolicitud.province = '';
        this.selectedSolicitud.municipality = '';
        this.selectedSolicitud.sector = '';
        this.selectedSolicitud.latitude = undefined;
        this.selectedSolicitud.longitude = undefined;
        this.selectedSolicitud.google_maps_url = undefined;
        this.selectedSolicitud.location_address = undefined;
        this.selectedSolicitud.installations?.forEach(installation => {
            installation.province = '';
            installation.municipality = '';
            installation.sector = '';
            installation.latitude = undefined;
            installation.longitude = undefined;
            installation.google_maps_url = undefined;
            installation.location_address = undefined;
        });
        this.rootLocationMarker?.remove?.();
        this.rootLocationMarker = null;
        void this.refreshTechnicianRecommendation();
    }

    private getPrimarySolicitudLocationDefaults(): Partial<InstallationDetail> {
        if (!this.selectedSolicitud) return {};

        const mainInstallation = this.selectedSolicitud.installations?.[0];
        return {
            province: this.selectedSolicitud.province || undefined,
            municipality: this.selectedSolicitud.municipality || undefined,
            sector: this.selectedSolicitud.sector || undefined,
            latitude: this.selectedSolicitud.latitude,
            longitude: this.selectedSolicitud.longitude,
            google_maps_url:
                this.selectedSolicitud.google_maps_url || undefined,
            location_address:
                this.selectedSolicitud.location_address
                || mainInstallation?.location_address
                || undefined,
        };
    }

    searchClientEmails(event: { query: string }): void {
        const query = (event.query || '').trim();
        const parentId = this.solicitudAutocompleteUserId;

        if (!query || query.length < 2 || !parentId) {
            this.clientEmailSuggestions = [];
            return;
        }

        this.userService.search(query, parentId, 0, 12).subscribe({
            next: (response) => {
                this.clientEmailSuggestions = (response.users || [])
                    .filter(user => !!user.email);
            },
            error: () => {
                this.clientEmailSuggestions = [];
            }
        });
    }

    onClientEmailSelect(event: { value: User | string }): void {
        const user = typeof event.value === 'string'
            ? this.clientEmailSuggestions.find(item => item.email === event.value)
            : event.value;
        if (!this.selectedSolicitud || !user) return;

        this.selectedSolicitud.client_email = user.email || '';
        this.selectedSolicitud.client_name = `${user.name || ''} ${user.last_name || ''}`.trim() || this.selectedSolicitud.client_name;
        if (user.phone) {
            this.selectedSolicitud.client_phone = user.phone;
        }
    }

    selectFirstClientEmail(event?: Event): void {
        const user = this.clientEmailSuggestions[0];
        if (!user) return;
        event?.preventDefault();
        event?.stopPropagation();
        this.onClientEmailSelect({ value: user });
    }

    async searchInventoryDevices(event: { query: string }, target: 'current' | 'new' = 'current'): Promise<void> {
        const activeSolicitudType = this.selectedSolicitud?.type || this.solicitudToInstall?.type;
        const query = (event.query || '').trim();
        if (!query || query.length < 2) {
            this.inventoryDeviceSuggestions = [];
            return;
        }

        const status = target === 'new'
            ? 'available'
            : ['instalacion', 'reinstalacion'].includes(activeSolicitudType || '')
            ? 'available'
            : ['chequeo', 'desinstalacion', 'cambio'].includes(activeSolicitudType || '')
                ? 'installed'
                : undefined;

        try {
            const [inventoryResult, targetsResult] = await Promise.allSettled([
                firstValueFrom(this.inventoryService.searchAllDevices(
                    query,
                    undefined,
                    1,
                    12,
                    status,
                    this.solicitudAutocompleteUserId
                )),
                this.targetsService.searchTargets(query, this.solicitudAutocompleteUserId, 0, 12)
            ]);

            const inventoryDevices = inventoryResult.status === 'fulfilled'
                ? (inventoryResult.value.data || [])
                : [];
            const targetDevices = targetsResult.status === 'fulfilled'
                ? (targetsResult.value.devices || [])
                : [];

            this.inventoryDeviceSuggestions = this.mergeDeviceSuggestions(inventoryDevices, targetDevices);
        } catch {
            this.inventoryDeviceSuggestions = [];
        }
    }

    onInventoryDeviceSelect(event: { value: InventoryItem | string }, index?: number, target: 'current' | 'new' = 'current'): void {
        const device = typeof event.value === 'string'
            ? this.inventoryDeviceSuggestions.find(item => this.getInventoryDeviceImei(item) === event.value)
            : event.value;
        if (!device) return;

        const imei = this.getInventoryDeviceImei(device);
        const sim = this.getInventoryDeviceSim(device);
        const protocolId = this.getInventoryDeviceProtocolId(device);

        if (typeof index === 'number' && this.selectedSolicitud?.installations?.[index]) {
            const inst = this.selectedSolicitud.installations[index];
            if (target === 'new') {
                inst.new_device_imei = imei;
                if (sim) {
                    inst.new_sim_card_number = sim;
                }
                if (protocolId) {
                    inst.new_protocol = protocolId;
                }
                return;
            }
            inst.device_imei = imei;
            if (sim) {
                inst.sim_card_number = sim;
            }
            return;
        }

        this.installData.device_imei = imei;
        if (sim) {
            this.installData.sim_card_number = sim;
        }
        if (protocolId) {
            this.installData.type = protocolId;
        }
    }

    selectFirstInventoryDevice(event?: Event, index?: number, target: 'current' | 'new' = 'current'): void {
        const device = this.inventoryDeviceSuggestions[0];
        if (!device) return;
        event?.preventDefault();
        event?.stopPropagation();
        this.onInventoryDeviceSelect({ value: device }, index, target);
    }

    private mergeDeviceSuggestions(inventoryDevices: any[], targetDevices: any[]): any[] {
        const seen = new Set<string>();
        return [...inventoryDevices, ...targetDevices].filter(device => {
            const imei = this.getInventoryDeviceImei(device);
            if (!imei || seen.has(imei)) return false;
            seen.add(imei);
            return true;
        });
    }

    getInventoryDeviceImei(device: any): string {
        return device?.IMEI || device?.imei || device?.device_imei || device?.name || '';
    }

    getInventoryDeviceSim(device: any): string {
        return device?.SIM || device?.sim || device?.sim_card_number || '';
    }

    getInventoryDeviceProtocolName(device: any): string {
        const protocol = device?.Protocol || device?.protocol || device?.type;
        if (typeof protocol === 'object' && protocol) {
            return protocol.name || protocol.label || this.getProtocolNameById(protocol._id || protocol.id) || '';
        }
        return this.getProtocolNameById(protocol) || (this.isMongoObjectId(protocol) ? '' : (protocol || ''));
    }

    private getInventoryDeviceProtocolId(device: any): string {
        const protocol = device?.Protocol || device?.protocol || device?.type;
        if (typeof protocol === 'object' && protocol) {
            return protocol._id || protocol.id || '';
        }
        return protocol || '';
    }

    private getProtocolNameById(protocolId?: string): string {
        if (!protocolId) return '';
        return this.availableProtocols.find(protocol => protocol._id === protocolId)?.name || '';
    }

    private isMongoObjectId(value?: string): boolean {
        return typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
    }

    async onClientPhoneBlur(): Promise<void> {
        if (!this.selectedSolicitud) return;
        const phone = this.selectedSolicitud.client_phone?.trim();
        if (!phone) return;

        try {
            const user = await this.userService.getByPhone(phone).toPromise();
            if (user) {
                this.selectedSolicitud.client_name = `${user.name || ''} ${user.last_name || ''}`.trim() || this.selectedSolicitud.client_name;
                if (user.email) {
                    this.selectedSolicitud.client_email = user.email;
                }
            }
        } catch (error) {
            // Se ignora si no existe
        }
    }

    async onImeiBlur(index: number): Promise<void> {
        await this.lookupExistingGpsTarget(index, true);
    }

    private async lookupExistingGpsTarget(index: number, showFoundToast = false): Promise<void> {
        if (!this.selectedSolicitud || !this.selectedSolicitud.installations || !this.selectedSolicitud.installations[index]) return;

        const inst = this.selectedSolicitud.installations[index];
        const imei = inst.device_imei?.trim();
        if (!imei) {
            delete this.existingGpsTargetByInstallation[index];
            return;
        }

        this.checkingExistingGpsTargetByInstallation[index] = true;
        try {
            // Buscamos si existe con los permisos de targets
            const result = await this.targetsService.searchTargets(imei, this.solicitudAutocompleteUserId, 0, 10);
            if (result && result.devices && result.devices.length > 0) {
                // Find exact match by IMEI or Name
                const exactMatch: any = result.devices.find((d: any) => d.device_imei === imei || d.name === imei) || result.devices[0];
                
                if (exactMatch) {
                    this.existingGpsTargetByInstallation[index] = exactMatch;
                    inst.brand = exactMatch.target_brand_id || exactMatch.brand || inst.brand;
                    // Prepare model lookup if brand is found
                    if (inst.brand) {
                        try {
                            const models = await this.vehicleBrandsService.getAllModelsByBrand(inst.brand);
                            this.availableModels = models.map((m: any) => ({ label: m.nombre, value: m._id })).sort((a: any, b: any) => a.label.localeCompare(b.label));
                        } catch(e) {}
                    }
                    inst.model = exactMatch.target_model_id || exactMatch.model || inst.model;
                    inst.year = exactMatch.target_year?.toString() || exactMatch.year?.toString() || inst.year;
                    
                    const colorVal = exactMatch.target_color || exactMatch.color;
                    if (colorVal) {
                        inst.color = colorVal;
                        const foundColor = this.availableColors.find(c => c.value === colorVal);
                        if (foundColor) {
                            this._displayColorName = foundColor.label;
                            this.filteredColors = [foundColor];
                        } else {
                            this._displayColorName = colorVal;
                        }
                    }
                    
                    inst.plate = exactMatch.target_plate_number || exactMatch.plate || inst.plate;
                    inst.chassis = exactMatch.target_chassis_number || exactMatch.chassis || inst.chassis;
                    inst.sim_card_number = exactMatch.sim_card_number || inst.sim_card_number;
                    inst.sim_company = exactMatch.sim_company || inst.sim_company;
                    
                    // Show message
                    if (showFoundToast) {
                        this.messageService.add({ severity: 'success', summary: 'Vehículo Encontrado', detail: 'Datos autocompletados desde el dispositivo.' });
                    }
                    return;
                }
            }
            delete this.existingGpsTargetByInstallation[index];
        } catch (error) {
            // Ignorar silenciosamente si no se encuentra o falla la red
            delete this.existingGpsTargetByInstallation[index];
        } finally {
            this.checkingExistingGpsTargetByInstallation[index] = false;
        }
    }

    hasExistingGpsTarget(index: number): boolean {
        return !!this.existingGpsTargetByInstallation[index];
    }

    getExistingGpsTarget(index: number): any | null {
        return this.existingGpsTargetByInstallation[index] || null;
    }

    goToGpsFromInstallation(index: number, event?: MouseEvent): void {
        const target = this.getExistingGpsTarget(index);
        const inst = this.selectedSolicitud?.installations?.[index];
        const imei = String(target?.device_imei || inst?.device_imei || '').trim();
        const parentId = String(target?.parent_id || target?.user_id || this.selectedSolicitud?.user_id || '').trim();

        if (!imei || !parentId) {
            this.messageService.add({
                severity: 'warn',
                summary: 'No se puede abrir',
                detail: 'No se encontró la cuenta donde está registrado ese GPS.'
            });
            return;
        }

        this.installationModalVisible = false;
        this.dialogVisible = false;
        const url = `/admin/management/t/${parentId}?search=${encodeURIComponent(imei)}`;
        if (event?.ctrlKey || event?.metaKey) {
            window.open(url, '_blank');
            return;
        }
        this.router.navigate(['/admin/management', 't', parentId], { queryParams: { search: imei } });
    }

    async initRootLocationMap(): Promise<void> {
        try {
            const mapElement = document.getElementById('map-container-root');
            if (!mapElement) return;

            this.rootLocationMarker?.remove?.();
            this.rootLocationMap?.remove?.();
            this.rootLocationMap = MapUtils.createMap(
                'osm', mapElement, '', 'light', 18.4861, -69.9312, 13
            );

            this.rootLocationMap.on('click', (event: maplibregl.MapMouseEvent) => {
                const lat = event.lngLat.lat;
                const lng = event.lngLat.lng;
                if (this.selectedSolicitud) {
                    this.selectedSolicitud.latitude = parseFloat(lat.toFixed(6));
                    this.selectedSolicitud.longitude = parseFloat(lng.toFixed(6));
                }
                this.updateRootLocationMarker(lat, lng);
                this.onRootLatitudeLongitudeChange();
            });

            if (this.selectedSolicitud?.latitude && this.selectedSolicitud?.longitude) {
                this.updateRootLocationMarker(this.selectedSolicitud.latitude, this.selectedSolicitud.longitude);
                this.rootLocationMap.setCenter([this.selectedSolicitud.longitude, this.selectedSolicitud.latitude]);
                this.rootLocationMap.setZoom(15);
            }
        } catch (error) {
            console.error('Error loading root location map:', error);
        }
    }

    updateRootLocationMarker(lat: number, lng: number): void {
        this.rootLocationMarker?.remove?.();
        if (this.rootLocationMap) {
            this.rootLocationMarker = new maplibregl.Marker({ color: '#ef4444' })
                .setLngLat([lng, lat])
                .addTo(this.rootLocationMap);
        }
    }

    applyRootGoogleMapsLink(): void {
        this.syncRootGoogleMapsLink(true);
    }

    private syncRootGoogleMapsLink(showFeedback = false): boolean {
        if (!this.selectedSolicitud) return false;

        const raw = String(this.rootGoogleMapsLink || '').trim();
        if (!raw) {
            this.selectedSolicitud.google_maps_url = undefined;
            this.selectedSolicitud.installations?.forEach(installation => {
                installation.google_maps_url = undefined;
            });
            if (showFeedback) {
                this.messageService.add({
                    severity: 'warn',
                    summary: 'Link requerido',
                    detail: 'Pega un link de Google Maps antes de aplicarlo.'
                });
            }
            return !showFeedback;
        }

        const googleMapsUrl = this.normalizeGoogleMapsUrl(raw);
        if (!googleMapsUrl) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Link no válido',
                detail: 'Debe ser un link válido de Google Maps.'
            });
            return false;
        }

        this.rootGoogleMapsLink = googleMapsUrl;
        this.selectedSolicitud.google_maps_url = googleMapsUrl;
        this.selectedSolicitud.installations?.forEach(installation => {
            installation.google_maps_url = googleMapsUrl;
        });

        const coords = this.extractCoordinatesFromGoogleMapsLink(googleMapsUrl);
        if (!coords) {
            this.selectedSolicitud.latitude = undefined;
            this.selectedSolicitud.longitude = undefined;
            this.selectedSolicitud.installations?.forEach(installation => {
                installation.latitude = undefined;
                installation.longitude = undefined;
            });
            this.rootLocationMarker?.remove?.();
            this.rootLocationMarker = null;

            if (showFeedback) {
                this.messageService.add({
                    severity: 'success',
                    summary: 'Link guardado',
                    detail: 'El enlace se conservará para abrirlo directamente en Google Maps.'
                });
            }
            void this.refreshTechnicianRecommendation();
            return true;
        }

        this.selectedSolicitud.latitude = coords.lat;
        this.selectedSolicitud.longitude = coords.lng;
        this.onRootLatitudeLongitudeChange();

        if (this.rootLocationMap) {
            this.rootLocationMap.panTo([coords.lng, coords.lat]);
            this.rootLocationMap.setZoom(17);
        }

        if (showFeedback) {
            this.messageService.add({
                severity: 'success',
                summary: 'Ubicación aplicada',
                detail: 'La ubicación exacta fue tomada desde el link de Google Maps.'
            });
        }
        return true;
    }

    private normalizeGoogleMapsUrl(value: string): string | null {
        try {
            const parsed = new URL(String(value || '').trim());
            if (!['http:', 'https:'].includes(parsed.protocol)) return null;

            const hostname = parsed.hostname.toLowerCase();
            const pathname = parsed.pathname.toLowerCase();
            const isMapsShortLink = hostname === 'maps.app.goo.gl'
                || (hostname === 'goo.gl' && pathname.startsWith('/maps'));
            const isGoogleMapsHost = hostname.startsWith('maps.google.')
                || (
                    (hostname === 'google.com'
                        || hostname === 'www.google.com'
                        || hostname.startsWith('www.google.'))
                    && pathname.startsWith('/maps')
                );

            return isMapsShortLink || isGoogleMapsHost ? parsed.toString() : null;
        } catch {
            return null;
        }
    }

    private extractCoordinatesFromGoogleMapsLink(value: string): { lat: number; lng: number } | null {
        const raw = String(value || '').trim();
        if (!raw) return null;

        const patterns = [
            /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
            /[?&](?:q|query|ll|center)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
            /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
            /(?:^|[^\d.-])(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)(?:$|[^\d.-])/,
        ];

        for (const pattern of patterns) {
            const match = raw.match(pattern);
            if (!match) continue;

            const lat = Number(match[1]);
            const lng = Number(match[2]);
            if (this.isValidCoordinatePair(lat, lng)) {
                return {
                    lat: Number(lat.toFixed(6)),
                    lng: Number(lng.toFixed(6)),
                };
            }
        }

        return null;
    }

    private isValidCoordinatePair(lat: number, lng: number): boolean {
        return Number.isFinite(lat)
            && Number.isFinite(lng)
            && lat >= -90
            && lat <= 90
            && lng >= -180
            && lng <= 180;
    }

    async geocodeRootLocation(address: string, zoomLevel: number): Promise<void> {
        if (!this.rootLocationMap) return;
        if (typeof google === 'undefined' || !google.maps?.Geocoder) {
            await this.initializeSolicitudLocationPlaces();
        }
        if (typeof google === 'undefined' || !google.maps?.Geocoder) return;

        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: address + ', República Dominicana' }, (results: any, status: any) => {
            if (status === 'OK' && results && results[0]) {
                const location = results[0].geometry.location;
                // Move map
                this.rootLocationMap.panTo([location.lng(), location.lat()]);
                this.rootLocationMap.setZoom(zoomLevel);
            } else {
                console.warn('Geocoding failed for: ', address, 'Status: ', status);
            }
        });
    }

    focusRootMapOnSelection(level: 'province' | 'municipality' | 'sector') {
        if (!this.selectedSolicitud) return;
        let address = '';
        let zoom = 12;

        const pVal = this.selectedSolicitud.province;
        const mVal = this.selectedSolicitud.municipality;
        const sVal = this.selectedSolicitud.sector;

        const prov = this.availableProvinces.find(p => p.value === pVal);
        const mun = this.rootAvailableMunicipalities.find(m => m.value === mVal);
        const sec = this.rootAvailableSectors?.find(s => s.value === sVal);

        switch (level) {
            case 'province':
                if (prov) address = prov.label;
                zoom = 10;
                break;
            case 'municipality':
                if (prov && mun) address = `${mun.label}, ${prov.label}`;
                zoom = 12;
                break;
            case 'sector':
                if (prov && mun && sec) address = `${sec.label}, ${mun.label}, ${prov.label}`;
                zoom = 15;
                break;
        }

        if (address) {
            this.geocodeRootLocation(address, zoom);
        }
    }

    onRootProvinceChange(): void {
        if (!this.selectedSolicitud) return;
        const val = this.selectedSolicitud.province;
        if (this.selectedSolicitud.installations) {
            this.selectedSolicitud.installations.forEach(i => i.province = val);
        }
        this.selectedSolicitud.municipality = '';
        this.selectedSolicitud.sector = '';
        if (val) {
            this.vehicleBrandsService.getMunicipalities(val).then((data: any) => {
                this.rootAvailableMunicipalities = data.map((m: any) => ({ label: m.name, value: String(m.code) }));
                this.focusRootMapOnSelection('province');
            });
        } else {
            this.rootAvailableMunicipalities = [];
            this.rootAvailableSectors = [];
        }
    }

    onRootMunicipalityChange(): void {
        if (!this.selectedSolicitud) return;
        const pVal = this.selectedSolicitud.province;
        const mVal = this.selectedSolicitud.municipality;
        if (this.selectedSolicitud.installations) {
            this.selectedSolicitud.installations.forEach(i => i.municipality = mVal);
        }
        this.selectedSolicitud.sector = '';
        if (pVal && mVal) {
            this.vehicleBrandsService.getSectors(pVal, mVal).then((data: any) => {
                this.rootAvailableSectors = data.map((s: any) => ({ label: s.name, value: String(s.code) }));
                this.focusRootMapOnSelection('municipality');
            });
        } else {
            this.rootAvailableSectors = [];
        }
    }

    onRootSectorChange(): void {
        if (!this.selectedSolicitud) return;
        const val = this.selectedSolicitud.sector;
        if (this.selectedSolicitud.installations) {
            this.selectedSolicitud.installations.forEach(i => i.sector = val);
        }
        if (val) {
            this.focusRootMapOnSelection('sector');
        }
    }

    onRootLatitudeLongitudeChange(): void {
        if (!this.selectedSolicitud) return;
        const lat = Number(this.selectedSolicitud.latitude);
        const lng = Number(this.selectedSolicitud.longitude);
        if (!this.isValidCoordinatePair(lat, lng)) return;

        this.selectedSolicitud.latitude = Number(lat.toFixed(6));
        this.selectedSolicitud.longitude = Number(lng.toFixed(6));
        if (this.selectedSolicitud.installations) {
            this.selectedSolicitud.installations.forEach(i => {
                i.latitude = this.selectedSolicitud?.latitude;
                i.longitude = this.selectedSolicitud?.longitude;
            });
        }
        this.updateRootLocationMarker(lat, lng);
        if (this.rootLocationMap) {
            this.rootLocationMap.panTo([lng, lat]);
        }
        void this.refreshTechnicianRecommendation();
    }
async initLocationMap(): Promise<void> {
        try {
            const mapElement = document.getElementById(`solLocationMap-${this.editingInstallationIndex}`);
            if (!mapElement) {
                setTimeout(() => this.initLocationMap(), 200); // Retry resolving DOM node
                return;
            }
            
            if (mapElement) {
                let lat = 18.483;
                let lng = -69.932;
                let zoom = 12;

                const currentInst = this.selectedSolicitud?.installations?.[this.editingInstallationIndex];
                if (currentInst?.latitude && currentInst?.longitude) {
                    lat = Number(currentInst.latitude);
                    lng = Number(currentInst.longitude);
                    zoom = 16;
                }

                this.locationMarker?.remove?.();
                this.locationMap?.remove?.();
                this.locationMap = MapUtils.createMap('osm', mapElement, '', 'light', lat, lng, zoom);

                if (currentInst?.latitude && currentInst?.longitude) {
                    this.locationMarker = new maplibregl.Marker({ color: '#ef4444' })
                        .setLngLat([lng, lat])
                        .addTo(this.locationMap);
                }

                this.locationMap.on('click', (event: maplibregl.MapMouseEvent) => {
                    const clickLat = event.lngLat.lat;
                    const clickLng = event.lngLat.lng;
                    
                    if(this.selectedSolicitud?.installations?.[this.editingInstallationIndex]) {
                        this.selectedSolicitud.installations[this.editingInstallationIndex].latitude = clickLat;
                        this.selectedSolicitud.installations[this.editingInstallationIndex].longitude = clickLng;
                    }

                    if (this.locationMarker) {
                        this.locationMarker.setLngLat([clickLng, clickLat]);
                    } else {
                        this.locationMarker = new maplibregl.Marker({ color: '#ef4444' })
                            .setLngLat([clickLng, clickLat])
                            .addTo(this.locationMap);
                    }
                });
            }
        } catch (error) {
            console.error('Error inicializando el mapa:', error);
        }
    }

    async editSolicitud(solicitud: Solicitud): Promise<void> {
        if (this.initialDataPromise) await this.initialDataPromise;

        if (this.isSolicitudClosed(solicitud)) {
            this.closedSolicitud = {
                ...solicitud,
                installations: solicitud.installations?.map(installation => ({ ...installation })) || [],
            };
            this.closedSolicitudLocation = this.getClosedLocationFallback(this.closedSolicitud);
            this.closedInfoDialogVisible = true;
            void this.resolveClosedSolicitudLocation(this.closedSolicitud);
            return;
        }

        this.rootAvailableMunicipalities = [];
        this.rootAvailableSectors = [];
        
        this.selectedSolicitud = { ...solicitud, installations: solicitud.installations ? solicitud.installations.map(i => ({ ...i })) : [] };
        this.selectedClient = null;
        this.closeClientDialogs();
        this.closeTechnicianSelection();
        this.selectedSolicitudOriginalStatus = solicitud.status;
        this.resetTechnicianScheduleValidation();
        this.resetTechnicianRecommendation();
        this.rootGoogleMapsLink = this.selectedSolicitud.google_maps_url
            || this.selectedSolicitud.installations?.[0]?.google_maps_url
            || '';
        this.deinstallationReasonError = false;
        this.selectedSolicitud.scheduled_date = this.toDateTimeLocalValue(
            this.selectedSolicitud.scheduled_date || this.selectedSolicitud.installations?.[0]?.scheduled_date
        );
        
        const qty = this.selectedSolicitud.quantity || 1;
        while (this.selectedSolicitud.installations!.length < qty) {
            this.selectedSolicitud.installations!.push({});
        }
        this.isEditMode = true;
        
        this.showRootLocationData = false;
        this.showRootDetailsData = false;
        this.showInstallationsCards = false;
        
        this.rootLocationMap = null;
        this.locationMap = null;

        this.dialogVisible = true;

        if (this.selectedSolicitud.province) {
            const savedM = this.selectedSolicitud.municipality;
            this.vehicleBrandsService.getMunicipalities(this.selectedSolicitud.province).then((data: any) => {
                this.rootAvailableMunicipalities = data.map((m: any) => ({ label: m.name, value: String(m.code) }));
                setTimeout(() => { if (this.selectedSolicitud) this.selectedSolicitud.municipality = savedM; }, 0);
            });
        }
        if (this.selectedSolicitud.province && this.selectedSolicitud.municipality) {
            const savedS = this.selectedSolicitud.sector;
            this.vehicleBrandsService.getSectors(this.selectedSolicitud.municipality, this.selectedSolicitud.province).then((data: any) => {
                this.rootAvailableSectors = data.map((s: any) => ({ label: s.name, value: String(s.code) }));
                setTimeout(() => { if (this.selectedSolicitud) this.selectedSolicitud.sector = savedS; }, 0);
            });
        }

        this.openInstallationModal(0, false);
        void this.refreshTechnicianRecommendation();
    }

    closeClosedSolicitudInfo(): void {
        this.closedInfoDialogVisible = false;
        this.closedSolicitud = null;
        this.closedSolicitudLocation = '';
    }

    openKanbanProcessDetails(
        solicitud: Solicitud,
        installation: InstallationDetail,
        index: number,
        event?: Event,
    ): void {
        event?.stopPropagation();
        event?.preventDefault();
        this.processDetailsSolicitud = solicitud;
        this.processDetailsInstallation = installation;
        this.processDetailsIndex = index;
        this.processDetailsDevice = null;
        this.processDetailsTimeline = this.getProcessTechnicianTimeline(solicitud, installation, index);
        this.processDetailsDialogVisible = true;
        void this.loadProcessDetailsDevice(solicitud, installation, index);
    }

    closeKanbanProcessDetails(): void {
        this.processDetailsDeviceRequestId += 1;
        this.processDetailsDialogVisible = false;
        this.processDetailsSolicitud = null;
        this.processDetailsInstallation = null;
        this.processDetailsIndex = 0;
        this.processDetailsDevice = null;
        this.processDetailsDeviceLoading = false;
        this.processDetailsDeviceError = '';
        this.processDetailsTimeline = [];
    }

    private async loadProcessDetailsDevice(
        solicitud: Solicitud,
        installation: InstallationDetail,
        index: number,
    ): Promise<void> {
        const requestId = ++this.processDetailsDeviceRequestId;
        this.processDetailsDevice = null;
        this.processDetailsDeviceError = '';

        const imei = this.getProcessDetailsDeviceImei(solicitud, installation, index);
        const getTargetByImei = (this.targetsService as any)?.getTargetByImei;
        if (!imei || typeof getTargetByImei !== 'function') {
            this.processDetailsDeviceLoading = false;
            return;
        }

        this.processDetailsDeviceLoading = true;
        try {
            const device = await getTargetByImei.call(this.targetsService, imei);
            if (requestId !== this.processDetailsDeviceRequestId) return;
            this.processDetailsDevice = device;
        } catch {
            if (requestId !== this.processDetailsDeviceRequestId) return;
            this.processDetailsDeviceError = 'No se pudieron consultar las evidencias guardadas en el dispositivo.';
        } finally {
            if (requestId === this.processDetailsDeviceRequestId) {
                this.processDetailsDeviceLoading = false;
                this.processDetailsTimeline = this.getProcessTechnicianTimeline(solicitud, installation, index);
            }
        }
    }

    getProcessDetailsDeviceImei(
        solicitud: Solicitud,
        installation: InstallationDetail,
        index: number,
    ): string {
        const gpsChange = this.getGpsChangeInstallation(solicitud, installation, index);
        return String(
            gpsChange?.new_device_imei
            || installation.checkup_recovery?.replacement_device_imei
            || installation.new_device_imei
            || installation.device_imei
            || '',
        ).trim();
    }

    getProcessDeviceEvidence(device: any = this.processDetailsDevice): ProcessDeviceEvidence[] {
        if (!device) return [];

        const fields: Array<[string, string]> = [
            ['chasis_img', 'Foto del chasis'],
            ['placa_img', 'Foto de la placa'],
            ['matricula_instalacion_img', 'Matrícula o carta de ruta'],
            ['lugar_instalacion_antes_img', 'Lugar de instalación antes'],
            ['vehiculo_exterior_antes_img', 'Exterior del vehículo antes'],
            ['vehiculo_interior_antes_img', 'Interior del vehículo antes'],
            ['gps_numeracion_img', 'Numeración del GPS'],
            ['simcard_numeracion_img', 'Numeración de la SIM'],
            ['lugar_instalacion_despues_img', 'Lugar de instalación después'],
            ['vehiculo_exterior_despues_img', 'Exterior del vehículo después'],
            ['vehiculo_interior_despues_img', 'Interior del vehículo después'],
        ];

        return fields.flatMap(([field, fallbackLabel]) => {
            const evidence = device[field];
            const url = typeof evidence === 'string' ? evidence : evidence?.url;
            if (!url) return [];
            return [{
                label: evidence?.label || fallbackLabel,
                url,
                uploadedAt: evidence?.uploaded_at,
            }];
        });
    }

    getProcessActivationSteps(device: any = this.processDetailsDevice): ProcessActivationStep[] {
        return Array.isArray(device?.activation_status?.steps)
            ? device.activation_status.steps
            : [];
    }

    getProcessActivationLogs(device: any = this.processDetailsDevice): ProcessActivationLog[] {
        return Array.isArray(device?.activation_status?.logs)
            ? device.activation_status.logs
            : [];
    }

    getProcessActivationStatusLabel(device: any = this.processDetailsDevice): string {
        const activation = device?.activation_status;
        if (!activation) return '';
        if (activation.cancelled) return 'Activación cancelada';
        if (activation.completed) return 'Activación completada';
        return 'Activación en proceso';
    }

    getCheckupResolutionLabel(value?: string): string {
        const labels: Record<string, string> = {
            sin_cambio: 'Restablecido sin reemplazar componentes',
            corregir_conexion: 'Conexión o alimentación corregida',
            cambio_simcard: 'SIM card reemplazada',
            cambio_gps: 'GPS reemplazado',
            requiere_seguimiento: 'Requiere seguimiento',
        };
        return value ? (labels[value] || value) : '';
    }

    getConnectionStatusLabel(value?: string): string {
        const labels: Record<string, string> = {
            bien_conectado: 'Bien conectado',
            mal_conectado: 'Mal conectado',
        };
        return value ? (labels[value] || value) : '';
    }

    getRecoveryStepLabel(value?: string): string {
        const labels: Record<string, string> = {
            connection: 'Conexión del GPS',
            power: 'Alimentación eléctrica',
            sim: 'Cambio de SIM card',
            gps: 'Cambio de GPS',
        };
        return value ? (labels[value] || value) : '';
    }

    hasCheckupRecoveryDetails(installation: InstallationDetail): boolean {
        const recovery = installation.checkup_recovery;
        return !!recovery && (
            recovery.connection_checked === true
            || recovery.power_checked === true
            || recovery.sim_replacement_attempted === true
            || recovery.gps_replacement_attempted === true
            || recovery.online_confirmed === true
            || !!recovery.last_online_check_step
        );
    }

    getInstallationFinalDeviceState(installation?: InstallationDetail | null): 'online' | 'offline' | 'unknown' {
        if (installation?.final_device_online === true) return 'online';
        if (installation?.final_device_online === false) return 'offline';

        const rawStatus = String(installation?.final_device_status || '').trim().toLowerCase();
        if (rawStatus) {
            return ['online', 'señal débil', 'localizado'].includes(rawStatus) ? 'online' : 'offline';
        }

        if (installation?.checkup_recovery?.online_confirmed === true) return 'online';
        return 'unknown';
    }

    getInstallationFinalDeviceStatusLabel(installation?: InstallationDetail | null): string {
        const state = this.getInstallationFinalDeviceState(installation);
        if (state === 'online') return 'En línea al finalizar';
        if (state === 'offline') return 'Fuera de línea al finalizar';
        return '';
    }

    hasInstallationFinalDeviceStatus(installation?: InstallationDetail | null): boolean {
        return this.getInstallationFinalDeviceState(installation) !== 'unknown';
    }

    getInstallationFinalDeviceStatusIcon(installation?: InstallationDetail | null): string {
        const state = this.getInstallationFinalDeviceState(installation);
        if (state === 'online') return 'pi pi-wifi';
        if (state === 'offline') return 'pi pi-ban';
        return 'pi pi-question-circle';
    }

    getTechnicianResponseLabel(value?: string): string {
        const labels: Record<string, string> = {
            pendiente: 'Pendiente de respuesta',
            verificando: 'Verificando disponibilidad',
            aceptada: 'Aceptada por el técnico',
            rechazada: 'Rechazada por el técnico',
        };
        return value ? (labels[value] || value) : '';
    }

    getProcessTechnicianTimeline(
        solicitud: Solicitud,
        installation: InstallationDetail,
        index: number,
    ): ProcessTechnicianTimelineItem[] {
        const items: ProcessTechnicianTimelineItem[] = [];
        const processType = this.getProcessTypeForSolicitud(solicitud, installation);
        const processLabel = this.typeLabels[processType] || processType || 'Proceso';
        const technician = this.getTechnicianDisplayName(solicitud);
        const gpsChange = this.getGpsChangeInstallation(solicitud, installation, index);
        const recovery = installation.checkup_recovery;
        const deviceEvidence = this.getProcessDeviceEvidence();
        const activationSteps = this.getProcessActivationSteps();
        const activationLogs = this.getProcessActivationLogs();

        const clean = (value: unknown): string => String(value ?? '').trim();
        const optionLabel = (value: unknown): string => {
            const normalized = clean(value).toLowerCase();
            if (normalized === 'si' || normalized === 'sí' || normalized === 'true') return 'Sí';
            if (normalized === 'no' || normalized === 'false') return 'No';
            return clean(value);
        };
        const details = (...entries: Array<[string, unknown]>): ProcessTimelineDetail[] =>
            entries
                .map(([label, value]) => ({ label, value: clean(value) }))
                .filter(entry => entry.value.length > 0);
        const add = (item: Omit<ProcessTechnicianTimelineItem, 'details'> & { details?: ProcessTimelineDetail[] }): void => {
            items.push({ ...item, details: item.details || [] });
        };

        add({
            title: solicitud.technician_response === 'aceptada'
                ? 'Aceptó el proceso asignado'
                : (solicitud.technician_response === 'rechazada' ? 'Rechazó el proceso asignado' : 'Proceso asignado al técnico'),
            description: `${processLabel} asignado${technician ? ` a ${technician}` : ' al técnico'}${solicitud.technician_response === 'aceptada' ? ' y aceptado' : ''}.`,
            icon: 'pi-user',
            state: solicitud.technician_response === 'rechazada' ? 'danger' : 'info',
            timestamp: solicitud.technician_response_updated_at,
            details: details(
                ['Respuesta del técnico', this.getTechnicianResponseLabel(solicitud.technician_response)],
                ['Creada por', this.getSolicitudCreatorName(solicitud)],
                ['Fecha programada', this.formatProcessTimelineDate(installation.scheduled_date || solicitud.scheduled_date)],
                ['Cliente', this.getClientDisplayName(solicitud)],
                ['Contacto', installation.contacts || solicitud.contacts],
                ['Descripción recibida', solicitud.description],
            ),
        });

        add({
            title: 'Revisó los datos iniciales del proceso',
            description: 'Consultó el vehículo y la ubicación disponibles antes de trabajar sobre el GPS.',
            icon: 'pi-car',
            state: 'neutral',
            showLocationAction: this.hasProcessDetailLocation(solicitud, installation),
            details: details(
                ['Vehículo', [installation.brand ? this.getBrandName(installation.brand) : '', this.getModelName(installation.brand, installation.model), installation.year].filter(Boolean).join(' ')],
                ['Color', this.getColorName(installation.color)],
                ['Placa', installation.plate],
                ['Chasis', installation.chassis],
                ['Dirección', this.getProcessDetailAddress(solicitud, installation)],
                ['Zona', this.getProcessDetailZone(solicitud, installation)],
                ['Coordenadas', this.getProcessDetailCoordinates(solicitud, installation)],
            ),
        });

        if (processType === 'instalacion' || processType === 'reinstalacion') {
            add({
                title: processType === 'reinstalacion' ? 'Preparó la reinstalación' : 'Preparó la instalación',
                description: 'Configuró el dispositivo y las funciones solicitadas para el vehículo.',
                icon: 'pi-wrench',
                state: 'info',
                details: details(
                    ['IMEI instalado', installation.device_imei],
                    ['SIM card', installation.sim_card_number],
                    ['Compañía SIM', installation.sim_company],
                    ['Lugar de instalación', this.getInstallationLocationLabel(installation.installation_location)],
                    ['Apagado de motor', optionLabel(installation.engine_shutdown)],
                    ['Sensor de ignición', optionLabel(installation.ignition_sensor)],
                ),
            });
        }

        if (processType === 'chequeo') {
            add({
                title: 'Inició el chequeo del GPS',
                description: 'Tomó como referencia el GPS y la SIM que tenía el vehículo al comenzar.',
                icon: 'pi-search',
                state: 'info',
                details: details(
                    ['IMEI revisado', recovery?.previous_device_imei || installation.device_imei],
                    ['SIM revisada', recovery?.previous_sim_card_number || installation.sim_card_number],
                    ['Compañía SIM', installation.sim_company],
                ),
            });

            if (recovery?.connection_checked) {
                add({
                    title: 'Revisó la conexión del GPS',
                    description: recovery.connection_corrected
                        ? 'Detectó un problema de conexión y lo corrigió.'
                        : 'La conexión fue revisada y no necesitó corrección.',
                    icon: 'pi-link',
                    state: recovery.connection_corrected ? 'success' : 'neutral',
                });
            }

            if (recovery?.power_checked) {
                add({
                    title: 'Revisó la alimentación eléctrica',
                    description: recovery.power_corrected
                        ? 'Detectó un problema de alimentación y lo corrigió.'
                        : 'La alimentación fue revisada y no necesitó corrección.',
                    icon: 'pi-bolt',
                    state: recovery.power_corrected ? 'success' : 'neutral',
                });
            }

            if (recovery?.sim_replacement_attempted) {
                add({
                    title: 'Reemplazó la SIM card',
                    description: 'Retiró la SIM anterior y vinculó una nueva al GPS.',
                    icon: 'pi-id-card',
                    state: 'success',
                    details: details(
                        ['SIM retirada', recovery.previous_sim_card_number || installation.sim_card_number],
                        ['SIM colocada', recovery.replacement_sim_card_number || installation.new_sim_card_number],
                        ['Compañía nueva', recovery.replacement_sim_company || installation.new_sim_company],
                    ),
                });
            }
        }

        if (gpsChange?.new_device_imei || recovery?.gps_replacement_attempted || processType === 'cambio') {
            add({
                title: 'Realizó el cambio de GPS',
                description: 'Registró el dispositivo retirado y el nuevo GPS colocado en el vehículo.',
                icon: 'pi-sync',
                state: this.isGpsChangeCancelled(solicitud) ? 'danger' : (gpsChange?.new_device_imei ? 'success' : 'warning'),
                timestamp: solicitud.gps_change?.completed_date,
                details: details(
                    ['GPS retirado', gpsChange?.device_imei || recovery?.previous_device_imei || installation.device_imei],
                    ['GPS colocado', gpsChange?.new_device_imei || recovery?.replacement_device_imei || installation.new_device_imei],
                    ['SIM anterior', gpsChange?.sim_card_number || recovery?.previous_sim_card_number || installation.sim_card_number],
                    ['SIM nueva', gpsChange?.new_sim_card_number || recovery?.replacement_sim_card_number || installation.new_sim_card_number],
                    ['Compañía nueva', gpsChange?.new_sim_company || recovery?.replacement_sim_company || installation.new_sim_company],
                    ['Protocolo nuevo', gpsChange?.new_protocol || installation.new_protocol],
                    ['Estado del cambio', this.getGpsChangeStatusLabel(solicitud)],
                    ['Detalles del cambio', gpsChange?.installation_details],
                ),
            });
        }

        if (processType === 'desinstalacion') {
            add({
                title: 'Realizó la desinstalación',
                description: 'Retiró el GPS asociado al vehículo.',
                icon: 'pi-eject',
                state: installation.cancelled ? 'danger' : 'success',
                details: details(
                    ['GPS retirado', installation.device_imei],
                    ['SIM asociada', installation.sim_card_number],
                    ['Motivo', this.getDeinstallationReasonLabel(installation.deinstallation_reason || solicitud.deinstallation_reason)],
                ),
            });
        }

        if (activationSteps.length || activationLogs.length || this.getProcessActivationStatusLabel()) {
            add({
                title: 'Activó y validó el GPS',
                description: 'Ejecutó la configuración necesaria y comprobó la comunicación del dispositivo.',
                icon: 'pi-wifi',
                state: this.processDetailsDevice?.activation_status?.cancelled
                    ? 'danger'
                    : (this.processDetailsDevice?.activation_status?.completed ? 'success' : 'warning'),
                timestamp: this.processDetailsDevice?.activation_status?.completedAt,
                details: [
                    ...details(['Resultado', this.getProcessActivationStatusLabel()]),
                    ...activationSteps.map((step, stepIndex) => ({
                        label: `Validación ${stepIndex + 1}: ${step.label}`,
                        value: `${this.getActivationStepStatusLabel(step.status)}${step.description ? ` · ${step.description}` : ''}`,
                    })),
                    ...activationLogs.map((log, logIndex) => ({
                        label: `Registro ${logIndex + 1}${log.time ? ` · ${this.formatProcessTimelineDate(log.time)}` : ''}`,
                        value: clean(log.message),
                    })).filter(log => log.value),
                ],
            });
        }

        if (recovery?.online_confirmed) {
            add({
                title: 'Confirmó el GPS nuevamente en línea',
                description: 'Comprobó que el dispositivo volvió a reportar correctamente.',
                icon: 'pi-check-circle',
                state: 'success',
                timestamp: recovery.online_confirmed_at,
                details: details(
                    ['Validación realizada después de', this.getRecoveryStepLabel(recovery.last_online_check_step)],
                    ['Estado final de conexión', this.getConnectionStatusLabel(installation.connection_status)],
                ),
            });
        }

        if (installation.diagnosis || installation.resolution_type || installation.connection_status || installation.installation_details) {
            add({
                title: 'Registró el resultado técnico',
                description: 'Documentó el diagnóstico y el resultado final del trabajo.',
                icon: 'pi-file-edit',
                state: installation.connection_status === 'mal_conectado' ? 'warning' : 'success',
                details: details(
                    ['Diagnóstico', installation.diagnosis],
                    ['Resolución', this.getCheckupResolutionLabel(installation.resolution_type)],
                    ['Estado final de conexión', this.getConnectionStatusLabel(installation.connection_status)],
                    ['Detalles del trabajo', installation.installation_details],
                    ['Notas del proceso', installation.notes],
                    ['Notas de la solicitud', solicitud.notes],
                ),
            });
        }

        if (deviceEvidence.length || installation.images?.length || installation.audio) {
            add({
                title: 'Adjuntó las evidencias del trabajo',
                description: 'Dejó fotografías y archivos que respaldan lo realizado.',
                icon: 'pi-paperclip',
                state: 'info',
                details: details(
                    ['Fotos del diagnóstico', installation.images?.length ? `${installation.images.length}` : ''],
                    ['Evidencias del dispositivo', deviceEvidence.length ? `${deviceEvidence.length}` : ''],
                    ['Nota de voz', installation.audio ? 'Adjunta' : ''],
                ),
                evidence: [
                    ...(installation.images || []).map((url, evidenceIndex) => ({
                        label: `Evidencia del diagnóstico ${evidenceIndex + 1}`,
                        url,
                    })),
                    ...deviceEvidence,
                ],
                audio: installation.audio,
            });
        }

        const finalState: ProcessTechnicianTimelineItem['state'] = installation.cancelled
            || solicitud.status === 'cancelada'
            || solicitud.status === 'rechazada'
            ? 'danger'
            : (installation.completed ? 'success' : 'warning');
        add({
            title: installation.cancelled
                ? 'Canceló este proceso'
                : (installation.completed ? 'Finalizó este proceso' : 'El proceso permanece pendiente'),
            description: installation.cancelled
                ? 'El técnico marcó este proceso como cancelado.'
                : (installation.completed ? 'El técnico marcó el trabajo como realizado.' : 'Todavía no existe un cierre técnico registrado.'),
            icon: installation.cancelled ? 'pi-times-circle' : (installation.completed ? 'pi-flag-fill' : 'pi-clock'),
            state: finalState,
            timestamp: installation.completed || installation.cancelled ? solicitud.completed_date : undefined,
            details: details(
                ['Estado del proceso', installation.cancelled ? 'Cancelado' : (installation.completed ? 'Realizado' : 'Pendiente')],
                ['Estado de la solicitud', this.statusLabels[solicitud.status] || solicitud.status],
                ['Estado del GPS al finalizar', (installation.completed || installation.cancelled)
                    && this.hasInstallationFinalDeviceStatus(installation)
                    ? this.getInstallationFinalDeviceStatusLabel(installation)
                    : ''],
                ['Estado reportado por el GPS', installation.final_device_status],
                ['Hora de la comprobación final', this.formatProcessTimelineDate(installation.final_device_status_at)],
                ['Motivo de cancelación', installation.cancelled || solicitud.status === 'cancelada' || solicitud.status === 'rechazada'
                    ? (solicitud.cancellation_reason || installation.installation_details)
                    : ''],
            ),
        });

        return items;
    }

    getActivationStepStatusLabel(value?: string): string {
        const labels: Record<string, string> = {
            success: 'Completado',
            error: 'Con error',
            running: 'En proceso',
            pending: 'Pendiente',
        };
        return value ? (labels[value] || value) : 'Sin estado';
    }

    formatProcessTimelineDate(value?: string | Date): string {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return new Intl.DateTimeFormat('es-DO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        }).format(date);
    }

    getProcessDetailZone(solicitud: Solicitud, installation: InstallationDetail): string {
        return [
            installation.sector || solicitud.sector,
            installation.municipality || solicitud.municipality,
            installation.province || solicitud.province,
        ].filter(Boolean).join(', ');
    }

    getProcessDetailAddress(solicitud: Solicitud, installation: InstallationDetail): string {
        const address = installation.location_address || solicitud.location_address;
        if (address) return address;

        const legacyAddress = String(installation.installation_location || '').trim();
        return legacyAddress && !this.installationLocations.some(
            option => option.value === legacyAddress
        )
            ? legacyAddress
            : '';
    }

    getProcessDetailCoordinates(solicitud: Solicitud, installation: InstallationDetail): string {
        const latitude = installation.latitude ?? solicitud.latitude;
        const longitude = installation.longitude ?? solicitud.longitude;
        return latitude != null && longitude != null ? `${latitude}, ${longitude}` : '';
    }

    hasProcessDetailLocation(solicitud: Solicitud, installation: InstallationDetail): boolean {
        return !!(
            this.getProcessDetailCoordinates(solicitud, installation)
            || installation.google_maps_url
            || solicitud.google_maps_url
            || this.getProcessDetailAddress(solicitud, installation)
        );
    }

    openProcessLocationMap(solicitud: Solicitud, installation: InstallationDetail): void {
        this.processLocationMapError = '';
        this.processLocationMapAddress = this.getProcessDetailAddress(solicitud, installation)
            || this.getProcessDetailZone(solicitud, installation)
            || 'Ubicación del proceso';
        this.processLocationMapCoordinates = this.getStoredProcessCoordinates(solicitud, installation);
        this.processLocationMapLoading = true;
        this.processLocationMapDialogVisible = true;
        setTimeout(() => {
            void this.initProcessLocationMap(solicitud, installation);
        }, 0);
    }

    closeProcessLocationMap(): void {
        this.processLocationMapDialogVisible = false;
        this.destroyProcessLocationMap();
        this.processLocationMapCoordinates = null;
        this.processLocationMapAddress = '';
        this.processLocationMapError = '';
        this.processLocationMapLoading = false;
    }

    private destroyProcessLocationMap(): void {
        this.processLocationMapMarker?.remove?.();
        this.processLocationMapMarker = null;
        this.processLocationMap?.remove?.();
        this.processLocationMap = null;
    }

    private getStoredProcessCoordinates(
        solicitud: Solicitud,
        installation: InstallationDetail,
    ): { lat: number; lng: number } | null {
        const lat = Number(installation.latitude ?? solicitud.latitude);
        const lng = Number(installation.longitude ?? solicitud.longitude);
        if (this.isValidCoordinatePair(lat, lng)) return { lat, lng };

        const mapsUrl = installation.google_maps_url || solicitud.google_maps_url || '';
        return this.extractCoordinatesFromGoogleMapsLink(mapsUrl);
    }

    private async initProcessLocationMap(
        solicitud: Solicitud,
        installation: InstallationDetail,
    ): Promise<void> {
        try {
            let coordinates = this.processLocationMapCoordinates;
            const mapsUrl = installation.google_maps_url || solicitud.google_maps_url || '';
            if (!coordinates && mapsUrl) {
                try {
                    const resolved = await firstValueFrom(this.userService.resolveGoogleMapsLink(mapsUrl));
                    const lat = Number(resolved?.latitude);
                    const lng = Number(resolved?.longitude);
                    if (this.isValidCoordinatePair(lat, lng)) {
                        coordinates = { lat, lng };
                        this.processLocationMapCoordinates = coordinates;
                    }
                    if (resolved?.address) {
                        this.processLocationMapAddress = resolved.address;
                    }
                } catch {
                    // If the link cannot be resolved, the stored address can still be geocoded below.
                }
            }

            if (!coordinates && this.processLocationMapAddress) {
                await this.initializeSolicitudLocationPlaces();
                if (typeof google === 'undefined' || !google.maps?.Geocoder) {
                    throw new Error('No se pudo convertir la dirección en coordenadas.');
                }
                coordinates = await this.geocodeProcessLocation(this.processLocationMapAddress);
                this.processLocationMapCoordinates = coordinates;
            }
            if (!coordinates) {
                throw new Error('Esta ubicación no tiene coordenadas que se puedan mostrar.');
            }

            const mapElement = document.getElementById('solicitud-process-location-map');
            if (!mapElement || !this.processLocationMapDialogVisible) return;

            this.destroyProcessLocationMap();
            this.processLocationMap = MapUtils.createMap(
                'osm',
                mapElement,
                '',
                'light',
                coordinates.lat,
                coordinates.lng,
                16
            );
            this.processLocationMapMarker = new maplibregl.Marker({ color: '#ef4444' })
                .setLngLat([coordinates.lng, coordinates.lat])
                .addTo(this.processLocationMap);
            this.processLocationMapMarker.getElement().title = this.processLocationMapAddress
                || this.getClientDisplayName(solicitud);
            this.processLocationMapLoading = false;
        } catch (error: any) {
            console.error('Error mostrando la ubicación del proceso:', error);
            this.processLocationMapLoading = false;
            this.processLocationMapError = error?.message || 'No se pudo mostrar la ubicación en el mapa.';
        }
    }

    private geocodeProcessLocation(address: string): Promise<{ lat: number; lng: number } | null> {
        return new Promise(resolve => {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ address }, (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
                if (status !== google.maps.GeocoderStatus.OK || !results?.[0]?.geometry?.location) {
                    resolve(null);
                    return;
                }
                resolve({
                    lat: results[0].geometry.location.lat(),
                    lng: results[0].geometry.location.lng(),
                });
            });
        });
    }

    getInstallationLocationLabel(value?: string): string {
        if (!value) return '';
        return this.installationLocations.find(option => option.value === value)?.label || value;
    }

    getClosedSolicitudAddress(solicitud: Solicitud): string {
        const installation = solicitud.installations?.[0];
        const address = solicitud.location_address || installation?.location_address;
        if (address) return address;

        const legacyAddress = String(installation?.installation_location || '').trim();
        return legacyAddress && !this.installationLocations.some(
            option => option.value === legacyAddress
        )
            ? legacyAddress
            : '';
    }

    getClosedSolicitudCoordinates(solicitud: Solicitud): string {
        const installation = solicitud.installations?.find(item => item.latitude != null && item.longitude != null);
        const latitude = solicitud.latitude ?? installation?.latitude;
        const longitude = solicitud.longitude ?? installation?.longitude;
        return latitude != null && longitude != null ? `${latitude}, ${longitude}` : '';
    }

    getClosedSolicitudMapsUrl(solicitud: Solicitud): string {
        const storedUrl = solicitud.google_maps_url
            || solicitud.installations?.find(item => item.google_maps_url)?.google_maps_url;
        if (storedUrl) return storedUrl;

        const coordinates = this.getClosedSolicitudCoordinates(solicitud);
        return coordinates
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordinates)}`
            : '';
    }

    private getClosedLocationFallback(solicitud: Solicitud): string {
        const installation = solicitud.installations?.[0];
        const address = solicitud.location_address || installation?.location_address;
        if (address) return address;

        const parts = [
            solicitud.sector || installation?.sector,
            solicitud.municipality || installation?.municipality,
            solicitud.province || installation?.province,
        ].filter(Boolean);
        return parts.join(', ');
    }

    private async resolveClosedSolicitudLocation(solicitud: Solicitud): Promise<void> {
        const installation = solicitud.installations?.[0];
        const provinceCode = String(solicitud.province || installation?.province || '');
        const municipalityCode = String(solicitud.municipality || installation?.municipality || '');
        const sectorCode = String(solicitud.sector || installation?.sector || '');
        if (!provinceCode && !municipalityCode && !sectorCode) return;

        try {
            const province = this.availableProvinces.find(option => String(option.value) === provinceCode)?.label || provinceCode;
            let municipality = municipalityCode;
            let sector = sectorCode;

            if (provinceCode && municipalityCode) {
                const municipalities = await this.vehicleBrandsService.getMunicipalities(provinceCode);
                municipality = municipalities.find((item: any) => String(item.code) === municipalityCode)?.name || municipalityCode;
            }
            if (provinceCode && municipalityCode && sectorCode) {
                const sectors = await this.vehicleBrandsService.getSectors(municipalityCode, provinceCode);
                sector = sectors.find((item: any) => String(item.code) === sectorCode)?.name || sectorCode;
            }

            if (this.closedSolicitud?._id === solicitud._id) {
                this.closedSolicitudLocation = [sector, municipality, province].filter(Boolean).join(', ');
            }
        } catch {
            // Keep the stored codes as a safe fallback when catalogs are unavailable.
        }
    }

    async saveSolicitud(): Promise<void> {
        if (!this.selectedSolicitud) return;
        if (this.isSelectedSolicitudFinalized()) {
            this.messageService.add({
                severity: 'info',
                summary: 'Solicitud finalizada',
                detail: 'Esta solicitud ya está cerrada y no puede modificarse.'
            });
            return;
        }

        if (!this.syncRootGoogleMapsLink()) {
            return;
        }

        if (
            this.selectedSolicitud.type === 'mixta'
            && this.selectedSolicitud.installations?.some(installation =>
                !this.mixedProcessOptions.some(option => option.value === installation.process_type)
            )
        ) {
            this.messageService.add({
                severity: 'error',
                summary: 'Tipo requerido',
                detail: 'Debe seleccionar el tipo de cada proceso de la solicitud mixta.'
            });
            this.showInstallationsCards = true;
            return;
        }

        if (
            ['desinstalacion', 'mixta'].includes(this.selectedSolicitud.type)
            && !this.hasValidDeinstallationReason(this.selectedSolicitud)
        ) {
            this.deinstallationReasonError = true;
            this.messageService.add({
                severity: 'error',
                summary: 'Razón requerida',
                detail: 'Debe seleccionar una razón de desinstalación antes de guardar.'
            });
            return;
        }
        this.deinstallationReasonError = false;

        // Chequeos y desinstalaciones necesitan identificar el dispositivo.
        if (this.isDeviceRequiredForSolicitud()) {
            const hasMissingDevice = this.selectedSolicitud.installations?.some(inst =>
                this.isDeviceRequiredForProcess(this.getInstallationProcessType(inst))
                && (!inst.device_imei || inst.device_imei.trim() === '')
            );
            if (hasMissingDevice) {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Validación Fallida',
                    detail: `Debe ingresar el IMEI del dispositivo para todas las ${this.getEntityName(true).toLowerCase()}.`
                });
                
                // Try to aggressively expand the installations and device config if not open
                this.showInstallationsCards = true;
                this.showDeviceData = true;
                return;
            }

        }

        this.syncSolicitudScheduledDate();
        if (!await this.validateSelectedTechnicianSchedule(true)) {
            this.showRootDetailsData = true;
            return;
        }

        if (!this.skipMissingClientCheckOnce && await this.shouldWarnMissingClientOnSave()) {
            this.missingClientDialogVisible = true;
            return;
        }
        this.skipMissingClientCheckOnce = false;

        if (this.selectedSolicitud.status === 'completada' && this.selectedSolicitudOriginalStatus !== 'completada') {
            this.confirmSolicitudCompletion(this.selectedSolicitud, () => this.persistSolicitud());
            return;
        }

        this.persistSolicitud();
    }

    private persistSolicitud(): void {
        if (!this.selectedSolicitud) return;

        if (this.isEditMode && this.selectedSolicitud._id) {
            const solicitudPayload = { ...this.selectedSolicitud };
            delete solicitudPayload.gps_change;
            this.solicitudesService.update(this.selectedSolicitud._id, solicitudPayload).subscribe({
                next: () => {
                    this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Solicitud actualizada' });
                    this.dialogVisible = false;
                    this.loadSolicitudes(false);
                },
                error: (error) => {
                    this.messageService.add({
                        severity: 'error',
                        summary: 'No se pudo actualizar',
                        detail: error?.error?.message || 'No se pudo actualizar la solicitud',
                    });
                }
            });
        } else {
            this.solicitudesService.create(this.selectedSolicitud).subscribe({
                next: () => {
                    this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Solicitud creada' });
                    this.dialogVisible = false;
                    this.loadSolicitudes();
                },
                error: (error) => {
                    this.messageService.add({
                        severity: 'error',
                        summary: 'No se pudo crear',
                        detail: error?.error?.message || 'No se pudo crear la solicitud',
                    });
                }
            });
        }
    }

    async confirmMissingClientAndSave(): Promise<void> {
        this.missingClientDialogVisible = false;
        this.skipMissingClientCheckOnce = true;
        await this.saveSolicitud();
    }

    normalizeSolicitudScheduledDateInput(): void {
        if (!this.selectedSolicitud) return;
        this.selectedSolicitud.scheduled_date = this.toDateTimeLocalValue(
            this.selectedSolicitud.scheduled_date
        );
        void this.validateSelectedTechnicianSchedule();
        void this.refreshTechnicianRecommendation();
    }

    onSelectedTechnicianChange(): void {
        void this.validateSelectedTechnicianSchedule();
    }

    async validateSelectedTechnicianSchedule(
        showToast = false,
    ): Promise<boolean> {
        const validationSequence = ++this.technicianScheduleValidationSequence;
        this.technicianScheduleConflict = null;
        this.technicianScheduleValidationError = '';

        const mechanicId = String(
            this.selectedSolicitud?.mechanic_id || '',
        ).trim();
        const scheduledDate = this.toDateTimeLocalValue(
            this.selectedSolicitud?.scheduled_date
            || this.selectedSolicitud?.installations?.[0]?.scheduled_date,
        );
        if (!mechanicId || !scheduledDate) {
            this.technicianScheduleChecking = false;
            return true;
        }

        this.technicianScheduleChecking = true;
        try {
            const result = await firstValueFrom(
                this.solicitudesService.checkTechnicianScheduleConflict(
                    mechanicId,
                    scheduledDate,
                    this.selectedSolicitud?._id,
                ),
            );
            if (validationSequence !== this.technicianScheduleValidationSequence) {
                return false;
            }

            this.technicianScheduleConflict =
                result.available ? null : result.conflict || null;
            if (this.technicianScheduleConflict && showToast) {
                this.messageService.add({
                    severity: 'warn',
                    summary: 'Técnico no disponible',
                    detail: this.technicianScheduleConflictMessage,
                });
            }
            return result.available;
        } catch (error: any) {
            if (validationSequence !== this.technicianScheduleValidationSequence) {
                return false;
            }
            this.technicianScheduleValidationError =
                error?.error?.message
                || 'No se pudo validar la disponibilidad del técnico.';
            if (showToast) {
                this.messageService.add({
                    severity: 'error',
                    summary: 'No se pudo validar',
                    detail: this.technicianScheduleValidationError,
                });
            }
            return false;
        } finally {
            if (validationSequence === this.technicianScheduleValidationSequence) {
                this.technicianScheduleChecking = false;
            }
        }
    }

    get technicianScheduleConflictMessage(): string {
        const conflict = this.technicianScheduleConflict;
        if (!conflict) return '';

        const client = conflict.client_name
            ? ` para ${conflict.client_name}`
            : '';
        const scheduled = this.getScheduledDateDisplay({
            type: conflict.type,
            status: 'pendiente',
            scheduled_date: conflict.scheduled_date,
        });
        return `El técnico no está disponible en esa fecha porque tiene una solicitud de ${conflict.type_label}${client} programada para ${scheduled}. Debe existir al menos una hora de diferencia.`;
    }

    private resetTechnicianScheduleValidation(): void {
        this.technicianScheduleValidationSequence += 1;
        this.technicianScheduleChecking = false;
        this.technicianScheduleConflict = null;
        this.technicianScheduleValidationError = '';
    }

    async refreshTechnicianRecommendation(): Promise<void> {
        const recommendationSequence = ++this.technicianRecommendationSequence;
        this.technicianRecommendation = null;
        this.technicianRecommendationMessage = '';

        const scheduledDate = this.toDateTimeLocalValue(
            this.selectedSolicitud?.scheduled_date
            || this.selectedSolicitud?.installations?.[0]?.scheduled_date,
        );
        const latitude = Number(
            this.selectedSolicitud?.latitude
            ?? this.selectedSolicitud?.installations?.[0]?.latitude,
        );
        const longitude = Number(
            this.selectedSolicitud?.longitude
            ?? this.selectedSolicitud?.installations?.[0]?.longitude,
        );
        if (!scheduledDate) {
            this.technicianRecommendationLoading = false;
            this.technicianRecommendationMessage =
                'Selecciona la fecha y la hora para calcular el técnico recomendado.';
            return;
        }
        if (!this.isValidCoordinatePair(latitude, longitude)) {
            this.technicianRecommendationLoading = false;
            this.technicianRecommendationMessage =
                'Configura la ubicación exacta de la solicitud para calcular el técnico recomendado.';
            return;
        }

        this.technicianRecommendationLoading = true;
        try {
            const response = await firstValueFrom(
                this.solicitudesService.getTechnicianRecommendation({
                    scheduledDate,
                    latitude,
                    longitude,
                    excludeId: this.selectedSolicitud?._id,
                }),
            );
            if (
                recommendationSequence
                !== this.technicianRecommendationSequence
            ) {
                return;
            }

            this.technicianRecommendation = response.recommendation;
            this.technicianRecommendationMessage =
                response.message
                || (
                    response.recommendation
                        ? `${response.available_technicians} de ${response.evaluated_technicians} técnicos están disponibles para este horario.`
                        : 'No fue posible determinar un técnico recomendado.'
                );
        } catch (error: any) {
            if (
                recommendationSequence
                !== this.technicianRecommendationSequence
            ) {
                return;
            }
            this.technicianRecommendationMessage =
                error?.error?.message
                || 'No se pudo calcular el técnico recomendado.';
        } finally {
            if (
                recommendationSequence
                === this.technicianRecommendationSequence
            ) {
                this.technicianRecommendationLoading = false;
            }
        }
    }

    applyTechnicianRecommendation(): void {
        if (!this.selectedSolicitud || !this.technicianRecommendation) return;
        this.selectedSolicitud.mechanic_id =
            this.technicianRecommendation.technician_id;
        void this.validateSelectedTechnicianSchedule();
    }

    get isRecommendedTechnicianSelected(): boolean {
        return !!this.technicianRecommendation
            && this.selectedSolicitud?.mechanic_id
                === this.technicianRecommendation.technician_id;
    }

    getTechnicianRecommendationLocationText(
        recommendation: TechnicianRecommendation,
    ): string {
        const reference = recommendation.location_reference;
        if (!reference || !Number.isFinite(reference.distance_km)) return '';

        const age = this.getRelativeLocationAge(reference.recorded_at);
        const source = reference.type === 'app'
            ? 'ubicación marcada en la app'
            : 'ubicación del último proceso';
        return [
            `Técnico a ${reference.distance_km.toFixed(1)} km`,
            age !== 'sin fecha' ? age : '',
            `según su ${source}`,
        ].filter(Boolean).join(' · ');
    }

    private resetTechnicianRecommendation(): void {
        this.technicianRecommendationSequence += 1;
        this.technicianRecommendationLoading = false;
        this.technicianRecommendation = null;
        this.technicianRecommendationMessage = '';
    }

    private syncSolicitudScheduledDate(): void {
        if (!this.selectedSolicitud) return;

        const scheduledDate = this.toDateTimeLocalValue(this.selectedSolicitud.scheduled_date);
        this.selectedSolicitud.scheduled_date = scheduledDate;

        if (!this.selectedSolicitud.installations?.length || !scheduledDate) {
            return;
        }

        this.selectedSolicitud.installations = this.selectedSolicitud.installations.map((installation, index) => ({
            ...installation,
            scheduled_date: index === 0 || !installation.scheduled_date
                ? scheduledDate
                : this.toDateTimeLocalValue(installation.scheduled_date)
        }));
    }

    private toDateTimeLocalValue(value: string | Date | undefined | null): string {
        if (!value) return '';

        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
            return this.floorDateTimeMinutesToTen(value);
        }

        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:/.test(value)) {
            return this.floorDateTimeMinutesToTen(value.slice(0, 16));
        }

        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return '';

        const pad = (part: number) => String(part).padStart(2, '0');
        const localValue = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
        return this.floorDateTimeMinutesToTen(localValue);
    }

    private floorDateTimeMinutesToTen(value: string): string {
        return value.replace(/:(\d{2})$/, (_, minutes: string) => {
            const flooredMinutes = Math.floor(Number(minutes) / 10) * 10;
            return `:${String(flooredMinutes).padStart(2, '0')}`;
        });
    }

    private getCurrentDateTimeLocalValue(): string {
        return this.toDateTimeLocalValue(new Date());
    }

    private async shouldWarnMissingClientOnSave(): Promise<boolean> {
        if (
            !this.selectedSolicitud
            || (
                this.selectedSolicitud.type !== 'instalacion'
                && !(
                    this.selectedSolicitud.type === 'mixta'
                    && this.selectedSolicitud.installations?.some(
                        installation => this.getInstallationProcessType(installation) === 'instalacion'
                    )
                )
            )
        ) return false;

        const hasClientLookupData = !!String(this.selectedSolicitud.client_email || '').trim()
            || !!String(this.selectedSolicitud.client_phone || '').trim();
        if (!hasClientLookupData) return false;

        this.missingClientChecking = true;
        try {
            const existingClient = await this.findSelectedSolicitudClient();
            return !existingClient;
        } finally {
            this.missingClientChecking = false;
        }
    }

    private async findSelectedSolicitudClient(): Promise<User | null> {
        if (!this.selectedSolicitud) return null;

        const clientId = String(this.selectedSolicitud.client_id || '').trim();
        if (clientId) {
            try {
                return this.normalizeFoundClient(await firstValueFrom(this.userService.getById(clientId)));
            } catch {
                // A legacy/stale id can still be resolved by email or phone below.
            }
        }

        const email = String(this.selectedSolicitud.client_email || '').trim();
        if (email) {
            try {
                return this.normalizeFoundClient(await firstValueFrom(this.userService.getByEmail(email)));
            } catch (error) {
                return null;
            }
        }

        const phone = String(this.selectedSolicitud.client_phone || '').trim();
        if (phone) {
            try {
                return this.normalizeFoundClient(await firstValueFrom(this.userService.getByPhone(phone)));
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    private normalizeFoundClient(user: any): User | null {
        if (!user || typeof user !== 'object') return null;
        return user._id || user.id || user.email || user.phone ? user : null;
    }

    deleteSolicitud(solicitud: Solicitud): void {
        if (!this.isRootUser) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Acceso restringido',
                detail: 'Solo los usuarios root pueden eliminar solicitudes.'
            });
            return;
        }

        this.confirmationService.confirm({
            message: '¿Estás seguro de eliminar esta solicitud?',
            header: 'Confirmar',
            icon: 'pi pi-exclamation-triangle',
            key: 'solicitudes-confirm',
            accept: () => {
                this.solicitudesService.delete(solicitud._id!).subscribe({
                    next: () => {
                        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Solicitud eliminada' });
                        this.loadSolicitudes(false);
                    },
                    error: () => {
                        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar' });
                    }
                });
            }
        });
    }

    cancelSolicitud(solicitud: Solicitud): void {
        if (this.isSolicitudClosed(solicitud)) {
            this.showClosedSolicitudLockedFeedback();
            return;
        }

        this.cancellationSolicitud = solicitud;
        this.cancellationReason = '';
        this.cancellationReasonSubmitted = false;
        this.cancellationDialogVisible = true;
    }

    confirmSolicitudCancellation(): void {
        const solicitud = this.cancellationSolicitud;
        const reason = String(this.cancellationReason || '').trim();
        this.cancellationReasonSubmitted = true;

        if (!solicitud?._id || !reason || this.cancellingSolicitud) return;

        this.cancellingSolicitud = true;
        this.solicitudesService.update(solicitud._id, {
            status: 'rechazada',
            cancellation_reason: reason
        }).subscribe({
            next: () => {
                this.messageService.add({
                    severity: 'warn',
                    summary: 'Rechazada',
                    detail: 'Solicitud cancelada y marcada como rechazada'
                });
                this.cancellingSolicitud = false;
                this.cancellationDialogVisible = false;
                this.resetSolicitudCancellation();
                this.loadSolicitudes(false);
            },
            error: (error) => {
                this.cancellingSolicitud = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'No se pudo cancelar',
                    detail: error?.error?.message
                        || 'Verifique la razón e intente nuevamente.'
                });
            }
        });
    }

    closeSolicitudCancellation(): void {
        if (this.cancellingSolicitud) return;
        this.cancellationDialogVisible = false;
        this.resetSolicitudCancellation();
    }

    resetSolicitudCancellation(): void {
        if (this.cancellingSolicitud) return;
        this.cancellationSolicitud = null;
        this.cancellationReason = '';
        this.cancellationReasonSubmitted = false;
    }

    private showClosedSolicitudLockedFeedback(): void {
        this.messageService.add({
            severity: 'info',
            summary: 'Solicitud cerrada',
            detail: 'Una solicitud completada o cancelada no se puede mover ni reabrir.'
        });
    }

    private confirmSolicitudCompletion(solicitud: Solicitud, accept: () => void): void {
        if (
            ['desinstalacion', 'mixta'].includes(solicitud.type)
            && !this.hasValidDeinstallationReason(solicitud)
        ) {
            this.deinstallationReasonError = true;
            this.messageService.add({
                severity: 'warn',
                summary: 'Razón requerida',
                detail: 'Seleccione una razón de desinstalación antes de completar y cancelar los dispositivos.'
            });
            return;
        }

        this.completionSolicitud = solicitud;
        this.pendingCompletionAction = accept;
        this.completionConfirmDialogVisible = true;
    }

    cancelSolicitudCompletion(): void {
        this.completionConfirmDialogVisible = false;
        this.completionSolicitud = null;
        this.pendingCompletionAction = null;
    }

    approveSolicitudCompletion(): void {
        const action = this.pendingCompletionAction;
        if (!action) {
            this.cancelSolicitudCompletion();
            return;
        }

        this.pendingCompletionAction = null;
        this.completionSolicitud = null;
        this.completionConfirmDialogVisible = false;
        action();
    }

    hideDialog(): void {
        this.dialogVisible = false;
        this.closeTechnicianSelection();
        this.selectedSolicitud = null;
        this.selectedSolicitudOriginalStatus = '';
        this.deinstallationReasonError = false;
        this.resetTechnicianScheduleValidation();
        this.resetTechnicianRecommendation();
    }

    getStatusIcon(status: string): string {
        const map: Record<string, string> = {
            pendiente: 'pi pi-clock',
            aceptada: 'pi pi-check-circle',
            rechazada: 'pi pi-times-circle',
            en_progreso: 'pi pi-spin pi-spinner',
            por_confirmar: 'pi pi-question-circle',
            completada: 'pi pi-check-circle',
            cancelada: 'pi pi-times-circle'
        };
        return map[status] || 'pi pi-circle';
    }

    isTechnicianUnavailable(solicitud: Solicitud | null): boolean {
        return solicitud?.technician_response === 'rechazada' || solicitud?.status === 'rechazada';
    }

    isTechnicianAccepted(solicitud: Solicitud | null): boolean {
        return solicitud?.technician_response === 'aceptada';
    }

    isPendingAcceptanceLoading(solicitud: Solicitud | null): boolean {
        return solicitud?.status === 'pendiente'
            && !this.isTechnicianAccepted(solicitud)
            && !this.isTechnicianUnavailable(solicitud);
    }

    isTechnicianVerifying(solicitud: Solicitud | null): boolean {
        return solicitud?.technician_response === 'verificando';
    }

    getTechnicianById(id?: string): User | null {
        if (!id) return null;
        if (this.technicianByIdCacheSource !== this.availableTechnicians) {
            this.technicianByIdCacheSource = this.availableTechnicians;
            this.technicianByIdCache = new Map(
                this.availableTechnicians
                    .map(technician => [
                        String(technician._id || (technician as any).id || ''),
                        technician,
                    ] as const)
                    .filter(([technicianId]) => technicianId),
            );
        }
        return this.technicianByIdCache.get(String(id)) || null;
    }

    getTechnicianDisplayName(solicitud: Solicitud | null): string {
        const technician = this.getTechnicianById(solicitud?.mechanic_id);
        if (!technician) return 'Técnico asignado';
        return `${technician.name || ''} ${technician.last_name || ''}`.trim() || technician.email || 'Técnico asignado';
    }

    getAcceptedTechnicianPhoto(solicitud: Solicitud | null): string | null {
        if (!this.isTechnicianAccepted(solicitud)) return null;

        const photo = String(this.getTechnicianById(solicitud?.mechanic_id)?.photo || '').trim();
        return photo && !this.failedTechnicianPhotos.has(photo) ? photo : null;
    }

    onTechnicianPhotoError(photo: string): void {
        if (photo) {
            this.failedTechnicianPhotos.add(photo);
            if (this.calendarBreakdownTechnicianPhoto === photo) {
                this.calendarBreakdownTechnicianPhoto = null;
            }
        }
    }

    openTechnicianAvailabilityDialog(solicitud: Solicitud, event?: Event): void {
        event?.stopPropagation();
        this.selectedTechnicianSolicitud = solicitud;
        this.technicianDialogVisible = true;
    }

    openTechnicianLocationDialog(): void {
        const solicitud = this.selectedTechnicianSolicitud;
        const technicianId = solicitud?.mechanic_id;
        if (!technicianId) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Sin técnico',
                detail: 'Esta solicitud no tiene un técnico asignado.'
            });
            return;
        }

        this.technicianLocationDialogVisible = true;
        this.technicianLocationLoading = true;
        this.technicianLocationError = '';
        this.technicianLocation = null;

        this.userService.getLatestLocation(technicianId).subscribe({
            next: (location) => {
                this.technicianLocation = location;
                this.technicianLocationLoading = false;
                if (!location?.latitude || !location?.longitude) {
                    this.technicianLocationError = 'No hay ubicación registrada para este técnico.';
                    return;
                }
                setTimeout(() => this.initTechnicianLocationMap(), 0);
            },
            error: () => {
                this.technicianLocationLoading = false;
                this.technicianLocationError = 'No se pudo cargar la ubicación del técnico.';
            }
        });
    }

    async initTechnicianLocationMap(): Promise<void> {
        const location = this.technicianLocation;
        if (!location?.latitude || !location?.longitude) return;

        try {
            const mapElement = document.getElementById('technician-location-map');
            if (!mapElement) return;

            const latitude = Number(location.latitude);
            const longitude = Number(location.longitude);
            this.destroyTechnicianLocationMap();
            this.technicianLocationMap = MapUtils.createMap(
                'osm',
                mapElement,
                '',
                'light',
                latitude,
                longitude,
                16
            );

            this.technicianLocationMarker = new maplibregl.Marker({ color: '#ef4444' })
                .setLngLat([longitude, latitude])
                .addTo(this.technicianLocationMap);
            this.technicianLocationMarker.getElement().title = this.getTechnicianDisplayName(
                this.selectedTechnicianSolicitud
            );
        } catch (error) {
            console.error('Error loading technician location map:', error);
            this.technicianLocationError = 'No se pudo mostrar el mapa del técnico.';
        }
    }

    onTechnicianLocationMapHide(): void {
        this.destroyTechnicianLocationMap();
    }

    private destroyTechnicianLocationMap(): void {
        this.technicianLocationMarker?.remove?.();
        this.technicianLocationMarker = null;
        this.technicianLocationMap?.remove?.();
        this.technicianLocationMap = null;
    }

    getTechnicianLocationAgeLabel(): string {
        const recordedAt = this.technicianLocation?.recordedAt;
        if (!recordedAt) return 'Sin fecha de ubicación';

        const date = new Date(recordedAt);
        if (Number.isNaN(date.getTime())) return 'Sin fecha de ubicación';

        const diffMs = Math.max(0, Date.now() - date.getTime());
        const diffMinutes = Math.floor(diffMs / 60000);
        if (diffMinutes < 1) return 'Ubicación actualizada hace menos de 1 minuto';
        if (diffMinutes < 60) return `Última ubicación hace ${diffMinutes} minuto${diffMinutes === 1 ? '' : 's'}`;

        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) return `Última ubicación hace ${diffHours} hora${diffHours === 1 ? '' : 's'}`;

        const diffDays = Math.floor(diffHours / 24);
        return `Última ubicación hace ${diffDays} día${diffDays === 1 ? '' : 's'}`;
    }

    isTechnicianLocationStale(): boolean {
        const recordedAt = this.technicianLocation?.recordedAt;
        if (!recordedAt) return false;
        const date = new Date(recordedAt);
        if (Number.isNaN(date.getTime())) return false;
        return Date.now() - date.getTime() > 5 * 60 * 1000;
    }

    async openTechniciansMapDialog(): Promise<void> {
        this.techniciansMapDialogVisible = true;
        this.techniciansMapLoading = true;
        this.techniciansMapError = '';
        this.techniciansWithLocation = [];

        try {
            let technicians = this.availableTechnicians;
            if (!technicians.length) {
                technicians = await firstValueFrom(this.userService.getTechnicians());
                this.availableTechnicians = technicians;
            }

            const results = await Promise.all(
                technicians.map(async (technician: User) => {
                    const technicianId = String((technician as any)._id || (technician as any).id || '').trim();
                    if (!technicianId) return null;
                    try {
                        const location = await firstValueFrom(this.userService.getLatestLocation(technicianId));
                        if (!location?.latitude || !location?.longitude) return null;
                        return { technician, location };
                    } catch {
                        return null;
                    }
                })
            );

            this.techniciansWithLocation = results.filter(Boolean) as Array<{ technician: User; location: UserLatestLocation }>;
            this.techniciansMapLoading = false;

            if (!this.techniciansWithLocation.length) {
                this.techniciansMapError = 'No hay técnicos con ubicación registrada.';
                return;
            }

            setTimeout(() => this.initTechniciansMap(), 0);
        } catch (error) {
            console.error('Error loading technicians map:', error);
            this.techniciansMapLoading = false;
            this.techniciansMapError = 'No se pudieron cargar las ubicaciones de los técnicos.';
        }
    }

    async initTechniciansMap(): Promise<void> {
        if (!this.techniciansWithLocation.length) return;

        try {
            const mapElement = document.getElementById('technicians-map');
            if (!mapElement) return;

            const firstLocation = this.techniciansWithLocation[0].location;
            this.destroyTechniciansMap();
            this.techniciansMap = MapUtils.createMap(
                'osm',
                mapElement,
                '',
                'light',
                Number(firstLocation.latitude),
                Number(firstLocation.longitude),
                12
            );

            const bounds = new maplibregl.LngLatBounds();

            this.techniciansWithLocation.forEach(({ technician, location }) => {
                const latitude = Number(location.latitude);
                const longitude = Number(location.longitude);
                bounds.extend([longitude, latitude]);
                this.techniciansMapMarkers.push(
                    this.createTechnicianMapMarker(
                        { lat: latitude, lng: longitude },
                        this.getTechnicianMarkerLabel(technician, location)
                    )
                );
            });

            if (this.techniciansWithLocation.length === 1) {
                this.techniciansMap.setCenter(bounds.getCenter());
                this.techniciansMap.setZoom(15);
                return;
            }

            this.techniciansMap.fitBounds(bounds, { padding: 64, maxZoom: 15 });
        } catch (error) {
            console.error('Error rendering technicians map:', error);
            this.techniciansMapError = 'No se pudo mostrar el mapa de técnicos.';
        }
    }

    getTechnicianName(technician: User): string {
        return `${technician?.name || ''} ${technician?.last_name || ''}`.replace(/\s+/g, ' ').trim()
            || technician?.email
            || 'Técnico';
    }

    getTechnicianMarkerLabel(technician: User, location: UserLatestLocation): string {
        return `${this.getTechnicianName(technician)} · ${this.getRelativeLocationAge(location?.recordedAt)}`;
    }

    onTechniciansMapHide(): void {
        this.destroyTechniciansMap();
    }

    private destroyTechniciansMap(): void {
        this.techniciansMapMarkers.forEach(marker => marker?.remove?.());
        this.techniciansMapMarkers = [];
        this.techniciansMap?.remove?.();
        this.techniciansMap = null;
    }

    private createTechnicianMapMarker(position: { lat: number; lng: number }, text: string): maplibregl.Marker {
        const element = document.createElement('div');
        element.className = 'sol-tech-map-marker';
        element.title = text;

        const pin = document.createElement('span');
        pin.className = 'sol-tech-map-marker__pin';
        pin.innerHTML = '<i class="pi pi-user"></i>';

        const label = document.createElement('div');
        label.className = 'sol-tech-map-label';
        label.textContent = text;

        element.append(pin, label);
        return new maplibregl.Marker({ element, anchor: 'bottom' })
            .setLngLat([position.lng, position.lat])
            .addTo(this.techniciansMap);
    }

    private getRelativeLocationAge(recordedAt?: string | Date): string {
        if (!recordedAt) return 'sin fecha';
        const date = new Date(recordedAt);
        if (Number.isNaN(date.getTime())) return 'sin fecha';

        const diffMs = Math.max(0, Date.now() - date.getTime());
        const diffMinutes = Math.floor(diffMs / 60000);
        if (diffMinutes < 1) return 'ahora';
        if (diffMinutes === 1) return 'hace 1 minuto';
        if (diffMinutes < 60) return `hace ${diffMinutes} minutos`;

        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours === 1) return 'hace 1 hora';
        if (diffHours < 24) return `hace ${diffHours} horas`;

        const diffDays = Math.floor(diffHours / 24);
        if (diffDays === 1) return 'hace 1 día';
        return `hace ${diffDays} días`;
    }

    verifyTechnicianAvailability(): void {
        const solicitud = this.selectedTechnicianSolicitud;
        if (!solicitud?._id) return;

        const previousResponse = solicitud.technician_response;
        this.verifyingAvailabilityId = solicitud._id;
        solicitud.technician_response = 'verificando';

        this.solicitudesService.verifyAvailability(solicitud._id).subscribe({
            next: (updated) => {
                this.upsertSolicitud(updated);
                this.selectedTechnicianSolicitud = updated;
                this.verifyingAvailabilityId = '';
                this.messageService.add({
                    severity: 'success',
                    summary: 'Verificando disponibilidad',
                    detail: 'La llamada al técnico fue iniciada.'
                });
                this.realtimeStateVersion = '';
                this.restartRealtimeRefresh();
            },
            error: (error) => {
                solicitud.technician_response = previousResponse;
                this.verifyingAvailabilityId = '';
                const detail = error?.error?.message || 'No se pudo iniciar la llamada de disponibilidad.';
                this.messageService.add({ severity: 'error', summary: 'No se pudo llamar', detail });
            }
        });
    }

    hasAvailabilityCall(solicitud: Solicitud | null): boolean {
        return !!(solicitud?.technician_response_call_id || solicitud?.technician_response_transcript);
    }

    openAvailabilityTranscript(): void {
        const solicitud = this.selectedTechnicianSolicitud;
        if (!solicitud) return;

        const localTranscript = solicitud.technician_response_transcript || (solicitud as any)._availabilityTranscript || '';
        if (localTranscript) {
            this.setAvailabilityTranscript(localTranscript);
            this.availabilityTranscriptDialogVisible = true;
            return;
        }

        this.loadAvailabilityCallDetails(solicitud, (details) => {
            const transcript = details.transcript || '';
            if (!transcript) {
                this.messageService.add({
                    severity: 'info',
                    summary: 'Transcripción no disponible',
                    detail: 'La llamada aún no tiene transcripción disponible.'
                });
                return;
            }
            this.setAvailabilityTranscript(transcript);
            this.availabilityTranscriptDialogVisible = true;
        });
    }

    private setAvailabilityTranscript(transcript: string): void {
        this.availabilityTranscriptText = transcript || '';
        this.availabilityTranscriptMessages = this.parseAvailabilityTranscript(transcript || '');
    }

    private parseAvailabilityTranscript(transcript: string): AvailabilityTranscriptMessage[] {
        const lines = String(transcript || '')
            .replace(/\r/g, '\n')
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean);
        const messages: AvailabilityTranscriptMessage[] = [];
        let current: AvailabilityTranscriptMessage | null = null;

        const pushCurrent = () => {
            if (!current?.text?.trim()) return;
            current.text = current.text.trim();
            messages.push(current);
            current = null;
        };

        for (const line of lines) {
            const match = line.match(/^([A-Za-zÁÉÍÓÚÜÑáéíóúüñ _.-]{2,36})\s*:\s*(.+)$/);
            if (match) {
                pushCurrent();
                const speaker = this.normalizeTranscriptSpeaker(match[1]);
                current = {
                    speaker: speaker.speaker,
                    side: speaker.side,
                    text: match[2],
                };
                continue;
            }

            if (!current) {
                current = {
                    speaker: 'Técnico',
                    side: 'technician',
                    text: line,
                };
            } else {
                current.text = `${current.text}\n${line}`;
            }
        }

        pushCurrent();
        return messages;
    }

    private normalizeTranscriptSpeaker(rawSpeaker: string): { speaker: string; side: 'ester' | 'technician' } {
        const speaker = String(rawSpeaker || '').trim();
        const normalized = speaker.toLowerCase();
        const isEster = [
            'ia',
            'ai',
            'assistant',
            'asistente',
            'bot',
            'ester',
            'vapi',
            'agent',
            'agente',
        ].some(token => normalized === token || normalized.includes(token));

        return isEster
            ? { speaker: 'Ester', side: 'ester' }
            : { speaker: speaker || 'Técnico', side: 'technician' };
    }

    openAvailabilityRecording(): void {
        const solicitud = this.selectedTechnicianSolicitud;
        if (!solicitud?.technician_response_call_id) return;

        const localRecording = (solicitud as any)._availabilityRecordingUrl || '';
        if (localRecording) {
            this.showAvailabilityRecording(localRecording, solicitud);
            return;
        }

        this.loadAvailabilityCallDetails(solicitud, (details) => {
            if (!details.recordingUrl) {
                this.messageService.add({
                    severity: 'info',
                    summary: 'Audio no disponible',
                    detail: details.status === 'ended'
                        ? 'La grabación aún se está procesando. Intenta en unos minutos.'
                        : 'La llamada aún no tiene audio disponible.'
                });
                return;
            }
            this.showAvailabilityRecording(details.recordingUrl, solicitud);
        });
    }

    isAvailabilityCallLoading(solicitud: Solicitud | null): boolean {
        return !!solicitud?.technician_response_call_id && this.availabilityCallLoadingId === solicitud.technician_response_call_id;
    }

    private loadAvailabilityCallDetails(solicitud: Solicitud, callback: (details: VapiCallDetails) => void): void {
        const callId = solicitud.technician_response_call_id;
        if (!callId || this.availabilityCallLoadingId) return;

        this.availabilityCallLoadingId = callId;
        this.solicitudesService.getAvailabilityCallDetails(callId).subscribe({
            next: (details) => {
                this.availabilityCallLoadingId = '';
                if (!details?.success) {
                    this.messageService.add({
                        severity: 'error',
                        summary: 'No se pudo cargar',
                        detail: details?.error || 'No se pudieron obtener los detalles de la llamada.'
                    });
                    return;
                }
                (solicitud as any)._availabilityRecordingUrl = details.recordingUrl || '';
                (solicitud as any)._availabilityTranscript = details.transcript || solicitud.technician_response_transcript || '';
                (solicitud as any)._availabilityCallStatus = details.status || '';
                (solicitud as any)._availabilityCallDuration = details.duration;
                if (details.transcript && !solicitud.technician_response_transcript) {
                    solicitud.technician_response_transcript = details.transcript;
                }
                callback(details);
            },
            error: (error) => {
                this.availabilityCallLoadingId = '';
                this.messageService.add({
                    severity: 'error',
                    summary: 'No se pudo cargar',
                    detail: error?.error?.message || 'Error consultando la llamada.'
                });
            }
        });
    }

    private showAvailabilityRecording(recordingUrl: string, solicitud: Solicitud): void {
        this.availabilityCallRecordingUrl = solicitud.technician_response_call_id
            ? this.solicitudesService.getAvailabilityCallAudioUrl(solicitud.technician_response_call_id)
            : recordingUrl;
        this.availabilityCallStatus = (solicitud as any)._availabilityCallStatus || '';
        this.availabilityCallDuration = (solicitud as any)._availabilityCallDuration;
        this.availabilityCallAudioDialogVisible = true;
    }

    isAvailabilityLoading(solicitud: Solicitud | null): boolean {
        return !!solicitud?._id && (this.verifyingAvailabilityId === solicitud._id || this.isTechnicianVerifying(solicitud));
    }

    private upsertSolicitud(updated: Solicitud): void {
        const index = this.solicitudes.findIndex(sol => sol._id === updated._id);
        if (index >= 0) {
            this.solicitudes = this.solicitudes.map((solicitud, solicitudIndex) =>
                solicitudIndex === index ? updated : solicitud
            );
            return;
        }
        this.solicitudes = [updated, ...this.solicitudes];
    }

    private sortSolicitudesForDisplay(items: Solicitud[]): Solicitud[] {
        return [...items].sort((a, b) => {
            const aUnavailable = this.isTechnicianUnavailable(a) ? 1 : 0;
            const bUnavailable = this.isTechnicianUnavailable(b) ? 1 : 0;
            if (aUnavailable !== bUnavailable) return bUnavailable - aUnavailable;
            return (a.order || 0) - (b.order || 0);
        });
    }

    get filteredSolicitudes(): Solicitud[] {
        const cacheKey = [
            this.topFilterTechnician,
            this.topFilterClient,
            this.topFilterType,
            this.topFilterDateFrom,
            this.topFilterDateTo,
        ].join('|');

        if (
            this.filteredSolicitudesCacheSource === this.solicitudes
            && this.filteredSolicitudesCacheKey === cacheKey
        ) {
            return this.filteredSolicitudesCache;
        }

        this.filteredSolicitudesCacheSource = this.solicitudes;
        this.filteredSolicitudesCacheKey = cacheKey;
        this.filteredSolicitudesCache = this.solicitudes.filter(solicitud =>
            this.matchesTopFilters(solicitud)
        );
        return this.filteredSolicitudesCache;
    }

    private getKanbanColumns(): typeof this.kanbanColumnsCache {
        const filtered = this.filteredSolicitudes;
        if (this.kanbanColumnsCacheSource === filtered) {
            return this.kanbanColumnsCache;
        }

        this.kanbanColumnsCacheSource = filtered;
        this.kanbanColumnsCache = {
            pendientes: this.sortSolicitudesForDisplay(filtered.filter(solicitud =>
                solicitud.status === 'pendiente'
                || solicitud.status === 'aceptada'
                || (solicitud.status === 'rechazada' && !this.isAdministrativeRejection(solicitud))
            )),
            enProgreso: this.sortSolicitudesForDisplay(filtered.filter(solicitud =>
                solicitud.status === 'en_progreso'
            )),
            porConfirmar: this.sortSolicitudesForDisplay(filtered.filter(solicitud =>
                solicitud.status === 'por_confirmar'
            )),
            completadas: this.sortSolicitudesForDisplay(filtered.filter(solicitud =>
                solicitud.status === 'completada'
                || solicitud.status === 'cancelada'
                || this.isAdministrativeRejection(solicitud)
            )),
        };
        return this.kanbanColumnsCache;
    }

    private matchesTopFilters(solicitud: Solicitud): boolean {
        if (this.topFilterTechnician === '__unassigned__' && solicitud.mechanic_id) {
            return false;
        }
        if (
            this.topFilterTechnician
            && this.topFilterTechnician !== '__unassigned__'
            && solicitud.mechanic_id !== this.topFilterTechnician
        ) {
            return false;
        }
        if (this.topFilterClient && this.getClientFilterKey(solicitud) !== this.topFilterClient) {
            return false;
        }
        if (this.topFilterType && solicitud.type !== this.topFilterType) {
            return false;
        }

        if (!this.hasInvalidTopFilterDateRange && (this.topFilterDateFrom || this.topFilterDateTo)) {
            const scheduledDate = this.getScheduledDateFilterKey(solicitud);
            if (!scheduledDate) return false;
            if (this.topFilterDateFrom && scheduledDate < this.topFilterDateFrom) return false;
            if (this.topFilterDateTo && scheduledDate > this.topFilterDateTo) return false;
        }
        return true;
    }

    get topFilterTechnicianOptions(): SelectOption[] {
        if (
            this.topFilterTechnicianOptionsCacheTechnicians === this.availableTechnicians
            && this.topFilterTechnicianOptionsCacheSolicitudes === this.solicitudes
        ) {
            return this.topFilterTechnicianOptionsCache;
        }

        const options = this.availableTechnicians
            .map(technician => ({
                value: String(technician._id || technician.id || ''),
                label: `${technician.name || ''} ${technician.last_name || ''}`.trim()
                    || technician.email
                    || 'Técnico asignado',
            }))
            .filter(option => option.value)
            .sort((a, b) => a.label.localeCompare(b.label));

        if (this.solicitudes.some(solicitud => !solicitud.mechanic_id)) {
            options.unshift({ value: '__unassigned__', label: 'Sin técnico asignado' });
        }
        this.topFilterTechnicianOptionsCacheTechnicians = this.availableTechnicians;
        this.topFilterTechnicianOptionsCacheSolicitudes = this.solicitudes;
        this.topFilterTechnicianOptionsCache = options;
        return this.topFilterTechnicianOptionsCache;
    }

    get topFilterClientOptions(): SelectOption[] {
        if (this.topFilterClientOptionsCacheSource === this.solicitudes) {
            return this.topFilterClientOptionsCache;
        }

        const clients = new Map<string, string>();
        for (const solicitud of this.solicitudes) {
            const value = this.getClientFilterKey(solicitud);
            const label = this.getClientDisplayName(solicitud)
                || solicitud.client_email
                || solicitud.client_phone
                || 'Sin cliente identificado';
            if (!clients.has(value) || clients.get(value) === 'Sin cliente identificado') {
                clients.set(value, label);
            }
        }
        this.topFilterClientOptionsCacheSource = this.solicitudes;
        this.topFilterClientOptionsCache = [...clients.entries()]
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => a.label.localeCompare(b.label));
        return this.topFilterClientOptionsCache;
    }

    get hasInvalidTopFilterDateRange(): boolean {
        return !!this.topFilterDateFrom
            && !!this.topFilterDateTo
            && this.topFilterDateFrom > this.topFilterDateTo;
    }

    get activeTopFilterCount(): number {
        return [
            this.topFilterTechnician,
            this.topFilterClient,
            this.topFilterType,
            this.topFilterDateFrom,
            this.topFilterDateTo,
        ].filter(Boolean).length;
    }

    clearTopFilters(): void {
        this.topFilterTechnician = '';
        this.topFilterClient = '';
        this.topFilterType = '';
        this.topFilterDateFrom = '';
        this.topFilterDateTo = '';
    }

    trackBySelectOption(index: number, option: SelectOption): string | number {
        return option?.value || index;
    }

    trackBySolicitud(index: number, solicitud: Solicitud): string | number {
        return solicitud?._id || index;
    }

    trackByInstallation(index: number, installation: InstallationDetail): string {
        const installationId = String((installation as any)?._id || '').trim();
        if (installationId) return installationId;
        return [
            installation?.device_imei,
            installation?.new_device_imei,
            installation?.plate,
            index,
        ].filter(value => value !== undefined && value !== null).join('|');
    }

    get calendarTechnicianOptions(): SelectOption[] {
        const options = this.topFilterTechnicianOptions;
        if (this.calendarTechnicianOptionsCacheSource === options) {
            return this.calendarTechnicianOptionsCache;
        }
        this.calendarTechnicianOptionsCacheSource = options;
        this.calendarTechnicianOptionsCache = options.filter(
            option => option.value !== '__unassigned__',
        );
        return this.calendarTechnicianOptionsCache;
    }

    openSolicitudCalendar(): void {
        const today = new Date();
        this.calendarCurrentMonth = new Date(
            today.getFullYear(),
            today.getMonth(),
            1,
        );
        this.calendarTechnicianFilter =
            this.topFilterTechnician
            && this.topFilterTechnician !== '__unassigned__'
                ? this.topFilterTechnician
                : '';
        this.refreshSolicitudCalendar();
        this.calendarDialogVisible = true;
    }

    changeSolicitudCalendarMonth(monthOffset: number): void {
        this.calendarCurrentMonth = new Date(
            this.calendarCurrentMonth.getFullYear(),
            this.calendarCurrentMonth.getMonth() + monthOffset,
            1,
        );
        this.refreshSolicitudCalendar();
    }

    goToCurrentSolicitudCalendarMonth(): void {
        const today = new Date();
        this.calendarCurrentMonth = new Date(
            today.getFullYear(),
            today.getMonth(),
            1,
        );
        this.refreshSolicitudCalendar();
    }

    refreshSolicitudCalendar(): void {
        const year = this.calendarCurrentMonth.getFullYear();
        const month = this.calendarCurrentMonth.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const mondayBasedOffset = (firstDayOfMonth.getDay() + 6) % 7;
        const calendarStart = new Date(year, month, 1 - mondayBasedOffset);
        const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
        const todayKey = this.toLocalDateKey(new Date());
        const scheduledByDay = new Map<string, Solicitud[]>();
        const unscheduled: Solicitud[] = [];
        let monthRequestCount = 0;

        for (const solicitud of this.solicitudes) {
            if (!solicitud.mechanic_id) continue;
            if (
                this.calendarTechnicianFilter
                && solicitud.mechanic_id !== this.calendarTechnicianFilter
            ) {
                continue;
            }

            const dateKey = this.getScheduledDateFilterKey(solicitud);
            if (!dateKey) {
                unscheduled.push(solicitud);
                continue;
            }

            const daySolicitudes = scheduledByDay.get(dateKey) || [];
            daySolicitudes.push(solicitud);
            scheduledByDay.set(dateKey, daySolicitudes);
            if (dateKey.startsWith(currentMonthPrefix)) {
                monthRequestCount += 1;
            }
        }

        for (const daySolicitudes of scheduledByDay.values()) {
            daySolicitudes.sort((first, second) =>
                (this.getSolicitudScheduledDateTime(first)?.getTime() || 0)
                - (this.getSolicitudScheduledDateTime(second)?.getTime() || 0)
            );
        }

        this.calendarDays = Array.from({ length: 42 }, (_, index) => {
            const date = new Date(
                calendarStart.getFullYear(),
                calendarStart.getMonth(),
                calendarStart.getDate() + index,
            );
            const dateKey = this.toLocalDateKey(date);
            return {
                dateKey,
                dayNumber: date.getDate(),
                inCurrentMonth: date.getMonth() === month,
                isToday: dateKey === todayKey,
                solicitudes: scheduledByDay.get(dateKey) || [],
            };
        });
        this.calendarMonthLabel = firstDayOfMonth
            .toLocaleDateString('es-DO', {
                month: 'long',
                year: 'numeric',
            })
            .replace(/^./, character => character.toUpperCase());
        this.calendarMonthRequestCount = monthRequestCount;
        this.calendarUnscheduledSolicitudes =
            this.sortSolicitudesForDisplay(unscheduled);
    }

    getCalendarSolicitudTime(solicitud: Solicitud): string {
        const date = this.getSolicitudScheduledDateTime(solicitud);
        if (!date) return 'Sin hora';
        const pad = (value: number) => String(value).padStart(2, '0');
        return this.formatTimeToTwelveHours(
            `${pad(date.getHours())}:${pad(date.getMinutes())}`,
        );
    }

    getCalendarSolicitudLabel(solicitud: Solicitud): string {
        return [
            this.getCalendarSolicitudTime(solicitud),
            this.getClientDisplayName(solicitud) || 'Sin cliente',
            this.typeLabels[solicitud.type] || solicitud.type,
            this.getTechnicianDisplayName(solicitud),
        ].join(' · ');
    }

    getCalendarTechnicianPhoto(solicitud: Solicitud | null): string | null {
        const photo = String(
            this.getTechnicianById(solicitud?.mechanic_id)?.photo || '',
        ).trim();
        return photo && !this.failedTechnicianPhotos.has(photo) ? photo : null;
    }

    getCalendarTechnicianInitials(solicitud: Solicitud | null): string {
        const words = this.getTechnicianDisplayName(solicitud)
            .split(/\s+/)
            .filter(Boolean);
        if (!words.length) return 'T';
        return `${words[0][0] || ''}${words[1]?.[0] || ''}`.toUpperCase();
    }

    openCalendarTechnicianBreakdown(
        day: SolicitudCalendarDay,
        solicitud: Solicitud,
        event?: Event,
    ): void {
        event?.stopPropagation();
        const technicianId = solicitud.mechanic_id;
        if (!technicianId) return;

        this.calendarBreakdownSolicitudes = day.solicitudes
            .filter(item => item.mechanic_id === technicianId)
            .sort((first, second) =>
                (this.getSolicitudScheduledDateTime(first)?.getTime() || 0)
                - (this.getSolicitudScheduledDateTime(second)?.getTime() || 0)
            );
        this.calendarBreakdownDateLabel =
            this.formatCalendarDateKey(day.dateKey);
        this.calendarBreakdownTechnicianName =
            this.getTechnicianDisplayName(solicitud);
        this.calendarBreakdownTechnicianPhoto =
            this.getCalendarTechnicianPhoto(solicitud);
        this.calendarBreakdownDialogVisible = true;
    }

    get calendarBreakdownCompletedCount(): number {
        return this.calendarBreakdownSolicitudes.filter(
            solicitud =>
                solicitud.status === 'por_confirmar'
                || solicitud.status === 'completada',
        ).length;
    }

    get calendarBreakdownPendingCount(): number {
        return this.calendarBreakdownSolicitudes.filter(
            solicitud =>
                solicitud.status !== 'por_confirmar'
                && solicitud.status !== 'completada'
                && solicitud.status !== 'cancelada',
        ).length;
    }

    get calendarBreakdownCancelledCount(): number {
        return this.calendarBreakdownSolicitudes.filter(
            solicitud => solicitud.status === 'cancelada',
        ).length;
    }

    getCalendarActivityLabel(solicitud: Solicitud): string {
        if (
            solicitud.status === 'por_confirmar'
            || solicitud.status === 'completada'
        ) {
            return 'Trabajo realizado';
        }
        if (solicitud.status === 'cancelada') return 'Trabajo cancelado';
        return 'Trabajo programado';
    }

    getCalendarWorkItems(
        solicitud: Solicitud,
    ): SolicitudCalendarWorkItem[] {
        const installations = solicitud.installations || [];
        const defaultState = this.getCalendarWorkState(solicitud);
        if (!installations.length) {
            return [{
                label: `${this.typeLabels[solicitud.type] || solicitud.type || 'Proceso'} x${solicitud.quantity || 1}`,
                detail: 'Sin vehículo o dispositivo especificado',
                state: defaultState,
            }];
        }

        return installations.map((installation, index) => {
            const processType = this.getProcessTypeForSolicitud(
                solicitud,
                installation,
            );
            const vehicle = [
                installation.plate,
                this.getBrandName(installation.brand) !== '—'
                    ? this.getBrandName(installation.brand)
                    : '',
                this.getModelName(installation.brand, installation.model),
                installation.year,
            ].filter(Boolean).join(' ');
            const imei =
                installation.new_device_imei
                || installation.device_imei
                || '';
            const detail = [
                vehicle || `Proceso #${index + 1}`,
                imei ? `IMEI ${imei}` : '',
            ].filter(Boolean).join(' · ');
            const state: SolicitudCalendarWorkItem['state'] =
                installation.cancelled
                    ? 'cancelled'
                    : installation.completed
                        ? 'completed'
                        : defaultState;
            return {
                label: this.typeLabels[processType] || processType || 'Proceso',
                detail,
                state,
            };
        });
    }

    getCalendarSolicitudLocation(solicitud: Solicitud): string {
        return this.getExportLocation(solicitud);
    }

    getCalendarWorkState(
        solicitud: Solicitud,
    ): SolicitudCalendarWorkItem['state'] {
        if (solicitud.status === 'cancelada') return 'cancelled';
        if (
            solicitud.status === 'por_confirmar'
            || solicitud.status === 'completada'
        ) {
            return 'completed';
        }
        return 'pending';
    }

    private formatCalendarDateKey(dateKey: string): string {
        const [year, month, day] = dateKey.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        if (Number.isNaN(date.getTime())) return dateKey;
        return date.toLocaleDateString('es-DO', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        }).replace(/^./, character => character.toUpperCase());
    }

    openSolicitudFromCalendar(
        solicitud: Solicitud,
        event?: Event,
    ): void {
        event?.stopPropagation();
        this.calendarDialogVisible = false;
        this.calendarBreakdownDialogVisible = false;
        void this.editSolicitud(solicitud);
    }

    async exportSolicitudes(format: SolicitudExportFormat): Promise<void> {
        if (this.exportingSolicitudesFormat) return;

        this.exportingSolicitudesFormat = format;
        try {
            const filteredSolicitudes = this.filterSolicitudesForExport(this.solicitudes);
            const solicitudes = format === 'pdf'
                ? filteredSolicitudes.filter(solicitud => this.isSolicitudClosed(solicitud))
                : filteredSolicitudes;

            if (!solicitudes.length) {
                this.messageService.add({
                    severity: 'warn',
                    summary: format === 'pdf' ? 'Sin solicitudes finalizadas' : 'Sin solicitudes',
                    detail: format === 'pdf'
                        ? 'No hay solicitudes completadas o canceladas que coincidan con los filtros seleccionados.'
                        : 'No hay solicitudes que coincidan con los filtros seleccionados.',
                });
                return;
            }

            await new Promise<void>(resolve => setTimeout(resolve, 0));
            if (format === 'pdf') {
                this.generateSolicitudesPdf(solicitudes);
            } else {
                this.generateSolicitudesExcel(solicitudes);
            }

            this.messageService.add({
                severity: 'success',
                summary: format === 'pdf' ? 'PDF generado' : 'Excel generado',
                detail: `Se exportaron ${solicitudes.length} solicitudes.`,
            });
        } catch (error) {
            console.error('Error exporting solicitudes:', error);
            this.messageService.add({
                severity: 'error',
                summary: 'No se pudo generar el archivo',
                detail: 'Ocurrió un error al generar el reporte de solicitudes. Inténtalo nuevamente.',
            });
        } finally {
            this.exportingSolicitudesFormat = null;
        }
    }

    private filterSolicitudesForExport(solicitudes: Solicitud[]): Solicitud[] {
        return solicitudes
            .filter(solicitud => this.matchesTopFilters(solicitud))
            .sort((left, right) => this.getSolicitudExportTimestamp(right) - this.getSolicitudExportTimestamp(left));
    }

    private generateSolicitudesPdf(solicitudes: Solicitud[]): void {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const generatedAt = this.formatExportDate(new Date());

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(17);
        doc.setTextColor(31, 41, 55);
        doc.text('Solicitudes finalizadas', 14, 16);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(90, 96, 110);
        doc.text(`Generado: ${generatedAt}`, 14, 23);
        doc.text(`Filtros: ${this.getSolicitudesExportFilterSummary()}`, 14, 29, {
            maxWidth: pageWidth - 28,
        });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(99, 102, 241);
        doc.text(`${solicitudes.length} solicitud${solicitudes.length === 1 ? '' : 'es'}`, pageWidth - 14, 16, {
            align: 'right',
        });

        autoTable(doc, {
            startY: 35,
            head: [['#', 'Finalizada', 'Cliente', 'Tipo', 'Estado', 'Técnico', 'Procesos', 'Ubicación']],
            body: solicitudes.map((solicitud, index) => [
                String(index + 1),
                this.formatExportDate(this.getSolicitudCompletionDate(solicitud)),
                this.getExportClientName(solicitud),
                this.typeLabels[solicitud.type] || solicitud.type || '—',
                this.statusLabels[solicitud.status] || solicitud.status || '—',
                this.getExportTechnicianName(solicitud),
                this.getExportProcesses(solicitud),
                this.getExportLocation(solicitud),
            ]),
            theme: 'grid',
            styles: {
                fontSize: 7.2,
                cellPadding: 1.8,
                overflow: 'linebreak',
                valign: 'top',
                lineColor: [224, 226, 232],
                lineWidth: 0.15,
            },
            headStyles: {
                fillColor: [99, 102, 241],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
            },
            alternateRowStyles: {
                fillColor: [247, 248, 252],
            },
            columnStyles: {
                0: { cellWidth: 9, halign: 'center' },
                1: { cellWidth: 28 },
                2: { cellWidth: 39 },
                3: { cellWidth: 25 },
                4: { cellWidth: 22 },
                5: { cellWidth: 35 },
                6: { cellWidth: 49 },
                7: { cellWidth: 44 },
            },
            margin: { left: 14, right: 14, bottom: 13 },
            didDrawPage: () => {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7.5);
                doc.setTextColor(120, 124, 134);
                doc.text(
                    `Página ${doc.getCurrentPageInfo().pageNumber}`,
                    pageWidth - 14,
                    pageHeight - 7,
                    { align: 'right' },
                );
            },
        });

        doc.save(`solicitudes_finalizadas_${this.toLocalDateKey(new Date())}.pdf`);
    }

    private generateSolicitudesExcel(solicitudes: Solicitud[]): void {
        const headers = [
            '#',
            'Fecha de creación',
            'Fecha programada',
            'Fecha finalización',
            'Cliente',
            'Teléfono',
            'Correo',
            'Tipo',
            'Estado',
            'Cantidad',
            'Técnico',
            'Ubicación',
            'Procesos',
            'Descripción',
            'Notas',
            'Razón de cancelación',
        ];
        const rows = solicitudes.map((solicitud, index) => [
            index + 1,
            this.formatExportDate(solicitud.createdAt),
            this.formatExportDate(solicitud.scheduled_date || solicitud.installations?.[0]?.scheduled_date),
            this.formatExportDate(this.getSolicitudCompletionDate(solicitud)),
            this.getExportClientName(solicitud),
            solicitud.client_phone || '',
            solicitud.client_email || '',
            this.typeLabels[solicitud.type] || solicitud.type || '',
            this.statusLabels[solicitud.status] || solicitud.status || '',
            solicitud.quantity || solicitud.installations?.length || 1,
            this.getExportTechnicianName(solicitud),
            this.getExportLocation(solicitud),
            this.getExportProcesses(solicitud),
            solicitud.description || '',
            solicitud.notes || '',
            solicitud.cancellation_reason || '',
        ]);
        const worksheet = XLSX.utils.aoa_to_sheet([
            ['Reporte de solicitudes'],
            [`Generado: ${this.formatExportDate(new Date())}`],
            [`Filtros: ${this.getSolicitudesExportFilterSummary()}`],
            headers,
            ...rows,
        ]);
        const lastColumn = XLSX.utils.encode_col(headers.length - 1);
        const lastRow = rows.length + 4;

        worksheet['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
            { s: { r: 2, c: 0 }, e: { r: 2, c: headers.length - 1 } },
        ];
        worksheet['!autofilter'] = { ref: `A4:${lastColumn}${lastRow}` };
        worksheet['!cols'] = [
            { wch: 7 },
            { wch: 22 },
            { wch: 22 },
            { wch: 22 },
            { wch: 28 },
            { wch: 16 },
            { wch: 28 },
            { wch: 20 },
            { wch: 14 },
            { wch: 10 },
            { wch: 26 },
            { wch: 34 },
            { wch: 48 },
            { wch: 40 },
            { wch: 40 },
            { wch: 38 },
        ];

        const titleCell = worksheet['A1'];
        if (titleCell) {
            titleCell.s = {
                fill: { fgColor: { rgb: '4F46E5' } },
                font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 16 },
                alignment: { horizontal: 'left', vertical: 'center' },
            };
        }
        ['A2', 'A3'].forEach(reference => {
            if (worksheet[reference]) {
                worksheet[reference].s = {
                    fill: { fgColor: { rgb: 'EEF2FF' } },
                    font: { color: { rgb: '4B5563' }, italic: true, sz: 10 },
                };
            }
        });
        headers.forEach((_, columnIndex) => {
            const cell = worksheet[`${XLSX.utils.encode_col(columnIndex)}4`];
            if (cell) {
                cell.s = {
                    fill: { fgColor: { rgb: '6366F1' } },
                    font: { color: { rgb: 'FFFFFF' }, bold: true },
                    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
                    border: {
                        top: { style: 'thin', color: { rgb: '4F46E5' } },
                        bottom: { style: 'thin', color: { rgb: '4F46E5' } },
                        left: { style: 'thin', color: { rgb: '818CF8' } },
                        right: { style: 'thin', color: { rgb: '818CF8' } },
                    },
                };
            }
        });

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Solicitudes');
        XLSX.writeFile(workbook, `solicitudes_${this.toLocalDateKey(new Date())}.xlsx`);
    }

    private getSolicitudesExportFilterSummary(): string {
        const filters: string[] = [];
        if (this.topFilterTechnician) {
            filters.push(`Técnico: ${
                this.topFilterTechnicianOptions.find(option => option.value === this.topFilterTechnician)?.label
                || this.topFilterTechnician
            }`);
        }
        if (this.topFilterClient) {
            filters.push(`Cliente: ${
                this.topFilterClientOptions.find(option => option.value === this.topFilterClient)?.label
                || this.topFilterClient
            }`);
        }
        if (this.topFilterType) {
            filters.push(`Tipo: ${this.typeLabels[this.topFilterType] || this.topFilterType}`);
        }
        if (this.topFilterDateFrom) filters.push(`Desde: ${this.topFilterDateFrom}`);
        if (this.topFilterDateTo) filters.push(`Hasta: ${this.topFilterDateTo}`);
        return filters.length ? filters.join(' · ') : 'Todos';
    }

    private getSolicitudCompletionDate(solicitud: Solicitud): string | Date | undefined {
        if (solicitud.completed_date) return solicitud.completed_date;
        if (
            solicitud.status === 'por_confirmar'
            || solicitud.status === 'completada'
            || solicitud.status === 'cancelada'
        ) {
            return solicitud.updatedAt;
        }
        return undefined;
    }

    private getSolicitudExportTimestamp(solicitud: Solicitud): number {
        const value = this.getSolicitudCompletionDate(solicitud)
            || solicitud.scheduled_date
            || solicitud.installations?.[0]?.scheduled_date
            || solicitud.updatedAt
            || solicitud.createdAt;
        const date = new Date(value || 0);
        return Number.isNaN(date.getTime()) ? 0 : date.getTime();
    }

    private getExportClientName(solicitud: Solicitud): string {
        return this.getClientDisplayName(solicitud)
            || solicitud.client_email
            || solicitud.client_phone
            || 'Sin cliente identificado';
    }

    private getExportTechnicianName(solicitud: Solicitud): string {
        if (!solicitud.mechanic_id) return 'Sin técnico asignado';
        const technician = this.getTechnicianById(solicitud.mechanic_id);
        return technician ? this.getTechnicianName(technician) : 'Técnico no disponible';
    }

    private getExportProcesses(solicitud: Solicitud): string {
        const installations = solicitud.installations || [];
        if (!installations.length) {
            return `${this.typeLabels[solicitud.type] || solicitud.type || 'Proceso'} x${solicitud.quantity || 1}`;
        }

        return installations.map((installation, index) => {
            const type = installation.process_type || solicitud.type;
            const details = [
                installation.plate ? `placa ${installation.plate}` : '',
                installation.device_imei ? `IMEI ${installation.device_imei}` : '',
            ].filter(Boolean);
            return `${this.typeLabels[type] || type || 'Proceso'} #${index + 1}${
                details.length ? ` (${details.join(', ')})` : ''
            }`;
        }).join(' | ');
    }

    private getExportLocation(solicitud: Solicitud): string {
        const installation = solicitud.installations?.[0];
        const address = solicitud.location_address || installation?.location_address;
        if (address) return address;

        const legacyAddress = String(installation?.installation_location || '').trim();
        if (
            legacyAddress &&
            !this.installationLocations.some(option => option.value === legacyAddress)
        ) {
            return legacyAddress;
        }

        const zone = [
            solicitud.sector || installation?.sector,
            solicitud.municipality || installation?.municipality,
            solicitud.province || installation?.province,
        ].filter(Boolean).join(', ');
        if (zone) return zone;

        const latitude = solicitud.latitude ?? installation?.latitude;
        const longitude = solicitud.longitude ?? installation?.longitude;
        return latitude != null && longitude != null ? `${latitude}, ${longitude}` : 'Sin ubicación';
    }

    private formatExportDate(value?: string | Date): string {
        if (!value) return '—';
        let date: Date;
        if (value instanceof Date) {
            date = value;
        } else {
            const localDateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            date = localDateOnly
                ? new Date(
                    Number(localDateOnly[1]),
                    Number(localDateOnly[2]) - 1,
                    Number(localDateOnly[3]),
                )
                : new Date(value);
        }
        if (Number.isNaN(date.getTime())) return String(value);
        return date.toLocaleString('es-DO', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
    }

    private initializeTopDateFilters(): void {
        const today = new Date();
        const tenDaysAgo = new Date(today);
        const fiveDaysAhead = new Date(today);
        tenDaysAgo.setDate(today.getDate() - 10);
        fiveDaysAhead.setDate(today.getDate() + 5);

        this.topFilterDateFrom = this.toLocalDateKey(tenDaysAgo);
        this.topFilterDateTo = this.toLocalDateKey(fiveDaysAhead);
    }

    private getClientFilterKey(solicitud: Solicitud): string {
        if (solicitud.user_id) return `user:${solicitud.user_id}`;
        const email = String(solicitud.client_email || '').trim().toLowerCase();
        if (email) return `email:${email}`;
        const phone = String(solicitud.client_phone || '').replace(/\D/g, '');
        if (phone) return `phone:${phone}`;
        const name = this.normalizeFilterText(this.getClientDisplayName(solicitud));
        return name ? `name:${name}` : '__unidentified__';
    }

    private getScheduledDateFilterKey(solicitud: Solicitud): string {
        const value = solicitud.scheduled_date || solicitud.installations?.[0]?.scheduled_date;
        if (!value) return '';

        if (value instanceof Date) {
            return this.toLocalDateKey(value);
        }

        const raw = String(value).trim();
        const datePrefix = raw.match(/^(\d{4}-\d{2}-\d{2})/);
        const hasExplicitTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
        if (datePrefix && !hasExplicitTimezone) {
            return datePrefix[1];
        }

        const date = new Date(raw);
        return Number.isNaN(date.getTime()) ? '' : this.toLocalDateKey(date);
    }

    private toLocalDateKey(date: Date): string {
        const pad = (value: number) => String(value).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }

    private normalizeFilterText(value?: string): string {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase();
    }

    onSearch(): void {
        this.realtimeStateVersion = '';
        this.loadSolicitudes();
        this.restartRealtimeRefresh();
    }

    clearSearch(): void {
        this.searchQuery = '';
        this.filterType = '';
        this.filterStatus = '';
        this.realtimeStateVersion = '';
        this.loadSolicitudes();
        this.restartRealtimeRefresh();
    }

    countByStatus(status: string): number {
        return this.filteredSolicitudes.filter(s => s.status === status).length;
    }

    getBrandName(brandId?: string): string {
        if (!brandId) return '—';
        const brand = this.availableBrands.find(b => b.value === brandId);
        return brand ? brand.label : brandId;
    }

    getModelName(brandId?: string, modelId?: string): string {
        if (!modelId) return '';
        // Check cache first
        if (this.modelNameCache[modelId]) return this.modelNameCache[modelId];
        // Fallback to currently loaded models
        const model = this.availableModels.find(m => m.value === modelId);
        return model ? model.label : modelId;
    }

    getColorName(hex?: string): string {
        if (!hex) return '';
        const color = this.availableColors.find(c => c.value === hex);
        return color ? color.label : hex;
    }

    getClientDisplayName(sol: Solicitud): string {
        if (sol.client_name) {
            return sol.client_name;
        }
        if (sol.user_id && this.userNameCache[sol.user_id]) {
            return this.userNameCache[sol.user_id];
        }
        return '';
    }

    getSolicitudCreatorName(solicitud?: Solicitud | null): string {
        const savedName = String(solicitud?.created_by_name || '').trim();
        if (savedName) return savedName;

        const creatorId = String(solicitud?.created_by_id || solicitud?.user_id || '').trim();
        if (!creatorId) return '';
        if (this.userNameCache[creatorId]) return this.userNameCache[creatorId];

        const currentUser: any = this.authService.getCurrentUser();
        const currentUserId = String(currentUser?.id || currentUser?._id || '').trim();
        if (currentUserId !== creatorId) return '';

        return [currentUser?.name, currentUser?.last_name]
            .map(value => String(value || '').trim())
            .filter(Boolean)
            .join(' ');
    }

    getSolicitudPrimaryDeviceLabel(solicitud: Solicitud | null): string {
        const installation = solicitud?.installations?.[0];
        if (!installation) return 'Sin dispositivo asignado';

        const vehicleParts = [
            installation.plate,
            this.getBrandName(installation.brand) !== '—' ? this.getBrandName(installation.brand) : '',
            this.getModelName(installation.brand, installation.model),
            installation.year,
        ].filter(Boolean);

        const vehicleLabel = vehicleParts.join(' ').trim();
        const imei = installation.device_imei || installation.new_device_imei || '';

        if (vehicleLabel && imei) return `${vehicleLabel} · IMEI ${imei}`;
        if (vehicleLabel) return vehicleLabel;
        if (imei) return `IMEI ${imei}`;
        return 'Sin dispositivo asignado';
    }

    private resolveUserNames(): void {
        const userIds = [...new Set(
            this.solicitudes
                .flatMap(s => [s.created_by_id, s.user_id])
                .filter((userId): userId is string => !!userId && !this.userNameCache[userId])
        )];
        for (const userId of userIds) {
            this.userService.getById(userId).subscribe({
                next: (user) => {
                    this.userNameCache[userId] = `${user.name} ${user.last_name || ''}`.trim();
                },
                error: () => { /* user not found, keep client_name */ }
            });
        }
    }

    // ====================================
    // INSTALL DIALOG
    // ====================================

    openInstallDialog(solicitud: Solicitud): void {
        if (this.isSolicitudClosed(solicitud)) {
            this.showClosedSolicitudLockedFeedback();
            return;
        }

        this.solicitudToInstall = solicitud;

        // Resolve brand and model names to pre-fill the target name
        let defaultName = '';
        const brandName = this.getBrandName(solicitud.installations?.[0]?.brand);
        if (brandName && brandName !== '—') {
            defaultName = brandName;
        }

        const today = new Date();
        const oneYearLater = new Date(today);
        oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

        this.installData = {
            name: defaultName,
            type: '',
            activation_date: today.toISOString().split('T')[0],
            expiration_date: oneYearLater.toISOString().split('T')[0],
            plan_id: '',
            plan_price_id: '',
            device_imei: solicitud.installations?.[0]?.device_imei || '',
            sim_card_number: solicitud.installations?.[0]?.sim_card_number || '',
            sim_company: solicitud.installations?.[0]?.sim_company || '',
            installation_details: solicitud.installations?.[0]?.installation_details || '',
            parent_id: solicitud.user_id || '',
            parentEmail: '',
            parentUserName: '',
            searchingUser: false,
            userFound: !!solicitud.user_id
        };

        // Load models to resolve model name and append to the target name
        if (solicitud.installations?.[0]?.brand && solicitud.installations?.[0]?.model) {
            this.vehicleBrandsService.getAllModelsByBrand(solicitud.installations[0].brand!).then((models: any[]) => {
                const matched = (models || []).find((m: any) => m._id === solicitud.installations?.[0]?.model);
                if (matched) {
                    this.installData.name = `${defaultName} ${matched.nombre}`.trim();
                }
            }).catch(() => { });
        }

        // Load protocols and plans
        this.protocolsService.getAllProtocols().subscribe({
            next: (protocols) => this.availableProtocols = protocols,
            error: () => console.error('Error loading protocols')
        });
        this.plansService.getAllPlans().subscribe({
            next: (plans) => {
                this.availablePlans = plans;
                // Auto-assign a random plan and its first price
                if (plans.length > 0) {
                    const randomPlan = plans[Math.floor(Math.random() * plans.length)];
                    this.installData.plan_id = randomPlan._id;
                    if (randomPlan.prices && randomPlan.prices.length > 0) {
                        this.installData.plan_price_id = randomPlan.prices[0].id;
                    }
                }
            },
            error: () => console.error('Error loading plans')
        });

        // Resolve user name if user_id exists
        if (solicitud.user_id) {
            this.userService.getById(solicitud.user_id).subscribe({
                next: (user) => {
                    this.installData.parentUserName = `${user.name} ${(user as any).last_name || ''}`.trim();
                    this.installData.parentEmail = (user as any).email || '';
                },
                error: () => {
                    this.installData.parentUserName = 'Usuario no encontrado';
                    this.installData.userFound = false;
                }
            });
        }

        this.installDialogVisible = true;
    }

    searchUserByEmail(): void {
        if (!this.installData.parentEmail) return;
        this.installData.searchingUser = true;
        this.installData.userFound = false;
        this.installData.parent_id = '';
        this.installData.parentUserName = '';

        this.userService.getByEmail(this.installData.parentEmail).subscribe({
            next: (user) => {
                this.installData.parent_id = (user as any)._id || (user as any).id;
                this.installData.parentUserName = `${user.name} ${(user as any).last_name || ''}`.trim();
                this.installData.userFound = true;
                this.installData.searchingUser = false;
            },
            error: () => {
                this.installData.searchingUser = false;
                this.installData.userFound = false;
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Usuario no encontrado con ese correo' });
            }
        });
    }

    getSelectedPlanPrices(): any[] {
        if (!this.installData.plan_id) return [];
        const plan = this.availablePlans.find(p => p._id === this.installData.plan_id);
        return plan?.prices || [];
    }

    async installDevice(): Promise<void> {
        // Validate required fields
        if (!this.installData.name || !this.installData.type || !this.installData.activation_date
            || !this.installData.expiration_date || !this.installData.parent_id
            || !this.installData.device_imei || !this.installData.sim_card_number
            || !this.installData.sim_company) {
            this.messageService.add({ severity: 'warn', summary: 'Campos requeridos', detail: 'Completa todos los campos obligatorios' });
            return;
        }

        const sol = this.solicitudToInstall;
        if (!sol) return;

        if (sol.status !== 'completada') {
            this.confirmSolicitudCompletion(sol, () => {
                void this.performDeviceInstallation();
            });
            return;
        }

        await this.performDeviceInstallation();
    }

    private async performDeviceInstallation(): Promise<void> {
        this.installing = true;
        const sol = this.solicitudToInstall!;
        const currentUser = this.authService.getCurrentUser();

        // Find selected plan and price
        const selectedPlan = this.availablePlans.find(p => p._id === this.installData.plan_id);
        const selectedPrice = selectedPlan?.prices?.find(pr => pr.id === this.installData.plan_price_id);

        // Resolve brand/model/color: solicitudes from Montao Rent may have names instead of IDs
        const isObjectId = (val: string) => /^[0-9a-fA-F]{24}$/.test(val);

        let resolvedBrandId = sol.installations?.[0]?.brand || '';
        let resolvedModelId = sol.installations?.[0]?.model || '';
        let resolvedColor = sol.installations?.[0]?.color || '';

        // Resolve brand name → ID
        if (resolvedBrandId && !isObjectId(resolvedBrandId)) {
            const matchedBrand = this.availableBrands.find(
                b => b.label.toLowerCase() === resolvedBrandId.toLowerCase()
            );
            if (matchedBrand) resolvedBrandId = matchedBrand.value;
        }

        // Resolve model name → ID (need to load models for the brand)
        if (resolvedModelId && !isObjectId(resolvedModelId) && resolvedBrandId && isObjectId(resolvedBrandId)) {
            try {
                const models = await this.vehicleBrandsService.getAllModelsByBrand(resolvedBrandId);
                const matchedModel = (models || []).find(
                    (m: any) => m.nombre.toLowerCase() === resolvedModelId.toLowerCase()
                );
                if (matchedModel) resolvedModelId = matchedModel._id;
            } catch { }
        }

        // Resolve color name → hex value
        if (resolvedColor && !resolvedColor.startsWith('#')) {
            const matchedColor = this.availableColors.find(
                c => c.label.toLowerCase() === resolvedColor.toLowerCase()
            );
            if (matchedColor) resolvedColor = matchedColor.value;
        }

        const targetData: any = {
            name: this.installData.name,
            device_imei: this.installData.device_imei,
            api_device_id: '',
            api_position_id: '',
            type: this.installData.type,
            sim_card_number: this.installData.sim_card_number,
            sim_company: this.installData.sim_company,
            target_plate_number: sol.installations?.[0]?.plate || '',
            target_brand_id: resolvedBrandId,
            target_model_id: resolvedModelId,
            target_color: resolvedColor,
            target_year: sol.installations?.[0]?.year || '',
            target_chassis_number: sol.installations?.[0]?.chassis || '',
            contacts: sol.installations?.[0]?.contacts || '',
            mechanic_id: sol.mechanic_id || '',
            installation_location: sol.installations?.[0]?.installation_location || '',
            engine_shutdown: sol.installations?.[0]?.engine_shutdown || '',
            ignition_sensor: sol.installations?.[0]?.ignition_sensor || '',
            installation_details: this.installData.installation_details,
            activation_date: new Date(this.installData.activation_date),
            expiration_date: new Date(this.installData.expiration_date),
            last_change_date: new Date(),
            status: true,
            canceled: false,
            delete: false,
            index: this.installData.parent_id,
            parent_id: this.installData.parent_id,
            creator_id: currentUser?.id || '',
            plan: {
                id_plan: this.installData.plan_id,
                selected_price: selectedPrice ? {
                    id: selectedPrice.id,
                    amount: selectedPrice.amount,
                    payment_period: String(selectedPrice.payment_period)
                } : undefined
            },
            description: sol.description || ''
        };

        try {
            const createdDevice: any = await this.targetsService.createTarget(targetData);
            const deviceId = createdDevice?._id || createdDevice?.id || '';

            // Complete install: update solicitud status + sync GPS data to Montao Rent vehicle
            if (sol._id) {
                this.solicitudesService.completeInstall(sol._id, deviceId, this.installData.device_imei).subscribe({
                    next: () => this.loadSolicitudes(false),
                    error: () => this.loadSolicitudes(false)
                });
            }

            this.messageService.add({ severity: 'success', summary: 'Éxito', detail: `Dispositivo ${sol.type === 'reinstalacion' ? 'reinstalado' : 'instalado'} correctamente` });
            this.installDialogVisible = false;
        } catch (error: any) {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: error?.error?.message || 'Error al crear el dispositivo' });
        } finally {
            this.installing = false;
        }
    }

    hideInstallDialog(): void {
        this.installDialogVisible = false;
        this.solicitudToInstall = null;
    }

    isSolicitudOverdue(sol: Solicitud, now: Date = new Date()): boolean {
        if (
            !sol
            || sol.status === 'por_confirmar'
            || sol.status === 'completada'
            || sol.status === 'cancelada'
        ) {
            return false;
        }

        const scheduledAt = this.getSolicitudScheduledDateTime(sol);
        return scheduledAt !== null && scheduledAt.getTime() < now.getTime();
    }

    private getSolicitudScheduledDateTime(sol: Solicitud): Date | null {
        const rawDate = sol.scheduled_date || sol.installations?.[0]?.scheduled_date;
        if (!rawDate) return null;

        if (rawDate instanceof Date) {
            return Number.isNaN(rawDate.getTime()) ? null : new Date(rawDate.getTime());
        }

        const value = String(rawDate).trim();
        const localDateTime = value.match(
            /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?$/,
        );
        if (localDateTime) {
            const [, year, month, day, hour, minute, second = '0'] = localDateTime;
            const parsed = new Date(
                Number(year),
                Number(month) - 1,
                Number(day),
                Number(hour),
                Number(minute),
                Number(second),
            );
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }

        const localDateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (localDateOnly) {
            const [, year, month, day] = localDateOnly;
            const parsed = new Date(
                Number(year),
                Number(month) - 1,
                Number(day),
                23,
                59,
                59,
                999,
            );
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }

        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    getSolicitudFinalizedDateDisplay(sol: Solicitud): string {
        const rawDate = sol.completed_date || sol.updatedAt || sol.createdAt;
        if (!rawDate) return '';

        const date = new Date(rawDate);
        if (Number.isNaN(date.getTime())) return '';

        const pad = (value: number) => String(value).padStart(2, '0');
        const formattedDate = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
        const formattedTime = this.formatTimeToTwelveHours(
            `${pad(date.getHours())}:${pad(date.getMinutes())}`,
        );
        return `${formattedDate} a las ${formattedTime}`;
    }

    getScheduledDateDisplay(sol: Solicitud): string {
        const rawDate = sol.scheduled_date || sol.installations?.[0]?.scheduled_date;
        if (!rawDate) return '';

        const dateStr: string = (rawDate instanceof Date) ? rawDate.toISOString() : (rawDate as string);

        let year, month, day, time;
        if (dateStr.includes('T')) {
            const [dObj, tObj] = dateStr.split('T');
            const dateParts = dObj.split('-');
            year = dateParts[0]; month = dateParts[1]; day = dateParts[2];
            time = tObj.substring(0, 5); // Take "HH:mm"
        } else {
            const parts = dateStr.split('-');
            year = parts[0]; month = parts[1]; day = parts[2];
            time = '';
        }

        // Technical date format
        const technicalTime = time ? this.formatTimeToTwelveHours(time) : '';
        const technicalDate = technicalTime
            ? `${day}/${month}/${year} a las ${technicalTime}`
            : `${day}/${month}/${year}`;

        // Natural language
        const targetDate = new Date(Number(year), Number(month) - 1, Number(day));
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        targetDate.setHours(0, 0, 0, 0);

        const diffTime = targetDate.getTime() - today.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        let naturalLanguage = '';
        if (diffDays === 0) naturalLanguage = 'Hoy';
        else if (diffDays === 1) naturalLanguage = 'Mañana';
        else if (diffDays === -1) naturalLanguage = 'Ayer';
        else if (diffDays > 1) naturalLanguage = `En ${diffDays} días`;
        else naturalLanguage = `Hace ${Math.abs(diffDays)} días`;

        return `${naturalLanguage} (${technicalDate})`;
    }

    private formatTimeToTwelveHours(time: string): string {
        const [rawHour, minute = '00'] = time.split(':');
        const hour = Number(rawHour);
        if (!Number.isInteger(hour) || hour < 0 || hour > 23) return time;

        const period = hour >= 12 ? 'p. m.' : 'a. m.';
        const twelveHour = hour % 12 || 12;
        return `${twelveHour}:${minute} ${period}`;
    }
}
