import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface InstallationDetail {
    process_type?: string;
    deinstallation_reason?: string;
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
    new_sim_company?: string;
    new_protocol?: string;
    province?: string;
    municipality?: string;
    sector?: string;
    latitude?: number;
    longitude?: number;
    google_maps_url?: string;
    location_address?: string;
    installation_location?: string;
    scheduled_date?: string | Date;
    engine_shutdown?: string;
    ignition_sensor?: string;
    installation_details?: string;
    diagnosis?: string;
    resolution_type?: string;
    connection_status?: string;
    checkup_recovery?: {
        connection_checked?: boolean;
        connection_corrected?: boolean;
        power_checked?: boolean;
        power_corrected?: boolean;
        sim_replacement_attempted?: boolean;
        gps_replacement_attempted?: boolean;
        previous_device_imei?: string;
        replacement_device_imei?: string;
        previous_sim_card_number?: string;
        replacement_sim_card_number?: string;
        replacement_sim_company?: string;
        last_online_check_step?: 'connection' | 'power' | 'sim' | 'gps';
        online_confirmed?: boolean;
        online_confirmed_at?: string | Date;
    };
    images?: string[];
    audio?: string;
    final_device_status?: string;
    final_device_online?: boolean;
    final_device_status_at?: string | Date;
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
    client_id?: string;
    description?: string;
    notes?: string;
    cancellation_reason?: string;
    deinstallation_reason?: string;
    contacts?: string;
    referido?: string;
    province?: string;
    municipality?: string;
    sector?: string;
    latitude?: number;
    longitude?: number;
    google_maps_url?: string;
    location_address?: string;
    mechanic_id?: string;
    scheduled_date?: string | Date;
    confirmation_permission?: string;
    completed_date?: string;
    created_by_id?: string;
    created_by_name?: string;
    user_id?: string;
    id_rent?: string;
    source_chequeo_id?: string;
    gps_change?: Solicitud;
    createdAt?: string;
    updatedAt?: string;
}

export interface SolicitudesRealtimeState {
    version: string;
    total: number;
    latestUpdatedAt: string | null;
}

export interface TechnicianScheduleConflict {
    solicitud_id: string;
    type: string;
    type_label: string;
    client_name?: string;
    scheduled_date: string | Date;
    difference_minutes: number;
}

export interface TechnicianScheduleAvailability {
    available: boolean;
    conflict?: TechnicianScheduleConflict;
}

export interface TechnicianRecommendation {
    technician_id: string;
    technician_name: string;
    distance_km: number | null;
    reason: string;
    location_reference?: {
        type: 'app' | 'last_process';
        source: string;
        recorded_at?: string | Date;
        latitude: number;
        longitude: number;
        distance_km: number;
    };
    last_process?: {
        solicitud_id: string;
        type: string;
        type_label: string;
        client_name?: string;
        completed_date?: string | Date;
        latitude: number;
        longitude: number;
    };
}

export interface TechnicianRecommendationResponse {
    recommendation: TechnicianRecommendation | null;
    evaluated_technicians: number;
    available_technicians: number;
    message?: string;
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

    checkTechnicianScheduleConflict(
        mechanicId: string,
        scheduledDate: string | Date,
        excludeId?: string,
    ): Observable<TechnicianScheduleAvailability> {
        let params = new HttpParams()
            .set('mechanic_id', mechanicId)
            .set('scheduled_date', String(scheduledDate));
        if (excludeId) {
            params = params.set('exclude_id', excludeId);
        }
        return this.http.get<TechnicianScheduleAvailability>(
            `${this.apiUrl}/technician-schedule-conflict`,
            { params },
        );
    }

    getTechnicianRecommendation(input: {
        scheduledDate: string | Date;
        latitude: number;
        longitude: number;
        excludeId?: string;
    }): Observable<TechnicianRecommendationResponse> {
        let params = new HttpParams()
            .set('scheduled_date', String(input.scheduledDate))
            .set('latitude', String(input.latitude))
            .set('longitude', String(input.longitude));
        if (input.excludeId) {
            params = params.set('exclude_id', input.excludeId);
        }
        return this.http.get<TechnicianRecommendationResponse>(
            `${this.apiUrl}/technician-recommendation`,
            { params },
        );
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
