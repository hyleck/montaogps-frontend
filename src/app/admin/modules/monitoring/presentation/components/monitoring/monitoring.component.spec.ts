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

  it('orders each client devices by installation date for the Excel export', () => {
    const firstClientDevices = [
      { _id: 'newest', name: 'Vehículo nuevo', activation_date: '2026-08-20T12:00:00.000Z' },
      { _id: 'without-date', name: 'Vehículo sin fecha' },
      { _id: 'oldest', name: 'Vehículo antiguo', activation_date: '2024-01-10T12:00:00.000Z' }
    ];
    const secondClientDevices = [
      { _id: 'second-newest', name: 'Segundo nuevo', activation_date: '2025-12-01' },
      { _id: 'second-oldest', name: 'Segundo antiguo', installation_date: '2025-02-01' }
    ];

    component.monitoringResult = {
      data: [
        { user: {} as any, route: [], devices: firstClientDevices },
        { user: {} as any, route: [], devices: secondClientDevices }
      ]
    } as any;

    const exportData = (component as any).getExcelMonitoringData();

    expect(exportData[0].devices.map((device: any) => device._id)).toEqual([
      'oldest',
      'newest',
      'without-date'
    ]);
    expect(exportData[1].devices.map((device: any) => device._id)).toEqual([
      'second-oldest',
      'second-newest'
    ]);
    expect(firstClientDevices.map(device => device._id)).toEqual([
      'newest',
      'without-date',
      'oldest'
    ]);
  });
});
