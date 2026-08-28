import { CommonModule } from '@angular/common';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../../../../core/services/auth.service';
import { InventoryService } from '../../../../../../core/services/inventory.service';
import { ProtocolsService } from '../../../../../../core/services/protocols.service';
import { SystemService } from '../../../../../../core/services/system.service';
import { UserService } from '../../../../../../core/services/user.service';
import { PrimengModule } from '../../../../../../shareds/libraries/primeng/primeng.module';
import { InventoryComponent } from './inventory.component';

describe('Inventory command bar responsive layout', () => {
  let fixture: ComponentFixture<InventoryComponent>;
  let host: HTMLElement;
  let bar: HTMLElement;
  let originalFontSize: string;

  beforeEach(async () => {
    originalFontSize = document.documentElement.style.fontSize;
    document.documentElement.style.fontSize = '16px';
    spyOn(InventoryComponent.prototype, 'ngOnInit').and.stub();
    await TestBed.configureTestingModule({
      declarations: [InventoryComponent],
      imports: [CommonModule, FormsModule, NoopAnimationsModule, TranslateModule.forRoot(), PrimengModule],
      providers: [
        provideRouter([]),
        { provide: InventoryService, useValue: {} },
        { provide: ProtocolsService, useValue: {} },
        { provide: AuthService, useValue: { hasPrivilege: () => true } },
        { provide: UserService, useValue: {} },
        { provide: SystemService, useValue: {} },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(InventoryComponent);
    fixture.componentInstance.loading = false;
    fixture.componentInstance.lowStockCount = 11;
    fixture.componentInstance.unregisteredSimAlertCount = 123;
    host = fixture.nativeElement;
    host.style.display = 'block';
    host.style.width = '1180px';
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.whenRenderingDone();
    bar = host.querySelector('.inventory-commandbar')!;
  });

  afterEach(() => {
    fixture?.destroy();
    document.documentElement.style.fontSize = originalFontSize;
  });

  function expectInside(child: Element, parent: Element): void {
    const rect = child.getBoundingClientRect();
    const bounds = parent.getBoundingClientRect();
    const label = child.textContent?.trim() || child.className;
    expect(rect.left).withContext(label).toBeGreaterThanOrEqual(bounds.left - 1);
    expect(rect.right).withContext(label).toBeLessThanOrEqual(bounds.right + 1);
    expect(rect.top).withContext(label).toBeGreaterThanOrEqual(bounds.top - 1);
    expect(rect.bottom).withContext(label).toBeLessThanOrEqual(bounds.bottom + 1);
  }

  function expectAligned(): void {
    const categories = bar.querySelector<HTMLElement>('.inventory-view-switch')!;
    const actions = bar.querySelector<HTMLElement>('.inventory-actions')!;
    const tabs = Array.from(categories.querySelectorAll<HTMLElement>('.inventory-tab'));
    expectInside(categories, bar);
    expectInside(actions, bar);
    expect(actions.getBoundingClientRect().top).toBeGreaterThanOrEqual(categories.getBoundingClientRect().bottom);
    expect(bar.scrollWidth).toBeLessThanOrEqual(bar.clientWidth + 1);

    const columns = bar.clientWidth <= 36 * parseFloat(getComputedStyle(document.documentElement).fontSize) ? 2 : 4;
    const first = tabs[0].getBoundingClientRect();
    tabs.forEach((tab, index) => {
      expectInside(tab, categories);
      const rect = tab.getBoundingClientRect();
      expect(rect.width).toBeCloseTo(first.width, 0);
      expect(rect.height).toBeCloseTo(first.height, 0);
      if (index < columns) expect(rect.top).toBeCloseTo(first.top, 0);
      else expect(rect.top).toBeGreaterThanOrEqual(first.bottom);
    });

    for (const group of [categories, actions]) {
      const buttons = Array.from(group.querySelectorAll<HTMLButtonElement>('button'));
      for (const button of buttons) {
        expectInside(button, group);
        expect(button.scrollWidth).withContext(button.textContent || '').toBeLessThanOrEqual(button.clientWidth + 1);
        for (const child of Array.from(button.children)) expectInside(child, button);
      }
      for (let index = 1; index < buttons.length; index++) {
        const previous = buttons[index - 1].getBoundingClientRect();
        const current = buttons[index].getBoundingClientRect();
        const separate = current.left >= previous.right - 1 || current.top >= previous.bottom - 1;
        expect(separate).withContext(buttons[index].textContent || '').toBeTrue();
      }
    }
  }

  for (const theme of ['light', 'dark']) {
    for (const width of [1600, 1180, 960, 720, 390, 320]) {
      it(`keeps every option aligned and visible at ${width}px in ${theme} mode`, () => {
        host.style.width = `${width}px`;
        host.style.setProperty('--managementColorCardBackground', theme === 'dark' ? '#202020' : '#ffffff');
        host.style.setProperty('--managementColorTextUser', theme === 'dark' ? '#eeeeee' : '#171717');
        expectAligned();
      });
    }
  }

  it('adapts to enlarged text and a narrow content area even in a desktop viewport', () => {
    document.documentElement.style.fontSize = '24px';
    host.style.width = '680px';
    expectAligned();
  });

  it('preserves the four category buttons and the active selection', () => {
    const component = fixture.componentInstance;
    const select = spyOn(component, 'switchView').and.callFake(view => component.currentView = view);
    const tabs = Array.from(bar.querySelectorAll<HTMLButtonElement>('.inventory-tab'));
    const views = ['devices', 'simcards', 'relay', 'cables'] as const;
    expect(tabs.map(tab => tab.textContent?.trim())).toEqual(['Equipos y paquetes', 'SIM cards', 'Relay', 'Cables']);
    tabs.forEach((tab, index) => {
      tab.click();
      fixture.detectChanges();
      expect(select).toHaveBeenCalledWith(views[index]);
      expect(tab.getAttribute('aria-selected')).toBe('true');
      expect(bar.querySelectorAll('.inventory-tab--active').length).toBe(1);
    });
  });

  it('keeps all actions and alert counts available after reflow', () => {
    const component = fixture.componentInstance;
    const spies = [
      spyOn(component, 'openGpsModels'),
      spyOn(component, 'openWarehouses'),
      spyOn(component, 'openUnregisteredSimAlerts'),
      spyOn(component, 'openConducesList'),
      spyOn(component, 'openNewPackage'),
    ];
    host.style.width = '390px';
    const buttons = Array.from(bar.querySelectorAll<HTMLButtonElement>('.inventory-actions button'));
    expect(buttons.length).toBe(5);
    expect(buttons[1].querySelector('b')?.textContent).toBe('11');
    expect(buttons[2].querySelector('b')?.textContent).toBe('123');
    buttons.forEach((button, index) => {
      button.click();
      expect(spies[index]).toHaveBeenCalledTimes(1);
    });
  });
});
