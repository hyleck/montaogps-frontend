import { Component, HostListener } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { ThemesService } from '../../../../../../shareds/services/themes.service';
import { Router, ActivatedRoute } from '@angular/router';
import { StatusService } from '../../../../../../shareds/services/status.service';
import { AuthService } from '../../../../../../core/services/auth.service';
import { UserService } from '../../../../../../core/services/user.service';
import { User } from '../../../../../../core/interfaces';

@Component({
    selector: 'app-management',
    templateUrl: './management.component.html',
    styleUrl: './management.component.css',
    standalone: false
})
export class ManagementComponent {
  
  userFormDisplay: boolean = false;
  targetFormDisplay: boolean = false;
  loading: boolean = true;

// Propiedades relacionadas con el menú y la navegación
items: MenuItem[] | undefined;
home: MenuItem | undefined;

// Propiedades relacionadas con el tema
currentTheme: string | undefined;

// Propiedades relacionadas con el estado y las búsquedas
op: string | undefined;
searchUsersTerm: string = '';
searchTargetsTerm: string = '';
currentUserId: string | undefined;
showMaps: boolean = false;
selectedUser: User | undefined;

customers = [
  {
    name: 'Honda accord',
    status: 'En linea',
    imei: '13132121655444123',
    sim: '1553215448888',
    id: '1',
  },
  {
    name: 'Toyota Corolla',
    status: 'Offline',
    imei: '13132121655444124',
    sim: '1553215448889',
    id: '2',
  },
  {
    name: 'Ford Focus',
    status: 'En linea',
    imei: '13132121655444125',
    sim: '1553215448890',
    id: '3',
  },
  {
    name: 'Chevrolet Malibu',
    status: 'Offline',
    imei: '13132121655444126',
    sim: '1553215448891',
    id: '4',
  },
  {
    name: 'Nissan Altima',
    status: 'En linea',
    imei: '13132121655444127',
    sim: '1553215448892',
    id: '5',
  },
  {
    name: 'Hyundai Elantra',
    status: 'Offline',
    imei: '13132121655444128',
    sim: '1553215448893',
    id: '6',
  },
  {
    name: 'Volkswagen Jetta',
    status: 'En linea',
    imei: '13132121655444129',
    sim: '1553215448894',
    id: '7',
  },
  {
    name: 'Kia Optima',
    status: 'Offline',
    imei: '13132121655444130',
    sim: '1553215448895',
    id: '8',
  },
  {
    name: 'Subaru Impreza',
    status: 'En linea',
    imei: '13132121655444131',
    sim: '1553215448896',
    id: '9',
  },
  {
    name: 'Mazda 3',
    status: 'Offline',
    imei: '13132121655444132',
    sim: '1553215448897',
    id: '10',
  },
  {
    name: 'BMW 3 Series',
    status: 'En linea',
    imei: '13132121655444133',
    sim: '1553215448898',
    id: '11',
  }

 
];

customersSelected = [];
isScreenSmall: boolean = false;
constructor(
  public _router: Router,
  public route: ActivatedRoute,
  private status: StatusService,
  private authService: AuthService,
  private userService: UserService
) {}

 // Escucha cambios en el tamaño de la ventana
 @HostListener('window:resize', ['$event'])
 onResize(): void {
   this.checkScreenSize();
 }

 // Método para verificar si la pantalla es menor a 700px
 private checkScreenSize(): void {
   if(window.innerWidth < 500){
    this.status.setState('sidebar', false);
   }

   if(window.innerWidth < 700){
    this.status.setState('management_show_maps', { showMaps: true });
   }
  
 }

  showMapsToggle() {
    this.status.setState('management_show_maps', { showMaps: !this.showMaps });
  }

   searchUser() {
    this._router.navigate(
      ['admin/management', this.op, this.currentUserId], 
      { queryParams: { search: this.searchUsersTerm } }
    );
    this.setURLStatus()
   }

   searchTargets() {
    this._router.navigate(
      ['admin/management', this.op, this.currentUserId], 
      { queryParams: { search: this.searchTargetsTerm } }
    );
    this.setURLStatus()
   }
  


   setOp(op: string) {

    this.op = op;
  
    const searchTerms: { [key: string]: string | undefined } = {
      u: this.searchUsersTerm,
      t: this.searchTargetsTerm
    };
  
    const searchParam = searchTerms[op];
  
    this._router.navigate(
      ['admin/management', op, this.currentUserId],
      { queryParams: { search: searchParam } }
    );
  }
  


  setURLStatus() {
    this.status.setState( 'management',
      { 
        url_query_params: { search: this.op == 'u'? this.searchUsersTerm : this.searchTargetsTerm },
        url_route: ['admin/management', this.op, this.currentUserId] 
      });
  }

  loadUserData(userId: string, isInitialLoad: boolean = false) {
    if (isInitialLoad) {
      this.loading = true;
    }
    
    this.userService.getById(userId).subscribe({
      next: (user) => {
        this.selectedUser = user;
        // Actualizar el breadcrumb con el nombre del usuario
        this.items = [
          { label: `${user.name} ${user.last_name}` }
        ];
        if (isInitialLoad) {
          setTimeout(() => {
            this.loading = false;
          }, 1000);
        }
      },
      error: (error) => {
        console.error('Error al cargar los datos del usuario:', error);
        // Si hay error al cargar el usuario, redirigir al dashboard
        this._router.navigate(['/admin/dashboard']);
        if (isInitialLoad) {
          this.loading = false;
        }
      }
    });
  }

  verifyURLStatus(params: any) {
    this.op = params['op'];
    this.currentUserId = params['user'];
    const managementState: any = this.status.getState('management');

    if (managementState.url_route[1] && !params['op'] && !params['user']) {
      this._router.navigate(
        managementState.url_route,
        { queryParams: managementState.url_query_params }
      );
    } else if (!managementState.url_route[1] && !params['op'] && !params['user']) {
      this.goDefaultRoute();
    }

    // Si hay un ID de usuario en la URL, cargar sus datos sin mostrar el skeleton
    if (this.currentUserId) {
      this.loadUserData(this.currentUserId, false);
    }

    this.setURLStatus();
  }

  goDefaultRoute() {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this._router.navigate(['admin/management', 'u', currentUser.id]);
    } else {
      this._router.navigate(['auth/login']);
    }
  }

  ngOnInit() {
    this.loading = true;
    this.checkScreenSize();

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      this._router.navigate(['auth/login']);
      return;
    }

    this.currentUserId = currentUser.id;
    
    this.loadUserData(currentUser.id, true);

    this.route.params.subscribe(params => {
      if (params['user'] && params['user'] !== this.currentUserId) {
        this.loadUserData(params['user'], false);
      }
      this.verifyURLStatus(params);
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
      if(this.op == 'u'){
        this.searchUsersTerm = queryParams['search'];
      }else if(this.op == 't'){
        this.searchTargetsTerm = queryParams['search'];
      }
      this.setURLStatus();
    });

    this.home = { icon: 'pi pi-home', routerLink: '/admin/dashboard' };
  }


 

  // showDialog() {
  //     this.visible = true;
  // }

  showUserForm() {
    this.userFormDisplay = true;
  }

  showTargetForm() {
    this.targetFormDisplay = true;
  }


}
