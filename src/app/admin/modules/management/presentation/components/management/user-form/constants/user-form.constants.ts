export interface ModuleOption {
    value: string;
    label: string;
}

export interface ThemeOption {
    label: string;
    value: string;
}

export interface LanguageOption {
    label: string;
    value: string;
}

export interface ProfileTypeOption {
    label: string;
    value: string;
}

export interface AffiliationTypeOption {
    label: string;
    value: string;
}

export const AVAILABLE_MODULES: ModuleOption[] = [
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

export const MODULE_ICONS: { [key: string]: string } = {
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

export const THEMES: ThemeOption[] = [
    { label: 'Claro', value: 'light' },
    { label: 'Oscuro', value: 'dark' }
];

export const LANGUAGES: LanguageOption[] = [
    { label: 'Español', value: 'es' },
    { label: 'Inglés', value: 'en' }
];

export const PROFILE_TYPES: ProfileTypeOption[] = [
    { label: 'Empresa', value: 'empresa' },
    { label: 'Personal', value: 'personal' }
];

export const AFFILIATION_TYPES: AffiliationTypeOption[] = [
    { label: 'Cliente', value: 'cliente' },
    { label: 'Subcliente', value: 'subcliente' },
    { label: 'Socio', value: 'socio' },
    { label: 'Empleado', value: 'empleado' },
    { label: 'Otro', value: 'otro' }
]; 