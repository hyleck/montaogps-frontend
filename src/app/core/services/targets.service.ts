import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { lastValueFrom, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { CreateTargetDto, Target, UpdateTargetDto } from '../interfaces/target.interface';

@Injectable({
  providedIn: 'root'
})
export class TargetsService {
  private apiUrl = environment.apiUrl + '/devices';

  constructor(private http: HttpClient) { }

  /**
   * Obtiene todos los objetivos
   * @returns Promise con la lista de objetivos
   */
  async getAllTargets(): Promise<Target[]> {
    const observable = this.http.get<Target[]>(this.apiUrl);
    return await lastValueFrom(observable);
  }

  /**
   * Obtiene un objetivo por su ID
   * @param id ID del objetivo
   * @returns Promise con el objetivo
   */
  async getTargetById(id: string): Promise<Target> {
    const observable = this.http.get<Target>(`${this.apiUrl}/${id}`);
    return await lastValueFrom(observable);
  }

  /**
   * Crea un nuevo objetivo
   * @param targetData Datos del objetivo a crear
   * @returns Promise con el objetivo creado
   */
  async createTarget(targetData: CreateTargetDto): Promise<Target> {
    console.log('Enviando datos al servidor:', targetData);
    const observable = this.http.post<Target>(this.apiUrl, targetData);
    return await lastValueFrom(observable);
  }

  /**
   * Actualiza un objetivo existente
   * @param id ID del objetivo a actualizar
   * @param targetData Datos a actualizar
   * @returns Promise con el objetivo actualizado
   */
  async updateTarget(id: string, targetData: UpdateTargetDto): Promise<Target> {
    console.log('Actualizando datos en el servidor:', targetData);
    const observable = this.http.patch<Target>(`${this.apiUrl}/${id}`, targetData);
    return await lastValueFrom(observable);
  }

  /**
   * Elimina un objetivo
   * @param id ID del objetivo a eliminar
   * @returns Promise con la respuesta del servidor
   */
  async deleteTarget(id: string): Promise<any> {
    const observable = this.http.delete(`${this.apiUrl}/${id}`);
    return await lastValueFrom(observable);
  }

  /**
   * Busca objetivos por un criterio
   * @param query Criterio de búsqueda
   * @returns Promise con los objetivos encontrados
   */
  async searchTargets(query: string): Promise<Target[]> {
    const observable = this.http.get<Target[]>(`${this.apiUrl}?search=${query}`);
    return await lastValueFrom(observable);
  }

  /**
   * Obtiene objetivos por ID de usuario
   * @param userId ID del usuario
   * @returns Promise con los objetivos del usuario
   */
  async getTargetsByUserId(userId: string): Promise<Target[]> {
    const observable = this.http.get<Target[]>(`${this.apiUrl}?user_id=${userId}`);
    return await lastValueFrom(observable);
  }

  /**
   * Obtiene objetivos por estado
   * @param status Estado de los objetivos ('active' o 'inactive')
   * @returns Promise con los objetivos en el estado especificado
   */
  async getTargetsByStatus(status: 'active' | 'inactive'): Promise<Target[]> {
    const observable = this.http.get<Target[]>(`${this.apiUrl}?status=${status}`);
    return await lastValueFrom(observable);
  }
} 