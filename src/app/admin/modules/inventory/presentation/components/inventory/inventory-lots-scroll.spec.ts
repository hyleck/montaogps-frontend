import { CommonModule } from '@angular/common';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { AuthService } from '../../../../../../core/services/auth.service';
import { InventoryService } from '../../../../../../core/services/inventory.service';
import { ProtocolsService } from '../../../../../../core/services/protocols.service';
import { SystemService } from '../../../../../../core/services/system.service';
import { UserService } from '../../../../../../core/services/user.service';
import { PrimengModule } from '../../../../../../shareds/libraries/primeng/primeng.module';
import { InventoryLotsComponent } from '../inventory-lots/inventory-lots.component';
import { InventoryComponent } from './inventory.component';

describe('Inventory lots scrolling inside the admin viewport', () => {
  let fixture: ComponentFixture<InventoryComponent>;
  let viewport: HTMLElement;
  let host: HTMLElement;
  let inventory: { getLots: jasmine.Spy };

  beforeEach(async () => {
    spyOn(InventoryComponent.prototype, 'ngOnInit').and.stub();
    inventory = {
      getLots: jasmine.createSpy().and.callFake((category, _storage, _query, page = 1) => of({
        total: 50, total_quantity: 5000, page, lastPage: 2,
        data: Array.from({ length: 25 }, (_, index) => ({
          _id: `lot-${page}-${index}`, category, name: `Lote ${page}-${index + 1}`,
          quantity: 100, balances: [{ storage_id: { _id: 'origin', name: 'Almacén principal' }, quantity: 100 }],
        })),
      })),
    };
    await TestBed.configureTestingModule({
      declarations: [InventoryComponent],
      imports: [CommonModule, FormsModule, NoopAnimationsModule, TranslateModule.forRoot(), PrimengModule, InventoryLotsComponent],
      providers: [provideRouter([]),
        { provide: InventoryService, useValue: inventory },
        { provide: ProtocolsService, useValue: {} },
        { provide: AuthService, useValue: { hasPrivilege: () => true } },
        { provide: UserService, useValue: {} },
        { provide: SystemService, useValue: {} },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(InventoryComponent);
    host = fixture.nativeElement;
    // The real .admin__body has a bounded height and overflow:hidden.
    // An unconstrained standalone lots fixture cannot reproduce the clipped list.
    viewport = document.createElement('div');
    viewport.style.cssText = 'width:1200px;height:650px;min-height:0;overflow:hidden;position:relative;';
    host.parentNode!.insertBefore(viewport, host);
    viewport.appendChild(host);
    fixture.componentInstance.loading = false;
    fixture.componentInstance.currentView = 'relay';
    fixture.componentInstance.warehouses = [{ _id: 'origin', name: 'Almacén principal', min_quantity: 0 }];
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    viewport.remove();
  });

  function element(selector: string): HTMLElement {
    return host.querySelector<HTMLElement>(selector)!;
  }

  function verticallyInside(child: HTMLElement, parent: HTMLElement): void {
    const rect = child.getBoundingClientRect();
    const bounds = parent.getBoundingClientRect();
    expect(rect.height).withContext(child.className).toBeGreaterThan(0);
    expect(rect.top).withContext(child.className).toBeGreaterThanOrEqual(bounds.top - 1);
    expect(rect.bottom).withContext(child.className).toBeLessThanOrEqual(bounds.bottom + 1);
  }

  for (const category of ['relay', 'cables'] as const) {
    for (const [width, height] of [[1200, 650], [900, 450], [390, 650], [320, 430]]) {
      it(`can reach the last ${category} row, its actions and pagination in ${width}×${height}px`, async () => {
        viewport.style.width = `${width}px`;
        viewport.style.height = `${height}px`;
        fixture.componentInstance.switchView(category);
        fixture.detectChanges();
        await fixture.whenStable();

        const content = element('.inventory-container');
        expect(getComputedStyle(content).overflowY).toBe('auto');
        verticallyInside(content, viewport);
        expect(content.scrollHeight).toBeGreaterThan(content.clientHeight);
        content.scrollTop = content.scrollHeight;
        expect(content.scrollTop).toBeGreaterThan(0);
        verticallyInside(element('.lot-pagination'), viewport);

        const table = element('.lot-table-scroll');
        expect(table.scrollHeight).toBeGreaterThan(table.clientHeight);
        table.scrollTop = table.scrollHeight;
        table.scrollLeft = table.scrollWidth;
        expect(table.scrollTop).toBeGreaterThan(0);
        const lastActions = element('tbody tr:last-child .lot-row-actions');
        verticallyInside(lastActions, table);
        verticallyInside(lastActions, viewport);
        expect(lastActions.getBoundingClientRect().right).toBeLessThanOrEqual(table.getBoundingClientRect().right + 1);
        if (width < 900) expect(table.scrollLeft).toBeGreaterThan(0);
        expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth + 1);

        element('.lot-pagination button:last-child').click();
        fixture.detectChanges();
        await fixture.whenStable();
        expect(inventory.getLots).toHaveBeenCalledWith(category, '', '', 2);
        expect(element('.lot-pagination').textContent).toContain('Página 2 de 2');
        expect(element('tbody tr:first-child').textContent).toContain('Lote 2-1');
      });
    }
  }

  it('does not change the scroll layout of devices or SIM cards when switching tabs', () => {
    for (const view of ['devices', 'simcards'] as const) {
      fixture.componentInstance.currentView = view;
      fixture.detectChanges();
      expect(host.classList.contains('inventory-lots-viewport')).toBeFalse();
      expect(getComputedStyle(element('.inventory-container')).overflowY).toBe('visible');
      expect(host.querySelector('app-inventory-lots')).toBeNull();
    }
    fixture.componentInstance.switchView('relay');
    fixture.detectChanges();
    expect(host.classList.contains('inventory-lots-viewport')).toBeTrue();
    verticallyInside(element('.inventory-container'), viewport);
  });

  it('keeps both scroll directions usable after the available window height changes', () => {
    viewport.style.width = '720px';
    for (const height of [650, 350, 750]) {
      viewport.style.height = `${height}px`;
      const content = element('.inventory-container');
      content.scrollTop = content.scrollHeight;
      verticallyInside(content, viewport);
      verticallyInside(element('.lot-pagination'), viewport);
      const table = element('.lot-table-scroll');
      table.focus({ preventScroll: true });
      expect(document.activeElement).toBe(table);
      table.scrollTop = table.scrollHeight;
      table.scrollLeft = table.scrollWidth;
      expect(table.scrollTop).toBeGreaterThan(0);
      expect(table.scrollLeft).toBeGreaterThan(0);
      verticallyInside(element('tbody tr:last-child .lot-row-actions'), viewport);
    }
  });
});
