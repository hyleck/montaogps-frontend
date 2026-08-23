import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../../environments/environment';

export interface UserListFilters {
  affiliation_type_id?: string;
  company_type_id?: string;
  profile_type_id?: string;
  status?: boolean;
  province?: string;
  municipality?: string;
  satisfaction_min?: number;
  satisfaction_max?: number;
  autocontact?: boolean;
  active_within_days?: number;
  min_device_count?: number;
  max_device_count?: number;
  has_open_request?: boolean;
  request_status?: string;
  conversation_assignment?: 'ester' | 'assigned' | 'unassigned' | 'waiting';
  exclude_notified?: boolean;
  force_empty?: boolean;
  manual_user_ids?: string[];
  excluded_user_ids?: string[];
}

export interface NotifiedHistory {
  title: string;
  body: string;
  sentAt: Date;
  executionId?: string;
  channel?: 'whatsapp' | 'push' | 'vapi' | 'sms' | 'manual';
}

export interface NotifiedUser {
  userId: string;
  notification_count: number;
  last_sent_at?: Date;
  history: NotifiedHistory[];
}

export interface ExternalContact {
  _id?: string;
  name: string;
  phone?: string;
  email?: string;
  completed_objectives?: string[];
}

export interface UserList {
  _id: string;
  name: string;
  description?: string;
  creator_id: string;
  filters: UserListFilters;
  user_count: number;
  external_contacts?: ExternalContact[];
  external_count?: number;
  total_count?: number;
  notified_users?: NotifiedUser[];
  objectives?: CampaignObjective[];
  archived?: boolean;
  notified_unique_count?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserListUsersResponse {
  users: any[];
  totalCount: number;
}

export type CampaignChannel = 'whatsapp' | 'push' | 'vapi' | 'sms';
export type CampaignConflictPolicy = 'skip' | 'queue' | 'replace';
export interface CampaignObjective {
  id: string;
  title: string;
  description?: string;
  type?: 'response' | 'data' | 'action' | 'result';
  required?: boolean;
  completion_mode?: 'automatic' | 'manual' | 'both';
}
export type CampaignExecutionStatus =
  | 'scheduled'
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface CampaignExecution {
  _id: string;
  list_id: string;
  list_name: string;
  parent_execution_id?: string;
  follow_up_execution_id?: string;
  channel: CampaignChannel;
  status: CampaignExecutionStatus;
  title?: string;
  body: string;
  body_variant_b?: string;
  objective?: string;
  objectives?: CampaignObjective[];
  conversation_conflict_policy?: CampaignConflictPolicy;
  generated_by_ester?: boolean;
  assign_to_ester?: boolean;
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  automatic_follow_up?: boolean;
  follow_up_after_hours?: number;
  follow_up_body?: string;
  totals: {
    total: number;
    pending: number;
    sent: number;
    failed: number;
    skipped: number;
    replied: number;
    positive: number;
    negative: number;
    interested: number;
    converted: number;
    escalated: number;
    objectives_completed?: number;
  };
  audience_snapshot?: {
    selected: number;
    missing_destination: number;
    duplicate_destination: number;
    autocontact_disabled: number;
    low_satisfaction: number;
    awaiting_employee_reply: number;
    active_campaign_conflicts?: number;
    warnings: string[];
  };
  createdAt?: string;
}

export interface CampaignTemplate {
  _id: string;
  name: string;
  description?: string;
  category: string;
  channels: CampaignChannel[];
  title?: string;
  body: string;
  objective?: string;
  follow_up_body?: string;
  objectives?: CampaignObjective[];
  is_system?: boolean;
}

@Injectable({ providedIn: 'root' })
export class InteraccionesService {
  private api = `${environment.apiUrl}/user-lists`;
  private campaignsApi = `${environment.apiUrl}/campaigns`;

  constructor(private http: HttpClient) {}

  // ── Listas ────────────────────────────────────────────────────────────

  getAll(): Observable<UserList[]> {
    return this.http.get<UserList[]>(this.api);
  }

