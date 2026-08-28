import { DeviceLabelConfirmationService, DeviceLabelMessageService } from './device-label-messages.service';

describe('Device label messages', () => {
  it('formats toast text without changing the original message, keys or payload', () => {
    const service = new DeviceLabelMessageService();
    const message = { summary: 'MTAG-A', detail: 'MTAG-A Toyota', key: 'MTAG-A', data: { name: 'MTAG-A' } };
    const received = jasmine.createSpy('received');
    service.messageObserver.subscribe(received);
    service.add(message);
    expect(received).toHaveBeenCalledWith({ ...message, summary: 'MLock', detail: 'MLock Toyota' });
    expect(message.detail).toBe('MTAG-A Toyota');
    service.addAll([message]);
    expect(received).toHaveBeenCalledWith([{ ...message, summary: 'MLock', detail: 'MLock Toyota' }]);
  });

  it('preserves confirmation callbacks and canonical values', () => {
    const service = new DeviceLabelConfirmationService();
    const accept = jasmine.createSpy('accept');
    const received = jasmine.createSpy('received');
    service.requireConfirmation$.subscribe(received);
    const confirmation = { header: 'MTAG-A', message: 'Cancelar MTAG-A Toyota', accept };
    expect(service.confirm(confirmation)).toBe(service);
    expect(received).toHaveBeenCalledWith(jasmine.objectContaining({
      header: 'MLock', message: 'Cancelar MLock Toyota', accept,
    }));
    expect(confirmation.message).toBe('Cancelar MTAG-A Toyota');
    expect(accept).not.toHaveBeenCalled();
  });
});
