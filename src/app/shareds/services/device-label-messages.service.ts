import { Injectable } from '@angular/core';
import { Confirmation, ConfirmationService, MessageService, ToastMessageOptions } from 'primeng/api';
import { formatDeviceLabel } from '../pipes/device-label.pipe';

function displayText(value: string | undefined): string | undefined {
  return value === undefined ? value : formatDeviceLabel(value);
}

/** Format only visible text; leave keys, callbacks and message data untouched. */
@Injectable()
export class DeviceLabelMessageService extends MessageService {
  override add(message: ToastMessageOptions): void {
    super.add(this.formatMessage(message));
  }

  override addAll(messages: ToastMessageOptions[]): void {
    super.addAll(messages.map(message => this.formatMessage(message)));
  }

  private formatMessage(message: ToastMessageOptions): ToastMessageOptions {
    return {
      ...message,
      summary: displayText(message.summary),
      detail: displayText(message.detail),
    };
  }
}

@Injectable()
export class DeviceLabelConfirmationService extends ConfirmationService {
  override confirm(confirmation: Confirmation): this {
    return super.confirm({
      ...confirmation,
      header: displayText(confirmation.header),
      message: displayText(confirmation.message),
      acceptLabel: displayText(confirmation.acceptLabel),
      rejectLabel: displayText(confirmation.rejectLabel),
    });
  }
}
