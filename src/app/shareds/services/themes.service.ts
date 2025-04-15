import { Injectable } from '@angular/core';
import { loginPalette } from '../../auth/presentation/components/login/login.palette';
import { globalPalette } from '../../global.palette';
import { managementPalette } from '../../admin/modules/management/presentation/components/management/managemente.palette';
import { sidebarPalette } from '../../admin/presentation/components/sidebar/sidebar.palette';
import { adminPalette } from '../../admin/presentation/components/admin-layout/admin.palette';
import { navbarPalette } from '../../admin/presentation/components/navbar/navbar.palette';
import { StatusService } from './status.service';

@Injectable({
  providedIn: 'root'
})
export class ThemesService {
  private readonly darkModeClass = 'app-dark'; // 👈 clase que activa dark mode en PrimeNG
  
  themes: any = {
    light: {
      ...globalPalette.light,
      ...loginPalette.light,
      ...managementPalette.light,
      ...sidebarPalette.light,
      ...adminPalette.light,
      ...navbarPalette.light
    },
    

    dark: {
      ...globalPalette.dark,
      ...loginPalette.dark,
      ...managementPalette.dark,
      ...sidebarPalette.dark,
      ...adminPalette.dark,
      ...navbarPalette.dark
    }
  };

  private currentTheme: string;

  constructor(private status: StatusService, private statusService: StatusService) {
    this.currentTheme = this.statusService.getState<string>('theme') || 'light';
    this.setTheme(this.currentTheme);
  }

  setTheme(theme: string) {
    this.currentTheme = theme;
    Object.keys(this.themes[theme]).forEach((key: string) => {
      document.documentElement.style.setProperty("--" + key, this.themes[theme][key]);
    });


      // ✅ Controla el modo oscuro de PrimeNG agregando o quitando la clase
      const html = document.documentElement;
      html.classList.remove(this.darkModeClass); // limpia primero
      if (theme === 'dark') {
        html.classList.add(this.darkModeClass);
      }



    this.status.setState('theme', theme);
  }

  getCurrentTheme(): string {
    // console.log('currentTheme', this.currentTheme);
    return this.currentTheme;
  }
}
