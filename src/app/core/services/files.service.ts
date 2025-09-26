import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';

// Interfaces for file operations
export interface FileData {
  _id?: string;
  name: string;
  description?: string;
  file_size: number;
  mimetype?: string;
  key?: string;
  location?: string;
  location_cdn?: string;
  folder_id?: string;
  refs?: string;
  owner: string;
  creator: string;
  modifier?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateFileDto {
  name: string;
  description?: string;
  file_size: number;
  mimetype?: string;
  folder_id?: string;
  refs?: string;
  owner: string;
  creator: string;
}

export interface UpdateFileDto {
  name?: string;
  description?: string;
  folder_id?: string;
  modifier: string;
}

export interface FilesResponse {
  files: FileData[];
  totalCount?: number;
}

@Injectable({
  providedIn: 'root'
})
export class FilesService {
  private apiUrl = environment.apiUrl + '/files';

  constructor(private http: HttpClient) { }

  async getAllFiles(owner?: string, limit?: number): Promise<FileData[]> {
    let params: any = {};
    if (owner) params.owner = owner;
    if (limit) params.limit = limit;

    const observable = this.http.get<FileData[]>(this.apiUrl, { params });
    return await lastValueFrom(observable);
  }

  async getFileById(id: string): Promise<FileData> {
    const observable = this.http.get<FileData>(`${this.apiUrl}/${id}`);
    return await lastValueFrom(observable);
  }

  async searchFiles(query: string, owner?: string, folder?: string, limit?: number): Promise<FileData[]> {
    let params: any = { q: query };
    if (owner) params.owner = owner;
    if (folder) params.f = folder;
    if (limit) params.limit = limit;

    const observable = this.http.get<FileData[]>(`${this.apiUrl}/provide/search`, { params });
    return await lastValueFrom(observable);
  }

  async getFilesInFolder(owner: string, folderId: string, limit?: number): Promise<FileData[]> {
    let params: any = { owner, f: folderId };
    if (limit) params.limit = limit;

    const observable = this.http.get<FileData[]>(`${this.apiUrl}/provide/inside`, { params });
    return await lastValueFrom(observable);
  }

  async searchFilesInFolder(owner: string, query: string, limit?: number): Promise<FileData[]> {
    let params: any = { owner, q: query };
    if (limit) params.limit = limit;

    const observable = this.http.get<FileData[]>(`${this.apiUrl}/provide/inside/search`, { params });
    return await lastValueFrom(observable);
  }

  async uploadFile(formData: FormData): Promise<any> {
    const observable = this.http.post(this.apiUrl, formData);
    return await lastValueFrom(observable);
  }

  async updateFile(id: string, updateData: UpdateFileDto): Promise<FileData> {
    const observable = this.http.put<FileData>(`${this.apiUrl}/${id}`, updateData);
    return await lastValueFrom(observable);
  }

  async deleteFile(id: string): Promise<any> {
    const observable = this.http.delete(`${this.apiUrl}/${id}`);
    return await lastValueFrom(observable);
  }

  async getTotalSize(owner: string): Promise<{ totalSize: number }> {
    const observable = this.http.get<{ totalSize: number }>(`${this.apiUrl}/get/total-size?owner=${owner}`);
    return await lastValueFrom(observable);
  }
}