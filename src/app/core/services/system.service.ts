import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SystemSettings {
  _id?: string;
  logo?: string;
  company_name: string;
  phone?: string;
  contacts: Array<{
    id: string;
    name: string;
    description: string;
    value: string;
    icon: string;
    type: string;
  }>;
  downloads: Array<{
    id: string;
    name: string;
    description: string;
    value: string;
    icon: string;
    type: string;
  }>;
  sim_api1: {
    name: string;
    url: string;
    key: string;
  };
  sim_api2: {
    name: string;
    url: string;
    key: string;
  };
  map_api1: {
    name: string;
    url: string;
    key: string;
  };
  map_api2: {
    name: string;
    url: string;
    key: string;
  };
  created_at?: Date;
  updated_at?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class SystemService {
  private readonly apiUrl = `${environment.apiUrl}/systems`;

  constructor(private http: HttpClient) {}

  /**
   * Obtener todas las configuraciones del sistema
   */
  getAll(): Observable<SystemSettings[]> {
    return this.http.get<SystemSettings[]>(this.apiUrl);
  }

  /**
   * Obtener configuración por ID
   */
  getById(id: string): Observable<SystemSettings> {
    return this.http.get<SystemSettings>(`${this.apiUrl}/${id}`);
  }

  /**
   * Crear nueva configuración del sistema
   */
  create(system: SystemSettings): Observable<SystemSettings> {
    return this.http.post<SystemSettings>(this.apiUrl, system);
  }

  /**
   * Actualizar configuración existente
   */
  update(id: string, system: SystemSettings): Observable<SystemSettings> {
    return this.http.patch<SystemSettings>(`${this.apiUrl}/${id}`, system);
  }

  /**
   * Eliminar configuración
   */
  delete(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  /**
   * Subir logo
   */
  uploadLogo(file: File): Observable<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.http.post<{ url: string }>(`${this.apiUrl}/upload-logo`, formData);
  }
} 