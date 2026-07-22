import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../../../environments/environment';

export type AnomalySeverity = 'critical' | 'warning' | 'info';
export type AnomalyCategory = 'devices' | 'users' | 'processes';

export interface AnomalyItem {
  id: string;
  title: string;
  description: string;
  category: AnomalyCategory;
  severity: AnomalySeverity;
  count: number;
  detectedAt: string;
  metadata?: Record<string, any>;
  records?: Array<Record<string, any>>;
}

export interface AnomaliesResponse {
  total: number;
  summary: {
    critical: number;
    warning: number;
    info: number;
  };
  anomalies: AnomalyItem[];
  generatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class AnomaliesService {
  private readonly apiUrl = `${environment.apiUrl}/anomalies`;

  constructor(private readonly http: HttpClient) {}

  getAnomalies(limit = 25): Observable<AnomaliesResponse> {
    return this.http.get<AnomaliesResponse>(this.apiUrl, {
      params: { limit },
    });
  }
}
