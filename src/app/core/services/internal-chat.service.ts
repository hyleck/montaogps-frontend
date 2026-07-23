import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface InternalChatAuthor {
  _id: string;
  name: string;
  last_name?: string;
  email?: string;
  photo?: string;
  department_id?: string;
  affiliation_type_id?: string;
}

export interface InternalChatMessage {
  _id: string;
  text: string;
  type: string;
  attachments?: InternalChatAttachment[];
  createdAt: string;
  updatedAt?: string;
  author: InternalChatAuthor;
}

export interface InternalChatAttachment {
  url: string;
  name?: string;
  mimeType?: string;
  fileType?: 'image' | 'video' | 'audio' | 'file' | string;
  size?: number;
  key?: string;
  fileId?: string;
}

export interface InternalChatMessagesResponse {
  messages: InternalChatMessage[];
  total: number;
}

@Injectable({
  providedIn: 'root',
})
export class InternalChatService {
  private readonly apiUrl = `${environment.apiUrl}/internal-chat`;

  constructor(private readonly http: HttpClient) {}

  getMessages(options: { limit?: number; before?: string; after?: string } = {}): Observable<InternalChatMessagesResponse> {
    let params = new HttpParams();
    if (options.limit) params = params.set('limit', String(options.limit));
    if (options.before) params = params.set('before', options.before);
    if (options.after) params = params.set('after', options.after);

    return this.http.get<InternalChatMessagesResponse>(`${this.apiUrl}/messages`, { params });
  }

  sendMessage(text: string, attachments: InternalChatAttachment[] = [], type = 'text'): Observable<{ message: InternalChatMessage }> {
    return this.http.post<{ message: InternalChatMessage }>(`${this.apiUrl}/messages`, { text, attachments, type });
  }

  uploadAttachment(file: File): Observable<{ attachment: InternalChatAttachment }> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<{ attachment: InternalChatAttachment }>(`${this.apiUrl}/attachments`, formData);
  }

  clearMessages(): Observable<{ success: boolean; deleted: number }> {
    return this.http.delete<{ success: boolean; deleted: number }>(`${this.apiUrl}/messages`);
  }
}
