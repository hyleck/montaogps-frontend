import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ColorsService {
  private backend = environment.montaoApiUrl;

  constructor(private http: HttpClient) { }

  async getAllColors(): Promise<any> {
    // const headers = this.loginService.getHeaders();
    const observable = this.http.get(`${this.backend}/api/colors`);
    return await lastValueFrom(observable);
  }

  // Crear un nuevo color
  async createColor(data: any): Promise<any> {
    // const headers = this.loginService.getHeaders(); // Si usas autenticación, puedes usar headers
    const observable = this.http.post(`${this.backend}/api/colors`, data);
    return await lastValueFrom(observable);
  }

  // Actualizar un color existente
  async updateColor(id: string, data: any): Promise<any> {
    // const headers = this.loginService.getHeaders(); // Si usas autenticación, puedes usar headers
    const observable = this.http.patch(`${this.backend}/api/colors/${id}`, data);
    return await lastValueFrom(observable);
  }

  // Eliminar un color por ID
  async deleteColor(id: string): Promise<any> {
    // const headers = this.loginService.getHeaders(); // Si usas autenticación, puedes usar headers
    const observable = this.http.delete(`${this.backend}/api/colors/${id}`);
    return await lastValueFrom(observable);
  }
} 