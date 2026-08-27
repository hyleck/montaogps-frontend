import { UserActivity } from '../../../../../../core/services/user-activity.service';
import {
  getEmployeeActivityDetail,
  getEmployeeActivityTitle,
  groupConsecutiveEmployeeActivities,
} from './employee-activity-display';

describe('employee activity display', () => {
  const activity = (
    action: string,
    route: string,
    occurredAt: string,
    metadata: Record<string, any> = {},
  ): UserActivity => ({
    user_id: 'employee-1',
    platform: 'desktop',
    type: 'action',
    action,
    route,
    metadata,
    occurred_at: occurredAt,
  });

  it('translates API actions into natural Spanish', () => {
    const value = activity(
      'Update /Solicitudes/:Id',
      '/solicitudes/6a901519166915e80a23383c5',
      '2026-08-27T15:03:34.000Z',
    );

    expect(getEmployeeActivityTitle(value)).toBe('Actualizó una solicitud');
  });

  it('groups only consecutive repetitions into one action', () => {
    const values = [
      activity('Update /Solicitudes/:Id', '/solicitudes/1', '2026-08-27T15:03:34.000Z'),
      activity('Update /Solicitudes/:Id', '/solicitudes/2', '2026-08-27T15:02:41.000Z'),
      activity('Create /Solicitudes', '/solicitudes', '2026-08-27T14:28:01.000Z'),
      activity('Update /Solicitudes/:Id', '/solicitudes/3', '2026-08-27T14:17:34.000Z'),
    ];

    const grouped = groupConsecutiveEmployeeActivities(values);

    expect(grouped.length).toBe(3);
    expect(getEmployeeActivityTitle(grouped[0])).toBe('Actualizó 2 solicitudes');
    expect(getEmployeeActivityTitle(grouped[1])).toBe('Creó una solicitud');
    expect(getEmployeeActivityTitle(grouped[2])).toBe('Actualizó una solicitud');
  });

  it('shows useful target metadata instead of the internal API route', () => {
    const value = activity(
      'Update /Devices/:Id',
      '/devices/6a901519166915e80a23383c5',
      '2026-08-27T15:03:34.000Z',
      { targetName: 'Honda CR-V', imei: '862667088312908' },
    );

    expect(getEmployeeActivityDetail(value)).toBe('Honda CR-V');
  });

  it('describes clicks using the visible control label', () => {
    const value = activity(
      'click',
      '/management',
      '2026-08-27T15:03:34.000Z',
      { label: 'Guardar usuario' },
    );

    expect(getEmployeeActivityTitle(value)).toBe('Hizo clic en Guardar usuario');
  });
});
