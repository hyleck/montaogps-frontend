import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface InventoryAuditUser {
  _id?: string;
  name?: string;
  last_name?: string;
  email?: string;
}

export interface InventoryItem {
  _id?: string;
  // Frontend fields (lowercase)
  imei?: string;
  sim?: string;
  protocol?: string | any; // Can be string ID or Protocol object
  // Backend fields (uppercase/capitalized)
  IMEI?: string;
  SIM?: string;
  IDSIM?: string;
  idsim?: string;
  sim_company?: string;
  Protocol?: string | any; // Can be string ID or Protocol object
  package?: string | any; // Reference to the package (can be string ID or Package object)
  packageId?: string; // For frontend convenience, maps to 'package'
  user?: string; // Added field
  storage_id?: string | any | null; // Added field for warehouse
  storageDate?: string; // Date when warehouse was assigned
  createdAt?: string;
  updatedAt?: string;
  created_by?: InventoryAuditUser | string;
  updated_by?: InventoryAuditUser | string;
  installed?: boolean;
  activation_mode?: boolean;
  inventory_status?: 'available' | 'reserved' | 'installed' | 'inspection';
  status_source?: 'none' | 'client_reservation' | 'active_installation' | 'incomplete_installation' | 'completed_installation' | 'office_installation' | 'legacy_device_assignment' | 'inspection';
  status_synced_at?: string;
  installed_at?: string;
  installation_process_id?: string;
  device_id?: string;
  mechanic_id?: string;
  device_parent_id?: string;
  inspection_required?: boolean;
  inspection_reason?: string;
  inspection_requested_at?: string;
  inspection_requested_by?: string;
  inspection_solicitud_id?: string;
  inspection_released_at?: string;
  inspection_released_by?: string;
  reservation_client_id?: string;
  reservation_client_name?: string;
  reservation_by?: string;
  reservation_at?: string;
  reservation_intent?: 'reserve' | 'install' | 'review';
}

export interface InventoryDeviceAssignmentResponse {
  device: any;
  inventory: InventoryItem;
  reused: boolean;
}

export interface InspectionRequiredResponse {
  data: InventoryItem[];
  total: number;
  page: number;
  lastPage: number;
}

export interface Package {
  _id?: string;
  title: string;
  date: string;
  price: number;
  description?: string;
  devices?: InventoryItem[];
  createdAt?: string;
  updatedAt?: string;
  created_by?: InventoryAuditUser | string;
  updated_by?: InventoryAuditUser | string;
}

export interface Warehouse {
  _id?: string;
  name: string;
  description?: string;
  min_quantity?: number;
  assigned_user?: string;
  access_users?: string[];
  stock?: number;
  simcard_stock?: number;
  createdAt?: string;
  updatedAt?: string;
  created_by?: InventoryAuditUser | string;
  updated_by?: InventoryAuditUser | string;
}

export interface SimcardItem {
  _id?: string;
  iccid: string;
  sim_company?: string;
  apn_name?: string;
  idsim?: string;
  storage_id?: string | any | null;
  storageDate?: string;
  installed?: boolean;
  device_imei?: string;
  package?: string | any;
  packageId?: string;
  createdAt?: string;
  updatedAt?: string;
  created_by?: InventoryAuditUser | string;
  updated_by?: InventoryAuditUser | string;
}

export interface Conduce {
  _id?: string;
  conduceNumber?: string;
  description?: string;
  destination_warehouse: string | any;
  devices?: string[] | any[];
  simcards?: string[] | any[];
  status?: string;
  created_by?: string | any;
  updated_by?: string | any;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly apiUrl = `${environment.apiUrl}/inventory`;
  private readonly packagesUrl = `${environment.apiUrl}/inventory/packages`;
  private readonly warehouseUrl = `${environment.apiUrl}/inventory/warehouses`;
  private readonly simcardsUrl = `${environment.apiUrl}/inventory/simcards`;
  private readonly conducesUrl = `${environment.apiUrl}/inventory/conduces`;

  public lowStockCount$ = new BehaviorSubject<number>(0);
  public inspectionRequiredCount$ = new BehaviorSubject<number>(0);
  public warehouses$ = new BehaviorSubject<Warehouse[]>([]);

  constructor(private http: HttpClient) { }

