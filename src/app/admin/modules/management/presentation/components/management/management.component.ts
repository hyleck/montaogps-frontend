// Angular imports
import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

// Third-party imports
import { MenuItem, ConfirmationService, MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { interval, Subscription } from 'rxjs';
import { switchMap, filter } from 'rxjs/operators';

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
export class ManagementComponent implements OnInit, OnDestroy {
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
  selectedTargetForMap: any | null = null;
  shouldCenterMapOnUpdate: boolean = true; // Controla si el mapa debe centrarse en actualizaciones
  
  // Polling para actualización automática
  private pollingSubscription: Subscription | null = null;
  private readonly POLLING_INTERVAL = 10000; // 10 segundos

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
  ngOnInit(): void {
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
            
            // Llamar al nuevo método getUserPath e imprimir la respuesta
            this.userService.getUserPath(user._id).subscribe({
              next: (pathData) => {
                console.log('Datos de ruta del usuario desde /path/ endpoint:', pathData);
                this.updateBreadcrumbFromPath(pathData);
              },
              error: (error) => {
                console.error('Error al obtener ruta del usuario:', error);
                // En caso de error, mostrar solo el usuario actual
                this.updateBreadcrumbFromPath([]);
              }
            });
            
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
              
              // Llamar al nuevo método getUserPath e imprimir la respuesta
              this.userService.getUserPath(user._id).subscribe({
                next: (pathData) => {
                  console.log('Datos de ruta del usuario desde /path/ endpoint:', pathData);
                  this.updateBreadcrumbFromPath(pathData);
                },
                error: (error) => {
                  console.error('Error al obtener ruta del usuario:', error);
                  console.error('Detalles completos del error:', {
                    status: error.status,
                    statusText: error.statusText,
                    message: error.message,
                    error: error.error,
                    url: error.url
                  });
                  
                  // Si hay error de parsing, intentar ver la respuesta raw
                  if (error.error && typeof error.error === 'string') {
                    console.error('Respuesta raw del servidor:', error.error);
                  }
                  
                  // En caso de error, mostrar solo el usuario actual
                  this.updateBreadcrumbFromPath([]);
                }
              });
              
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
              
              // Llamar al nuevo método getUserPath e imprimir la respuesta
              this.userService.getUserPath(currentUser.id).subscribe({
                next: (pathData) => {
                  console.log('Datos de ruta del usuario desde /path/ endpoint:', pathData);
                  this.updateBreadcrumbFromPath(pathData);
                },
                error: (error) => {
                  console.error('Error al obtener ruta del usuario:', error);
                  console.error('Detalles completos del error:', {
                    status: error.status,
                    statusText: error.statusText,
                    message: error.message,
                    error: error.error,
                    url: error.url
                  });
                  
                  // Si hay error de parsing, intentar ver la respuesta raw
                  if (error.error && typeof error.error === 'string') {
                    console.error('Respuesta raw del servidor:', error.error);
                  }
                  
                  // En caso de error, mostrar solo el usuario actual
                  this.updateBreadcrumbFromPath([]);
                }
              });
              
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
        const newShowMaps = newStatus.management_show_maps.showMaps as boolean;
        console.log('🔄 Status subscription - showMaps cambió de', this.showMaps, 'a', newShowMaps);
        console.log('🔄 selectedTargetForMap antes del cambio:', this.selectedTargetForMap);
        
        this.showMaps = newShowMaps;
        
        // Solo limpiar selectedTargetForMap si se está cerrando el mapa desde el subscription
        if (!this.showMaps && this.selectedTargetForMap) {
          console.log('🔄 Limpiando selectedTargetForMap desde subscription');
          this.selectedTargetForMap = null;
        }
        
        console.log('🔄 selectedTargetForMap después del cambio:', this.selectedTargetForMap);
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
    
    // Inicializar polling para actualización automática de targets
    this.startTargetsPolling();
  }

  // Métodos públicos
  showMapsToggle() {
    this.showMaps = !this.showMaps;
    this.status.setState('management_show_maps', { showMaps: this.showMaps });
    
    // Si se está cerrando el mapa, limpiar el query parameter y target seleccionado
    if (!this.showMaps) {
      this.selectedTargetForMap = null;
      this.shouldCenterMapOnUpdate = true; // Resetear para la próxima selección
      this.clearTargetFromUrl();
      console.log('🗺️ Mapa cerrado - Target y URL limpiados');
    }
  }

  // Nuevo método para mostrar target específico en el mapa
  showTargetOnMap(target: any) {
    console.log('🗺️ Mostrando target en mapa:', target);
    console.log('🔍 Estructura completa del target:', JSON.stringify(target, null, 2));
    
    // Debugging: revisar todas las posibles ubicaciones de la geolocalización
    console.log('🔍 traccarInfo completo:', target.traccarInfo);
    console.log('🔍 originalTarget:', target.originalTarget);
    
    // Verificar múltiples posibles estructuras de geolocalización
    let lat = null;
    let lng = null;
    
         // Opción 1: traccarInfo.geolocation (nombres en inglés)
     if (target.traccarInfo?.geolocation?.latitude && target.traccarInfo?.geolocation?.longitude) {
       lat = target.traccarInfo.geolocation.latitude;
       lng = target.traccarInfo.geolocation.longitude;
       console.log('✅ Geolocalización encontrada en traccarInfo.geolocation:', lat, lng);
     }
    // Opción 2: traccarInfo directamente
    else if (target.traccarInfo?.latitude && target.traccarInfo?.longitude) {
      lat = target.traccarInfo.latitude;
      lng = target.traccarInfo.longitude;
      console.log('✅ Geolocalización encontrada en traccarInfo directo:', lat, lng);
    }
         // Opción 3: originalTarget.traccarInfo.geolocation (nombres en inglés)
     else if (target.originalTarget?.traccarInfo?.geolocation?.latitude && target.originalTarget?.traccarInfo?.geolocation?.longitude) {
       lat = target.originalTarget.traccarInfo.geolocation.latitude;
       lng = target.originalTarget.traccarInfo.geolocation.longitude;
       console.log('✅ Geolocalización encontrada en originalTarget.traccarInfo.geolocation:', lat, lng);
     }
    // Opción 4: originalTarget.traccarInfo directamente
    else if (target.originalTarget?.traccarInfo?.latitude && target.originalTarget?.traccarInfo?.longitude) {
      lat = target.originalTarget.traccarInfo.latitude;
      lng = target.originalTarget.traccarInfo.longitude;
      console.log('✅ Geolocalización encontrada en originalTarget.traccarInfo directo:', lat, lng);
    }
    // Opción 5: traccarInfo con lat/lon
    else if (target.traccarInfo?.lat && target.traccarInfo?.lon) {
      lat = target.traccarInfo.lat;
      lng = target.traccarInfo.lon;
      console.log('✅ Geolocalización encontrada en traccarInfo.lat/lon:', lat, lng);
    }
    
    if (!lat || !lng) {
      console.warn('❌ El target no tiene información de geolocalización válida');
      console.log('🔍 Todas las estructuras verificadas:', {
        'traccarInfo.geolocation': target.traccarInfo?.geolocation,
        'traccarInfo directo': { lat: target.traccarInfo?.latitude, lng: target.traccarInfo?.longitude },
        'originalTarget.traccarInfo.geolocation': target.originalTarget?.traccarInfo?.geolocation,
        'originalTarget.traccarInfo directo': { lat: target.originalTarget?.traccarInfo?.latitude, lng: target.originalTarget?.traccarInfo?.longitude },
        'traccarInfo.lat/lon': { lat: target.traccarInfo?.lat, lng: target.traccarInfo?.lon }
      });
      
      this.messageService.add({
        severity: 'warn',
        summary: 'Sin ubicación',
        detail: 'Este dispositivo no tiene información de ubicación disponible'
      });
      return;
    }

         // Crear objeto target con la estructura esperada por el mapa
     const targetForMap = {
       ...target,
       traccarInfo: {
         ...target.traccarInfo,
         geolocation: {
           latitude: lat,  // Usar nombres en inglés
           longitude: lng
         }
       }
     };

    // Almacenar el target seleccionado
    this.selectedTargetForMap = targetForMap;
    
    // Reactivar el centrado automático para la nueva selección
    this.shouldCenterMapOnUpdate = true;
    
    console.log('✅ Target preparado para el mapa:', this.selectedTargetForMap);
    
    // Activar la vista del mapa
    // Solo cambiar el estado si no está ya activo
    if (!this.showMaps) {
      this.showMaps = true;
      this.status.setState('management_show_maps', { showMaps: true });
      console.log('🗺️ Mapa activado desde cerrado');
    } else {
      console.log('🗺️ Mapa ya estaba abierto, actualizando target seleccionado');
    }
    
    // SIEMPRE forzar actualización del mapa para que se centre en el nuevo target
    // Esto es necesario tanto si el mapa estaba cerrado como si ya estaba abierto
    this.mapsKey = Date.now();
    console.log('🗺️ Mapa actualizado con nueva key para target:', this.selectedTargetForMap.name);
    
    // Actualizar URL con el query parameter del target seleccionado
    this.updateUrlWithTargetId(target._id);
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
            this.targetsList = targets.map((target: Target) => {
              // Usar traccarInfo.status en lugar de target.status
              const traccarStatus = target.traccarInfo?.status || 'offline';
              const isOnline = traccarStatus === 'online';
              
              return {
                name: target.name,
                status: isOnline ? this.translate.instant('management.status.online') : this.translate.instant('management.status.offline'),
                imei: target.device_imei || target.imei, // Intentar ambos campos
                sim: target.sim_card_number || target.sim_card, // Intentar ambos campos
                _id: target._id,
                traccarStatus: traccarStatus,
                // ✅ NUEVA: Incluir toda la información del target original, especialmente traccarInfo
                traccarInfo: target.traccarInfo, // Incluir geolocalización y otros datos de traccar
                originalTarget: target // Incluir el target completo para casos complejos
              };
            });
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
        
        // Llamar al getUserPath para actualizar el breadcrumb correctamente
        this.userService.getUserPath(user._id).subscribe({
          next: (pathData) => {
            console.log('Datos de ruta del usuario al entrar:', pathData);
            this.updateBreadcrumbFromPath(pathData);
          },
          error: (error) => {
            console.error('Error al obtener ruta del usuario:', error);
            // En caso de error, mostrar solo el usuario actual
            this.updateBreadcrumbFromPath([]);
          }
        });
        
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
      console.log('🔍 ===== RESPUESTA COMPLETA DEL API DE TARGETS =====');
      console.log('📊 Cantidad de targets recibidos:', targets?.length || 0);
      console.log('📋 Respuesta completa del API:', JSON.stringify(targets, null, 2));
      
      if (targets && targets.length > 0) {
        console.log('🎯 ===== ANÁLISIS DEL PRIMER TARGET =====');
        const firstTarget = targets[0];
        console.log('📝 Target completo:', JSON.stringify(firstTarget, null, 2));
        console.log('🏷️ Nombre:', firstTarget.name);
        console.log('🆔 ID:', firstTarget._id);
        console.log('📱 IMEI:', firstTarget.device_imei || firstTarget.imei);
        console.log('📞 SIM:', firstTarget.sim_card_number || firstTarget.sim_card);
        console.log('📡 traccarInfo completo:', JSON.stringify(firstTarget.traccarInfo, null, 2));
        console.log('📍 Geolocalización:', firstTarget.traccarInfo?.['geolocation']);
        console.log('🔄 Status:', firstTarget.traccarInfo?.status);
        console.log('🚗 Speed:', firstTarget.traccarInfo?.['speed']);
        console.log('🔗 originalTarget:', (firstTarget as any).originalTarget ? 'Existe' : 'No existe');
      }
      
      this.targets = targets;
      
      // Verificar si hay datos antes de transformarlos
      if (targets && targets.length > 0) {
        console.log('Primer objetivo recibido:', targets[0]);
        this.targetsList = targets.map(target => {
          // Usar traccarInfo.status en lugar de target.status
          const traccarStatus = target.traccarInfo?.status || 'offline';
          const isOnline = traccarStatus === 'online';
          
          console.log('Mapeando target:', target.name, 'con traccarInfo.status:', traccarStatus);
          console.log('Target con IMEI:', target.device_imei || target.imei, 'y SIM:', target.sim_card_number || target.sim_card);
          
          return {
            name: target.name,
            status: isOnline ? this.translate.instant('management.status.online') : this.translate.instant('management.status.offline'),
            imei: target.device_imei || target.imei, // Intentar ambos campos
            sim: target.sim_card_number || target.sim_card, // Intentar ambos campos
            _id: target._id,
            traccarStatus: traccarStatus, // Mantener el status original para debugging
            // ✅ NUEVA: Incluir toda la información del target original, especialmente traccarInfo
            traccarInfo: target.traccarInfo, // Incluir geolocalización y otros datos de traccar
            originalTarget: target // Incluir el target completo para casos complejos
          };
        });
      } else {
        console.log('No se recibieron objetivos del API');
        this.targetsList = [];
      }
      
      console.log('Objetivos transformados para la UI:', this.targetsList);
      
      // Verificar si hay un target en la URL para seleccionarlo automáticamente
      // Se ejecuta después de cargar los targets para asegurar que estén disponibles
      setTimeout(() => {
        this.checkAndLoadTargetFromUrl();
      }, 100);
      
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

  // Método para obtener y mostrar datos de un target específico
  async loadTargetDetails(target: any) {
    try {
      console.log('Obteniendo datos del target:', target.name, target._id);
      
      // Obtener los datos completos del target
      const targetDetails = await this.targetsService.getTargetById(target._id);
      console.log('Datos completos del target:', targetDetails);
      
      // Aquí puedes decidir qué hacer con los datos:
      // 1. Mostrar un modal con los datos
      // 2. Navegar a una vista de detalles
      // 3. Actualizar alguna propiedad del componente
      // 4. Mostrar en consola (por ahora)
      
      // Por ejemplo, si quieres mostrar un mensaje con algunos datos:
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

  // Método para actualizar el breadcrumb con los datos del path
  private updateBreadcrumbFromPath(pathData: any[]): void {
    if (!pathData || !Array.isArray(pathData) || pathData.length === 0) {
      // Si no hay datos de path, usar solo el usuario actual
      if (this.selectedUser) {
        this.items = [
          { label: `${this.selectedUser.name} ${this.selectedUser.last_name}` }
        ];
      }
      return;
    }

    // Convertir los datos del path en elementos del breadcrumb
    this.items = pathData.map((pathItem, index) => {
      const isLast = index === pathData.length - 1;
      
      return {
        label: pathItem.fullName,
        // Para elementos que no son el último, agregar comando para navegar
        command: !isLast ? () => {
          console.log('Navegando a usuario:', pathItem.fullName, pathItem.id);
          // Navegar al usuario específico del path
          this.managementService.setOp('u', pathItem.id);
        } : undefined,
        // Solo el último elemento no será clickeable
        disabled: isLast
      };
    });

    console.log('Breadcrumb actualizado con:', this.items);
  }

  // Métodos privados para polling
  private startTargetsPolling(): void {
    console.log('🔄 Iniciando polling de targets cada', this.POLLING_INTERVAL / 1000, 'segundos');
    
    // Crear observable que ejecuta cada 10 segundos
    this.pollingSubscription = interval(this.POLLING_INTERVAL)
      .pipe(
        // Solo ejecutar si hay un usuario seleccionado
        filter(() => !!this.selectedUser?._id)
      )
      .subscribe(() => {
        this.updateTargetsData();
      });
  }

  private async updateTargetsData(): Promise<void> {
    if (!this.selectedUser?._id) return;
    
    try {
      console.log('🔄 Actualizando datos de targets (polling)...');
      
      // Obtener el ID del usuario padre como antes
      const parentId = this.managementService.getCurrentUserId();
      
      // Obtener datos actualizados de targets
      const updatedTargets = await this.targetsService.getTargetsByUserId(this.selectedUser._id, parentId);
      
      console.log('🔄 ===== POLLING - TARGETS ACTUALIZADOS =====');
      console.log('📊 Cantidad actualizada:', updatedTargets?.length || 0);
      if (updatedTargets && updatedTargets.length > 0) {
        const firstUpdated = updatedTargets[0];
        console.log('📍 Primera ubicación actualizada:', firstUpdated.traccarInfo?.['geolocation']);
        console.log('🔄 Primer status actualizado:', firstUpdated.traccarInfo?.status);
        console.log('🚗 Primera velocidad actualizada:', firstUpdated.traccarInfo?.['speed']);
      }
      
      if (updatedTargets && updatedTargets.length > 0) {
        // Actualizar el array principal de targets
        this.targets = updatedTargets;
        
        // Transformar para la UI como en loadTargetsForUser
        this.targetsList = updatedTargets.map(target => {
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
        
        // Si hay un target seleccionado en el mapa, actualizar su información
        if (this.selectedTargetForMap) {
          this.updateSelectedTargetLocation(updatedTargets);
        }
        
        console.log('✅ Targets actualizados:', this.targetsList.length, 'dispositivos');
      }
      
    } catch (error) {
      console.error('❌ Error actualizando targets:', error);
    }
  }

  private updateSelectedTargetLocation(updatedTargets: Target[]): void {
    if (!this.selectedTargetForMap?._id) return;
    
    // Buscar el target actualizado que coincida con el seleccionado
    const updatedTarget = updatedTargets.find(target => target._id === this.selectedTargetForMap._id);
    
    if (updatedTarget?.traccarInfo?.['geolocation']) {
      console.log('🎯 Actualizando ubicación del target seleccionado:', updatedTarget.name);
      
      // Actualizar las coordenadas del target seleccionado
      const lat = updatedTarget.traccarInfo['geolocation'].latitude;
      const lng = updatedTarget.traccarInfo['geolocation'].longitude;
      
      if (lat && lng) {
        // Verificar si las coordenadas han cambiado significativamente
        const oldLat = this.selectedTargetForMap.traccarInfo?.geolocation?.latitude;
        const oldLng = this.selectedTargetForMap.traccarInfo?.geolocation?.longitude;
        
        const hasLocationChanged = !oldLat || !oldLng || 
          Math.abs(lat - oldLat) > 0.0001 || Math.abs(lng - oldLng) > 0.0001;
        
        // Crear nuevo objeto targetForMap con datos actualizados
        const updatedTargetForMap = {
          ...this.selectedTargetForMap,
          traccarInfo: {
            ...updatedTarget.traccarInfo,
            geolocation: {
              latitude: lat,
              longitude: lng
            }
          }
        };
        
        // Actualizar el target seleccionado
        this.selectedTargetForMap = updatedTargetForMap;
        
        if (hasLocationChanged) {
          console.log('📍 Ubicación actualizada (sin centrar mapa):', lat, lng);
          console.log('🔄 Posición anterior:', oldLat, oldLng, '-> Nueva:', lat, lng);
          
          // Solo actualizar mapsKey si es la primera selección (para centrar)
          // Para actualizaciones posteriores, el componente de mapas moverá el marcador suavemente
          if (this.shouldCenterMapOnUpdate) {
            this.mapsKey = Date.now();
            this.shouldCenterMapOnUpdate = false; // Desactivar centrado automático después de la primera vez
            console.log('🎯 Primera selección - centrando mapa');
          } else {
            // NO cambiar mapsKey para evitar recrear el marcador
            // El cambio en selectedTargetForMap será detectado por ngOnChanges del componente de mapas
            // y solo actualizará la posición del marcador existente
            console.log('🔄 Actualización suave de posición - marcador se moverá sin recrearse');
          }
        }
      }
    }
  }

  @HostListener('window:resize', ['$event'])
  private onResize(): void {
    this.screenService.checkScreenSize();
  }

  // Métodos para manejo de URL con query parameters
  private updateUrlWithTargetId(targetId: string): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { target: targetId },
      queryParamsHandling: 'merge'
    });
    console.log('🔗 URL actualizada con target ID:', targetId);
  }

  private clearTargetFromUrl(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { target: null },
      queryParamsHandling: 'merge'
    });
    console.log('🔗 Query parameter "target" removido de la URL');
  }

  private checkAndLoadTargetFromUrl(): void {
    this.route.queryParams.subscribe(params => {
      const targetId = params['target'];
      if (targetId && this.targets.length > 0) {
        console.log('🔍 Buscando target con ID desde URL:', targetId);
        
        const targetToSelect = this.targets.find(target => target._id === targetId);
        if (targetToSelect) {
          console.log('✅ Target encontrado, seleccionando automáticamente:', targetToSelect.name);
          
          // Activar el mapa si no está activo
          if (!this.showMaps) {
            this.showMaps = true;
            this.status.setState('management_show_maps', { showMaps: this.showMaps });
          }
          
          // Seleccionar el target en el mapa (sin actualizar URL para evitar loop)
          this.selectTargetForMapWithoutUrlUpdate(targetToSelect);
        } else {
          console.log('❌ No se encontró target con ID:', targetId);
        }
      }
    });
  }

  private selectTargetForMapWithoutUrlUpdate(target: any): void {
    console.log('🗺️ Seleccionando target para mapa (sin actualizar URL):', target);
    
    // Verificar geolocalización como en showTargetOnMap
    let lat = null;
    let lng = null;
    
    if (target.traccarInfo?.geolocation?.latitude && target.traccarInfo?.geolocation?.longitude) {
      lat = target.traccarInfo.geolocation.latitude;
      lng = target.traccarInfo.geolocation.longitude;
    } else if (target.traccarInfo?.latitude && target.traccarInfo?.longitude) {
      lat = target.traccarInfo.latitude;
      lng = target.traccarInfo.longitude;
    } else if (target.originalTarget?.traccarInfo?.geolocation?.latitude && target.originalTarget?.traccarInfo?.geolocation?.longitude) {
      lat = target.originalTarget.traccarInfo.geolocation.latitude;
      lng = target.originalTarget.traccarInfo.geolocation.longitude;
    } else if (target.originalTarget?.traccarInfo?.latitude && target.originalTarget?.traccarInfo?.longitude) {
      lat = target.originalTarget.traccarInfo.latitude;
      lng = target.originalTarget.traccarInfo.longitude;
    } else if (target.traccarInfo?.lat && target.traccarInfo?.lon) {
      lat = target.traccarInfo.lat;
      lng = target.traccarInfo.lon;
    }

    if (!lat || !lng) {
      console.warn('❌ El target desde URL no tiene información de geolocalización válida');
      return;
    }

    // Crear objeto target con la estructura esperada por el mapa
    const targetForMap = {
      ...target,
      traccarInfo: {
        ...target.traccarInfo,
        geolocation: {
          latitude: lat,
          longitude: lng
        }
      }
    };

    // Almacenar el target seleccionado
    this.selectedTargetForMap = targetForMap;
    
    // Reactivar el centrado automático para la selección desde URL
    this.shouldCenterMapOnUpdate = true;
    
    // Forzar actualización del mapa
    this.mapsKey = Date.now();
    console.log('🗺️ Mapa actualizado desde URL con nueva key para target:', this.selectedTargetForMap.name);
  }

  ngOnDestroy(): void {
    // Limpiar el polling cuando el componente se destruya
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      console.log('🔄 Polling de targets detenido');
    }
  }
}
