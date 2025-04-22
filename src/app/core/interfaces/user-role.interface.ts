export interface PrivilegeAction {
    read: boolean;
    update: boolean;
    create: boolean;
    delete: boolean;
}

export interface Privilege {
    module: string;
    actions: PrivilegeAction;
}

export interface UserRole {
    _id: string;
    name: string;
    description: string;
    status: string;
    createdAt: Date;
    privileges: Privilege[];
}

export interface CreateUserRoleDto {
    name: string;
    description: string;
    status: string;
    privileges: Privilege[];
}

export interface UpdateUserRoleDto {
    name?: string;
    description?: string;
    status?: string;
    privileges?: Privilege[];
}

export interface PrivilegeActions {
    read: boolean;
    update: boolean;
    create: boolean;
    delete: boolean;
} 