import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface InstallationDetail {
    brand?: string;
    model?: string;
    year?: string;
    color?: string;
    plate?: string;
    chassis?: string;
    device_imei?: string;
    new_device_imei?: string;
    sim_card_number?: string;
    new_sim_card_number?: string;
    sim_company?: string;
    new_protocol?: string;
    province?: string;
    municipality?: string;
    sector?: string;
    latitude?: number;
    longitude?: number;
    installation_location?: string;
    scheduled_date?: string | Date;
    engine_shutdown?: string;
    ignition_sensor?: string;
    installation_details?: string;
    diagnosis?: string;
    images?: string[];
    audio?: string;
    contacts?: string;
    notes?: string;
    completed?: boolean;
    cancelled?: boolean;
}

export interface Solicitud {
    _id?: string;
    type: string;
    status: string;
    technician_response?: string;
    technician_response_call_id?: string;
    technician_response_transcript?: string;
    technician_response_updated_at?: string | Date;
    quantity?: number;
    order?: number;
    installations?: InstallationDetail[];
    client_name?: string;
    client_phone?: string;
    client_email?: string;
    description?: string;
    notes?: string;
    deinstallation_reason?: string;
    contacts?: string;
    referido?: string;
    province?: string;
    municipality?: string;
    sector?: string;
    latitude?: number;
    longitude?: number;
    mechanic_id?: string;
    scheduled_date?: string | Date;
    confirmation_permission?: string;
    completed_date?: string;
    user_id?: string;
    id_rent?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface SolicitudesRealtimeState {
    version: string;
    total: number;
    latestUpdatedAt: string | null;
}

export interface VapiCallDetails {
    success: boolean;
    recordingUrl?: string;
    transcript?: string;
    status?: string;
    duration?: number;
    error?: string;
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

    getRealtimeState(filters?: { type?: string; status?: string; search?: string }): Observable<SolicitudesRealtimeState> {
        let params = new HttpParams();
        if (filters?.type) params = params.set('type', filters.type);
        if (filters?.status) params = params.set('status', filters.status);
        if (filters?.search) params = params.set('search', filters.search);
        return this.http.get<SolicitudesRealtimeState>(`${this.apiUrl}/realtime-state`, { params });
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

    verifyAvailability(id: string): Observable<Solicitud> {
        return this.http.post<Solicitud>(`${this.apiUrl}/${id}/verify-availability`, {});
    }

    getAvailabilityCallDetails(callId: string): Observable<VapiCallDetails> {
        return this.http.get<VapiCallDetails>(`${environment.apiUrl}/vapi/call-recording/${callId}`);
    }

    getAvailabilityCallAudioUrl(callId: string): string {
        return `${environment.apiUrl}/vapi/call-recording/${encodeURIComponent(callId)}/audio`;
    }

    delete(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }

    completeInstall(solicitudId: string, deviceId: string, imei: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/${solicitudId}/complete-install`, {
            device_id: deviceId,
            imei: imei
        });
    }
}
