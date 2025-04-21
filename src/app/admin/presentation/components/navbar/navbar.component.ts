import { Component } from '@angular/core';
import { ThemesService } from '../../../../shareds/services/themes.service';
import { MenuItem } from 'primeng/api';
import { StatusService } from '../../../../shareds/services/status.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Router } from '@angular/router';

@Component({
    selector: 'app-navbar',
    templateUrl: './navbar.component.html',
    styleUrl: './navbar.component.css',
    standalone: false
})
export class NavbarComponent {
  items: MenuItem[] = [];
  userMenuItems: MenuItem[] = [];
  loadingTheme: boolean = false;
  currentTheme: string = 'light';

  constructor(
    private status: StatusService,
    private themes: ThemesService,
    private authService: AuthService,
    private router: Router
  ) {
    this.currentTheme = status.getState('theme') as string;
  }

  ngOnInit() {
    this.status.statusChanges$.subscribe((newStatus) => {
      if (newStatus && newStatus.theme) {
        this.currentTheme = newStatus.theme as string;
      }
    });

    this.items = [
      {
        label: 'Programar proceso',
        icon: 'pi pi-calendar-clock'
      },
      {
        label: 'Cancelados',
        icon: 'pi pi-trash'
      },
      {
        label: 'Transferir',
        icon: 'pi pi-reply',
        disabled: true
      },
      {
        label: 'Compartir',
        icon: 'pi pi-share-alt',
        disabled: true
      }
    ];

    this.userMenuItems = [
      {
        label: this.currentTheme === 'light' ? 'Modo oscuro' : 'Modo claro',
        icon: this.currentTheme === 'light' ? 'pi pi-moon' : 'pi pi-sun',
        command: () => this.toggleTheme()
      },
      {
        separator: true
      },
      {
        label: 'Cerrar sesión',
        icon: 'pi pi-sign-out',
        command: () => this.logout()
      }
    ];
  }

  toggleTheme() {
    this.loadingTheme = true;
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.themes.setTheme(newTheme);
    this.currentTheme = newTheme;
    
    // Actualizar el menú después de cambiar el tema
    this.userMenuItems[0].label = this.currentTheme === 'light' ? 'Modo oscuro' : 'Modo claro';
    this.userMenuItems[0].icon = this.currentTheme === 'light' ? 'pi pi-moon' : 'pi pi-sun';
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/auth/login']).then(() => {
      // Forzar un refresh de la página para asegurar que todo se limpie
      window.location.reload();
    });
  }
}
