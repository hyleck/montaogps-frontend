import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from 'src/environments/environment';
import { WhatsAppApiService } from './whatsapp-api.service';

describe('WhatsAppApiService', () => {
    let service: WhatsAppApiService;
    let httpController: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
        });
        service = TestBed.inject(WhatsAppApiService);
        httpController = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpController.verify();
    });

    it('searches conversation contacts and messages with an attention filter', () => {
        service.getConversations(
            5,
            1,
            'employee-id',
            true,
            'batería baja',
            'unread',
        ).subscribe();

        const request = httpController.expectOne(candidate => (
            candidate.url === `${environment.apiUrl}/whatsapp/conversations`
            && candidate.params.get('inbox_id') === '5'
            && candidate.params.get('page') === '1'
            && candidate.params.get('agent_id') === 'employee-id'
            && candidate.params.get('include_all') === 'true'
            && candidate.params.get('search') === 'batería baja'
            && candidate.params.get('attention') === 'unread'
        ));
        expect(request.request.method).toBe('GET');
        request.flush({ success: true, conversations: [] });
    });

    it('requests an improved employee reply without sending the message', () => {
        service.improveEmployeeReply(202, 'ta bien vamos a revisarlo').subscribe(response => {
            expect(response).toEqual({
                success: true,
                enabled: true,
                suggestion: 'Está bien, vamos a revisarlo.',
                changed: true,
            });
        });

        const request = httpController.expectOne(
            `${environment.apiUrl}/whatsapp/conversation-improve-reply`,
        );
        expect(request.request.method).toBe('POST');
        expect(request.request.body).toEqual({
            conversation_id: 202,
            message: 'ta bien vamos a revisarlo',
        });
        request.flush({
            success: true,
            enabled: true,
            suggestion: 'Está bien, vamos a revisarlo.',
            changed: true,
        });
    });
});
