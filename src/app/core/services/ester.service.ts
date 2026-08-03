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

export interface EsterSupervisorSettings {
  active: boolean;
  guidelines: string;
  mandatoryGuidelines: string[];
  updatedAt?: string;
}

export interface EsterSupervisorSettingsPayload {
  active?: boolean;
  guidelines?: string;
}

export interface EsterCommunicationStatus {
  whatsappAutoReplyActive: boolean;
}

export interface EsterSelfLearningRule {
  _id: string;
  title: string;
  category: string;
  content: string;
  when_to_apply: string;
  avoid: string;
  change_summary?: string;
  active: boolean;
  version: number;
  source_conversation_id?: number | null;
  source_message_id?: number | null;
  feedback_history?: Array<{
    feedback: string;
    conversation_id: number;
    message_id: number;
    submitted_by: string;
    applied_at: string;
    change_summary?: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface EsterFeedbackPayload {
  conversationId: number;
  messageId: number;
  feedback: string;
}

export interface EsterFeedbackResult {
  updated: boolean;
  rule: EsterSelfLearningRule;
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

  getCommunicationStatus(): Observable<EsterCommunicationStatus> {
    return this.http.get<EsterCommunicationStatus>(
      `${environment.apiUrl}/ester/communication-status`,
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

  getSupervisorSettings(): Observable<EsterSupervisorSettings> {
    return this.http.get<EsterSupervisorSettings>(
      `${environment.apiUrl}/ester/supervisor`,
    );
  }

  updateSupervisorSettings(
    payload: EsterSupervisorSettingsPayload,
  ): Observable<EsterSupervisorSettings> {
    return this.http.patch<EsterSupervisorSettings>(
      `${environment.apiUrl}/ester/supervisor`,
      payload,
    );
  }

  getSelfLearningRules(): Observable<EsterSelfLearningRule[]> {
    return this.http.get<EsterSelfLearningRule[]>(
      `${environment.apiUrl}/ester/self-learning`,
    );
  }

  submitMessageFeedback(
    payload: EsterFeedbackPayload,
  ): Observable<EsterFeedbackResult> {
    return this.http.post<EsterFeedbackResult>(
      `${environment.apiUrl}/ester/self-learning/feedback`,
      payload,
    );
  }
}
