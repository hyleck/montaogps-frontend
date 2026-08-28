import { Pipe, PipeTransform } from '@angular/core';

/** Presentation alias only: never use this value to identify or save a protocol. */
export function formatDeviceLabel(value: unknown): string {
  return value == null ? '' : String(value).replace(/MTAG-A/gi, 'MLock');
}

@Pipe({
  name: 'deviceLabel',
  standalone: true,
})
export class DeviceLabelPipe implements PipeTransform {
  transform(value: unknown): string {
    return formatDeviceLabel(value);
  }
}
