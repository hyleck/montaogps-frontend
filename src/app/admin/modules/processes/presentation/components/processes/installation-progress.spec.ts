import { buildInstallationProgress, InstallationProgressInput } from './installation-progress';

describe('buildInstallationProgress', () => {
  const deviceId = '507f1f77bcf86cd799439011';
  const imei = '863874080932787';
  const photoFields = [
    'chasis_img', 'placa_img', 'matricula_instalacion_img', 'lugar_instalacion_antes_img',
    'vehiculo_exterior_antes_img', 'vehiculo_interior_antes_img', 'gps_numeracion_img', 'simcard_numeracion_img',
    'lugar_instalacion_despues_img', 'vehiculo_exterior_despues_img', 'vehiculo_interior_despues_img',
  ];
  const evidence = () => photoFields.map(field => ({ field, url: `https://example.com/${field}.jpg` }));
  function input(): InstallationProgressInput {
    return {
      process: {
        _id: 'process-1', type: 1, description: 'Instalación', target: { _id: deviceId, device_imei: imei },
        user: { _id: 'client' }, creator: 'office-user', reference: deviceId,
        before: {}, after: {}, registrationDate: '2026-09-20T14:00:00Z',
        createdAt: '2026-09-20T14:00:00Z', updatedAt: '2026-09-20T14:00:00Z',
        verificationStatus: 'verified', verifiedAt: '2026-09-21T14:00:00Z',
      },
      linked: true, target: null, targetLoading: false, targetError: '', loading: false, error: '',
      installation: {
        _id: 'installation-1', registered_device_id: deviceId, device_type: 'gps', device_imei: imei,
        target_name: 'Camión', brand: 'Isuzu', model: 'NPR', year: '2022', color: 'Blanco', plate: 'L12345', chassis: 'CHASIS-1',
        new_protocol: 'GT06', sim_card_number: '8095550123', sim_company: 'Claro',
        installation_location: 'Tablero', engine_shutdown: 'No', ignition_sensor: 'Si',
        installation_evidence: evidence(), completed: true, completion_source: 'technician',
        completed_at: '2026-09-20T14:00:00Z', final_device_online: true,
        final_device_status: 'online', final_device_status_at: '2026-09-20T13:59:00Z',
      },
      solicitud: {
        _id: 'request-1', type: 'instalacion', status: 'completada', mechanic_id: 'technician-1', technician_response: 'aceptada',
        createdAt: '2026-09-19T14:00:00Z', created_by_id: 'creator-1', created_by_name: 'María Gómez',
        client_name: 'Cliente original', client_phone: '8095550001', client_email: 'cliente@example.com',
      },
      technicians: { 'technician-1': 'Ana Pérez', 'technician-2': 'Luis García' },
    };
  }
  const getStep = (value: InstallationProgressInput, id: string) => buildInstallationProgress(value).find(item => item.id === id)!;
  const getCheck = (value: InstallationProgressInput, id: string, label: string) => getStep(value, id).checks.find(item => item.label === label)!;

  it('returns ten chronological independently checked steps for a complete linked installation', () => {
    const value = input();
    expect(buildInstallationProgress(value).map(item => item.id)).toEqual([
      'inicio', 'tecnico', 'vehiculo', 'gps', 'fotos-antes', 'instalacion', 'fotos-despues', 'conexion', 'cierre', 'revision',
    ]);
    expect(buildInstallationProgress(value).every(item => item.status === 'complete')).toBeTrue();
    expect(getStep(value, 'fotos-antes').checks.length).toBe(6);
    expect(getStep(value, 'fotos-despues').checks.length).toBe(3);
    expect(getCheck(value, 'tecnico', 'Técnico responsable').value).toBe('Ana Pérez');
  });

  it('preserves calendar installation dates instead of moving UTC midnight to the previous day', () => {
    const value = input();
    const expected = new Date(2026, 8, 28).toLocaleString('es-DO', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
    for (const date of ['2026-09-28', '2026-09-28T00:00:00.000Z']) {
      value.process.registrationDate = date;
      expect(getCheck(value, 'tecnico', 'Fecha registrada de instalación').value).toBe(expected);
    }
  });

  it('does not use current device fields or completion to fill missing historical information', () => {
    const value = input();
    value.installation!.brand = '   ';
    value.installation!.sim_card_number = '';
    value.installation!.installation_evidence = [];
    value.target = { target_brand_id: 'Isuzu', sim_card_number: '8099999999', ...Object.fromEntries(photoFields.map(field => [field, '/current.jpg'])) };
    expect(getCheck(value, 'vehiculo', 'Marca').status).toBe('pending');
    expect(getCheck(value, 'gps', 'SIM card').status).toBe('pending');
    expect(getStep(value, 'fotos-antes').status).toBe('pending');
    expect(getCheck(value, 'cierre', 'Finalización del trabajo').status).toBe('complete');
  });

  it('shows loading for linked checks while keeping administrative status independent', () => {
    const value = input();
    value.loading = true;
    value.target = { ...value.installation, chasis_img: '/current.jpg' };
    expect(buildInstallationProgress(value).slice(0, 9).every(item => item.status === 'loading')).toBeTrue();
    expect(getStep(value, 'revision').status).toBe('complete');
  });

  it('reports unavailable linked data on failure and never substitutes current photographs', () => {
    const value = input();
    value.error = 'No se pudo consultar la solicitud';
    value.target = { ...value.installation, chasis_img: '/current.jpg' };
    expect(buildInstallationProgress(value).slice(0, 9).every(item => item.status === 'unavailable')).toBeTrue();
    value.error = '';
    value.installation = null;
    expect(getStep(value, 'fotos-antes').status).toBe('unavailable');
  });

  it('accepts persisted negative options as configured and treats absent options as pending', () => {
    const value = input();
    for (const option of ['No', 'false', false, '0', 0]) {
      (value.installation as any).engine_shutdown = option;
      (value.installation as any).ignition_sensor = option;
      expect(getCheck(value, 'instalacion', 'Apagado de motor')).toEqual({ label: 'Apagado de motor', status: 'complete', value: 'No' });
      expect(getCheck(value, 'instalacion', 'Sensor de ignición').status).toBe('complete');
    }
    for (const option of [null, undefined, '', '  ']) {
      (value.installation as any).engine_shutdown = option;
      expect(getCheck(value, 'instalacion', 'Apagado de motor').status).toBe('pending');
    }
  });

  it('does not classify unspecified option strings as a saved yes/no response', () => {
    const value = input();
    value.installation!.engine_shutdown = 'undefined';
    expect(getCheck(value, 'instalacion', 'Apagado de motor').status).toBe('pending');
  });

  it('requires individually identified photos instead of treating generic images as all evidence', () => {
    const value = input();
    value.installation!.installation_evidence = [{ url: '/unspecified.jpg' }];
    value.installation!.images = ['/photo1.jpg', '/photo2.jpg'];
    (value.installation as any).chasis_img = '/outside-evidence-list.jpg';
    expect(getStep(value, 'fotos-antes').checks.every(item => item.status === 'pending')).toBeTrue();
    expect(getStep(value, 'fotos-despues').checks.every(item => item.status === 'pending')).toBeTrue();
  });

  it('recognizes only the identified photo and the matching row draft evidence', () => {
    const value = input();
    value.installation!.installation_evidence = [{ field: 'chasis_img', url: '/chassis.jpg' }];
    (value.installation as any).draft = { data: { device_imei: imei, placa_img: { location_cdn: '/plate.jpg' } } };
    expect(getCheck(value, 'fotos-antes', 'Foto del chasis').status).toBe('complete');
    expect(getCheck(value, 'fotos-antes', 'Foto de la placa').status).toBe('complete');
    expect(getCheck(value, 'fotos-antes', 'Matrícula o carta de ruta').status).toBe('pending');
    (value.installation as any).draft.data.device_imei = 'different-device';
    expect(getCheck(value, 'fotos-antes', 'Foto de la placa').status).toBe('pending');
  });

  it('uses persisted draft evidence and protocol only for the matching device', () => {
    const value = input();
    value.installation!.new_protocol = '';
    value.installation!.installation_evidence = [];
    (value.installation as any).draft = {
      data: { device_imei: imei, type: 'GT06' },
      evidence: { chasis_img: { url: '/chassis.jpg', uploaded_at: '2026-09-23T10:00:00Z' } },
    };
    expect(getCheck(value, 'gps', 'Modelo del equipo').value).toBe('GT06');
    expect(getCheck(value, 'fotos-antes', 'Foto del chasis').status).toBe('complete');
    (value.installation as any).draft.data.device_imei = 'another-imei';
    expect(getCheck(value, 'gps', 'Modelo del equipo').status).toBe('unavailable');
    expect(getCheck(value, 'fotos-antes', 'Foto del chasis').status).toBe('pending');
  });

  it('reports a missing historical GPS model as unavailable without borrowing the current model', () => {
    const value = input();
    delete value.installation!.new_protocol;
    value.target = { protocol: { name: 'Modelo actual' }, gps_model: 'Modelo actual' };
    value.process.target['gps_model'] = 'Modelo enriquecido desde el equipo actual';

    expect(getCheck(value, 'gps', 'Modelo del equipo')).toEqual({
      label: 'Modelo del equipo', status: 'unavailable', value: 'Modelo no disponible en el registro',
    });
    expect(getStep(value, 'gps').status).toBe('unavailable');
  });

  it('warns about retained photos after identity corrections unless a newer upload is proven', () => {
    const value = input();
    value.installation!.correction_history = [{
      corrected_at: '2026-09-22T10:00:00Z', corrected_by_id: 'office', corrected_by_name: 'Oficina',
      changed_fields: ['device_imei'], before: { device_imei: 'previous-imei' }, after: { device_imei: imei },
    }];
    expect(getCheck(value, 'fotos-antes', 'Foto del chasis').status).toBe('warning');
    value.installation!.installation_evidence![0].uploaded_at = '2026-09-22T10:01:00Z';
    expect(getCheck(value, 'fotos-antes', 'Foto del chasis').status).toBe('complete');
    expect(getCheck(value, 'fotos-antes', 'Foto de la placa').status).toBe('warning');
    value.installation!.installation_evidence![0].uploaded_at = '2026-09-22T10:00:00Z';
    expect(getCheck(value, 'fotos-antes', 'Foto del chasis').status).toBe('warning');
  });

  it('does not warn about photos after edits that do not change identity', () => {
    const value = input();
    value.installation!.correction_history = [{
      corrected_at: '2026-09-22T10:00:00Z', corrected_by_id: 'office', corrected_by_name: 'Oficina',
      changed_fields: ['notes'], before: {}, after: { notes: 'Updated' },
    }];
    expect(getStep(value, 'fotos-antes').status).toBe('complete');
    expect(getStep(value, 'revision').status).toBe('complete');
  });

  it('treats a correction without a reliable date as needing photo and approval review', () => {
    const value = input();
    value.installation!.correction_history = [{
      corrected_at: '', corrected_by_id: 'office', corrected_by_name: 'Oficina',
      changed_fields: ['chassis'], before: {}, after: { chassis: 'NEW' },
    }];
    expect(getStep(value, 'fotos-antes').status).toBe('warning');
    expect(getStep(value, 'revision').status).toBe('warning');
  });

  it('requires renewed administrative review after an identity correction', () => {
    const value = input();
    value.installation!.correction_history = [{
      corrected_at: '2026-09-22T10:00:00Z', corrected_by_id: 'office', corrected_by_name: 'Oficina',
      changed_fields: ['plate'], before: { plate: 'OLD' }, after: { plate: 'NEW' },
    }];
    expect(getStep(value, 'revision').status).toBe('warning');
    value.process.verifiedAt = '2026-09-22T10:01:00Z';
    expect(getStep(value, 'revision').status).toBe('complete');
    value.process.verifiedAt = undefined;
    expect(getStep(value, 'revision').status).toBe('warning');
  });

  it('keeps administrative rejection and pending status even when installation data is complete', () => {
    const value = input();
    value.process.verificationStatus = 'pending';
    expect(getStep(value, 'revision').status).toBe('pending');
    value.process.verificationStatus = 'rejected';
    value.process.verificationNote = 'Falta revisar el montaje';
    expect(getCheck(value, 'revision', 'Verificación administrativa').value).toBe('Falta revisar el montaje');
    expect(getStep(value, 'revision').status).toBe('warning');
    value.process.verificationStatus = undefined;
    expect(getStep(value, 'revision').status).toBe('pending');
  });

  it('keeps optional historical vehicle verification separate from administrative approval', () => {
    const value = input();
    value.target = { verificado: true };
    expect(getStep(value, 'vehiculo').checks.some(item => item.label === 'Vehículo verificado')).toBeFalse();
    expect(getStep(value, 'revision').status).toBe('complete');
    (value.installation as any).verificado = false;
    expect(getCheck(value, 'vehiculo', 'Vehículo verificado').status).toBe('pending');
    expect(getStep(value, 'revision').status).toBe('complete');
  });

  it('does not turn a missing final snapshot into online based on the current device', () => {
    const value = input();
    value.installation!.final_device_status_at = undefined;
    value.target = { traccarInfo: { status: 'online' }, final_device_online: true, final_device_status_at: '2026-09-28T12:00:00Z' };
    expect(getStep(value, 'conexion').status).toBe('unavailable');
    value.installation!.final_device_status_at = 'invalid-date';
    expect(getStep(value, 'conexion').status).toBe('unavailable');
  });

  it('shows an offline final snapshot as a warning without undoing the recorded closure', () => {
    const value = input();
    value.installation!.final_device_online = false;
    value.installation!.final_device_status = 'Fuera de línea';
    value.target = { traccarInfo: { status: 'online' } };
    expect(getStep(value, 'conexion').status).toBe('warning');
    expect(getCheck(value, 'conexion', 'Estado al finalizar').value).toBe('Fuera de línea');
    expect(getCheck(value, 'cierre', 'Finalización del trabajo').status).toBe('complete');
  });

  it('warns on office closure, cancellation and omission instead of approving the technical work', () => {
    const value = input();
    value.installation!.completion_source = 'office';
    value.installation!.technician_completion_missing = true;
    expect(getCheck(value, 'cierre', 'Finalización del trabajo').status).toBe('warning');
    value.installation!.cancelled = true;
    expect(getCheck(value, 'cierre', 'Finalización del trabajo').value).toBe('Proceso cancelado');
    value.installation!.cancelled = false;
    value.installation!.omitted = true;
    expect(getCheck(value, 'cierre', 'Finalización del trabajo').value).toBe('Proceso omitido');
  });

  it('uses the request technician for unfinished work and never substitutes the creator', () => {
    const value = input();
    value.installation!.completed = false;
    value.installation!.completion_source = undefined;
    value.process.target['mechanic_id'] = 'technician-2';
    value.process.target['mechanic_name'] = 'Luis García';
    value.target = { mechanic_id: 'technician-2' };
    expect(getCheck(value, 'tecnico', 'Técnico responsable').value).toBe('Ana Pérez');
    value.solicitud!.technician_response = 'rechazada';
    expect(getStep(value, 'tecnico').status).toBe('warning');
    value.solicitud!.technician_response = undefined;
    value.solicitud!.mechanic_id = '';
    delete value.process.target['mechanic_id'];
    delete value.process.target['mechanic_name'];
    expect(getCheck(value, 'tecnico', 'Técnico responsable').status).toBe('pending');
  });

  it('keeps the technician who completed this installation after the request is reassigned', () => {
    const value = input();
    value.installation!.completed_by_id = 'technician-1';
    value.installation!.completed_by_name = 'Ana Pérez';
    value.solicitud!.mechanic_id = 'technician-2';
    value.solicitud!.technician_response = 'pendiente';
    value.process.target['mechanic_id'] = 'technician-2';
    value.process.target['mechanic_name'] = 'Luis García';
    value.target = { mechanic_id: 'technician-2' };

    expect(getCheck(value, 'tecnico', 'Técnico responsable').value).toBe('Ana Pérez');
    expect(getStep(value, 'tecnico').status).toBe('complete');
  });

  it('does not penalize a technician closure for a later request response', () => {
    const value = input();
    value.installation!.completed_by_id = 'technician-1';
    value.installation!.completed_by_name = 'Ana Pérez';
    for (const response of ['pendiente', 'rechazada', 'verificando', undefined]) {
      value.solicitud!.technician_response = response;
      expect(getCheck(value, 'tecnico', 'Respuesta del técnico')).toEqual({
        label: 'Respuesta del técnico', status: 'not-applicable', value: 'Instalación ya finalizada por el técnico',
      });
      expect(getStep(value, 'tecnico').status).toBe('complete');
    }
  });

  it('does not use a process or current-device mechanic when the linked request has no assignment', () => {
    const value = input();
    value.installation!.completed = false;
    value.installation!.completion_source = undefined;
    value.solicitud!.mechanic_id = '';
    value.process.target['mechanic_id'] = 'technician-2';
    value.process.target['mechanic_name'] = 'Luis García';
    value.target = { mechanic_id: 'technician-2' };

    expect(getCheck(value, 'tecnico', 'Técnico responsable')).toEqual({
      label: 'Técnico responsable', status: 'pending',
    });
  });

  it('excludes vehicle fields, photos, SIM and motor checks for MTAG-P', () => {
    const value = input();
    value.installation = { device_type: 'mtag_p', device_imei: imei, target_name: 'Equipaje', target_category: 'object', completed: true };
    expect(getStep(value, 'vehiculo').status).toBe('complete');
    expect(getStep(value, 'gps').status).toBe('complete');
    expect(getStep(value, 'gps').checks.map(item => item.label)).toEqual(['IMEI / ID del equipo', 'Modelo del equipo']);
    expect(getStep(value, 'fotos-antes').status).toBe('not-applicable');
    expect(getStep(value, 'fotos-despues').status).toBe('not-applicable');
    expect(getStep(value, 'instalacion').status).toBe('not-applicable');
    expect(getStep(value, 'cierre').checks.map(item => item.label)).toEqual(['Finalización del trabajo']);
  });

  it('keeps vehicle and applicable photos for MTAG-A while omitting SIM and motor checks', () => {
    const value = input();
    value.installation!.device_type = 'mtag_a';
    value.installation!.sim_card_number = '';
    value.installation!.sim_company = '';
    value.installation!.engine_shutdown = '';
    value.installation!.ignition_sensor = '';
    value.installation!.installation_evidence = evidence().filter(item => item.field !== 'simcard_numeracion_img');
    expect(getStep(value, 'gps').status).toBe('complete');
    expect(getStep(value, 'gps').checks.some(item => item.label.includes('SIM'))).toBeFalse();
    expect(getStep(value, 'fotos-antes').checks.length).toBe(6);
    expect(getStep(value, 'instalacion').checks.map(item => item.label)).toEqual(['Lugar de instalación']);
  });

  it('uses current office data without reviving explicitly cleared fields from the snapshot', () => {
    const value = input();
    value.linked = false;
    value.process.target = { _id: deviceId, name: 'Anterior', target_brand_id: 'Isuzu', target_plate_number: 'L12345', chasis_img: '/snapshot.jpg' };
    value.target = { name: 'Actual', target_plate_number: null, chasis_img: { location: '/actual.jpg' } };
    expect(getCheck(value, 'vehiculo', 'Nombre del objetivo').value).toBe('Actual');
    expect(getCheck(value, 'vehiculo', 'Marca').status).toBe('complete');
    expect(getCheck(value, 'vehiculo', 'Placa').status).toBe('pending');
    expect(getCheck(value, 'fotos-antes', 'Foto del chasis').status).toBe('complete');
    expect(getCheck(value, 'cierre', 'Registro de instalación').value).toBe('Proceso registrado');
    expect(getStep(value, 'conexion').status).toBe('unavailable');
  });

  it('uses the process client for office origin and never presents the employee as the client', () => {
    const value = input();
    value.linked = false;
    value.process.after = { origin: 'office_management' };
    value.process.user = { _id: 'employee-1', name: 'Operadora', email: 'empleada@example.com', phone: '8095551111' };
    value.process.client = { _id: 'client-1', name: 'Cliente', last_name: 'Actual', email: 'cliente@example.com', phone: '8095552222' };

    expect(getCheck(value, 'inicio', 'Cliente').value).toBe('Cliente Actual');
    const initialDetails = getStep(value, 'inicio').details!;
    expect(initialDetails).toContain({ label: 'Teléfono del cliente', value: '8095552222' });
    expect(initialDetails).toContain({ label: 'Correo del cliente', value: 'cliente@example.com' });
    expect(initialDetails.some(item => item.value.includes('Operadora') || item.value.includes('empleada@example.com'))).toBeFalse();

    value.process.client = undefined;
    expect(getCheck(value, 'inicio', 'Cliente').status).toBe('pending');
    expect(getStep(value, 'inicio').details!.some(item => item.label === 'Teléfono del cliente' || item.label === 'Correo del cliente')).toBeFalse();
  });

  it('uses office connection snapshots and requires an explicit office origin for that label', () => {
    const value = input();
    value.linked = false;
    value.target = { traccarInfo: { status: 'online' }, installation_device_status: 'online', installation_device_status_at: '2026-09-28T10:00:00Z' };
    expect(getStep(value, 'conexion').status).toBe('unavailable');
    value.process.after = { origin: 'office_management', deviceStatus: { status: 'offline', checkedAt: '2026-09-20T10:00:00Z' } };
    expect(getStep(value, 'conexion').status).toBe('warning');
    expect(getCheck(value, 'cierre', 'Registro de instalación').value).toBe('Registrado en oficina');
    value.process.after = {};
    value.process.target['installation_device_status'] = 'online';
    value.process.target['installation_device_status_at'] = '2026-09-20T10:00:00Z';
    expect(getStep(value, 'conexion').status).toBe('complete');
  });

  it('uses the MTAG office location status despite the legacy online=false flag', () => {
    const value = input();
    value.linked = false;
    value.target = { protocol: { name: 'MTAG-A', isAirtag: true } };
    value.process.after = { origin: 'office_management', deviceStatus: { status: 'Localizado', online: false, checkedAt: '2026-09-20T10:00:00Z' } };
    expect(getStep(value, 'conexion').status).toBe('complete');
    expect(getCheck(value, 'conexion', 'Estado al finalizar').value).toBe('Localizado');
    value.process.after.deviceStatus.status = 'No localizado';
    value.process.after.deviceStatus.online = true;
    expect(getStep(value, 'conexion').status).toBe('warning');
  });

  it('does not mutate installation, process or target while deriving progress', () => {
    const value = input();
    value.target = { name: 'Current device' };
    const original = JSON.stringify(value);
    buildInstallationProgress(value);
    expect(JSON.stringify(value)).toBe(original);
  });

  it('shows office data loading and errors explicitly', () => {
    const value = input();
    value.linked = false;
    value.targetLoading = true;
    expect(getStep(value, 'vehiculo').status).toBe('loading');
    value.targetLoading = false;
    value.targetError = 'Objetivo no disponible';
    expect(getStep(value, 'vehiculo').status).toBe('unavailable');
    expect(getStep(value, 'fotos-antes').status).toBe('unavailable');
  });
});
