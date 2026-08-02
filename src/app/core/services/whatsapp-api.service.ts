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

    getConversations(inboxId?: number, page: number = 1, agentId?: string, includeAll: boolean = false): Observable<any> {
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
