// Angular imports
import { Component, HostListener } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

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

    this.managementService.loadUserData(currentUser.id)
      .then(user => {
        this.selectedUser = user;
        this.items = [
          { label: `${user.name} ${user.last_name}` }
        ];
        this.loading = false;
      })
      .catch(() => {
        this.loading = false;
      });

    this.userService.getAll(currentUser.id).subscribe({
      next: (users) => {
        this.users = users;
      },
      error: (error) => {
        console.error('Error al cargar todos los usuarios:', error);
      }
    });

    this.route.params.subscribe(params => {
      if (params['user'] && params['user'] !== currentUser.id) {
        this.managementService.loadUserData(params['user']);
      }
      setTimeout(() => {
        this.managementService.verifyURLStatus(params);
      }, 100);
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

  searchUser() {
    this.managementService.setSearchUsersTerm(this.searchUsersTerm);
    this.managementService.searchUser();
  }

  searchTargets() {
    this.managementService.setSearchTargetsTerm(this.searchTargetsTerm);
    this.managementService.searchTargets();
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

  // Métodos privados
  @HostListener('window:resize', ['$event'])
  private onResize(): void {
    this.screenService.checkScreenSize();
  }
}
