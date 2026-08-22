export const ONLINE_GRACE_PERIOD_MINUTES = 10;
export const WEAK_SIGNAL_MAX_DURATION_MINUTES = 60;

export function getOfflineDurationInMinutes(
  lastUpdate?: string | Date | null,
  nowMs: number = Date.now(),
): number | null {
  if (!lastUpdate) return null;

  const lastUpdateDate = new Date(lastUpdate);
  if (Number.isNaN(lastUpdateDate.getTime())) return null;

  const diffMs = nowMs - lastUpdateDate.getTime();
  if (diffMs < 0) return null;

  return Math.floor(diffMs / 60_000);
}

export function getGpsDisplayConnectionStatus(
  rawStatus?: string | null,
  lastUpdate?: string | Date | null,
  nowMs: number = Date.now(),
): string {
  const status = rawStatus || 'offline';
  const normalizedStatus = String(status).trim().toLowerCase();

  if (
    normalizedStatus === 'online'
    || normalizedStatus === 'localizado'
    || normalizedStatus === 'no localizado'
  ) {
    return status;
  }

  const offlineMinutes = getOfflineDurationInMinutes(lastUpdate, nowMs);
  if (offlineMinutes !== null && offlineMinutes <= ONLINE_GRACE_PERIOD_MINUTES) {
    return 'online';
  }

  if (
    offlineMinutes !== null
    && offlineMinutes > ONLINE_GRACE_PERIOD_MINUTES
    && offlineMinutes <= WEAK_SIGNAL_MAX_DURATION_MINUTES
  ) {
    return 'Señal débil';
  }

  return status;
}
