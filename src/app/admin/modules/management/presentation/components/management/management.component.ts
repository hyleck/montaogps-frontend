// Angular imports
import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription, Subject, forkJoin, from } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, map } from 'rxjs/operators';

// Third-party imports
import { MenuItem, ConfirmationService, MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';

// Application imports
import { User, BasicUser, ExtendedUser, convertToExtendedUser } from '@core/interfaces';
import { Target } from '@core/interfaces/target.interface';
import { AuthService } from '@core/services/auth.service';
import { UserService, UsersResponse } from '@core/services/user.service';
import { TargetsService, TargetsResponse } from '@core/services/targets.service';
import { StatusService } from '@shared/services/status.service';
import { ManagementService } from '@management/presentation/services/management.service';
import { ScreenService } from '@management/presentation/services/screen.service';

// Servicios especializados
import { MapProviderService } from '@management/presentation/services/map-provider.service';
import { BreadcrumbService } from '@management/presentation/services/breadcrumb.service';
import { VehicleDataService } from '@management/presentation/services/vehicle-data.service';
import { ManagementUIService } from '@management/presentation/services/management-ui.service';
import { SelectionService } from '@core/services/selection.service';

@Component({
    selector: 'app-management',
    templateUrl: './management.component.html',
    styleUrls: ['./management.component.css'],
    standalone: false,
    animations: [
        trigger('fadeInOut', [
            transition(':enter', [
                style({ opacity: 0, transform: 'translateY(-20px)' }),
                animate('400ms ease-in-out', style({ opacity: 1, transform: 'translateY(0)' }))
            ])
        ])
    ]
})
export class ManagementComponent implements OnInit, OnDestroy {

  // ====================================
  // PROPIEDADES PÚBLICAS - DATOS
  // ====================================
  selectedUser: User | undefined;
  users: User[] = [];
  userToEdit: ExtendedUser | null = null;
  targets: Target[] = [];
  targetsList: any[] = [];
  targetsSelected: any[] = [];
  targetToEdit: any | null = null;
  selectedTargetForMap: any | null = null;
  selectedTargetStopTime: string | undefined = undefined;
  targetIdFromUrl: string | null = null;
  
  // ====================================
  // PROPIEDADES PARA CANCELACIÓN
  // ====================================
  cancelDialogVisible: boolean = false;
  targetToCancel: any | null = null;
  cancelForm = {
    reason: '',
    description: ''
  };
  cancelReasons = [
    { label: 'Vehículo vendido', value: 'vehicle_sold' },
    { label: 'Descontento con el servicio', value: 'service_dissatisfaction' },
    { label: 'Cliente saldó el préstamo', value: 'loan_paid_off' },
    { label: 'Renovación muy cara', value: 'renewal_too_expensive' },
    { label: 'Vehículo robado', value: 'vehicle_stolen' },
    { label: 'Vehículo en el taller', value: 'vehicle_in_shop' },
    { label: 'Cambio de Dispositivo', value: 'device_change' },
    { label: 'Cambio de Vehículo', value: 'vehicle_change' },
    { label: 'Dispositivo dañado', value: 'device_damaged' },
    { label: 'Sin razón específica', value: 'no_specific_reason' }
  ];

  // ====================================
  // PROPIEDADES PARA PERMISOS DE ROOT
  // ====================================
  isCurrentUserRoot: boolean = false;
  
  // Estado específico de carga de targets
  private loadingTargets: boolean = false;
  private targetsLoadCompletedFlag: boolean = false;
  
  // Propiedades para scroll infinito de targets
  private currentOffset: number = 0;
  private readonly pageSize: number = 30;
  private hasMoreTargets: boolean = true;
  private loadingMoreTargets: boolean = false;
  private totalTargetsCount: number = 0;

  // Propiedades para scroll infinito de usuarios
  private currentUsersOffset: number = 0;
  private readonly usersPageSize: number = 30;
  private hasMoreUsers: boolean = true;
  private loadingMoreUsers: boolean = false;
  private totalUsersCount: number = 0;

  // Getters para el template
  get isLoadingMoreTargets(): boolean {
    return this.loadingMoreTargets;
  }

  get hasMoreTargetsToLoad(): boolean {
    return this.hasMoreTargets;
  }

  get totalTargetsCountDisplay(): number {
    return this.totalTargetsCount;
  }

  // Getters para usuarios
  get isLoadingMoreUsers(): boolean {
    return this.loadingMoreUsers;
  }

  get hasMoreUsersToLoad(): boolean {
    return this.hasMoreUsers;
  }

  get totalUsersCountDisplay(): number {
    return this.totalUsersCount;
  }
  
  // ====================================
  // PROPIEDADES PÚBLICAS - BÚSQUEDA
  // ====================================
  searchUsersTerm: string = '';
  searchTargetsTerm: string = '';
  
  // Propiedad local para el ngModel del select de mapas
  currentMapSelection: string = 'mapbox-light';
  
  // ====================================
  // PROPIEDADES PÚBLICAS - TRADUCCIONES
  // ====================================
  translations = {
    users: 'management.users.title',
    targets: 'management.targets',
    searchUsers: 'management.searchUsers',
    searchTargets: 'management.searchTargets',
    newUser: 'management.newUser',
    newTarget: 'management.newTarget',
    showMap: 'management.showMap',
    back: 'management.back'
  };

  // ====================================
  // MÉTODOS PÚBLICOS - UTILIDADES
  // ====================================
  
  /**
   * Determina si un usuario es compartido basándose en profile_type_id
   * @param user Usuario a verificar
   * @returns true si el usuario es compartido
   */
  isSharedUser(user: User): boolean {
    return user.profile_type_id === 'compartido';
  }

  // ====================================
  // PROPIEDADES PÚBLICAS - DELEGADAS A SERVICIOS
  // ====================================
  
  // UI State (delegado a ManagementUIService)
  get loading(): boolean { return this.uiService.isLoading(); }
  get loadingTargetsState(): boolean { return this.loadingTargets; }
  get targetsLoadCompleted(): boolean { return this.targetsLoadCompletedFlag; }
  get userFormDisplay(): boolean { return this.uiService.isUserFormVisible(); }
  get targetFormDisplay(): boolean { return this.uiService.isTargetFormVisible(); }
  get showMaps(): boolean { return this.uiService.areMapsVisible(); }
  get isUserSearchActive(): boolean { return this.isSearchingUsers; }
  get isTargetSearchActive(): boolean { return this.isSearchingTargets; }

  // Mobile/responsive state
  isMobileView: boolean = false;
  showMobileMapFullscreen: boolean = false;

  // Map Provider (delegado a MapProviderService)
  get selectedMap(): string { return this.mapProviderService.selectedMap; }
  get providerType(): 'google' | 'mapbox' { return this.mapProviderService.providerType; }
  get providerTheme(): 'light' | 'dark' { return this.mapProviderService.providerTheme; }
  get mapsKey(): string | null { return this.mapProviderService.mapsKey; }

  // Breadcrumb (delegado a BreadcrumbService)
  get items(): MenuItem[] { return this.breadcrumbService.getItems(); }
  get home(): MenuItem { return this.breadcrumbService.getHome(); }

  // Target selection helpers
  get currentTargetFromUrl(): string | null { return this.targetIdFromUrl; }
  
  isTargetSelectedFromUrl(targetId: string): boolean {
    return this.targetIdFromUrl === targetId;
  }

  // ====================================
  // PROPIEDADES PRIVADAS - SUSCRIPCIONES
  // ====================================
  private subscriptions: Subscription[] = [];
  
  // ====================================
  // PROPIEDADES PRIVADAS - POLLING
  // ====================================
  private pollingInterval: any = null;
  private readonly POLLING_INTERVAL_MS = 10000; // 10 segundos
  
  // Estado para seguimiento de cambios de status de targets
  // (integrado en el polling principal de 10s, no requiere polling separado)
  private previousTargetsStatus: Map<string, string> = new Map(); // targetId -> status
  
  // ====================================
  // PROPIEDADES PRIVADAS - BÚSQUEDA
  // ====================================
  private searchUsersSubject = new Subject<string>();
  private isSearchingUsers = false;
  private searchTargetsSubject = new Subject<string>();
  private isSearchingTargets = false;

  // ====================================
  // CONSTRUCTOR
  // ====================================
  constructor(
    public router: Router,
    public route: ActivatedRoute,
    private status: StatusService,
    private authService: AuthService,
    private userService: UserService,
    public translate: TranslateService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    public managementService: ManagementService,
    private screenService: ScreenService,
    private targetsService: TargetsService,
    // Servicios especializados
    private mapProviderService: MapProviderService,
    private breadcrumbService: BreadcrumbService,
    private vehicleDataService: VehicleDataService,
    private uiService: ManagementUIService,
    private cdr: ChangeDetectorRef,
    private selectionService: SelectionService
  ) {}

  // ====================================
  // MÉTODOS DE VALIDACIÓN DE PRIVILEGIOS
  // ====================================
  
  // Métodos de validación de privilegios para usuarios
  canCreateUsers(): boolean {
    return this.authService.hasPrivilege('users', 'create');
  }

  canReadUsers(): boolean {
    return this.authService.hasPrivilege('users', 'read');
  }

  canUpdateUsers(): boolean {
    return this.authService.hasPrivilege('users', 'update');
  }

  canDeleteUsers(): boolean {
    return this.authService.hasPrivilege('users', 'delete');
  }

  // Métodos de validación de privilegios para devices (targets)
  canCreateDevices(): boolean {
    return this.authService.hasPrivilege('devices', 'create');
  }

  canReadDevices(): boolean {
    return this.authService.hasPrivilege('devices', 'read');
  }

  canUpdateDevices(): boolean {
    return this.authService.hasPrivilege('devices', 'update');
  }

  canDeleteDevices(): boolean {
    return this.authService.hasPrivilege('devices', 'delete');
  }

  // ====================================
  // MÉTODOS PARA PERMISOS DE ROOT
  // ====================================
  
  /**
   * Verifica si el usuario actual tiene permisos de root
   */
  checkCurrentUserRootStatus(): void {
    const currentUser = this.authService.getCurrentUser();
    this.isCurrentUserRoot = !!(currentUser?.root === true || String(currentUser?.root) === 'true');
    console.log('🔍 Verificando estado root del usuario:', {
      currentUser: currentUser?.name,
      isRoot: this.isCurrentUserRoot,
      rootValue: currentUser?.root
    });
  }

  /**
   * Elimina permanentemente un target (solo para usuarios root)
   */
  async deleteTarget(target: any): Promise<void> {
    if (!this.isCurrentUserRoot) {
      console.warn('⚠️ Solo usuarios root pueden eliminar targets permanentemente');
      return;
    }

    console.log('🗑️ Iniciando eliminación permanente de target:', target);

    try {
      // Mostrar confirmación más estricta para eliminación permanente
      this.confirmationService.confirm({
        message: `¿Está seguro de que desea ELIMINAR PERMANENTEMENTE el target "${target.name}"? Esta acción no se puede deshacer.`,
        header: 'Confirmar eliminación permanente',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Sí, eliminar permanentemente',
        rejectLabel: 'Cancelar',
        acceptButtonStyleClass: 'p-button-danger',
        accept: async () => {
          try {
            // Llamar al servicio para eliminar
            console.log('📡 Ejecutando eliminación permanente...');
            await this.targetsService.deleteTarget(target._id);
            
            // Mostrar mensaje de éxito
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Target eliminado permanentemente'
            });

            // Actualizar la lista de targets
            if (this.selectedUser) {
              await this.loadTargetsForUser(this.selectedUser._id);
            }
            
            // Notificar que se han actualizado objetivos
            this.selectionService.notifyTargetsUpdated();

          } catch (error: any) {
            console.error('❌ Error al eliminar target:', error);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: error.message || 'Error al eliminar el target'
            });
          }
        }
      });

    } catch (error: any) {
      console.error('❌ Error en el proceso de eliminación:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Error al procesar la eliminación'
      });
    }
  }

  // ====================================
  // LIFECYCLE HOOKS
  // ====================================
  
  ngOnInit(): void {
    // Sincronizar la selección actual con el servicio
    this.currentMapSelection = this.mapProviderService.selectedMap;
    
    // Verificar permisos de root del usuario actual
    this.checkCurrentUserRootStatus();
    
    this.checkMobileView();
    this.setupInitialState();
    this.setupSubscriptions();
    this.setupSelectionWatcher();
    this.setupRouting();
    this.loadInitialData();
    // Nota: El status polling ahora está integrado en el polling principal de 10s

    // Verificar si hay datos de instalación de dispositivo en sessionStorage
    this.checkDeviceInstallationData();
  }

  ngOnDestroy(): void {
    this.cleanupSubscriptions();
    this.stopPolling();
    // Nota: El status polling ahora está integrado en el polling principal
    
    // Limpiar subjects
    this.searchUsersSubject.complete();
    this.searchTargetsSubject.complete();
    
    // Limpiar timeout del scroll infinito
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
  }

  // ====================================
  // EVENT HANDLERS
  // ====================================
  
  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.uiService.updateScreenSize();
    this.checkMobileView();
  }

  private checkMobileView(): void {
    const previousMobileView = this.isMobileView;
    this.isMobileView = window.innerWidth <= 760; // Cambio a 760px para coincidir con CSS
    
    // Si cambió de escritorio a móvil, ocultar el mapa full screen
    if (!previousMobileView && this.isMobileView) {
      this.showMobileMapFullscreen = false;
    }
    
    // Si cambió de móvil a escritorio y hay target seleccionado, asegurar que maps esté visible
    if (previousMobileView && !this.isMobileView && this.selectedTargetForMap && !this.uiService.areMapsVisible()) {
      this.uiService.toggleMaps();
    }
  }

  // ====================================
  // DEVICE INSTALLATION FROM INVENTORY
  // ====================================
  
  private checkDeviceInstallationData(): void {
    try {
      const deviceInstallationDataStr = sessionStorage.getItem('deviceInstallationData');
      
      if (deviceInstallationDataStr) {
        const deviceInstallationData = JSON.parse(deviceInstallationDataStr);
        console.log('📦 Datos de instalación encontrados en sessionStorage:', deviceInstallationData);
        
        // Verificar que los datos no sean muy antiguos (máximo 1 hora)
        const timestamp = new Date(deviceInstallationData.timestamp);
        const now = new Date();
        const diffInHours = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60);
        
        if (diffInHours > 1) {
          console.log('⏰ Datos de instalación expirados (más de 1 hora), limpiando sessionStorage');
          sessionStorage.removeItem('deviceInstallationData');
          return;
        }
        
        // Verificar que estamos en el usuario correcto
        const currentUserId = this.getCurrentUserId();
        if (currentUserId && currentUserId === deviceInstallationData.userId) {
          console.log('✅ Usuario coincide, abriendo formulario de target automáticamente');
          
          // Esperar un poco para que se carguen los datos del usuario
          setTimeout(() => {
            this.openTargetFormWithDeviceData(deviceInstallationData);
          }, 1000);
        } else {
          console.log('❌ Usuario no coincide o no está definido, manteniendo datos en sessionStorage');
          console.log('Current User ID:', currentUserId);
          console.log('Expected User ID:', deviceInstallationData.userId);
        }
      }
    } catch (error) {
      console.error('❌ Error al verificar datos de instalación:', error);
      sessionStorage.removeItem('deviceInstallationData');
    }
  }

  private openTargetFormWithDeviceData(deviceData: any): void {
    // Cambiar a vista de targets
    this.setOp('t');
    
    // Esperar un poco para que se complete el cambio de vista y se carguen los datos
    setTimeout(() => {
      this.openTargetFormWithData(deviceData);
    }, 1000);
  }

  private openTargetFormWithData(deviceData: any): void {
    // Preparar datos pre-cargados para el formulario
    const preloadedTargetData = {
      device_imei: deviceData.imei,
      sim_card_number: deviceData.sim,
      type: deviceData.protocol._id, // Usar solo el _id del protocolo
      status: 'active',
      // Otros campos pueden ser pre-cargados según sea necesario
    };
    
    console.log('🎯 Datos pre-cargados para el formulario de target:', preloadedTargetData);
    console.log('📋 Datos del dispositivo a instalar:', {
      imei: deviceData.imei,
      sim: deviceData.sim,
      protocol: deviceData.protocol,
      protocolId: deviceData.protocol._id
    });
    
    // Mostrar el formulario de target con datos pre-cargados
    this.showTargetForm(preloadedTargetData);
    
    // Limpiar sessionStorage después de usar los datos
    sessionStorage.removeItem('deviceInstallationData');
    console.log('🧹 Datos de instalación limpiados de sessionStorage');
  }

  hideMobileMapFullscreen(): void {
    this.showMobileMapFullscreen = false;
    
    // IMPORTANTE: Mantener showMaps en true para que el mapa siga disponible
    // Solo cambiar el estado de pantalla completa, no ocultar los mapas completamente
    
    this.cdr.detectChanges(); // Forzar detección de cambios
  
  }

  get mapDisplayStyle(): string {
    // En móvil: mostrar solo si está en modo pantalla completa
    // En escritorio: siempre mostrar
    if (this.isMobileView) {
      return this.showMobileMapFullscreen ? 'block' : 'none';
    } else {
      return 'block'; // En escritorio siempre visible
    }
  }

  window = window; // Para acceder a window desde el template

  // ====================================
  // MÉTODOS PÚBLICOS - NAVEGACIÓN
  // ====================================
  
  goToParent() {
    if (this.selectedUser) {
        const managementState: any = this.status.getState('management');
      this.breadcrumbService.navigateToParent(managementState);
    }
  }

  canNavigateBack(): boolean {
    const managementState: any = this.status.getState('management');
    return this.breadcrumbService.canNavigateBack(managementState);
  }

  enterUser(user: User) {
    this.managementService.setOp('u', user._id);
  }

  setOp(op: string) {
    // Obtener la operación actual antes del cambio
    const currentOp = this.managementService.getOp();
    const currentUserId = this.managementService.getCurrentUserId();
    
    // Limpiar selección si se cambia de targets a otra sección
    if (currentOp === 't' && op !== 't') {
      this.targetsSelected = [];
      this.selectionService.clearSelection();
    }
    
    // Solo actualizar la operación en el servicio, sin recargar datos
    this.managementService.setOp(op);
    
    // Si cambia a targets, verificar si necesita cargar datos
    // Solo cargar si no hay datos O si cambió el usuario desde la última carga
    if (op === 't' && this.selectedUser) {
      const hasNoTargets = this.targetsList.length === 0;
      const userChanged = currentUserId !== this.selectedUser._id;
      
      if (hasNoTargets || userChanged) {
        this.targetsLoadCompletedFlag = false; // Solo aquí, cuando realmente se van a cargar datos
        this.loadTargetsForUser(this.selectedUser._id);
      } 
    }
    
    // Si cambia a usuarios, verificar si necesita cargar datos
    if (op === 'u' && this.selectedUser) {
      const hasNoUsers = this.users.length === 0;
      const userChanged = currentUserId !== this.selectedUser._id;
      
      if (hasNoUsers || userChanged) {
        this.loadUsersForUser(this.selectedUser._id);
      }
    }
  }

  // ====================================
  // MÉTODOS PÚBLICOS - BÚSQUEDA
  // ====================================
  
  searchUser() {
    // Actualizar el término en el servicio de management para mantener la URL sincronizada
    this.managementService.setSearchUsersTerm(this.searchUsersTerm);
    this.managementService.searchUser();
    
    // Ejecutar búsqueda con debounce a través del subject
    this.searchUsersSubject.next(this.searchUsersTerm);
  }

  clearUserSearch() {
    this.searchUsersTerm = '';
    this.managementService.setSearchUsersTerm('');
    this.searchUsersSubject.next('');
  }

  clearTargetSearch() {
    this.searchTargetsTerm = '';
    this.managementService.setSearchTargetsTerm('');
    this.searchTargetsSubject.next('');
  }

  searchTargets() {
    // Actualizar el término en el servicio de management para mantener la URL sincronizada
    this.managementService.setSearchTargetsTerm(this.searchTargetsTerm);
    this.managementService.searchTargets();
    
    // Ejecutar búsqueda con debounce a través del subject
    this.searchTargetsSubject.next(this.searchTargetsTerm);
  }

  // ====================================
  // MÉTODOS PÚBLICOS - UI STATE
  // ====================================
  
  showMapsToggle() {
    // Si los mapas están visibles, al ocultarlos quitamos el parámetro target de la URL
    if (this.uiService.areMapsVisible()) {
      this.removeTargetFromUrl();
      this.selectedTargetForMap = null;
      this.targetIdFromUrl = null;
    }
    
    this.uiService.toggleMaps();
  }

  get shouldShowMapToggleButton(): boolean {
    return true; // Siempre mostrar el botón del mapa, independientemente de si hay targets
  }

  // ====================================
  // MÉTODOS PÚBLICOS - MAPAS
  // ====================================
  
  onMapProviderChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const value = target.value;
    this.setMapProvider(value);
  }
  
  async setMapProvider(value: string): Promise<void> {
 
    
    const newKey = await this.mapProviderService.changeProviderWithRecreation(value);
    
  
    
    // Forzar detección de cambios
    this.cdr.detectChanges();
  }

  // Método para manejar cambios del ngModel
  onMapSelectionChange(value: string): void {
    this.setMapProvider(value);
  }

  // ====================================
  // MÉTODOS PÚBLICOS - GESTIÓN DE USUARIOS
  // ====================================
  
  showUserForm() {
    // Validar permisos antes de permitir crear usuarios
    if (!this.canCreateUsers()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('management.users.no_create_permission'),
        detail: this.translate.instant('management.users.contact_admin')
      });
      return;
    }

    this.uiService.showUserForm();
  }

  editUser(user: User) {
    // Validar permisos antes de permitir editar usuarios
    if (!this.canUpdateUsers()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('management.users.no_update_permission'),
        detail: this.translate.instant('management.users.contact_admin')
      });
      return;
    }

    this.userToEdit = convertToExtendedUser(user);
    this.uiService.showUserForm();
  }

  onHideUserForm() {
    this.uiService.hideUserForm();
    this.userToEdit = null;
  }

  onUserCreated() {
    this.uiService.hideUserForm();
    this.userToEdit = null;
    
    if (this.selectedUser) {
      this.loadUsersForUser(this.selectedUser._id);
    }
  }

  confirmDeleteUser(user: User) {
    // Validar permisos antes de permitir eliminar usuarios
    if (!this.canDeleteUsers()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('management.users.no_delete_permission'),
        detail: this.translate.instant('management.users.contact_admin')
      });
      return;
    }

    this.confirmationService.confirm({
      message: this.translate.instant('management.confirmDeleteUser'),
      header: this.translate.instant('management.userForm.confirmDeleteHeader'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('management.userForm.yes'),
      rejectLabel: this.translate.instant('management.userForm.no'),
      accept: () => {
        this.deleteUser(user);
      }
    });
  }

  // ====================================
  // MÉTODOS PÚBLICOS - GESTIÓN DE TARGETS
  // ====================================
  
  async showTargetForm(target?: any) {
    // Validar permisos antes de permitir crear/editar targets
    if (target && !this.canUpdateDevices()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('management.devices.no_update_permission'),
        detail: this.translate.instant('management.devices.contact_admin')
      });
      return;
    }
    
    if (!target && !this.canCreateDevices()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('management.devices.no_create_permission'),
        detail: this.translate.instant('management.devices.contact_admin')
      });
      return;
    }

    this.targetToEdit = target || null;
    this.uiService.showTargetForm();
  }

  onHideTargetForm() {
    this.uiService.hideTargetForm();
    this.targetToEdit = null;
  }

  onTargetCreated() {
    this.uiService.hideTargetForm();
    this.targetToEdit = null;
    
    if (this.selectedUser) {
      this.loadTargetsForUser(this.selectedUser._id);
    }
  }

  handleTargetClick(target: any, event: MouseEvent) {
    if (event.ctrlKey) {
      this.openTargetInNewTab(target);
    } else {
      // Click normal: agregar el query parameter 'target' a la URL actual
      this.addTargetToUrl(target);
      
      // Si el target es diferente al actual, cambiar selección y actualizar polling
      if (!this.selectedTargetForMap || this.selectedTargetForMap._id !== target._id) {
        this.stopPolling();
        
        // ✅ REINICIAR tiempo de parada cuando se cambia de target
        this.selectedTargetStopTime = undefined;
        
        this.selectedTargetForMap = target;
        this.startPolling();
        
        // Scroll automático hacia el target seleccionado
        this.scrollToSelectedTarget();
      }

      // En vista móvil, mostrar el mapa en pantalla completa
      if (this.isMobileView) {
        // Asegurar que los mapas estén visibles
        if (!this.uiService.areMapsVisible()) {
          this.uiService.toggleMaps();
        }
        
        this.showMobileMapFullscreen = true;
        this.cdr.detectChanges(); // Forzar detección de cambios
     
        

      }
    }
  }

  private addTargetToUrl(target: any) {
    const currentUserId = this.selectedUser?._id;
    if (currentUserId) {
      // Navegar a la misma ruta pero agregando el query parameter 'target'
      this.router.navigate(
        ['/admin/management', this.managementService.getOp(), currentUserId],
        { 
          queryParams: { target: target._id },
          queryParamsHandling: 'merge' // Mantener otros query params existentes
        }
      );
    }
  }

  private removeTargetFromUrl() {
    const currentUserId = this.selectedUser?._id;
    if (currentUserId) {
      // Navegar a la misma ruta pero quitando el query parameter 'target'
      this.router.navigate(
        ['/admin/management', this.managementService.getOp(), currentUserId],
        { 
          queryParams: { target: null },
          queryParamsHandling: 'merge' // Mantener otros query params existentes
        }
      );
    }
  }

  openTargetInNewTab(target: any) {
    const currentUserId = this.selectedUser?._id;
    if (currentUserId) {
      const url = this.router.serializeUrl(
        this.router.createUrlTree(['/admin/management/user', currentUserId], {
          queryParams: { target: target._id }
        })
      );
      window.open(url, '_blank');
    }
  }

  async loadTargetDetails(target: any) {
    try {
      const targetDetails = await this.targetsService.getTargetById(target._id);
      
      this.messageService.add({
        severity: 'info',
        summary: `Datos de ${targetDetails.name}`,
        detail: `IMEI: ${targetDetails.device_imei || targetDetails.imei} | Estado: ${targetDetails.traccarInfo?.status || 'desconocido'}`,
        life: 5000
      });
      
    } catch (error) {
      console.error('Error al obtener datos del target:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudieron obtener los datos del dispositivo',
        life: 3000
      });
    }
  }



  /**
   * Cambia la URL para navegar al usuario padre del target
   * @param target Target con parent_id diferente al usuario actual
   */
  navigateToParentUser(target: any) {
    // Buscar parent_id en el target principal o en originalTarget
    const originalTarget = target.originalTarget || target;
    const parentId = target.parent_id || target.parentId || target.user_id ||
                    originalTarget.parent_id || originalTarget.parentId || originalTarget.user_id;
    
    if (parentId) {
      // Obtener el parámetro 'op' actual para mantenerlo en la navegación
      const currentOp = this.route.snapshot.params['op'] || 't';
      
      // Construir la URL completa con parámetros de consulta actuales
      const currentQueryParams = this.route.snapshot.queryParams;
      const queryString = new URLSearchParams(currentQueryParams).toString();
      const newUrl = `/admin/management/${currentOp}/${parentId}${queryString ? '?' + queryString : ''}`;
  
      
      // Abrir en nueva pestaña manteniendo todos los parámetros
      window.open(newUrl, '_blank');
    } else {
      console.error('❌ No se encontró parent_id/parentId/user_id en el target ni en originalTarget:', {
        target: target,
        originalTarget: originalTarget
      });
    }
  }

  /**
   * Obtiene el ID del usuario actual desde la URL
   * @returns El ID del usuario actual o null si no existe
   */
  getCurrentUserId(): string | null {
    // El routing es /:op/:user, así que 'user' es el segundo parámetro
    const userId = this.route.snapshot.params['user'];
    
    // Log simplificado para debugging
    
    // Si no hay userId en params, intentar desde selectedUser
    return userId || this.selectedUser?._id || null;
  }

  /**
   * Verifica si el target pertenece a un usuario diferente al actual
   * @param target Target a verificar
   * @returns true si el parent_id es diferente al usuario actual
   */
  shouldShowParentUserButton(target: any): boolean {
    const currentUserId = this.getCurrentUserId();
    
    // Buscar parent_id en el target principal o en originalTarget
    const originalTarget = target.originalTarget || target;
    const targetParentId = target.parent_id || target.parentId || target.user_id ||
                          originalTarget.parent_id || originalTarget.parentId || originalTarget.user_id;
    
    // Log simplificado para debugging cuando sea necesario
  
    
    return !!(targetParentId && currentUserId && targetParentId !== currentUserId);
  }

  // ====================================
  // MÉTODOS PÚBLICOS - DATOS DE VEHÍCULOS (DELEGADOS)
  // ====================================
  
  public getVehicleTypeByModelId(modelId: string): string {
    return this.vehicleDataService.getVehicleTypeByModelId(modelId);
  }

  public getDeviceSpeed(target: any): string {
    return this.vehicleDataService.getDeviceSpeed(target);
  }

  public formatSpeedDisplay(speedInKmh: number): string {
    return this.vehicleDataService.formatSpeedDisplay(speedInKmh);
  }

  // ====================================
  // MÉTODOS PRIVADOS - INICIALIZACIÓN
  // ====================================
  
  private setupInitialState(): void {
    this.uiService.setLoading(true);
    this.screenService.checkScreenSize();
    this.uiService.updateScreenSize();
  }

  private setupSubscriptions(): void {
    // Suscribirse a notificaciones de actualización de targets (ej: cuando se restaura un target)
    this.subscriptions.push(
      this.selectionService.targetsUpdated$.subscribe(updated => {
        if (updated && this.selectedUser) {
          console.log('🔄 Targets actualizados desde navbar, recargando lista...');
          this.loadTargetsForUser(this.selectedUser._id);
        }
      })
    );

    // Suscribirse a cambios de UI state
    this.subscriptions.push(
      this.uiService.uiState$.subscribe(uiState => {
        // Reaccionar a cambios de estado si es necesario
      })
    );

    // Suscribirse a cambios responsive
    this.subscriptions.push(
      this.uiService.responsiveState$.subscribe(responsiveState => {
        this.uiService.autoShowMapsIfMobileAndHasTargets(this.targetsList.length > 0);
      })
    );

    // Configurar búsqueda de usuarios con debounce
    this.subscriptions.push(
      this.searchUsersSubject.pipe(
        debounceTime(300), // Esperar 300ms después de que el usuario deje de escribir
        distinctUntilChanged(), // Solo buscar si el término cambió
        switchMap(searchTerm => {
          if (searchTerm.trim() === '') {
            // Si no hay término de búsqueda, cargar usuarios normales con paginación
            this.isSearchingUsers = false;
            if (this.selectedUser) {
              // Resetear paginación y cargar usuarios con scroll infinito
              this.currentUsersOffset = 0;
              this.hasMoreUsers = true;
              this.users = [];
              return this.userService.getAllWithPagination(this.selectedUser._id, 0, this.usersPageSize);
            }
            return from([{ users: [], totalCount: 0 }]);
          } else {
            // Realizar búsqueda con paginación
            this.isSearchingUsers = true;
            // Resetear paginación para búsqueda
            this.currentUsersOffset = 0;
            this.hasMoreUsers = true;
            this.users = [];
            return this.userService.search(searchTerm, this.selectedUser?._id, 0, this.usersPageSize);
          }
        })
      ).subscribe({
        next: (response) => {
          // Siempre recibimos un objeto con users y totalCount
          this.users = response.users;
          this.totalUsersCount = response.totalCount;
          this.hasMoreUsers = this.users.length < this.totalUsersCount;
        },
        error: (error) => {
          console.error('❌ Error en búsqueda de usuarios:', error);
      this.messageService.add({
            severity: 'error',
            summary: 'Error de búsqueda',
            detail: 'No se pudieron buscar los usuarios',
            life: 3000
          });
        }
      })
    );

    // Configurar búsqueda de targets con debounce
    this.subscriptions.push(
      this.searchTargetsSubject.pipe(
        debounceTime(300), // Esperar 300ms después de que el usuario deje de escribir
        distinctUntilChanged(), // Solo buscar si el término cambió
        switchMap(searchTerm => {
          if (searchTerm.trim() === '') {
            // Si no hay término de búsqueda, cargar targets normales con paginación
            this.isSearchingTargets = false;
            if (this.selectedUser) {
              // Resetear paginación y cargar targets con scroll infinito
              this.currentOffset = 0;
              this.hasMoreTargets = true;
              this.targets = [];
      const parentId = this.managementService.getCurrentUserId();
              return from(this.targetsService.getTargetsByUserId(this.selectedUser._id, parentId, 0, this.pageSize)).pipe(
                switchMap(response => from([{ devices: response.devices, totalCount: response.totalCount }]))
              );
            }
            return from([{ devices: [], totalCount: 0 }]);
          } else {
            // Realizar búsqueda con paginación
            this.isSearchingTargets = true;
            // Resetear paginación para búsqueda
            this.currentOffset = 0;
            this.hasMoreTargets = true;
            this.targets = [];
            const parentId = this.managementService.getCurrentUserId();
            return from(this.targetsService.searchTargets(searchTerm, parentId, 0, this.pageSize));
          }
        })
      ).subscribe({
        next: (response) => {
          // Siempre recibimos un objeto con devices y totalCount
          this.targets = response.devices;
          this.totalTargetsCount = response.totalCount;
          this.hasMoreTargets = this.targets.length < this.totalTargetsCount;
          
          // Transformar targets para la lista
          if (this.targets && this.targets.length > 0) {
            this.targetsList = this.targets.map((target: Target) => {
              const traccarStatus = target.traccarInfo?.status || 'offline';
              const isOnline = traccarStatus === 'online';
              
              return {
              name: target.name,
                status: isOnline ? this.translate.instant('management.status.online') : this.translate.instant('management.status.offline'),
                imei: target.device_imei || target.imei,
                sim: target.sim_card_number || target.sim_card,
                _id: target._id,
                traccarStatus: traccarStatus,
                traccarInfo: target.traccarInfo,
                originalTarget: target
              };
            });
          } else {
            this.targetsList = [];
          }
          
          
          // Actualizar estado de polling después de búsqueda/carga
          this.initializePreviousTargetsStatus();
          
          // Iniciar polling si hay targets y aún no está activo
          if (this.targets.length > 0 && !this.pollingInterval) {
            this.startPolling();
          }
        },
        error: (error) => {
          console.error('❌ Error en búsqueda de targets:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error de búsqueda',
            detail: 'No se pudieron buscar los dispositivos',
            life: 3000
          });
        }
      })
    );
  }

  private setupRouting(): void {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      this.router.navigate(['auth/login']); 
      return;
    }

    // Configurar suscripciones a parámetros de ruta
    this.subscriptions.push(
      this.route.params.subscribe(params => {
        this.handleRouteParams(params, currentUser);
      })
    );

    // Configurar suscripciones a query parameters
    this.subscriptions.push(
      this.route.queryParams.subscribe(queryParams => {
        this.handleQueryParams(queryParams);
      })
    );
  }

  private async loadInitialData(): Promise<void> {
    // Cargar datos de vehículos en segundo plano
    await this.vehicleDataService.loadVehicleData();
  }

  private cleanupSubscriptions(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
  }

  /**
   * Configura el observador para cambios en la selección de targets
   */
  private setupSelectionWatcher(): void {
    // Usar un polling simple para detectar cambios en targetsSelected
    // Ya que PrimeNG no emite eventos específicos para cambios de selección
    let previousSelectionLength = 0;
    
    setInterval(() => {
      const currentSelectionLength = this.targetsSelected?.length || 0;
      
      if (currentSelectionLength !== previousSelectionLength) {
        this.onTargetsSelectionChange();
        previousSelectionLength = currentSelectionLength;
      }
    }, 100); // Verificar cada 100ms
  }

  /**
   * Maneja cambios en la selección de targets
   */
  onTargetsSelectionChange(): void {
    // Actualizar el servicio de selección con los targets seleccionados
    this.selectionService.updateSelectedTargets(this.targetsSelected || []);
    
    console.log('🔄 Selección de targets actualizada:', {
      count: this.targetsSelected?.length || 0,
      targets: this.targetsSelected?.map(t => ({ id: t._id, name: t.name })) || []
    });
  }

  // ====================================
  // MÉTODOS PRIVADOS - ROUTING
  // ====================================
  
  private handleRouteParams(params: any, currentUser: any): void {
    const newUserId = params['user'];
    const currentSelectedUserId = this.selectedUser?._id;
    
    // Solo cargar datos del usuario si realmente cambió
    if (newUserId && newUserId !== currentSelectedUserId) {
      this.loadUserFromParams(newUserId);
    } else if (!newUserId && !this.selectedUser) {
      this.loadUserFromState(currentUser);
    } 
    
    this.managementService.verifyURLStatus(params);
  }

  private handleQueryParams(queryParams: any): void {
    if (this.managementService.getOp() === 'u') {
      this.searchUsersTerm = queryParams['search'];
    } else if (this.managementService.getOp() === 't') {
      this.searchTargetsTerm = queryParams['search'];
    }

    // Si hay un parámetro 'target' en la URL, mostrar automáticamente los mapas y seleccionar el target
    if (queryParams['target']) {
      this.uiService.showMaps();
      this.selectTargetFromUrl(queryParams['target']);
      
      // Si estamos en móvil, activar también el mapa en pantalla completa
      if (this.isMobileView) {
        this.showMobileMapFullscreen = true;
      }
    } else {
      // Si no hay target en la URL, limpiar la selección y detener polling
      this.targetIdFromUrl = null;
      this.selectedTargetForMap = null;
      this.stopPolling();
    }
  }

  private selectTargetFromUrl(targetId: string): void {
    this.targetIdFromUrl = targetId;
    
    // Si ya tenemos la lista de targets cargada, seleccionar inmediatamente
    if (this.targetsList && this.targetsList.length > 0) {
      this.findAndSelectTarget(targetId);
    }
    // Si no, el target se seleccionará cuando se cargue la lista en loadTargetsForUser
  }

  private findAndSelectTarget(targetId: string): void {
    const target = this.targetsList.find(t => t._id === targetId);
    if (target) {
      // Detener polling anterior si existe
      this.stopPolling();
      
      // ✅ REINICIAR tiempo de parada cuando se selecciona target desde URL
      this.selectedTargetStopTime = undefined;
      
      this.selectedTargetForMap = target;
      
      // Iniciar polling para el nuevo target seleccionado
      this.startPolling();
      
      // Scroll automático hacia el target seleccionado
      this.scrollToSelectedTarget();
    } else {
      console.warn('⚠️ Target no encontrado en la lista:', targetId);
    }
  }

  private loadUserFromParams(userId: string): void {
    this.managementService.loadUserData(userId)
      .then(user => {
        this.handleUserLoaded(user);
      })
      .catch(() => {
        this.uiService.setLoading(false);
      });
  }

  private loadUserFromState(currentUser: any): void {
    const managementState: any = this.status.getState('management');
    const storedUserId = managementState?.url_route ? managementState.url_route[2] : null;
    
    if (storedUserId) {
      this.loadUserFromParams(storedUserId);
    } else {
      this.loadUserFromParams(currentUser.id);
    }
  }

  private handleUserLoaded(user: User): void {
    this.selectedUser = user;
    // Limpiar datos anteriores y resetear bandera de carga completada
    this.targetsList = [];
    this.targets = [];
    this.targetsSelected = [];
    this.targetsLoadCompletedFlag = false;
    
    // Limpiar selección cuando se cambia de usuario
    this.selectionService.clearSelection();
    
    // ✅ REINICIAR tiempo de parada cuando se cambia de usuario
    this.selectedTargetStopTime = undefined;
    this.selectedTargetForMap = null;
    
    // Limpiar input de búsqueda de usuarios al cambiar de usuario
    this.searchUsersTerm = '';
    
    this.loadUserPath(user._id);
    this.loadUsersForUser(user._id);
    this.loadTargetsForUser(user._id);
  }

  // ====================================
  // MÉTODOS PRIVADOS - GESTIÓN DE DATOS
  // ====================================
  
  /**
   * Calcula el tiempo transcurrido desde la última actualización y formatea la fecha
   * @param lastUpdate Fecha de la última actualización
   * @returns Objeto con el tiempo transcurrido y la fecha formateada
   */
  private calculateOfflineTime(lastUpdate: string | Date): { timeText: string; dateText: string } {
    try {
      const lastUpdateDate = new Date(lastUpdate);
      const now = new Date();
      const diffInMs = now.getTime() - lastUpdateDate.getTime();
      
      // Verificar que la fecha sea válida
      if (isNaN(lastUpdateDate.getTime())) {
        return { timeText: 'Fecha inválida', dateText: 'Fecha inválida' };
      }
      
      // Verificar que no sea una fecha futura
      if (diffInMs < 0) {
        return { timeText: 'Fecha futura', dateText: 'Fecha futura' };
      }
      
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
      const diffInWeeks = Math.floor(diffInDays / 7);
      const diffInMonths = Math.floor(diffInDays / 30);
      const diffInYears = Math.floor(diffInDays / 365);
      
      // Formatear tiempo transcurrido
      let timeText = '';
      if (diffInYears > 0) {
        timeText = `Fuera de línea hace ${diffInYears} año${diffInYears > 1 ? 's' : ''}`;
      } else if (diffInMonths > 0) {
        timeText = `Fuera de línea hace ${diffInMonths} mes${diffInMonths > 1 ? 'es' : ''}`;
      } else if (diffInWeeks > 0) {
        timeText = `Fuera de línea hace ${diffInWeeks} semana${diffInWeeks > 1 ? 's' : ''}`;
      } else if (diffInDays > 0) {
        timeText = `Fuera de línea hace ${diffInDays} día${diffInDays > 1 ? 's' : ''}`;
      } else if (diffInHours > 0) {
        timeText = `Fuera de línea hace ${diffInHours} hora${diffInHours > 1 ? 's' : ''}`;
      } else if (diffInMinutes > 0) {
        timeText = `Fuera de línea hace ${diffInMinutes} minuto${diffInMinutes > 1 ? 's' : ''}`;
      } else {
        timeText = 'Fuera de línea hace menos de 1 minuto';
      }
      
      // Formatear fecha de última ubicación
      const dateText = lastUpdateDate.toLocaleString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      
      return { timeText, dateText };
    } catch (error) {
      console.error('Error calculando tiempo offline:', error);
      return { timeText: 'Error calculando tiempo', dateText: 'Error en fecha' };
    }
  }
  
  private loadUserPath(userId: string): void {
    this.userService.getUserPath(userId).subscribe({
      next: (pathData) => {
        this.breadcrumbService.updateFromUserPath(pathData, this.selectedUser);
      },
      error: (error) => {
        console.error('Error al obtener ruta del usuario:', error);
        this.breadcrumbService.updateFromUserPath([], this.selectedUser);
      }
    });
  }

  private async loadUsersForUser(userId: string, resetPagination: boolean = true): Promise<void> {
    // Validar permisos antes de cargar usuarios
    if (!this.canReadUsers()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('management.users.no_permissions'),
        detail: this.translate.instant('management.users.contact_admin')
      });
      this.uiService.setLoading(false);
      return;
    }

    // Si hay un término de búsqueda activo, usar la búsqueda en lugar de cargar todos
    if (this.searchUsersTerm && this.searchUsersTerm.trim() !== '') {
      this.searchUsersSubject.next(this.searchUsersTerm);
      return;
    }

    console.log(`[USUARIOS] 📋 Cargando usuarios para user: ${userId} - resetPagination: ${resetPagination}`);
    
    try {
      // Resetear paginación si es necesario
      if (resetPagination) {
        this.currentUsersOffset = 0;
        this.hasMoreUsers = true;
        this.users = [];
      }
      
      // Obtener el usuario logueado
      const loggedUser = this.authService.getCurrentUser();
      const loggedUserId = loggedUser?.id;
      
      // Verificar si el usuario logueado es el mismo que está en la URL
      const shouldLoadSharedUsers = loggedUserId === userId;
      
      if (shouldLoadSharedUsers) {
        // Cargar usuarios normales con paginación y compartidos en paralelo
        const [usersResponse, sharedUsers] = await Promise.all([
          this.userService.getAllWithPagination(userId, this.currentUsersOffset, this.usersPageSize).toPromise(),
          this.userService.getSharedUsers().toPromise()
        ]);
        
        if (usersResponse) {
            // Unir las dos listas, eliminando duplicados por ID
          const allUsers = [...(usersResponse.users || [])];
            
            // Agregar usuarios compartidos que no estén ya en la lista
            (sharedUsers || []).forEach(sharedUser => {
              if (!allUsers.find(user => user._id === sharedUser._id)) {
                allUsers.push(sharedUser);
              }
            });

          // Agregar usuarios a la lista existente
          this.users = [...this.users, ...allUsers];
          this.totalUsersCount = usersResponse.totalCount;
          
          // Verificar si hay más usuarios disponibles
          this.hasMoreUsers = usersResponse.users.length === this.usersPageSize;
          this.currentUsersOffset += this.usersPageSize;
          
          console.log(`[USUARIOS] ✅ Usuarios cargados exitosamente:`, {
            totalEnLista: this.users.length,
            totalEnBD: this.totalUsersCount,
            hasMore: this.hasMoreUsers,
            offset: this.currentUsersOffset
          });
        }
      } else {
        // Solo cargar usuarios normales con paginación si no es el usuario logueado
        const usersResponse = await this.userService.getAllWithPagination(
          userId, 
          this.currentUsersOffset, 
          this.usersPageSize
        ).toPromise();
        
        if (usersResponse) {
          // Agregar usuarios a la lista existente
          this.users = [...this.users, ...usersResponse.users];
          this.totalUsersCount = usersResponse.totalCount;
          
          // Verificar si hay más usuarios disponibles
          this.hasMoreUsers = usersResponse.users.length === this.usersPageSize;
          this.currentUsersOffset += this.usersPageSize;
          
          console.log(`[USUARIOS] ✅ Usuarios cargados exitosamente:`, {
            totalEnLista: this.users.length,
            totalEnBD: this.totalUsersCount,
            hasMore: this.hasMoreUsers,
            offset: this.currentUsersOffset
          });
        }
      }
      
            this.uiService.setLoading(false);
    } catch (error) {
      console.error('❌ Error al cargar usuarios:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('management.error'),
        detail: 'Error al cargar usuarios'
      });
                this.uiService.setLoading(false);
              }
  }
  showNoTargetMessage = false;

  // Método para cargar más targets (scroll infinito)
  private async loadMoreTargets() {
    // Verificaciones de seguridad para evitar cargas múltiples
    if (!this.selectedUser || this.loadingMoreTargets || !this.hasMoreTargets || this.loadingTargets) {
      return;
    }

    console.log(`[SCROLL INFINITO] 🚀 Cargando más targets - offset: ${this.currentOffset}, hasMore: ${this.hasMoreTargets}`);
    
    this.loadingMoreTargets = true;
    try {
      let response;
      if (this.isSearchingTargets && this.searchTargetsTerm.trim() !== '') {
        // Si estamos en modo búsqueda, usar el endpoint de búsqueda
        const parentId = this.managementService.getCurrentUserId();
        response = await this.targetsService.searchTargets(
          this.searchTargetsTerm,
          parentId,
          this.currentOffset,
          this.pageSize
        );
      } else {
        // Si no estamos buscando, usar el endpoint normal
        await this.loadTargetsForUser(this.selectedUser._id, false);
        console.log(`[SCROLL INFINITO] ✅ Targets cargados exitosamente - total: ${this.targets.length}`);
        
        // Subir el scroll 300px después de cargar nuevos targets
        setTimeout(() => {
          this.scrollUpAfterLoad();
        }, 100);
        
        this.loadingMoreTargets = false;
        return;
      }

      if (response) {
        this.targets = [...this.targets, ...response.devices];
        this.totalTargetsCount = response.totalCount;
        this.hasMoreTargets = this.targets.length < this.totalTargetsCount;
        this.currentOffset += this.pageSize;

        // Transformar targets para la lista
        if (this.targets && this.targets.length > 0) {
          this.targetsList = this.targets.map((target: Target) => {
            const traccarStatus = target.traccarInfo?.status || 'offline';
            const isOnline = traccarStatus === 'online';
            
            return {
              name: target.name,
              _id: target._id,
              device_imei: target.device_imei,
              target_plate_number: (target as any).target_plate_number || target.plate,
              status: isOnline ? 'online' : 'offline',
              traccarInfo: target.traccarInfo,
              shared: (target as any).shared || [],
              isShared: ((target as any).shared || []).length > 0
            };
          });
        }

        console.log(`[SCROLL INFINITO] ✅ Cargados ${response.devices.length} targets más. Total: ${this.targets.length}/${this.totalTargetsCount}`);
      }
      
      // Subir el scroll 300px después de cargar nuevos targets
      setTimeout(() => {
        this.scrollUpAfterLoad();
      }, 100);
      
    } catch (error) {
      console.error('[SCROLL INFINITO] ❌ Error cargando más targets:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudieron cargar más dispositivos'
      });
    } finally {
      this.loadingMoreTargets = false;
    }
  }

  // Método para cargar más usuarios (scroll infinito)
  private async loadMoreUsers() {
    // Verificaciones de seguridad para evitar cargas múltiples
    if (!this.selectedUser || this.loadingMoreUsers || !this.hasMoreUsers) {
      return;
    }

    console.log(`[SCROLL INFINITO USUARIOS] 🚀 Cargando más usuarios - offset: ${this.currentUsersOffset}, hasMore: ${this.hasMoreUsers}`);
    
    this.loadingMoreUsers = true;
    try {
      let response;
      if (this.isSearchingUsers && this.searchUsersTerm.trim() !== '') {
        // Si estamos en modo búsqueda, usar el endpoint de búsqueda
        response = await this.userService.search(
          this.searchUsersTerm,
          this.selectedUser._id,
          this.currentUsersOffset,
          this.usersPageSize
        ).toPromise();
      } else {
        // Si no estamos buscando, usar el endpoint normal
        response = await this.userService.getAllWithPagination(
          this.selectedUser._id,
          this.currentUsersOffset,
          this.usersPageSize
        ).toPromise();
      }

      if (response) {
        this.users = [...this.users, ...response.users];
        this.totalUsersCount = response.totalCount;
        this.hasMoreUsers = this.users.length < this.totalUsersCount;
        this.currentUsersOffset += this.usersPageSize;

        console.log(`[SCROLL INFINITO USUARIOS] ✅ Cargados ${response.users.length} usuarios más. Total: ${this.users.length}/${this.totalUsersCount}`);
      }
      
      // Ajustar scroll después de cargar
      setTimeout(() => {
        this.scrollUpAfterLoad();
      }, 100);
    } catch (error) {
      console.error('[SCROLL INFINITO USUARIOS] ❌ Error al cargar más usuarios:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudieron cargar más usuarios'
      });
    } finally {
      this.loadingMoreUsers = false;
    }
  }

  // Método para subir el scroll después de cargar nuevos targets
  private scrollUpAfterLoad() {
    const scrollContainer = document.querySelector('.management__content-body');
    if (scrollContainer) {
      const currentScrollTop = scrollContainer.scrollTop;
      const newScrollTop = Math.max(0, currentScrollTop - 100);
      scrollContainer.scrollTo({
        top: newScrollTop,
        behavior: 'smooth'
      });
      console.log(`[SCROLL INFINITO] 📈 Scroll ajustado: ${currentScrollTop}px → ${newScrollTop}px`);
    }
  }

  // Método para hacer scroll automático hacia el target seleccionado
  private scrollToSelectedTarget() {
    if (!this.selectedTargetForMap) {
      return;
    }

    // Esperar un poco para que el DOM se actualice
    setTimeout(() => {
      const selectedTargetElement = document.querySelector('.target-selected-for-map');
      const scrollContainer = document.querySelector('.management__content-body');
      
      if (selectedTargetElement && scrollContainer) {
        const containerRect = scrollContainer.getBoundingClientRect();
        const targetRect = selectedTargetElement.getBoundingClientRect();
        
        // Calcular la posición relativa del target dentro del contenedor
        const targetTop = targetRect.top - containerRect.top + scrollContainer.scrollTop;
        const targetBottom = targetRect.bottom - containerRect.top + scrollContainer.scrollTop;
        const containerHeight = containerRect.height;
        
        // Calcular la posición de scroll para centrar el target
        const scrollPosition = targetTop - (containerHeight / 2) + (targetRect.height / 2);
        
        scrollContainer.scrollTo({
          top: Math.max(0, scrollPosition),
          behavior: 'smooth'
        });
        
        console.log(`[SCROLL TARGET] 🎯 Scroll hacia target seleccionado: ${this.selectedTargetForMap.name}`);
      }
    }, 100);
  }

  // Propiedad para controlar el debounce del scroll
  private scrollTimeout: any;

  // Método para detectar scroll y cargar más contenido
  onScroll(event: any) {
    // Limpiar timeout anterior si existe
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }

    // Aplicar debounce de 100ms para evitar múltiples llamadas
    this.scrollTimeout = setTimeout(() => {
      const element = event.target;
      const threshold = 150; // Aumentar threshold para evitar cargas prematuras
      
      // Verificar si estamos cerca del final y no estamos ya cargando
      if (element.scrollTop + element.clientHeight >= element.scrollHeight - threshold) {
        // Cargar más contenido según la operación actual
        if (this.managementService.getOp() === 't') {
          this.loadMoreTargets();
        } else if (this.managementService.getOp() === 'u') {
          this.loadMoreUsers();
        }
      }
    }, 100);
  }
  private async loadTargetsForUser(userId: string, resetPagination: boolean = true) {
    // Validar permisos antes de cargar targets/devices
    if (!this.canReadDevices()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('management.devices.no_permissions'),
        detail: this.translate.instant('management.devices.contact_admin')
      });
      this.loadingTargets = false;
      this.targetsLoadCompletedFlag = true;
      return;
    }

    // Si hay un término de búsqueda activo, usar la búsqueda en lugar de cargar todos
    if (this.searchTargetsTerm && this.searchTargetsTerm.trim() !== '') {
      this.searchTargetsSubject.next(this.searchTargetsTerm);
      return;
    }

    try {
      // Resetear paginación si es necesario
      if (resetPagination) {
        this.currentOffset = 0;
        this.hasMoreTargets = true;
        this.targets = [];
      }
      
      const parentId = this.managementService.getCurrentUserId();
      this.loadingTargets = true;
      
      // Cargar targets propios y compartidos en paralelo
      const userEmail = this.selectedUser?.email;
      
      const targetsPromise = this.targetsService.getTargetsByUserId(userId, parentId, this.currentOffset, this.pageSize);
      const sharedPromise = userEmail ? this.targetsService.getSharedTargets(userEmail) : Promise.resolve([]);
      
      const [targetsResponse, sharedTargets] = await Promise.all([targetsPromise, sharedPromise]);
      
      // 🔍 CONSOLE LOG PARA DEBUG: Ver cómo llegan los targets
      console.log('🔍 [DEBUG] Respuesta completa del servicio de targets:', {
        targetsResponse: targetsResponse,
        sharedTargets: sharedTargets,
        userId: userId,
        parentId: parentId,
        currentOffset: this.currentOffset,
        pageSize: this.pageSize
      });
      
      // Extraer devices y totalCount de la respuesta
      const targets = targetsResponse.devices;
      this.totalTargetsCount = targetsResponse.totalCount;
      
      // 🔍 CONSOLE LOG PARA DEBUG: Ver los targets extraídos
      console.log('🔍 [DEBUG] Targets extraídos:', {
        targets: targets,
        totalCount: this.totalTargetsCount,
        targetsLength: targets?.length || 0
      });
      
      // Combinar targets: compartidos primero, luego propios (evitando duplicados)
      const ownTargetIds = new Set(targets.map(t => t._id));
      const uniqueSharedTargets = sharedTargets.filter(t => !ownTargetIds.has(t._id));
      const combinedTargets = [...uniqueSharedTargets, ...targets];
      
      // 🔍 CONSOLE LOG PARA DEBUG: Ver targets combinados
      console.log('🔍 [DEBUG] Targets combinados:', {
        ownTargetIds: Array.from(ownTargetIds),
        uniqueSharedTargets: uniqueSharedTargets,
        combinedTargets: combinedTargets,
        combinedLength: combinedTargets.length
      });
      
      // Si es la primera carga, reemplazar. Si es scroll infinito, agregar
      if (resetPagination) {
      this.targets = combinedTargets;
      } else {
        // Para scroll infinito, solo agregar los targets propios (no los compartidos)
        // Los targets compartidos solo se cargan en la primera carga
        this.targets = [...this.targets, ...targets];
      }
      
      // 🔍 CONSOLE LOG PARA DEBUG: Ver targets finales
      console.log('🔍 [DEBUG] Targets finales después de combinar:', {
        targets: this.targets,
        targetsLength: this.targets.length,
        resetPagination: resetPagination
      });
      
      // Verificar si hay más targets disponibles
      this.hasMoreTargets = targets.length === this.pageSize;
      this.currentOffset += this.pageSize;
      
      this.showNoTargetMessage = this.targets.length === 0;
      
      console.log('📋 Targets cargados:', {
        propios: targets.length,
        compartidos: uniqueSharedTargets.length,
        total: this.targets.length,
        offset: this.currentOffset - this.pageSize,
        hasMore: this.hasMoreTargets,
        selectedUserEmail: userEmail,
        selectedUserName: this.selectedUser?.name + ' ' + this.selectedUser?.last_name
      });
      
      if (this.targets && this.targets.length > 0) {
        // Crear un Set con los IDs de targets compartidos para verificación rápida
        const sharedTargetIds = new Set(uniqueSharedTargets.map(t => t._id));
        
        this.targetsList = this.targets.map((target, index) => {
          const traccarStatus = target.traccarInfo?.status || 'offline';
          const isOnline = traccarStatus === 'online';
          
          // Determinar si es un target compartido
          const isShared = sharedTargetIds.has(target._id);
          
          // Calcular tiempo offline si no está online
          let offlineTimeText = '';
          let offlineDateText = '';
          if (!isOnline && target.traccarInfo?.['lastUpdate']) {
            const offlineInfo = this.calculateOfflineTime(target.traccarInfo['lastUpdate']);
            offlineTimeText = offlineInfo.timeText;
            offlineDateText = offlineInfo.dateText;
          }
          
          return {
            name: target.name,
            status: isOnline ? this.translate.instant('management.status.online') : this.translate.instant('management.status.offline'),
            imei: target.device_imei || target.imei,
            sim: target.sim_card_number || target.sim_card,
            _id: target._id,
            traccarStatus: traccarStatus,
            traccarInfo: target.traccarInfo,
            originalTarget: target,
            isShared: isShared,
            offlineTimeText: offlineTimeText,
            offlineDateText: offlineDateText
          };
                  });
        
        // 🔍 CONSOLE LOG PARA DEBUG: Ver la lista final de targets para la UI
        console.log('🔍 [DEBUG] Lista final de targets para la UI (targetsList):', {
          targetsList: this.targetsList,
          targetsListLength: this.targetsList.length,
          sharedTargetIds: Array.from(sharedTargetIds)
                  });
        } else {
          this.targetsList = [];
        }
      
      // Actualizar visibilidad de mapas si es necesario
      this.uiService.autoShowMapsIfMobileAndHasTargets(this.targetsList.length > 0);
      
      // Reinicializar el estado de polling de status después de cargar targets
      this.initializePreviousTargetsStatus();
      
      // Iniciar polling de status si hay targets cargados
      if (this.targetsList.length > 0) {
        this.startPolling();
      }
      
      // Si hay un target ID desde la URL, intentar seleccionarlo
      if (this.targetIdFromUrl) {
        this.findAndSelectTarget(this.targetIdFromUrl);
      }
      
      
    } catch (error) {
      console.error('❌ Error al cargar objetivos:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('management.error'),
        detail: this.translate.instant('management.targetsLoadError')
      });
    } finally {
      // Desactivar estado de carga específico para targets
      this.loadingTargets = false;
      this.targetsLoadCompletedFlag = true;
    }
  }


  private deleteUser(user: User): void {
    this.userService.delete(user._id).subscribe({
      next: () => {
        this.users = this.users.filter(u => u._id !== user._id);
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('management.userDeleted'),
          detail: `${user.name} ${user.last_name}`,
          life: 3000
        });
      },
      error: (error) => {
        console.error('Error al eliminar usuario:', error);
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('management.error'),
          detail: this.translate.instant('management.errorDeleteUser'),
          life: 3000
        });
      }
    });
  }

  // ====================================
  // MÉTODOS PRIVADOS - POLLING
  // ====================================
  
    private initializePreviousTargetsStatus(): void {
    // Inicializar el mapa con el status actual de todos los targets
    this.previousTargetsStatus.clear();
    this.targetsList.forEach(target => {
      this.previousTargetsStatus.set(target._id, target.traccarStatus || 'offline');
    });
  }
  
  private startPolling(): void {
    // Detener cualquier polling previo
    this.stopPolling();
    
    // Iniciar polling si hay un target seleccionado O si hay targets cargados (para actualizar status)
    if (this.selectedTargetForMap || (this.selectedUser && this.targetsList.length > 0)) {
      const pollingType = this.selectedTargetForMap ? 
        `target ${this.selectedTargetForMap.name} y status de todos` : 
        'status de todos los targets';
      
      
      this.pollingInterval = setInterval(async () => {
        await this.updateSelectedTargetData();
      }, this.POLLING_INTERVAL_MS);
      
      // Actualizar inmediatamente
      this.updateSelectedTargetData();
    }
  }
  
  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }
  
  private async updateSelectedTargetData(): Promise<void> {
    // Si no hay usuario seleccionado o targets cargados, detener polling
    if (!this.selectedUser || this.targetsList.length === 0) {
      this.stopPolling();
      return;
    }
    
    try {
      let logMessage = '📡 Actualizando ';
      let selectedTargetName = '';
      
      // 1. Actualizar target seleccionado (si existe)
      if (this.selectedTargetForMap) {
        logMessage += 'target seleccionado y ';
      const updatedTarget = await this.targetsService.getTargetById(this.selectedTargetForMap._id);
      
      // Actualizar el target seleccionado con la nueva información
      this.selectedTargetForMap = {
        ...this.selectedTargetForMap,
        ...updatedTarget,
        // Preservar información adicional que pueda tener el target local
          traccarInfo: updatedTarget.traccarInfo || this.selectedTargetForMap.traccarInfo,
          // IMPORTANTE: Sincronizar traccarStatus para que el mapa lo detecte
          traccarStatus: updatedTarget.traccarInfo?.status || 'offline'
        };
        
        selectedTargetName = updatedTarget.name;
      }
      
      logMessage += 'status de todos los targets';
      
      // 2. Actualizar status de TODOS los targets
      await this.updateAllTargetsStatusInPolling();
      
      // Forzar detección de cambios para actualizar la UI
      this.cdr.detectChanges();
      
      // Timeout adicional para asegurar que el mapa detecte los cambios en selectedTarget
      setTimeout(() => {
        this.cdr.detectChanges();
      }, 50);
      
      const summary: any = {
        lastUpdate: new Date().toLocaleTimeString()
      };
      
      if (selectedTargetName) {
        summary.selectedTarget = selectedTargetName;
      }
      
      
    } catch (error) {
      console.error('❌ Error en polling:', error);
      // No mostrar error al usuario para evitar spam, solo log en consola
    }
  }

  private async updateAllTargetsStatusInPolling(): Promise<void> {
    // Solo ejecutar si hay un usuario seleccionado y targets cargados
    if (!this.selectedUser || this.targetsList.length === 0) {
      return;
    }

    try {
      // Obtener la lista actualizada de targets
      const parentId = this.managementService.getCurrentUserId();
      const updatedTargetsResponse = await this.targetsService.getTargetsByUserId(this.selectedUser._id, parentId);
      const updatedTargets = updatedTargetsResponse.devices;
      
      let statusChanges: string[] = [];
      let offlineChangesDetected = 0;
      
      // Comparar con el estado anterior y actualizar los que cambiaron
      updatedTargets.forEach((updatedTarget: Target) => {
        const targetId = updatedTarget._id;
        const newStatus = updatedTarget.traccarInfo?.status || 'offline';
        const previousStatus = this.previousTargetsStatus.get(targetId);
        
        // Detectar cualquier cambio de status
        if (previousStatus && previousStatus !== newStatus) {
          const changeMessage = `${updatedTarget.name}: ${previousStatus} → ${newStatus}`;
          statusChanges.push(changeMessage);
          
          // Especialmente importante: cambios a offline
          if (newStatus === 'offline') {
            offlineChangesDetected++;
          } else if (previousStatus === 'offline' && newStatus === 'online') {
            
            // Mostrar mensaje cuando un target pasa a online
            this.messageService.add({
              severity: 'success',
              summary: 'Dispositivo Conectado',
              detail: `${updatedTarget.name} ahora está en línea`,
              life: 5000
            });
          }
          
          // Actualizar en la lista de targets
          const targetIndex = this.targetsList.findIndex(t => t._id === targetId);
          if (targetIndex !== -1) {
            const isOnline = newStatus === 'online';
            this.targetsList[targetIndex] = {
              ...this.targetsList[targetIndex],
              status: isOnline ? this.translate.instant('management.status.online') : this.translate.instant('management.status.offline'),
              traccarStatus: newStatus,
              traccarInfo: updatedTarget.traccarInfo,
              originalTarget: updatedTarget
            };
          }
          
          // Actualizar también en la lista de targets originales
          const originalTargetIndex = this.targets.findIndex(t => t._id === targetId);
          if (originalTargetIndex !== -1) {
            this.targets[originalTargetIndex] = updatedTarget;
          }
          
          // IMPORTANTE: Actualizar selectedTargetForMap si este target es el que está seleccionado
          if (this.selectedTargetForMap && this.selectedTargetForMap._id === targetId) {
            
            const previousTraccarStatus = this.selectedTargetForMap.traccarStatus;
            this.selectedTargetForMap = {
              ...this.selectedTargetForMap,
              ...updatedTarget,
              // Preservar información adicional que pueda tener el target local
              traccarInfo: updatedTarget.traccarInfo,
              // IMPORTANTE: Establecer traccarStatus para que el mapa lo detecte
              traccarStatus: newStatus
            };
            
        
          }
        }
        
        // Actualizar el estado anterior
        this.previousTargetsStatus.set(targetId, newStatus);
      });
      
             // Log de resultados (solo si hay cambios para evitar spam)
   
      
    } catch (error) {
      console.error('❌ Error actualizando status en polling:', error);
      // No mostrar error al usuario para evitar spam, solo log en consola
    }
  }

  confirmCancelTarget(target: any) {
    // Validar permisos antes de permitir cancelar targets
    if (!this.canDeleteDevices()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('management.devices.no_delete_permission'),
        detail: this.translate.instant('management.devices.contact_admin')
      });
      return;
    }

    this.targetToCancel = target;
    this.cancelForm = {
      reason: '',
      description: ''
    };
    this.cancelDialogVisible = true;
  }

  confirmCancelation() {
    if (!this.cancelForm.reason || !this.cancelForm.description.trim()) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('management.validationError'),
        detail: this.translate.instant('management.cancelTargetValidation'),
        life: 3000
      });
      return;
    }

    this.cancelTarget();
  }

  cancelCancelation() {
    this.cancelDialogVisible = false;
    this.targetToCancel = null;
    this.cancelForm = {
      reason: '',
      description: ''
    };
  }

  private async cancelTarget(): Promise<void> {
    if (!this.targetToCancel) return;

    try {
      // 1. Cancelar el target usando el nuevo endpoint
      await this.targetsService.cancelTarget(this.targetToCancel._id, {
        reason: this.cancelForm.reason,
        description: this.cancelForm.description
      });

      // 2. Registrar el proceso de cancelación
      await this.createCancelationProcess();

      // 3. Actualizar la lista de targets
      this.targets = this.targets.filter(t => t._id !== this.targetToCancel!._id);
      this.targetsList = this.targetsList.filter(t => t._id !== this.targetToCancel!._id);

      // 4. Mostrar mensaje de éxito
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('management.targetCanceled'),
        detail: this.translate.instant('management.targetCanceledDetail'),
        life: 3000
      });

      // 5. Cerrar el modal
      this.cancelDialogVisible = false;
      this.targetToCancel = null;
      this.cancelForm = {
        reason: '',
        description: ''
      };

    } catch (error) {
      console.error('Error al cancelar objetivo:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('management.error'),
        detail: this.translate.instant('management.errorCancelTarget'),
        life: 3000
      });
    }
  }

  private async createCancelationProcess(): Promise<void> {
    if (!this.targetToCancel) return;

    const reasonLabels: { [key: string]: string } = {
      'vehicle_sold': 'Vehículo vendido',
      'service_dissatisfaction': 'Descontento con el servicio',
      'loan_paid_off': 'Cliente saldó el préstamo',
      'renewal_too_expensive': 'Renovación muy cara',
      'vehicle_stolen': 'Vehículo robado',
      'vehicle_in_shop': 'Vehículo en el taller',
      'device_change': 'Cambio de Dispositivo',
      'vehicle_change': 'Cambio de Vehículo',
      'device_damaged': 'Dispositivo dañado',
      'no_specific_reason': 'Sin razón específica'
    };

    const reasonLabel = reasonLabels[this.cancelForm.reason] || this.cancelForm.reason;
    
    const processData = {
      type: 8, // Tipo 8 para cancelación
      registrationDate: new Date().toISOString(),
      description: `Dispositivo cancelado - Razón: ${reasonLabel}`,
      details: this.cancelForm.description,
      target: {
        _id: this.targetToCancel._id,
        name: this.targetToCancel.name,
        device_imei: this.targetToCancel.device_imei || this.targetToCancel.imei,
        sim_card_number: this.targetToCancel.sim_card_number || this.targetToCancel.sim
      },
      user: {
        _id: this.authService.getCurrentUser()?.id || "ejemplo_user_id",
        name: this.authService.getCurrentUser()?.name || "Usuario Ejemplo",
        email: this.authService.getCurrentUser()?.email || "usuario@ejemplo.com"
      },
      reference: this.targetToCancel._id,
      before: {
        status: "active",
        canceled: false
      },
      after: {
        status: "canceled",
        canceled: true,
        cancelReason: this.cancelForm.reason,
        cancelDescription: this.cancelForm.description
      },
      creator: this.authService.getCurrentUser()?.id || "creator_ejemplo_id"
    };

    await this.targetsService.createProcess(processData);
  }
}
