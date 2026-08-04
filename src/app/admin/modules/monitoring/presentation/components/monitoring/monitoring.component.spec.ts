import { MonitoringComponent } from './monitoring.component';

describe('MonitoringComponent', () => {
  let component: MonitoringComponent;

  beforeEach(() => {
    component = new MonitoringComponent(
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('combines only initial-state and strictly offline devices', () => {
    const devices = [
      { _id: 'initial', traccarInfo: { status: 'offline', lastUpdate: 'never' } },
      { _id: 'offline', traccarInfo: { status: 'offline', lastUpdate: '2020-01-01T00:00:00.000Z' } },
      { _id: 'online', traccarInfo: { status: 'online', lastUpdate: new Date().toISOString() } },
      { _id: 'weak', traccarInfo: { status: 'offline', lastUpdate: new Date(Date.now() - 30 * 60 * 1000).toISOString() } },
      { _id: 'located', traccarInfo: { status: 'Localizado', lastUpdate: '2020-01-01T00:00:00.000Z' } },
      { _id: 'not-located', traccarInfo: { status: 'No localizado', lastUpdate: '2020-01-01T00:00:00.000Z' } }
    ];

    component.monitoringResult = {
      data: [{ user: {} as any, route: [], devices }]
    } as any;
    component.selectedConnectionFilter = 'initial-or-offline';

    const filteredIds = component.filteredMonitoringData
      .flatMap(group => group.devices)
      .map(device => device._id);

    expect(filteredIds).toEqual(['initial', 'offline']);
  });

  it('keeps initial-state and offline categories mutually exclusive', () => {
    const initial = { traccarInfo: { status: 'offline', lastUpdate: null } };
    const offline = { traccarInfo: { status: 'offline', lastUpdate: '2020-01-01T00:00:00.000Z' } };

    expect(component.isDeviceInitialState(initial)).toBeTrue();
    expect(component.isDeviceOffline(initial)).toBeFalse();
    expect(component.isDeviceInitialState(offline)).toBeFalse();
    expect(component.isDeviceOffline(offline)).toBeTrue();
  });
});
