import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, Subject, throwError } from 'rxjs';
import { ProcessClientOption, ProcessesService } from '../../services/processes.service';
import { ProcessTemplateConfiguration, ProcessTemplatesDialogComponent } from './process-templates-dialog.component';

describe('ProcessTemplatesDialogComponent', () => {
  let fixture: ComponentFixture<ProcessTemplatesDialogComponent>;
  let component: ProcessTemplatesDialogComponent;
  let service: jasmine.SpyObj<ProcessesService>;
  const client = { id: 'client-1', label: 'MARÍA PÉREZ', email: 'maria@example.test', phone: '8095550000' };

  beforeEach(async () => {
    service = jasmine.createSpyObj('ProcessesService', ['searchClients']);
    service.searchClients.and.returnValue(of([]));
    await TestBed.configureTestingModule({
      imports: [ProcessTemplatesDialogComponent, NoopAnimationsModule],
      providers: [{ provide: ProcessesService, useValue: service }],
    }).compileComponents();
    fixture = TestBed.createComponent(ProcessTemplatesDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(async () => {
    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.destroy();
  });

  async function open(): Promise<void> {
    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function choose(type = 4): void {
    (fixture.nativeElement.querySelector(`[data-process-type="${type}"]`) as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  it('starts with seven template cards and keeps drafts unapplied until Generar', async () => {
    const generated = spyOn(component.generated, 'emit');
    await open();
    const cards: HTMLButtonElement[] = [...fixture.nativeElement.querySelectorAll('.template-card')];
    expect(cards.map(card => card.querySelector('strong')?.textContent?.trim())).toEqual([
      'Renovar ( Facturación a crédito )', 'Renovar ( Facturación al contado )', 'Instalación', 'Reinstalación', 'Revisión', 'Desinstalación', 'Renovación pendiente',
    ]);
    choose();
    expect(fixture.nativeElement.querySelectorAll('.p-dialog').length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Procesos registrados en este período');
    expect(fixture.nativeElement.querySelector('.template-form')).not.toBeNull();
    component.clientDraft = client;
    component.dateFrom = new Date(2026, 7, 10);
    expect(generated).not.toHaveBeenCalled();
    (fixture.nativeElement.querySelector('.template-button--back') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.template-card').length).toBe(7);
    expect(component.clientDraft).toBe(client);
    expect(generated).not.toHaveBeenCalled();
  });

  it('generates each template with its exact process type', async () => {
    const generated = spyOn(component.generated, 'emit');
    for (const type of [4, 20, 1, 18, 10, 19, 22]) {
      await open();
      choose(type);
      if (type === 22) component.clientDraft = client;
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('.template-button--generate') as HTMLButtonElement).click();
      expect(generated.calls.mostRecent().args[0]!.types).toEqual([type]);
      expect(generated.calls.mostRecent().args[0]!.client).toEqual(type === 22 ? { ...client, label: 'María Pérez' } : null);
      expect(component.visible).toBeFalse();
    }
    expect(generated).toHaveBeenCalledTimes(7);
  });

  it('includes all currently expired devices of the selected client, ignoring the parent current-month range', async () => {
    const generated = spyOn(component.generated, 'emit');
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    fixture.componentRef.setInput('initialClient', client);
    fixture.componentRef.setInput('initialDateFrom', from);
    fixture.componentRef.setInput('initialDateTo', to);
    await open();
    choose(22);
    expect(component.dateFrom).toBeNull();
    expect(component.dateTo).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('incluidos los de meses anteriores');
    expect(fixture.nativeElement.textContent).toContain('vencidos o por vencer del cliente seleccionado');
    expect(fixture.nativeElement.textContent).toContain('Sin fechas se muestran solo los dispositivos actualmente vencidos');
    expect(fixture.nativeElement.textContent).toContain('Si una renovación mueve el vencimiento fuera de esos límites');
    expect(fixture.nativeElement.textContent).not.toContain('Procesos registrados en este período');
    expect(fixture.nativeElement.querySelector('label[for="template-date-from"]').textContent).toContain('Vencimiento desde');
    expect(fixture.nativeElement.querySelector('label[for="template-date-to"]').textContent).toContain('Vencimiento hasta');
    component.generate();
    expect(generated).toHaveBeenCalledOnceWith({
      types: [22], client: { ...client, label: 'María Pérez' }, dateFrom: null, dateTo: null,
    });
    expect(from.getDate()).toBe(1);
    expect(to.getHours()).toBe(0);
  });

  it('restores the edited registration period when moving from pending renewal to another template', async () => {
    await open();
    choose(4);
    const from = new Date(2025, 10, 2);
    const to = new Date(2025, 10, 28);
    component.dateFrom = from;
    component.dateTo = to;
    component.clientDraft = client;
    component.back();
    fixture.detectChanges();
    choose(22);
    component.dateFrom = new Date(2024, 1, 1);
    component.dateTo = new Date(2024, 4, 3);
    component.back();
    fixture.detectChanges();
    choose(1);
    expect(component.dateFrom).toEqual(from);
    expect(component.dateTo).toEqual(to);
    expect(component.dateFrom).not.toBe(from);
    expect(component.dateTo).not.toBe(to);
    expect(component.clientDraft).toBe(client);
    expect(fixture.nativeElement.textContent).toContain('Procesos registrados en este período');
    expect(fixture.nativeElement.querySelector('label[for="template-date-from"]').textContent.trim()).toBe('Desde');
    expect(fixture.nativeElement.querySelector('label[for="template-date-to"]').textContent.trim()).toBe('Hasta');
  });

  it('restores the default month for registered processes and resets expiry dates on reselecting pending renewal', async () => {
    await open();
    const from = new Date(component.dateFrom!);
    const to = new Date(component.dateTo!);
    choose(22);
    component.dateFrom = new Date(2025, 0, 1);
    component.back();
    fixture.detectChanges();
    choose(22);
    expect(component.dateFrom).toBeNull();
    expect(component.dateTo).toBeNull();
    component.back();
    fixture.detectChanges();
    choose(20);
    expect(component.dateFrom).toEqual(from);
    expect(component.dateTo).toEqual(to);
  });

  it('allows either future expiry boundary independently and includes the whole local boundary day', async () => {
    const generated = spyOn(component.generated, 'emit');
    fixture.componentRef.setInput('initialClient', client);
    const futureYear = new Date().getFullYear() + 1;
    for (const boundary of ['from', 'to', 'both']) {
      await open();
      choose(22);
      const day = new Date(futureYear, 1, 6, 11, 24);
      component.dateFrom = boundary === 'to' ? null : day;
      component.dateTo = boundary === 'from' ? null : day;
      component.generate();
      const result = generated.calls.mostRecent().args[0]!;
      expect(result.dateFrom).withContext(boundary).toEqual(boundary === 'to' ? null : new Date(futureYear, 1, 6, 0, 0, 0, 0));
      expect(result.dateTo).withContext(boundary).toEqual(boundary === 'from' ? null : new Date(futureYear, 1, 6, 23, 59, 59, 999));
      expect(day.getHours()).toBe(11);
      expect(result.types).toEqual([22]);
    }
    expect(generated).toHaveBeenCalledTimes(3);
  });

  it('rejects invalid provided expiry dates and inverted ranges while allowing empty boundaries', async () => {
    const generated = spyOn(component.generated, 'emit');
    fixture.componentRef.setInput('initialClient', client);
    await open();
    choose(22);
    component.dateFrom = new Date('invalid');
    component.generate();
    expect(component.validationError).toContain('fecha de vencimiento válida');
    component.dateFrom = null;
    component.dateTo = new Date('invalid');
    component.generate();
    expect(component.validationError).toContain('fecha de vencimiento válida');
    component.dateFrom = new Date(2025, 7, 20);
    component.dateTo = new Date(2025, 7, 19);
    component.generate();
    expect(component.validationError).toContain('Vencimiento desde debe ser anterior o igual a Vencimiento hasta');
    expect(generated).not.toHaveBeenCalled();
    expect(component.visible).toBeTrue();
  });

  it('does not silently remove an invalid typed expiry boundary when the input loses focus', async () => {
    const generated = spyOn(component.generated, 'emit');
    fixture.componentRef.setInput('initialClient', client);
    await open();
    choose(22);
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#template-date-from');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: '3', code: 'Digit3', bubbles: true }));
    input.value = '31/02/2026';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    component.generate();
    expect(component.validationError).toContain('fecha de vencimiento válida');
    expect(generated).not.toHaveBeenCalled();
    expect(input.value).toBe('31/02/2026');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', code: 'Backspace', bubbles: true }));
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    component.generate();
    expect(generated).toHaveBeenCalledOnceWith({ types: [22], client: { ...client, label: 'María Pérez' }, dateFrom: null, dateTo: null });
  });

  it('opens pending renewal without a client but requires selecting one before generating', async () => {
    const generated = spyOn(component.generated, 'emit');
    await open();
    choose(22);
    expect(component.selectedTemplate?.type).toBe(22);
    expect(fixture.nativeElement.querySelector('label[for="template-client"]').textContent).toContain('(obligatorio)');
    expect((fixture.nativeElement.querySelector('#template-client') as HTMLInputElement).placeholder).toBe('Selecciona un cliente');
    expect(fixture.nativeElement.textContent).not.toContain('Todos los clientes');
    expect((fixture.nativeElement.querySelector('.template-button--generate') as HTMLButtonElement).disabled).toBeTrue();
    component.generate();
    expect(component.validationError).toContain('Selecciona un cliente de la lista');
    expect(generated).not.toHaveBeenCalled();
    expect(component.visible).toBeTrue();
  });

  it('rejects missing, free-text and blank-ID clients for pending renewal even on direct generation', async () => {
    const generated = spyOn(component.generated, 'emit');
    await open();
    choose(22);
    for (const invalid of [null, '', 'Cliente sin seleccionar', { ...client, id: '' }, { ...client, id: '   ' }]) {
      component.clientDraft = invalid;
      fixture.detectChanges();
      expect((fixture.nativeElement.querySelector('.template-button--generate') as HTMLButtonElement).disabled).withContext(JSON.stringify(invalid)).toBeTrue();
      component.generate();
      expect(component.validationError).toContain('Selecciona un cliente de la lista');
    }
    component.clientDraft = client;
    component.clientSelectionPending = true;
    component.generate();
    expect(generated).not.toHaveBeenCalled();
  });

  it('blocks required-client generation while replacing a selected client with unmatched text', async () => {
    const generated = spyOn(component.generated, 'emit');
    fixture.componentRef.setInput('initialClient', client);
    await open();
    choose(22);
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#template-client');
    input.value = 'cliente inexistente';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(component.clientDraft).toBeNull();
    expect(component.clientSelectionPending).toBeTrue();
    expect(fixture.nativeElement.textContent).not.toContain('Todos los clientes');
    expect((fixture.nativeElement.querySelector('.template-button--generate') as HTMLButtonElement).disabled).toBeTrue();
    component.generate();
    expect(generated).not.toHaveBeenCalled();
    component.clientDraft = { id: ' replacement ', label: 'CLIENTE NUEVO' };
    component.onClientSelected();
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('.template-button--generate') as HTMLButtonElement).disabled).toBeFalse();
    component.generate();
    expect(generated).toHaveBeenCalledOnceWith({
      types: [22], client: { id: 'replacement', label: 'Cliente Nuevo' }, dateFrom: null, dateTo: null,
    });
  });

  it('allows clearing a required client for replacement and keeps other templates optional', async () => {
    const generated = spyOn(component.generated, 'emit');
    fixture.componentRef.setInput('initialClient', client);
    await open();
    choose(22);
    const clear: HTMLButtonElement = fixture.nativeElement.querySelector('.template-clear-client');
    expect(clear.textContent).toContain('Limpiar cliente');
    clear.click();
    fixture.detectChanges();
    expect(component.clientDraft).toBeNull();
    expect((fixture.nativeElement.querySelector('.template-button--generate') as HTMLButtonElement).disabled).toBeTrue();
    component.generate();
    expect(generated).not.toHaveBeenCalled();
    component.back();
    fixture.detectChanges();
    choose(4);
    expect((fixture.nativeElement.querySelector('#template-client') as HTMLInputElement).placeholder).toBe('Todos los clientes');
    expect(fixture.nativeElement.querySelector('label[for="template-client"]').textContent).toContain('(opcional)');
    expect((fixture.nativeElement.querySelector('.template-button--generate') as HTMLButtonElement).disabled).toBeFalse();
    component.generate();
    expect(generated.calls.mostRecent().args[0]!.client).toBeNull();
  });

  it('reopens pending renewal without retaining a discarded client selection', async () => {
    await open();
    choose(22);
    component.clientDraft = client;
    component.onClientSelected();
    component.close();
    await open();
    choose(22);
    expect(component.clientDraft).toBeNull();
    expect((fixture.nativeElement.querySelector('.template-button--generate') as HTMLButtonElement).disabled).toBeTrue();
    fixture.componentRef.setInput('initialClient', client);
    component.close();
    await open();
    choose(22);
    expect(component.clientDraft).toEqual({ ...client, label: 'María Pérez' });
    expect((fixture.nativeElement.querySelector('.template-button--generate') as HTMLButtonElement).disabled).toBeFalse();
  });

  it('defaults to the complete current local month when there is no valid initial range', async () => {
    const now = new Date();
    fixture.componentRef.setInput('initialDateFrom', new Date('invalid'));
    fixture.componentRef.setInput('initialDateTo', new Date(2026, 7, 10));
    await open();
    expect(component.dateFrom).toEqual(new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0));
    expect(component.dateTo).toEqual(new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));

    fixture.componentRef.setInput('initialDateFrom', new Date(2026, 8, 11));
    fixture.componentRef.setInput('initialDateTo', new Date(2026, 8, 10));
    await open();
    expect(component.dateFrom).toEqual(new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0));
  });

  it('clones initial values, keeps full local days and resets the chosen card and draft when reopened', async () => {
    const initialFrom = new Date(2026, 6, 15, 14, 20);
    const initialTo = new Date(2026, 7, 2, 9, 10);
    fixture.componentRef.setInput('initialClient', client);
    fixture.componentRef.setInput('initialDateFrom', initialFrom);
    fixture.componentRef.setInput('initialDateTo', initialTo);
    await open();
    expect(component.clientDraft).toEqual({ ...client, label: 'María Pérez' });
    expect(component.clientDraft).not.toBe(client);
    expect(component.dateFrom).toEqual(new Date(2026, 6, 15, 0, 0, 0, 0));
    expect(component.dateTo).toEqual(new Date(2026, 7, 2, 23, 59, 59, 999));
    expect(component.dateFrom).not.toBe(initialFrom);
    expect(component.dateTo).not.toBe(initialTo);
    choose(1);
    component.dateFrom!.setFullYear(2000);
    component.clearClient();
    component.close();
    await open();
    expect(component.selectedTemplate).toBeNull();
    expect(component.clientDraft).toEqual({ ...client, label: 'María Pérez' });
    expect(component.dateFrom?.getFullYear()).toBe(2026);
    expect(initialFrom.getHours()).toBe(14);
    expect(initialTo.getHours()).toBe(9);
    expect(client.label).toBe('MARÍA PÉREZ');
  });

  it('requires both valid dates and rejects an inverted range without emitting', async () => {
    const generated = spyOn(component.generated, 'emit');
    await open();
    choose();
    for (const missing of [null, new Date('invalid')]) {
      component.dateFrom = missing;
      component.generate();
      expect(component.validationError).toContain('Desde y Hasta');
    }
    component.dateFrom = new Date(2026, 8, 10);
    component.dateTo = null;
    component.generate();
    expect(component.validationError).toContain('Desde y Hasta');
    component.dateTo = new Date(2026, 8, 9);
    component.generate();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.template-validation')?.textContent).toContain('anterior o igual');
    expect(component.visible).toBeTrue();
    expect(generated).not.toHaveBeenCalled();
  });

  it('includes a single whole local day and emits independent dates and client data', async () => {
    const generated = spyOn(component.generated, 'emit');
    const visible = spyOn(component.visibleChange, 'emit');
    await open();
    choose();
    const from = new Date(2026, 8, 15, 20, 30);
    const to = new Date(2026, 8, 15, 9, 45);
    component.dateFrom = from;
    component.dateTo = to;
    component.clientDraft = client;
    component.generate();
    const output: ProcessTemplateConfiguration = generated.calls.mostRecent().args[0]!;
    expect(output.dateFrom).toEqual(new Date(2026, 8, 15, 0, 0, 0, 0));
    expect(output.dateTo).toEqual(new Date(2026, 8, 15, 23, 59, 59, 999));
    expect(output.dateFrom).not.toBe(from);
    expect(output.dateTo).not.toBe(to);
    expect(output.client).toEqual({ ...client, label: 'María Pérez' });
    expect(output.client).not.toBe(client);
    expect(from.getHours()).toBe(20);
    expect(to.getHours()).toBe(9);
    expect(visible).toHaveBeenCalledOnceWith(false);
  });

  it('cancels from the button or dialog close icon without emitting a configuration', async () => {
    const generated = spyOn(component.generated, 'emit');
    const visible = spyOn(component.visibleChange, 'emit');
    await open();
    choose();
    (fixture.nativeElement.querySelector('.template-button--cancel') as HTMLButtonElement).click();
    expect(visible).toHaveBeenCalledWith(false);
    await open();
    (fixture.nativeElement.querySelector('.p-dialog-close-button') as HTMLButtonElement).click();
    expect(visible).toHaveBeenCalledTimes(2);
    expect(generated).not.toHaveBeenCalled();
  });

  it('rejects arbitrary client text instead of treating it as a selected client', async () => {
    const generated = spyOn(component.generated, 'emit');
    await open();
    choose();
    component.clientDraft = 'cliente inexistente';
    component.generate();
    expect(component.validationError).toContain('Selecciona un cliente de la lista');
    expect(generated).not.toHaveBeenCalled();
  });

  it('keeps Generar blocked after forceSelection clears unmatched text until the user chooses all clients', async () => {
    const generated = spyOn(component.generated, 'emit');
    fixture.componentRef.setInput('initialClient', client);
    await open();
    choose();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#template-client');
    input.value = 'cliente inexistente';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(component.clientDraft).toBeNull();
    expect(component.clientSelectionPending).toBeTrue();
    expect((fixture.nativeElement.querySelector('.template-button--generate') as HTMLButtonElement).disabled).toBeTrue();
    component.generate();
    expect(generated).not.toHaveBeenCalled();
    (fixture.nativeElement.querySelector('.template-clear-client') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.clientSelectionPending).toBeFalse();
    (fixture.nativeElement.querySelector('.template-button--generate') as HTMLButtonElement).click();
    expect(generated.calls.mostRecent().args[0]!.client).toBeNull();
  });

  it('searches the existing client API, formats names and preserves client identifiers', async () => {
    service.searchClients.and.returnValue(of([
      { _id: 'client-1', name: '  MARÍA', last_name: 'PÉREZ ', email: 'Maria@example.test' },
      { id: 'subclient-2', name: 'jOSÉ', last_name: 'DE LA CRUZ', phone: '8095550000' },
      { email: 'support@Example.test' },
      {},
    ]));
    await open();
    choose();
    component.searchClients({ query: ' María ' });
    expect(service.searchClients).toHaveBeenCalledOnceWith('María', 50);
    expect(component.clientOptions).toEqual([
      { id: 'client-1', label: 'María Pérez', email: 'Maria@example.test', phone: undefined },
      { id: 'subclient-2', label: 'José De La Cruz', email: undefined, phone: '8095550000' },
      { id: 'support@Example.test', label: 'support@Example.test', email: 'support@Example.test', phone: undefined },
    ]);
    component.clientSelectionPending = true;
    component.clientDraft = component.clientOptions[1];
    component.onClientSelected();
    expect(component.clientSelectionPending).toBeFalse();
    const generated = spyOn(component.generated, 'emit');
    component.generate();
    expect(generated.calls.mostRecent().args[0]!.client?.id).toBe('subclient-2');
  });

  it('cancels earlier searches and ignores their later results', async () => {
    const first = new Subject<ProcessClientOption[]>();
    const second = new Subject<ProcessClientOption[]>();
    service.searchClients.and.returnValues(first, second);
    await open();
    choose();
    component.searchClients({ query: 'maria' });
    expect(component.loadingClients).toBeTrue();
    expect(first.observed).toBeTrue();
    component.searchClients({ query: 'jose' });
    expect(first.observed).toBeFalse();
    first.next([{ _id: 'wrong', name: 'María' }]);
    second.next([{ _id: 'right', name: 'José' }]);
    expect(component.clientOptions.map(option => option.id)).toEqual(['right']);
    expect(component.loadingClients).toBeFalse();
  });

  it('shows loading and a recoverable client search error without losing the selected template', async () => {
    const response = new Subject<ProcessClientOption[]>();
    service.searchClients.and.returnValues(response, of([{ _id: 'retry', name: 'cliente' }]));
    await open();
    choose(20);
    component.searchClients({ query: 'cliente' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.template-search-loading')?.textContent).toContain('Buscando');
    response.error(new Error('network'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.template-search-error')?.textContent).toContain('No se pudieron cargar');
    (fixture.nativeElement.querySelector('.template-search-error button') as HTMLButtonElement).click();
    expect(service.searchClients.calls.mostRecent().args).toEqual(['cliente', 50]);
    expect(component.clientSearchError).toBe('');
    expect(component.clientOptions[0].id).toBe('retry');
    expect(component.selectedTemplate?.type).toBe(20);
  });

  it('clears old errors on a new search and represents an empty result', async () => {
    service.searchClients.and.returnValues(throwError(() => new Error('network')), of([]));
    await open();
    choose();
    component.searchClients({ query: 'first' });
    expect(component.clientSearchError).not.toBe('');
    component.searchClients({ query: 'second' });
    expect(component.clientSearchError).toBe('');
    expect(component.clientOptions).toEqual([]);
    expect(component.loadingClients).toBeFalse();
  });

  it('cancels searches on close, external hide, back and destruction', async () => {
    for (const action of ['close', 'hide', 'back', 'destroy']) {
      const response = new Subject<ProcessClientOption[]>();
      service.searchClients.and.returnValue(response);
      await open();
      choose();
      component.searchClients({ query: action });
      if (action === 'close') component.close();
      if (action === 'hide') {
        fixture.componentRef.setInput('visible', false);
        fixture.detectChanges();
      }
      if (action === 'back') component.back();
      if (action === 'destroy') component.ngOnDestroy();
      expect(response.observed).withContext(action).toBeFalse();
      expect(component.loadingClients).withContext(action).toBeFalse();
      response.next([{ _id: 'late', name: 'Late' }]);
      expect(component.clientOptions).withContext(action).toEqual([]);
    }
  });
});
