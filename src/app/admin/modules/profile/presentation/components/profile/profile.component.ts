import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenuItem, MessageService } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { TabViewModule } from 'primeng/tabview';
import { CheckboxModule } from 'primeng/checkbox';
import { PasswordModule } from 'primeng/password';
import { ThemesService } from '../../../../../../shareds/services/themes.service';
import { StatusService } from '../../../../../../shareds/services/status.service';
import { TranslateService } from '@ngx-translate/core';
import { LangService } from '../../../../../../shareds/services/langi18/lang.service';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../../../../core/services/auth.service';
import { UserService } from '../../../../../../core/services/user.service';
import { User as BackendUser } from '../../../../../../core/interfaces/user.interface';
import { ToastModule } from 'primeng/toast';

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
interface ProfileUser {
    _id: string;
    name: string;
    last_name: string;
    email: string;
    isActive?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
    access_level_id?: any;
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
        PasswordModule,
        TranslateModule,
        ToastModule
    ],
    providers: [MessageService]
})
export class ProfileComponent implements OnInit {
    items: MenuItem[] = [{ label: 'Perfil' }];
    home: MenuItem = { icon: 'pi pi-home', routerLink: '/admin/dashboard' };
    loading: boolean = true;

    user: ProfileUser = {
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
        private langService: LangService,
        private authService: AuthService,
        private userService: UserService,
        private messageService: MessageService
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

                    // Formatear la fecha de nacimiento para el input date
                    const birthDate = userData.birth ? new Date(userData.birth).toISOString().split('T')[0] : '';

                    this.user = {
                        _id: userData._id,
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
                        birth: birthDate,
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
        // Preparar el objeto de actualización
        const updateUserDto = {
            name: this.user.name,
            last_name: this.user.last_name,
            email: this.user.email,
            phone: this.user.phone,
            phone2: this.user.phone2,
            birth: this.user.birth ? new Date(this.user.birth).toISOString() : null,
            dni: this.user.dni,
            address: this.user.address,
            settings: [{
                theme: this.user.settings.theme,
                language: this.user.settings.language,
                notifications: this.user.settings.notifications
            }]
        };

        this.userService.update(this.user._id, updateUserDto).subscribe({
            next: (updatedUser) => {
                console.log('Usuario actualizado:', updatedUser);
                this.messageService.add({
                    severity: 'success',
                    summary: this.translate.instant('Perfil actualizado'),
                    detail: this.translate.instant('Tu perfil ha sido actualizado exitosamente')
                });
                
                // Actualizar el usuario en el AuthService
                const currentUser = this.authService.getCurrentUser();
                if (currentUser) {
                    const basicUserInfo = {
                        ...currentUser,
                        name: updatedUser.name,
                        last_name: updatedUser.last_name,
                        email: updatedUser.email
                    };
                    this.authService['saveUser'](basicUserInfo);
                }
            },
            error: (error) => {
                console.error('Error al actualizar el usuario:', error);
                this.messageService.add({
                    severity: 'error',
                    summary: this.translate.instant('Error al actualizar'),
                    detail: this.translate.instant('Ha ocurrido un error al actualizar tu perfil')
                });
            }
        });
    }

    onChangePassword() {
        if (this.newPassword !== this.confirmPassword) {
            this.messageService.add({
                severity: 'error',
                summary: this.translate.instant('Error'),
                detail: this.translate.instant('Las contraseñas no coinciden')
            });
            return;
        }

        if (!this.newPassword) {
            this.messageService.add({
                severity: 'error',
                summary: this.translate.instant('Error'),
                detail: this.translate.instant('Debes ingresar una nueva contraseña')
            });
            return;
        }

        const updatePasswordDto = {
            password: this.newPassword
        };

        this.userService.updatePassword(this.user._id, updatePasswordDto).subscribe({
            next: () => {
                this.messageService.add({
                    severity: 'success',
                    summary: this.translate.instant('Contraseña actualizada'),
                    detail: this.translate.instant('Tu contraseña ha sido actualizada exitosamente')
                });
                // Limpiar los campos
                this.newPassword = '';
                this.confirmPassword = '';
            },
            error: (error: any) => {
                console.error('Error al actualizar la contraseña:', error);
                this.messageService.add({
                    severity: 'error',
                    summary: this.translate.instant('Error al actualizar'),
                    detail: this.translate.instant('Ha ocurrido un error al actualizar tu contraseña')
                });
            }
        });
    }

    onThemeChange() {
        this.themesService.setTheme(this.selectedTheme);
        this.user.settings.theme = this.selectedTheme;
        
        // Actualizar el usuario con el nuevo tema
        const updateUserDto: any = {
            settings: [{
                theme: this.user.settings.theme,
                language: this.user.settings.language,
                notifications: this.user.settings.notifications
            }]
        };

        this.userService.update(this.user._id, updateUserDto).subscribe({
            next: (updatedUser) => {
                console.log('Tema actualizado:', updatedUser);
                this.messageService.add({
                    severity: 'success',
                    summary: this.translate.instant('Tema actualizado'),
                    detail: this.translate.instant('El tema ha sido actualizado exitosamente')
                });
            },
            error: (error) => {
                console.error('Error al actualizar el tema:', error);
                this.messageService.add({
                    severity: 'error',
                    summary: this.translate.instant('Error al actualizar'),
                    detail: this.translate.instant('Ha ocurrido un error al actualizar el tema')
                });
            }
        });
    }

    onLanguageChange(language: string) {
        this.langService.setLanguage(language);
        this.translate.use(language);
        this.user.settings.language = language;
        
        // Actualizar el usuario con el nuevo idioma
        const updateUserDto: any = {
            settings: [{
                theme: this.user.settings.theme,
                language: this.user.settings.language,
                notifications: this.user.settings.notifications
            }]
        };

        this.userService.update(this.user._id, updateUserDto).subscribe({
            next: (updatedUser) => {
                console.log('Idioma actualizado:', updatedUser);
                this.messageService.add({
                    severity: 'success',
                    summary: this.translate.instant('Idioma actualizado'),
                    detail: this.translate.instant('El idioma ha sido actualizado exitosamente')
                });
            },
            error: (error) => {
                console.error('Error al actualizar el idioma:', error);
                this.messageService.add({
                    severity: 'error',
                    summary: this.translate.instant('Error al actualizar'),
                    detail: this.translate.instant('Ha ocurrido un error al actualizar el idioma')
                });
            }
        });
    }

    onNotificationsChange(event: any) {
        this.user.settings.notifications = event.checked;
        
        // Actualizar el usuario con las nuevas notificaciones
        const updateUserDto: any = {
            settings: [{
                theme: this.user.settings.theme,
                language: this.user.settings.language,
                notifications: this.user.settings.notifications
            }]
        };

        this.userService.update(this.user._id, updateUserDto).subscribe({
            next: (updatedUser) => {
                console.log('Notificaciones actualizadas:', updatedUser);
                this.messageService.add({
                    severity: 'success',
                    summary: this.translate.instant('Notificaciones actualizadas'),
                    detail: this.translate.instant('Las preferencias de notificaciones han sido actualizadas exitosamente')
                });
            },
            error: (error) => {
                console.error('Error al actualizar las notificaciones:', error);
                this.messageService.add({
                    severity: 'error',
                    summary: this.translate.instant('Error al actualizar'),
                    detail: this.translate.instant('Ha ocurrido un error al actualizar las notificaciones')
                });
            }
        });
    }
}
