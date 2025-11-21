import { Component, OnInit, Output, EventEmitter, Input, SimpleChanges, OnChanges, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { MessageService } from 'primeng/api';
import { Subject, takeUntil, interval, Subscription } from 'rxjs';
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
import { ServersService } from 'src/app/core/services/servers.service';
import { CreateTargetDto, Target, UpdateTargetDto, TargetDevice, CreateProcessDto, ProcessResponse } from 'src/app/core/interfaces/target.interface';
import { Plan, PlanPrice, ExtendedPlanPrice } from 'src/app/core/interfaces/plan.interface';
import { Server } from 'src/app/core/interfaces/server.interface';
import { ProtocolsService } from 'src/app/core/services/protocols.service';
import { Protocol } from 'src/app/core/interfaces/protocol.interface';
import { AuthService } from 'src/app/core/services/auth.service';
import { ProtocolCommand } from 'src/app/core/interfaces/protocol.interface';
import { ManagementService } from 'src/app/admin/modules/management/presentation/services/management.service';
import { UserService } from 'src/app/core/services/user.service';
import { User } from 'src/app/core/interfaces/user.interface';
import { CommandsService, Command } from 'src/app/core/services/commands.service';



@Component({
    selector: 'app-target-form',
    templateUrl: './target-form.component.html',
    styleUrls: TARGET_FORM_STYLES,
    standalone: false,
    animations: [
        trigger('slideInOut', [
            state('in', style({ height: '*', opacity: 1 })),
            state('out', style({ height: '0px', opacity: 0, overflow: 'hidden' })),
            transition('in <=> out', animate('300ms ease-in-out'))
        ])
    ]
})
export class TargetFormComponent implements OnInit, OnChanges, OnDestroy, AfterViewInit {
    private destroy$ = new Subject<void>();
    private smsPollingSub: Subscription | null = null;

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
    private _displayColorName: string = '';
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
            this.target.target_color = '';
        }
    }
    showColorOptions: boolean = true;
    isLoading: boolean = false;
    
    // Flag para determinar si estamos editando un target existente
    get isEditMode(): boolean {
        return !!(this.target && this.target._id && this.target._id.trim());
    }
    
    // Opciones para selects
    availableBrands: SelectOption[] = [];
    availableModels: SelectOption[] = [];
    availableYears: SelectOption[] = [];
    availableGpsModels: SelectOption[] = [];
    availableLocations: SelectOption[] = [];
    availableColors: SelectOption[] = [];
    availableSimCardTypes: SelectOption[] = [
        { value: 'tigo', label: 'Tigo' },
        { value: 'entel', label: 'Entel' },
        { value: 'viva', label: 'Viva' },
        { value: 'telecel', label: 'Telecel' },
        { value: 'boliviatel', label: 'Boliviatel' },
        { value: 'global-m2', label: 'Global M2' },
        { value: 'other', label: 'Otro' }
    ];
    availablePlans: SelectOption[] = [];
    availablePrices: ExtendedPlanPrice[] = [];
    filteredColors: SelectOption[] = [];
    availableTechnicians: SelectOption[] = [];
    
    // Planes específicos para procesos (separados del formulario principal)
    availablePlansForProcess: SelectOption[] = [];
    
    // Precios específicos para procesos (separados del formulario principal)
    availablePricesForProcess: ExtendedPlanPrice[] = [];
    
    // Bandera para evitar recálculo automático de fecha de expiración
    skipExpirationDateRecalculation: boolean = false;
    
    // Propiedades para SMS
    selectedSmsCommand: string = '';
    smsMessages: SmsMessage[] = [];
    lastSentCommand: string = '';
    customSmsMessage: string = '';
    isLoadingSmsMessages: boolean = false;
    hasLoadedSmsMessages: boolean = false;
    isSendingSms: boolean = false;
    
    // Protocolos y comandos dinámicos
    loadedProtocols: Protocol[] = [];
    availableCommands: ProtocolCommand[] = [];
    
    // Propiedades para formulario de procesos
    processForm = {
        type: '',
        registrationDate: this.getTodayInputDate(),
        description: '',
        newPlan: '',
        newPrice: null,
        newInstallationDate: '',
        newExpirationDate: '',
        newRenewalDate: '',
        newTechnician: '',
        newGpsImei: '',
        newGpsModel: '',
        newInstallationDetails: '',
        newSimCard: '',
        newSimCompany: '',
        newSimNumber: '',
        newSimType: ''
    };
    
    // Mapeo de tipos de proceso a números
    private processTypeMap: { [key: string]: number } = {
        'installation': 2, // Modificación de fecha de instalación
        'expiration': 3, // Modificación de fecha de expiración
        'renewal': 4, // Renovación de servicio
        'plan_change': 5, // Cambio de plan
        'technician_change': 8, // Modificar técnico
        'gps_change': 9, // Cambio de GPS
        'installation_details_change': 10, // Modificar detalles de instalación
        'gps_model_change': 11, // Modificar modelo de GPS
        'imei_change': 12, // Modificar IMEI / GPS ID
        'sim_change': 13, // Cambio de SIM card
        'sim_number_change': 14, // Modificar número de SIM card
        'sim_type_change': 15, // Modificar tipo de SIM card
        'restoration': 16 // Restauración de target cancelado
    };

    // Lista de procesos del target actual
    processList: ProcessResponse[] = [];
    isLoadingProcesses: boolean = false;
    displayProcessesDialog: boolean = false;
    expandedProcessIndex: number | null = null;
    // Personalización de precio para CAMBIO DE PLAN (proceso)
    displayProcessPriceDialog = false;
    processCustomPrice: { id: string; amount: number; payment_period: string } = {
        id: CUSTOM_PRICE_CONFIG.CUSTOM_PREFIX + new Date().getTime(),
        amount: 0,
        payment_period: CUSTOM_PRICE_CONFIG.DEFAULT_PAYMENT_PERIOD
    };
    processOriginalPlanPrice: { id: string; amount: number; payment_period: string } | null = null;
    selectedProtocol: Protocol | null = null;
    pendingGpsModel: string = ''; // GPS model a asignar después de cargar protocolos
    
    // Referencias a elementos del DOM
    @ViewChild('smsCommands') smsCommands!: ElementRef;
    @ViewChild('smsChat') smsChat!: ElementRef;
    @ViewChild('chatMessages') chatMessages!: ElementRef;

    // Propiedad para el tipo de afiliación del usuario actual
    currentUserAffiliationTypeId: string = '';

    // Propiedad para controlar la visibilidad del modal de gestión de comandos
    displayCommandManagementModal: boolean = false;

    // Propiedad para controlar la visibilidad del modal de historial de comandos
    displayCommandHistoryModal: boolean = false;

    // Propiedades para gestión de comandos
    displayCreateCommandModal: boolean = false;
    deviceCommands: any[] = [];
    isLoadingCommands: boolean = false;
    isCreatingCommand: boolean = false;
  newCommand: any = {
    name: '',
    description: '',
    observation: ''
  };
  showContactsModal: boolean = false;

  openContacts(): void {
    this.showContactsModal = true;
  }

  closeContacts(): void {
    this.showContactsModal = false;
  }

    // Propiedades para modal de observación de comandos estáticos
    displayCommandObservationModal: boolean = false;
    commandObservationTitle: string = '';
    commandObservationIcon: string = '';
    commandObservationName: string = '';
    commandObservationDescription: string = '';
    commandObservationText: string = '';
    isSendingCommand: boolean = false;
    pendingCommandType: string = ''; // 'shutdown' or 'ignition'
    
    constructor(
        private langService: LangService,
        private messageService: MessageService,
        private vehicleBrandsService: VehicleBrandsService,
        private colorsService: ColorsService,
        private targetsService: TargetsService,
        private plansService: PlansService,
        private serversService: ServersService,
        private protocolsService: ProtocolsService,
        private managementService: ManagementService,
        private authService: AuthService,
        private userService: UserService,
        private commandsService: CommandsService
    ) {}

    // Métodos de validación de privilegios para devices
    canCreateDevices(): boolean {
        return this.authService.hasPrivilege('devices', 'create');
    }

    canUpdateDevices(): boolean {
        return this.authService.hasPrivilege('devices', 'update');
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

        // Asegurar que mechanic_id esté inicializado como string vacío
        if (this.target.mechanic_id === undefined || this.target.mechanic_id === null) {
            this.target.mechanic_id = '';
        }
        // El estado del dispositivo se obtiene desde traccarInfo.status
        // Establecer fecha actual por defecto para el proceso
        if (!this.processForm.registrationDate) {
            this.processForm.registrationDate = this.getTodayInputDate();
        }

        // Obtener el tipo de afiliación del usuario actual
        const currentUser = this.authService.getCurrentUser();
        this.currentUserAffiliationTypeId = currentUser?.affiliation_type_id || '';
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

            // Cargar técnicos desde el servicio
            this.userService.getTechnicians().pipe(takeUntil(this.destroy$)).subscribe({
                next: (technicians: User[]) => {
                    this.availableTechnicians = technicians.map(tech => ({
                        label: `${tech.name} ${tech.last_name}`.trim(),
                        value: tech._id
                    })).sort((a, b) => a.label.localeCompare(b.label));
                },
                error: (error) => {
                    console.error('Error al cargar técnicos:', error);
                    this.availableTechnicians = [];
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
        
        // Si el target tiene originalTarget, usar esos datos en su lugar
        let targetData = target;
        if ((target as any)['originalTarget']) {
            targetData = (target as any)['originalTarget'];
        }
        
      
        
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
        
        // Asegurar que mechanic_id tenga un valor válido, preservando el existente
        if (this.target.mechanic_id === null || this.target.mechanic_id === undefined) {
            this.target.mechanic_id = '';
        }
        // console.log('🔍 DEBUG setupEditTarget: ignition_sensor cargado:', this.target.ignition_sensor);
        
        // Ajuste para el estado (status): en DB es boolean, en formulario puede ser string
        if (this.target.status === true || String(this.target.status) === 'true') {
            this.target.status = 'active';
        } else if (this.target.status === false || String(this.target.status) === 'false') {
            this.target.status = 'inactive';
        }
        
        // Formatear fechas para el input HTML
        console.log('🔍 DEBUG setupEditTarget: Fecha de expiración RAW del backend:', this.target.expiration_date);
        
        this.target.activation_date = this.formatDateToInput(this.target.activation_date || '');
        
        if (this.target.expiration_date) {
            const formattedExpirationDate = this.formatDateToInput(this.target.expiration_date);
            console.log('🔍 DEBUG setupEditTarget: Fecha de expiración FORMATEADA:', formattedExpirationDate);
            this.target.expiration_date = formattedExpirationDate;
        }
        
        // Formatear la fecha de instalación (usar activation_date como fuente principal)
        if (this.target.activation_date) {
            this.target.installation_date = this.formatDateToInput(this.target.activation_date);
        } else if (this.target.installation_date) {
            this.target.installation_date = this.formatDateToInput(this.target.installation_date);
        } else {
            // Solo asignar fecha actual si estamos creando un nuevo target (no en modo edición)
            this.target.installation_date = this.isEditMode ? '' : new Date().toISOString().substring(0, 10);
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
        // actualizar la fecha de expiración SOLO si no hay fecha de expiración establecida
        // o si estamos en modo creación (no edición)
        if (this.target.plan && (!this.target.expiration_date || !this.isEditMode)) {
            console.log('🔍 DEBUG setupEditTarget: Recalculando fecha de expiración - isEditMode:', this.isEditMode, 'expiration_date:', this.target.expiration_date);
            this.updateExpirationDate();
        } else if (this.target.plan && this.isEditMode && this.target.expiration_date) {
            console.log('🔍 DEBUG setupEditTarget: Saltando recálculo automático en modo edición - fecha ya establecida:', this.target.expiration_date);
        }
        
        // Asignar el GPS model después de que los protocolos se hayan cargado
        // Si ya están cargados, asignar inmediatamente, si no, se asignará en el callback de protocolos
        if (selectedGpsModel && this.availableGpsModels.length > 0) {
            // Verificar que el modelo está en la lista antes de asignarlo
            const modelExists = this.availableGpsModels.some(model => model.value === selectedGpsModel);
            if (modelExists) {
                this.target.type = selectedGpsModel;
                this.updateSmsCommands();
            } else {
                this.target.type = '';
            }
        } else if (selectedGpsModel) {
            // Guardar el GPS model para asignarlo cuando se carguen los protocolos
            this.pendingGpsModel = selectedGpsModel;
            
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
                this.startSmsPolling();
            }, 500);
        }

        // Cargar datos del servidor asociado al plan del target
        this.loadServerDataFromPlan();
        
        // Cargar lista de procesos del target actual
        this.loadProcessesList();
    }

    /**
     * Obtiene la IP del servidor asociado al plan del target
     * @returns Promise que resuelve con la IP del servidor o null si no se encuentra
     */
    private async getServerIpFromPlan(): Promise<string | null> {
        // Verificar que el target tenga un plan asignado
        if (!this.target.plan) {
            return null;
        }

        const planId = typeof this.target.plan === 'string' ? this.target.plan : 
                      (this.target.plan as any).id_plan || '';

        if (!planId) {
            return null;
        }

        try {
            // Obtener datos del plan
            const plan = await this.plansService.getPlanById(planId).toPromise();
            
            if (!plan || !plan.server_id) {
                return null;
            }

            // Obtener datos del servidor
            const server = await this.serversService.getServerById(plan.server_id).toPromise();
            
            return server?.ip || null;
        } catch (error) {
            console.error('❌ Error al obtener IP del servidor:', error);
            return null;
        }
    }

    /**
     * Carga los datos del servidor asociado al plan del target
     * Muestra la información del plan y servidor en consola
     */
    private loadServerDataFromPlan(): void {
        // Verificar que el target tenga un plan asignado
        if (!this.target.plan) {
            return;
        }

        const planId = typeof this.target.plan === 'string' ? this.target.plan : 
                      (this.target.plan as any).id_plan || '';

        if (!planId) {
            return;
        }


        // Obtener datos del plan
        this.plansService.getPlanById(planId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (plan: Plan) => {
                

                    // Obtener datos del servidor
                    if (plan.server_id) {
                        this.serversService.getServerById(plan.server_id)
                            .pipe(takeUntil(this.destroy$))
                            .subscribe({
                                next: (server: Server) => {
                                 
                                },
                                error: (error) => {
                                    console.error('❌ Error al cargar datos del servidor:', error);
                                }
                            });
                    }
                },
                error: (error) => {
                    console.error('❌ Error al cargar datos del plan:', error);
                }
            });
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
        // Validar privilegios antes de proceder
        if (this.target._id && !this.canUpdateDevices()) {
            this.messageService.add({
                severity: 'error',
                summary: 'Sin permisos para actualizar',
                detail: 'No tiene permisos para actualizar dispositivos. Contacte al administrador.',
                life: 5000
            });
            return;
        }
        
        if (!this.target._id && !this.canCreateDevices()) {
            this.messageService.add({
                severity: 'error',
                summary: 'Sin permisos para crear',
                detail: 'No tiene permisos para crear nuevos dispositivos. Contacte al administrador.',
                life: 5000
            });
            return;
        }

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
                
                // Crear automáticamente un proceso de instalación para el nuevo target
                if (newTarget && newTarget._id) {
                    await this.createInstallationProcess(newTarget as TargetDevice);
                }
                
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
        
        // target_plate_number se mantiene con su nombre original
        // El backend espera este campo tal como está
        
        // target_chassis_number se mantiene con su nombre original
        // target_color se mantiene con su nombre original  
        // target_year se mantiene con su nombre original
        // El backend espera estos campos tal como están
        
        // target_brand_id y target_model_id se mantienen con sus nombres originales
        // El backend espera estos campos tal como están
        
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
        } else if (!this.isEditMode) {
            // Solo asignar fecha actual si estamos creando un nuevo target
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
            if (!this.target.device_imei || !this.target.sim_card_number || !this.target.mechanic_id || !this.target.plan || !this.target.selectedPrice) {
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
        
        // Validación específica para el técnico (siempre requerido)
        if (!this.target.mechanic_id) {
            this.messageService.add({
                severity: 'error',
                summary: this.translate('management.targetForm.validationError'),
                detail: this.translate('management.targetForm.technicianRequired')
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

    private getTodayInputDate(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    filterColors(event: any) {
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
    
    // Removed explicit input handler in favor of ngModel setter
    
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
        // Procesar mensaje para reemplazar variables del servidor
        let processedMessage = message;
        
        try {
            this.isSendingSms = true;
            
            // Verificar si el mensaje contiene {{company}} y validar tipo de SIM card
            if (message.includes('{{company}}')) {
                // Verificar si es SIM card nacional (no permite comandos con {{company}})
                if (this.target.sim_company?.toLowerCase() === 'nacionales') {
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Comando no permitido',
                        detail: 'Este tipo de simcard no permite este comando, comuníquese con su proveedor de simcard',
                        life: 5000
                    });
                    return;
                }
                
                // Reemplazar {{company}} basado en el tipo de SIM card
                const companyValue = this.getCompanyValueFromSimType();
                if (companyValue) {
                    processedMessage = message.replace(/\{\{company\}\}/g, companyValue);
                } else {
                    console.warn('⚠️ No se pudo determinar el valor de company para el tipo de SIM:', this.target.sim_company);
                    this.messageService.add({
                        severity: 'warn',
                        summary: 'Advertencia',
                        detail: 'No se pudo determinar el valor de company. El mensaje se enviará sin procesar.',
                        life: 3000
                    });
                }
            }
            
            // Verificar si el mensaje contiene {{server}} y reemplazarlo por la IP del servidor
            if (processedMessage.includes('{{server}}')) {
                const serverIp = await this.getServerIpFromPlan();
                
                if (serverIp) {
                    processedMessage = processedMessage.replace(/\{\{server\}\}/g, serverIp);
                } else {
                    console.warn('⚠️ No se pudo obtener la IP del servidor, enviando mensaje sin procesar');
                    this.messageService.add({
                        severity: 'warn',
                        summary: 'Advertencia',
                        detail: 'No se pudo obtener la IP del servidor. El mensaje se enviará sin procesar.',
                        life: 3000
                    });
                }
            }

            // Mostrar mensaje de envío
            this.messageService.add({
                severity: 'info',
                summary: 'Enviando SMS',
                detail: 'Enviando mensaje al dispositivo...',
                life: 2000
            });

            // Añadir mensaje enviado al chat (mostrar el mensaje procesado)
            this.smsMessages.push({
                type: 'sent',
                content: processedMessage,
                timestamp: new Date(),
                createdby: 'montaogps',
                delivered: false,
                pending: true
            });

            this.scrollToBottom();

            // Enviar SMS real al backend (usando el mensaje procesado)
            const response = await this.targetsService.sendSMS(this.target.sim_card_number, processedMessage, provider, this.target.sim_company);


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
                this.updateTempMessageStatus(processedMessage, { pending: false, delivered: false });
            } else {
                console.warn('⚠️ Respuesta de error del servidor:', response);
                this.messageService.add({
                    severity: 'warn',
                    summary: 'SMS Enviado',
                    detail: response.message || response.error || 'Mensaje enviado, pero hubo un problema en la entrega'
                });
                this.updateTempMessageStatus(processedMessage, { pending: false });
            }

        } catch (error: any) {
            console.error('❌ Error al enviar SMS:', error);
            
            // Remover el mensaje del chat si falló completamente
            if (this.smsMessages.length > 0 && this.smsMessages[this.smsMessages.length - 1].content === processedMessage) {
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
        if (this.isLoadingSmsMessages) {
            return;
        }
        if (!this.target.sim_card_number) {
            return;
        }

        const provider = this.getProviderFromSimCompany();
        if (!provider) {
            return;
        }

        const showInitialLoader = !this.hasLoadedSmsMessages;

        try {
            this.isLoadingSmsMessages = showInitialLoader ? true : this.isLoadingSmsMessages;

            const response = await this.targetsService.getMessages(this.target.sim_card_number, provider);


            // Verificar si la respuesta es un array directamente o tiene una estructura con success
            let messages = Array.isArray(response) ? response : (response.messages || response.data || []);
            

            if (messages && Array.isArray(messages)) {
                // Convertir mensajes del backend al formato del componente
                this.smsMessages = messages.map((msg: any) => {
                    const createdBy = (msg.createdby || '').toLowerCase();
                    // Preferimos createdby para determinar dirección; fallback al tipo MT/MO
                    const isSent =
                        createdBy === 'montaogps'
                            ? true
                            : createdBy === 'device'
                            ? false
                            : msg.type === 'MT';
                    const messageType: 'sent' | 'received' = isSent ? 'sent' : 'received';
                    
                    return {
                        type: messageType,
                        content: msg.text || msg.body || msg.message || '',
                        timestamp: new Date(
                            msg.fecha ||
                            msg.timestamp ||
                            msg.date_created ||
                            msg.dateCreated
                        ),
                        from: msg.from,
                        to: msg.to,
                        id: msg.id,
                        read: msg.read,
                        delivered: msg.delivered,
                        createdby: msg.createdby
                    };
                });

                // Ordenar por timestamp (más antiguos primero)
                this.smsMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

                this.scrollToBottom();
                this.hasLoadedSmsMessages = true;
            }

        } catch (error: any) {
            console.error('Error al cargar mensajes SMS:', error);
            this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'No se pudieron cargar los mensajes SMS'
            });
        } finally {
            if (showInitialLoader) {
                this.isLoadingSmsMessages = false;
            }
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

    private getCompanyValueFromSimType(): string | null {
        if (!this.target.sim_company) {
            return null;
        }

        // Mapear tipos de SIM card a valores de company
        const companyMap: Record<string, string> = {
            'global-e': 'em',
            'global-m': 'altanwifi',
            'global-m2': 'gigsky-02'
        };

        return companyMap[this.target.sim_company.toLowerCase()] || null;
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

    /**
     * Obtiene el nombre del comando para mostrar en la terminal
     * Ahora se muestra exactamente el contenido del mensaje sin reemplazos
     */
    getDisplayMessageContent(message: SmsMessage): string {
        return message.content ? message.content.trim() : '';
    }

    getMessageAuthor(message: SmsMessage): string {
        const createdBy = (message.createdby || '').toLowerCase();
        if (createdBy === 'montaogps') {
            return 'Montao GPS';
        }
        // Si viene del dispositivo, usar el nombre del target
        const legacyName = (this.target as any)?.['target_name'];
        return this.target?.name || legacyName || 'Dispositivo';
    }

    getMessageDeliveryLabel(message: SmsMessage): string {
        return message.delivered ? 'Entregado' : 'Pendiente';
    }

    private updateTempMessageStatus(content: string, updates: Partial<SmsMessage>): void {
        const lastIndex = [...this.smsMessages].reverse().findIndex(
            (msg) => msg.type === 'sent' && msg.content === content && msg.pending
        );
        if (lastIndex !== -1) {
            // reverse index to actual index
            const realIndex = this.smsMessages.length - 1 - lastIndex;
            this.smsMessages[realIndex] = {
                ...this.smsMessages[realIndex],
                ...updates,
            };
        }
    }

    private startSmsPolling(): void {
        this.stopSmsPolling();
        const provider = this.getProviderFromSimCompany();
        if (!this.target.sim_card_number || !provider) {
            return;
        }
        this.smsPollingSub = interval(15000)
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => {
                this.loadSmsMessages();
            });
    }

    private stopSmsPolling(): void {
        if (this.smsPollingSub) {
            this.smsPollingSub.unsubscribe();
            this.smsPollingSub = null;
        }
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
        this.stopSmsPolling();
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
        console.log('🔍 DEBUG updateExpirationDate: LLAMADO - skipFlag:', this.skipExpirationDateRecalculation);
        console.log('🔍 DEBUG updateExpirationDate: Fecha actual antes del recálculo:', this.target.expiration_date);
        
        // Si la bandera está activada, no recalcular automáticamente
        if (this.skipExpirationDateRecalculation) {
            console.log('🔍 DEBUG: Saltando recálculo automático de fecha de expiración');
            return;
        }
        
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
            const formattedDate = this.formatDateToInput(expirationDate.toISOString());
            console.log('🔍 DEBUG updateExpirationDate: Nueva fecha calculada:', formattedDate);
            this.target.expiration_date = formattedDate;
            
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
        let protocolCommands: ProtocolCommand[] = [];
        
        if (gpsModelId && this.loadedProtocols.length > 0) {
            this.selectedProtocol = this.loadedProtocols.find(p => p._id === gpsModelId) || null;
            protocolCommands = this.selectedProtocol?.commands || [];
        } else {
            this.selectedProtocol = null;
            protocolCommands = [];
        }
        
        this.availableCommands = protocolCommands;
        
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
        
      
        
        // Establecer el valor limpio
        this.target.sim_company = cleanValue;
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

    // Método para crear automáticamente un proceso de instalación
    private async createInstallationProcess(target: TargetDevice): Promise<void> {
        try {
            const currentUser = this.authService.getCurrentUser();
            const currentDate = new Date().toISOString().substring(0, 10);
            
            const processData: CreateProcessDto = {
                type: 1, // Tipo 1 = instalación real automática
                registrationDate: currentDate,
                description: 'Proceso de instalación creado automáticamente',
                details: `Instalación automática registrada para el dispositivo ${target.name || target.device_imei}. Técnico asignado: ${this.getTechnicianName(target.mechanic_id || '')}.`,
                target: {
                    _id: target._id,
                    name: target.name,
                    device_imei: target.device_imei,
                    sim_card_number: target.sim_card_number
                },
                user: {
                    _id: currentUser?.id || "sistema",
                    name: currentUser?.name || "Sistema",
                    email: currentUser?.email || "sistema@montao.net"
                },
                reference: target.device_imei,
                before: {
                    status: "pending",
                    lastProcess: null
                },
                after: {
                    status: "completed",
                    processType: "installation",
                    processDate: currentDate
                },
                creator: currentUser?.id || "sistema"
            };

            await this.targetsService.createProcess(processData);
            console.log('✅ Proceso de instalación creado automáticamente');
        } catch (error) {
            console.error('❌ Error al crear proceso de instalación automático:', error);
            // No mostramos error al usuario para no interferir con el flujo principal
        }
    }

    // Método auxiliar para obtener el nombre del técnico
    private getTechnicianName(mechanicId: string): string {
        if (!mechanicId) return 'No asignado';
        const technician = this.availableTechnicians.find(tech => tech.value === mechanicId);
        return technician ? technician.label : 'Técnico no encontrado';
    }

    // Método para enviar el formulario de proceso
    async onSubmitProcess(): Promise<void> {
        try {
            // Validar que los campos requeridos estén completos
            if (!this.processForm.type) {
                this.messageService.add({
                    severity: 'warn',
                    summary: 'Campo requerido',
                    detail: 'Debe seleccionar un tipo de proceso'
                });
                return;
            }

            if (!this.processForm.registrationDate) {
                this.messageService.add({
                    severity: 'warn',
                    summary: 'Campo requerido',
                    detail: 'Debe seleccionar una fecha para el proceso'
                });
                return;
            }

            // Validaciones específicas para cambio de plan
            if (this.processForm.type === 'plan_change') {
                if (!this.processForm.newPlan) {
                    this.messageService.add({
                        severity: 'warn',
                        summary: 'Campo requerido',
                        detail: 'Debe seleccionar un nuevo plan'
                    });
                    return;
                }

                if (!this.processForm.newPrice) {
                    this.messageService.add({
                        severity: 'warn',
                        summary: 'Campo requerido',
                        detail: 'Debe seleccionar un precio para el nuevo plan'
                    });
                    return;
                }
            }

            // Validaciones específicas para cambio de fecha de instalación
            if (this.processForm.type === 'installation') {
                if (!this.processForm.newInstallationDate) {
                    this.messageService.add({
                        severity: 'warn',
                        summary: 'Campo requerido',
                        detail: 'Debe seleccionar una nueva fecha de instalación'
                    });
                    return;
                }
            }

            // Validaciones específicas para cambio de fecha de expiración
            if (this.processForm.type === 'expiration') {
                if (!this.processForm.newExpirationDate) {
                    this.messageService.add({
                        severity: 'warn',
                        summary: 'Campo requerido',
                        detail: 'Debe seleccionar una nueva fecha de expiración'
                    });
                    return;
                }
            }

            // Validaciones específicas para renovación de servicio
            if (this.processForm.type === 'renewal') {
                if (!this.processForm.newRenewalDate) {
                    this.messageService.add({
                        severity: 'warn',
                        summary: 'Campo requerido',
                        detail: 'Debe seleccionar una nueva fecha de renovación'
                    });
                    return;
                }
            }

            // Validaciones específicas para cambio de técnico
            if (this.processForm.type === 'technician_change') {
                if (!this.processForm.newTechnician) {
                    this.messageService.add({
                        severity: 'warn',
                        summary: 'Campo requerido',
                        detail: 'Debe seleccionar un nuevo técnico'
                    });
                    return;
                }
            }

            // Validaciones específicas para cambio de GPS
            if (this.processForm.type === 'gps_change') {
                if (!this.processForm.newGpsImei || this.processForm.newGpsImei.trim() === '') {
                    this.messageService.add({
                        severity: 'warn',
                        summary: 'Campo requerido',
                        detail: 'Debe ingresar el nuevo IMEI del GPS'
                    });
                    return;
                }
                
                if (!this.processForm.newGpsModel) {
                    this.messageService.add({
                        severity: 'warn',
                        summary: 'Campo requerido',
                        detail: 'Debe seleccionar el nuevo modelo de GPS'
                    });
                    return;
                }
                
                if (!this.processForm.newInstallationDetails || this.processForm.newInstallationDetails.trim() === '') {
                    this.messageService.add({
                        severity: 'warn',
                        summary: 'Campo requerido',
                        detail: 'Debe ingresar los nuevos detalles de instalación'
                    });
                    return;
                }
            }
            
            // Validaciones específicas para modificar detalles de instalación
            if (this.processForm.type === 'installation_details_change') {
                if (!this.processForm.newInstallationDetails || this.processForm.newInstallationDetails.trim() === '') {
                    this.messageService.add({
                        severity: 'warn',
                        summary: 'Campo requerido',
                        detail: 'Debe ingresar los nuevos detalles de instalación'
                    });
                    return;
                }
            }
            
            // Validaciones específicas para modificar modelo de GPS
            if (this.processForm.type === 'gps_model_change') {
                if (!this.processForm.newGpsModel) {
                    this.messageService.add({
                        severity: 'warn',
                        summary: 'Campo requerido',
                        detail: 'Debe seleccionar el nuevo modelo de GPS'
                    });
                    return;
                }
            }
            
            // Validaciones específicas para modificar IMEI / GPS ID
            if (this.processForm.type === 'imei_change') {
                if (!this.processForm.newGpsImei || this.processForm.newGpsImei.trim() === '') {
                    this.messageService.add({
                        severity: 'warn',
                        summary: 'Campo requerido',
                        detail: 'Debe ingresar el nuevo IMEI / GPS ID'
                    });
                    return;
                }
            }
            
            // Validaciones específicas para cambio de SIM card
            if (this.processForm.type === 'sim_change') {
                if (!this.processForm.newSimCard || this.processForm.newSimCard.trim() === '') {
                    this.messageService.add({
                        severity: 'warn',
                        summary: 'Campo requerido',
                        detail: 'Debe ingresar el nuevo número de SIM card'
                    });
                    return;
                }
                
                if (!this.processForm.newSimCompany || this.processForm.newSimCompany.trim() === '') {
                    this.messageService.add({
                        severity: 'warn',
                        summary: 'Campo requerido',
                        detail: 'Debe ingresar el tipo de SIM card'
                    });
                    return;
                }
            }
            
            // Validaciones específicas para modificar número de SIM card
            if (this.processForm.type === 'sim_number_change') {
                if (!this.processForm.newSimNumber || this.processForm.newSimNumber.trim() === '') {
                    this.messageService.add({
                        severity: 'warn',
                        summary: 'Campo requerido',
                        detail: 'Debe ingresar el nuevo número de SIM card'
                    });
                    return;
                }
            }
            
            // Validaciones específicas para modificar tipo de SIM card
            if (this.processForm.type === 'sim_type_change') {
                if (!this.processForm.newSimType || this.processForm.newSimType.trim() === '') {
                    this.messageService.add({
                        severity: 'warn',
                        summary: 'Campo requerido',
                        detail: 'Debe seleccionar el nuevo tipo de SIM card'
                    });
                    return;
                }
            }

            // Construir detalles automáticos si aplica
            const currentUser = this.authService.getCurrentUser();
            const userName = currentUser?.name || currentUser?.email || 'Usuario';
            const targetName = this.target.name || this.target.device_imei || 'dispositivo';
            let autoDetails = '';
            if (this.processForm.type === 'plan_change') {
                const newPlanObj = this.availablePlansForProcess.find(p => p.value === this.processForm.newPlan);
                const newPlanName = newPlanObj?.label || 'nuevo plan';
                const currentPlanId = typeof this.target.plan === 'string' ? this.target.plan : (this.target.plan as any)?.id_plan || '';
                const currentPlanObj = this.availablePlansForProcess.find(p => p.value === currentPlanId);
                const currentPlanName = currentPlanObj?.label || 'plan actual';
                const reason = this.processForm.description?.trim() ? ` por la siguiente razón: ${this.processForm.description.trim()}` : '';
                autoDetails = `El usuario ${userName} ha cambiado el plan del dispositivo ${targetName} de ${currentPlanName} a ${newPlanName}${reason}.`;
            }
            
            if (this.processForm.type === 'installation') {
                const currentInstallationDate = this.target.activation_date || 'no definida';
                const newInstallationDate = this.processForm.newInstallationDate;
                const reason = this.processForm.description?.trim() ? ` por la siguiente razón: ${this.processForm.description.trim()}` : '';
                autoDetails = `El usuario ${userName} ha cambiado la fecha de instalación del dispositivo ${targetName} de ${currentInstallationDate} a ${newInstallationDate}${reason}.`;
            }
            
            if (this.processForm.type === 'expiration') {
                const currentExpirationDate = this.target.expiration_date || 'no definida';
                const newExpirationDate = this.processForm.newExpirationDate;
                const reason = this.processForm.description?.trim() ? ` por la siguiente razón: ${this.processForm.description.trim()}` : '';
                autoDetails = `El usuario ${userName} ha cambiado la fecha de expiración del dispositivo ${targetName} de ${currentExpirationDate} a ${newExpirationDate}${reason}.`;
            }
            
            if (this.processForm.type === 'renewal') {
                const currentExpirationDate = this.target.expiration_date || 'no definida';
                const newRenewalDate = this.processForm.newRenewalDate;
                const reason = this.processForm.description?.trim() ? ` por la siguiente razón: ${this.processForm.description.trim()}` : '';
                autoDetails = `El usuario ${userName} ha renovado el servicio del dispositivo ${targetName} cambiando la fecha de expiración de ${currentExpirationDate} a ${newRenewalDate}${reason}.`;
            }
            
            if (this.processForm.type === 'technician_change') {
                const currentTechnicianId = this.target.mechanic_id || '';
                const currentTechnicianObj = this.availableTechnicians.find(t => t.value === currentTechnicianId);
                const currentTechnicianName = currentTechnicianObj?.label || 'no asignado';
                const newTechnicianObj = this.availableTechnicians.find(t => t.value === this.processForm.newTechnician);
                const newTechnicianName = newTechnicianObj?.label || 'técnico seleccionado';
                const reason = this.processForm.description?.trim() ? ` por la siguiente razón: ${this.processForm.description.trim()}` : '';
                autoDetails = `El usuario ${userName} ha cambiado el técnico asignado al dispositivo ${targetName} de ${currentTechnicianName} a ${newTechnicianName}${reason}.`;
            }
            
            if (this.processForm.type === 'gps_change') {
                const currentImei = this.target.device_imei || 'no definido';
                const newImei = this.processForm.newGpsImei.trim();
                const currentGpsModelId = this.target.type || ''; // El backend usa 'type' para el modelo GPS
                const currentGpsModelObj = this.availableGpsModels.find(g => g.value === currentGpsModelId);
                const currentGpsModelName = currentGpsModelObj?.label || 'no definido';
                const newGpsModelObj = this.availableGpsModels.find(g => g.value === this.processForm.newGpsModel);
                const newGpsModelName = newGpsModelObj?.label || 'modelo seleccionado';
                const newInstallationDetails = this.processForm.newInstallationDetails.trim();
                const reason = this.processForm.description?.trim() ? ` por la siguiente razón: ${this.processForm.description.trim()}` : '';
                autoDetails = `El usuario ${userName} ha realizado un cambio completo de GPS en el dispositivo ${targetName}: IMEI cambiado de ${currentImei} a ${newImei}, modelo de ${currentGpsModelName} a ${newGpsModelName}, y se actualizaron los detalles de instalación${reason}.`;
            }
            
            if (this.processForm.type === 'installation_details_change') {
                const currentDetails = this.target.installation_details || 'no definidos';
                const newDetails = this.processForm.newInstallationDetails.trim();
                const reason = this.processForm.description?.trim() ? ` por la siguiente razón: ${this.processForm.description.trim()}` : '';
                autoDetails = `El usuario ${userName} ha actualizado los detalles de instalación del dispositivo ${targetName} de "${currentDetails}" a "${newDetails}"${reason}.`;
            }
            
            if (this.processForm.type === 'gps_model_change') {
                const currentGpsModelId = this.target.type || ''; // El backend usa 'type' para el modelo GPS
                const currentGpsModelObj = this.availableGpsModels.find(g => g.value === currentGpsModelId);
                const currentGpsModelName = currentGpsModelObj?.label || 'no definido';
                const newGpsModelObj = this.availableGpsModels.find(g => g.value === this.processForm.newGpsModel);
                const newGpsModelName = newGpsModelObj?.label || 'modelo seleccionado';
                const reason = this.processForm.description?.trim() ? ` por la siguiente razón: ${this.processForm.description.trim()}` : '';
                autoDetails = `El usuario ${userName} ha cambiado el modelo de GPS del dispositivo ${targetName} de ${currentGpsModelName} a ${newGpsModelName}${reason}.`;
            }
            
            if (this.processForm.type === 'imei_change') {
                const currentImei = this.target.device_imei || 'no definido';
                const newImei = this.processForm.newGpsImei.trim();
                const reason = this.processForm.description?.trim() ? ` por la siguiente razón: ${this.processForm.description.trim()}` : '';
                autoDetails = `El usuario ${userName} ha cambiado el IMEI / GPS ID del dispositivo ${targetName} de ${currentImei} a ${newImei}${reason}.`;
            }
            
            if (this.processForm.type === 'sim_change') {
                const currentSim = this.target.sim_card_number || 'no definido';
                const currentSimCompany = this.target.sim_company || 'no definida';
                const newSim = this.processForm.newSimCard.trim();
                const newSimCompany = this.processForm.newSimCompany.trim();
                const reason = this.processForm.description?.trim() ? ` por la siguiente razón: ${this.processForm.description.trim()}` : '';
                autoDetails = `El usuario ${userName} ha cambiado la SIM card del dispositivo ${targetName} de ${currentSim} (${currentSimCompany}) a ${newSim} (${newSimCompany})${reason}.`;
            }
            
            if (this.processForm.type === 'sim_number_change') {
                const currentSim = this.target.sim_card_number || 'no definido';
                const newSim = this.processForm.newSimNumber.trim();
                const reason = this.processForm.description?.trim() ? ` por la siguiente razón: ${this.processForm.description.trim()}` : '';
                autoDetails = `El usuario ${userName} ha cambiado el número de SIM card del dispositivo ${targetName} de ${currentSim} a ${newSim}${reason}.`;
            }
            
            if (this.processForm.type === 'sim_type_change') {
                const currentSimCompany = this.target.sim_company || 'no definido';
                const newSimCompany = this.processForm.newSimType.trim();
                const reason = this.processForm.description?.trim() ? ` por la siguiente razón: ${this.processForm.description.trim()}` : '';
                autoDetails = `El usuario ${userName} ha cambiado el tipo de SIM card del dispositivo ${targetName} de ${currentSimCompany} a ${newSimCompany}${reason}.`;
            }

                    // Preparar los datos del proceso
        const processData: CreateProcessDto = {
            type: this.processTypeMap[this.processForm.type] || 1, // Convertir string a number
            registrationDate: this.processForm.registrationDate,
            description: this.processForm.description || '',
                details: autoDetails || undefined,
            target: {
                _id: this.target._id,
                name: this.target.name,
                device_imei: this.target.device_imei,
                sim_card_number: this.target.sim_card_number
            },
            user: {
                _id: this.authService.getCurrentUser()?.id || "ejemplo_user_id",
                name: this.authService.getCurrentUser()?.name || "Usuario Ejemplo",
                email: this.authService.getCurrentUser()?.email || "usuario@ejemplo.com"
            },
            reference: this.target._id, // Referencia usando el ID del target
            before: {
                status: "pending",
                lastProcess: null
            },
            after: {
                status: "completed",
                processType: this.processForm.type,
                processDate: this.processForm.registrationDate
            },
            creator: this.authService.getCurrentUser()?.id || "creator_ejemplo_id"
        };

            // Enviar el proceso al servidor
            const response = await this.targetsService.createProcess(processData);

            // Si es un cambio de plan, actualizar el target con el nuevo plan
            if (this.processForm.type === 'plan_change') {
                try {
                    // Preparar datos completos del target para la actualización
                    const updateData: UpdateTargetDto = {
                        name: this.target.name,
                        device_imei: this.target.device_imei,
                        type: this.target.type,
                        sim_card_number: this.target.sim_card_number,
                        sim_company: this.target.sim_company,
                        description: this.target.description,
                        target_plate_number: this.target.target_plate_number,
                        contacts: Array.isArray(this.target.contacts) ? this.target.contacts.join(',') : this.target.contacts,
                        target_year: this.target.target_year,
                        installation_location: this.target.installation_location,
                        target_brand_id: this.target.target_brand_id,
                        target_model_id: this.target.target_model_id,
                        target_color: this.target.target_color,
                        target_chassis_number: this.target.target_chassis_number,
                        activation_date: this.target.activation_date,
                        expiration_date: this.target.expiration_date,
                        last_change_date: new Date(),
                        gps_model: this.target.gps_model,
                        ignition_sensor: this.target.ignition_sensor,
                        shutdown_control: this.target.shutdown_control,
                        engine_shutdown: this.target.engine_shutdown,
                        installation_details: this.target.installation_details,
                        status: this.target.status == 'active',
                        canceled: this.target.canceled,
                        delete: this.target['delete'],
                        index: this.target.index,
                        // Estructurar el plan como objeto según requiere el backend
                        plan: {
                            id_plan: this.processForm.newPlan,
                            selected_price: {
                                id: (this.processForm.newPrice as any)?.id || '',
                                amount: (this.processForm.newPrice as any)?.amount || 0,
                                payment_period: (this.processForm.newPrice as any)?.payment_period || ''
                            }
                        },
                        selectedPrice: this.processForm.newPrice as any,
                        creator_id: this.target.creator_id,
                        parent_id: this.target.parent_id,
                        user_id: this.target.user_id
                    };

                    await this.targetsService.updateTarget(this.target._id, updateData);
                    
                    // Actualizar el objeto target local y UI principal
                    this.target.plan = this.processForm.newPlan;
                    this.target.selectedPrice = this.processForm.newPrice as any;

                    // Refrescar precios del plan en el formulario real y recalcular expiración
                    if (typeof this.target.plan === 'string' && this.target.plan) {
                        const currentSelectedFromProcess: any = this.processForm.newPrice;
                        this.plansService.getPlanById(this.target.plan)
                            .pipe(takeUntil(this.destroy$))
                            .subscribe({
                                next: (plan: Plan) => {
                                    this.availablePrices = plan.prices.map(price => ({
                                        id: price.id,
                                        amount: price.amount,
                                        payment_period: typeof price.payment_period === 'string' ? price.payment_period : this.mapPeriodToString(price.payment_period)
                                    }));

                                    // Alinear el objeto seleccionado con la lista refrescada preservando el monto personalizado
                                    const matched = this.availablePrices.find(p => p.id === currentSelectedFromProcess?.id);
                                    if (matched) {
                                        if (currentSelectedFromProcess && currentSelectedFromProcess.amount !== matched.amount) {
                                            const custom = {
                                                ...matched,
                                                amount: currentSelectedFromProcess.amount,
                                                originalAmount: matched.amount
                                            } as any;
                                            // Reemplazar en la lista para reflejar el personalizado
                                            const idx = this.availablePrices.findIndex(p => p.id === matched.id);
                                            if (idx >= 0) {
                                                (this.availablePrices as any)[idx] = custom;
                                            }
                                            this.target.selectedPrice = custom;
                                        } else {
                                            this.target.selectedPrice = matched as any;
                                        }
                                    } else if (currentSelectedFromProcess) {
                                        // No existe en plan (caso custom puro), insertarlo al inicio
                                        const custom = {
                                            id: currentSelectedFromProcess.id,
                                            amount: currentSelectedFromProcess.amount,
                                            payment_period: currentSelectedFromProcess.payment_period,
                                            originalAmount: 0
                                        } as any;
                                        this.availablePrices = [custom as any, ...this.availablePrices];
                                        this.target.selectedPrice = custom;
                                    }
                                    this.updateExpirationDate();
                                },
                                error: () => {
                                    this.updateExpirationDate();
                                }
                            });
                    } else {
                        this.updateExpirationDate();
                    }

                    this.messageService.add({
                        severity: 'success',
                        summary: 'Plan actualizado',
                        detail: 'El plan del target ha sido actualizado exitosamente'
                    });
                } catch (updateError) {
                    console.error('Error al actualizar el plan del target:', updateError);
                    this.messageService.add({
                        severity: 'warn',
                        summary: 'Proceso creado con advertencia',
                        detail: 'El proceso fue registrado pero no se pudo actualizar el plan del target'
                    });

                    // Aun si falla el backend, reflejar en el formulario local para continuidad visual
                    this.target.plan = this.processForm.newPlan;
                    this.target.selectedPrice = this.processForm.newPrice as any;
                    this.updateExpirationDate();
                }
            }

            // Si es un cambio de fecha de instalación, actualizar el target
            if (this.processForm.type === 'installation') {
                try {
                    console.log('🔍 DEBUG: Plan antes de actualizar fecha:', this.target.plan);
                    console.log('🔍 DEBUG: Precio antes de actualizar fecha:', this.target.selectedPrice);
                    
                    // Preparar datos para actualizar solo la fecha de instalación
                    const updateData: UpdateTargetDto = {
                        name: this.target.name,
                        device_imei: this.target.device_imei,
                        type: this.target.type,
                        sim_card_number: this.target.sim_card_number,
                        sim_company: this.target.sim_company,
                        description: this.target.description,
                        target_plate_number: this.target.target_plate_number,
                        contacts: Array.isArray(this.target.contacts) ? this.target.contacts.join(',') : this.target.contacts,
                        target_year: this.target.target_year,
                        installation_location: this.target.installation_location,
                        target_brand_id: this.target.target_brand_id,
                        target_model_id: this.target.target_model_id,
                        target_color: this.target.target_color,
                        target_chassis_number: this.target.target_chassis_number,
                        mechanic_id: this.target.mechanic_id,
                        activation_date: new Date(this.processForm.newInstallationDate), // Nueva fecha de instalación
                        expiration_date: this.target.expiration_date ? new Date(this.target.expiration_date) : undefined,
                        last_change_date: new Date(),
                        gps_model: this.target.gps_model,
                        ignition_sensor: this.target.ignition_sensor,
                        shutdown_control: this.target.shutdown_control,
                        engine_shutdown: this.target.engine_shutdown,
                        installation_details: this.target.installation_details,
                        status: this.target.status == 'active',
                        canceled: this.target.canceled,
                        delete: this.target['delete'],
                        index: this.target.index,
                        // Estructurar el plan como objeto según requiere el backend (preservar plan y precio existentes)
                        plan: this.target.plan && typeof this.target.plan === 'object' ? 
                            this.target.plan : 
                            (this.target.plan && this.target.selectedPrice ? {
                                id_plan: this.target.plan,
                                selected_price: {
                                    id: (this.target.selectedPrice as any)?.id || '',
                                    amount: (this.target.selectedPrice as any)?.amount || 0,
                                    payment_period: (this.target.selectedPrice as any)?.payment_period || ''
                                }
                            } : this.target.plan),
                        creator_id: this.target.creator_id,
                        parent_id: this.target.parent_id,
                        user_id: this.target.user_id
                    };

                    const response = await this.targetsService.updateTarget(this.target._id, updateData);
                    console.log('🔍 DEBUG: Respuesta del backend después de actualizar fecha:', response);
                    
                    // Actualizar el objeto target local (ambos campos para consistencia)
                    this.target.activation_date = this.formatDateToInput(this.processForm.newInstallationDate);
                    this.target.installation_date = this.formatDateToInput(this.processForm.newInstallationDate);

                    this.messageService.add({
                        severity: 'success',
                        summary: 'Fecha de instalación actualizada',
                        detail: 'La fecha de instalación ha sido actualizada correctamente'
                    });

                } catch (error) {
                    console.error('Error al actualizar la fecha de instalación:', error);
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'No se pudo actualizar la fecha de instalación del target'
                    });

                    // Aun si falla el backend, reflejar en el formulario local para continuidad visual
                    this.target.activation_date = this.formatDateToInput(this.processForm.newInstallationDate);
                    this.target.installation_date = this.formatDateToInput(this.processForm.newInstallationDate);
                }
            }

            // Si es un cambio de fecha de expiración, actualizar el target
            if (this.processForm.type === 'expiration') {
                try {
                    console.log('🔍 DEBUG: Plan antes de actualizar fecha de expiración:', this.target.plan);
                    console.log('🔍 DEBUG: Precio antes de actualizar fecha de expiración:', this.target.selectedPrice);
                    
                    // Preparar datos para actualizar solo la fecha de expiración
                    const updateData: UpdateTargetDto = {
                        name: this.target.name,
                        device_imei: this.target.device_imei,
                        type: this.target.type,
                        sim_card_number: this.target.sim_card_number,
                        sim_company: this.target.sim_company,
                        description: this.target.description,
                        target_plate_number: this.target.target_plate_number,
                        contacts: Array.isArray(this.target.contacts) ? this.target.contacts.join(',') : this.target.contacts,
                        target_year: this.target.target_year,
                        installation_location: this.target.installation_location,
                        target_brand_id: this.target.target_brand_id,
                        target_model_id: this.target.target_model_id,
                        target_color: this.target.target_color,
                        target_chassis_number: this.target.target_chassis_number,
                        mechanic_id: this.target.mechanic_id,
                        activation_date: this.target.activation_date ? new Date(this.target.activation_date) : undefined,
                        expiration_date: new Date(this.processForm.newExpirationDate), // Nueva fecha de expiración
                        last_change_date: new Date(),
                        gps_model: this.target.gps_model,
                        ignition_sensor: this.target.ignition_sensor,
                        shutdown_control: this.target.shutdown_control,
                        engine_shutdown: this.target.engine_shutdown,
                        installation_details: this.target.installation_details,
                        status: this.target.status == 'active',
                        canceled: this.target.canceled,
                        delete: this.target['delete'],
                        index: this.target.index,
                        // Estructurar el plan como objeto según requiere el backend (preservar plan y precio existentes)
                        plan: this.target.plan && typeof this.target.plan === 'object' ? 
                            this.target.plan : 
                            (this.target.plan && this.target.selectedPrice ? {
                                id_plan: this.target.plan,
                                selected_price: {
                                    id: (this.target.selectedPrice as any)?.id || '',
                                    amount: (this.target.selectedPrice as any)?.amount || 0,
                                    payment_period: (this.target.selectedPrice as any)?.payment_period || ''
                                }
                            } : this.target.plan),
                        creator_id: this.target.creator_id,
                        parent_id: this.target.parent_id,
                        user_id: this.target.user_id
                    };

                    const response = await this.targetsService.updateTarget(this.target._id, updateData);
                    console.log('🔍 DEBUG: Respuesta del backend después de actualizar fecha de expiración:', response);
                    
                    // Activar bandera para evitar recálculo automático
                    this.skipExpirationDateRecalculation = true;
                    
                    // Actualizar el objeto target local
                    this.target.expiration_date = this.formatDateToInput(this.processForm.newExpirationDate);
                    
                    // Desactivar bandera después de un breve delay
                    setTimeout(() => {
                        this.skipExpirationDateRecalculation = false;
                    }, 100);

                    this.messageService.add({
                        severity: 'success',
                        summary: 'Fecha de expiración actualizada',
                        detail: 'La fecha de expiración ha sido actualizada correctamente'
                    });

                } catch (error) {
                    console.error('Error al actualizar la fecha de expiración:', error);
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'No se pudo actualizar la fecha de expiración del target'
                    });

                    // Activar bandera para evitar recálculo automático
                    this.skipExpirationDateRecalculation = true;
                    
                    // Aun si falla el backend, reflejar en el formulario local para continuidad visual
                    this.target.expiration_date = this.formatDateToInput(this.processForm.newExpirationDate);
                    
                    // Desactivar bandera después de un breve delay
                    setTimeout(() => {
                        this.skipExpirationDateRecalculation = false;
                    }, 100);
                }
            }

            // Si es una renovación de servicio, actualizar el target
            if (this.processForm.type === 'renewal') {
                try {
                    console.log('🔍 DEBUG: Plan antes de renovar servicio:', this.target.plan);
                    console.log('🔍 DEBUG: Precio antes de renovar servicio:', this.target.selectedPrice);
                    
                    // Preparar datos para actualizar solo la fecha de expiración (renovación)
                    const updateData: UpdateTargetDto = {
                        name: this.target.name,
                        device_imei: this.target.device_imei,
                        type: this.target.type,
                        sim_card_number: this.target.sim_card_number,
                        sim_company: this.target.sim_company,
                        description: this.target.description,
                        target_plate_number: this.target.target_plate_number,
                        contacts: Array.isArray(this.target.contacts) ? this.target.contacts.join(',') : this.target.contacts,
                        target_year: this.target.target_year,
                        installation_location: this.target.installation_location,
                        target_brand_id: this.target.target_brand_id,
                        target_model_id: this.target.target_model_id,
                        target_color: this.target.target_color,
                        target_chassis_number: this.target.target_chassis_number,
                        mechanic_id: this.target.mechanic_id,
                        activation_date: this.target.activation_date ? new Date(this.target.activation_date) : undefined,
                        expiration_date: new Date(this.processForm.newRenewalDate), // Nueva fecha de renovación
                        last_change_date: new Date(),
                        gps_model: this.target.gps_model,
                        ignition_sensor: this.target.ignition_sensor,
                        shutdown_control: this.target.shutdown_control,
                        engine_shutdown: this.target.engine_shutdown,
                        installation_details: this.target.installation_details,
                        status: this.target.status == 'active',
                        canceled: this.target.canceled,
                        delete: this.target['delete'],
                        index: this.target.index,
                        // Estructurar el plan como objeto según requiere el backend (preservar plan y precio existentes)
                        plan: this.target.plan && typeof this.target.plan === 'object' ? 
                            this.target.plan : 
                            (this.target.plan && this.target.selectedPrice ? {
                                id_plan: this.target.plan,
                                selected_price: {
                                    id: (this.target.selectedPrice as any)?.id || '',
                                    amount: (this.target.selectedPrice as any)?.amount || 0,
                                    payment_period: (this.target.selectedPrice as any)?.payment_period || ''
                                }
                            } : this.target.plan),
                        creator_id: this.target.creator_id,
                        parent_id: this.target.parent_id,
                        user_id: this.target.user_id
                    };

                    const response = await this.targetsService.updateTarget(this.target._id, updateData);
                    console.log('🔍 DEBUG: Respuesta del backend después de renovar servicio:', response);
                    
                    // Activar bandera para evitar recálculo automático
                    this.skipExpirationDateRecalculation = true;
                    
                    // Actualizar el objeto target local
                    this.target.expiration_date = this.formatDateToInput(this.processForm.newRenewalDate);
                    
                    // Desactivar bandera después de un breve delay
                    setTimeout(() => {
                        this.skipExpirationDateRecalculation = false;
                    }, 100);

                    this.messageService.add({
                        severity: 'success',
                        summary: 'Servicio renovado',
                        detail: 'El servicio ha sido renovado correctamente'
                    });

                } catch (error) {
                    console.error('Error al renovar el servicio:', error);
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'No se pudo renovar el servicio del target'
                    });

                    // Activar bandera para evitar recálculo automático
                    this.skipExpirationDateRecalculation = true;
                    
                    // Aun si falla el backend, reflejar en el formulario local para continuidad visual
                    this.target.expiration_date = this.formatDateToInput(this.processForm.newRenewalDate);
                    
                    // Desactivar bandera después de un breve delay
                    setTimeout(() => {
                        this.skipExpirationDateRecalculation = false;
                    }, 100);
                }
            }

            // Si es un cambio de técnico, actualizar el target
            if (this.processForm.type === 'technician_change') {
                try {
                    console.log('🔍 DEBUG: Técnico actual:', this.target.mechanic_id);
                    console.log('🔍 DEBUG: Nuevo técnico:', this.processForm.newTechnician);
                    
                    // Preparar datos para actualizar solo el técnico
                    const updateData: UpdateTargetDto = {
                        name: this.target.name,
                        device_imei: this.target.device_imei,
                        type: this.target.type,
                        sim_card_number: this.target.sim_card_number,
                        sim_company: this.target.sim_company,
                        description: this.target.description,
                        target_plate_number: this.target.target_plate_number,
                        contacts: Array.isArray(this.target.contacts) ? this.target.contacts.join(',') : this.target.contacts,
                        target_year: this.target.target_year,
                        installation_location: this.target.installation_location,
                        target_brand_id: this.target.target_brand_id,
                        target_model_id: this.target.target_model_id,
                        target_color: this.target.target_color,
                        target_chassis_number: this.target.target_chassis_number,
                        mechanic_id: this.processForm.newTechnician, // Nuevo técnico
                        activation_date: this.target.activation_date ? new Date(this.target.activation_date) : undefined,
                        expiration_date: this.target.expiration_date ? new Date(this.target.expiration_date) : undefined,
                        last_change_date: new Date(),
                        gps_model: this.target.gps_model,
                        ignition_sensor: this.target.ignition_sensor,
                        shutdown_control: this.target.shutdown_control,
                        engine_shutdown: this.target.engine_shutdown,
                        installation_details: this.target.installation_details,
                        status: this.target.status == 'active',
                        canceled: this.target.canceled,
                        delete: this.target['delete'],
                        index: this.target.index,
                        // Preservar plan y precio existentes
                        plan: this.target.plan && typeof this.target.plan === 'object' ? 
                            this.target.plan : 
                            (this.target.plan && this.target.selectedPrice ? {
                                id_plan: this.target.plan,
                                selected_price: {
                                    id: (this.target.selectedPrice as any)?.id || '',
                                    amount: (this.target.selectedPrice as any)?.amount || 0,
                                    payment_period: (this.target.selectedPrice as any)?.payment_period || ''
                                }
                            } : this.target.plan),
                        creator_id: this.target.creator_id,
                        parent_id: this.target.parent_id,
                        user_id: this.target.user_id
                    };

                    const response = await this.targetsService.updateTarget(this.target._id, updateData);
                    console.log('🔍 DEBUG: Respuesta del backend después de cambiar técnico:', response);
                    
                    // Actualizar el objeto target local
                    this.target.mechanic_id = this.processForm.newTechnician;

                    this.messageService.add({
                        severity: 'success',
                        summary: 'Técnico actualizado',
                        detail: 'El técnico ha sido cambiado correctamente'
                    });

                } catch (error) {
                    console.error('Error al actualizar el técnico:', error);
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'No se pudo actualizar el técnico. El proceso se registró correctamente.'
                    });
                    
                    // Aun si falla el backend, reflejar en el formulario local para continuidad visual
                    this.target.mechanic_id = this.processForm.newTechnician;
                }
            }

            // Si es un cambio de GPS, actualizar el target
            if (this.processForm.type === 'gps_change') {
                try {
                    
                    // Preparar datos para actualizar el IMEI, modelo GPS y detalles de instalación
                    const updateData: UpdateTargetDto = {
                        name: this.target.name,
                        device_imei: this.processForm.newGpsImei.trim(), // Nuevo IMEI
                        type: this.processForm.newGpsModel, // Nuevo modelo GPS (el backend espera 'type')
                        sim_card_number: this.target.sim_card_number,
                        sim_company: this.target.sim_company,
                        description: this.target.description,
                        target_plate_number: this.target.target_plate_number,
                        contacts: Array.isArray(this.target.contacts) ? this.target.contacts.join(',') : this.target.contacts,
                        target_year: this.target.target_year,
                        installation_location: this.target.installation_location,
                        target_brand_id: this.target.target_brand_id,
                        target_model_id: this.target.target_model_id,
                        target_color: this.target.target_color,
                        target_chassis_number: this.target.target_chassis_number,
                        mechanic_id: this.target.mechanic_id,
                        activation_date: this.target.activation_date ? new Date(this.target.activation_date) : undefined,
                        expiration_date: this.target.expiration_date ? new Date(this.target.expiration_date) : undefined,
                        last_change_date: new Date(),
                        gps_model: this.target.gps_model, // Mantener el valor actual de gps_model
                        ignition_sensor: this.target.ignition_sensor,
                        shutdown_control: this.target.shutdown_control,
                        engine_shutdown: this.target.engine_shutdown,
                        installation_details: this.processForm.newInstallationDetails.trim(), // Nuevos detalles de instalación
                        status: this.target.status == 'active',
                        canceled: this.target.canceled,
                        delete: this.target['delete'],
                        index: this.target.index,
                        // Preservar plan y precio existentes
                        plan: this.target.plan && typeof this.target.plan === 'object' ? 
                            this.target.plan : 
                            (this.target.plan && this.target.selectedPrice ? {
                                id_plan: this.target.plan,
                                selected_price: {
                                    id: (this.target.selectedPrice as any)?.id || '',
                                    amount: (this.target.selectedPrice as any)?.amount || 0,
                                    payment_period: (this.target.selectedPrice as any)?.payment_period || ''
                                }
                            } : this.target.plan),
                        creator_id: this.target.creator_id,
                        parent_id: this.target.parent_id,
                        user_id: this.target.user_id
                    };

                    const response = await this.targetsService.updateTarget(this.target._id, updateData);
                    
                    // Actualizar el objeto target local
                    this.target.device_imei = this.processForm.newGpsImei.trim();
                    this.target.type = this.processForm.newGpsModel; // El backend usa 'type' para el modelo GPS
                    this.target.installation_details = this.processForm.newInstallationDetails.trim();

                    this.messageService.add({
                        severity: 'success',
                        summary: 'GPS actualizado',
                        detail: 'El IMEI, modelo del GPS y detalles de instalación han sido actualizados correctamente'
                    });

                } catch (error) {
                    console.error('Error al actualizar el GPS:', error);
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'No se pudo actualizar el GPS. El proceso se registró correctamente.'
                    });
                    
                    // Aun si falla el backend, reflejar en el formulario local para continuidad visual
                    this.target.device_imei = this.processForm.newGpsImei.trim();
                    this.target.type = this.processForm.newGpsModel; // El backend usa 'type' para el modelo GPS
                    this.target.installation_details = this.processForm.newInstallationDetails.trim();
                }
            }
            
            // Si es modificar detalles de instalación, actualizar solo los detalles
            if (this.processForm.type === 'installation_details_change') {
                try {
                    // Preparar datos para actualizar solo los detalles de instalación
                    const updateData: UpdateTargetDto = {
                        name: this.target.name,
                        device_imei: this.target.device_imei,
                        type: this.target.type,
                        sim_card_number: this.target.sim_card_number,
                        sim_company: this.target.sim_company,
                        description: this.target.description,
                        target_plate_number: this.target.target_plate_number,
                        contacts: Array.isArray(this.target.contacts) ? this.target.contacts.join(',') : this.target.contacts,
                        target_year: this.target.target_year,
                        installation_location: this.target.installation_location,
                        target_brand_id: this.target.target_brand_id,
                        target_model_id: this.target.target_model_id,
                        target_color: this.target.target_color,
                        target_chassis_number: this.target.target_chassis_number,
                        mechanic_id: this.target.mechanic_id,
                        activation_date: this.target.activation_date ? new Date(this.target.activation_date) : undefined,
                        expiration_date: this.target.expiration_date ? new Date(this.target.expiration_date) : undefined,
                        last_change_date: new Date(),
                        gps_model: this.target.gps_model,
                        ignition_sensor: this.target.ignition_sensor,
                        shutdown_control: this.target.shutdown_control,
                        engine_shutdown: this.target.engine_shutdown,
                        installation_details: this.processForm.newInstallationDetails.trim(), // Nuevos detalles de instalación
                        status: this.target.status == 'active',
                        canceled: this.target.canceled,
                        delete: this.target['delete'],
                        index: this.target.index,
                        // Preservar plan y precio existentes
                        plan: this.target.plan && typeof this.target.plan === 'object' ? 
                            this.target.plan : 
                            (this.target.plan && this.target.selectedPrice ? {
                                id_plan: this.target.plan,
                                selected_price: {
                                    id: (this.target.selectedPrice as any)?.id || '',
                                    amount: (this.target.selectedPrice as any)?.amount || 0,
                                    payment_period: (this.target.selectedPrice as any)?.payment_period || ''
                                }
                            } : this.target.plan),
                        creator_id: this.target.creator_id,
                        parent_id: this.target.parent_id,
                        user_id: this.target.user_id
                    };

                    const response = await this.targetsService.updateTarget(this.target._id, updateData);
                    
                    // Actualizar el objeto target local
                    this.target.installation_details = this.processForm.newInstallationDetails.trim();

                    this.messageService.add({
                        severity: 'success',
                        summary: 'Detalles actualizados',
                        detail: 'Los detalles de instalación han sido actualizados correctamente'
                    });

                } catch (error) {
                    console.error('Error al actualizar los detalles de instalación:', error);
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'No se pudieron actualizar los detalles de instalación. El proceso se registró correctamente.'
                    });
                    
                    // Aun si falla el backend, reflejar en el formulario local para continuidad visual
                    this.target.installation_details = this.processForm.newInstallationDetails.trim();
                }
            }
            
            // Si es modificar modelo de GPS, actualizar solo el modelo
            if (this.processForm.type === 'gps_model_change') {
                try {
                    // Preparar datos para actualizar solo el modelo de GPS
                    const updateData: UpdateTargetDto = {
                        name: this.target.name,
                        device_imei: this.target.device_imei,
                        type: this.processForm.newGpsModel, // Nuevo modelo GPS (el backend espera 'type')
                        sim_card_number: this.target.sim_card_number,
                        sim_company: this.target.sim_company,
                        description: this.target.description,
                        target_plate_number: this.target.target_plate_number,
                        contacts: Array.isArray(this.target.contacts) ? this.target.contacts.join(',') : this.target.contacts,
                        target_year: this.target.target_year,
                        installation_location: this.target.installation_location,
                        target_brand_id: this.target.target_brand_id,
                        target_model_id: this.target.target_model_id,
                        target_color: this.target.target_color,
                        target_chassis_number: this.target.target_chassis_number,
                        mechanic_id: this.target.mechanic_id,
                        activation_date: this.target.activation_date ? new Date(this.target.activation_date) : undefined,
                        expiration_date: this.target.expiration_date ? new Date(this.target.expiration_date) : undefined,
                        last_change_date: new Date(),
                        gps_model: this.target.gps_model,
                        ignition_sensor: this.target.ignition_sensor,
                        shutdown_control: this.target.shutdown_control,
                        engine_shutdown: this.target.engine_shutdown,
                        installation_details: this.target.installation_details,
                        status: this.target.status == 'active',
                        canceled: this.target.canceled,
                        delete: this.target['delete'],
                        index: this.target.index,
                        // Preservar plan y precio existentes
                        plan: this.target.plan && typeof this.target.plan === 'object' ? 
                            this.target.plan : 
                            (this.target.plan && this.target.selectedPrice ? {
                                id_plan: this.target.plan,
                                selected_price: {
                                    id: (this.target.selectedPrice as any)?.id || '',
                                    amount: (this.target.selectedPrice as any)?.amount || 0,
                                    payment_period: (this.target.selectedPrice as any)?.payment_period || ''
                                }
                            } : this.target.plan),
                        creator_id: this.target.creator_id,
                        parent_id: this.target.parent_id,
                        user_id: this.target.user_id
                    };

                    const response = await this.targetsService.updateTarget(this.target._id, updateData);
                    
                    // Actualizar el objeto target local
                    this.target.type = this.processForm.newGpsModel; // El backend usa 'type' para el modelo GPS

                    this.messageService.add({
                        severity: 'success',
                        summary: 'Modelo de GPS actualizado',
                        detail: 'El modelo del GPS ha sido actualizado correctamente'
                    });

                } catch (error) {
                    console.error('Error al actualizar el modelo de GPS:', error);
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'No se pudo actualizar el modelo de GPS. El proceso se registró correctamente.'
                    });
                    
                    // Aun si falla el backend, reflejar en el formulario local para continuidad visual
                    this.target.type = this.processForm.newGpsModel; // El backend usa 'type' para el modelo GPS
                }
            }
            
            // Si es modificar IMEI / GPS ID, actualizar solo el IMEI
            if (this.processForm.type === 'imei_change') {
                try {
                    // Preparar datos para actualizar solo el IMEI / GPS ID
                    const updateData: UpdateTargetDto = {
                        name: this.target.name,
                        device_imei: this.processForm.newGpsImei.trim(), // Nuevo IMEI
                        type: this.target.type,
                        sim_card_number: this.target.sim_card_number,
                        sim_company: this.target.sim_company,
                        description: this.target.description,
                        target_plate_number: this.target.target_plate_number,
                        contacts: Array.isArray(this.target.contacts) ? this.target.contacts.join(',') : this.target.contacts,
                        target_year: this.target.target_year,
                        installation_location: this.target.installation_location,
                        target_brand_id: this.target.target_brand_id,
                        target_model_id: this.target.target_model_id,
                        target_color: this.target.target_color,
                        target_chassis_number: this.target.target_chassis_number,
                        mechanic_id: this.target.mechanic_id,
                        activation_date: this.target.activation_date ? new Date(this.target.activation_date) : undefined,
                        expiration_date: this.target.expiration_date ? new Date(this.target.expiration_date) : undefined,
                        last_change_date: new Date(),
                        gps_model: this.target.gps_model,
                        ignition_sensor: this.target.ignition_sensor,
                        shutdown_control: this.target.shutdown_control,
                        engine_shutdown: this.target.engine_shutdown,
                        installation_details: this.target.installation_details,
                        status: this.target.status == 'active',
                        canceled: this.target.canceled,
                        delete: this.target['delete'],
                        index: this.target.index,
                        // Preservar plan y precio existentes
                        plan: this.target.plan && typeof this.target.plan === 'object' ? 
                            this.target.plan : 
                            (this.target.plan && this.target.selectedPrice ? {
                                id_plan: this.target.plan,
                                selected_price: {
                                    id: (this.target.selectedPrice as any)?.id || '',
                                    amount: (this.target.selectedPrice as any)?.amount || 0,
                                    payment_period: (this.target.selectedPrice as any)?.payment_period || ''
                                }
                            } : this.target.plan),
                        creator_id: this.target.creator_id,
                        parent_id: this.target.parent_id,
                        user_id: this.target.user_id
                    };

                    const response = await this.targetsService.updateTarget(this.target._id, updateData);
                    
                    // Actualizar el objeto target local
                    this.target.device_imei = this.processForm.newGpsImei.trim();

                    this.messageService.add({
                        severity: 'success',
                        summary: 'IMEI actualizado',
                        detail: 'El IMEI / GPS ID ha sido actualizado correctamente'
                    });

                } catch (error) {
                    console.error('Error al actualizar el IMEI:', error);
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'No se pudo actualizar el IMEI / GPS ID. El proceso se registró correctamente.'
                    });
                    
                    // Aun si falla el backend, reflejar en el formulario local para continuidad visual
                    this.target.device_imei = this.processForm.newGpsImei.trim();
                }
            }
            
            // Si es cambio de SIM card, actualizar solo la SIM
            if (this.processForm.type === 'sim_change') {
                try {
                    // Preparar datos para actualizar solo la SIM card
                    const updateData: UpdateTargetDto = {
                        name: this.target.name,
                        device_imei: this.target.device_imei,
                        type: this.target.type,
                        sim_card_number: this.processForm.newSimCard.trim(), // Nueva SIM card
                        sim_company: this.processForm.newSimCompany.trim(), // Nuevo tipo de SIM
                        description: this.target.description,
                        target_plate_number: this.target.target_plate_number,
                        contacts: Array.isArray(this.target.contacts) ? this.target.contacts.join(',') : this.target.contacts,
                        target_year: this.target.target_year,
                        installation_location: this.target.installation_location,
                        target_brand_id: this.target.target_brand_id,
                        target_model_id: this.target.target_model_id,
                        target_color: this.target.target_color,
                        target_chassis_number: this.target.target_chassis_number,
                        mechanic_id: this.target.mechanic_id,
                        activation_date: this.target.activation_date ? new Date(this.target.activation_date) : undefined,
                        expiration_date: this.target.expiration_date ? new Date(this.target.expiration_date) : undefined,
                        last_change_date: new Date(),
                        gps_model: this.target.gps_model,
                        ignition_sensor: this.target.ignition_sensor,
                        shutdown_control: this.target.shutdown_control,
                        engine_shutdown: this.target.engine_shutdown,
                        installation_details: this.target.installation_details,
                        status: this.target.status == 'active',
                        canceled: this.target.canceled,
                        delete: this.target['delete'],
                        index: this.target.index,
                        // Preservar plan y precio existentes
                        plan: this.target.plan && typeof this.target.plan === 'object' ? 
                            this.target.plan : 
                            (this.target.plan && this.target.selectedPrice ? {
                                id_plan: this.target.plan,
                                selected_price: {
                                    id: (this.target.selectedPrice as any)?.id || '',
                                    amount: (this.target.selectedPrice as any)?.amount || 0,
                                    payment_period: (this.target.selectedPrice as any)?.payment_period || ''
                                }
                            } : this.target.plan),
                        creator_id: this.target.creator_id,
                        parent_id: this.target.parent_id,
                        user_id: this.target.user_id
                    };

                    const response = await this.targetsService.updateTarget(this.target._id, updateData);
                    
                    // Actualizar el objeto target local
                    this.target.sim_card_number = this.processForm.newSimCard.trim();
                    this.target.sim_company = this.processForm.newSimCompany.trim();

                    this.messageService.add({
                        severity: 'success',
                        summary: 'SIM card actualizada',
                        detail: 'La SIM card ha sido actualizada correctamente'
                    });

                } catch (error) {
                    console.error('Error al actualizar la SIM card:', error);
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'No se pudo actualizar la SIM card. El proceso se registró correctamente.'
                    });
                    
                    // Aun si falla el backend, reflejar en el formulario local para continuidad visual
                    this.target.sim_card_number = this.processForm.newSimCard.trim();
                    this.target.sim_company = this.processForm.newSimCompany.trim();
                }
            }
            
            // Si es modificar número de SIM card, actualizar solo el número
            if (this.processForm.type === 'sim_number_change') {
                try {
                    // Preparar datos para actualizar solo el número de SIM card
                    const updateData: UpdateTargetDto = {
                        name: this.target.name,
                        device_imei: this.target.device_imei,
                        type: this.target.type,
                        sim_card_number: this.processForm.newSimNumber.trim(), // Nuevo número de SIM
                        sim_company: this.target.sim_company, // Mantener el tipo de SIM existente
                        description: this.target.description,
                        target_plate_number: this.target.target_plate_number,
                        contacts: Array.isArray(this.target.contacts) ? this.target.contacts.join(',') : this.target.contacts,
                        target_year: this.target.target_year,
                        installation_location: this.target.installation_location,
                        target_brand_id: this.target.target_brand_id,
                        target_model_id: this.target.target_model_id,
                        target_color: this.target.target_color,
                        target_chassis_number: this.target.target_chassis_number,
                        mechanic_id: this.target.mechanic_id,
                        activation_date: this.target.activation_date ? new Date(this.target.activation_date) : undefined,
                        expiration_date: this.target.expiration_date ? new Date(this.target.expiration_date) : undefined,
                        last_change_date: new Date(),
                        gps_model: this.target.gps_model,
                        ignition_sensor: this.target.ignition_sensor,
                        shutdown_control: this.target.shutdown_control,
                        engine_shutdown: this.target.engine_shutdown,
                        installation_details: this.target.installation_details,
                        status: this.target.status == 'active',
                        canceled: this.target.canceled,
                        delete: this.target['delete'],
                        index: this.target.index,
                        // Preservar plan y precio existentes
                        plan: this.target.plan && typeof this.target.plan === 'object' ? 
                            this.target.plan : 
                            (this.target.plan && this.target.selectedPrice ? {
                                id_plan: this.target.plan,
                                selected_price: {
                                    id: (this.target.selectedPrice as any)?.id || '',
                                    amount: (this.target.selectedPrice as any)?.amount || 0,
                                    payment_period: (this.target.selectedPrice as any)?.payment_period || ''
                                }
                            } : this.target.plan),
                        creator_id: this.target.creator_id,
                        parent_id: this.target.parent_id,
                        user_id: this.target.user_id
                    };

                    const response = await this.targetsService.updateTarget(this.target._id, updateData);
                    
                    // Actualizar el objeto target local
                    this.target.sim_card_number = this.processForm.newSimNumber.trim();

                    this.messageService.add({
                        severity: 'success',
                        summary: 'Número de SIM actualizado',
                        detail: 'El número de SIM card ha sido actualizado correctamente'
                    });

                } catch (error) {
                    console.error('Error al actualizar el número de SIM:', error);
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'No se pudo actualizar el número de SIM. El proceso se registró correctamente.'
                    });
                    
                    // Aun si falla el backend, reflejar en el formulario local para continuidad visual
                    this.target.sim_card_number = this.processForm.newSimNumber.trim();
                }
            }
            
            // Si es modificar tipo de SIM card, actualizar solo el tipo
            if (this.processForm.type === 'sim_type_change') {
                try {
                    // Preparar datos para actualizar solo el tipo de SIM card
                    const updateData: UpdateTargetDto = {
                        name: this.target.name,
                        device_imei: this.target.device_imei,
                        type: this.target.type,
                        sim_card_number: this.target.sim_card_number, // Mantener el número de SIM existente
                        sim_company: this.processForm.newSimType.trim(), // Nuevo tipo de SIM
                        description: this.target.description,
                        target_plate_number: this.target.target_plate_number,
                        contacts: Array.isArray(this.target.contacts) ? this.target.contacts.join(',') : this.target.contacts,
                        target_year: this.target.target_year,
                        installation_location: this.target.installation_location,
                        target_brand_id: this.target.target_brand_id,
                        target_model_id: this.target.target_model_id,
                        target_color: this.target.target_color,
                        target_chassis_number: this.target.target_chassis_number,
                        mechanic_id: this.target.mechanic_id,
                        activation_date: this.target.activation_date ? new Date(this.target.activation_date) : undefined,
                        expiration_date: this.target.expiration_date ? new Date(this.target.expiration_date) : undefined,
                        last_change_date: new Date(),
                        gps_model: this.target.gps_model,
                        ignition_sensor: this.target.ignition_sensor,
                        shutdown_control: this.target.shutdown_control,
                        engine_shutdown: this.target.engine_shutdown,
                        installation_details: this.target.installation_details,
                        status: this.target.status == 'active',
                        canceled: this.target.canceled,
                        delete: this.target['delete'],
                        index: this.target.index,
                        // Preservar plan y precio existentes
                        plan: this.target.plan && typeof this.target.plan === 'object' ? 
                            this.target.plan : 
                            (this.target.plan && this.target.selectedPrice ? {
                                id_plan: this.target.plan,
                                selected_price: {
                                    id: (this.target.selectedPrice as any)?.id || '',
                                    amount: (this.target.selectedPrice as any)?.amount || 0,
                                    payment_period: (this.target.selectedPrice as any)?.payment_period || ''
                                }
                            } : this.target.plan),
                        creator_id: this.target.creator_id,
                        parent_id: this.target.parent_id,
                        user_id: this.target.user_id
                    };

                    const response = await this.targetsService.updateTarget(this.target._id, updateData);
                    
                    // Actualizar el objeto target local
                    this.target.sim_company = this.processForm.newSimType.trim();

                    this.messageService.add({
                        severity: 'success',
                        summary: 'Tipo de SIM actualizado',
                        detail: 'El tipo de SIM card ha sido actualizado correctamente'
                    });

                } catch (error) {
                    console.error('Error al actualizar el tipo de SIM:', error);
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'No se pudo actualizar el tipo de SIM. El proceso se registró correctamente.'
                    });
                    
                    // Aun si falla el backend, reflejar en el formulario local para continuidad visual
                    this.target.sim_company = this.processForm.newSimType.trim();
                }
            }

            // Mostrar mensaje de éxito
            this.messageService.add({
                severity: 'success',
                summary: 'Proceso agregado',
                detail: `El proceso de ${this.processForm.type} ha sido registrado exitosamente`
            });

            // Limpiar el formulario
            this.resetProcessForm();

            // Recargar la lista de procesos
            this.loadProcessesList();

        } catch (error) {
            console.error('Error al crear proceso:', error);
            this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'No se pudo registrar el proceso. Intente nuevamente.'
            });
        }
    }

    // Método para limpiar el formulario de proceso
    private resetProcessForm(): void {
        this.processForm = {
            type: '',
            registrationDate: this.getTodayInputDate(),
            description: '',
            newPlan: '',
            newPrice: null,
            newInstallationDate: '',
            newExpirationDate: '',
            newRenewalDate: '',
            newTechnician: '',
            newGpsImei: '',
            newGpsModel: '',
            newInstallationDetails: '',
            newSimCard: '',
            newSimCompany: '',
            newSimNumber: '',
            newSimType: ''
        };
    }

    // Método para cargar todos los planes disponibles (sin filtros de servidor)
    async loadFilteredPlansForProcess(): Promise<void> {
        try {
            // Obtener todos los planes sin filtrar por servidor
            this.plansService.getAllPlans().subscribe({
                next: (allPlans: Plan[]) => {
                    // Mostrar todos los planes disponibles sin restricciones
                    this.availablePlansForProcess = allPlans.map(plan => ({
                        label: plan.plan_name,
                        value: plan._id
                    })).sort((a, b) => a.label.localeCompare(b.label));
                },
                error: (error) => {
                    console.error('Error al cargar todos los planes:', error);
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'No se pudieron cargar los planes disponibles'
                    });
                }
            });
        } catch (error) {
            console.error('Error en loadFilteredPlansForProcess:', error);
        }
    }

    // Método para manejar el cambio de plan en el proceso
    async onProcessPlanChange() {
        if (this.processForm.newPlan && typeof this.processForm.newPlan === 'string' && this.processForm.newPlan !== '') {
            try {
                // Resetear el precio seleccionado temporalmente
                this.processForm.newPrice = null;
                
                // Cargar el plan completo con sus precios
                this.plansService.getPlanById(this.processForm.newPlan).subscribe({
                    next: (plan: Plan) => {
                        // Asegurar que los períodos de pago sean strings
                        this.availablePricesForProcess = plan.prices.map(price => {
                            return {
                                id: price.id,
                                amount: price.amount,
                                payment_period: typeof price.payment_period === 'string' ? 
                                    price.payment_period : 
                                    this.mapPeriodToString(price.payment_period)
                            };
                        });
                        // Reset de personalización al cambiar de plan
                        this.processCustomPrice = {
                            id: CUSTOM_PRICE_CONFIG.CUSTOM_PREFIX + new Date().getTime(),
                            amount: 0,
                            payment_period: CUSTOM_PRICE_CONFIG.DEFAULT_PAYMENT_PERIOD
                        };
                        this.processOriginalPlanPrice = null;
                    },
                    error: (error) => {
                        console.error('Error al cargar los precios del plan para el proceso:', error);
                        this.messageService.add({
                            severity: 'error',
                            summary: 'Error',
                            detail: 'No se pudieron cargar los precios del plan'
                        });
                        this.availablePricesForProcess = [];
                    }
                });
            } catch (error) {
                console.error('Error al cambiar de plan en el proceso:', error);
                this.availablePricesForProcess = [];
            }
        } else {
            // Si no hay plan seleccionado, vaciar los precios
            this.availablePricesForProcess = [];
            this.processForm.newPrice = null;
        }
    }

    // Método para manejar el cambio de tipo de proceso
    onProcessTypeChange(): void {
        console.log('🔍 DEBUG: Cambio de tipo de proceso a:', this.processForm.type);
        console.log('🔍 DEBUG: Precio del target ANTES del cambio:', this.target.selectedPrice);

        // Solo cargar planes filtrados si es cambio de plan, sin limpiar nada más
        if (this.processForm.type === 'plan_change') {
            this.loadFilteredPlansForProcess();
        } else {
            // Limpiar campos específicos del cambio de plan cuando no es plan_change
        this.processForm.newPlan = '';
        this.processForm.newPrice = null;
            this.availablePricesForProcess = []; // Solo limpiar precios de procesos, no del formulario principal
            this.availablePlansForProcess = [];
        }

        // Limpiar campos específicos de cambio de fechas cuando se cambia el tipo
        if (this.processForm.type !== 'installation') {
            this.processForm.newInstallationDate = '';
        }

        if (this.processForm.type !== 'expiration') {
            this.processForm.newExpirationDate = '';
        }

        if (this.processForm.type !== 'renewal') {
            this.processForm.newRenewalDate = '';
        }

        if (this.processForm.type !== 'technician_change') {
            this.processForm.newTechnician = '';
        }

        // Limpiar IMEI solo si no es gps_change ni imei_change
        if (this.processForm.type !== 'gps_change' && this.processForm.type !== 'imei_change') {
            this.processForm.newGpsImei = '';
        }

        // Limpiar modelo de GPS solo si no es gps_change ni gps_model_change
        if (this.processForm.type !== 'gps_change' && this.processForm.type !== 'gps_model_change') {
            this.processForm.newGpsModel = '';
        }

        // Limpiar detalles de instalación solo si no es gps_change ni installation_details_change
        if (this.processForm.type !== 'gps_change' && this.processForm.type !== 'installation_details_change') {
            this.processForm.newInstallationDetails = '';
        }

        // Limpiar SIM card solo si no es sim_change
        if (this.processForm.type !== 'sim_change') {
            this.processForm.newSimCard = '';
            this.processForm.newSimCompany = '';
        }

        // Limpiar número de SIM solo si no es sim_number_change
        if (this.processForm.type !== 'sim_number_change') {
            this.processForm.newSimNumber = '';
        }

        // Limpiar tipo de SIM solo si no es sim_type_change
        if (this.processForm.type !== 'sim_type_change') {
            this.processForm.newSimType = '';
        }

        // Pre-llenar campos con valores actuales del target cuando corresponde
        if (this.processForm.type === 'installation') {
            // Pre-llenar con la fecha de instalación actual
            if (this.target.installation_date) {
                this.processForm.newInstallationDate = this.target.installation_date;
            }
        }

        if (this.processForm.type === 'expiration') {
            // Pre-llenar con la fecha de expiración actual
            if (this.target.expiration_date) {
                this.processForm.newExpirationDate = this.target.expiration_date;
            }
        }

        if (this.processForm.type === 'renewal') {
            // Pre-llenar con la fecha de expiración actual (para renovación)
            if (this.target.expiration_date) {
                this.processForm.newRenewalDate = this.target.expiration_date;
            }
        }

        if (this.processForm.type === 'technician_change') {
            // Pre-llenar con el técnico actual
            if (this.target.mechanic_id) {
                this.processForm.newTechnician = this.target.mechanic_id;
            }
        }

        if (this.processForm.type === 'gps_change' || this.processForm.type === 'imei_change') {
            // Pre-llenar con el IMEI actual
            if (this.target.device_imei) {
                this.processForm.newGpsImei = this.target.device_imei;
            }
        }

        if (this.processForm.type === 'gps_change') {
            // Pre-llenar con el modelo de GPS actual
            if (this.target.type) {
                this.processForm.newGpsModel = this.target.type;
            }
            // Pre-llenar con los detalles de instalación actuales
            if (this.target.installation_details) {
                this.processForm.newInstallationDetails = this.target.installation_details;
            }
        }

        if (this.processForm.type === 'gps_model_change') {
            // Pre-llenar con el modelo de GPS actual
            if (this.target.type) {
                this.processForm.newGpsModel = this.target.type;
            }
        }

        if (this.processForm.type === 'installation_details_change') {
            // Pre-llenar con los detalles de instalación actuales
            if (this.target.installation_details) {
                this.processForm.newInstallationDetails = this.target.installation_details;
            }
        }

        if (this.processForm.type === 'sim_change') {
            // Pre-llenar con la SIM card actual
            if (this.target.sim_card_number) {
                this.processForm.newSimCard = this.target.sim_card_number;
            }
            if (this.target.sim_company) {
                this.processForm.newSimCompany = this.target.sim_company;
            }
        }

        if (this.processForm.type === 'sim_number_change') {
            // Pre-llenar con el número de SIM actual
            if (this.target.sim_card_number) {
                this.processForm.newSimNumber = this.target.sim_card_number;
            }
        }

        if (this.processForm.type === 'sim_type_change') {
            // Pre-llenar con el tipo de SIM actual
            if (this.target.sim_company) {
                this.processForm.newSimType = this.target.sim_company;
            }
        }

        console.log('🔍 DEBUG: Precio del target DESPUÉS del cambio:', this.target.selectedPrice);
    }

    // Método para manejar el cambio de precio en el proceso
    onProcessPriceChange(): void {
        // Validar que se haya seleccionado un precio válido
        if (this.processForm.newPrice) {
            console.log('Precio seleccionado para el proceso:', this.processForm.newPrice);
        }
    }

    // ========= Personalización de precio en CAMBIO DE PLAN ========= //
    startProcessCustomPriceEdit(): void {
        if (this.processForm.newPrice && this.processForm.newPlan) {
            // Tomar valores base del precio seleccionado actualmente
            this.processCustomPrice = {
                id: (this.processForm.newPrice as any).id,
                amount: (this.processForm.newPrice as any).amount,
                payment_period: (this.processForm.newPrice as any).payment_period
            };

            // Cargar precio original desde el plan seleccionado para mostrar en modal
            this.plansService.getPlanById(this.processForm.newPlan).subscribe({
                next: (plan: Plan) => {
                    const original = plan.prices.find(p => p.id === (this.processForm.newPrice as any)?.id);
                    if (original) {
                        this.processOriginalPlanPrice = {
                            id: original.id,
                            amount: original.amount,
                            payment_period: typeof original.payment_period === 'string' ?
                                original.payment_period : this.mapPeriodToString(original.payment_period)
                        };
                    } else {
                        this.processOriginalPlanPrice = null;
                    }
                },
                error: () => {
                    this.processOriginalPlanPrice = null;
                }
            });
        } else {
            // Si no hay precio seleccionado aún, iniciar con valores por defecto
            this.processCustomPrice = {
                id: CUSTOM_PRICE_CONFIG.CUSTOM_PREFIX + new Date().getTime(),
                amount: 0,
                payment_period: CUSTOM_PRICE_CONFIG.DEFAULT_PAYMENT_PERIOD
            };
            this.processOriginalPlanPrice = null;
        }

        this.displayProcessPriceDialog = true;
    }

    applyProcessCustomPrice(): void {
        if (!this.processCustomPrice || this.processCustomPrice.amount <= 0) {
            this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: this.translate('management.targetForm.invalidPrice')
            });
            return;
        }

        // Crear objeto de precio personalizado conservando el id
        const customPriceObj: any = {
            id: this.processCustomPrice.id,
            amount: this.processCustomPrice.amount,
            payment_period: this.processCustomPrice.payment_period,
            originalAmount: this.processOriginalPlanPrice?.amount ?? (this.processForm.newPrice as any)?.originalAmount ?? 0
        };

        // Reemplazar/insertar en lista de precios actual del proceso (availablePricesForProcess en contexto del nuevo plan)
        const existingIndex = this.availablePricesForProcess.findIndex(p => p.id === customPriceObj.id);
        if (existingIndex >= 0) {
            if (!(this.availablePricesForProcess[existingIndex] as any).originalAmount && this.processOriginalPlanPrice) {
                customPriceObj.originalAmount = this.processOriginalPlanPrice.amount;
            }
            this.availablePricesForProcess[existingIndex] = customPriceObj;
        } else {
            // Insertar al inicio para mayor visibilidad; evita duplicar otros custom existentes
            this.availablePricesForProcess = [customPriceObj, ...this.availablePricesForProcess.filter(p => !(p as any).id?.startsWith(CUSTOM_PRICE_CONFIG.CUSTOM_PREFIX))];
        }

        // Seleccionar el precio personalizado en el formulario de proceso
        this.processForm.newPrice = customPriceObj;

        // Cerrar modal
        this.displayProcessPriceDialog = false;

        this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: this.translate('management.targetForm.customPriceApplied')
        });
    }

    cancelProcessCustomPrice(): void {
        this.displayProcessPriceDialog = false;
    }

    // Método para cargar la lista de procesos del target actual
    async loadProcessesList(): Promise<void> {
        if (!this.target || !this.target._id) {
            return;
        }

        try {
            this.isLoadingProcesses = true;
            this.processList = await this.targetsService.getProcessesByReference(this.target._id);
            
            // Ordenar procesos por fecha de registro (más recientes primero)
            this.processList.sort((a, b) => 
                new Date(b.registrationDate).getTime() - new Date(a.registrationDate).getTime()
            );

            // Inicializar la propiedad expanded para cada proceso
            this.processList.forEach(process => {
                process.expanded = false;
            });
            this.expandedProcessIndex = null;

        } catch (error) {
            console.error('Error al cargar procesos:', error);
            this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'No se pudieron cargar los procesos del dispositivo'
            });
        } finally {
            this.isLoadingProcesses = false;
        }
    }

    // Abrir modal de historial de procesos
    openProcessesDialog(): void {
        this.displayProcessesDialog = true;
        // Cargar o refrescar al abrir
        this.loadProcessesList();
    }

    // Método para obtener el nombre del tipo de proceso
    getProcessTypeName(type: number): string {
        const typeNames: { [key: number]: string } = {
            1: 'Instalación inicial',
            2: 'Fecha de instalación',
            3: 'Fecha de expiración',
            4: 'Renovación de servicio',
            5: 'Cambio de plan',
            6: 'Cambio de plan', // Compatibilidad con tipos anteriores
            7: 'Cambio de plan', // Compatibilidad con tipos anteriores
            8: 'Cambio de técnico',
            9: 'Cambio de GPS',
            10: 'Detalles de instalación',
            11: 'Modelo de GPS',
            12: 'IMEI / GPS ID',
            13: 'SIM card',
            14: 'Número de SIM',
            15: 'Tipo de SIM',
            16: 'Restauración'
        };
        return typeNames[type] || `Proceso desconocido`;
    }

    // Método para formatear fecha
    formatDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }

    // Método para formatear fecha y hora completa
    formatDateTime(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Método para alternar la expansión de un proceso
    toggleProcessExpansion(index: number): void {
        if (!this.processList[index]) return;

        // Si el mismo índice, colapsar
        if (this.expandedProcessIndex === index) {
            this.processList[index].expanded = false;
            this.expandedProcessIndex = null;
            return;
        }

        // Cerrar el previamente abierto
        if (this.expandedProcessIndex !== null && this.processList[this.expandedProcessIndex]) {
            this.processList[this.expandedProcessIndex].expanded = false;
        }

        // Abrir el nuevo
        this.processList[index].expanded = true;
        this.expandedProcessIndex = index;
    }

    trackByProcess(index: number, process: ProcessResponse): string {
        return process._id || String(index);
    }

    trackByCommand(index: number, command: any): any {
        return command._id || index;
    }

    // Método para obtener el ícono según el tipo de proceso
    getProcessIcon(type: number): string {
        const iconMap: { [key: number]: string } = {
            1: 'pi pi-wrench',        // Instalación real
            2: 'pi pi-calendar',      // Modificación de fecha de instalación
            3: 'pi pi-calendar-times', // Modificación de fecha de expiración
            4: 'pi pi-refresh',       // Renovación de servicio
            5: 'pi pi-dollar',        // Cambio de plan
            6: 'pi pi-dollar',        // Cambio de plan (compatibilidad)
            7: 'pi pi-dollar',        // Cambio de plan (compatibilidad)
            8: 'pi pi-user',          // Cambio de técnico
            9: 'pi pi-mobile',        // Cambio de GPS
            10: 'pi pi-file-edit',    // Modificar detalles de instalación
            11: 'pi pi-cog',          // Modificar modelo de GPS
            12: 'pi pi-id-card',      // Modificar IMEI / GPS ID
            13: 'pi pi-credit-card',  // Cambio de SIM card
            14: 'pi pi-phone',        // Modificar número de SIM card
            15: 'pi pi-sim-card'      // Modificar tipo de SIM card
        };
        return iconMap[type] || 'pi pi-circle';
    }

    // Método para obtener la clase de estado del proceso
    getProcessStatusClass(type: number): string {
        const statusMap: { [key: number]: string } = {
            1: 'status-installation', // Instalación real
            2: 'status-installation-date', // Modificación de fecha de instalación
            3: 'status-expiration-date', // Modificación de fecha de expiración
            4: 'status-service-renewal', // Renovación de servicio
            5: 'status-plan-change', // Cambio de plan
            6: 'status-plan-change', // Cambio de plan (compatibilidad)
            7: 'status-plan-change', // Cambio de plan (compatibilidad)
            8: 'status-technician-change', // Cambio de técnico
            9: 'status-gps-change', // Cambio de GPS
            10: 'status-installation-details', // Modificar detalles de instalación
            11: 'status-gps-model', // Modificar modelo de GPS
            12: 'status-imei-change', // Modificar IMEI / GPS ID
            13: 'status-sim-change', // Cambio de SIM card
            14: 'status-sim-number-change', // Modificar número de SIM card
            15: 'status-sim-type-change' // Modificar tipo de SIM card
        };
        return statusMap[type] || 'status-default';
    }

    // Método para obtener el texto de estado del proceso
    getProcessStatusText(type: number): string {
        const statusMap: { [key: number]: string } = {
            1: 'CONFIGURACIÓN INICIAL',
            2: 'MODIFICADA',
            3: 'MODIFICADA',
            4: 'COMPLETADA',
            5: 'ACTUALIZADO',
            6: 'ACTUALIZADO', // Cambio de plan (compatibilidad)
            7: 'ACTUALIZADO', // Cambio de plan (compatibilidad)
            8: 'ASIGNADO',    // Cambio de técnico
            9: 'REEMPLAZADO', // Cambio de GPS
            10: 'ACTUALIZADOS', // Modificar detalles de instalación
            11: 'CAMBIADO', // Modificar modelo de GPS
            12: 'ACTUALIZADO', // Modificar IMEI / GPS ID
            13: 'REEMPLAZADA', // Cambio de SIM card
            14: 'ACTUALIZADO', // Modificar número de SIM card
            15: 'ACTUALIZADO' // Modificar tipo de SIM card
        };
        return statusMap[type] || 'COMPLETADO';
    }

    // Método para abrir el modal de gestión de comandos
    openCommandManagementModal(): void {
        this.displayCommandManagementModal = true;
    }

    // Método para cerrar el modal de gestión de comandos
    closeCommandManagementModal(): void {
        this.displayCommandManagementModal = false;
    }

    // Método para abrir el modal de historial de comandos
    openCommandHistoryModal(): void {
        this.displayCommandHistoryModal = true;
        // Cargar comandos al abrir el modal
        this.loadDeviceCommands();
    }

    // Método para cerrar el modal de historial de comandos
    closeCommandHistoryModal(): void {
        this.displayCommandHistoryModal = false;
    }

    // Método para abrir el modal de crear comando
    openCreateCommandModal(): void {
        this.newCommand = {
            name: '',
            description: '',
            observation: ''
        };
        this.displayCreateCommandModal = true;
    }

    // Método para cerrar el modal de crear comando
    closeCreateCommandModal(): void {
        this.displayCreateCommandModal = false;
    }

    // Método para cargar comandos del dispositivo
    async loadDeviceCommands(): Promise<void> {
        if (!this.target._id) {
            this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'No se puede cargar comandos sin un dispositivo seleccionado'
            });
            return;
        }

        try {
            this.isLoadingCommands = true;
            const commands = await this.commandsService.getCommandsByDevice(this.target._id);
            this.deviceCommands = commands || [];
        } catch (error) {
            console.error('Error al cargar comandos:', error);
            this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'No se pudieron cargar los comandos del dispositivo'
            });
            this.deviceCommands = [];
        } finally {
            this.isLoadingCommands = false;
        }
    }

    // Método para crear un comando
    async createCommand(): Promise<void> {
        if (!this.newCommand.name || !this.newCommand.observation) {
            this.messageService.add({
                severity: 'error',
                summary: 'Campos requeridos',
                detail: 'El nombre y la observación son obligatorios'
            });
            return;
        }

        if (!this.target._id) {
            this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'No se puede crear comando sin un dispositivo seleccionado'
            });
            return;
        }

        try {
            this.isCreatingCommand = true;

            const commandData = {
                ...this.newCommand,
                deviceId: this.target._id,
                creator: this.authService.getCurrentUser()?.id || 'system'
            };

            // Enviar comando al backend
            await this.commandsService.createCommand(commandData);

            this.messageService.add({
                severity: 'success',
                summary: 'Comando creado',
                detail: 'El comando ha sido creado exitosamente'
            });

            this.closeCreateCommandModal();
            this.loadDeviceCommands(); // Recargar la lista

        } catch (error) {
            console.error('Error al crear comando:', error);
            this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'No se pudo crear el comando'
            });
        } finally {
            this.isCreatingCommand = false;
        }
    }

    // Método para obtener el texto del estado del comando
    getCommandStatusText(status: string): string {
        const statusMap: { [key: string]: string } = {
            'pending': 'Pendiente',
            'sent': 'Enviado',
            'executed': 'Ejecutado',
            'failed': 'Fallido'
        };
        return statusMap[status] || 'Desconocido';
    }

    // Método para enviar comando de apagar vehículo
    sendVehicleShutdownCommand(): void {
        this.pendingCommandType = 'shutdown';
        this.commandObservationTitle = 'Confirmar Comando: Apagar Vehículo';
        this.commandObservationIcon = 'pi pi-power-off';
        this.commandObservationName = 'Apagar Vehículo';
        this.commandObservationDescription = 'Este comando apagará el motor del vehículo de forma remota.';
        this.commandObservationText = '';
        this.displayCommandObservationModal = true;
    }

    // Método para enviar comando de permitir encendido
    sendAllowIgnitionCommand(): void {
        this.pendingCommandType = 'ignition';
        this.commandObservationTitle = 'Confirmar Comando: Permitir Encendido';
        this.commandObservationIcon = 'pi pi-key';
        this.commandObservationName = 'Permitir Encendido';
        this.commandObservationDescription = 'Este comando permitirá el encendido del vehículo.';
        this.commandObservationText = '';
        this.displayCommandObservationModal = true;
    }

    // Método para cerrar el modal de observación
    closeCommandObservationModal(): void {
        this.displayCommandObservationModal = false;
        this.pendingCommandType = '';
        this.commandObservationText = '';
    }

    // Método para confirmar y enviar el comando
    async confirmSendCommand(): Promise<void> {
        if (!this.target._id) {
            this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'No se puede enviar comando sin un dispositivo seleccionado'
            });
            return;
        }

        try {
            this.isSendingCommand = true;

            // Preparar datos del comando según el tipo
            let commandData: any;

            if (this.pendingCommandType === 'shutdown') {
                commandData = {
                    name: 'Apagar Vehículo',
                    description: 'Comando para apagar el motor del vehículo de forma remota',
                    observation: this.commandObservationText || 'Comando enviado desde la interfaz de gestión',
                    targetId: this.target._id,
                    creator: this.authService.getCurrentUser()?.id || 'system',
                    commandType: 'shutdown'
                };
            } else if (this.pendingCommandType === 'ignition') {
                commandData = {
                    name: 'Permitir Encendido',
                    description: 'Comando para permitir el encendido del vehículo',
                    observation: this.commandObservationText || 'Comando enviado desde la interfaz de gestión',
                    targetId: this.target._id,
                    creator: this.authService.getCurrentUser()?.id || 'system',
                    commandType: 'ignition'
                };
            } else {
                throw new Error('Tipo de comando no válido');
            }

            // Enviar comando al backend
            await this.commandsService.createCommand(commandData);

            this.messageService.add({
                severity: 'success',
                summary: 'Comando enviado',
                detail: `El comando "${commandData.name}" ha sido enviado exitosamente al dispositivo`
            });

            this.closeCommandObservationModal();

            // Recargar la lista de comandos
            this.loadDeviceCommands();

        } catch (error) {
            console.error('Error al enviar comando:', error);
            this.messageService.add({
                severity: 'error',
                summary: 'Error al enviar comando',
                detail: 'No se pudo enviar el comando al dispositivo. Intente nuevamente.'
            });
        } finally {
            this.isSendingCommand = false;
        }
    }
}
