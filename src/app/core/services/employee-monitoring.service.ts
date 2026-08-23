import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { record } from '@rrweb/record';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface EmployeeMonitoringStatus {
  user_id: string;
  online: boolean;
  last_seen: string | null;
  current_route: string | null;
  current_page_title: string | null;
  current_session_id: string | null;
  platform: 'mobile' | 'desktop' | null;
  events_last_hour: number;
  sessions_last_hour: number;
  first_event_at: string | null;
  last_event_at: string | null;
}

export interface EmployeeReplaySession {
  session_id: string;
  platform: 'mobile' | 'desktop';
  route: string | null;
  page_title: string | null;
  first_event_at: string;
  last_event_at: string;
  event_count: number;
  chunk_count: number;
}

export interface EmployeeReplayChunkResponse {
  chunks: Array<{
    id: string;
    route: string | null;
    page_title: string | null;
    first_event_at: string;
    last_event_at: string;
    events: any[];
  }>;
  cursor: string | null;
  has_more: boolean;
}

@Injectable({ providedIn: 'root' })
export class EmployeeMonitoringService {
  private readonly apiUrl = `${environment.apiUrl}/employee-monitoring`;
  private readonly sessionStorageKey = 'employee_monitoring_session';
  private readonly sessionStartedKey = 'employee_monitoring_session_started';
  private readonly maxBufferedEvents = 1_000;

  private stopRecorder?: () => void;
  private bufferedEvents: any[] = [];
  private flushTimer?: ReturnType<typeof setInterval>;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private authTimer?: ReturnType<typeof setInterval>;
  private flushInProgress = false;
  private activeUserId = '';

  constructor(private readonly http: HttpClient) {}

