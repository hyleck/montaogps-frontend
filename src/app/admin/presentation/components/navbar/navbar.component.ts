import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { ThemesService } from '../../../../shareds/services/themes.service';
import { MenuItem, ConfirmationService, MessageService } from 'primeng/api';
import { StatusService } from '../../../../shareds/services/status.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { LangService } from '../../../../shareds/services/langi18/lang.service';
import { TranslateService } from '@ngx-translate/core';
import { SelectionService } from '../../../../core/services/selection.service';
import { TargetsService } from '../../../../core/services/targets.service';
import { Target, CreateProcessDto } from '../../../../core/interfaces/target.interface';
import { PlansService } from '../../../../core/services/plans.service';
import { Plan } from '../../../../core/interfaces/plan.interface';
import { UserService } from '../../../../core/services/user.service';
import { User } from '../../../../core/interfaces/user.interface';
import { Subject, takeUntil, debounceTime, distinctUntilChanged, filter, firstValueFrom } from 'rxjs';
import { AlertsService, AlertResponse, AlertStatus, CreateAlertDto } from '../../../../core/services/alerts.service';

// ... (inside NavbarComponent class)

import { MapAlertComponent } from '../map-alert/map-alert.component';
import { FirebaseNotificationsService, NotificationLog } from '../../../../core/services/firebase-notifications.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
  standalone: false
})
export class NavbarComponent implements OnInit, OnDestroy {
  items: MenuItem[] = [];
  userMenuItems: MenuItem[] = [];
  languageItems: MenuItem[] = [];
  loadingTheme: boolean = false;
  currentTheme: string = 'light';
  currentUser: any;

  // Control de suscripciones
  private destroy$ = new Subject<void>();
  private searchCanceledSubject$ = new Subject<string>();

  // Estado de la selección
  selectedTargetsCount: number = 0;
  hasSelectedTargets: boolean = false;

  // Control de visibilidad del botón cancelados
  showCanceledButton: boolean = false;

  // Drawer de objetivos cancelados
  canceledDrawerVisible: boolean = false;
  canceledTargets: Target[] = [];
  loadingCanceledTargets: boolean = false;

  // Paginación para targets cancelados
  canceledTargetsOffset: number = 0;
  canceledTargetsPageSize: number = 20;
  totalCanceledTargetsCount: number = 0;
  hasMoreCanceledTargets: boolean = true;
  loadingMoreCanceledTargets: boolean = false;
  lastLoadedParentId: string | null = null;

  // Para los planes
  plans: Plan[] = [];

  // Búsqueda de objetivos cancelados
  canceledSearchTerm: string = '';
  canceledSearchResults: Target[] = [];
  isSearchingCanceled: boolean = false;

  // Modal de detalles del target
  targetDetailsVisible: boolean = false;
  selectedTargetDetails: Target | null = null;
  targetProcesses: any[] = [];
  loadingTargetProcesses: boolean = false;

  // Modal de compartir targets
  shareDialogVisible: boolean = false;
  newEmailInput: string = '';
  selectedEmails: string[] = [];
  targetsToShare: Target[] = [];
  emailInputError: string = '';
  loadingSharedEmails: boolean = false;
  autoSaving: boolean = false;

  // Modal de alertas
  alertsDialogVisible: boolean = false;
  speedAlertDialogVisible: boolean = false;
  perimeterAlertDialogVisible: boolean = false;
  alertsOptions: { labelKey: string }[] = [
    { labelKey: 'navbar.alertOptionSpeed' },
    { labelKey: 'navbar.alertOptionPerimeter' },
    { labelKey: 'navbar.alertOptionIgnition' },
    { labelKey: 'navbar.alertOptionMovement' },
    { labelKey: 'navbar.alertOptionConnection' }
  ];
  currentSelectedTargets: Target[] = [];
  maxSpeedValue: number | null = null;
  creatingAlert: boolean = false;
  notificationEmail: string = '';
  notificationEmailUserId: string | null = null;
  verifyingNotificationEmail: boolean = false;
  deletingAlertId: string | null = null;
  speedAlerts: AlertResponse[] = [];
  visibleSpeedAlerts: AlertResponse[] = [];
  loadingSpeedAlerts: boolean = false;
  togglingAlertId: string | null = null;
  speedAlertMessage: string = '';

  // Perimeter alert variables
  perimeterNotificationTrigger: string = 'enter';
  perimeterNotificationEmail: string = '';
  perimeterNotificationEmailUserId: string | null = null;
  perimeterNotificationMessage: string = '';
  verifyingPerimeterNotificationEmail: boolean = false;
  creatingPerimeterAlert: boolean = false;

  // Perimeter alerts list
  perimeterAlerts: AlertResponse[] = [];
  loadingPerimeterAlerts: boolean = false;
  visiblePerimeterAlerts: AlertResponse[] = [];
  togglingPerimeterAlertId: string | null = null;
  deletingPerimeterAlertId: string | null = null;

  // Perimeter alert edit mode
  editingPerimeterAlertId: string | null = null;
  editingPerimeterCoordinates: any[] = [];
  savingPerimeterAlert: boolean = false;

  /**
   * Entra en modo de edición para una alerta de perímetro
   */
  editPerimeterAlert(alert: AlertResponse): void {
    this.editingPerimeterAlertId = alert._id;
    this.editingPerimeterCoordinates = [...(alert.config?.['coordinates'] || [])];

    // Cargar el trigger (entrada/salida) desde la configuración de la alerta
    this.perimeterNotificationTrigger = alert.config?.['trigger'] || 'enter';

    // Cargar el email de notificación si existe
    const userTopic = alert.userTopic;
    if (userTopic && typeof userTopic === 'object' && 'email' in userTopic) {
      this.perimeterNotificationEmail = userTopic.email || '';
      this.perimeterNotificationEmailUserId = userTopic._id || null;
    } else {
      this.perimeterNotificationEmail = '';
      this.perimeterNotificationEmailUserId = null;
    }

    // Dibujar el perímetro existente en el mapa para edición
    if (this.mapAlertComponent && this.editingPerimeterCoordinates.length >= 3) {
      setTimeout(() => {
        this.mapAlertComponent.setPerimeter(this.editingPerimeterCoordinates);
      }, 100);
    }

    this.messageService.add({
      severity: 'info',
      summary: 'Modo de edición',
      detail: 'Modifica el perímetro en el mapa arrastrando los puntos o dibuja uno nuevo'
    });
  }

