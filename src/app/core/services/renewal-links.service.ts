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

export interface RenewalDeviceAccount {
  id?: string;
  /** Route from the link's client to the account that owns the GPS. */
  path: string[];
}

export interface PublicRenewalDevice {
  id: string;
  name: string;
  imei: string;
  plate?: string;
  expirationDate?: string;
  account?: RenewalDeviceAccount;
  renew?: boolean;
}

export interface PublicRenewalInfo {
  expirationFilter?: RenewalExpirationFilter;
  client: { name: string };
  status: 'active' | 'submitted';
  submittedAt?: string;
  /** Choices already marked on an open link, to resume where the client left off. */
  draft?: RenewalDecision[];
  draftUpdatedAt?: string;
  /** GPS left out because another response already confirmed their renewal. */
  omittedConfirmedCount?: number;
  devices: PublicRenewalDevice[];
}

export interface RenewalLinkDeviceOption extends PublicRenewalDevice {
  inLink: boolean;
  addedManually: boolean;
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
  status: 'active' | 'submitted' | 'revoked';
  deviceCount: number;
  submittedAt?: string;
  execution?: RenewalLinkExecution;
  renewalMethod?: 'cash' | 'credit' | null;
  renewalMethodError?: string;
  rangeChangeCount?: number;
  /** Number of times a root user added or removed GPS by hand. */
  deviceChangeCount?: number;
  /** Number of times staff undid the client's confirmation. */
  confirmationUndoCount?: number;
  decisions?: Array<RenewalDecision & {
    name: string;
    imei: string;
    plate?: string;
    expirationDate?: string;
    account?: RenewalDeviceAccount;
  }>;
}

export interface RenewalLinkShare {
  id: string;
  token: string;
}

export type RenewalLinksOverviewStatus = 'all' | 'active' | 'submitted' | 'pending_processing' | 'processed' | 'revoked';

export interface RenewalLinksOverviewQuery {
  status?: RenewalLinksOverviewStatus;
  search?: string;
  offset?: number;
  limit?: number;
}

export interface RenewalLinksOverviewPage {
  items: Array<RenewalLinkSummary & { createdBy?: { id: string; name: string } }>;
  total: number;
  counts: Record<RenewalLinksOverviewStatus, number>;
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

  /** Every renewal link sent to any client, newest first. */
  listAll(query: RenewalLinksOverviewQuery = {}): Observable<RenewalLinksOverviewPage> {
    let params = new HttpParams();
    if (query.status && query.status !== 'all') params = params.set('status', query.status);
    if (query.search?.trim()) params = params.set('search', query.search.trim());
    if (query.offset) params = params.set('offset', String(query.offset));
    if (query.limit) params = params.set('limit', String(query.limit));
    return this.http.get<RenewalLinksOverviewPage>(`${this.apiUrl}/all`, { params });
  }

  /** The public URL token the client already has, to copy or forward it again. */
  getShareLink(id: string): Observable<RenewalLinkShare> {
    return this.http.get<RenewalLinkShare>(`${this.apiUrl}/${encodeURIComponent(id)}/link`);
  }

  /** Issues a new public URL for the link; the previous one stops working. */
  regenerateLink(id: string): Observable<RenewalLinkShare> {
    return this.http.post<RenewalLinkShare>(`${this.apiUrl}/${encodeURIComponent(id)}/link`, {});
  }

  /** Returns a confirmed link to pending under the same URL, with the client's choices still marked. */
  undoConfirmation(id: string): Observable<RenewalLinkSummary> {
    return this.http.patch<RenewalLinkSummary>(`${this.apiUrl}/${encodeURIComponent(id)}/undo-confirmation`, {});
  }

  revoke(id: string): Observable<RenewalLinkSummary> {
    return this.http.patch<RenewalLinkSummary>(`${this.apiUrl}/${encodeURIComponent(id)}/revoke`, {});
  }

  /** Root only: the client's GPS, marking which ones the link includes. */
  deviceOptions(id: string): Observable<RenewalLinkDeviceOption[]> {
    return this.http.get<RenewalLinkDeviceOption[]>(`${this.apiUrl}/${encodeURIComponent(id)}/devices`);
  }

  /** Root only: adds or removes GPS and returns the link to pending under the same URL. */
  updateDevices(id: string, changes: { add: string[]; remove: string[] }): Observable<RenewalLinkSummary> {
    return this.http.patch<RenewalLinkSummary>(`${this.apiUrl}/${encodeURIComponent(id)}/devices`, changes);
  }

  /** Changes the expiration range and returns the link to pending under the same URL. */
  updateRange(id: string, range: RenewalLinkDateRange): Observable<RenewalLinkSummary> {
    return this.http.patch<RenewalLinkSummary>(`${this.apiUrl}/${encodeURIComponent(id)}/range`, {
      ...(range.dateFrom ? { dateFrom: range.dateFrom } : {}),
      ...(range.dateTo ? { dateTo: range.dateTo } : {}),
    });
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

  /** Saves the choices marked so far; reopening the link restores them. */
  saveDraftPublic(token: string, decisions: RenewalDecision[]): Observable<{ savedAt: string; count: number }> {
    return this.publicHttp.put<{ savedAt: string; count: number }>(this.publicDraftUrl(token), { decisions });
  }

  /** URL of the draft endpoint, also used to save the last change while the page closes. */
  publicDraftUrl(token: string): string {
    return `${environment.apiUrl}/public/renewals/${encodeURIComponent(token)}/draft`;
  }

  submitPublic(token: string, decisions: RenewalDecision[]): Observable<PublicRenewalInfo> {
    return this.publicHttp.post<PublicRenewalInfo>(`${environment.apiUrl}/public/renewals/${encodeURIComponent(token)}`, { decisions });
  }
}
