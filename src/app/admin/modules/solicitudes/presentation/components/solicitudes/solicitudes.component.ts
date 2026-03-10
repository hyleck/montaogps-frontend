import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { MenuItem, MessageService, ConfirmationService } from 'primeng/api';
import { SolicitudesService, Solicitud } from '../../../../../../core/services/solicitudes.service';
import { VehicleBrandsService } from '../../../../../../core/services/vehicle-brands.service';
import { ColorsService } from '../../../../../../core/services/colors.service';
import { UserService } from '../../../../../../core/services/user.service';
import { TargetsService } from '../../../../../../core/services/targets.service';
import { ProtocolsService } from '../../../../../../core/services/protocols.service';
import { PlansService } from '../../../../../../core/services/plans.service';
import { AuthService } from '../../../../../../core/services/auth.service';
import { Protocol } from '../../../../../../core/interfaces/protocol.interface';
import { Plan } from '../../../../../../core/interfaces/plan.interface';
import { SIM_CARD_TYPES } from '../../../../../../core/constants/sim-card-types.constant';

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
export class SolicitudesComponent implements OnInit {
    items: MenuItem[] = [{ label: 'Solicitudes' }];
    home: MenuItem = { icon: 'pi pi-home', routerLink: '/admin/dashboard' };

    solicitudes: Solicitud[] = [];
    selectedSolicitud: Solicitud | null = null;
    dialogVisible = false;
    isEditMode = false;
    loading = false;
    totalItems = 0;
    currentPage = 1;

    // Filters
    filterType = '';
    filterStatus = '';
    searchQuery = '';

    // Select options for vehicle
    availableBrands: SelectOption[] = [];
    availableModels: SelectOption[] = [];
    availableYears: SelectOption[] = [];

