import { Component, OnInit, OnDestroy } from '@angular/core';

import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { FirebaseNotificationsService } from '@core/services/firebase-notifications.service';

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
    private transferSub!: Subscription;

    constructor(
        private firebaseNotifications: FirebaseNotificationsService,
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
    }

    ngOnDestroy(): void {
        if (this.transferSub) {
            this.transferSub.unsubscribe();
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
}
