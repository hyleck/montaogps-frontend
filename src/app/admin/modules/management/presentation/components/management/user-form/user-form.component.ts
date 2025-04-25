import { Component, OnInit } from '@angular/core';
import { UserRole, Privilege, PrivilegeAction } from '../../../../../../../core/interfaces/user-role.interface';
import { User } from '../../../../../../../core/interfaces/user.interface';
import { UserRolesService } from '../../../../../../../core/services/user-roles.service';
import { TranslateService } from '@ngx-translate/core';

interface UserSettings {
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
}

@Component({
    selector: 'app-user-form',
    templateUrl: './user-form.component.html',
    styleUrls: ['./user-form.component.css'],
    standalone: false
})
export class UserFormComponent implements OnInit {
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
        }
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
        { label: 'management.userForm.theme', value: 'light' },
        { label: 'management.userForm.theme', value: 'dark' }
    ];

    languages = [
        { label: 'management.userForm.language', value: 'es' },
        { label: 'management.userForm.language', value: 'en' }
    ];

    affiliationTypes = [
        { label: 'management.userForm.affiliationType', value: 'personal' },
        { label: 'management.userForm.affiliationType', value: 'business' },
        { label: 'management.userForm.affiliationType', value: 'premium' }
    ];

    profileTypes = [
        { label: 'management.userForm.profileType', value: 'basic' },
        { label: 'management.userForm.profileType', value: 'advanced' },
        { label: 'management.userForm.profileType', value: 'expert' }
    ];

    constructor(
        private userRolesService: UserRolesService,
        private translate: TranslateService
    ) {}

    ngOnInit() {
        this.loadRoles();
        this.user.role = null;
    }

    loadRoles() {
        this.userRolesService.getAllRoles().subscribe({
            next: (roles) => {
                this.roles = roles;
                if (!this.user.role) {
                    this.user.role = null;
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
        const userToSubmit = {
            ...this.user,
            role: this.user.role ? {
                ...this.user.role,
                privileges: this.user.role.privileges
            } : null
        };
        console.log('Usuario a guardar:', userToSubmit);
        // Aquí iría la llamada al servicio para guardar el usuario
    }

    onRoleChange() {
        if (!this.user.role) {
            return;
        }
        
        const selectedRole = this.roles.find(r => r._id === this.user.role?._id);
        if (selectedRole) {
            this.user.role.privileges = selectedRole.privileges.map(p => ({
                ...p,
                actions: { ...p.actions }
            }));
        }
    }

    onSaveSettings() {
        console.log('Configuración actualizada:', this.user.settings);
    }
}

