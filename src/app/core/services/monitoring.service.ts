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

  monitorUser(userId: string): Observable<MonitorUserResponse> {
    return this.http.post<MonitorUserResponse>(`${this.apiUrl}/user`, { userId });
  }
}