import { Component, OnInit, Output, EventEmitter, Input, SimpleChanges, OnChanges, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Subject, takeUntil } from 'rxjs';
import { LangService } from '../../../../../../../shareds/services/langi18/lang.service';
import { 
  TARGET_FORM_STYLES, 
  TARGET_FORM_TRANSLATIONS,
  INSTALLATION_LOCATIONS,
  SIM_CARD_TYPES,
  FALLBACK_PLANS,
  FALLBACK_GPS_MODELS,
  FIELDS_TO_PRESERVE,
  YEARS_CONFIG,
  CUSTOM_PRICE_CONFIG,
  SelectOption,
  SmsMessage,
  CustomPrice
} from './constants/target-form.constants';
import { CloudComponent } from 'src/app/shareds/components/cloud/cloud.component';
import { VehicleBrandsService } from 'src/app/core/services/vehicle-brands.service';
import { ColorsService } from 'src/app/core/services/colors.service';
import { TargetsService } from 'src/app/core/services/targets.service';
import { PlansService } from 'src/app/core/services/plans.service';
import { CreateTargetDto, Target, UpdateTargetDto, TargetDevice } from 'src/app/core/interfaces/target.interface';
import { Plan, PlanPrice, ExtendedPlanPrice } from 'src/app/core/interfaces/plan.interface';
import { ProtocolsService } from 'src/app/core/services/protocols.service';
import { Protocol } from 'src/app/core/interfaces/protocol.interface';
import { ProtocolCommand } from 'src/app/core/interfaces/protocol.interface';
import { ManagementService } from 'src/app/admin/modules/management/presentation/services/management.service';



@Component({
    selector: 'app-target-form',
    templateUrl: './target-form.component.html',
    styleUrls: TARGET_FORM_STYLES,
    standalone: false
})
export class TargetFormComponent implements OnInit, OnChanges, OnDestroy, AfterViewInit {
    private destroy$ = new Subject<void>();

    @Input() targetInput: TargetDevice | null = null;
    @Output() targetCreated = new EventEmitter<void>();

    // Flag para mostrar/ocultar la edición personalizada de precio
    isCustomPriceEditing = false;
    customPrice: CustomPrice = { id: '', amount: 0, payment_period: CUSTOM_PRICE_CONFIG.DEFAULT_PAYMENT_PERIOD };
    
    // Precio original del plan, antes de cualquier personalización
    originalPlanPrice: { id: string; amount: number; payment_period: string } | null = null;
    
    // Flag para controlar la visibilidad del diálogo modal
    displayPriceDialog = false;

    // Claves de traducción importadas desde constantes
    translations = TARGET_FORM_TRANSLATIONS;

    target: TargetDevice = this.getEmptyTarget();
    activeTabIndex: number = 0;
    displayColorName: string = '';
    showColorOptions: boolean = true;
    isLoading: boolean = false;
    
    // Opciones para selects
    availableBrands: SelectOption[] = [];
    availableModels: SelectOption[] = [];
    availableYears: SelectOption[] = [];
    availableGpsModels: SelectOption[] = [];
    availableLocations: SelectOption[] = [];
    availableColors: SelectOption[] = [];
    availableSimCardTypes: SelectOption[] = [];
    availablePlans: SelectOption[] = [];
    availablePrices: ExtendedPlanPrice[] = [];
    filteredColors: SelectOption[] = [];
    
    // Propiedades para SMS
    selectedSmsCommand: string = '';
    smsMessages: SmsMessage[] = [];
    lastSentCommand: string = '';
    customSmsMessage: string = '';
    isLoadingSmsMessages: boolean = false;
    isSendingSms: boolean = false;
    
    // Protocolos y comandos dinámicos
    loadedProtocols: Protocol[] = [];
    availableCommands: ProtocolCommand[] = [];
    selectedProtocol: Protocol | null = null;
    pendingGpsModel: string = ''; // GPS model a asignar después de cargar protocolos
    
