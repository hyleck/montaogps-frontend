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
  createdAt?: string;
  updatedAt?: string;
}

export interface EsterKnowledgePayload {
  title: string;
  category?: string;
  content: string;
  active?: boolean;
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

  getWorkflowRuns(): Observable<EsterWorkflowRun[]> {
    return this.http.get<EsterWorkflowRun[]>(
      `${environment.apiUrl}/ester/workflow/runs`,
    );
  }
}
