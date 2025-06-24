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
import { VehicleBrandsService } from '@core/services/vehicle-brands.service';
import { MarkerService } from '@shared/helpers/map-service.helper';

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
  mapsKey: string | null = 'mapbox'; // Key que cambia solo cuando cambia el proveedor
  targets: Target[] = [];
  targetToEdit: any | null = null;
  selectedTargetForMap: any | null = null;
  shouldCenterMapOnUpdate: boolean = true; // Controla si el mapa debe centrarse en actualizaciones
  selectedTargetStopTime: string | undefined = undefined; // Tiempo de parada del target seleccionado
  
  // Variables para controlar estado interno
  private pollingSubscription: Subscription | null = null;
  private readonly POLLING_INTERVAL = 10000; // 10 segundos
  
  // Control de procesos activos por target
  private activeTargetProcesses: Map<string, AbortController> = new Map();
  private currentTargetId: string | null = null;
  private isProcessingTargetFromUrl: boolean = false; // Bandera para evitar doble procesamiento

  
  // Cache para tipos de vehículos, marcas y modelos
  private vehicleTypes: any[] = [];
  private vehicleBrands: any[] = [];
  private vehicleModels: any[] = [];

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
    private vehicleBrandsService: VehicleBrandsService
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
      this.mapsKey = this.providerType; // Inicializar con el proveedor
    } else {
      this.selectedMap = `mapbox-${defaultTheme}`;
      this.providerType = 'mapbox';
      this.providerTheme = defaultTheme;
      this.mapsKey = this.providerType; // Inicializar con el proveedor
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
        this.showMaps = newShowMaps;
        
        // Solo limpiar selectedTargetForMap si se está cerrando el mapa desde el subscription
        if (!this.showMaps && this.selectedTargetForMap) {
          this.selectedTargetForMap = null;
        }
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
    
    // Cargar datos de vehículos (tipos, marcas, modelos)
    this.loadVehicleData();
  }

  // Métodos públicos
  showMapsToggle() {
    this.showMaps = !this.showMaps;
    this.status.setState('management_show_maps', { showMaps: this.showMaps });
    
    // Si se está cerrando el mapa, limpiar el query parameter y target seleccionado
    if (!this.showMaps) {
      console.log('🗑️ Cerrando mapa, limpiando target seleccionado');
      this.clearSelectedTarget();
    }
  }

  private clearSelectedTarget(): void {
    console.log('🧹 LIMPIANDO COMPLETAMENTE target seleccionado para mapa');
    
    // CANCELAR TODOS LOS PROCESOS DEL TARGET ACTUAL
    if (this.currentTargetId) {
      console.log('🛑 Cancelando COMPLETAMENTE procesos para target:', this.currentTargetId);
      this.cancelAllTargetProcesses(this.currentTargetId);
    }
    
    // LIMPIAR COMPLETAMENTE EL ESTADO
    console.log('🧹 Limpiando estado del target anterior');
    this.selectedTargetForMap = null;
    this.selectedTargetStopTime = undefined; // Limpiar tiempo de parada
    this.shouldCenterMapOnUpdate = true; // Resetear para la próxima selección
    this.currentTargetId = null; // Limpiar ID del target actual
    this.isProcessingTargetFromUrl = false; // Limpiar bandera de procesamiento
    
    // LIMPIAR URL
    this.clearTargetFromUrl();
    
    console.log('✅ Target anterior COMPLETAMENTE limpiado');
  }

  // Método para cancelar todos los procesos de un target específico
  private cancelAllTargetProcesses(targetId: string): void {
    console.log('🛑 Cancelando TODOS los procesos para target:', targetId);
    
    // Cancelar procesos HTTP específicos del target
    const abortController = this.activeTargetProcesses.get(targetId);
    if (abortController) {
      console.log('🛑 Cancelando solicitudes HTTP para target:', targetId);
      abortController.abort();
      this.activeTargetProcesses.delete(targetId);
    }
    
    // Cancelar procesos del MarkerService
    console.log('🛑 Cancelando procesos del MarkerService para target:', targetId);
    try {
      MarkerService.cancelTargetProcesses(targetId);
    } catch (error) {
      console.warn('Error cancelando procesos del MarkerService:', error);
    }
  }

  // Nuevo método para mostrar target específico en el mapa
  showTargetOnMap(target: any) {
    console.log('🎯 showTargetOnMap called for target:', target._id);
    console.log('🔍 DEBUG: Target completo desde lista:', target);
    console.log('🔍 DEBUG: Target.traccarInfo:', target.traccarInfo);
    console.log('🔍 DEBUG: Target.api_device_id:', target.api_device_id);
    console.log('🔍 DEBUG: Target status:', target?.traccarInfo?.status);
    
    // Verificar si es el mismo target que ya está seleccionado
    if (this.currentTargetId === target._id) {
      console.log('⚠️ El mismo target ya está seleccionado, no hacer nada:', target._id);
      return;
    }
    
    // CANCELACIÓN COMPLETA DEL TARGET ANTERIOR
    if (this.currentTargetId && this.currentTargetId !== target._id) {
      console.log('🛑 CANCELANDO COMPLETAMENTE target anterior:', this.currentTargetId);
      this.cancelAllTargetProcesses(this.currentTargetId);
      
      // Limpiar estado del target anterior
      this.selectedTargetForMap = null;
      this.selectedTargetStopTime = undefined;
    }
    
    // SELECCIÓN DEL NUEVO TARGET
    console.log('🆕 Seleccionando nuevo target:', target._id);
    this.currentTargetId = target._id;
    
    // Crear AbortController para el nuevo target
    const abortController = new AbortController();
    this.activeTargetProcesses.set(target._id, abortController);
    
    // Proceder con la selección del nuevo target
    this.selectNewTargetForMap(target, abortController);
  }

  private async selectNewTargetForMap(target: any, abortController?: AbortController) {
    console.log('🆕 Seleccionando nuevo target para mapa:', target._id);
    
    // Verificar múltiples posibles estructuras de geolocalización
    let lat = null;
    let lng = null;
    
         // Opción 1: traccarInfo.geolocation (nombres en inglés)
     if (target.traccarInfo?.geolocation?.latitude && target.traccarInfo?.geolocation?.longitude) {
       lat = parseFloat(target.traccarInfo.geolocation.latitude);
       lng = parseFloat(target.traccarInfo.geolocation.longitude);
     }
    // Opción 2: traccarInfo directamente
    else if (target.traccarInfo?.latitude && target.traccarInfo?.longitude) {
      lat = parseFloat(target.traccarInfo.latitude);
      lng = parseFloat(target.traccarInfo.longitude);
    }
         // Opción 3: originalTarget.traccarInfo.geolocation (nombres en inglés)
     else if (target.originalTarget?.traccarInfo?.geolocation?.latitude && target.originalTarget?.traccarInfo?.geolocation?.longitude) {
       lat = parseFloat(target.originalTarget.traccarInfo.geolocation.latitude);
       lng = parseFloat(target.originalTarget.traccarInfo.geolocation.longitude);
     }
    // Opción 4: originalTarget.traccarInfo directamente
    else if (target.originalTarget?.traccarInfo?.latitude && target.originalTarget?.traccarInfo?.longitude) {
      lat = parseFloat(target.originalTarget.traccarInfo.latitude);
      lng = parseFloat(target.originalTarget.traccarInfo.longitude);
    }
    // Opción 5: traccarInfo con lat/lon
    else if (target.traccarInfo?.lat && target.traccarInfo?.lon) {
      lat = parseFloat(target.traccarInfo.lat);
      lng = parseFloat(target.traccarInfo.lon);
    }
    
    // Validar que las coordenadas sean números válidos
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      console.log('❌ Coordenadas inválidas para target:', target._id);
      this.messageService.add({
        severity: 'warn',
        summary: 'Sin ubicación',
        detail: 'Este dispositivo no tiene información de ubicación disponible'
      });
      return;
    }

             // Crear objeto target con la estructura esperada por el mapa
    
    // Priorizar la geolocation completa cuando esté disponible
    let geolocationToUse;
    if (target.traccarInfo?.geolocation) {
      geolocationToUse = target.traccarInfo.geolocation;
    } else if (target.originalTarget?.traccarInfo?.geolocation) {
      geolocationToUse = target.originalTarget.traccarInfo.geolocation;
    } else {
      geolocationToUse = {
        latitude: lat,
        longitude: lng
      };
    }
    
    const targetForMap = {
      ...target,
      traccarInfo: {
        ...target.traccarInfo,
        geolocation: geolocationToUse
      }
    };

    console.log('✅ Target preparado para mapa:', targetForMap._id, 'con coordenadas:', lat, lng);
    
    // DEBUG DETALLADO PARA RASTREAR PROBLEMA DE CENTRADO
    console.log('🔍 DEBUG MANAGEMENT: Target preparado con coordenadas exactas:', {
      targetId: targetForMap._id,
      lat: lat.toFixed(6),
      lng: lng.toFixed(6),
      geolocationCompleta: targetForMap.traccarInfo?.geolocation,
      coordenadasOriginales: { lat, lng }
    });

    // Almacenar el target seleccionado
    this.selectedTargetForMap = targetForMap;
    
    // Reactivar el centrado automático para la nueva selección
    this.shouldCenterMapOnUpdate = true;
    
    // Activar la vista del mapa INMEDIATAMENTE
    // Solo cambiar el estado si no está ya activo
    if (!this.showMaps) {
      console.log('🔍 DEBUG: Activando vista de mapa inmediatamente (sin esperar tiempo de parada)');
      this.showMaps = true;
      this.status.setState('management_show_maps', { showMaps: true });
    }
    
    // CONSULTAR TIEMPO DE PARADA EN SEGUNDO PLANO (sin bloquear)
    console.log('🔍 DEBUG: Iniciando consulta de tiempo de parada en segundo plano, selectedTargetStopTime:', this.selectedTargetStopTime);
    this.consultarTiempoDeParadaEnSegundoPlano(targetForMap, abortController);
    // Si el mapa ya está visible, NO recrearlo, solo actualizar el target
    
    // Actualizar URL con el query parameter del target seleccionado
    this.updateUrlWithTargetId(target._id);
  }

  // Método para consultar tiempo de parada en segundo plano (sin bloquear)
  private async consultarTiempoDeParadaEnSegundoPlano(target: any, abortController?: AbortController): Promise<void> {
    try {
      console.log('🔍 DEBUG: consultarTiempoDeParadaEnSegundoPlano iniciado para target:', target._id);
      const stopTime = await this.consultarTiempoDeParada(target, abortController);
      console.log('🔍 DEBUG: Resultado de consulta en segundo plano:', stopTime);
      
      // Actualizar selectedTargetStopTime con el resultado
      this.selectedTargetStopTime = stopTime;
      console.log('🔍 DEBUG: selectedTargetStopTime actualizado a:', this.selectedTargetStopTime);
    } catch (error) {
      console.warn('Error en consulta de tiempo de parada en segundo plano:', error);
      this.selectedTargetStopTime = undefined;
    }
  }

  // Método para consultar tiempo de parada inmediatamente
  private async consultarTiempoDeParada(target: any, abortController?: AbortController): Promise<string | undefined> {
    console.log('🔍 DEBUG: consultarTiempoDeParada iniciado para target:', target._id);
    
    // VERIFICAR SI EL PROCESO HA SIDO CANCELADO
    if (abortController?.signal.aborted) {
      console.log('🛑 consultarTiempoDeParada: Proceso cancelado antes de iniciar para target:', target._id);
      return undefined;
    }
    
    // Determinar qué deviceId usar: api_device_id o traccarInfo.id como fallback
    const deviceId = target.api_device_id || target.traccarInfo?.id?.toString();
    
    if (!deviceId) {
      console.log('⚠️ Target sin api_device_id ni traccarInfo.id, no se puede consultar tiempo de parada:', target._id);
      console.log('🔍 DEBUG: target data:', {
        _id: target._id,
        api_device_id: target.api_device_id,
        traccar_device_id: target.traccar_device_id,
        device_id: target.device_id,
        traccarInfoId: target.traccarInfo?.id
      });
      return undefined;
    }
    
    console.log('🔍 DEBUG: Usando deviceId para consulta:', deviceId, '(fuente:', target.api_device_id ? 'api_device_id' : 'traccarInfo.id', ')');

    const status = target?.traccarInfo?.status || 'offline';
    console.log('🔍 DEBUG: status del target:', status);
    
    if (status !== 'online') {
      console.log('⚠️ Target offline, no se consulta tiempo de parada:', target._id);
      return undefined;
    }

    try {
      console.log('🔄 Consultando tiempo de parada inmediatamente para device:', deviceId);
      const stopTimeResponse = await this.targetsService.getStopTime(deviceId);
      console.log('📊 Respuesta tiempo de parada inmediata COMPLETA:', stopTimeResponse);
      
      // VERIFICAR NUEVAMENTE SI EL PROCESO HA SIDO CANCELADO DESPUÉS DE LA CONSULTA
      if (abortController?.signal.aborted) {
        console.log('🛑 consultarTiempoDeParada: Proceso cancelado después de consulta HTTP para target:', target._id);
        return undefined;
      }
      
      if (!stopTimeResponse.isMoving && stopTimeResponse.text && !stopTimeResponse.error) {
        console.log('✅ Tiempo de parada obtenido inmediatamente:', stopTimeResponse.text);
        console.log('🔍 DEBUG: Asignando selectedTargetStopTime:', stopTimeResponse.text);
        this.selectedTargetStopTime = stopTimeResponse.text;
        return stopTimeResponse.text;
      } else if (stopTimeResponse.isMoving) {
        console.log('🚗 Vehículo en movimiento (consulta inmediata)');
        console.log('🔍 DEBUG: selectedTargetStopTime será undefined por isMoving=true');
        return undefined;
      } else if (stopTimeResponse.error) {
        console.log('❌ Error en consulta inmediata:', stopTimeResponse.error);
        return undefined;
      }
    } catch (error) {
      console.warn('Error consultando tiempo de parada inmediatamente:', error);
      console.log('🔍 DEBUG: Error completo:', error);
    }
    
    return undefined;
  }

  // Método para navegar al usuario padre
  goToParent() {
    if (!this.selectedUser) return;

    // Verificar si el usuario actual tiene parent_id usando acceso con casting
    const parentId = (this.selectedUser as any).parent_id;
    if (!parentId) {
      return;
    }

    // Mostrar skeletons inmediatamente
    this.loading = true;
    
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
      // Obtener el ID del usuario de la URL (management) como parent
      const parentId = this.managementService.getCurrentUserId();
      
      this.targetsService.searchTargets(this.searchTargetsTerm, parentId)
        .then((targets: Target[]) => {
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
            this.targetsList = [];
          }
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
    const previousProvider = this.providerType;
    
    // Obtener el target actual de la URL para reseleccionarlo después
    const currentTargetInUrl = this.route.snapshot.queryParams['target'];
    
    // Actualizar providerType y providerTheme basado en la selección
    if (value.startsWith('google')) {
      this.providerType = 'google';
      this.providerTheme = value.includes('dark') ? 'dark' : 'light';
    } else {
      this.providerType = 'mapbox';
      this.providerTheme = value.includes('dark') ? 'dark' : 'light';
    }
    
    // Solo recrear el componente si cambió el proveedor (no solo el tema)
    if (previousProvider !== this.providerType) {
      console.log('🔄 Provider changed from', previousProvider, 'to', this.providerType);
      console.log('🎯 Target en URL a reseleccionar:', currentTargetInUrl);
      
      // CANCELAR COMPLETAMENTE EL TARGET ACTUAL ANTES DEL CAMBIO
      if (this.currentTargetId) {
        console.log('🛑 Cancelando target actual antes de cambio de proveedor:', this.currentTargetId);
        this.cancelAllTargetProcesses(this.currentTargetId);
        this.currentTargetId = null;
      }
      
      // IMPORTANTE: Resetear completamente el MarkerService antes de cambiar proveedor
      MarkerService.resetService();
      
      // Limpiar el target seleccionado para forzar limpieza
      this.selectedTargetForMap = null;
      this.selectedTargetStopTime = undefined;
      
      // Primero destruir el componente
      this.mapsKey = null;
      
      // Luego recrearlo después de un breve delay para asegurar limpieza completa
      setTimeout(() => {
        this.mapsKey = this.providerType + '-' + Date.now();
        console.log('✅ Componente Maps recreado con nueva key:', this.mapsKey);
        
        // Después de recrear el componente, reseleccionar el target de la URL
        setTimeout(() => {
          if (currentTargetInUrl) {
            console.log('🔄 RESELECCIONANDO target desde URL después de cambio de proveedor:', currentTargetInUrl);
            this.checkAndLoadTargetFromUrlDirect();
          } else {
            console.log('ℹ️ No hay target en URL para reseleccionar después de cambio de proveedor');
          }
        }, 300); // Delay mayor para asegurar que el componente esté completamente cargado
        
      }, 150);
    } else {
      console.log('🎨 Solo cambió el tema, no se necesita recreación');
    }
  }

  // Método para cargar objetivos de un usuario específico
  private async loadTargetsForUser(userId: string) {
    try {
      // Obtener el ID del usuario de la URL (management) como parent
      const parentId = this.managementService.getCurrentUserId();
      
      // Pasar el ID del usuario y el parent al método del servicio
      const targets = await this.targetsService.getTargetsByUserId(userId, parentId);
      
      this.targets = targets;
      
      // Verificar si hay datos antes de transformarlos
      if (targets && targets.length > 0) {
        this.targetsList = targets.map(target => {
          // Usar traccarInfo.status en lugar de target.status
          const traccarStatus = target.traccarInfo?.status || 'offline';
          const isOnline = traccarStatus === 'online';
          
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
          this.targetsList = [];
        }
      
      // Verificar si hay un target en la URL para seleccionarlo automáticamente
      // Se ejecuta después de cargar los targets para asegurar que estén disponibles
      setTimeout(() => {
        this.checkAndLoadTargetFromUrlDirect();
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
      
      // Obtener los datos completos del target
      const targetDetails = await this.targetsService.getTargetById(target._id);
      
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
          // Navegar al usuario específico del path
          this.managementService.setOp('u', pathItem.id);
        } : undefined,
        // Solo el último elemento no será clickeable
        disabled: isLast
      };
    });
  }

  // Métodos privados para polling
  private startTargetsPolling(): void {
    console.log('🔄 Iniciando polling de targets cada', this.POLLING_INTERVAL / 1000, 'segundos');
    
    // Crear observable que ejecuta cada 10 segundos
    this.pollingSubscription = interval(this.POLLING_INTERVAL)
      .pipe(
        // Solo ejecutar si hay un usuario seleccionado
        filter(() => {
          const hasUser = !!this.selectedUser?._id;
          if (!hasUser) {
            console.log('⏸️ Polling pausado - no hay usuario seleccionado');
          }
          return hasUser;
        })
      )
      .subscribe(() => {
        console.log('⏰ EJECUTANDO polling de targets...');
        this.updateTargetsData();
      });
  }

  private async updateTargetsData(): Promise<void> {
    if (!this.selectedUser?._id) return;
    
    try {
      
      // Obtener el ID del usuario padre como antes
      const parentId = this.managementService.getCurrentUserId();
      
      // Obtener datos actualizados de targets
      const updatedTargets = await this.targetsService.getTargetsByUserId(this.selectedUser._id, parentId);
      
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
        
        // Si hay un target seleccionado en el mapa, obtener sus detalles específicos
        if (this.selectedTargetForMap?._id) {
          await this.updateSelectedTargetDetails();
        }
      }
      
    } catch (error) {
      console.error('❌ Error actualizando targets:', error);
    }
  }

  private async updateSelectedTargetDetails(): Promise<void> {
    if (!this.selectedTargetForMap?._id) return;
    
    // VERIFICACIÓN CRÍTICA: Verificar que el target actual siga siendo el target activo
    if (this.currentTargetId !== this.selectedTargetForMap._id) {
      console.log('🛑 POLLING CANCELADO: Target cambió durante polling');
      console.log('🛑 Target esperado:', this.currentTargetId);
      console.log('🛑 Target en polling:', this.selectedTargetForMap._id);
      return;
    }
    
    // VERIFICACIÓN ADICIONAL: Verificar que el proceso no haya sido cancelado
    if (!this.activeTargetProcesses.has(this.selectedTargetForMap._id)) {
      console.log('🛑 POLLING CANCELADO: Proceso de target ya fue cancelado');
      console.log('🛑 Target ID:', this.selectedTargetForMap._id);
      return;
    }
    
    try {
      // Usar el método específico para obtener detalles del target seleccionado
      const updatedTargetDetails = await this.targetsService.getTargetById(this.selectedTargetForMap._id);
      
      // Console para ver los detalles completos del target
      console.log('🎯 DETALLES DEL TARGET ESPECÍFICO:', {
        targetId: this.selectedTargetForMap._id,
        targetName: updatedTargetDetails.name,
        detallesCompletos: updatedTargetDetails,
        traccarInfo: updatedTargetDetails.traccarInfo,
        geolocation: updatedTargetDetails.traccarInfo?.['geolocation'],
        geolocationAttributes: updatedTargetDetails.traccarInfo?.['geolocation']?.attributes,
        geolocationSpeed: updatedTargetDetails.traccarInfo?.['geolocation']?.speed,
        geolocationVelocity: updatedTargetDetails.traccarInfo?.['geolocation']?.velocity,
        allGeolocationProps: updatedTargetDetails.traccarInfo?.['geolocation'] ? Object.keys(updatedTargetDetails.traccarInfo['geolocation']) : [],
        status: updatedTargetDetails.traccarInfo?.status
      });
      
      if (updatedTargetDetails?.traccarInfo?.['geolocation']) {
        
        // Actualizar las coordenadas del target seleccionado
        const lat = updatedTargetDetails.traccarInfo['geolocation'].latitude;
        const lng = updatedTargetDetails.traccarInfo['geolocation'].longitude;
        
        if (lat && lng) {
          // Verificar si las coordenadas han cambiado significativamente
          const oldLat = this.selectedTargetForMap.traccarInfo?.geolocation?.latitude;
          const oldLng = this.selectedTargetForMap.traccarInfo?.geolocation?.longitude;
          
          const hasLocationChanged = !oldLat || !oldLng || 
            Math.abs(lat - oldLat) > 0.0001 || Math.abs(lng - oldLng) > 0.0001;
          
          console.log('📍 Comparando coordenadas:', {
            oldLat: oldLat?.toFixed(6),
            newLat: lat?.toFixed(6),
            oldLng: oldLng?.toFixed(6),
            newLng: lng?.toFixed(6),
            latDiff: oldLat ? Math.abs(lat - oldLat) : 'N/A',
            lngDiff: oldLng ? Math.abs(lng - oldLng) : 'N/A',
            hasLocationChanged
          });
          
          // ACTUALIZAR PROPIEDADES DEL OBJETO EXISTENTE en lugar de reasignar
          // Esto preserva la referencia del objeto y evita disparos innecesarios de ngOnChanges
          if (!this.selectedTargetForMap.traccarInfo) {
            this.selectedTargetForMap.traccarInfo = {};
          }
          
          // Actualizar propiedades específicas preservando la estructura existente
          Object.assign(this.selectedTargetForMap, updatedTargetDetails);
          Object.assign(this.selectedTargetForMap.traccarInfo, updatedTargetDetails.traccarInfo);
          this.selectedTargetForMap.traccarInfo.geolocation = updatedTargetDetails.traccarInfo?.['geolocation'] || {
            latitude: lat,
            longitude: lng
          };
          
          // DEBUG: Verificar que el polling preserva la geolocation completa
          console.log('🔄 POLLING updateSelectedTargetDetails:');
          console.log('- Geolocation completa preservada:', this.selectedTargetForMap.traccarInfo?.geolocation);
          console.log('- Velocidad preservada:', this.selectedTargetForMap.traccarInfo?.geolocation?.speed);
          
          // NO reasignar this.selectedTargetForMap para preservar referencia del objeto
          
          if (hasLocationChanged) {
            console.log('🚀 UBICACIÓN CAMBIÓ! Activando actualización del mapa para target:', this.selectedTargetForMap._id);
            console.log('📍 Nueva ubicación:', { lat: lat.toFixed(6), lng: lng.toFixed(6) });
            
            // Para actualizaciones posteriores, el componente de mapas moverá el marcador suavemente
            if (this.shouldCenterMapOnUpdate) {
              this.shouldCenterMapOnUpdate = false; // Desactivar centrado automático después de la primera vez
            }
            // El cambio en selectedTargetForMap será detectado por ngOnChanges del componente de mapas
            // y solo actualizará la posición del marcador existente
          } else {
            console.log('📍 Sin cambios de ubicación detectados para target:', this.selectedTargetForMap._id);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Error actualizando detalles del target seleccionado:', error);
    }
  }

  private updateSelectedTargetLocation(updatedTargets: Target[]): void {
    if (!this.selectedTargetForMap?._id) return;
    
    // Buscar el target actualizado que coincida con el seleccionado
    const updatedTarget = updatedTargets.find(target => target._id === this.selectedTargetForMap._id);
    
    if (updatedTarget?.traccarInfo?.['geolocation']) {
      
      // Actualizar las coordenadas del target seleccionado
      const lat = updatedTarget.traccarInfo['geolocation'].latitude;
      const lng = updatedTarget.traccarInfo['geolocation'].longitude;
      
      if (lat && lng) {
        // Verificar si las coordenadas han cambiado significativamente
        const oldLat = this.selectedTargetForMap.traccarInfo?.geolocation?.latitude;
        const oldLng = this.selectedTargetForMap.traccarInfo?.geolocation?.longitude;
        
        const hasLocationChanged = !oldLat || !oldLng || 
          Math.abs(lat - oldLat) > 0.0001 || Math.abs(lng - oldLng) > 0.0001;
        
        // ACTUALIZAR PROPIEDADES DEL OBJETO EXISTENTE en lugar de reasignar
        // Esto preserva la referencia del objeto y evita disparos innecesarios de ngOnChanges
        if (!this.selectedTargetForMap.traccarInfo) {
          this.selectedTargetForMap.traccarInfo = {};
        }
        
        // Actualizar propiedades específicas preservando la estructura existente
        Object.assign(this.selectedTargetForMap.traccarInfo, updatedTarget.traccarInfo);
        this.selectedTargetForMap.traccarInfo.geolocation = updatedTarget.traccarInfo?.['geolocation'] || {
          latitude: lat,
          longitude: lng
        };
        
        // DEBUG: Verificar que el polling preserva la geolocation completa
        console.log('🔄 POLLING updateSelectedTargetLocation:');
        console.log('- Geolocation completa preservada:', this.selectedTargetForMap.traccarInfo?.geolocation);
        console.log('- Velocidad preservada:', this.selectedTargetForMap.traccarInfo?.geolocation?.speed);

        // NO reasignar this.selectedTargetForMap para preservar referencia del objeto
        
        if (hasLocationChanged) {
          
          // Para actualizaciones posteriores, el componente de mapas moverá el marcador suavemente
          if (this.shouldCenterMapOnUpdate) {
            this.shouldCenterMapOnUpdate = false; // Desactivar centrado automático después de la primera vez
          }
          // El cambio en selectedTargetForMap será detectado por ngOnChanges del componente de mapas
          // y solo actualizará la posición del marcador existente
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
  }

  private clearTargetFromUrl(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { target: null },
      queryParamsHandling: 'merge'
    });
  }



  // Nuevo método para verificación directa sin crear subscripción
  private checkAndLoadTargetFromUrlDirect(): void {
    // PREVENIR DOBLE PROCESAMIENTO
    if (this.isProcessingTargetFromUrl) {
      console.log('⏸️ Ya procesando target desde URL, saltando ejecución...');
      return;
    }
    
    // Obtener directamente los parámetros de la URL sin crear nueva subscripción
    const currentParams = this.route.snapshot.queryParams;
    const targetId = currentParams['target'];
    
    console.log('🔍 Verificando target en URL (directo):', { 
      targetId, 
      targetsAvailable: this.targets.length,
      currentlySelected: this.currentTargetId,
      selectedTargetForMap: this.selectedTargetForMap?._id,
      isProcessing: this.isProcessingTargetFromUrl
    });
    
    // VALIDACIÓN MEJORADA: Verificar tanto currentTargetId como selectedTargetForMap
    if (targetId && (this.currentTargetId === targetId || this.selectedTargetForMap?._id === targetId)) {
      console.log('✅ Target ya está seleccionado en el mapa, no reseleccionar:', targetId);
      return;
    }
    
    // VALIDACIÓN ADICIONAL: Si no hay targetId en URL, no hacer nada
    if (!targetId) {
      console.log('ℹ️ No hay target en URL para seleccionar');
      return;
    }
    
    // VALIDACIÓN: Verificar que los targets estén cargados
    if (this.targets.length === 0) {
      console.log('⏳ Target en URL pero targets no cargados aún, esperando...');
      return;
    }
    
    const targetToSelect = this.targets.find(target => target._id === targetId);
    if (targetToSelect) {
      console.log('✅ Target encontrado en URL, seleccionando:', targetToSelect._id);
      
      // MARCAR COMO PROCESANDO
      this.isProcessingTargetFromUrl = true;
      
      // Timeout de seguridad para resetear la bandera
      setTimeout(() => {
        if (this.isProcessingTargetFromUrl) {
          console.log('⚠️ Timeout de seguridad: reseteando bandera de procesamiento');
          this.isProcessingTargetFromUrl = false;
        }
      }, 5000); // 5 segundos
      
      // CANCELAR TARGET ANTERIOR SI ES DIFERENTE
      if (this.currentTargetId && this.currentTargetId !== targetId) {
        console.log('🛑 Cancelando target anterior desde URL directo:', this.currentTargetId);
        this.cancelAllTargetProcesses(this.currentTargetId);
      }
      
      // Activar el mapa si no está activo
      if (!this.showMaps) {
        console.log('🗺️ Activando mapa para target de URL');
        this.showMaps = true;
        this.status.setState('management_show_maps', { showMaps: this.showMaps });
      }
      
      // Seleccionar el target en el mapa (sin actualizar URL para evitar loop)
      this.selectTargetForMapWithoutUrlUpdate(targetToSelect)
        .finally(() => {
          // DESMARCAR COMO PROCESANDO AL FINALIZAR
          this.isProcessingTargetFromUrl = false;
          console.log('✅ Finalizado procesamiento de target desde URL');
        });
    } else {
      console.log('❌ Target de URL no encontrado en lista de targets:', targetId);
    }
  }

  private async selectTargetForMapWithoutUrlUpdate(target: any): Promise<void> {
    console.log('🎯 selectTargetForMapWithoutUrlUpdate called for target:', target._id);
    
    // VALIDACIÓN REFORZADA: Verificar múltiples condiciones para evitar doble selección
    if (this.currentTargetId === target._id || this.selectedTargetForMap?._id === target._id) {
      console.log('⚠️ El mismo target ya está seleccionado, no hacer nada:', target._id);
      return;
    }
    
    // CANCELACIÓN COMPLETA DEL TARGET ANTERIOR
    if (this.currentTargetId && this.currentTargetId !== target._id) {
      console.log('🛑 CANCELANDO target anterior desde URL:', this.currentTargetId);
      this.cancelAllTargetProcesses(this.currentTargetId);
      this.selectedTargetForMap = null;
      this.selectedTargetStopTime = undefined;
    }
    
    // ESTABLECER NUEVO TARGET COMO ACTIVO
    this.currentTargetId = target._id;
    const abortController = new AbortController();
    this.activeTargetProcesses.set(target._id, abortController);
    
    await this.selectTargetFromUrl(target, abortController);
  }

  private async selectTargetFromUrl(target: any, abortController?: AbortController): Promise<void> {
    console.log('🆕 Seleccionando target desde URL:', target._id);
    
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
      console.log('❌ Coordenadas inválidas para target desde URL:', target._id);
      return;
    }

    // Crear objeto target con la estructura esperada por el mapa
    
    // Priorizar la geolocation completa cuando esté disponible
    let geolocationToUse;
    if (target.traccarInfo?.['geolocation']) {
      console.log('✅ selectTargetFromUrl - Usando target.traccarInfo.geolocation (COMPLETA)');
      geolocationToUse = target.traccarInfo['geolocation'];
    } else if (target.originalTarget?.traccarInfo?.['geolocation']) {
      console.log('✅ selectTargetFromUrl - Usando target.originalTarget.traccarInfo.geolocation (COMPLETA)');
      geolocationToUse = target.originalTarget.traccarInfo['geolocation'];
    } else {
      console.log('⚠️ selectTargetFromUrl - Usando coordenadas básicas como fallback');
      geolocationToUse = {
        latitude: lat,
        longitude: lng
      };
    }
    
    const targetForMap = {
      ...target,
      traccarInfo: {
        ...target.traccarInfo,
        geolocation: geolocationToUse
      }
    };

    console.log('✅ Target desde URL preparado para mapa:', targetForMap._id, 'con coordenadas:', lat, lng);

    // Almacenar el target seleccionado
    this.selectedTargetForMap = targetForMap;
    
    // Reactivar el centrado automático para la selección desde URL
    this.shouldCenterMapOnUpdate = true;
    
    // CONSULTAR TIEMPO DE PARADA EN SEGUNDO PLANO (sin bloquear)
    console.log('🔍 DEBUG: Iniciando consulta de tiempo de parada en segundo plano desde URL');
    this.consultarTiempoDeParadaEnSegundoPlano(targetForMap, abortController);
  }

  // Métodos para manejo de datos de vehículos
  private async loadVehicleData(): Promise<void> {
    try {
      
      // Cargar tipos de vehículos, marcas y modelos en paralelo
      const [types, brands] = await Promise.all([
        this.vehicleBrandsService.getAllTypes(),
        this.vehicleBrandsService.getAllBrands()
      ]);
      
      this.vehicleTypes = types || [];
      this.vehicleBrands = brands || [];
      
      // Cargar todos los modelos para todas las marcas
      if (this.vehicleBrands.length > 0) {
        const allModels = await this.vehicleBrandsService.getAllModelsByBrand('all');
        this.vehicleModels = allModels || [];
      }
      
    } catch (error) {
      console.error('❌ Error al cargar datos de vehículos:', error);
    }
  }

  public getVehicleTypeByModelId(modelId: string): string {
    if (!modelId || this.vehicleModels.length === 0) {
      return 'Desconocido';
    }
    
    // Buscar el modelo por ID
    const model = this.vehicleModels.find(m => m._id === modelId);
    if (!model || !model.id_tipo_vehiculo) {
      return 'Desconocido';
    }
    
    // Buscar el tipo de vehículo por ID
    const vehicleType = this.vehicleTypes.find(t => t._id === model.id_tipo_vehiculo);
    return vehicleType ? vehicleType.nombre : 'Desconocido';
  }

  /**
   * Convierte velocidad de nudos a kilómetros por hora
   * @param speedInKnots Velocidad en nudos
   * @returns Velocidad en km/h
   */
  private convertKnotsToKmh(speedInKnots: number): number {
    return Math.round(speedInKnots * 1.852);
  }

  /**
   * Formatea la velocidad para mostrar "Estacionado" si es 0 o la velocidad en km/h
   * @param speedInKmh Velocidad en km/h
   * @returns String formateado de la velocidad
   */
  public formatSpeedDisplay(speedInKmh: number): string {
    if (speedInKmh === 0) {
      return this.translate.instant('common.parked') || 'Estacionado';
    }
    return `${speedInKmh} km/h`;
  }

  /**
   * Obtiene la velocidad actual del dispositivo
   * @param target Target del cual obtener la velocidad
   * @returns Velocidad formateada como string
   */
  public getDeviceSpeed(target: any): string {
    if (!target.traccarInfo || !target.traccarInfo.geolocation) {
      return '--';
    }

    const speedInKnots = target.traccarInfo.geolocation.speed || 0;
    const speedInKmh = this.convertKnotsToKmh(speedInKnots);
    
    return this.formatSpeedDisplay(speedInKmh);
  }

  private getVehicleModelName(modelId: string): string {
    if (!modelId || this.vehicleModels.length === 0) {
      return 'Desconocido';
    }
    
    const model = this.vehicleModels.find(m => m._id === modelId);
    return model ? model.nombre : 'Desconocido';
  }

  private getVehicleBrandName(brandId: string): string {
    if (!brandId || this.vehicleBrands.length === 0) {
      return 'Desconocido';
    }
    
    const brand = this.vehicleBrands.find(b => b._id === brandId);
    return brand ? brand.nombre : 'Desconocido';
  }

  ngOnDestroy(): void {
    console.log('🧹 INICIANDO LIMPIEZA COMPLETA del componente Management');
    
    // CANCELAR TODOS LOS PROCESOS ACTIVOS DE TARGETS
    if (this.currentTargetId) {
      console.log('🛑 ngOnDestroy: Cancelando procesos del target actual:', this.currentTargetId);
      this.cancelAllTargetProcesses(this.currentTargetId);
    }
    
    // CANCELAR CUALQUIER PROCESO ACTIVO RESTANTE
    if (this.activeTargetProcesses.size > 0) {
      console.log('🛑 ngOnDestroy: Cancelando', this.activeTargetProcesses.size, 'procesos restantes');
      this.activeTargetProcesses.forEach((controller, targetId) => {
        console.log('🛑 ngOnDestroy: Cancelando procesos restantes para target:', targetId);
        controller.abort();
      });
      this.activeTargetProcesses.clear();
    }
    
    // LIMPIAR EL POLLING CUANDO EL COMPONENTE SE DESTRUYA
    if (this.pollingSubscription) {
      console.log('🛑 ngOnDestroy: Cancelando polling subscription');
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
    
    // LIMPIAR ESTADO COMPLETAMENTE
    this.selectedTargetForMap = null;
    this.selectedTargetStopTime = undefined;
    this.currentTargetId = null;
    this.isProcessingTargetFromUrl = false;
    
    console.log('✅ LIMPIEZA COMPLETA terminada - Management component destroyed');
  }
}
