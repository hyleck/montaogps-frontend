import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { lastValueFrom, Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { CreateTargetDto, Target, UpdateTargetDto, StopTimeResponse, RouteHistoryResponse, CreateProcessDto, ProcessResponse } from '../interfaces';

// Interfaz para la respuesta con totalCount
export interface TargetsResponse {
  devices: Target[];
  totalCount: number;
}

export interface DeviceDistanceResponse {
  deviceId: string;
  traccarDeviceId: string;
  from: string;
  to: string;
  distance: number;
  summary?: any[] | null;
  details?: any | null;
}

export interface VehicleRegistrationScanResponse {
  ok: boolean;
  deviceId?: string;
  data: Record<string, any>;
  voiceAudio?: { mimeType: string; base64: string };
  rawText?: string;
}

export interface SmsCommandQuotaResponse {
  limit: number | null;
  used: number;
  remaining: number | null;
  unlimited: boolean;
}

export interface VehicleVerificationMetrics {
  total: number;
  verified: number;
  pending: number;
  verifiedPercent: number;
  pendingPercent: number;
}

export interface VehicleDataCompletenessMetrics {
  total: number;
  complete: number;
  incomplete: number;
  completePercent: number;
  incompletePercent: number;
}

export interface VehicleRegistrationFinalizeResponse {
  ok: boolean;
  deviceId?: string;
  data: Record<string, any>;
  matricula_img?: any;
  device?: Target;
}

export interface VehicleRegistrationVerificationLinkResponse {
  short_code: string;
  expires_at: string;
  device_id: string;
}

export interface PublicVehicleVerificationInfo {
  device: {
    id: string;
    name: string;
    imei?: string;
    verificado?: boolean;
  };
  expires_at: string;
}

export interface RealtimeShortLinkResponse {
  short_code: string;
  expires_at: string;
}

export interface PublicRealtimeShortLinkInfo {
  target_id: string;
  expires_at: string;
  gkey?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TargetsService {
  private apiUrl = environment.apiUrl + '/devices';

  constructor(private http: HttpClient) { }

  async getAllTargets(): Promise<Target[]> {
    const observable = this.http.get<Target[]>(this.apiUrl);
    return await lastValueFrom(observable);
  }

  async getTargetsWithPagination(parentId: string, offset: number = 0, limit: number = 30): Promise<TargetsResponse> {
    const url = `${this.apiUrl}?parent=${parentId}&offset=${offset}&limit=${limit}`;
    const observable = this.http.get<TargetsResponse>(url);
    return await lastValueFrom(observable);
  }

  async getTargetById(id: string): Promise<Target> {
    const observable = this.http.get<Target>(`${this.apiUrl}/${id}`);
    return await lastValueFrom(observable);
  }

  async getTargetByImei(imei: string): Promise<Target> {
    const observable = this.http.get<Target>(`${this.apiUrl}/by-imei/${encodeURIComponent(imei)}`);
    return await lastValueFrom(observable);
  }

  async getPublicTargetById(id: string): Promise<Target> {
    const url = `${environment.apiUrl}/users-public/realtime/${id}`;
    const observable = this.http.get<Target>(url);
    return await lastValueFrom(observable);
  }

  async createRealtimeShortLink(payload: {
    target_id: string;
    expires_at: string;
    map_key?: string;
  }): Promise<RealtimeShortLinkResponse> {
    const observable = this.http.post<RealtimeShortLinkResponse>(`${this.apiUrl}/realtime-link`, payload);
    return await lastValueFrom(observable);
  }

  async resolvePublicRealtimeShortLink(code: string): Promise<PublicRealtimeShortLinkInfo> {
    const observable = this.http.get<PublicRealtimeShortLinkInfo>(
      `${environment.apiUrl}/users-public/realtime-link/${encodeURIComponent(code)}`
    );
    return await lastValueFrom(observable);
  }

  async createTarget(targetData: CreateTargetDto): Promise<Target> {
    const observable = this.http.post<Target>(this.apiUrl, targetData);
    return await lastValueFrom(observable);
  }

  async updateTarget(id: string, targetData: UpdateTargetDto): Promise<Target> {
    const observable = this.http.patch<Target>(`${this.apiUrl}/${id}`, targetData);
    return await lastValueFrom(observable);
  }

  async startActivation(id: string): Promise<any> {
    const observable = this.http.post<any>(`${this.apiUrl}/${id}/activate`, {});
    return await lastValueFrom(observable);
  }

  async scanVehicleRegistration(id: string, file: File): Promise<VehicleRegistrationScanResponse> {
    const formData = new FormData();
    formData.append('matricula', file);
    const observable = this.http.post<VehicleRegistrationScanResponse>(`${this.apiUrl}/${id}/scan-registration`, formData);
    return await lastValueFrom(observable);
  }

  async finalizeVehicleRegistration(
    id: string,
    file: File,
    metadata: Record<string, any>
  ): Promise<VehicleRegistrationFinalizeResponse> {
    const formData = new FormData();
    formData.append('matricula', file);
    formData.append('metadata', JSON.stringify(metadata));
    const observable = this.http.post<VehicleRegistrationFinalizeResponse>(`${this.apiUrl}/${id}/finalize-registration`, formData);
    return await lastValueFrom(observable);
  }

  async createVehicleRegistrationVerificationLink(id: string): Promise<VehicleRegistrationVerificationLinkResponse> {
    const observable = this.http.post<VehicleRegistrationVerificationLinkResponse>(`${this.apiUrl}/${id}/registration-verification-link`, {});
    return await lastValueFrom(observable);
  }

  async getPublicVehicleVerificationInfo(token: string): Promise<PublicVehicleVerificationInfo> {
    const observable = this.http.get<PublicVehicleVerificationInfo>(
      `${environment.apiUrl}/users-public/vehicle-verification/${encodeURIComponent(token)}`
    );
    return await lastValueFrom(observable);
  }

  async scanPublicVehicleRegistration(token: string, file: File): Promise<VehicleRegistrationScanResponse> {
    const formData = new FormData();
    formData.append('matricula', file);
    const observable = this.http.post<VehicleRegistrationScanResponse>(
      `${environment.apiUrl}/users-public/vehicle-verification/${encodeURIComponent(token)}/scan-registration`,
      formData
    );
    return await lastValueFrom(observable);
  }

  async finalizePublicVehicleRegistration(
    token: string,
    file: File,
    metadata: Record<string, any>
  ): Promise<VehicleRegistrationFinalizeResponse> {
    const formData = new FormData();
    formData.append('matricula', file);
    formData.append('metadata', JSON.stringify(metadata));
    const observable = this.http.post<VehicleRegistrationFinalizeResponse>(
      `${environment.apiUrl}/users-public/vehicle-verification/${encodeURIComponent(token)}/finalize`,
      formData
    );
    return await lastValueFrom(observable);
  }

  async deleteTarget(id: string): Promise<any> {
    const observable = this.http.delete(`${this.apiUrl}/${id}`);
    return await lastValueFrom(observable);
  }

  async cancelTarget(id: string, cancelData: { reason: string; description: string }): Promise<any> {
    const observable = this.http.patch(`${this.apiUrl}/${id}/cancel`, cancelData);
    return await lastValueFrom(observable);
  }

  async restoreTarget(id: string): Promise<any> {
    const observable = this.http.patch(`${this.apiUrl}/${id}/restore`, {});
    return await lastValueFrom(observable);
  }

  async searchTargets(query: string, parentId?: string, offset: number = 0, limit: number = 30, status?: 'online' | 'offline' | 'all', tag?: string, simCompany?: string): Promise<TargetsResponse> {
    let params: any = {
      q: query,
      offset: offset.toString(),
      limit: limit.toString()
    };

    if (parentId) {
      params.parent = parentId;
    }

    if (status && status !== 'all') {
      params.status = status;
    }

    if (tag) {
      params.tag = tag;
    }

    if (simCompany) {
      params.simCompany = simCompany;
    }

    const observable = this.http.get<TargetsResponse>(`${this.apiUrl}/search`, { params });
    return await lastValueFrom(observable);
  }

  async getExpiredConnectionPriorityTargets(): Promise<Target[]> {
    const observable = this.http.get<Target[]>(`${this.apiUrl}/check-connection-priority`);
    return await lastValueFrom(observable);
  }

  getVehicleVerificationMetrics(): Observable<VehicleVerificationMetrics> {
    return this.http.get<VehicleVerificationMetrics>(`${this.apiUrl}/metrics/vehicle-verification`);
  }

  getVehicleDataCompletenessMetrics(): Observable<VehicleDataCompletenessMetrics> {
    return this.http.get<VehicleDataCompletenessMetrics>(`${this.apiUrl}/metrics/vehicle-data-completeness`);
  }

  async getTargetsByUserId(userId: string, parentId?: string, offset: number = 0, limit: number = 30, status?: 'online' | 'offline' | 'all', tag?: string, simCompany?: string): Promise<TargetsResponse> {
    let url = `${this.apiUrl}?user_id=${userId}`;

    if (parentId) {
      url += `&parent=${parentId}`;
    }

    url += `&offset=${offset}&limit=${limit}`;

    if (status && status !== 'all') {
      url += `&status=${status}`;
    }

    if (tag) {
      url += `&tag=${tag}`;
    }

    if (simCompany) {
      url += `&simCompany=${simCompany}`;
    }

    const observable = this.http.get<TargetsResponse>(url);
    return await lastValueFrom(observable);
  }

  async getTargetsByStatus(status: 'active' | 'inactive'): Promise<Target[]> {
    const observable = this.http.get<Target[]>(`${this.apiUrl}?status=${status}`);
    return await lastValueFrom(observable);
  }

  async getStopTime(deviceId: string): Promise<StopTimeResponse> {
    const url = `${environment.apiUrl}/reports/device/${deviceId}/stop-time`;
    const observable = this.http.get<StopTimeResponse>(url);
    return await lastValueFrom(observable);
  }

  async getRouteHistory(deviceId: string, fromDate?: string, toDate?: string, minStopDuration?: number, cacheOnly: boolean = false): Promise<RouteHistoryResponse> {
    let url = `${environment.apiUrl}/reports/device/${deviceId}/route-history`;

    const params = new URLSearchParams();
    if (fromDate) {
      params.append('fromDate', fromDate);
    }
    if (toDate) {
      params.append('toDate', toDate);
    }
    if (minStopDuration !== undefined && minStopDuration !== null) {
      params.append('minStopDuration', String(minStopDuration));
    }
    if (cacheOnly) {
      params.append('cacheOnly', 'true');
    }

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    // Add timeout to prevent hanging requests
    const observable = this.http.get<RouteHistoryResponse>(url);
    return await lastValueFrom(observable.pipe(
      timeout(60000) // 60 second timeout
    ));
  }

  async updateRouteHistoryCache(
    deviceId: string,
    payload: {
      fromDate: string;
      toDate: string;
      source?: string;
      minStopDuration?: number;
      positions?: RouteHistoryResponse['positions'];
      stops?: any[];
      totalPositions?: number;
      distanceMeters?: number | null;
    }
  ): Promise<any> {
    const url = `${environment.apiUrl}/reports/device/${deviceId}/route-history/cache`;
    const observable = this.http.post(url, payload);
    return await lastValueFrom(observable.pipe(timeout(60000)));
  }



  async sendSMS(simCardId: string, message: string, provider: 'myorion' | 'twilio' | 'emnify' | 'myorion2', sim_company?: string, targetId?: string): Promise<any> {
    const url = `${environment.apiUrl}/sim-card`;
    const body = {
      id: simCardId,
      message: message,
      provider: provider,
      sim_company: sim_company,
      targetId: targetId
    };

    const observable = this.http.post<any>(url, body);
    return await lastValueFrom(observable);
  }

  async getSmsCommandQuota(targetId: string): Promise<SmsCommandQuotaResponse> {
    const url = `${environment.apiUrl}/sim-card/command-quota/${targetId}`;
    const observable = this.http.get<SmsCommandQuotaResponse>(url);
    return await lastValueFrom(observable);
  }

  async getMessages(simCardId: string, provider: 'myorion' | 'twilio' | 'emnify' | 'myorion2'): Promise<any> {
    const url = `${environment.apiUrl}/sim-card/messages/${simCardId}`;
    const params = { provider: provider };

    const observable = this.http.get<any>(url, { params });
    return await lastValueFrom(observable);
  }

  async createProcess(processData: CreateProcessDto): Promise<ProcessResponse> {
    const url = `${environment.apiUrl}/process`;
    const observable = this.http.post<ProcessResponse>(url, processData);
    return await lastValueFrom(observable);
  }

  async getProcessesByReference(reference: string): Promise<ProcessResponse[]> {
    const url = `${environment.apiUrl}/process/by-reference/${encodeURIComponent(reference)}`;
    const observable = this.http.get<ProcessResponse[]>(url);
    return await lastValueFrom(observable);
  }

  async getCanceledTargets(parentId: string): Promise<Target[]> {
    const url = `${this.apiUrl}/canceled?parent=${parentId}`;
    const observable = this.http.get<Target[]>(url);
    return await lastValueFrom(observable);
  }

  async getCanceledTargetsWithPagination(parentId: string, offset: number = 0, limit: number = 20, dateFrom?: string, dateTo?: string, simCompany?: string, modDateFrom?: string, modDateTo?: string): Promise<TargetsResponse> {
    let url = `${this.apiUrl}/canceled?parent=${parentId}&offset=${offset}&limit=${limit}`;
    if (dateFrom) {
      url += `&dateFrom=${encodeURIComponent(dateFrom)}`;
    }
    if (dateTo) {
      url += `&dateTo=${encodeURIComponent(dateTo)}`;
    }
    if (simCompany) {
      url += `&simCompany=${encodeURIComponent(simCompany)}`;
    }
    if (modDateFrom) {
      url += `&modDateFrom=${encodeURIComponent(modDateFrom)}`;
    }
    if (modDateTo) {
      url += `&modDateTo=${encodeURIComponent(modDateTo)}`;
    }
    const observable = this.http.get<TargetsResponse>(url);
    return await lastValueFrom(observable);
  }

  async searchCanceledTargets(parentId: string, searchTerm: string): Promise<Target[]> {
    const url = `${this.apiUrl}/canceled/search?parent=${parentId}&q=${encodeURIComponent(searchTerm)}`;
    const observable = this.http.get<Target[]>(url);
    return await lastValueFrom(observable);
  }

  /**
   * Obtiene los correos compartidos de un target específico
   * @param targetId ID del target
   */
  async getSharedEmails(targetId: string): Promise<{ deviceId: string, deviceName: string, shared: string[] }> {
    const observable = this.http.get<{ deviceId: string, deviceName: string, shared: string[] }>(`${this.apiUrl}/${targetId}/shared`);
    return await lastValueFrom(observable);
  }

  async getSharedTargets(email: string): Promise<Target[]> {
    const observable = this.http.get<Target[]>(`${this.apiUrl}/shared?email=${encodeURIComponent(email)}`);
    return await lastValueFrom(observable);
  }

  async transferTarget(targetId: string, targetUserId: string): Promise<any> {
    const observable = this.http.patch(`${this.apiUrl}/${targetId}/transfer`, { targetUserId });
    return await lastValueFrom(observable);
  }

  async getDeviceDistance(deviceId: string, from: string, to: string): Promise<DeviceDistanceResponse> {
    const url = `${this.apiUrl}/${deviceId}/distance`;
    const params = { from, to };
    const observable = this.http.get<DeviceDistanceResponse>(url, { params });
    return await lastValueFrom(observable);
  }

  /**
   * Actualiza los correos compartidos de un target
   * @param targetId ID del target
   * @param sharedEmails Array de correos electrónicos compartidos
   */
  async updateSharedUsers(targetId: string, sharedEmails: string[]): Promise<any> {
    const observable = this.http.patch(`${this.apiUrl}/${targetId}/shared`, { shared: sharedEmails });
    return await lastValueFrom(observable);
  }

  /**
   * Obtiene la ubicación más reciente de un dispositivo desde el historial
   * @param deviceId ID del dispositivo
   */
  async getLatestLocationFromHistory(deviceId: string): Promise<any> {
    const url = `${environment.apiUrl}/history/latest-location/${deviceId}`;
    const observable = this.http.get<any>(url);
    return await lastValueFrom(observable);
  }

  async getSimUsage(iccid: string, provider: string): Promise<any> {
    const url = `${environment.apiUrl}/sim-card/usage/${iccid}`;
    const params = { provider };
    const observable = this.http.get<any>(url, { params });
    return await lastValueFrom(observable);
  }

  async generateAIImage(data: { brand: string; model: string; color: string; year: number }): Promise<{ url: string; thumbnailUrl?: string; fromCache?: boolean }> {
    const observable = this.http.post<{ url: string; thumbnailUrl?: string; fromCache?: boolean }>(`${this.apiUrl}/generate-image`, data);
    return await lastValueFrom(observable);
  }

  async bulkVerifyIccids(iccids: string[]): Promise<any[]> {
    const observable = this.http.post<any[]>(`${this.apiUrl}/bulk-verify-iccids`, { iccids });
    return await lastValueFrom(observable);
  }
}
