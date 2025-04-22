import { Component } from '@angular/core';
import { MenuItem } from 'primeng/api';

@Component({
    selector: 'app-follow-up',
    templateUrl: './follow-up.component.html',
    styleUrl: './follow-up.component.css',
    standalone: false
})
export class FollowUpComponent {

    items: MenuItem[] = [{ label: 'Seguimiento' }];
    home: MenuItem = { icon: 'pi pi-home', routerLink: '/admin/dashboard' };

}
