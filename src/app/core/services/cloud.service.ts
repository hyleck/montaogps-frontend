import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CloudFile {
  _id: string;
  name: string;
  description?: string;
  key: string;
  location: string;
  location_cdn: string;
  mimetype: string;
  file_size: number;
  owner: string;
  folder_id?: string;
  refs?: string;
  status?: boolean;
  delete?: boolean;
  private?: boolean;
  bucket?: string;
  etag?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CloudFolder {
  _id: string;
  name: string;
  parentId?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFolderDto {
  name: string;
  parentId?: string;
}

export interface UpdateFolderDto {
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class CloudService {
  private apiUrl = `${environment.apiUrl}/cloud`;

  constructor(private http: HttpClient) {}

  // File operations
  uploadFile(file: File, owner: string, isPrivate: boolean = false): Observable<HttpEvent<any>> {
    const formData = new FormData();
    formData.append('files', file);
    formData.append('owner', owner);
    formData.append('private', isPrivate.toString());

    const req = new HttpRequest('POST', `${this.apiUrl}/upload`, formData, {
      reportProgress: true,
      responseType: 'json'
    });

    return this.http.request(req);
  }

  getFiles(folderId?: string): Observable<CloudFile[]> {
    const params: any = {};
    if (folderId) {
      params.folder_id = folderId;
    }
    return this.http.get<CloudFile[]>(`${this.apiUrl}`, { params });
  }

  downloadFile(fileId: string): Observable<CloudFile> {
    return this.http.get<CloudFile>(`${this.apiUrl}/${fileId}`);
  }

  deleteFile(fileId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${fileId}`);
  }

  // Folder operations
  createFolder(createFolderDto: CreateFolderDto): Observable<CloudFolder> {
    return this.http.post<CloudFolder>(`${this.apiUrl}/folders`, createFolderDto);
  }

  getFolders(parentId?: string): Observable<CloudFolder[]> {
    const params: any = {};
    if (parentId) {
      params.parentId = parentId;
    }
    return this.http.get<CloudFolder[]>(`${this.apiUrl}/folders`, { params });
  }

  updateFolder(folderId: string, updateFolderDto: UpdateFolderDto): Observable<CloudFolder> {
    return this.http.patch<CloudFolder>(`${this.apiUrl}/folders/${folderId}`, updateFolderDto);
  }

  deleteFolder(folderId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/folders/${folderId}`);
  }

  // Combined operations for UI
  getFolderContents(owner: string): Observable<{ files: CloudFile[], folders: CloudFolder[] }> {
    const params: any = { owner };
    return this.http.get<{ files: CloudFile[], folders: CloudFolder[] }>(`${this.apiUrl}/contents`, { params });
  }

  getStorageStats(owner: string): Observable<{ totalSize: number; fileCount: number }> {
    return this.http.get<{ totalSize: number; fileCount: number }>(`${this.apiUrl}/stats/size`, {
      params: { owner }
    });
  }
}