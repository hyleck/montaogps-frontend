import { UserRole, Privilege } from './user-role.interface';

export interface UserPrivilegeActions {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
  _id: string;
}

export interface UserPrivilege {
  module: string;
  actions: UserPrivilegeActions;
  _id: string;
}

export interface AccessLevel {
  _id: string;
  createdAt: string;
  description: string;
  name: string;
  privileges: any[];
  updatedAt: string;
}

export interface BasicUser {
  id: string;
  name: string;
  last_name: string;
  email: string;
  access_level_id: AccessLevel;
  affiliation_type_id?: string;
  profile_type_id?: string;
  company_type_id?: string;
  company_type?: string;
  root?: boolean;
  developer?: boolean;
  privileges?: UserPrivilege[];
}

export interface User {
  _id: string;
  name: string;
  last_name: string;
  email: string;
  access_level_id: AccessLevel;
  phone?: string;
  phone2?: string;
  birth?: string;
  dni?: string;
  address?: string;
  province?: string;
  municipality?: string;
  sector?: string;
  latitude?: number;
  longitude?: number;
  locationUpdatedAt?: string | Date;
  locationAccuracy?: number;
  realtime_location?: {
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    recordedAt?: string | Date;
    source?: string;
  };
  static_location_url?: string;
  static_location_address?: string;
  static_latitude?: number;
  static_longitude?: number;
  photo?: string;
  settings?: UserSettings[];
  profile_type_id?: string;
  affiliation_type_id?: string;
  department_id?: string;
  root?: boolean;
  developer?: boolean;
  status?: boolean;
  tag?: string;
  verificado?: boolean;
  cedula_img?: any;
  noDocuments?: boolean;
  no_assistance?: boolean;
  noDocumentsAcceptance?: {
    document_type?: string;
    title?: string;
  };
  customer_satisfaction_level?: number;
  customer_satisfaction_updated_at?: string | Date;
  customer_satisfaction_history?: Array<{
    message_id: number;
    conversation_id: number;
    sentiment: 'positive' | 'negative';
    delta: number;
    previous_level: number;
    new_level: number;
    reason?: string;
    message_excerpt?: string;
    created_at?: string | Date;
  }>;
  idSessions?: Array<{ date: string; device: string }>;
  interaction_progress?: { listId: string; completed_objectives: string[] }[];
}

export interface UserSettings {
  [key: string]: string | boolean | undefined;
  theme: string;
  language: string;
  notifications: boolean;
  affiliation_type: string;
  profile_type: string;
  company_type?: string;
  map_marker_type?: string;
}

export interface ExtendedUser extends Omit<User, 'settings'> {
  password?: string;
  dni: string;
  birth: string;
  address: string;
  province?: string;
  municipality?: string;
  sector?: string;
  latitude?: number;
  longitude?: number;
  realtime_location?: {
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    recordedAt?: string | Date;
    source?: string;
  };
  static_location_url?: string;
  static_location_address?: string;
  static_latitude?: number;
  static_longitude?: number;
  photo: string;
  phone: string;
  phone2: string;
  verified_email: boolean;
  role: UserRole | null;
  privileges?: { [key: string]: Privilege };
  settings: UserSettings;
  status: boolean;
  affiliation_type_id: string;
  profile_type_id: string;
  company_type_id?: string;
  root?: boolean;
  developer?: boolean;
  tag?: string;
  verificado?: boolean;
  cedula_img?: any;
}

export function convertToExtendedUser(user: User): ExtendedUser {
  return {
    ...user,
    verified_email: false,
    role: null,
    status: user.status !== undefined ? user.status : true,
    affiliation_type_id: (user as any).affiliation_type_id || 'cliente',
    profile_type_id: (user as any).profile_type_id || 'personal',
    dni: user.dni || '',
    birth: user.birth || '',
    address: user.address || '',
    photo: user.photo || '',
    phone: user.phone || '',
    phone2: user.phone2 || '',
    settings: {
      theme: user.settings?.[0]?.theme || 'light',
      language: user.settings?.[0]?.language || 'es',
      notifications: user.settings?.[0]?.notifications ?? true,
      affiliation_type: (user as any).affiliation_type_id || 'cliente',
      profile_type: (user as any).profile_type_id || 'personal',
      company_type: (user as any).company_type_id,
      map_marker_type: user.settings?.[0]?.map_marker_type || 'default'
    }
  };
} 
