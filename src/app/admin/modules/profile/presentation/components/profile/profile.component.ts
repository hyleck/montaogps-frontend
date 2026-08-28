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
import { getApiErrorMessage } from '@core/utils/api-error.util';

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
    saving: boolean = false;
    private savedProfile: any = null;
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
            notifications: true,
            map_marker_type: 'default'
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
    markerTypes = [
        { label: 'Marcador por defecto', value: 'default' },
        { label: 'Representación de vehículo', value: 'vehicle' }
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
                this.updateUserProfile({ photo: uploadedFile.location_cdn }, false);
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
        if (this.loading || this.saving || !this.user?._id) return;
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
        this.updateUserProfile({ photo: '' }, false);
    }



    // Métodos Privados
    private loadCachedProfile() {
        const cachedProfile = this.status.getState<any>('profile');
        if (cachedProfile?._id && cachedProfile._id === this.authService.getCurrentUser()?.id) {
            this.user = this.cloneProfile(cachedProfile);
            this.savedProfile = this.cloneProfile(cachedProfile);
        }
    }

    private loadUserProfile() {
        const currentUser = this.authService.getCurrentUser();

        if (currentUser && currentUser.id) {
            this.userService.getById(currentUser.id).subscribe({
                next: (userData: any) => {
                    const updatedUser = this.processUserData(userData);
                    this.user = updatedUser;
                    this.rememberSavedProfile(updatedUser);
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
        const userSettingsData = (Array.isArray(userData.settings)
            ? userData.settings[0]
            : userData.settings) || {};

        if (userSettingsData.theme) {
            this.selectedTheme = userSettingsData.theme;
            this.themesService.setTheme(userSettingsData.theme);
        }

        if (userSettingsData.language) {
            this.translate.use(userSettingsData.language);
            this.langService.setLanguage(userSettingsData.language);
        }

        const userSettings = {
            theme: userSettingsData.theme || this.selectedTheme,
            language: userSettingsData.language || this.translate.currentLang || 'es',
            notifications: userSettingsData.notifications !== undefined ? userSettingsData.notifications : true,
            map_marker_type: userSettingsData.map_marker_type || 'default'
        };

        // Set photo URL for display
        this.userPhotoUrl = userData.photo || null;

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
            settings: userSettings
        };
    }

    private cloneProfile(profile: any): any {
        return JSON.parse(JSON.stringify(profile));
    }

    private rememberSavedProfile(profile: any): void {
        // El borrador del formulario no debe compartir objetos con la caché.
        this.savedProfile = this.cloneProfile(profile);
        this.status.setState('profile', this.cloneProfile(profile));
    }

    private prepareUpdateUserDto() {
        const payload = {
            name: this.user.name,
            last_name: this.user.last_name,
            phone: this.user.phone,
            phone2: this.user.phone2,
            dni: this.user.dni,
            address: this.user.address,
            auto_response: this.user.auto_response,
            settings: [{
                theme: this.user.settings.theme,
                language: this.user.settings.language,
                notifications: this.user.settings.notifications,
                map_marker_type: this.user.settings.map_marker_type
            }]
        };

        const normalized = this.normalizeUserPayload(payload);
        if (this.savedProfile && this.sanitizeString(this.user.dni) === this.sanitizeString(this.savedProfile.dni)) {
            delete normalized.dni;
        }
        return normalized;
    }

    private updateUserProfile(updateUserDto: any, replaceForm: boolean = true) {
        const normalizedDto = this.normalizeUserPayload(updateUserDto);
        if (replaceForm) this.saving = true;

        this.userService.update(this.user._id, normalizedDto).pipe(
            finalize(() => { if (replaceForm) this.saving = false; })
        ).subscribe({
            next: (updatedUser) => {
                const savedProfile = this.processUserData(updatedUser);
                if (replaceForm) {
                    this.user = this.cloneProfile(savedProfile);
                } else {
                    // Foto y preferencias se guardan por separado: no perder ni
                    // dar por guardados los datos personales aún en edición.
                    const changedFields = new Set([
                        ...Object.keys(normalizedDto),
                        ...(normalizedDto.clear_fields || [])
                    ]);
                    changedFields.delete('clear_fields');
                    for (const field of changedFields) {
                        this.user[field] = savedProfile[field];
                    }
                }
                this.rememberSavedProfile(savedProfile);
                this.updateAuthServiceUser(updatedUser);
                this.showUpdateSuccessMessage();
            },
            error: (error) => {
                console.error('Error al actualizar el usuario:', error);
                this.showUpdateErrorMessage(error);
            }
        });
    }

    onMapMarkerTypeChange() {
        console.log('🗺️ Map marker type changed to:', this.user.settings.map_marker_type);
        this.updateUserSettings();
    }

    private updateUserSettings() {
        const updateUserDto: any = {
            settings: [{
                theme: this.user.settings.theme,
                language: this.user.settings.language,
                notifications: this.user.settings.notifications,
                map_marker_type: this.user.settings.map_marker_type
            }]
        };

        this.updateUserProfile(updateUserDto, false);
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
                this.showPasswordUpdateErrorMessage(error);
            }
        });
    }

    private updateAuthServiceUser(updatedUser: any) {
        // Instead of calling saveUser directly, update the localStorage manually
        // to preserve all existing data including privileges
        try {
            const userStr = localStorage.getItem('user');
            const currentUser = userStr ? JSON.parse(userStr) : null;

            if (currentUser && String(currentUser.id || currentUser._id) === String(updatedUser._id)) {
                // Update only the fields that changed, preserve everything else
                const updatedUserData = {
                    ...currentUser,
                    name: updatedUser.name,
                    last_name: updatedUser.last_name,
                    email: updatedUser.email,
                    dni: updatedUser.dni || '',
                    phone: updatedUser.phone || '',
                    phone2: updatedUser.phone2 || '',
                    address: updatedUser.address || '',
                    photo: updatedUser.photo || '',
                    auto_response: updatedUser.auto_response || false,
                    settings: updatedUser.settings || currentUser.settings
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

    private showUpdateErrorMessage(error: unknown) {
        this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('profile.messages.update_error'),
            detail: getApiErrorMessage(error, this.translate.instant('profile.messages.update_error_detail'))
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

    private showPasswordUpdateErrorMessage(error: unknown) {
        this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('Error al actualizar'),
            detail: getApiErrorMessage(error, this.translate.instant('No se pudo actualizar la contraseña'))
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
            notifications: !!setting?.notifications,
            map_marker_type: this.sanitizeString(setting?.map_marker_type) || 'default'
        }));
    }

    private normalizeUserPayload(payload: any): any {
        const sanitized: any = { ...payload };
        const clearFields = new Set<string>(payload.clear_fields || []);

        for (const field of ['phone2', 'address', 'photo']) {
            if (field in payload && payload[field] !== undefined && !this.sanitizeString(payload[field])) {
                clearFields.add(field);
                delete sanitized[field];
            }
        }
        if (clearFields.size) sanitized.clear_fields = [...clearFields];

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
