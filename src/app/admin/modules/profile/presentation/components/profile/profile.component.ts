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
import { AuthService } from '../../../../../../core/services/auth.service';
import { UserService } from '../../../../../../core/services/user.service';
import { User as BackendUser } from '../../../../../../core/interfaces/user.interface';

interface UserSettings {
    theme: string;
    language: string;
    notifications: boolean;
}

interface UserRole {
    _id: string;
    name: string;
}

// Interfaz extendida para el perfil del usuario
interface ProfileUser extends BackendUser {
    phone?: string;
    phone2?: string;
    birth?: string;
    dni?: string;
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
    loading: boolean = true;

    user: ProfileUser = {
        id: '',
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
        private langService: LangService,
        private authService: AuthService,
        private userService: UserService
    ) {
        this.selectedTheme = this.themesService.getCurrentTheme();
        this.user.settings.language = this.translate.currentLang || this.translate.getDefaultLang();
        this.initializeLanguageLabels();
    }

    ngOnInit() {
        // Inicialización de breadcrumbs
        this.items = [
            { label: this.translate.instant('profile.title') }
        ];
        this.home = { icon: 'pi pi-home', routerLink: '/admin' };

        // Cargar datos del usuario
        this.loadUserProfile();

        // Suscripción a cambios de estado
        this.status.statusChanges$.subscribe((newStatus) => {
            if (newStatus && newStatus.theme) {
                this.selectedTheme = newStatus.theme as string;
            }
        });

        // Actualizar las etiquetas de los temas según el idioma actual
        this.updateThemeLabels();

        // Suscribirse a cambios de idioma solo para actualizar las traducciones de la interfaz
        this.translate.onLangChange.subscribe(() => {
            this.updateThemeLabels();
            // Ya no actualizamos las etiquetas de idioma aquí
            // Actualizamos los breadcrumbs
            this.items = [
                { label: this.translate.instant('profile.title') }
            ];
        });
    }

    private initializeLanguageLabels() {
        // Inicializar las etiquetas de idioma una sola vez
        this.languages = [
            { label: 'Español', value: 'es' },
            { label: 'English', value: 'en' },
            { label: 'Français', value: 'fr' }
        ];
    }

    private updateThemeLabels() {
        this.themes = [
            { label: this.translate.instant('theme.toggleLight'), value: 'light' },
            { label: this.translate.instant('theme.toggleDark'), value: 'dark' }
        ];
    }

    loadUserProfile() {
        this.loading = true;
        const currentUser = this.authService.getCurrentUser();
        
        if (currentUser && currentUser.id) {
            this.userService.getById(currentUser.id).subscribe({
                next: (userData: any) => {
                    console.log('Datos del usuario cargados:', userData);
                    
                    // Obtener la configuración del array settings
                    const userSettingsArray = userData.settings || [];
                    const userSettingsData = userSettingsArray.length > 0 ? userSettingsArray[0] : {};
                    
                    // Configurar el tema basado en los settings del usuario
                    if (userSettingsData.theme) {
                        this.selectedTheme = userSettingsData.theme;
                        this.themesService.setTheme(userSettingsData.theme);
                    }

                    // Configurar el idioma basado en los settings del usuario
                    if (userSettingsData.language) {
                        this.translate.use(userSettingsData.language);
                        this.langService.setLanguage(userSettingsData.language);
                        this.user.settings.language = userSettingsData.language;
                    }

                    const userSettings = {
                        theme: userSettingsData.theme || this.selectedTheme,
                        language: userSettingsData.language || this.translate.currentLang || 'es',
                        notifications: userSettingsData.notifications !== undefined ? userSettingsData.notifications : true
                    };

                    // Actualizar la foto si existe
                    if (userData.photo) {
                        this.userPhotoUrl = userData.photo;
                    }

                    this.user = {
                        id: userData.id,
                        name: userData.name,
                        last_name: userData.last_name,
                        email: userData.email,
                        isActive: userData.isActive,
                        createdAt: userData.createdAt,
                        updatedAt: userData.updatedAt,
                        access_level_id: userData.access_level_id,
                        // Campos extendidos
                        phone: userData.phone || '',
                        phone2: userData.phone2 || '',
                        birth: userData.birth || '',
                        dni: userData.dni || '',
                        address: userData.address || '',
                        photo: userData.photo || '',
                        settings: userSettings
                    };

                    this.loading = false;
                },
                error: (error) => {
                    console.error('Error al cargar los datos del usuario:', error);
                    this.loading = false;
                }
            });
        } else {
            console.error('No se encontró el ID del usuario actual');
            this.loading = false;
        }
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
        // No necesitamos actualizar this.user.settings.language aquí porque está vinculado con ngModel
    }
}
