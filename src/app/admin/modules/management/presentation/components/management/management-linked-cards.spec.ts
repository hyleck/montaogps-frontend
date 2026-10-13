import { ManagementComponent } from './management.component';

describe('ManagementComponent linked target cards', () => {
  const component: any = Object.create(ManagementComponent.prototype);
  const gps = (id: string, imei: string, extra: any = {}) => ({ _id: id, device_imei: imei, ...extra });

  it('groups a MLock with a primary that arrived later, at the MLock position', () => {
    const rows = component.buildLinkedTargetCardRows([
      gps('mlock', '000008826030319', { gps_adicional: '354778343956812' }),
      gps('other', '869890088000001'),
      gps('primary', '354778343956812'),
    ]);
    expect(rows.map((row: any) => row.isLinkedPairCard ? row.linkedTargets.map((t: any) => t._id) : row._id))
      .toEqual([['primary', 'mlock'], 'other']);
  });

  it('keeps a MLock alone when its primary is not loaded', () => {
    const rows = component.buildLinkedTargetCardRows([gps('mlock', '000008826030319', { gps_adicional: '354778343956812' })]);
    expect(rows.length).toBe(1);
    expect(rows[0].isLinkedPairCard).toBeFalsy();
  });

  it('does not duplicate a companion when its own page arrives later', () => {
    const merged = component.uniqueTargetsById([gps('a', '1'), gps('primary', '2'), gps('primary', '2'), gps('b', '3')]);
    expect(merged.map((target: any) => target._id)).toEqual(['a', 'primary', 'b']);
  });
});
