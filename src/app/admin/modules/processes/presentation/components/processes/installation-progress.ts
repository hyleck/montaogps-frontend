import type { InstallationDetail, Solicitud } from 'src/app/core/services/solicitudes.service';
import type { ProcessItem } from '../../services/processes.service';
import { parseProcessDisplayDate } from 'src/app/core/utils/process-date.util';

export type InstallationProgressStatus = 'complete' | 'pending' | 'warning' | 'unavailable' | 'loading' | 'not-applicable';

export interface InstallationProgressCheck {
  label: string;
  status: InstallationProgressStatus;
  value?: string;
}

export interface InstallationProgressStep {
  id: string;
  label: string;
  status: InstallationProgressStatus;
  summary: string;
  checks: InstallationProgressCheck[];
  details?: InstallationProgressDetail[];
  photos?: InstallationProgressPhoto[];
}

export interface InstallationProgressDetail {
  label: string;
  value: string;
}

export interface InstallationProgressPhoto {
  label: string;
  url: string;
  uploadedAt?: string;
}

export interface InstallationProgressInput {
  process: ProcessItem;
  target: any | null;
  targetLoading: boolean;
  targetError: string;
  linked: boolean;
  installation: InstallationDetail | null;
  solicitud: Solicitud | null;
  loading: boolean;
  error: string;
  technicians: Record<string, string>;
  catalogs?: {
    brands: Record<string, string>;
    models: Record<string, string>;
    colors: Record<string, string>;
    gpsModels: Record<string, string>;
  };
}

type Data = Record<string, any>;
const BEFORE_PHOTOS = [
  ['chasis_img', 'Foto del chasis'], ['placa_img', 'Foto de la placa'],
  ['matricula_instalacion_img', 'Matrícula o carta de ruta'],
  ['lugar_instalacion_antes_img', 'Lugar antes de instalar'],
  ['vehiculo_exterior_antes_img', 'Exterior antes de instalar'],
  ['vehiculo_interior_antes_img', 'Interior antes de instalar'],
];
const AFTER_PHOTOS = [
  ['lugar_instalacion_despues_img', 'Lugar después de instalar'],
  ['vehiculo_exterior_despues_img', 'Exterior después de instalar'],
  ['vehiculo_interior_despues_img', 'Interior después de instalar'],
];
const IDENTITY_FIELDS = new Set([
  'device_imei', 'new_device_imei', 'registered_device_id', 'chassis', 'plate',
  'target_chassis_number', 'target_plate_number',
]);

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (value && typeof value === 'object') {
    const item = value as Data;
    return text(item['name'] || item['nombre'] || item['label'] || item['_id']);
  }
  return '';
}

function first(data: Data, ...keys: string[]): unknown {
  return keys.map(key => data[key]).find(value => text(value) !== '');
}

