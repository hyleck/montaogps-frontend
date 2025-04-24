import { Component, OnInit } from '@angular/core';
import { ThemesService } from '../../../../shareds/services/themes.service';
import { MenuItem } from 'primeng/api';
import { StatusService } from '../../../../shareds/services/status.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Router } from '@angular/router';
import { LangService } from '../../../../shareds/services/langi18/lang.service';
import { TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-navbar',
    templateUrl: './navbar.component.html',
    styleUrl: './navbar.component.css',
    standalone: false
})
export class NavbarComponent implements OnInit {
  items: MenuItem[] = [];
  userMenuItems: MenuItem[] = [];
  languageItems: MenuItem[] = [];
  loadingTheme: boolean = false;
  currentTheme: string = 'light';
  currentUser: any;

  constructor(
    private status: StatusService,
    private themes: ThemesService,
    private authService: AuthService,
    private router: Router,
    private langService: LangService,
    private translate: TranslateService
  ) {
    this.currentTheme = status.getState('theme') as string;
    this.currentUser = this.authService.getCurrentUser();
  }

  ngOnInit() {
    this.status.statusChanges$.subscribe((newStatus) => {
      if (newStatus && newStatus.theme) {
        this.currentTheme = newStatus.theme as string;
      }
    });

    this.initializeMenus();

    // Suscribirse a cambios de idioma para actualizar los menús
    this.translate.onLangChange.subscribe(() => {
      this.initializeMenus();
    });
  }

  private initializeMenus() {
    // Menú principal
    this.items = [
      {
        label: this.translate.instant('navbar.scheduleProcess'),
        icon: 'pi pi-calendar-clock'
      },
      {
        label: this.translate.instant('navbar.canceled'),
        icon: 'pi pi-trash'
      },
      {
        label: this.translate.instant('navbar.transfer'),
        icon: 'pi pi-reply',
        disabled: true
      },
      {
        label: this.translate.instant('navbar.share'),
        icon: 'pi pi-share-alt',
        disabled: true
      }
    ];

    // Menú de usuario
    this.userMenuItems = [
      {
        label: this.currentUser ? `${this.currentUser.name} ${this.currentUser.last_name}` : this.translate.instant('navbar.myProfile'),
        icon: 'pi pi-user',
        command: () => this.router.navigate(['/admin/profile'])
      },
      // {
      //   separator: true
      // },
      // {
      //   label: this.currentTheme === 'light' ? this.translate.instant('theme.toggleDark') : this.translate.instant('theme.toggleLight'),
      //   icon: this.currentTheme === 'light' ? 'pi pi-moon' : 'pi pi-sun',
      //   command: () => this.toggleTheme()
      // },
      {
        separator: true
      },
      {
        label: this.translate.instant('navbar.logout'),
        icon: 'pi pi-sign-out',
        command: () => this.logout()
      }
    ];

    // Menú de idiomas
    const languages = this.langService.getLanguages();
    this.languageItems = languages.map(lang => ({
      label: this.translate.instant('language.' + lang.code),
      icon: 'pi pi-flag',
      command: () => {
        this.langService.setLanguage(lang.code);
        this.translate.use(lang.code);
      }
    }));
  }

  toggleTheme() {
    this.loadingTheme = true;
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.themes.setTheme(newTheme);
    this.currentTheme = newTheme;
    
    // Actualizar el menú después de cambiar el tema
    this.initializeMenus();
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/auth/login']).then(() => {
      // Forzar un refresh de la página para asegurar que todo se limpie
      window.location.reload();
    });
  }
}
