import type { Package } from '../../../../../../core/services/inventory.service';

export const isIncosisPackage = (pkg: Package): boolean => !!pkg.incosisExpense?.expenseId;

export function orderPackages(packages: Package[]): Package[] {
  const registeredAt = (pkg: Package): number => {
    const timestamp = pkg.createdAt ? Date.parse(pkg.createdAt) : 0;
    return Number.isFinite(timestamp) ? timestamp : 0;
  };
  return [...packages].sort((a, b) =>
    Number(isIncosisPackage(b)) - Number(isIncosisPackage(a)) ||
    registeredAt(b) - registeredAt(a) ||
    (b._id || '').localeCompare(a._id || ''),
  );
}
