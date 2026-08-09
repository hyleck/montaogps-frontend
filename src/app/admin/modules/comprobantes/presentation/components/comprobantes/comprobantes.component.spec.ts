import { of } from 'rxjs';
import { ExpenseReceipt } from '../../../../../../core/services/expense-receipts.service';
import { ComprobantesComponent } from './comprobantes.component';

describe('ComprobantesComponent', () => {
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
    const component = new ComprobantesComponent(service as any);
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

  it('sends date and employee-selected category filters to the root endpoint', () => {
    const service = { getAll: jasmine.createSpy('getAll').and.returnValue(of({ data: [], total: 0 })) };
    const component = new ComprobantesComponent(service as any);
    component.accountingCategory = 'gasto_representacion';
    component.dateFrom = '2026-08-01';
    component.dateTo = '2026-08-31';

    component.applyFilters();

    expect(service.getAll).toHaveBeenCalledWith(jasmine.objectContaining({
      accounting_category: 'gasto_representacion',
      date_from: '2026-08-01',
      date_to: '2026-08-31',
      page: 1,
    }));
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
    };
    const component = new ComprobantesComponent(service as any);
    component.uploadModalOpen = true;
    component.uploadCategory = 'gasto_operativo';
    component.uploadFile = new File(['image'], 'comprobante.jpg', { type: 'image/jpeg' });

    component.submitReceipt();

    expect(service.upload).toHaveBeenCalledWith(
      jasmine.any(File),
      'gasto_operativo',
    );
    expect(component.uploadModalOpen).toBeFalse();
    expect(component.success).toContain('digitalizado');
    expect(service.getAll).toHaveBeenCalled();
  });

  it('requires a category before uploading from gps-frontend', () => {
    const service = {
      getAll: jasmine.createSpy('getAll').and.returnValue(of({ data: [], total: 0 })),
      upload: jasmine.createSpy('upload'),
    };
    const component = new ComprobantesComponent(service as any);
    component.uploadFile = new File(['image'], 'comprobante.jpg', { type: 'image/jpeg' });

    component.submitReceipt();

    expect(service.upload).not.toHaveBeenCalled();
    expect(component.uploadError).toContain('Seleccione');
  });
});
