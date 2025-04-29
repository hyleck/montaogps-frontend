export interface UserSettings {
    theme: string;
    language: string;
    notifications: boolean;
}

export interface UserRole {
    _id: string;
    name: string;
}

export interface ProfileUser {
    _id: string;
    name: string;
    last_name: string;
    email: string;
    isActive?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
    access_level_id?: any;
    phone?: string;
    phone2?: string;
    birth?: string;
    dni?: string;
    address?: string;
    role?: UserRole;
    photo?: string;
    settings: UserSettings;
} 