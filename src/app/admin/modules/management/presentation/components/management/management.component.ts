import { Component, HostListener } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { ThemesService } from '../../../../../../shareds/services/themes.service';
import { Router, ActivatedRoute } from '@angular/router';
import { StatusService } from '../../../../../../shareds/services/status.service';

@Component({
    selector: 'app-management',
    templateUrl: './management.component.html',
    styleUrl: './management.component.css',
    standalone: false
})
export class ManagementComponent {
  
  userFormDisplay: boolean = false;
  targetFormDisplay: boolean = false;

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
  private status: StatusService
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

    this.setURLStatus();
  }

  goDefaultRoute() {
    this._router.navigate(
      ['/admin/management', 't', '4541321asd3sad1sad'],
      { queryParams: { search: this.searchUsersTerm } }
      );
  }

  ngOnInit() {

    const params = this.route.snapshot.params;
    if(!params['op'] && !params['user']){
      this.goDefaultRoute();
    }
    

    this.route.params.subscribe((params: any) => {
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


    this.checkScreenSize();
    this.route.queryParams.subscribe(queryParams => {

      if(this.op == 'u'){
        this.searchUsersTerm = queryParams['search'];
      }else if(this.op == 't'){
        this.searchTargetsTerm = queryParams['search'];
      }

      this.setURLStatus()
    });

      this.items = [
          { label: 'Frankely García Diaz' }, 
          { label: 'Antonio Guzman' }, 
      ];

      this.home = { icon: 'pi pi-home', routerLink: '/' };
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
