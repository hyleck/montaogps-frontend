import { InventoryComponent } from './inventory.component';

/**
 * Cualquier empleado registra modelos de GPS; borrarlos queda en las cuentas
 * root, incluso si el empleado conserva el permiso antiguo de borrado.
 */
describe('Permisos de los modelos de GPS', () => {
  const construir = (usuario: any, privilegios: Record<string, boolean> = {}) => {
    const component: InventoryComponent = Object.create(InventoryComponent.prototype);
    Object.assign(component, {
      authService: {
        getCurrentUser: () => usuario,
        isRootUser: () => usuario?.root === true,
        isEmployee: () => String(usuario?.affiliation_type_id || '').trim().toLowerCase() === 'empleado',
        hasPrivilege: (modulo: string, accion: string) => modulo === 'protocols' && privilegios[accion] === true,
      },
    });
    return component;
  };

  it('un empleado sin privilegios puede abrir y registrar, pero no borrar', () => {
    const component = construir({ affiliation_type_id: 'empleado' });
    expect(component.canReadGpsModels()).toBeTrue();
    expect(component.canCreateGpsModels()).toBeTrue();
    expect(component.canDeleteGpsModels()).toBeFalse();
  });

  it('un empleado con el permiso antiguo de borrado tampoco borra', () => {
    const component = construir({ affiliation_type_id: 'empleado' }, { read: true, create: true, update: true, delete: true });
    expect(component.canUpdateGpsModels()).toBeTrue();
    expect(component.canDeleteGpsModels()).toBeFalse();
  });

  it('una cuenta root conserva el borrado', () => {
    const component = construir({ affiliation_type_id: 'empleado', root: true });
    expect(component.canDeleteGpsModels()).toBeTrue();
  });

  it('un técnico o un cliente necesitan el permiso explícito', () => {
    const tecnico = construir({ affiliation_type_id: 'tecnico_empleado' });
    expect(tecnico.canCreateGpsModels()).toBeFalse();
    const tecnicoConPermiso = construir({ affiliation_type_id: 'tecnico_empleado' }, { read: true, create: true });
    expect(tecnicoConPermiso.canCreateGpsModels()).toBeTrue();
    const cliente = construir({ affiliation_type_id: 'cliente' });
    expect(cliente.canReadGpsModels()).toBeFalse();
    expect(cliente.canCreateGpsModels()).toBeFalse();
  });
});
