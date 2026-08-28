import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import {
  ExpenseReceipt,
  ExpenseReceiptsService,
} from '../../../../../../core/services/expense-receipts.service';
import { ComprobantesComponent } from './comprobantes.component';

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
      providers: [{ provide: ExpenseReceiptsService, useValue: { getAll } }],
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
});
