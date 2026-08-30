import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface EmployeeEsterReplyResponse {
    success: boolean;
    enabled: boolean;
    message?: string;
    error?: string;
}

export interface ImproveEmployeeReplyResponse {
    success: boolean;
    enabled: boolean;
    suggestion: string;
    changed?: boolean;
    reason?: string;
}

export interface ConversationObjective {
    id: string;
    title: string;
    description?: string;
    type: 'response' | 'data' | 'action' | 'result';
    required: boolean;
    completion_mode: 'automatic' | 'manual' | 'both';
    status: 'pending' | 'completed' | 'archived';
    created_by?: string;
    created_by_name?: string;
    created_at?: string;
    updated_at?: string;
    completed_by_name?: string;
    completed_source?: 'ester_ai' | 'manual';
    completed_at?: string | null;
    evidence?: Record<string, unknown> | null;
    history?: Array<Record<string, unknown>>;
}

@Injectable({
    providedIn: 'root'
})
export class WhatsAppApiService {

    private readonly apiUrl = `${environment.apiUrl}/whatsapp`;

    constructor(private http: HttpClient) { }

    sendMessage(phone: string, message: string, contactName?: string, inboxId?: number, files?: File[], agentId?: string): Observable<any> {
        if (files && files.length > 0) {
            const formData = new FormData();
            formData.append('phone', phone);
            formData.append('message', message);
            if (contactName) formData.append('contact_name', contactName);
            if (inboxId) formData.append('inbox_id', inboxId.toString());
            if (agentId) formData.append('agent_id', agentId);
            for (const file of files) {
                formData.append('files', file);
            }
            return this.http.post(`${this.apiUrl}/send-message`, formData);
        }
        return this.http.post(`${this.apiUrl}/send-message`, {
            phone,
            message,
            contact_name: contactName,
            inbox_id: inboxId,
            agent_id: agentId
        });
    }

    searchContact(phone: string): Observable<any> {
        return this.http.get(`${this.apiUrl}/search-contact`, {
            params: { phone }
        });
    }

    getMessages(phone: string, inboxId?: number): Observable<any> {
        const params: any = { phone };
        if (inboxId) {
            params.inbox_id = inboxId.toString();
        }
        return this.http.get(`${this.apiUrl}/messages`, { params });
    }

    getConversations(
        inboxId?: number,
        page: number = 1,
        agentId?: string,
        includeAll: boolean = false,
        search: string = '',
        attention: 'all' | 'recent' | 'urgent' | 'waiting' | 'unread' = 'all',
        assignedOnly: boolean = false,
        pageSize?: number,
    ): Observable<any> {
        const params: any = { page: page.toString() };
        if (inboxId) {
            params.inbox_id = inboxId.toString();
        }
        if (agentId) {
            params.agent_id = agentId;
        }
        if (includeAll) {
            params.include_all = 'true';
        }
        if (search.trim()) {
            params.search = search.trim();
        }
        if (attention !== 'all') {
            params.attention = attention;
        }
        if (assignedOnly) {
            params.assigned_only = 'true';
        }
        if (Number.isFinite(pageSize) && Number(pageSize) > 0) {
            params.page_size = String(Math.floor(Number(pageSize)));
        }
        return this.http.get(`${this.apiUrl}/conversations`, { params });
    }

    getConversationMessages(conversationId: number, limit: number = 50, before?: number): Observable<any> {
        const params: any = {
            conversation_id: conversationId.toString(),
            limit: limit.toString()
        };
        if (before) {
            params.before = before.toString();
        }
        return this.http.get(`${this.apiUrl}/conversation-messages`, {
            params
        });
    }

    ensureConversation(payload: {
        phone: string;
        contact_name?: string;
        claim_if_unassigned?: boolean;
    }): Observable<{
        success: boolean;
        error?: string;
        conversation?: {
            id: number;
            phone: string;
            contact_name: string;
            assignee_id?: string | null;
        };
    }> {
        return this.http.post<{
            success: boolean;
            error?: string;
            conversation?: {
                id: number;
                phone: string;
                contact_name: string;
                assignee_id?: string | null;
            };
        }>(`${this.apiUrl}/conversation-ensure`, payload);
    }

