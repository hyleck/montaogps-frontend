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

// Interfaz extendida para PlanPrice que incluye el monto original
interface ExtendedPlanPrice extends PlanPrice {
  originalAmount?: number;
}

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

    // Flag para mostrar/ocultar la edición personalizada de precio
    isCustomPriceEditing = false;
    customPrice: { id: string; amount: number; payment_period: string; originalAmount?: number } = { id: '', amount: 0, payment_period: 'monthly' };
    
    // Precio original del plan, antes de cualquier personalización
    originalPlanPrice: { id: string; amount: number; payment_period: string } | null = null;
    
    // Flag para controlar la visibilidad del diálogo modal
    displayPriceDialog = false;

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
    availablePrices: ExtendedPlanPrice[] = [];
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
            plan: '',
            selectedPrice: null
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
        
        // Asegurarse de que los campos estén correctamente formateados
        // y que los valores vacíos tengan el formato adecuado para los selectores
        
        // Para mantener compatibilidad con versiones anteriores,
        // aseguramos que algunos campos siempre tengan un valor
        this.target.device_imei = this.target.device_imei || '';
        this.target.sim_card_number = this.target.sim_card_number || '';
        this.target.target_plate_number = this.target.target_plate_number || '';
        this.target.target_chassis_number = this.target.target_chassis_number || '';
        this.target.target_brand_id = this.target.target_brand_id || '';
        this.target.target_color = this.target.target_color || '';
        this.target.target_year = this.target.target_year || '';
        
        // Guardar temporalmente el ID del modelo seleccionado
        const selectedModelId = this.target.target_model_id || '';
        
        // Establecer el modelo a string vacía inicialmente hasta que carguemos los modelos disponibles
        this.target.target_model_id = '';
        
        // Para campos de selección, asegurarse de que se muestre la opción por defecto cuando están vacíos
        if (!this.target.type) {
            this.target.type = '';
        }
        
        if (!this.target.sim_company) {
            this.target.sim_company = '';
        }
        
        if (!this.target.engine_shutdown) {
            this.target.engine_shutdown = '';
        }
        
        if (!this.target.installation_location || this.target.installation_location === '') {
            this.target.installation_location = '';
        }
        
        if (!this.target.ignition_sensor || this.target.ignition_sensor === '') {
            this.target.ignition_sensor = '';
        }
        
        // Ajuste para el estado (status): en DB es boolean, en formulario puede ser string
        if (this.target.status === true || String(this.target.status) === 'true') {
            this.target.status = 'active';
        } else if (this.target.status === false || String(this.target.status) === 'false') {
            this.target.status = 'inactive';
        }
        
        // Formatear fechas para el input HTML
        this.target.activation_date = this.formatDateToInput(this.target.activation_date || '');
        
        if (this.target.expiration_date) {
            this.target.expiration_date = this.formatDateToInput(this.target.expiration_date);
        }
        
        // Formatear la fecha de instalación si existe, o usar la fecha actual si no existe
        if (this.target.installation_date) {
            this.target.installation_date = this.formatDateToInput(this.target.installation_date);
        } else {
            this.target.installation_date = new Date().toISOString().substring(0, 10);
        }
        
        this.activeTabIndex = 0;
        
        // Actualizar el nombre del color para mostrar
        if (this.target.target_color) {
            const colorObj = this.availableColors.find(c => c.value === this.target.target_color);
            this.displayColorName = colorObj ? colorObj.label : '';
        } else {
            this.displayColorName = '';
        }
        
        // Cargar los modelos para la marca seleccionada
        if (this.target.target_brand_id) {
            // Cargar modelos según la marca seleccionada
            this.vehicleBrandsService.getAllModelsByBrand(this.target.target_brand_id)
                .then((models: any) => {
                    this.availableModels = models.map((model: any) => ({
                        label: model.nombre,
                        value: model._id
                    })).sort((a: any, b: any) => a.label.localeCompare(b.label));
                    
                    // Una vez cargados los modelos, establecer el modelo seleccionado
                    if (selectedModelId && this.availableModels.some(m => m.value === selectedModelId)) {
                        this.target.target_model_id = selectedModelId;
                    }
                })
                .catch(error => {
                    console.error('Error al cargar modelos para edición:', error);
                    this.availableModels = [];
                });
        }
        
        // Configurar el plan si existe
        if (this.target.plan && typeof this.target.plan === 'object') {
            console.log('Configurando plan desde objeto:', this.target.plan);
            // Extraer el ID del plan
            if ('id_plan' in this.target.plan && this.target.plan.id_plan) {
                // Guardar el objeto plan original
                const originalPlan = this.target.plan;
                
                // Si hay un precio seleccionado, configurarlo antes de convertir el plan a string
                if (originalPlan.selected_price) {
                    console.log('Precio seleccionado encontrado:', originalPlan.selected_price);
                    
                    // Crear objeto de precio seleccionado
                    this.target.selectedPrice = {
                        id: originalPlan.selected_price.id,
                        amount: originalPlan.selected_price.amount,
                        payment_period: originalPlan.selected_price.payment_period
                    };
                }
                
                // Establecer el ID del plan como string para el selector
                this.target.plan = originalPlan.id_plan as string;
                
                // Cargar los precios disponibles para este plan
                // Hacemos esto después de configurar selectedPrice para que no se pierda
                this.plansService.getPlanById(this.target.plan).subscribe({
                    next: (plan: Plan) => {
                        console.log('Plan cargado con éxito:', plan);
                        
                        // Guardar precio seleccionado actual para preservar su valor personalizado
                        const currentSelectedPrice = this.target.selectedPrice ? { ...this.target.selectedPrice } : null;
                        
                        // Mapear precios disponibles
                        this.availablePrices = plan.prices.map(price => ({
                            id: price.id,
                            amount: price.amount,
                            payment_period: typeof price.payment_period === 'string' ? 
                                price.payment_period : 
                                this.mapPeriodToString(price.payment_period)
                        }));
                        
                        console.log('Precios disponibles:', this.availablePrices);
                        console.log('Precio seleccionado antes de restaurar:', currentSelectedPrice);
                        
                        // Si hay un precio seleccionado, buscamos su correspondiente en los precios del plan
                        if (currentSelectedPrice) {
                            const matchedPrice = this.availablePrices.find(price => 
                                price.id === currentSelectedPrice.id
                            );
                            
                            if (matchedPrice) {
                                console.log('Precio coincidente encontrado:', matchedPrice);
                                
                                // Si el precio ha sido modificado, guardamos el original
                                if (currentSelectedPrice.amount !== matchedPrice.amount) {
                                    console.log('Precio personalizado detectado:', currentSelectedPrice.amount, 'Original:', matchedPrice.amount);
                                    
                                    // Guardar el monto original
                                    const customPrice = {
                                        ...matchedPrice,
                                        amount: currentSelectedPrice.amount, // Usar el monto personalizado
                                        originalAmount: matchedPrice.amount  // Guardar el monto original
                                    };
                                    
                                    // Reemplazar el precio en la lista
                                    const priceIndex = this.availablePrices.findIndex(p => p.id === matchedPrice.id);
                                    if (priceIndex >= 0) {
                                        this.availablePrices[priceIndex] = customPrice;
                                    }
                                    
                                    // Actualizar el precio seleccionado
                                    this.target.selectedPrice = customPrice;
                                } else {
                                    this.target.selectedPrice = matchedPrice;
                                }
                            } else {
                                // Si no encontramos el precio en la lista, lo agregamos como personalizado
                                const customPrice = {
                                    ...currentSelectedPrice,
                                    originalAmount: 0 // No conocemos el original, marcamos como 0
                                };
                                
                                // Agregar al inicio de la lista
                                this.availablePrices = [customPrice, ...this.availablePrices];
                                this.target.selectedPrice = customPrice;
                            }
                        }
                    },
                    error: (error) => {
                        console.error('Error al cargar el plan:', error);
                    }
                });
            }
        } else if (!this.target.plan) {
            // Si no hay plan, establecer string vacía para mostrar la opción por defecto
            this.target.plan = '';
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
            if (this.target.target_brand_id) {
                // Limpiar el modelo seleccionado
                this.target.target_model_id = '';
                this.availableModels = [];
                
                // Mostrar indicador de carga si es necesario
                // this.isLoadingModels = true;
                
                // Cargar modelos para la marca seleccionada
                const models = await this.vehicleBrandsService.getAllModelsByBrand(this.target.target_brand_id);
                
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
                this.target.target_model_id = '';
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
            this.target.target_model_id = '';
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
                console.log('Actualizando target existente con ID:', this.target._id);
                const updatedTarget = await this.targetsService.updateTarget(this.target._id, targetToSave as UpdateTargetDto);
                console.log('Target actualizado exitosamente:', updatedTarget);
                
                this.messageService.add({
                    severity: 'success',
                    summary: this.translate('management.targetForm.updateSuccess'),
                    detail: this.translate('management.targetForm.updateSuccessDetail')
                });
                
                // Emitir evento de actualización
                this.targetCreated.emit();
            } else {
                // Crear nuevo objetivo
                const newTarget = await this.targetsService.createTarget(targetToSave as CreateTargetDto);
                console.log('Nuevo target creado exitosamente:', newTarget);
                
                this.messageService.add({
                    severity: 'success',
                    summary: this.translate('management.targetForm.saveSuccess'),
                    detail: this.translate('management.targetForm.saveSuccessDetail')
                });
                
                // Emitir evento de creación
                this.targetCreated.emit();
            }
            
            // Resetear el formulario solo después de una creación exitosa
            // Para edición, mantenemos los datos para posibles ediciones adicionales
            if (!this.target._id) {
                this.resetForm();
            }
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
            } else if (error.message) {
                errorMessage += `: ${error.message}`;
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
        if (targetData.plan && targetData.selectedPrice) {
            // Cuando hay un precio personalizado, conservamos el ID original
            // y solo modificamos el monto
            targetData.plan = {
                id_plan: targetData.plan,
                selected_price: {
                    id: targetData.selectedPrice.id,
                    amount: targetData.selectedPrice.amount,
                    payment_period: typeof targetData.selectedPrice.payment_period === 'string' ? 
                        targetData.selectedPrice.payment_period : 
                        this.mapPeriodToString(targetData.selectedPrice.payment_period)
                }
            };
            
            // Debug para verificar la estructura del plan en el envío
            console.log('Estructura del plan a enviar:', {
                id_plan: targetData.plan.id_plan,
                precio_id: targetData.plan.selected_price.id,
                monto: targetData.plan.selected_price.amount,
                periodo: targetData.plan.selected_price.payment_period
            });
        } else {
            targetData.plan = null;
        }
        
        // Convertir el array de contactos a string si es necesario
        if (Array.isArray(targetData.contacts)) {
            targetData.contacts = targetData.contacts.join(',');
        }
        
        // Formatear fechas
        if (targetData.activation_date) {
            targetData.activation_date = new Date(targetData.activation_date);
        } else if (targetData.activation_date) {
            targetData.activation_date = new Date(targetData.activation_date);
        } else {
            targetData.activation_date = new Date();
        }
        
        if (targetData.expiration_date) {
            targetData.expiration_date = new Date(targetData.expiration_date);
        }
        
        // Actualizar la fecha del último cambio
        targetData.last_change_date = new Date();
        
        // Convertir status de string a boolean
        targetData.status = targetData.status === 'active';
        
        // Aplicar valores por defecto para campos requeridos pero que podrían estar vacíos
        for (const key in defaultValues) {
            if (!targetData[key]) {
                targetData[key] = defaultValues[key];
            }
        }
        
        // Eliminar propiedades que no deben enviarse al backend
        delete targetData.selectedPrice;
        
        // Para depuración, mostrar campos clave que se enviarán
        if (this.target._id) {
            console.log('Campos clave para actualización:', {
                id: this.target._id,
                name: targetData.name,
                device_imei: targetData.device_imei,
                plan: targetData.plan,
                status: targetData.status
            });
        }
        
        return targetData;
    }

    private validateForm(): boolean {
        // Validaciones según el tab activo
        if (this.activeTabIndex === 0) { // Tab de vehículo
            if (!this.target.name || !this.target.target_plate_number || !this.target.plan || !this.target.selectedPrice) {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translate('management.targetForm.validationError'),
                    detail: this.translate('management.targetForm.requiredFieldsMissing')
                });
                return false;
            }
        } else if (this.activeTabIndex === 1) { // Tab de instalación
            if (!this.target.device_imei || !this.target.sim_card_number || !this.target.plan || !this.target.selectedPrice) {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translate('management.targetForm.validationError'),
                    detail: this.translate('management.targetForm.deviceInfoMissing')
                });
                return false;
            }
        }
        
        // Validación específica para el plan y precio
        if (!this.target.plan) {
            this.messageService.add({
                severity: 'error',
                summary: this.translate('management.targetForm.validationError'),
                detail: this.translate('management.targetForm.planRequired')
            });
            return false;
        }
        
        if (!this.target.selectedPrice) {
            this.messageService.add({
                severity: 'error',
                summary: this.translate('management.targetForm.validationError'),
                detail: this.translate('management.targetForm.priceRequired')
            });
            return false;
        }
        
        // Si estamos actualizando, validamos que tengamos un ID
        if (this.target._id === '') {
            console.log('Advertencia: Formulario en modo edición pero sin ID de target');
        }
        
        // Validar el formato del IMEI
        if (this.target.device_imei && (this.target.device_imei.length < 10 || !/^[0-9]+$/.test(this.target.device_imei))) {
            this.messageService.add({
                severity: 'warning',
                summary: this.translate('management.targetForm.validationWarning'),
                detail: this.translate('management.targetForm.imeiFormatWarning')
            });
            // No bloqueamos el guardado, solo advertimos
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

    // Método para calcular la fecha de expiración basada en el período de pago
    private updateExpirationDate(): void {
        if (this.target.selectedPrice && this.target.selectedPrice.payment_period) {
            // Obtener los días del período de pago
            const periodInDays = this.mapPeriodToNumber(this.target.selectedPrice.payment_period.toString());
            
            // Usar la fecha de activación/instalación como base si existe, o la fecha actual
            let baseDate = new Date();
            if (this.target.activation_date) {
                baseDate = new Date(this.target.activation_date);
            } else if (this.target.installation_date) {
                baseDate = new Date(this.target.installation_date);
            }
            
            // Calcular la fecha de expiración sumando los días del período
            const expirationDate = new Date(baseDate);
            expirationDate.setDate(expirationDate.getDate() + periodInDays);
            
            // Formatear la fecha de expiración para el input HTML
            this.target.expiration_date = this.formatDateToInput(expirationDate.toISOString());
            
            console.log(`Fecha de expiración calculada: ${this.target.expiration_date} (basada en un período de ${periodInDays} días)`);
        }
    }

    async onPlanChange() {
        if (this.target.plan && typeof this.target.plan === 'string' && this.target.plan !== '') {
            try {
                // Guardar el precio seleccionado actual para restaurarlo si es necesario
                const currentSelectedPrice = this.target.selectedPrice;
                
                // Resetear el precio seleccionado temporalmente
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
                        
                        // Restaurar el precio seleccionado si existe y coincide con uno de los precios disponibles
                        if (currentSelectedPrice) {
                            const matchedPrice = this.availablePrices.find(price => 
                                price.id === currentSelectedPrice.id
                            );
                            
                            if (matchedPrice) {
                                this.target.selectedPrice = matchedPrice;
                                // Actualizar fecha de expiración según el período de pago
                                this.updateExpirationDate();
                            }
                        }
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
    
    // Método para manejar el cambio de precio seleccionado
    onPriceChange(): void {
        // Actualizar la fecha de expiración basada en el período de pago
        this.updateExpirationDate();
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

    // Método para iniciar la edición personalizada de precio
    startCustomPriceEdit(): void {
        // Si ya hay un precio seleccionado, tomamos sus valores como base
        if (this.target.selectedPrice && this.target.plan) {
            console.log('Iniciando edición de precio con ID:', this.target.selectedPrice.id);
            
            // Guardar el precio actual para edición
            this.customPrice = {
                id: this.target.selectedPrice.id,
                amount: this.target.selectedPrice.amount,
                payment_period: this.target.selectedPrice.payment_period as string
            };
            
            // Cargar los precios originales del plan directamente desde el servicio
            // para asegurarnos de tener los valores originales, no los personalizados
            this.plansService.getPlanById(this.target.plan as string).subscribe({
                next: (plan: Plan) => {
                    // Buscar el precio original por ID
                    const planOriginalPrice = plan.prices.find(price => price.id === this.target.selectedPrice?.id);
                    
                    if (planOriginalPrice) {
                        console.log('Precio original encontrado en plan:', planOriginalPrice);
                        
                        // Guardar el precio original para mostrarlo en el modal
                        this.originalPlanPrice = {
                            id: planOriginalPrice.id,
                            amount: planOriginalPrice.amount,
                            payment_period: typeof planOriginalPrice.payment_period === 'string' ?
                                planOriginalPrice.payment_period :
                                this.mapPeriodToString(planOriginalPrice.payment_period)
                        };
                    } else {
                        console.log('No se encontró el precio original en el plan');
                        this.originalPlanPrice = null;
                    }
                },
                error: (error) => {
                    console.error('Error al cargar el plan para obtener el precio original:', error);
                    this.originalPlanPrice = null;
                }
            });
            
            console.log('Custom price configurado:', this.customPrice);
        } else {
            // Iniciar con valores por defecto
            this.customPrice = {
                id: 'custom_' + new Date().getTime(),
                amount: 0,
                payment_period: 'monthly'
            };
            this.originalPlanPrice = null;
        }
        
        // Mostrar el diálogo modal
        this.displayPriceDialog = true;
    }

    // Método para verificar si un precio está personalizado (tiene un monto diferente al original)
    isPriceCustomized(price: any): boolean {
        // Si el precio tiene un originalAmount definido, es personalizado
        if (price && price.originalAmount !== undefined && price.originalAmount !== price.amount && price.originalAmount > 0) {
            return true;
        }
        
        // Si no tiene originalAmount, buscamos el original en la lista para comparar
        const originalPrice = this.availablePrices.find(p => p.id === price?.id && p !== price);
        return originalPrice !== undefined && originalPrice.amount !== price.amount;
    }

    // Método para obtener el monto original de un precio
    getOriginalPriceAmount(price: any): number | undefined {
        // Si el precio tiene originalAmount definido, usarlo
        if (price && price.originalAmount !== undefined && price.originalAmount > 0) {
            return price.originalAmount;
        }
        
        // Si no, buscar el precio original en la lista
        if (price && price.id) {
            const originalPrice = this.availablePrices.find(p => p.id === price.id && p !== price);
            if (originalPrice) {
                return originalPrice.amount;
            }
        }
        
        // Si no se encuentra, devolver undefined
        return undefined;
    }

    // Método para obtener el monto original de un precio por su ID
    getOriginalPriceAmountForId(priceId: string): number | undefined {
        // Buscar el precio original en la lista de precios disponibles
        const originalPrice = this.availablePrices.find(p => p.id === priceId);
        if (originalPrice) {
            return originalPrice.amount;
        }
        return undefined;
    }

    // Método para aplicar el precio personalizado
    applyCustomPrice(): void {
        if (this.customPrice.amount <= 0) {
            this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: this.translate('management.targetForm.invalidPrice')
            });
            return;
        }

        // Crear un nuevo precio personalizado
        const customPriceObj = {
            id: this.customPrice.id, // Mantener el ID original
            amount: this.customPrice.amount,
            payment_period: this.customPrice.payment_period,
            originalAmount: this.getOriginalPriceAmountForId(this.customPrice.id) // Guardar el monto original
        };

        // Añadir/actualizar el precio personalizado en la lista
        const existingIndex = this.availablePrices.findIndex(p => p.id === customPriceObj.id);
        if (existingIndex >= 0) {
            // Guardar el monto original si no existe
            if (!this.availablePrices[existingIndex].originalAmount) {
                customPriceObj.originalAmount = this.availablePrices[existingIndex].amount;
            }
            // Actualizar el precio existente
            this.availablePrices[existingIndex] = customPriceObj;
        } else {
            // Añadir el precio personalizado al inicio de la lista para que aparezca primero
            this.availablePrices = [customPriceObj, ...this.availablePrices.filter(p => !p.id.startsWith('custom_'))];
        }

        // Seleccionar el precio personalizado
        this.target.selectedPrice = customPriceObj;

        // Actualizar la fecha de expiración
        this.updateExpirationDate();

        // Cerrar el diálogo modal
        this.displayPriceDialog = false;

        this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: this.translate('management.targetForm.customPriceApplied')
        });
    }

    // Método para cancelar la edición personalizada
    cancelCustomPrice(): void {
        // Cerrar el diálogo modal
        this.displayPriceDialog = false;
    }
}
