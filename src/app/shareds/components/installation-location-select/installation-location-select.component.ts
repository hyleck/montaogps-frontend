import { CommonModule } from '@angular/common';
import { Component, forwardRef, Input, OnDestroy, OnInit } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { InstallationLocationOption } from '../../../core/constants/installation-locations.constant';
import { InstallationLocationsService } from '../../../core/services/installation-locations.service';

@Component({
  selector: 'app-installation-location-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './installation-location-select.component.html',
  styleUrls: ['./installation-location-select.component.css'],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => InstallationLocationSelectComponent),
    multi: true,
  }],
})
export class InstallationLocationSelectComponent implements ControlValueAccessor, OnInit, OnDestroy {
  @Input() placeholder = 'Selecciona el lugar';
  @Input() inputId = '';

  locations: InstallationLocationOption[] = [];
  value = '';
  disabled = false;
  dialogVisible = false;
  newLocationLabel = '';
  saving = false;
  errorMessage = '';

  private readonly destroy$ = new Subject<void>();
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor(private readonly locationsService: InstallationLocationsService) {}

  ngOnInit(): void {
    this.locationsService.locations$
      .pipe(takeUntil(this.destroy$))
      .subscribe(locations => { this.locations = locations; });
    this.locationsService.load().pipe(takeUntil(this.destroy$)).subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get displayedLocations(): InstallationLocationOption[] {
    if (!this.value || this.locations.some(location => location.value === this.value)) {
      return this.locations;
    }
    return [...this.locations, { label: this.value, value: this.value, custom: true }];
  }

  writeValue(value: string | null | undefined): void {
    this.value = String(value || '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
  }

  markTouched(): void {
    this.onTouched();
  }

  selectValue(event: Event): void {
    const selected = (event.target as HTMLSelectElement).value;
    this.onTouched();
    this.value = selected;
    this.onChange(selected);
  }

  openDialog(): void {
    this.newLocationLabel = '';
    this.errorMessage = '';
    this.dialogVisible = true;
  }

  closeDialog(): void {
    if (this.saving) return;
    this.dialogVisible = false;
  }

  saveLocation(): void {
    const label = this.newLocationLabel.trim().replace(/\s+/g, ' ');
    if (label.length < 2) {
      this.errorMessage = 'Escribe el nombre del lugar de instalación.';
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.locationsService.create(label).subscribe({
      next: location => {
        this.saving = false;
        this.dialogVisible = false;
        this.value = location.value;
        this.onChange(location.value);
        this.onTouched();
      },
      error: error => {
        this.saving = false;
        const message = error?.error?.message;
        this.errorMessage = Array.isArray(message)
          ? message.join(' ')
          : String(message || 'No se pudo guardar el lugar. Intenta nuevamente.');
      },
    });
  }
}
