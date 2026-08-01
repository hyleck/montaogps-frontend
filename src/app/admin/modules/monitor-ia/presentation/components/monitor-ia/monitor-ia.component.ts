import { Component, OnDestroy, OnInit } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { finalize } from 'rxjs';
import {
  MonitorClient,
  MonitorRecord,
  MonitorSession,
} from '../../models/monitor-ia.models';
import { MonitorIaApiService } from '../../services/monitor-ia-api.service';

@Component({
  selector: 'app-monitor-ia',
  templateUrl: './monitor-ia.component.html',
  styleUrls: ['./monitor-ia.component.css'],
  standalone: false,
})
export class MonitorIaComponent implements OnInit, OnDestroy {
  session: MonitorSession | null = null;
  records: MonitorRecord[] = [];
  recordsTotal = 0;
  page = 1;
  readonly limit = 30;
  search = '';
  loading = true;
  starting = false;
  canceling = false;
  sendingTestContact = false;
  latestTestContact: {
    status: 'sent' | 'failed';
    phone?: string;
    contactedAt?: string;
    error?: string;
  } | null = null;
  selectedClient: MonitorClient | null = null;
  clientSearchResults: MonitorClient[] = [];
  clientSearchTotal = 0;
  clientSearch = '';
  clientSearchLoading = false;
  clientPickerOpen = true;
  private pollingTimer?: ReturnType<typeof setInterval>;
  private clientSearchTimer?: ReturnType<typeof setTimeout>;
  private clientSearchRequestId = 0;

  constructor(
    private readonly api: MonitorIaApiService,
    private readonly messageService: MessageService,
    private readonly confirmationService: ConfirmationService,
  ) {}

  ngOnInit(): void {
    this.loadActiveSession();
    this.loadClients();
  }

  ngOnDestroy(): void {
    this.stopPolling();
    if (this.clientSearchTimer) clearTimeout(this.clientSearchTimer);
  }

  confirmStartScan(): void {
    if (!this.starting && !this.isRunning) this.startScan();
  }

  applySearch(): void {
    this.page = 1;
    this.loadRecords();
  }

  onPageChange(event: any): void {
    this.page = Number(event?.page || 0) + 1;
    this.loadRecords();
  }

  get isRunning(): boolean {
    return (
      this.session?.status === 'queued' || this.session?.status === 'running'
    );
  }

  get canSendTestContact(): boolean {
    return !this.sendingTestContact;
  }

  get displayedTestContactStatus(): string {
    return (
      this.latestTestContact?.status ||
      this.session?.testContactStatus ||
      'not_contacted'
    );
  }

  get displayedTestContactPhone(): string {
    return (
      this.latestTestContact?.phone || this.session?.testContactPhone || ''
    );
  }

  get displayedTestContactedAt(): string | undefined {
    return (
      this.latestTestContact?.contactedAt || this.session?.testContactedAt
    );
  }

  get displayedTestContactError(): string {
    return (
      this.latestTestContact?.error || this.session?.testContactError || ''
    );
  }

  get selectedClientId(): string {
    return String(this.selectedClient?._id || '').trim();
  }

