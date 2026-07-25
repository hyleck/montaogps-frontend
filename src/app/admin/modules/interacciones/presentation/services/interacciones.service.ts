import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../../environments/environment';

export interface UserListFilters {
  affiliation_type_id?: string;
  company_type_id?: string;
  profile_type_id?: string;
  status?: boolean;
  exclude_notified?: boolean;
  force_empty?: boolean;
  manual_user_ids?: string[];
  excluded_user_ids?: string[];
}

export interface NotifiedHistory {
  title: string;
  body: string;
  sentAt: Date;
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
  objectives?: { id: string; title: string; description?: string }[];
  createdAt?: string;
  updatedAt?: string;
}

export interface UserListUsersResponse {
  users: any[];
  totalCount: number;
}

@Injectable({ providedIn: 'root' })
export class InteraccionesService {
  private api = `${environment.apiUrl}/user-lists`;

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
    if (filters.exclude_notified !== undefined) params.exclude_notified = filters.exclude_notified.toString();
    if (filters.force_empty !== undefined) params.force_empty = filters.force_empty.toString();
    if (filters.manual_user_ids && filters.manual_user_ids.length > 0) params.manual_user_ids = filters.manual_user_ids.join(',');
    if (filters.excluded_user_ids && filters.excluded_user_ids.length > 0) params.excluded_user_ids = filters.excluded_user_ids.join(',');
    if (listId) params.list_id = listId;
    return this.http.get<UserListUsersResponse>(`${this.api}/preview`, { params });
  }

  sendWhatsAppToUser(payload: { phone: string; template_name: string; variables: string[]; agent_id?: string }): Observable<any> {
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
}
