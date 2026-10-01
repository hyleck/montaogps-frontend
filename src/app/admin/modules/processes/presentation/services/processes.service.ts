import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface ProcessClientRouteEntry {
  id: string;
  fullName: string;
  affiliation_type_id?: string;
}

export interface ProcessItem {
  _id: string;
  type: number;
  readOnly?: boolean;
  description: string;
  details?: string;
  target: {
    _id: string;
    name?: string;
    device_imei?: string;
    sim_card_number?: string;
    solicitud_id?: string;
    solicitud_installation_id?: string;
    solicitud_installation_index?: number;
    [key: string]: any;
  };
  user: { _id: string; name?: string; email?: string; [key: string]: any };
  client?: {
    _id?: string;
    name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    [key: string]: any;
  };
  clientRoute?: ProcessClientRouteEntry[];
  reference: string;
  before: any;
  after: any;
  registrationDate: string;
  creator: any;
  verificationStatus?: ProcessVerificationStatus;
  verifiedBy?: any;
  verifiedAt?: string;
  verificationNote?: string;
  createdAt: string;
  updatedAt: string;
}

export type ProcessVerificationStatus = 'pending' | 'verified' | 'rejected';

export const PROCESS_VERIFICATION_STATUS_LABELS: Record<ProcessVerificationStatus, string> = {
  pending: 'Pendiente',
  verified: 'Verificado',
  rejected: 'Rechazado',
};

export interface PaginatedProcessResponse {
  data: ProcessItem[];
  total: number;
  page: number;
  lastPage: number;
}

export interface ProcessListFilters {
  type?: number;
  types?: number[];
  creator?: string;
  mechanic?: string;
  client?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  verificationStatus?: ProcessVerificationStatus;
}

export interface ProcessClientGroupResult {
  id: string;
  name: string;
  contact: string;
  route: ProcessClientRouteEntry[];
  total: number;
  processes: ProcessItem[];
  page: number;
  lastPage: number;
}

export interface PaginatedProcessClientGroupsResponse {
  groups: ProcessClientGroupResult[];
  total: number;
  totalGroups: number;
  page: number;
  lastPage: number;
}

export interface ProcessClientOption {
  _id?: string;
  id?: string;
  name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
}

export interface CreatorStatsItem {
  _id?: string;
  creatorName?: string;
  creatorEmail?: string;
  totalProcesses: number;
  processesByType?: Array<{ type: number; count: number }>;
}

export interface CreatorStatsResponse {
  statsByCreator: CreatorStatsItem[];
  generatedAt: string | Date;
}

export interface TechnicianWorkStatsItem {
  technicianId: string | null;
  technician: string;
  installations: number;
  checks: number;
  total: number;
  installationPercent: number;
  checkPercent: number;
}

export interface TechnicianWorkStatsResponse {
  totalInstallations: number;
  totalChecks: number;
  technicians: TechnicianWorkStatsItem[];
  generatedAt: string | Date;
}

export const PROCESS_TYPE_LABELS: { [key: number]: string } = {
  1: 'Instalación',
  2: 'Mod. Fecha Instalación',
  3: 'Mod. Fecha Expiración',
  4: 'Renovar ( Facturación a crédito )',
  7: 'Cambio de SIM',
  8: 'Mod. Técnico',
  9: 'Cambio de GPS',
  10: 'Chequeo',
  11: 'Mod. Modelo GPS',
  12: 'Mod. IMEI / GPS ID',
  13: 'Cambio de SIM Card',
  14: 'Mod. Número SIM',
  15: 'Mod. Tipo SIM',
  16: 'Restauración',
  17: 'Activación Automática',
  18: 'Reinstalación',
  19: 'Desinstalación',
  20: 'Renovar ( Facturación al contado )',
  21: 'Cambio de vehículo',
  22: 'Renovación pendiente',
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
    filters?: ProcessListFilters,
  ): Observable<PaginatedProcessResponse> {
    return this.http.get<PaginatedProcessResponse>(`${this.apiUrl}/paginated?${this.processQuery(page, limit, filters)}`);
  }

  getClientGroups(page = 1, limit = 10, filters?: ProcessListFilters, processLimit = 20): Observable<PaginatedProcessClientGroupsResponse> {
    return this.http.get<PaginatedProcessClientGroupsResponse>(
      `${this.apiUrl}/client-groups?${this.processQuery(page, limit, filters)}&processLimit=${processLimit}`,
    );
  }

  getClientGroupProcesses(clientId: string, page = 1, limit = 20, filters?: ProcessListFilters): Observable<PaginatedProcessResponse> {
    return this.http.get<PaginatedProcessResponse>(
      `${this.apiUrl}/client-groups/${encodeURIComponent(clientId)}/processes?${this.processQuery(page, limit, filters)}`,
    );
  }

  private processQuery(page: number, limit: number, filters?: ProcessListFilters): string {
    let url = `page=${page}&limit=${limit}`;
    if (filters?.types?.length) url += `&types=${encodeURIComponent(filters.types.join(','))}`;
    else if (filters?.type !== undefined && filters.type !== null) url += `&type=${filters.type}`;
    if (filters?.creator) url += `&creator=${encodeURIComponent(filters.creator)}`;
    if (filters?.mechanic) url += `&mechanic=${encodeURIComponent(filters.mechanic)}`;
    if (filters?.client) url += `&client=${encodeURIComponent(filters.client)}`;
    if (filters?.dateFrom) url += `&dateFrom=${encodeURIComponent(filters.dateFrom)}`;
    if (filters?.dateTo) url += `&dateTo=${encodeURIComponent(filters.dateTo)}`;
    if (filters?.search) url += `&search=${encodeURIComponent(filters.search)}`;
    if (filters?.verificationStatus) url += `&verificationStatus=${encodeURIComponent(filters.verificationStatus)}`;
    return url;
  }

  updateVerificationStatus(
    processId: string,
    status: ProcessVerificationStatus,
    note?: string,
  ): Observable<ProcessItem> {
    return this.http.patch<ProcessItem>(`${this.apiUrl}/${processId}/verification-status`, {
      status,
      ...(note?.trim() ? { note: note.trim() } : {}),
    });
  }

  searchClients(search = '', limit = 50): Observable<ProcessClientOption[]> {
    const params = new URLSearchParams({
      search: search.trim(),
      limit: String(limit),
    });
    return this.http.get<ProcessClientOption[]>(`${this.apiUrl}/clients?${params.toString()}`);
  }

  getStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/stats`);
  }

  getStatsByCreator(): Observable<CreatorStatsResponse> {
    return this.http.get<CreatorStatsResponse>(`${this.apiUrl}/stats/creator`);
  }

  getTechnicianWorkStats(): Observable<TechnicianWorkStatsResponse> {
    return this.http.get<TechnicianWorkStatsResponse>(`${this.apiUrl}/stats/technician-work`);
  }
}
