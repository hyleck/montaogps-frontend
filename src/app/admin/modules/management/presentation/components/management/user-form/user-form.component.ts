import { Component, OnInit, Output, EventEmitter, Input, SimpleChanges, OnChanges, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UserRole, Privilege, PrivilegeAction } from '@core/interfaces/user-role.interface';
import { ExtendedUser, UserSettings } from '@core/interfaces/user.interface';
import { TranslateService } from '@ngx-translate/core';

import { UserRolesService } from '@core/services/user-roles.service';
import { MessageService } from 'primeng/api';
import { UserService } from '@core/services/user.service';
import { AuthService } from '@core/services/auth.service';
import { PrivilegeService } from './services/privilege.service';
import { Subject, takeUntil } from 'rxjs';
import { VehicleBrandsService } from 'src/app/core/services/vehicle-brands.service';

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
    ServiceOption
} from './constants/user-form.constants';

@Component({
    selector: 'app-user-form',
    templateUrl: './user-form.component.html',
    styleUrls: USER_FORM_STYLES,
    standalone: false
})
export class UserFormComponent implements OnInit, OnChanges, OnDestroy {
    private destroy$ = new Subject<void>();

    @Input() userInput: ExtendedUser | null = null;
    @Output() userCreated = new EventEmitter<void>();

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

    // Propiedades intermedias para el enlace de datos
    selectedTheme: string = this.getSettingValue('theme') as string;
    selectedLanguage: string = this.getSettingValue('language') as string;
    notificationsEnabled: boolean = this.getSettingValue('notifications') as boolean;

    selectedAffiliationType: string = '';
    selectedProfileType: string = '';
    // Campos para técnicos
    provinces: ProvinceOption[] = PROVINCES;
    municipalities: MunicipalityOption[] = MUNICIPALITIES[''];
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

    // Agregamos una nueva propiedad para controlar si estamos inicializando el formulario de edición
    private isInitializingEditForm: boolean = false;

    @ViewChild('municipalitySelect') municipalitySelectRef?: ElementRef<HTMLSelectElement>;

    constructor(
        private userRolesService: UserRolesService,
        private translate: TranslateService,
        private messageService: MessageService,
        private userService: UserService,
        private authService: AuthService,
        private route: ActivatedRoute,
        private privilegeService: PrivilegeService,
        private brandsService: VehicleBrandsService,
        private cdr: ChangeDetectorRef
    ) {}

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
        this.loadRoles();
        this.user = this.getEmptyUser();
        this.selectedTheme = 'light';
        this.selectedLanguage = 'es';
        this.notificationsEnabled = true;
        this.selectedAffiliationType = 'cliente';
        this.selectedProfileType = 'personal';
        this.confirmPassword = '';
        this.user.password = '';
        this.activeTabIndex = 0;

