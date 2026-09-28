import { fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ProcessItem } from '../../services/processes.service';
import { ProcessesComponent } from './processes.component';

describe('ProcessesComponent installation detail', () => {
  const deviceId = '507f1f77bcf86cd799439011';
  const otherDeviceId = '507f1f77bcf86cd799439022';
  const imei = '863874080932787';
  const solicitudId = '507f1f77bcf86cd799439044';
  const clientId = '507f1f77bcf86cd799439055';
  const subclientId = '507f1f77bcf86cd799439077';
  let component: ProcessesComponent;
  let targets: jasmine.SpyObj<any>;
  let auth: jasmine.SpyObj<any>;
  let tags: jasmine.SpyObj<any>;
  let contacts: jasmine.SpyObj<any>;
  let solicitudes: jasmine.SpyObj<any>;
  let users: jasmine.SpyObj<any>;
  let processesApi: jasmine.SpyObj<any>;

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
    solicitudes = jasmine.createSpyObj('SolicitudesService', ['getById']);
    solicitudes.getById.and.returnValue(of(null));
    users = jasmine.createSpyObj('UserService', ['getById', 'getUserPath']);
    users.getById.and.returnValue(of(null));
    users.getUserPath.and.returnValue(of([]));
    processesApi = jasmine.createSpyObj('ProcessesService', ['updateVerificationStatus']);
    component = new ProcessesComponent(
      processesApi, users, {} as any, {} as any, {} as any,
      jasmine.createSpyObj('MessageService', ['add']), targets, auth, tags, contacts, solicitudes,
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

  ['target', 'after'].forEach(source => {
    it(`loads the linked installation progress from ${source}, including installation index zero`, fakeAsync(() => {
      const row = { _id: 'installation-0', device_imei: imei, registered_device_id: deviceId, completed: false, brand: 'Isuzu' };
      const solicitud = {
        _id: solicitudId, type: 'instalacion', status: 'in_progress',
        installations: [row, { _id: 'installation-1', device_imei: '863874080932788', registered_device_id: otherDeviceId }],
      };
      solicitudes.getById.and.returnValue(of(solicitud));
      const item = process();
      const link = { solicitud_id: solicitudId, solicitud_installation_index: 0 };
      if (source === 'target') item.target = { ...item.target, ...link };
      else item.after = { ...item.after, ...link };
      component.showDetail(item);
      flushMicrotasks();
      expect(solicitudes.getById).toHaveBeenCalledOnceWith(solicitudId);
      expect(component.installationSolicitud?._id).toBe(solicitudId);
      expect(component.installationProgressRecord).toEqual(row);
      expect(component.installationProgressLoading).toBeFalse();
      expect(component.installationProgressError).toBe('');
    }));
  });

  ['request', 'technician'].forEach(pendingSource => {
    it(`finishes pending ${pendingSource} and owner lookups after changing verification`, fakeAsync(() => {
      const technicianId = '507f1f77bcf86cd799439066';
      const pendingRequest = new Subject<any>();
      const pendingOwner = new Subject<any>();
      const pendingTechnician = new Subject<any>();
      const row = { device_imei: imei, registered_device_id: deviceId, completed: false };
      const solicitud = { _id: solicitudId, type: 'instalacion', mechanic_id: technicianId, installations: [row] };
      const owner = { id: clientId, fullName: 'Cliente actual', affiliation_type_id: 'cliente' };
      const item = process(1, { _id: deviceId, device_imei: imei, solicitud_id: solicitudId, solicitud_installation_index: 0 });
      targets.getTargetById.and.resolveTo({ _id: deviceId, device_imei: imei, parent_id: clientId });
      solicitudes.getById.and.returnValue(pendingSource === 'request' ? pendingRequest : of(solicitud));
      users.getUserPath.and.returnValue(pendingOwner);
      users.getById.and.returnValue(pendingTechnician);
      const updated = { ...item, verificationStatus: 'verified' as const, verifiedAt: '2026-09-28T15:00:00Z' };
      processesApi.updateVerificationStatus.and.returnValue(of(updated));
      component.processes = [item];

      component.showDetail(item);
      flushMicrotasks();
      expect(component.installationOwnershipLoading).toBeTrue();
      if (pendingSource === 'request') expect(component.installationProgressLoading).toBeTrue();
      else expect(component.installationTechnicianLoading).toBeTrue();
      component.updateProcessVerificationStatus(item, 'verified');
      expect(component.selectedProcess?.verificationStatus).toBe('verified');
      expect(component.processes[0].verificationStatus).toBe('verified');

      if (pendingSource === 'request') {
        pendingRequest.next(solicitud);
        pendingRequest.complete();
        flushMicrotasks();
      }
      pendingOwner.next([owner]);
      pendingOwner.complete();
      pendingTechnician.next({ _id: technicianId, name: 'Ana', last_name: 'Pérez' });
      pendingTechnician.complete();
      flushMicrotasks();

      expect(component.installationProgressRecord).toEqual(row);
      expect(component.installationProgressLoading).toBeFalse();
      expect(component.installationProgressError).toBe('');
      expect(component.installationCurrentClient).toEqual(owner);
      expect(component.installationOwnershipLoading).toBeFalse();
      expect(component.installationOwnershipError).toBe('');
      expect(component.installationTechnicianName).toBe('Ana Pérez');
      expect(component.installationTechnicianLoading).toBeFalse();
    }));
  });

  it('rejects a linked progress row whose device identity does not match the process', fakeAsync(() => {
    solicitudes.getById.and.returnValue(of({
      _id: solicitudId, type: 'instalacion', status: 'in_progress',
      installations: [{ _id: 'installation-other', device_imei: '863874080932788', registered_device_id: otherDeviceId }],
    }));
    component.showDetail(process(1, { _id: deviceId, device_imei: imei, solicitud_id: solicitudId, solicitud_installation_index: 0 }));
    flushMicrotasks();
    expect(component.installationProgressRecord).toBeNull();
    expect(component.installationProgressError).not.toBe('');
    expect(component.installationTarget._id).toBe(deviceId);
  }));

  it('accepts the matching indexed row when its request subdocument ID was regenerated', fakeAsync(() => {
    const row = { _id: 'regenerated-row', device_imei: imei, registered_device_id: deviceId, process_type: 'reinstalacion' };
    solicitudes.getById.and.returnValue(of({
      _id: solicitudId, type: 'instalacion', status: 'in_progress', installations: [row],
    }));
    component.showDetail(process(18, {
      _id: deviceId, device_imei: imei, solicitud_id: solicitudId,
      solicitud_installation_index: 0, solicitud_installation_id: 'original-row',
    }));
    flushMicrotasks();
    expect(component.installationProgressRecord).toEqual(row);
    expect(component.installationProgressError).toBe('');
  }));

  it('does not fall back to a different row when the linked index points to another IMEI', fakeAsync(() => {
    solicitudes.getById.and.returnValue(of({
      _id: solicitudId, type: 'instalacion', status: 'in_progress', installations: [
        { _id: 'wrong-row', device_imei: '863874080932788', registered_device_id: otherDeviceId },
        { _id: 'matching-row', device_imei: imei, registered_device_id: deviceId },
      ],
    }));
    component.showDetail(process(1, {
      _id: deviceId, device_imei: imei, solicitud_id: solicitudId,
      solicitud_installation_index: 0, solicitud_installation_id: 'matching-row',
    }));
    flushMicrotasks();
    expect(component.installationSolicitud).toBeNull();
    expect(component.installationProgressRecord).toBeNull();
    expect(component.installationProgressError).toContain('no coincide');
  }));

  it('rejects progress returned for a different request', fakeAsync(() => {
    solicitudes.getById.and.returnValue(of({
      _id: otherDeviceId, type: 'instalacion', status: 'in_progress',
      installations: [{ device_imei: imei, registered_device_id: deviceId }],
    }));
    component.showDetail(process(1, { _id: deviceId, device_imei: imei, solicitud_id: solicitudId, solicitud_installation_index: 0 }));
    flushMicrotasks();
    expect(component.installationProgressRecord).toBeNull();
    expect(component.installationProgressError).not.toBe('');
  }));

  it('rejects a linked row whose IMEI was removed instead of displaying it as the expected GPS', fakeAsync(() => {
    solicitudes.getById.and.returnValue(of({
      _id: solicitudId, type: 'instalacion', status: 'in_progress',
      installations: [{ _id: 'installation-without-gps', device_imei: '', registered_device_id: deviceId }],
    }));
    component.showDetail(process(1, {
      _id: deviceId, device_imei: imei, solicitud_id: solicitudId, solicitud_installation_index: 0,
    }));
    flushMicrotasks();
    expect(component.installationProgressRecord).toBeNull();
    expect(component.installationProgressError).toContain('no coincide');
    expect(component.installationProgressLoading).toBeFalse();
  }));

  it('ignores installation progress received after switching to another process', fakeAsync(() => {
    const pending = new Subject<any>();
    solicitudes.getById.and.returnValue(pending);
    component.showDetail(process(1, { _id: deviceId, device_imei: imei, solicitud_id: solicitudId, solicitud_installation_index: 0 }));
    flushMicrotasks();
    const second = { ...process(18, { _id: otherDeviceId }), _id: 'process-2', reference: otherDeviceId };
    component.showDetail(second);
    flushMicrotasks();
    pending.next({ _id: solicitudId, type: 'instalacion', status: 'in_progress', installations: [{ device_imei: imei, registered_device_id: deviceId }] });
    pending.complete();
    flushMicrotasks();
    expect(component.selectedProcess).toBe(second);
    expect(component.installationSolicitud).toBeNull();
    expect(component.installationProgressRecord).toBeNull();
    expect(component.installationProgressLoading).toBeFalse();
  }));

  it('ignores installation progress errors received after closing the dialog', fakeAsync(() => {
    const pending = new Subject<any>();
    solicitudes.getById.and.returnValue(pending);
    component.showDetail(process(1, { _id: deviceId, device_imei: imei, solicitud_id: solicitudId, solicitud_installation_index: 0 }));
    flushMicrotasks();
    component.closeDetail();
    pending.error({ status: 500, error: { message: 'Respuesta tardía de progreso' } });
    flushMicrotasks();
    expect(component.installationSolicitud).toBeNull();
    expect(component.installationProgressRecord).toBeNull();
    expect(component.installationProgressLoading).toBeFalse();
    expect(component.installationProgressError).toBe('');
  }));

  it('uses the current direct owner as the principal client and does not invent a subclient', fakeAsync(() => {
    targets.getTargetById.and.resolveTo({ _id: deviceId, device_imei: imei, parent_id: clientId });
    const client = { id: clientId, fullName: 'Cliente actual', affiliation_type_id: 'cliente' };
    users.getUserPath.and.returnValue(of([client]));
    component.showDetail({ ...process(), client: { _id: 'historical-client', name: 'Cliente histórico' } });
    flushMicrotasks();
    expect(users.getUserPath).toHaveBeenCalledOnceWith(clientId);
    expect(component.installationCurrentClient).toEqual(client);
    expect(component.installationCurrentSubclient).toBeNull();
    expect(component.installationCurrentAccount).toEqual(client);
    expect(component.installationOwnershipLoading).toBeFalse();
    expect(component.installationOwnershipError).toBe('');
  }));

  it('shows the principal client and the final subclient without treating the employee as the owner', fakeAsync(() => {
    targets.getTargetById.and.resolveTo({ _id: deviceId, device_imei: imei, parent_id: subclientId });
    const principal = { id: clientId, fullName: 'Flota principal', affiliation_type_id: 'cliente' };
    const owner = { id: subclientId, fullName: 'Subcliente propietario', affiliation_type_id: 'subcliente' };
    users.getUserPath.and.returnValue(of([
      { id: 'employee', fullName: 'Operador de oficina', affiliation_type_id: 'empleado' }, principal, owner,
    ]));
    component.showDetail(process());
    flushMicrotasks();
    expect(component.installationCurrentClient).toEqual(principal);
    expect(component.installationCurrentSubclient).toEqual(owner);
    expect(component.installationCurrentAccount).toEqual(owner);
  }));

  it('keeps the final owner when the path contains several nested subclients', fakeAsync(() => {
    targets.getTargetById.and.resolveTo({ _id: deviceId, device_imei: imei, parent_id: subclientId });
    users.getUserPath.and.returnValue(of([
      { id: clientId, fullName: 'Cliente principal', affiliation_type_id: 'cliente' },
      { id: 'intermediate-subclient', fullName: 'Subcliente intermediario', affiliation_type_id: 'subcliente' },
      { id: subclientId, fullName: 'Dueño final', affiliation_type_id: 'subcliente' },
    ]));
    component.showDetail(process());
    flushMicrotasks();
    expect(component.installationCurrentClient?.id).toBe(clientId);
    expect(component.installationCurrentSubclient?.fullName).toBe('Dueño final');
    expect(component.installationCurrentAccount?.id).toBe(subclientId);
  }));

  it('leaves the principal client unavailable when permissions return only the subclient', fakeAsync(() => {
    targets.getTargetById.and.resolveTo({
      _id: deviceId, device_imei: imei, parent_id: subclientId, index: ['historical-principal', subclientId],
    });
    users.getUserPath.and.returnValue(of([
      { id: subclientId, fullName: 'Subcliente visible', affiliation_type_id: 'subcliente' },
    ]));
    solicitudes.getById.and.returnValue(of({
      _id: solicitudId, type: 'instalacion', status: 'completed', client_id: 'request-client', client_name: 'Cliente de solicitud',
      installations: [{ device_imei: imei }],
    }));
    component.showDetail({
      ...process(1, { _id: deviceId, device_imei: imei, solicitud_id: solicitudId }),
      client: { _id: 'historical-principal', name: 'Cliente histórico' },
    });
    flushMicrotasks();
    expect(component.installationCurrentClient).toBeNull();
    expect(component.installationCurrentSubclient?.fullName).toBe('Subcliente visible');
    expect(component.installationCurrentAccount?.id).toBe(subclientId);
    expect(users.getUserPath).toHaveBeenCalledOnceWith(subclientId);
  }));

  it('rejects an ownership path that ends at a different user', fakeAsync(() => {
    targets.getTargetById.and.resolveTo({ _id: deviceId, device_imei: imei, parent_id: subclientId });
    users.getUserPath.and.returnValue(of([
      { id: clientId, fullName: 'Otro cliente', affiliation_type_id: 'cliente' },
    ]));
    component.showDetail(process());
    flushMicrotasks();
    expect(component.installationCurrentClient).toBeNull();
    expect(component.installationCurrentSubclient).toBeNull();
    expect(component.installationCurrentAccount).toBeNull();
    expect(component.installationOwnershipError).not.toBe('');
  }));

  it('keeps ownership unavailable on a permission error without substituting the historical client', fakeAsync(() => {
    targets.getTargetById.and.resolveTo({ _id: deviceId, device_imei: imei, parent_id: clientId });
    users.getUserPath.and.returnValue(throwError(() => ({ status: 403, error: { message: 'Sin permiso para consultar la cuenta.' } })));
    component.showDetail({ ...process(), client: { _id: 'historical-client', name: 'Cliente histórico' } });
    flushMicrotasks();
    expect(component.installationCurrentClient).toBeNull();
    expect(component.installationCurrentSubclient).toBeNull();
    expect(component.installationCurrentAccount).toBeNull();
    expect(component.installationOwnershipError).not.toBe('');
    expect(component.installationOwnershipLoading).toBeFalse();
    expect(component.installationTarget._id).toBe(deviceId);
  }));

  it('does not query a snapshot owner when the current device request fails', fakeAsync(() => {
    targets.getTargetById.and.rejectWith({ status: 403 });
    component.showDetail(process(1, { _id: deviceId, device_imei: imei, parent_id: clientId }));
    flushMicrotasks();
    expect(users.getUserPath).not.toHaveBeenCalled();
    expect(component.installationCurrentClient).toBeNull();
    expect(component.installationCurrentSubclient).toBeNull();
    expect(component.installationCurrentAccount).toBeNull();
  }));

  it('ignores an older ownership response after selecting another installation', fakeAsync(() => {
    const pending = new Subject<any>();
    targets.getTargetById.and.callFake((id: string) => Promise.resolve({
      _id: id, device_imei: imei, parent_id: id === deviceId ? clientId : subclientId,
    }));
    users.getUserPath.and.callFake((id: string) => id === clientId ? pending : of([
      { id: subclientId, fullName: 'Segundo propietario', affiliation_type_id: 'cliente' },
    ]));
    component.showDetail(process());
    flushMicrotasks();
    component.showDetail({ ...process(18, { _id: otherDeviceId }), _id: 'process-2', reference: otherDeviceId });
    flushMicrotasks();
    pending.next([{ id: clientId, fullName: 'Propietario anterior', affiliation_type_id: 'cliente' }]);
    pending.complete();
    flushMicrotasks();
    expect(component.installationCurrentClient?.fullName).toBe('Segundo propietario');
    expect(component.installationCurrentAccount?.id).toBe(subclientId);
    expect(component.installationOwnershipLoading).toBeFalse();
  }));

  it('ignores a late ownership failure after closing the installation dialog', fakeAsync(() => {
    const pending = new Subject<any>();
    targets.getTargetById.and.resolveTo({ _id: deviceId, device_imei: imei, parent_id: clientId });
    users.getUserPath.and.returnValue(pending);
    component.showDetail(process());
    flushMicrotasks();
    component.closeDetail();
    pending.error({ status: 403, error: { message: 'Error tardío' } });
    flushMicrotasks();
    expect(component.installationOwnerPath).toEqual([]);
    expect(component.installationCurrentAccount).toBeNull();
    expect(component.installationOwnershipLoading).toBeFalse();
    expect(component.installationOwnershipError).toBe('');
  }));

  it('resolves the full name of the linked technician even when absent from the technician catalog', fakeAsync(() => {
    const technicianId = '507f1f77bcf86cd799439066';
    solicitudes.getById.and.returnValue(of({ _id: solicitudId, type: 'instalacion', mechanic_id: technicianId, installations: [{ device_imei: imei }] }));
    users.getById.and.returnValue(of({ _id: technicianId, name: 'Ana', last_name: 'Pérez' }));
    component.showDetail(process(1, { _id: deviceId, device_imei: imei, solicitud_id: solicitudId, solicitud_installation_index: 0 }));
    flushMicrotasks();
    expect(users.getById).toHaveBeenCalledOnceWith(technicianId);
    expect(component.installationTechnicianName).toBe('Ana Pérez');
    expect(component.installationProgressSteps.find(step => step.id === 'tecnico')?.summary).toBe('Ana Pérez');
  }));

  it('does not show a current device technician when the linked request has no assignment', fakeAsync(() => {
    const technicianId = '507f1f77bcf86cd799439066';
    solicitudes.getById.and.returnValue(of({ _id: solicitudId, type: 'instalacion', installations: [{ device_imei: imei }] }));
    component.techniciansMap = { [technicianId]: 'Técnico actual' };
    component.showDetail(process(1, { _id: deviceId, device_imei: imei, mechanic_id: technicianId, mechanic_name: 'Técnico actual', solicitud_id: solicitudId, solicitud_installation_index: 0 }));
    flushMicrotasks();
    expect(component.installationTechnicianName).toBe('Sin técnico asignado');
    expect(users.getById).not.toHaveBeenCalled();
  }));

  it('ignores technician details arriving after opening another installation', fakeAsync(() => {
    const technicianId = '507f1f77bcf86cd799439066';
    const pending = new Subject<any>();
    users.getById.and.returnValue(pending);
    component.showDetail(process(1, { _id: deviceId, mechanic_id: technicianId }));
    flushMicrotasks();
    expect(component.installationTechnicianLoading).toBeTrue();
    component.showDetail({ ...process(18, { _id: otherDeviceId }), reference: otherDeviceId });
    flushMicrotasks();
    pending.next({ _id: technicianId, name: 'Técnico anterior' });
    pending.complete();
    flushMicrotasks();
    expect(component.installationTechnicianName).toBe('Sin técnico asignado');
    expect(component.installationTechnicianLoading).toBeFalse();
  }));
});
