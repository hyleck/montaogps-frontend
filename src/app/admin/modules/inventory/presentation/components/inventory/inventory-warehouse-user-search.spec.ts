import { of, throwError } from 'rxjs';
import { InventoryComponent } from './inventory.component';

describe('Inventory warehouse user search', () => {
  let component: InventoryComponent;
  let userService: {
    getMainAccount: jasmine.Spy;
    search: jasmine.Spy;
  };
  let messageService: { add: jasmine.Spy };

  beforeEach(() => {
    component = Object.create(InventoryComponent.prototype);
    userService = {
      getMainAccount: jasmine.createSpy('getMainAccount'),
      search: jasmine.createSpy('search'),
    };
    messageService = { add: jasmine.createSpy('add') };
    (component as any).userService = userService;
    (component as any).messageService = messageService;
    component.warehouseUserSearchTerm = 'ana@example.com';
    component.warehouseUserSearchResults = [];
    component.isSearchingWarehouseUsers = false;
  });

  it('searches within the configured main account', async () => {
    const user = { _id: 'user-1', email: 'ana@example.com' } as any;
    userService.getMainAccount.and.returnValue(of({
      account: { _id: '507f1f77bcf86cd799439011' },
    }));
    userService.search.and.returnValue(of({ users: [user], totalCount: 1 }));

    await component.searchWarehouseAccessUsers();

    expect(userService.search).toHaveBeenCalledOnceWith(
      'ana@example.com',
      '507f1f77bcf86cd799439011',
      0,
      15,
    );
    expect(component.warehouseUserSearchResults).toEqual([user]);
    expect(component.isSearchingWarehouseUsers).toBeFalse();
    expect(messageService.add).not.toHaveBeenCalled();
  });

  it('reports the error and does not search without a main account', async () => {
    userService.getMainAccount.and.returnValue(throwError(() => new Error('No configurada')));

    await component.searchWarehouseAccessUsers();

    expect(userService.search).not.toHaveBeenCalled();
    expect(component.warehouseUserSearchResults).toEqual([]);
    expect(component.isSearchingWarehouseUsers).toBeFalse();
    expect(messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({
      severity: 'error',
      summary: 'Error',
    }));
  });
});
