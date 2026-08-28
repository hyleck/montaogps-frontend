import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import {
  ExpenseReceipt,
  ExpenseReceiptsService,
} from '../../../../../../core/services/expense-receipts.service';
import { ComprobantesComponent } from './comprobantes.component';
import { AuthService } from '../../../../../../core/services/auth.service';

describe('Comprobantes scroll layout', () => {
  let fixture: ComponentFixture<ComprobantesComponent>;
  let viewport: HTMLDivElement;
  let page: HTMLElement;
  let getAll: jasmine.Spy;

  beforeEach(async () => {
    const receipts: ExpenseReceipt[] = Array.from({ length: 30 }, (_, index) => ({
      _id: `receipt-${index}`,
      employee_id: 'employee-1',
      employee_name: 'Ana Pérez',
      registered_by_id: 'admin-1',
      registered_by_name: 'Soporte Admin',
      image_url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      merchant_name: `Comercio ${index + 1}`,
      expense_date: '2026-08-28T12:00:00.000Z',
      category: 'otros',
      accounting_category: 'gasto_operativo',
      processing_status: 'completed',
    }));
    getAll = jasmine.createSpy('getAll').and.returnValue(of({ data: receipts, total: 61 }));
    await TestBed.configureTestingModule({
      declarations: [ComprobantesComponent],
      imports: [CommonModule, FormsModule],
      providers: [
        { provide: AuthService, useValue: { getCurrentUser: () => ({ root: true }) } },
        { provide: ExpenseReceiptsService, useValue: {
        getAll,
        getEmployees: () => of([
          { employee_id: 'employee-1', employee_name: 'Ana Pérez' },
          { employee_id: 'employee-2', employee_name: 'Luis Alberto García Rodríguez', employee_email: 'luis-alberto.garcia@example.com' },
        ]),
        getEligibleEmployees: () => of([
          { employee_id: 'employee-new', employee_name: 'María Rodríguez', employee_email: 'maria@example.com' },
        ]),
      } }],
    }).compileComponents();

    fixture = TestBed.createComponent(ComprobantesComponent);
    // The admin layout clips its routed content; each module must own its scroll.
    viewport = document.createElement('div');
    viewport.style.cssText = 'position: fixed; top: 0; left: 0; width: 1120px; height: 540px; overflow: hidden;';
    document.body.appendChild(viewport);
    viewport.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    page = fixture.nativeElement.querySelector('.receipts-page');
  });

  afterEach(() => {
    fixture?.destroy();
    viewport?.remove();
  });

  for (const size of [{ width: 1120, height: 540 }, { width: 375, height: 320 }]) {
    it(`allows scrolling to the last receipt and pagination in a ${size.width}x${size.height} panel`, () => {
      viewport.style.width = `${size.width}px`;
      viewport.style.height = `${size.height}px`;

      expect(page.clientHeight).toBe(size.height);
      expect(getComputedStyle(page).overflowY).toBe('auto');
      expect(page.scrollHeight).toBeGreaterThan(page.clientHeight);

      page.scrollTop = page.scrollHeight;

      expect(page.scrollTop).toBeGreaterThan(0);
      const lastCard = page.querySelector<HTMLElement>('.receipt-card:last-child')!;
      const pagination = page.querySelector<HTMLElement>('.pagination')!;
      expect(lastCard.getBoundingClientRect().bottom).toBeLessThanOrEqual(page.getBoundingClientRect().bottom);
      expect(pagination.getBoundingClientRect().top).toBeGreaterThanOrEqual(page.getBoundingClientRect().top);
      expect(pagination.getBoundingClientRect().bottom).toBeLessThanOrEqual(page.getBoundingClientRect().bottom);
      expect(viewport.scrollTop).toBe(0);
    });
  }

  it('adapts to changes in the available admin height', () => {
    viewport.style.height = '280px';
    expect(page.clientHeight).toBe(280);
    viewport.style.height = '620px';
    expect(page.clientHeight).toBe(620);
    expect(page.scrollHeight).toBeGreaterThan(page.clientHeight);
  });

  it('scrolls the receipts panel, not the window, when changing pages', () => {
    const panelScroll: jasmine.Spy = spyOn(page, 'scrollTo');
    const windowScroll = spyOn(window, 'scrollTo');

    page.querySelector<HTMLButtonElement>('.pagination button:last-child')!.click();

    expect(getAll).toHaveBeenCalledWith(jasmine.objectContaining({ page: 2 }));
    expect(panelScroll).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    expect(windowScroll).not.toHaveBeenCalled();
  });

  it('does not scroll or reload when the requested page is invalid or unchanged', () => {
    const panelScroll = spyOn(page, 'scrollTo');
    getAll.calls.reset();

    for (const pageNumber of [0, 1, 4]) fixture.componentInstance.changePage(pageNumber);

    expect(panelScroll).not.toHaveBeenCalled();
    expect(getAll).not.toHaveBeenCalled();
  });

  it('applies the selected employee from the dropdown and resets it with Limpiar', async () => {
    const select = page.querySelector<HTMLSelectElement>('#receipt-employee-filter')!;
    expect(select.options.length).toBe(3);
    expect(select.options[0].textContent).toContain('Todos los empleados');
    expect(select.options[2].textContent).toContain('Luis Alberto');
    select.value = 'employee-2';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    page.querySelector<HTMLButtonElement>('.apply-btn')!.click();

    expect(getAll).toHaveBeenCalledWith(jasmine.objectContaining({ employee_id: 'employee-2', page: 1 }));

    page.querySelector<HTMLButtonElement>('.clear-btn')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(select.value).toBe('');
    expect(getAll.calls.mostRecent().args[0].employee_id).toBeUndefined();
  });

  for (const width of [1600, 1120, 760, 375]) {
    it(`keeps every filter within its own column in a ${width}px panel`, () => {
      viewport.style.width = `${width}px`;
      const filters = page.querySelector<HTMLElement>('.filters-card')!;
      expect(filters.scrollWidth).toBeLessThanOrEqual(filters.clientWidth);
      for (const control of Array.from(filters.querySelectorAll<HTMLElement>('input, select'))) {
        const column = control.closest('label')!.getBoundingClientRect();
        const bounds = control.getBoundingClientRect();
        expect(bounds.left).toBeGreaterThanOrEqual(column.left);
        expect(bounds.right).toBeLessThanOrEqual(column.right + 1);
      }
    });
  }

  it('requires selecting the expense employee in the upload modal', async () => {
    page.querySelector<HTMLButtonElement>('.upload-receipt-btn')!.click();
    fixture.componentInstance.uploadCategory = 'gasto_operativo';
    fixture.componentInstance.uploadFile = new File(['image'], 'comprobante.jpg', { type: 'image/jpeg' });
    fixture.detectChanges();
    await fixture.whenStable();
    const select = fixture.nativeElement.querySelector('#receipt-upload-employee') as HTMLSelectElement;
    const submit = fixture.nativeElement.querySelector('.upload-submit-btn') as HTMLButtonElement;

    expect(select.value).toBe('');
    expect(select.options[0].textContent).toContain('Seleccione un empleado');
    expect(select.options[1].textContent).toContain('María Rodríguez');
    expect(submit.disabled).toBeTrue();
    select.value = 'employee-new';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(submit.disabled).toBeFalse();
  });

  it('shows the expense owner and registrar on cards and in the detail modal', () => {
    const card = page.querySelector<HTMLElement>('.receipt-card')!;
    expect(card.textContent).toContain('Gasto generado porAna Pérez');
    expect(card.textContent).toContain('Registrado porSoporte Admin');

    card.click();
    fixture.detectChanges();
    const details = fixture.nativeElement.querySelector('.detail-grid') as HTMLElement;
    expect(details.textContent).toContain('Gasto generado porAna Pérez');
    expect(details.textContent).toContain('Registrado porSoporte Admin');
  });

  it('does not define hover effects or transitions for receipt cards and their images', () => {
    const card = page.querySelector<HTMLElement>('.receipt-card')!;
    const image = card.querySelector('img')!;
    expect(getComputedStyle(card).transitionDuration).toBe('0s');
    expect(getComputedStyle(image).transitionDuration).toBe('0s');
    expect(getComputedStyle(card).transform).toBe('none');
    expect(getComputedStyle(image).transform).toBe('none');

    const checkRules = (rules: CSSRuleList) => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSStyleRule && rule.selectorText.includes('.receipt-card')) {
          expect(rule.selectorText).not.toContain(':hover');
        }
        if (rule instanceof CSSMediaRule) checkRules(rule.cssRules);
      }
    };
    for (const sheet of Array.from(document.styleSheets)) {
      if (!sheet.href || sheet.href.startsWith(location.origin)) checkRules(sheet.cssRules);
    }
  });

  it('opens an editable root form without losing the current employee and allows cancelling', async () => {
    page.querySelector<HTMLButtonElement>('.receipt-actions button')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const form = fixture.nativeElement.querySelector('.receipt-edit-form') as HTMLFormElement;
    expect(form).toBeTruthy();
    const employee = form.querySelector<HTMLSelectElement>('select[name="editEmployee"]')!;
    expect(employee.value).toBe('employee-1');
    expect(form.querySelector('input[name="editNcf"]')).toBeTruthy();
    expect(form.querySelector('input[name="editTotal"]')).toBeTruthy();
    expect(form.textContent).toContain('El usuario que registró el comprobante se conserva');
    for (const control of Array.from(form.querySelectorAll<HTMLElement>('input, select, textarea'))) {
      expect(control.getBoundingClientRect().right).toBeLessThanOrEqual(form.getBoundingClientRect().right + 1);
    }
    form.querySelector<HTMLButtonElement>('.receipt-actions button[type="button"]')!.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.receipt-edit-form')).toBeNull();
  });

  it('hides editing and deletion controls for a non-root account', () => {
    spyOn(TestBed.inject(AuthService), 'getCurrentUser').and.returnValue({ root: false } as any);
    fixture.detectChanges();
    expect(page.querySelector('.receipt-actions')).toBeNull();
    page.querySelector<HTMLElement>('.receipt-card')!.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.modal-content .receipt-actions')).toBeNull();
  });

  it('shows a specific confirmation before deleting a receipt', () => {
    page.querySelector<HTMLButtonElement>('.receipt-actions .delete-receipt-btn')!.click();
    fixture.detectChanges();
    const confirmation = fixture.nativeElement.querySelector('.delete-confirmation') as HTMLElement;
    expect(confirmation.textContent).toContain('¿Borrar este comprobante?');
    expect(confirmation.textContent).toContain('Comercio 1');
    confirmation.querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.delete-confirmation')).toBeNull();
  });
});
