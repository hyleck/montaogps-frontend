import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User, CreateUserDto, UpdateUserDto } from '../interfaces';

interface UpdatePasswordDto {
  password: string;
}

export interface UsersResponse {
  users: User[];
  totalCount: number;
}

export interface MainAccountResponse {
  account: {
    _id: string;
    name?: string;
    last_name?: string;
    email?: string;
    affiliation_type_id?: string;
  };
  updated_at?: string | Date;
}

export interface RegistrationLinkResponse {
  token?: string;
  short_code?: string;
  expires_at: string;
  target_count: number;
}

export interface IdentityVerificationLinkResponse {
  short_code: string;
  expires_at: string;
  user_id: string;
}

export interface PublicRegistrationInfo {
  parent: {
    id: string;
    name: string;
    last_name?: string;
    email?: string;
  };
  target_count: number;
  expires_at: string;
  /** El teléfono viene firmado en el enlace; no se expone ni se pide nuevamente. */
  uses_linked_phone?: boolean;
}

export interface PublicIdentityVerificationInfo {
  user: {
    id: string;
    name: string;
    last_name?: string;
    email?: string;
    verificado?: boolean;
  };
  expires_at: string;
}

export interface IdentityScanResponse {
  ok: boolean;
  userId?: string;
  data: Record<string, any>;
  voiceAudio?: { mimeType: string; base64: string };
  rawText?: string;
}

export interface IdentityFinalizeResponse {
  ok: boolean;
  userId?: string;
  data: Record<string, any>;
  cedula_img?: any;
  user?: User;
}

export interface UserLatestLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  recordedAt?: string | Date;
  source?: string;
}

export interface UserStaticLocation {
  static_location_url?: string | null;
  static_location_address?: string | null;
  static_latitude?: number | null;
  static_longitude?: number | null;
}

export interface ResolvedGoogleMapsLink {
  original_url: string;
  resolved_url: string;
  latitude: number;
  longitude: number;
  address?: string;
}

export interface LocatedUser {
  id: string;
  name: string;
  last_name?: string;
  email?: string;
  affiliation_type_id?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  recordedAt?: string | Date;
  source?: string;
}

export interface ClientVerificationMetrics {
  total: number;
  verified: number;
  pending: number;
  noAssistance: number;
  verifiedPercent: number;
  pendingPercent: number;
  noAssistancePercent: number;
}

