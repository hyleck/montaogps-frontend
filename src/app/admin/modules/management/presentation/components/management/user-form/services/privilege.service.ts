import { Injectable } from '@angular/core';
import { UserRole, Privilege, PrivilegeAction } from '../../../../../../../../core/interfaces/user-role.interface';

@Injectable({
    providedIn: 'root'
})
export class PrivilegeService {
    getPrivilegeByModule(privileges: Privilege[] | undefined, module: string): Privilege | undefined {
        if (!privileges) return undefined;
        const privilege = privileges.find(p => p.module === module);
        return privilege ? { ...privilege } : undefined;
    }

    getPrivilegeActions(privileges: { [key: string]: Privilege } | undefined, rolePrivileges: Privilege[] | undefined, module: string): PrivilegeAction {
        // Si el usuario tiene privilegios personalizados, usarlos
        if (privileges && Array.isArray(privileges)) {
            const userPrivilege = privileges.find(p => p.module === module);
            if (userPrivilege) {
                return userPrivilege.actions;
            }
        }
        
        // Si no hay privilegios personalizados, usar los del role
        const privilege = this.getPrivilegeByModule(rolePrivileges, module);
        return privilege?.actions || {
            read: false,
            create: false,
            update: false,
            delete: false
        };
    }

    setPrivilegeAction(role: UserRole | null, module: string, action: keyof PrivilegeAction, value: boolean): UserRole {
        if (!role) {
            role = {
                _id: '',
                name: '',
                description: '',
                status: 'active',
                createdAt: new Date(),
                privileges: []
            };
        }
        
        let privilege = this.getPrivilegeByModule(role.privileges, module);
        if (!privilege) {
            privilege = {
                module,
                actions: {
                    read: false,
                    create: false,
                    update: false,
                    delete: false
                }
            };
            role.privileges.push(privilege);
        }
        privilege.actions[action] = value;
        return role;
    }

    toggleAllPrivileges(privilege: Privilege | undefined): Privilege | undefined {
        if (!privilege) return undefined;
        
        const allChecked = Object.values(privilege.actions).every(value => value === true);
        const newValue = !allChecked;
        
        (Object.keys(privilege.actions) as Array<keyof PrivilegeAction>).forEach(action => {
            privilege.actions[action] = newValue;
        });

        return privilege;
    }

    isAllSelected(privilege: Privilege | undefined): boolean {
        if (!privilege) return false;
        return Object.values(privilege.actions).every(value => value === true);
    }

    toggleAllModulesPrivileges(role: UserRole | null): UserRole | null {
        if (!role?.privileges) return role;
        
        const allChecked = this.isAllModulesSelected(role);
        const newValue = !allChecked;
        
        role.privileges.forEach(privilege => {
            (Object.keys(privilege.actions) as Array<keyof PrivilegeAction>).forEach(action => {
                privilege.actions[action] = newValue;
            });
        });

        return role;
    }

    isAllModulesSelected(role: UserRole | null): boolean {
        if (!role?.privileges) return false;
        return role.privileges.every(privilege => 
            Object.values(privilege.actions).every(value => value === true)
        );
    }
} 