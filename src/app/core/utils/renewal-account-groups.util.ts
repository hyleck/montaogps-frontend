export interface RenewalAccountLike {
  account?: { id?: string; path: string[] };
}

export interface RenewalAccountGroup<T> {
  key: string;
  /** Route from the link's client to the account, as the monitoring module shows it. */
  path: string[];
  items: T[];
}

/**
 * Groups GPS by the account that owns them: the client's own account first and
 * then each subaccount alphabetically, keeping the original order inside each.
 */
export function groupByRenewalAccount<T extends RenewalAccountLike>(items: T[]): RenewalAccountGroup<T>[] {
  const groups = new Map<string, RenewalAccountGroup<T>>();
  for (const item of items) {
    const path = item.account?.path?.filter(Boolean) ?? [];
    const key = path.join(' › ');
    const group = groups.get(key) ?? { key, path, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()].sort((left, right) =>
    (left.path.length <= 1 ? 0 : 1) - (right.path.length <= 1 ? 0 : 1)
    || left.key.localeCompare(right.key, 'es'));
}

/** Headers only help when the GPS belong to more than one account. */
export function hasSeveralRenewalAccounts<T extends RenewalAccountLike>(groups: RenewalAccountGroup<T>[]): boolean {
  return groups.length > 1;
}
