import { DatePipe } from '@angular/common';
import { ProcessesComponent } from './processes.component';
import { ProcessItem } from '../../services/processes.service';

describe('ProcessesComponent process date', () => {
  const component = Object.create(ProcessesComponent.prototype) as ProcessesComponent;

  it('shows the installation day instead of the day the record was created', () => {
    const process = {
      registrationDate: '2026-08-26T00:00:00.000Z',
      createdAt: '2026-08-28T21:43:11.706Z',
    } as ProcessItem;

    expect(new DatePipe('en-US').transform(component.getProcessDate(process), 'dd/MM/yyyy'))
      .toBe('26/08/2026');
    expect(process.createdAt).toBe('2026-08-28T21:43:11.706Z');
  });

  it('falls back to the creation timestamp for legacy records without a process date', () => {
    const process = { createdAt: '2026-08-28T21:43:11.706Z' } as ProcessItem;
    expect(component.getProcessDate(process)?.toISOString()).toBe(process.createdAt);
  });
});
