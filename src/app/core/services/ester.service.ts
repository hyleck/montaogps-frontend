import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface EsterKnowledgeEntry {
  _id: string;
  title: string;
  category: string;
  content: string;
  active: boolean;
  priority: boolean;
  media_type?: 'image' | 'video' | null;
  media_url?: string | null;
  media_name?: string | null;
  media_mime_type?: string | null;
  media_size?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface EsterKnowledgePayload {
  title: string;
  category?: string;
  content: string;
  active?: boolean;
  priority?: boolean;
  media_type?: 'image' | 'video' | null;
  media_url?: string | null;
  media_name?: string | null;
  media_mime_type?: string | null;
  media_size?: number | null;
}

export interface EsterKnowledgeMediaUpload {
  media_type: 'image' | 'video';
  media_url: string;
  media_name: string;
  media_mime_type: string;
  media_size: number;
}

export type EsterWorkflowStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'skipped'
  | 'error';

export interface EsterWorkflowNode {
  id: string;
  label: string;
  status: EsterWorkflowStatus;
  detail?: string;
  started_at?: string;
  completed_at?: string;
}

export interface EsterWorkflowRun {
  _id: string;
  conversation_id: number;
  contact_name: string;
  trigger: string;
  status: 'running' | 'success' | 'error';
  nodes: EsterWorkflowNode[];
  error?: string;
  started_at: string;
  completed_at?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EsterSkill {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  version: string;
  defaultActive: boolean;
  audience: 'all' | 'registered_user';
  active: boolean;
  codeManaged: true;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class EsterService {
  private readonly apiUrl = `${environment.apiUrl}/ester/knowledge`;

  constructor(private readonly http: HttpClient) {}

  getKnowledge(): Observable<EsterKnowledgeEntry[]> {
    return this.http.get<EsterKnowledgeEntry[]>(this.apiUrl);
  }

  createKnowledge(
    payload: EsterKnowledgePayload,
  ): Observable<EsterKnowledgeEntry> {
    return this.http.post<EsterKnowledgeEntry>(this.apiUrl, payload);
  }

  updateKnowledge(
    id: string,
    payload: Partial<EsterKnowledgePayload>,
  ): Observable<EsterKnowledgeEntry> {
    return this.http.patch<EsterKnowledgeEntry>(
      `${this.apiUrl}/${id}`,
      payload,
    );
  }

  deleteKnowledge(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  uploadKnowledgeMedia(
    file: File,
  ): Observable<EsterKnowledgeMediaUpload> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<EsterKnowledgeMediaUpload>(
      `${this.apiUrl}/media`,
      formData,
    );
  }

  getWorkflowRuns(): Observable<EsterWorkflowRun[]> {
    return this.http.get<EsterWorkflowRun[]>(
      `${environment.apiUrl}/ester/workflow/runs`,
    );
  }

  getSkills(): Observable<EsterSkill[]> {
    return this.http.get<EsterSkill[]>(
      `${environment.apiUrl}/ester/skills`,
    );
  }

  updateSkillState(
    skillId: string,
    active: boolean,
  ): Observable<EsterSkill> {
    return this.http.patch<EsterSkill>(
      `${environment.apiUrl}/ester/skills/${skillId}`,
      { active },
    );
  }
}