export interface PersonalizedCallHistory {
  _id?: string;
  callId?: string;
  phone?: string;
  clientName?: string;
  reason?: string;
  status?: string;
  calledAt?: string | Date;
  recordingUrl?: string;
  transcript?: string;
  summary?: string;
  duration?: number;
  endedAt?: string | Date;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) { }

  getAll(parent?: string): Observable<User[]> {
    let params = {};
    if (parent) {
      params = { params: { parent } };
    }
    return this.http.get<User[]>(this.apiUrl, params);
  }

  getAllWithPagination(parent: string, offset: number = 0, limit: number = 30): Observable<UsersResponse> {
    const params = {
      parent,
      offset: offset.toString(),
      limit: limit.toString()
    };
    return this.http.get<UsersResponse>(this.apiUrl, { params });
  }

  getManagementSummary(id: string): Observable<{ usersCount: number; targetsCount: number }> {
    return this.http.get<{ usersCount: number; targetsCount: number }>(
      `${this.apiUrl}/${encodeURIComponent(id)}/management-summary`
    );
  }

  search(query: string, parent?: string, offset: number = 0, limit: number = 30): Observable<UsersResponse> {
    let params: any = {
      q: query,
      offset: offset.toString(),
      limit: limit.toString()
    };
    if (parent) {
      params.parent = parent;
    }
    return this.http.get<UsersResponse>(`${this.apiUrl}/search`, { params });
  }

  searchSolicitudClients(query: string = '', offset: number = 0, limit: number = 30): Observable<UsersResponse> {
    const params = {
      q: query,
      offset: offset.toString(),
      limit: limit.toString()
    };
    return this.http.get<UsersResponse>(`${this.apiUrl}/solicitud-clients`, { params });
  }

  getByEmail(email: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/by-email?email=${encodeURIComponent(email)}`);
  }

  getDeviceRecipientByEmail(email: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/device-recipient?email=${encodeURIComponent(email)}`);
  }

  getByPhone(phone: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/by-phone`, { params: { phone } });
  }

  getById(id: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`);
  }

  getMainAccount(): Observable<MainAccountResponse> {
    return this.http.get<MainAccountResponse>(`${environment.apiUrl}/main-account`);
  }

  setMainAccount(accountId: string): Observable<MainAccountResponse> {
    return this.http.put<MainAccountResponse>(
      `${environment.apiUrl}/main-account/${encodeURIComponent(accountId)}`,
      {},
    );
  }

  getUserPath(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}/path/`);
  }

  getLatestLocation(id: string): Observable<UserLatestLocation | null> {
    return this.http.get<UserLatestLocation | null>(`${this.apiUrl}/${id}/location/latest`);
  }

  getStaticLocation(id: string): Observable<UserStaticLocation> {
    return this.http.get<UserStaticLocation>(`${this.apiUrl}/${id}/static-location`);
  }

  updateStaticLocation(id: string, location: UserStaticLocation): Observable<UserStaticLocation> {
    return this.http.patch<UserStaticLocation>(`${this.apiUrl}/${id}/static-location`, location);
  }

  resolveGoogleMapsLink(url: string): Observable<ResolvedGoogleMapsLink> {
    return this.http.post<ResolvedGoogleMapsLink>(`${this.apiUrl}/static-location/resolve-link`, { url });
  }

  getLocatedUsers(): Observable<LocatedUser[]> {
    return this.http.get<LocatedUser[]>(`${this.apiUrl}/locations/all`);
  }

  getClientVerificationMetrics(): Observable<ClientVerificationMetrics> {
    return this.http.get<ClientVerificationMetrics>(`${this.apiUrl}/metrics/client-verification`);
  }

  getPersonalizedCalls(userId: string): Observable<PersonalizedCallHistory[]> {
    return this.http.get<PersonalizedCallHistory[]>(`${this.apiUrl}/${userId}/personalized-calls`);
  }

  create(createUserDto: CreateUserDto): Observable<User> {
    return this.http.post<User>(this.apiUrl, createUserDto);
  }

  createRegistrationLink(payload: { parent_id: string; target_ids?: string[]; access_level_id?: string; affiliation_type_id?: 'cliente' | 'subcliente' }): Observable<RegistrationLinkResponse> {
    return this.http.post<RegistrationLinkResponse>(`${this.apiUrl}/registration-link`, payload);
  }

  createIdentityVerificationLink(userId: string): Observable<IdentityVerificationLinkResponse> {
    return this.http.post<IdentityVerificationLinkResponse>(`${this.apiUrl}/${userId}/identity-verification-link`, {});
  }

  getPublicRegistrationInfo(token: string): Observable<PublicRegistrationInfo> {
    return this.http.get<PublicRegistrationInfo>(`${environment.apiUrl}/users-public/registration-link/${encodeURIComponent(token)}`);
  }

  scanPublicRegistrationIdentity(token: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('cedula', file);
    return this.http.post<any>(`${environment.apiUrl}/users-public/registration-link/${encodeURIComponent(token)}/scan-identity`, formData);
  }

  scanIdentity(userId: string, file: File): Observable<IdentityScanResponse> {
    const formData = new FormData();
    formData.append('cedula', file);
    return this.http.post<IdentityScanResponse>(`${this.apiUrl}/${userId}/scan-identity`, formData);
  }

  finalizeIdentity(userId: string, file: File, metadata: Record<string, any>): Observable<IdentityFinalizeResponse> {
    const formData = new FormData();
    formData.append('cedula', file);
    formData.append('metadata', JSON.stringify(metadata));
    return this.http.post<IdentityFinalizeResponse>(`${this.apiUrl}/${userId}/finalize-identity`, formData);
  }

  registerWithPublicLink(token: string, payload: any): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/users-public/registration-link/${encodeURIComponent(token)}/register`, payload);
  }

  getPublicIdentityVerificationInfo(token: string): Observable<PublicIdentityVerificationInfo> {
    return this.http.get<PublicIdentityVerificationInfo>(`${environment.apiUrl}/users-public/identity-verification/${encodeURIComponent(token)}`);
  }

  scanPublicIdentityVerification(token: string, file: File): Observable<IdentityScanResponse> {
    const formData = new FormData();
    formData.append('cedula', file);
    return this.http.post<IdentityScanResponse>(`${environment.apiUrl}/users-public/identity-verification/${encodeURIComponent(token)}/scan-identity`, formData);
  }

  finalizePublicIdentityVerification(token: string, file: File, metadata: Record<string, any>): Observable<IdentityFinalizeResponse> {
    const formData = new FormData();
    formData.append('cedula', file);
    formData.append('metadata', JSON.stringify(metadata));
    return this.http.post<IdentityFinalizeResponse>(`${environment.apiUrl}/users-public/identity-verification/${encodeURIComponent(token)}/finalize`, formData);
  }

  update(id: string, updateUserDto: UpdateUserDto): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/${id}`, updateUserDto);
  }

  transferBranch(id: string, targetParentId: string): Observable<{ rootUser: User; usersUpdated: number; devicesUpdated: number }> {
    return this.http.patch<{ rootUser: User; usersUpdated: number; devicesUpdated: number }>(
      `${this.apiUrl}/${id}/transfer-branch`,
      { targetParentId },
    );
  }

  updatePassword(id: string, updatePasswordDto: UpdatePasswordDto): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${id}`, updatePasswordDto);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  closeSessions(id: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${id}/close-sessions`, {});
  }

  deleteSession(id: string, sessionDateStr: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}/sessions/${sessionDateStr}`);
  }

  getTechnicians(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/technicians`);
  }

  getSharedUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/shared`);
  }

  getEmployees(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/employees`);
  }

  getActiveUsers(minutes: number = 15): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/active`, {
      params: { minutes: String(minutes) }
    });
  }

  toggleInteractionProgress(userId: string, listId: string, objectiveId: string, completed: boolean): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${userId}/interaction-progress/${listId}`, {
      objectiveId,
      completed
    });
  }
}
