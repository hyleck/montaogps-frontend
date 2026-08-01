import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  FunnelDevice,
  FunnelSession,
  MonitorClient,
  MonitorRecord,
  MonitorSession,
  OfflineCategory,
  PagedResponse,
  SegmentationResponse,
} from '../models/monitor-ia.models';

@Injectable({ providedIn: 'root' })
export class MonitorIaApiService {
  private readonly baseUrl = `${environment.apiUrl}/monitor-ia`;

  constructor(private readonly http: HttpClient) {}

  startScan(clientId: string): Observable<{
    message: string;
    sessionId: string;
  }> {
    return this.http.post<{ message: string; sessionId: string }>(
      `${this.baseUrl}/start`,
      { clientId, includeSimStatus: false },
    );
  }

  getActiveSession(): Observable<MonitorSession | null> {
    return this.http.get<MonitorSession | null>(
      `${this.baseUrl}/session/active`,
    );
  }

  getClients(
    search = '',
    page = 1,
    limit = 50,
  ): Observable<PagedResponse<MonitorClient>> {
    return this.http.get<PagedResponse<MonitorClient>>(
      `${this.baseUrl}/clients`,
      { params: this.pageParams(page, limit, search) },
    );
  }

  getSession(sessionId: string): Observable<MonitorSession> {
    return this.http.get<MonitorSession>(
      `${this.baseUrl}/session/${sessionId}`,
    );
  }

  cancelScan(sessionId: string): Observable<MonitorSession> {
    return this.http.patch<MonitorSession>(
      `${this.baseUrl}/session/${sessionId}/cancel`,
      {},
    );
  }

  getRecords(
    sessionId: string,
    page = 1,
    limit = 30,
    search = '',
  ): Observable<PagedResponse<MonitorRecord>> {
    return this.http.get<PagedResponse<MonitorRecord>>(
      `${this.baseUrl}/session/${sessionId}/records`,
      {
        params: this.pageParams(page, limit, search),
      },
    );
  }

  sendWillisContactTest(): Observable<{
    success: boolean;
    email: string;
    phone: string;
    contactName: string;
    message: string;
    contactedAt: string;
    conversationId?: number;
    matchedScanRecord: boolean;
  }> {
    return this.http.post<{
      success: boolean;
      email: string;
      phone: string;
      contactName: string;
      message: string;
      contactedAt: string;
      conversationId?: number;
      matchedScanRecord: boolean;
    }>(`${this.baseUrl}/contact-test`, {});
  }

  getSegmentation(options: {
    page?: number;
    limit?: number;
    search?: string;
    category?: OfflineCategory | '';
    sessionId?: string;
  }): Observable<SegmentationResponse> {
    let params = this.pageParams(
      options.page || 1,
      options.limit || 30,
      options.search || '',
    );
    if (options.category) {
      params = params.set('category', options.category);
    }
    if (options.sessionId) {
      params = params.set('sessionId', options.sessionId);
    }
    return this.http.get<SegmentationResponse>(
      `${this.baseUrl}/segmentation/offline`,
      { params },
    );
  }

  startFunnel(
    waitHours: number,
    scanSessionId?: string,
  ): Observable<{ message: string; sessionId: string }> {
    return this.http.post<{ message: string; sessionId: string }>(
      `${this.baseUrl}/funnel/start`,
      {
        waitHours,
        ...(scanSessionId ? { scanSessionId } : {}),
      },
    );
  }

  getActiveFunnel(): Observable<FunnelSession | null> {
    return this.http.get<FunnelSession | null>(`${this.baseUrl}/funnel/active`);
  }

  getFunnelDevices(
    sessionId: string,
    page = 1,
    limit = 30,
    search = '',
    finalStatus = '',
  ): Observable<PagedResponse<FunnelDevice>> {
    let params = this.pageParams(page, limit, search);
    if (finalStatus) params = params.set('finalStatus', finalStatus);
    return this.http.get<PagedResponse<FunnelDevice>>(
      `${this.baseUrl}/funnel/${sessionId}/devices`,
      { params },
    );
  }

  forceRecheck(sessionId: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.baseUrl}/funnel/recheck/${sessionId}`,
      {},
    );
  }

  markContacted(deviceId: string, response: string): Observable<FunnelDevice> {
    return this.http.patch<FunnelDevice>(
      `${this.baseUrl}/funnel/device/${deviceId}/contact`,
      { response },
    );
  }

  private pageParams(page: number, limit: number, search: string): HttpParams {
    let params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));
    if (search.trim()) params = params.set('search', search.trim());
    return params;
  }
}
