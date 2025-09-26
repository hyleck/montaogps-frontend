import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';

// Interfaces for folder operations
export interface FolderData {
  _id?: string;
  name: string;
  description?: string;
  folder_size?: number;
  folder_id?: string;
  refs?: string;
  owner: string;
  creator: string;
  modifier?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateFolderDto {
  name: string;
  description?: string;
  folder_size?: number;
  folder_id?: string;
  refs?: string;
  owner: string;
  creator: string;
}

export interface UpdateFolderDto {
  name?: string;
  description?: string;
  folder_id?: string;
  modifier: string;
}

export interface FoldersResponse {
  folders: FolderData[];
  totalCount?: number;
}

@Injectable({
  providedIn: 'root'
})
export class FoldersService {
  private apiUrl = environment.apiUrl + '/folders';

  constructor(private http: HttpClient) { }

  async getAllFolders(owner?: string, limit?: number): Promise<FolderData[]> {
    let params: any = {};
    if (owner) params.owner = owner;
    if (limit) params.limit = limit;

    const observable = this.http.get<FolderData[]>(this.apiUrl, { params });
    return await lastValueFrom(observable);
  }

  async getFolderById(id: string): Promise<FolderData> {
    const observable = this.http.get<FolderData>(`${this.apiUrl}/${id}`);
    return await lastValueFrom(observable);
  }

  async searchFolders(query: string, owner?: string, limit?: number): Promise<FolderData[]> {
    let params: any = { q: query };
    if (owner) params.owner = owner;
    if (limit) params.limit = limit;

    const observable = this.http.get<FolderData[]>(`${this.apiUrl}/provide/search`, { params });
    return await lastValueFrom(observable);
  }

  async getFoldersInside(parentFolderId: string, limit?: number): Promise<FolderData[]> {
    let params: any = { f: parentFolderId };
    if (limit) params.limit = limit;

    const observable = this.http.get<FolderData[]>(`${this.apiUrl}/provide/inside`, { params });
    return await lastValueFrom(observable);
  }

  async searchFoldersInside(owner: string, refs: string, query: string, limit?: number): Promise<FolderData[]> {
    let params: any = { owner, refs, q: query };
    if (limit) params.limit = limit;

    const observable = this.http.get<FolderData[]>(`${this.apiUrl}/provide/inside/search`, { params });
    return await lastValueFrom(observable);
  }

  async createFolder(folderData: CreateFolderDto): Promise<FolderData> {
    const observable = this.http.post<FolderData>(this.apiUrl, folderData);
    return await lastValueFrom(observable);
  }

  async updateFolder(id: string, updateData: UpdateFolderDto): Promise<FolderData> {
    const observable = this.http.put<FolderData>(`${this.apiUrl}/${id}`, updateData);
    return await lastValueFrom(observable);
  }

  async deleteFolder(id: string): Promise<any> {
    const observable = this.http.delete(`${this.apiUrl}/${id}`);
    return await lastValueFrom(observable);
  }
}