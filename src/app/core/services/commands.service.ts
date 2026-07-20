import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Command {
  _id?: string;
  name: string;
  description?: string;
  observation: string;
  deviceId: string;
  creator: string | {
    _id: string;
    name: string;
    last_name: string;
    email: string;
  };
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCommandDto {
  name: string;
  description?: string;
  observation: string;
  targetId: string;
  creator: string;
}

@Injectable({
  providedIn: 'root'
})
export class CommandsService {
  private apiUrl = `${environment.apiUrl}/commands`;

  constructor(private http: HttpClient) { }

  async createCommand(commandData: CreateCommandDto): Promise<Command> {
    const observable = this.http.post<Command>(this.apiUrl, commandData);
    return await lastValueFrom(observable);
  }

  async getCommandsByDevice(deviceId: string): Promise<Command[]> {
    const observable = this.http.get<Command[]>(`${this.apiUrl}/target/${deviceId}`);
    return await lastValueFrom(observable);
  }

  async getCommandById(id: string): Promise<Command> {
    const observable = this.http.get<Command>(`${this.apiUrl}/${id}`);
    return await lastValueFrom(observable);
  }

  async updateCommand(id: string, commandData: Partial<CreateCommandDto>): Promise<Command> {
    const observable = this.http.patch<Command>(`${this.apiUrl}/${id}`, commandData);
    return await lastValueFrom(observable);
  }

  async deleteCommand(id: string): Promise<void> {
    const observable = this.http.delete<void>(`${this.apiUrl}/${id}`);
    return await lastValueFrom(observable);
  }
}
