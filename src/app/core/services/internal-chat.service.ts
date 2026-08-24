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
  groupId: string;
  text: string;
  type: string;
  attachments?: InternalChatAttachment[];
  createdAt: string;
  updatedAt?: string;
  referenceConversationId?: number;
  referenceMessageId?: number;
  referenceProviderMessageId?: string;
  referenceLabel?: string;
  author: InternalChatAuthor;
}

export interface InternalChatGroup {
  id: string;
  name: string;
  type: 'admin' | 'installation';
  unreadCount?: number;
  technicianId?: string;
  technician?: {
    name: string;
    lastName: string;
    email: string;
    photo: string;
    phone: string;
    phone2: string;
  };
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
  groupId: string;
}

@Injectable({
  providedIn: 'root',
})
export class InternalChatService {
  private readonly apiUrl = `${environment.apiUrl}/internal-chat`;

  constructor(private readonly http: HttpClient) {}

  getGroups(): Observable<{
    groups: InternalChatGroup[];
    canClearMessages: boolean;
  }> {
    return this.http.get<{
      groups: InternalChatGroup[];
      canClearMessages: boolean;
    }>(
      `${this.apiUrl}/groups`,
    );
  }

  markGroupRead(groupId: string): Observable<{
    success: boolean;
    groupId: string;
    unreadCount: number;
  }> {
    return this.http.post<{
      success: boolean;
      groupId: string;
      unreadCount: number;
    }>(
      `${this.apiUrl}/groups/read`,
      { groupId },
    );
  }

  getMessages(options: { limit?: number; before?: string; after?: string; groupId?: string; allGroups?: boolean } = {}): Observable<InternalChatMessagesResponse> {
    let params = new HttpParams();
    if (options.limit) params = params.set('limit', String(options.limit));
    if (options.before) params = params.set('before', options.before);
    if (options.after) params = params.set('after', options.after);
    if (options.groupId) params = params.set('groupId', options.groupId);
    if (options.allGroups) params = params.set('allGroups', 'true');

    return this.http.get<InternalChatMessagesResponse>(`${this.apiUrl}/messages`, { params });
  }

  sendMessage(text: string, attachments: InternalChatAttachment[] = [], type = 'text', groupId?: string): Observable<{ message: InternalChatMessage }> {
    return this.http.post<{ message: InternalChatMessage }>(
      `${this.apiUrl}/messages`,
      { text, attachments, type, groupId },
    );
  }

  uploadAttachment(file: File): Observable<{ attachment: InternalChatAttachment }> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<{ attachment: InternalChatAttachment }>(`${this.apiUrl}/attachments`, formData);
  }

  clearMessages(groupId?: string): Observable<{ success: boolean; deleted: number }> {
    const params = groupId
      ? new HttpParams().set('groupId', groupId)
      : undefined;
    return this.http.delete<{ success: boolean; deleted: number }>(
      `${this.apiUrl}/messages`,
      { params },
    );
  }

}
