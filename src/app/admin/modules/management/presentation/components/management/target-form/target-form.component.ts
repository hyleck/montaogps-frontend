import { Component, OnInit, Output, EventEmitter, Input, SimpleChanges, OnChanges, OnDestroy } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Subject, takeUntil } from 'rxjs';
import { LangService } from '../../../../../../../shareds/services/langi18/lang.service';
import { TARGET_FORM_STYLES } from './constants/target-form.constants';
import { CloudComponent } from 'src/app/shareds/components/cloud/cloud.component';
import { VehicleBrandsService } from 'src/app/core/services/vehicle-brands.service';
import { ColorsService } from 'src/app/core/services/colors.service';

// Interfaces para el objetivo/dispositivo
interface TargetDevice {
  _id: string;
  name: string;
  imei: string;
  api_id: string;
  sim_card: string;
  description: string;
  plate: string;
  contacts: string[];
  year: string;
  installation_location: string;
  brand: string;
  model: string;
  color: string;
  chassis: string;
  installation_date: string;
  expiration_date: string;
  gps_model: string;
  ignition_sensor: string;
  shutdown_control: string;
  installation_details: string;
  status: 'active' | 'inactive';
  plan: string;
}

@Component({
    selector: 'app-target-form',
    templateUrl: './target-form.component.html',
    styleUrls: TARGET_FORM_STYLES,
    standalone: false
})
export class TargetFormComponent implements OnInit, OnChanges, OnDestroy {
    private destroy$ = new Subject<void>();

    @Input() targetInput: TargetDevice | null = null;
    @Output() targetCreated = new EventEmitter<void>();

    // Claves de traducción
    translations = {
        title: 'management.targetForm.title',
        vehicleInfo: 'management.targetForm.vehicleInfo',
        installationInfo: 'management.targetForm.installationInfo',
        processInfo: 'management.targetForm.processInfo',
        name: 'management.targetForm.name',
        imei: 'management.targetForm.imei',
        apiId: 'management.targetForm.apiId',
        simCard: 'management.targetForm.simCard',
        description: 'management.targetForm.description',
        plate: 'management.targetForm.plate',
        year: 'management.targetForm.year',
        installationLocation: 'management.targetForm.installationLocation',
        brand: 'management.targetForm.brand',
        model: 'management.targetForm.model',
        color: 'management.targetForm.color',
        chassis: 'management.targetForm.chassis',
        installationDate: 'management.targetForm.installationDate',
        expirationDate: 'management.targetForm.expirationDate',
        gpsModel: 'management.targetForm.gpsModel',
        ignitionSensor: 'management.targetForm.ignitionSensor',
        shutdownControl: 'management.targetForm.shutdownControl',
        installationDetails: 'management.targetForm.installationDetails',
        save: 'management.targetForm.save',
        cancel: 'management.targetForm.cancel',
        plan: 'management.targetForm.plan'
    };

    target: TargetDevice = this.getEmptyTarget();
    activeTabIndex: number = 0;
    displayColorName: string = '';
    showColorOptions: boolean = true;
    
    // Opciones para selects
    availableBrands: { label: string, value: string }[] = [];
    availableModels: { label: string, value: string }[] = [];
    availableYears: { label: string, value: string }[] = [];
    availableGpsModels: { label: string, value: string }[] = [];
    availableLocations: { label: string, value: string }[] = [];
    availableColors: { label: string, value: string }[] = [];
    availableSimCardTypes: { label: string, value: string }[] = [];
    availablePlans: { label: string, value: string }[] = [];
    filteredColors: { label: string, value: string }[] = [];
    
    constructor(
        private langService: LangService,
        private messageService: MessageService,
        private vehicleBrandsService: VehicleBrandsService,
        private colorsService: ColorsService
    ) {}

    // Método para manejar el envío del formulario de procesos
    onSubmitProcess(): void {
        // Aquí puedes implementar la lógica para guardar el proceso
        // Por ahora, mostraremos un mensaje de éxito
        this.messageService.add({
            severity: 'success',
            summary: this.translate('management.targetForm.processAdded'),
            detail: this.translate('management.targetForm.processAddedDetail')
        });
        
        // Aquí podrías limpiar el formulario o hacer otras acciones después de agregar el proceso
        const processForm = document.getElementById('process_notes') as HTMLTextAreaElement;
        if (processForm) {
            processForm.value = '';
        }
    }

    private getEmptyTarget(): TargetDevice {
        return {
            _id: '',
            name: '',
            imei: '',
            api_id: '',
            sim_card: '',
            description: '',
            plate: '',
            contacts: [],
            year: '',
            installation_location: '',
            brand: '',
            model: '',
            color: '',
            chassis: '',
            installation_date: '',
            expiration_date: '',
            gps_model: '',
            ignition_sensor: '',
            shutdown_control: '',
            installation_details: '',
            status: 'active',
            plan: ''
        };
    }

    ngOnInit() {
        this.loadInitialData();
        this.target = this.getEmptyTarget();
        this.target.api_id = '';
        this.activeTabIndex = 0;
    }

