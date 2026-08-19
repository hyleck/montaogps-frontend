import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface InstallationDetail {
    process_type?: string;
    device_type?: 'gps' | 'mtag_a' | 'mtag_p';
    target_name?: string;
    target_category?: string;
    deinstallation_reason?: string;
    post_uninstall_disposition?: 'return_to_company' | 'retained_by_client' | 'not_recovered';
    brand?: string;
    model?: string;
    year?: string;
    color?: string;
    plate?: string;
    chassis?: string;
    previous_target_name?: string;
    previous_brand?: string;
    previous_model?: string;
    previous_year?: string;
    previous_color?: string;
    previous_plate?: string;
    previous_chassis?: string;
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
    installation_evidence?: Array<{
        field?: string;
        label?: string;
        url: string;
        uploaded_at?: string | Date;
    }>;
    audio?: string;
    final_device_status?: string;
    final_device_online?: boolean;
    final_device_status_at?: string | Date;
    contacts?: string;
    notes?: string;
    completed?: boolean;
    completion_source?: 'technician' | 'office';
    completed_at?: string | Date;
    completed_by_id?: string;
    completed_by_name?: string;
    completed_by_email?: string;
    office_completion_reason?: string;
    technician_completion_missing?: boolean;
    cancelled?: boolean;
    omitted?: boolean;
    omitted_at?: string | Date;
    omitted_reason?: string;
    reinstallation_validated?: boolean;
    retained_device_id?: string;
    retained_expiration_date?: string | Date;
    correction_history?: InstallationCorrectionHistoryEntry[];
}

export interface InstallationCorrectionHistoryEntry {
    _id?: string;
    corrected_at: string | Date;
    corrected_by_id: string;
    corrected_by_name: string;
    corrected_by_email?: string;
    reason?: string;
    changed_fields: string[];
    before?: Record<string, any>;
    after?: Record<string, any>;
}

export interface SolicitudReassignment {
    reason?: string;
    previous_mechanic_id?: string;
    mechanic_id?: string;
    previous_scheduled_date?: string | Date;
    scheduled_date?: string | Date;
    reassigned_at?: string | Date;
    reassigned_by_id?: string;
    reassigned_by_name?: string;
}

export interface SolicitudLockEvent {
    action: 'locked' | 'unlocked';
    reason?: string;
    actor_id?: string;
    actor_name?: string;
    occurred_at: string | Date;
}

export interface Solicitud {
    _id?: string;
    __v?: number;
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
    post_uninstall_disposition?: 'return_to_company' | 'retained_by_client' | 'not_recovered';
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
    reassigned?: boolean;
    reassignment_reason?: string;
    reassigned_at?: string | Date;
    reassigned_by_id?: string;
    reassigned_by_name?: string;
    reassignment_history?: SolicitudReassignment[];
    locked?: boolean;
    lock_reason?: string;
    locked_at?: string | Date;
    locked_by_id?: string;
    locked_by_name?: string;
    unlocked_at?: string | Date;
    unlocked_by_id?: string;
    unlocked_by_name?: string;
    lock_history?: SolicitudLockEvent[];
    created_by_id?: string;
    created_by_name?: string;
    user_id?: string;
    id_rent?: string;
    source_chequeo_id?: string;
    gps_change?: Solicitud;
    createdAt?: string;
    updatedAt?: string;
    idempotency_key?: string;
    expected_version?: number;
    operation_warnings?: string[];
    client_acceptance_notification_sent_at?: string | Date;
    client_registration_invitation_sent_at?: string | Date;
    client_registration_short_code?: string;
    completion_transfer_mode?: SolicitudCompletionTransferMode;
    completion_transfer_target_user_id?: string;
}

export type SolicitudCompletionTransferMode = 'automatic' | 'disabled' | 'custom';

export type SolicitudCompletionPreviewState =
    | 'will_run'
    | 'already_done'
    | 'deferred'
    | 'not_applicable'
    | 'attention';

