import { Component, OnInit } from '@angular/core';
import { StatusService } from '../../../../shareds/services/status.service';
import { AuthService } from '../../../../core/services/auth.service';
import { TranslateService } from '@ngx-translate/core';
import { LangService } from '../../../../shareds/services/langi18/lang.service';

@Component({
    selector: 'app-sidebar',
    templateUrl: './sidebar.component.html',
    styleUrl: './sidebar.component.css',
    standalone: false
})
export class SidebarComponent implements OnInit {

  sidebarDisplayed = true;
  userName: string = '';

  sidaberOptions = {
    favoriteTitle: '',
    favoriteItems: [
      { label: '', path: '/admin/dashboard', icon:'pi pi-objects-column', badge: 5 },
    ],
    principalTitle: '',
    principalItems: [
      { label: '', path: '/admin/management/' , icon:'pi pi-book', badge: 0},
      { label: '', path: '/admin/follow-up', icon:'pi pi-calendar-clock',badge: 0 },
      { label: '', path: '/admin/reports', icon:'pi pi-sliders-h',badge: 0 }
    ],
    profileTitle: '',
    profileItems: [
      { label: '', path: '/admin/settings', icon:'pi pi-cog',badge: 0 },
      { label: '', path: '/admin/profile', icon:'pi pi-user',badge: 0 },
    ]
  }

  constructor(
    private status: StatusService,
    private authService: AuthService,
    private translate: TranslateService,
    private langService: LangService
  ) {
    this.sidebarDisplayed = status.getState('sidebar') as boolean;
  }

  ngOnInit() {
    this.updateTranslations();
    
    const user = this.authService.getCurrentUser();
    if (user) {
      this.userName = `${user.name} ${user.last_name}`;
      this.sidaberOptions.profileItems[1].label = this.userName;
    }

    this.status.statusChanges$.subscribe((newStatus) => {
      if (newStatus && typeof newStatus.sidebar !== 'undefined') {
        this.sidebarDisplayed = newStatus.sidebar as boolean;
      }
    });

    this.translate.onLangChange.subscribe(() => {
      this.updateTranslations();
    });
  }

  updateTranslations() {
    // Títulos de las secciones
    this.sidaberOptions.favoriteTitle = this.translate.instant('sidebar.favorites');
    this.sidaberOptions.principalTitle = this.translate.instant('sidebar.mainMenu');
    this.sidaberOptions.profileTitle = this.translate.instant('sidebar.system');

    // Elementos favoritos
    this.sidaberOptions.favoriteItems[0].label = this.translate.instant('sidebar.dashboard');

    // Elementos del menú principal
    this.sidaberOptions.principalItems[0].label = this.translate.instant('sidebar.management');
    this.sidaberOptions.principalItems[1].label = this.translate.instant('sidebar.processes');
    this.sidaberOptions.principalItems[2].label = this.translate.instant('sidebar.reports');

    // Elementos del perfil
    this.sidaberOptions.profileItems[0].label = this.translate.instant('sidebar.settings');
  }

  toggleSidebar() {
    this.sidebarDisplayed = !this.sidebarDisplayed;
    this.status.setState('sidebar', this.sidebarDisplayed);
  }
}
