import { Component, OnInit } from '@angular/core';
import { StatusService } from '../../../../shareds/services/status.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
    selector: 'app-sidebar',
    templateUrl: './sidebar.component.html',
    styleUrl: './sidebar.component.css',
    standalone: false
})
export class SidebarComponent implements OnInit {

  sidebarDisplayed = true;
  userName: string = '';

  sidaberOptions = {
    favoriteTitle: 'Favoritos',
    favoriteItems: [
      { label: 'Dashboard', path: '/admin/dashboard', icon:'pi pi-objects-column', badge: 5 },
    
    ],
    principalTitle: 'Menú Principal',
    principalItems: [
      { label: 'Gestion', path: '/admin/management/' , icon:'pi pi-book', badge: 0},
      { label: 'Procesos', path: '/admin/follow-up', icon:'pi pi-calendar-clock',badge: 0 },
      { label: 'Reportes', path: '/admin/reports', icon:'pi pi-sliders-h',badge: 0 }
    ],
    profileTitle: 'Sistema',
    profileItems: [
      { label: 'Configuración', path: '/admin/settings', icon:'pi pi-cog',badge: 0 },
      { label: '', path: '/admin/profile', icon:'pi pi-user',badge: 0 },
    ]
  }

  constructor(
    private status: StatusService,
    private authService: AuthService
  ) {
    this.sidebarDisplayed = status.getState('sidebar') as boolean;
  }

  ngOnInit() {
    const user = this.authService.getCurrentUser();
    console.log('Usuario actual:', user);
    
    if (user) {
      this.userName = `${user.name} ${user.last_name}`;
      this.sidaberOptions.profileItems[1].label = this.userName;
      console.log('Nombre de usuario establecido:', this.userName);
      console.log('Opciones actualizadas:', this.sidaberOptions.profileItems);
    }

    this.status.statusChanges$.subscribe((newStatus) => {
      if (newStatus && typeof newStatus.sidebar !== 'undefined') {
        this.sidebarDisplayed = newStatus.sidebar as boolean;
      }
    });
  }

  toggleSidebar() {
    this.sidebarDisplayed = !this.sidebarDisplayed;
    this.status.setState('sidebar', this.sidebarDisplayed);
  }
}
