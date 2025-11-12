import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export type AlertType = 'speed' | 'perimeter' | 'power' | 'movement';

export interface CreateAlertDto {
  type: AlertType;
  maxSpeed?: number;
  targetIds?: string[];
  userTopic?: string;
}

export interface AlertUserTopic {
  _id: string;
  email?: string;
  name?: string;
  last_name?: string;
}

export interface AlertResponse {
  _id: string;
  type: AlertType;
  targetIds: string[];
  config?: Record<string, any>;
  userTopic?: AlertUserTopic | string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class AlertsService {
  private apiUrl = `${environment.apiUrl}/alerts`;

  constructor(private http: HttpClient) {}

  createAlert(payload: CreateAlertDto): Observable<any> {
    return this.http.post(this.apiUrl, payload);
  }

  getAlerts(): Observable<AlertResponse[]> {
    return this.http
      .get<{ data: AlertResponse[] }>(this.apiUrl)
      .pipe(map((response) => response?.data ?? []));
  }

  deleteAlert(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
