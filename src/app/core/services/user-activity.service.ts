import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NavigationEnd, Router } from '@angular/router';
import { filter, Subscription } from 'rxjs';

export interface UserActivity {
  _id?: string;
  user_id: string;
  platform: 'mobile' | 'desktop';
  type: 'screen' | 'action';
  screen?: string;
  route?: string;
  action?: string;
  element?: string;
  metadata?: Record<string, any>;
  occurred_at: string | Date;
}

export interface UserActivityResponse {
  activities: UserActivity[];
  totalCount: number;
}

@Injectable({ providedIn: 'root' })
export class UserActivityService {
  private readonly apiUrl = `${environment.apiUrl}/user-activity`;
  private readonly platform = 'desktop' as const;
  private pendingEvents: Array<Omit<UserActivity, '_id' | 'user_id'>> = [];
  private routeSubscription?: Subscription;
  private flushTimer?: ReturnType<typeof setInterval>;
  private started = false;
  private readonly clickHandler = (event: MouseEvent) => this.recordClick(event);

  constructor(private http: HttpClient, private router: Router) {}

  start(): void {
    if (this.started) return;
    this.started = true;
    this.routeSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.enqueue({
        platform: this.platform,
        type: 'screen',
        screen: document.title || this.humanizeRoute(event.urlAfterRedirects),
        route: event.urlAfterRedirects,
        action: 'navigation',
        occurred_at: new Date(),
      }));
    document.addEventListener('click', this.clickHandler, true);
    this.flushTimer = setInterval(() => this.flush(), 2_000);
  }

  stop(): void {
    this.flush();
    this.routeSubscription?.unsubscribe();
    this.routeSubscription = undefined;
    document.removeEventListener('click', this.clickHandler, true);
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = undefined;
    this.started = false;
  }

  recordGpsMapView(target: any): Observable<UserActivity> {
    const targetId = target?._id || target?.id;
    const imei = target?.device_imei || target?.imei || target?.deviceId;
    return this.http.post<UserActivity>(this.apiUrl, {
      platform: 'desktop',
      type: 'action',
      screen: 'management/map',
      route: targetId ? `/devices/${targetId}/map` : '/devices/map',
      action: 'view gps',
      element: 'map',
      metadata: {
        resource: 'devices',
        targetId,
        targetName: target?.name || target?.target_name || target?.targetName,
        deviceName: target?.name || target?.target_name || target?.targetName,
        imei,
      },
    });
  }

  getByUser(userId: string, limit: number = 30, since?: string): Observable<UserActivityResponse> {
    let params = new HttpParams().set('limit', String(limit));
    if (since) params = params.set('since', since);
    return this.http.get<UserActivityResponse>(`${this.apiUrl}/user/${userId}`, { params });
  }

  private recordClick(event: MouseEvent): void {
    const target = event.target instanceof Element
      ? event.target.closest('button, a, [role="button"], input, select, textarea')
      : null;
    if (!target) return;
    const element = this.describeElement(target);
    this.enqueue({
      platform: this.platform,
      type: 'action',
      screen: document.title,
      route: this.router.url || window.location.pathname,
      action: 'click',
      element,
      metadata: { label: element, source: 'client-monitoring' },
      occurred_at: new Date(),
    });
  }

  private enqueue(event: Omit<UserActivity, '_id' | 'user_id'>): void {
    if (!localStorage.getItem('authtoken')) return;
    this.pendingEvents.push(event);
    if (this.pendingEvents.length > 500) {
      this.pendingEvents.splice(0, this.pendingEvents.length - 500);
    }
    if (this.pendingEvents.length >= 50) this.flush();
  }

  private flush(): void {
    if (!this.pendingEvents.length || !localStorage.getItem('authtoken')) return;
    const events = this.pendingEvents.splice(0, 100);
    this.http.post(`${this.apiUrl}/batch`, { events }).subscribe({
      error: () => {
        this.pendingEvents.unshift(...events);
        if (this.pendingEvents.length > 500) this.pendingEvents.length = 500;
      },
    });
  }

  private describeElement(element: Element): string {
    const label = String(
      element.getAttribute('aria-label') ||
      element.getAttribute('title') ||
      (element instanceof HTMLInputElement ? element.placeholder : '') ||
      element.textContent ||
      element.tagName,
    ).replace(/\s+/g, ' ').trim().slice(0, 180);
    return label || element.tagName.toLowerCase();
  }

  private humanizeRoute(route: string): string {
    const value = String(route || '').split('?')[0].replace(/^\//, '').replace(/[-_/]+/g, ' ').trim();
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Inicio';
  }
}