  get selectedClientName(): string {
    if (!this.selectedClient) return '';
    return [this.selectedClient.name, this.selectedClient.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  get selectedClientInitials(): string {
    const words = this.selectedClientName.split(/\s+/).filter(Boolean);
    return `${words[0]?.[0] || 'C'}${words[1]?.[0] || ''}`.toUpperCase();
  }

  onClientSearchChange(): void {
    if (this.clientSearchTimer) clearTimeout(this.clientSearchTimer);
    this.clientPickerOpen = true;
    this.clientSearchTimer = setTimeout(() => {
      this.clientSearchTimer = undefined;
      this.loadClients();
    }, 300);
  }

  selectClient(client: MonitorClient): void {
    this.selectedClient = client;
    this.clientPickerOpen = false;
    this.clientSearch = '';
  }

  openClientPicker(): void {
    this.clientPickerOpen = true;
    this.loadClients();
  }

  get offlineRecords(): MonitorRecord[] {
    return this.records.filter(
      (record) => (record.offlineDevices || []).length > 0,
    );
  }

  get statusLabel(): string {
    const labels: Record<string, string> = {
      queued: 'En cola',
      running: 'Ejecutándose',
      completed: 'Completado',
      completed_with_errors: 'Completado con alertas',
      failed: 'Falló',
      cancelled: 'Cancelado',
    };
    return labels[this.session?.status || ''] || 'Sin ejecución';
  }

  get statusClass(): string {
    return `status-${this.session?.status || 'empty'}`;
  }

  formatTimeOffline(lastUpdate: unknown): string {
    if (!lastUpdate) return 'Estado inicial';
    const date = new Date(String(lastUpdate));
    if (Number.isNaN(date.getTime()) || date.getFullYear() < 2010) {
      return 'Estado inicial';
    }
    const hours = Math.max(
      0,
      Math.floor((Date.now() - date.getTime()) / 3_600_000),
    );
    if (hours < 24) return `Hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Hace ${days} ${days === 1 ? 'día' : 'días'}`;
  }

  trackRecord(_: number, record: MonitorRecord): string {
    return record._id || record.userId;
  }

  cancelScan(): void {
    if (!this.session?._id || !this.isRunning || this.canceling) return;

    this.canceling = true;
    this.api
      .cancelScan(this.session._id)
      .pipe(finalize(() => (this.canceling = false)))
      .subscribe({
        next: (session) => {
          this.stopPolling();
          this.session = session;
          this.loadRecords();
          this.messageService.add({
            severity: 'warn',
            summary: 'Escaneo cancelado',
            detail: session.message,
          });
        },
        error: (error) =>
          this.showError(error, 'No se pudo cancelar el escaneo.'),
      });
  }

  confirmWillisContactTest(): void {
    if (!this.canSendTestContact || this.sendingTestContact) return;

    this.confirmationService.confirm({
      header: 'Enviar prueba por WhatsApp',
      message:
        'Esta prueba está bloqueada en el backend para que únicamente pueda recibirla willis@montao.net. Ningún otro cliente será contactado.',
      icon: 'pi pi-shield',
      acceptLabel: 'Enviar solo a Willis',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-success',
      accept: () => this.sendWillisContactTest(),
    });
  }

  private startScan(): void {
    if (!this.selectedClientId) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Selecciona un cliente',
        detail: 'Elige la rama que deseas monitorear antes de iniciar.',
      });
      return;
    }

