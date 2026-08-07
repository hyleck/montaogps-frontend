import { of, throwError } from 'rxjs';
import { RevisionComponent } from './revision.component';

describe('RevisionComponent', () => {
  it('loads devices that are pending inspection', () => {
    const inventoryService = {
      getInspectionRequired: jasmine.createSpy('getInspectionRequired').and.returnValue(of({
        data: [{ IMEI: '868720063779593', inspection_reason: 'No entra en línea' }],
        total: 1,
        page: 1,
        lastPage: 1,
      })),
    };
    const component = new RevisionComponent(inventoryService as any);

    component.ngOnInit();

    expect(inventoryService.getInspectionRequired).toHaveBeenCalledWith('', 1, 25);
    expect(component.devices.length).toBe(1);
    expect(component.total).toBe(1);
    expect(component.loading).toBeFalse();
  });

  it('shows a useful error when the inspection list cannot be loaded', () => {
    const inventoryService = {
      getInspectionRequired: jasmine.createSpy('getInspectionRequired').and.returnValue(
        throwError(() => ({ error: { message: 'Inventario no disponible' } })),
      ),
    };
    const component = new RevisionComponent(inventoryService as any);

    component.loadDevices();

    expect(component.error).toBe('Inventario no disponible');
    expect(component.loading).toBeFalse();
  });
});