  // Device/Item methods
  create(item: InventoryItem): Observable<InventoryItem> {
    return this.http.post<InventoryItem>(this.apiUrl, item);
  }

  findAll(): Observable<InventoryItem[]> {
    return this.http.get<InventoryItem[]>(this.apiUrl);
  }

  findOne(id: string): Observable<InventoryItem> {
    return this.http.get<InventoryItem>(`${this.apiUrl}/${id}`);
  }

  getInspectionRequired(query = '', page = 1, limit = 30): Observable<InspectionRequiredResponse> {
    const normalizedQuery = String(query || '').trim();
    const url = `${this.apiUrl}/inspection/required?q=${encodeURIComponent(normalizedQuery)}&page=${page}&limit=${limit}`;
    return this.http.get<InspectionRequiredResponse>(url).pipe(
      tap(response => {
        if (!normalizedQuery) {
          this.inspectionRequiredCount$.next(Number(response?.total || 0));
        }
      }),
    );
  }

  releaseInspection(
    id: string,
    options: { cancelOfficeTarget?: boolean } = {},
  ): Observable<InventoryItem> {
    return this.http.patch<InventoryItem>(
      `${this.apiUrl}/inspection/${encodeURIComponent(id)}/release`,
      options,
    );
  }

  checkInspectionRequired(): void {
    this.getInspectionRequired('', 1, 1).subscribe({
      error: () => this.inspectionRequiredCount$.next(0),
    });
  }

