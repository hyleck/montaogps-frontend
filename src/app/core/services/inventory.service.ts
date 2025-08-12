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
  createdAt?: string;
  updatedAt?: string;
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

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly apiUrl = `${environment.apiUrl}/inventory`;
  private readonly packagesUrl = `${environment.apiUrl}/inventory/packages`;

  constructor(private http: HttpClient) {}

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

  searchDevicesByPackage(packageId: string, query: string): Observable<InventoryItem[]> {
    const url = `${this.packagesUrl}/${packageId}/devices/search/${encodeURIComponent(query)}`;
    return this.http.get<InventoryItem[]>(url);
  }
}


