import { Injectable } from '@angular/core';
import { HttpBackend, HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface RenewalDecision {
  deviceId: string;
  renew: boolean;
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
  id: string;
  token: string;
  client: RenewalLinkClient;
  expiresAt: string;
  deviceCount: number;
}

export interface RenewalLinkSummary {
  id: string;
  client: RenewalLinkClient;
  createdAt: string;
  expiresAt: string;
  status: 'active' | 'submitted' | 'revoked' | 'expired';
  deviceCount: number;
  submittedAt?: string;
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

  create(clientId: string): Observable<CreatedRenewalLink> {
    return this.http.post<CreatedRenewalLink>(this.apiUrl, { clientId });
  }

  getForClient(clientId: string): Observable<RenewalLinkSummary[]> {
    return this.http.get<RenewalLinkSummary[]>(this.apiUrl, { params: new HttpParams().set('clientId', clientId) });
  }

  revoke(id: string): Observable<RenewalLinkSummary> {
    return this.http.patch<RenewalLinkSummary>(`${this.apiUrl}/${encodeURIComponent(id)}/revoke`, {});
  }

  getPublic(token: string): Observable<PublicRenewalInfo> {
    return this.publicHttp.get<PublicRenewalInfo>(`${environment.apiUrl}/public/renewals/${encodeURIComponent(token)}`);
  }

  submitPublic(token: string, decisions: RenewalDecision[]): Observable<PublicRenewalInfo> {
    return this.publicHttp.post<PublicRenewalInfo>(`${environment.apiUrl}/public/renewals/${encodeURIComponent(token)}`, { decisions });
  }
}
