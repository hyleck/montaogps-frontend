import { Injectable } from '@angular/core';
import { loginPalette } from '../../auth/presentation/components/login/login.palette';
import { globalPalette } from '../../global.palette';
import { managementPalette } from '../../admin/modules/management/presentation/components/management/managemente.palette';
import { sidebarPalette } from '../../admin/presentation/components/sidebar/sidebar.palette';
import { adminPalette } from '../../admin/presentation/components/admin-layout/admin.palette';
import { navbarPalette } from '../../admin/presentation/components/navbar/navbar.palette';
import { userRolesPalette } from '../../admin/modules/settings/presentation/components/settings/user-roles-settings/user-roles.palette';
import { dashboardPalette } from '../../admin/modules/dashboard/presentation/components/dashboard/dashboard.palette';
import { StatusService } from './status.service';
// import { applyThemeTransition } from '../../shareds/helpers/theme-transition.helper';

@Injectable({
  providedIn: 'root'
})
export class ThemesService {
  private readonly darkModeClass = 'app-dark';

  themes: any = {
    light: {
      ...globalPalette.light,
      ...loginPalette.light,
      ...managementPalette.light,
      ...sidebarPalette.light,
      ...adminPalette.light,
      ...navbarPalette.light,
      ...userRolesPalette.light,
      ...dashboardPalette.light
    },
    dark: {
      ...globalPalette.dark,
      ...loginPalette.dark,
      ...managementPalette.dark,
      ...sidebarPalette.dark,
      ...adminPalette.dark,
      ...navbarPalette.dark,
      ...userRolesPalette.dark,
      ...dashboardPalette.dark
    }
  };

  private currentTheme: string;

  constructor(private status: StatusService, private statusService: StatusService) {
    this.currentTheme = this.statusService.getState<string>('theme') || 'light';
    this.setTheme(this.currentTheme);
  }

  private applyPalette(theme: string) {
    
  
      this.currentTheme = theme;
      Object.keys(this.themes[theme]).forEach((key: string) => {
        document.documentElement.style.setProperty("--" + key, this.themes[theme][key]);
      });
  
    
        const html = document.documentElement;
        html.classList.remove(this.darkModeClass);
        if (theme === 'dark') {
          html.classList.add(this.darkModeClass);
        }
    
    
  
      this.status.setState('theme', theme);
    
   

    // this.setThemeWithTransition(theme);
  }

  // ⚡ Método público con transición
  // async setThemeWithTransition(theme: string) {
  //   await applyThemeTransition(() => {
  //     this.applyPalette(theme);
  //   });
  // }

  // ☑ Método normal (sin transición)
  setTheme(theme: string) {
  
      this.applyPalette(theme);
 
  
    
  }

  getCurrentTheme(): string {
    return this.currentTheme;
  }
}
