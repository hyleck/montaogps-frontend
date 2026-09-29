import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ProtocolCommand } from '../interfaces/protocol.interface';
import { SmsCommandQuotaResponse } from './targets.service';

export interface TestingCommand extends ProtocolCommand {
  commandIndex: number;
  canSend?: boolean;
  reason?: string;
}

export interface SimcardTestingContext {
  sessionId: string;
  sim: { id: string; iccid: string; idsim?: string; sim_company?: string };
  targetId?: string;
  modelName: string;
  protocolId?: string;
  serverId?: string;
  commands: TestingCommand[];
  quota: SmsCommandQuotaResponse;
  canSend: boolean;
  reason?: string;
}

export interface TestingSmsMessage {
  type: 'sent' | 'received';
  content: string;
  timestamp: Date;
  createdby?: string;
  delivered?: boolean;
  pending?: boolean;
}

export interface SimcardTestingSession {
  sessionId: string;
  simId: string;
  inventoryId: string;
  imei: string;
  protocolId: string;
  serverId: string;
  name: string;
  status: 'starting' | 'active' | 'cleanup_pending' | 'finished' | 'failed';
  expiresAt: string;
  reason?: string;
  traccarDeviceId?: number;
  restoreSubmitted: boolean;
  sim: { id: string; iccid: string; idsim?: string; sim_company?: string };
  gps: { id: string; imei: string; modelName: string };
  server: { id: string; name: string };
}

export interface TestingHistorySession extends SimcardTestingSession {
  ownerId: string;
  ownerName: string;
  createdAt: string;
  finishedAt?: string;
}

export interface TestingConnection {
  sessionId: string;
  imei: string;
  sessionStatus: SimcardTestingSession['status'];
  status: 'online' | 'offline' | 'unknown' | 'unavailable';
  lastCommunicationAt: string | null;
  checkedAt: string;
  reason?: string;
  position?: TestingGpsPosition | null;
  positionReason?: string;
}

export interface TestingGpsPosition {
  id: number;
  latitude: number;
  longitude: number;
  fixTime: string;
  receivedAt: string | null;
  speed: number | null;
  course: number | null;
  accuracy: number | null;
}

export interface TestingLogEvent {
  id: string;
  type: string;
  message: string;
  actorId?: string;
  actorName?: string;
  occurredAt: string;
  details?: Record<string, unknown>;
}

export interface TestingHistoryPage {
  data: TestingHistorySession[];
  total: number;
  page: number;
  lastPage: number;
}

export interface TestingLogsPage {
  session: TestingHistorySession;
  data: TestingLogEvent[];
  total: number;
  page: number;
  lastPage: number;
}

@Injectable({ providedIn: 'root' })
export class SimcardTestingService {
  private readonly url = `${environment.apiUrl}/sim-card/testing`;
  private readonly sessionsUrl = `${environment.apiUrl}/sim-card/testing-sessions`;

  constructor(private readonly http: HttpClient) {}

  getActiveSession(): Observable<SimcardTestingSession | null> {
    return this.http.get<SimcardTestingSession | null>(`${this.sessionsUrl}/active`);
  }

  getHistory(query = '', page = 1, limit = 20): Observable<TestingHistoryPage> {
    const params = new HttpParams().set('q', query.trim()).set('page', page).set('limit', limit);
    return this.http.get<TestingHistoryPage>(`${this.sessionsUrl}/history`, { params });
  }

  getLogs(sessionId: string, page = 1, limit = 50): Observable<TestingLogsPage> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http.get<TestingLogsPage>(`${this.sessionsUrl}/${encodeURIComponent(sessionId)}/logs`, { params });
  }

  startSession(simId: string, inventoryId: string): Observable<SimcardTestingSession> {
    return this.http.post<SimcardTestingSession>(this.sessionsUrl, { simId, inventoryId });
  }

  getSession(sessionId: string): Observable<SimcardTestingSession> {
    return this.http.get<SimcardTestingSession>(`${this.sessionsUrl}/${encodeURIComponent(sessionId)}`);
  }

  getConnection(sessionId: string): Observable<TestingConnection> {
    return this.http.get<TestingConnection>(`${this.sessionsUrl}/${encodeURIComponent(sessionId)}/connection`);
  }

  heartbeat(sessionId: string): Observable<SimcardTestingSession> {
    return this.http.patch<SimcardTestingSession>(`${this.sessionsUrl}/${encodeURIComponent(sessionId)}/heartbeat`, {});
  }

  finishSession(sessionId: string): Observable<SimcardTestingSession> {
    return this.http.delete<SimcardTestingSession>(`${this.sessionsUrl}/${encodeURIComponent(sessionId)}`);
  }

  getContext(simId: string, sessionId: string): Observable<SimcardTestingContext> {
    const params = new HttpParams().set('sessionId', sessionId);
    return this.http.get<SimcardTestingContext>(`${this.url}/${encodeURIComponent(simId)}`, { params });
  }

  sendCommand(simId: string, commandIndex: number, sessionId: string):
    Observable<{ success: boolean; quota: SmsCommandQuotaResponse; message?: string }> {
    return this.http.post<{ success: boolean; quota: SmsCommandQuotaResponse; message?: string }>(
      `${this.url}/${encodeURIComponent(simId)}`,
      { sessionId, commandIndex },
    );
  }

  getMessages(simId: string, sessionId: string): Observable<TestingSmsMessage[]> {
    const params = new HttpParams().set('sessionId', sessionId);
    return this.http.get<unknown>(`${this.url}/${encodeURIComponent(simId)}/messages`, { params }).pipe(map(response => {
      const body = response as { messages?: unknown; data?: unknown } | null;
      const messages = Array.isArray(response) ? response : body?.messages || body?.data;
      if (!Array.isArray(messages)) return [];
      return messages.map((message): TestingSmsMessage => {
        const author = String(message.createdby || '').toLowerCase();
        const sent = author === 'montaogps' || (author !== 'device' && ['MT', 'sent'].includes(message.type));
        return {
          type: sent ? 'sent' : 'received',
          content: String(message.text || message.body || message.message || message.content || ''),
          timestamp: new Date(message.fecha || message.timestamp || message.date_created || message.dateCreated),
          createdby: author || (sent ? 'montaogps' : 'device'),
          delivered: message.delivered === true,
        };
      }).filter(message => Number.isFinite(message.timestamp.getTime()))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }));
  }
}
