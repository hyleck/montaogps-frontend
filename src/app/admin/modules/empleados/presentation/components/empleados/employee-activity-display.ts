import { UserActivity } from '../../../../../../core/services/user-activity.service';

export interface GroupedEmployeeActivity extends UserActivity {
  groupCount: number;
}

interface ActivityDescription {
  key: string;
  singular: string;
  grouped: (count: number) => string;
}

interface ResourceDescription {
  key: string;
  singular: string;
  plural: string;
  countable: boolean;
}

const RESOURCE_DESCRIPTIONS: Record<string, ResourceDescription> = {
  solicitudes: { key: 'solicitudes', singular: 'una solicitud', plural: 'solicitudes', countable: true },
  devices: { key: 'devices', singular: 'un GPS', plural: 'GPS', countable: true },
  users: { key: 'users', singular: 'un usuario', plural: 'usuarios', countable: true },
  simcards: { key: 'simcards', singular: 'una SIM card', plural: 'SIM cards', countable: true },
  commands: { key: 'commands', singular: 'un comando', plural: 'comandos', countable: true },
  processes: { key: 'processes', singular: 'un proceso', plural: 'procesos', countable: true },
  targets: { key: 'targets', singular: 'un objetivo', plural: 'objetivos', countable: true },
  roles: { key: 'roles', singular: 'un rol', plural: 'roles', countable: true },
  plans: { key: 'plans', singular: 'un plan', plural: 'planes', countable: true },
  reports: { key: 'reports', singular: 'un reporte', plural: 'reportes', countable: true },
  notifications: { key: 'notifications', singular: 'una notificación', plural: 'notificaciones', countable: true },
  inventory: { key: 'inventory', singular: 'el inventario', plural: 'el inventario', countable: false },
  monitoring: { key: 'monitoring', singular: 'el monitoreo', plural: 'el monitoreo', countable: false },
  communication: { key: 'communication', singular: 'comunicación', plural: 'comunicación', countable: false },
  whatsapp: { key: 'whatsapp', singular: 'una conversación', plural: 'conversaciones', countable: true },
  campaigns: { key: 'campaigns', singular: 'una campaña', plural: 'campañas', countable: true },
  auth: { key: 'auth', singular: 'su sesión', plural: 'su sesión', countable: false },
};

const ACTION_VERBS: Record<string, string> = {
  create: 'Creó',
  post: 'Creó',
  update: 'Actualizó',
  edit: 'Actualizó',
  patch: 'Actualizó',
  delete: 'Eliminó',
  remove: 'Eliminó',
  view: 'Consultó',
  read: 'Consultó',
  get: 'Consultó',
  search: 'Buscó',
};

export function groupConsecutiveEmployeeActivities(
  activities: UserActivity[],
): GroupedEmployeeActivity[] {
  const grouped: GroupedEmployeeActivity[] = [];

  for (const activity of activities || []) {
    const description = describeActivity(activity);
    const previous = grouped[grouped.length - 1];
    const previousKey = previous ? describeActivity(previous).key : '';

    if (previous && previousKey === description.key) {
      previous.groupCount += 1;
      continue;
    }

    grouped.push({ ...activity, groupCount: 1 });
  }

  return grouped;
}

export function getEmployeeActivityTitle(
  activity: UserActivity & { groupCount?: number },
): string {
  const description = describeActivity(activity);
  const count = Math.max(1, Number(activity.groupCount) || 1);
  return count > 1 ? description.grouped(count) : description.singular;
}

export function getEmployeeActivityDetail(
  activity: UserActivity & { groupCount?: number },
): string {
  if ((Number(activity.groupCount) || 1) > 1) return '';

  const metadata = activity.metadata || {};
  const targetName = cleanText(
    metadata['targetName'] || metadata['deviceName'] || metadata['userName'],
  );
  const email = cleanText(metadata['email']);
  const imei = cleanText(metadata['imei']);

  if (targetName) return targetName;
  if (email) return email;
  if (imei) return `IMEI ${imei}`;
  return '';
}

