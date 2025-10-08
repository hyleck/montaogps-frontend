import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface MonitorUserResponse {
  message: string;
  data: Array<{
    route: { id: string; fullName: string }[];
    devices: any[];
  }>;
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
    route: { id: string; fullName: string }[];
    devices: any[];
  }>;
}

export interface UserMonitoringReportsResponse {
  id: string;
  userId: string;
  creator: string;
  createdAt: string;
  data: Array<{
    route: { id: string; fullName: string }[];
    devices: any[];
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class MonitoringService {
  private apiUrl = `${environment.apiUrl}/monitoring`;

  constructor(private http: HttpClient) { }

  monitorUser(userId: string): Observable<MonitorUserResponse> {
    const body: any = { userId };
    return this.http.post<MonitorUserResponse>(`${this.apiUrl}/user`, body);
  }

  getMonitoringReport(reportId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/report/${reportId}`);
  }

  getUserMonitoringReports(userId: string): Observable<MonitoringReport[]> {
    return this.http.get<MonitoringReport[]>(`${this.apiUrl}/user/${userId}/reports`);
  }
}