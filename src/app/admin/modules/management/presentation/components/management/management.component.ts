import { Component } from '@angular/core';
import { MenuItem } from 'primeng/api';

@Component({
  selector: 'app-management',
  templateUrl: './management.component.html',
  styleUrl: './management.component.css'
})
export class ManagementComponent {
  items: MenuItem[] | undefined;

  home: MenuItem | undefined;

  ngOnInit() {
      this.items = [
          { label: 'Frankely García Diaz' }, 
          { label: 'Antonio Guzman' }, 
       
      ];

      this.home = { icon: 'pi pi-home', routerLink: '/' };
  }
}
