import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SendPersonalizedCallPayload {
  phone: string;
  query: string;
  name: string;
  userId?: string;
  purpose?: string;
}

export interface SendPersonalizedCallResponse {
  success: boolean;
  data?: any;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class VapiService {
  private readonly apiUrl = `${environment.apiUrl}/vapi`;

  constructor(private readonly http: HttpClient) {}

  sendPersonalizedCall(payload: SendPersonalizedCallPayload): Observable<SendPersonalizedCallResponse> {
    return this.http.post<SendPersonalizedCallResponse>(`${this.apiUrl}/send-call`, payload);
  }

  getCallRecordingAudioUrl(callId: string): string {
    return `${this.apiUrl}/call-recording/${encodeURIComponent(callId)}/audio`;
  }
}
