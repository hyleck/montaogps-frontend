import { Pipe, PipeTransform } from '@angular/core';
import { formatUserName } from 'src/app/core/utils/user-name.util';

@Pipe({ name: 'userName', standalone: true })
export class UserNamePipe implements PipeTransform {
  transform(value: unknown): string {
    return formatUserName(value);
  }
}
