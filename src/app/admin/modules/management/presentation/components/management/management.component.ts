// Angular imports
import { Component, HostListener } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

// Third-party imports
import { MenuItem, ConfirmationService, MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';

// Application imports
import { User, BasicUser, ExtendedUser, convertToExtendedUser } from '@core/interfaces';
import { Target } from '@core/interfaces/target.interface';
import { AuthService } from '@core/services/auth.service';
import { UserService } from '@core/services/user.service';
import { TargetsService } from '@core/services/targets.service';
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
export class ManagementComponent {
  // Propiedades públicas
  userFormDisplay: boolean = false;
  targetFormDisplay: boolean = false;
  loading: boolean = true;
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
  targetsList: any[] = [];
  targetsSelected: any[] = [];
  selectedMap: string = 'mapbox-light';
  providerType: 'google' | 'mapbox' = 'mapbox';
  providerTheme: 'light' | 'dark' = 'light';
  mapsKey: number | null = Date.now();
  targets: Target[] = [];
  targetToEdit: any | null = null;

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
    private targetsService: TargetsService
  ) {}

  // Lifecycle hooks
  ngOnInit() {
    const savedProvider = this.status.getState('map_provider');
    let defaultTheme: 'light' | 'dark' = 'light';
    const globalTheme = this.status.getState('theme');
    if (globalTheme === 'dark') {
      defaultTheme = 'dark';
    }
    if (typeof savedProvider === 'string') {
      this.selectedMap = savedProvider;
      const [type, theme] = savedProvider.split('-');
      this.providerType = type as 'google' | 'mapbox';
      this.providerTheme = theme as 'light' | 'dark';
    } else {
      this.selectedMap = `google-${defaultTheme}`;
      this.providerType = 'google';
      this.providerTheme = defaultTheme;
    }
    this.loading = true;
    this.screenService.checkScreenSize();

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      this.router.navigate(['auth/login']);
      return;
    }

    this.route.params.subscribe(params => {
      if (params['user']) {
        this.managementService.loadUserData(params['user'])
          .then(user => {
            this.selectedUser = user;
            this.items = [
              { label: `${user.name} ${user.last_name}` }
            ];
            
            this.userService.getAll(user._id).subscribe({
              next: (users) => {
                this.users = users;
                this.loading = false;
              },
              error: (error) => {
                console.error('Error al cargar usuarios:', error);
              }
            });
            
            // Cargar objetivos del usuario
            this.loadTargetsForUser(user._id);
          })
          .catch(() => {
            this.loading = false;
          });
      } else {
        const managementState: any = this.status.getState('management');
        const storedUserId = managementState && managementState.url_route ? managementState.url_route[2] : null;
        
        if (storedUserId) {
          this.managementService.loadUserData(storedUserId)
            .then(user => {
              this.selectedUser = user;
              this.items = [
                { label: `${user.name} ${user.last_name}` }
              ];
              
              this.userService.getAll(user._id).subscribe({
                next: (users) => {
                  this.users = users;
                },
                error: (error) => {
                  console.error('Error al cargar usuarios:', error);
                }
              });
              
              // Cargar objetivos del usuario
              this.loadTargetsForUser(user._id);
              
              this.loading = false;
            })
            .catch(() => {
              this.loading = false;
            });
        } else {
          this.managementService.loadUserData(currentUser.id)
            .then(user => {
              this.selectedUser = user;
              this.items = [
                { label: `${user.name} ${user.last_name}` }
              ];
              
              this.userService.getAll(currentUser.id).subscribe({
                next: (users) => {
                  this.users = users;
                },
                error: (error) => {
                  console.error('Error al cargar todos los usuarios:', error);
                }
              });
              
              // Cargar objetivos del usuario actual
              this.loadTargetsForUser(currentUser.id);
              
              this.loading = false;
            })
            .catch(() => {
              this.loading = false;
            });
        }
      }
      
      this.managementService.verifyURLStatus(params);
    });

    this.status.statusChanges$.subscribe((newStatus) => {
      if (newStatus.management_show_maps) {
        this.showMaps = newStatus.management_show_maps.showMaps as boolean;
      }
      if (newStatus.theme) {
        this.currentTheme = newStatus.theme as string;
      }
    });

    this.route.queryParams.subscribe(queryParams => {
      if (this.managementService.getOp() === 'u') {
        this.searchUsersTerm = queryParams['search'];
      } else if (this.managementService.getOp() === 't') {
        this.searchTargetsTerm = queryParams['search'];
      }
    });

    this.home = { icon: 'pi pi-home', routerLink: '/admin/dashboard' };
  }

  // Métodos públicos
  showMapsToggle() {
    this.status.setState('management_show_maps', { showMaps: !this.showMaps });
  }

  // Método para navegar al usuario padre
  goToParent() {
    if (!this.selectedUser) return;

    // Verificar si el usuario actual tiene parent_id usando acceso con casting
    const parentId = (this.selectedUser as any).parent_id;
    if (!parentId) {
      console.log('El usuario actual no tiene padre definido');
      return;
    }

    // Mostrar skeletons inmediatamente
    this.loading = true;
    
    console.log('Navegando al usuario padre:', parentId);
    
    // Establecer el ID del padre como usuario actual
    this.managementService.setCurrentUserId(parentId);
    
    // Navegar al usuario padre
    this.managementService.setOp('u', parentId);
  }

  // Método para verificar si se puede navegar hacia atrás
  canNavigateBack(): boolean {
    if (!this.selectedUser) return false;
    // Verificar si el usuario tiene parent_id usando acceso con casting
    return !!(this.selectedUser as any).parent_id;
  }

  searchUser() {
    this.managementService.setSearchUsersTerm(this.searchUsersTerm);
    this.managementService.searchUser();
  }

  searchTargets() {
    this.managementService.setSearchTargetsTerm(this.searchTargetsTerm);
    // Si hay término de búsqueda, filtrar objetivos
    if (this.searchTargetsTerm && this.searchTargetsTerm.trim() !== '') {
      console.log('Buscando objetivos con término:', this.searchTargetsTerm);
      
      // Obtener el ID del usuario de la URL (management) como parent
      const parentId = this.managementService.getCurrentUserId();
      console.log('ID de usuario padre (parent) para búsqueda:', parentId);
      
      this.targetsService.searchTargets(this.searchTargetsTerm, parentId)
        .then((targets: Target[]) => {
          console.log('Respuesta de búsqueda de objetivos:', targets);
          this.targets = targets;
          
          if (targets && targets.length > 0) {
            this.targetsList = targets.map((target: Target) => ({
              name: target.name,
              status: target.status === 'active' ? this.translate.instant('management.status.online') : this.translate.instant('management.status.offline'),
              imei: target.device_imei || target.imei, // Intentar ambos campos
              sim: target.sim_card_number || target.sim_card, // Intentar ambos campos
              _id: target._id
            }));
          } else {
            console.log('No se encontraron objetivos en la búsqueda');
            this.targetsList = [];
          }
          
          console.log('Objetivos encontrados transformados:', this.targetsList);
        })
        .catch((error: any) => {
          console.error('Error al buscar objetivos:', error);
        });
    } else if (this.selectedUser) {
      // Si no hay término, recargar todos los objetivos del usuario
      this.loadTargetsForUser(this.selectedUser._id);
    }
  }

  enterUser(user: User) {
    if (!user || !user._id) return;
    
    // Mostrar skeletons inmediatamente
    this.loading = true;
    
    console.log('Entrando al usuario:', user.name, user._id);
    
    // Primero establecemos explícitamente el ID del usuario
    this.managementService.setCurrentUserId(user._id);
    
    // Luego navegamos usando el método setOp, pasando explícitamente el ID
    this.managementService.setOp('u', user._id);
    
    // Cargamos los datos del usuario
    this.managementService.loadUserData(user._id)
      .then(loadedUser => {
        this.selectedUser = loadedUser;
        this.items = [
          { label: `${loadedUser.name} ${loadedUser.last_name}` }
        ];
        
        // Cargamos la lista de usuarios
        this.userService.getAll(user._id).subscribe({
          next: (users) => {
            this.users = users;
            console.log('Usuarios cargados:', users.length);
            this.loading = false;
          },
          error: (error) => {
            console.error('Error al cargar usuarios:', error);
            this.loading = false;
          }
        });
      })
      .catch(() => {
        this.loading = false;
      });
  }

  setOp(op: string) {
    this.managementService.setOp(op);
  }

  showUserForm() {
    this.userToEdit = null;
    this.userFormDisplay = true;
  }

  async showTargetForm(target?: any) {
    // Si recibimos un target (edición), necesitamos obtener todos los detalles
    if (target) {
      try {
        // Obtener los detalles completos del objetivo desde el backend
        const targetDetails = await this.targetsService.getTargetById(target._id);
        console.log('Detalles completos del objetivo a editar:', targetDetails);
        this.targetToEdit = targetDetails;
      } catch (error) {
        console.error('Error al obtener detalles del objetivo:', error);
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('management.error'),
          detail: this.translate.instant('management.targetsLoadError')
        });
      }
    } else {
      this.targetToEdit = null;
    }
    
    this.targetFormDisplay = true;
  }

  onHideTargetForm() {
    this.targetToEdit = null;
  }

  onUserCreated() {
    this.userFormDisplay = false;
    this.userToEdit = null;
    this.userService.getAll(this.managementService.getCurrentUserId() || '').subscribe({
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
        this.userService.delete(user._id).subscribe({
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

  setMapProvider(value: string) {
    const [type, theme] = value.split('-');
    this.providerType = type as 'google' | 'mapbox';
    this.providerTheme = theme as 'light' | 'dark';
    this.status.setState('map_provider', value);
    this.mapsKey = null;
    setTimeout(() => {
      this.mapsKey = Date.now();
    }, 0);
  }

  // Método para cargar objetivos de un usuario específico
  private async loadTargetsForUser(userId: string) {
    try {
      console.log('Cargando objetivos para el usuario:', userId);
      
      // Obtener el ID del usuario de la URL (management) como parent
      const parentId = this.managementService.getCurrentUserId();
      console.log('ID de usuario padre (parent):', parentId);
      
      // Pasar el ID del usuario y el parent al método del servicio
      const targets = await this.targetsService.getTargetsByUserId(userId, parentId);
      console.log('Respuesta del API de objetivos:', targets);
      
      this.targets = targets;
      
      // Verificar si hay datos antes de transformarlos
      if (targets && targets.length > 0) {
        console.log('Primer objetivo recibido:', targets[0]);
        this.targetsList = targets.map(target => {
          const isOnline = target.status === 'active';
          console.log('Mapeando target con IMEI:', target.device_imei || target.imei, 'y SIM:', target.sim_card_number || target.sim_card);
          return {
            name: target.name,
            status: isOnline ? this.translate.instant('management.status.online') : this.translate.instant('management.status.offline'),
            imei: target.device_imei || target.imei, // Intentar ambos campos
            sim: target.sim_card_number || target.sim_card, // Intentar ambos campos
            _id: target._id
          };
        });
      } else {
        console.log('No se recibieron objetivos del API');
        this.targetsList = [];
      }
      
      console.log('Objetivos transformados para la UI:', this.targetsList);
    } catch (error) {
      console.error('Error al cargar objetivos:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('management.error'),
        detail: this.translate.instant('management.targetsLoadError')
      });
    }
  }

  onTargetCreated() {
    this.targetFormDisplay = false;
    this.targetToEdit = null;
    
    // Si existe un usuario seleccionado, recargar sus objetivos
    if (this.selectedUser) {
      this.loadTargetsForUser(this.selectedUser._id);
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
        // Eliminar el objetivo
        this.targetsService.deleteTarget(target._id)
          .then(() => {
            // Filtrar el objetivo eliminado de la lista
            this.targets = this.targets.filter(t => t._id !== target._id);
            this.targetsList = this.targetsList.filter(t => t._id !== target._id);
            
            // Mostrar mensaje de éxito
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
    });
  }

  // Métodos privados
  @HostListener('window:resize', ['$event'])
  private onResize(): void {
    this.screenService.checkScreenSize();
  }
}
