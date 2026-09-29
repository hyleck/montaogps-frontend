import type { RenewalExpirationFilter } from '../services/renewal-links.service';
import { parseProcessDisplayDate } from './process-date.util';

/** These are calendar dates, independent of the browser's time zone. */
export function renewalFilterDate(value: Date | null): string | undefined {
  if (!value || !Number.isFinite(value.getTime())) return undefined;
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function renewalExpirationFilterLabel(filter?: RenewalExpirationFilter): string {
  const day = (value?: string) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !parseProcessDisplayDate(value)) return '';
    return value.split('-').reverse().join('/');
  };
  const from = day(filter?.dateFrom);
  const to = day(filter?.dateTo);
  if (filter?.mode === 'range') {
    if (from && to) return `Del ${from} al ${to}, ambas fechas incluidas`;
    if (from) return `Desde el ${from}, inclusive`;
    if (to) return `Hasta el ${to}, inclusive`;
  }
  if (filter?.mode === 'expired') {
    const cutoff = day(filter.asOf);
    return cutoff ? `Vencidos antes del ${cutoff}` : 'Solo dispositivos vencidos';
  }
  if (filter?.mode === 'all') return 'Todos los vencimientos';
  return 'Sin rango de vencimiento registrado en este enlace';
}
