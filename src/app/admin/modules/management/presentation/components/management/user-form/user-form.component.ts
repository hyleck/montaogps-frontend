import { Component, OnInit, Output, EventEmitter, Input, SimpleChanges, OnChanges, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UserRole, Privilege, PrivilegeAction } from '../../../../../../../core/interfaces/user-role.interface';
import { User, ExtendedUser, UserSettings } from '../../../../../../../core/interfaces/user.interface';
import { 
    AVAILABLE_MODULES, 
    MODULE_ICONS, 
    THEMES, 
    LANGUAGES, 
    PROFILE_TYPES, 
    AFFILIATION_TYPES,
    ModuleOption,
    ThemeOption,
    LanguageOption,
    ProfileTypeOption,
    AffiliationTypeOption
} from '../../../../../../../core/interfaces/user-form.constants';
import { UserRolesService } from '../../../../../../../core/services/user-roles.service';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { UserService } from '../../../../../../../core/services/user.service';
import { AuthService } from '../../../../../../../core/services/auth.service';
import { PrivilegeService } from './privilege.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'app-user-form',
    templateUrl: './user-form.component.html',
    styleUrls: ['./user-form.component.css'],
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

    selectedAffiliationType: string = this.user.affiliation_type_id;
    selectedProfileType: string = this.user.profile_type_id;

    confirmPassword: string = '';

    activeTabIndex: number = 0;

    constructor(
        private userRolesService: UserRolesService,
        private translate: TranslateService,
        private messageService: MessageService,
        private userService: UserService,
        private authService: AuthService,
        private route: ActivatedRoute,
        private privilegeService: PrivilegeService
    ) {}

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
            status: 'active',
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
                // Rellenar el formulario con los datos del usuario a editar
                this.user = JSON.parse(JSON.stringify(user));
                this.user.birth = this.formatDateToInput(user.birth);
                this.selectedTheme = this.user.settings?.theme || 'light';
                this.selectedLanguage = this.user.settings?.language || 'es';
                this.notificationsEnabled = this.user.settings?.notifications ?? true;
                this.selectedAffiliationType = this.user.affiliation_type_id;
                this.selectedProfileType = this.user.profile_type_id;
                this.confirmPassword = '';
                
                // Seleccionar el rol correcto de la lista de roles si existe
                if (this.user.access_level_id && this.user.access_level_id._id && this.roles && Array.isArray(this.roles)) {
                    const roleId = this.user.access_level_id._id;
                    const foundRole = this.roles.find(r => r._id === roleId);
                    if (foundRole) {
                        this.user.role = foundRole;
                    }
                }
                this.activeTabIndex = 0;
            } else {
                this.resetForm();
            }
        }
    }

    loadRoles() {
        this.userRolesService.getAllRoles()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (roles) => {
                    this.roles = roles;
                    if (!this.user.role) {
                        this.user.role = null;
                    } else if (this.user.access_level_id && this.user.access_level_id._id) {
                        const foundRole = this.roles.find(r => r._id === this.user.access_level_id._id);
                        if (foundRole) {
                            this.user.role = foundRole;
                        }
                    }
                },
                error: (error) => {
                    console.error('Error al cargar roles:', error);
                }
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
        if (privilege) {
            this.privilegeService.toggleAllPrivileges(privilege);
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
        if (!this.user.role || !this.user.role._id) {
            this.messageService.add({
                severity: 'error',
                summary: this.translate.instant('management.userForm.error'),
                detail: this.translate.instant('management.userForm.roleRequired'),
                life: 3000
            });
            return;
        }

        if (this.user.password !== this.confirmPassword) {
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

        const userToSubmit = {
            ...this.user,
            password: this.user.password || 'examplePassword',
            role: this.user.role._id,
            access_level_id: this.user.role._id,
            hashdRt: 'exampleHashdRt',
            creator_id: currentUser ? currentUser.id : 'exampleCreatorId',
            privileges: this.user.privileges || this.user.role.privileges || [],
            settings: [this.user.settings],
            affiliation_type_id: this.selectedAffiliationType,
            profile_type_id: this.selectedProfileType,
            department_id: 'exampleDepartmentId',
            parent_id: parentId
        };

        this.userService.create(userToSubmit)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (response) => {
                    this.messageService.add({
                        severity: 'success',
                        summary: this.translate.instant('management.userForm.success'),
                        detail: this.translate.instant('management.userForm.userCreated'),
                        life: 3000
                    });
                    console.log('Usuario creado:', response);
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

    onRoleChange() {
        if (!this.user.role) {
            return;
        }
        
        // Buscar el role original en el array de roles
        const originalRole = this.roles.find(r => r._id === this.user.role?._id);
        if (originalRole) {
            // Mantener la referencia al objeto original del array roles
            this.user.role = originalRole;
            
            // Limpiar los privilegios personalizados del usuario
            this.user.privileges = undefined;
        }
    }

    onSaveSettings() {
        console.log('Configuración actualizada:', this.user.settings);
    }

    getSettingValue(key: keyof UserSettings): string | boolean {
        return this.user.settings[key];
    }

    updateSettingValue(key: keyof UserSettings, value: string | boolean): void {
        if (typeof value === 'string' || typeof value === 'boolean') {
            this.user.settings[key] = value;
        }
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

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }
}

