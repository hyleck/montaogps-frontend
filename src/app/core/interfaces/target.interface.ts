export interface TraccarInfo {
    status: 'online' | 'offline' | string;
    [key: string]: any; // Para otras propiedades que pueda tener traccarInfo
}

export interface Target {
    _id: string;
    name: string;
    imei: string;
    device_imei: string;
    api_id?: string | null;
    sim_card: string;
    sim_card_number: string;
    description?: string;
    plate: string;
    contacts?: string[];
    year?: string | null;
    installation_location?: string | null;
    brand?: string | null;
    model?: string | null;
    color?: string;
    chassis?: string;
    installation_date?: string;
    expiration_date?: string;
    gps_model?: string | null;
    ignition_sensor?: string | null;
    shutdown_control?: string | null;
    engine_shutdown?: string | null;
    installation_details?: string;
    status: 'active' | 'inactive' | null;
    plan?: string | null;
    user_id?: string;
    created_at?: string;
    updated_at?: string;
    traccarInfo?: TraccarInfo;
}

export interface CreateTargetDto {
    name: string;
    device_imei: string;
    api_device_id: string;
    api_position_id: string;
    type: string;
    sim_card_number: string;
    sim_company: string;
    description?: string;
    target_plate_number: string;
    contacts: string;
    target_year?: string | null;
    installation_location?: string | null;
    target_brand_id?: string | null;
    target_model_id?: string | null;
    target_color?: string;
    target_chassis_number?: string;
    activation_date: Date;
    expiration_date?: Date;
    last_change_date: Date;
    gps_model?: string | null;
    ignition_sensor?: string | null;
    shutdown_control?: string | null;
    engine_shutdown?: string | null;
    installation_details?: string;
    status: boolean;
    canceled: boolean;
    delete: boolean;
    index: string;
    plan?: string | null;
    creator_id: string;
    parent_id: string;
    user_id?: string;
}

export interface UpdateTargetDto {
    name?: string;
    device_imei?: string;
    api_device_id?: string;
    api_position_id?: string;
    type?: string;
    sim_card_number?: string;
    sim_company?: string;
    description?: string;
    target_plate_number?: string;
    contacts?: string;
    target_year?: string | null;
    installation_location?: string | null;
    target_brand_id?: string | null;
    target_model_id?: string | null;
    target_color?: string;
    target_chassis_number?: string;
    activation_date?: Date;
    expiration_date?: Date;
    last_change_date?: Date;
    gps_model?: string | null;
    ignition_sensor?: string | null;
    shutdown_control?: string | null;
    engine_shutdown?: string | null;
    installation_details?: string;
    status?: boolean;
    canceled?: boolean;
    delete?: boolean;
    index?: string;
    plan?: string | null;
    creator_id?: string;
    parent_id?: string;
    user_id?: string;
}

// Interface para el formulario de target (más completa que Target básica)
export interface TargetDevice {
  _id: string;
  name: string;
  device_imei: string;
  api_device_id: string;
  api_position_id: string;
  description: string;
  type: string;
  sim_card_number: string;
  sim_company: string;
  target_plate_number: string;
  target_chassis_number: string;
  contacts: string | string[];
  mechanic_id?: string;
  target_brand_id: string;
  target_model_id: string;
  target_color: string;
  target_year: string;
  installation_location: string;
  engine_shutdown?: string;
  ignition_sensor?: string;
  required_check?: string;
  installation_details?: string;
  creator_id: string;
  activation_date: string;
  expiration_date: string;
  last_change_date: string;
  status: boolean | 'active' | 'inactive';
  canceled: boolean;
  deleted: boolean;
  shared?: string;
  index: string;
  parent_id: string;
  user_id?: string;
  plan: string | {
    id_plan: string;
    selected_price: {
      id: string;
      amount: number;
      payment_period: string | number;
    }
  } | null;
  // Propiedades para el estado del formulario o compatibilidad
  selectedPrice?: {
    id: string;
    amount: number;
    payment_period: string | number;
  } | null;
  // Campos de compatibilidad con versión anterior
  imei?: string;
  api_id?: string | null;
  sim_card?: string;
  plate?: string;
  chassis?: string;
  year?: string | null;
  brand?: string | null;
  model?: string | null;
  color?: string;
  installation_date?: string;
  gps_model?: string | null;
  shutdown_control?: string | null;
  // Información de Traccar para estado del dispositivo
  traccarInfo?: {
    status: 'online' | 'offline' | string;
  };
  // Campos adicionales que pueden existir
  [key: string]: any;
}

// Interfaces para el historial de rutas
export interface RouteHistoryPosition {
  id: number;
  deviceId: number;
  serverTime: string;
  deviceTime: string;
  fixTime: string;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  course: number;
  address: string;
  accuracy: number;
  valid: boolean;
  dbfrom: string;
  attributes: Record<string, any>;
}

export interface RouteHistoryResponse {
  positions: RouteHistoryPosition[];
  totalPositions: number;
} 