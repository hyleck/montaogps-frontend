import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ProtocolCommand } from 'src/app/core/interfaces/protocol.interface';
import { SmsCommandQuotaResponse } from 'src/app/core/services/targets.service';
import { DeviceLabelPipe } from 'src/app/shareds/pipes/device-label.pipe';
import { SmsLocationPipe } from 'src/app/shareds/pipes/sms-location.pipe';

export type SmsDialogCommand = ProtocolCommand & {
  commandIndex?: number;
  canSend?: boolean;
  reason?: string;
};

export interface SmsDialogMessage {
  type: 'sent' | 'received';
  content: string;
  timestamp: Date | string;
  delivered?: boolean;
  createdby?: string;
  pending?: boolean;
}

@Component({
  selector: 'app-sms-commands-dialog',
  standalone: true,
  imports: [CommonModule, DialogModule, DeviceLabelPipe, SmsLocationPipe],
  templateUrl: './sms-commands-dialog.component.html',
  styleUrls: ['./sms-commands-dialog.component.css'],
})
export class SmsCommandsDialogComponent implements OnChanges, OnDestroy {
  @Input() visible = false;
  @Input() modelName = '';
  @Input() deviceName = '';
  @Input() simNumber = '';
  @Input() commands: SmsDialogCommand[] = [];
  @Input() error = '';
  @Input() loadingQuota = false;
  @Input() quota: SmsCommandQuotaResponse | null = null;
  @Input() sendingKey = '';
  @Input() sending = false;
  @Input() quotaExhausted = false;
  @Input() messages: SmsDialogMessage[] = [];
  @Input() loadingMessages = false;
  @Input() hasLoadedMessages = false;
  @Input() controlledClose = false;
  @Input() closeLabel = 'Cerrar';

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() closed = new EventEmitter<void>();
  @Output() closeRequested = new EventEmitter<void>();
  @Output() copyCommand = new EventEmitter<SmsDialogCommand>();
  @Output() sendCommand = new EventEmitter<SmsDialogCommand>();
  @Output() refreshMessages = new EventEmitter<void>();

  @ViewChild('chatMessages') chatMessages?: ElementRef<HTMLDivElement>;
  private scrollTimer?: ReturnType<typeof setTimeout>;

  get quotaLabel(): string {
    if (this.loadingQuota) return 'Consultando saldo...';
    if (!this.quota || this.quota.remaining === null || this.quota.limit === null) return '';
    return `Saldo: ${this.quota.remaining}/${this.quota.limit}`;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.visible && (changes['visible'] || changes['messages'])) this.scrollToBottom();
  }

  ngOnDestroy(): void {
    clearTimeout(this.scrollTimer);
  }

  onVisibleChange(visible: boolean): void {
    if (!visible && this.sending) return;
    if (!visible && this.controlledClose) {
      this.closeRequested.emit();
      return;
    }
    this.visible = visible;
    this.visibleChange.emit(visible);
  }

  isSendingCommand(command: SmsDialogCommand): boolean {
    return this.sendingKey === `${command?.name || ''}|${command?.value || ''}`;
  }

  onSend(command: SmsDialogCommand): void {
    if (this.sending || this.isSendingCommand(command) || this.quotaExhausted || command.canSend === false) return;
    this.sendCommand.emit(command);
  }

  messageAuthor(message: SmsDialogMessage): string {
    return (message.createdby || '').toLowerCase() === 'montaogps'
      ? 'Montao GPS'
      : this.deviceName || 'Dispositivo';
  }

  scrollToBottom(): void {
    clearTimeout(this.scrollTimer);
    this.scrollTimer = setTimeout(() => {
      const element = this.chatMessages?.nativeElement;
      if (element) element.scrollTop = element.scrollHeight;
    }, 120);
  }
}
