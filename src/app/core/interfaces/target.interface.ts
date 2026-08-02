import { User } from './user.interface';

export interface TraccarInfo {
  status: 'online' | 'offline' | string;
  [key: string]: any; // Para otras propiedades que pueda tener traccarInfo
}

export interface TargetTransferHistoryEntry {
  _id?: string;
  from_user_id: string;
  from_user_name?: string;
  from_user_email?: string;
  to_user_id: string;
  to_user_name?: string;
  to_user_email?: string;
  transferred_by_user_id?: string;
  transferred_by_name?: string;
  transferred_by_email?: string;
  source?: string;
  transferred_at: string | Date;
}

export interface Target {
  _id: string;
  name: string;
  imei: string;
  device_imei: string;
  api_id?: string | null;
  sim_card: string;
  sim_card_number: string;
  sim_company?: string;
  description?: string;
  plate: string;
  contacts?: string[];
  year?: string | null;
  installation_location?: string | null;
  gps_adicional?: string | null;
  instalaciones_adicionales?: Target[];
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
  historicalLocation?: {
    latitude: number;
    longitude: number;
    timestamp?: string;
  };
  tag?: string;
  connection_priority?: string;
  activation_status?: {
    completed: boolean;
    completedAt?: string;
    cancelled?: boolean;
    steps: { label: string, icon: string, description: string, status: 'pending' | 'running' | 'success' | 'error' }[];
    logs: { message: string, type: 'info' | 'success' | 'error' | 'warn', time: Date | string }[];
  };
  transfer_history?: TargetTransferHistoryEntry[];
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
  gps_adicional?: string | null;
  target_brand_id?: string | null;
  target_model_id?: string | null;
  target_color?: string;
  target_image?: string;
  target_image_thumbnail?: string;
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
  cancelReason?: string;
  cancelDescription?: string;
  delete: boolean;
  index: string;
  plan?: string | null;
  creator_id: string;
  parent_id: string;
  user_id?: string;
  connection_priority?: string;
  activation_status?: any;
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
  gps_adicional?: string | null;
  target_brand_id?: string | null;
  target_model_id?: string | null;
  target_color?: string;
  target_chassis_number?: string;
  mechanic_id?: string;
  activation_date?: Date | string;
  expiration_date?: Date | string;
  installation_date?: Date | string;
  last_change_date?: Date;
  gps_model?: string | null;
  ignition_sensor?: string | null;
  shutdown_control?: string | null;
  engine_shutdown?: string | null;
  installation_details?: string;
  status?: boolean | 'active' | 'inactive';
  canceled?: boolean;
  delete?: boolean;
  index?: string;
  plan?: string | {
    id_plan: string;
    selected_price: {
      id: string;
      amount: number;
      payment_period: string | number;
    }
  } | null;
  selectedPrice?: {
    id: string;
    amount: number;
    payment_period: string | number;
  } | null;
  creator_id?: string;
  parent_id?: string;
  user_id?: string;
  tag?: string;
  customs?: any;
  connection_priority?: string;
  activation_status?: any;
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
  protocol?: { _id: string; name: string };
  sim_card_number: string;
  sim_company: string;
  target_plate_number: string;
  target_chassis_number: string;
  customs?: any;
  contacts: string | string[];
  mechanic_id?: string;
  target_brand_id: string;
  target_model_id: string;
  target_color: string;
  target_year: string;
  installation_location: string;
  gps_adicional?: string;
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
  cancelReason?: string;
  cancelDescription?: string;
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
  instalaciones_adicionales?: TargetDevice[];
  connection_priority?: string;
  activation_status?: {
    completed: boolean;
    completedAt?: string;
    cancelled?: boolean;
    steps: { label: string, icon: string, description: string, status: 'pending' | 'running' | 'success' | 'error' }[];
    logs: { message: string, type: 'info' | 'success' | 'error' | 'warn', time: Date | string }[];
  };
  transfer_history?: TargetTransferHistoryEntry[];
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
  cachedStops?: any[];
  totalCachedStops?: number;
  fromCache?: boolean;
  cacheMiss?: boolean;
  cacheKey?: string;
  generatedAt?: string | Date;
  error?: string;
}

// Interfaces para procesos de targets
export interface CreateProcessDto {
  type: number;
  registrationDate: string;
  description?: string;
  details?: string;
  target: object;
  user: object;
  reference: string;
  before: object;
  after: object;
  creator: string;
}

export interface ProcessResponse {
  _id: string;
  type: number;
  registrationDate: string;
  description?: string;
  details?: string;
  reference: string;
  target: {
    _id: string;
    name?: string;
    device_imei: string;
    [key: string]: any;
  };
  user: User;
  before: object;
  after: object;
  creator: string;
  createdAt?: string;
  updatedAt?: string;
  expanded?: boolean; // Propiedad para controlar la expansión del accordion
}
