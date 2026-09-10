import { CommonModule } from '@angular/common';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError, Subject } from 'rxjs';
import { ConfirmationService } from 'primeng/api';
import { AuthService } from '../../../../../../core/services/auth.service';
import { InventoryService } from '../../../../../../core/services/inventory.service';
import { ProtocolsService } from '../../../../../../core/services/protocols.service';
import { SystemService } from '../../../../../../core/services/system.service';
import { UserService } from '../../../../../../core/services/user.service';
import { PrimengModule } from '../../../../../../shareds/libraries/primeng/primeng.module';
import { InventoryComponent } from './inventory.component';

describe('Incosis package cards', () => {
  let fixture: ComponentFixture<InventoryComponent>;
  const rows = [
    { _id: 'manual', title: 'Manual', date: '2026-09-10', createdAt: '2026-09-10T12:00:00Z', price: 10 },
    { _id: 'linked-old', title: 'Compra anterior', date: '2026-09-20', createdAt: '2026-09-01T12:00:00Z', price: 10, incosisExpense: { expenseId: 'expense-1' } },
    { _id: 'linked-new', title: 'Compra reciente', date: '2026-08-01', createdAt: '2026-09-09T12:00:00Z', price: 10, incosisExpense: { expenseId: 'expense-2' } },
  ];
  beforeEach(async () => {
    spyOn(InventoryComponent.prototype, 'ngOnInit').and.stub();
    await TestBed.configureTestingModule({ declarations: [InventoryComponent], imports: [CommonModule, FormsModule, NoopAnimationsModule, TranslateModule.forRoot(), PrimengModule], providers: [provideRouter([]),
      { provide: InventoryService, useValue: { findAllPackages: () => of(structuredClone(rows)) } },
      { provide: ProtocolsService, useValue: {} }, { provide: AuthService, useValue: { hasPrivilege: () => true } }, { provide: UserService, useValue: {} }, { provide: SystemService, useValue: {} },
    ], schemas: [NO_ERRORS_SCHEMA] }).compileComponents();
    fixture = TestBed.createComponent(InventoryComponent);
    fixture.componentInstance.loadPackages(); fixture.detectChanges(); await fixture.whenStable();
  });
  afterEach(() => fixture.destroy());
  it('lists deleted packages and restores only after confirmation', () => {
    const api = TestBed.inject(InventoryService);
    const pkg = { ...rows[0], deletedAt: '2026-09-09T12:00:00Z' } as any;
    api.findDeletedPackages = jasmine.createSpy().and.returnValue(of([pkg]));
    const request = new Subject<any>();
    api.restorePackage = jasmine.createSpy().and.returnValue(request);
    const confirm = spyOn(fixture.debugElement.injector.get(ConfirmationService), 'confirm');
    const component = fixture.componentInstance;
    component.openDeletedPackages(); fixture.detectChanges();
    expect(component.deletedPackages).toEqual([pkg]);
    expect(fixture.nativeElement.textContent).toContain('Paquetes eliminados');
    component.restorePackage(pkg);
    expect(api.restorePackage).not.toHaveBeenCalled();
    confirm.calls.mostRecent().args[0].accept!();
    expect(api.restorePackage).toHaveBeenCalledOnceWith(pkg._id);
    component.restorePackage(pkg);
    expect(confirm).toHaveBeenCalledTimes(1);
    request.next(pkg); request.complete();
    expect(component.deletedPackages).toEqual([]);
    expect(component.restoringPackageId).toBe('');
  });
  it('keeps failures visible and does not discard the package after failed restoration', () => {
    const api = TestBed.inject(InventoryService);
    api.findDeletedPackages = jasmine.createSpy().and.returnValue(throwError(() => new Error('offline')));
    const component = fixture.componentInstance;
    component.openDeletedPackages();
    expect(component.deletedPackagesError).toBeTruthy();
    expect(component.loadingDeletedPackages).toBeFalse();
    const pkg = rows[0] as any;
    component.deletedPackages = [pkg];
    api.restorePackage = jasmine.createSpy().and.returnValue(throwError(() => new Error('offline')));
    spyOn(fixture.debugElement.injector.get(ConfirmationService), 'confirm').and.callFake(options => { options.accept!(); return {} as any; });
    component.restorePackage(pkg);
    expect(component.deletedPackages).toEqual([pkg]);
    expect(component.restoringPackageId).toBe('');
  });
  it('does not fetch or restore deleted packages without update permission', () => {
    const api = TestBed.inject(InventoryService);
    api.findDeletedPackages = jasmine.createSpy(); api.restorePackage = jasmine.createSpy();
    spyOn(fixture.componentInstance, 'canUpdateInventory').and.returnValue(false);
    fixture.componentInstance.openDeletedPackages();
    fixture.componentInstance.restorePackage(rows[0] as any);
    expect(api.findDeletedPackages).not.toHaveBeenCalled();
    expect(api.restorePackage).not.toHaveBeenCalled();
  });
  it('renders linked packages first, shows registration dates and distinguishes their origin', () => {
    const cards = fixture.nativeElement.querySelectorAll('.package-card');
    expect(cards.length).toBe(3);
    expect(cards[0].querySelector('h3').textContent).toBe('Compra reciente');
    expect(cards[1].querySelector('h3').textContent).toBe('Compra anterior');
    expect(cards[0].textContent).toContain('09/09/2026');
    expect(cards[0].classList.contains('package-card--incosis')).toBeTrue();
    expect(cards[0].querySelector('.package-origin-badge').textContent).toContain('Compra registrada en Incosis');
    expect(cards[2].querySelector('.package-origin-badge')).toBeNull();
    const open = spyOn(fixture.componentInstance, 'viewPackageDevices');
    cards[0].querySelector('.package-card-footer').click();
    expect(open).toHaveBeenCalledOnceWith(jasmine.objectContaining({ _id: 'linked-new' }));
  });
  it('keeps the highlighted cards within the grid in light and dark themes', () => {
    const host: HTMLElement = fixture.nativeElement; host.style.display = 'block';
    for (const background of ['#ffffff', '#202020']) {
      host.style.setProperty('--managementColorCardBackground', background);
      for (const width of [1280, 390]) {
        host.style.width = width + 'px'; fixture.detectChanges();
        const grid = host.querySelector('.packages-grid')!.getBoundingClientRect();
        const card = host.querySelector('.package-card--incosis')!;
        expect(card.getBoundingClientRect().right).toBeLessThanOrEqual(grid.right + 1);
        expect(getComputedStyle(card).borderTopWidth).toBe('5px');
        expect(getComputedStyle(card.querySelector('.package-card-footer')!).color).toBe('rgb(255, 255, 255)');
      }
    }
  });
});
