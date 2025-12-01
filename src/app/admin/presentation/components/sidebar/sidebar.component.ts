import { Component, OnInit } from '@angular/core';
import { StatusService } from '../../../../shareds/services/status.service';
import { AuthService } from '../../../../core/services/auth.service';
import { SystemService } from '../../../../core/services/system.service';
import { UserService } from '../../../../core/services/user.service';
import { TranslateService } from '@ngx-translate/core';
import { LangService } from '../../../../shareds/services/langi18/lang.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
  standalone: false
})
export class SidebarComponent implements OnInit {

  sidebarDisplayed = true;
  userName: string = '';
  systemLogo: string = 'logo/LOGO.png'; // Default logo
  private isEmployeeUser: boolean = false;

  sidaberOptions = {
    favoriteTitle: '',
    favoriteItems: [
      { label: '', path: '/admin/dashboard', icon: 'pi pi-objects-column', badge: 5 },
    ],
    principalTitle: '',
    principalItems: [
      { label: '', path: '/admin/management/', icon: 'pi pi-book', badge: 0 },
      { label: '', path: '/admin/inventory', icon: 'pi pi-database', badge: 0 },
      { label: '', path: '/admin/macro', icon: 'pi pi-cog', badge: 0 },
      { label: '', path: '/admin/monitoring', icon: 'pi pi-eye', badge: 0 },
      { label: '', path: '/admin/server-costs', icon: 'pi pi-wallet', badge: 0 },
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
    private userService: UserService // Inject UserService
  ) {
    this.sidebarDisplayed = status.getState('sidebar') as boolean;
  }

  ngOnInit() {
    this.updateTranslations();
    this.loadSystemSettings();
    this.loadUserProfile(); // Load user profile

    const user = this.authService.getCurrentUser();
    if (user) {
      this.userName = `${user.name} ${user.last_name}`;
      this.sidaberOptions.profileItems[1].label = this.userName;
      this.isEmployeeUser = user.affiliation_type_id === 'empleado';
      // Set monitoring path with current user ID when the current user is an employee
      if (this.isEmployeeUser) {
        this.sidaberOptions.principalItems[3].path = `/admin/monitoring/${user.id}`;
      }
    }

    this.status.statusChanges$.subscribe((newStatus) => {
      if (newStatus && typeof newStatus.sidebar !== 'undefined') {
        this.sidebarDisplayed = newStatus.sidebar as boolean;
      }
    });

    this.translate.onLangChange.subscribe(() => {
      this.updateTranslations();
    });
  }

  loadUserProfile() {
    const currentUser = this.authService.getCurrentUser();

    if (currentUser && currentUser.id) {
      this.userService.getById(currentUser.id).subscribe({
        next: (userData: any) => {
          if (userData.photo) {
            this.userPhotoUrl = userData.photo;
          }
        },
        error: (error) => {
          console.error('Error loading user profile for sidebar:', error);
        }
      });
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
    this.sidaberOptions.principalItems[0].label = this.translate.instant('sidebar.management');
    this.sidaberOptions.principalItems[1].label = this.translate.instant('sidebar.inventory');
    this.sidaberOptions.principalItems[2].label = this.translate.instant('sidebar.macro');
    this.sidaberOptions.principalItems[3].label = this.translate.instant('sidebar.monitoring');
    this.sidaberOptions.principalItems[4].label = this.translate.instant('sidebar.serverCosts');

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

  toggleSidebar() {
    this.sidebarDisplayed = !this.sidebarDisplayed;
    this.status.setState('sidebar', this.sidebarDisplayed);
  }

  // Getter para verificar si el usuario es root
  get isRootUser(): boolean {
    const currentUser = this.authService.getCurrentUser();
    return currentUser?.root === true;
  }

  // Getter para obtener los elementos del menú principal filtrados por root
  get filteredPrincipalItems() {
    return this.sidaberOptions.principalItems.filter(item => {
      // Ocultar completamente la opción macro
      if (item.path === '/admin/macro') {
        return false;
      }
      // Ocultar el módulo de monitoreo si el usuario no es empleado
      if (!this.isEmployeeUser && item.path.startsWith('/admin/monitoring')) {
        return false;
      }
      if (item.path === '/admin/server-costs') {
        return this.isRootUser;
      }
      // Si es inventory, solo mostrar si el usuario es root
      if (item.path === '/admin/inventory') {
        return this.isRootUser;
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
}
