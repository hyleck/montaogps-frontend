import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface InventoryItem {
  _id?: string;
  // Frontend fields (lowercase)
  imei?: string;
  sim?: string;
  protocol?: string | any; // Can be string ID or Protocol object
  // Backend fields (uppercase/capitalized)
  IMEI?: string;
  SIM?: string;
  Protocol?: string | any; // Can be string ID or Protocol object
  package?: string | any; // Reference to the package (can be string ID or Package object)
  packageId?: string; // For frontend convenience, maps to 'package'
  user?: string; // Added field
  storage_id?: string | null; // Added field for warehouse
  storageDate?: string; // Date when warehouse was assigned
  createdAt?: string;
  updatedAt?: string;
  installed?: boolean;
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
}

export interface Warehouse {
  _id?: string;
  name: string;
  description?: string;
  min_quantity?: number;
  stock?: number;
  simcard_stock?: number;
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
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly apiUrl = `${environment.apiUrl}/inventory`;
  private readonly packagesUrl = `${environment.apiUrl}/inventory/packages`;
  private readonly warehouseUrl = `${environment.apiUrl}/inventory/warehouses`;
  private readonly simcardsUrl = `${environment.apiUrl}/inventory/simcards`;
  private readonly conducesUrl = `${environment.apiUrl}/inventory/conduces`;

  public lowStockCount$ = new BehaviorSubject<number>(0);
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

  update(id: string, item: Partial<InventoryItem>): Observable<InventoryItem> {
    return this.http.patch<InventoryItem>(`${this.apiUrl}/${id}`, item);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
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
  searchAllDevices(query: string, storageId?: string, page = 1, limit = 20, status?: string): Observable<{ data: InventoryItem[]; total: number; page: number; lastPage: number }> {
    let url = `${this.apiUrl}/search/global?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`;
    if (storageId) {
      url += `&storage_id=${storageId}`;
    }
    if (status) {
      url += `&status=${status}`;
    }
    return this.http.get<{ data: InventoryItem[]; total: number; page: number; lastPage: number }>(url);
  }

  searchDevicesByPackage(packageId: string, query: string, storageId?: string, page = 1, limit = 20, status?: string): Observable<{ data: InventoryItem[]; total: number; page: number; lastPage: number }> {
    let url = `${this.packagesUrl}/${packageId}/devices/search/${encodeURIComponent(query)}?page=${page}&limit=${limit}`;
    if (storageId) {
      url += `&storage_id=${storageId}`;
    }
    if (status) {
      url += `&status=${status}`;
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

  // Conduce methods
  getConduces(page = 1, limit = 20): Observable<{ data: Conduce[]; total: number; page: number; lastPage: number }> {
    return this.http.get<{ data: Conduce[]; total: number; page: number; lastPage: number }>(`${this.conducesUrl}?page=${page}&limit=${limit}`);
  }

  createConduce(payload: any): Observable<Conduce> {
    return this.http.post<Conduce>(this.conducesUrl, payload);
  }
}

