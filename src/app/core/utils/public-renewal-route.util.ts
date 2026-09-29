export function isPublicRenewalRoute(url: string): boolean {
  return /^\/renovar(?:\/|[?#]|$)/.test(url || '');
}
