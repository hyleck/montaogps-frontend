import { Directive, ElementRef, forwardRef, HostListener, Renderer2 } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { formatDeviceLabel } from '../pipes/device-label.pipe';

/** Keep editable names canonical while displaying the same alias as the pipe. */
@Directive({
  selector: 'input[appDeviceLabel]',
  standalone: true,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => DeviceLabelInputDirective),
    multi: true,
  }],
})
export class DeviceLabelInputDirective implements ControlValueAccessor {
  private modelValue = '';
  private composing = false;
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private element: ElementRef<HTMLInputElement>, private renderer: Renderer2) {}

  writeValue(value: string | null | undefined): void {
    this.modelValue = value ?? '';
    this.renderer.setProperty(this.element.nativeElement, 'value', formatDeviceLabel(this.modelValue));
  }

  registerOnChange(callback: (value: string) => void): void {
    this.onChange = callback;
  }

  registerOnTouched(callback: () => void): void {
    this.onTouched = callback;
  }

  setDisabledState(disabled: boolean): void {
    this.renderer.setProperty(this.element.nativeElement, 'disabled', disabled);
  }

  @HostListener('input', ['$event.target.value'])
  handleInput(value: string): void {
    if (this.composing) return;
    const canonicalToken = this.modelValue.match(/MTAG-A/i)?.[0];
    this.modelValue = canonicalToken ? value.replace(/MLock/gi, canonicalToken) : value;
    this.onChange(this.modelValue);
  }

  @HostListener('blur')
  handleBlur(): void {
    this.writeValue(this.modelValue);
    this.onTouched();
  }

  @HostListener('compositionstart')
  handleCompositionStart(): void {
    this.composing = true;
  }

  @HostListener('compositionend', ['$event.target.value'])
  handleCompositionEnd(value: string): void {
    this.composing = false;
    this.handleInput(value);
  }
}
