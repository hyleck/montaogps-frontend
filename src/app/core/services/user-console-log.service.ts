import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type UserConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

export interface UserConsoleLog {
  _id?: string;
  user_id: string;
  platform: 'desktop' | 'mobile';
  level: UserConsoleLevel;
  message: string;
  route?: string;
  occurred_at: string | Date;
}

export interface UserConsoleLogResponse {
  logs: UserConsoleLog[];
  totalCount: number;
}

export interface ConsoleCaptureStatus {
  enabled: boolean;
  forced: boolean;
}

export interface LocalConsoleDiagnostic {
  level: 'warn' | 'error';
  message: string;
  route: string;
  occurred_at: string;
}

interface PendingConsoleLog {
  platform: 'desktop';
  level: UserConsoleLevel;
  message: string;
  route: string;
  occurred_at: string;
}

@Injectable({ providedIn: 'root' })
export class UserConsoleLogService {
  private readonly apiUrl = `${environment.apiUrl}/user-activity/console`;
  private readonly levels: UserConsoleLevel[] = ['log', 'info', 'warn', 'error', 'debug'];
  private readonly originals = new Map<UserConsoleLevel, (...args: any[]) => void>();
  private buffer: PendingConsoleLog[] = [];
  private flushTimer?: ReturnType<typeof setInterval>;
  private statusTimer?: ReturnType<typeof setInterval>;
  private started = false;
  private captureEnabled = false;
  private statusRequestInFlight = false;
  private activeUserId = '';
  private readonly localDiagnostics: LocalConsoleDiagnostic[] = [];
  private readonly windowErrorHandler = (event: ErrorEvent) => {
    this.enqueue('error', [event.error || event.message]);
  };
  private readonly rejectionHandler = (event: PromiseRejectionEvent) => {
    this.enqueue('error', ['Unhandled promise rejection', event.reason]);
  };

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
  ) {}

  start(): void {
    if (this.started) return;
    this.started = true;
    this.captureEnabled = this.isEmployeeUser();

    this.levels.forEach((level) => {
      const original = console[level].bind(console);
      this.originals.set(level, original);
      console[level] = (...args: any[]) => {
        original(...args);
        this.enqueue(level, args);
      };
    });

    window.addEventListener('error', this.windowErrorHandler);
    window.addEventListener('unhandledrejection', this.rejectionHandler);
    this.flushTimer = setInterval(() => this.flush(), 2_000);
    this.refreshCaptureStatus();
    this.statusTimer = setInterval(() => this.refreshCaptureStatus(), 15_000);
  }

  stop(): void {
    if (!this.started) return;
    this.flush();
    this.levels.forEach((level) => {
      const original = this.originals.get(level);
      if (original) console[level] = original;
    });
    this.originals.clear();
    window.removeEventListener('error', this.windowErrorHandler);
    window.removeEventListener('unhandledrejection', this.rejectionHandler);
    if (this.flushTimer) clearInterval(this.flushTimer);
    if (this.statusTimer) clearInterval(this.statusTimer);
    this.flushTimer = undefined;
    this.statusTimer = undefined;
    this.captureEnabled = false;
    this.started = false;
  }

  getByUser(
    userId: string,
    limit = 300,
    level?: UserConsoleLevel | 'all',
    since?: string,
  ): Observable<UserConsoleLogResponse> {
    let params = new HttpParams().set('limit', String(limit));
    if (level && level !== 'all') params = params.set('level', level);
    if (since) params = params.set('since', since);
    return this.http.get<UserConsoleLogResponse>(`${this.apiUrl}/user/${userId}`, { params });
  }

  getCaptureStatus(userId?: string): Observable<ConsoleCaptureStatus> {
    const url = userId
      ? `${this.apiUrl}/status/user/${userId}`
      : `${this.apiUrl}/status`;
    return this.http.get<ConsoleCaptureStatus>(url);
  }

  setCaptureStatus(userId: string, enabled: boolean): Observable<ConsoleCaptureStatus> {
    return this.http.patch<ConsoleCaptureStatus>(`${this.apiUrl}/status/user/${userId}`, { enabled });
  }

  getRecentDiagnostics(limit = 30): LocalConsoleDiagnostic[] {
    const normalizedLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
    return this.localDiagnostics.slice(-normalizedLimit).map(entry => ({ ...entry }));
  }

  private enqueue(level: UserConsoleLevel, args: any[]): void {
    const userId = this.currentUserId();
    const message = this.serializeArguments(args);
    if (!message) return;

    if (level === 'warn' || level === 'error') {
      this.localDiagnostics.push({
        level,
        message,
        route: this.router.url || window.location.pathname || '/',
        occurred_at: new Date().toISOString(),
      });
      if (this.localDiagnostics.length > 100) {
        this.localDiagnostics.splice(0, this.localDiagnostics.length - 100);
      }
    }

    if (!userId || !this.isAuthenticated() || !this.captureEnabled) return;
    if (this.activeUserId && this.activeUserId !== userId) this.buffer = [];
    this.activeUserId = userId;

    this.buffer.push({
      platform: 'desktop',
      level,
      message,
      route: this.router.url || window.location.pathname || '/',
      occurred_at: new Date().toISOString(),
    });
    if (this.buffer.length > 500) this.buffer.splice(0, this.buffer.length - 500);
    if (this.buffer.length >= 50) this.flush();
  }

  private flush(): void {
    if (!this.buffer.length || !this.isAuthenticated()) return;
    if (this.activeUserId && this.activeUserId !== this.currentUserId()) {
      this.buffer = [];
      this.activeUserId = '';
      return;
    }
    const logs = this.buffer.splice(0, 100);
    this.http.post(`${this.apiUrl}/batch`, { logs }).subscribe({
      error: () => {
        this.buffer.unshift(...logs);
        if (this.buffer.length > 500) this.buffer.length = 500;
      },
    });
  }

  private serializeArguments(args: any[]): string {
    const seen = new WeakSet<object>();
    const serialize = (value: any): string => {
      if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
      if (typeof value === 'string') return value;
      if (value === undefined) return 'undefined';
      if (value === null || typeof value !== 'object') return String(value);
      if (value instanceof Element) {
        const id = value.id ? `#${value.id}` : '';
        return `[Elemento ${value.tagName.toLowerCase()}${id}]`;
      }
      try {
        return JSON.stringify(value, (key, nested) => {
          if (/(password|pass|token|authorization|secret|api[_-]?key|cookie|cedula|dni|card|cvv)/i.test(key)) {
            return '[REDACTED]';
          }
          if (nested && typeof nested === 'object') {
            if (seen.has(nested)) return '[Circular]';
            seen.add(nested);
          }
          return nested;
        });
      } catch {
        return Object.prototype.toString.call(value);
      }
    };

    return this.redact(args.map(serialize).join(' ')).slice(0, 8_000);
  }

  private redact(value: string): string {
    return value
      .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s,;]+/gi, '$1[REDACTED]')
      .replace(/((?:password|pass|token|secret|api[_-]?key)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]');
  }

  private currentUserId(): string {
    try {
      const user = JSON.parse(localStorage.getItem('user') || 'null');
      return String(user?.id || user?._id || '');
    } catch {
      return '';
    }
  }

  private isAuthenticated(): boolean {
    return Boolean(localStorage.getItem('authtoken'));
  }

  private refreshCaptureStatus(): void {
    if (!this.isAuthenticated() || this.statusRequestInFlight) {
      if (!this.isAuthenticated()) this.captureEnabled = false;
      return;
    }
    if (this.isEmployeeUser()) {
      this.captureEnabled = true;
      return;
    }

    this.statusRequestInFlight = true;
    this.getCaptureStatus().subscribe({
      next: (status) => {
        this.captureEnabled = status?.enabled === true;
        this.statusRequestInFlight = false;
      },
      error: () => {
        this.captureEnabled = false;
        this.statusRequestInFlight = false;
      },
    });
  }

  private isEmployeeUser(): boolean {
    try {
      const user = JSON.parse(localStorage.getItem('user') || 'null');
      const settings = Array.isArray(user?.settings) ? user.settings[0] : user?.settings;
      const affiliation = String(user?.affiliation_type_id || settings?.affiliation_type || '').trim().toLowerCase();
      return ['empleado', 'tecnico', 'tecnico_empleado', 'tecnico_independiente'].includes(affiliation);
    } catch {
      return false;
    }
  }
}
