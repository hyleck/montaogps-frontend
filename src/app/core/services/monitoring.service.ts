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

@Injectable({
  providedIn: 'root'
})
export class MonitoringService {
  private apiUrl = `${environment.apiUrl}/monitoring`;

  constructor(private http: HttpClient) { }

  monitorUser(userId: string, filters?: { status?: string; expiration?: string }): Observable<MonitorUserResponse> {
    const body: any = { userId };
    if (filters) {
      if (filters.status) {
        body.statusFilter = filters.status;
      }
      if (filters.expiration) {
        body.expirationFilter = filters.expiration;
      }
    }
    return this.http.post<MonitorUserResponse>(`${this.apiUrl}/user`, body);
  }
}