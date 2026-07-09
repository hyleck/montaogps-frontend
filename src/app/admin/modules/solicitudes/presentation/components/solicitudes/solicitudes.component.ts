import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MenuItem, MessageService, ConfirmationService } from 'primeng/api';
import { SolicitudesService, Solicitud } from '../../../../../../core/services/solicitudes.service';
import { VehicleBrandsService } from '../../../../../../core/services/vehicle-brands.service';
import { ColorsService } from '../../../../../../core/services/colors.service';
import { UserService } from '../../../../../../core/services/user.service';
import { TargetsService } from '../../../../../../core/services/targets.service';
import { ProtocolsService } from '../../../../../../core/services/protocols.service';
import { PlansService } from '../../../../../../core/services/plans.service';
import { AuthService } from '../../../../../../core/services/auth.service';
import { InventoryItem, InventoryService } from '../../../../../../core/services/inventory.service';
import { User } from '../../../../../../core/interfaces/user.interface';
import { Protocol } from '../../../../../../core/interfaces/protocol.interface';
import { Plan } from '../../../../../../core/interfaces/plan.interface';
import { SIM_CARD_TYPES } from '../../../../../../core/constants/sim-card-types.constant';
import { INSTALLATION_LOCATIONS } from '../../../../management/presentation/components/management/target-form/constants/target-form-data.constants';
import { SystemService } from '../../../../../../core/services/system.service';
import { MapUtils } from '../../../../../../shareds/helpers/map.helper';
interface SelectOption {
    label: string;
    value: string;
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
    
    get pendientes() { return this.sortSolicitudesForDisplay(this.solicitudes.filter(s => s.status === 'pendiente' || s.status === 'aceptada' || s.status === 'rechazada')); }
    get enProgreso() { return this.sortSolicitudesForDisplay(this.solicitudes.filter(s => s.status === 'en_progreso')); }
    get porConfirmar() { return this.sortSolicitudesForDisplay(this.solicitudes.filter(s => s.status === 'por_confirmar')); }
    get completadas() { return this.sortSolicitudesForDisplay(this.solicitudes.filter(s => s.status === 'completada' || s.status === 'cancelada')); }
    
    // Drag and Drop
    draggedSolicitud: Solicitud | null = null;
    dragSuppressClick = false;

    onDragStart(event: DragEvent, sol: Solicitud): void {
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

        // Update status
        sol.status = newStatus;

        // Insert at position
        if (dropIndex >= 0 && dropIndex <= columnItems.length) {
            columnItems.splice(dropIndex, 0, sol);
        } else {
            columnItems.push(sol);
        }

        // Re-index all items in the column
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
    }

    selectedSolicitud: Solicitud | null = null;
    dialogVisible = false;
    installationModalVisible = false;
    editingInstallationIndex: number = 0;
    isEditMode = false;
    
    showVehicleData = false;
    showLocationData = false;
    showDeviceData = false;
        showRootLocationData = false;
    rootLocationMap: any = null;
    rootLocationMarker: any = null;
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
    technicianDialogVisible = false;
    selectedTechnicianSolicitud: Solicitud | null = null;
    verifyingAvailabilityId = '';

    // Filters
    filterType = '';
    filterStatus = '';
    searchQuery = '';
    clientEmailSuggestions: User[] = [];
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
        { label: 'Cambio de GPS', value: 'cambio' }
    ];

    getEntityName(plural: boolean = false): string {
        const t = this.selectedSolicitud?.type || 'instalacion';
        if (t === 'chequeo') return plural ? 'Chequeos' : 'Chequeo';
        if (t === 'reinstalacion') return plural ? 'Reinstalaciones' : 'Reinstalación';
        if (t === 'desinstalacion') return plural ? 'Desinstalaciones' : 'Desinstalación';
        if (t === 'cambio') return plural ? 'Cambios' : 'Cambio';
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
        private systemService: SystemService
    ) { }

    ngOnInit(): void {
        this.loadSolicitudes(false);
        this.startRealtimeRefresh();
        this.initialDataPromise = this.loadInitialData();
    }

    ngOnDestroy(): void {
        this.stopRealtimeRefresh();
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
        
        this.showRootLocationData = false;
        this.showRootDetailsData = false;
        this.showInstallationsCards = false;
        
        this.rootLocationMap = null;
        this.locationMap = null;

        this.dialogVisible = true;
        setTimeout(() => this.initRootLocationMap(), 200);
    }

    onTypeChange(): void {
        if (!this.selectedSolicitud) return;
        this.onQuantityChange();

        if (this.isDeviceRequiredForSolicitud()) {
            this.showInstallationsCards = true;
        }
    }

    isDeviceRequiredForSolicitud(): boolean {
        return ['chequeo', 'desinstalacion', 'cambio'].includes(this.selectedSolicitud?.type || '');
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
            this.selectedSolicitud.installations.push({});
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
        if (!this.selectedSolicitud || !this.selectedSolicitud.installations || !this.selectedSolicitud.installations[index]) return;
        
        const inst = this.selectedSolicitud.installations[index];
        const imei = inst.device_imei?.trim();
        if (!imei) return;

        try {
            // Buscamos si existe con los permisos de targets
            const result = await this.targetsService.searchTargets(imei, this.solicitudAutocompleteUserId, 0, 10);
            if (result && result.devices && result.devices.length > 0) {
                // Find exact match by IMEI or Name
                const exactMatch: any = result.devices.find((d: any) => d.device_imei === imei || d.name === imei) || result.devices[0];
                
                if (exactMatch) {
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
                    this.messageService.add({ severity: 'success', summary: 'Vehículo Encontrado', detail: 'Datos autocompletados desde el dispositivo.' });
                }
            }
        } catch (error) {
            // Ignorar silenciosamente si no se encuentra o falla la red
        }
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
        const lat = this.selectedSolicitud.latitude;
        const lng = this.selectedSolicitud.longitude;
        if (this.selectedSolicitud.installations) {
            this.selectedSolicitud.installations.forEach(i => {
                i.latitude = lat;
                i.longitude = lng;
            });
        }
        if (lat && lng) {
            this.updateRootLocationMarker(lat, lng);
            if (this.rootLocationMap) {
                this.rootLocationMap.panTo({ lat, lng });
            }
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

        this.rootAvailableMunicipalities = [];
        this.rootAvailableSectors = [];
        
        this.selectedSolicitud = { ...solicitud, installations: solicitud.installations ? solicitud.installations.map(i => ({ ...i })) : [] };
        // Map ISO Strings into Date objects for PrimeNG DatePickers
        if (this.selectedSolicitud.scheduled_date) {
            this.selectedSolicitud.scheduled_date = new Date(this.selectedSolicitud.scheduled_date);
        }
        
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

    saveSolicitud(): void {
        if (!this.selectedSolicitud) return;

        // Chequeos y desinstalaciones necesitan identificar el dispositivo.
        if (this.isDeviceRequiredForSolicitud()) {
            const hasMissingDevice = this.selectedSolicitud.installations?.some(inst => !inst.device_imei || inst.device_imei.trim() === '');
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

    hideDialog(): void {
        this.dialogVisible = false;
        this.selectedSolicitud = null;
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

    isTechnicianUnavailable(solicitud: Solicitud): boolean {
        return solicitud.technician_response === 'rechazada' || solicitud.status === 'rechazada';
    }

    isTechnicianAccepted(solicitud: Solicitud): boolean {
        return solicitud.technician_response === 'aceptada';
    }

    isTechnicianVerifying(solicitud: Solicitud): boolean {
        return solicitud.technician_response === 'verificando';
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
        return this.solicitudes.filter(s => s.status === status).length;
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
