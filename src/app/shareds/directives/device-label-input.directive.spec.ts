import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { DeviceLabelInputDirective } from './device-label-input.directive';

@Component({
  standalone: true,
  imports: [FormsModule, DeviceLabelInputDirective],
  template: '<input appDeviceLabel [(ngModel)]="name" [disabled]="disabled">',
})
class TestHost {
  name = 'MTAG-A Toyota';
  disabled = false;
}

describe('DeviceLabelInputDirective', () => {
  async function setup() {
    await TestBed.configureTestingModule({ imports: [TestHost] }).compileComponents();
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, host: fixture.componentInstance, input: fixture.nativeElement.querySelector('input') as HTMLInputElement };
  }

  it('displays the alias without changing the model on load or blur', async () => {
    const { host, input } = await setup();
    expect(input.value).toBe('MLock Toyota');
    input.dispatchEvent(new Event('blur'));
    expect(host.name).toBe('MTAG-A Toyota');
  });

  it('preserves the canonical prefix when the rest of the name is edited', async () => {
    const { host, input } = await setup();
    input.value = 'MLock Toyota negro';
    input.dispatchEvent(new Event('input'));
    expect(host.name).toBe('MTAG-A Toyota negro');
    input.dispatchEvent(new Event('blur'));
    expect(input.value).toBe('MLock Toyota negro');
  });

  it('allows removing the prefix and leaves unrelated MLock text unchanged', async () => {
    const { fixture, host, input } = await setup();
    input.value = 'Toyota negro';
    input.dispatchEvent(new Event('input'));
    expect(host.name).toBe('Toyota negro');
    host.name = 'MLock personal';
    fixture.detectChanges();
    await fixture.whenStable();
    input.value = 'MLock personal nuevo';
    input.dispatchEvent(new Event('input'));
    expect(host.name).toBe('MLock personal nuevo');
  });

  it('supports disabled controls and composition input', async () => {
    const { fixture, host, input } = await setup();
    input.dispatchEvent(new Event('compositionstart'));
    input.value = 'MLock camión';
    input.dispatchEvent(new Event('input'));
    expect(host.name).toBe('MTAG-A Toyota');
    input.dispatchEvent(new Event('compositionend'));
    expect(host.name).toBe('MTAG-A camión');
    host.disabled = true;
    fixture.detectChanges();
    await fixture.whenStable();
    expect(input.disabled).toBeTrue();
  });
});