    // Province/Municipality
    availableProvinces: SelectOption[] = [];
    availableMunicipalities: SelectOption[] = [];

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
            if (this.selectedSolicitud) {
                this.selectedSolicitud.color = '';
            }
        }
    }

    typeOptions = [
        { label: 'Todas', value: '' },
        { label: 'Instalación', value: 'instalacion' },
        { label: 'Chequeo', value: 'chequeo' },
        { label: 'Cambio', value: 'cambio' },
        { label: 'Desinstalación', value: 'desinstalacion' },
        { label: 'Otro', value: 'otro' }
    ];

    statusOptions = [
        { label: 'Todos', value: '' },
        { label: 'Pendiente', value: 'pendiente' },
        { label: 'En Progreso', value: 'en_progreso' },
        { label: 'Completada', value: 'completada' },
        { label: 'Cancelada', value: 'cancelada' }
    ];

    typeLabels: Record<string, string> = {
        instalacion: 'Instalación',
        chequeo: 'Chequeo',
        cambio: 'Cambio',
        desinstalacion: 'Desinstalación',
        otro: 'Otro'
    };

    statusLabels: Record<string, string> = {
        pendiente: 'Pendiente',
        en_progreso: 'En Progreso',
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
        private authService: AuthService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService
    ) { }

    ngOnInit(): void {
        this.loadSolicitudes();
        this.loadInitialData();
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
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    }

    async onProvinceChange(): Promise<void> {
        if (!this.selectedSolicitud) return;
        this.selectedSolicitud.municipality = '';
        this.availableMunicipalities = [];
        if (this.selectedSolicitud.province) {
            try {
                const municipalities = await this.vehicleBrandsService.getMunicipalities(this.selectedSolicitud.province);
                this.availableMunicipalities = municipalities.map((m: any) => ({
                    label: m.name,
                    value: String(m.code)
                }));
            } catch (e) {
                console.error('Error loading municipalities:', e);
            }
        }
    }

    async onBrandChange(): Promise<void> {
        if (!this.selectedSolicitud) return;
        try {
            if (this.selectedSolicitud.brand) {
                this.selectedSolicitud.model = '';
                this.availableModels = [];
                const models = await this.vehicleBrandsService.getAllModelsByBrand(this.selectedSolicitud.brand);
                if (models && models.length > 0) {
                    this.availableModels = models.map((model: any) => ({
                        label: model.nombre,
                        value: model._id
                    })).sort((a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label));
                    // Cache model names
                    this.availableModels.forEach(m => this.modelNameCache[m.value] = m.label);
                }
            } else {
                this.availableModels = [];
                this.selectedSolicitud.model = '';
            }
        } catch (error) {
            console.error('Error loading models:', error);
            this.availableModels = [];
        }
    }

    private async loadModelNamesForTable(): Promise<void> {
        const brandIds = [...new Set(this.solicitudes.filter(s => s.brand).map(s => s.brand!))];
        for (const brandId of brandIds) {
            const alreadyCached = this.solicitudes
                .filter(s => s.brand === brandId && s.model)
                .every(s => this.modelNameCache[s.model!]);
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
        if (this.selectedSolicitud) {
            this.selectedSolicitud.color = color.value;
            this._displayColorName = color.label;
        }
    }

    loadSolicitudes(resetPage = true): void {
        if (resetPage) this.currentPage = 1;
        this.loading = true;
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
                this.loading = false;
                this.loadModelNamesForTable();
                this.resolveUserNames();
            },
            error: () => {
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las solicitudes' });
                this.loading = false;
            }
        });
    }

    openNew(): void {
        this.selectedSolicitud = {
            type: 'instalacion',
            status: 'pendiente'
        } as Solicitud;
        this.availableModels = [];
        this.availableMunicipalities = [];
        this._displayColorName = '';
        this.filteredColors = [...this.availableColors];
        this.isEditMode = false;
        this.dialogVisible = true;
    }

    async editSolicitud(solicitud: Solicitud): Promise<void> {
        this.selectedSolicitud = { ...solicitud };
        this.isEditMode = true;
        this.dialogVisible = true;

        // Set display color name from hex value
        if (this.selectedSolicitud.color) {
            const colorObj = this.availableColors.find(c => c.value === this.selectedSolicitud!.color);
            this._displayColorName = colorObj ? colorObj.label : '';
        } else {
            this._displayColorName = '';
        }
        this.filteredColors = [...this.availableColors];
        this.availableMunicipalities = [];

        // Load models for the selected brand if exists
        if (this.selectedSolicitud.brand) {
            try {
                const models = await this.vehicleBrandsService.getAllModelsByBrand(this.selectedSolicitud.brand);
                this.availableModels = (models || []).map((model: any) => ({
                    label: model.nombre,
                    value: model._id
                })).sort((a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label));
            } catch {
                this.availableModels = [];
            }
        }

        // Load municipalities for the selected province if exists
        if (this.selectedSolicitud.province) {
            try {
                const municipalities = await this.vehicleBrandsService.getMunicipalities(this.selectedSolicitud.province);
                this.availableMunicipalities = municipalities.map((m: any) => ({
                    label: m.name,
                    value: String(m.code)
                }));
            } catch {
                this.availableMunicipalities = [];
            }
        }
    }

    saveSolicitud(): void {
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

    hideDialog(): void {
        this.dialogVisible = false;
        this.selectedSolicitud = null;
    }

    getStatusIcon(status: string): string {
        const map: Record<string, string> = {
            pendiente: 'pi pi-clock',
            en_progreso: 'pi pi-spinner',
            completada: 'pi pi-check-circle',
            cancelada: 'pi pi-times-circle'
        };
        return map[status] || 'pi pi-circle';
    }

    onSearch(): void {
        this.loadSolicitudes();
    }

    clearSearch(): void {
        this.searchQuery = '';
        this.filterType = '';
        this.filterStatus = '';
        this.loadSolicitudes();
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
        if (sol.user_id && this.userNameCache[sol.user_id]) {
            return this.userNameCache[sol.user_id];
        }
        return sol.client_name || '';
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
        this.installData = {
            name: '',
            type: '',
            activation_date: new Date().toISOString().split('T')[0],
            expiration_date: '',
            plan_id: '',
            plan_price_id: '',
            device_imei: solicitud.device_imei || '',
            sim_card_number: solicitud.sim_card_number || '',
            sim_company: solicitud.sim_company || '',
            installation_details: solicitud.installation_details || '',
            parent_id: solicitud.user_id || '',
            parentEmail: '',
            parentUserName: '',
            searchingUser: false,
            userFound: !!solicitud.user_id
        };

        // Load protocols and plans
        this.protocolsService.getAllProtocols().subscribe({
            next: (protocols) => this.availableProtocols = protocols,
            error: () => console.error('Error loading protocols')
        });
        this.plansService.getAllPlans().subscribe({
            next: (plans) => this.availablePlans = plans,
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
            || !this.installData.expiration_date || !this.installData.plan_id
            || !this.installData.plan_price_id || !this.installData.parent_id
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

        let resolvedBrandId = sol.brand || '';
        let resolvedModelId = sol.model || '';
        let resolvedColor = sol.color || '';

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
            target_plate_number: sol.plate || '',
            target_brand_id: resolvedBrandId,
            target_model_id: resolvedModelId,
            target_color: resolvedColor,
            target_year: sol.year || '',
            target_chassis_number: sol.chassis || '',
            contacts: sol.contacts || '',
            mechanic_id: sol.mechanic_id || '',
            installation_location: sol.installation_location || '',
            engine_shutdown: sol.engine_shutdown || '',
            ignition_sensor: sol.ignition_sensor || '',
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

            this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Dispositivo instalado correctamente' });
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
}
