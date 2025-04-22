import { Component } from '@angular/core';
import { MenuItem } from 'primeng/api';

@Component({
    selector: 'app-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrl: './dashboard.component.css',
    standalone: false
})
export class DashboardComponent {

    items: MenuItem[] = [{ label: 'Dashboard' }];
    home: MenuItem = { icon: 'pi pi-home', routerLink: '/admin/dashboard' };

}