  getOne(id: string): Observable<UserList> {
    return this.http.get<UserList>(`${this.api}/${id}`);
  }

  create(data: { name: string; description?: string; filters?: UserListFilters }): Observable<UserList> {
    return this.http.post<UserList>(this.api, data);
  }

  update(id: string, data: Partial<{ name: string; description: string; filters: UserListFilters }>): Observable<UserList> {
    return this.http.patch<UserList>(`${this.api}/${id}`, data);
  }

  remove(id: string): Observable<UserList> {
    return this.http.delete<UserList>(`${this.api}/${id}`);
  }

  archive(id: string): Observable<UserList> {
    return this.http.patch<UserList>(`${this.api}/${id}/archive`, {});
  }

  restore(id: string): Observable<UserList> {
    return this.http.patch<UserList>(`${this.api}/${id}/restore`, {});
  }

  // ── Usuarios de una lista guardada ────────────────────────────────────

  logCampaignUsers(listId: string, payload: { userIds: string[]; title: string; body: string; sentAt?: Date; callId?: string }): Observable<void> {
    return this.http.post<void>(`${this.api}/${listId}/notified-users/log`, payload);
  }

  getUsersInList(id: string, offset = 0, limit = 50): Observable<UserListUsersResponse> {
    return this.http.get<UserListUsersResponse>(`${this.api}/${id}/users`, {
      params: { offset: offset.toString(), limit: limit.toString() },
    });
  }

  // ── Preview dinámico ─────────────────────────────────────────────────

  previewUsers(filters: UserListFilters, listId?: string, offset = 0, limit = 30): Observable<UserListUsersResponse> {
    const params: any = { offset: offset.toString(), limit: limit.toString() };
    if (filters.affiliation_type_id) params.affiliation_type_id = filters.affiliation_type_id;
    if (filters.company_type_id) params.company_type_id = filters.company_type_id;
    if (filters.profile_type_id) params.profile_type_id = filters.profile_type_id;
    if (filters.status !== undefined && filters.status !== null) params.status = filters.status.toString();
    if (filters.province) params.province = filters.province;
    if (filters.municipality) params.municipality = filters.municipality;
    if (filters.satisfaction_min !== undefined && filters.satisfaction_min !== null) params.satisfaction_min = String(filters.satisfaction_min);
    if (filters.satisfaction_max !== undefined && filters.satisfaction_max !== null) params.satisfaction_max = String(filters.satisfaction_max);
    if (filters.autocontact !== undefined && filters.autocontact !== null) params.autocontact = String(filters.autocontact);
    if (filters.active_within_days) params.active_within_days = String(filters.active_within_days);
    if (filters.min_device_count !== undefined && filters.min_device_count !== null) params.min_device_count = String(filters.min_device_count);
    if (filters.max_device_count !== undefined && filters.max_device_count !== null) params.max_device_count = String(filters.max_device_count);
    if (filters.has_open_request !== undefined && filters.has_open_request !== null) params.has_open_request = String(filters.has_open_request);
    if (filters.request_status) params.request_status = filters.request_status;
    if (filters.conversation_assignment) params.conversation_assignment = filters.conversation_assignment;
    if (filters.exclude_notified !== undefined) params.exclude_notified = filters.exclude_notified.toString();
    if (filters.force_empty !== undefined) params.force_empty = filters.force_empty.toString();
    if (filters.manual_user_ids && filters.manual_user_ids.length > 0) params.manual_user_ids = filters.manual_user_ids.join(',');
    if (filters.excluded_user_ids && filters.excluded_user_ids.length > 0) params.excluded_user_ids = filters.excluded_user_ids.join(',');
    if (listId) params.list_id = listId;
    return this.http.get<UserListUsersResponse>(`${this.api}/preview`, { params });
  }

