import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { InventoryService } from './inventory.service';

describe('Inventory lot API', () => {
  let api: InventoryService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/inventory`;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(InventoryService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('queries category, warehouse, search and page', () => {
    api.getLots('cables', 'unassigned', 'Cable & relay', 2).subscribe();
    const request = http.expectOne(req => req.url === `${base}/lots`);
    expect(request.request.params.get('category')).toBe('cables');
    expect(request.request.params.get('storage_id')).toBe('unassigned');
    expect(request.request.params.get('q')).toBe('Cable & relay');
    expect(request.request.params.get('page')).toBe('2');
    request.flush({ data: [], total: 0, total_quantity: 0, page: 2, lastPage: 1 });
  });
  it('registers quantity without individual serials', () => {
    const payload = { category: 'relay' as const, name: 'Entrada', quantity: 50, storage_id: null, request_id: 'request' };
    api.createLot(payload).subscribe();
    const request = http.expectOne(`${base}/lots`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush({ ...payload, _id: 'lot-1' });
  });
  it('resumes by the existing conduce id', () => {
    api.resumeConduce('conduce-1').subscribe();
    const request = http.expectOne(`${base}/conduces/conduce-1/resume`);
    expect(request.request.method).toBe('POST');
    request.flush({ status: 'completed' });
  });
  it('loads complete lot details by an encoded id', () => {
    api.getLot('lot/1').subscribe();
    const request = http.expectOne(`${base}/lots/lot%2F1`);
    expect(request.request.method).toBe('GET');
    request.flush({ _id: 'lot/1', version: 2, balances: [] });
  });
  it('patches only the chosen fields and includes the optimistic version', () => {
    const payload = { version: 2, name: 'Nuevo', description: 'Notas', quantity: 40, storage_id: null };
    api.updateLot('lot/1', payload).subscribe();
    const request = http.expectOne(`${base}/lots/lot%2F1`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual(payload);
    request.flush({ _id: 'lot/1', ...payload });
  });
  it('sends the confirmed version when deleting a specific lot', () => {
    api.deleteLot('lot/1', 3).subscribe();
    const request = http.expectOne(`${base}/lots/lot%2F1`);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.body).toEqual({ version: 3 });
    request.flush({ id: 'lot/1', deleted: true });
  });
});
