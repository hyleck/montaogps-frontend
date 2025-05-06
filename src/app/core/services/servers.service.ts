import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Server, CreateServerDto, UpdateServerDto } from '../interfaces/server.interface';

@Injectable({
  providedIn: 'root'
})
export class ServersService {
  private apiUrl = `${environment.apiUrl}/servers`;

  constructor(private http: HttpClient) {}

  /**
   * Obtiene todos los servidores
   * @returns Observable con la lista de servidores
   */
  getAllServers(): Observable<Server[]> {
    return this.http.get<Server[]>(this.apiUrl);
  }

  /**
   * Obtiene un servidor por su ID
   * @param id ID del servidor
   * @returns Observable con el servidor solicitado
   */
  getServerById(id: string): Observable<Server> {
    return this.http.get<Server>(`${this.apiUrl}/${id}`);
  }

  /**
   * Crea un nuevo servidor
   * @param createServerDto Datos del servidor a crear
   * @returns Observable con el servidor creado
   */
  createServer(createServerDto: CreateServerDto): Observable<Server> {
    return this.http.post<Server>(this.apiUrl, createServerDto);
  }

  /**
   * Actualiza un servidor existente
   * @param id ID del servidor a actualizar
   * @param updateServerDto Datos para actualizar el servidor
   * @returns Observable con el servidor actualizado
   */
  updateServer(id: string, updateServerDto: UpdateServerDto): Observable<Server> {
    return this.http.patch<Server>(`${this.apiUrl}/${id}`, updateServerDto);
  }

  /**
   * Elimina un servidor
   * @param id ID del servidor a eliminar
   * @returns Observable con la respuesta del servidor
   */
  deleteServer(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
} 