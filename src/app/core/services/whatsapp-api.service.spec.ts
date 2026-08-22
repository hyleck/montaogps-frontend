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
