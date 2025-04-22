import { Component } from '@angular/core';
import { MenuItem } from 'primeng/api';

@Component({
    selector: 'app-profile',
    templateUrl: './profile.component.html',
    styleUrl: './profile.component.css',
    standalone: false
})
export class ProfileComponent {

    items: MenuItem[] = [{ label: 'Perfil' }];
    home: MenuItem = { icon: 'pi pi-home', routerLink: '/admin/dashboard' };

}
