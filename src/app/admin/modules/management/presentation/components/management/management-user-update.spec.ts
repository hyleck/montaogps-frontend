import { ManagementComponent } from './management.component';

describe('Management saved user refresh', () => {
  let component: any;

  beforeEach(() => {
    component = Object.create(ManagementComponent.prototype);
    component.selectedUser = {
      _id: 'parent-1',
      name: 'Nombre anterior',
      dni: '00112345678',
      phone2: '8295550101',
      affiliation_type_id: 'empleado',
    };
    component.userToEdit = component.selectedUser;
    component.pendingCreateUserTransferTargets = [];
    component.uiService = { hideUserForm: jasmine.createSpy('hideUserForm') };
    component.loadUsersForUser = jasmine.createSpy('loadUsersForUser').and.resolveTo();
    component.loadUserPath = jasmine.createSpy('loadUserPath');
    component.transferPendingTargetsToCreatedUser = jasmine.createSpy('transferPendingTargetsToCreatedUser').and.resolveTo();
  });

  it('updates the open account with confirmed data and removes cleared fields', async () => {
    const savedUser = {
      _id: 'parent-1',
      name: 'Nombre actualizado',
      dni: '00287654321',
      affiliation_type_id: 'empleado',
    };

    await component.onUserCreated(savedUser);

    expect(component.selectedUser).toEqual(savedUser);
    expect(component.selectedUser.phone2).toBeUndefined();
    expect(component.loadUserPath).toHaveBeenCalledOnceWith('parent-1');
    expect(component.loadUsersForUser).toHaveBeenCalledOnceWith('parent-1');
    expect(component.userToEdit).toBeNull();
  });

  it('refreshes child cards without replacing the open parent account', async () => {
    const parent = component.selectedUser;

    await component.onUserCreated({ _id: 'child-1', name: 'Hijo actualizado' });

    expect(component.selectedUser).toBe(parent);
    expect(component.loadUserPath).not.toHaveBeenCalled();
    expect(component.loadUsersForUser).toHaveBeenCalledOnceWith('parent-1');
  });

  it('preserves the transfer flow when creating a destination account', async () => {
    const createdUser = { _id: 'child-1', name: 'Cuenta nueva' };
    component.pendingCreateUserTransferTargets = [{ _id: 'gps-1' }];

    await component.onUserCreated(createdUser);

    expect(component.transferPendingTargetsToCreatedUser).toHaveBeenCalledOnceWith(
      createdUser, [{ _id: 'gps-1' }],
    );
    expect(component.loadUsersForUser).not.toHaveBeenCalled();
  });
});
