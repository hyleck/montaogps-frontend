import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface ProcessItem {
  _id: string;
  type: number;
  description: string;
  details?: string;
  target: { _id: string; name?: string; device_imei?: string; sim_card_number?: string; [key: string]: any };
  user: { _id: string; name?: string; email?: string; [key: string]: any };
  reference: string;
  before: any;
  after: any;
  registrationDate: string;
  creator: any;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedProcessResponse {
  data: ProcessItem[];
  total: number;
  page: number;
  lastPage: number;
}

export const PROCESS_TYPE_LABELS: { [key: number]: string } = {
  1: 'Instalación',
  2: 'Mod. Fecha Instalación',
  3: 'Mod. Fecha Expiración',
  4: 'Renovación',
  5: 'Cambio de Plan',
  6: 'Cambio de Plan',
  7: 'Cambio de SIM',
  8: 'Mod. Técnico',
  9: 'Cambio de GPS',
  10: 'Mod. Detalles Instalación',
  11: 'Mod. Modelo GPS',
  12: 'Mod. IMEI / GPS ID',
  13: 'Cambio de SIM Card',
  14: 'Mod. Número SIM',
  15: 'Mod. Tipo SIM',
  16: 'Restauración',
};

@Injectable({
  providedIn: 'root'
})
export class ProcessesService {
  private apiUrl = `${environment.apiUrl}/process`;

  constructor(private http: HttpClient) {}

  getPaginated(
    page = 1,
    limit = 20,
    filters?: {
      type?: number;
      creator?: string;
      mechanic?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
    }
  ): Observable<PaginatedProcessResponse> {
    let url = `${this.apiUrl}/paginated?page=${page}&limit=${limit}`;
    if (filters?.type !== undefined && filters.type !== null) url += `&type=${filters.type}`;
    if (filters?.creator) url += `&creator=${encodeURIComponent(filters.creator)}`;
    if (filters?.mechanic) url += `&mechanic=${encodeURIComponent(filters.mechanic)}`;
    if (filters?.dateFrom) url += `&dateFrom=${filters.dateFrom}`;
    if (filters?.dateTo) url += `&dateTo=${filters.dateTo}`;
    if (filters?.search) url += `&search=${encodeURIComponent(filters.search)}`;
    return this.http.get<PaginatedProcessResponse>(url);
  }

  getStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/stats`);
  }
}
