import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { TabViewModule } from 'primeng/tabview';
import { CheckboxModule } from 'primeng/checkbox';
import { ThemesService } from '../../../../../../shareds/services/themes.service';
import { StatusService } from '../../../../../../shareds/services/status.service';
import { TranslateService } from '@ngx-translate/core';
import { LangService } from '../../../../../../shareds/services/langi18/lang.service';
import { TranslateModule } from '@ngx-translate/core';

interface UserSettings {
    theme: string;
    language: string;
    notifications: boolean;
}

interface UserRole {
    _id: string;
    name: string;
}

interface User {
    _id: string;
    name: string;
    last_name: string;
    email: string;
    phone: string;
    phone2?: string;
    birth: string;
    dni: string;
    address?: string;
    role?: UserRole;
    photo?: string;
    settings: UserSettings;
}

@Component({
    selector: 'app-profile',
    templateUrl: './profile.component.html',
    styleUrl: './profile.component.css',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        BreadcrumbModule,
        TabViewModule,
        CheckboxModule,
        TranslateModule
    ]
})
export class ProfileComponent implements OnInit {
    items: MenuItem[] = [{ label: 'Perfil' }];
    home: MenuItem = { icon: 'pi pi-home', routerLink: '/admin/dashboard' };

    user: User = {
        _id: '',
        name: '',
        last_name: '',
        email: '',
        phone: '',
        birth: '',
        dni: '',
        settings: {
            theme: 'light',
            language: 'es',
            notifications: true
        }
    };

    userPhotoUrl: string | null = null;
    currentPassword: string = '';
    newPassword: string = '';
    confirmPassword: string = '';

    selectedTheme: string;
    themes = [
        { label: 'Claro', value: 'light' },
        { label: 'Oscuro', value: 'dark' }
    ];

    languages = [
        { label: 'Español', value: 'es' },
        { label: 'English', value: 'en' },
        { label: 'Français', value: 'fr' }
    ];

    constructor(
        private status: StatusService,
        private themesService: ThemesService,
        private translate: TranslateService,
        private langService: LangService
    ) {
        this.selectedTheme = this.themesService.getCurrentTheme();
        // Inicializar el idioma del usuario con el idioma actual del sistema
        this.user.settings.language = this.translate.currentLang || this.translate.getDefaultLang();
    }

    ngOnInit() {
        // Inicialización de breadcrumbs
        this.items = [
            { label: 'Perfil' }
        ];
        this.home = { icon: 'pi pi-home', routerLink: '/admin' };

        // Suscripción a cambios de estado
        this.status.statusChanges$.subscribe((newStatus) => {
            if (newStatus && newStatus.theme) {
                this.selectedTheme = newStatus.theme as string;
            }
        });

        // Actualizar las etiquetas de los temas según el idioma actual
        this.updateThemeLabels();
        this.updateLanguageLabels();

        // Suscribirse a cambios de idioma
        this.translate.onLangChange.subscribe(() => {
            this.updateThemeLabels();
            this.updateLanguageLabels();
            // Actualizar el idioma seleccionado cuando cambie
            this.user.settings.language = this.translate.currentLang;
        });
    }

    private updateThemeLabels() {
        this.themes = [
            { label: this.translate.instant('theme.toggleLight'), value: 'light' },
            { label: this.translate.instant('theme.toggleDark'), value: 'dark' }
        ];
    }

    private updateLanguageLabels() {
        this.languages = [
            { label: this.translate.instant('language.es'), value: 'es' },
            { label: this.translate.instant('language.en'), value: 'en' },
            { label: this.translate.instant('language.fr'), value: 'fr' }
        ];
    }

    loadUserProfile() {
        // Aquí se implementará la carga de datos del usuario desde el servicio
    }

    onSubmit() {
        // Aquí se implementará la actualización de datos del usuario
        console.log('Guardando cambios del perfil:', this.user);
    }

    onChangePassword() {
        if (this.newPassword !== this.confirmPassword) {
            // Mostrar error de contraseñas no coincidentes
            return;
        }
        // Aquí se implementará el cambio de contraseña
        console.log('Cambiando contraseña');
    }

    onThemeChange() {
        this.themesService.setTheme(this.selectedTheme);
    }

    onLanguageChange(language: string) {
        this.langService.setLanguage(language);
        this.translate.use(language);
        // Actualizar el idioma en las configuraciones del usuario
        this.user.settings.language = language;
    }
}