    private async loadInitialData() {
        try {
            // Cargar años
            this.availableYears = Array.from({ length: 30 }, (_, i) => {
                const year = new Date().getFullYear() - i;
                return { label: year.toString(), value: year.toString() };
            });
            
            // Cargar marcas desde el servicio
            const brands = await this.vehicleBrandsService.getAllBrands();
            this.availableBrands = brands.map((brand: any) => ({
                label: brand.nombre,
                value: brand._id
            })).sort((a: any, b: any) => a.label.localeCompare(b.label));
            
            // Cargar colores desde el servicio
            const colors = await this.colorsService.getAllColors();
            this.availableColors = colors.map((color: any) => ({
                label: color.nombre,
                value: color.hex
            })).sort((a: any, b: any) => a.label.localeCompare(b.label));
            
            // Inicializar filteredColors con todos los colores
            this.filteredColors = [...this.availableColors];
            
            // Otras opciones que no dependen de servicios
            this.availableGpsModels = [
                { label: 'Modelo A', value: 'modelo_a' },
                { label: 'Modelo B', value: 'modelo_b' },
                { label: 'Modelo C', value: 'modelo_c' }
            ];
            
            this.availableLocations = [
                { label: 'Interior', value: 'interior' },
                { label: 'Exterior', value: 'exterior' },
                { label: 'Bajo tablero', value: 'bajo_tablero' }
            ];
            
            this.availableSimCardTypes = [
                { label: 'Nacionales', value: 'nacionales' },
                { label: 'Global-E', value: 'global-e' },
                { label: 'Global-M', value: 'global-m' }
            ];
            
            this.availablePlans = [
                { label: 'Básico', value: 'basico' },
                { label: 'Estándar', value: 'estandar' },
                { label: 'Premium', value: 'premium' },
                { label: 'Empresarial', value: 'empresarial' }
            ];
            
        } catch (error) {
            console.error('Error al cargar datos iniciales:', error);
            this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'No se pudieron cargar algunos datos. Por favor, recargue la página.'
            });
        }
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['targetInput']) {
            if (changes['targetInput'].currentValue) {
                const target = changes['targetInput'].currentValue;
                this.setupEditTarget(target);
            } else {
                this.resetForm();
            }
        }
    }

    private setupEditTarget(target: TargetDevice) {
        // Rellenar el formulario con los datos del objetivo a editar
        this.target = JSON.parse(JSON.stringify(target));
        this.target.api_id = target.api_id || '';
        this.target.installation_date = this.formatDateToInput(target.installation_date);
        this.target.expiration_date = this.formatDateToInput(target.expiration_date);
        this.activeTabIndex = 0;
        
        // Actualizar el nombre del color para mostrar
        if (this.target.color) {
            const colorObj = this.availableColors.find(c => c.value === this.target.color);
            this.displayColorName = colorObj ? colorObj.label : '';
        } else {
            this.displayColorName = '';
        }
        
        // Cargar los modelos para la marca seleccionada
        if (this.target.brand) {
            this.onBrandChange();
        }
    }

    private resetForm() {
        this.target = this.getEmptyTarget();
        this.target.api_id = '';
        this.activeTabIndex = 0;
        this.displayColorName = '';
        // No modificamos showColorOptions ya que queremos que siempre esté visible
    }

    async onBrandChange() {
        try {
            if (this.target.brand) {
                // Limpiar el modelo seleccionado
                this.target.model = '';
                
                // Cargar modelos para la marca seleccionada
                const models = await this.vehicleBrandsService.getAllModelsByBrand(this.target.brand);
                this.availableModels = models.map((model: any) => ({
                    label: model.nombre,
                    value: model._id
                })).sort((a: any, b: any) => a.label.localeCompare(b.label));
            } else {
                // Si no hay marca seleccionada, vaciar los modelos
                this.availableModels = [];
            }
        } catch (error) {
            console.error('Error al cargar modelos:', error);
            this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'No se pudieron cargar los modelos para esta marca.'
            });
            this.availableModels = [];
        }
    }

    onSubmit() {
        // Validar los datos antes de enviar
        if (!this.validateForm()) {
            return;
        }

        const targetToSave = { ...this.target };
        
        // Aquí se enviaría al backend
        console.log('Enviando datos del objetivo:', targetToSave);
        
        this.messageService.add({
            severity: 'success',
            summary: this.translate('management.targetForm.saveSuccess'),
            detail: this.translate('management.targetForm.saveSuccessDetail')
        });
        
        this.targetCreated.emit();
        this.resetForm();
    }

    private validateForm(): boolean {
        // Validaciones según el tab activo
        if (this.activeTabIndex === 0) { // Tab de vehículo
            if (!this.target.name || !this.target.plate) {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translate('management.targetForm.validationError'),
                    detail: this.translate('management.targetForm.requiredFieldsMissing')
                });
                return false;
            }
        } else if (this.activeTabIndex === 1) { // Tab de instalación
            if (!this.target.imei || !this.target.sim_card) {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translate('management.targetForm.validationError'),
                    detail: this.translate('management.targetForm.deviceInfoMissing')
                });
                return false;
            }
        }
        
        return true;
    }

    // Método para traducir texto (helper para usar en el template si es necesario)
    translate(key: string): string {
        return this.langService.translate(key);
    }

    private formatDateToInput(dateStr: string): string {
        if (!dateStr) return '';
        
        try {
            const date = new Date(dateStr);
            return date.toISOString().substring(0, 10);
        } catch (e) {
            return '';
        }
    }

    filterColors(event: Event) {
        const target = event.target as HTMLInputElement;
        const value = target.value.toLowerCase();
        this.displayColorName = value;
        
        if (value) {
            this.filteredColors = this.availableColors.filter(color => 
                color.label.toLowerCase().includes(value) || 
                color.value.toLowerCase().includes(value)
            );
        } else {
            this.filteredColors = [...this.availableColors];
            this.target.color = '';
        }
        
        // No necesitamos cambiar showColorOptions ya que siempre está visible
    }
    
    selectColor(color: { label: string, value: string }) {
        this.target.color = color.value;
        this.displayColorName = color.label;
        // El selector ya está siempre visible
    }
    
    // Estos métodos ya no se usan porque el selector está siempre visible
    onColorInputFocus() {
        // No hacemos nada
    }
    
    onColorInputBlur() {
        // No hacemos nada
    }
    
    closeColorOptions() {
        // No hacemos nada
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }
}
