import { Component, OnInit } from '@angular/core';
import { StatusService } from '../../../../shareds/services/status.service';
import { AuthService } from '../../../../core/services/auth.service';
import { SystemService } from '../../../../core/services/system.service';
import { UserService } from '../../../../core/services/user.service';
import { TranslateService } from '@ngx-translate/core';
import { LangService } from '../../../../shareds/services/langi18/lang.service';
import { InventoryService } from '../../../../core/services/inventory.service';
import { BasicUser } from '../../../../core/interfaces/user.interface';

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
  currentUser: BasicUser | null = null;
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
      { label: '', path: '/admin/fleet-management', icon: 'pi pi-car', badge: 0 },
      { label: '', path: '/admin/contracts', icon: 'pi pi-file', badge: 0 },
      { label: '', path: '/admin/reservations', icon: 'pi pi-calendar', badge: 0 },
      { label: '', path: '/admin/quotes', icon: 'pi pi-dollar', badge: 0 },
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
    private inventoryService: InventoryService
  ) {
    this.sidebarDisplayed = status.getState('sidebar') as boolean;
  }

  ngOnInit() {
    this.updateTranslations();
    this.loadSystemSettings();
    this.loadUserProfile();

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



    // Suscribirse a cambios de autenticación para actualizar el usuario
    this.authService.authState$.subscribe(isAuthenticated => {
      this.updateCurrentUser();
    });

    // Carga inicial del usuario
    this.updateCurrentUser();
  }

  updateCurrentUser() {
    this.currentUser = this.authService.getCurrentUser();
    if (this.currentUser) {
      const compType = (this.currentUser as any).company_type || (this.currentUser as any).company_type_id || 'N/A';
      this.userName = `${this.currentUser.name} ${this.currentUser.last_name} [${compType}]`;
      this.sidaberOptions.profileItems[1].label = this.userName;
      this.isEmployeeUser = this.currentUser.affiliation_type_id === 'empleado';

      // Set monitoring path with current user ID when the current user is an employee
      if (this.isEmployeeUser) {
        this.sidaberOptions.principalItems[3].path = `/admin/monitoring/${this.currentUser.id}`;
      }

      // Force change detection by re-assigning options if needed (or just relying on getter)
      console.log('Sidebar - Current User Updated:', this.currentUser);
    } else {
      this.currentUser = null;
      this.userName = '';
      this.isEmployeeUser = false;
    }
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
    this.sidaberOptions.principalItems[5].label = this.translate.instant('sidebar.fleetManagement');
    this.sidaberOptions.principalItems[6].label = this.translate.instant('sidebar.contracts');
    this.sidaberOptions.principalItems[7].label = this.translate.instant('sidebar.reservations');
    this.sidaberOptions.principalItems[8].label = this.translate.instant('sidebar.quotes');

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
    return this.currentUser?.root === true;
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
      // Si es inventory, mostrar si es root o tiene permisos de lectura
      if (item.path === '/admin/inventory') {
        return this.isRootUser || this.authService.hasPrivilege('inventory', 'read');
      }

      // Opciones exclusivas para rent_a_car
      const rentACarOptions = [
        '/admin/fleet-management',
        '/admin/contracts',
        '/admin/reservations',
        '/admin/quotes'
      ];

      if (rentACarOptions.includes(item.path)) {
        if (!this.currentUser) return false;

        // Verificar si es rent_a_car (usando company_type_id o company_type según corresponda)
        // Check settings first as it might be stored there
        const settings = (this.currentUser as any).settings;

        let companyType = (this.currentUser as any).company_type || (this.currentUser as any).company_type_id;

        if (!companyType && Array.isArray(settings) && settings.length > 0) {
          companyType = settings[0].company_type;
        } else if (!companyType && settings && typeof settings === 'object') {
          companyType = settings.company_type;
        }

        console.log('Checking Rent A Car option:', item.path, 'CompanyType:', companyType, 'User:', this.currentUser);

        return companyType === 'rent_a_car';
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
