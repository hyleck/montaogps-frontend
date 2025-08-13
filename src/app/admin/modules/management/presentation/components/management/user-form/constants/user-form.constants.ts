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

export interface ProvinceOption { label: string; value: string }
export interface MunicipalityOption { label: string; value: string }
export interface ServiceOption { id: string; i18nKey: string }

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
    { value: 'servers', label: 'management.userForm.modules.servers' },
    { value: 'protocols', label: 'management.userForm.modules.protocols' },
    { value: 'inventory', label: 'management.userForm.modules.inventory' }
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
    servers: 'pi pi-database',
    protocols: 'pi pi-shield',
    inventory: 'pi pi-database'
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
    { label: 'Personal', value: 'personal' },
    { label: 'Compartido', value: 'compartido' }
];

export const AFFILIATION_TYPES: AffiliationTypeOption[] = [
    { label: 'Cliente', value: 'cliente' },
    { label: 'Subcliente', value: 'subcliente' },
    { label: 'Socio', value: 'socio' },
    { label: 'Empleado', value: 'empleado' },
    { label: 'Tecnico (empleado)', value: 'tecnico_empleado' },
    { label: 'Tecnico (independiente)', value: 'tecnico_independiente' },
    { label: 'Otro', value: 'otro' }
];

export const USER_FORM_STYLES = [
    './styles/base.css',
    './styles/inputs.css',
    './styles/buttons.css',
    './styles/settings.css',
    './styles/privileges.css',
    './styles/prime-ng.css',
    './styles/scrollbar.css',
    './styles/dark-mode.css'
]; 

// Servicios técnicos (dinámicos con IDs y claves de traducción)
export const TECHNICIAN_SERVICES: ServiceOption[] = [
    { id: 'electricidad', i18nKey: 'management.userForm.servicesOptions.electricidad' },
    { id: 'tren_delantero', i18nKey: 'management.userForm.servicesOptions.tren_delantero' },
    { id: 'aire_acondicionado', i18nKey: 'management.userForm.servicesOptions.aire_acondicionado' },
    { id: 'mecanica_diesel', i18nKey: 'management.userForm.servicesOptions.mecanica_diesel' },
    { id: 'mecanica_motor', i18nKey: 'management.userForm.servicesOptions.mecanica_motor' },
    { id: 'transmision_automatica', i18nKey: 'management.userForm.servicesOptions.transmision_automatica' },
    { id: 'transmision_mecanica', i18nKey: 'management.userForm.servicesOptions.transmision_mecanica' }
];

export const PROVINCES: ProvinceOption[] = [
    { label: 'Seleccione provincia', value: '' },
    { label: 'Provincia A', value: 'prov_a' },
    { label: 'Provincia B', value: 'prov_b' },
    { label: 'Provincia C', value: 'prov_c' }
];

export const MUNICIPALITIES: Record<string, MunicipalityOption[]> = {
    prov_a: [
        { label: 'Seleccione municipio', value: '' },
        { label: 'Municipio A1', value: 'mun_a1' },
        { label: 'Municipio A2', value: 'mun_a2' }
    ],
    prov_b: [
        { label: 'Seleccione municipio', value: '' },
        { label: 'Municipio B1', value: 'mun_b1' },
        { label: 'Municipio B2', value: 'mun_b2' }
    ],
    prov_c: [
        { label: 'Seleccione municipio', value: '' },
        { label: 'Municipio C1', value: 'mun_c1' },
        { label: 'Municipio C2', value: 'mun_c2' }
    ],
    '': [{ label: 'Seleccione municipio', value: '' }]
};