import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class VehicleBrandsService {
  private backend = environment.montaoApiUrl;

  constructor(private http: HttpClient) { }

  async getAllTypes(): Promise<any> {
    // const headers = this.loginService.getHeaders();
    const observable = this.http.get(`${this.backend}/api/types`);
    return await lastValueFrom(observable);
  }

  async getAllBrands(): Promise<any> {
    // const headers = this.loginService.getHeaders();
    const observable = this.http.get(`${this.backend}/api/brands`);
    return await lastValueFrom(observable);
  }

  async createBrand(data: any): Promise<any> {
    // const headers = this.loginService.getHeaders();
    const observable = this.http.post(`${this.backend}/api/brands`, data);
    return await lastValueFrom(observable);
  }

  async updateBrand(id: string, data: any): Promise<any> {
    // const headers = this.loginService.getHeaders(); // Si usas autenticación, descomentar
    const observable = this.http.patch(`${this.backend}/api/brands/${id}`, data);
    return await lastValueFrom(observable);
  }

  async deleteBrand(id: string): Promise<any> {
    // const headers = this.loginService.getHeaders(); // Si usas autenticación, descomentar
    const observable = this.http.delete(`${this.backend}/api/brands/${id}`);
    return await lastValueFrom(observable);
  }

  async getAllModelsByBrand(brand: string): Promise<any> {
    // const headers = this.loginService.getHeaders();
    const observable = this.http.get(`${this.backend}/api/models/${brand}/`);
    return await lastValueFrom(observable);
  }

  // Crear un nuevo modelo
  async createModel(data: any): Promise<any> {
    // const headers = this.loginService.getHeaders();
    const observable = this.http.post(`${this.backend}/api/models`, data);
    return await lastValueFrom(observable);
  }

  // Actualizar un modelo existente
  async updateModel(id: string, data: any): Promise<any> {
    // const headers = this.loginService.getHeaders();
    const observable = this.http.patch(`${this.backend}/api/models/${id}`, data);
    return await lastValueFrom(observable);
  }

  // Eliminar un modelo por ID
  async deleteModel(id: string): Promise<any> {
    // const headers = this.loginService.getHeaders();
    const observable = this.http.delete(`${this.backend}/api/models/${id}`);
    return await lastValueFrom(observable);
  }
} 