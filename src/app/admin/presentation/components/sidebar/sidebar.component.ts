import { Component } from '@angular/core';
import { StatusService } from '../../../../shareds/services/status.service';

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
      { label: 'Gestion', path: '/admin/management/' , icon:'pi pi-book', badge: 0},
      { label: 'Procesos', path: '/admin/follow-up', icon:'pi pi-calendar-clock',badge: 0 },
      { label: 'Reportes', path: '/admin/reports', icon:'pi pi-sliders-h',badge: 0 }
    ],
    profileTitle: 'Sistema',
    profileItems: [
      { label: 'Configuración', path: '/admin/settings', icon:'pi pi-cog',badge: 0 },
      { label: 'Frankely García', path: '/admin/profile', icon:'pi pi-user',badge: 0 },
    
    ]
  }

  constructor(private status: StatusService) {
    this.sidebarDisplayed = status.getState('sidebar') as boolean;
  }

 
  ngOnInit() {
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
