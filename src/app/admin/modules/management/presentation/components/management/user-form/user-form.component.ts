import { Component, OnInit } from '@angular/core';
import { UserRole, Privilege, PrivilegeAction } from '../../../../../../../core/interfaces/user-role.interface';
import { User } from '../../../../../../../core/interfaces/user.interface';
import { UserRolesService } from '../../../../../../../core/services/user-roles.service';

interface UserSettings {
    theme: string;
    language: string;
    notifications: boolean;
    affiliation_type: string;
    profile_type: string;
}

interface ExtendedUser extends User {
    password?: string;
    dni: string;
    birth: Date;
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
    user: ExtendedUser = {
        id: '',
        email: '',
        name: '',
        last_name: '',
        dni: '',
        birth: new Date(),
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
        status: 'active'
    };

    roles: UserRole[] = [];

    availableModules = [
        { value: 'users', label: 'Usuarios' },
        { value: 'roles', label: 'Roles' },
        { value: 'devices', label: 'Dispositivos' },
        { value: 'reports', label: 'Reportes' },
        { value: 'processes', label: 'Procesos' },
        { value: 'sms', label: 'SMS' },
        { value: 'cloud', label: 'Nube' },
        { value: 'sectors', label: 'Sectores' },
        { value: 'tags', label: 'Etiquetas' },
        { value: 'brands', label: 'Marcas' },
        { value: 'models', label: 'Modelos' },
        { value: 'colors', label: 'Colores' },
        { value: 'canceled', label: 'Cancelados' },
        { value: 'system', label: 'Sistema' },
        { value: 'plans', label: 'Planes' },
        { value: 'servers', label: 'Servidores' }
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

    constructor(private userRolesService: UserRolesService) {}

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
            birth: this.user.birth.toISOString(),
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