    this.starting = true;
    this.api
      .startScan(this.selectedClientId)
      .pipe(finalize(() => (this.starting = false)))
      .subscribe({
        next: (result) => {
          this.messageService.add({
            severity: 'success',
            summary: 'Escaneo en cola',
            detail: result.message,
          });
          this.session = {
            _id: result.sessionId,
            phase: 1,
            scanRootUserId: this.selectedClientId,
            scanRootUserName: this.selectedClientName,
            scanRootUserPhone:
              this.selectedClient?.phone || this.selectedClient?.phone2 || '',
            status: 'queued',
            progress: 0,
            totalUsers: 0,
            processedUsers: 0,
            totalDevices: 0,
            offlineDevices: 0,
            qualifyingUsers: 0,
            validContactPhones: 0,
            testContactStatus: 'not_contacted',
            testContactEmail: 'willis@montao.net',
            errorsCount: 0,
            message: result.message,
          };
          this.records = [];
          this.recordsTotal = 0;
          this.startPolling();
        },
        error: (error) =>
          this.showError(error, 'No se pudo iniciar la Fase 1.'),
      });
  }

  private sendWillisContactTest(): void {
    this.sendingTestContact = true;
    this.api
      .sendWillisContactTest()
      .pipe(finalize(() => (this.sendingTestContact = false)))
      .subscribe({
        next: (result) => {
          this.latestTestContact = {
            status: 'sent',
            phone: result.phone,
            contactedAt: result.contactedAt,
            error: '',
          };
          this.loadRecords();
          this.messageService.add({
            severity: 'success',
            summary: 'Prueba enviada a Willis',
            detail: `El mensaje se envió únicamente a ${result.email}.`,
          });
        },
        error: (error) => {
          this.latestTestContact = {
            status: 'failed',
            error:
              error?.error?.message ||
              'No se pudo enviar la prueba a Willis.',
          };
          this.showError(error, 'No se pudo enviar la prueba a Willis.');
        },
      });
  }

  private loadActiveSession(): void {
    this.loading = true;
    this.api
      .getActiveSession()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (session) => {
          this.session = session;
          this.restoreSelectedClient(session);
          if (session?._id) this.loadRecords();
          if (session?.status === 'queued' || session?.status === 'running') {
            this.startPolling();
          }
        },
        error: (error) =>
          this.showError(error, 'No se pudo cargar Monitor IA.'),
      });
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollingTimer = setInterval(() => this.refreshSession(), 5000);
    this.refreshSession();
  }

  private stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = undefined;
    }
  }

  private refreshSession(): void {
    if (!this.session?._id) return;
    this.api.getSession(this.session._id).subscribe({
      next: (session) => {
        const wasRunning = this.isRunning;
        this.session = session;
        this.loadRecords();
        if (session.status !== 'queued' && session.status !== 'running') {
          this.stopPolling();
          if (wasRunning) {
            this.messageService.add({
              severity:
                session.status === 'failed'
                  ? 'error'
                  : session.status === 'completed_with_errors'
                    ? 'warn'
                    : 'success',
              summary: this.statusLabel,
              detail: session.message || 'El escaneo terminó.',
            });
          }
        }
      },
      error: (error) =>
        this.showError(error, 'No se pudo actualizar el escaneo.'),
    });
  }

  private loadRecords(): void {
    if (!this.session?._id) return;
    this.api
      .getRecords(this.session._id, this.page, this.limit, this.search)
      .subscribe({
        next: (response) => {
          this.records = (response.items || []).map((record) => ({
            ...record,
            userPhoneValid: this.isContactPhoneValid(record),
          }));
          this.recordsTotal = response.total || 0;
        },
        error: (error) =>
          this.showError(error, 'No se pudieron cargar los resultados.'),
      });
  }

  private loadClients(): void {
    const requestId = ++this.clientSearchRequestId;
    this.clientSearchLoading = true;
    this.api
      .getClients(this.clientSearch.trim(), 1, 50)
      .pipe(
        finalize(() => {
          if (requestId === this.clientSearchRequestId) {
            this.clientSearchLoading = false;
          }
        }),
      )
      .subscribe({
        next: (response) => {
          if (requestId !== this.clientSearchRequestId) return;
          this.clientSearchResults = response.items || [];
          this.clientSearchTotal = response.total || 0;
        },
        error: (error) => {
          if (requestId !== this.clientSearchRequestId) return;
          this.showError(error, 'No se pudieron cargar los clientes.');
        },
      });
  }

  private restoreSelectedClient(session: MonitorSession | null): void {
    if (!session?.scanRootUserId || this.selectedClient) return;
    this.selectedClient = {
      _id: session.scanRootUserId,
      name: session.scanRootUserName || 'Cliente',
      last_name: '',
      phone: session.scanRootUserPhone || '',
    };
    this.clientPickerOpen = false;
  }

  private isContactPhoneValid(record: MonitorRecord): boolean {
    if (record.userPhoneValid === true) return true;

    const rawPhone = String(record.userPhone || '').trim();
    const digits = rawPhone.replace(/\D/g, '');
    return (
      /^[2-9]\d{2}[2-9]\d{6}$/.test(digits) ||
      /^1[2-9]\d{2}[2-9]\d{6}$/.test(digits) ||
      (rawPhone.startsWith('+') && /^\d{8,15}$/.test(digits)) ||
      /^[1-9]\d{10,14}$/.test(digits)
    );
  }

  private showError(error: any, fallback: string): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Monitor IA',
      detail: error?.error?.message || fallback,
    });
  }
}