function timestamp(value: unknown): number | null {
  if (!(typeof value === 'string' && value.trim()) && !(value instanceof Date)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.getTime() : null;
}

function dateLabel(value: unknown): string {
  const time = timestamp(value);
  return time === null ? '' : new Date(time).toLocaleString('es-DO', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function stateCheck(label: string, status: InstallationProgressStatus, value?: string): InstallationProgressCheck {
  return { label, status, ...(value ? { value } : {}) };
}

function dataCheck(label: string, value: unknown, unavailable?: InstallationProgressStatus): InstallationProgressCheck {
  if (unavailable) return stateCheck(label, unavailable);
  const displayed = text(value);
  return stateCheck(label, displayed ? 'complete' : 'pending', /^[a-f\d]{24}$/i.test(displayed) ? 'Registrado' : displayed);
}

function optionCheck(label: string, value: unknown, unavailable?: InstallationProgressStatus): InstallationProgressCheck {
  if (unavailable) return stateCheck(label, unavailable);
  const normalized = text(value).toLowerCase();
  if (['si', 'sí', 'yes', 'true', '1'].includes(normalized)) return stateCheck(label, 'complete', 'Sí');
  if (['no', 'false', '0'].includes(normalized)) return stateCheck(label, 'complete', 'No');
  return stateCheck(label, 'pending', normalized ? 'Respuesta sin confirmar' : undefined);
}

function details(...values: Array<[string, unknown]>): InstallationProgressDetail[] {
  return values.map(([label, value]) => ({ label, value: text(value) })).filter(item => !!item.value);
}

function checkDetails(checks: InstallationProgressCheck[]): InstallationProgressDetail[] {
  return checks.filter(check => check.value && check.status !== 'loading' && check.status !== 'unavailable')
    .map(check => ({ label: check.label, value: check.value! }));
}

function personName(value: unknown): string {
  if (value && typeof value === 'object') {
    const person = value as Data;
    return [text(person['name']), text(person['last_name'])].filter(Boolean).join(' ')
      || text(person['full_name'] || person['nombre'] || person['email']);
  }
  const name = text(value);
  return /^[a-f\d]{24}$/i.test(name) ? '' : name;
}

function step(id: string, label: string, checks: InstallationProgressCheck[], context: {
  summary?: string;
  details?: InstallationProgressDetail[];
  photos?: InstallationProgressPhoto[];
} = {}): InstallationProgressStep {
  const applicable = checks.filter(check => check.status !== 'not-applicable');
  const status: InstallationProgressStatus = !applicable.length ? 'not-applicable'
    : (['loading', 'unavailable', 'warning', 'pending'] as const).find(value => applicable.some(check => check.status === value)) || 'complete';
  const count = applicable.filter(check => check.status === 'complete').length;
  const summary = status === 'not-applicable' ? 'No aplica a este equipo'
    : status === 'loading' ? 'Consultando datos'
      : status === 'unavailable' ? 'No se pudo comprobar toda la información'
        : context.summary || (status === 'warning' ? 'Requiere revisión'
          : status === 'complete' ? `${count} de ${applicable.length} comprobaciones completas`
            : `${count} de ${applicable.length} completas · faltan ${applicable.length - count}`);
  return { id, label, status, summary, checks, details: context.details || checkDetails(checks), photos: context.photos || [] };
}

function photoUrl(value: unknown): string {
  const stored = value as Data | null;
  const url = typeof value === 'string' ? value.trim() : text(stored?.['url'] || stored?.['location_cdn'] || stored?.['location']);
  return /^[a-z][a-z\d+.-]*:/i.test(url) && !/^(https?:|blob:|data:)/i.test(url) ? '' : url;
}

function deviceKind(data: Data): 'gps' | 'mtag_a' | 'mtag_p' {
  const protocol = data['protocol'];
  const candidates = [data['device_type'], protocol?.name, protocol?.nombre, protocol, data['gps_model'], data['type']];
  for (const candidate of candidates) {
    const compact = text(candidate).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (compact === 'mtagp') return 'mtag_p';
    if (compact === 'mtaga') return 'mtag_a';
  }
  return protocol?.isAirtag === true || data['isAirtag'] === true ? 'mtag_a' : 'gps';
}

/** The caller resolves the exact request row before passing a linked installation. */
export function buildInstallationProgress(input: InstallationProgressInput): InstallationProgressStep[] {
  const { process, linked } = input;
  const snapshot: Data = process.target || {};
  const row: Data = input.installation || {};
  const office: Data = { ...snapshot };
  for (const [key, value] of Object.entries(input.target || {})) {
    if (value !== undefined) office[key] = value;
  }
  const data = linked ? row : office;
  const unavailable: InstallationProgressStatus | undefined = linked
    ? input.loading ? 'loading' : input.error || !input.installation || !input.solicitud ? 'unavailable' : undefined
    : input.targetLoading ? 'loading' : input.targetError ? 'unavailable' : undefined;
  const draftRecord: Data = linked && row['draft'] && typeof row['draft'] === 'object' ? row['draft'] : {};
  const draft: Data = draftRecord['data'] && typeof draftRecord['data'] === 'object' ? draftRecord['data'] : {};
  const imei = text(first(data, 'new_device_imei', 'device_imei', 'imei')) || text(draft['device_imei']);
  const draftMatches = !text(draft['device_imei']) || !imei || text(draft['device_imei']) === imei;
  const kind = deviceKind({ ...(draftMatches ? draft : {}), ...data });
  const personalTag = kind === 'mtag_p';
  const gps = kind === 'gps';
  const corrections = linked && Array.isArray(row['correction_history']) ? row['correction_history'].filter((entry: Data) =>
    Array.isArray(entry['changed_fields']) && entry['changed_fields'].some((field: string) => IDENTITY_FIELDS.has(field)),
  ) : [];

  const catalogValue = (value: unknown, catalog?: Record<string, string>): unknown => catalog?.[text(value)] || value;
  const request: Data = linked ? input.solicitud || {} : {};
  const sourceUnavailable = linked ? unavailable : undefined;
  const creator = linked ? text(request['created_by_name']) : personName(process.creator);
  const creatorId = linked ? text(request['created_by_id'] || request['user_id']) : text(process.creator);
  const createdAt = linked ? request['createdAt'] : process.createdAt;
  const officeClient = process.client;
  const client = linked ? text(request['client_name'] || request['client_email'] || request['client_phone'])
    : personName(officeClient);
  const clientId = linked ? text(request['client_id']) : text(officeClient?._id);
  const initialChecks = [
    dataCheck(linked ? 'Solicitud registrada' : 'Proceso registrado', (linked ? request['_id'] : process._id) ? 'Registrado' : '', sourceUnavailable),
    dataCheck('Fecha de creación', dateLabel(createdAt), sourceUnavailable),
    dataCheck('Creado por', creator || (creatorId ? 'Usuario registrado; nombre no disponible' : ''), sourceUnavailable),
    dataCheck('Cliente', client || (clientId ? 'Cliente registrado; nombre no disponible' : ''), sourceUnavailable),
  ];
  const initialDetails = sourceUnavailable ? [] : details(
    ['Origen', linked ? 'Solicitud de instalación' : 'Registro en Procesos'],
    ['Fecha de creación', dateLabel(createdAt)], ['Creado por', creator], ['Cliente', client],
    ['Teléfono del cliente', linked ? request['client_phone'] : officeClient?.phone],
    ['Correo del cliente', linked ? request['client_email'] : officeClient?.email],
    ['Descripción', linked ? request['description'] : process.description],
    ['Observaciones iniciales', linked ? request['notes'] : process.details],
  );

  const evidenceFor = (field: string): Data[] => {
    if (unavailable) return [];
    if (!linked) {
      const stored = data[field];
      return photoUrl(stored) ? [typeof stored === 'object' ? stored : { url: stored }] : [];
    }
    const evidence: Data[] = Array.isArray(row['installation_evidence'])
      ? row['installation_evidence'].filter((item: Data) => item['field'] === field && photoUrl(item['url'])) : [];
    if (draftMatches) {
      for (const stored of [draftRecord['evidence']?.[field], draft[field]]) {
        if (photoUrl(stored)) evidence.push(typeof stored === 'object' ? stored : { url: stored });
      }
    }
    return evidence;
  };

  const photosFor = (fields: string[][]): InstallationProgressPhoto[] => fields.flatMap(([field, label]) => {
    const stored = evidenceFor(field).sort((a, b) => (timestamp(b['uploaded_at']) || 0) - (timestamp(a['uploaded_at']) || 0))[0];
    if (!stored) return [];
    const uploadedAt = timestamp(stored['uploaded_at']);
    return [{ label, url: photoUrl(stored), ...(uploadedAt !== null ? { uploadedAt: new Date(uploadedAt).toISOString() } : {}) }];
  });

  const photo = (field: string, label: string): InstallationProgressCheck => {
    if (unavailable) return stateCheck(label, unavailable);
    const evidence = evidenceFor(field);
    if (!evidence.length) return stateCheck(label, 'pending');
    if (corrections.length) {
      const changedAt = corrections.map((entry: Data) => timestamp(entry['corrected_at']));
      const provenAfter = changedAt.every((time: number | null) => time !== null)
        && evidence.some(item => {
          const uploaded = timestamp(item['uploaded_at']);
          return uploaded !== null && changedAt.every((time: number) => uploaded > time);
        });
      if (!provenAfter) return stateCheck(label, 'warning', 'Foto registrada; revisar después de la corrección de identidad');
    }
    return stateCheck(label, 'complete', 'Registrada');
  };

  // Assignment belongs to the request/process, never to a later device assignment.
  const technicianClosed = linked && row['completed'] === true && row['completion_source'] === 'technician';
  const assignedTechnicianId = text(linked ? input.solicitud?.mechanic_id : snapshot['mechanic_id'] || data['mechanic_id']);
  const technicianId = technicianClosed && text(row['completed_by_id']) ? text(row['completed_by_id']) : assignedTechnicianId;
  const recordedTechnicianName = (!linked || !!technicianId) && (!technicianId || text(snapshot['mechanic_id']) === technicianId)
    ? text((process as any).mechanic_name || snapshot['mechanic_name']) : '';
  const technicianName = (technicianClosed ? text(row['completed_by_name']) : '')
    || input.technicians[technicianId] || recordedTechnicianName || (technicianId ? 'Técnico registrado' : '');
  const technicianChecks = [dataCheck('Técnico responsable', technicianName, linked ? unavailable : undefined)];
  const responseLabels: Record<string, string> = { aceptada: 'Aceptada por el técnico', rechazada: 'Rechazada por el técnico', pendiente: 'Pendiente de respuesta', verificando: 'Verificando disponibilidad' };
  const response = text(request['technician_response']);
  if (linked) {
    technicianChecks.push(unavailable ? stateCheck('Respuesta del técnico', unavailable)
      : technicianClosed ? stateCheck('Respuesta del técnico', 'not-applicable', 'Instalación ya finalizada por el técnico')
      : stateCheck('Respuesta del técnico', response === 'aceptada' ? 'complete' : response === 'rechazada' ? 'warning' : 'pending', responseLabels[response] || 'Sin respuesta registrada'));
  }
  technicianChecks.push(dataCheck('Fecha registrada de instalación', dateLabel(parseProcessDisplayDate(process.registrationDate))));
  const technicianDetails = sourceUnavailable ? [] : details(
    ['Técnico responsable', technicianName],
    ['Técnico asignado actualmente a la solicitud', linked ? input.technicians[assignedTechnicianId] || (assignedTechnicianId ? 'Técnico registrado; nombre no disponible' : 'Sin técnico asignado') : ''],
    ['Respuesta actual de la solicitud', responseLabels[response]], ['Última actualización de respuesta', dateLabel(request['technician_response_updated_at'])],
    ['Fecha programada', dateLabel(row['scheduled_date'] || request['scheduled_date'])],
    ['Fecha registrada de instalación', dateLabel(parseProcessDisplayDate(process.registrationDate))],
  );
  if (!sourceUnavailable && linked) {
    const reassignments: Data[] = Array.isArray(request['reassignment_history']) && request['reassignment_history'].length
      ? request['reassignment_history'] : request['reassigned'] ? [{
        mechanic_id: request['mechanic_id'], reason: request['reassignment_reason'], reassigned_at: request['reassigned_at'],
        reassigned_by_name: request['reassigned_by_name'], reassigned_by_id: request['reassigned_by_id'],
      }] : [];
    reassignments.forEach((assignment, index) => {
      const previous = input.technicians[text(assignment['previous_mechanic_id'])];
      const next = input.technicians[text(assignment['mechanic_id'])] || (text(assignment['mechanic_id']) === technicianId ? technicianName : '');
      technicianDetails.push(...details(
        [`Reasignación ${index + 1}`, [previous, next].filter(Boolean).join(' → ')],
        [`Fecha de reasignación ${index + 1}`, dateLabel(assignment['reassigned_at'])],
        [`Reasignado por (${index + 1})`, assignment['reassigned_by_name'] || input.technicians[text(assignment['reassigned_by_id'])]],
        [`Motivo de reasignación ${index + 1}`, assignment['reason']],
      ));
    });
  }

  const vehicleChecks = personalTag ? [
    dataCheck('Nombre del objetivo', first(data, 'target_name', 'name'), unavailable),
    dataCheck('Categoría del objetivo', data['target_category'] === 'unspecified' ? '' : data['target_category'], unavailable),
  ] : [
    dataCheck('Nombre del objetivo', first(data, 'target_name', 'name'), unavailable),
    dataCheck('Marca', catalogValue(first(data, 'brand', 'target_brand_id'), input.catalogs?.brands), unavailable),
    dataCheck('Modelo', catalogValue(first(data, 'model', 'target_model_id'), input.catalogs?.models), unavailable),
    dataCheck('Año', first(data, 'year', 'target_year'), unavailable),
    dataCheck('Color', catalogValue(first(data, 'color', 'target_color'), input.catalogs?.colors), unavailable),
    dataCheck('Placa', first(data, 'plate', 'target_plate_number'), unavailable),
    dataCheck('Chasis', first(data, 'chassis', 'target_chassis_number'), unavailable),
  ];
  const verified = first(data, 'verificado', 'verified');
  if (!personalTag && verified !== undefined) {
    vehicleChecks.push(unavailable ? stateCheck('Vehículo verificado', unavailable)
      : verified === true || ['true', 'si', 'sí', 'yes', '1'].includes(text(verified).toLowerCase())
        ? stateCheck('Vehículo verificado', 'complete', 'Sí')
        : stateCheck('Vehículo verificado', 'pending', 'Verificación del vehículo pendiente'));
  }
  const protocol = data['protocol'];
  const genericType = ['gps', 'mtaga', 'mtagp'].includes(text(data['device_type']).toLowerCase().replace(/[^a-z0-9]/g, ''));
  const model = first(data, 'new_protocol', 'gps_model') || protocol?.name || protocol?.nombre || protocol
    || data['type'] || (!genericType ? data['device_type'] : '')
    || (draftMatches ? first(draft, 'type', 'protocol', 'gps_model') : '')
    || (!gps ? kind.replace('_', '-').toUpperCase() : '');
  const gpsChecks = [dataCheck('IMEI / ID del equipo', imei, unavailable),
    linked && !unavailable && !text(model) ? stateCheck('Modelo del equipo', 'unavailable', 'Modelo no disponible en el registro')
      : dataCheck('Modelo del equipo', catalogValue(model, input.catalogs?.gpsModels), unavailable)];
  if (gps) gpsChecks.push(
    dataCheck('SIM card', first(data, 'new_sim_card_number', 'sim_card_number', 'sim_card'), unavailable),
    dataCheck('Proveedor de SIM', first(data, 'new_sim_company', 'sim_company'), unavailable),
  );
  if (!personalTag) gpsChecks.push(photo('gps_numeracion_img', 'Numeración del GPS'));
  if (gps) gpsChecks.push(photo('simcard_numeracion_img', 'Numeración de la SIM'));

  const installationChecks: InstallationProgressCheck[] = [];
  if (!personalTag) installationChecks.push(dataCheck('Lugar de instalación', data['installation_location'], unavailable));
  if (gps) installationChecks.push(
    optionCheck('Apagado de motor', first(data, 'engine_shutdown', 'shutdown_control'), unavailable),
    optionCheck('Sensor de ignición', data['ignition_sensor'], unavailable),
  );
  const closureChecks: InstallationProgressCheck[] = [];
  const officeOrigin = process.after?.origin === 'office_management' || snapshot['installation_origin'] === 'office_management';
  if (linked) {
    closureChecks.push(unavailable ? stateCheck('Finalización del trabajo', unavailable)
      : row['cancelled'] === true ? stateCheck('Finalización del trabajo', 'warning', 'Proceso cancelado')
        : row['omitted'] === true ? stateCheck('Finalización del trabajo', 'warning', 'Proceso omitido')
          : row['technician_completion_missing'] === true || row['completion_source'] === 'office'
            ? stateCheck('Finalización del trabajo', 'warning', text(row['office_completion_reason']) || 'Finalizado desde oficina; falta el cierre del técnico')
            : row['completed'] === true ? stateCheck('Finalización del trabajo', 'complete', dateLabel(row['completed_at']) || 'Trabajo finalizado')
              : stateCheck('Finalización del trabajo', 'pending', 'El técnico no ha registrado el cierre'));
  } else {
    closureChecks.push(dataCheck('Registro de instalación', process._id ? officeOrigin ? 'Registrado en oficina' : 'Proceso registrado' : ''));
    if (!officeOrigin) closureChecks.push(stateCheck('Finalización del trabajo', 'unavailable', 'No hay constancia del cierre técnico'));
  }
  const installationDetails = unavailable ? [] : [
    ...checkDetails(installationChecks),
    ...details(['Inicio registrado', linked ? dateLabel(draftRecord['started_at']) : ''],
      ['Registro del equipo', linked ? dateLabel(row['registered_at']) : ''],
      ['Observaciones de instalación', data['installation_details']], ['Notas del técnico', linked ? row['notes'] : data['installation_description']]),
  ];
  const closureSource = linked ? row['completion_source'] === 'office' ? 'Oficina'
    : row['completion_source'] === 'technician' ? 'Técnico' : '' : officeOrigin ? 'Oficina' : '';
  const closureActor = linked ? text(row['completed_by_name']) || input.technicians[text(row['completed_by_id'])] : officeOrigin ? personName(process.creator) : '';
  const closureDate = linked ? row['omitted'] ? row['omitted_at'] : row['completed_at'] : officeOrigin ? process.createdAt : null;
  const closureDetails = sourceUnavailable ? [] : details(
    ['Estado del cierre', closureChecks[0]?.value], ['Origen del cierre', closureSource],
    ['Registrado por', closureActor], ['Correo del responsable', linked ? row['completed_by_email'] : officeOrigin ? process.creator?.email : ''],
    ['Fecha de cierre', dateLabel(closureDate)],
    ['Motivo del cierre desde oficina', linked ? row['office_completion_reason'] : ''],
    ['Constancia del técnico', linked && row['technician_completion_missing'] === true ? 'El técnico no registró su finalización' : ''],
    ['Motivo de omisión', linked && row['omitted'] === true ? row['omitted_reason'] : ''],
    ['Motivo de cancelación', linked && row['cancelled'] === true ? request['cancellation_reason'] || row['notes'] : ''],
  );

  // Connection is evidence captured at completion; current traccarInfo is unrelated.
  const officeStatus = process.after?.deviceStatus;
  const finalData = linked ? row : {
    final_device_status: officeStatus?.status || snapshot['final_device_status'] || snapshot['installation_device_status'],
    final_device_status_at: officeStatus?.checkedAt || snapshot['final_device_status_at'] || snapshot['installation_device_status_at'],
    final_device_online: typeof officeStatus?.online === 'boolean' ? officeStatus.online : snapshot['final_device_online'],
  };
  const finalTime = timestamp(finalData['final_device_status_at']);
  const finalStatus = text(finalData['final_device_status']);
  const normalizedStatus = finalStatus.toLowerCase();
  const reportedOffline = ['offline', 'fuera de línea', 'fuera de linea', 'no localizado'].includes(normalizedStatus);
  const reportedOnline = ['online', 'en línea', 'en linea', 'señal débil', 'localizado'].includes(normalizedStatus);
  // Office snapshots historically set online=false for a successfully located MTAG.
  const preferLocationStatus = !gps && (reportedOffline || reportedOnline);
  const offline = preferLocationStatus ? reportedOffline : finalData['final_device_online'] === false || reportedOffline;
  const online = preferLocationStatus ? reportedOnline : finalData['final_device_online'] === true || reportedOnline;
  const connectionState = linked && unavailable ? unavailable
    : finalTime === null || (!online && !offline) ? 'unavailable' : offline ? 'warning' : 'complete';
  const connectionChecks = [
    stateCheck('Estado al finalizar', connectionState, connectionState === 'loading' ? undefined
      : connectionState === 'unavailable' ? 'No hay una comprobación final disponible'
        : finalStatus || (online ? 'En línea' : personalTag || !gps ? 'No localizado' : 'Fuera de línea')),
  ];
  if (connectionState !== 'loading' && connectionState !== 'unavailable') {
    connectionChecks.push(stateCheck('Fecha de la comprobación', 'complete', dateLabel(finalData['final_device_status_at'])));
  }

  const review = process.verificationStatus;
  const verifiedAt = timestamp(process.verifiedAt);
  const reviewAfterCorrection = review === 'verified' && corrections.some((entry: Data) => {
    const correctedAt = timestamp(entry['corrected_at']);
    return verifiedAt === null || correctedAt === null || correctedAt > verifiedAt;
  });
  const reviewChecks = [stateCheck('Verificación administrativa', reviewAfterCorrection || review === 'rejected' ? 'warning'
    : review === 'verified' ? 'complete' : 'pending', reviewAfterCorrection ? 'Revisar corrección de identidad posterior o sin fecha comprobable'
      : review === 'verified' ? 'Verificado' : review === 'rejected' ? text(process.verificationNote) || 'Rechazado' : 'Pendiente de verificación')];
  const reviewer = personName(process.verifiedBy) || input.technicians[text(process.verifiedBy)];
  const reviewDetails = details(
    ['Estado administrativo', review === 'verified' ? 'Verificado' : review === 'rejected' ? 'Rechazado' : 'Pendiente'],
    ['Revisado por', reviewer], ['Fecha de revisión', dateLabel(process.verifiedAt)], ['Observación de revisión', process.verificationNote],
    ['Advertencia', reviewAfterCorrection ? reviewChecks[0].value : ''],
  );
  const beforeChecks = BEFORE_PHOTOS.map(([field, label]) => photo(field, label));
  const afterChecks = AFTER_PHOTOS.map(([field, label]) => photo(field, label));
  const beforePhotos = personalTag ? [] : photosFor(BEFORE_PHOTOS);
  const afterPhotos = personalTag ? [] : photosFor(AFTER_PHOTOS);
  const equipmentPhotos = personalTag ? [] : photosFor([
    ['gps_numeracion_img', 'Numeración del GPS'], ...(gps ? [['simcard_numeracion_img', 'Numeración de la SIM']] : []),
  ]);
  const photoDetails = (checks: InstallationProgressCheck[], photos: InstallationProgressPhoto[]): InstallationProgressDetail[] => [
    ...photos.flatMap(item => details([item.label, item.uploadedAt ? `Subida el ${dateLabel(item.uploadedAt)}` : 'Foto registrada; fecha de subida no disponible'])),
    ...checks.filter(check => check.status === 'warning').map(check => ({ label: `Revisar: ${check.label}`, value: check.value || 'Revisar esta evidencia' })),
  ];
  const noPhotos = [stateCheck('Fotografías de instalación', 'not-applicable', 'MTAG-P no requiere estas fotografías')];
  return [
    step('inicio', 'Inicio', initialChecks, { summary: creator ? `Creado por ${creator}` : linked ? 'Origen de la solicitud' : 'Origen del registro', details: initialDetails }),
    step('tecnico', 'Técnico', technicianChecks, { summary: technicianName || 'Técnico sin asignar', details: technicianDetails }),
    step('vehiculo', personalTag ? 'Objetivo' : 'Vehículo', vehicleChecks, { summary: unavailable ? '' : text(first(data, 'target_name', 'name')) || 'Datos del vehículo pendientes' }),
    step('gps', gps ? 'GPS y SIM' : 'MTAG', gpsChecks, { summary: imei ? `Equipo ${imei}` : 'Equipo sin identificar', details: [...checkDetails(gpsChecks), ...photoDetails(gpsChecks, equipmentPhotos)], photos: equipmentPhotos }),
    step('fotos-antes', 'Fotos antes', personalTag ? noPhotos : beforeChecks, { summary: `${beforePhotos.length} de ${BEFORE_PHOTOS.length} fotos registradas`, details: photoDetails(beforeChecks, beforePhotos), photos: beforePhotos }),
    step('instalacion', 'Instalación', installationChecks, { summary: text(data['installation_location']) || 'Configuración de la instalación', details: installationDetails }),
    step('fotos-despues', 'Fotos después', personalTag ? noPhotos : afterChecks, { summary: `${afterPhotos.length} de ${AFTER_PHOTOS.length} fotos registradas`, details: photoDetails(afterChecks, afterPhotos), photos: afterPhotos }),
    step('conexion', 'Conexión final', connectionChecks, { summary: connectionChecks[0].value }),
    step('cierre', 'Cierre', closureChecks, { summary: linked ? row['cancelled'] ? 'Proceso cancelado' : row['omitted'] ? 'Proceso omitido'
      : row['completed'] ? closureSource ? `Finalizado por ${closureSource.toLowerCase()}` : 'Trabajo finalizado' : 'Cierre pendiente'
      : officeOrigin ? 'Registrado desde oficina' : 'Sin cierre técnico documentado', details: closureDetails }),
    step('revision', 'Revisión', reviewChecks, { summary: reviewAfterCorrection ? 'Revisar corrección de identidad'
      : reviewer && review !== 'pending' && review ? `${review === 'verified' ? 'Verificado' : 'Rechazado'} por ${reviewer}` : reviewChecks[0].value, details: reviewDetails }),
  ];
}
