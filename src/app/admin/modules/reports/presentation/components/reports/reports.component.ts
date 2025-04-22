import { Component } from '@angular/core';
import { MenuItem } from 'primeng/api';

@Component({
    selector: 'app-reports',
    templateUrl: './reports.component.html',
    styleUrl: './reports.component.css',
    standalone: false
})
export class ReportsComponent {

    items: MenuItem[] = [{ label: 'Reportes' }];
    home: MenuItem = { icon: 'pi pi-home', routerLink: '/admin/dashboard' };
    

}
