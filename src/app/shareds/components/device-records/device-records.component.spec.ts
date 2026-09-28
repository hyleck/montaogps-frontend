import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DeviceRecordEntry } from 'src/app/core/interfaces/target.interface';
import { DeviceRecordsComponent } from './device-records.component';

describe('DeviceRecordsComponent', () => {
  let fixture: ComponentFixture<DeviceRecordsComponent>;
  let component: DeviceRecordsComponent;
  let element: HTMLElement;

  const installation: DeviceRecordEntry = {
    id: 'installation:1', occurredAt: '2026-09-28T13:52:00Z', category: 'installation',
    title: 'Instalación completada', description: 'Se verificó la instalación del GPS.',
    status: 'success', icon: 'pi-check-circle',
    actor: { id: 'technician', name: 'María Pérez', role: 'Técnico' },
    source: { type: 'solicitud', id: 'request' },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DeviceRecordsComponent] }).compileComponents();
    fixture = TestBed.createComponent(DeviceRecordsComponent);
    component = fixture.componentInstance;
    element = fixture.nativeElement;
  });

  it('renders the supplied chronology with its status, actor, description and local date', () => {
    const created: DeviceRecordEntry = {
      ...installation, id: 'device:1', occurredAt: '2026-09-28T12:00:00Z', category: 'device',
      title: 'Dispositivo registrado', status: 'info', icon: 'pi-plus-circle', actor: undefined,
    };
    component.entries = [created, installation];
    fixture.detectChanges();

    const cards = element.querySelectorAll('.device-records__card');
    expect(cards.length).toBe(2);
    expect(cards[0].querySelector('strong')?.textContent).toContain('Dispositivo registrado');
    expect(cards[1].querySelector('strong')?.textContent).toContain('Instalación completada');
    expect(cards[1].classList).toContain('device-records__card--success');
    expect(cards[1].querySelector('p')?.textContent).toContain(installation.description);
    expect(cards[0].querySelector('footer')).toBeNull();
    expect(cards[1].querySelector('footer')?.textContent).toContain('María Pérez');
    expect(cards[1].querySelector('footer small')?.textContent).toContain('Técnico');
    expect(element.querySelector('.device-records__marker--success .pi-check-circle')).not.toBeNull();
    const date = cards[1].querySelector('time');
    expect(date?.getAttribute('datetime')).toBe(installation.occurredAt);
    expect(date?.textContent?.trim()).toBe(new Date(installation.occurredAt).toLocaleString('es-ES', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }));
    expect(element.querySelector('.device-records__count')?.textContent).toContain('2 registros');
  });

  it('shows an empty history only after loading completes without an error', () => {
    component.loading = true;
    fixture.detectChanges();
    expect(element.querySelector('.device-records__loading')).not.toBeNull();
    expect(element.querySelector('.device-records__empty')).toBeNull();
    component.loading = false;
    fixture.detectChanges();
    expect(element.querySelector('.device-records__empty')?.textContent).toContain('Todavía no hay registros');
    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(element.querySelector('.device-records__timeline')).toBeNull();
  });

  it('distinguishes a failed request from an empty history and permits retry', () => {
    component.entries = [installation];
    component.error = 'No fue posible cargar los registros. Intenta otra vez.';
    const refresh = spyOn(component.refresh, 'emit');
    fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(component.error);
    expect(element.querySelector('.device-records__empty')).toBeNull();
    expect(element.querySelector('.device-records__timeline')).toBeNull();
    expect(element.querySelector('.device-records__count')).toBeNull();
    const retry = element.querySelector<HTMLButtonElement>('button[aria-label="Actualizar registros"]')!;
    expect(retry.disabled).toBeFalse();
    retry.click();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('prevents repeat requests while refreshing and hides the previous failure', () => {
    component.loading = true;
    component.error = 'Fallo anterior';
    const refresh = spyOn(component.refresh, 'emit');
    fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')).toBeNull();
    const button = element.querySelector<HTMLButtonElement>('button')!;
    expect(button.disabled).toBeTrue();
    button.click();
    expect(refresh).not.toHaveBeenCalled();
  });
});
