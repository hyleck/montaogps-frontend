import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface MonitoringRouteEntry {
  id: string;
  fullName: string;
  affiliation_type_id?: string;
  profile_type_id?: string;
}

export interface MonitorUserResponse {
  id: string;
  userId: string;
  message: string;
  statusRequestId: string;
  data: Array<{
    route: MonitoringRouteEntry[];
    devices: any[];
  }>;
  monitoringType?: 'device-status' | 'mileage';
  distanceRange?: { from: string; to: string };
  createdAt: string;
}

export interface MonitoringSummary {
  id: string;
  userId: string;
  creator?: {
    id?: string;
    _id?: string;
    name: string;
    last_name: string;
    email: string;
  } | null;
  totalUsers: number;
  totalDevices: number;
  activeDevices: number;
  activeValidOnlineDevices: number;
  activeValidOfflineDevices: number;
  totalExpiredDevices: number;
  createdAt: string;
  reportId?: string | null;
  monitoringType?: 'device-status' | 'mileage';
}

export interface MonitoringSummaryResponse {
  message: string;
  summaries: MonitoringSummary[];
}

export interface MonitoringReport {
  id: string;
  userId: string;
  creator: {
    id: string;
    name: string;
    last_name: string;
    email: string;
  };
  createdAt: string;
  data: Array<{
    route: MonitoringRouteEntry[];
    devices: any[];
  }>;
  monitoringType?: 'device-status' | 'mileage';
  distanceRange?: { from: string; to: string };
}

export type MonitoringStatusState = 'idle' | 'pending' | 'in-progress' | 'completed' | 'failed';

export interface MonitoringStatus {
  requestId?: string;
  userId: string;
  status: MonitoringStatusState;
  processedUsers: number;
  totalUsers: number;
  progress: number;
  message?: string;
  error?: string;
  reportId?: string | null;
  startedAt?: string;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  creator?: {
    id?: string;
    _id?: string;
    name: string;
    last_name: string;
    email: string;
  } | null;
}

export interface UserMonitoringReportsResponse {
  id: string;
  userId: string;
  creator: string;
  createdAt: string;
  data: Array<{
    route: MonitoringRouteEntry[];
    devices: any[];
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class MonitoringService {
  private apiUrl = `${environment.apiUrl}/monitoring`;

  constructor(private http: HttpClient) { }

  monitorUser(
    userId: string,
    monitoringType?: string,
    range?: { from: string; to: string }
  ): Observable<MonitorUserResponse> {
    const body: any = { userId };
    if (monitoringType) {
      body.monitoringType = monitoringType;
    }
    if (range) {
      body.from = range.from;
      body.to = range.to;
    }

    const endpoint = range
      ? `${this.apiUrl}/user/mileage`
      : `${this.apiUrl}/user`;

    return this.http.post<MonitorUserResponse>(endpoint, body);
  }

  monitorUserSummary(userId: string): Observable<MonitoringSummaryResponse> {
    const body: any = { userId };
    return this.http.post<MonitoringSummaryResponse>(`${this.apiUrl}/user/summary`, body);
  }

  getMonitoringReport(reportId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/report/${reportId}`);
  }

  getUserMonitoringReports(userId: string): Observable<MonitoringReport[]> {
    return this.http.get<MonitoringReport[]>(`${this.apiUrl}/user/${userId}/reports`);
  }

  getMonitoringStatus(userId: string): Observable<MonitoringStatus> {
    return this.http.get<MonitoringStatus>(`${this.apiUrl}/status`, {
      params: { userId }
    });
  }

  cancelMonitoringStatus(requestId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/status/${requestId}`);
  }
}