    // Referencias a elementos del DOM
    @ViewChild('smsCommands') smsCommands!: ElementRef;
    @ViewChild('smsChat') smsChat!: ElementRef;
    @ViewChild('chatMessages') chatMessages!: ElementRef;
    
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
        // El estado del dispositivo se obtiene desde traccarInfo.status
    }

    private async loadInitialData() {
        try {
            // Cargar años usando la configuración de constantes
            this.availableYears = Array.from({ length: YEARS_CONFIG.YEARS_TO_GENERATE }, (_, i) => {
                const year = YEARS_CONFIG.BASE_YEAR() - i;
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
                        // Almacenar protocolos completos para usar en SMS
                        this.loadedProtocols = protocols;
                        
                        // Mapear para select de GPS models
                        this.availableGpsModels = protocols.map(protocol => ({
                            label: protocol.name,
                            value: protocol._id
                        })).sort((a, b) => a.label.localeCompare(b.label));
                        
                        // Si hay un GPS model pendiente de asignar, asignarlo ahora
                        if (this.pendingGpsModel && this.availableGpsModels.some(model => model.value === this.pendingGpsModel)) {
                            this.target.type = this.pendingGpsModel;
                            this.pendingGpsModel = ''; // Limpiar el pendiente
                            console.log('✅ GPS model asignado después de cargar protocolos:', this.target.type);
                        }
                        
                        // Si hay un protocolo ya seleccionado, cargar sus comandos
                        this.updateSmsCommands();
                    },
                    error: (error) => {
                        console.error('Error al cargar protocolos:', error);
                        // Usar fallback de constantes
                        this.availableGpsModels = [...FALLBACK_GPS_MODELS];
                        this.loadedProtocols = [];
                        this.availableCommands = [];
                    }
                });
            
            // Usar constantes para ubicaciones y tipos de SIM
            this.availableLocations = [...INSTALLATION_LOCATIONS];
            this.availableSimCardTypes = [...SIM_CARD_TYPES];
            
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
                    // Usar fallback de constantes
                    this.availablePlans = [...FALLBACK_PLANS];
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
        
        // DEBUG: Ver qué datos llegan del backend para edición
        console.log('🔍 DEBUG setupEditTarget: Target original recibido:', target);
        
        // Si el target tiene originalTarget, usar esos datos en su lugar
        let targetData = target;
        if ((target as any)['originalTarget']) {
            console.log('✅ Usando originalTarget para los datos del formulario');
            targetData = (target as any)['originalTarget'];
        }
        
        console.log('🔍 Datos que se usarán para el formulario:', {
            _id: targetData._id,
            name: targetData.name,
            target_plate_number: targetData.target_plate_number,
            target_chassis_number: targetData.target_chassis_number,
            target_color: targetData.target_color,
            target_brand_id: targetData.target_brand_id,
            target_model_id: targetData.target_model_id,
            type: targetData.type,
            plan: targetData.plan,
            ignition_sensor: targetData.ignition_sensor,
            engine_shutdown: targetData.engine_shutdown
        });
        
        // Rellenar el formulario con los datos del objetivo a editar
        this.target = JSON.parse(JSON.stringify(targetData));
        
        // El backend ya maneja engine_shutdown directamente, no necesita mapeo
        
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
        
        // DEBUG: Ver campos después de asignación
        console.log('🔍 Campos después de asignación:', {
            target_plate_number: this.target.target_plate_number,
            target_chassis_number: this.target.target_chassis_number,
            target_color: this.target.target_color,
            device_imei: this.target.device_imei
        });
        
        // Guardar temporalmente el ID del modelo GPS para asignarlo después de cargar protocolos
        const selectedGpsModel = this.target.type || '';
        
        // Guardar temporalmente el ID del modelo seleccionado
        const selectedModelId = this.target.target_model_id || '';
        
        // Establecer el modelo a string vacía inicialmente hasta que carguemos los modelos disponibles
        this.target.target_model_id = '';
        
        // Para campos de selección, asegurarse de que se muestre la opción por defecto cuando están vacíos
        if (!this.target.type) {
            this.target.type = '';
        }
        
        if (this.target.sim_company === null || this.target.sim_company === undefined) {
            this.target.sim_company = '';
        }
        
        // Asegurar que engine_shutdown tenga un valor válido, preservando el existente
        if (this.target.engine_shutdown === null || this.target.engine_shutdown === undefined) {    
            this.target.engine_shutdown = '';
        }
        // console.log('🔍 DEBUG setupEditTarget: engine_shutdown cargado:', this.target.engine_shutdown);
        
        if (!this.target.installation_location || this.target.installation_location === '') {
            this.target.installation_location = '';
        }
        
        // Asegurar que ignition_sensor tenga un valor válido, preservando el existente
        if (this.target.ignition_sensor === null || this.target.ignition_sensor === undefined) {
            this.target.ignition_sensor = '';
        }
        // console.log('🔍 DEBUG setupEditTarget: ignition_sensor cargado:', this.target.ignition_sensor);
        
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
            console.log('🚗 Cargando modelos para marca:', this.target.target_brand_id, 'Modelo a restaurar:', selectedModelId);
            // Cargar modelos según la marca seleccionada
            this.vehicleBrandsService.getAllModelsByBrand(this.target.target_brand_id)
                .then((models: any) => {
                    this.availableModels = models.map((model: any) => ({
                        label: model.nombre,
                        value: model._id
                    })).sort((a: any, b: any) => a.label.localeCompare(b.label));
                    
                    console.log('🚗 Modelos cargados:', this.availableModels.length, 'modelos disponibles');
                    
                    // Una vez cargados los modelos, establecer el modelo seleccionado
                    if (selectedModelId && this.availableModels.some(m => m.value === selectedModelId)) {
                        this.target.target_model_id = selectedModelId;
                        console.log('✅ Modelo restaurado correctamente:', selectedModelId);
                    } else if (selectedModelId) {
                        console.log('❌ No se pudo restaurar el modelo:', selectedModelId, 'no está en la lista de modelos disponibles');
                    }
                })
                .catch(error => {
                    console.error('❌ Error al cargar modelos para edición:', error);
                    this.availableModels = [];
                });
        }
        
        // Configurar el plan si existe
        if (this.target.plan && typeof this.target.plan === 'object') {
            // Extraer el ID del plan
            if ('id_plan' in this.target.plan && this.target.plan.id_plan) {
                // Guardar el objeto plan original
                const originalPlan = this.target.plan;
                
                // Si hay un precio seleccionado, configurarlo antes de convertir el plan a string
                if (originalPlan.selected_price) {
                    
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
                        
                        
                        // Si hay un precio seleccionado, buscamos su correspondiente en los precios del plan
                        if (currentSelectedPrice) {
                            const matchedPrice = this.availablePrices.find(price => 
                                price.id === currentSelectedPrice.id
                            );
                            
                            if (matchedPrice) {
                                
                                // Si el precio ha sido modificado, guardamos el original
                                if (currentSelectedPrice.amount !== matchedPrice.amount) {
                                    
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
        
        // Si el plan original del target es diferente al plan actualizado, 
        // actualizar la fecha de expiración
        if (this.target.plan) {
            this.updateExpirationDate();
        }
        
        // Asignar el GPS model después de que los protocolos se hayan cargado
        // Si ya están cargados, asignar inmediatamente, si no, se asignará en el callback de protocolos
        console.log('📡 GPS Model a restaurar:', selectedGpsModel, 'Modelos GPS disponibles:', this.availableGpsModels.length);
        if (selectedGpsModel && this.availableGpsModels.length > 0) {
            // Verificar que el modelo está en la lista antes de asignarlo
            const modelExists = this.availableGpsModels.some(model => model.value === selectedGpsModel);
            if (modelExists) {
                this.target.type = selectedGpsModel;
                this.updateSmsCommands();
                console.log('✅ GPS Model restaurado correctamente:', selectedGpsModel);
            } else {
                console.log('❌ GPS Model no encontrado en la lista disponible:', selectedGpsModel);
                this.target.type = '';
            }
        } else if (selectedGpsModel) {
            // Guardar el GPS model para asignarlo cuando se carguen los protocolos
            this.pendingGpsModel = selectedGpsModel;
            console.log('⏳ GPS Model pendiente de asignar:', selectedGpsModel);
            
            // Intentar asignar inmediatamente si los protocolos ya están cargados
            // (esto puede suceder en navegaciones posteriores)
            setTimeout(() => {
                this.checkAndAssignPendingGpsModel();
            }, 100);
        }

        // Cargar mensajes SMS si hay SIM card configurada
        if (this.target.sim_card_number && this.target.sim_company) {
            setTimeout(() => {
                this.loadSmsMessages();
            }, 500);
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
                    
                    // console.log(`Cargados ${this.availableModels.length} modelos para la marca seleccionada`);
                } else {
                    // console.log('No se encontraron modelos para esta marca');
                    this.availableModels = [];
                }
            } else {
                // Si no hay marca seleccionada, vaciar los modelos
                this.availableModels = [];
                this.target.target_model_id = '';
                //  console.log('No hay marca seleccionada, se han limpiado los modelos');
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
        // 🔍 DEBUG: Ver estado del formulario antes de validar y procesar
        // console.log('🔍 DEBUG onSubmit - Estado antes de procesar:', {
        //     targetId: this.target._id,
        //     engine_shutdown: this.target.engine_shutdown,
        //     ignition_sensor: this.target.ignition_sensor,
        //     targetCompleto: this.target
        // });

        // Validar los datos antes de enviar
        if (!this.validateForm()) {
            return;
        }

        try {
            this.isLoading = true;
            const targetToSave = this.prepareTargetData();
            
            // console.log('Datos preparados para enviar:', targetToSave);
            
            // 🔍 DEBUG: Ver exactamente qué se va a enviar al backend para engine_shutdown
            // console.log('🔍 DEBUG - Campos específicos antes del envío:', {
            //     isUpdate: !!this.target._id,
            //     engine_shutdown_en_target: this.target.engine_shutdown,
            //     engine_shutdown_en_payload: targetToSave.engine_shutdown,
            //     ignition_sensor_en_payload: targetToSave.ignition_sensor
            // });
            
            if (this.target._id) {
                // Actualizar objetivo existente
                // console.log('Actualizando target existente con ID:', this.target._id);
                // console.log('📤 ENVIANDO AL BACKEND:');
                // console.log('- sim_company que se enviará:', targetToSave.sim_company);
                // console.log('- Datos completos:', targetToSave);
                const updatedTarget = await this.targetsService.updateTarget(this.target._id, targetToSave as UpdateTargetDto);
                // console.log('📥 RESPUESTA DEL BACKEND (UPDATE):');
                // console.log('- sim_company recibido:', (updatedTarget as any).sim_company);
                // console.log('- engine_shutdown recibido:', (updatedTarget as any).engine_shutdown);
                // console.log('- ignition_sensor recibido:', (updatedTarget as any).ignition_sensor);
                // console.log('- Target completo actualizado:', updatedTarget);
                
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
                // console.log('📥 RESPUESTA DEL BACKEND (CREATE):');
                // console.log('- engine_shutdown recibido:', (newTarget as any).engine_shutdown);
                // console.log('- ignition_sensor recibido:', (newTarget as any).ignition_sensor);
                // console.log('- Nuevo target creado exitosamente:', newTarget);
                
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
        // console.log('ID de usuario actual para parent_id:', currentUserId);
        
        return {
            api_position_id: 'default_position_id',
            api_device_id: 'default_api_device_id',
            type: 'vehicle',
            creator_id: currentUserId || '64a7ecf2de1b240df0a97345', // usar un ID de fallback si no hay ID actual
            parent_id: currentUserId || '64a7ecf2de1b240df0a97345', // usar un ID de fallback si no hay ID actual
            index: '1',
            canceled: false,
            delete: false,
            deleted: false,
            ignition_sensor: '', // Valor por defecto para sensor de encendido
            engine_shutdown: '' // Valor por defecto para control de apagado
        };
    }

    private prepareTargetData(): CreateTargetDto | UpdateTargetDto {
        // Crear una copia del objeto target con los campos actuales
        const targetData: any = { ...this.target };
        
        // Mapear campos del formulario a los nombres requeridos por el backend
        if (targetData.target_plate_number) {
            targetData.plate = targetData.target_plate_number;
            delete targetData.target_plate_number;
        }
        
        if (targetData.target_chassis_number) {
            targetData.chassis = targetData.target_chassis_number;
            delete targetData.target_chassis_number;
        }
        
        if (targetData.target_color) {
            targetData.color = targetData.target_color;
            delete targetData.target_color;
        }
        
        if (targetData.target_year) {
            targetData.year = targetData.target_year;
            delete targetData.target_year;
        }
        
        if (targetData.target_brand_id) {
            targetData.brand = targetData.target_brand_id;
            delete targetData.target_brand_id;
        }
        
        if (targetData.target_model_id) {
            targetData.model = targetData.target_model_id;
            delete targetData.target_model_id;
        }
        
        // NO mapear engine_shutdown - el backend ya lo espera con ese nombre
        // Asegurar que engine_shutdown se incluya explícitamente (incluso si está vacío)
        if (targetData.engine_shutdown === undefined || targetData.engine_shutdown === null) {
            targetData.engine_shutdown = '';
        }
        
        // Asegurar que ignition_sensor se incluya explícitamente (incluso si está vacío)
        if (targetData.ignition_sensor === undefined || targetData.ignition_sensor === null) {
            targetData.ignition_sensor = '';
        }
        
        // sim_company y sim_card_number ya tienen los nombres correctos, no necesitan mapeo
        
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
            // console.log('Estructura del plan a enviar:', {
            //     id_plan: targetData.plan.id_plan,
            //     precio_id: targetData.plan.selected_price.id,
            //     monto: targetData.plan.selected_price.amount,
            //     periodo: targetData.plan.selected_price.payment_period
            // });
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
        // Excluir campos que deben mantener su valor original (incluido string vacío)
        for (const key in defaultValues) {
            if ((targetData[key] === undefined || targetData[key] === null || targetData[key] === '') && !FIELDS_TO_PRESERVE.includes(key as any)) {
                targetData[key] = defaultValues[key];
            }
        }
        
        // Asegurar que sim_company siempre se incluya, incluso si está vacío
        // No aplicar ningún valor por defecto a sim_company
        
        // Eliminar propiedades que no deben enviarse al backend
        delete targetData.selectedPrice;
        
      
        
        // VERIFICACIÓN COMPLETA DE CAMPOS CLAVE
        // console.log('🔍 VERIFICACIÓN FINAL prepareTargetData:');
        // console.log('- sim_company en this.target:', this.target.sim_company);
        // console.log('- sim_company en targetData:', targetData.sim_company);
        // console.log('- ignition_sensor en this.target:', this.target.ignition_sensor);
        // console.log('- ignition_sensor en targetData:', targetData.ignition_sensor);
        // console.log('- engine_shutdown en this.target:', this.target.engine_shutdown);
        // console.log('- engine_shutdown en targetData:', targetData.engine_shutdown);
        // console.log('- isUpdate:', !!this.target._id);
        
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
            //  console.log('Advertencia: Formulario en modo edición pero sin ID de target');
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
            this.target.target_color = '';
        }
        
        // No necesitamos cambiar showColorOptions ya que siempre está visible
    }
    
    selectColor(color: { label: string, value: string }) {
        this.target.target_color = color.value;
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
        this.showColorOptions = false;
    }

    // Métodos para SMS
    selectSmsCommand(command: string): void {
        this.selectedSmsCommand = command;
        
        // Enviar comando automáticamente siempre
        this.sendCommand(command);
        
        // Sincronizar altura después de cualquier cambio
        setTimeout(() => {
            this.syncChatHeight();
            this.scrollToBottom();
        }, 50);
    }

    async sendCommand(commandName: string): Promise<void> {
        // Buscar el comando en los comandos disponibles del protocolo
        const selectedCommand = this.availableCommands.find(cmd => cmd.name === commandName);
        
        if (!selectedCommand) {
            console.error('Comando no encontrado:', commandName);
            this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: `El comando "${commandName}" no está disponible para este protocolo`
            });
            return;
        }

        if (!this.target.sim_card_number) {
            this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'Número de SIM card requerido para enviar SMS'
            });
            return;
        }

        const provider = this.getProviderFromSimCompany();
        if (!provider) {
            this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'Proveedor de SMS no configurado'
            });
            return;
        }

        await this.sendSmsMessage(selectedCommand.value, provider);
    }

    async sendCustomMessage(): Promise<void> {
        if (!this.customSmsMessage.trim()) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Advertencia',
                detail: 'Ingrese un mensaje para enviar'
            });
            return;
        }

        if (!this.target.sim_card_number) {
            this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'Número de SIM card requerido para enviar SMS'
            });
            return;
        }

        const provider = this.getProviderFromSimCompany();
        if (!provider) {
            this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'Proveedor de SMS no configurado'
            });
            return;
        }

        await this.sendSmsMessage(this.customSmsMessage, provider);
        this.customSmsMessage = ''; // Limpiar el campo después de enviar
    }

    private async sendSmsMessage(message: string, provider: 'myorion' | 'twilio' | 'emnify' | 'myorion2'): Promise<void> {
        try {
            this.isSendingSms = true;

            // Mostrar mensaje de envío
            this.messageService.add({
                severity: 'info',
                summary: 'Enviando SMS',
                detail: 'Enviando mensaje al dispositivo...',
                life: 2000
            });

            // Añadir mensaje enviado al chat
            this.smsMessages.push({
                type: 'sent',
                content: message,
                timestamp: new Date()
            });

            this.scrollToBottom();

            // Enviar SMS real al backend
            const response = await this.targetsService.sendSMS(this.target.sim_card_number, message, provider);

            console.log('📤 Respuesta del envío SMS:', response);

            // Validar que la respuesta no sea null/undefined
            if (!response) {
                console.warn('⚠️ Respuesta vacía del servidor');
                this.messageService.add({
                    severity: 'warn',
                    summary: 'SMS Enviado',
                    detail: 'Mensaje enviado, pero no se recibió confirmación del servidor'
                });
                return;
            }

            // Manejar diferentes formatos de respuesta
            const isSuccess = response.success === true || 
                             response.status === 'success' || 
                             response.result === 'success' ||
                             (response.error === undefined && response.success !== false);

            if (isSuccess) {
                this.messageService.add({
                    severity: 'success',
                    summary: 'SMS Enviado',
                    detail: response.message || 'Mensaje enviado correctamente al dispositivo'
                });
            } else {
                console.warn('⚠️ Respuesta de error del servidor:', response);
                this.messageService.add({
                    severity: 'warn',
                    summary: 'SMS Enviado',
                    detail: response.message || response.error || 'Mensaje enviado, pero hubo un problema en la entrega'
                });
            }

        } catch (error: any) {
            console.error('❌ Error al enviar SMS:', error);
            
            // Remover el mensaje del chat si falló completamente
            if (this.smsMessages.length > 0 && this.smsMessages[this.smsMessages.length - 1].content === message) {
                this.smsMessages.pop();
            }

            this.messageService.add({
                severity: 'error',
                summary: 'Error al Enviar SMS',
                detail: this.getErrorMessage(error)
            });
        } finally {
            this.isSendingSms = false;
        }
    }

    private getErrorMessage(error: any): string {
        if (error?.error?.message) {
            return error.error.message;
        }
        if (error?.message) {
            return error.message;
        }
        if (typeof error === 'string') {
            return error;
        }
        if (error?.status) {
            switch (error.status) {
                case 400: return 'Datos de SMS inválidos';
                case 401: return 'No autorizado para enviar SMS';
                case 403: return 'Acceso denegado al servicio SMS';
                case 404: return 'Servicio SMS no encontrado';
                case 500: return 'Error interno del servidor SMS';
                default: return `Error del servidor (${error.status})`;
            }
        }
        return 'Error desconocido al enviar SMS';
    }

    async loadSmsMessages(): Promise<void> {
        if (!this.target.sim_card_number) {
            return;
        }

        const provider = this.getProviderFromSimCompany();
        if (!provider) {
            return;
        }

        try {
            this.isLoadingSmsMessages = true;

            const response = await this.targetsService.getMessages(this.target.sim_card_number, provider);

            console.log('📨 Respuesta completa de getMessages:', response);

            // Verificar si la respuesta es un array directamente o tiene una estructura con success
            let messages = Array.isArray(response) ? response : (response.messages || response.data || []);
            
            console.log('📝 Mensajes a procesar:', messages);

            if (messages && Array.isArray(messages)) {
                // Convertir mensajes del backend al formato del componente
                this.smsMessages = messages.map((msg: any) => {
                    // Determinar tipo de mensaje:
                    // MT = Mobile Terminated (enviado al dispositivo) = 'sent'
                    // MO = Mobile Originated (recibido del dispositivo) = 'received'
                    const messageType = msg.type === 'MT' ? 'sent' : 'received';
                    
                    return {
                        type: messageType,
                        content: msg.text || msg.body || msg.message || '',
                        timestamp: new Date(msg.fecha || msg.timestamp || msg.date_created),
                        from: msg.from,
                        to: msg.to,
                        id: msg.id,
                        read: msg.read
                    };
                });

                // Ordenar por timestamp (más antiguos primero)
                this.smsMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

                console.log('✅ Mensajes procesados:', this.smsMessages);
                this.scrollToBottom();
            } else {
                console.log('⚠️ No se encontraron mensajes en la respuesta');
            }

        } catch (error: any) {
            console.error('Error al cargar mensajes SMS:', error);
            this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'No se pudieron cargar los mensajes SMS'
            });
        } finally {
            this.isLoadingSmsMessages = false;
        }
    }

    private getProviderFromSimCompany(): 'myorion' | 'twilio' | 'emnify' | 'myorion2' | null {
        if (!this.target.sim_company) {
            return null;
        }

        // Mapear tipos de SIM card a proveedores
        const providerMap: Record<string, 'myorion' | 'twilio' | 'emnify' | 'myorion2'> = {
            'myorion': 'myorion',
            'twilio': 'twilio',
            'emnify': 'emnify',
            'myorion2': 'myorion2',
            'nacionales': 'twilio', // nacionales = twilio
            'global-e': 'emnify', // global-e = emnify
            'global-m': 'myorion', // global-m = myorion
            'global-m2': 'myorion2', // global-m2 = myorion2
            'internacionales': 'twilio' // Mantener por compatibilidad
        };

        return providerMap[this.target.sim_company.toLowerCase()] || null;
    }

    onEnterKeySimple(event: KeyboardEvent): void {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (!this.isSendingSms && this.customSmsMessage.trim()) {
                this.sendCustomMessage();
            }
        }
    }

    autoResizeInput(event: Event): void {
        const textarea = event.target as HTMLTextAreaElement;
        textarea.style.height = 'auto';
        const newHeight = Math.min(textarea.scrollHeight, 100); // Máximo 3-4 líneas
        textarea.style.height = newHeight + 'px';
    }

    getCommandName(commandName: string): string {
        const command = this.availableCommands.find(cmd => cmd.name === commandName);
        return command ? command.name : commandName;
    }

    ngAfterViewInit() {
        // Sincronizar alturas después de que la vista esté completamente cargada
        setTimeout(() => {
            this.syncChatHeight();
            this.scrollToBottom();
        }, 100);
        
        // Observar cambios en el tamaño de la lista de comandos
        if (this.smsCommands) {
            const resizeObserver = new ResizeObserver(() => {
                this.syncChatHeight();
            });
            resizeObserver.observe(this.smsCommands.nativeElement);
        }
        
        // Listener para cambios de tamaño de ventana
        window.addEventListener('resize', () => {
            setTimeout(() => {
                this.syncChatHeight();
            }, 100);
        });
    }

    syncChatHeight(): void {
        if (this.smsCommands && this.smsChat) {
            // No aplicar sincronización en móvil (768px o menos)
            if (window.innerWidth <= 768) {
                this.smsChat.nativeElement.style.height = 'auto';
                return;
            }
            
            const commandsHeight = this.smsCommands.nativeElement.offsetHeight;
            const minHeight = 350; // Altura mínima
            const finalHeight = Math.max(commandsHeight, minHeight);
            this.smsChat.nativeElement.style.height = `${finalHeight}px`;
        }
    }

    scrollToBottom(): void {
        if (this.chatMessages) {
            setTimeout(() => {
                const element = this.chatMessages.nativeElement;
                element.scrollTop = element.scrollHeight;
            }, 100);
        }
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    /**
     * Verifica y asigna el GPS model pendiente si los protocolos ya están cargados
     */
    private checkAndAssignPendingGpsModel(): void {
        if (this.pendingGpsModel && this.availableGpsModels.length > 0) {
            const modelExists = this.availableGpsModels.some(model => model.value === this.pendingGpsModel);
            if (modelExists) {
                this.target.type = this.pendingGpsModel;
                this.pendingGpsModel = ''; // Limpiar el pendiente
                this.updateSmsCommands();
                console.log('✅ GPS Model pendiente asignado correctamente:', this.target.type);
            } else {
                console.log('❌ GPS Model pendiente no encontrado en la lista:', this.pendingGpsModel);
            }
        }
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
            // console.log('Iniciando edición de precio con ID:', this.target.selectedPrice.id);
            
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
                        // console.log('Precio original encontrado en plan:', planOriginalPrice);
                        
                        // Guardar el precio original para mostrarlo en el modal
                        this.originalPlanPrice = {
                            id: planOriginalPrice.id,
                            amount: planOriginalPrice.amount,
                            payment_period: typeof planOriginalPrice.payment_period === 'string' ?
                                planOriginalPrice.payment_period :
                                this.mapPeriodToString(planOriginalPrice.payment_period)
                        };
                    } else {
                        // console.log('No se encontró el precio original en el plan');
                        this.originalPlanPrice = null;
                    }
                },
                error: (error) => {
                    console.error('Error al cargar el plan para obtener el precio original:', error);
                    this.originalPlanPrice = null;
                }
            });
            
            // console.log('Custom price configurado:', this.customPrice);
        } else {
            // Iniciar con valores por defecto
            this.customPrice = {
                id: CUSTOM_PRICE_CONFIG.CUSTOM_PREFIX + new Date().getTime(),
                amount: 0,
                payment_period: CUSTOM_PRICE_CONFIG.DEFAULT_PAYMENT_PERIOD
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
            this.availablePrices = [customPriceObj, ...this.availablePrices.filter(p => !p.id.startsWith(CUSTOM_PRICE_CONFIG.CUSTOM_PREFIX))];
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

    // Métodos para manejar comandos SMS dinámicos
    updateSmsCommands(): void {
        const gpsModelId = this.target.type;
        if (gpsModelId && this.loadedProtocols.length > 0) {
            this.selectedProtocol = this.loadedProtocols.find(p => p._id === gpsModelId) || null;
            this.availableCommands = this.selectedProtocol?.commands || [];
        } else {
            this.selectedProtocol = null;
            this.availableCommands = [];
        }
        
        // Sincronizar altura después de cambiar comandos
        setTimeout(() => {
            this.syncChatHeight();
        }, 50);
    }

    onGpsModelChange(): void {
        // Actualizar comandos cuando cambie el modelo GPS
        this.updateSmsCommands();
        // Limpiar comando seleccionado al cambiar modelo
        this.selectedSmsCommand = '';
    }

    onSimCompanyChange(event: any): void {
        let rawValue = event.target.value;
        
        // Limpiar el valor si Angular añadió un prefijo (ej: "1: nacionales" -> "nacionales")
        let cleanValue = rawValue;
        if (rawValue && rawValue.includes(': ')) {
            cleanValue = rawValue.split(': ')[1] || rawValue;
        }
        
        console.log('DEBUG: sim_company cambió a:', {
            valor_select_raw: rawValue,
            valor_limpio: cleanValue,
            target_sim_company_antes: this.target.sim_company
        });
        
        // Establecer el valor limpio
        this.target.sim_company = cleanValue;
        console.log('ESTABLECIDO: sim_company final:', this.target.sim_company);
    }

    // Método para obtener el estado real del dispositivo desde traccarInfo
    isDeviceOnline(): boolean {
        return this.target?.traccarInfo?.status === 'online';
    }

    // Método para verificar si hay un tipo de SIM card seleccionado
    hasSimCardTypeSelected(): boolean {
        return !!(this.target?.sim_company && this.target.sim_company.trim() !== '');
    }

    // Método para obtener el nombre de visualización del tipo de SIM card
    getSimCardDisplayName(): string {
        if (!this.target?.sim_company) {
            return 'SMS';
        }

        // Buscar el tipo de SIM card en la lista de opciones disponibles
        const simCardType = this.availableSimCardTypes.find(
            simType => simType.value === this.target.sim_company
        );

        // Devolver el label si se encuentra, o el valor original si no se encuentra
        return simCardType ? simCardType.label : this.target.sim_company;
    }
}
