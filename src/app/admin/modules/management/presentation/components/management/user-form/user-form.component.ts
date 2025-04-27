import { Component, OnInit, Output, EventEmitter, Input, SimpleChanges, OnChanges } from '@angular/core';
import { UserRole, Privilege, PrivilegeAction } from '../../../../../../../core/interfaces/user-role.interface';
import { User } from '../../../../../../../core/interfaces/user.interface';
import { UserRolesService } from '../../../../../../../core/services/user-roles.service';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { UserService } from '../../../../../../../core/services/user.service';
import { AuthService } from '../../../../../../../core/services/auth.service';
import { ActivatedRoute } from '@angular/router';

interface UserSettings {
    [key: string]: string | boolean;
    theme: string;
    language: string;
    notifications: boolean;
    affiliation_type: string;
    profile_type: string;
}

interface ExtendedUser extends Omit<User, 'settings'> {
    password?: string;
    dni: string;
    birth: string;
    address: string;
    photo: string;
    phone: string;
    phone2: string;
    verified_email: boolean;
    role: UserRole | null;
    privileges?: { [key: string]: Privilege };
    settings: UserSettings;
    status: 'active' | 'inactive';
    affiliation_type: string;
    profile_type: string;
}

@Component({
    selector: 'app-user-form',
    templateUrl: './user-form.component.html',
    styleUrls: ['./user-form.component.css'],
    standalone: false
})
export class UserFormComponent implements OnInit, OnChanges {
    @Input() userInput: any = null;
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
        save: 'management.userForm.save',
        cancel: 'management.userForm.cancel'
    };

    user: ExtendedUser = {
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
            affiliation_type: '',
            profile_type: ''
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
        affiliation_type: '',
        profile_type: ''
    };

    roles: UserRole[] = [];

    availableModules = [
        { value: 'users', label: 'management.userForm.modules.users' },
        { value: 'roles', label: 'management.userForm.modules.roles' },
        { value: 'devices', label: 'management.userForm.modules.devices' },
        { value: 'reports', label: 'management.userForm.modules.reports' },
        { value: 'processes', label: 'management.userForm.modules.processes' },
        { value: 'sms', label: 'management.userForm.modules.sms' },
        { value: 'cloud', label: 'management.userForm.modules.cloud' },
        { value: 'sectors', label: 'management.userForm.modules.sectors' },
        { value: 'tags', label: 'management.userForm.modules.tags' },
        { value: 'brands', label: 'management.userForm.modules.brands' },
        { value: 'models', label: 'management.userForm.modules.models' },
        { value: 'colors', label: 'management.userForm.modules.colors' },
        { value: 'canceled', label: 'management.userForm.modules.canceled' },
        { value: 'system', label: 'management.userForm.modules.system' },
        { value: 'plans', label: 'management.userForm.modules.plans' },
        { value: 'servers', label: 'management.userForm.modules.servers' }
    ];

    moduleIcons: { [key: string]: string } = {
        users: 'pi pi-users',
        roles: 'pi pi-key',
        devices: 'pi pi-mobile',
        reports: 'pi pi-chart-bar',
        processes: 'pi pi-cog',
        sms: 'pi pi-envelope',
        cloud: 'pi pi-cloud',
        sectors: 'pi pi-map',
        tags: 'pi pi-tags',
        brands: 'pi pi-bookmark',
        models: 'pi pi-car',
        colors: 'pi pi-palette',
        canceled: 'pi pi-ban',
        system: 'pi pi-server',
        plans: 'pi pi-dollar',
        servers: 'pi pi-database'
    };

    themes = [
        { label: 'Claro', value: 'light' },
        { label: 'Oscuro', value: 'dark' }
    ];

    languages = [
        { label: 'Español', value: 'es' },
        { label: 'Inglés', value: 'en' }
    ];

    affiliationTypes = [
        { label: 'Personal', value: 'personal' },
        { label: 'Empresarial', value: 'business' },
        { label: 'Premium', value: 'premium' }
    ];

    profileTypes = [
        { label: 'Básico', value: 'basic' },
        { label: 'Avanzado', value: 'advanced' },
        { label: 'Experto', value: 'expert' }
    ];

    // Propiedades intermedias para el enlace de datos
    selectedTheme: string = this.getSettingValue('theme') as string;
    selectedLanguage: string = this.getSettingValue('language') as string;
    notificationsEnabled: boolean = this.getSettingValue('notifications') as boolean;

    selectedAffiliationType: string = this.user.affiliation_type;
    selectedProfileType: string = this.user.profile_type;

    confirmPassword: string = '';

    activeTabIndex: number = 0;

    constructor(
        private userRolesService: UserRolesService,
        private translate: TranslateService,
        private messageService: MessageService,
        private userService: UserService,
        private authService: AuthService,
        private route: ActivatedRoute
    ) {}

    ngOnInit() {
        this.loadRoles();
        this.user = {
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
                affiliation_type: '',
                profile_type: ''
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
            affiliation_type: '',
            profile_type: ''
        };
        this.selectedTheme = 'light';
        this.selectedLanguage = 'es';
        this.notificationsEnabled = true;
        this.selectedAffiliationType = '';
        this.selectedProfileType = '';
        this.confirmPassword = '';
        this.user.password = '';
        this.activeTabIndex = 0;
    }

    private resetForm() {
        this.user = {
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
                affiliation_type: '',
                profile_type: ''
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
            affiliation_type: '',
            profile_type: ''
        };
        this.selectedTheme = 'light';
        this.selectedLanguage = 'es';
        this.notificationsEnabled = true;
        this.selectedAffiliationType = '';
        this.selectedProfileType = '';
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
                this.selectedAffiliationType = this.user.affiliation_type;
                this.selectedProfileType = this.user.profile_type;
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
        this.userRolesService.getAllRoles().subscribe({
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
        if (!privileges) return undefined;
        const privilege = privileges.find(p => p.module === module);
        return privilege ? { ...privilege } : undefined;
    }

    getPrivilegeActions(module: string): PrivilegeAction {
        // Si el usuario tiene privilegios personalizados, usarlos
        if (this.user.privileges && Array.isArray(this.user.privileges)) {
            const userPrivilege = this.user.privileges.find(p => p.module === module);
            if (userPrivilege) {
                return userPrivilege.actions;
            }
        }
        
        // Si no hay privilegios personalizados, usar los del role
        const privilege = this.getPrivilegeByModule(this.user.role?.privileges, module);
        return privilege?.actions || {
            read: false,
            create: false,
            update: false,
            delete: false
        };
    }

    setPrivilegeAction(module: string, action: keyof PrivilegeAction, value: boolean): void {
        if (!this.user.role?.privileges) {
            this.user.role = {
                _id: '',
                name: '',
                description: '',
                status: 'active',
                createdAt: new Date(),
                privileges: []
            };
        }
        
        let privilege = this.getPrivilegeByModule(this.user.role.privileges, module);
        if (!privilege) {
            privilege = {
                module,
                actions: {
                    read: false,
                    create: false,
                    update: false,
                    delete: false
                }
            };
            this.user.role.privileges.push(privilege);
        }
        privilege.actions[action] = value;
    }

    toggleAllPrivileges(privilege: Privilege | undefined): void {
        if (!privilege) return;
        
        const allChecked = Object.values(privilege.actions).every(value => value === true);
        const newValue = !allChecked;
        
        (Object.keys(privilege.actions) as Array<keyof PrivilegeAction>).forEach(action => {
            privilege.actions[action] = newValue;
        });
    }

    isAllSelected(privilege: Privilege | undefined): boolean {
        if (!privilege) return false;
        return Object.values(privilege.actions).every(value => value === true);
    }

    toggleAllModulesPrivileges(): void {
        if (!this.user.role?.privileges) return;
        
        const allChecked = this.isAllModulesSelected();
        const newValue = !allChecked;
        
        this.user.role.privileges.forEach(privilege => {
            (Object.keys(privilege.actions) as Array<keyof PrivilegeAction>).forEach(action => {
                privilege.actions[action] = newValue;
            });
        });
    }

    isAllModulesSelected(): boolean {
        if (!this.user.role?.privileges) return false;
        return this.user.role.privileges.every(privilege => 
            Object.values(privilege.actions).every(value => value === true)
        );
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
        const userToSubmit = {
            ...this.user,
            password: this.user.password || 'examplePassword',
            role: this.user.role._id,
            access_level_id: this.user.role._id,
            hashdRt: 'exampleHashdRt',
            creator_id: currentUser ? currentUser.id : 'exampleCreatorId',
            privileges: this.user.privileges || this.user.role.privileges || [],
            settings: this.user.settings ? [this.user.settings] : [],
            profile_type_id: 'exampleProfileTypeId',
            affiliation_type_id: 'exampleAffiliationTypeId',
            department_id: 'exampleDepartmentId',
            parent_id: parentId
        };

        this.userService.create(userToSubmit).subscribe({
            next: (response) => {
                this.messageService.add({
                    severity: 'success',
                    summary: this.translate.instant('management.userForm.success'),
                    detail: this.translate.instant('management.userForm.userCreated'),
                    life: 3000
                });
                console.log('Usuario creado:', response);
                this.userCreated.emit();
                // Limpiar el formulario
                this.user = {
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
                        affiliation_type: '',
                        profile_type: ''
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
                    affiliation_type: '',
                    profile_type: ''
                };
                this.selectedTheme = 'light';
                this.selectedLanguage = 'es';
                this.notificationsEnabled = true;
                this.selectedAffiliationType = '';
                this.selectedProfileType = '';
                this.confirmPassword = ''; // Reiniciar confirmPassword
                this.user.password = ''; // Reiniciar password
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
}

