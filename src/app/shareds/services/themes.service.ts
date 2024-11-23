import { Injectable } from '@angular/core';
import { loginPalette } from '../../auth/presentation/components/login/login.palette';
import { globalPalette } from '../../global.palette';
import { managementPalette } from '../../admin/modules/management/presentation/components/management/managemente.palette';
import { sidebarPalette } from '../../admin/presentation/components/sidebar/sidebar.palette';
import { adminPalette } from '../../admin/presentation/components/admin-layout/admin.palette';
import { navbarPalette } from '../../admin/presentation/components/navbar/navbar.palette';

@Injectable({
  providedIn: 'root'
})
export class ThemesService {

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

  constructor() {
    this.currentTheme = localStorage.getItem('theme') || 'light';
    console.log('constructor', this.currentTheme);
    this.setTheme(this.currentTheme);
  }

  setTheme(theme: string) {
    this.currentTheme = theme;
    console.log('setTheme', this.currentTheme);
    Object.keys(this.themes[theme]).forEach((key: string) => {
      document.documentElement.style.setProperty("--" + key, this.themes[theme][key]);
    });
    localStorage.setItem('theme', theme);
  }

  getCurrentTheme(): string {
    // console.log('currentTheme', this.currentTheme);
    return this.currentTheme;
  }
}
