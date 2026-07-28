import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MenuItem, MessageService, ConfirmationService } from 'primeng/api';
import { InstallationDetail, SolicitudesService, Solicitud, VapiCallDetails } from '../../../../../../core/services/solicitudes.service';
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

@Component({
    selector: 'app-solicitudes',
    templateUrl: './solicitudes.component.html',
    styleUrls: ['./solicitudes.component.css'],
    standalone: false,
    encapsulation: ViewEncapsulation.None
})
export class SolicitudesComponent implements OnInit, OnDestroy {
    private readonly solicitudAutocompleteUserId = '68a9ccf19bb280482272477f';
    items: MenuItem[] = [{ label: 'Solicitudes' }];
    home: MenuItem = { icon: 'pi pi-home', routerLink: '/admin/dashboard' };

    solicitudes: Solicitud[] = [];
    
    get pendientes() { return this.sortSolicitudesForDisplay(this.filteredSolicitudes.filter(s => s.status === 'pendiente' || s.status === 'aceptada' || s.status === 'rechazada')); }
    get enProgreso() { return this.sortSolicitudesForDisplay(this.filteredSolicitudes.filter(s => s.status === 'en_progreso')); }
    get porConfirmar() { return this.sortSolicitudesForDisplay(this.filteredSolicitudes.filter(s => s.status === 'por_confirmar')); }
    get completadas() { return this.sortSolicitudesForDisplay(this.filteredSolicitudes.filter(s => s.status === 'completada' || s.status === 'cancelada')); }
    
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
    completionConfirmDialogVisible = false;
    completionSolicitud: Solicitud | null = null;
    private pendingCompletionAction: (() => void) | null = null;
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
    showInstallData = false;
    showDetailsData = false;
    showDiagnosisData = false;
    
