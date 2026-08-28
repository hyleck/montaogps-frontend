import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, Subject } from 'rxjs';
import { globalPalette } from '../../../../../../global.palette';
import { InventoryLotPage, InventoryService } from '../../../../../../core/services/inventory.service';
import { managementPalette } from '../../../../management/presentation/components/management/managemente.palette';
import { InventoryLotsComponent } from './inventory-lots.component';

describe('Inventory lots design', () => {
  let fixture: ComponentFixture<InventoryLotsComponent>;
  let component: InventoryLotsComponent;
  let host: HTMLElement;
  let inventory: jasmine.SpyObj<InventoryService>;
  const page: InventoryLotPage = {
    total: 1, total_quantity: 1240, page: 1, lastPage: 1,
    data: [{ _id: 'lot-1', category: 'relay', name: 'Compra agosto · Relay 12V para instalaciones', quantity: 1240,
      createdAt: '2026-08-28T12:00:00Z', balances: [
        { storage_id: { _id: 'warehouse-1', name: 'Almacén del equipo técnico de Santo Domingo' }, quantity: 1200 },
        { storage_id: null, quantity: 40 },
      ] }],
  };

  beforeEach(async () => {
    inventory = jasmine.createSpyObj('InventoryService', ['getLots', 'createLot', 'getLot']);
    inventory.getLots.and.returnValue(of(page));
    inventory.createLot.and.returnValue(of(page.data[0]));
    inventory.getLot.and.returnValue(of({ ...page.data[0], version: 2, stock_locked: true, pending_transfer: false }));
    await TestBed.configureTestingModule({
      imports: [InventoryLotsComponent, NoopAnimationsModule],
      providers: [{ provide: InventoryService, useValue: inventory }],
    }).compileComponents();
    fixture = TestBed.createComponent(InventoryLotsComponent);
    component = fixture.componentInstance;
    host = fixture.nativeElement;
    host.style.width = '1280px';
    fixture.componentRef.setInput('canCreate', true);
    fixture.componentRef.setInput('category', 'relay');
    fixture.detectChanges();
    await fixture.whenStable();
  });
  afterEach(() => fixture.destroy());

  function theme(mode: 'light' | 'dark'): void {
    Object.entries({ ...globalPalette[mode], ...managementPalette[mode] })
      .forEach(([key, value]) => host.style.setProperty(`--${key}`, value));
    host.classList.toggle('app-dark', mode === 'dark');
    host.style.backgroundColor = managementPalette[mode].managementColorBackgroundUser;
  }
  function element(selector: string): HTMLElement { return host.querySelector<HTMLElement>(selector)!; }
  function inside(child: Element, parent: Element): void {
    const rect = child.getBoundingClientRect();
    const bounds = parent.getBoundingClientRect();
    expect(rect.width).withContext(child.className).toBeGreaterThan(0);
    expect(rect.left).withContext(child.className).toBeGreaterThanOrEqual(bounds.left - 1);
    expect(rect.right).withContext(child.className).toBeLessThanOrEqual(bounds.right + 1);
  }
  function rgb(value: string): number[] {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3);
  }
  function luminance(color: string): number {
    return rgb(color).map(value => {
      const channel = value / 255;
      return channel <= .04045 ? channel / 12.92 : Math.pow((channel + .055) / 1.055, 2.4);
    }).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
  }
  function readable(selector: string, background: Element, pseudo?: string): void {
    const foreground = luminance(getComputedStyle(element(selector), pseudo).color);
    const surface = luminance(getComputedStyle(background).backgroundColor);
    const ratio = (Math.max(foreground, surface) + .05) / (Math.min(foreground, surface) + .05);
    expect(ratio).withContext(`${selector} contrast`).toBeGreaterThanOrEqual(4.5);
  }

  for (const mode of ['light', 'dark'] as const) {
    for (const width of [1280, 720, 320]) {
      it(`keeps edit/delete actions inside their table cells at ${width}px in ${mode}`, () => {
        theme(mode);
        fixture.componentRef.setInput('canUpdate', true);
        fixture.componentRef.setInput('canDelete', true);
        host.style.width = `${width}px`;
        fixture.detectChanges();
        for (const create of [true, false]) {
          fixture.componentRef.setInput('canCreate', create);
          fixture.detectChanges();
          for (const controls of Array.from(host.querySelectorAll('.lot-edit-actions'))) {
            inside(controls, controls.closest('td')!);
            for (const button of Array.from(controls.children)) inside(button, controls.closest('td')!);
            expect(controls.children[0].getBoundingClientRect().right).toBeLessThanOrEqual(controls.children[1].getBoundingClientRect().left);
          }
          const scroll = element('.lot-table-scroll');
          scroll.scrollLeft = scroll.scrollWidth;
          inside(element('.lot-edit'), scroll);
          inside(element('.lot-delete'), scroll);
          readable('.lot-edit', element('.lot-edit'));
          readable('.lot-delete', element('.lot-delete'));
          expect(element('.lot-section').scrollWidth).toBeLessThanOrEqual(element('.lot-section').clientWidth + 1);
        }
      });
    }

    it(`themes the deletion confirmation and full warehouse distribution in ${mode}`, async () => {
      theme(mode);
      fixture.componentRef.setInput('canDelete', true);
      fixture.detectChanges();
      component.openDelete(component.rows[0]);
      fixture.detectChanges();
      await fixture.whenStable();
      const dialog = element('.inventory-lot-delete-dialog');
      dialog.style.width = '320px';
      dialog.style.maxWidth = 'none';
      dialog.style.flexShrink = '0';
      expect(rgb(getComputedStyle(dialog).backgroundColor)).toEqual(rgb(managementPalette[mode].managementColorBackgroundUser));
      expect(element('.lot-delete-summary').textContent).toContain('1,240');
      readable('.lot-delete-summary > strong', element('.p-dialog-content'));
      readable('.lot-distribution', element('.lot-distribution'));
      readable('.lot-confirm-delete', element('.lot-confirm-delete'));
      for (const control of Array.from(dialog.querySelectorAll('.lot-distribution > div > *, .lot-form-footer button'))) inside(control, element('.lot-form'));
      expect(element('.lot-form').scrollWidth).toBeLessThanOrEqual(element('.lot-form').clientWidth + 1);
    });

    it(`renders locked edit controls and warehouse balances in ${mode}`, async () => {
      theme(mode);
      fixture.componentRef.setInput('canUpdate', true);
      fixture.detectChanges();
      component.openEdit(component.rows[0]);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(element('.p-dialog-header').textContent).toContain('Editar lote');
      expect((element('input[name="quantity"]') as HTMLInputElement).disabled).toBeTrue();
      readable('.lot-distribution', element('.lot-distribution'));
      readable('.lot-form-note p', element('.lot-form-note'));
      expect(element('.lot-distribution').textContent).toContain('Almacén del equipo técnico');
    });

    for (const category of ['relay', 'cables'] as const) {
      for (const width of [1280, 960, 720, 390, 320]) {
        it(`keeps ${category} filters and table controls aligned at ${width}px in ${mode}`, () => {
          theme(mode);
          fixture.componentRef.setInput('category', category);
          component.query = 'Compra';
          host.style.width = `${width}px`;
          fixture.detectChanges();
          const section = element('.lot-section');
          expect(section.scrollWidth).toBeLessThanOrEqual(section.clientWidth + 1);
          for (const selector of ['.lot-header', '.lot-filters', '.lot-panel']) inside(element(selector), section);
          for (const control of Array.from(host.querySelectorAll('.lot-filters input, .lot-filters select, .lot-filters button'))) {
            inside(control, element('.lot-filters'));
            expect(control.scrollWidth).toBeLessThanOrEqual(control.clientWidth + 1);
          }
          const controls = Array.from(host.querySelectorAll('.lot-filter-actions button'));
          expect(controls[0].getBoundingClientRect().right).toBeLessThanOrEqual(controls[1].getBoundingClientRect().left);
          for (const cell of Array.from(host.querySelectorAll('tbody td'))) {
            for (const child of Array.from(cell.children)) inside(child, cell);
          }
          const scroll = element('.lot-table-scroll');
          inside(scroll, element('.lot-panel'));
          if (width < 880) {
            scroll.scrollLeft = scroll.scrollWidth;
            expect(scroll.scrollLeft).toBeGreaterThan(0);
            inside(element('tbody tr:first-child .lot-button--send'), scroll);
          }
        });
      }
    }

    it(`uses the actual inventory ${mode} palette with readable labels and fields`, () => {
      theme(mode);
      const input = element('.lot-filters input');
      expect(rgb(getComputedStyle(input).backgroundColor)).toEqual(rgb(managementPalette[mode].managementColorInputSearch));
      expect(rgb(getComputedStyle(element('.lot-panel')).backgroundColor)).toEqual(rgb(managementPalette[mode].managementColorCardBackground));
      expect(getComputedStyle(input).colorScheme).toBe(mode);
      readable('.lot-heading h2', host);
      readable('.lot-heading p', host);
      readable('.lot-kicker', host);
      readable('.lot-field > span', element('.lot-filters'));
      readable('.lot-filters input', input);
      readable('.lot-filters input', input, '::placeholder');
      readable('.lot-button--primary', element('.lot-button--primary'));
      readable('.lot-button--search', element('.lot-button--search'));
      readable('.lot-identity strong', element('tbody td'));
      readable('.lot-identity small', element('tbody td'));
      readable('.lot-stock b', element('.lot-stock'));
    });

    it(`themes the registration dialog and all native controls in ${mode}`, async () => {
      theme(mode);
      component.openNew();
      fixture.detectChanges();
      await fixture.whenStable();
      await fixture.whenRenderingDone();
      const dialog = element('.inventory-lot-dialog');
      expect(rgb(getComputedStyle(dialog).backgroundColor)).toEqual(rgb(managementPalette[mode].managementColorBackgroundUser));
      expect(rgb(getComputedStyle(element('.p-dialog-header')).backgroundColor)).toEqual(rgb(managementPalette[mode].managementColorCardBackground));
      expect(element('.p-dialog-header').textContent).toContain('Nueva entrada de inventario');
      for (const selector of ['input[name="name"]', 'input[name="quantity"]', 'select[name="initialStorage"]', 'textarea']) {
        const input = element(`.lot-form ${selector}`);
        expect(rgb(getComputedStyle(input).backgroundColor)).toEqual(rgb(managementPalette[mode].managementColorInputSearch));
        readable(`.lot-form ${selector}`, input);
      }
      dialog.style.width = '340px';
      dialog.style.maxWidth = 'none';
      dialog.style.flexShrink = '0';
      for (const control of Array.from(dialog.querySelectorAll('input, select, textarea, .lot-form-footer button'))) inside(control, element('.lot-form'));
      const form = element('.lot-form');
      expect(form.scrollWidth).toBeLessThanOrEqual(form.clientWidth + 1);
      readable('.lot-form-note p', element('.lot-form-note'));
    });

    it(`keeps empty states readable in ${mode} and offers a registration action`, () => {
      theme(mode);
      inventory.getLots.and.returnValue(of({ ...page, data: [], total: 0, total_quantity: 0 }));
      component.load();
      fixture.detectChanges();
      readable('.lot-empty strong', element('.lot-panel'));
      readable('.lot-empty p', element('.lot-panel'));
      element('.lot-empty button').click();
      expect(component.formVisible).toBeTrue();
    });
  }

  it('updates colors immediately when the user changes theme', () => {
    theme('light');
    const input = element('.lot-filters input');
    const light = getComputedStyle(input).backgroundColor;
    theme('dark');
    expect(getComputedStyle(input).backgroundColor).not.toBe(light);
    theme('light');
    expect(getComputedStyle(input).backgroundColor).toBe(light);
  });

  it('clears filters from the empty state without changing the selected inventory category', () => {
    inventory.getLots.and.returnValue(of({ ...page, data: [], total: 0, total_quantity: 0 }));
    component.query = 'Missing';
    component.storage = 'unassigned';
    component.load(2);
    fixture.detectChanges();
    expect(element('.lot-empty strong').textContent).toBe('No se encontraron lotes');
    element('.lot-empty button').click();
    expect(component.hasFilters).toBeFalse();
    expect(inventory.getLots).toHaveBeenCalledWith('relay', '', '', 1);
  });

  it('keeps the mixed-product picker responsive and preserves the selected source and quantity', () => {
    fixture.componentRef.setInput('category', '');
    fixture.componentRef.setInput('picker', true);
    host.style.width = '350px';
    fixture.detectChanges();
    inside(element('select[name="category"]'), element('.lot-filters'));
    expect(host.querySelector('.lot-header button')).toBeNull();
    const emitted = spyOn(component.selectLot, 'emit');
    component.quantities[component.rows[0].key] = 7;
    fixture.detectChanges();
    element('tbody button').click();
    expect(emitted).toHaveBeenCalledWith(jasmine.objectContaining({ lot_id: 'lot-1', source_warehouse: 'warehouse-1', quantity: 7 }));
  });

  it('does not display old balances as current data during loading or after an error', () => {
    const pending = new Subject<InventoryLotPage>();
    inventory.getLots.and.returnValue(pending);
    component.load();
    fixture.detectChanges();
    expect(host.querySelector('.lot-summary')).toBeNull();
    expect(host.querySelector('table')).toBeNull();
    expect(element('[role="status"]').textContent).toContain('Cargando lotes');
    pending.error({ error: { message: 'Sin conexión' } });
    fixture.detectChanges();
    expect(host.querySelector('.lot-summary')).toBeNull();
    expect(element('[role="alert"]').textContent).toContain('Sin conexión');
    inventory.getLots.and.returnValue(of(page));
    element('[role="alert"] button').click();
    fixture.detectChanges();
    expect(host.querySelector('table')).not.toBeNull();
  });

  it('hides registration and transfer controls for read-only users including empty states', () => {
    fixture.componentRef.setInput('canCreate', false);
    inventory.getLots.and.returnValue(of({ ...page, data: [], total: 0, total_quantity: 0 }));
    fixture.detectChanges();
    expect(host.querySelector('.lot-empty button')).toBeNull();
    expect(host.querySelector('.lot-header button')).toBeNull();
  });
});
