import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root'
})
export class ChatwootApiService {

    private readonly apiUrl = `${environment.apiUrl}/chatwoot`;

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

    getConversations(inboxId?: number, page: number = 1, agentId?: string): Observable<any> {
        const params: any = { page: page.toString() };
        if (inboxId) {
            params.inbox_id = inboxId.toString();
        }
        if (agentId) {
            params.agent_id = agentId;
        }
        return this.http.get(`${this.apiUrl}/conversations`, { params });
    }

    getConversationMessages(conversationId: number): Observable<any> {
        return this.http.get(`${this.apiUrl}/conversation-messages`, {
            params: { conversation_id: conversationId.toString() }
        });
    }

    sendAttachment(conversationId: number, file: File, message?: string, agentId?: string): Observable<any> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('conversation_id', conversationId.toString());
        if (message) {
            formData.append('message', message);
        }
        if (agentId) {
            formData.append('agent_id', agentId);
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

    getInboxDetails(inboxId: number): Observable<any> {
        return this.http.get(`${this.apiUrl}/inbox-details`, {
            params: { inbox_id: inboxId.toString() }
        });
    }

    assignAgentToConversation(conversationId: number, agentId: number): Observable<any> {
        return this.http.post(`${this.apiUrl}/conversation-assign`, { conversation_id: conversationId, agent_id: agentId });
    }

    sendWhatsAppTemplateToUser(payload: { phone: string; template_name: string; variables: string[]; agent_id?: string }): Observable<any> {
        return this.http.post(`${this.apiUrl}/send-whatsapp`, payload);
    }

    check24hWindow(phone: string): Observable<any> {
        return this.http.get(`${this.apiUrl}/check-24h-window`, {
            params: { phone }
        });
    }

    sendWhatsAppText(payload: { phone: string; message: string; contact_name?: string; agent_id?: string }): Observable<any> {
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

    sendSticker(payload: { phone: string; sticker_id: string; conversation_id?: number; agent_id?: string }): Observable<any> {
        return this.http.post(`${this.apiUrl}/stickers/send`, payload);
    }

    deleteSticker(stickerId: string): Observable<any> {
        return this.http.delete(`${this.apiUrl}/stickers/${stickerId}`);
    }
}
