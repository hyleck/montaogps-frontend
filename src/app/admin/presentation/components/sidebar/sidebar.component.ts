import { Component, OnDestroy, OnInit } from '@angular/core';
import { StatusService } from '../../../../shareds/services/status.service';
import { AuthService } from '../../../../core/services/auth.service';
import { SystemService } from '../../../../core/services/system.service';
import { UserService } from '../../../../core/services/user.service';
import { TranslateService } from '@ngx-translate/core';
import { LangService } from '../../../../shareds/services/langi18/lang.service';
import { InventoryService } from '../../../../core/services/inventory.service';
import { BasicUser } from '../../../../core/interfaces/user.interface';
import { ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { ChatwootNotificationSoundService } from '../../../../core/services/chatwoot-notification-sound.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
  standalone: false
})
export class SidebarComponent implements OnInit, OnDestroy {

  sidebarDisplayed = true;
  userName: string = '';
  systemLogo: string = 'logo/LOGO.png'; // Default logo
  currentUser: BasicUser | null = null;
  private isEmployeeUser: boolean = false;
  private isCompanyUser: boolean = false;
  private hasInbox: boolean = false;
  private chatwootBadgeSubscription?: Subscription;

  sidaberOptions = {
    favoriteTitle: '',
    favoriteItems: [
      { label: '', path: '/admin/dashboard', icon: 'pi pi-objects-column', badge: 5 },
    ],
    principalTitle: '',
    principalItems: [
      { label: '', path: '/admin/management/', icon: 'pi pi-book', badge: 0 },
      { label: '', path: '/admin/empleados', icon: 'pi pi-id-card', badge: 0 },
      { label: '', path: '/admin/inventory', icon: 'pi pi-database', badge: 0 },
      { label: '', path: '/admin/solicitudes', icon: 'pi pi-clipboard', badge: 0 },
      { label: '', path: '/admin/monitoring', icon: 'pi pi-eye', badge: 0 },
      { label: '', path: '/admin/server-costs', icon: 'pi pi-wallet', badge: 0 },
      { label: '', path: '/admin/communication', icon: 'pi pi-comments', badge: 0 },
      { label: '', path: '/admin/processes', icon: 'pi pi-list', badge: 0 },
      { label: '', path: '/admin/interacciones', icon: 'pi pi-share-alt', badge: 0 },
      { label: '', path: '/admin/simcard-verification', icon: 'pi pi-mobile', badge: 0 },
      { label: '', path: '/admin/monitor-ia', icon: 'pi pi-android', badge: 0 },
    ],
    profileTitle: '',
    profileItems: [
      { label: '', path: '/admin/settings', icon: 'pi pi-cog', badge: 0 },
      { label: '', path: '/admin/profile', icon: 'pi pi-user', badge: 0 },
    ]
  }

  userPhotoUrl: string | null = null;

  constructor(
    private status: StatusService,
    private authService: AuthService,
    private systemService: SystemService,
    private translate: TranslateService,
    private langService: LangService,
    private userService: UserService,
    private inventoryService: InventoryService,
    private chatwootNotificationSound: ChatwootNotificationSoundService,
    private cdr: ChangeDetectorRef
  ) {
    this.sidebarDisplayed = status.getState('sidebar') as boolean;
  }

