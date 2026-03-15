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

    sendMessage(phone: string, message: string, contactName?: string, inboxId?: number): Observable<any> {
        return this.http.post(`${this.apiUrl}/send-message`, {
            phone,
            message,
            contact_name: contactName,
            inbox_id: inboxId,
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

    getConversations(inboxId?: number, page: number = 1): Observable<any> {
        const params: any = { page: page.toString() };
        if (inboxId) {
            params.inbox_id = inboxId.toString();
        }
        return this.http.get(`${this.apiUrl}/conversations`, { params });
    }

    getConversationMessages(conversationId: number): Observable<any> {
        return this.http.get(`${this.apiUrl}/conversation-messages`, {
            params: { conversation_id: conversationId.toString() }
        });
    }

    sendAttachment(conversationId: number, file: File, message?: string): Observable<any> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('conversation_id', conversationId.toString());
        if (message) {
            formData.append('message', message);
        }
        return this.http.post(`${this.apiUrl}/send-attachment`, formData);
    }

    sendConversationMessage(conversationId: number, message: string, inReplyTo?: number): Observable<any> {
        const body: any = { conversation_id: conversationId, message };
        if (inReplyTo) {
            body.in_reply_to = inReplyTo;
        }
        return this.http.post(`${this.apiUrl}/conversation-send`, body);
    }
}
