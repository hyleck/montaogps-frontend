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

  async getPublicTargetById(id: string): Promise<Target> {
    const url = `${environment.apiUrl}/users-public/realtime/${id}`;
    const observable = this.http.get<Target>(url);
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

  async searchTargets(query: string, parentId?: string, offset: number = 0, limit: number = 30): Promise<TargetsResponse> {
    let params: any = {
      q: query,
      offset: offset.toString(),
      limit: limit.toString()
    };

    if (parentId) {
      params.parent = parentId;
    }

    const observable = this.http.get<TargetsResponse>(`${this.apiUrl}/search`, { params });
    return await lastValueFrom(observable);
  }

  async getTargetsByUserId(userId: string, parentId?: string, offset: number = 0, limit: number = 30): Promise<TargetsResponse> {
    let url = `${this.apiUrl}?user_id=${userId}`;

    if (parentId) {
      url += `&parent=${parentId}`;
    }

    url += `&offset=${offset}&limit=${limit}`;

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

  async getRouteHistory(deviceId: string, fromDate?: string, toDate?: string): Promise<RouteHistoryResponse> {
    let url = `${environment.apiUrl}/reports/device/${deviceId}/route-history`;

    const params = new URLSearchParams();
    if (fromDate) {
      params.append('fromDate', fromDate);
    }
    if (toDate) {
      params.append('toDate', toDate);
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



  async sendSMS(simCardId: string, message: string, provider: 'myorion' | 'twilio' | 'emnify' | 'myorion2', sim_company?: string): Promise<any> {
    const url = `${environment.apiUrl}/sim-card`;
    const body = {
      id: simCardId,
      message: message,
      provider: provider,
      sim_company: sim_company
    };

    const observable = this.http.post<any>(url, body);
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
    const url = `${environment.apiUrl}/process/by-reference/${reference}`;
    const observable = this.http.get<ProcessResponse[]>(url);
    return await lastValueFrom(observable);
  }

  async getCanceledTargets(parentId: string): Promise<Target[]> {
    const url = `${this.apiUrl}/canceled?parent=${parentId}`;
    const observable = this.http.get<Target[]>(url);
    return await lastValueFrom(observable);
  }

  async getCanceledTargetsWithPagination(parentId: string, offset: number = 0, limit: number = 20): Promise<TargetsResponse> {
    const url = `${this.apiUrl}/canceled?parent=${parentId}&offset=${offset}&limit=${limit}`;
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
}
