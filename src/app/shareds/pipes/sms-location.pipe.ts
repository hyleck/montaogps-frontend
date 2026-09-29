import { Pipe, PipeTransform } from '@angular/core';
import { extractSmsLocation, SmsLocation } from 'src/app/core/utils/sms-location.util';

@Pipe({ name: 'smsLocation', standalone: true, pure: true })
export class SmsLocationPipe implements PipeTransform {
  transform(content: unknown): SmsLocation | null {
    return extractSmsLocation(content);
  }
}
