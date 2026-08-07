import { Component, OnInit, Output, EventEmitter, Input, SimpleChanges, OnChanges, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UserRole, Privilege, PrivilegeAction } from '@core/interfaces/user-role.interface';
import { ExtendedUser, UserSettings, UserTransferHistoryEntry } from '@core/interfaces/user.interface';
import { TranslateService } from '@ngx-translate/core';

import { UserRolesService } from '@core/services/user-roles.service';
import { MessageService } from 'primeng/api';
import { PersonalizedCallHistory, UserService } from '@core/services/user.service';
import { AuthService } from '@core/services/auth.service';
import { PrivilegeService } from './services/privilege.service';
import { debounceTime, Subject, takeUntil } from 'rxjs';
import { VehicleBrandsService } from 'src/app/core/services/vehicle-brands.service';
import { CloudService } from '@core/services/cloud.service';
import { FirebaseNotificationsService } from '@core/services/firebase-notifications.service';
import { SystemService } from '@core/services/system.service';
import { MapUtils } from 'src/app/shareds/helpers/map.helper';
import { WhatsAppApiService } from '@core/services/whatsapp-api.service';
import { InteraccionesService, UserList } from '../../../../../interacciones/presentation/services/interacciones.service';
import { VapiService } from '@core/services/vapi.service';
import * as maplibregl from 'maplibre-gl';

declare var google: any;
type StaticLocationMethod = 'coordinates' | 'link' | 'search';
interface StaticLocationSuggestion {
    description: string;
    placeId: string;
    mainText: string;
    secondaryText: string;
    placePrediction?: any;
}

import {
    AVAILABLE_MODULES, // Lista de módulos disponibles
    MODULE_ICONS, // Iconos de los módulos
    THEMES, // Temas disponibles
    LANGUAGES, // Idiomas disponibles
    PROFILE_TYPES, // Tipos de perfil
    AFFILIATION_TYPES, // Tipos de afiliación
    USER_FORM_STYLES, // Estilos del formulario
    ModuleOption, // Opciones de módulo 
    ThemeOption, // Opciones de tema
    LanguageOption, // Opciones de idioma
    ProfileTypeOption, // Opciones de perfil
    AffiliationTypeOption, // Opciones de afiliación
    PROVINCES,
    MUNICIPALITIES,
    ProvinceOption,
    MunicipalityOption,
    TECHNICIAN_SERVICES,
    ServiceOption,
    COMPANY_TYPES,
    CompanyTypeOption
} from './constants/user-form.constants';
import { getApiErrorMessage } from '../../../../../../../core/utils/api-error.util';

@Component({
    selector: 'app-user-form',
    templateUrl: './user-form.component.html',
    styleUrls: USER_FORM_STYLES,
    standalone: false
})
export class UserFormComponent implements OnInit, OnChanges, OnDestroy {
    private destroy$ = new Subject<void>();

    @Input() userInput: ExtendedUser | null = null;
    @Input() showWhatsappButton: boolean = false;
    @Output() userCreated = new EventEmitter<any>();
    @Output() openChatEvent = new EventEmitter<any>();

    // Claves de traducción
    translations = {
        title: 'management.userForm.title',
        personalInfo: 'management.userForm.personalInfo',
        name: 'management.userForm.name',
        lastName: 'management.userForm.lastName',
        email: 'management.userForm.email',
        dni: 'management.userForm.dni',
        birth: 'management.userForm.birth',
        address: 'management.userForm.address',
        phone: 'management.userForm.phone',
        phone2: 'management.userForm.phone2',
        settings: 'management.userForm.settings',
        theme: 'management.userForm.theme',
        language: 'management.userForm.language',
        notifications: 'management.userForm.notifications',
        affiliationType: 'management.userForm.affiliationType',
        profileType: 'management.userForm.profileType',
        role: 'management.userForm.role',
        privileges: 'management.userForm.privileges',
        of: 'management.userForm.of',
        save: 'management.userForm.save',
        cancel: 'management.userForm.cancel'
    };

    user: ExtendedUser = this.getEmptyUser();
    roles: UserRole[] = [];

    // Propiedad para verificar si el usuario actual es empleado
    get isCurrentUserEmployee(): boolean {
        const currentUser = this.authService.getCurrentUser();
        return currentUser?.affiliation_type_id === 'empleado';
    }

    // Getter para obtener los roles filtrados según el tipo de usuario
    get filteredRoles(): UserRole[] {
        // Si el usuario actual es empleado, mostrar todos los roles
        if (this.isCurrentUserEmployee) {
            return this.roles;
        }

        // Para usuarios que no son empleados
        const currentUser = this.authService.getCurrentUser();
        if (currentUser && currentUser.access_level_id) {
            let userAccessLevelId: string = '';

            // Manejar tanto si access_level_id es un objeto como si es un string
            if (typeof currentUser.access_level_id === 'string') {
                userAccessLevelId = currentUser.access_level_id;
            } else if (currentUser.access_level_id && typeof currentUser.access_level_id === 'object' && currentUser.access_level_id._id) {
                userAccessLevelId = currentUser.access_level_id._id;
            }

            if (userAccessLevelId) {
                let filteredRoles = this.roles.filter(role => role._id === userAccessLevelId);

                // Si estamos editando un usuario (userInput existe), también incluir el rol actual del usuario que se está editando
                if (this.userInput && this.user.role && this.user.role._id) {
                    const editingUserRoleId = this.user.role._id;
                    const editingUserRole = this.roles.find(role => role._id === editingUserRoleId);

                    // Si el rol del usuario que se está editando es diferente al del usuario logueado, agregarlo
                    if (editingUserRole && editingUserRole._id !== userAccessLevelId) {
                        filteredRoles = [...filteredRoles, editingUserRole];
                    }
                }

                return filteredRoles;
            }
        }

        // Si no hay usuario actual o no tiene access_level_id, mostrar todos los roles (fallback)
        return this.roles;
    }


    availableModules: ModuleOption[] = AVAILABLE_MODULES;
    moduleIcons: { [key: string]: string } = MODULE_ICONS;
    themes: ThemeOption[] = THEMES;
    languages: LanguageOption[] = LANGUAGES;
    profileTypes: ProfileTypeOption[] = PROFILE_TYPES;
    affiliationTypes: AffiliationTypeOption[] = AFFILIATION_TYPES;
    companyTypes: CompanyTypeOption[] = COMPANY_TYPES;

    // Propiedades intermedias para el enlace de datos
    selectedTheme: string = this.getSettingValue('theme') as string;
    selectedLanguage: string = this.getSettingValue('language') as string;
    notificationsEnabled: boolean = this.getSettingValue('notifications') as boolean;

    selectedAffiliationType: string = '';
    selectedProfileType: string = '';
    selectedCompanyType: string = '';
    // Campos para técnicos
    provinces: ProvinceOption[] = PROVINCES;
    municipalities: MunicipalityOption[] = MUNICIPALITIES[''];
    
    // Dynamic Location State
    showLocationModal: boolean = false;
    availableProvinces: any[] = [];
    availableMunicipalities: any[] = [];
    availableSectors: any[] = [];
    
    userLocationMap: any;
    userLocationMarker: any;
    staticLocationManualAddress: string = '';
    staticLocationGoogleMapsLink: string = '';
    staticLocationMethod: StaticLocationMethod = 'search';
    staticLatitudeInput: number | null = null;
    staticLongitudeInput: number | null = null;
    loadingStaticLocation: boolean = false;
    savingStaticLocation: boolean = false;
    resolvingStaticLocationLink: boolean = false;
    showStaticLocationMapModal: boolean = false;
    staticLocationPreviewMap: any;
    staticLocationPreviewMarker: any;
    staticLocationSuggestions: StaticLocationSuggestion[] = [];
    searchingStaticLocation: boolean = false;
    staticLocationSearchAttempted: boolean = false;
    staticLocationSearchUnavailable: boolean = false;
    private staticLocationSearch$ = new Subject<string>();
    private staticLocationAutocompleteService: any;
    private staticLocationAutocompleteSessionToken: any;
    private staticLocationSearchRequestId: number = 0;
    
    selectedProvince: string = '';
    selectedMunicipality: string = '';
    technicianServices: string[] = [];
    technicianServicesOptions: ServiceOption[] = TECHNICIAN_SERVICES;
    // Control programático para precargar municipio al cambiar provincia desde backend
    private pendingMunicipality: string = '';
    private isProgrammaticProvinceSetting: boolean = false;

    confirmPassword: string = '';

    activeTabIndex: number = 0;
    showContactsModal: boolean = false;

    // Push Notifications
    displayPushModal: boolean = false;
    pushTitle: string = '';
    pushBody: string = '';
    isSendingPush: boolean = false;

    // Personalized calls
    displayPersonalizedCallModal: boolean = false;
    personalizedCallClientName: string = '';
    personalizedCallReason: string = '';
    sendingPersonalizedCall: boolean = false;
    personalizedCallHistory: PersonalizedCallHistory[] = [];
    loadingPersonalizedCallHistory: boolean = false;

    // Agregamos una nueva propiedad para controlar si estamos inicializando el formulario de edición
    private isInitializingEditForm: boolean = false;

    // WhatsApp Messaging
    showWaTemplateModal: boolean = false;
    showWaFreeTextModal: boolean = false;
    sendingWa: boolean = false;
    waFreeText: string = '';
    waConversationId: number | null = null;
    waSelectedPhone: string = '';
    whatsappAgentId: string = '';
    waTemplateVars = {
        headerUser: '',
        bodySaludos: '',
        name: '',
        body: ''
    };
    waCheckingWindow: boolean = false;

    // Campaign Assignment
    showCampaignModal: boolean = false;
    availableCampaigns: UserList[] = [];
    selectedCampaign: UserList | null = null;
    loadingCampaigns: boolean = false;
    addingToCampaign: boolean = false;

    // Identity verification
    displayIdentityVerificationModal: boolean = false;
    identityFile: File | null = null;
    identityPreviewUrl: string | null = null;
    identityScanResult: Record<string, any> | null = null;
    identityScanError: string = '';
    scanningIdentity: boolean = false;
    finalizingIdentity: boolean = false;
    generatingIdentityLink: boolean = false;
    identityVerificationLink: string = '';

    // Subcliente parent email
    subclienteParentEmail: string = '';

    @ViewChild('municipalitySelect') municipalitySelectRef?: ElementRef<HTMLSelectElement>;
    @ViewChild('identityFileInput') identityFileInput?: ElementRef<HTMLInputElement>;
    @ViewChild('staticLocationSearchInput') staticLocationSearchInput?: ElementRef<HTMLInputElement>;

    constructor(
        private userRolesService: UserRolesService,
        private translate: TranslateService,
        private messageService: MessageService,
        private userService: UserService,
        private authService: AuthService,
        private route: ActivatedRoute,
        private privilegeService: PrivilegeService,
        private brandsService: VehicleBrandsService,
        private systemService: SystemService,
        private cdr: ChangeDetectorRef,
        private cloudService: CloudService,
        private firebaseNotificationsService: FirebaseNotificationsService,
        private whatsappApi: WhatsAppApiService,
        private interaccionesService: InteraccionesService,
        private vapiService: VapiService
    ) { }

    onPhotoSelected(event: any) {
        const file = event.target.files[0];
        if (file) {
            this.uploadProfilePhoto(file);
        }
    }

    openPushModal() {
        this.pushTitle = '';
        this.pushBody = '';
        this.displayPushModal = true;
    }

