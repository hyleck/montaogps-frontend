import { Component, OnInit, OnDestroy } from '@angular/core';

import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { FirebaseNotificationsService } from '@core/services/firebase-notifications.service';
import { CommunicationFloatingMessage, CommunicationNotificationService } from '@core/services/communication-notification.service';

@Component({
    selector: 'app-admin',
    templateUrl: './admin.component.html',
    styleUrl: './admin.component.css',
    standalone: false
})
export class AdminComponent implements OnInit, OnDestroy {
    showChatTransferModal: boolean = false;
    transferConversationId: string | null = null;
    transferSummaryText: string | null = null;
    floatingMessage: CommunicationFloatingMessage | null = null;
    private transferSub!: Subscription;
    private floatingSub!: Subscription;
    private floatingTimer: any = null;

    constructor(
        private firebaseNotifications: FirebaseNotificationsService,
        private communicationNotifications: CommunicationNotificationService,
        private router: Router
    ) {}

    ngOnInit(): void {
        this.transferSub = this.firebaseNotifications.chatTransferReceived$.subscribe((data: any) => {
            if (data && data.conversationId) {
                this.transferConversationId = data.conversationId;
                this.transferSummaryText = data.summary || null;
            } else {
                this.transferConversationId = null;
                this.transferSummaryText = null;
            }
            this.showChatTransferModal = true;
        });

        this.floatingSub = this.communicationNotifications.floatingMessage$.subscribe((message) => {
            this.floatingMessage = message;
            if (this.floatingTimer) clearTimeout(this.floatingTimer);
            this.floatingTimer = setTimeout(() => {
                this.floatingMessage = null;
                this.floatingTimer = null;
            }, 9000);
        });
    }

    ngOnDestroy(): void {
        if (this.transferSub) {
            this.transferSub.unsubscribe();
        }
        if (this.floatingSub) {
            this.floatingSub.unsubscribe();
        }
        if (this.floatingTimer) {
            clearTimeout(this.floatingTimer);
        }
    }

    goToConversation(): void {
        this.showChatTransferModal = false;
        if (this.transferConversationId) {
            this.router.navigate(['/admin/communication', 'chat', this.transferConversationId]);
        } else {
            this.router.navigate(['/admin/communication', 'chat']);
        }
    }

    openFloatingConversation(): void {
        if (!this.floatingMessage) return;
        const source = this.floatingMessage.source || 'whatsapp';
        const conversationId = this.floatingMessage.conversationId;
        this.floatingMessage = null;
        if (this.floatingTimer) {
            clearTimeout(this.floatingTimer);
            this.floatingTimer = null;
        }
        if (source === 'internal') {
            this.router.navigate(['/admin/communication', 'grupo']);
            return;
        }
        if (!conversationId) return;
        this.router.navigate(['/admin/communication', 'chat', conversationId]);
    }

    closeFloatingMessage(event: Event): void {
        event.stopPropagation();
        this.floatingMessage = null;
        if (this.floatingTimer) {
            clearTimeout(this.floatingTimer);
            this.floatingTimer = null;
        }
    }

    getFloatingInitials(name?: string): string {
        const safeName = (name || '').trim();
        if (!safeName) return '??';
        return safeName
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join('');
    }
}
