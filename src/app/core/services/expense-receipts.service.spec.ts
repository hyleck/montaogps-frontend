import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { ExpenseReceiptsService } from './expense-receipts.service';

describe('ExpenseReceiptsService employee filter', () => {
  let service: ExpenseReceiptsService;
  let http: HttpTestingController;
  const apiUrl = `${environment.apiUrl}/expense-receipts`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ExpenseReceiptsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('patches the requested receipt using the editable fields and the known revision', () => {
    const changes = { total_amount: 125, expected_updated_at: '2026-08-28T14:00:00Z' };
    service.update('receipt-1', changes).subscribe();
    const request = http.expectOne(`${apiUrl}/receipt-1`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual(changes);
    request.flush({ _id: 'receipt-1', total_amount: 125 });
  });

  it('deletes only the selected receipt with the last known revision', () => {
    service.remove('receipt-1', '2026-08-28T14:00:00Z').subscribe();
    const request = http.expectOne(req => req.url === `${apiUrl}/receipt-1`);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.params.get('expected_updated_at')).toBe('2026-08-28T14:00:00Z');
    request.flush({ deleted: true, id: 'receipt-1' });
  });

  it('requests the complete employee options without receipt pagination or filters', () => {
    const employees = [{ employee_id: '507f191e810c19729de860ea', employee_name: 'Ana Pérez' }];
    service.getEmployees().subscribe(result => expect(result).toEqual(employees));

    const request = http.expectOne(`${apiUrl}/employees`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual([]);
    request.flush(employees);
  });

  it('sends the exact employee id along with other filters and pagination', () => {
    const filters = {
      employee_id: '507f191e810c19729de860ea',
      accounting_category: 'gasto_operativo',
      status: 'completed',
      search: 'Comercio',
      date_from: '2026-08-01',
      date_to: '2026-08-31',
      page: 2,
      limit: 30,
    };
    service.getAll(filters).subscribe();

    const request = http.expectOne(req => req.url === apiUrl);
    for (const [key, value] of Object.entries(filters)) {
      expect(request.request.params.get(key)).toBe(String(value));
    }
    request.flush({ data: [], total: 0, page: 2, limit: 30 });
  });

  it('omits an empty employee selection to return all employees', () => {
    service.getAll({ employee_id: '', page: 1 }).subscribe();

    const request = http.expectOne(req => req.url === apiUrl);
    expect(request.request.params.has('employee_id')).toBeFalse();
    request.flush({ data: [], total: 0, page: 1, limit: 30 });
  });

  it('loads eligible employees separately from the historical receipt filter', () => {
    service.getEligibleEmployees().subscribe();

    const request = http.expectOne(`${apiUrl}/eligible-employees`);
    expect(request.request.method).toBe('GET');
    request.flush([{ employee_id: '507f191e810c19729de860ea', employee_name: 'Ana Pérez' }]);
  });

  it('uploads the selected expense employee but never sends a client-chosen registrar', () => {
    const file = new File(['image'], 'comprobante.jpg', { type: 'image/jpeg' });
    const employeeId = '507f191e810c19729de860ea';

    service.upload(file, 'gasto_operativo', employeeId).subscribe();

    const request = http.expectOne(apiUrl);
    expect(request.request.method).toBe('POST');
    const body = request.request.body as FormData;
    expect(body.get('image')).toEqual(jasmine.any(File));
    expect(body.get('accounting_category')).toBe('gasto_operativo');
    expect(body.get('employee_id')).toBe(employeeId);
    expect(body.has('employee_name')).toBeFalse();
    expect(body.has('registered_by_id')).toBeFalse();
    expect(body.has('registered_by_name')).toBeFalse();
    request.flush({ _id: 'receipt-1' });
  });
});
