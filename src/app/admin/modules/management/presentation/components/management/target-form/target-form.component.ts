import { Component, OnInit, Output, EventEmitter, Input, SimpleChanges, OnChanges, OnDestroy } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Subject, takeUntil } from 'rxjs';
import { LangService } from '../../../../../../../shareds/services/langi18/lang.service';
import { TARGET_FORM_STYLES } from './constants/target-form.constants';
import { CloudComponent } from 'src/app/shareds/components/cloud/cloud.component';
import { VehicleBrandsService } from 'src/app/core/services/vehicle-brands.service';
import { ColorsService } from 'src/app/core/services/colors.service';
import { TargetsService } from 'src/app/core/services/targets.service';
import { PlansService } from 'src/app/core/services/plans.service';
import { CreateTargetDto, Target, UpdateTargetDto } from 'src/app/core/interfaces/target.interface';
import { Plan, PlanPrice } from 'src/app/core/interfaces/plan.interface';
import { ProtocolsService } from 'src/app/core/services/protocols.service';
import { Protocol } from 'src/app/core/interfaces/protocol.interface';
import { ManagementService } from 'src/app/admin/modules/management/presentation/services/management.service';

// Interface local para el componente
interface TargetDevice {
  _id: string;
  name: string;
  device_imei: string;
  api_device_id: string;
  api_position_id: string;
  description: string;
  type: string;
  sim_card_number: string;
  sim_company: string;
  target_plate_number: string;
  target_chassis_number: string;
  contacts: string | string[];
  mechanic_id?: string;
  target_brand_id: string;
  target_model_id: string;
  target_color: string;
  target_year: string;
  installation_location: string;
  engine_shutdown?: string;
  ignition_sensor?: string;
  required_check?: string;
  installation_details?: string;
  creator_id: string;
  activation_date: string;
  expiration_date: string;
  last_change_date: string;
  status: boolean | 'active' | 'inactive';
  canceled: boolean;
  deleted: boolean;
  shared?: string;
  index: string;
  parent_id: string;
  user_id?: string;
  plan: string | {
    id_plan: string;
    selected_price: {
      id: string;
      amount: number;
      payment_period: string | number;
    }
  } | null;
  // Propiedades para el estado del formulario o compatibilidad
  selectedPrice?: {
    id: string;
    amount: number;
    payment_period: string | number;
  } | null;
  // Campos de compatibilidad con versión anterior
  imei?: string;
  api_id?: string | null;
  sim_card?: string;
  plate?: string;
  chassis?: string;
  year?: string | null;
  brand?: string | null;
  model?: string | null;
  color?: string;
  installation_date?: string;
  gps_model?: string | null;
  shutdown_control?: string | null;
  // Campos adicionales que pueden existir
  [key: string]: any;
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
    isLoading: boolean = false;
    
    // Opciones para selects
    availableBrands: { label: string, value: string }[] = [];
    availableModels: { label: string, value: string }[] = [];
    availableYears: { label: string, value: string }[] = [];
    availableGpsModels: { label: string, value: string }[] = [];
    availableLocations: { label: string, value: string }[] = [];
    availableColors: { label: string, value: string }[] = [];
    availableSimCardTypes: { label: string, value: string }[] = [];
    availablePlans: { label: string, value: string }[] = [];
    availablePrices: PlanPrice[] = [];
    filteredColors: { label: string, value: string }[] = [];
    