    locationMap: any = null;
    locationMarker: any = null;
    availableTechnicians: any[] = [];
    showRootDetailsData = false;
    showInstallationsCards = false;
    loading = false;
    totalItems = 0;
    currentPage = 1;
    private readonly realtimeRefreshMs = 5000;
    private realtimeRefreshTimer?: ReturnType<typeof setInterval>;
    private realtimeStateVersion = '';
    private realtimeStateInFlight = false;
    private solicitudStatusSnapshot = new Map<string, string>();
    private solicitudStartedToastTimer?: ReturnType<typeof setTimeout>;
    solicitudStartedToast: SolicitudStartedToast | null = null;
    technicianDialogVisible = false;
    selectedTechnicianSolicitud: Solicitud | null = null;
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
    clientEmailSuggestions: User[] = [];
    clientSelectionDialogVisible = false;
    newClientDialogVisible = false;
    clientSearchQuery = '';
    clientSearchResults: User[] = [];
    clientSearchTotal = 0;
    clientSearchLoading = false;
    selectedClient: User | null = null;
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
        private router: Router
    ) { }

    ngOnInit(): void {
        this.initializeTopDateFilters();
        this.loadSolicitudes(false);
        this.startRealtimeRefresh();
        this.initialDataPromise = this.loadInitialData();
    }

    ngOnDestroy(): void {
        this.stopRealtimeRefresh();
        this.clearSolicitudStartedToastTimer();
        if (this.clientSearchTimer) {
            clearTimeout(this.clientSearchTimer);
        }
        if (this.newClientLookupTimer) {
            clearTimeout(this.newClientLookupTimer);
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

    geocodeInstLocation(address: string, zoomLevel: number) {
        if (!this.locationMap || typeof google === 'undefined') return;

        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: address + ', República Dominicana' }, (results: any, status: any) => {
            if (status === 'OK' && results && results[0]) {
                const location = results[0].geometry.location;
                // Move map
                this.locationMap.panTo(location);
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

    loadSolicitudes(resetPage = true, options: { silent?: boolean } = {}): void {
        if (resetPage) this.currentPage = 1;
        const silent = options.silent === true;
        if (!silent) {
            this.loading = true;
        }
        this.solicitudesService.getAll({
            type: this.filterType || undefined,
            status: this.filterStatus || undefined,
            search: this.searchQuery || undefined,
            page: this.currentPage,
            limit: 20
        }).subscribe({
            next: (response: { data: Solicitud[]; total: number }) => {
                this.detectSolicitudesStarted(response.data, silent);
                this.solicitudes = response.data;
                this.totalItems = response.total;
                if (!silent) {
                    this.loading = false;
                }
                this.loadModelNamesForTable();
                this.resolveUserNames();
            },
            error: () => {
                if (!silent) {
                    this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las solicitudes' });
                    this.loading = false;
                }
            }
        });
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
        
        this.showRootLocationData = false;
        this.showRootDetailsData = false;
        this.showInstallationsCards = false;
        
        this.rootLocationMap = null;
        this.locationMap = null;
        this.rootGoogleMapsLink = '';
        this.selectedClient = null;
        this.closeClientDialogs();

        this.dialogVisible = true;
        setTimeout(() => this.initRootLocationMap(), 200);
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
        return solicitud?.status === 'completada' || solicitud?.status === 'cancelada';
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
                    ? { process_type: 'instalacion' }
                    : {}
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
            setTimeout(() => this.initLocationMap(), 200);
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

        switch (section) {
            case 'vehicle': this.showVehicleData = !currentlyOpen; break;
            case 'location': 
                this.showLocationData = !currentlyOpen; 
                this.locationMap = null; 
                if (this.showLocationData) { 
                    setTimeout(() => this.initLocationMap(), 300); 
                } 
                break;
            case 'device': this.showDeviceData = !currentlyOpen; break;
            case 'install': this.showInstallData = !currentlyOpen; break;
            case 'details': this.showDetailsData = !currentlyOpen; break;
            case 'diagnosis': this.showDiagnosisData = !currentlyOpen; break;
        }
    }
    
    
    toggleRootLocation(): void {
        const currentlyOpen = this.showRootLocationData;
        this.showRootLocationData = false;
        this.showRootDetailsData = false;
        this.showInstallationsCards = false;

        this.showRootLocationData = !currentlyOpen;
        if (this.showRootLocationData) {
            setTimeout(() => {
                this.initRootLocationMap();
            }, 100);
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
        this.messageService.add({
            severity: 'success',
            summary: 'Cliente seleccionado',
            detail: this.selectedSolicitud.client_name || 'Los datos del cliente fueron aplicados.'
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

    private async applySolicitudClientLocation(user: User): Promise<void> {
        if (!this.selectedSolicitud) return;

        this.clearSolicitudClientLocation();
        const province = String(user.province || '').trim();
        const municipality = String(user.municipality || '').trim();
        const sector = String(user.sector || '').trim();

        this.selectedSolicitud.province = province;
        this.selectedSolicitud.municipality = municipality;
        this.selectedSolicitud.sector = sector;
        this.selectedSolicitud.installations?.forEach(installation => {
            installation.province = province;
            installation.municipality = municipality;
            installation.sector = sector;
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

        const mapsUrl = String(user.static_location_url || '').trim();
        if (mapsUrl) {
            this.rootGoogleMapsLink = mapsUrl;
            this.syncRootGoogleMapsLink(false);
            return;
        }

        const latitude = Number(user.static_latitude);
        const longitude = Number(user.static_longitude);
        if (this.isValidCoordinatePair(latitude, longitude)) {
            this.selectedSolicitud.latitude = latitude;
            this.selectedSolicitud.longitude = longitude;
            this.onRootLatitudeLongitudeChange();
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
        this.selectedSolicitud.installations?.forEach(installation => {
            installation.province = '';
            installation.municipality = '';
            installation.sector = '';
            installation.latitude = undefined;
            installation.longitude = undefined;
            installation.google_maps_url = undefined;
        });
        this.rootLocationMarker?.setMap?.(null);
        this.rootLocationMarker = null;
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
            const systemConfigsResponse = await this.systemService.getAll().toPromise();
            const systemConfigs = systemConfigsResponse?.[0];
            const MAP_API1_KEY = systemConfigs?.map_api1?.key;
            const MAP_API1_URL = systemConfigs?.map_api1?.url;
            if (!MAP_API1_KEY || !MAP_API1_URL) return;
            
            await MapUtils.loadMapScript('google', MAP_API1_KEY, MAP_API1_URL);
            const mapElement = document.getElementById('map-container-root');
            if (!mapElement) return;

            this.rootLocationMap = new google.maps.Map(mapElement, {
                center: { lat: 18.4861, lng: -69.9312 },
                zoom: 13,
                mapTypeId: google.maps.MapTypeId.ROADMAP
            });

            this.rootLocationMap.addListener('click', (e: any) => {
                const lat = e.latLng.lat();
                const lng = e.latLng.lng();
                if (this.selectedSolicitud) {
                    this.selectedSolicitud.latitude = parseFloat(lat.toFixed(6));
                    this.selectedSolicitud.longitude = parseFloat(lng.toFixed(6));
                }
                this.updateRootLocationMarker(lat, lng);
                this.onRootLatitudeLongitudeChange();
            });

            if (this.selectedSolicitud?.latitude && this.selectedSolicitud?.longitude) {
                this.updateRootLocationMarker(this.selectedSolicitud.latitude, this.selectedSolicitud.longitude);
                this.rootLocationMap.setCenter({ lat: this.selectedSolicitud.latitude, lng: this.selectedSolicitud.longitude });
                this.rootLocationMap.setZoom(15);
            }
        } catch (error) {
            console.error('Error loading root location map:', error);
        }
    }

    updateRootLocationMarker(lat: number, lng: number): void {
        if (this.rootLocationMarker) {
            this.rootLocationMarker.setMap(null);
        }
        if (this.rootLocationMap) {
            this.rootLocationMarker = new google.maps.Marker({
                position: { lat, lng },
                map: this.rootLocationMap
            });
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
            this.rootLocationMarker?.setMap?.(null);
            this.rootLocationMarker = null;

            if (showFeedback) {
                this.messageService.add({
                    severity: 'success',
                    summary: 'Link guardado',
                    detail: 'El enlace se conservará para abrirlo directamente en Google Maps.'
                });
            }
            return true;
        }

        this.selectedSolicitud.latitude = coords.lat;
        this.selectedSolicitud.longitude = coords.lng;
        this.onRootLatitudeLongitudeChange();

        if (this.rootLocationMap) {
            this.rootLocationMap.panTo(coords);
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

    geocodeRootLocation(address: string, zoomLevel: number) {
        if (!this.rootLocationMap || typeof google === 'undefined') return;

        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: address + ', República Dominicana' }, (results: any, status: any) => {
            if (status === 'OK' && results && results[0]) {
                const location = results[0].geometry.location;
                // Move map
                this.rootLocationMap.panTo(location);
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
            this.rootLocationMap.panTo({ lat, lng });
        }
    }
async initLocationMap(): Promise<void> {
        try {
            const systemConfigsResponse = await this.systemService.getAll().toPromise();
            const systemConfigs = systemConfigsResponse?.[0];
            const MAP_API1_KEY = systemConfigs?.map_api1?.key;
            if (!MAP_API1_KEY) return;
            
            await MapUtils.loadMapScript('google', MAP_API1_KEY, systemConfigs?.map_api1?.url || 'https://maps.googleapis.com/maps/api/js');
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

                this.locationMap = new google.maps.Map(mapElement, {
                    center: { lat, lng },
                    zoom: zoom,
                    mapTypeControl: false,
                    streetViewControl: false
                });

                if (currentInst?.latitude && currentInst?.longitude) {
                    this.locationMarker = new google.maps.Marker({
                        position: { lat, lng },
                        map: this.locationMap
                    });
                }

                this.locationMap.addListener('click', (e: any) => {
                    const clickLat = e.latLng.lat();
                    const clickLng = e.latLng.lng();
                    
                    if(this.selectedSolicitud?.installations?.[this.editingInstallationIndex]) {
                        this.selectedSolicitud.installations[this.editingInstallationIndex].latitude = clickLat;
                        this.selectedSolicitud.installations[this.editingInstallationIndex].longitude = clickLng;
                    }

                    if (this.locationMarker) {
                        this.locationMarker.setPosition({ lat: clickLat, lng: clickLng });
                    } else {
                        this.locationMarker = new google.maps.Marker({
                            position: { lat: clickLat, lng: clickLng },
                            map: this.locationMap
                        });
                    }
                });
            }
        } catch (error) {
            console.error('Error inicializando el mapa:', error);
        }
    }

    async editSolicitud(solicitud: Solicitud): Promise<void> {
        if (this.initialDataPromise) await this.initialDataPromise;

        if (solicitud.status === 'completada' || solicitud.status === 'cancelada') {
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
        this.selectedSolicitudOriginalStatus = solicitud.status;
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
        setTimeout(() => this.initRootLocationMap(), 200);

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
    }

    closeClosedSolicitudInfo(): void {
        this.closedInfoDialogVisible = false;
        this.closedSolicitud = null;
        this.closedSolicitudLocation = '';
    }

    getClosedSolicitudAddress(solicitud: Solicitud): string {
        return solicitud.installations?.find(installation => installation.installation_location)?.installation_location || '';
    }

    getClosedSolicitudCoordinates(solicitud: Solicitud): string {
        const installation = solicitud.installations?.find(item => item.latitude != null && item.longitude != null);
        const latitude = solicitud.latitude ?? installation?.latitude;
        const longitude = solicitud.longitude ?? installation?.longitude;
        return latitude != null && longitude != null ? `${latitude}, ${longitude}` : '';
    }

    getClosedSolicitudMapsUrl(solicitud: Solicitud): string {
        const coordinates = this.getClosedSolicitudCoordinates(solicitud);
        return coordinates
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordinates)}`
            : '';
    }

    private getClosedLocationFallback(solicitud: Solicitud): string {
        const installation = solicitud.installations?.[0];
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

        if (!this.skipMissingClientCheckOnce && await this.shouldWarnMissingClientOnSave()) {
            this.missingClientDialogVisible = true;
            return;
        }
        this.skipMissingClientCheckOnce = false;
        this.syncSolicitudScheduledDate();

        if (this.selectedSolicitud.status === 'completada' && this.selectedSolicitudOriginalStatus !== 'completada') {
            this.confirmSolicitudCompletion(this.selectedSolicitud, () => this.persistSolicitud());
            return;
        }

        this.persistSolicitud();
    }

    private persistSolicitud(): void {
        if (!this.selectedSolicitud) return;

        if (this.isEditMode && this.selectedSolicitud._id) {
            this.solicitudesService.update(this.selectedSolicitud._id, this.selectedSolicitud).subscribe({
                next: () => {
                    this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Solicitud actualizada' });
                    this.dialogVisible = false;
                    this.loadSolicitudes(false);
                },
                error: () => {
                    this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo actualizar' });
                }
            });
        } else {
            this.solicitudesService.create(this.selectedSolicitud).subscribe({
                next: () => {
                    this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Solicitud creada' });
                    this.dialogVisible = false;
                    this.loadSolicitudes();
                },
                error: () => {
                    this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo crear' });
                }
            });
        }
    }

    async confirmMissingClientAndSave(): Promise<void> {
        this.missingClientDialogVisible = false;
        this.skipMissingClientCheckOnce = true;
        await this.saveSolicitud();
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
            scheduled_date: index === 0 || !installation.scheduled_date ? scheduledDate : installation.scheduled_date
        }));
    }

    private toDateTimeLocalValue(value: string | Date | undefined | null): string {
        if (!value) return '';

        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
            return value;
        }

        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:/.test(value)) {
            return value.slice(0, 16);
        }

        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return '';

        const pad = (part: number) => String(part).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

        this.confirmationService.confirm({
            message: '¿Estás seguro de cancelar esta solicitud?',
            header: 'Confirmar cancelación',
            icon: 'pi pi-exclamation-triangle',
            key: 'solicitudes-confirm',
            accept: () => {
                this.solicitudesService.update(solicitud._id!, { ...solicitud, status: 'cancelada' }).subscribe({
                    next: () => {
                        this.messageService.add({ severity: 'warn', summary: 'Cancelada', detail: 'Solicitud cancelada correctamente' });
                        this.loadSolicitudes(false);
                    },
                    error: () => {
                        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cancelar' });
                    }
                });
            }
        });
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
        this.selectedSolicitud = null;
        this.selectedSolicitudOriginalStatus = '';
        this.deinstallationReasonError = false;
    }

    getStatusIcon(status: string): string {
        const map: Record<string, string> = {
            pendiente: 'pi pi-clock',
            aceptada: 'pi pi-check-circle',
            rechazada: 'pi pi-times-circle',
            en_progreso: 'pi pi-spinner',
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

    isTechnicianVerifying(solicitud: Solicitud | null): boolean {
        return solicitud?.technician_response === 'verificando';
    }

    getTechnicianById(id?: string): User | null {
        if (!id) return null;
        return this.availableTechnicians.find(tech => (tech._id || (tech as any).id) === id) || null;
    }

    getTechnicianDisplayName(solicitud: Solicitud | null): string {
        const technician = this.getTechnicianById(solicitud?.mechanic_id);
        if (!technician) return 'Técnico asignado';
        return `${technician.name || ''} ${technician.last_name || ''}`.trim() || technician.email || 'Técnico asignado';
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
            const systemConfigsResponse = await this.systemService.getAll().toPromise();
            const systemConfigs = systemConfigsResponse?.[0];
            const MAP_API1_KEY = systemConfigs?.map_api1?.key;
            const MAP_API1_URL = systemConfigs?.map_api1?.url;
            if (!MAP_API1_KEY || !MAP_API1_URL) {
                this.technicianLocationError = 'No hay configuración de mapa disponible.';
                return;
            }

            await MapUtils.loadMapScript('google', MAP_API1_KEY, MAP_API1_URL);
            const mapElement = document.getElementById('technician-location-map');
            if (!mapElement) return;

            const position = { lat: Number(location.latitude), lng: Number(location.longitude) };
            this.technicianLocationMap = new google.maps.Map(mapElement, {
                center: position,
                zoom: 16,
                mapTypeId: google.maps.MapTypeId.ROADMAP,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: true
            });

            this.technicianLocationMarker?.setMap?.(null);
            this.technicianLocationMarker = new google.maps.Marker({
                position,
                map: this.technicianLocationMap,
                title: this.getTechnicianDisplayName(this.selectedTechnicianSolicitud)
            });
        } catch (error) {
            console.error('Error loading technician location map:', error);
            this.technicianLocationError = 'No se pudo mostrar el mapa del técnico.';
        }
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
            const systemConfigsResponse = await this.systemService.getAll().toPromise();
            const systemConfigs = systemConfigsResponse?.[0];
            const MAP_API1_KEY = systemConfigs?.map_api1?.key;
            const MAP_API1_URL = systemConfigs?.map_api1?.url;
            if (!MAP_API1_KEY || !MAP_API1_URL) {
                this.techniciansMapError = 'No hay configuración de mapa disponible.';
                return;
            }

            await MapUtils.loadMapScript('google', MAP_API1_KEY, MAP_API1_URL);
            const mapElement = document.getElementById('technicians-map');
            if (!mapElement) return;

            const firstLocation = this.techniciansWithLocation[0].location;
            this.techniciansMap = new google.maps.Map(mapElement, {
                center: { lat: Number(firstLocation.latitude), lng: Number(firstLocation.longitude) },
                zoom: 12,
                mapTypeId: google.maps.MapTypeId.ROADMAP,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: true
            });

            this.techniciansMapMarkers.forEach(marker => marker?.setMap?.(null));
            this.techniciansMapMarkers = [];
            const bounds = new google.maps.LatLngBounds();

            this.techniciansWithLocation.forEach(({ technician, location }) => {
                const position = { lat: Number(location.latitude), lng: Number(location.longitude) };
                bounds.extend(position);

                const marker = new google.maps.Marker({
                    position,
                    map: this.techniciansMap,
                    title: this.getTechnicianName(technician),
                });

                this.techniciansMapMarkers.push(marker);
                this.techniciansMapMarkers.push(this.createTechnicianLabelOverlay(position, this.getTechnicianMarkerLabel(technician, location)));
            });

            if (this.techniciansWithLocation.length === 1) {
                this.techniciansMap.setCenter(bounds.getCenter());
                this.techniciansMap.setZoom(15);
                return;
            }

            this.techniciansMap.fitBounds(bounds, 64);
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

    private createTechnicianLabelOverlay(position: { lat: number; lng: number }, text: string): any {
        const overlay = new google.maps.OverlayView();
        let div: HTMLDivElement | null = null;

        overlay.onAdd = () => {
            div = document.createElement('div');
            div.className = 'sol-tech-map-label';
            div.textContent = text;
            overlay.getPanes()?.overlayMouseTarget.appendChild(div);
        };

        overlay.draw = () => {
            if (!div) return;
            const projection = overlay.getProjection();
            const point = projection.fromLatLngToDivPixel(new google.maps.LatLng(position.lat, position.lng));
            if (!point) return;
            div.style.left = `${point.x}px`;
            div.style.top = `${point.y - 46}px`;
        };

        overlay.onRemove = () => {
            div?.parentNode?.removeChild(div);
            div = null;
        };

        overlay.setMap(this.techniciansMap);
        return overlay;
    }

    private getRelativeLocationAge(recordedAt?: string | Date): string {
        if (!recordedAt) return 'sin fecha';
        const date = new Date(recordedAt);
        if (Number.isNaN(date.getTime())) return 'sin fecha';

        const diffMs = Math.max(0, Date.now() - date.getTime());
        const diffMinutes = Math.floor(diffMs / 60000);
        if (diffMinutes < 1) return 'ahora';
        if (diffMinutes < 60) return `hace ${diffMinutes} min`;

        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) return `hace ${diffHours} h`;

        const diffDays = Math.floor(diffHours / 24);
        return `hace ${diffDays} d`;
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
            this.solicitudes[index] = updated;
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
        const hasInvalidDateRange = this.hasInvalidTopFilterDateRange;
        return this.solicitudes.filter(solicitud => {
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

            if (!hasInvalidDateRange && (this.topFilterDateFrom || this.topFilterDateTo)) {
                const scheduledDate = this.getScheduledDateFilterKey(solicitud);
                if (!scheduledDate) return false;
                if (this.topFilterDateFrom && scheduledDate < this.topFilterDateFrom) return false;
                if (this.topFilterDateTo && scheduledDate > this.topFilterDateTo) return false;
            }
            return true;
        });
    }

    get topFilterTechnicianOptions(): SelectOption[] {
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
        return options;
    }

    get topFilterClientOptions(): SelectOption[] {
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
        return [...clients.entries()]
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => a.label.localeCompare(b.label));
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

    private initializeTopDateFilters(): void {
        const today = new Date();
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);

        this.topFilterDateFrom = this.toLocalDateKey(sevenDaysAgo);
        this.topFilterDateTo = this.toLocalDateKey(today);
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
                .filter(s => s.user_id && !this.userNameCache[s.user_id!])
                .map(s => s.user_id!)
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
        const technicalDate = time ? `${day}/${month}/${year} a las ${time}` : `${day}/${month}/${year}`;

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
}