    sendEmployeeEsterReply(
        conversationId: number,
    ): Observable<EmployeeEsterReplyResponse> {
        return this.http.post<EmployeeEsterReplyResponse>(
            `${this.apiUrl}/conversation-ester-reply`,
            {
                conversation_id: conversationId,
            },
        );
    }

    improveEmployeeReply(
        conversationId: number,
        message: string,
    ): Observable<ImproveEmployeeReplyResponse> {
        return this.http.post<ImproveEmployeeReplyResponse>(
            `${this.apiUrl}/conversation-improve-reply`,
            {
                conversation_id: conversationId,
                message,
            },
        );
    }

    getConversationObjectives(
        conversationId: number,
        includeArchived = false,
    ): Observable<{
        success: boolean;
        objectives: ConversationObjective[];
        summary?: Record<string, number>;
    }> {
        return this.http.get<{
            success: boolean;
            objectives: ConversationObjective[];
            summary?: Record<string, number>;
        }>(`${this.apiUrl}/conversation-objectives`, {
            params: {
                conversation_id: conversationId.toString(),
                ...(includeArchived ? { include_archived: 'true' } : {}),
            },
        });
    }

    createConversationObjective(
        conversationId: number,
        objective: Partial<ConversationObjective>,
    ): Observable<{ success: boolean; objective: ConversationObjective }> {
        return this.http.post<{ success: boolean; objective: ConversationObjective }>(
            `${this.apiUrl}/conversation-objectives`,
            { conversation_id: conversationId, ...objective },
        );
    }

    updateConversationObjective(
        conversationId: number,
        objectiveId: string,
        objective: Partial<ConversationObjective>,
    ): Observable<{ success: boolean; objective: ConversationObjective }> {
        return this.http.patch<{ success: boolean; objective: ConversationObjective }>(
            `${this.apiUrl}/conversation-objectives/${encodeURIComponent(objectiveId)}`,
            { conversation_id: conversationId, ...objective },
        );
    }

    setConversationObjectiveProgress(
        conversationId: number,
        objectiveId: string,
        completed: boolean,
    ): Observable<{ success: boolean; objective: ConversationObjective }> {
        return this.http.post<{ success: boolean; objective: ConversationObjective }>(
            `${this.apiUrl}/conversation-objectives/${encodeURIComponent(objectiveId)}/progress`,
            { conversation_id: conversationId, completed },
        );
    }

    deleteConversationObjective(
        conversationId: number,
        objectiveId: string,
    ): Observable<{ success: boolean; objective: ConversationObjective }> {
        return this.http.delete<{ success: boolean; objective: ConversationObjective }>(
            `${this.apiUrl}/conversation-objectives/${encodeURIComponent(objectiveId)}`,
            { params: { conversation_id: conversationId.toString() } },
        );
    }

    updateConversationPresence(
        conversationId: number,
        active: boolean,
        typing: boolean,
    ): Observable<any> {
        return this.http.post(`${this.apiUrl}/conversation-presence`, {
            conversation_id: conversationId,
            active,
            typing,
        });
    }

    getConversationPresence(conversationId: number): Observable<any> {
        return this.http.get(`${this.apiUrl}/conversation-presence`, {
            params: { conversation_id: conversationId.toString() },
        });
    }

    getPlayableAudioUrl(mediaUrl: string): string {
        const normalizedUrl = String(mediaUrl || '').trim();
        return normalizedUrl
            ? `${this.apiUrl}/media/audio?url=${encodeURIComponent(normalizedUrl)}`
            : '';
    }

    getPlayableVideoUrl(mediaUrl: string): string {
        const normalizedUrl = String(mediaUrl || '').trim();
        return normalizedUrl
            ? `${this.apiUrl}/media/video?url=${encodeURIComponent(normalizedUrl)}`
            : '';
    }