  update(id: string, item: Partial<InventoryItem>): Observable<InventoryItem> {
    return this.http.patch<InventoryItem>(`${this.apiUrl}/${id}`, item);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  assignDeviceToClient(
    inventoryId: string,
    data: {
      clientId?: string;
      intent: 'reserve' | 'install' | 'review';
      expirationDate: string;
      targetName?: string;
    },
  ): Observable<InventoryDeviceAssignmentResponse> {
    return this.http.post<InventoryDeviceAssignmentResponse>(
      `${this.apiUrl}/${encodeURIComponent(inventoryId)}/assign`,
      data,
    );
  }

  // Package methods
  createPackage(packageData: Package): Observable<Package> {
    return this.http.post<Package>(this.packagesUrl, packageData);
  }

  findAllPackages(): Observable<Package[]> {
    return this.http.get<Package[]>(this.packagesUrl);
  }

  findOnePackage(id: string): Observable<Package> {
    return this.http.get<Package>(`${this.packagesUrl}/${id}`);
  }

  updatePackage(id: string, packageData: Partial<Package>): Observable<Package> {
    return this.http.patch<Package>(`${this.packagesUrl}/${id}`, packageData);
  }

  deletePackage(id: string): Observable<void> {
    return this.http.delete<void>(`${this.packagesUrl}/${id}`);
  }

  // Get devices by package
  getDevicesByPackage(packageId: string, page = 1, limit = 20): Observable<{ data: InventoryItem[]; total: number; page: number; lastPage: number }> {
    const url = `${this.packagesUrl}/${packageId}/devices?page=${page}&limit=${limit}`;
    return this.http.get<{ data: InventoryItem[]; total: number; page: number; lastPage: number }>(url);
  }

  // Search methods
  searchAllDevices(query: string, storageId?: string, page = 1, limit = 20, status?: string, userId?: string): Observable<{ data: InventoryItem[]; total: number; page: number; lastPage: number }> {
    let url = `${this.apiUrl}/search/global?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`;
    if (storageId) {
      url += `&storage_id=${storageId}`;
    }
    if (status) {
      url += `&status=${status}`;
    }
    if (userId) {
      url += `&user_id=${userId}`;
    }
    return this.http.get<{ data: InventoryItem[]; total: number; page: number; lastPage: number }>(url);
  }

  searchInstallationDevices(
    query = '',
    deviceType: 'all' | 'gps' | 'mtag_p' | 'mtag_a' = 'all',
    status: 'available' | 'all' = 'available',
    page = 1,
    limit = 50,
  ): Observable<{ data: InventoryItem[]; total: number; page: number; lastPage: number }> {
    const url = `${this.apiUrl}/installation/devices?q=${encodeURIComponent(query)}&device_type=${deviceType}&status=${status}&page=${page}&limit=${limit}`;
    return this.http.get<{ data: InventoryItem[]; total: number; page: number; lastPage: number }>(url);
  }

  searchDevicesByPackage(packageId: string, query: string, storageId?: string, page = 1, limit = 20, status?: string, protocolId?: string): Observable<{ data: InventoryItem[]; total: number; page: number; lastPage: number }> {
    let url = `${this.packagesUrl}/${packageId}/devices/search/${encodeURIComponent(query)}?page=${page}&limit=${limit}`;
    if (storageId) {
      url += `&storage_id=${storageId}`;
    }
    if (status) {
      url += `&status=${status}`;
    }
    if (protocolId) {
      url += `&protocol_id=${encodeURIComponent(protocolId)}`;
    }
    return this.http.get<{ data: InventoryItem[]; total: number; page: number; lastPage: number }>(url);
  }

  // Warehouse methods
  getWarehouses(): Observable<Warehouse[]> {
    return this.http.get<Warehouse[]>(this.warehouseUrl).pipe(
      tap(warehouses => {
        if (warehouses) {
          const count = warehouses.filter(w => (w.stock || 0) < (w.min_quantity || 0)).length;
          this.lowStockCount$.next(count);
          this.warehouses$.next(warehouses);
        }
      })
    );
  }

  checkLowStock(): void {
    this.getWarehouses().subscribe();
  }

  createWarehouse(warehouse: Warehouse): Observable<Warehouse> {
    return this.http.post<Warehouse>(this.warehouseUrl, warehouse);
  }

  updateWarehouse(id: string, warehouse: Warehouse): Observable<Warehouse> {
    return this.http.patch<Warehouse>(`${this.warehouseUrl}/${id}`, warehouse);
  }

  deleteWarehouse(id: string): Observable<any> {
    return this.http.delete(`${this.warehouseUrl}/${id}`);
  }

  findSimcardByIccid(iccid: string): Observable<SimcardItem | null> {
    return this.http.get<SimcardItem | null>(`${this.simcardsUrl}/lookup/iccid/${iccid}`);
  }

  // Simcard methods
  createSimcard(simcard: SimcardItem): Observable<SimcardItem> {
    return this.http.post<SimcardItem>(this.simcardsUrl, simcard);
  }

  findAllSimcards(): Observable<SimcardItem[]> {
    return this.http.get<SimcardItem[]>(this.simcardsUrl);
  }

  findOneSimcard(id: string): Observable<SimcardItem> {
    return this.http.get<SimcardItem>(`${this.simcardsUrl}/${id}`);
  }

  updateSimcard(id: string, simcard: Partial<SimcardItem>): Observable<SimcardItem> {
    return this.http.patch<SimcardItem>(`${this.simcardsUrl}/${id}`, simcard);
  }

  deleteSimcard(id: string): Observable<void> {
    return this.http.delete<void>(`${this.simcardsUrl}/${id}`);
  }

  searchAllSimcards(query: string, storageId?: string, page = 1, limit = 20, status?: string, simCompany?: string): Observable<{ data: SimcardItem[]; total: number; page: number; lastPage: number }> {
    let url = `${this.simcardsUrl}/search/global?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`;
    if (storageId) {
      url += `&storage_id=${storageId}`;
    }
    if (status) {
      url += `&status=${status}`;
    }
    if (simCompany) {
      url += `&sim_company=${encodeURIComponent(simCompany)}`;
    }
    return this.http.get<{ data: SimcardItem[]; total: number; page: number; lastPage: number }>(url);
  }

  searchInstallationSimcards(
    query = '',
    page = 1,
    limit = 100,
  ): Observable<{ data: SimcardItem[]; total: number; page: number; lastPage: number }> {
    const url = `${this.apiUrl}/installation/simcards?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`;
    return this.http.get<{ data: SimcardItem[]; total: number; page: number; lastPage: number }>(url);
  }

  // Conduce methods
  getConduces(page = 1, limit = 20): Observable<{ data: Conduce[]; total: number; page: number; lastPage: number }> {
    return this.http.get<{ data: Conduce[]; total: number; page: number; lastPage: number }>(`${this.conducesUrl}?page=${page}&limit=${limit}`);
  }

  createConduce(payload: any): Observable<Conduce> {
    return this.http.post<Conduce>(this.conducesUrl, payload);
  }
}
