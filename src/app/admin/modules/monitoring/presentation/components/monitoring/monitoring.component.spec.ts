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

  for (const rejected of [false, true]) {
    it(`${rejected ? 'preserves expiration when Incosis rejects' : 'authorizes before updating'} a massive credit renewal`, async () => {
      const originalDate = '2026-09-29T12:00:00.000Z';
      const device: any = { _id: 'gps-1', name: 'GPS de prueba', expiration_date: originalDate, customRenewalYears: 1 };
      const order: string[] = [];
      const targets = {
        createProcess: jasmine.createSpy().and.callFake(async () => {
          order.push('authorize');
          expect(device.expiration_date).toBe(originalDate);
          if (rejected) throw { status: 409, error: { message: 'El cliente requiere facturación al contado.' } };
          return { _id: 'process-1' };
        }),
        updateTarget: jasmine.createSpy().and.callFake(async () => { order.push('update'); }),
      };
      Object.assign(component as any, { targetsService: targets, authService: { getCurrentUser: () => ({ id: 'operator' }) }, messageService: { add: jasmine.createSpy() } });
      component.monitoringResult = {} as any;
      component.massiveProcessDevices = [device];
      component.processForm.type = 'renewal';
      spyOnProperty(component, 'filteredMonitoringData', 'get').and.returnValue([]);
      spyOn(window, 'confirm').and.returnValue(true);
      await component.executeMassiveProcess();
      expect(order).toEqual(rejected ? ['authorize'] : ['authorize', 'update']);
      expect(device.expiration_date).toBe(rejected ? originalDate : '2027-09-29');
      expect(targets.createProcess.calls.mostRecent().args[0].type).toBe(4);
    });
  }

  it('formats the report creator name while preserving their stored identity and email', () => {
    const creator = { name: 'mARÍA', last_name: 'PÉREZ', email: 'MPerez@Example.COM' };
    expect(component.getStatusCreatorLabel({ creator } as any)).toBe('María Pérez (MPerez@Example.COM)');
    expect(creator.name).toBe('mARÍA');
    expect(creator.last_name).toBe('PÉREZ');
    expect(component.getStatusCreatorLabel({ creator: { email: creator.email } } as any)).toBe(creator.email);
  });

  it('dates a localized device from the retained fix while communication advances', () => {
    component.protocols = [{ _id: 'tag', isAirtag: true }] as any;
    spyOn(Date, 'now').and.returnValue(Date.parse('2026-09-28T14:24:00Z'));
    const formatter = spyOn<any>(component, 'formatOfflineDuration').and.callFake((date: Date) => date.toISOString());
    const target = {
      _id: 'gps', type: 'tag',
      traccarInfo: {
        status: 'Localizado', lastUpdate: '2026-09-28T13:52:00Z',
        geolocation: { valid: true, latitude: 19.63116, longitude: -70.28124, fixTime: '2026-09-28T13:52:00Z' },
      },
    };
    expect(component.getConnectionDisplay(target)).toBe('2026-09-28T13:52:00.000Z');
    target.traccarInfo.lastUpdate = '2026-09-28T14:24:00Z';
    target.traccarInfo.geolocation = { valid: false, latitude: 0, longitude: 0, fixTime: '2026-09-28T14:24:00Z' };
    expect(component.getConnectionDisplay(target)).toBe('2026-09-28T13:52:00.000Z');
    expect(formatter.calls.mostRecent().args[1]).toBeTrue();
    expect(target.traccarInfo.lastUpdate).toBe('2026-09-28T14:24:00Z');
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