  start(): void {
    if (this.authTimer) return;

    this.syncRecorderWithSession();
    this.authTimer = setInterval(() => this.syncRecorderWithSession(), 3_000);
    this.flushTimer = setInterval(() => this.flush(), 2_000);
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), 10_000);
  }

  stop(): void {
    this.flush();
    this.stopRecorder?.();
    this.stopRecorder = undefined;
    this.activeUserId = '';

    if (this.authTimer) clearInterval(this.authTimer);
    if (this.flushTimer) clearInterval(this.flushTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.authTimer = undefined;
    this.flushTimer = undefined;
    this.heartbeatTimer = undefined;
  }

  getOverview(): Observable<EmployeeMonitoringStatus[]> {
    return this.http.get<EmployeeMonitoringStatus[]>(`${this.apiUrl}/overview`);
  }

  getSessions(userId: string, hours = 1): Observable<EmployeeReplaySession[]> {
    const params = new HttpParams().set('hours', String(hours));
    return this.http.get<EmployeeReplaySession[]>(
      `${this.apiUrl}/users/${userId}/sessions`,
      { params },
    );
  }

  getSessionEvents(
    userId: string,
    sessionId: string,
    after?: string | null,
    limit = 100,
  ): Observable<EmployeeReplayChunkResponse> {
    let params = new HttpParams().set('limit', String(limit));
    if (after) params = params.set('after', after);

    return this.http.get<EmployeeReplayChunkResponse>(
      `${this.apiUrl}/users/${userId}/sessions/${encodeURIComponent(sessionId)}/events`,
      { params },
    );
  }

  recordReplayAccess(
    employeeId: string,
    sessionId: string | null,
    mode: 'live' | 'last_hour',
  ): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.apiUrl}/replay-access`, {
      employee_id: employeeId,
      session_id: sessionId || undefined,
      mode,
    });
  }

  private syncRecorderWithSession(): void {
    const user = this.currentUser();
    const userId = String(user?.id || user?._id || '');

    if (!this.isEmployee(user)) {
      if (this.stopRecorder) {
        this.flush();
        this.stopRecorder();
        this.stopRecorder = undefined;
        this.activeUserId = '';
      }
      return;
    }

    if (!this.stopRecorder || this.activeUserId !== userId) {
      this.stopRecorder?.();
      this.activeUserId = userId;
      this.ensureSession(userId);
      this.stopRecorder = record({
        emit: (event: any) => {
          this.bufferedEvents.push(event);
          if (this.bufferedEvents.length > this.maxBufferedEvents) {
            this.bufferedEvents.splice(
              0,
              this.bufferedEvents.length - this.maxBufferedEvents,
            );
          }
        },
        checkoutEveryNms: 60_000,
        blockSelector: [
          '[data-replay-block]',
          '.session-replay-block',
          'input[type="password"]',
          'input[autocomplete^="cc-"]',
          'input[name*="password" i]',
          'input[name*="token" i]',
          'input[name*="secret" i]',
          'input[name*="cvv" i]',
          'input[name*="card_number" i]',
        ].join(', '),
        maskInputOptions: { password: true },
        recordCanvas: false,
        collectFonts: true,
        inlineImages: false,
        mousemoveWait: 80,
      });
      this.sendHeartbeat();
    }

    this.ensureSession(userId);
  }

  private flush(): void {
    if (
      this.flushInProgress ||
      !this.stopRecorder ||
      !this.bufferedEvents.length ||
      !this.activeUserId
    ) {
      return;
    }

    const events = this.bufferedEvents.splice(0, 250);
    const payload = this.sessionPayload();
    if (!payload) {
      this.bufferedEvents.unshift(...events);
      return;
    }

    this.flushInProgress = true;
    this.http
      .post(`${this.apiUrl}/events`, { ...payload, events })
      .subscribe({
        next: () => {
          this.flushInProgress = false;
          if (this.bufferedEvents.length) this.flush();
        },
        error: () => {
          this.bufferedEvents.unshift(...events);
          if (this.bufferedEvents.length > this.maxBufferedEvents) {
            this.bufferedEvents.length = this.maxBufferedEvents;
          }
          this.flushInProgress = false;
        },
      });
  }

  private sendHeartbeat(): void {
    if (!this.stopRecorder || !this.activeUserId) return;
    const payload = this.sessionPayload();
    if (!payload) return;
    this.http.post(`${this.apiUrl}/heartbeat`, payload).subscribe({
      error: () => undefined,
    });
  }

  private sessionPayload(): {
    session_id: string;
    platform: 'desktop';
    route: string;
    page_title: string;
  } | null {
    const sessionId = this.ensureSession(this.activeUserId);
    if (!sessionId) return null;
    return {
      session_id: sessionId,
      platform: 'desktop',
      route: window.location.pathname,
      page_title: document.title,
    };
  }

  private ensureSession(userId: string): string {
    const currentId = sessionStorage.getItem(this.sessionStorageKey);
    const startedAt = Number(
      sessionStorage.getItem(this.sessionStartedKey) || 0,
    );
    const expired = !startedAt || Date.now() - startedAt >= 60 * 60 * 1_000;
    const belongsToUser = currentId?.startsWith(`${userId}:`);

    if (!currentId || expired || !belongsToUser) {
      const nextId = `${userId}:${Date.now()}:${Math.random()
        .toString(36)
        .slice(2, 10)}`;
      sessionStorage.setItem(this.sessionStorageKey, nextId);
      sessionStorage.setItem(this.sessionStartedKey, String(Date.now()));
      if (this.stopRecorder) record.takeFullSnapshot(true);
      return nextId;
    }

    return currentId;
  }

  private currentUser(): any | null {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private isEmployee(user: any): boolean {
    const isAdministrator =
      user?.root === true ||
      String(user?.root).toLowerCase() === 'true' ||
      user?.developer === true ||
      String(user?.developer).toLowerCase() === 'true';
    if (!user || isAdministrator) return false;
    const affiliation = String(
      user.affiliation_type_id?.name ||
        user.affiliation_type_id ||
        user.affiliation_type ||
        '',
    )
      .trim()
      .toLowerCase();
    return affiliation === 'empleado' || affiliation === 'tecnico_empleado';
  }
}
