import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { lastValueFrom, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { CreateTargetDto, Target, UpdateTargetDto, StopTimeResponse } from '../interfaces';

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

  async getTargetById(id: string): Promise<Target> {
    const observable = this.http.get<Target>(`${this.apiUrl}/${id}`);
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

  async searchTargets(query: string, parentId?: string): Promise<Target[]> {
    let url = `${this.apiUrl}?search=${query}`;
    
    if (parentId) {
      url += `&parent=${parentId}`;
    }
    
    const observable = this.http.get<Target[]>(url);
    return await lastValueFrom(observable);
  }

  async getTargetsByUserId(userId: string, parentId?: string): Promise<Target[]> {
    let url = `${this.apiUrl}?user_id=${userId}`;
    
    if (parentId) {
      url += `&parent=${parentId}`;
    }
    
    const observable = this.http.get<Target[]>(url);
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
} 