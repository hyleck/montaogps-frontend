import { Component } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { ThemesService } from '../../../../../../shareds/services/themes.service';
import { Router, ActivatedRoute } from '@angular/router';
import { StatusService } from '../../../../../../shareds/services/status.service';

@Component({
  selector: 'app-management',
  templateUrl: './management.component.html',
  styleUrl: './management.component.css'
})
export class ManagementComponent {
  
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

constructor(
  public theme: ThemesService,
  public _router: Router,
  public route: ActivatedRoute,
  private status: StatusService
) {
  this.currentTheme = theme.getCurrentTheme();

  this.route.params.subscribe((params: any) => {
    this.op = params['op'];
    this.currentUserId = params['user'];
    const managementState: any = status.getState('management');

    if (managementState.url_route && !params['op']) {
      this._router.navigate(
        managementState.url_route,
        { queryParams: managementState.url_query_params }
      );
    } else if (!managementState.url_route && !params['op']) {
      this._router.navigate(
        ['admin/management', 't', '4541321asd3sad1sad'],
        { queryParams: { search: this.searchUsersTerm } }
      );
    }

    this.setURLStatus();
  });
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



  ngOnInit() {

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


}
