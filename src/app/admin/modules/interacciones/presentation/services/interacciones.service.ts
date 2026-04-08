import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../../environments/environment';

export interface UserListFilters {
  affiliation_type_id?: string;
  company_type_id?: string;
  profile_type_id?: string;
  status?: boolean;
}

export interface UserList {
  _id: string;
  name: string;
  description?: string;
  creator_id: string;
  filters: UserListFilters;
  user_count: number;
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

  getUsersInList(id: string, offset = 0, limit = 50): Observable<UserListUsersResponse> {
    return this.http.get<UserListUsersResponse>(`${this.api}/${id}/users`, {
      params: { offset: offset.toString(), limit: limit.toString() },
    });
  }

  // ── Preview dinámico ─────────────────────────────────────────────────

  previewUsers(filters: UserListFilters, offset = 0, limit = 30): Observable<UserListUsersResponse> {
    const params: any = { offset: offset.toString(), limit: limit.toString() };
    if (filters.affiliation_type_id) params.affiliation_type_id = filters.affiliation_type_id;
    if (filters.company_type_id) params.company_type_id = filters.company_type_id;
    if (filters.profile_type_id) params.profile_type_id = filters.profile_type_id;
    if (filters.status !== undefined) params.status = filters.status.toString();
    return this.http.get<UserListUsersResponse>(`${this.api}/preview`, { params });
  }
}
