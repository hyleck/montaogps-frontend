// Angular imports
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';

// Third-party imports
import { MenuItem, ConfirmationService, MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';

// Application imports
import { User, BasicUser, ExtendedUser, convertToExtendedUser } from '@core/interfaces';
import { AuthService } from '@core/services/auth.service';
import { UserService } from '@core/services/user.service';
import { ThemesService } from '@shared/services/themes.service';
import { StatusService } from '@shared/services/status.service';
import { ManagementService } from '@management/presentation/services/management.service';
import { ScreenService } from '@management/presentation/services/screen.service';

@Component({
    selector: 'app-management',
    templateUrl: './management.component.html',
    styleUrls: ['./management.component.css'],
    standalone: false
})
export class ManagementComponent implements OnInit, OnDestroy {
  // Propiedades públicas
  userFormDisplay: boolean = false;
  targetFormDisplay: boolean = false;
  loading: boolean = true;
  breadcrumbLoading: boolean = false;
  items: MenuItem[] | undefined;
  home: MenuItem | undefined;
  currentTheme: string | undefined;
  searchUsersTerm: string = '';
  searchTargetsTerm: string = '';
  showMaps: boolean = false;
  selectedUser: User | undefined;
  users: User[] = [];
  userToEdit: ExtendedUser | null = null;
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
  customers = [
    {
      name: 'Honda accord',
      status: 'En linea',
      imei: '13132121655444123',
      sim: '1553215448888',
      _id: '1',
    },
    {
      name: 'Toyota Corolla',
      status: 'Offline',
      imei: '13132121655444124',
      sim: '1553215448889',
      _id: '2',
    }
  ];
  customersSelected = [];

  // Propiedades para gestionar suscripciones
  private routeParamsSubscription: Subscription | null = null;
  private statusChangesSubscription: Subscription | null = null;
  private queryParamsSubscription: Subscription | null = null;
  private usersSubscription: Subscription | null = null;
  private deleteUserSubscription: Subscription | null = null;

  // Propiedades para control de solicitudes y cancelaciones
  private currentRequestId: number = 0;
  private activeBreadcrumbRequestId: number | null = null;
  private activeUserDataRequestId: number | null = null;

  constructor(
    public router: Router,
    public route: ActivatedRoute,
    private status: StatusService,
    private authService: AuthService,
    private userService: UserService,
    private translate: TranslateService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    public managementService: ManagementService,
    private screenService: ScreenService
  ) {}

  // Lifecycle hooks
  ngOnInit() {
    this.loading = true;
    this.screenService.checkScreenSize();

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      this.router.navigate(['auth/login']);
      return;
    }

    // Guarda el último ID de usuario procesado
    let lastProcessedUserId: string | null = null;
    
    // Limpiar suscripción anterior si existe
    this.unsubscribe(this.routeParamsSubscription);
    this.routeParamsSubscription = this.route.params.subscribe(params => {
      const userId = params['user'];
      
      // Solo procesar cuando el ID de usuario cambia
      if (userId && userId !== lastProcessedUserId) {
        lastProcessedUserId = userId;
        this.loadUserDataAndPath(userId);
      } else if (!userId && !params['op']) {
        // Manejar el caso cuando no hay user ID en la URL, como antes
        const managementState: any = this.status.getState('management');
        const storedUserId = managementState && managementState.url_route ? managementState.url_route[2] : null;
        
        if (storedUserId && storedUserId !== lastProcessedUserId) {
          lastProcessedUserId = storedUserId;
          this.loadUserDataAndPath(storedUserId);
        } else if (!lastProcessedUserId) {
          // Solo cargar el usuario por defecto si no hemos procesado ningún ID aún
          const defaultUserId = currentUser.id;
          lastProcessedUserId = defaultUserId;
          this.loadUserDataAndPath(defaultUserId);
        }
      }
      
      this.managementService.verifyURLStatus(params);
    });

    // Limpiar suscripción anterior si existe
    this.unsubscribe(this.statusChangesSubscription);
    this.statusChangesSubscription = this.status.statusChanges$.subscribe((newStatus) => {
      if (newStatus.management_show_maps) {
        this.showMaps = newStatus.management_show_maps.showMaps as boolean;
      }
      if (newStatus.theme) {
        this.currentTheme = newStatus.theme as string;
      }
    });

    // Limpiar suscripción anterior si existe
    this.unsubscribe(this.queryParamsSubscription);
    this.queryParamsSubscription = this.route.queryParams.subscribe(queryParams => {
      if (this.managementService.getOp() === 'u') {
        this.searchUsersTerm = queryParams['search'];
      } else if (this.managementService.getOp() === 't') {
        this.searchTargetsTerm = queryParams['search'];
      }
    });

    this.home = { icon: 'pi pi-home', routerLink: '/admin/dashboard' };
  }

  // Nuevo método para cargar datos de usuario y construir la ruta
  private loadUserDataAndPath(userId: string) {
    // Generar un nuevo ID de solicitud para rastrear esta carga específica
    const requestId = ++this.currentRequestId;
    
    // Marcar como cargando y vaciar los datos actuales
    this.loading = true;
    this.breadcrumbLoading = true;
    this.users = [];
    
    console.log(`Iniciando carga para usuario ${userId}. RequestID: ${requestId}`);
    
    // Almacenar el ID de solicitud actual
    this.activeUserDataRequestId = requestId;
    this.activeBreadcrumbRequestId = requestId;
    
    // Cargar datos del usuario
    this.managementService.loadUserData(userId)
      .then(user => {
        // Verificar si esta solicitud sigue siendo relevante
        if (this.activeUserDataRequestId !== requestId) {
          console.log(`Descartada carga de datos para requestId ${requestId}. Actual: ${this.activeUserDataRequestId}`);
          return;
        }
        
        this.selectedUser = user;
        
        // Construir la ruta completa para el breadcrumb
        this.managementService.buildUserPath(user._id)
          .then(breadcrumbItems => {
            // Verificar si esta solicitud de breadcrumb sigue siendo relevante
            if (this.activeBreadcrumbRequestId !== requestId) {
              console.log(`Descartada actualización de breadcrumb para requestId ${requestId}. Actual: ${this.activeBreadcrumbRequestId}`);
              return;
            }
            
            this.items = breadcrumbItems;
            this.breadcrumbLoading = false;
          })
          .catch(error => {
            if (this.activeBreadcrumbRequestId !== requestId) return;
            
            console.error('Error al construir la ruta del breadcrumb:', error);
            // Fallback simple en caso de error
            this.items = [
              { label: `${user.name} ${user.last_name}` }
            ];
            this.breadcrumbLoading = false;
          });
        
        // Cancelar suscripción anterior
        this.unsubscribe(this.usersSubscription);
        this.usersSubscription = this.userService.getAll(user._id).subscribe({
          next: (users) => {
            // Verificar si esta solicitud sigue siendo relevante
            if (this.activeUserDataRequestId !== requestId) {
              console.log(`Descartados usuarios cargados para requestId ${requestId}. Actual: ${this.activeUserDataRequestId}`);
              return;
            }
            
            this.users = users;
            this.loading = false;
            console.log(`Completada carga para usuario ${userId}. RequestID: ${requestId}`);
          },
          error: (error) => {
            if (this.activeUserDataRequestId !== requestId) return;
            
            console.error('Error al cargar usuarios:', error);
            this.loading = false;
          }
        });
      })
      .catch((error) => {
        if (this.activeUserDataRequestId !== requestId) return;
        
        console.error('Error al cargar datos de usuario:', error);
        this.loading = false;
        this.breadcrumbLoading = false;
      });
  }

  // Método para cancelar una suscripción si existe
  private unsubscribe(subscription: Subscription | null): void {
    if (subscription) {
      subscription.unsubscribe();
    }
  }

  // Método para limpiar todas las suscripciones
  private unsubscribeAll(): void {
    this.unsubscribe(this.routeParamsSubscription);
    this.unsubscribe(this.statusChangesSubscription);
    this.unsubscribe(this.queryParamsSubscription);
    this.unsubscribe(this.usersSubscription);
    this.unsubscribe(this.deleteUserSubscription);
  }

  // Implementar OnDestroy para limpiar todas las suscripciones
  ngOnDestroy(): void {
    this.unsubscribeAll();
    
    // Limpiar IDs de solicitudes activas
    this.activeUserDataRequestId = null;
    this.activeBreadcrumbRequestId = null;
  }

  // Reemplazar processUserId con la nueva implementación
  private processUserId(userId: string) {
    this.loadUserDataAndPath(userId);
  }

  // Métodos públicos
  showMapsToggle() {
    this.status.setState('management_show_maps', { showMaps: !this.showMaps });
  }

  // Método para determinar si se puede navegar hacia atrás
  canNavigateBack(): boolean {
    if (!this.selectedUser) return false;
    
    // Verificar si el usuario actual es el usuario logueado
    const currentLoggedUserId = this.authService.getCurrentUser()?.id;
    const selectedUserId = this.selectedUser._id;
    
    // Si estamos en el usuario logueado, no permitimos navegar hacia atrás
    if (currentLoggedUserId === selectedUserId) {
      return false;
    }
    
    // Verificar si el usuario tiene parent_id
    const parentId = (this.selectedUser as any).parent_id;
    
    // Retornar true solo si el usuario tiene parent_id
    return !!parentId;
  }

  goToParent() {
    if (!this.selectedUser) return;
    
    // Verificar si el usuario actual es el usuario logueado
    const currentLoggedUserId = this.authService.getCurrentUser()?.id;
    const selectedUserId = this.selectedUser._id;
    
    // Si estamos en el usuario logueado, no permitimos navegar hacia atrás
    if (currentLoggedUserId === selectedUserId) {
      console.log('Estás en el usuario logueado, no puedes navegar hacia atrás');
      return;
    }
    
    // Acceder a parent_id usando casting de tipo para evitar errores del linter
    const parentId = (this.selectedUser as any).parent_id;
    
    // Si el usuario no tiene parent_id, no hacemos nada
    if (!parentId) {
      console.log('Usuario actual no tiene padre definido');
      return;
    }
    
    // Establecemos el ID del padre como usuario actual
    this.managementService.setCurrentUserId(parentId);
    
    // Navegamos al usuario padre - el resto se manejará en la suscripción a params
    this.managementService.setOp('u', parentId);
  }

  searchUser() {
    this.managementService.setSearchUsersTerm(this.searchUsersTerm);
    this.managementService.searchUser();
  }

  searchTargets() {
    this.managementService.setSearchTargetsTerm(this.searchTargetsTerm);
    this.managementService.searchTargets();
  }

  enterUser(user: User) {
    if (!user || !user._id) return;
    
    console.log('Entrando al usuario:', user.name, user._id);
    
    // Primero establecemos explícitamente el ID del usuario
    this.managementService.setCurrentUserId(user._id);
    
    // Luego navegamos usando el método setOp, pasando explícitamente el ID
    // El resto se manejará en la suscripción a params
    this.managementService.setOp('u', user._id);
  }

  setOp(op: string) {
    this.managementService.setOp(op);
  }

  showUserForm() {
    this.userToEdit = null;
    this.userFormDisplay = true;
  }

  showTargetForm() {
    this.targetFormDisplay = true;
  }

  onUserCreated() {
    this.userFormDisplay = false;
    this.userToEdit = null;
    
    // Cancelar suscripción anterior
    this.unsubscribe(this.usersSubscription);
    this.usersSubscription = this.userService.getAll(this.managementService.getCurrentUserId() || '').subscribe({
      next: (users) => {
        this.users = users;
      },
      error: (error) => {
        console.error('Error al recargar usuarios:', error);
      }
    });
  }

  editUser(user: User) {
    this.userToEdit = convertToExtendedUser(user);
    this.userFormDisplay = true;
  }

  confirmDeleteUser(user: User) {
    this.confirmationService.confirm({
      message: this.translate.instant('management.userForm.confirmDeleteUser'),
      header: this.translate.instant('management.userForm.confirmDeleteHeader'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('management.userForm.yes'),
      rejectLabel: this.translate.instant('management.userForm.no'),
      accept: () => {
        // Cancelar suscripción anterior
        this.unsubscribe(this.deleteUserSubscription);
        this.deleteUserSubscription = this.userService.delete(user._id).subscribe({
          next: () => {
            this.users = this.users.filter(u => u._id !== user._id);
            this.messageService.add({
              severity: 'success',
              summary: this.translate.instant('management.userForm.userDeleted'),
              detail: this.translate.instant('management.userForm.userDeleted'),
              life: 3000
            });
          },
          error: (error) => {
            this.messageService.add({
              severity: 'error',
              summary: this.translate.instant('management.userForm.error'),
              detail: this.translate.instant('management.userForm.errorDelete'),
              life: 3000
            });
          }
        });
      }
    });
  }

  // Métodos privados
  @HostListener('window:resize', ['$event'])
  private onResize(): void {
    this.screenService.checkScreenSize();
  }
}