export interface SolicitudCompletionPreviewAction {
    key: string;
    title: string;
    detail: string;
    state: SolicitudCompletionPreviewState;
    icon: string;
    count?: number;
}

export interface SolicitudCompletionPreview {
    solicitud_id: string;
    client_name: string;
    mode: 'status_update' | 'complete_install';
    transfer?: {
        mode: SolicitudCompletionTransferMode;
        target_user: {
            id: string;
            name: string;
            last_name: string;
            email: string;
        } | null;
    };
    actions: SolicitudCompletionPreviewAction[];
}

export interface SolicitudesRealtimeState {
    version: string;
    total: number;
    latestUpdatedAt: string | null;
}

export interface TechnicianAssistancePresence {
    mechanic_id: string;
    technician_name: string;
    installation_index: number;
    action_id: string;
    action_label: string;
    last_seen_at: string | Date;
}

export interface TechnicianAssistancePresenceState {
    online: boolean;
    presence: TechnicianAssistancePresence | null;
    refresh_pending: boolean;
    logout_pending?: boolean;
    refresh_requested_at?: string | Date | null;
    refresh_delivered_at?: string | Date | null;
}

export interface TechnicianDataRefreshResponse {
    queued: boolean;
    action?: 'refresh' | 'logout';
    command_id: string;
    href: string;
    technician_online: boolean;
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

export interface SolicitudInstallationDeviceDetails {
    device: any | null;
    imei: string | null;
}

@Injectable({ providedIn: 'root' })
export class SolicitudesService {
    private readonly apiUrl = `${environment.apiUrl}/solicitudes`;

    constructor(private http: HttpClient) { }

