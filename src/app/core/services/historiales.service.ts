import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  HistoryDevicesResponse,
  AnalyzeHistoryRequest,
  AnalyzeHistoryResponse,
  AnalyzeDeviceResponse,
  AnalyzeDeviceParams,
  ProgressResponse,
  CancelResponse,
  CurrentDeviceResponse,
  ArchiveDashboardResponse,
  TriggerArchiveResponse,
} from '../../admin/modules/settings/presentation/components/settings/historiales-settings/historiales.interface';

@Injectable({
  providedIn: 'root',
})
export class HistorialesService {
  private readonly apiUrl = `${environment.apiUrl}/history`;

  constructor(private http: HttpClient) {}

  /**
   * Obtener listado de dispositivos con api_device_id
   * GET /history/devices
   */
  getDevices(): Observable<HistoryDevicesResponse> {
    return this.http.get<HistoryDevicesResponse>(`${this.apiUrl}/devices`);
  }

  /**
   * Analizar historial de TODOS los dispositivos
   * POST /history/analyze
   */
  analyzeAllDevices(
    request: AnalyzeHistoryRequest,
  ): Observable<AnalyzeHistoryResponse> {
    return this.http.post<AnalyzeHistoryResponse>(
      `${this.apiUrl}/analyze`,
      request,
    );
  }

  /**
   * Analizar historial de un dispositivo específico
   * GET /history/analyze/device/:deviceImei
   */
  analyzeDevice(
    deviceImei: string,
    params: AnalyzeDeviceParams,
  ): Observable<AnalyzeDeviceResponse> {
    let httpParams = new HttpParams()
      .set('fromDate', params.fromDate)
      .set('toDate', params.toDate);

    if (params.intervalHours) {
      httpParams = httpParams.set(
        'intervalHours',
        params.intervalHours.toString(),
      );
    }

    return this.http.get<AnalyzeDeviceResponse>(
      `${this.apiUrl}/analyze/device/${deviceImei}`,
      { params: httpParams },
    );
  }

  // ========================
  // MÉTODOS DE PROGRESO
  // ========================

  /**
   * Obtener progreso del análisis actual
   * GET /history/progress
   */
  getCurrentProgress(): Observable<ProgressResponse> {
    return this.http.get<ProgressResponse>(`${this.apiUrl}/progress`);
  }

  /**
   * Obtener progreso de un análisis específico
   * GET /history/progress/:analysisId
   */
  getProgressById(analysisId: string): Observable<ProgressResponse> {
    return this.http.get<ProgressResponse>(
      `${this.apiUrl}/progress/${analysisId}`,
    );
  }

  /**
   * Cancelar el análisis actual
   * DELETE /history/cancel
   */
  cancelCurrentAnalysis(): Observable<CancelResponse> {
    return this.http.delete<CancelResponse>(`${this.apiUrl}/cancel`);
  }

  /**
   * Cancelar un análisis específico
   * DELETE /history/cancel/:analysisId
   */
  cancelAnalysis(analysisId: string): Observable<CancelResponse> {
    return this.http.delete<CancelResponse>(
      `${this.apiUrl}/cancel/${analysisId}`,
    );
  }

  // ========================
  // MÉTODO PARA DISPOSITIVO ACTUAL
  // ========================

  /**
   * Obtener progreso detallado del dispositivo actual
   * GET /history/progress/current-device
   */
  getCurrentDeviceProgress(): Observable<CurrentDeviceResponse> {
    return this.http.get<CurrentDeviceResponse>(
      `${this.apiUrl}/progress/current-device`,
    );
  }

  getArchiveDashboard(limit = 12): Observable<ArchiveDashboardResponse> {
    const params = new HttpParams().set('limit', String(limit));
    return this.http.get<ArchiveDashboardResponse>(
      `${this.apiUrl}/archive/dashboard`,
      { params },
    );
  }

  triggerArchive(server?: string): Observable<TriggerArchiveResponse> {
    return this.http.post<TriggerArchiveResponse>(
      `${this.apiUrl}/archive/run`,
      server ? { server } : {},
    );
  }
}
