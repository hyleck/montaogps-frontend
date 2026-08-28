import { of, Subject, throwError } from 'rxjs';
import { ExpenseReceipt } from '../../../../../../core/services/expense-receipts.service';
import { ComprobantesComponent } from './comprobantes.component';

describe('ComprobantesComponent', () => {
  const rootAuth = { getCurrentUser: () => ({ root: true }) } as any;
  function receipt(values: Partial<ExpenseReceipt>): ExpenseReceipt {
    return {
      _id: String(values._id || 'receipt'),
      employee_id: 'employee-1',
      employee_name: 'Ana Pérez',
      image_url: 'https://cdn.example.com/receipt.jpg',
      category: 'otros',
      processing_status: 'completed',
      ...values,
    };
  }

  it('groups receipts first by date and then by the employee-selected category', () => {
    const service = { getAll: jasmine.createSpy('getAll').and.returnValue(of({ data: [], total: 0 })) };
    const component = new ComprobantesComponent(service as any, rootAuth);
    component.receipts = [
      receipt({ _id: 'fuel', expense_date: '2026-08-04T12:00:00.000Z', accounting_category: 'gasto_operativo' }),
      receipt({ _id: 'food', expense_date: '2026-08-04T12:00:00.000Z', accounting_category: 'gasto_representacion' }),
      receipt({ _id: 'transport', expense_date: '2026-08-03T12:00:00.000Z', accounting_category: 'gasto_operativo' }),
    ];

    expect(component.dateGroups.length).toBe(2);
    expect(component.dateGroups[0].categories.map(group => group.category)).toEqual([
      'gasto_operativo',
      'gasto_representacion',
    ]);
    expect(component.dateGroups[0].count).toBe(2);
    expect(component.dateGroups[1].categories[0].items[0]._id).toBe('transport');
  });

  it('combines the employee filter with dates, category, status and search and resets pagination', () => {
    const service = { getAll: jasmine.createSpy('getAll').and.returnValue(of({ data: [], total: 0 })) };
    const component = new ComprobantesComponent(service as any, rootAuth);
    component.accountingCategory = 'gasto_representacion';
    component.employeeId = '507f191e810c19729de860ea';
    component.status = 'completed';
    component.search = '  Comercio  ';
    component.page = 3;
    component.dateFrom = '2026-08-01';
    component.dateTo = '2026-08-31';

    component.applyFilters();

    expect(service.getAll).toHaveBeenCalledWith(jasmine.objectContaining({
      employee_id: '507f191e810c19729de860ea',
      accounting_category: 'gasto_representacion',
      status: 'completed',
      search: 'Comercio',
      date_from: '2026-08-01',
      date_to: '2026-08-31',
      page: 1,
    }));
    expect(component.page).toBe(1);
  });

  it('loads employee options independently from the current receipt page', () => {
    const employees = [{ employee_id: 'employee-other-page', employee_name: 'Luis García' }];
    const service = {
      getAll: jasmine.createSpy('getAll').and.returnValue(of({ data: [receipt({})], total: 61 })),
      getEmployees: jasmine.createSpy('getEmployees').and.returnValue(of(employees)),
    };
    const component = new ComprobantesComponent(service as any, rootAuth);

    component.ngOnInit();

    expect(service.getEmployees).toHaveBeenCalledTimes(1);
    expect(component.employees).toEqual(employees);
    expect(component.employeesLoading).toBeFalse();
    expect(component.receipts[0].employee_id).toBe('employee-1');
  });

  it('shows a retryable employee loading error without hiding receipts', () => {
    const service = {
      getEmployees: jasmine.createSpy('getEmployees').and.returnValue(throwError(() => new Error('offline'))),
    };
    const component = new ComprobantesComponent(service as any, rootAuth);
    component.receipts = [receipt({})];

    component.loadEmployees();

    expect(component.employeesLoading).toBeFalse();
    expect(component.employeesError).toContain('empleados');
    expect(component.receipts.length).toBe(1);
    expect(component.error).toBe('');

    const response = new Subject<any[]>();
    service.getEmployees.and.returnValue(response);
    component.loadEmployees();
    expect(component.employeesLoading).toBeTrue();
    expect(component.employeesError).toBe('');
    response.next([{ employee_id: 'employee-1', employee_name: 'Ana Pérez' }]);
    response.complete();
    expect(component.employeesLoading).toBeFalse();
    expect(component.employees.length).toBe(1);
  });

  it('keeps the selected employee when changing pages and clears it with the other filters', () => {
    const service = { getAll: jasmine.createSpy('getAll').and.returnValue(of({ data: [], total: 61 })) };
    const component = new ComprobantesComponent(service as any, rootAuth);
    component.employeeId = 'employee-1';
    component.total = 61;

    component.changePage(2);

    expect(service.getAll).toHaveBeenCalledWith(jasmine.objectContaining({ employee_id: 'employee-1', page: 2 }));
    component.search = 'Ana';
    component.accountingCategory = 'gasto_operativo';
    component.status = 'completed';
    component.dateFrom = '2026-08-01';
    component.dateTo = '2026-08-31';
    component.clearFilters();

    expect(component.employeeId).toBe('');
    expect(service.getAll.calls.mostRecent().args[0]).toEqual({
      employee_id: undefined,
      search: undefined,
      accounting_category: undefined,
      status: undefined,
      date_from: undefined,
      date_to: undefined,
      page: 1,
      limit: 30,
    });
  });

  it('uploads a receipt from gps-frontend with the selected accounting category', () => {
    const uploaded = receipt({
      _id: 'uploaded-receipt',
      accounting_category: 'gasto_operativo',
      merchant_name: 'Papelería Central',
    });
    const service = {
      getAll: jasmine.createSpy('getAll').and.returnValue(of({ data: [uploaded], total: 1 })),
      upload: jasmine.createSpy('upload').and.returnValue(of(uploaded)),
      getEmployees: jasmine.createSpy('getEmployees').and.returnValue(of([])),
    };
    const component = new ComprobantesComponent(service as any, rootAuth);
    component.uploadModalOpen = true;
    component.uploadCategory = 'gasto_operativo';
    component.uploadEmployeeId = 'employee-1';
    component.uploadEmployees = [{ employee_id: 'employee-1', employee_name: 'Ana Pérez' }];
    component.uploadFile = new File(['image'], 'comprobante.jpg', { type: 'image/jpeg' });

    component.submitReceipt();

    expect(service.upload).toHaveBeenCalledWith(
      jasmine.any(File),
      'gasto_operativo',
      'employee-1',
    );
    expect(component.uploadModalOpen).toBeFalse();
    expect(component.success).toContain('digitalizado');
    expect(service.getAll).toHaveBeenCalled();
    expect(service.getEmployees).toHaveBeenCalled();
    expect(component.uploadEmployeeId).toBe('');
  });

  it('requires a category before uploading from gps-frontend', () => {
    const service = {
      getAll: jasmine.createSpy('getAll').and.returnValue(of({ data: [], total: 0 })),
      upload: jasmine.createSpy('upload'),
    };
    const component = new ComprobantesComponent(service as any, rootAuth);
    component.uploadFile = new File(['image'], 'comprobante.jpg', { type: 'image/jpeg' });

    component.submitReceipt();

    expect(service.upload).not.toHaveBeenCalled();
    expect(component.uploadError).toContain('Seleccione');
  });

  it('loads all eligible employees for a new receipt without preselecting the current filter', () => {
    const employees = [{ employee_id: 'employee-without-receipts', employee_name: 'Luis García' }];
    const service = { getEligibleEmployees: jasmine.createSpy('getEligibleEmployees').and.returnValue(of(employees)) };
    const component = new ComprobantesComponent(service as any, rootAuth);
    component.employeeId = 'filtered-employee';
    component.uploadEmployeeId = 'previous-selection';

    component.openUploadModal();

    expect(service.getEligibleEmployees).toHaveBeenCalled();
    expect(component.uploadEmployees).toEqual(employees);
    expect(component.uploadEmployeeId).toBe('');
    expect(component.uploadModalOpen).toBeTrue();
    component.uploadEmployeeId = 'employee-without-receipts';
    component.closeUploadModal();
    expect(component.uploadEmployeeId).toBe('');
  });

  it('rejects missing or unavailable employees before submitting the receipt', () => {
    const service = { upload: jasmine.createSpy('upload') };
    const component = new ComprobantesComponent(service as any, rootAuth);
    component.uploadFile = new File(['image'], 'comprobante.jpg', { type: 'image/jpeg' });
    component.uploadCategory = 'gasto_operativo';
    component.uploadEmployees = [{ employee_id: 'employee-1', employee_name: 'Ana Pérez' }];

    for (const employeeId of ['', 'unknown-employee']) {
      component.uploadEmployeeId = employeeId;
      component.submitReceipt();
      expect(component.uploadError).toContain('empleado que generó el gasto');
    }
    expect(service.upload).not.toHaveBeenCalled();
  });

  it('allows retrying employee loading without discarding the selected image or category', () => {
    const service = { getEligibleEmployees: jasmine.createSpy('getEligibleEmployees').and.returnValue(throwError(() => new Error('offline'))) };
    const component = new ComprobantesComponent(service as any, rootAuth);
    const file = new File(['image'], 'comprobante.jpg', { type: 'image/jpeg' });
    component.uploadFile = file;
    component.uploadCategory = 'gasto_operativo';

    component.loadUploadEmployees();

    expect(component.uploadEmployeesError).toContain('Reintente');
    expect(component.uploadEmployeesLoading).toBeFalse();
    const response = new Subject<any[]>();
    service.getEligibleEmployees.and.returnValue(response);
    component.loadUploadEmployees();
    expect(component.uploadEmployeesLoading).toBeTrue();
    expect(component.uploadEmployeesError).toBe('');
    response.next([{ employee_id: 'employee-1', employee_name: 'Ana Pérez' }]);
    response.complete();
    expect(component.uploadEmployees.length).toBe(1);
    expect(component.uploadEmployeesLoading).toBeFalse();
    expect(component.uploadFile).toBe(file);
    expect(component.uploadCategory).toBe('gasto_operativo');
  });

  it('displays separate expense and registrar identities on new receipts', () => {
    const component = new ComprobantesComponent({} as any, rootAuth);
    const uploaded = receipt({
      employee_name: 'Luis García',
      registered_by_id: 'admin-1',
      registered_by_name: 'Ana Pérez',
      registered_by_email: 'ana@example.com',
    });

    expect(component.expenseEmployeeName(uploaded)).toBe('Luis García');
    expect(component.registeredByName(uploaded)).toBe('Ana Pérez');
    expect(component.registeredByEmail(uploaded)).toBe('ana@example.com');
  });

  it('preserves the historical registrar without inventing a separate expense owner', () => {
    const component = new ComprobantesComponent({} as any, rootAuth);
    const legacy = receipt({ employee_name: 'Ana Pérez', employee_email: 'ana@example.com' });

    expect(component.expenseEmployeeName(legacy)).toBe('No especificado (registro anterior)');
    expect(component.registeredByName(legacy)).toBe('Ana Pérez');
    expect(component.registeredByEmail(legacy)).toBe('ana@example.com');
  });
});