    getAll(filters?: { type?: string; status?: string; search?: string; sort_by?: 'status_scheduled'; sort_order?: 'asc' | 'desc'; page?: number; limit?: number }): Observable<{ data: Solicitud[]; total: number }> {
        let params = new HttpParams();
        if (filters?.type) params = params.set('type', filters.type);
        if (filters?.status) params = params.set('status', filters.status);
        if (filters?.search) params = params.set('search', filters.search);
        if (filters?.sort_by) params = params.set('sort_by', filters.sort_by);
        if (filters?.sort_order) params = params.set('sort_order', filters.sort_order);
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

    getTechnicianAssistancePresence(
        id: string,
    ): Observable<TechnicianAssistancePresenceState> {
        return this.http.get<TechnicianAssistancePresenceState>(
            `${this.apiUrl}/${encodeURIComponent(id)}/technician-presence`,
        );
    }

    requestTechnicianDataRefresh(
        id: string,
    ): Observable<TechnicianDataRefreshResponse> {
        return this.http.post<TechnicianDataRefreshResponse>(
            `${this.apiUrl}/${encodeURIComponent(id)}/refresh-technician-data`,
            {},
        );
    }

    requestTechnicianLogout(
        id: string,
    ): Observable<TechnicianDataRefreshResponse> {
        return this.http.post<TechnicianDataRefreshResponse>(
            `${this.apiUrl}/${encodeURIComponent(id)}/logout-technician`,
            {},
        );
    }

    getInstallationDeviceDetails(
        solicitudId: string,
        installationIndex: number,
    ): Observable<SolicitudInstallationDeviceDetails> {
        return this.http.get<SolicitudInstallationDeviceDetails>(
            `${this.apiUrl}/${encodeURIComponent(solicitudId)}/installations/${installationIndex}/device-details`,
        );
    }

    configureInstallationDevice(
        solicitudId: string,
        installationIndex: number,
        payload: {
            existing_device_id?: string;
            device: Record<string, any>;
            installation?: Record<string, any>;
        },
    ): Observable<{ solicitud: Solicitud; installation: InstallationDetail; device: any }> {
        return this.http.post<{ solicitud: Solicitud; installation: InstallationDetail; device: any }>(
            `${this.apiUrl}/${encodeURIComponent(solicitudId)}/installations/${installationIndex}/configure-device`,
            payload,
        );
    }

    replaceInstallationDevice(
        solicitudId: string,
        installationIndex: number,
        payload: { new_imei: string; expected_current_imei: string; reason: string },
    ): Observable<{ solicitud: Solicitud; installation: InstallationDetail; device: any }> {
        return this.http.post<{ solicitud: Solicitud; installation: InstallationDetail; device: any }>(
            `${this.apiUrl}/${encodeURIComponent(solicitudId)}/installations/${installationIndex}/replace-device`,
            payload,
        );
    }

    updateInstallationProgress(
        solicitudId: string,
        installationIndex: number,
        changes: Record<string, any>,
        status?: string,
        expectedVersion?: number,
    ): Observable<{
        solicitud: Solicitud;
        installation: InstallationDetail;
        operation_warnings?: string[];
    }> {
        return this.http.patch<{
            solicitud: Solicitud;
            installation: InstallationDetail;
            operation_warnings?: string[];
        }>(
            `${this.apiUrl}/${encodeURIComponent(solicitudId)}/installations/${installationIndex}/progress`,
            {
                changes,
                ...(status ? { status } : {}),
                ...(expectedVersion !== undefined ? { expected_version: expectedVersion } : {}),
            },
        );
    }

    correctInstallation(
        solicitudId: string,
        installationIndex: number,
        payload: {
            changes: Record<string, any>;
            reason?: string;
            expected_version?: number;
        },
    ): Observable<{
        solicitud: Solicitud;
        installation: InstallationDetail;
        correction: InstallationCorrectionHistoryEntry;
        operation_warnings?: string[];
    }> {
        return this.http.patch<{
            solicitud: Solicitud;
            installation: InstallationDetail;
            correction: InstallationCorrectionHistoryEntry;
            operation_warnings?: string[];
        }>(
            `${this.apiUrl}/${encodeURIComponent(solicitudId)}/installations/${installationIndex}/correction`,
            payload,
        );
    }

    completeInstallationFromOffice(
        solicitudId: string,
        installationIndex: number,
        payload: { reason?: string; expected_version?: number },
    ): Observable<{
        solicitud: Solicitud;
        installation: InstallationDetail;
        operation_warnings?: string[];
    }> {
        return this.http.post<{
            solicitud: Solicitud;
            installation: InstallationDetail;
            operation_warnings?: string[];
        }>(
            `${this.apiUrl}/${encodeURIComponent(solicitudId)}/installations/${installationIndex}/complete-from-office`,
            payload,
        );
    }

    getCompletionPreview(
        solicitudId: string,
        mode: 'status_update' | 'complete_install' = 'status_update',
    ): Observable<SolicitudCompletionPreview> {
        const params = new HttpParams().set('mode', mode);
        return this.http.get<SolicitudCompletionPreview>(
            `${this.apiUrl}/${encodeURIComponent(solicitudId)}/completion-preview`,
            { params },
        );
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

    applyVehicleChange(id: string): Observable<Solicitud> {
        return this.http.post<Solicitud>(
            `${this.apiUrl}/${encodeURIComponent(id)}/apply-vehicle-change`,
            {},
        );
    }

    reorder(items: Array<{
        id: string;
        status: string;
        order: number;
        expected_version?: number;
    }>): Observable<Solicitud[]> {
        return this.http.patch<Solicitud[]>(`${this.apiUrl}/board/reorder`, { items });
    }

    reassign(
        id: string,
        input: { mechanic_id: string; scheduled_date: string; reason: string },
    ): Observable<Solicitud> {
        return this.http.post<Solicitud>(`${this.apiUrl}/${id}/reassign`, input);
    }

    lock(id: string, reason: string): Observable<Solicitud> {
        return this.http.post<Solicitud>(`${this.apiUrl}/${id}/lock`, { reason });
    }

    unlock(id: string): Observable<Solicitud> {
        return this.http.post<Solicitud>(`${this.apiUrl}/${id}/unlock`, {});
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
