import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Solicitud {
    _id?: string;
    type: 'instalacion' | 'chequeo' | 'cambio' | 'desinstalacion' | 'otro';
    status: 'pendiente' | 'en_progreso' | 'completada' | 'cancelada';
    plate?: string;
    brand?: string;
    model?: string;
    color?: string;
    year?: string;
    chassis?: string;
    device_imei?: string;
    sim_card_number?: string;
    sim_company?: string;
    installation_location?: string;
    engine_shutdown?: string;
    ignition_sensor?: string;
    installation_details?: string;
    contacts?: string;
    mechanic_id?: string;
    client_name?: string;
    client_phone?: string;
    province?: string;
    municipality?: string;
    description?: string;
    notes?: string;
    scheduled_date?: string;
    completed_date?: string;
    user_id?: string;
    createdAt?: string;
    updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class SolicitudesService {
    private readonly apiUrl = `${environment.apiUrl}/solicitudes`;

    constructor(private http: HttpClient) { }

    getAll(filters?: { type?: string; status?: string; search?: string; page?: number; limit?: number }): Observable<{ data: Solicitud[]; total: number }> {
        let params = new HttpParams();
        if (filters?.type) params = params.set('type', filters.type);
        if (filters?.status) params = params.set('status', filters.status);
        if (filters?.search) params = params.set('search', filters.search);
        if (filters?.page) params = params.set('page', filters.page.toString());
        if (filters?.limit) params = params.set('limit', filters.limit.toString());
        return this.http.get<{ data: Solicitud[]; total: number }>(this.apiUrl, { params });
    }

    getById(id: string): Observable<Solicitud> {
        return this.http.get<Solicitud>(`${this.apiUrl}/${id}`);
    }

    create(solicitud: Partial<Solicitud>): Observable<Solicitud> {
        return this.http.post<Solicitud>(this.apiUrl, solicitud);
    }

    update(id: string, solicitud: Partial<Solicitud>): Observable<Solicitud> {
        return this.http.patch<Solicitud>(`${this.apiUrl}/${id}`, solicitud);
    }

    delete(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }
}
