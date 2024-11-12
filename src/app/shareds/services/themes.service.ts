import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemesService {

  themes: any = {
  
    light: {
      // Colores primarios
      colorMainBackgroundStart: "#c86161",
      colorMainBackgroundEnd: "#bd3535",
      colorButtonBackground: "#bd3535",
      colorBorderTop: "rgb(186, 53, 53)",
      colorTitle: "#bd3535",
    
      // Colores de fondo
      colorBackgroundWhite: "#ffffff",
      colorBackgroundLight: "#fff0db",
      colorInfoContactBackground: "#6124248a",
      colorInputBackground: "#ffffff",
      colorSelectOption:"rgb(49, 49, 49)",
      colorTransparent:"rgba(0, 0, 0, 0)",
    
      // Colores de texto
      colorTextDark: "rgb(31, 31, 31)",
      colorTextMuted: "rgb(134, 134, 134)",
      colorTextLight: "#ffffff",
      colorTextLink: "rgb(58, 119, 218)",
      colorTextStrong: "rgb(255, 255, 255)",
      colorTextSubFooter: "#ffffff9e",
      colorTextInput: "#000000",
    
      // Colores de borde
      colorBorderInput: "rgb(218, 218, 218)",
    
      // Otros
      colorShadow: "rgba(0, 0, 0, 0.206)",
      colorShadowInfoContact: "rgba(0, 0, 0, 0.552)",
      colorIcon: "#fff0db",
    },

    dark: {
      // Colores primarios
      colorMainBackgroundStart: "#2b2b2b",
      colorMainBackgroundEnd: "#000000",
      colorButtonBackground: "#cf3f3f",
      colorBorderTop: "#cf3f3f",
      colorTitle: "#ff5050",
    
      // Colores de fondo
      colorBackgroundWhite: "#414141",
      colorBackgroundLight: "#ff5050",
      colorInfoContactBackground: "#444444",
      colorInputBackground: "#2f2f2f",
      colorSelectOption:"rgb(49, 49, 49)",
      colorTransparent:"rgba(0, 0, 0, 0)",

      // Colores de texto
      colorTextDark: "#d1d1d1",
      colorTextMuted: "#a1a1a1",
      colorTextLight: "#ffffff",
      colorTextLink: "#4a90e2",
      colorTextStrong: "#ffffff",
      colorTextSubFooter: "#ffffff9e",
      colorTextInput: "#ffffff",
    
      // Colores de borde
      colorBorderInput: "#313131",
    
      // Otros
      colorShadow: "rgba(0, 0, 0, 0.1)",
      colorShadowInfoContact: "rgba(255, 255, 255, 0.15)",
      colorIcon: "#ffffff",
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
  }

  getCurrentTheme(): string {
    // console.log('currentTheme', this.currentTheme);
    return this.currentTheme;
  }
}