  ngOnInit() {
    this.updateTranslations();

    // Defer HTTP calls so the UI paints first
    setTimeout(() => {
      this.loadSystemSettings();

      // Check inventory stock
      if (this.authService.hasPrivilege('inventory', 'read') || this.isRootUser) {
        this.inventoryService.checkLowStock();
        this.inventoryService.lowStockCount$.subscribe((count: number) => {
          const inventoryItem = this.sidaberOptions.principalItems.find(i => i.path === '/admin/inventory');
          if (inventoryItem) {
            inventoryItem.badge = count;
          }
        });
      }
    }, 0);

    // Suscribirse a cambios de autenticación para actualizar el usuario
    this.authService.authState$.subscribe(isAuthenticated => {
      this.updateCurrentUser();
    });

    // Carga inicial del usuario
    this.updateCurrentUser();

    this.chatwootBadgeSubscription = this.chatwootNotificationSound.pendingCount$.subscribe((count) => {
      this.updatePrincipalBadge('/admin/communication', count);
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.chatwootBadgeSubscription?.unsubscribe();
  }

  updateCurrentUser() {
    this.currentUser = this.authService.getCurrentUser();
    if (this.currentUser) {
      const compType = (this.currentUser as any).company_type || (this.currentUser as any).company_type_id || 'N/A';
      this.userName = `${this.currentUser.name} ${this.currentUser.last_name} [${compType}]`;
      this.sidaberOptions.profileItems[1].label = this.userName;
      this.isEmployeeUser = this.currentUser.affiliation_type_id === 'empleado';
      this.isCompanyUser = this.currentUser.profile_type_id === 'empresa';

      this.updateMonitoringPath();

      // Force change detection by re-assigning options if needed (or just relying on getter)
      console.log('Sidebar - Current User Updated:', this.currentUser);
      this.loadUserProfile();
    } else {
      this.currentUser = null;
      this.userName = '';
      this.isEmployeeUser = false;
      this.isCompanyUser = false;
      this.hasInbox = false;
    }
  }

  loadUserProfile() {
    const currentUser = this.authService.getCurrentUser();

    if (currentUser && currentUser.id) {
      this.userService.getById(currentUser.id).subscribe({
        next: (userData: any) => {
          this.isCompanyUser = userData.profile_type_id === 'empresa';
          this.isEmployeeUser = userData.affiliation_type_id === 'empleado';
          this.currentUser = {
            ...currentUser,
            profile_type_id: userData.profile_type_id || currentUser.profile_type_id,
            affiliation_type_id: userData.affiliation_type_id || currentUser.affiliation_type_id,
          };
          localStorage.setItem('user', JSON.stringify(this.currentUser));
          this.updateMonitoringPath();

          if (userData.photo) {
            this.userPhotoUrl = userData.photo;
          }
          this.hasInbox = !!userData.inbox || !!userData.inbox2;
          this.cdr.detectChanges(); // Force redraw the sidebar options
        },
        error: (error) => {
          console.error('Error loading user profile for sidebar:', error);
        }
      });
    }
  }

  private updateMonitoringPath() {
    const monitoringItem = this.sidaberOptions.principalItems.find(item =>
      item.path.startsWith('/admin/monitoring')
    );

    if (monitoringItem && this.currentUser?.id && this.canAccessMonitoring) {
      monitoringItem.path = `/admin/monitoring/${this.currentUser.id}`;
    }
  }

  updateTranslations() {
    // Títulos de las secciones
    this.sidaberOptions.favoriteTitle = this.translate.instant('sidebar.favorites');
    this.sidaberOptions.principalTitle = this.translate.instant('sidebar.mainMenu');
    this.sidaberOptions.profileTitle = this.translate.instant('sidebar.system');

    // Elementos favoritos
    this.sidaberOptions.favoriteItems[0].label = this.translate.instant('sidebar.dashboard');

    // Elementos del menú principal
    this.setPrincipalLabel('/admin/management/', this.translate.instant('sidebar.management'));
    this.setPrincipalLabel('/admin/empleados', 'Empleados');
    this.setPrincipalLabel('/admin/inventory', this.translate.instant('sidebar.inventory'));
    this.setPrincipalLabel('/admin/solicitudes', 'Solicitudes');
    this.setPrincipalLabel('/admin/monitoring', this.translate.instant('sidebar.monitoring'));
    this.setPrincipalLabel('/admin/server-costs', this.translate.instant('sidebar.serverCosts'));
    this.setPrincipalLabel('/admin/communication', 'Comunicación');
    this.setPrincipalLabel('/admin/processes', 'Procesos');
    this.setPrincipalLabel('/admin/interacciones', 'Campañas');
    this.setPrincipalLabel('/admin/simcard-verification', 'Verificación SIMs');
    this.setPrincipalLabel('/admin/monitor-ia', 'Monitor IA');

    // Elementos del perfil
    this.sidaberOptions.profileItems[0].label = this.translate.instant('sidebar.settings');
  }

  loadSystemSettings() {
    this.systemService.getAll().subscribe({
      next: (systems) => {
        if (systems && systems.length > 0) {
          const system = systems[0];
          if (system.logo) {
            this.systemLogo = system.logo;
          }
        }
      },
      error: (error) => {
        console.error('Error loading system settings:', error);
        // Keep default logo if system settings can't be loaded
      }
    });
  }

  private setPrincipalLabel(path: string, label: string): void {
    const item = this.sidaberOptions.principalItems.find(option => option.path === path);
    if (item) {
      item.label = label;
    }
  }

  private updatePrincipalBadge(path: string, badge: number): void {
    const item = this.sidaberOptions.principalItems.find(option => option.path === path);
    if (item) {
      item.badge = Math.max(0, Number(badge) || 0);
    }
  }

  toggleSidebar() {
    this.sidebarDisplayed = !this.sidebarDisplayed;
    this.status.setState('sidebar', this.sidebarDisplayed);
  }

  handleItemClick(event: Event, item: any) {
    const externalUrl = this.getExternalUrl(item);

    if (externalUrl) {
      event.preventDefault();
      window.location.href = externalUrl;
      return;
    }

  }

  getExternalUrl(item: unknown): string {
    if (!item || typeof item !== 'object' || !('externalUrl' in item)) {
      return '';
    }

    return String((item as { externalUrl?: string }).externalUrl || '');
  }

  // Getter para verificar si el usuario es root
  get isRootUser(): boolean {
    return this.currentUser?.root === true;
  }

  get canAccessMonitoring(): boolean {
    return this.isEmployeeUser || this.isCompanyUser || this.isRootUser;
  }

  // Getter para obtener los elementos del menú principal filtrados por root
  get filteredPrincipalItems() {
    return this.sidaberOptions.principalItems.filter(item => {

      // Ocultar el módulo de monitoreo si el usuario no es empleado, empresa o root
      if (!this.canAccessMonitoring && item.path.startsWith('/admin/monitoring')) {
        return false;
      }
      // Ocultar el módulo de empleados a todos excepto a los usuarios root
      if (item.path === '/admin/empleados') {
        return this.isRootUser;
      }
      // Ocultar solicitudes si el usuario no es empleado
      if (!this.isEmployeeUser && item.path === '/admin/solicitudes') {
        return false;
      }
      // Ocultar procesos si el usuario no es empleado
      if (!this.isEmployeeUser && item.path === '/admin/processes') {
        return false;
      }
      // Ocultar comunicación a los que no son empleados (y permitir a root)
      if (item.path === '/admin/communication') {
        return this.isRootUser || this.isEmployeeUser;
      }
      // Ocultar campañas si el usuario no es root
      if (item.path === '/admin/interacciones') {
        return this.isRootUser;
      }
      if (item.path === '/admin/server-costs') {
        return this.isRootUser;
      }
      // Si es inventory, mostrar solo si es empleado o root
      if (item.path === '/admin/inventory') {
        return this.isEmployeeUser || this.isRootUser;
      }
      // Ocultar simcard-verification si no es root
      if (item.path === '/admin/simcard-verification') {
        return this.isRootUser;
      }
      
      // Ocultar Monitor IA del sidebar
      if (item.path === '/admin/monitor-ia') {
        return false;
      }

      // Para otros elementos, mostrar siempre
      return true;
    });
  }

  // Getter para obtener los elementos del perfil filtrados por root
  get filteredProfileItems() {
    return this.sidaberOptions.profileItems.filter(item => {
      // Si es settings, solo mostrar si el usuario es root
      if (item.path === '/admin/settings') {
        return this.isRootUser;
      }
      // Para otros elementos, mostrar siempre
      return true;
    });
  }

  // Getter para obtener los elementos favoritos filtrados
  get filteredFavoriteItems() {
    return this.sidaberOptions.favoriteItems.filter(item => {
      // El dashboard ahora está adaptado para mostrar contenido diferente a Clientes vs Empleados
      if (item.path === '/admin/dashboard') {
        return true; 
      }
      return true;
    });
  }
}
