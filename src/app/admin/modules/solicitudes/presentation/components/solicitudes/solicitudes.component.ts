import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { MenuItem, MessageService, ConfirmationService } from 'primeng/api';
import { SolicitudesService, Solicitud } from '../../../../../../core/services/solicitudes.service';
import { VehicleBrandsService } from '../../../../../../core/services/vehicle-brands.service';
import { ColorsService } from '../../../../../../core/services/colors.service';

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

    constructor(
        private solicitudesService: SolicitudesService,
        private vehicleBrandsService: VehicleBrandsService,
        private colorsService: ColorsService,
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
}
