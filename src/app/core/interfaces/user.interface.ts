export interface AccessLevel {
  id: string;
  createdAt: string;
  description: string;
  name: string;
  privileges: string[];
  updatedAt: string;
  _id: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  last_name: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  access_level_id?: AccessLevel;
} 