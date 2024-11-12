import { Component } from '@angular/core';
import { ThemesService } from './shareds/services/themes.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  constructor(public themes: ThemesService) {
    this.themes.setTheme('light');
   }
}
