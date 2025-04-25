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
  theme?: string;
  language?: string;
  notifications?: boolean;
} 