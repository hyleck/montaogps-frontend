import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MasivoService {

  private apiUrl = `${environment.apiUrl}/masivo`;

  constructor(private http: HttpClient) { }

  getDevices(filters?: { planId?: string }): Observable<any[]> {
    let params: any = {};

    if (filters?.planId) {
      params.planId = filters.planId;
    }

    return this.http.get<any[]>(`${this.apiUrl}/devices`, { params });
  }

  sendMassSMS(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/send-sms`);
  }

  // Keep tolist for backward compatibility
  tolist(): Observable<any[]> {
    return this.getDevices();
  }
}