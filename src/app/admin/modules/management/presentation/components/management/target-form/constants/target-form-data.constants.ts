// Constantes de datos para el formulario de target

// Opciones para ubicaciones de instalación
export const INSTALLATION_LOCATIONS = [
  { label: 'Bajo el tablero', value: 'bajo_tablero' },
  { label: 'En el maletero', value: 'maletero' },
  { label: 'Bajo el asiento del conductor', value: 'asiento_conductor' },
  { label: 'Asiento del chofer', value: 'asiento_chofer' },
  { label: 'En el compartimento del motor', value: 'compartimento_motor' },
  { label: 'En el panel de instrumentos', value: 'panel_instrumentos' },
  { label: 'Debajo del volante', value: 'debajo_volante' },
  { label: 'En la parte trasera del vehículo', value: 'parte_trasera' },
  { label: 'Luz del techo', value: 'luz_techo' },
  { label: 'Luz trasera', value: 'luz_trasera' },
  { label: 'Debajo del asiento del pasajero', value: 'asiento_pasajero' },
  { label: 'Caja de fusibles', value: 'caja_fusibles' },
  { label: 'Debajo del asiento trasero', value: 'asiento_trasero' },
  { label: 'En la guantera del pasajero', value: 'guantera_pasajero' },
  { label: 'En el radio', value: 'radio' },
  { label: 'El buche', value: 'buche' },
  { label: 'Lateral izquierdo', value: 'lateral_izquierdo' },
  { label: 'El millero', value: 'millero' },
  { label: 'El chasis', value: 'chasis' },
  { label: 'Otro', value: 'otro' }
] as const;

// Opciones para tipos de tarjetas SIM
export const SIM_CARD_TYPES = [
  { label: 'Nacionales', value: 'nacionales' },
  { label: 'Global-E', value: 'global-e' },
  { label: 'Global-M', value: 'global-m' },
  { label: 'Global-M2', value: 'global-m2' }
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
  YEARS_TO_GENERATE: 60,
  BASE_YEAR: () => new Date().getFullYear()
} as const;

// Configuración para precios personalizados
export const CUSTOM_PRICE_CONFIG = {
  DEFAULT_PAYMENT_PERIOD: 'monthly',
  CUSTOM_PREFIX: 'custom_'
} as const; 