    constructor(
        private langService: LangService,
        private messageService: MessageService,
        private vehicleBrandsService: VehicleBrandsService,
        private colorsService: ColorsService,
        private targetsService: TargetsService,
        private plansService: PlansService,
        private protocolsService: ProtocolsService,
        private managementService: ManagementService
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
            device_imei: '',
            api_device_id: '',
            api_position_id: '',
            description: '',
            type: '',
            sim_card_number: '',
            sim_company: '',
            target_plate_number: '',
            target_chassis_number: '',
            contacts: [],
            mechanic_id: '',
            target_brand_id: '',
            target_model_id: '',
            target_color: '',
            target_year: '',
            installation_location: '',
            engine_shutdown: '',
            ignition_sensor: '',
            required_check: '',
            installation_details: '',
            creator_id: '',
            activation_date: '',
            expiration_date: '',
            last_change_date: '',
            status: 'active',
            canceled: false,
            deleted: false,
            shared: '',
            index: '',
            parent_id: '',
            user_id: '',
            plan: null,
            selectedPrice: null,
            // Campos de compatibilidad
            imei: '',
            api_id: null,
            sim_card: '',
            plate: '',
            chassis: '',
            year: null,
            brand: null,
            model: null,
            color: '',
            installation_date: '',
            gps_model: null,
            shutdown_control: null
        };
    }

    ngOnInit() {
        this.loadInitialData();
        this.target = this.getEmptyTarget();
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
            
            // Cargar protocolos para modelos de GPS
            this.protocolsService.getAllProtocols()
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                    next: (protocols: Protocol[]) => {
                        this.availableGpsModels = protocols.map(protocol => ({
                            label: protocol.name,
                            value: protocol._id
                        })).sort((a, b) => a.label.localeCompare(b.label));
                    },
                    error: (error) => {
                        console.error('Error al cargar protocolos:', error);
                        // Fallback a modelos estáticos si hay error
                        this.availableGpsModels = [
                            { label: 'Modelo A', value: 'modelo_a' },
                            { label: 'Modelo B', value: 'modelo_b' },
                            { label: 'Modelo C', value: 'modelo_c' }
                        ];
                    }
                });
            
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
            
            // Cargar planes desde el servicio
            this.plansService.getAllPlans().subscribe({
                next: (plans: Plan[]) => {
                    this.availablePlans = plans.map(plan => ({
                        label: plan.plan_name,
                        value: plan._id
                    })).sort((a, b) => a.label.localeCompare(b.label));
                },
                error: (error) => {
                    console.error('Error al cargar planes:', error);
                    // Fallback a planes estáticos si hay error
                    this.availablePlans = [
                        { label: 'Básico', value: 'basico' },
                        { label: 'Estándar', value: 'estandar' },
                        { label: 'Premium', value: 'premium' },
                        { label: 'Empresarial', value: 'empresarial' }
                    ];
                }
            });
            
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
        console.log('Configurando objetivo para edición:', target);
        
        // Rellenar el formulario con los datos del objetivo a editar
        this.target = JSON.parse(JSON.stringify(target));
        
        // Asegurarse de que los campos de compatibilidad estén sincronizados
        // Copiamos de los campos nuevos a los antiguos para compatibilidad del formulario
        
        // device_imei -> imei (compatibilidad)
        this.target.imei = this.target.device_imei || this.target.imei || '';
        
        // api_device_id -> api_id (compatibilidad)
        this.target.api_id = this.target.api_device_id || this.target.api_id || null;
        
        // sim_card_number -> sim_card (compatibilidad)
        this.target.sim_card = this.target.sim_card_number || this.target.sim_card || '';
        
        // target_plate_number -> plate (compatibilidad)
        this.target.plate = this.target.target_plate_number || this.target.plate || '';
        
        // target_chassis_number -> chassis (compatibilidad)
        this.target.chassis = this.target.target_chassis_number || this.target.chassis || '';
        
        // target_brand_id -> brand (compatibilidad)
        this.target.brand = this.target.target_brand_id || this.target.brand || null;
        
        // Guardar temporalmente el ID del modelo seleccionado
        const selectedModelId = this.target.target_model_id || this.target.model || null;
        
        // Establecer el modelo a null inicialmente hasta que carguemos los modelos disponibles
        this.target.model = null;
        
        // target_color -> color (compatibilidad)
        this.target.color = this.target.target_color || this.target.color || '';
        
        // target_year -> year (compatibilidad)
        this.target.year = this.target.target_year || this.target.year || null;
        
        // type -> gps_model (compatibilidad: en la interfaz se usa gps_model, pero en el backend se guarda como type)
        this.target.gps_model = this.target.type || this.target.gps_model || null;
        
        // engine_shutdown -> shutdown_control (compatibilidad)
        this.target.shutdown_control = this.target.engine_shutdown || this.target.shutdown_control || null;
        
        // Ajuste para el estado (status): en DB es boolean, en formulario puede ser string
        if (this.target.status === true || String(this.target.status) === 'true') {
            this.target.status = 'active';
        } else if (this.target.status === false || String(this.target.status) === 'false') {
            this.target.status = 'inactive';
        }
        
        // Formatear fechas para el input HTML
        // activation_date -> installation_date (compatibilidad) 
        this.target.installation_date = this.formatDateToInput(this.target.activation_date || this.target.installation_date || '');
        
        if (this.target.expiration_date) {
            this.target.expiration_date = this.formatDateToInput(this.target.expiration_date);
        }
        
        this.activeTabIndex = 0;
        
        // Actualizar el nombre del color para mostrar
        if (this.target.target_color || this.target.color) {
            const colorValue = this.target.target_color || this.target.color;
            const colorObj = this.availableColors.find(c => c.value === colorValue);
            this.displayColorName = colorObj ? colorObj.label : '';
        } else {
            this.displayColorName = '';
        }
        
        // Cargar los modelos para la marca seleccionada
        if (this.target.brand) {
            // Cargar modelos según la marca seleccionada
            this.vehicleBrandsService.getAllModelsByBrand(this.target.brand)
                .then((models: any) => {
                    this.availableModels = models.map((model: any) => ({
                        label: model.nombre,
                        value: model._id
                    })).sort((a: any, b: any) => a.label.localeCompare(b.label));
                    
                    // Una vez cargados los modelos, establecer el modelo seleccionado
                    if (selectedModelId && this.availableModels.some(m => m.value === selectedModelId)) {
                        this.target.model = selectedModelId;
                    }
                })
                .catch(error => {
                    console.error('Error al cargar modelos para edición:', error);
                    this.availableModels = [];
                });
        }
        
        // Configurar el plan si existe
        if (this.target.plan && typeof this.target.plan === 'object') {
            console.log('Configurando plan:', this.target.plan);
            // Extraer el ID del plan
            if ('id_plan' in this.target.plan && this.target.plan.id_plan) {
                // Guardar el objeto plan original
                const originalPlan = this.target.plan;
                
                // Establecer el ID del plan como string para el selector
                this.target.plan = originalPlan.id_plan as string;
                
                // Si hay un precio seleccionado, configurarlo
                if (originalPlan.selected_price) {
                    this.target.selectedPrice = {
                        id: originalPlan.selected_price.id,
                        amount: originalPlan.selected_price.amount,
                        payment_period: originalPlan.selected_price.payment_period
                    };
                    
                    // Cargar los precios disponibles para este plan
                    this.onPlanChange();
                }
            }
        }
    }

    private resetForm() {
        this.target = this.getEmptyTarget();
        this.activeTabIndex = 0;
        this.displayColorName = '';
        // No modificamos showColorOptions ya que queremos que siempre esté visible
    }

    async onBrandChange() {
        try {
            if (this.target.brand) {
                // Limpiar el modelo seleccionado
                this.target.model = null;
                this.availableModels = [];
                
                // Mostrar indicador de carga si es necesario
                // this.isLoadingModels = true;
                
                // Cargar modelos para la marca seleccionada
                const models = await this.vehicleBrandsService.getAllModelsByBrand(this.target.brand);
                
                if (models && models.length > 0) {
                    this.availableModels = models.map((model: any) => ({
                        label: model.nombre,
                        value: model._id
                    })).sort((a: any, b: any) => a.label.localeCompare(b.label));
                    
                    console.log(`Cargados ${this.availableModels.length} modelos para la marca seleccionada`);
                } else {
                    console.log('No se encontraron modelos para esta marca');
                    this.availableModels = [];
                }
            } else {
                // Si no hay marca seleccionada, vaciar los modelos
                this.availableModels = [];
                this.target.model = null;
                console.log('No hay marca seleccionada, se han limpiado los modelos');
            }
        } catch (error) {
            console.error('Error al cargar modelos:', error);
            this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: this.translate('management.targetForm.errorLoadingModels') || 'No se pudieron cargar los modelos para esta marca.'
            });
            this.availableModels = [];
            this.target.model = null;
        } finally {
            // Desactivar indicador de carga si se implementa
            // this.isLoadingModels = false;
        }
    }

    async onSubmit() {
        // Validar los datos antes de enviar
        if (!this.validateForm()) {
            return;
        }

        try {
            this.isLoading = true;
            const targetToSave = this.prepareTargetData();
            
            console.log('Datos preparados para enviar:', targetToSave);
            
            if (this.target._id) {
                // Actualizar objetivo existente
                await this.targetsService.updateTarget(this.target._id, targetToSave as UpdateTargetDto);
                this.messageService.add({
                    severity: 'success',
                    summary: this.translate('management.targetForm.updateSuccess'),
                    detail: this.translate('management.targetForm.updateSuccessDetail')
                });
            } else {
                // Crear nuevo objetivo
                await this.targetsService.createTarget(targetToSave as CreateTargetDto);
                this.messageService.add({
                    severity: 'success',
                    summary: this.translate('management.targetForm.saveSuccess'),
                    detail: this.translate('management.targetForm.saveSuccessDetail')
                });
            }
            
            this.targetCreated.emit();
            this.resetForm();
        } catch (error: any) {
            console.error('Error al guardar el objetivo:', error);
            
            // Mostrar mensaje de error más detallado si está disponible
            let errorMessage = this.translate('management.targetForm.saveError');
            
            if (error.error && error.error.message) {
                if (Array.isArray(error.error.message)) {
                    // Si hay varios mensajes de error, mostrar el primero
                    errorMessage += `: ${error.error.message[0]}`;
                    console.log('Errores de validación del servidor:', error.error.message);
                } else {
                    errorMessage += `: ${error.error.message}`;
                }
            }
            
            this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: errorMessage
            });
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Obtiene valores por defecto para campos no presentes en el formulario
     * basados en el contexto del usuario actual u otra lógica
     */
    private getDefaultValues(): any {
        // Obtener el ID del usuario actual de management service
        const currentUserId = this.managementService.getCurrentUserId();
        console.log('ID de usuario actual para parent_id:', currentUserId);
        
        return {
            api_position_id: 'default_position_id',
            api_device_id: 'default_api_device_id',
            type: 'vehicle',
            sim_company: 'default', // Valor por defecto para sim_company
            creator_id: currentUserId || '64a7ecf2de1b240df0a97345', // usar un ID de fallback si no hay ID actual
            parent_id: currentUserId || '64a7ecf2de1b240df0a97345', // usar un ID de fallback si no hay ID actual
            index: '1',
            canceled: false,
            delete: false,
            deleted: false
        };
    }

    private prepareTargetData(): CreateTargetDto | UpdateTargetDto {
        // Crear una copia del objeto target con los campos actuales
        const targetData: any = { ...this.target };
        
        // Obtener valores por defecto
        const defaultValues = this.getDefaultValues();
        
        // Estructurar el plan en el formato requerido
        const planData = targetData.plan && targetData.selectedPrice ? {
            id_plan: targetData.plan,
            selected_price: {
                id: targetData.selectedPrice.id,
                amount: targetData.selectedPrice.amount,
                payment_period: typeof targetData.selectedPrice.payment_period === 'string' ? 
                    targetData.selectedPrice.payment_period : 
                    this.mapPeriodToString(targetData.selectedPrice.payment_period)
            }
        } : null;
        
        // Mapear campos actuales a los campos esperados por el backend
        const mappedData: any = {
            name: targetData.name,
            device_imei: targetData.imei || targetData.device_imei,
            api_device_id: targetData.api_id || targetData.api_device_id || defaultValues.api_device_id,
            api_position_id: targetData.api_position_id || defaultValues.api_position_id,
            type: targetData.gps_model || targetData.type || defaultValues.type,
            sim_card_number: targetData.sim_card || targetData.sim_card_number,
            sim_company: targetData.sim_company || defaultValues.sim_company,
            description: targetData.description || '',
            target_plate_number: targetData.plate || targetData.target_plate_number,
            target_chassis_number: targetData.chassis || targetData.target_chassis_number || '',
            // Convertir el array de contactos a string (o usar valor por defecto)
            contacts: Array.isArray(targetData.contacts) ? targetData.contacts.join(',') : (targetData.contacts || ''),
            mechanic_id: targetData.mechanic_id || null,
            target_year: targetData.year || targetData.target_year,
            installation_location: targetData.installation_location,
            target_brand_id: targetData.brand || targetData.target_brand_id,
            target_model_id: targetData.model || targetData.target_model_id,
            target_color: targetData.color || targetData.target_color,
            activation_date: targetData.installation_date ? new Date(targetData.installation_date) : new Date(targetData.activation_date || new Date()),
            expiration_date: targetData.expiration_date ? new Date(targetData.expiration_date) : undefined,
            last_change_date: new Date(),
            ignition_sensor: targetData.ignition_sensor,
            engine_shutdown: targetData.shutdown_control || targetData.engine_shutdown,
            required_check: targetData.required_check || null,
            installation_details: targetData.installation_details || '',
            status: targetData.status === 'active',
            canceled: targetData.canceled !== undefined ? targetData.canceled : defaultValues.canceled,
            deleted: targetData.deleted !== undefined ? targetData.deleted : defaultValues.deleted,
            index: targetData.index || defaultValues.index,
            plan: planData,
            creator_id: targetData.creator_id || defaultValues.creator_id,
            parent_id: targetData.parent_id || defaultValues.parent_id,
            shared: targetData.shared || null,
            user_id: targetData.user_id || defaultValues.creator_id
        };
        
        // Si es una actualización, incluir el _id
        if (this.target._id && this.target._id !== '') {
            mappedData._id = this.target._id;
        }
        
        return mappedData;
    }

    private validateForm(): boolean {
        // Validaciones según el tab activo
        if (this.activeTabIndex === 0) { // Tab de vehículo
            if (!this.target.name || !this.target.plate || !this.target.plan || !this.target.selectedPrice) {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translate('management.targetForm.validationError'),
                    detail: this.translate('management.targetForm.requiredFieldsMissing')
                });
                return false;
            }
        } else if (this.activeTabIndex === 1) { // Tab de instalación
            if (!this.target.imei || !this.target.sim_card || !this.target.plan || !this.target.selectedPrice) {
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

    // Método para mapear periodos de string a número
    private mapPeriodToNumber(period: string): number {
        const periodMap: Record<string, number> = {
            'monthly': 30,
            'quarterly': 90,
            'yearly': 365
        };
        return periodMap[period] || 30; // Por defecto mensual si el periodo no es reconocido
    }

    async onPlanChange() {
        if (this.target.plan && typeof this.target.plan === 'string') {
            try {
                // Resetear el precio seleccionado
                this.target.selectedPrice = null;
                
                // Cargar el plan completo con sus precios
                this.plansService.getPlanById(this.target.plan).subscribe({
                    next: (plan: Plan) => {
                        // Asegurar que los períodos de pago sean strings
                        this.availablePrices = plan.prices.map(price => {
                            return {
                                id: price.id,
                                amount: price.amount,
                                payment_period: typeof price.payment_period === 'string' ? 
                                    price.payment_period : 
                                    this.mapPeriodToString(price.payment_period)
                            };
                        });
                    },
                    error: (error) => {
                        console.error('Error al cargar los precios del plan:', error);
                        this.messageService.add({
                            severity: 'error',
                            summary: 'Error',
                            detail: 'No se pudieron cargar los precios del plan'
                        });
                        this.availablePrices = [];
                    }
                });
            } catch (error) {
                console.error('Error al cambiar de plan:', error);
                this.availablePrices = [];
            }
        } else {
            // Si no hay plan seleccionado, vaciar los precios
            this.availablePrices = [];
            this.target.selectedPrice = null;
        }
    }

    // Método para comparar objetos de precio (usado en select compareWith)
    comparePrices(price1: any, price2: any): boolean {
        return price1 && price2 ? price1.id === price2.id : price1 === price2;
    }

    // Método para mapear periodos de número a string
    mapPeriodToString(period: string | number): string {
        if (typeof period === 'string') {
            return period;
        }
        
        const periodMap: Record<number, string> = {
            30: 'monthly',
            90: 'quarterly',
            365: 'yearly'
        };
        
        return periodMap[period as number] || 'monthly';
    }
}
