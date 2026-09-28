import { fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ProcessItem } from '../../services/processes.service';
import { ProcessesComponent } from './processes.component';

describe('ProcessesComponent installation detail', () => {
  const deviceId = '507f1f77bcf86cd799439011';
  const otherDeviceId = '507f1f77bcf86cd799439022';
  const imei = '863874080932787';
  let component: ProcessesComponent;
  let targets: jasmine.SpyObj<any>;
  let auth: jasmine.SpyObj<any>;
  let tags: jasmine.SpyObj<any>;
  let contacts: jasmine.SpyObj<any>;

  function process(type = 1, target: any = { _id: deviceId, device_imei: imei, name: 'Nombre registrado' }): ProcessItem {
    return {
      _id: 'process-1', type, description: 'Instalación', target, reference: deviceId,
      user: { _id: 'client' }, before: { target_plate_number: 'ANTERIOR' },
      after: { target_plate_number: 'HISTORICA' }, creator: 'employee',
      registrationDate: '2026-09-28T00:00:00Z', createdAt: '2026-09-28T14:00:00Z', updatedAt: '2026-09-28T14:00:00Z',
    };
  }

  function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: any) => void;
    const promise = new Promise<T>((success, failure) => { resolve = success; reject = failure; });
    return { promise, resolve, reject };
  }

  beforeEach(() => {
    targets = jasmine.createSpyObj('TargetsService', ['getTargetById', 'getTargetByImei', 'getDeviceRecords']);
    targets.getTargetById.and.callFake((id: string) => Promise.resolve({ _id: id, device_imei: imei }));
    targets.getTargetByImei.and.resolveTo({ _id: deviceId, device_imei: imei });
    targets.getDeviceRecords.and.resolveTo({ deviceId, imei, entries: [] });
    auth = jasmine.createSpyObj('AuthService', ['getCurrentUser']);
    auth.getCurrentUser.and.returnValue({ affiliation_type_id: 'empleado' });
    tags = jasmine.createSpyObj('TagsService', ['getTagById']);
    tags.getTagById.and.returnValue(of(null));
    contacts = jasmine.createSpyObj('ContactsService', ['getAll']);
    contacts.getAll.and.returnValue(of([]));
    component = new ProcessesComponent(
      {} as any, {} as any, {} as any, {} as any, {} as any,
      jasmine.createSpyObj('MessageService', ['add']), targets, auth, tags, contacts,
    );
  });

  [1, 18].forEach(type => {
    it(`loads current device data when opening installation type ${type}`, fakeAsync(() => {
      const item = process(type);
      component.showDetail(item);
      expect(component.detailDialogVisible).toBeTrue();
      expect(component.installationTargetLoading).toBeTrue();
      expect(targets.getTargetById).toHaveBeenCalledOnceWith(deviceId);
      expect(targets.getDeviceRecords).not.toHaveBeenCalled();
      flushMicrotasks();
      expect(component.installationTarget._id).toBe(deviceId);
      expect(component.installationTargetLoading).toBeFalse();
      expect(component.installationTargetError).toBe('');
    }));
  });

  it('keeps other process types on their existing detail view', () => {
    component.showDetail(process(9));
    expect(component.isInstallationProcess).toBeFalse();
    expect(component.detailSimpleChangeRows.length).toBe(1);
    expect(targets.getTargetById).not.toHaveBeenCalled();
    expect(targets.getTargetByImei).not.toHaveBeenCalled();
    expect(component.canViewDeviceRecords).toBeFalse();
  });

  it('resolves vehicle and GPS catalogs and merges current fields without rewriting the historical process', fakeAsync(() => {
    const snapshot = process(1, {
      _id: deviceId, device_imei: imei, name: 'Nombre registrado',
      target_plate_number: 'HISTORICA', description: 'Descripción registrada', target_year: '2020',
    });
    const original = JSON.stringify(snapshot);
    Object.freeze(snapshot.target);
    const current = {
      _id: deviceId, device_imei: imei, name: 'Camión actual', target_brand_id: 'brand', target_model_id: 'model',
      target_color: '#fff', target_plate_number: 'ACTUAL', target_chassis_number: 'CHASIS-1',
      description: undefined, contacts: [{ name: 'Contacto principal' }],
      type: 'protocol', sim_card_number: '8095550123', sim_company: 'Claro', ignition_sensor: 'ignition',
      engine_shutdown: 'yes', traccarInfo: { status: 'online' }, status: true,
      activation_date: '2026-09-28T14:00:00Z', expiration_date: '2027-09-28T14:00:00Z',
      service_plan: { name: 'Plan anual' }, tag: { name: 'Flota' },
    };
    targets.getTargetById.and.resolveTo(current);
    contacts.getAll.and.returnValue(of([{ full_name: 'Contacto principal', phone: '8095550180', relationship: 'Propietario', reference: deviceId }]));
    component.brandsMap = { brand: 'Isuzu' };
    component.modelsMap = { model: 'NPR' };
    component.colorsMap = { '#fff': 'Blanco' };
    component.gpsModelsMap = { protocol: 'GT06' };
    component.showDetail(snapshot);
    flushMicrotasks();

    const vehicle = Object.fromEntries(component.installationVehicleFields.map(field => [field.label, field.value]));
    const gps = Object.fromEntries(component.installationGpsFields.map(field => [field.label, field.value]));
    expect(vehicle).toEqual(jasmine.objectContaining({
      'Nombre del objetivo': 'Camión actual', Marca: 'Isuzu', Modelo: 'NPR', 'Año': '2020', Color: 'Blanco',
      Placa: 'ACTUAL', Chasis: 'CHASIS-1', 'Descripción': 'Descripción registrada',
    }));
    expect(gps).toEqual(jasmine.objectContaining({
      'IMEI / ID del GPS': imei, 'Modelo GPS': 'GT06', 'SIM card': '8095550123',
      'Proveedor de SIM': 'Claro', 'Sensor de ignición': 'ignition', 'Apagado de motor': 'Sí',
      'Conexión': 'En línea', 'Estado del objetivo': 'Activo', 'Plan de servicio': 'Plan anual', Etiqueta: 'Flota',
    }));
    expect(gps['Fecha de instalación']).toContain('2026');
    expect(gps['Fecha de expiración']).toContain('2027');
    expect(vehicle['Contactos']).toContain('Contacto principal');
    expect(vehicle['Contactos']).toContain('8095550180');
    expect(JSON.stringify(snapshot)).toBe(original);
    expect(component.detailSimpleChangeRows[0].after).toBe('HISTORICA');
  }));

  it('resolves a legacy process by exact IMEI and uses the returned Mongo ID for records', fakeAsync(() => {
    const item = { ...process(18, { _id: imei, device_imei: imei }), reference: imei };
    component.showDetail(item);
    flushMicrotasks();
    expect(targets.getTargetById).not.toHaveBeenCalled();
    expect(targets.getTargetByImei).toHaveBeenCalledOnceWith(imei);
    expect(component.recordsDeviceId).toBe(deviceId);
    component.toggleDeviceRecords();
    flushMicrotasks();
    expect(targets.getDeviceRecords).toHaveBeenCalledOnceWith(deviceId);
  }));

  it('rejects an IMEI lookup that returns a different device', fakeAsync(() => {
    targets.getTargetByImei.and.resolveTo({ _id: otherDeviceId, device_imei: '863874080932788' });
    component.showDetail({ ...process(1, { _id: '', device_imei: imei }), reference: imei });
    flushMicrotasks();
    expect(component.installationTarget).toBeNull();
    expect(component.installationTargetError).toContain('corresponda');
    expect(component.recordsDeviceId).toBe('');
    component.toggleDeviceRecords();
    expect(targets.getDeviceRecords).not.toHaveBeenCalled();
  }));

  it('rejects a device ID lookup with a different returned ID', fakeAsync(() => {
    targets.getTargetById.and.resolveTo({ _id: otherDeviceId, device_imei: imei });
    component.showDetail(process());
    flushMicrotasks();
    expect(component.installationTarget).toBeNull();
    expect(component.installationTargetError).toContain('corresponda');
    expect(component.installationData.name).toBe('Nombre registrado');
  }));

  it('retains the historical snapshot with an explicit error if the current target cannot be loaded', fakeAsync(() => {
    targets.getTargetById.and.rejectWith({ status: 404, error: { message: 'Objetivo no encontrado.' } });
    component.showDetail(process());
    flushMicrotasks();
    expect(component.installationTargetError).toBe('Objetivo no encontrado.');
    expect(component.installationTargetLoading).toBeFalse();
    expect(component.installationData.name).toBe('Nombre registrado');
    expect(component.installationValue('unknown')).toBe('Sin registrar');
  }));

  it('does not replace a new process with the response of an earlier selection', fakeAsync(() => {
    const pending = deferred<any>();
    targets.getTargetById.and.callFake((id: string) => id === deviceId
      ? pending.promise : Promise.resolve({ _id: otherDeviceId, name: 'Segundo vehículo' }));
    component.showDetail(process());
    const second = { ...process(18, { _id: otherDeviceId }), _id: 'process-2', reference: otherDeviceId };
    component.showDetail(second);
    flushMicrotasks();
    pending.resolve({ _id: deviceId, name: 'Respuesta anterior' });
    flushMicrotasks();
    expect(component.selectedProcess).toBe(second);
    expect(component.installationTarget.name).toBe('Segundo vehículo');
    expect(component.installationTargetError).toBe('');
  }));

  it('ignores late failures after closing the installation detail', fakeAsync(() => {
    const pending = deferred<any>();
    targets.getTargetById.and.returnValue(pending.promise);
    component.showDetail(process());
    component.closeDetail();
    pending.reject({ status: 500, error: { message: 'Respuesta tardía' } });
    flushMicrotasks();
    expect(component.selectedProcess).toBeNull();
    expect(component.installationTarget).toBeNull();
    expect(component.installationTargetLoading).toBeFalse();
    expect(component.installationTargetError).toBe('');
    expect(component.detailDialogVisible).toBeFalse();
  }));

  it('allows records only for employees viewing an installation with a known device ID', fakeAsync(() => {
    component.showDetail(process());
    flushMicrotasks();
    for (const affiliation_type_id of ['admin', 'cliente', undefined]) {
      auth.getCurrentUser.and.returnValue({ affiliation_type_id });
      component.toggleDeviceRecords();
      expect(component.deviceRecordsVisible).toBeFalse();
    }
    expect(targets.getDeviceRecords).not.toHaveBeenCalled();
    auth.getCurrentUser.and.returnValue({ affiliation_type_id: 'empleado' });
    component.toggleDeviceRecords();
    expect(component.deviceRecordsLoading).toBeTrue();
    flushMicrotasks();
    expect(component.deviceRecordsVisible).toBeTrue();
    expect(component.deviceRecordsLoading).toBeFalse();
    expect(targets.getDeviceRecords).toHaveBeenCalledOnceWith(deviceId);
  }));

  it('rejects a history response belonging to a different device', fakeAsync(() => {
    targets.getDeviceRecords.and.resolveTo({ deviceId: otherDeviceId, entries: [{ title: 'Registro ajeno' }] });
    component.showDetail(process());
    flushMicrotasks();
    component.toggleDeviceRecords();
    flushMicrotasks();
    expect(component.deviceRecords).toEqual([]);
    expect(component.deviceRecordsError).toContain('no corresponde');
    expect(component.deviceRecordsLoading).toBeFalse();
  }));

  it('distinguishes a records failure from an empty result and clears the error after retry', fakeAsync(() => {
    targets.getDeviceRecords.and.rejectWith({ status: 403, error: { message: 'Solo empleados autorizados.' } });
    component.showDetail(process());
    flushMicrotasks();
    component.toggleDeviceRecords();
    flushMicrotasks();
    expect(component.deviceRecords).toEqual([]);
    expect(component.deviceRecordsError).toBe('Solo empleados autorizados.');
    targets.getDeviceRecords.and.resolveTo({ deviceId, imei, entries: [] });
    void component.loadDeviceRecords();
    flushMicrotasks();
    expect(component.deviceRecordsError).toBe('');
    expect(component.deviceRecords).toEqual([]);
  }));

  it('ignores records resolved after switching to another process', fakeAsync(() => {
    const pending = deferred<any>();
    targets.getDeviceRecords.and.returnValue(pending.promise);
    component.showDetail(process());
    flushMicrotasks();
    component.toggleDeviceRecords();
    component.showDetail({ ...process(18, { _id: otherDeviceId }), _id: 'process-2', reference: otherDeviceId });
    flushMicrotasks();
    pending.resolve({ deviceId, entries: [{ title: 'Registro anterior' }] });
    flushMicrotasks();
    expect(component.deviceRecords).toEqual([]);
    expect(component.deviceRecordsVisible).toBeFalse();
    expect(component.deviceRecordsLoading).toBeFalse();
    expect(component.deviceRecordsError).toBe('');
    expect(component.recordsDeviceId).toBe(otherDeviceId);
  }));

  it('ignores records resolved after the detail is closed', fakeAsync(() => {
    const pending = deferred<any>();
    targets.getDeviceRecords.and.returnValue(pending.promise);
    component.showDetail(process());
    flushMicrotasks();
    component.toggleDeviceRecords();
    component.closeDetail();
    pending.resolve({ deviceId, entries: [{ title: 'Registro tardío' }] });
    flushMicrotasks();
    expect(component.deviceRecords).toEqual([]);
    expect(component.deviceRecordsLoading).toBeFalse();
    expect(component.deviceRecordsError).toBe('');
    expect(component.deviceRecordsVisible).toBeFalse();
  }));

  it('loads the current contacts and tag label by the accepted device identity', fakeAsync(() => {
    const tagId = '507f1f77bcf86cd799439033';
    targets.getTargetById.and.resolveTo({ _id: deviceId, device_imei: imei, tag: tagId });
    tags.getTagById.and.returnValue(of({ _id: tagId, name: 'Flota refrigerada' }));
    contacts.getAll.and.returnValue(of([{ full_name: 'Contacto actual', phone: '8095550189', relationship: 'Propietario', reference: deviceId }]));
    const item = process(1, { _id: deviceId, device_imei: imei, contacts: [{ name: 'Contacto antiguo' }] });
    component.showDetail(item);
    flushMicrotasks();
    expect(contacts.getAll).toHaveBeenCalledOnceWith(deviceId);
    expect(tags.getTagById).toHaveBeenCalledOnceWith(tagId);
    const contact = component.installationVehicleFields.find(field => field.label === 'Contactos')!.value;
    expect(contact).toContain('Contacto actual');
    expect(contact).toContain('8095550189');
    expect(contact).toContain('Propietario');
    expect(contact).not.toContain('Contacto antiguo');
    expect(component.installationGpsFields.find(field => field.label === 'Etiqueta')?.value).toBe('Flota refrigerada');
    expect(item.target['contacts'][0].name).toBe('Contacto antiguo');
  }));

  it('reports a contact request failure without hiding the accepted vehicle data', fakeAsync(() => {
    contacts.getAll.and.returnValue(throwError(() => ({ status: 500, error: { message: 'No se pudieron consultar los contactos.' } })));
    component.showDetail(process());
    flushMicrotasks();
    expect(component.installationTarget._id).toBe(deviceId);
    expect(component.installationTargetError).toBe('');
    expect(component.installationContactsLoading).toBeFalse();
    expect(component.installationContactsError).toContain('No se pudieron consultar los contactos.');
  }));

  it('does not apply stale contact data after selecting a different installation', fakeAsync(() => {
    const pending = new Subject<any[]>();
    contacts.getAll.and.callFake((id: string) => id === deviceId ? pending : of([
      { full_name: 'Contacto del segundo GPS', phone: '8095550190', relationship: 'Chofer', reference: otherDeviceId },
    ]));
    component.showDetail(process());
    flushMicrotasks();
    component.showDetail({ ...process(18, { _id: otherDeviceId }), _id: 'process-2', reference: otherDeviceId });
    flushMicrotasks();
    pending.next([{ full_name: 'Contacto tardío', phone: '8095550000', relationship: 'Chofer', reference: deviceId }]);
    pending.complete();
    flushMicrotasks();
    const contact = component.installationVehicleFields.find(field => field.label === 'Contactos')!.value;
    expect(contact).toContain('Contacto del segundo GPS');
    expect(contact).not.toContain('Contacto tardío');
    expect(component.installationContactsError).toBe('');
  }));

  it('ignores contact data delivered after the dialog closes', fakeAsync(() => {
    const pending = new Subject<any[]>();
    contacts.getAll.and.returnValue(pending);
    component.showDetail(process());
    flushMicrotasks();
    component.closeDetail();
    pending.next([{ full_name: 'Contacto tardío', phone: '8095550000', relationship: 'Chofer', reference: deviceId }]);
    pending.complete();
    flushMicrotasks();
    expect(component.installationContacts).toBeNull();
    expect(component.installationContactsError).toBe('');
    expect(component.installationContactsLoading).toBeFalse();
  }));

  it('rejects contacts belonging to another target without hiding the current GPS', fakeAsync(() => {
    contacts.getAll.and.returnValue(of([{ full_name: 'Contacto ajeno', phone: '8095550189', relationship: 'Chofer', reference: otherDeviceId }]));
    component.showDetail(process());
    flushMicrotasks();
    expect(component.installationContacts).toBeNull();
    expect(component.installationContactsError).toContain('no corresponden');
    expect(component.installationTarget._id).toBe(deviceId);
  }));

  it('keeps vehicle and contact data available when the tag catalog fails', fakeAsync(() => {
    targets.getTargetById.and.resolveTo({ _id: deviceId, device_imei: imei, tag: '507f1f77bcf86cd799439033' });
    tags.getTagById.and.returnValue(throwError(() => ({ status: 500 })));
    component.showDetail(process());
    flushMicrotasks();
    expect(component.installationTarget._id).toBe(deviceId);
    expect(component.installationTargetError).toBe('');
    expect(component.installationContacts).toEqual([]);
    expect(component.installationTagValue).toBe('Etiqueta no disponible');
  }));

  it('ignores a tag catalog response after selecting a different device', fakeAsync(() => {
    const tagId = '507f1f77bcf86cd799439033';
    const pending = new Subject<any>();
    targets.getTargetById.and.callFake((id: string) => Promise.resolve({
      _id: id, device_imei: imei, tag: id === deviceId ? tagId : { name: 'Segunda flota' },
    }));
    tags.getTagById.and.returnValue(pending);
    component.showDetail(process());
    flushMicrotasks();
    component.showDetail({ ...process(18, { _id: otherDeviceId }), _id: 'process-2', reference: otherDeviceId });
    flushMicrotasks();
    pending.next({ _id: tagId, name: 'Etiqueta anterior' });
    pending.complete();
    flushMicrotasks();
    expect(component.installationTagValue).toBe('Segunda flota');
    expect(component.installationTagLoading).toBeFalse();
  }));

  it('shows legacy evidence objects and relative image paths with their usable URLs', fakeAsync(() => {
    targets.getTargetById.and.resolveTo({
      _id: deviceId, device_imei: imei,
      target_image: '/uploads/vehicle.jpg',
      chasis_img: { location: 'https://images.example/chassis.jpg' },
      placa_img: { location_cdn: 'https://images.example/plate.jpg' },
      matricula_img: { url: '/uploads/registration.jpg' },
    });
    component.showDetail(process());
    flushMicrotasks();
    const images = Object.fromEntries(component.installationEvidence.map(image => [image.label, image.url]));
    expect(images).toEqual(jasmine.objectContaining({
      'Vehículo': `${environment.apiUrl}/uploads/vehicle.jpg`,
      Chasis: 'https://images.example/chassis.jpg',
      Placa: 'https://images.example/plate.jpg',
      'Matrícula': `${environment.apiUrl}/uploads/registration.jpg`,
    }));
  }));
});
