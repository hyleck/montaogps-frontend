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
});
