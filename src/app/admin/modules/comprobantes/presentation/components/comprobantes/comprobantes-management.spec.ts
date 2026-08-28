import { of, Subject, throwError } from 'rxjs';
import { ExpenseReceipt } from '../../../../../../core/services/expense-receipts.service';
import { ComprobantesComponent } from './comprobantes.component';

describe('Root receipt management', () => {
  const receipt: ExpenseReceipt = {
    _id: 'receipt-1', employee_id: 'employee-1', employee_name: 'Ana',
    registered_by_id: 'registrar-1', registered_by_name: 'Pedro',
    image_url: 'https://example.com/invoice.jpg', merchant_name: 'Comercio',
    ncf: 'B020000001', accounting_category: 'gasto_operativo', category: 'otros',
    total_amount: 100, currency: 'DOP', processing_status: 'completed',
    expense_date: '2026-08-28T12:00:00Z', updatedAt: '2026-08-28T14:00:00Z',
  };

  function setup(root: boolean | string = true) {
    const service = {
      update: jasmine.createSpy('update').and.returnValue(of({ ...receipt, total_amount: 200 })),
      remove: jasmine.createSpy('remove').and.returnValue(of({ deleted: true, id: receipt._id })),
      getEligibleEmployees: jasmine.createSpy().and.returnValue(of([{ employee_id: 'employee-2', employee_name: 'Luis' }])),
      getEmployees: jasmine.createSpy().and.returnValue(of([])),
      getAll: jasmine.createSpy().and.returnValue(of({ data: [], total: 0 })),
    };
    return { service, component: new ComprobantesComponent(service as any, { getCurrentUser: () => ({ root }) } as any) };
  }

  it('edits extracted fields but never sends or changes the original registrar', () => {
    const { component, service } = setup('true');
    component.startEditing(receipt);
    expect(component.editEmployees.map(item => item.employee_id)).toEqual(['employee-1', 'employee-2']);
    component.editDraft.total_amount = 200;
    expect(receipt.total_amount).toBe(100);

    component.saveEditedReceipt();

    expect(service.update).toHaveBeenCalledWith('receipt-1', jasmine.objectContaining({ total_amount: 200, employee_id: 'employee-1', expected_updated_at: receipt.updatedAt, expense_date: '2026-08-28' }));
    const payload = service.update.calls.mostRecent().args[1];
    expect(payload.registered_by_id).toBeUndefined();
    expect(payload.registered_by_name).toBeUndefined();
    expect(component.selectedReceipt?.registered_by_name).toBe('Pedro');
    expect(component.editingReceipt).toBeFalse();
    expect(service.getAll).toHaveBeenCalled();
  });

  it('does not save or delete from a non-root session', () => {
    const { component, service } = setup('false');
    expect(component.canManageReceipts).toBeFalse();
    component.startEditing(receipt);
    component.requestDelete(receipt);
    component.selectedReceipt = receipt;
    component.editingReceipt = true;
    component.deleteConfirmation = true;
    component.saveEditedReceipt();
    component.confirmDelete();
    expect(service.update).not.toHaveBeenCalled();
    expect(service.remove).not.toHaveBeenCalled();
  });

  it('keeps the draft and displays a server duplicate error without closing the editor', () => {
    const { component, service } = setup();
    service.update.and.returnValue(throwError(() => ({ status: 409, error: { message: 'Este comprobante ya está registrado.' } })));
    component.startEditing(receipt);
    component.editDraft.ncf = 'DUPLICATE';
    component.saveEditedReceipt();
    expect(component.detailError).toContain('ya está registrado');
    expect(component.editingReceipt).toBeTrue();
    expect(component.editDraft.ncf).toBe('DUPLICATE');
    expect(component.selectedReceipt).toBe(receipt);
  });

  it('requires deletion confirmation, preserves filters and moves back from an empty last page', () => {
    const { component, service } = setup();
    component.selectedReceipt = receipt;
    component.confirmDelete();
    expect(service.remove).not.toHaveBeenCalled();
    component.total = 31;
    component.page = 2;
    component.employeeId = 'employee-1';
    component.requestDelete(receipt);
    expect(service.remove).not.toHaveBeenCalled();
    component.confirmDelete();
    expect(service.remove).toHaveBeenCalledWith(receipt._id, receipt.updatedAt);
    expect(component.selectedReceipt).toBeNull();
    expect(component.page).toBe(1);
    expect(component.employeeId).toBe('employee-1');
    expect(service.getAll).toHaveBeenCalledWith(jasmine.objectContaining({ employee_id: 'employee-1', page: 1 }));
  });

  it('disables duplicate submissions and closing the editor while saving', () => {
    const { component, service } = setup();
    const response = new Subject<ExpenseReceipt>();
    service.update.and.returnValue(response);
    component.startEditing(receipt);
    component.saveEditedReceipt();
    component.saveEditedReceipt();
    component.closeReceipt();
    component.requestDelete(receipt);
    expect(service.update).toHaveBeenCalledTimes(1);
    expect(component.selectedReceipt).toBe(receipt);
    expect(component.deleteConfirmation).toBeFalse();
    response.next(receipt);
    response.complete();
    expect(component.receiptBusy).toBeFalse();
  });

  it('retains the selected receipt if deletion fails', () => {
    const { component, service } = setup();
    service.remove.and.returnValue(throwError(() => ({ error: { message: 'El comprobante fue modificado.' } })));
    component.requestDelete(receipt);
    component.confirmDelete();
    expect(component.selectedReceipt).toBe(receipt);
    expect(component.detailError).toContain('modificado');
    expect(component.deletingReceipt).toBeFalse();
  });
});