  sendWhatsAppToUser(payload: { phone: string; template_name: string; variables: string[]; agent_id?: string; clear_assignment?: boolean }): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/whatsapp/send-whatsapp`, payload);
  }

  // ── VAPI AI Voice ────────────────────────────────────────────────
  
  sendVapiCall(payload: { phone: string; query: string; name: string; listId?: string; userId?: string; isExternal?: boolean; objectives?: any[] }): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/vapi/send-call`, payload);
  }

  getVapiCallRecording(callId: string): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/vapi/call-recording/${callId}`);
  }

  toggleExternalInteractionProgress(listId: string, contactId: string, objectiveId: string, completed: boolean): Observable<any> {
    return this.http.patch<any>(`${this.api}/${listId}/external-progress/${contactId}`, { objectiveId, completed });
  }

  saveInteractionObservation(listId: string, userId: string, historyId: string, observation: string): Observable<any> {
    return this.http.patch<any>(`${this.api}/${listId}/user/${userId}/history/${historyId}/observation`, { observation });
  }

  previewCampaignAudience(listId: string, channel: CampaignChannel): Observable<any> {
    return this.http.get<any>(`${this.campaignsApi}/audience-preview`, {
      params: { list_id: listId, channel },
    });
  }

  createCampaignExecution(payload: any): Observable<CampaignExecution> {
    return this.http.post<CampaignExecution>(`${this.campaignsApi}/executions`, payload);
  }

  getCampaignExecutions(listId?: string): Observable<CampaignExecution[]> {
    const params: any = {};
    if (listId) params.list_id = listId;
    return this.http.get<CampaignExecution[]>(`${this.campaignsApi}/executions`, { params });
  }

  getCampaignExecution(id: string): Observable<any> {
    return this.http.get<any>(`${this.campaignsApi}/executions/${id}`);
  }

  pauseCampaignExecution(id: string): Observable<CampaignExecution> {
    return this.http.patch<CampaignExecution>(`${this.campaignsApi}/executions/${id}/pause`, {});
  }

  resumeCampaignExecution(id: string): Observable<CampaignExecution> {
    return this.http.patch<CampaignExecution>(`${this.campaignsApi}/executions/${id}/resume`, {});
  }

  cancelCampaignExecution(id: string): Observable<CampaignExecution> {
    return this.http.patch<CampaignExecution>(`${this.campaignsApi}/executions/${id}/cancel`, {});
  }

  updateCampaignObjectiveProgress(payload: {
    list_id: string;
    objective_id: string;
    completed: boolean;
    execution_id?: string;
    recipient_id?: string;
    user_id?: string;
    external_contact_id?: string;
    source?: 'manual' | 'ester_ai' | 'vapi' | 'system';
    evidence?: Record<string, any>;
  }): Observable<any> {
    return this.http.patch<any>(
      `${this.campaignsApi}/objective-progress`,
      payload,
    );
  }

  retryCampaignExecution(id: string): Observable<CampaignExecution> {
    return this.http.post<CampaignExecution>(`${this.campaignsApi}/executions/${id}/retry-failed`, {});
  }

  createCampaignFollowUp(id: string, body?: string): Observable<CampaignExecution> {
    return this.http.post<CampaignExecution>(`${this.campaignsApi}/executions/${id}/follow-up`, { body });
  }

  getCampaignMetrics(listId?: string): Observable<any> {
    const params: any = {};
    if (listId) params.list_id = listId;
    return this.http.get<any>(`${this.campaignsApi}/metrics`, { params });
  }

  generateCampaignDraft(payload: {
    objective: string;
    channel: CampaignChannel;
    audience_description?: string;
    tone?: string;
    required_points?: string[];
  }): Observable<any> {
    return this.http.post<any>(`${this.campaignsApi}/ester/draft`, payload);
  }

  getCampaignTemplates(): Observable<CampaignTemplate[]> {
    return this.http.get<CampaignTemplate[]>(`${this.campaignsApi}/templates`);
  }

  createCampaignTemplate(payload: Partial<CampaignTemplate>): Observable<CampaignTemplate> {
    return this.http.post<CampaignTemplate>(`${this.campaignsApi}/templates`, payload);
  }
}