    sendPersonalPush() {
        if (!this.pushTitle || !this.pushBody || !this.user._id) return;

        this.isSendingPush = true;
        const payload = {
            title: this.pushTitle,
            body: this.pushBody,
            topic: this.user._id.toString()
        };

        this.firebaseNotificationsService.sendTestNotification(payload).subscribe({
            next: (res: any) => {
                this.isSendingPush = false;
                if (res.success) {
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Éxito',
                        detail: 'Notificación enviada correctamente al usuario.'
                    });
                    this.displayPushModal = false;
                }
            },
            error: (err: any) => {
                this.isSendingPush = false;
                console.error('Error enviando notificación:', err);
                const errorDetail = err.error?.message || 'No se pudo enviar la notificación personal.';
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: errorDetail
                });
            }
        });
    }

    openPersonalizedCallModal(): void {
        this.personalizedCallClientName = this.getUserFullName();
        this.personalizedCallReason = '';
        this.loadPersonalizedCallHistory();
        this.displayPersonalizedCallModal = true;
    }

    sendPersonalizedCall(): void {
        const phone = String(this.user.phone || this.user.phone2 || '').trim();
        const name = String(this.personalizedCallClientName || '').trim();
        const reason = String(this.personalizedCallReason || '').trim();

        if (!phone) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Teléfono requerido',
                detail: 'Este usuario no tiene un número de WhatsApp o teléfono registrado.'
            });
            return;
        }

        if (!name || !reason) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Datos incompletos',
                detail: 'Debe indicar el nombre del cliente y el motivo de la llamada.'
            });
            return;
        }

        this.sendingPersonalizedCall = true;
        this.vapiService.sendPersonalizedCall({
            phone,
            name,
            query: reason,
            userId: this.user._id,
            purpose: 'personalized_user_call'
        }).subscribe({
            next: (response) => {
                this.sendingPersonalizedCall = false;
                if (response?.success) {
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Llamada iniciada',
                        detail: 'La llamada personalizada fue enviada correctamente.'
                    });
                    this.personalizedCallReason = '';
                    this.loadPersonalizedCallHistory();
                    return;
                }

                this.messageService.add({
                    severity: 'error',
                    summary: 'No se pudo llamar',
                    detail: response?.error || 'No se pudo iniciar la llamada personalizada.'
                });
            },
            error: (error) => {
                this.sendingPersonalizedCall = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'No se pudo llamar',
                    detail: error?.error?.message || error?.error?.error || 'No se pudo iniciar la llamada personalizada.'
                });
            }
        });
    }

    loadPersonalizedCallHistory(): void {
        const userId = this.user?._id || this.userInput?._id;
        if (!userId) {
            this.personalizedCallHistory = [];
            return;
        }

        this.loadingPersonalizedCallHistory = true;
        this.userService.getPersonalizedCalls(userId).pipe(takeUntil(this.destroy$)).subscribe({
            next: (calls) => {
                this.personalizedCallHistory = Array.isArray(calls) ? calls : [];
                this.loadingPersonalizedCallHistory = false;
            },
            error: () => {
                this.loadingPersonalizedCallHistory = false;
                this.personalizedCallHistory = [];
            }
        });
    }

    getPersonalizedCallAudioUrl(call: PersonalizedCallHistory): string {
        if (call.recordingUrl) return call.recordingUrl;
        if (call.callId) return this.vapiService.getCallRecordingAudioUrl(call.callId);
        return '';
    }

    hasPersonalizedCallAudio(call: PersonalizedCallHistory): boolean {
        return !!call.recordingUrl || (!!call.callId && this.getPersonalizedCallStatus(call) === 'Finalizada');
    }

    formatPersonalizedCallDate(value: any): string {
        if (!value) return 'Fecha no disponible';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
        return date.toLocaleString('es-DO', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    }

    getUserTransferHistory(): UserTransferHistoryEntry[] {
        const history = Array.isArray(this.user?.transfer_history)
            ? this.user.transfer_history
            : [];
        return [...history].sort((first, second) => (
            new Date(second.transferred_at).getTime()
            - new Date(first.transferred_at).getTime()
        ));
    }

    getUserTransferAccountLabel(
        entry: UserTransferHistoryEntry,
        side: 'from' | 'to'
    ): string {
        const name = String(
            side === 'from' ? entry.from_parent_name : entry.to_parent_name
        ).trim();
        const email = String(
            side === 'from' ? entry.from_parent_email : entry.to_parent_email
        ).trim();
        const id = String(
            side === 'from' ? entry.from_parent_id : entry.to_parent_id
        ).trim();
        return name || email || (id ? `Cuenta ${id}` : 'Sin cuenta superior');
    }

    getUserTransferAccountEmail(
        entry: UserTransferHistoryEntry,
        side: 'from' | 'to'
    ): string {
        return String(
            side === 'from' ? entry.from_parent_email : entry.to_parent_email
        ).trim();
    }

    getUserTransferActorLabel(entry: UserTransferHistoryEntry): string {
        return String(
            entry.transferred_by_name
            || entry.transferred_by_email
            || 'Sistema'
        ).trim();
    }

    formatPersonalizedCallDuration(seconds?: number): string {
        if (!seconds || seconds <= 0) return '';
        const minutes = Math.floor(seconds / 60);
        const remainder = Math.round(seconds % 60);
        if (!minutes) return `${remainder}s`;
        return `${minutes}m ${remainder}s`;
    }

    getPersonalizedCallTranscriptMessages(transcript?: string): Array<{ speaker: 'agent' | 'client'; label: string; text: string }> {
        if (!transcript) return [];

        const messages: Array<{ speaker: 'agent' | 'client'; label: string; text: string }> = [];
        const lines = transcript
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean);

        for (const line of lines) {
            const match = line.match(/^(AI|IA|Ester|Assistant|Agent|Agente|User|Usuario|Cliente)\s*:\s*(.+)$/i);
            if (!match) {
                const last = messages[messages.length - 1];
                if (last) {
                    last.text = `${last.text} ${line}`.trim();
                } else {
                    messages.push({ speaker: 'agent', label: 'Ester', text: line });
                }
                continue;
            }

            const rawSpeaker = match[1].toLowerCase();
            const isClient = ['user', 'usuario', 'cliente'].includes(rawSpeaker);
            messages.push({
                speaker: isClient ? 'client' : 'agent',
                label: isClient ? 'Cliente' : 'Ester',
                text: match[2].trim()
            });
        }

        return messages;
    }

    getPersonalizedCallStatus(call: PersonalizedCallHistory): string {
        const status = String(call.status || '').toLowerCase();
        if (call.transcript || call.recordingUrl || call.endedAt) return 'Finalizada';
        if (status.includes('ended') || status.includes('complete')) return 'Finalizada';
        if (status.includes('failed') || status.includes('error')) return 'Fallida';
        return 'En proceso';
    }

    getUserFullName(): string {
        return `${this.user.name || ''} ${this.user.last_name || ''}`.trim();
    }

    openCampaignModal() {
        this.selectedCampaign = null;
        this.showCampaignModal = true;
        this.loadCampaigns();
    }

    loadCampaigns() {
        this.loadingCampaigns = true;
        this.interaccionesService.getAll().pipe(takeUntil(this.destroy$)).subscribe({
            next: (lists) => {
                this.availableCampaigns = lists;
                this.loadingCampaigns = false;
            },
            error: (error) => {
                this.loadingCampaigns = false;
                this.messageService.add({ severity: 'error', summary: 'Error', detail: getApiErrorMessage(error, 'No se pudieron cargar las campañas disponibles') });
            }
        });
    }

    addToCampaign() {
        if (!this.selectedCampaign || !this.user._id) return;
        
        this.addingToCampaign = true;
        const manualIds = this.selectedCampaign.filters?.manual_user_ids || [];
        
        if (manualIds.includes(this.user._id)) {
            this.messageService.add({ severity: 'info', summary: 'Aviso', detail: 'El usuario ya pertenece a esta campaña manualmente.' });
            this.addingToCampaign = false;
            this.showCampaignModal = false;
            return;
        }

        const newManualIds = [...manualIds, this.user._id];
        const newFilters = { ...this.selectedCampaign.filters, manual_user_ids: newManualIds };

        this.interaccionesService.update(this.selectedCampaign._id, { filters: newFilters }).pipe(takeUntil(this.destroy$)).subscribe({
            next: () => {
                this.addingToCampaign = false;
                this.showCampaignModal = false;
                this.messageService.add({ severity: 'success', summary: 'Añadido', detail: `El usuario fue añadido a la campaña "${this.selectedCampaign!.name}"` });
            },
            error: (error) => {
                this.addingToCampaign = false;
                this.messageService.add({ severity: 'error', summary: 'Error', detail: getApiErrorMessage(error, 'No se pudo añadir el usuario a la campaña') });
            }
        });
    }

    removePhoto() {
        this.user.photo = '';
        this.currentPhotoUrl = null;
    }

    private uploadProfilePhoto(file: File) {
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
        // Use the user being edited ID if available, otherwise the current user (creator) ID
        const ownerId = this.userInput?._id || currentUser?.id;

        if (!ownerId) {
            this.messageService.add({
                severity: 'error',
                summary: this.translate.instant('Error'),
                detail: this.translate.instant('No se pudo determinar el propietario para subir la imagen')
            });
            return;
        }

        // Upload to cloud storage
        this.cloudService.uploadFile(file, ownerId).subscribe({
            next: (event) => {
                // Handle upload progress if needed
                if (event.type === 4 && event.body) { // HttpEventType.Response
                    const uploadedFile = event.body.data?.[0];
                    if (uploadedFile?.location_cdn) {
                        this.user.photo = uploadedFile.location_cdn;
                        this.currentPhotoUrl = uploadedFile.location_cdn;
                    }
                }
            },
            error: (error) => {
                console.error('Error uploading photo:', error);
                this.messageService.add({
                    severity: 'error',
                    summary: this.translate.instant('Error'),
                    detail: this.translate.instant('Error al subir la foto de perfil')
                });
            }
        });
    }

    // Métodos de validación de privilegios
    canCreateUsers(): boolean {
        return this.authService.hasPrivilege('users', 'create');
    }

    canUpdateUsers(): boolean {
        return this.authService.hasPrivilege('users', 'update');
    }

    private getEmptyUser(): ExtendedUser {
        return {
            _id: '',
            email: '',
            name: '',
            last_name: '',
            dni: '',
            birth: '',
            address: '',
            photo: '',
            phone: '',
            phone2: '',
            static_location_url: '',
            static_location_address: '',
            verified_email: false,
            role: null,
            settings: {
                theme: 'light',
                language: 'es',
                notifications: true,
                affiliation_type: 'cliente',
                profile_type: 'personal'
            },
            status: true,
            access_level_id: {
                _id: '',
                name: '',
                description: '',
                privileges: [],
                createdAt: '',
                updatedAt: ''
            },
            affiliation_type_id: 'cliente',
            profile_type_id: 'personal'
        };
    }

    openContacts(): void {
        this.showContactsModal = true;
    }

    closeContacts(): void {
        this.showContactsModal = false;
    }

    ngOnInit() {
        this.staticLocationSearch$
            .pipe(
                debounceTime(3000),
                takeUntil(this.destroy$)
            )
            .subscribe(query => void this.searchStaticLocationSuggestions(query));

        this.loadRoles();
        this.user = this.getEmptyUser();
        this.selectedTheme = 'light';
        this.selectedLanguage = 'es';
        this.notificationsEnabled = true;
        this.selectedAffiliationType = 'cliente';
        this.selectedProfileType = 'personal';
        this.selectedCompanyType = '';
        this.confirmPassword = '';
        this.user.password = '';
        this.activeTabIndex = 0;

        // Usa el ID real del empleado para asignar la conversación.
        const currentUser = this.authService.getCurrentUser();
        if (currentUser?.id) {
            this.userService.getById(currentUser.id).subscribe({
                next: (user: any) => {
                    this.whatsappAgentId = String(user?._id || user?.id || currentUser.id);
                },
                error: () => { this.whatsappAgentId = ''; }
            });
        }

        // Cargar provincias desde API real (usa el mismo backend de marcas/modelos)
        this.brandsService.getProvinces()
            .then(list => {
                this.provinces = [{ label: this.translate.instant('management.userForm.selectAffiliation'), value: '' }, ...list.map((p: any) => ({ label: p.name, value: String(p.code) }))];
            })
            .catch(() => { });
    }

    private resetForm() {
        this.user = this.getEmptyUser();
        this.selectedTheme = 'light';
        this.selectedLanguage = 'es';
        this.notificationsEnabled = true;
        this.selectedAffiliationType = 'cliente';
        this.selectedProfileType = 'personal';
        this.selectedCompanyType = '';
        this.confirmPassword = '';
        this.user.password = '';
        this.activeTabIndex = 0;
        this.currentPhotoUrl = null;
        
        // Ensure Geographic caches and local selections explicitly wipe
        this.selectedProvince = '';
        this.selectedMunicipality = '';
        this.user.sector = '';
        this.pendingMunicipality = '';
        this.availableProvinces = [];
        this.availableMunicipalities = [];
        this.availableSectors = [];
        this.user.static_location_url = '';
        this.user.static_location_address = '';
        this.user.static_latitude = undefined;
        this.user.static_longitude = undefined;
        this.personalizedCallHistory = [];
        this.loadingPersonalizedCallHistory = false;
        this.resetIdentityVerificationState();
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['userInput']) {
            if (changes['userInput'].currentValue) {
                const user = changes['userInput'].currentValue;

                // Primero cargamos los roles si no están cargados
                if (!this.roles || this.roles.length === 0) {
                    this.loadRoles().then(() => {
                        this.setupEditUser(user);
                    });
                } else {
                    this.setupEditUser(user);
                }
            } else {
                this.resetForm();
            }
        }
    }

    // Propiedad para mostrar la foto actual
    currentPhotoUrl: string | null = null;

    private setupEditUser(user: ExtendedUser) {
        console.log(user, 'holaaaaa4')
        // Rellenar el formulario con los datos del usuario a editar
        this.user = JSON.parse(JSON.stringify(user));
        this.personalizedCallHistory = Array.isArray((user as any).personalized_calls)
            ? (user as any).personalized_calls
            : [];
        this.loadPersonalizedCallHistory();
        this.user.birth = this.formatDateToInput(user.birth);
        this.selectedTheme = this.user.settings?.theme || 'light';
        this.selectedLanguage = this.user.settings?.language || 'es';
        this.notificationsEnabled = this.user.settings?.notifications ?? true;

        // Establecer la URL de la foto actual
        this.currentPhotoUrl = user.photo || null;

        // Asignamos explícitamente los valores para el tipo de afiliación y perfil
        this.selectedAffiliationType = user.affiliation_type_id || 'cliente';
        this.selectedProfileType = user.profile_type_id || 'personal';
        this.selectedCompanyType = user.company_type_id || '';
        if (this.isCurrentUserEmployee && user._id) {
            this.loadStaticLocation(user._id);
        }

        // Pre-fill parent email for subcliente
        if (this.selectedAffiliationType === 'subcliente' && (user as any).parent_id) {
            this.fetchParentEmail((user as any).parent_id);
        } else {
            this.subclienteParentEmail = '';
        }

        // Forzar detección de cambios
        this.cdr.detectChanges();

        const backendProvince = (user as any).province || '';
        const backendMunicipality = (user as any).municipality || '';
        const backendServices = (user as any).services;

        // Cargar provincia y municipio para todos los usuarios
        this.selectedProvince = backendProvince;
        this.pendingMunicipality = backendMunicipality;
        
        // Execute cascading load directly without fragile setTimeout delays
        if (this.selectedProvince) {
            this.isProgrammaticProvinceSetting = true;
            const paramProv = isNaN(Number(this.selectedProvince)) ? this.selectedProvince : this.selectedProvince;
            this.brandsService.getMunicipalities(paramProv).then((municipalities: any) => {
                this.availableMunicipalities = municipalities.map((m: any) => ({ label: m.name, value: String(m.code) }));
                
                if (this.pendingMunicipality) {
                    this.selectedMunicipality = this.pendingMunicipality;
                    const paramMun = isNaN(Number(this.selectedMunicipality)) ? this.selectedMunicipality : this.selectedMunicipality;
                    
                    this.brandsService.getSectors(paramMun, paramProv).then((sectors: any) => {
                        this.availableSectors = sectors.map((s: any) => ({ label: s.name, value: String(s.name) }));
                        this.user.sector = (user as any).sector || '';
                        this.isProgrammaticProvinceSetting = false;
                        this.cdr.detectChanges();
                    });
                } else {
                    this.isProgrammaticProvinceSetting = false;
                    this.cdr.detectChanges();
                }
            });
        } else {
            this.selectedMunicipality = '';
            this.availableMunicipalities = [];
            this.availableSectors = [];
        }

        // Servicios desde backend (solo para técnicos)
        const isTech = this.selectedAffiliationType?.startsWith('tecnico');
        if (isTech) {
            this.technicianServices = Array.isArray(backendServices) ? backendServices.map((s: any) => String(s)) : [];
        } else {
            this.technicianServices = [];
        }

        this.confirmPassword = '';

        // Preservar los privilegios personalizados si existen
        const userPrivileges = user.privileges;

        // Seleccionar el rol correcto de la lista de roles
        if (user.access_level_id && user.access_level_id._id && this.roles && Array.isArray(this.roles)) {
            const roleId = user.access_level_id._id;
            const foundRole = this.roles.find(r => r._id === roleId);

            if (foundRole) {
                this.user.role = foundRole;

                // Invocar onRoleChange para inicializar correctamente, pero sin borrar privilegios personalizados
                setTimeout(() => {
                    // Conservar la bandera de que estamos en modo edición para no borrar privilegios personalizados
                    this.isInitializingEditForm = true;
                    this.onRoleChange();
                    this.isInitializingEditForm = false;

                    // Restaurar los privilegios personalizados después de inicializar el rol
                    if (userPrivileges) {
                        this.user.privileges = userPrivileges;
                    }
                }, 0);
            }
        }

        this.activeTabIndex = 0;
        this.resetIdentityVerificationState();
    }

    get isIdentityVerified(): boolean {
        return this.user?.verificado === true || !!this.user?.cedula_img;
    }

    openIdentityVerificationModal(): void {
        if (!this.userInput?._id) {
            this.messageService.add({
                severity: 'info',
                summary: 'Guarde el usuario',
                detail: 'Debe guardar el usuario antes de verificar la cuenta.',
                life: 2600
            });
            return;
        }

        this.resetIdentityVerificationState();
        if (this.isIdentityVerified) {
            this.identityScanResult = this.user.cedula_img?.metadata || null;
            this.identityPreviewUrl = this.user.cedula_img?.url || null;
        }
        this.displayIdentityVerificationModal = true;
    }

    closeIdentityVerificationModal(): void {
        this.displayIdentityVerificationModal = false;
        this.resetIdentityVerificationState();
    }

    triggerIdentityFileInput(): void {
        if (this.scanningIdentity || this.finalizingIdentity || this.isIdentityVerified) return;
        this.identityFileInput?.nativeElement?.click();
    }

    onIdentityFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            this.messageService.add({
                severity: 'error',
                summary: 'Archivo inválido',
                detail: 'Debe subir una imagen de la cédula.'
            });
            input.value = '';
            return;
        }

        this.identityFile = file;
        this.identityScanResult = null;
        this.identityScanError = '';
        this.identityPreviewUrl = URL.createObjectURL(file);
        input.value = '';
        this.scanIdentityFile(file);
    }

    scanIdentityFile(file: File): void {
        const userId = this.userInput?._id;
        if (!userId) return;

        this.scanningIdentity = true;
        this.identityScanError = '';

        this.userService.scanIdentity(userId, file)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (response) => {
                    this.scanningIdentity = false;
                    this.identityScanResult = response.data || null;

                    if (response.data?.['es_cedula'] !== true) {
                        this.identityScanError = response.data?.['mensaje_usuario']
                            || 'La imagen subida no parece ser una cédula. Debe subir una foto clara de la cédula de identidad.';
                        this.playIdentityVoice(response.voiceAudio);
                        return;
                    }

                    this.messageService.add({
                        severity: 'success',
                        summary: 'Cédula digitalizada',
                        detail: 'La cuenta se verificará automáticamente.',
                        life: 3000
                    });
                    this.finalizeIdentityVerification();
                },
                error: (error) => {
                    this.scanningIdentity = false;
                    this.identityScanError = error?.error?.message || error?.message || 'No se pudo escanear la cédula.';
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: this.identityScanError,
                        life: 3500
                    });
                }
            });
    }

    finalizeIdentityVerification(): void {
        const userId = this.userInput?._id;
        if (!userId || !this.identityFile || !this.identityScanResult) return;

        if (this.identityScanResult['es_cedula'] !== true) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Cédula inválida',
                detail: 'Debe subir una cédula válida antes de finalizar.'
            });
            return;
        }

        this.finalizingIdentity = true;
        this.userService.finalizeIdentity(userId, this.identityFile, this.identityScanResult)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (response) => {
                    this.finalizingIdentity = false;
                    const updatedUser: any = response.user || {};
                    this.user = {
                        ...this.user,
                        ...updatedUser,
                        role: this.user.role,
                        settings: this.user.settings,
                        access_level_id: this.user.access_level_id,
                        verificado: true,
                        cedula_img: response.cedula_img || updatedUser.cedula_img
                    };

                    this.user.name = updatedUser.name || this.user.name;
                    this.user.last_name = updatedUser.last_name || this.user.last_name;
                    this.user.dni = updatedUser.dni || this.user.dni;
                    this.user.birth = this.formatDateToInput(updatedUser.birth || this.user.birth);
                    this.user.address = updatedUser.address || this.user.address;
                    this.selectedProvince = updatedUser.province || this.selectedProvince;
                    this.selectedMunicipality = updatedUser.municipality || this.selectedMunicipality;

                    this.identityScanResult = response.data || this.identityScanResult;
                    this.identityPreviewUrl = response.cedula_img?.url || this.identityPreviewUrl;
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Cuenta verificada',
                        detail: 'La cuenta fue verificada correctamente.',
                        life: 3000
                    });
                },
                error: (error) => {
                    this.finalizingIdentity = false;
                    const detail = error?.error?.message || error?.message || 'No se pudo finalizar la verificación.';
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail,
                        life: 4000
                    });
                }
            });
    }

    getIdentityDataEntries(): Array<{ label: string; value: any }> {
        if (!this.identityScanResult) return [];

        const labels: Record<string, string> = {
            nombres: 'Nombres',
            apellidos: 'Apellidos',
            cedula: 'Cédula',
            fecha_nacimiento: 'Fecha de nacimiento',
            lugar_nacimiento: 'Lugar de nacimiento',
            nacionalidad: 'Nacionalidad',
            sexo: 'Sexo',
            estado_civil: 'Estado civil',
            ocupacion: 'Ocupación',
            direccion: 'Dirección',
            municipio: 'Municipio',
            provincia: 'Provincia',
            fecha_emision: 'Fecha de emisión',
            fecha_expiracion: 'Fecha de expiración',
            confidence: 'Confianza'
        };

        return Object.entries(labels)
            .map(([key, label]) => ({ label, value: this.identityScanResult?.[key] }))
            .filter(item => item.value !== undefined && item.value !== null && item.value !== '');
    }

    private resetIdentityVerificationState(): void {
        if (this.identityPreviewUrl && !this.identityPreviewUrl.startsWith('http')) {
            URL.revokeObjectURL(this.identityPreviewUrl);
        }
        this.identityFile = null;
        this.identityPreviewUrl = null;
        this.identityScanResult = null;
        this.identityScanError = '';
        this.scanningIdentity = false;
        this.finalizingIdentity = false;
        this.generatingIdentityLink = false;
        this.identityVerificationLink = '';
    }

    private playIdentityVoice(voiceAudio?: { mimeType: string; base64: string }): void {
        if (!voiceAudio?.base64) return;

        try {
            const audio = new Audio(`data:${voiceAudio.mimeType || 'audio/mpeg'};base64,${voiceAudio.base64}`);
            audio.play().catch(() => undefined);
        } catch (error) {
            console.warn('No se pudo reproducir la voz de verificación:', error);
        }
    }

    generateIdentityVerificationLink(): void {
        const userId = this.userInput?._id;
        if (!userId || this.generatingIdentityLink) return;

        this.generatingIdentityLink = true;
        this.userService.createIdentityVerificationLink(userId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: async (response) => {
                    this.generatingIdentityLink = false;
                    const code = response.short_code;
                    this.identityVerificationLink = `${window.location.origin}/verificar-cuenta/${encodeURIComponent(code)}`;
                    await this.copyIdentityVerificationLink(false);
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Link generado',
                        detail: 'El link de verificación fue copiado al portapapeles.',
                        life: 3200
                    });
                },
                error: (error) => {
                    this.generatingIdentityLink = false;
                    this.messageService.add({
                        severity: 'error',
                        summary: 'No se pudo generar',
                        detail: getApiErrorMessage(error, 'No se pudo generar el enlace de verificación de identidad'),
                        life: 3500
                    });
                }
            });
    }

    async copyIdentityVerificationLink(showToast: boolean = true): Promise<void> {
        if (!this.identityVerificationLink) return;

        try {
            await navigator.clipboard.writeText(this.identityVerificationLink);
        } catch {
            this.copyTextFallback(this.identityVerificationLink);
        }

        if (showToast) {
            this.messageService.add({
                severity: 'success',
                summary: 'Copiado',
                detail: 'Link copiado al portapapeles.',
                life: 2200
            });
        }
    }

    private copyTextFallback(value: string): void {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }

    loadRoles() {
        return new Promise<void>((resolve) => {
            this.userRolesService.getAllRoles()
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                    next: (roles) => {
                        this.roles = roles;

                        resolve();
                    },
                    error: (error) => {
                        console.error('Error al cargar roles:', error);
                        resolve();
                    }
                });
        });
    }

    getPrivilegeByModule(privileges: Privilege[] | undefined, module: string): Privilege | undefined {
        return this.privilegeService.getPrivilegeByModule(privileges, module);
    }

    getPrivilegeActions(module: string): PrivilegeAction {
        return this.privilegeService.getPrivilegeActions(
            this.user.privileges,
            this.user.role?.privileges,
            module
        );
    }

    setPrivilegeAction(module: string, action: keyof PrivilegeAction, value: boolean): void {
        if (Array.isArray(this.user.privileges)) {
            let privilege = this.user.privileges.find(item => item.module === module);
            if (!privilege) {
                const rolePrivilege = this.user.role?.privileges?.find(item => item.module === module);
                privilege = rolePrivilege
                    ? JSON.parse(JSON.stringify(rolePrivilege))
                    : {
                        module,
                        actions: { read: false, create: false, update: false, delete: false }
                    };
                this.user.privileges.push(privilege);
            }
            privilege.actions[action] = value;
            return;
        }

        if (this.user.role) {
            this.user.role = this.privilegeService.setPrivilegeAction(
                this.user.role,
                module,
                action,
                value
            );
        }
    }

    toggleAllPrivileges(privilege: Privilege | undefined): void {
        if (!privilege) return;

        // Modificar el privilegio sin crear una nueva referencia
        this.privilegeService.toggleAllPrivileges(privilege);

        // Si estamos trabajando con privilegios personalizados del usuario
        if (this.user.privileges && Array.isArray(this.user.privileges)) {
            const userPrivilegeIndex = this.user.privileges.findIndex(p => p.module === privilege.module);
            if (userPrivilegeIndex >= 0) {
                // Actualizar el privilegio personalizado
                this.user.privileges[userPrivilegeIndex] = { ...privilege };
                return; // Salimos para no actualizar también los privilegios del rol
            }
        }

        // Si llegamos aquí, actualizamos los privilegios del rol
        if (this.user.role && this.user.role.privileges) {
            const rolePrivilegeIndex = this.user.role.privileges.findIndex(p => p.module === privilege.module);
            if (rolePrivilegeIndex >= 0) {
                // Actualizar el privilegio del rol
                this.user.role.privileges[rolePrivilegeIndex] = { ...privilege };
            }
        }
    }

    isAllSelected(privilege: Privilege | undefined): boolean {
        return this.privilegeService.isAllSelected(privilege);
    }

    toggleAllModulesPrivileges(): void {
        if (this.user.role) {
            this.user.role = this.privilegeService.toggleAllModulesPrivileges(this.user.role);
        }
    }

    isAllModulesSelected(): boolean {
        return this.privilegeService.isAllModulesSelected(this.user.role);
    }

    onSubmit() {
        // Validar privilegios antes de proceder
        if (this.userInput && !this.canUpdateUsers()) {
            this.messageService.add({
                severity: 'error',
                summary: this.translate.instant('management.users.no_update_permission'),
                detail: this.translate.instant('management.users.contact_admin')
            });
            return;
        }

        if (!this.userInput && !this.canCreateUsers()) {
            this.messageService.add({
                severity: 'error',
                summary: this.translate.instant('management.users.no_create_permission'),
                detail: this.translate.instant('management.users.contact_admin')
            });
            return;
        }

        if (!this.user.role || !this.user.role._id) {
            this.messageService.add({
                severity: 'error',
                summary: this.translate.instant('management.userForm.error'),
                detail: this.translate.instant('management.userForm.roleRequired'),
                life: 3000
            });
            return;
        }

        const sanitizedPassword = this.sanitizeString(this.user.password);
        const sanitizedConfirmPassword = this.sanitizeString(this.confirmPassword);
        this.user.password = sanitizedPassword;
        this.confirmPassword = sanitizedConfirmPassword;

        // Validar contraseñas solo si se está creando un nuevo usuario o si se ha ingresado una contraseña
        if (!this.userInput) {
            if (!sanitizedPassword || !sanitizedConfirmPassword) {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translate.instant('management.userForm.error'),
                    detail: this.translate.instant('management.userForm.passwordRequired'),
                    life: 3000
                });
                return;
            }
            if (sanitizedPassword !== sanitizedConfirmPassword) {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translate.instant('management.userForm.error'),
                    detail: this.translate.instant('management.userForm.passwordsDoNotMatch'),
                    life: 3000
                });
                return;
            }
        } else if (sanitizedPassword && sanitizedPassword !== sanitizedConfirmPassword) {
            this.messageService.add({
                severity: 'error',
                summary: this.translate.instant('management.userForm.error'),
                detail: this.translate.instant('management.userForm.passwordsDoNotMatch'),
                life: 3000
            });
            return;
        }

        const parentId = this.route.snapshot.params['user'];

        this.user.affiliation_type_id = this.selectedAffiliationType;
        this.user.profile_type_id = this.selectedProfileType;
        this.user.settings.affiliation_type = this.selectedAffiliationType;
        this.user.settings.profile_type = this.selectedProfileType;
        this.user.settings.company_type = this.selectedCompanyType;

        // Asegurar que settings sea un objeto, no array
        const settingsObject = {
            ...this.user.settings,
            profile_type: this.selectedProfileType,
            affiliation_type: this.selectedAffiliationType,
            company_type: this.selectedCompanyType
        };

        // Asegurar que los privilegios modificados se incluyan en el envío
        const privileges = Array.isArray(this.user.privileges)
            ? this.user.privileges
            : (this.user.role?.privileges || []);

        const userToSubmit = {
            ...this.user,
            role: this.user.role._id,
            access_level_id: this.user.role._id,
            privileges: privileges,
            settings: [settingsObject], // Mantener como array pero con el objeto actualizado
            affiliation_type_id: this.selectedAffiliationType,
            profile_type_id: this.selectedProfileType,
            company_type_id: this.selectedCompanyType,
            // Enviar también en nivel raíz por si el backend lo espera ahí
            profile_type: this.selectedProfileType,
            department_id: this.user.department_id || this.userInput?.department_id || undefined,
            parent_id: parentId,
            // Campos de ubicación para todos y servicios para técnicos
            province: this.selectedProvince || undefined,
            municipality: this.selectedMunicipality || undefined,
            sector: this.user.sector || undefined,
            static_location_url: this.user.static_location_url || undefined,
            static_location_address: this.user.static_location_address || undefined,
            static_latitude: this.toOptionalNumber(this.user.static_latitude),
            static_longitude: this.toOptionalNumber(this.user.static_longitude),
            services: this.selectedAffiliationType?.startsWith('tecnico') ? (this.technicianServices || []) : [],
            // Correo del cliente principal para subclientes
            subclient_parent_email: this.selectedAffiliationType === 'subcliente' ? (this.subclienteParentEmail || undefined) : undefined
        };
        delete (userToSubmit as any).latitude;
        delete (userToSubmit as any).longitude;
        delete (userToSubmit as any).locationAccuracy;
        delete (userToSubmit as any).locationUpdatedAt;
        delete (userToSubmit as any).realtime_location;
        // La ubicación fija de usuarios existentes se guarda por su endpoint
        // dedicado para no mezclarla con la ubicación realtime protegida.
        if (this.userInput) {
            delete (userToSubmit as any).static_location_url;
            delete (userToSubmit as any).static_location_address;
            delete (userToSubmit as any).static_latitude;
            delete (userToSubmit as any).static_longitude;
        }
        const normalizedUserPayload = this.normalizeUserPayload(userToSubmit);


        if (this.userInput) {
            // Actualizar usuario existente
            const updateUserDto: any = {
                ...normalizedUserPayload,
                password: normalizedUserPayload.password || undefined
            };

            // Las cuentas antiguas pueden tener identificadores internos como
            // `replica_...`. Si no fueron editados, no deben normalizarse ni
            // reenviarse: hacerlo puede convertirlos en el DNI de otra cuenta y
            // provocar un conflicto falso al guardar cualquier otro campo.
            if (this.normalizeEmail(this.user.email) === this.normalizeEmail(this.userInput.email)) {
                delete updateUserDto.email;
            }
            if (this.sanitizeString(this.user.dni) === this.sanitizeString(this.userInput.dni)) {
                delete updateUserDto.dni;
            }
            if (!updateUserDto.password) {
                delete updateUserDto.password;
            }

            const originalRoleId = String(this.userInput.access_level_id?._id || '');
            const selectedRoleId = String(this.user.role?._id || '');
            if (
                originalRoleId === selectedRoleId &&
                this.arePrivilegesEqual(privileges, this.userInput.privileges)
            ) {
                // No es una asignación de permisos; omitirlos evita que una
                // edición de datos personales intente conceder nuevamente
                // privilegios que el empleado no está modificando.
                delete updateUserDto.privileges;
            }

            this.userService.update(this.userInput._id, updateUserDto)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                    next: (response) => {
                        this.messageService.add({
                            severity: 'success',
                            summary: this.translate.instant('management.userForm.success'),
                            detail: this.translate.instant('management.userForm.userUpdated'),
                            life: 3000
                        });
                        this.userCreated.emit(response);
                        this.resetForm();
                    },
                    error: (error) => {
                        this.messageService.add({
                            severity: 'error',
                            summary: this.translate.instant('management.userForm.error'),
                            detail: getApiErrorMessage(
                                error,
                                this.translate.instant('management.userForm.updateFailed')
                            ),
                            life: 3000
                        });
                        console.error('Error al actualizar usuario:', error);
                    }
                });
        } else {
            // Crear nuevo usuario
            const createUserDto: any = {
                ...normalizedUserPayload,
                password: normalizedUserPayload.password || ''
            };
            this.userService.create(createUserDto)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                    next: (response) => {
                        this.messageService.add({
                            severity: 'success',
                            summary: this.translate.instant('management.userForm.success'),
                            detail: this.translate.instant('management.userForm.userCreated'),
                            life: 3000
                        });
                        this.userCreated.emit(response);
                        this.resetForm();
                    },
                    error: (error) => {
                        this.messageService.add({
                            severity: 'error',
                            summary: this.translate.instant('management.userForm.error'),
                            detail: this.translate.instant('management.userForm.creationFailed'),
                            life: 3000
                        });
                        console.error('Error al crear usuario:', error);
                    }
                });
        }
    }

    displaySessionsModal: boolean = false;

    openSessionsModal() {
        this.displaySessionsModal = true;
    }

    deleteSession(sessionDate: string) {
        if (!this.userInput || !this.userInput._id) return;

        // Validar privilegios antes de proceder
        if (!this.canUpdateUsers()) {
            this.messageService.add({
                severity: 'error',
                summary: this.translate.instant('management.users.no_update_permission'),
                detail: this.translate.instant('management.users.contact_admin')
            });
            return;
        }

        this.userService.deleteSession(this.userInput._id, sessionDate)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (res) => {
                    if (this.userInput) {
                        (this.userInput as any).idSessions = ((this.userInput as any).idSessions || []).filter((s: any) => {
                            const sDate = new Date(s.date).toISOString();
                            const checkDate = new Date(sessionDate).toISOString();
                            return sDate !== checkDate;
                        });
                    }
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Sesión Cerrada',
                        detail: res.message || 'La sesión seleccionada ha sido cerrada.',
                        life: 3000
                    });
                },
                error: (error) => {
                    this.messageService.add({
                        severity: 'error',
                        summary: this.translate.instant('management.userForm.error'),
                        detail: getApiErrorMessage(error, 'Error al cerrar la sesión del usuario.'),
                        life: 3000
                    });
                    console.error('Error al cerrar sesión:', error);
                }
            });
    }

    onRoleChange() {
        if (!this.user.role) {
            return;
        }

        // Buscar el role original en el array de roles
        const originalRole = this.roles.find(r => r._id === this.user.role?._id);
        if (originalRole) {
            // Mantener la referencia al objeto original del array roles
            this.user.role = originalRole;

            // Limpiar los privilegios personalizados del usuario SOLO si no estamos inicializando el formulario de edición
            if (!this.isInitializingEditForm) {
                this.user.privileges = undefined;
            }
        }
    }

    onSaveSettings() {

    }

    getSettingValue(key: keyof UserSettings): string | boolean | undefined {
        return this.user.settings[key];
    }

    updateSettingValue(key: keyof UserSettings, value: string | boolean): void {
        if (typeof value === 'string' || typeof value === 'boolean') {
            this.user.settings[key] = value;
        }
        // Cuando cambia la afiliación, si es técnico mostrar sección y resetear selects
        if (key === 'affiliation_type' && typeof value === 'string') {
            const isTech = value === 'tecnico_empleado' || value === 'tecnico_independiente';
            if (!isTech) {
                this.selectedProvince = '';
                this.selectedMunicipality = '';
                this.municipalities = MUNICIPALITIES[''];
                this.technicianServices = [];
            }
            // Fetch parent email when subcliente is selected
            if (value === 'subcliente') {
                const parentId = this.route.snapshot.params['user'] || (this.userInput as any)?.parent_id;
                if (parentId) {
                    this.fetchParentEmail(parentId);
                } else {
                    this.subclienteParentEmail = '';
                }
            } else {
                this.subclienteParentEmail = '';
            }
        }

        // Resetear company_type si el perfil ya no es empresa
        if (key === 'profile_type' && typeof value === 'string') {
            if (value !== 'empresa') {
                this.selectedCompanyType = '';
            }
        }
    }

    private fetchParentEmail(parentId: string) {
        this.userService.getById(parentId).pipe(takeUntil(this.destroy$)).subscribe({
            next: (parentUser: any) => {
                this.subclienteParentEmail = parentUser?.email || '';
            },
            error: () => {
                this.subclienteParentEmail = '';
            }
        });
    }

    private sanitizeString(value?: string | null): string {
        return typeof value === 'string' ? value.trim() : '';
    }

    private sanitizeOptionalString(value?: string | null): string | undefined {
        const sanitized = this.sanitizeString(value);
        return sanitized || undefined;
    }

    private sanitizePhone(value?: string | null): string | undefined {
        const sanitized = this.sanitizeString(value);
        return sanitized || undefined;
    }

    private sanitizeNumeric(value?: string | null): string {
        if (!value) return '';
        return String(value).replace(/\D/g, '');
    }

    private normalizeIdentifier(value?: string | null): string {
        return this.sanitizeString(value).toLowerCase();
    }

    private normalizeEmail(value?: string | null): string {
        return this.normalizeIdentifier(value);
    }

    private arePrivilegesEqual(current: any, original: any): boolean {
        const normalize = (value: any) => (Array.isArray(value) ? value : [])
            .map((privilege: any) => ({
                module: String(privilege?.module || ''),
                actions: {
                    read: privilege?.actions?.read === true,
                    create: privilege?.actions?.create === true,
                    update: privilege?.actions?.update === true,
                    delete: privilege?.actions?.delete === true
                }
            }))
            .sort((left: any, right: any) => left.module.localeCompare(right.module));

        return JSON.stringify(normalize(current)) === JSON.stringify(normalize(original));
    }

    private normalizeUserPayload(payload: any): any {
        const sanitized: any = { ...payload };

        sanitized.email = this.normalizeEmail(payload.email);
        sanitized.name = this.sanitizeString(payload.name);
        sanitized.last_name = this.sanitizeString(payload.last_name);
        sanitized.dni = this.sanitizeNumeric(payload.dni);
        sanitized.address = this.sanitizeOptionalString(payload.address);
        sanitized.birth = this.sanitizeOptionalString(payload.birth);
        sanitized.photo = this.sanitizeOptionalString(payload.photo);
        sanitized.phone = this.sanitizePhone(payload.phone);
        sanitized.phone2 = this.sanitizePhone(payload.phone2);
        sanitized.parent_id = this.sanitizeOptionalString(payload.parent_id);
        sanitized.hashdRt = this.sanitizeString(payload.hashdRt);
        sanitized.creator_id = this.sanitizeOptionalString(payload.creator_id);
        sanitized.access_level_id = this.sanitizeString(payload.access_level_id);
        sanitized.role = this.sanitizeString(payload.role);
        sanitized.profile_type = this.normalizeIdentifier(payload.profile_type);
        sanitized.profile_type_id = this.normalizeIdentifier(payload.profile_type_id);
        sanitized.company_type_id = this.normalizeIdentifier(payload.company_type_id);
        sanitized.affiliation_type_id = this.normalizeIdentifier(payload.affiliation_type_id);
        sanitized.department_id = this.sanitizeString(payload.department_id);
        sanitized.province = this.sanitizeOptionalString(payload.province);
        sanitized.municipality = this.sanitizeOptionalString(payload.municipality);
        sanitized.static_location_url = this.sanitizeOptionalString(payload.static_location_url);
        sanitized.static_location_address = this.sanitizeOptionalString(payload.static_location_address);
        sanitized.static_latitude = this.toOptionalNumber(payload.static_latitude);
        sanitized.static_longitude = this.toOptionalNumber(payload.static_longitude);
        sanitized.password = typeof payload.password === 'string' ? this.sanitizeString(payload.password) : payload.password;

        sanitized.services = Array.isArray(payload.services)
            ? payload.services.map((service: string) => this.normalizeIdentifier(service))
            : payload.services;

        sanitized.settings = Array.isArray(payload.settings)
            ? payload.settings.map((setting: any) => ({
                ...setting,
                theme: this.sanitizeString(setting.theme),
                language: this.normalizeIdentifier(setting.language),
                affiliation_type: this.normalizeIdentifier(setting.affiliation_type),
                profile_type: this.normalizeIdentifier(setting.profile_type),
                company_type: this.normalizeIdentifier(setting.company_type),
                notifications: !!setting.notifications
            }))
            : payload.settings;

        return sanitized;
    }



    private formatDateToInput(dateStr: string): string {
        if (!dateStr) return '';
        // Si ya viene en formato YYYY-MM-DD, devolver tal cual para evitar desfases
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return dateStr;
        }
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '';
        return date.toISOString().slice(0, 10);
    }

    getProfileDescription(): string {
        switch (this.selectedProfileType) {
            case 'compartido':
                return 'management.userForm.profileDescriptions.compartido';
            case 'empresa':
                return 'management.userForm.profileDescriptions.empresa';
            case 'personal':
                return 'management.userForm.profileDescriptions.personal';
            default:
                return 'management.userForm.profileDescription';
        }
    }

    /**
     * Determina si el campo tipo de perfil debe estar desactivado
     * Se desactiva si el perfil es 'compartido' y el usuario logueado no tiene root=true
     */
    isProfileTypeDisabled(): boolean {
        // Si el perfil seleccionado es 'compartido'
        if (this.selectedProfileType === 'compartido') {
            // Obtener el usuario logueado
            const loggedUser = this.authService.getCurrentUser();

            // Si no hay usuario logueado, deshabilitar por seguridad
            if (!loggedUser) {
                return true;
            }

            // Verificar si el usuario logueado tiene la propiedad root=true
            // Si no tiene root=true, deshabilitar el campo
            return !loggedUser.root;
        }

        // Si no es perfil compartido, permitir edición normal
        return false;
    }

    /**
     * Obtiene los tipos de perfil disponibles según los permisos del usuario logueado
     * Solo muestra 'compartido' si el usuario tiene root=true
     */
    getAvailableProfileTypes(): ProfileTypeOption[] {
        const loggedUser = this.authService.getCurrentUser();

        // Si no hay usuario logueado, filtrar 'compartido'
        if (!loggedUser) {
            return this.profileTypes.filter(type => type.value !== 'compartido');
        }

        // Verificar si tiene root=true (manejando tanto string como boolean)
        const userRoot = loggedUser.root as any; // Cast temporal para evitar error de TypeScript
        const hasRootPermission = userRoot === true || userRoot === "true";

        // Si no tiene permisos root, filtrar 'compartido'
        if (!hasRootPermission) {
            return this.profileTypes.filter(type => type.value !== 'compartido');
        }

        // Si tiene root=true, mostrar todos los tipos incluido 'compartido'
        return this.profileTypes;
    }

    ngOnDestroy() {
        this.destroyStaticCoordinatePickerMap();
        this.destroyStaticLocationPreviewMap();
        this.destroy$.next();
        this.destroy$.complete();
    }

    // Modal Map Logic
    onStaticLocationUrlChange(value: string): void {
        this.user.static_location_url = this.sanitizeOptionalString(value);
        const coordinates = this.extractCoordinatesFromGoogleMapsUrl(this.user.static_location_url || '');
        this.user.static_latitude = coordinates?.latitude;
        this.user.static_longitude = coordinates?.longitude;
        this.user.static_location_address = this.extractReadableLocationFromGoogleMapsUrl(this.user.static_location_url || '');
    }

    private extractCoordinatesFromGoogleMapsUrl(value: string): { latitude: number; longitude: number } | null {
        const url = String(value || '').trim();
        if (!url) return null;

        const patterns = [
            /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
            /[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
            /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (!match) continue;
            const latitude = Number(match[1]);
            const longitude = Number(match[2]);
            if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
                return { latitude, longitude };
            }
        }

        return null;
    }

    private extractReadableLocationFromGoogleMapsUrl(value: string): string {
        const url = String(value || '').trim();
        const placeMatch = url.match(/\/maps\/place\/([^/@?]+)/);
        if (!placeMatch?.[1]) return '';

        try {
            return decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')).trim();
        } catch {
            return placeMatch[1].replace(/\+/g, ' ').trim();
        }
    }

    private toOptionalNumber(value: any): number | undefined {
        const numberValue = Number(value);
        return Number.isFinite(numberValue) ? numberValue : undefined;
    }

    openLocationModal() {
        if (!this.isCurrentUserEmployee) {
            return;
        }

        if (this.userInput?._id) {
            this.loadStaticLocation(this.userInput._id, true);
            return;
        }

        this.prepareStaticLocationInputs();
        this.showLocationModal = true;
    }

    selectStaticLocationMethod(method: StaticLocationMethod): void {
        this.staticLocationMethod = method;
        if (method === 'search') {
            setTimeout(() => void this.initializeStaticLocationSearch());
        } else if (method === 'coordinates') {
            setTimeout(() => void this.initStaticCoordinatePickerMap());
        }
    }

    onStaticLocationModalShow(): void {
        if (this.staticLocationMethod === 'search') {
            setTimeout(() => {
                void this.initializeStaticLocationSearch();
                this.staticLocationSearchInput?.nativeElement?.focus();
            });
        } else if (this.staticLocationMethod === 'coordinates') {
            setTimeout(() => void this.initStaticCoordinatePickerMap());
        }
    }

    async initStaticCoordinatePickerMap(): Promise<void> {
        const mapElement = document.getElementById('staticCoordinatePickerMap');
        if (!mapElement) return;

        const latitude = this.toOptionalNumber(this.user.static_latitude);
        const longitude = this.toOptionalNumber(this.user.static_longitude);
        const hasCoordinates = latitude != null && longitude != null;
        const centerLat = hasCoordinates ? latitude : 18.7357;
        const centerLng = hasCoordinates ? longitude : -70.1627;

        this.destroyStaticCoordinatePickerMap();
        this.userLocationMap = MapUtils.createMap(
            'osm',
            mapElement,
            '',
            'light',
            centerLat,
            centerLng,
            hasCoordinates ? 17 : 8
        );

        if (hasCoordinates) {
            this.userLocationMarker = new maplibregl.Marker({ color: '#ef4444' })
                .setLngLat([centerLng, centerLat])
                .addTo(this.userLocationMap);
            this.userLocationMarker.getElement().title =
                this.user.static_location_address || 'Ubicación del cliente';
        }

        this.userLocationMap.on('click', (event: maplibregl.MapMouseEvent) => this.onMapClick(event));
    }

    openStaticLocationMapModal(): void {
        if (this.user.static_latitude == null || this.user.static_longitude == null) return;
        this.showStaticLocationMapModal = true;
    }

    async initStaticLocationPreviewMap(): Promise<void> {
        const latitude = this.toOptionalNumber(this.user.static_latitude);
        const longitude = this.toOptionalNumber(this.user.static_longitude);
        const mapElement = document.getElementById('staticLocationPreviewMap');
        if (
            latitude == null ||
            longitude == null ||
            !mapElement
        ) {
            return;
        }

        this.destroyStaticLocationPreviewMap();
        this.staticLocationPreviewMap = MapUtils.createMap(
            'osm',
            mapElement,
            '',
            'light',
            latitude,
            longitude,
            17
        );
        this.staticLocationPreviewMarker = new maplibregl.Marker({ color: '#ef4444' })
            .setLngLat([longitude, latitude])
            .addTo(this.staticLocationPreviewMap);
        this.staticLocationPreviewMarker.getElement().title =
            this.user.static_location_address || 'Ubicación del cliente';
    }

    private destroyStaticCoordinatePickerMap(): void {
        this.userLocationMarker?.remove?.();
        this.userLocationMarker = null;
        this.userLocationMap?.remove?.();
        this.userLocationMap = null;
    }

    private destroyStaticLocationPreviewMap(): void {
        this.staticLocationPreviewMarker?.remove?.();
        this.staticLocationPreviewMarker = null;
        this.staticLocationPreviewMap?.remove?.();
        this.staticLocationPreviewMap = null;
    }

    applyStaticCoordinates(): void {
        const latitude = Number(this.staticLatitudeInput);
        const longitude = Number(this.staticLongitudeInput);

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
        ) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Coordenadas inválidas',
                detail: 'La latitud debe estar entre -90 y 90, y la longitud entre -180 y 180.'
            });
            return;
        }

        this.setStaticLocationPoint(latitude, longitude, this.user.static_location_address || 'Ubicación por coordenadas');
        this.user.static_location_url = this.buildGoogleMapsLink(latitude, longitude);
        this.staticLocationGoogleMapsLink = this.user.static_location_url;
        this.reverseGeocodeStaticLocation(latitude, longitude);
    }

    saveStaticLocation(): void {
        if (!this.isCurrentUserEmployee) return;

        if (!this.userInput?._id) {
            this.showLocationModal = false;
            return;
        }

        this.savingStaticLocation = true;
        this.userService.updateStaticLocation(this.userInput._id, {
            static_location_url: this.sanitizeOptionalString(this.user.static_location_url) ?? null,
            static_location_address: this.sanitizeOptionalString(this.user.static_location_address) ?? null,
            static_latitude: this.toOptionalNumber(this.user.static_latitude) ?? null,
            static_longitude: this.toOptionalNumber(this.user.static_longitude) ?? null
        })
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (location) => {
                    this.assignStaticLocation(location);
                    this.savingStaticLocation = false;
                    this.showLocationModal = false;
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Ubicación guardada',
                        detail: 'La ubicación fija del cliente se actualizó correctamente.'
                    });
                },
                error: (error) => {
                    this.savingStaticLocation = false;
                    this.messageService.add({
                        severity: 'error',
                        summary: 'No se pudo guardar',
                        detail: error?.error?.message || 'No fue posible actualizar la ubicación del cliente.'
                    });
                }
            });
    }

    private loadStaticLocation(userId: string, openAfterLoad: boolean = false): void {
        if (!this.isCurrentUserEmployee || !userId) return;

        this.loadingStaticLocation = true;
        this.userService.getStaticLocation(userId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (location) => {
                    this.assignStaticLocation(location);
                    this.loadingStaticLocation = false;
                    if (openAfterLoad) {
                        this.showLocationModal = true;
                    }
                },
                error: (error) => {
                    this.loadingStaticLocation = false;
                    if (openAfterLoad) {
                        this.messageService.add({
                            severity: 'error',
                            summary: 'No se pudo cargar',
                            detail: error?.error?.message || 'No fue posible consultar la ubicación del cliente.'
                        });
                    }
                }
            });
    }

    private assignStaticLocation(location: {
        static_location_url?: string | null;
        static_location_address?: string | null;
        static_latitude?: number | null;
        static_longitude?: number | null;
    }): void {
        this.user.static_location_url = location.static_location_url || '';
        this.user.static_location_address = location.static_location_address || '';
        this.user.static_latitude = this.toOptionalNumber(location.static_latitude);
        this.user.static_longitude = this.toOptionalNumber(location.static_longitude);
        this.prepareStaticLocationInputs();
    }

    private prepareStaticLocationInputs(): void {
        this.staticLocationManualAddress = this.user.static_location_address || '';
        this.staticLocationGoogleMapsLink = this.user.static_location_url || '';
        this.staticLatitudeInput = this.toNullableNumber(this.user.static_latitude);
        this.staticLongitudeInput = this.toNullableNumber(this.user.static_longitude);
    }

    loadDynamicProvinces() {
        this.brandsService.getProvinces().then((data: any) => {
            this.availableProvinces = data.map((p: any) => ({ label: p.name, value: String(p.code) }));
        }).catch((err: any) => console.error('Error fetching provinces', err));
    }

    onProvinceChange() {
        if (!this.selectedProvince) {
            this.availableMunicipalities = [];
            this.availableSectors = [];
            this.selectedMunicipality = '';
            this.user.sector = '';
            return;
        }

        const paramProv = isNaN(Number(this.selectedProvince)) ? this.selectedProvince : this.selectedProvince;
        this.brandsService.getMunicipalities(paramProv).then((data: any) => {
            this.availableMunicipalities = data.map((m: any) => ({ label: m.name, value: String(m.code) }));
            if (!this.isProgrammaticProvinceSetting) {
                this.selectedMunicipality = '';
                this.user.sector = '';
                this.availableSectors = [];
                this.focusMapOnSelection('province');
            }
            this.isProgrammaticProvinceSetting = false;
        }).catch((err: any) => console.error('Error loading municipalities', err));
    }

    onMunicipalityChange() {
        if (!this.selectedMunicipality) {
            this.availableSectors = [];
            this.user.sector = '';
            return;
        }

        const paramProv = isNaN(Number(this.selectedProvince)) ? this.selectedProvince : this.selectedProvince;
        const paramMun = isNaN(Number(this.selectedMunicipality)) ? this.selectedMunicipality : this.selectedMunicipality;
        
        this.brandsService.getSectors(paramMun, paramProv).then((data: any) => {
            this.availableSectors = data.map((s: any) => ({ label: s.name, value: String(s.name) }));
            if (!this.isProgrammaticProvinceSetting) {
                this.focusMapOnSelection('municipality');
            }
        }).catch((err: any) => console.error('Error loading sectors', err));
    }

    onSectorChange() {
        if (!this.isProgrammaticProvinceSetting) {
            this.focusMapOnSelection('sector');
        }
    }

    private async initializeStaticLocationSearch(): Promise<void> {
        if (!this.isCurrentUserEmployee) return;

        try {
            const systemConfigsResponse = await this.systemService.getAll().toPromise();
            const systemConfigs = systemConfigsResponse?.[0];
            const MAP_API1_KEY = systemConfigs?.map_api1?.key;
            if (MAP_API1_KEY) {
                await MapUtils.loadMapScript('google', MAP_API1_KEY, systemConfigs?.map_api1?.url || 'https://maps.googleapis.com/maps/api/js');
                await this.ensureGooglePlacesLibrary();
            }
        } catch (e) {
            console.error('Error loading Google Maps API key via SystemService', e);
        }

        if (typeof google === 'undefined') return;
        this.setupStaticLocationAutocomplete();
    }

    private async ensureGooglePlacesLibrary(): Promise<void> {
        if (typeof google === 'undefined' || !google.maps) return;
        if (google.maps.places) return;
        if (typeof google.maps.importLibrary === 'function') {
            await google.maps.importLibrary('places');
        }
    }

    private setupStaticLocationAutocomplete(): void {
        if (typeof google === 'undefined' || !google.maps?.places) return;
        if (google.maps.places.AutocompleteService) {
            this.staticLocationAutocompleteService ??= new google.maps.places.AutocompleteService();
        }
        if (
            !this.staticLocationAutocompleteSessionToken &&
            google.maps.places.AutocompleteSessionToken
        ) {
            this.staticLocationAutocompleteSessionToken =
                new google.maps.places.AutocompleteSessionToken();
        }
    }

    onStaticLocationSearchInput(value: string): void {
        const query = String(value || '').trim();
        this.staticLocationSuggestions = [];
        this.staticLocationSearchAttempted = false;
        this.staticLocationSearchUnavailable = false;
        this.searchingStaticLocation = query.length >= 3;
        this.staticLocationSearchRequestId++;

        if (query.length < 3) {
            this.searchingStaticLocation = false;
            return;
        }

        this.staticLocationSearch$.next(query);
    }

    private async searchStaticLocationSuggestions(query: string): Promise<void> {
        const currentQuery = String(this.staticLocationManualAddress || '').trim();
        if (query !== currentQuery || query.length < 3) return;

        if (
            typeof google === 'undefined' ||
            !google.maps?.places ||
            (
                !google.maps.places.AutocompleteSuggestion?.fetchAutocompleteSuggestions &&
                !this.staticLocationAutocompleteService
            )
        ) {
            await this.initializeStaticLocationSearch();
        }

        const autocompleteSuggestion = google?.maps?.places?.AutocompleteSuggestion;
        if (
            !autocompleteSuggestion?.fetchAutocompleteSuggestions &&
            !this.staticLocationAutocompleteService
        ) {
            this.searchingStaticLocation = false;
            this.staticLocationSearchAttempted = true;
            this.staticLocationSearchUnavailable = true;
            this.cdr.detectChanges();
            return;
        }

        const requestId = ++this.staticLocationSearchRequestId;
        const request = {
            input: query,
            language: 'es',
            region: 'do',
            // Favorece resultados dominicanos sin excluir lugares de otros países.
            locationBias: {
                west: -72.2,
                south: 17.3,
                east: -68.0,
                north: 20.2
            },
            sessionToken: this.staticLocationAutocompleteSessionToken
        };

        if (autocompleteSuggestion?.fetchAutocompleteSuggestions) {
            try {
                const response = await autocompleteSuggestion.fetchAutocompleteSuggestions(request);
                if (
                    requestId !== this.staticLocationSearchRequestId ||
                    query !== String(this.staticLocationManualAddress || '').trim()
                ) {
                    return;
                }

                this.staticLocationSuggestions = (response?.suggestions || [])
                    .map((suggestion: any) => {
                        const prediction = suggestion.placePrediction;
                        const description = prediction?.text?.toString?.() || '';
                        return {
                            description,
                            placeId: prediction?.placeId || '',
                            mainText: prediction?.mainText?.toString?.() || description,
                            secondaryText: prediction?.secondaryText?.toString?.() || '',
                            placePrediction: prediction
                        };
                    })
                    .filter((suggestion: StaticLocationSuggestion) => suggestion.description && suggestion.placeId);
                this.searchingStaticLocation = false;
                this.staticLocationSearchAttempted = true;
                this.cdr.detectChanges();
                return;
            } catch (error) {
                console.warn('La API nueva de sugerencias no respondió; se usará la API compatible.', error);
            }
        }

        if (!this.staticLocationAutocompleteService) {
            this.searchingStaticLocation = false;
            this.staticLocationSearchAttempted = true;
            this.staticLocationSearchUnavailable = true;
            this.cdr.detectChanges();
            return;
        }

        this.staticLocationAutocompleteService.getPlacePredictions(request, (predictions: any[] | null, status: any) => {
            if (
                requestId !== this.staticLocationSearchRequestId ||
                query !== String(this.staticLocationManualAddress || '').trim()
            ) {
                return;
            }

            const okStatus = google.maps.places.PlacesServiceStatus?.OK || 'OK';
            const zeroResultsStatus =
                google.maps.places.PlacesServiceStatus?.ZERO_RESULTS || 'ZERO_RESULTS';
            const requestSucceeded = status === okStatus;
            this.staticLocationSuggestions = requestSucceeded && predictions
                ? predictions.map(prediction => ({
                    description: prediction.description,
                    placeId: prediction.place_id,
                    mainText: prediction.structured_formatting?.main_text || prediction.description,
                    secondaryText: prediction.structured_formatting?.secondary_text || ''
                }))
                : [];
            this.searchingStaticLocation = false;
            this.staticLocationSearchAttempted = true;
            this.staticLocationSearchUnavailable =
                !requestSucceeded && status !== zeroResultsStatus;
            this.cdr.detectChanges();
        });
    }

    async selectStaticLocationSuggestion(suggestion: StaticLocationSuggestion): Promise<void> {
        if (typeof google === 'undefined' || !suggestion?.placeId) return;

        this.staticLocationManualAddress = suggestion.description;
        this.staticLocationSuggestions = [];
        this.staticLocationSearchAttempted = false;
        this.staticLocationSearchUnavailable = false;
        this.searchingStaticLocation = true;
        this.staticLocationSearchRequestId++;

        if (suggestion.placePrediction?.toPlace) {
            try {
                const place = suggestion.placePrediction.toPlace();
                await place.fetchFields({
                    fields: ['formattedAddress', 'location']
                });
                if (place.location) {
                    const lat = place.location.lat();
                    const lng = place.location.lng();
                    const address = place.formattedAddress || suggestion.description;
                    this.setStaticLocationPoint(lat, lng, address);
                    const googleMapsUrl = this.buildGoogleMapsLink(lat, lng);
                    this.user.static_location_url = googleMapsUrl;
                    this.staticLocationGoogleMapsLink = googleMapsUrl;
                    this.finishStaticLocationSelection();
                    return;
                }
            } catch (error) {
                console.warn('No fue posible cargar el detalle moderno del lugar; se usará geocodificación.', error);
            }
        }

        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ placeId: suggestion.placeId }, (results: any[], status: any) => {
            if (status === 'OK' && results?.[0]?.geometry?.location) {
                const result = results[0];
                const lat = result.geometry.location.lat();
                const lng = result.geometry.location.lng();
                this.setStaticLocationPoint(lat, lng, suggestion.description || result.formatted_address);
                this.user.static_location_url = this.buildGoogleMapsLink(lat, lng);
                this.staticLocationGoogleMapsLink = this.user.static_location_url;
            } else {
                this.messageService.add({
                    severity: 'warn',
                    summary: 'Ubicación no disponible',
                    detail: 'No fue posible obtener las coordenadas de la ubicación seleccionada.'
                });
            }
            this.finishStaticLocationSelection();
        });
    }

    onStaticLocationSearchKeydown(event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            this.staticLocationSuggestions = [];
            return;
        }

        if (event.key === 'Enter' && this.staticLocationSuggestions.length) {
            event.preventDefault();
            void this.selectStaticLocationSuggestion(this.staticLocationSuggestions[0]);
        }
    }

    clearStaticLocationSearch(): void {
        this.staticLocationManualAddress = '';
        this.staticLocationSuggestions = [];
        this.staticLocationSearchAttempted = false;
        this.staticLocationSearchUnavailable = false;
        this.searchingStaticLocation = false;
        this.staticLocationSearchRequestId++;
        this.staticLocationSearchInput?.nativeElement?.focus();
    }

    private finishStaticLocationSelection(): void {
        this.searchingStaticLocation = false;
        this.staticLocationAutocompleteSessionToken = null;
        this.setupStaticLocationAutocomplete();
        this.cdr.detectChanges();
    }

    applyStaticManualAddress(): void {
        const address = String(this.staticLocationManualAddress || '').trim();
        if (!address) return;

        this.geocodeStaticLocation(address);
    }

    applyStaticGoogleMapsLink(): void {
        const link = this.sanitizeOptionalString(this.staticLocationGoogleMapsLink);
        if (!link) return;

        const coordinates = this.extractCoordinatesFromGoogleMapsUrl(link);
        const readableAddress = this.extractReadableLocationFromGoogleMapsUrl(link);
        if (coordinates) {
            this.user.static_location_url = link;
            this.setStaticLocationPoint(
                coordinates.latitude,
                coordinates.longitude,
                readableAddress || 'Ubicación desde Google Maps'
            );
            if (!readableAddress) {
                this.reverseGeocodeStaticLocation(coordinates.latitude, coordinates.longitude);
            }
            return;
        }

        this.resolvingStaticLocationLink = true;
        this.userService.resolveGoogleMapsLink(link)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (resolved) => {
                    this.resolvingStaticLocationLink = false;
                    this.user.static_location_url = resolved.resolved_url || link;
                    this.staticLocationGoogleMapsLink = this.user.static_location_url;
                    this.setStaticLocationPoint(
                        resolved.latitude,
                        resolved.longitude,
                        resolved.address || 'Ubicación desde Google Maps'
                    );
                    if (!resolved.address) {
                        this.reverseGeocodeStaticLocation(resolved.latitude, resolved.longitude);
                    }
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Enlace resuelto',
                        detail: 'Se obtuvieron correctamente las coordenadas del enlace acortado.'
                    });
                },
                error: (error) => {
                    this.resolvingStaticLocationLink = false;
                    this.messageService.add({
                        severity: 'warn',
                        summary: 'No se pudo resolver el enlace',
                        detail: error?.error?.message || 'El enlace no contiene coordenadas que puedan identificarse.'
                    });
                }
            });
    }

    clearStaticLocation(): void {
        this.user.static_location_url = '';
        this.user.static_location_address = '';
        this.user.static_latitude = undefined;
        this.user.static_longitude = undefined;
        this.staticLocationManualAddress = '';
        this.staticLocationGoogleMapsLink = '';
        this.staticLatitudeInput = null;
        this.staticLongitudeInput = null;
        this.staticLocationSuggestions = [];
        this.staticLocationSearchAttempted = false;
        this.staticLocationSearchUnavailable = false;
        this.searchingStaticLocation = false;
        this.staticLocationSearchRequestId++;
        if (this.staticLocationSearchInput?.nativeElement) {
            this.staticLocationSearchInput.nativeElement.value = '';
        }
        this.userLocationMarker?.remove?.();
        this.userLocationMarker = null;
    }

    private geocodeStaticLocation(address: string): void {
        if (typeof google === 'undefined') return;

        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: `${address}, República Dominicana` }, (results: any, status: any) => {
            if (status === 'OK' && results?.[0]) {
                const location = results[0].geometry.location;
                const lat = location.lat();
                const lng = location.lng();
                this.setStaticLocationPoint(lat, lng, results[0].formatted_address || address);
                this.user.static_location_url = this.buildGoogleMapsLink(lat, lng);
                this.staticLocationGoogleMapsLink = this.user.static_location_url;
            } else {
                this.messageService.add({
                    severity: 'warn',
                    summary: 'Dirección no encontrada',
                    detail: 'Intenta con una dirección más específica o selecciona el punto en el mapa.'
                });
            }
        });
    }

    geocodeLocation(address: string, zoomLevel: number) {
        if (!this.userLocationMap || typeof google === 'undefined') return;

        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: address + ', República Dominicana' }, (results: any, status: any) => {
            if (status === 'OK' && results && results[0]) {
                const location = results[0].geometry.location;
                // Move map
                this.userLocationMap.setCenter([location.lng(), location.lat()]);
                this.userLocationMap.setZoom(zoomLevel);
            } else {
                console.warn('Geocoding failed for: ', address, 'Status: ', status);
            }
        });
    }

    focusMapOnSelection(level: 'province' | 'municipality' | 'sector') {
        let address = '';
        let zoom = 12;

        const prov = this.availableProvinces.find((p: any) => p.value === String(this.selectedProvince));
        const mun = this.availableMunicipalities.find((m: any) => m.value === String(this.selectedMunicipality));

        switch (level) {
            case 'province':
                if (prov) address = prov.label;
                zoom = 10;
                break;
            case 'municipality':
                if (prov && mun) address = `${mun.label}, ${prov.label}`;
                zoom = 12;
                break;
            case 'sector':
                if (prov && mun && this.user.sector) address = `${this.user.sector}, ${mun.label}, ${prov.label}`;
                zoom = 15;
                break;
        }

        if (address) {
            this.geocodeLocation(address, zoom);
        }
    }

    onMapClick(event: any) {
        const lat = Number(event?.lngLat?.lat);
        const lng = Number(event?.lngLat?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        this.setStaticLocationPoint(
            lat,
            lng,
            this.user.static_location_address || 'Punto seleccionado en mapa',
            false
        );
        this.user.static_location_url = this.buildGoogleMapsLink(lat, lng);
        this.staticLocationGoogleMapsLink = this.user.static_location_url;
        this.reverseGeocodeStaticLocation(lat, lng);
    }

    private setStaticLocationPoint(lat: number, lng: number, address?: string, adjustZoom: boolean = true): void {
        this.user.static_latitude = Number(lat.toFixed(6));
        this.user.static_longitude = Number(lng.toFixed(6));
        this.staticLatitudeInput = this.user.static_latitude;
        this.staticLongitudeInput = this.user.static_longitude;
        if (address) {
            this.user.static_location_address = address;
            this.staticLocationManualAddress = address;
        }

        if (this.userLocationMap) {
            this.userLocationMap.setCenter([lng, lat]);
            if (adjustZoom) {
                this.userLocationMap.setZoom(17);
            }
        }
        if (this.userLocationMarker) {
            this.userLocationMarker.setLngLat([lng, lat]);
        } else if (this.userLocationMap) {
            this.userLocationMarker = new maplibregl.Marker({ color: '#ef4444' })
                .setLngLat([lng, lat])
                .addTo(this.userLocationMap);
        }
    }

    private async reverseGeocodeStaticLocation(lat: number, lng: number): Promise<void> {
        if (typeof google === 'undefined' || !google.maps?.Geocoder) {
            await this.initializeStaticLocationSearch();
        }
        if (typeof google === 'undefined' || !google.maps?.Geocoder) return;

        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
            if (status === 'OK' && results?.[0]?.formatted_address) {
                this.user.static_location_address = results[0].formatted_address;
                this.staticLocationManualAddress = results[0].formatted_address;
            }
        });
    }

    private buildGoogleMapsLink(lat: number, lng: number): string {
        return `https://www.google.com/maps?q=${lat},${lng}`;
    }

    private toNullableNumber(value: any): number | null {
        if (value === null || value === undefined || value === '') return null;
        const numberValue = Number(value);
        return Number.isFinite(numberValue) ? numberValue : null;
    }

    // ─── WhatsApp Messaging ─────────────────────────────────
    openWhatsApp() {
        if (!this.userInput || !this.getDefaultWhatsAppPhone()) return;
        this.waCheckingWindow = true;
        this.waSelectedPhone = this.getDefaultWhatsAppPhone();

        const phone = this.waSelectedPhone.replace(/[^0-9+]/g, '');

        // Single backend call that checks ALL conversations for this contact
        this.whatsappApi.check24hWindow(phone).subscribe({
            next: (res: any) => {
                this.waCheckingWindow = false;
                
                if (res.isOutside) {
                    // Outside 24h window → must use template
                    this.waConversationId = null;
                    this.openWaTemplateModal();
                } else {
                    // Inside 24h window → free text via conversation (same as communication module)
                    this.waConversationId = res.conversationId || null;
                    this.showWaFreeTextModal = true;
                    this.waFreeText = '';
                }
            },
            error: () => {
                this.waCheckingWindow = false;
                this.waConversationId = null;
                this.openWaTemplateModal();
            }
        });
    }

    getWhatsAppPhoneOptions(): { label: string; value: string }[] {
        const options = [
            { label: `WhatsApp principal: ${this.userInput?.phone || ''}`, value: this.userInput?.phone || '' },
            { label: `WhatsApp secundario: ${this.userInput?.phone2 || ''}`, value: this.userInput?.phone2 || '' },
        ].filter(option => !!String(option.value || '').trim());

        return options.filter((option, index, list) => (
            list.findIndex(item => this.normalizePhoneForCompare(item.value) === this.normalizePhoneForCompare(option.value)) === index
        ));
    }

    private getDefaultWhatsAppPhone(): string {
        return String(this.userInput?.phone || this.userInput?.phone2 || '').trim();
    }

    private getSelectedWhatsAppPhone(): string {
        return String(this.waSelectedPhone || this.getDefaultWhatsAppPhone()).trim();
    }

    private normalizePhoneForCompare(phone: string): string {
        return String(phone || '').replace(/\D/g, '');
    }

    private openWaTemplateModal() {
        const toTitleCase = (str: string) => str.replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
        const currentUser = this.authService.getCurrentUser();
        this.waTemplateVars.headerUser = toTitleCase(currentUser ? `${currentUser.name || ''} ${currentUser.last_name || ''}`.trim() : 'Asesor');
        this.waTemplateVars.name = toTitleCase(this.userInput ? `${this.userInput.name || ''} ${this.userInput.last_name || ''}`.trim() : '');
        this.waTemplateVars.body = '';

        const hour = new Date().getHours();
        if (hour < 12) this.waTemplateVars.bodySaludos = 'uenos días';
        else if (hour < 19) this.waTemplateVars.bodySaludos = 'uenas tardes';
        else this.waTemplateVars.bodySaludos = 'uenas noches';

        this.showWaTemplateModal = true;
    }

    sendWaTemplate() {
        const destinationPhone = this.getSelectedWhatsAppPhone();
        if (!destinationPhone) return;
        if (!String(this.waTemplateVars.body || '').trim()) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Mensaje requerido',
                detail: 'Escribe el mensaje antes de enviar la plantilla.'
            });
            return;
        }
        this.sendingWa = true;

        const directMessage = this.buildWaDirectMessage();
        const contactName = `${this.userInput?.name || ''} ${this.userInput?.last_name || ''}`.trim() || this.waTemplateVars.name;

        this.whatsappApi.sendWhatsAppText({
            phone: destinationPhone,
            message: directMessage,
            contact_name: contactName,
            agent_id: this.whatsappAgentId || undefined,
            conversation_id: this.waConversationId || undefined,
        }).subscribe({
            next: (res: any) => {
                if (res.success) {
                    this.sendingWa = false;
                    this.showWaTemplateModal = false;
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Enviado',
                        detail: `Mensaje WhatsApp enviado a ${destinationPhone}.`
                    });
                    return;
                }

                this.sendWaTemplateFallback(destinationPhone, res?.error);
            },
            error: (error) => {
                this.sendWaTemplateFallback(
                    destinationPhone,
                    error?.error?.message || error?.error?.error || 'No se pudo enviar texto directo'
                );
            }
        });
    }

    private buildWaDirectMessage(): string {
        return [
            `${this.waTemplateVars.headerUser || 'Asesor'}:`,
            `B${this.waTemplateVars.bodySaludos || 'uenas'}, ${this.waTemplateVars.name}.`,
            this.waTemplateVars.body,
            '',
            'Seguimos a tu orden por este número.',
            'Montao GPS',
        ].join('\n').trim();
    }

    private sendWaTemplateFallback(destinationPhone: string, directError?: string): void {
        this.whatsappApi.sendWhatsAppTemplateToUser({
            phone: destinationPhone,
            template_name: 'simple',
            variables: [
                this.waTemplateVars.headerUser,
                this.waTemplateVars.bodySaludos,
                this.waTemplateVars.name,
                this.waTemplateVars.body
            ],
            agent_id: this.whatsappAgentId || undefined,
            conversation_id: this.waConversationId || undefined,
        }).subscribe({
            next: (res: any) => {
                this.sendingWa = false;
                if (res.success) {
                    this.showWaTemplateModal = false;
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Enviado',
                        detail: `Meta aceptó la plantilla para ${destinationPhone}.`
                    });
                } else {
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: res?.error || directError || 'No se pudo enviar la plantilla.'
                    });
                }
            },
            error: (error) => {
                this.sendingWa = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: error?.error?.message || error?.error?.error || directError || 'Error de red al enviar plantilla.'
                });
            }
        });
    }

    sendWaFreeText() {
        const destinationPhone = this.getSelectedWhatsAppPhone();
        if (!destinationPhone || !this.waFreeText.trim()) return;
        this.sendingWa = true;

        const currentUser = this.authService.getCurrentUser();
        const agentName = currentUser ? `${currentUser.name || ''} ${currentUser.last_name || ''}`.trim() : 'Asesor';
        const finalMessage = `> ${agentName}\n${this.waFreeText.trim()}`;

        if (this.waConversationId) {
            // Send via existing conversation (same approach as communication module)
            this.whatsappApi.sendConversationMessage(
                this.waConversationId,
                finalMessage,
                undefined,
                undefined,
                this.whatsappAgentId || undefined
            ).subscribe({
                next: (res: any) => {
                    this.sendingWa = false;
                    if (res.success) {
                        this.showWaFreeTextModal = false;
                        this.waFreeText = '';
                        this.messageService.add({ severity: 'success', summary: 'Enviado', detail: 'Mensaje WhatsApp enviado.' });
                    } else {
                        this.messageService.add({
                            severity: 'error',
                            summary: 'Error',
                            detail: getApiErrorMessage(res, 'No se pudo enviar el mensaje'),
                        });
                    }
                },
                error: (error) => {
                    this.sendingWa = false;
                    this.messageService.add({ severity: 'error', summary: 'Error', detail: getApiErrorMessage(error, 'Error de red al enviar mensaje.') });
                }
            });
        } else {
            // Fallback: send via Meta API
            this.whatsappApi.sendWhatsAppText({
                phone: destinationPhone,
                message: this.waFreeText.trim(),
                contact_name: `${this.userInput?.name || ''} ${this.userInput?.last_name || ''}`.trim(),
                agent_id: this.whatsappAgentId || undefined,
                conversation_id: this.waConversationId || undefined,
            }).subscribe({
                next: (res: any) => {
                    this.sendingWa = false;
                    if (res.success) {
                        this.showWaFreeTextModal = false;
                        this.waFreeText = '';
                        this.messageService.add({ severity: 'success', summary: 'Enviado', detail: 'Mensaje WhatsApp enviado.' });
                    } else {
                        this.messageService.add({
                            severity: 'error',
                            summary: 'Error',
                            detail: getApiErrorMessage(res, 'No se pudo enviar el mensaje'),
                        });
                    }
                },
                error: (error) => {
                    this.sendingWa = false;
                    this.messageService.add({ severity: 'error', summary: 'Error', detail: getApiErrorMessage(error, 'Error de red al enviar mensaje.') });
                }
            });
        }
    }
}
