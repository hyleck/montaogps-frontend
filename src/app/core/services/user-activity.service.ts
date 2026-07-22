import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UserActivity {
  _id?: string;
  user_id: string;
  platform: 'mobile' | 'desktop';
  type: 'screen' | 'action';
  screen?: string;
  route?: string;
  action?: string;
  element?: string;
  metadata?: Record<string, any>;
  occurred_at: string | Date;
}

export interface UserActivityResponse {
  activities: UserActivity[];
  totalCount: number;
}

@Injectable({ providedIn: 'root' })
export class UserActivityService {
  private readonly apiUrl = `${environment.apiUrl}/user-activity`;

  constructor(private http: HttpClient) {}

  start(): void {
    // Activity is recorded by the backend for GPS views and create/update/delete actions.
  }

  recordGpsMapView(target: any): Observable<UserActivity> {
    const targetId = target?._id || target?.id;
    const imei = target?.device_imei || target?.imei || target?.deviceId;
    return this.http.post<UserActivity>(this.apiUrl, {
      platform: 'desktop',
      type: 'action',
      screen: 'management/map',
      route: targetId ? `/devices/${targetId}/map` : '/devices/map',
      action: 'view gps',
      element: 'map',
      metadata: {
        resource: 'devices',
        targetId,
        targetName: target?.name || target?.target_name || target?.targetName,
        deviceName: target?.name || target?.target_name || target?.targetName,
        imei,
      },
    });
  }

  getByUser(userId: string, limit: number = 30): Observable<UserActivityResponse> {
    const params = new HttpParams().set('limit', String(limit));
    return this.http.get<UserActivityResponse>(`${this.apiUrl}/user/${userId}`, { params });
  }
}
