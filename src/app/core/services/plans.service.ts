import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Plan, CreatePlanDto, UpdatePlanDto } from '../interfaces/plan.interface';

@Injectable({
  providedIn: 'root'
})
export class PlansService {
  private apiUrl = `${environment.apiUrl}/plans`;

  constructor(private http: HttpClient) {}

  /**
   * Obtiene todos los planes
   * @returns Observable con la lista de planes
   */
  getAllPlans(): Observable<Plan[]> {
    return this.http.get<Plan[]>(this.apiUrl);
  }

  /**
   * Obtiene un plan por su ID
   * @param id ID del plan
   * @returns Observable con el plan solicitado
   */
  getPlanById(id: string): Observable<Plan> {
    return this.http.get<Plan>(`${this.apiUrl}/${id}`);
  }

  /**
   * Obtiene todos los planes de un servidor específico
   * @param serverId ID del servidor
   * @returns Observable con la lista de planes del servidor
   */
  getPlansByServerId(serverId: string): Observable<Plan[]> {
    return this.http.get<Plan[]>(`${this.apiUrl}/server/${serverId}`);
  }

  /**
   * Crea un nuevo plan
   * @param createPlanDto Datos del plan a crear
   * @returns Observable con el plan creado
   */
  createPlan(createPlanDto: CreatePlanDto): Observable<Plan> {
    return this.http.post<Plan>(this.apiUrl, createPlanDto);
  }

  /**
   * Actualiza un plan existente
   * @param id ID del plan a actualizar
   * @param updatePlanDto Datos para actualizar el plan
   * @returns Observable con el plan actualizado
   */
  updatePlan(id: string, updatePlanDto: UpdatePlanDto): Observable<Plan> {
    return this.http.patch<Plan>(`${this.apiUrl}/${id}`, updatePlanDto);
  }

  /**
   * Elimina un plan
   * @param id ID del plan a eliminar
   * @returns Observable con la respuesta del servidor
   */
  deletePlan(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
} 