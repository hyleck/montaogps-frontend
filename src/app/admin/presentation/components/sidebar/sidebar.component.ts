import { Component } from '@angular/core';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent {

  sidebarDisplayed = true;

  sidaberOptions = {
    favoriteTitle: 'Favoritos',
    favoriteItems: [
      { label: 'Dashboard', path: '/admin/dashboard', icon:'pi pi-objects-column', badge: 5 },
    
    ],
    principalTitle: 'Menú Principal',
    principalItems: [
      { label: 'Gestion', path: '/admin/management' , icon:'pi pi-book', badge: 0},
      { label: 'Procesos', path: '/admin/follow-up', icon:'pi pi-calendar-clock',badge: 0 },
      { label: 'Reportes', path: '/admin/reports', icon:'pi pi-sliders-h',badge: 0 }
    ],
    profileTitle: 'Sistema',
    profileItems: [
      { label: 'Configuración', path: '/admin/settings', icon:'pi pi-cog',badge: 0 },
      { label: 'Frankely García', path: '/admin/profile', icon:'pi pi-user',badge: 0 },
    
    ]
  }

  toggleSidebar() {
    this.sidebarDisplayed = !this.sidebarDisplayed;
  }

}
