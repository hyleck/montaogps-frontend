import { SidebarComponent } from './sidebar.component';

describe('SidebarComponent inventory badge', () => {
  function createComponent(): SidebarComponent {
    return new SidebarComponent(
      { getState: () => true } as any,
      {} as any,
      {} as any,
      { instant: (key: string) => key } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { detectChanges: jasmine.createSpy('detectChanges') } as any,
    );
  }

  it('adds low-stock and unregistered-SIM alerts in the inventory badge', () => {
    const component = createComponent();
    const inventoryItem = component.sidaberOptions.principalItems.find(
      item => item.path === '/admin/inventory',
    );

    (component as any).inventoryLowStockCount = 2;
    (component as any).inventoryUnregisteredSimCount = 3;
    (component as any).refreshInventoryBadge();

    expect(inventoryItem?.badge).toBe(5);
    expect((inventoryItem as any)?.attention).toBeTrue();
  });

  it('shows Comprobantes to employees and hides it from external clients', () => {
    const component = createComponent();
    const hasReceipts = () => component.filteredPrincipalItems
      .some(item => item.path === '/admin/comprobantes');

    (component as any).isEmployeeUser = true;
    expect(hasReceipts()).toBeTrue();

    (component as any).isEmployeeUser = false;
    component.currentUser = { root: false } as any;
    expect(hasReceipts()).toBeFalse();
  });
});
