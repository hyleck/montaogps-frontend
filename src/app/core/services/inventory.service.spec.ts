import { of } from 'rxjs';
import {
  InventoryService,
  UnregisteredInventorySimAlertResponse,
} from './inventory.service';

describe('InventoryService alert counts', () => {
  it('publishes the total GPS devices with an unregistered SIM', () => {
    const response: UnregisteredInventorySimAlertResponse = {
      data: [],
      total: 4,
      page: 1,
      lastPage: 1,
    };
    const http = {
      get: jasmine.createSpy('get').and.returnValue(of(response)),
    };
    const service = new InventoryService(http as any);
    let latestCount = 0;
    service.unregisteredSimAlertCount$.subscribe(count => {
      latestCount = count;
    });

    service.getWarehouseDevicesWithUnregisteredSimcards(1, 1).subscribe();

    expect(latestCount).toBe(4);
    expect(http.get).toHaveBeenCalledWith(
      jasmine.stringMatching('/inventory/alerts/unregistered-simcards\\?page=1&limit=1$'),
    );
  });
});
