import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, Subject, throwError } from 'rxjs';
import { InventoryService, SimcardItem } from '../../../../../../core/services/inventory.service';
import { InventorySimcardSelectorComponent } from './inventory-simcard-selector.component';

describe('Inventory SIM card selector', () => {
  let fixture: ComponentFixture<InventorySimcardSelectorComponent>;
  let component: InventorySimcardSelectorComponent;
  let inventory: jasmine.SpyObj<InventoryService>;
  const card: SimcardItem = {
    _id: 'sim-1', iccid: '89014103211118510720', idsim: '0012345678901234567',
    sim_company: 'global-m', apn_name: 'altanwifi', storage_id: { _id: 'warehouse', name: 'Principal' },
    package: { title: 'Lote de septiembre' }, installed: false, createdAt: '2026-09-04T12:00:00Z',
    created_by: { name: 'Ana', last_name: 'Pérez' }, updated_by: { name: 'Luis' },
  };

  beforeEach(async () => {
    inventory = jasmine.createSpyObj<InventoryService>('InventoryService', ['searchAllSimcards', 'findSimcardByIccid', 'findSimcardsByIdentifier']);
    inventory.findSimcardsByIdentifier.and.returnValue(of([card]));
    inventory.searchAllSimcards.and.returnValue(of({ data: [card], total: 1, page: 1, lastPage: 1 }));
    inventory.findSimcardByIccid.and.returnValue(of(card));
    await TestBed.configureTestingModule({
      imports: [InventorySimcardSelectorComponent, NoopAnimationsModule],
      providers: [{ provide: InventoryService, useValue: inventory }],
    }).compileComponents();
    fixture = TestBed.createComponent(InventorySimcardSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('automatically selects a typed code after a short pause without changing any digit', fakeAsync(() => {
    const simChange = spyOn(component.simChange, 'emit');
    const idsimChange = spyOn(component.idsimChange, 'emit');
    const input: HTMLInputElement = fixture.nativeElement.querySelector('.sim-selector__code input');
    input.value = card.iccid;
    input.dispatchEvent(new Event('input'));
    tick(349);
    expect(inventory.findSimcardsByIdentifier).not.toHaveBeenCalled();
    tick(1);
    fixture.detectChanges();
    expect(inventory.findSimcardsByIdentifier).toHaveBeenCalledWith(card.iccid);
    expect(simChange).toHaveBeenCalledWith(card.iccid);
    expect(idsimChange).toHaveBeenCalledWith(card.idsim!);
    expect(input.value).toBe(card.iccid);
    expect(fixture.nativeElement.querySelector('.sim-selector__card').textContent).toContain(card.iccid);
  }));

  it('uses the scanner Enter immediately and prevents submission of the device form', fakeAsync(() => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('.sim-selector__code input');
    input.value = card.idsim!;
    input.dispatchEvent(new Event('input'));
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    input.dispatchEvent(enter);
    tick(350);
    expect(enter.defaultPrevented).toBeTrue();
    expect(inventory.findSimcardsByIdentifier).toHaveBeenCalledOnceWith(card.idsim!);
    expect(component.selected).toEqual(card);
    expect(input.value).toBe(card.idsim!);
  }));

  it('preserves the selected SIM and reports unmatched or ambiguous codes', () => {
    component.select(card);
    const emitted = spyOn(component.simChange, 'emit');
    inventory.findSimcardsByIdentifier.and.returnValue(of([]));
    component.onCodeChange('missing');
    component.findCode();
    expect(component.codeMessage).toContain('No se encontró');
    expect(component.codeMessage).toContain('Se mantiene la SIM actual');
    inventory.findSimcardsByIdentifier.and.returnValue(of([card, { ...card, _id: 'other' }]));
    component.onCodeChange('duplicate');
    component.findCode();
    expect(component.codeMessage).toContain('varias SIM cards');
    expect(component.selected).toEqual(card);
    expect(emitted).not.toHaveBeenCalled();
  });

  it('cancels stale code lookups and pending typing when a SIM is selected from the modal', fakeAsync(() => {
    const oldResult = new Subject<SimcardItem[]>();
    inventory.findSimcardsByIdentifier.and.returnValue(oldResult);
    component.onCodeChange('old-code');
    tick(350);
    component.onCodeChange(card.iccid);
    oldResult.next([{ iccid: 'old-code' }]);
    expect(component.selected).toBeNull();
    component.openPicker();
    component.select(card);
    tick(350);
    expect(inventory.findSimcardsByIdentifier).toHaveBeenCalledTimes(1);
    expect(component.selected).toEqual(card);
  }));

  it('allows retrying a failed code lookup and cancels automatic selection when removing the SIM', fakeAsync(() => {
    inventory.findSimcardsByIdentifier.and.returnValue(throwError(() => new Error('offline')));
    component.onCodeChange(card.iccid);
    tick(350);
    expect(component.findingCode).toBeFalse();
    expect(component.codeMessage).toBeTruthy();
    inventory.findSimcardsByIdentifier.and.returnValue(of([card]));
    component.findCode();
    expect(component.selected).toEqual(card);
    component.onCodeChange('another-code');
    component.remove();
    tick(350);
    expect(component.selected).toBeNull();
    expect(component.codeInput).toBe('');
    expect(inventory.findSimcardsByIdentifier).toHaveBeenCalledTimes(2);
  }));

  it('selects a result with every identifier digit intact and displays its inventory details', async () => {
    const simChange = spyOn(component.simChange, 'emit');
    const idsimChange = spyOn(component.idsimChange, 'emit');
    fixture.nativeElement.querySelector('.sim-selector__button').click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.querySelector('.sim-selector__picker .sim-selector__search input')).not.toBeNull();
    expect(document.activeElement).toBe(document.querySelector('.sim-selector__picker .sim-selector__search input'));
    (document.querySelector('.sim-selector__result') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(simChange).toHaveBeenCalledWith('89014103211118510720');
    expect(idsimChange).toHaveBeenCalledWith('0012345678901234567');
    const text = fixture.nativeElement.querySelector('.sim-selector__card').textContent;
    for (const value of [card.iccid, card.idsim, 'Global-M', 'altanwifi', 'Principal', 'Lote de septiembre', 'Ana Pérez', 'Luis']) {
      expect(text).toContain(value);
    }
    expect(component.visible).toBeFalse();
    expect(fixture.nativeElement.querySelector('.sim-selector__code input').value).toBe(card.idsim);
  });

  it('cancels an older search while typing and searches the complete new number', fakeAsync(() => {
    const oldResponse = new Subject<any>();
    inventory.searchAllSimcards.and.returnValues(oldResponse, of({ data: [card], total: 1, page: 1, lastPage: 1 }));
    component.openPicker();
    component.query = card.iccid;
    component.onQueryChange();
    oldResponse.next({ data: [{ iccid: 'wrong' }], total: 1 });
    expect(component.results).toEqual([]);
    tick(300);
    expect(inventory.searchAllSimcards).toHaveBeenCalledWith(card.iccid, undefined, 1, 20);
    expect(component.results).toEqual([card]);
  }));

  it('loads later result pages and handles an empty search', () => {
    inventory.searchAllSimcards.and.returnValues(
      of({ data: [card], total: 21, page: 1, lastPage: 2 }),
      of({ data: [{ iccid: 'last-result' }], total: 21, page: 2, lastPage: 2 }),
      of({ data: [], total: 0, page: 1, lastPage: 1 }),
    );
    component.openPicker();
    component.search(2);
    expect(inventory.searchAllSimcards).toHaveBeenCalledWith('', undefined, 2, 20);
    expect(component.results[0].iccid).toBe('last-result');
    component.query = 'missing';
    component.search();
    expect(component.total).toBe(0);
    expect(component.results).toEqual([]);
    expect(component.page).toBe(1);
  });

  it('prevents Enter in the picker from submitting the device form', () => {
    const event = { preventDefault: jasmine.createSpy(), stopPropagation: jasmine.createSpy() } as unknown as Event;
    component.searchOnEnter(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it('loads an existing SIM without modifying saved identifiers and clears it for the next GPS', () => {
    const emitted = spyOn(component.simChange, 'emit');
    fixture.componentRef.setInput('sim', card.iccid);
    fixture.componentRef.setInput('idsim', card.idsim);
    fixture.detectChanges();
    expect(component.selected).toEqual(card);
    expect(emitted).not.toHaveBeenCalled();
    expect(component.codeInput).toBe(card.idsim!);
    fixture.componentRef.setInput('sim', '');
    fixture.componentRef.setInput('idsim', '');
    fixture.detectChanges();
    expect(component.selected).toBeNull();
    expect(component.codeInput).toBe('');
    expect(fixture.nativeElement.querySelector('.sim-selector__card')).toBeNull();
  });

  it('preserves a legacy SIM when no matching inventory card exists', () => {
    inventory.findSimcardByIccid.and.returnValue(of(null));
    const emitted = spyOn(component.simChange, 'emit');
    fixture.componentRef.setInput('sim', '8095551234');
    fixture.detectChanges();
    expect(component.sim).toBe('8095551234');
    expect(fixture.nativeElement.querySelector('.sim-selector__legacy').textContent).toContain('8095551234');
    expect(emitted).not.toHaveBeenCalled();
  });

  it('resolves an ID SIM-only legacy record by exact identifier', () => {
    fixture.componentRef.setInput('idsim', card.idsim);
    fixture.detectChanges();
    expect(component.selected).toEqual(card);
    expect(inventory.findSimcardByIccid).not.toHaveBeenCalled();
  });

  it('clears the former ID SIM when replacing a national SIM with a global SIM', () => {
    component.select({ ...card, sim_company: 'nacionales', iccid: '8095551234' });
    const emitted = spyOn(component.idsimChange, 'emit');
    component.select({ ...card, idsim: undefined });
    expect(emitted).toHaveBeenCalledWith('');
    const simChange = spyOn(component.simChange, 'emit');
    component.remove();
    expect(simChange).toHaveBeenCalledWith('');
    expect(component.selected).toBeNull();
  });

  it('does not replace a selected SIM with a late lookup response', () => {
    const pending = new Subject<SimcardItem | null>();
    inventory.findSimcardByIccid.and.returnValue(pending);
    fixture.componentRef.setInput('sim', 'old-number');
    fixture.detectChanges();
    component.select(card);
    pending.next({ iccid: 'old-number' });
    expect(component.selected).toEqual(card);
    expect(component.sim).toBe(card.iccid);
  });

  it('shows a recoverable search error and cancels without changing the current SIM', () => {
    component.select(card);
    inventory.searchAllSimcards.and.returnValue(throwError(() => new Error('offline')));
    component.openPicker();
    expect(component.searchError).toBeTruthy();
    inventory.searchAllSimcards.and.returnValue(of({ data: [card], total: 1, page: 1, lastPage: 1 }));
    component.search();
    expect(component.searchError).toBe('');
    component.closePicker();
    expect(component.selected).toEqual(card);
    expect(component.codeInput).toBe(card.idsim!);
  });
});
