// Angular imports
import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

// Third-party imports
import { MenuItem, ConfirmationService, MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';

// Application imports
import { User, BasicUser, ExtendedUser, convertToExtendedUser } from '@core/interfaces';
import { Target } from '@core/interfaces/target.interface';
import { AuthService } from '@core/services/auth.service';
import { UserService } from '@core/services/user.service';
import { TargetsService } from '@core/services/targets.service';
import { StatusService } from '@shared/services/status.service';
import { ManagementService } from '@management/presentation/services/management.service';
import { ScreenService } from '@management/presentation/services/screen.service';

// Servicios especializados
import { MapProviderService } from '@management/presentation/services/map-provider.service';
import { BreadcrumbService } from '@management/presentation/services/breadcrumb.service';
import { VehicleDataService } from '@management/presentation/services/vehicle-data.service';
import { ManagementUIService } from '@management/presentation/services/management-ui.service';

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
  
  // Estado específico de carga de targets
  private loadingTargets: boolean = false;
  private targetsLoadCompletedFlag: boolean = false;
  
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
    users: 'management.users',
    targets: 'management.targets',
    searchUsers: 'management.searchUsers',
    searchTargets: 'management.searchTargets',
    newUser: 'management.newUser',
    newTarget: 'management.newTarget',
    showMap: 'management.showMap',
    back: 'management.back'
  };

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

  // Map Provider (delegado a MapProviderService)
  get selectedMap(): string { return this.mapProviderService.selectedMap; }
  get providerType(): 'google' | 'mapbox' { return this.mapProviderService.providerType; }
  get providerTheme(): 'light' | 'dark' { return this.mapProviderService.providerTheme; }
  get mapsKey(): string | null { return this.mapProviderService.mapsKey; }

  // Breadcrumb (delegado a BreadcrumbService)
  get items(): MenuItem[] { return this.breadcrumbService.getItems(); }
  get home(): MenuItem { return this.breadcrumbService.getHome(); }

  // ====================================
  // PROPIEDADES PRIVADAS - SUSCRIPCIONES
  // ====================================
  private subscriptions: Subscription[] = [];
  
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
    private cdr: ChangeDetectorRef
  ) {}

  // ====================================
  // LIFECYCLE HOOKS
  // ====================================
  
  ngOnInit(): void {
    // Sincronizar la selección actual con el servicio
    this.currentMapSelection = this.mapProviderService.selectedMap;
    
    this.setupInitialState();
    this.setupSubscriptions();
    this.setupRouting();
    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.cleanupSubscriptions();
    
    // Limpiar subjects
    this.searchUsersSubject.complete();
    this.searchTargetsSubject.complete();
  }

  // ====================================
  // EVENT HANDLERS
  // ====================================
  
  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.uiService.updateScreenSize();
  }

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
    
    // Solo actualizar la operación en el servicio, sin recargar datos
    this.managementService.setOp(op);
    
    // Si cambia a targets, verificar si necesita cargar datos
    // Solo cargar si no hay datos O si cambió el usuario desde la última carga
    if (op === 't' && this.selectedUser) {
      const hasNoTargets = this.targetsList.length === 0;
      const userChanged = currentUserId !== this.selectedUser._id;
      
      if (hasNoTargets || userChanged) {
        console.log('🔄 Cambiando a pestaña targets - necesita cargar datos');
        this.targetsLoadCompletedFlag = false; // Solo aquí, cuando realmente se van a cargar datos
        this.loadTargetsForUser(this.selectedUser._id);
      } else {
        console.log('✅ Targets ya cargados para este usuario - no recargando');
      }
    }
    
    // Si cambia a usuarios, verificar si necesita cargar datos
    if (op === 'u' && this.selectedUser) {
      const hasNoUsers = this.users.length === 0;
      const userChanged = currentUserId !== this.selectedUser._id;
      
      if (hasNoUsers || userChanged) {
        console.log('🔄 Cambiando a pestaña usuarios - necesita cargar datos');
        this.loadUsersForUser(this.selectedUser._id);
      } else {
        console.log('✅ Usuarios ya cargados para este usuario - no recargando');
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
    console.log('🔄 Map provider change event:', value);
    this.setMapProvider(value);
  }
  
  async setMapProvider(value: string): Promise<void> {
    console.log('🎛️ Management: setMapProvider llamado con valor:', value);
    console.log('🎛️ Management: Estado actual del servicio:', {
      selectedMap: this.mapProviderService.selectedMap,
      providerType: this.mapProviderService.providerType,
      mapsKey: this.mapProviderService.mapsKey
    });
    
    const newKey = await this.mapProviderService.changeProviderWithRecreation(value);
    
    console.log('🎛️ Management: Cambio completado, nueva key:', newKey);
    console.log('🎛️ Management: Nuevo estado del servicio:', {
      selectedMap: this.mapProviderService.selectedMap,
      providerType: this.mapProviderService.providerType,
      mapsKey: this.mapProviderService.mapsKey
    });
    
    // Forzar detección de cambios
    this.cdr.detectChanges();
    console.log('🔄 Change detection forzada');
  }

  // Método para manejar cambios del ngModel
  onMapSelectionChange(value: string): void {
    console.log('🔄 Map selection changed to:', value);
    this.setMapProvider(value);
  }

  // ====================================
  // MÉTODOS PÚBLICOS - GESTIÓN DE USUARIOS
  // ====================================
  
  showUserForm() {
    this.uiService.showUserForm();
  }

  editUser(user: User) {
    this.userToEdit = convertToExtendedUser(user);
    this.uiService.showUserForm();
  }

  onHideUserForm() {
    console.log('🔄 onHideUserForm ejecutado');
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
    console.log('📝 Target recibido para editar:', target);
    this.targetToEdit = target || null;
    console.log('📝 targetToEdit asignado:', this.targetToEdit);
    this.uiService.showTargetForm();
  }

  onHideTargetForm() {
    console.log('🔄 onHideTargetForm ejecutado');
    this.uiService.hideTargetForm();
    this.targetToEdit = null;
  }

  onTargetCreated() {
    this.uiService.hideTargetForm();
    this.targetToEdit = null;
    
    if (this.selectedUser) {
      console.log('🔄 Recargando targets después de crear/editar');
      this.loadTargetsForUser(this.selectedUser._id);
    }
  }

  handleTargetClick(target: any, event: MouseEvent) {
    if (event.ctrlKey) {
      this.openTargetInNewTab(target);
    } else {
      // Click normal: agregar el query parameter 'target' a la URL actual
      this.addTargetToUrl(target);
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
      console.log(`🎯 Target agregado a URL: ${target.name} (ID: ${target._id})`);
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
      console.log('🚫 Parámetro target removido de la URL');
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

  confirmDeleteTarget(target: any) {
    this.confirmationService.confirm({
      message: this.translate.instant('management.confirmDeleteTarget'),
      header: this.translate.instant('management.userForm.confirmDeleteHeader'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('management.userForm.yes'),
      rejectLabel: this.translate.instant('management.userForm.no'),
      accept: () => {
        this.deleteTarget(target);
      }
    });
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
            // Si no hay término de búsqueda, cargar usuarios normales
            this.isSearchingUsers = false;
            if (this.selectedUser) {
              return this.userService.getAll(this.selectedUser._id);
            }
            return [];
          } else {
            // Realizar búsqueda
            this.isSearchingUsers = true;
            console.log('🔍 Buscando usuarios:', searchTerm);
            return this.userService.search(searchTerm, this.selectedUser?._id);
          }
        })
      ).subscribe({
        next: (users) => {
          this.users = users;
          console.log(`✅ ${this.isSearchingUsers ? 'Búsqueda' : 'Carga normal'} completada:`, users.length, 'usuarios');
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
            // Si no hay término de búsqueda, cargar targets normales
            this.isSearchingTargets = false;
            if (this.selectedUser) {
      const parentId = this.managementService.getCurrentUserId();
              return this.targetsService.getTargetsByUserId(this.selectedUser._id, parentId);
            }
            return [];
          } else {
            // Realizar búsqueda
            this.isSearchingTargets = true;
            console.log('🔍 Buscando targets:', searchTerm);
      const parentId = this.managementService.getCurrentUserId();
            return this.targetsService.searchTargets(searchTerm, parentId);
          }
        })
      ).subscribe({
        next: (targets) => {
          this.targets = targets;
          
          // Transformar targets para la lista
          if (targets && targets.length > 0) {
            this.targetsList = targets.map(target => {
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
          
          console.log(`✅ ${this.isSearchingTargets ? 'Búsqueda' : 'Carga normal'} de targets completada:`, targets.length, 'targets');
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

  // ====================================
  // MÉTODOS PRIVADOS - ROUTING
  // ====================================
  
  private handleRouteParams(params: any, currentUser: any): void {
    const newUserId = params['user'];
    const currentSelectedUserId = this.selectedUser?._id;
    
    // Solo cargar datos del usuario si realmente cambió
    if (newUserId && newUserId !== currentSelectedUserId) {
      console.log('🔄 Usuario cambió en ruta - cargando datos del nuevo usuario');
      this.loadUserFromParams(newUserId);
    } else if (!newUserId && !this.selectedUser) {
      console.log('🔄 No hay usuario en ruta y no hay usuario seleccionado - cargando desde estado/usuario actual');
      this.loadUserFromState(currentUser);
    } else {
      console.log('✅ Usuario no cambió - manteniendo datos actuales');
    }
    
    this.managementService.verifyURLStatus(params);
  }

  private handleQueryParams(queryParams: any): void {
    if (this.managementService.getOp() === 'u') {
      this.searchUsersTerm = queryParams['search'];
    } else if (this.managementService.getOp() === 't') {
      this.searchTargetsTerm = queryParams['search'];
    }

    // Si hay un parámetro 'target' en la URL, mostrar automáticamente los mapas
    if (queryParams['target']) {
      console.log('🗺️ Parámetro target detectado en URL - mostrando mapas automáticamente:', queryParams['target']);
      this.uiService.showMaps();
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
    this.targetsLoadCompletedFlag = false;
    this.loadUserPath(user._id);
    this.loadUsersForUser(user._id);
    this.loadTargetsForUser(user._id);
  }

  // ====================================
  // MÉTODOS PRIVADOS - GESTIÓN DE DATOS
  // ====================================
  
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

  private loadUsersForUser(userId: string): void {
    // Si hay un término de búsqueda activo, usar la búsqueda en lugar de cargar todos
    if (this.searchUsersTerm && this.searchUsersTerm.trim() !== '') {
      console.log('🔍 Hay término de búsqueda activo, ejecutando búsqueda:', this.searchUsersTerm);
      this.searchUsersSubject.next(this.searchUsersTerm);
    } else {
      // Cargar todos los usuarios normalmente
      this.userService.getAll(userId).subscribe({
        next: (users) => {
          this.users = users;
          this.uiService.setLoading(false);
          },
          error: (error) => {
          console.error('Error al cargar usuarios:', error);
          this.uiService.setLoading(false);
          }
        });
      }
  }

  private async loadTargetsForUser(userId: string) {
    // Si hay un término de búsqueda activo, usar la búsqueda en lugar de cargar todos
    if (this.searchTargetsTerm && this.searchTargetsTerm.trim() !== '') {
      console.log('🔍 Hay término de búsqueda de targets activo, ejecutando búsqueda:', this.searchTargetsTerm);
      this.searchTargetsSubject.next(this.searchTargetsTerm);
      return;
    }

    try {
      // Activar estado de carga específico para targets
      
      console.log('🔄 Iniciando carga de targets...');
      
      const parentId = this.managementService.getCurrentUserId();
      this.loadingTargets = true;
      const targets = await this.targetsService.getTargetsByUserId(userId, parentId);
      
      this.targets = targets;
      
      if (targets && targets.length > 0) {
        this.targetsList = targets.map(target => {
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
      
      // Actualizar visibilidad de mapas si es necesario
      this.uiService.autoShowMapsIfMobileAndHasTargets(this.targetsList.length > 0);
      
      console.log('✅ Carga de targets completada exitosamente');
      
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
      console.log('🏁 Estado de carga de targets desactivado');
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

  private deleteTarget(target: any): void {
        this.targetsService.deleteTarget(target._id)
          .then(() => {
            this.targets = this.targets.filter(t => t._id !== target._id);
            this.targetsList = this.targetsList.filter(t => t._id !== target._id);
            
            this.messageService.add({
              severity: 'success',
              summary: this.translate.instant('management.targetDeleted'),
              detail: this.translate.instant('management.targetDeleted'),
              life: 3000
            });
          })
          .catch((error) => {
            console.error('Error al eliminar objetivo:', error);
            this.messageService.add({
              severity: 'error',
              summary: this.translate.instant('management.error'),
              detail: this.translate.instant('management.errorDeleteTarget'),
              life: 3000
            });
          });
  }
}
