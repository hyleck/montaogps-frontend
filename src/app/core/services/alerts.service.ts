import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export type AlertType = 'speed' | 'perimeter' | 'movement' | 'ignition' | 'connection';

export type AlertStatus = 'active' | 'inactive';

export interface CreateAlertDto {
  type: AlertType;
  maxSpeed?: number;
  targetIds: string[];
  userTopic?: string;
  email?: string;
  coordinates?: Array<{ lat: number; lng: number }>;
  trigger?: 'enter' | 'exit';
  ignitionTrigger?: 'on' | 'off';
  connectionAlertType?: 'online' | 'offline';
  message?: string;
  oneNotificationEveryFiveHours?: boolean;
  presetKey?: string;
  presetName?: string;
  scheduleStart?: string;
  scheduleEnd?: string;
  scheduleTimezone?: string;
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
  createdBy?: AlertUserTopic | string;
  status: AlertStatus | string;
  createdAt: string;
  updatedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class AlertsService {
  private apiUrl = `${environment.apiUrl}/alerts`;

  constructor(private http: HttpClient) { }

  createAlert(payload: CreateAlertDto): Observable<AlertResponse> {
    return this.http
      .post<{ data: AlertResponse }>(this.apiUrl, payload)
      .pipe(map((response) => response.data));
  }

  getAlerts(targetIds: string[] = []): Observable<AlertResponse[]> {
    let params = new HttpParams();
    if (targetIds.length) {
      params = params.set('targetIds', [...new Set(targetIds)].join(','));
    }
    return this.http
      .get<{ data: AlertResponse[] }>(this.apiUrl, { params })
      .pipe(map((response) => response?.data ?? []));
  }

  updateAlertStatus(id: string, status: AlertStatus): Observable<AlertResponse> {
    return this.http
      .patch<{ data: AlertResponse }>(`${this.apiUrl}/${id}/status`, { status })
      .pipe(map((response) => response.data));
  }

  updateAlert(
    id: string,
    payload: {
      config?: Record<string, unknown>;
      targetIds?: string[];
      userTopic?: string;
    },
  ): Observable<AlertResponse> {
    return this.http
      .put<{ data: AlertResponse }>(`${this.apiUrl}/${id}`, payload)
      .pipe(map((response) => response.data));
  }

  deleteAlert(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
