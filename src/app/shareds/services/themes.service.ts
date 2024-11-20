import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemesService {

  themes: any = {
    light: {
      // Colores primarios
      colorMainBackgroundStart: "#c86161",
      colorMainBackgroundStart2: "#c64444",
      colorMainBackgroundEnd: "#bd3535",
      colorButtonBackground: "#bd3535",
      colorBorderTop: "rgb(186, 53, 53)",
      colorTitle: "#bd3535",
      
    
      // Colores de fondo
      colorBackgroundWhite: "#ffffff",
      colorBackgroundLight: "#fff0db",
      colorInfoContactBackground: "#6124248a",
      colorInputBackground: "#ffffff",
      colorSelectOption: "rgb(49, 49, 49)",
      colorTransparent: "rgba(0, 0, 0, 0)",
      colorPrimaryDarkEnd: "#222222",
      colorPrimaryDarkStart: "#2d2d2d",
      colorNone:"rgba(255, 255, 255, 0)",

      // Colores de texto
      colorTextDark: "rgb(31, 31, 31)",
      colorTextMuted: "rgb(134, 134, 134)",
      colorTextLight: "#ffffff",
      colorTextLink: "#fff0db",
      colorTextStrong: "rgb(255, 255, 255)",
      colorTextSubFooter: "#ffffff9e",
      colorTextInput: "#000000",
    
      // Colores de borde
      colorBorderInput: "rgb(218, 218, 218)",
      colorBorderLight: "rgb(240, 240, 240)",
      colorBorderDark: "rgb(236, 236, 236)",
      colorBorderHover: "rgb(217, 75, 75)",
      colorBorderTransparent: "rgba(255, 255, 255, 0.124)",
    
      // Colores adicionales
      colorHighlight: "rgb(255, 142, 142)",
      colorAccent: "rgb(226, 84, 84)",
      colorSecondaryDark: "rgb(60, 16, 16)",
      colorCardBorderLight: "#ffd4d4",
      colorCardBorderHover: "rgb(217, 75, 75)",
      colorCardHighlight: "rgb(245, 167, 167)",
      colorCardBackground: "rgb(255, 250, 250)",
      colorInputBorderAccent: "rgb(255, 201, 201)",
      colorIconMuted: "rgba(227, 98, 98, 0.363)",
      colorIconDark: "rgb(45, 45, 45)",
    
      // Otros
      colorShadow: "rgba(0, 0, 0, 0.206)",
      colorShadowInfoContact: "rgba(0, 0, 0, 0.552)",
      colorBackgroundDark: "rgb(45, 45, 45)",
    },
    

    dark: {
      // Colores primarios
      colorMainBackgroundStart: "#2b2b2b",
      colorMainBackgroundStart2: "#292929", // Nuevo
      colorMainBackgroundEnd: "#000000",
      colorButtonBackground: "#cf3f3f",
      colorBorderTop: "#cf3f3f",
      colorTitle: "#ff5050",
    
      // Colores de fondo
      colorBackgroundWhite: "#414141",
      colorBackgroundLight: "#ff5050",
      colorInfoContactBackground: "#444444",
      colorInputBackground: "#2f2f2f",
      colorSelectOption: "rgb(49, 49, 49)",
      colorTransparent: "rgba(0, 0, 0, 0)",
      colorPrimaryDarkEnd: "#000000", // Nuevo
      colorPrimaryDarkStart: "#1c1c1c", // Nuevo
      colorNone: "rgba(0, 0, 0, 0)", // Nuevo

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
      colorBorderLight: "#525252", // Nuevo
      colorBorderDark: "#414141", // Nuevo
      colorBorderHover: "#ff5050", // Nuevo
      colorBorderTransparent: "rgba(255, 255, 255, 0.124)", // Nuevo

      // Colores adicionales
      colorHighlight: "#ff7070", // Nuevo
      colorAccent: "#cf3f3f", // Nuevo
      colorSecondaryDark: "#2f2f2f", // Nuevo
      colorCardBorderLight: "#525252", // Nuevo
      colorCardBorderHover: "#ff5050", // Nuevo
      colorCardHighlight: "#d16f6f", // Nuevo
      colorCardBackground: "#333333", // Nuevo
      colorInputBorderAccent: "#ff7070", // Nuevo
      colorIconMuted: "rgba(255, 255, 255, 0.3)", // Nuevo
      colorIconDark: "#ffffff", // Nuevo

      // Otros
      colorShadow: "rgba(0, 0, 0, 0.1)",
      colorShadowInfoContact: "rgba(255, 255, 255, 0.15)",
      colorBackgroundDark: "#1c1c1c", // Nuevo
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
