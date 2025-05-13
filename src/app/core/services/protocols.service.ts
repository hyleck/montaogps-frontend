import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Protocol, CreateProtocolDto, UpdateProtocolDto } from '../interfaces/protocol.interface';

@Injectable({
  providedIn: 'root'
})
export class ProtocolsService {
  private readonly apiUrl = `${environment.apiUrl}/protocols`;

  constructor(private http: HttpClient) {}

  /**
   * Obtiene todos los protocolos
   * @returns Observable con la lista de protocolos
   */
  getAllProtocols(): Observable<Protocol[]> {
    return this.http.get<Protocol[]>(this.apiUrl);
  }

  /**
   * Obtiene un protocolo por su ID
   * @param id ID del protocolo
   * @returns Observable con el protocolo solicitado
   */
  getProtocolById(id: string): Observable<Protocol> {
    return this.http.get<Protocol>(`${this.apiUrl}/${id}`);
  }

  /**
   * Crea un nuevo protocolo
   * @param createProtocolDto Datos del protocolo a crear
   * @returns Observable con el protocolo creado
   */
  createProtocol(createProtocolDto: CreateProtocolDto): Observable<Protocol> {
    return this.http.post<Protocol>(this.apiUrl, createProtocolDto);
  }

  /**
   * Actualiza un protocolo existente
   * @param id ID del protocolo a actualizar
   * @param updateProtocolDto Datos para actualizar el protocolo
   * @returns Observable con el protocolo actualizado
   */
  updateProtocol(id: string, updateProtocolDto: UpdateProtocolDto): Observable<Protocol> {
    return this.http.patch<Protocol>(`${this.apiUrl}/${id}`, updateProtocolDto);
  }

  /**
   * Elimina un protocolo
   * @param id ID del protocolo a eliminar
   * @returns Observable con la respuesta del servidor
   */
  deleteProtocol(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
} 