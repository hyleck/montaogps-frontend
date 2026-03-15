import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpEventType, HttpClient, HttpBackend, HttpHeaders, HttpRequest } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { MenuItem, MessageService } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { TabViewModule } from 'primeng/tabview';
import { CheckboxModule } from 'primeng/checkbox';
import { PasswordModule } from 'primeng/password';
import { InputSwitchModule } from 'primeng/inputswitch';
import { ThemesService } from '@shared/services/themes.service';
import { StatusService } from '@shared/services/status.service';
import { TranslateService } from '@ngx-translate/core';
import { LangService } from '@shared/services/langi18/lang.service';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '@core/services/auth.service';
import { UserService } from '@core/services/user.service';
import { CloudService } from '@core/services/cloud.service';
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
        InputSwitchModule,
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
    user: any = {
        _id: '',
        name: '',
        last_name: '',
        email: '',
        phone: '',
        dni: '',
        settings: {
            theme: 'light',
            language: 'es',
            notifications: true
        }
    };
    userPhotoUrl: string | SafeUrl | null = null;
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
        private cloudService: CloudService,
        private messageService: MessageService,
        private cdr: ChangeDetectorRef,
        private sanitizer: DomSanitizer
    ) {
        console.log('📸 DEBUG - ProfileComponent CONSTRUCTOR initialized');
        this.selectedTheme = this.themesService.getCurrentTheme();
        this.user.settings.language = this.translate.currentLang || this.translate.getDefaultLang();
    }

    // ... (ngOnInit and other methods)

    onPhotoSelected(event: any) {
        console.log('📸 DEBUG - onPhotoSelected triggered', event);
        const file = event.target.files[0];
        if (file) {
            console.log('📸 DEBUG - File selected:', file.name, file.type, file.size);

            // Show local preview immediately
            this.userPhotoUrl = null; // Clear current photo to force update
            this.cdr.detectChanges();

            const reader = new FileReader();
            reader.onload = (e: any) => {
                console.log('📸 DEBUG - Reader loaded');
                // Sanitize the URL to be safe
                const unsafeUrl = e.target.result;
                console.log('📸 DEBUG - Unsafe URL length:', unsafeUrl.length);

                // Revert to TrustUrl (ResourceUrl is for iframes/scripts)
                this.userPhotoUrl = this.sanitizer.bypassSecurityTrustUrl(unsafeUrl);
                console.log('📸 DEBUG - userPhotoUrl updated (sanitized TrustUrl):', this.userPhotoUrl);

                setTimeout(() => {
                    this.cdr.detectChanges(); // Force update in next tick
                }, 0);
            };
            reader.readAsDataURL(file);

            this.uploadProfilePhoto(file);
        } else {
            console.log('📸 DEBUG - No file selected');
        }
    }

    onImageError(event: any) {
        console.error('📸 DEBUG - Image load error', event);
        this.userPhotoUrl = null; // Fallback to icon
    }

    private async uploadProfilePhoto(file: File) {
        console.log('📸 DEBUG - Starting uploadProfilePhoto (Native Fetch)');
        // Validate file type and size
        if (!file.type.startsWith('image/')) {
            this.messageService.add({
                severity: 'error',
                summary: this.translate.instant('Error'),
                detail: this.translate.instant('Solo se permiten archivos de imagen')
            });
            return;
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            this.messageService.add({
                severity: 'error',
                summary: this.translate.instant('Error'),
                detail: this.translate.instant('La imagen no puede ser mayor a 5MB')
            });
            return;
        }

        const currentUser = this.authService.getCurrentUser();
        const ownerId = currentUser?.id;

        if (!ownerId) {
            this.messageService.add({
                severity: 'error',
                summary: this.translate.instant('Error'),
                detail: this.translate.instant('No se pudo determinar el propietario para subir la imagen')
            });
            return;
        }

        // Prepare FormData
        const formData = new FormData();
        formData.append('files', file);
        formData.append('owner', ownerId);
        formData.append('private', 'false');

        const token = localStorage.getItem('authtoken');
        const apiUrl = `${environment.apiUrl}/cloud/upload`;
        console.log('📸 DEBUG - API URL:', apiUrl);

        try {
            console.log('📸 DEBUG - Sending fetch request');
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            console.log('📸 DEBUG - Fetch response status:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('📸 DEBUG - Fetch response data:', data);

            const uploadedFile = data.data?.[0];
            if (uploadedFile?.location_cdn) {
                console.log('📸 DEBUG - Setting user photo:', uploadedFile.location_cdn);
                this.user.photo = uploadedFile.location_cdn;
                this.userPhotoUrl = uploadedFile.location_cdn;
                this.updateUserProfile({ photo: uploadedFile.location_cdn });
                this.cdr.detectChanges();
            } else {
                console.warn('📸 DEBUG - location_cdn not found in response');
            }

        } catch (error) {
            console.error('📸 DEBUG - Error uploading photo:', error);
            this.messageService.add({
                severity: 'error',
                summary: this.translate.instant('Error'),
                detail: this.translate.instant('Error al subir la foto de perfil')
            });
        }
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
        this.newPassword = this.sanitizeString(this.newPassword);
        this.confirmPassword = this.sanitizeString(this.confirmPassword);

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



    removePhoto() {
        this.user.photo = '';
        this.userPhotoUrl = null;
        this.updateUserProfile({ photo: '' });
    }



    // Métodos Privados
    private loadCachedProfile() {
        const cachedProfile = this.status.getState<any>('profile');
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
                    // 🔍 DEBUG: Usuario completo desde perfil
                    console.log('🔍 DEBUG - USUARIO COMPLETO EN PERFIL:', userData);
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

    private processUserData(userData: any): any {
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

        // Set photo URL for display
        if (userData.photo) {
            this.userPhotoUrl = userData.photo;
        }

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
            dni: userData.dni || '',
            address: userData.address || '',
            photo: userData.photo || '',
            auto_response: userData.auto_response || false,
            inbox: userData.inbox || 0,
            inbox2: userData.inbox2 || 0,
            inbox3: userData.inbox3 || 0,
            settings: userSettings
        };
    }

    private updateUserIfChanged(updatedUser: any) {
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
        const payload = {
            name: this.user.name,
            last_name: this.user.last_name,
            email: this.user.email,
            phone: this.user.phone,
            phone2: this.user.phone2,
            dni: this.user.dni,
            address: this.user.address,
            auto_response: this.user.auto_response,
            inbox: this.user.inbox,
            inbox2: this.user.inbox2,
            inbox3: this.user.inbox3,
            settings: [{
                theme: this.user.settings.theme,
                language: this.user.settings.language,
                notifications: this.user.settings.notifications
            }]
        };

        return this.normalizeUserPayload(payload);
    }

    private updateUserProfile(updateUserDto: any) {
        const normalizedDto = this.normalizeUserPayload(updateUserDto);

        this.userService.update(this.user._id, normalizedDto).subscribe({
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

        const normalizedDto = this.normalizeUserPayload(updateUserDto);

        this.userService.update(this.user._id, normalizedDto).subscribe({
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
        const updatePasswordDto = this.normalizeUserPayload({
            password: this.newPassword
        });

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
        // Instead of calling saveUser directly, update the localStorage manually
        // to preserve all existing data including privileges
        try {
            const userStr = localStorage.getItem('user');
            const currentUser = userStr ? JSON.parse(userStr) : null;

            if (currentUser) {
                // Update only the fields that changed, preserve everything else
                const updatedUserData = {
                    ...currentUser,
                    name: updatedUser.name,
                    last_name: updatedUser.last_name,
                    email: updatedUser.email
                };

                localStorage.setItem('user', JSON.stringify(updatedUserData));
            }
        } catch (error) {
            console.error('Error updating user in localStorage:', error);
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

    private sanitizeString(value?: string | null): string {
        return typeof value === 'string' ? value.trim() : '';
    }

    private sanitizeOptionalString(value?: string | null): string | undefined {
        const sanitized = this.sanitizeString(value);
        return sanitized || undefined;
    }

    private normalizeEmail(value?: string | null): string {
        return this.sanitizeString(value).toLowerCase();
    }

    private normalizeSettings(settings: any[]): any[] {
        return settings.map(setting => ({
            theme: this.sanitizeString(setting?.theme),
            language: this.normalizeEmail(setting?.language),
            notifications: !!setting?.notifications
        }));
    }

    private normalizeUserPayload(payload: any): any {
        const sanitized: any = { ...payload };

        if ('name' in sanitized) sanitized.name = this.sanitizeString(sanitized.name);
        if ('last_name' in sanitized) sanitized.last_name = this.sanitizeString(sanitized.last_name);
        if ('email' in sanitized) sanitized.email = this.normalizeEmail(sanitized.email);
        if ('phone' in sanitized) sanitized.phone = this.sanitizeOptionalString(sanitized.phone);
        if ('phone2' in sanitized) sanitized.phone2 = this.sanitizeOptionalString(sanitized.phone2);
        if ('dni' in sanitized) sanitized.dni = this.sanitizeOptionalString(sanitized.dni);
        if ('address' in sanitized) sanitized.address = this.sanitizeOptionalString(sanitized.address);
        if ('password' in sanitized && typeof sanitized.password === 'string') {
            sanitized.password = this.sanitizeString(sanitized.password);
        }

        if (Array.isArray(sanitized.settings)) {
            sanitized.settings = this.normalizeSettings(sanitized.settings);
        }

        return sanitized;
    }
}
