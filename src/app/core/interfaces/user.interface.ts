import { UserRole, Privilege } from './user-role.interface';

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
  photo?: string;
  settings?: UserSettings[];
}

export interface UserSettings {
  [key: string]: string | boolean;
  theme: string;
  language: string;
  notifications: boolean;
  affiliation_type: string;
  profile_type: string;
}

export interface ExtendedUser extends Omit<User, 'settings'> {
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
  affiliation_type_id: string;
  profile_type_id: string;
}

export function convertToExtendedUser(user: User): ExtendedUser {
    return {
        ...user,
        verified_email: false,
        role: null,
        status: 'active',
        affiliation_type_id: user.settings?.[0]?.affiliation_type || 'cliente',
        profile_type_id: user.settings?.[0]?.profile_type || 'personal',
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
            affiliation_type: user.settings?.[0]?.affiliation_type || 'cliente',
            profile_type: user.settings?.[0]?.profile_type || 'personal'
        }
    };
} 