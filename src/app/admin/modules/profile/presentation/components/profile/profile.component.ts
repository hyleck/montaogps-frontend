import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenuItem, MessageService } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { TabViewModule } from 'primeng/tabview';
import { CheckboxModule } from 'primeng/checkbox';
import { PasswordModule } from 'primeng/password';
import { ThemesService } from '@shared/services/themes.service';
import { StatusService } from '@shared/services/status.service';
import { TranslateService } from '@ngx-translate/core';
import { LangService } from '@shared/services/langi18/lang.service';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '@core/services/auth.service';
import { UserService } from '@core/services/user.service';
import { ProfileUser } from '@core/interfaces/profile.interface';
import { ToastModule } from 'primeng/toast';

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
    // Propiedades públicas
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
    }

    // Lifecycle Hooks
    ngOnInit() {
        this.loadCachedProfile();
        this.loadUserProfile();
    }

    // Métodos Públicos
    onSubmit() {
        const updateUserDto = this.prepareUpdateUserDto();
        this.updateUserProfile(updateUserDto);
    }

    onChangePassword() {
        if (this.newPassword !== this.confirmPassword) {
            this.showPasswordMismatchError();
            return;
        }

        if (!this.newPassword) {
            this.showEmptyPasswordError();
            return;
        }

        this.updatePassword();
    }

    onThemeChange() {
        this.themesService.setTheme(this.selectedTheme);
        this.user.settings.theme = this.selectedTheme;
        this.updateUserSettings();
    }

    onLanguageChange(language: string) {
        this.langService.setLanguage(language);
        this.translate.use(language);
        this.user.settings.language = language;
        this.updateUserSettings();
    }

    onNotificationsChange(event: any) {
        this.user.settings.notifications = event.checked;
        this.updateUserSettings();
    }

    // Métodos Privados
    private loadCachedProfile() {
        const cachedProfile = this.status.getState<ProfileUser>('profile');
        if (cachedProfile) {
            this.user = cachedProfile;
            this.loading = false;
        }
    }

    private loadUserProfile() {
        const currentUser = this.authService.getCurrentUser();
        
        if (currentUser && currentUser.id) {
            this.userService.getById(currentUser.id).subscribe({
                next: (userData: any) => {
                    const updatedUser = this.processUserData(userData);
                    this.updateUserIfChanged(updatedUser);
                    this.status.setState('profile', this.user);
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

    private processUserData(userData: any): ProfileUser {
        const userSettingsArray = userData.settings || [];
        const userSettingsData = userSettingsArray.length > 0 ? userSettingsArray[0] : {};
        
        if (userSettingsData.theme) {
            this.selectedTheme = userSettingsData.theme;
            this.themesService.setTheme(userSettingsData.theme);
        }

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

        const birthDate = userData.birth ? new Date(userData.birth).toISOString().split('T')[0] : '';

        return {
            _id: userData._id,
            name: userData.name,
            last_name: userData.last_name,
            email: userData.email,
            isActive: userData.isActive,
            createdAt: userData.createdAt,
            updatedAt: userData.updatedAt,
            access_level_id: userData.access_level_id,
            phone: userData.phone || '',
            phone2: userData.phone2 || '',
            birth: birthDate,
            dni: userData.dni || '',
            address: userData.address || '',
            photo: userData.photo || '',
            settings: userSettings
        };
    }

    private updateUserIfChanged(updatedUser: ProfileUser) {
        if (JSON.stringify(this.user) !== JSON.stringify(updatedUser)) {
            this.user = updatedUser;
            if (!this.loading) {
                this.messageService.add({
                    severity: 'info',
                    summary: this.translate.instant('profile.messages.update_success'),
                    detail: this.translate.instant('profile.messages.profile_updated')
                });
            }
        }
    }

    private prepareUpdateUserDto() {
        return {
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
    }

    private updateUserProfile(updateUserDto: any) {
        this.userService.update(this.user._id, updateUserDto).subscribe({
            next: (updatedUser) => {
                this.status.setState('profile', this.user);
                this.showUpdateSuccessMessage();
                this.updateAuthServiceUser(updatedUser);
            },
            error: (error) => {
                console.error('Error al actualizar el usuario:', error);
                this.showUpdateErrorMessage();
            }
        });
    }

    private updateUserSettings() {
        const updateUserDto: any = {
            settings: [{
                theme: this.user.settings.theme,
                language: this.user.settings.language,
                notifications: this.user.settings.notifications
            }]
        };

        this.userService.update(this.user._id, updateUserDto).subscribe({
            next: (updatedUser) => {
                this.status.setState('profile', this.user);
                this.showUpdateSuccessMessage();
            },
            error: (error) => {
                console.error('Error al actualizar la configuración:', error);
                this.showUpdateErrorMessage();
            }
        });
    }

    private updatePassword() {
        const updatePasswordDto = {
            password: this.newPassword
        };

        this.userService.updatePassword(this.user._id, updatePasswordDto).subscribe({
            next: () => {
                this.showPasswordUpdateSuccessMessage();
                this.clearPasswordFields();
            },
            error: (error) => {
                console.error('Error al actualizar la contraseña:', error);
                this.showPasswordUpdateErrorMessage();
            }
        });
    }

    private updateAuthServiceUser(updatedUser: any) {
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
    }

    private showUpdateSuccessMessage() {
        this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('profile.messages.update_success'),
            detail: this.translate.instant('profile.messages.update_success_detail')
        });
    }

    private showUpdateErrorMessage() {
        this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('profile.messages.update_error'),
            detail: this.translate.instant('profile.messages.update_error_detail')
        });
    }

    private showPasswordMismatchError() {
        this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('Error'),
            detail: this.translate.instant('Las contraseñas no coinciden')
        });
    }

    private showEmptyPasswordError() {
        this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('Error'),
            detail: this.translate.instant('Debes ingresar una nueva contraseña')
        });
    }

    private showPasswordUpdateSuccessMessage() {
        this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('Contraseña actualizada'),
            detail: this.translate.instant('Tu contraseña ha sido actualizada exitosamente')
        });
    }

    private showPasswordUpdateErrorMessage() {
        this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('Error al actualizar'),
            detail: this.translate.instant('Ha ocurrido un error al actualizar tu contraseña')
        });
    }

    private clearPasswordFields() {
        this.newPassword = '';
        this.confirmPassword = '';
    }
}
