import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface SimcardValidationTemp {
  _id?: string;
  nombre: string;
  estado: string;
  conexion: string;
  iccid: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmnifyRealtimeSimcard {
  id: number;
  nombre: string;
  estado: string;
  simEstado: string;
  conexion: string;
  iccid: string;
  iccidWithLuhn: string;
  devices: Array<{
    id: string;
    name: string;
    imei: string;
    plate: string;
    status: boolean;
    canceled: boolean;
    expirationDate: string;
    connectionStatus: string;
    isOnline: boolean;
    lastUpdate: string | null;
  }>;
}

export interface EmnifyRealtimeResponse {
  data: EmnifyRealtimeSimcard[];
  total: number;
  page: number;
  limit: number;
}

@Injectable({
  providedIn: 'root'
})
export class SimcardsValidationTempService {
  private readonly apiUrl = `${environment.apiUrl}/simcards-validation-temp`;

  constructor(private readonly http: HttpClient) {}

  findAll(): Observable<SimcardValidationTemp[]> {
    return this.http.get<SimcardValidationTemp[]>(this.apiUrl);
  }

  create(payload: SimcardValidationTemp): Observable<SimcardValidationTemp> {
    return this.http.post<SimcardValidationTemp>(this.apiUrl, payload);
  }

  findEmnifyRealtime(filters: {
    search?: string;
    estado?: string;
    conexion?: string;
    page?: number;
    limit?: number;
  } = {}): Observable<EmnifyRealtimeResponse> {
    return this.http.get<EmnifyRealtimeResponse>(`${this.apiUrl}/emnify/realtime`, {
      params: {
        search: filters.search || '',
        estado: filters.estado || '',
        conexion: filters.conexion || '',
        page: String(filters.page || 1),
        limit: String(filters.limit || 50),
      },
    });
  }
}
