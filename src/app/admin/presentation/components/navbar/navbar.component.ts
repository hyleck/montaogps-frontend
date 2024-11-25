import { Component } from '@angular/core';
import { ThemesService } from '../../../../shareds/services/themes.service';
import { MenuItem } from 'primeng/api';
import { StatusService } from '../../../../shareds/services/status.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent {
  items: MenuItem[] | undefined;
  currentTheme: string | undefined;
  constructor(private status: StatusService, private themes: ThemesService) {
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
        label: 'Options',
        items: [
          {
            label: 'Prog. proceso',
            icon: 'pi pi-calendar-clock',
            command: () => {
              // Lógica para programar el proceso
            }
          },
          {
            label: 'Cancelados (45)',
            icon: 'pi pi-trash',
            command: () => {
              // Lógica para mostrar cancelados
            }
          },
          {
            label: 'Transferir',
            icon: 'pi pi-reply',
            disabled: true, // Botón deshabilitado
            command: () => {
              // Lógica para transferir, si fuera habilitado
            }
          },
          {
            label: 'Compartir',
            icon: 'pi pi-share-alt',
            disabled: true, // Botón deshabilitado
            command: () => {
              // Lógica para compartir, si fuera habilitado
            }
          },
      
        ]
      }
    ];
    
  }

  toggleTheme() {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.themes.setTheme(this.currentTheme);
    this.status.setState('theme', this.currentTheme);
  }
}
