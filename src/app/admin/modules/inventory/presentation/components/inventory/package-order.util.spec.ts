import { isIncosisPackage, orderPackages } from './package-order.util';
import { Package } from '../../../../../../core/services/inventory.service';

describe('Package registration ordering', () => {
  const pkg = (id: string, createdAt?: string, incosis = false): Package => ({ _id: id, title: id, date: '2099-01-01', price: 0, createdAt, ...(incosis ? { incosisExpense: { expenseId: id } } : {}) });
  it('puts Incosis first and orders both groups by registration, never by expense or edit date', () => {
    const rows = [pkg('manual-new', '2026-09-10'), pkg('incosis-old', '2026-09-01', true), pkg('manual-old', '2026-08-01'), pkg('incosis-new', '2026-09-09', true)];
    rows[1].updatedAt = '2099-01-01';
    expect(orderPackages(rows).map(row => row._id)).toEqual(['incosis-new', 'incosis-old', 'manual-new', 'manual-old']);
    expect(rows[0]._id).toBe('manual-new');
  });
  it('has deterministic ties and places missing or invalid registration dates last within their group', () => {
    expect(orderPackages([pkg('a'), pkg('c', '2026-09-09'), pkg('b', '2026-09-09'), pkg('d', 'invalid')]).map(row => row._id)).toEqual(['c', 'b', 'd', 'a']);
    expect(orderPackages([])).toEqual([]);
  });
  it('uses the actual origin link, not the title or presence of declared content', () => {
    const manual = pkg('INCOSIS'); manual.declaredContent = { gpsQuantity: 1, cableQuantity: 0, relayQuantity: 0, models: [] };
    expect(isIncosisPackage(manual)).toBeFalse();
    expect(isIncosisPackage({ ...manual, incosisExpense: {} })).toBeFalse();
    expect(isIncosisPackage(pkg('linked', undefined, true))).toBeTrue();
  });
});
