import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly apiUrl = `${environment.apiUrl}/inventory`;
  private readonly packagesUrl = `${environment.apiUrl}/inventory/packages`;
  private readonly warehouseUrl = `${environment.apiUrl}/inventory/warehouses`;

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
  getDevicesByPackage(packageId: string): Observable<InventoryItem[]> {
    const url = `${this.packagesUrl}/${packageId}/devices`;
    console.log('getDevicesByPackage - URL:', url);
    console.log('getDevicesByPackage - Package ID:', packageId);

    return this.http.get<InventoryItem[]>(url);
  }

  // Search methods
  searchAllDevices(query: string): Observable<InventoryItem[]> {
    const url = `${this.apiUrl}/search/all/${encodeURIComponent(query)}`;
    return this.http.get<InventoryItem[]>(url);
  }

  searchDevicesByPackage(packageId: string, query: string, storageId?: string): Observable<InventoryItem[]> {
    let url = `${this.packagesUrl}/${packageId}/devices/search/${encodeURIComponent(query)}`;
    if (storageId) {
      url += `?storage_id=${storageId}`;
    }
    return this.http.get<InventoryItem[]>(url);
  }

  // Warehouse methods
  getWarehouses(): Observable<Warehouse[]> {
    return this.http.get<Warehouse[]>(this.warehouseUrl);
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

