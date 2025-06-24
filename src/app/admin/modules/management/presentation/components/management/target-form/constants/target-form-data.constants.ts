// Constantes de datos para el formulario de target

// Opciones para ubicaciones de instalación
export const INSTALLATION_LOCATIONS = [
  { label: 'Interior', value: 'interior' },
  { label: 'Exterior', value: 'exterior' },
  { label: 'Bajo tablero', value: 'bajo_tablero' }
] as const;

// Opciones para tipos de tarjetas SIM
export const SIM_CARD_TYPES = [
  { label: 'Nacionales', value: 'nacionales' },
  { label: 'Global-E', value: 'global-e' },
  { label: 'Global-M', value: 'global-m' }
] as const;

// Planes de fallback (cuando no se pueden cargar desde el servicio)
export const FALLBACK_PLANS = [
  { label: 'Básico', value: 'basico' },
  { label: 'Estándar', value: 'estandar' },
  { label: 'Premium', value: 'premium' },
  { label: 'Empresarial', value: 'empresarial' }
] as const;

// Modelos GPS de fallback (cuando no se pueden cargar protocolos)
export const FALLBACK_GPS_MODELS = [
  { label: 'Modelo A', value: 'modelo_a' },
  { label: 'Modelo B', value: 'modelo_b' },
  { label: 'Modelo C', value: 'modelo_c' }
] as const;

// Campos que deben preservarse durante la edición
export const FIELDS_TO_PRESERVE = ['sim_company', 'engine_shutdown', 'ignition_sensor'] as const;

// Configuración para generación de años
export const YEARS_CONFIG = {
  YEARS_TO_GENERATE: 30,
  BASE_YEAR: () => new Date().getFullYear()
} as const;

// Configuración para precios personalizados
export const CUSTOM_PRICE_CONFIG = {
  DEFAULT_PAYMENT_PERIOD: 'monthly',
  CUSTOM_PREFIX: 'custom_'
} as const; 