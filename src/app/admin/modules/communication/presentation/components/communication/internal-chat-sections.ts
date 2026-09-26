/**
 * El chat interno tiene dos secciones: «Equipo», con el chat de los empleados
 * administrativos, y «Técnicos», con un chat por técnico. Aquí vive la regla
 * que decide a cuál pertenece cada grupo, para no repetirla en la pantalla.
 */
export interface SectionableInternalGroup {
  type?: string | null;
  unreadCount?: number | null;
}

export function isTechnicianGroup(
  group: SectionableInternalGroup | null | undefined,
): boolean {
  return Boolean(group) && String(group?.type || '').trim() !== 'admin';
}

export function teamGroupsOf<T extends SectionableInternalGroup>(
  groups: readonly T[] = [],
): T[] {
  return groups.filter(group => !isTechnicianGroup(group));
}

export function technicianGroupsOf<T extends SectionableInternalGroup>(
  groups: readonly T[] = [],
): T[] {
  return groups.filter(group => isTechnicianGroup(group));
}

export function countUnreadMessages(
  groups: readonly SectionableInternalGroup[] = [],
): number {
  return groups.reduce(
    (total, group) => total + Math.max(0, Number(group?.unreadCount) || 0),
    0,
  );
}
