import { Component, OnInit } from '@angular/core';
import { UserRole, CreateUserRoleDto, Privilege } from '../../../../../../../core/interfaces/user-role.interface';
import { UserRolesService } from '../../../../../../../core/services/user-roles.service';
import { ConfirmationService, MessageService } from 'primeng/api';

@Component({
  selector: 'app-user-roles-settings',
  standalone: false,
  templateUrl: './user-roles-settings.component.html',
  styleUrl: './user-roles-settings.component.css'
})
export class UserRolesSettingsComponent implements OnInit {
  roles: UserRole[] = [];
  selectedRole: UserRole | null = null;
  isEditing: boolean = false;
  privilegesDialogVisible: boolean = false;
  
  availableModules = [
    'usuarios',
    'roles',
    'dispositivos',
    'reportes',
    'procesos',
    'sms',
    'nube',
    'sectores',
    'etiquetas',
    'marcas',
    'modelos',
    'colores',
    'cancelados'
  ];

  moduleIcons: { [key: string]: string } = {
    usuarios: 'pi pi-users',
    roles: 'pi pi-key',
    dispositivos: 'pi pi-mobile',
    reportes: 'pi pi-chart-bar',
    procesos: 'pi pi-cog',
    sms: 'pi pi-envelope',
    nube: 'pi pi-cloud',
    sectores: 'pi pi-map',
    etiquetas: 'pi pi-tags',
    marcas: 'pi pi-bookmark',
    modelos: 'pi pi-car',
    colores: 'pi pi-palette',
    cancelados: 'pi pi-ban'
  };

  roleForm = {
    _id: '',
    name: '',
    description: '',
    status: 'active',
    privileges: this.availableModules.map(module => ({
      module: module,
      actions: {
        read: false,
        update: false,
        create: false,
        delete: false
      }
    }))
  };

  constructor(
    private userRolesService: UserRolesService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService
  ) {}

  ngOnInit() {
    this.loadRoles();
  }

  loadRoles() {
    this.userRolesService.getAllRoles().subscribe({
      next: (roles: UserRole[]) => {
        console.log('Roles cargados:', roles);
        this.roles = roles;
      },
      error: (error: unknown) => {
        console.error('Error loading roles:', error);
      }
    });
  }

  onSubmit() {
    if (this.isEditing && this.roleForm._id) {
      console.log('Actualizando rol con ID:', this.roleForm._id);
      this.userRolesService.updateRole(this.roleForm._id, {
        name: this.roleForm.name,
        description: this.roleForm.description,
        status: this.roleForm.status,
        privileges: this.roleForm.privileges
      }).subscribe({
        next: (updatedRole: UserRole) => {
          console.log('Rol actualizado:', updatedRole);
          const index = this.roles.findIndex(role => role._id === this.roleForm._id);
          if (index !== -1) {
            this.roles[index] = updatedRole;
          }
          this.cancelEdit();
          this.messageService.add({
            severity: 'success',
            summary: 'Rol actualizado',
            detail: `El rol "${updatedRole.name}" ha sido actualizado correctamente`
          });
        },
        error: (error: unknown) => {
          console.error('Error updating role:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo actualizar el rol'
          });
        }
      });
    } else {
      const newRole: CreateUserRoleDto = {
        name: this.roleForm.name,
        description: this.roleForm.description,
        status: this.roleForm.status,
        privileges: this.roleForm.privileges
      };

      this.userRolesService.createRole(newRole).subscribe({
        next: (createdRole: UserRole) => {
          console.log('Rol creado:', createdRole);
          this.roles.push(createdRole);
          this.cancelEdit();
          this.messageService.add({
            severity: 'success',
            summary: 'Rol creado',
            detail: `El rol "${createdRole.name}" ha sido creado correctamente`
          });
        },
        error: (error: unknown) => {
          console.error('Error creating role:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo crear el rol'
          });
        }
      });
    }
  }

  editRole(role: UserRole) {
    console.log('Editando rol:', role);
    this.selectedRole = role;
    this.roleForm = {
      _id: role._id,
      name: role.name,
      description: role.description,
      status: role.status,
      privileges: role.privileges.map(p => ({
        module: p.module,
        actions: { ...p.actions }
      }))
    };
    this.isEditing = true;
  }

  deleteRole(role: UserRole) {
    this.confirmationService.confirm({
      message: `¿Está seguro que desea eliminar el rol "${role.name}"?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'No, cancelar',
      accept: () => {
        if (!role._id) {
          console.error('No se pudo obtener el ID del rol');
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo obtener el ID del rol'
          });
          return;
        }

        this.userRolesService.deleteRole(role._id).subscribe({
          next: () => {
            console.log('Rol eliminado con éxito');
            const index = this.roles.findIndex(r => r._id === role._id);
            if (index !== -1) {
              this.roles.splice(index, 1);
            }
            this.messageService.add({
              severity: 'success',
              summary: 'Rol eliminado',
              detail: `El rol "${role.name}" ha sido eliminado correctamente`
            });
          },
          error: (error: unknown) => {
            console.error('Error deleting role:', error);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'No se pudo eliminar el rol'
            });
          }
        });
      }
    });
  }

  cancelEdit() {
    this.selectedRole = null;
    this.isEditing = false;
    this.roleForm = {
      _id: '',
      name: '',
      description: '',
      status: 'active',
      privileges: this.availableModules.map(module => ({
        module: module,
        actions: {
          read: false,
          update: false,
          create: false,
          delete: false
        }
      }))
    };
  }

  getPrivilegeByModule(privileges: Privilege[], module: string): Privilege | undefined {
    return privileges.find(p => p.module === module);
  }

  toggleAllPrivileges(privilege: Privilege) {
    const allChecked = Object.values(privilege.actions).every(value => value === true);
    const newValue = !allChecked;
    
    Object.keys(privilege.actions).forEach(action => {
      privilege.actions[action as keyof typeof privilege.actions] = newValue;
    });
  }

  isAllSelected(privilege: Privilege): boolean {
    return Object.values(privilege.actions).every(value => value === true);
  }

  toggleAllModulesPrivileges() {
    const allChecked = this.roleForm.privileges.every(privilege => 
      Object.values(privilege.actions).every(value => value === true)
    );
    
    const newValue = !allChecked;
    
    this.roleForm.privileges.forEach(privilege => {
      Object.keys(privilege.actions).forEach(action => {
        privilege.actions[action as keyof typeof privilege.actions] = newValue;
      });
    });
  }

  isAllModulesSelected(): boolean {
    return this.roleForm.privileges.every(privilege => 
      Object.values(privilege.actions).every(value => value === true)
    );
  }
}
