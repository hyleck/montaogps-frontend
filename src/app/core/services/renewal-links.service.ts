import { Injectable } from '@angular/core';
import { HttpBackend, HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface RenewalDecision {
  deviceId: string;
  renew: boolean;
}

export interface RenewalExpirationFilter {
  mode: 'range' | 'expired' | 'all';
  dateFrom?: string;
  dateTo?: string;
  asOf?: string;
}

export interface RenewalLinkDateRange {
  dateFrom?: string;
  dateTo?: string;
}

export interface PublicRenewalDevice {
  id: string;
  name: string;
  imei: string;
  plate?: string;
  expirationDate?: string;
  renew?: boolean;
}

export interface PublicRenewalInfo {
  expirationFilter?: RenewalExpirationFilter;
  client: { name: string };
  expiresAt: string;
  status: 'active' | 'submitted';
  submittedAt?: string;
  devices: PublicRenewalDevice[];
}

export interface RenewalLinkClient {
  id: string;
  name: string;
}

export interface CreatedRenewalLink {
  expirationFilter?: RenewalExpirationFilter;
  id: string;
  token: string;
  client: RenewalLinkClient;
  expiresAt: string;
  deviceCount: number;
}

export type RenewalLinkAction = 'renewal' | 'pre_renewal';

export interface ExecuteRenewalLink {
  action: RenewalLinkAction;
  years: number;
  expirationDate?: string;
  registrationDate: string;
  notes?: string;
}

export interface RenewalLinkPreviewItem {
  deviceId: string;
  renew: boolean;
  canExecute: boolean;
  currentExpirationDate?: string | null;
  expirationDate?: string | null;
  requestedExpirationDate?: string;
  effect: 'renewal' | 'pre_renewal' | 'unchanged' | 'completed' | 'unavailable';
  message?: string;
}

export interface RenewalLinkPreview {
  items: RenewalLinkPreviewItem[];
}

export interface RenewalLinkExecutionResult {
  deviceId: string;
  status: 'pending' | 'succeeded' | 'failed';
  processId?: string;
  expirationDate?: string;
  message?: string;
  completedAt?: string;
  attempts?: number;
}

export interface RenewalLinkExecution extends ExecuteRenewalLink {
  status: 'processing' | 'completed' | 'partial';
  startedAt: string;
  finishedAt?: string;
  actor: { id: string; name: string };
  results: RenewalLinkExecutionResult[];
  succeeded: number;
  failed: number;
  pending: number;
}

export interface RenewalLinkSummary {
  expirationFilter?: RenewalExpirationFilter;
  id: string;
  client: RenewalLinkClient;
  createdAt: string;
  expiresAt: string;
  status: 'active' | 'submitted' | 'revoked' | 'expired';
  deviceCount: number;
  submittedAt?: string;
  execution?: RenewalLinkExecution;
  renewalMethod?: 'cash' | 'credit' | null;
  renewalMethodError?: string;
  decisions?: Array<RenewalDecision & {
    name: string;
    imei: string;
    plate?: string;
    expirationDate?: string;
  }>;
}

@Injectable({ providedIn: 'root' })
export class RenewalLinksService {
  private readonly apiUrl = `${environment.apiUrl}/process/renewal-links`;
  private readonly publicHttp: HttpClient;

  constructor(private readonly http: HttpClient, backend: HttpBackend) {
    // Public links work independently of any GPS account open in this browser.
    this.publicHttp = new HttpClient(backend);
  }

  create(clientId: string, range: RenewalLinkDateRange = {}): Observable<CreatedRenewalLink> {
    return this.http.post<CreatedRenewalLink>(this.apiUrl, {
      clientId,
      ...(range.dateFrom ? { dateFrom: range.dateFrom } : {}),
      ...(range.dateTo ? { dateTo: range.dateTo } : {}),
    });
  }

  getForClient(clientId: string): Observable<RenewalLinkSummary[]> {
    return this.http.get<RenewalLinkSummary[]>(this.apiUrl, { params: new HttpParams().set('clientId', clientId) });
  }

  revoke(id: string): Observable<RenewalLinkSummary> {
    return this.http.patch<RenewalLinkSummary>(`${this.apiUrl}/${encodeURIComponent(id)}/revoke`, {});
  }

  execute(id: string, request: ExecuteRenewalLink): Observable<RenewalLinkSummary> {
    return this.http.post<RenewalLinkSummary>(`${this.apiUrl}/${encodeURIComponent(id)}/execute`, request);
  }

  preview(id: string, request: ExecuteRenewalLink): Observable<RenewalLinkPreview> {
    return this.http.post<RenewalLinkPreview>(`${this.apiUrl}/${encodeURIComponent(id)}/preview`, request);
  }

  getPublic(token: string): Observable<PublicRenewalInfo> {
    return this.publicHttp.get<PublicRenewalInfo>(`${environment.apiUrl}/public/renewals/${encodeURIComponent(token)}`);
  }

  submitPublic(token: string, decisions: RenewalDecision[]): Observable<PublicRenewalInfo> {
    return this.publicHttp.post<PublicRenewalInfo>(`${environment.apiUrl}/public/renewals/${encodeURIComponent(token)}`, { decisions });
  }
}
