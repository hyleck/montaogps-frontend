import { BreadcrumbService } from './breadcrumb.service';
import { ManagementService } from './management.service';

describe('BreadcrumbService', () => {
  let managementService: jasmine.SpyObj<ManagementService>;
  let service: BreadcrumbService;

  beforeEach(() => {
    managementService = jasmine.createSpyObj<ManagementService>(
      'ManagementService',
      ['setOp'],
    );
    service = new BreadcrumbService(managementService);
  });

  it('navigates to the actual parent from the loaded hierarchy', () => {
    service.updateFromUserPath([
      { id: 'root', fullName: 'Cuenta principal' },
      { id: 'parent', fullName: 'Distribuidor' },
      { id: 'child', fullName: 'Cliente' },
    ]);

    expect(service.canNavigateBack()).toBeTrue();
    service.navigateToParent();
    expect(managementService.setOp).toHaveBeenCalledOnceWith('u', 'parent');
  });

  it('does not show or execute back navigation at the hierarchy root', () => {
    service.updateFromUserPath([
      { id: 'root', fullName: 'Cuenta principal' },
    ]);

    expect(service.canNavigateBack()).toBeFalse();
    service.navigateToParent();
    expect(managementService.setOp).not.toHaveBeenCalled();
  });

  it('does not expose ancestors above the authenticated user', () => {
    const items = service.updateFromUserPath([
      { id: 'owner', fullName: 'Cuenta superior' },
      { id: 'viewer', fullName: 'Usuario autenticado' },
      { id: 'child', fullName: 'Cliente' },
    ], undefined, { id: 'viewer' });

    expect(items.map((item) => item.label)).toEqual([
      'Usuario autenticado',
      'Cliente',
    ]);
    service.navigateToParent();
    expect(managementService.setOp).toHaveBeenCalledOnceWith('u', 'viewer');
  });

  it('does not expose ancestors above an authenticated root account', () => {
    const items = service.updateFromUserPath([
      { id: 'owner', fullName: 'Cuenta superior' },
      { id: 'viewer', fullName: 'Cuenta root autenticada' },
      { id: 'child', fullName: 'Cliente' },
    ], undefined, { id: 'viewer', root: true, developer: true });

    expect(items.map((item) => item.label)).toEqual([
      'Cuenta root autenticada',
      'Cliente',
    ]);
  });

  it('shows the authenticated employee before an external shared route', () => {
    const items = service.updateFromUserPath([
      { id: 'owner', fullName: 'Cuenta superior' },
      {
        id: 'shared',
        fullName: 'Cuenta compartida',
        profile_type_id: 'compartido',
      },
      { id: 'child', fullName: 'Cliente' },
    ], undefined, {
      id: 'employee',
      name: 'Ericka',
      last_name: 'Tatis Reyes',
      affiliation_type_id: 'empleado',
    });

    expect(items.map((item) => item.label)).toEqual([
      'Ericka Tatis Reyes',
      'Cuenta compartida',
      'Cliente',
    ]);
    items[0].command?.({} as any);
    expect(managementService.setOp).toHaveBeenCalledOnceWith('u', 'employee');
  });

  it('does not duplicate an employee already present in the hierarchy', () => {
    const items = service.updateFromUserPath([
      { id: 'employee', fullName: 'Ericka Tatis Reyes' },
      { id: 'child', fullName: 'Cliente' },
    ], undefined, {
      id: 'employee',
      name: 'Ericka',
      last_name: 'Tatis Reyes',
      affiliation_type_id: 'empleado',
    });

    expect(items.map((item) => item.label)).toEqual([
      'Ericka Tatis Reyes',
      'Cliente',
    ]);
  });

  it('keeps the viewer but does not restore unauthorized ancestors', () => {
    const items = service.updateFromUserPath([
      { id: 'owner', fullName: 'Cuenta superior' },
      { id: 'child', fullName: 'Cliente' },
    ], undefined, {
      id: 'viewer',
      name: 'Usuario',
      last_name: 'Autenticado',
      affiliation_type_id: 'cliente',
    });

    expect(items.map((item) => item.label)).toEqual([
      'Usuario Autenticado',
      'Cliente',
    ]);
    expect(items.map((item) => item.label)).not.toContain('Cuenta superior');
  });
});