    sendAttachment(conversationId: number, file: File, message?: string, agentId?: string, inReplyTo?: number): Observable<any> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('conversation_id', conversationId.toString());
        if (message) {
            formData.append('message', message);
        }
        if (agentId) {
            formData.append('agent_id', agentId);
        }
        if (inReplyTo) {
            formData.append('in_reply_to', inReplyTo.toString());
        }
        return this.http.post(`${this.apiUrl}/send-attachment`, formData);
    }

    sendConversationMessage(conversationId: number, message: string, inReplyTo?: number, contentType?: string, agentId?: string): Observable<any> {
        const body: any = { conversation_id: conversationId, message };
        if (inReplyTo) {
            body.in_reply_to = inReplyTo;
        }
        if (contentType) {
            body.content_type = contentType;
        }
        if (agentId) {
            body.agent_id = agentId;
        }
        return this.http.post(`${this.apiUrl}/conversation-send`, body);
    }

    setConversationTranslationLanguage(
        conversationId: number,
        language: string,
    ): Observable<any> {
        return this.http.post(
            `${this.apiUrl}/conversation-translation-language`,
            {
                conversation_id: conversationId,
                language,
            },
        );
    }

    clearConversation(conversationId: number): Observable<{
        success: boolean;
        conversation_id: number;
        deleted_messages: number;
    }> {
        return this.http.post<{
            success: boolean;
            conversation_id: number;
            deleted_messages: number;
        }>(`${this.apiUrl}/conversation-clear`, {
            conversation_id: conversationId,
        });
    }

    deleteConversation(conversationId: number): Observable<{
        success: boolean;
        conversation_id: number;
        deleted_messages: number;
    }> {
        return this.http.delete<{
            success: boolean;
            conversation_id: number;
            deleted_messages: number;
        }>(`${this.apiUrl}/conversation/${conversationId}`);
    }

    translateConversationMessages(
        conversationId: number,
        language: string,
        messageIds: number[],
    ): Observable<any> {
        return this.http.post(
            `${this.apiUrl}/conversation-translations`,
            {
                conversation_id: conversationId,
                language,
                message_ids: messageIds,
            },
        );
    }

    reactToConversationMessage(conversationId: number, messageId: number, emoji: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/conversation-reaction`, {
            conversation_id: conversationId,
            message_id: messageId,
            emoji,
        });
    }

    assignAgentToConversation(conversationId: number, agentId: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/conversation-assign`, { conversation_id: conversationId, agent_id: agentId });
    }

    resumeEsterConversation(conversationId: number): Observable<any> {
        return this.http.post(`${this.apiUrl}/conversation-resume-ester`, {
            conversation_id: conversationId,
        });
    }

    sendConversationReminder(conversationId: number): Observable<{
        success: boolean;
        sentTo?: string;
        error?: string;
    }> {
        return this.http.post<{
            success: boolean;
            sentTo?: string;
            error?: string;
        }>(`${this.apiUrl}/conversation-reminder`, {
            conversation_id: conversationId,
        });
    }

    sendWhatsAppTemplateToUser(payload: { phone: string; template_name: string; variables: string[]; agent_id?: string; conversation_id?: number }): Observable<any> {
        return this.http.post(`${this.apiUrl}/send-whatsapp`, payload);
    }

    check24hWindow(phone: string): Observable<any> {
        return this.http.get(`${this.apiUrl}/check-24h-window`, {
            params: { phone }
        });
    }

    sendWhatsAppText(payload: { phone: string; message: string; contact_name?: string; agent_id?: string; conversation_id?: number }): Observable<any> {
        return this.http.post(`${this.apiUrl}/send-whatsapp-text`, payload);
    }

    getStickers(): Observable<any> {
        return this.http.get(`${this.apiUrl}/stickers`);
    }

    saveStickerFromImage(payload: { image_url: string; name?: string }): Observable<any> {
        return this.http.post(`${this.apiUrl}/stickers/save-from-image`, payload);
    }

    uploadStickerImage(file: File, name?: string): Observable<any> {
        const formData = new FormData();
        formData.append('image', file, file.name);
        if (name) formData.append('name', name);
        return this.http.post(`${this.apiUrl}/stickers/upload`, formData);
    }

    sendSticker(payload: { phone: string; sticker_id: string; conversation_id?: number; agent_id?: string; in_reply_to?: number }): Observable<any> {
        return this.http.post(`${this.apiUrl}/stickers/send`, payload);
    }

    deleteSticker(stickerId: string): Observable<any> {
        return this.http.delete(`${this.apiUrl}/stickers/${stickerId}`);
    }
}
