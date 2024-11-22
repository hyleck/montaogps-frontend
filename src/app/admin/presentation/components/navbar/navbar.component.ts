import { Component } from '@angular/core';
import { ThemesService } from '../../../../shareds/services/themes.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent {
  currentTheme: string | undefined;
  constructor(public theme: ThemesService) {
    this.currentTheme = theme.getCurrentTheme();
  }

  toggleTheme() {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.theme.setTheme(this.currentTheme);
  }
}