function describeActivity(activity: UserActivity): ActivityDescription {
  const action = cleanText(activity.action).toLowerCase();
  const resource = resolveResource(activity);

  if (action === 'click') {
    const label = cleanText(activity.metadata?.['label'] || activity.element);
    const target = label ? ` en ${label}` : '';
    return repeatableDescription(
      `click:${label.toLowerCase() || 'control'}`,
      `Hizo clic${target}`,
    );
  }

  if (action === 'view gps' || action === 'view gps by imei') {
    return countableDescription('view:devices', 'Consultó un GPS', 'Consultó', 'GPS');
  }

  if (action === 'support impersonation start') {
    return repeatableDescription(
      'support:impersonation:start',
      'Inició un acceso de soporte',
    );
  }
  if (action === 'support impersonation end') {
    return repeatableDescription(
      'support:impersonation:end',
      'Finalizó un acceso de soporte',
    );
  }

  const verbKey = firstActionWord(action);
  const verb = ACTION_VERBS[verbKey];
  if (verb) {
    return resource.countable
      ? countableDescription(
          `${verbKey}:${resource.key}`,
          `${verb} ${resource.singular}`,
          verb,
          resource.plural,
        )
      : repeatableDescription(
          `${verbKey}:${resource.key}`,
          `${verb} ${resource.singular}`,
        );
  }

  if (activity.type === 'screen') {
    const screenLabel = screenDescription(resource);
    return repeatableDescription(`screen:${resource.key}`, screenLabel);
  }

  const naturalAction = humanizeUnknownAction(action);
  if (naturalAction) {
    return repeatableDescription(`action:${naturalAction}`, naturalAction);
  }

  return repeatableDescription(
    `activity:${resource.key}`,
    `Trabajó en ${resource.singular}`,
  );
}

function resolveResource(activity: UserActivity): ResourceDescription {
  const metadataResource = cleanText(activity.metadata?.['resource']);
  const candidates = [
    metadataResource,
    cleanText(activity.action).replace(/^[a-z]+\s+/i, ''),
    cleanText(activity.route),
    cleanText(activity.screen),
  ];

  let unknownKey = '';
  for (const candidate of candidates) {
    const key = firstRouteSegment(candidate);
    if (RESOURCE_DESCRIPTIONS[key]) return RESOURCE_DESCRIPTIONS[key];
    if (!unknownKey && key && !ACTION_VERBS[key]) unknownKey = key;
  }

  if (unknownKey) {
    const label = humanizeResourceSegment(unknownKey);
    return {
      key: unknownKey,
      singular: `la sección de ${label}`,
      plural: `la sección de ${label}`,
      countable: false,
    };
  }

  return {
    key: 'platform',
    singular: 'la plataforma',
    plural: 'la plataforma',
    countable: false,
  };
}

function humanizeResourceSegment(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function firstActionWord(action: string): string {
  return action.match(/^[a-z]+/i)?.[0]?.toLowerCase() || '';
}

function firstRouteSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/^\/+/, '')
    .split(/[/:?\s]/)
    .filter(Boolean)[0] || '';
}

function countableDescription(
  key: string,
  singular: string,
  verb: string,
  plural: string,
): ActivityDescription {
  return {
    key,
    singular,
    grouped: (count) => `${verb} ${count} ${plural}`,
  };
}

function repeatableDescription(key: string, singular: string): ActivityDescription {
  return {
    key,
    singular,
    grouped: (count) => `${singular} ${count} veces`,
  };
}

function screenDescription(resource: ResourceDescription): string {
  if (resource.key === 'platform') return 'Cambió de pantalla';
  if (resource.countable) return `Entró al módulo de ${resource.plural}`;
  return `Entró a ${resource.singular}`;
}

function humanizeUnknownAction(action: string): string {
  if (!action || action.includes('/')) return '';
  const value = action.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function cleanText(value: unknown): string {
  return String(value || '').trim();
}
