import { Component } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { ThemesService } from '../../../../../../shareds/services/themes.service';

@Component({
  selector: 'app-management',
  templateUrl: './management.component.html',
  styleUrl: './management.component.css'
})
export class ManagementComponent {
  items: MenuItem[] | undefined;

  home: MenuItem | undefined;
  currentTheme: string | undefined;
  // constructor(public theme: ThemesService) {
  //   //  this.currentTheme = theme.getCurrentTheme();
  //  }

  ngOnInit() {


      this.items = [
          { label: 'Frankely García Diaz' }, 
          { label: 'Antonio Guzman' }, 
       
      ];

      this.home = { icon: 'pi pi-home', routerLink: '/' };
  }
}
