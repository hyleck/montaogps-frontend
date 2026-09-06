import { of, Subject, throwError } from 'rxjs';
import { ExpenseReceipt } from '../../../../../../core/services/expense-receipts.service';
import { ComprobantesComponent } from './comprobantes.component';

describe('Private receipt evidence and review', () => {
  const receipt: ExpenseReceipt = { _id: 'receipt-1', employee_id: 'staff', employee_name: 'Staff', image_url: 'https://must-not-be-used.invalid/private.jpg', category: 'otros', processing_status: 'completed', updatedAt: '2026-09-05T12:00:00.000Z', total_amount: 118, review_status: 'pending_review' };
  function setup() {
    const service = {
      getAll: jasmine.createSpy().and.returnValue(of({ data: [receipt], total: 1 })),
      getAttachment: jasmine.createSpy().and.returnValue(of(new Blob(['fixture']))),
      getHistory: jasmine.createSpy().and.returnValue(of([])),
      review: jasmine.createSpy().and.returnValue(of({ ...receipt, review_status: 'reviewed' })),
    };
    const component = new ComprobantesComponent(service as any, { getCurrentUser: () => ({ root: true }) } as any);
    return { component, service };
  }
  it('fetches private blobs and revokes them when refreshing and leaving the screen', () => {
    const { component, service } = setup();
    spyOn(URL, 'createObjectURL').and.returnValues('blob:first', 'blob:second');
    const revoke = spyOn(URL, 'revokeObjectURL');
    component.loadReceipts();
    expect(service.getAttachment).toHaveBeenCalledWith('receipt-1');
    expect(component.attachmentUrls['receipt-1']).toBe('blob:first');
    component.loadReceipts();
    expect(revoke).toHaveBeenCalledWith('blob:first');
    component.ngOnDestroy();
    expect(revoke).toHaveBeenCalledWith('blob:second');
    expect(component.attachmentUrls).toEqual({});
  });
  it('cancels an old history request before selecting another receipt', () => {
    const { component, service } = setup();
    const old = new Subject<any[]>();
    service.getHistory.and.returnValues(old, of([{ revision: 2, action: 'edited' }]));
    component.openReceipt(receipt);
    component.openReceipt({ ...receipt, _id: 'receipt-2' });
    old.next([{ revision: 99, action: 'stale' }]);
    expect(component.receiptHistory.map(entry => entry.revision)).toEqual([2]);
    component.ngOnDestroy();
  });
  it('requires a fresh explicit review and keeps an error visible after a conflict', () => {
    const { component, service } = setup();
    service.review.and.returnValue(throwError(() => ({ error: { message: 'La versión cambió' } })));
    component.openReceipt(receipt);
    component.markReviewed();
    expect(service.review).toHaveBeenCalledWith(receipt._id, receipt.updatedAt);
    expect(component.selectedReceipt?.review_status).toBe('pending_review');
    expect(component.detailError).toContain('versión');
    component.ngOnDestroy();
  });
  it('does not invent a currency or expense date from the upload timestamp', () => {
    const { component } = setup();
    expect(component.displayAmount(receipt)).toContain('moneda no detectada');
    expect(component.displayReceiptDate({ ...receipt, createdAt: '2026-09-05T12:00:00Z' })).toBe('Fecha no detectada');
  });
});
