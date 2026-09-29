import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { SmsCommandsDialogComponent, SmsDialogCommand } from './sms-commands-dialog.component';

describe('SmsCommandsDialogComponent', () => {
  let fixture: ComponentFixture<SmsCommandsDialogComponent>;
  let component: SmsCommandsDialogComponent;
  const command: SmsDialogCommand = { name: 'Ubicación', value: 'WHERE#', icon: 'pi pi-map-marker', commandIndex: 2 };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SmsCommandsDialogComponent, NoopAnimationsModule],
    }).compileComponents();
    fixture = TestBed.createComponent(SmsCommandsDialogComponent);
    component = fixture.componentInstance;
    component.visible = true;
    component.simNumber = '891030000019069688';
    component.commands = [command];
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('preserves the selected command when copying or sending', () => {
    const copied = spyOn(component.copyCommand, 'emit');
    const sent = spyOn(component.sendCommand, 'emit');
    fixture.nativeElement.querySelector('.server-command-action--copy').click();
    fixture.nativeElement.querySelector('.server-command-action--send').click();
    expect(copied).toHaveBeenCalledWith(command);
    expect(sent).toHaveBeenCalledWith(command);
  });

  it('shows why a command is unavailable and keeps it disabled', () => {
    component.commands = [{ ...command, canSend: false, reason: 'Selecciona un servidor.' }];
    const sent = spyOn(component.sendCommand, 'emit');
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.server-command-action--send');
    expect(button.disabled).toBeTrue();
    expect(fixture.nativeElement.querySelector('.server-command-reason').textContent).toContain('Selecciona un servidor.');
    button.click();
    expect(sent).not.toHaveBeenCalled();
  });

  it('blocks further sends and closing while a command is in flight', () => {
    component.sending = true;
    component.sendingKey = 'Ubicación|WHERE#';
    const closed = spyOn(component.visibleChange, 'emit');
    fixture.detectChanges();
    const send: HTMLButtonElement = fixture.nativeElement.querySelector('.server-command-action--send');
    const close: HTMLButtonElement = fixture.nativeElement.querySelector('.cancel-btn');
    expect(send.disabled).toBeTrue();
    expect(send.textContent).toContain('Enviando');
    expect(close.disabled).toBeTrue();
    close.click();
    component.onVisibleChange(false);
    expect(component.visible).toBeTrue();
    expect(closed).not.toHaveBeenCalled();
  });

  it('shows quota and message authors, and delegates history refresh', () => {
    component.deviceName = 'Vehículo de prueba';
    component.quota = { limit: 1000, used: 0, remaining: 1000, unlimited: true };
    component.messages = [
      { type: 'sent', content: ' WHERE# ', timestamp: new Date('2026-09-29T12:00:00Z'), createdby: 'montaogps', delivered: true },
      { type: 'received', content: 'Respuesta GPS', timestamp: new Date('2026-09-29T12:01:00Z') },
    ];
    const refreshed = spyOn(component.refreshMessages, 'emit');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.server-command-quota').textContent).toContain('Saldo: 1000/1000');
    const authors = [...fixture.nativeElement.querySelectorAll('.chat-author')].map((element: HTMLElement) => element.textContent);
    expect(authors).toEqual(['Montao GPS', 'Vehículo de prueba']);
    expect(fixture.nativeElement.querySelector('.chat-delivery').textContent).toContain('Entregado');
    fixture.nativeElement.querySelector('.server-command-refresh').click();
    expect(refreshed).toHaveBeenCalled();
  });

  it('keeps Testing visible until the owner confirms temporary registration cleanup', () => {
    component.controlledClose = true;
    component.closeLabel = 'Finalizar prueba';
    const requested = spyOn(component.closeRequested, 'emit');
    const changed = spyOn(component.visibleChange, 'emit');
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.cancel-btn');
    expect(button.textContent).toContain('Finalizar prueba');
    button.click();
    expect(requested).toHaveBeenCalledTimes(1);
    expect(component.visible).toBeTrue();
    expect(changed).not.toHaveBeenCalled();
    // A real PrimeNG close-icon click follows the same path as Escape.
    fixture.nativeElement.querySelector('.p-dialog-close-button').click();
    fixture.detectChanges();
    expect(requested).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('.p-dialog')).not.toBeNull();
    component.sending = true;
    component.onVisibleChange(false);
    expect(requested).toHaveBeenCalledTimes(2);
  });

  it('automatically adds a safe Maps link to a GPS reply while preserving the original SMS as text', () => {
    const content = 'lat:18.4861 lon:-69.9312 <img src=x onerror=alert(1)>';
    component.messages = [{ type: 'received', content, timestamp: new Date() }];
    fixture.detectChanges();
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('.chat-map-link');
    expect(link.textContent).toContain('Ver en Google Maps');
    const url = new URL(link.href);
    expect(url.origin).toBe('https://www.google.com');
    expect(url.pathname).toBe('/maps/search/');
    expect(url.searchParams.get('api')).toBe('1');
    expect(url.searchParams.get('query')).toBe('18.4861,-69.9312');
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
    expect(link.rel).toContain('noreferrer');
    expect(fixture.nativeElement.querySelector('.chat-text').textContent).toBe(content);
    expect(fixture.nativeElement.querySelector('.chat-bubble img')).toBeNull();
    expect(component.messages[0].content).toBe(content);
  });

  it('does not link outgoing commands or invalid replies, and updates links when a GPS response arrives', () => {
    component.messages = [
      { type: 'sent', content: 'lat:18.4861 lon:-69.9312', timestamp: new Date() },
      { type: 'received', content: 'lat:99.1 lon:-69.9312', timestamp: new Date() },
      { type: 'received', content: 'GPS OK. Bateria:90%', timestamp: new Date() },
    ];
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.chat-map-link').length).toBe(0);
    component.messages[2].content = 'lat:18.4861 lon:-69.9312';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.chat-map-link').length).toBe(1);
    component.messages[2].content = 'Sin señal GPS';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.chat-map-link').length).toBe(0);
  });
});
