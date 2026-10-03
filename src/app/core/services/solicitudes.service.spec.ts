import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { SolicitudesService } from './solicitudes.service';

describe('SolicitudesService single-request board movement', () => {
    let service: SolicitudesService;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
        service = TestBed.inject(SolicitudesService);
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    it('sends only the moved request and anchor versions and returns the authoritative request and positions', () => {
        const input = { id: 'moved', status: 'en_progreso', before_id: 'anchor', expected_version: 4, before_expected_version: 8 };
        let result: unknown;
        service.moveOnBoard(input).subscribe(value => result = value);
        const request = http.expectOne(`${environment.apiUrl}/solicitudes/board/move`);
        expect(request.request.method).toBe('PATCH');
        expect(request.request.body).toEqual(input);
        expect(request.request.body.items).toBeUndefined();
        const response = {
            solicitud: { _id: 'moved', type: 'instalacion', status: 'en_progreso', order: 3, __v: 5 },
            positions: [{ id: 'anchor', order: 4, version: 9 }],
        };
        request.flush(response);
        expect(result).toEqual(response);
    });

    it('represents completion at the end of the column without sending existing closed requests', () => {
        service.moveOnBoard({ id: 'moved', status: 'completada', before_id: null, expected_version: 7 }).subscribe();
        const request = http.expectOne(`${environment.apiUrl}/solicitudes/board/move`);
        expect(request.request.body).toEqual({ id: 'moved', status: 'completada', before_id: null, expected_version: 7 });
        request.flush({ solicitud: { _id: 'moved', status: 'completada' }, positions: [] });
    });
});
