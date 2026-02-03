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
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly apiUrl = `${environment.apiUrl}/inventory`;
  private readonly packagesUrl = `${environment.apiUrl}/inventory/packages`;
  private readonly warehouseUrl = `${environment.apiUrl}/inventory/warehouses`;

  public lowStockCount$ = new BehaviorSubject<number>(0);

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
}

