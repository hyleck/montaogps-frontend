import { ActivatedRouteSnapshot, DetachedRouteHandle, RouteReuseStrategy } from '@angular/router';

export class AppRouteReuseStrategy implements RouteReuseStrategy {
  private storedHandles = new Map<string, DetachedRouteHandle>();

  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    return !!this.getReuseKey(route);
  }

  store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    const key = this.getReuseKey(route);
    if (key && handle) {
      this.storedHandles.set(key, handle);
    }
  }

  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    const key = this.getReuseKey(route);
    return !!key && this.storedHandles.has(key);
  }

  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    const key = this.getReuseKey(route);
    return key ? this.storedHandles.get(key) || null : null;
  }

  shouldReuseRoute(future: ActivatedRouteSnapshot, current: ActivatedRouteSnapshot): boolean {
    const futureKey = this.getReuseKey(future);
    const currentKey = this.getReuseKey(current);
    if (futureKey && currentKey && futureKey === currentKey) {
      return true;
    }

    return future.routeConfig === current.routeConfig;
  }

  private getReuseKey(route: ActivatedRouteSnapshot): string | null {
    const key = route.data?.['reuseKey'];
    return typeof key === 'string' && key.trim() ? key.trim() : null;
  }
}
