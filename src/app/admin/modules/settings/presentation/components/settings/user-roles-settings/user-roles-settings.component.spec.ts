import { of } from 'rxjs';
import { UserRole } from '@core/interfaces/user-role.interface';
import { UserRolesSettingsComponent } from './user-roles-settings.component';

describe('UserRolesSettingsComponent', () => {
  const protectedRole: UserRole = {
    _id: 'cliente-full-id',
    isSystem: true,
    name: 'cliente-full',
    description: 'Rol protegido',
    status: 'active',
    createdAt: new Date(),
    privileges: [],
  };

  function createComponent() {
    const userRolesService = {
      getAllRoles: jasmine.createSpy().and.returnValue(of([])),
      deleteRole: jasmine.createSpy().and.returnValue(of(void 0)),
    };
    const confirmationService = { confirm: jasmine.createSpy() };
    const messageService = { add: jasmine.createSpy() };
    const translate = {
      instant: jasmine.createSpy().and.callFake((key: string) => key),
    };
    const authService = {
      hasPrivilege: jasmine.createSpy().and.returnValue(true),
    };

    const component = new UserRolesSettingsComponent(
      userRolesService as any,
      confirmationService as any,
      messageService as any,
      translate as any,
      authService as any,
    );

    return {
      component,
      userRolesService,
      confirmationService,
      messageService,
    };
  }

  it('recognizes cliente-full as protected even without the system flag', () => {
    const { component } = createComponent();

    expect(
      component.isProtectedRole({ ...protectedRole, isSystem: false }),
    ).toBeTrue();
  });

  it('does not open the delete confirmation for a protected role', () => {
    const {
      component,
      userRolesService,
      confirmationService,
      messageService,
    } = createComponent();

    component.deleteRole(protectedRole);

    expect(confirmationService.confirm).not.toHaveBeenCalled();
    expect(userRolesService.deleteRole).not.toHaveBeenCalled();
    expect(messageService.add).toHaveBeenCalledWith(
      jasmine.objectContaining({ summary: 'Rol protegido' }),
    );
  });
});