        // Cargar provincias desde API real (usa el mismo backend de marcas/modelos)
        this.brandsService.getProvinces()
            .then(list => {
                this.provinces = [{ label: this.translate.instant('management.userForm.selectAffiliation'), value: '' }, ...list.map((p: any) => ({ label: p.name, value: String(p.code) }))];
            })
            .catch(() => {});
    }

    private resetForm() {
        this.user = this.getEmptyUser();
        this.selectedTheme = 'light';
        this.selectedLanguage = 'es';
        this.notificationsEnabled = true;
        this.selectedAffiliationType = 'cliente';
        this.selectedProfileType = 'personal';
        this.confirmPassword = '';
        this.user.password = '';
        this.activeTabIndex = 0;
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

    private setupEditUser(user: ExtendedUser) {
        console.log(user,'holaaaaa4')
        // Rellenar el formulario con los datos del usuario a editar
        this.user = JSON.parse(JSON.stringify(user));
        this.user.birth = this.formatDateToInput(user.birth);
        this.selectedTheme = this.user.settings?.theme || 'light';
        this.selectedLanguage = this.user.settings?.language || 'es';
        this.notificationsEnabled = this.user.settings?.notifications ?? true;
        
        // Asignamos explícitamente los valores para el tipo de afiliación y perfil
        this.selectedAffiliationType = user.affiliation_type_id || 'cliente';
        this.selectedProfileType = user.profile_type_id || 'personal';
        
        // Forzar detección de cambios
        this.cdr.detectChanges();
        


        // Detectar si debe considerarse técnico por datos existentes aunque la afiliación venga como 'cliente'
        const backendProvince = (user as any).province || '';
        const backendMunicipality = (user as any).municipality || '';
        const backendServices = (user as any).services;
        // const hasTechSignals = (!!backendProvince || !!backendMunicipality || (Array.isArray(backendServices) && backendServices.length > 0));
        // if (!this.selectedAffiliationType?.startsWith('tecnico') && hasTechSignals) {
        //     this.selectedAffiliationType = 'tecnico_independiente';
        // }

        // Precargar datos de técnico si aplican
        const isTech = this.selectedAffiliationType?.startsWith('tecnico');
        if (isTech) {
            // Provincia y municipio desde backend
            this.isProgrammaticProvinceSetting = true;
            this.pendingMunicipality = backendMunicipality;
            this.selectedProvince = backendProvince;
            // Disparar carga de municipios de forma programática
            if (this.selectedProvince) {
                // Ejecutar onProvinceChange y reafirmar el valor tras render
                this.onProvinceChange();
                const pm = this.pendingMunicipality;
                setTimeout(() => {
                    if (pm) {
                        this.selectedMunicipality = pm;
                    }
                }, 0);
            }

            // Servicios desde backend (array de ids)
            this.technicianServices = Array.isArray(backendServices) ? backendServices.map((s: any) => String(s)) : [];
        } else {
            this.selectedProvince = '';
            this.selectedMunicipality = '';
            this.municipalities = MUNICIPALITIES[''];
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
                this.user.privileges[userPrivilegeIndex] = {...privilege};
                return; // Salimos para no actualizar también los privilegios del rol
            }
        }
        
        // Si llegamos aquí, actualizamos los privilegios del rol
        if (this.user.role && this.user.role.privileges) {
            const rolePrivilegeIndex = this.user.role.privileges.findIndex(p => p.module === privilege.module);
            if (rolePrivilegeIndex >= 0) {
                // Actualizar el privilegio del rol
                this.user.role.privileges[rolePrivilegeIndex] = {...privilege};
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

        const currentUser = this.authService.getCurrentUser();
        const parentId = this.route.snapshot.params['user'];
        
        this.user.affiliation_type_id = this.selectedAffiliationType;
        this.user.profile_type_id = this.selectedProfileType;
        this.user.settings.affiliation_type = this.selectedAffiliationType;
        this.user.settings.profile_type = this.selectedProfileType;
        
        // Asegurar que settings sea un objeto, no array
        const settingsObject = {
            ...this.user.settings,
            profile_type: this.selectedProfileType,
            affiliation_type: this.selectedAffiliationType
        };

        // Asegurar que los privilegios modificados se incluyan en el envío
        const privileges = this.user.role?.privileges || [];

        const userToSubmit = {
            ...this.user,
            role: this.user.role._id,
            access_level_id: this.user.role._id,
            hashdRt: 'exampleHashdRt',
            creator_id: currentUser ? currentUser.id : 'exampleCreatorId',
            privileges: privileges,
            settings: [settingsObject], // Mantener como array pero con el objeto actualizado
            affiliation_type_id: this.selectedAffiliationType,
            profile_type_id: this.selectedProfileType,
            // Enviar también en nivel raíz por si el backend lo espera ahí
            profile_type: this.selectedProfileType,
            department_id: 'exampleDepartmentId',
            parent_id: parentId,
            // Campos de ubicación/servicios para técnicos
            province: this.selectedAffiliationType?.startsWith('tecnico') ? this.selectedProvince : undefined,
            municipality: this.selectedAffiliationType?.startsWith('tecnico') ? this.selectedMunicipality : undefined,
            services: this.selectedAffiliationType?.startsWith('tecnico') ? (this.technicianServices || []) : []
        };

        const normalizedUserPayload = this.normalizeUserPayload(userToSubmit);


        if (this.userInput) {
            // Actualizar usuario existente
            const updateUserDto: any = {
                ...normalizedUserPayload,
                password: normalizedUserPayload.password || undefined
            };
            
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
                        this.userCreated.emit();
                        this.resetForm();
                    },
                    error: (error) => {
                        this.messageService.add({
                            severity: 'error',
                            summary: this.translate.instant('management.userForm.error'),
                            detail: this.translate.instant('management.userForm.updateFailed'),
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
                        this.userCreated.emit();
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

    getSettingValue(key: keyof UserSettings): string | boolean {
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
        }
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

    private normalizeIdentifier(value?: string | null): string {
        return this.sanitizeString(value).toLowerCase();
    }

    private normalizeEmail(value?: string | null): string {
        return this.normalizeIdentifier(value);
    }

    private normalizeUserPayload(payload: any): any {
        const sanitized: any = { ...payload };

        sanitized.email = this.normalizeEmail(payload.email);
        sanitized.name = this.sanitizeString(payload.name);
        sanitized.last_name = this.sanitizeString(payload.last_name);
        sanitized.dni = this.sanitizeString(payload.dni);
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
        sanitized.affiliation_type_id = this.normalizeIdentifier(payload.affiliation_type_id);
        sanitized.department_id = this.sanitizeString(payload.department_id);
        sanitized.province = this.sanitizeOptionalString(payload.province);
        sanitized.municipality = this.sanitizeOptionalString(payload.municipality);
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
                notifications: !!setting.notifications
            }))
            : payload.settings;

        return sanitized;
    }

    onProvinceChange(): void {
        // Logs de depuración removidos
        if (!this.selectedProvince) {
            this.municipalities = MUNICIPALITIES[''];
            this.selectedMunicipality = '';
            this.isProgrammaticProvinceSetting = false;
            this.pendingMunicipality = '';
            return;
        }
        const pending = String(this.pendingMunicipality || '');
        this.brandsService.getMunicipalities(this.selectedProvince)
            .then(list => {
                const opts = list.map((m: any) => ({ label: m.name, value: String(m.code), raw: m }));
                this.municipalities = [{ label: this.translate.instant('management.userForm.selectAffiliation'), value: '' }, ...opts.map(o => ({ label: o.label, value: o.value }))];
                if (this.isProgrammaticProvinceSetting && pending) {
                    // 1) Exact match
                    let match = opts.find(o => o.value === pending)?.value;
                    // 2) Try province+pending padded (e.g., '05' + '05' => '0505' or '0501')
                    if (!match) {
                        const candidate1 = `${this.selectedProvince}${pending.padStart(2,'0')}`;
                        match = opts.find(o => o.value === candidate1)?.value;
                    }
                    // 3) startsWith province and endsWith pending (e.g., '0501' ends with '01')
                    if (!match) {
                        match = opts.find(o => o.value.startsWith(String(this.selectedProvince)) && o.value.endsWith(pending))?.value;
                    }
                    // 3.1) endsWith last two digits of pending (robusto en códigos largos)
                    if (!match) {
                        const pending2 = pending.padStart(2,'0');
                        match = opts.find(o => o.value.slice(-2) === pending2)?.value;
                    }
                    // 4) label contains pending (fallback)
                    if (!match) {
                        match = opts.find(o => String(o.label).toLowerCase().includes(pending.toLowerCase()))?.value;
                    }
                    // Forzar set en microtask para asegurar actualización en el DOM de select
                    const valueToSet = match || '';
                    this.selectedMunicipality = valueToSet;
                    this.cdr.detectChanges();
                    Promise.resolve().then(() => {
                        this.selectedMunicipality = valueToSet;
                        this.cdr.detectChanges();
                        // Refuerzo: setear directamente el valor del select del DOM si existe
                        setTimeout(() => {
                            const el = this.municipalitySelectRef?.nativeElement;
                            if (el) {
                                el.value = valueToSet;
                            }
                        }, 0);
                    });
                } else {
                    this.selectedMunicipality = '';
                }
                // Logs de depuración removidos
            })
            .catch(() => {
                this.municipalities = MUNICIPALITIES[''];
                this.selectedMunicipality = '';
            })
            .finally(() => {
                this.isProgrammaticProvinceSetting = false;
                this.pendingMunicipality = '';
            });
    }

    private formatDateToInput(dateStr: string): string {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '';
        // Ajuste para zona horaria si es necesario
        const offset = date.getTimezoneOffset();
        date.setMinutes(date.getMinutes() - offset);
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
        this.destroy$.next();
        this.destroy$.complete();
    }
}