  /**
   * Guarda los cambios de una alerta de perímetro editada
   */
  async savePerimeterAlert(): Promise<void> {
    if (!this.editingPerimeterAlertId) return;

    // Obtener las coordenadas actuales del mapa
    const updatedCoordinates = this.mapAlertComponent?.getPolygonCoordinates();

    if (!updatedCoordinates || updatedCoordinates.length < 3) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('common.warning'),
        detail: 'Debes dibujar un perímetro válido con al menos 3 puntos'
      });
      return;
    }

    this.savingPerimeterAlert = true;
    try {
      await firstValueFrom(
        this.alertsService.updateAlert(this.editingPerimeterAlertId, {
          config: {
            coordinates: updatedCoordinates,
            trigger: this.perimeterNotificationTrigger
          }
        })
      );

      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('common.success'),
        detail: 'Alerta de perímetro actualizada correctamente'
      });

      this.cancelPerimeterEdit();
      await this.loadPerimeterAlerts();
    } catch (error) {
      console.error('Error updating perimeter alert:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail: 'Error al actualizar la alerta'
      });
    } finally {
      this.savingPerimeterAlert = false;
    }
  }

  /**
   * Cancela el modo de edición de alerta de perímetro
   */
  cancelPerimeterEdit(): void {
    this.editingPerimeterAlertId = null;
    this.editingPerimeterCoordinates = [];

    // Limpiar el perímetro del mapa
    if (this.mapAlertComponent) {
      this.mapAlertComponent.clearPerimeter();
    }
  }

  // Ignition alert variables
  ignitionAlertDialogVisible: boolean = false;
  ignitionTrigger: string = 'on';
  ignitionNotificationEmail: string = '';
  ignitionNotificationEmailUserId: string | null = null;
  verifyingIgnitionNotificationEmail: boolean = false;
  creatingIgnitionAlert: boolean = false;

  // Ignition alerts list
  ignitionAlerts: AlertResponse[] = [];
  loadingIgnitionAlerts: boolean = false;
  visibleIgnitionAlerts: AlertResponse[] = [];
  togglingIgnitionAlertId: string | null = null;
  deletingIgnitionAlertId: string | null = null;
  ignitionAlertMessage: string = '';

  // Movement alert variables
  movementAlertDialogVisible: boolean = false;
  movementNotificationEmail: string = '';
  movementNotificationEmailUserId: string | null = null;
  verifyingMovementNotificationEmail: boolean = false;
  creatingMovementAlert: boolean = false;

  // Movement alerts list
  movementAlerts: AlertResponse[] = [];
  loadingMovementAlerts: boolean = false;
  visibleMovementAlerts: AlertResponse[] = [];
  togglingMovementAlertId: string | null = null;
  deletingMovementAlertId: string | null = null;
  movementAlertMessage: string = '';

  // Connection alert variables
  connectionAlertDialogVisible: boolean = false;
  connectionAlertType: 'online' | 'offline' = 'online';
  connectionNotificationEmail: string = '';
  connectionNotificationEmailUserId: string | null = null;
  verifyingConnectionNotificationEmail: boolean = false;
  creatingConnectionAlert: boolean = false;

  // Connection alerts list
  connectionAlerts: AlertResponse[] = [];
  loadingConnectionAlerts: boolean = false;
  visibleConnectionAlerts: AlertResponse[] = [];
  togglingConnectionAlertId: string | null = null;
  deletingConnectionAlertId: string | null = null;
  connectionAlertMessage: string = '';

  // Modal de transferir targets
  transferDialogVisible: boolean = false;
  transferEmailInput: string = '';
  transferEmailError: string = '';
  targetsToTransfer: Target[] = [];
  foundUser: User | null = null;
  searchingUser: boolean = false;
  transferring: boolean = false;

  // Referencias a elementos del DOM
  @ViewChild('transferEmailRef') transferEmailRef!: ElementRef<HTMLInputElement>;
  @ViewChild(MapAlertComponent) mapAlertComponent!: MapAlertComponent;

  // Mapeo de tipos de proceso a números
  private processTypeMap: { [key: string]: number } = {
    'restoration': 16, // Nuevo tipo de proceso para restauración
    'deletion': 17 // Nuevo tipo de proceso para eliminación permanente
  };

  // Notificaciones
  notificationsDialogVisible: boolean = false;
  notifications: NotificationLog[] = [];
  loadingNotifications: boolean = false;

  openNotificationsModal() {
    this.notificationsDialogVisible = true;
    this.loadNotifications();
  }

  loadNotifications() {
    this.loadingNotifications = true;
    this.firebaseNotificationsService.getMyNotifications().subscribe({
      next: (notifications) => {
        this.notifications = notifications;
        this.loadingNotifications = false;
      },
      error: (error) => {
        console.error('Error loading notifications', error);
        this.loadingNotifications = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar las notificaciones'
        });
      }
    });
  }

  // ... existing properties
  userPhotoUrl: string | null = null;

  constructor(
    private status: StatusService,
    private themes: ThemesService,
    public authService: AuthService, // Changed to public to access it in template if needed, though we use currentUser
    private router: Router,
    private route: ActivatedRoute,
    private langService: LangService,
    public translate: TranslateService,
    private selectionService: SelectionService,
    private targetsService: TargetsService,
    private plansService: PlansService,
    private userService: UserService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private alertsService: AlertsService,
    private firebaseNotificationsService: FirebaseNotificationsService
  ) {
    this.currentTheme = status.getState('theme') as string;
    this.currentUser = this.authService.getCurrentUser();
    this.resetNotificationEmailToCurrentUser();
    this.resetPerimeterNotificationEmail();
    this.resetConnectionNotificationEmail();

    // Load user profile to get photo
    this.loadUserProfile();
  }

  private loadUserProfile() {
    const currentUser = this.authService.getCurrentUser();

    if (currentUser && currentUser.id) {
      this.userService.getById(currentUser.id).subscribe({
        next: (userData: any) => {
          if (userData.photo) {
            this.userPhotoUrl = userData.photo;
          }
        },
        error: (error) => {
          console.error('Error loading user profile for navbar:', error);
        }
      });
    }
  }

  /**
   * Verifica si todos los targets seleccionados tienen sensor de ignición
   */
  get allSelectedTargetsHaveIgnitionSensor(): boolean {
    if (!this.currentSelectedTargets || this.currentSelectedTargets.length === 0) {
      return false;
    }
    return this.currentSelectedTargets.every(target => target.ignition_sensor?.toLowerCase() === 'yes');
  }

  ngOnInit() {
    this.status.statusChanges$.subscribe((newStatus) => {
      if (newStatus && newStatus.theme) {
        this.currentTheme = newStatus.theme as string;
      }
    });

    this.initializeMenus();

    // Suscribirse a cambios de idioma para actualizar los menús
    this.translate.onLangChange.subscribe(() => {
      this.initializeMenus();
    });

    // Suscribirse a cambios en la selección de objetivos
    this.selectionService.selectedTargets$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(targets => {
      this.currentSelectedTargets = targets || [];
      this.selectedTargetsCount = this.currentSelectedTargets.length;
      this.hasSelectedTargets = this.selectedTargetsCount > 0;
      this.updateMenuItems();
      this.filterSpeedAlertsForSelection();
    });

    // Configurar debounce para búsqueda de objetivos cancelados
    this.searchCanceledSubject$
      .pipe(
        debounceTime(300), // Esperar 300ms después de la última tecla
        distinctUntilChanged(), // Solo buscar si el término cambió
        takeUntil(this.destroy$)
      )
      .subscribe(searchTerm => {
        this.performCanceledSearch(searchTerm);
      });



    // Suscribirse a cambios de ruta para controlar visibilidad del botón cancelados
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.updateCanceledButtonVisibility();
    });

    // Cargar planes para mostrar nombres en lugar de IDs
    this.loadPlans();

    // Verificar visibilidad inicial del botón cancelados y cargar targets si es necesario
    this.updateCanceledButtonVisibility();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Actualiza la visibilidad del botón "Cancelados" basado en si existe el ID del usuario en la URL
   * y carga automáticamente los targets cancelados si es necesario
   */
  private async updateCanceledButtonVisibility() {
    const parentId = this.getParentIdFromUrl();
    const wasVisible = this.showCanceledButton;
    this.showCanceledButton = !!parentId; // Convertir a boolean: true si existe parentId, false si es null

    console.log('🔄 Actualizando visibilidad del botón cancelados:', {
      url: this.router.url,
      parentId,
      showCanceledButton: this.showCanceledButton,
      wasVisible
    });

    // Si el botón se vuelve visible y hay un parentId, cargar targets cancelados automáticamente
    if (this.showCanceledButton && parentId) {
      // Solo cargar si:
      // 1. El botón no estaba visible antes (nueva ruta)
      // 2. O si no hay targets cargados aún
      // 3. O si el parentId cambió (diferente usuario)
      const shouldLoad = !wasVisible ||
        this.canceledTargets.length === 0 ||
        this.lastLoadedParentId !== parentId;

      if (shouldLoad) {
        console.log('🚀 Cargando targets cancelados automáticamente:', {
          reason: !wasVisible ? 'nueva ruta' :
            this.canceledTargets.length === 0 ? 'sin targets cargados' :
              'cambio de usuario',
          parentId,
          lastParentId: this.lastLoadedParentId
        });
        this.lastLoadedParentId = parentId;
        await this.loadCanceledTargets();
      }
    } else if (!this.showCanceledButton) {
      // Si el botón se oculta, limpiar los datos
      this.canceledTargets = [];
      this.totalCanceledTargetsCount = 0;
      this.hasMoreCanceledTargets = true;
      this.lastLoadedParentId = null;
    }
  }

  private initializeMenus() {
    // Menú principal
    this.items = [
      {
        label: this.translate.instant('navbar.alerts'),
        icon: 'pi pi-cog',
        disabled: !this.hasSelectedTargets,
        command: this.hasSelectedTargets ? () => this.openAlertsModal() : undefined
      },
      {
        label: this.translate.instant('navbar.canceled'),
        icon: 'pi pi-trash',
        disabled: true
      },
      {
        label: this.translate.instant('navbar.transfer'),
        icon: 'pi pi-reply',
        disabled: !this.hasSelectedTargets, // Se activa si hay objetivos seleccionados
        command: this.hasSelectedTargets ? () => this.transferSelectedTargets() : undefined
      },
      {
        label: this.translate.instant('navbar.share'),
        icon: 'pi pi-share-alt',
        disabled: !this.hasSelectedTargets, // Se activa si hay objetivos seleccionados
        command: this.hasSelectedTargets ? () => this.shareSelectedTargets() : undefined
      }
    ];

    // Menú de usuario
    this.userMenuItems = [
      {
        label: this.currentUser ? `${this.currentUser.name} ${this.currentUser.last_name}` : this.translate.instant('navbar.myProfile'),
        icon: 'pi pi-user',
        command: () => this.router.navigate(['/admin/profile'])
      },
      // {
      //   separator: true
      // },
      // {
      //   label: this.currentTheme === 'light' ? this.translate.instant('theme.toggleDark') : this.translate.instant('theme.toggleLight'),
      //   icon: this.currentTheme === 'light' ? 'pi pi-moon' : 'pi pi-sun',
      //   command: () => this.toggleTheme()
      // },
      {
        separator: true
      },
      {
        label: this.translate.instant('navbar.logout'),
        icon: 'pi pi-sign-out',
        command: () => this.logout()
      }
    ];

    // Menú de idiomas
    const languages = this.langService.getLanguages();
    this.languageItems = languages.map(lang => ({
      label: this.translate.instant('language.' + lang.code),
      icon: 'pi pi-flag',
      command: () => {
        this.langService.setLanguage(lang.code);
        this.translate.use(lang.code);
      }
    }));
  }

  toggleTheme() {
    this.loadingTheme = true;
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.themes.setTheme(newTheme);
    this.currentTheme = newTheme;

    // Actualizar el menú después de cambiar el tema
    this.initializeMenus();
  }

  openAlertsModal(): void {
    this.alertsDialogVisible = true;
  }

  openSpeedAlertModal(): void {
    this.loadSpeedAlerts();
    this.speedAlertDialogVisible = true;
  }

  openPerimeterAlertModal(): void {
    this.perimeterAlertDialogVisible = true;
  }

  openIgnitionAlertModal(): void {
    this.ignitionAlertDialogVisible = true;
    if (this.currentUser?.email) {
      this.ignitionNotificationEmail = this.currentUser.email;
      // Verificar automáticamente si es el usuario actual
      if (this.currentUser.id) {
        this.ignitionNotificationEmailUserId = this.currentUser.id;
      }
    }
  }

  onNotificationEmailChange(): void {
    if (
      this.notificationEmail &&
      this.currentUser?.email &&
      this.notificationEmail.trim().toLowerCase() ===
      this.currentUser.email.toLowerCase() &&
      this.currentUser?.id
    ) {
      this.notificationEmailUserId = this.currentUser.id;
    } else {
      this.notificationEmailUserId = null;
    }
  }

  async verifyNotificationEmail(): Promise<void> {
    const email = this.notificationEmail?.trim();
    if (!email) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('common.warning'),
        detail: this.translate.instant('navbar.verifyEmailRequired')
      });
      return;
    }

    // Si coincide con el usuario actual, marcar como verificado sin consultar API
    if (
      this.currentUser?.email &&
      email.toLowerCase() === this.currentUser.email.toLowerCase() &&
      this.currentUser?.id
    ) {
      this.notificationEmailUserId = this.currentUser.id;
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('common.success'),
        detail: this.translate.instant('navbar.verifyEmailSuccess')
      });
      return;
    }

    this.verifyingNotificationEmail = true;
    try {
      const user = await firstValueFrom(this.userService.getByEmail(email));
      const userId = user?._id || (user as any)?.id;

      if (userId) {
        this.notificationEmailUserId = userId;
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('common.success'),
          detail: this.translate.instant('navbar.verifyEmailSuccess')
        });
      } else {
        this.notificationEmailUserId = null;
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('common.warning'),
          detail: this.translate.instant('navbar.verifyEmailNotFound')
        });
      }
    } catch (error) {
      this.notificationEmailUserId = null;
      console.error('❌ Error verificando correo para alerta:', error);
      const detail =
        (error as any)?.error?.message ||
        this.translate.instant('navbar.verifyEmailError');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail
      });
    } finally {
      this.verifyingNotificationEmail = false;
    }
  }

  async createSpeedAlert(): Promise<void> {
    if (this.maxSpeedValue === null || this.maxSpeedValue <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('common.warning'),
        detail: this.translate.instant('navbar.maxSpeedRequired')
      });
      return;
    }

    const targetIds = (this.currentSelectedTargets || [])
      .map(target => target?._id || (target as any)?.id)
      .filter((id): id is string => !!id);

    if (!targetIds.length) {
      const userIdFromUrl = this.getParentIdFromUrl();

      if (!userIdFromUrl) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('common.warning'),
          detail: this.translate.instant('navbar.userIdRequired')
        });
        return;
      }

      const targetIdsForGlobalAlert = [userIdFromUrl];
      targetIds.push(...targetIdsForGlobalAlert);
    }

    if (this.notificationEmail?.trim() && !this.notificationEmailUserId) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('common.warning'),
        detail: this.translate.instant('navbar.verifyEmailPending')
      });
      return;
    }

    const payload = {
      type: 'speed' as const,
      maxSpeed: this.maxSpeedValue,
      targetIds,
      userTopic: this.notificationEmailUserId || undefined,
      message: this.speedAlertMessage?.trim() || undefined
    };

    this.creatingAlert = true;

    try {
      await firstValueFrom(this.alertsService.createAlert(payload));

      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('navbar.createAlert'),
        detail: `${this.translate.instant('navbar.alertOptionSpeed')} - ${this.maxSpeedValue} km/h`
      });

      this.maxSpeedValue = null;
      this.speedAlertMessage = '';
      this.resetNotificationEmailToCurrentUser();
      await this.loadSpeedAlerts();
    } catch (error: any) {
      console.error('❌ Error al crear la alerta de velocidad:', error);
      const detail =
        error?.error?.message ||
        this.translate.instant('navbar.createAlertError');

      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail
      });
    } finally {
      this.creatingAlert = false;
    }
  }

  private resetNotificationEmailToCurrentUser(): void {
    if (this.currentUser?.email && this.currentUser?.id) {
      this.notificationEmail = this.currentUser.email;
      this.notificationEmailUserId = this.currentUser.id;
    } else {
      this.notificationEmail = '';
      this.notificationEmailUserId = null;
    }
  }

  onPerimeterNotificationEmailChange(): void {
    if (
      this.perimeterNotificationEmail &&
      this.currentUser?.email &&
      this.perimeterNotificationEmail.trim().toLowerCase() ===
      this.currentUser.email.toLowerCase() &&
      this.currentUser?.id
    ) {
      this.perimeterNotificationEmailUserId = this.currentUser.id;
    } else {
      this.perimeterNotificationEmailUserId = null;
    }
  }

  async verifyPerimeterNotificationEmail(): Promise<void> {
    const email = this.perimeterNotificationEmail?.trim();
    if (!email) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('common.warning'),
        detail: this.translate.instant('navbar.verifyEmailRequired')
      });
      return;
    }

    // Si coincide con el usuario actual, marcar como verificado sin consultar API
    if (
      this.currentUser?.email &&
      email.toLowerCase() === this.currentUser.email.toLowerCase() &&
      this.currentUser?.id
    ) {
      this.perimeterNotificationEmailUserId = this.currentUser.id;
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('common.success'),
        detail: this.translate.instant('navbar.verifyEmailSuccess')
      });
      return;
    }

    this.verifyingPerimeterNotificationEmail = true;
    try {
      const user = await firstValueFrom(this.userService.getByEmail(email));
      const userId = user?._id || (user as any)?.id;

      if (userId) {
        this.perimeterNotificationEmailUserId = userId;
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('common.success'),
          detail: this.translate.instant('navbar.verifyEmailSuccess')
        });
      } else {
        this.perimeterNotificationEmailUserId = null;
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('common.warning'),
          detail: this.translate.instant('navbar.verifyEmailNotFound')
        });
      }
    } catch (error) {
      this.perimeterNotificationEmailUserId = null;
      console.error('❌ Error verificando correo para alerta de perímetro:', error);
      const detail =
        (error as any)?.error?.message ||
        this.translate.instant('navbar.verifyEmailError');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail
      });
    } finally {
      this.verifyingPerimeterNotificationEmail = false;
    }
  }

  onIgnitionNotificationEmailChange(): void {
    if (
      this.ignitionNotificationEmail &&
      this.ignitionNotificationEmailUserId
    ) {
      this.ignitionNotificationEmailUserId = null;
    }
  }

  async verifyIgnitionNotificationEmail(): Promise<void> {
    const email = this.ignitionNotificationEmail?.trim();
    if (!email) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('common.warning'),
        detail: this.translate.instant('navbar.verifyEmailRequired')
      });
      return;
    }

    // Si coincide con el usuario actual, marcar como verificado sin consultar API
    if (
      this.currentUser?.email &&
      email.toLowerCase() === this.currentUser.email.toLowerCase() &&
      this.currentUser?.id
    ) {
      this.ignitionNotificationEmailUserId = this.currentUser.id;
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('common.success'),
        detail: this.translate.instant('navbar.verifyEmailSuccess')
      });
      return;
    }

    this.verifyingIgnitionNotificationEmail = true;
    try {
      const user = await firstValueFrom(this.userService.getByEmail(email));
      const userId = user?._id || (user as any)?.id;

      if (userId) {
        this.ignitionNotificationEmailUserId = userId;
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('common.success'),
          detail: this.translate.instant('navbar.verifyEmailSuccess')
        });
      } else {
        this.ignitionNotificationEmailUserId = null;
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('common.warning'),
          detail: this.translate.instant('navbar.verifyEmailNotFound')
        });
      }
    } catch (error) {
      this.ignitionNotificationEmailUserId = null;
      console.error('❌ Error verificando correo para alerta de encendido:', error);
      const detail =
        (error as any)?.error?.message ||
        this.translate.instant('navbar.verifyEmailError');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail
      });
    } finally {
      this.verifyingIgnitionNotificationEmail = false;
    }
  }

  async createPerimeterAlert(): Promise<void> {
    // Validar que hay un polígono dibujado
    const coordinates = this.mapAlertComponent?.getPolygonCoordinates();

    if (!coordinates || coordinates.length < 3) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('common.warning'),
        detail: 'Debe dibujar un perímetro en el mapa'
      });
      return;
    }

    // Validar email si está presente
    if (this.perimeterNotificationEmail?.trim() && !this.perimeterNotificationEmailUserId) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('common.warning'),
        detail: this.translate.instant('navbar.verifyEmailPending')
      });
      return;
    }

    const targetIds = (this.currentSelectedTargets || [])
      .map(target => target?._id || (target as any)?.id)
      .filter((id): id is string => !!id);

    if (!targetIds.length) {
      const userIdFromUrl = this.getParentIdFromUrl();
      if (!userIdFromUrl) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('common.warning'),
          detail: this.translate.instant('navbar.userIdRequired')
        });
        return;
      }
      targetIds.push(userIdFromUrl);
    }

    const payload = {
      type: 'perimeter' as const,
      coordinates,
      trigger: this.perimeterNotificationTrigger,
      targetIds,
      userTopic: this.perimeterNotificationEmailUserId || undefined,
      message: this.perimeterNotificationMessage?.trim() || undefined
    };

    this.creatingPerimeterAlert = true;

    try {
      await firstValueFrom(this.alertsService.createAlert(payload));

      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('navbar.createAlert'),
        detail: `${this.translate.instant('navbar.alertOptionPerimeter')} creada exitosamente`
      });

      // Resetear formulario
      this.perimeterNotificationTrigger = 'enter';
      this.perimeterNotificationMessage = '';
      this.resetPerimeterNotificationEmail();
      this.mapAlertComponent?.clearPerimeter();

      // Recargar lista de alertas
      await this.loadPerimeterAlerts();
    } catch (error: any) {
      console.error('❌ Error al crear la alerta de perímetro:', error);
      const detail = error?.error?.message ||
        this.translate.instant('navbar.createAlertError');

      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail
      });
    } finally {
      this.creatingPerimeterAlert = false;
    }
  }

  private resetPerimeterNotificationEmail(): void {
    if (this.currentUser?.email && this.currentUser?.id) {
      this.perimeterNotificationEmail = this.currentUser.email;
      this.perimeterNotificationEmailUserId = this.currentUser.id;
    } else {
      this.perimeterNotificationEmail = '';
      this.perimeterNotificationEmailUserId = null;
    }
  }

  async loadPerimeterAlerts(): Promise<void> {
    this.loadingPerimeterAlerts = true;
    try {
      const allAlerts = await firstValueFrom(this.alertsService.getAlerts());

      // Filtrar solo alertas de perímetro
      this.perimeterAlerts = allAlerts.filter(alert => alert.type === 'perimeter');

      // Filtrar por targets seleccionados
      this.filterVisiblePerimeterAlerts();
    } catch (error) {
      console.error('❌ Error al cargar alertas de perímetro:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail: 'Error al cargar las alertas de perímetro'
      });
    } finally {
      this.loadingPerimeterAlerts = false;
    }
  }

  private filterVisiblePerimeterAlerts(): void {
    const selectedIds = (this.currentSelectedTargets || [])
      .map(t => t?._id || (t as any)?.id)
      .filter((id): id is string => !!id);

    if (!selectedIds.length) {
      this.visiblePerimeterAlerts = this.perimeterAlerts;
      return;
    }

    this.visiblePerimeterAlerts = this.perimeterAlerts.filter(alert => {
      if (!Array.isArray(alert.targetIds) || alert.targetIds.length === 0) {
        return false;
      }
      return alert.targetIds.some(targetId => selectedIds.includes(targetId));
    });
  }

  async togglePerimeterAlertStatus(alert: AlertResponse): Promise<void> {
    if (!alert._id) {
      return;
    }

    const newStatus: AlertStatus = alert.status === 'active' ? 'inactive' : 'active';
    this.togglingPerimeterAlertId = alert._id;

    try {
      await firstValueFrom(
        this.alertsService.updateAlertStatus(alert._id, newStatus)
      );

      alert.status = newStatus;

      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('common.success'),
        detail: `Alerta ${newStatus === 'active' ? 'activada' : 'desactivada'}`
      });
    } catch (error) {
      console.error('❌ Error al cambiar estado de alerta:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail: 'Error al cambiar el estado de la alerta'
      });
    } finally {
      this.togglingPerimeterAlertId = null;
    }
  }

  async deletePerimeterAlert(alert: AlertResponse): Promise<void> {
    if (!alert._id) {
      return;
    }

    this.confirmationService.confirm({
      message: '¿Está seguro de eliminar esta alerta de perímetro?',
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      accept: async () => {
        try {
          await firstValueFrom(this.alertsService.deleteAlert(alert._id!));

          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('common.success'),
            detail: 'Alerta eliminada correctamente'
          });

          await this.loadPerimeterAlerts();
        } catch (error) {
          console.error('❌ Error al eliminar alerta:', error);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('common.error'),
            detail: 'Error al eliminar la alerta'
          });
        }
      }
    });
  }

  async createIgnitionAlert(): Promise<void> {
    if (this.ignitionNotificationEmail && !this.ignitionNotificationEmailUserId) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('common.warning'),
        detail: 'Debe verificar el correo electrónico antes de crear la alerta'
      });
      return;
    }

    this.creatingIgnitionAlert = true;

    try {
      const targetIds = this.currentSelectedTargets.length
        ? this.currentSelectedTargets.map(t => t._id || (t as any).id).filter(id => !!id)
        : this.currentUser?.id ? [this.currentUser.id] : [];

      const payload: any = {
        type: 'ignition',
        ignitionTrigger: this.ignitionTrigger,
        targetIds,
        userTopic: this.ignitionNotificationEmailUserId || undefined,
        message: this.ignitionAlertMessage?.trim() || undefined
      };

      await firstValueFrom(this.alertsService.createAlert(payload));

      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('common.success'),
        detail: 'Alerta de encendido creada exitosamente'
      });

      await this.loadIgnitionAlerts();

      this.ignitionTrigger = 'on';
      this.ignitionAlertMessage = '';
      this.ignitionNotificationEmail = '';
      this.ignitionNotificationEmailUserId = null;
    } catch (error) {
      console.error('❌ Error creando alerta de encendido:', error);
      const detail = (error as any)?.error?.message || 'Error al crear la alerta';
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail
      });
    } finally {
      this.creatingIgnitionAlert = false;
    }
  }

  async loadIgnitionAlerts(): Promise<void> {
    this.loadingIgnitionAlerts = true;
    try {
      const allAlerts = await firstValueFrom(this.alertsService.getAlerts());
      this.ignitionAlerts = allAlerts.filter(alert => alert.type === 'ignition');
      this.filterVisibleIgnitionAlerts();
    } catch (error) {
      console.error('❌ Error al cargar alertas de encendido:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail: 'Error al cargar las alertas de encendido'
      });
    } finally {
      this.loadingIgnitionAlerts = false;
    }
  }

  private filterVisibleIgnitionAlerts(): void {
    const selectedIds = (this.currentSelectedTargets || [])
      .map(t => t?._id || (t as any)?.id)
      .filter((id): id is string => !!id);

    if (!selectedIds.length) {
      this.visibleIgnitionAlerts = this.ignitionAlerts;
      return;
    }

    this.visibleIgnitionAlerts = this.ignitionAlerts.filter(alert => {
      if (!Array.isArray(alert.targetIds) || alert.targetIds.length === 0) {
        return false;
      }
      return alert.targetIds.some(targetId => selectedIds.includes(targetId));
    });
  }

  // Métodos para alertas de movimiento
  openMovementAlertModal(): void {
    this.movementAlertDialogVisible = true;
    if (this.currentUser?.email) {
      this.movementNotificationEmail = this.currentUser.email;
      if (this.currentUser.id) {
        this.movementNotificationEmailUserId = this.currentUser.id;
      }
    }
  }

  onMovementNotificationEmailChange(): void {
    if (
      this.movementNotificationEmail &&
      this.currentUser?.email &&
      this.movementNotificationEmail.trim().toLowerCase() ===
      this.currentUser.email.toLowerCase() &&
      this.currentUser?.id
    ) {
      this.movementNotificationEmailUserId = this.currentUser.id;
    } else {
      this.movementNotificationEmailUserId = null;
    }
  }

  async verifyMovementNotificationEmail(): Promise<void> {
    if (!this.movementNotificationEmail) return;

    this.verifyingMovementNotificationEmail = true;
    try {
      // Usar el mismo patrón que en alertas de perímetro/encendido
      const users = await firstValueFrom(this.userService.getByEmail(this.movementNotificationEmail));
      if (users && (users as any).length > 0) {
        this.movementNotificationEmailUserId = (users as any)[0]._id;
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('common.success'),
          detail: this.translate.instant('navbar.emailVerified')
        });
      } else {
        this.movementNotificationEmailUserId = null;
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('common.warning'),
          detail: this.translate.instant('navbar.emailNotFound')
        });
      }
    } catch (error) {
      console.error('Error verifying email:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail: this.translate.instant('navbar.errorVerifyingEmail')
      });
    } finally {
      this.verifyingMovementNotificationEmail = false;
    }
  }

  async createMovementAlert(): Promise<void> {
    if (!this.movementNotificationEmail) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('common.warning'),
        detail: this.translate.instant('navbar.emailRequired')
      });
      return;
    }

    if (!this.currentSelectedTargets || this.currentSelectedTargets.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('common.warning'),
        detail: this.translate.instant('navbar.noDevicesSelected')
      });
      return;
    }

    this.creatingMovementAlert = true;
    try {
      const targetIds = this.currentSelectedTargets
        .map(t => t?._id || (t as any)?.id)
        .filter(id => !!id);

      const alertData: CreateAlertDto = {
        type: 'movement',
        targetIds: targetIds,
        userTopic: this.movementNotificationEmailUserId,
        email: this.movementNotificationEmail,
        message: this.movementAlertMessage?.trim() || undefined
      } as any;

      await firstValueFrom(this.alertsService.createAlert(alertData));

      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('common.success'),
        detail: 'Alerta de movimiento creada correctamente'
      });

      this.movementNotificationEmail = '';
      this.movementAlertMessage = '';
      this.movementNotificationEmailUserId = null;
      this.loadMovementAlerts();
    } catch (error) {
      console.error('Error creating movement alert:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail: 'Error al crear la alerta de movimiento'
      });
    } finally {
      this.creatingMovementAlert = false;
    }
  }

  async loadMovementAlerts(): Promise<void> {
    if (!this.currentUser?.id) return;

    this.loadingMovementAlerts = true;
    try {
      const alerts = await firstValueFrom(this.alertsService.getAlerts());
      this.movementAlerts = alerts.filter(alert => alert.type === 'movement');
      this.filterVisibleMovementAlerts();
    } catch (error) {
      console.error('Error loading movement alerts:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail: 'Error al cargar las alertas de movimiento'
      });
    } finally {
      this.loadingMovementAlerts = false;
    }
  }

  private filterVisibleMovementAlerts(): void {
    const selectedIds = (this.currentSelectedTargets || [])
      .map(t => t?._id || (t as any)?.id)
      .filter((id): id is string => !!id);

    if (!selectedIds.length) {
      this.visibleMovementAlerts = this.movementAlerts;
      return;
    }

    this.visibleMovementAlerts = this.movementAlerts.filter(alert => {
      if (!Array.isArray(alert.targetIds) || alert.targetIds.length === 0) {
        return false;
      }
      return alert.targetIds.some(targetId => selectedIds.includes(targetId));
    });
  }

  async toggleMovementAlertStatus(alert: AlertResponse): Promise<void> {
    if (!alert._id) return;

    this.togglingMovementAlertId = alert._id;
    const newStatus = alert.status === 'active' ? 'inactive' : 'active';

    try {
      await firstValueFrom(this.alertsService.updateAlertStatus(alert._id, newStatus));
      alert.status = newStatus;
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('common.success'),
        detail: `Alerta ${newStatus === 'active' ? 'activada' : 'desactivada'} correctamente`
      });
    } catch (error) {
      console.error('Error updating alert status:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail: 'Error al actualizar el estado de la alerta'
      });
    } finally {
      this.togglingMovementAlertId = null;
    }
  }

  deleteMovementAlert(alertId: string): void {
    this.confirmationService.confirm({
      message: '¿Estás seguro de que deseas eliminar esta alerta?',
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      accept: async () => {
        this.deletingMovementAlertId = alertId;
        try {
          await firstValueFrom(this.alertsService.deleteAlert(alertId));
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('common.success'),
            detail: 'Alerta eliminada correctamente'
          });
          this.loadMovementAlerts();
        } catch (error) {
          console.error('Error deleting alert:', error);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('common.error'),
            detail: 'Error al eliminar la alerta'
          });
        } finally {
          this.deletingMovementAlertId = null;
        }
      }
    });
  }

  async toggleIgnitionAlertStatus(alert: AlertResponse): Promise<void> {
    if (!alert._id) return;

    const newStatus: AlertStatus = alert.status === 'active' ? 'inactive' : 'active';
    this.togglingIgnitionAlertId = alert._id;

    try {
      await firstValueFrom(this.alertsService.updateAlertStatus(alert._id, newStatus));
      alert.status = newStatus;
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('common.success'),
        detail: `Alerta ${newStatus === 'active' ? 'activada' : 'desactivada'}`
      });
    } catch (error) {
      console.error('❌ Error al cambiar estado de alerta:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail: 'Error al cambiar el estado de la alerta'
      });
    } finally {
      this.togglingIgnitionAlertId = null;
    }
  }

  async deleteIgnitionAlert(alert: AlertResponse): Promise<void> {
    if (!alert._id) return;

    this.confirmationService.confirm({
      message: '¿Está seguro de eliminar esta alerta de encendido?',
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      accept: async () => {
        this.deletingIgnitionAlertId = alert._id!;
        try {
          await firstValueFrom(this.alertsService.deleteAlert(alert._id!));
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('common.success'),
            detail: 'Alerta eliminada correctamente'
          });
          await this.loadIgnitionAlerts();
        } catch (error) {
          console.error('❌ Error al eliminar alerta:', error);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('common.error'),
            detail: 'Error al eliminar la alerta'
          });
        } finally {
          this.deletingIgnitionAlertId = null;
        }
      }
    });
  }

  private async loadSpeedAlerts(): Promise<void> {
    this.loadingSpeedAlerts = true;
    try {
      const alerts = await firstValueFrom(this.alertsService.getAlerts());
      this.speedAlerts = (alerts || []).filter(alert => alert.type === 'speed');
      this.filterSpeedAlertsForSelection();
    } catch (error) {
      console.error('❌ Error al cargar las alertas de velocidad:', error);
    } finally {
      this.loadingSpeedAlerts = false;
    }
  }

  private async logCurrentUserDetails(): Promise<User | null> {
    try {
      const currentUserId = this.currentUser?.id;
      if (!currentUserId) {
        console.warn('⚠️ No se pudo obtener el ID del usuario actual');
        return null;
      }
      const user = await firstValueFrom(this.userService.getById(currentUserId));
      console.log('ℹ️ Usuario logueado sin objetivos seleccionados:', user);
      return user;
    } catch (error) {
      console.error('❌ Error al obtener datos del usuario logueado:', error);
      return null;
    }
  }

  private filterSpeedAlertsForSelection(): void {
    const currentTargetIds = (this.currentSelectedTargets || [])
      .map(target => target?._id || (target as any)?.id)
      .filter((id): id is string => !!id);
    const userIdFromUrl = this.getParentIdFromUrl();

    if (!currentTargetIds.length) {
      if (!userIdFromUrl) {
        this.visibleSpeedAlerts = [];
        return;
      }

      this.visibleSpeedAlerts = (this.speedAlerts || []).filter(alert => {
        return alert.targetIds.includes(userIdFromUrl);
      });
      return;
    }

    this.visibleSpeedAlerts = (this.speedAlerts || []).filter(alert => {
      if (!alert.targetIds || alert.targetIds.length === 0) {
        return false;
      }
      return currentTargetIds.every(targetId => alert.targetIds.includes(targetId));
    });
  }

  getAlertRecipientEmail(alert: AlertResponse): string | null {
    if (!alert?.userTopic) {
      return null;
    }

    if (typeof alert.userTopic === 'string') {
      return null;
    }

    return alert.userTopic.email ?? null;
  }

  getCreatorName(alert: AlertResponse): string {
    if (!alert.createdBy) {
      return 'Desconocido';
    }

    const creator = alert.createdBy as any;
    const firstName = creator.name || '';
    const lastName = creator.last_name || '';

    return `${firstName} ${lastName}`.trim() || 'Desconocido';
  }

  getCreatorEmail(alert: AlertResponse): string | null {
    if (!alert.createdBy) {
      return null;
    }

    const creator = alert.createdBy as any;
    return creator.email || null;
  }

  async toggleAlertStatus(alert: AlertResponse): Promise<void> {
    const nextStatus: AlertStatus =
      alert.status === 'active' ? 'inactive' : 'active';

    this.togglingAlertId = alert._id;

    try {
      const updatedAlert = await firstValueFrom(
        this.alertsService.updateAlertStatus(alert._id, nextStatus),
      );

      alert.status = updatedAlert.status;

      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('navbar.alertStatusUpdated'),
        detail:
          alert.status === 'active'
            ? this.translate.instant('navbar.alertEnabled')
            : this.translate.instant('navbar.alertDisabled'),
      });
    } catch (error: any) {
      console.error('❌ Error al actualizar estado de alerta:', error);
      const detail =
        error?.error?.message ||
        this.translate.instant('navbar.toggleAlertError');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail,
      });
    } finally {
      this.togglingAlertId = null;
    }
  }

  confirmDeleteAlert(alert: AlertResponse): void {
    this.confirmationService.confirm({
      message: this.translate.instant('navbar.deleteAlertConfirm'),
      header: this.translate.instant('navbar.deleteAlert'),
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.deleteAlert(alert._id)
    });
  }

  private async deleteAlert(alertId: string): Promise<void> {
    this.deletingAlertId = alertId;
    try {
      await firstValueFrom(this.alertsService.deleteAlert(alertId));
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('navbar.deleteAlert'),
        detail: this.translate.instant('navbar.deleteAlertSuccess')
      });
      await this.loadSpeedAlerts();
    } catch (error: any) {
      console.error('❌ Error eliminando alerta:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail:
          error?.error?.message ||
          this.translate.instant('navbar.deleteAlertError')
      });
    } finally {
      this.deletingAlertId = null;
    }
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/auth/login']).then(() => {
      // Forzar un refresh de la página para asegurar que todo se limpie
      window.location.reload();
    });
  }

  /**
   * Actualiza solo los elementos del menú que dependen del estado de selección
   */
  private updateMenuItems() {
    if (this.items.length > 0) {
      // Actualizar el botón de alertas (índice 0)
      const alertsItem = this.items[0];
      if (alertsItem) {
        alertsItem.disabled = !this.hasSelectedTargets;
        alertsItem.command = this.hasSelectedTargets ? () => this.openAlertsModal() : undefined;
      }

      // Actualizar el botón de transferir (índice 2)
      const transferItem = this.items[2];
      if (transferItem) {
        transferItem.disabled = !this.hasSelectedTargets;
        transferItem.command = this.hasSelectedTargets ? () => this.transferSelectedTargets() : undefined;
      }

      // Actualizar el botón de compartir (índice 3)
      const shareItem = this.items[3];
      if (shareItem) {
        shareItem.disabled = !this.hasSelectedTargets;
        shareItem.command = this.hasSelectedTargets ? () => this.shareSelectedTargets() : undefined;
      }
    }
  }

  /**
   * Abre el modal de transferencia de targets
   */
  transferSelectedTargets() {
    const selectedTargets = this.selectionService.selectedTargetsValue || [];
    // Crear una copia para evitar referencias residuales
    this.targetsToTransfer = [...selectedTargets];
    if (!this.targetsToTransfer.length) {
      return;
    }
    this.transferEmailInput = '';
    this.transferEmailError = '';
    this.foundUser = null;
    this.searchingUser = false;
    this.transferring = false;
    this.transferDialogVisible = true;

    // Enfocar el input después de que el modal se abra
    setTimeout(() => {
      this.focusTransferEmailInput();
    }, 300);
  }

  /**
   * Maneja la acción de compartir objetivos seleccionados
   */
  async shareSelectedTargets() {
    const selectedTargets = this.selectionService.selectedTargetsValue;
    console.log('🔗 Compartiendo objetivos seleccionados:', selectedTargets);

    // Asignar targets a compartir
    this.targetsToShare = selectedTargets;

    // Resetear estado del modal
    this.newEmailInput = '';
    this.emailInputError = '';
    this.selectedEmails = [];

    // Abrir modal primero
    this.shareDialogVisible = true;

    // Si solo hay un target seleccionado, consultar sus emails compartidos específicos
    if (selectedTargets.length === 1 && selectedTargets[0]._id) {
      await this.loadSharedEmailsFromAPI(selectedTargets[0]._id);
    } else if (selectedTargets.length > 0) {
      // Para múltiples targets, usar los emails del primer target como referencia (legacy)
      if (selectedTargets[0].shared && Array.isArray(selectedTargets[0].shared)) {
        this.selectedEmails = [...selectedTargets[0].shared];
        console.log('📧 Emails compartidos (múltiples targets - referencia):', this.selectedEmails);
      }
    }
  }

  /**
   * Carga los emails compartidos de un target específico desde la API
   */
  async loadSharedEmailsFromAPI(targetId: string) {
    try {
      this.loadingSharedEmails = true;

      console.log('🔍 Consultando emails compartidos para target:', targetId);

      const response = await this.targetsService.getSharedEmails(targetId);

      console.log('✅ Respuesta de emails compartidos:', response);

      // Cargar los emails compartidos
      if (response.shared && Array.isArray(response.shared)) {
        this.selectedEmails = [...response.shared];
        console.log('📧 Emails compartidos cargados desde API:', this.selectedEmails);
      } else {
        this.selectedEmails = [];
        console.log('📭 No hay emails compartidos para este target');
      }

    } catch (error) {
      console.error('❌ Error al cargar emails compartidos:', error);
      this.selectedEmails = [];

      // Mostrar mensaje de error si es necesario
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'No se pudieron cargar los emails compartidos actuales'
      });
    } finally {
      this.loadingSharedEmails = false;
    }
  }

  /**
   * Valida si un email es válido
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Agrega un email a la lista de emails compartidos y auto-guarda
   */
  async addEmail() {
    const email = this.newEmailInput.trim();

    // Limpiar error previo
    this.emailInputError = '';

    // Validaciones
    if (!email) {
      this.emailInputError = 'El correo electrónico es requerido';
      return;
    }

    if (!this.isValidEmail(email)) {
      this.emailInputError = 'Por favor ingrese un correo electrónico válido';
      return;
    }

    if (this.selectedEmails.includes(email)) {
      this.emailInputError = 'Este correo ya está en la lista';
      return;
    }

    // Agregar email
    this.selectedEmails.push(email);
    this.newEmailInput = '';

    console.log('➕ Email agregado:', email);
    console.log('📧 Lista actual:', this.selectedEmails);

    // Auto-guardar cambios
    await this.autoSaveEmailChanges();
  }

  /**
   * Elimina un email de la lista y auto-guarda
   */
  async removeEmail(email: string) {
    this.selectedEmails = this.selectedEmails.filter(e => e !== email);
    console.log('➖ Email eliminado:', email);
    console.log('📧 Lista actual:', this.selectedEmails);

    // Auto-guardar cambios
    await this.autoSaveEmailChanges();
  }

  /**
   * Maneja el evento keypress en el input de email (Enter para agregar)
   */
  onEmailKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addEmail();
    }
  }

  /**
   * Auto-guarda los cambios de emails compartidos
   */
  async autoSaveEmailChanges() {
    // No auto-guardar si ya se está guardando o cargando emails
    if (this.autoSaving || this.loadingSharedEmails) {
      return;
    }

    try {
      this.autoSaving = true;

      console.log('💾 Auto-guardando cambios de emails:', {
        targets: this.targetsToShare.map(t => t._id),
        sharedEmails: this.selectedEmails
      });

      // Actualizar cada target con los emails compartidos
      for (const target of this.targetsToShare) {
        await this.targetsService.updateSharedUsers(target._id!, this.selectedEmails);
      }

      console.log('✅ Cambios auto-guardados exitosamente');

      // Mostrar mensaje sutil de confirmación
      this.messageService.add({
        severity: 'success',
        summary: 'Guardado',
        detail: `Emails actualizados automáticamente`,
        life: 2000 // Mensaje más corto
      });

    } catch (error: any) {
      console.error('❌ Error al auto-guardar emails:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: error.message || 'No se pudieron guardar los cambios automáticamente'
      });
    } finally {
      this.autoSaving = false;
    }
  }

  /**
   * Limpia todos los emails seleccionados y auto-guarda
   */
  async clearAllEmails() {
    this.selectedEmails = [];
    console.log('🗑️ Todos los emails eliminados');

    // Auto-guardar cambios
    await this.autoSaveEmailChanges();
  }

  /**
   * Cancela la acción de compartir
   */
  cancelShareTargets() {
    this.shareDialogVisible = false;
    this.selectedEmails = [];
    this.targetsToShare = [];
    this.newEmailInput = '';
    this.emailInputError = '';
    this.loadingSharedEmails = false;
    this.autoSaving = false;
  }

  /**
   * Busca un usuario por email para transferencia
   */
  async searchUserForTransfer() {
    const email = this.transferEmailInput.trim();

    // Limpiar error previo
    this.transferEmailError = '';
    this.foundUser = null;

    // Validaciones
    if (!email) {
      this.transferEmailError = 'El correo electrónico es requerido';
      return;
    }

    if (!this.isValidEmail(email)) {
      this.transferEmailError = 'Por favor ingrese un correo electrónico válido';
      return;
    }

    try {
      this.searchingUser = true;

      // Buscar usuario por email usando endpoint específico
      const user = await this.userService.getByEmail(email).toPromise();

      if (!user) {
        this.transferEmailError = 'No se encontró ningún usuario con ese correo electrónico';
        return;
      }

      this.foundUser = user;

    } catch (error: any) {
      console.error('❌ Error al buscar usuario:', error);

      // Manejar diferentes tipos de error
      if (error.status === 404) {
        this.transferEmailError = 'No se encontró ningún usuario con ese correo electrónico';
      } else if (error.status === 400) {
        this.transferEmailError = 'Formato de correo electrónico inválido';
      } else {
        this.transferEmailError = 'Error al buscar el usuario. Intente nuevamente.';
      }
    } finally {
      this.searchingUser = false;
    }
  }

  /**
   * Confirma la transferencia de targets al usuario encontrado
   */
  async confirmTransferTargets() {
    if (!this.foundUser) {
      this.transferEmailError = 'Debe buscar y seleccionar un usuario primero';
      return;
    }

    try {
      this.transferring = true;

      console.log('🔄 Transfiriendo targets:', {
        targets: this.targetsToTransfer.map(t => t._id),
        targetUserId: this.foundUser._id,
        targetUserEmail: this.foundUser.email
      });

      // Transferir cada target
      for (const target of this.targetsToTransfer) {
        await this.targetsService.transferTarget(target._id!, this.foundUser._id);
      }

      // Mostrar mensaje de éxito
      this.messageService.add({
        severity: 'success',
        summary: 'Transferencia Exitosa',
        detail: `${this.targetsToTransfer.length} objetivo(s) transferido(s) a ${this.foundUser.name} ${this.foundUser.last_name}`
      });

      // Cerrar modal y limpiar selección
      this.transferDialogVisible = false;
      this.selectionService.clearSelection();
      this.targetsToTransfer = [];

      // Notificar que los targets han sido actualizados para recargar en management
      this.selectionService.notifyTargetsUpdated();

      console.log('✅ Transferencia completada exitosamente');

    } catch (error: any) {
      console.error('❌ Error al transferir targets:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error en Transferencia',
        detail: error.message || 'No se pudieron transferir los objetivos'
      });
    } finally {
      this.transferring = false;
    }
  }

  /**
   * Cancela la acción de transferir
   */
  cancelTransferTargets() {
    this.transferDialogVisible = false;
    this.targetsToTransfer = [];
    this.transferEmailInput = '';
    this.transferEmailError = '';
    this.foundUser = null;
    this.searchingUser = false;
    this.transferring = false;
  }

  /**
   * Manejo de eventos del input de email de transferencia
   */
  onTransferEmailInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.transferEmailInput = target.value;
  }

  onTransferEmailInputKeypress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.searchUserForTransfer();
    }
  }

  onTransferEmailInputClick(event: Event) {
    event.stopPropagation();

    // Asegurar focus
    const target = event.target as HTMLInputElement;
    target.focus();
  }

  onTransferEmailInputFocus(event: Event) {
    // Posicionar cursor al final del texto
    const target = event.target as HTMLInputElement;
    target.setSelectionRange(target.value.length, target.value.length);
  }

  /**
   * Enfoca el input de email de transferencia
   */
  focusTransferEmailInput() {
    try {
      if (this.transferEmailRef && this.transferEmailRef.nativeElement) {
        const input = this.transferEmailRef.nativeElement;

        // Asegurar que el input esté habilitado y enfocado
        input.disabled = false;
        input.readOnly = false;
        input.focus();
        input.click();
      }
    } catch (error) {
      console.error('Error al enfocar input de transferencia:', error);
    }
  }

  /**
   * Abre el drawer de objetivos cancelados
   */
  async openCanceledTargetsDrawer() {
    this.canceledDrawerVisible = true;
    this.canceledSearchTerm = '';
    this.canceledSearchResults = [];
    await this.loadCanceledTargets();
  }

  /**
   * Carga los objetivos cancelados desde la API con paginación
   */
  async loadCanceledTargets() {
    try {
      this.loadingCanceledTargets = true;

      // Resetear paginación
      this.canceledTargetsOffset = 0;
      this.canceledTargets = [];
      this.hasMoreCanceledTargets = true;

      // Obtener el parent ID desde la URL
      const parentId = this.getParentIdFromUrl();

      if (!parentId) {
        console.warn('⚠️ No se pudo obtener el parent ID desde la URL, cancelando carga de objetivos cancelados');
        this.canceledTargets = [];
        return;
      }

      console.log('🚀 Cargando objetivos cancelados para parent ID:', parentId);

      // Cargar primera página de objetivos cancelados
      const response = await this.targetsService.getCanceledTargetsWithPagination(
        parentId,
        this.canceledTargetsOffset,
        this.canceledTargetsPageSize
      );

      this.canceledTargets = response.devices;
      this.totalCanceledTargetsCount = response.totalCount;
      this.hasMoreCanceledTargets = this.canceledTargets.length < this.totalCanceledTargetsCount;
      this.canceledTargetsOffset += this.canceledTargetsPageSize;

      console.log('✅ Objetivos cancelados cargados exitosamente:', {
        cantidad: this.canceledTargets.length,
        total: this.totalCanceledTargetsCount,
        hasMore: this.hasMoreCanceledTargets
      });

    } catch (error) {
      console.error('❌ Error al cargar objetivos cancelados:', error);
      this.canceledTargets = [];
      this.totalCanceledTargetsCount = 0;
      this.hasMoreCanceledTargets = false;
    } finally {
      this.loadingCanceledTargets = false;
    }
  }

  /**
   * Carga más objetivos cancelados para el scroll infinito
   */
  async loadMoreCanceledTargets() {
    if (!this.hasMoreCanceledTargets || this.loadingMoreCanceledTargets) {
      return;
    }

    try {
      this.loadingMoreCanceledTargets = true;

      // Obtener el parent ID desde la URL
      const parentId = this.getParentIdFromUrl();

      if (!parentId) {
        console.warn('⚠️ No se pudo obtener el parent ID desde la URL para cargar más objetivos cancelados');
        return;
      }

      console.log('🔄 Cargando más objetivos cancelados:', {
        parentId,
        offset: this.canceledTargetsOffset,
        pageSize: this.canceledTargetsPageSize
      });

      // Cargar siguiente página de objetivos cancelados
      const response = await this.targetsService.getCanceledTargetsWithPagination(
        parentId,
        this.canceledTargetsOffset,
        this.canceledTargetsPageSize
      );

      // Agregar nuevos targets a la lista existente
      this.canceledTargets = [...this.canceledTargets, ...response.devices];
      this.totalCanceledTargetsCount = response.totalCount;
      this.hasMoreCanceledTargets = this.canceledTargets.length < this.totalCanceledTargetsCount;
      this.canceledTargetsOffset += this.canceledTargetsPageSize;

      console.log('✅ Más objetivos cancelados cargados:', {
        nuevos: response.devices.length,
        total: this.canceledTargets.length,
        hasMore: this.hasMoreCanceledTargets
      });

    } catch (error) {
      console.error('❌ Error al cargar más objetivos cancelados:', error);
    } finally {
      this.loadingMoreCanceledTargets = false;
    }
  }

  /**
   * Maneja el evento de scroll en la lista de targets cancelados
   */
  onCanceledTargetsScroll(event: Event) {
    const element = event.target as HTMLElement;
    const threshold = 50; // pixels desde el final

    const atBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + threshold;

    if (atBottom && this.hasMoreCanceledTargets && !this.loadingMoreCanceledTargets) {
      console.log('🔄 Scroll infinito detectado - cargando más targets cancelados');
      this.loadMoreCanceledTargets();
    }
  }

  /**
   * Obtiene el parent ID desde la URL actual
   */
  private getParentIdFromUrl(): string | null {
    const url = this.router.url;
    console.log('🔍 URL actual para extraer parent ID:', url);

    // El routing de management es /admin/management/:op/:user
    // Necesitamos extraer el parámetro 'user' que es el segundo después de 'management'
    const managementPattern = /\/admin\/management\/([^\/\?]+)\/([^\/\?]+)/;
    const match = url.match(managementPattern);

    if (match && match[2]) {
      const parentId = match[2];
      console.log('✅ Parent ID extraído de la URL:', parentId);
      return parentId;
    }

    // Fallback: Si no se encuentra el patrón, intentar obtener desde route.snapshot.params
    try {
      const routeParams = this.route.snapshot.params;
      console.log('📋 Route params como fallback:', routeParams);

      if (routeParams['user']) {
        console.log('✅ Parent ID desde route params:', routeParams['user']);
        return routeParams['user'];
      }
    } catch (error) {
      console.warn('⚠️ Error al obtener parámetros de ruta:', error);
    }

    console.warn('❌ No se pudo extraer parent ID desde la URL:', url);
    return null;
  }

  /**
   * Maneja la entrada de búsqueda (con debounce)
   */
  onCanceledSearch() {
    const searchTerm = this.canceledSearchTerm.trim();
    this.searchCanceledSubject$.next(searchTerm);
  }

  /**
   * Realiza la búsqueda de objetivos cancelados (llamado por el debounce)
   */
  async performCanceledSearch(searchTerm: string) {
    if (!searchTerm) {
      // Si no hay término de búsqueda, mostrar todos los objetivos cancelados
      this.canceledSearchResults = [];
      return;
    }

    if (searchTerm.length < 2) {
      // Requiere al menos 2 caracteres para buscar
      return;
    }

    try {
      this.isSearchingCanceled = true;

      const parentId = this.getParentIdFromUrl();
      if (!parentId) {
        console.warn('⚠️ No se puede buscar sin parent ID');
        return;
      }

      console.log('🔍 Buscando objetivos cancelados:', {
        parentId,
        searchTerm
      });

      this.canceledSearchResults = await this.targetsService.searchCanceledTargets(parentId, searchTerm);

      console.log('✅ Resultados de búsqueda de objetivos cancelados:', {
        cantidad: this.canceledSearchResults.length,
        resultados: this.canceledSearchResults
      });

    } catch (error) {
      console.error('❌ Error al buscar objetivos cancelados:', error);
      this.canceledSearchResults = [];
    } finally {
      this.isSearchingCanceled = false;
    }
  }

  /**
   * Limpia la búsqueda de objetivos cancelados
   */
  clearCanceledSearch() {
    this.canceledSearchTerm = '';
    this.canceledSearchResults = [];
  }

  /**
   * Obtiene los objetivos a mostrar (resultados de búsqueda o todos)
   */
  get displayedCanceledTargets(): Target[] {
    return this.canceledSearchResults.length > 0 || this.canceledSearchTerm.trim()
      ? this.canceledSearchResults
      : this.canceledTargets;
  }

  /**
   * Muestra los detalles de un target cancelado
   */
  async showTargetDetails(target: Target) {
    this.selectedTargetDetails = target;
    this.targetDetailsVisible = true;
    await this.loadTargetProcesses(target);
  }

  /**
   * Restaura un target cancelado
   */
  async restoreTarget(targetId: string) {
    console.log('🔄 Iniciando restauración de target:', targetId);

    if (!targetId) {
      console.error('❌ ID del target es requerido para restaurar');
      return;
    }

    try {
      // Mostrar confirmación
      this.confirmationService.confirm({
        message: '¿Está seguro de que desea restaurar este target?',
        header: 'Confirmar restauración',
        icon: 'pi pi-refresh',
        acceptLabel: 'Sí, restaurar',
        rejectLabel: 'Cancelar',
        accept: async () => {
          try {
            // Llamar al servicio para restaurar
            console.log('📡 Ejecutando restauración...');
            await this.targetsService.restoreTarget(targetId);

            // Mostrar mensaje de éxito
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Target restaurado correctamente'
            });

            // Registrar proceso de restauración
            await this.registerRestorationProcess(targetId);

            // Actualizar la lista de cancelados
            await this.loadCanceledTargets();

            // Notificar que se han actualizado objetivos para refrescar management
            this.selectionService.notifyTargetsUpdated();

            // Cerrar el modal de detalles si está abierto
            if (this.targetDetailsVisible && this.selectedTargetDetails?._id === targetId) {
              this.closeTargetDetails();
            }

          } catch (error: any) {
            console.error('❌ Error al restaurar target:', error);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: error.message || 'Error al restaurar el target'
            });
          }
        }
      });

    } catch (error: any) {
      console.error('❌ Error en el proceso de restauración:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Error al procesar la restauración'
      });
    }
  }

  /**
   * Elimina permanentemente un target cancelado
   */
  async deleteTarget(targetId: string) {
    console.log('🗑️ Iniciando eliminación permanente de target:', targetId);

    if (!targetId) {
      console.error('❌ ID del target es requerido para eliminar');
      return;
    }

    try {
      // Mostrar confirmación más estricta para eliminación permanente
      this.confirmationService.confirm({
        message: '¿Está seguro de que desea ELIMINAR PERMANENTEMENTE este target? Esta acción no se puede deshacer.',
        header: 'Confirmar eliminación permanente',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Sí, eliminar permanentemente',
        rejectLabel: 'Cancelar',
        acceptButtonStyleClass: 'p-button-danger',
        accept: async () => {
          try {
            // Llamar al servicio para eliminar
            console.log('📡 Ejecutando eliminación permanente...');
            await this.targetsService.deleteTarget(targetId);

            // Mostrar mensaje de éxito
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Target eliminado permanentemente'
            });

            // Registrar proceso de eliminación
            await this.registerDeletionProcess(targetId);

            // Actualizar la lista de cancelados
            await this.loadCanceledTargets();

            // Notificar que se han actualizado objetivos para refrescar management
            this.selectionService.notifyTargetsUpdated();

            // Cerrar el modal de detalles si está abierto
            if (this.targetDetailsVisible && this.selectedTargetDetails?._id === targetId) {
              this.closeTargetDetails();
            }

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

  /**
   * Registra un proceso de restauración para el target
   */
  private async registerRestorationProcess(targetId: string): Promise<void> {
    try {
      console.log('📝 Registrando proceso de restauración para target:', targetId);

      // Obtener información del target restaurado
      const targetDetails = this.selectedTargetDetails || this.canceledTargets.find(t => t._id === targetId);
      if (!targetDetails) {
        console.warn('⚠️ No se encontró información del target para registrar el proceso');
        return;
      }

      const currentUser = this.authService.getCurrentUser();
      const currentDate = new Date().toISOString();

      // Preparar los datos del proceso de restauración
      const processData: CreateProcessDto = {
        type: this.processTypeMap['restoration'] || 16,
        registrationDate: currentDate,
        description: 'Target restaurado desde cancelados',
        details: `El target "${targetDetails.name}" fue restaurado desde el estado cancelado por el usuario ${currentUser?.name || 'Sistema'}.`,
        target: {
          _id: targetDetails._id,
          name: targetDetails.name,
          device_imei: targetDetails.device_imei || targetDetails.imei,
          sim_card_number: targetDetails.sim_card_number || targetDetails.sim_card
        },
        user: {
          _id: currentUser?.id || "sistema_id",
          name: currentUser?.name || "Sistema",
          email: currentUser?.email || "sistema@montao.com"
        },
        reference: targetDetails._id,
        before: {
          status: "canceled",
          lastProcess: null
        },
        after: {
          status: "restored",
          processType: 'restoration',
          processDate: currentDate
        },
        creator: currentUser?.id || "sistema_id"
      };

      // Registrar el proceso
      await this.targetsService.createProcess(processData);
      console.log('✅ Proceso de restauración registrado exitosamente');

    } catch (error: any) {
      console.error('❌ Error al registrar proceso de restauración:', error);
      // No mostramos error al usuario para no interrumpir el flujo, solo lo logueamos
    }
  }

  /**
   * Registra un proceso de eliminación para el target
   */
  private async registerDeletionProcess(targetId: string): Promise<void> {
    try {
      console.log('📝 Registrando proceso de eliminación para target:', targetId);

      // Obtener información del target eliminado
      const targetDetails = this.selectedTargetDetails || this.canceledTargets.find(t => t._id === targetId);
      if (!targetDetails) {
        console.warn('⚠️ No se encontró información del target para registrar el proceso');
        return;
      }

      const currentUser = this.authService.getCurrentUser();
      const currentDate = new Date().toISOString();

      // Preparar los datos del proceso de eliminación
      const processData: CreateProcessDto = {
        type: this.processTypeMap['deletion'] || 17, // Tipo de eliminación
        registrationDate: currentDate,
        description: 'Target eliminado permanentemente',
        details: `El target "${targetDetails.name}" fue eliminado permanentemente del sistema por el usuario ${currentUser?.name || 'Sistema'}.`,
        target: {
          _id: targetDetails._id,
          name: targetDetails.name,
          device_imei: targetDetails.device_imei || targetDetails.imei,
          plate: targetDetails.plate || 'N/A'
        },
        user: {
          _id: currentUser?.id || 'system',
          name: currentUser?.name || 'Sistema',
          email: currentUser?.email || 'system@montaogps.com'
        },
        reference: targetId,
        before: {
          status: 'canceled',
          name: targetDetails.name
        },
        after: {
          status: 'deleted',
          name: targetDetails.name
        },
        creator: currentUser?.id || 'system'
      };

      // Crear el proceso
      await this.targetsService.createProcess(processData);

      console.log('✅ Proceso de eliminación registrado exitosamente');

    } catch (error: any) {
      console.error('❌ Error al registrar proceso de eliminación:', error);
      // No mostramos error al usuario para no interrumpir el flujo, solo lo logueamos
    }
  }

  /**
   * Carga los procesos de un target específico
   */
  async loadTargetProcesses(target: Target) {
    try {
      this.loadingTargetProcesses = true;
      this.targetProcesses = [];

      const targetId = target._id;
      console.log('🔍 Cargando procesos para target:', targetId);

      // Cargar procesos usando el ID del target
      this.targetProcesses = await this.targetsService.getProcessesByReference(targetId);

      console.log('✅ Procesos del objetivo cargados:', {
        targetId,
        cantidad: this.targetProcesses.length,
        procesos: this.targetProcesses
      });

    } catch (error) {
      console.error('❌ Error al cargar procesos del target:', error);
      this.targetProcesses = [];
    } finally {
      this.loadingTargetProcesses = false;
    }
  }

  /**
   * Cierra el modal de detalles
   */
  closeTargetDetails() {
    this.targetDetailsVisible = false;
    this.selectedTargetDetails = null;
    this.targetProcesses = [];
    this.loadingTargetProcesses = false;
  }

  /**
   * Carga la lista de planes para mostrar nombres en lugar de IDs
   */
  private loadPlans() {
    this.plansService.getAllPlans().subscribe({
      next: (plans: Plan[]) => {
        this.plans = plans;
        console.log('✅ Planes cargados para el navbar:', this.plans.length);
      },
      error: (error) => {
        console.error('❌ Error al cargar planes en navbar:', error);
        this.plans = [];
      }
    });
  }

  /**
   * Busca un plan por ID y retorna su nombre
   */
  private getPlanNameById(planId: string): string {
    const plan = this.plans.find(p => p._id === planId);
    return plan ? plan.plan_name : planId; // Si no encuentra el plan, muestra el ID
  }

  /**
   * Obtiene el texto de visualización del plan
   */
  getPlanDisplayText(plan: any): string {
    if (!plan) return 'No asignado';

    if (typeof plan === 'string') {
      // Si es un string, podría ser un ID, intentar buscar el nombre
      return this.getPlanNameById(plan);
    }

    if (typeof plan === 'object' && plan.id_plan) {
      // Si es un objeto con id_plan, buscar el nombre del plan
      const planName = this.getPlanNameById(plan.id_plan);
      let displayText = planName;

      if (plan.selected_price) {
        displayText += ` - $${plan.selected_price.amount}`;
        if (plan.selected_price.payment_period) {
          displayText += ` (${plan.selected_price.payment_period})`;
        }
      }
      return displayText;
    }

    return JSON.stringify(plan);
  }

  /**
   * Obtiene el texto de visualización del precio
   */
  getPriceDisplayText(price: any): string {
    if (!price) return 'No asignado';

    if (typeof price === 'object' && price.amount) {
      let displayText = price.amount.toString();
      if (price.payment_period) {
        displayText += ` (${price.payment_period})`;
      }
      return displayText;
    }

    return JSON.stringify(price);
  }

  /**
   * Obtiene el texto de visualización de los contactos
   */
  getContactsDisplayText(contacts: any): string {
    if (!contacts) return 'No especificado';

    if (Array.isArray(contacts)) {
      return contacts.join(', ');
    }

    if (typeof contacts === 'string') {
      return contacts;
    }

    return JSON.stringify(contacts);
  }

  /**
   * Obtiene la clase CSS para el estado de Traccar
   */
  getTraccarStatusClass(status: string): string {
    if (!status) return '';

    switch (status.toLowerCase()) {
      case 'online':
        return 'online';
      case 'offline':
        return 'canceled';
      default:
        return '';
    }
  }

  /**
   * Obtiene el texto de visualización para Yes/No
   */
  getYesNoDisplayText(value: any): string {
    if (!value) return 'No especificado';

    if (typeof value === 'string') {
      switch (value.toLowerCase()) {
        case 'yes':
        case 'sí':
        case 'si':
        case 'true':
          return 'Sí';
        case 'no':
        case 'false':
          return 'No';
        default:
          return value;
      }
    }

    if (typeof value === 'boolean') {
      return value ? 'Sí' : 'No';
    }

    return String(value);
  }

  /**
   * Obtiene el texto de visualización del estado
   */
  getStatusDisplayText(status: any): string {
    if (!status) return 'No especificado';

    if (typeof status === 'string') {
      switch (status.toLowerCase()) {
        case 'active':
          return 'Activo';
        case 'inactive':
          return 'Inactivo';
        default:
          return status;
      }
    }

    if (typeof status === 'boolean') {
      return status ? 'Activo' : 'Inactivo';
    }

    return String(status);
  }

  /**
   * Obtiene el texto de visualización de la marca
   */
  getBrandDisplayText(brandId: string): string {
    if (!brandId) return '';
    // Aquí podrías hacer una búsqueda en un array de marcas si tienes los datos
    // Por ahora devolvemos el ID
    return brandId;
  }

  /**
   * Obtiene el texto de visualización del modelo
   */
  getModelDisplayText(modelId: string): string {
    if (!modelId) return '';
    // Aquí podrías hacer una búsqueda en un array de modelos si tienes los datos
    // Por ahora devolvemos el ID
    return modelId;
  }

  /**
   * Obtiene el texto de visualización del color
   */
  getColorDisplayText(colorValue: string): string {
    if (!colorValue) return '';

    // Si es un valor hex, podrías convertirlo a nombre
    const colorNames: { [key: string]: string } = {
      '#FFFFFF': 'Blanco',
      '#000000': 'Negro',
      '#FF0000': 'Rojo',
      '#0000FF': 'Azul',
      '#008000': 'Verde',
      '#FFFF00': 'Amarillo',
      '#FFA500': 'Naranja',
      '#800080': 'Púrpura',
      '#A0A0A0': 'Gris',
      '#C0C0C0': 'Plata'
    };

    return colorNames[colorValue] || colorValue;
  }

  // Connection Alert Methods

  openConnectionAlertModal(): void {
    this.connectionAlertDialogVisible = true;
    if (this.currentUser?.email) {
      this.connectionNotificationEmail = this.currentUser.email;
      if (this.currentUser.id) {
        this.connectionNotificationEmailUserId = this.currentUser.id;
      }
    }
    this.loadConnectionAlerts();
  }

  onConnectionNotificationEmailChange(): void {
    if (
      this.connectionNotificationEmail &&
      this.currentUser?.email &&
      this.connectionNotificationEmail.trim().toLowerCase() ===
      this.currentUser.email.toLowerCase() &&
      this.currentUser?.id
    ) {
      this.connectionNotificationEmailUserId = this.currentUser.id;
    } else {
      this.connectionNotificationEmailUserId = null;
    }
  }

  async verifyConnectionNotificationEmail(): Promise<void> {
    const email = this.connectionNotificationEmail?.trim();
    if (!email) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('common.warning'),
        detail: this.translate.instant('navbar.verifyEmailRequired')
      });
      return;
    }

    if (
      this.currentUser?.email &&
      email.toLowerCase() === this.currentUser.email.toLowerCase() &&
      this.currentUser?.id
    ) {
      this.connectionNotificationEmailUserId = this.currentUser.id;
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('common.success'),
        detail: this.translate.instant('navbar.verifyEmailSuccess')
      });
      return;
    }

    this.verifyingConnectionNotificationEmail = true;
    try {
      const user = await firstValueFrom(this.userService.getByEmail(email));
      const userId = user?._id || (user as any)?.id;

      if (userId) {
        this.connectionNotificationEmailUserId = userId;
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('common.success'),
          detail: this.translate.instant('navbar.verifyEmailSuccess')
        });
      } else {
        this.connectionNotificationEmailUserId = null;
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('common.warning'),
          detail: this.translate.instant('navbar.verifyEmailNotFound')
        });
      }
    } catch (error) {
      this.connectionNotificationEmailUserId = null;
      console.error('❌ Error verificando correo para alerta de conexión:', error);
      const detail =
        (error as any)?.error?.message ||
        this.translate.instant('navbar.verifyEmailError');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail
      });
    } finally {
      this.verifyingConnectionNotificationEmail = false;
    }
  }

  async createConnectionAlert(): Promise<void> {
    const targetIds = (this.currentSelectedTargets || [])
      .map(target => target?._id || (target as any)?.id)
      .filter((id): id is string => !!id);

    if (!targetIds.length) {
      const userIdFromUrl = this.getParentIdFromUrl();
      if (!userIdFromUrl) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('common.warning'),
          detail: this.translate.instant('navbar.userIdRequired')
        });
        return;
      }
      targetIds.push(userIdFromUrl);
    }

    if (this.connectionNotificationEmail?.trim() && !this.connectionNotificationEmailUserId) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('common.warning'),
        detail: this.translate.instant('navbar.verifyEmailPending')
      });
      return;
    }

    const payload = {
      type: 'connection' as const,
      connectionAlertType: this.connectionAlertType,
      targetIds,
      userTopic: this.connectionNotificationEmailUserId || undefined,
      email: this.connectionNotificationEmail || undefined,
      message: this.connectionAlertMessage?.trim() || undefined
    };

    this.creatingConnectionAlert = true;

    try {
      await firstValueFrom(this.alertsService.createAlert(payload));

      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('navbar.createAlert'),
        detail: `${this.translate.instant('navbar.alertOptionConnection')} creada exitosamente`
      });

      this.connectionAlertMessage = '';
      this.resetConnectionNotificationEmail();
      await this.loadConnectionAlerts();
    } catch (error: any) {
      console.error('❌ Error al crear la alerta de conexión:', error);
      const detail = error?.error?.message ||
        this.translate.instant('navbar.createAlertError');

      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.error'),
        detail
      });
    } finally {
      this.creatingConnectionAlert = false;
    }
  }

  private resetConnectionNotificationEmail(): void {
    if (this.currentUser?.email && this.currentUser?.id) {
      this.connectionNotificationEmail = this.currentUser.email;
      this.connectionNotificationEmailUserId = this.currentUser.id;
    } else {
      this.connectionNotificationEmail = '';
      this.connectionNotificationEmailUserId = null;
    }
  }

  async loadConnectionAlerts(): Promise<void> {
    this.loadingConnectionAlerts = true;
    try {
      const allAlerts = await firstValueFrom(this.alertsService.getAlerts());
      this.connectionAlerts = allAlerts.filter(alert => alert.type === 'connection');
      this.filterConnectionAlertsForSelection();
    } catch (error) {
      console.error('Error loading connection alerts:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudieron cargar las alertas de conexión'
      });
    } finally {
      this.loadingConnectionAlerts = false;
    }
  }

  filterConnectionAlertsForSelection(): void {
    if (!this.connectionAlerts.length) {
      this.visibleConnectionAlerts = [];
      return;
    }

    const selectedIds = new Set(
      this.currentSelectedTargets
        .map(t => t._id || (t as any).id)
        .filter(id => !!id)
    );

    if (selectedIds.size === 0) {
      const parentId = this.getParentIdFromUrl();
      if (parentId) {
        this.visibleConnectionAlerts = this.connectionAlerts.filter(alert =>
          alert.targetIds && alert.targetIds.includes(parentId)
        );
      } else {
        this.visibleConnectionAlerts = [];
      }
      return;
    }

    this.visibleConnectionAlerts = this.connectionAlerts.filter(alert => {
      if (!alert.targetIds || alert.targetIds.length === 0) return false;
      return alert.targetIds.some(id => selectedIds.has(id));
    });
  }

  async toggleConnectionAlert(alert: AlertResponse): Promise<void> {
    if (!alert._id) return;

    this.togglingConnectionAlertId = alert._id;
    const newStatus = alert.status === 'active' ? 'inactive' : 'active';

    try {
      await firstValueFrom(this.alertsService.updateAlertStatus(alert._id, newStatus));
      alert.status = newStatus;
      this.messageService.add({
        severity: 'success',
        summary: 'Actualizado',
        detail: `Alerta ${newStatus === 'active' ? 'activada' : 'desactivada'}`
      });
    } catch (error) {
      console.error('Error toggling alert:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo actualizar el estado de la alerta'
      });
    } finally {
      this.togglingConnectionAlertId = null;
    }
  }

  async deleteConnectionAlert(alertId: string): Promise<void> {
    this.deletingConnectionAlertId = alertId;
    try {
      await firstValueFrom(this.alertsService.deleteAlert(alertId));
      this.connectionAlerts = this.connectionAlerts.filter(a => a._id !== alertId);
      this.filterConnectionAlertsForSelection();
      this.messageService.add({
        severity: 'success',
        summary: 'Eliminado',
        detail: 'Alerta eliminada exitosamente'
      });
    } catch (error) {
      console.error('Error deleting alert:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo eliminar la alerta'
      });
    } finally {
      this.deletingConnectionAlertId = null;
    }
  }
}
