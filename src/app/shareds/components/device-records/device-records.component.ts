import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DeviceRecordEntry } from 'src/app/core/interfaces/target.interface';

@Component({
  selector: 'app-device-records',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './device-records.component.html',
  styleUrls: ['./device-records.component.css'],
})
export class DeviceRecordsComponent {
  private static nextId = 0;
  readonly headingId = `device-records-title-${++DeviceRecordsComponent.nextId}`;

  @Input() entries: DeviceRecordEntry[] = [];
  @Input() loading = false;
  @Input() error = '';
  @Output() refresh = new EventEmitter<void>();

  formatDateTime(value: string): string {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'Fecha no disponible';
    return date.toLocaleString('es-ES', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  }
}
