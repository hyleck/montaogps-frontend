import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { finalize } from 'rxjs';
import {
  FunnelDevice,
  FunnelSession,
} from '../../models/monitor-ia.models';
import { MonitorIaApiService } from '../../services/monitor-ia-api.service';
import { getApiErrorMessage } from '../../../../../../core/utils/api-error.util';

@Component({
  selector: 'app-monitor-ia-funnel',
  templateUrl: './monitor-ia-funnel.component.html',
  styleUrls: ['./monitor-ia-funnel.component.css'],
  standalone: false,
})
export class MonitorIaFunnelComponent implements OnInit, OnDestroy {
  session: FunnelSession | null = null;
  devices: FunnelDevice[] = [];
  total = 0;
  page = 1;
  readonly limit = 30;
  waitHours = 5;
  search = '';
  finalStatus = '';
  loading = true;
  starting = false;
  savingContact = false;
  contactDeviceId: string | null = null;
  contactResponse = '';
  private pollingTimer?: ReturnType<typeof setInterval>;

  readonly phases = [
    { label: 'Detección', icon: 'pi pi-search', phase: 1 },
    { label: 'Reactivación real', icon: 'pi pi-bolt', phase: 2 },
    { label: 'Espera', icon: 'pi pi-clock', phase: 3 },
    { label: 'Re-verificación', icon: 'pi pi-refresh', phase: 4 },
    { label: 'Campaña', icon: 'pi pi-megaphone', phase: 5 },
  ];

  readonly statusFilters = [
    { value: '', label: 'Todos' },
    { value: 'persistent', label: 'Pendientes de contacto' },
    { value: 'recovered', label: 'Recuperados' },
    { value: 'error', label: 'Errores técnicos' },
  ];

  constructor(
    private readonly api: MonitorIaApiService,
    private readonly router: Router,
    private readonly confirmationService: ConfirmationService,
    private readonly messageService: MessageService,
  ) {}

  ngOnInit(): void {
    this.loadSession();
    this.pollingTimer = setInterval(() => this.loadSession(false), 5000);
  }

  ngOnDestroy(): void {
    if (this.pollingTimer) clearInterval(this.pollingTimer);
  }

  confirmStart(): void {
    const hours = Math.max(1, Math.min(24, Number(this.waitHours) || 5));
    this.waitHours = hours;
    this.confirmationService.confirm({
      header: 'Iniciar reactivación real',
      icon: 'pi pi-bolt',
      message: `Se iniciará la activación SIM, APN y servidor de los equipos vigentes, y se volverán a consultar dentro de ${hours} hora(s).`,
      acceptLabel: 'Iniciar embudo',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-warning',
      accept: () => this.startFunnel(),
    });
  }

  confirmForceRecheck(): void {
    if (!this.session?._id) return;
    this.confirmationService.confirm({
      header: 'Verificar ahora',
      icon: 'pi pi-refresh',
      message:
        'La espera terminará ahora y se consultará la telemetría actual de todos los dispositivos.',
      acceptLabel: 'Re-verificar',
      rejectLabel: 'Continuar esperando',
      accept: () => this.forceRecheck(),
    });
  }

  applyFilters(): void {
    this.page = 1;
    this.loadDevices();
  }

  onPageChange(event: any): void {
    this.page = Number(event?.page || 0) + 1;
    this.loadDevices();
  }

  openContactForm(deviceId: string): void {
    this.contactDeviceId = deviceId;
    this.contactResponse = '';
  }

  cancelContact(): void {
    this.contactDeviceId = null;
    this.contactResponse = '';
  }

  submitContact(): void {
    if (!this.contactDeviceId || this.contactResponse.trim().length < 2) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Resultado requerido',
        detail: 'Especifica el resultado real de la conversación.',
      });
      return;
    }
    this.savingContact = true;
    this.api
      .markContacted(this.contactDeviceId, this.contactResponse.trim())
      .pipe(finalize(() => (this.savingContact = false)))
      .subscribe({
        next: () => {
          this.cancelContact();
          this.loadDevices();
          this.messageService.add({
            severity: 'success',
            summary: 'Contacto registrado',
            detail: 'Se guardó con la identidad del usuario autenticado.',
          });
        },
        error: (error) => this.showError(error, 'No se guardó el contacto.'),
      });
  }

  openConversation(device: FunnelDevice): void {
    if (!device.conversationId) return;
    this.router.navigate([
      '/admin/communication',
      'chat',
      device.conversationId,
    ]);
  }

  openCampaign(): void {
    if (!this.session?.campaignListId) return;
    this.router.navigate(['/admin/interacciones'], {
      queryParams: { listId: this.session.campaignListId },
    });
  }

  goBack(): void {
    this.router.navigate(['/admin/monitor-ia']);
  }

  get isActive(): boolean {
    return !!this.session && !['completed', 'failed'].includes(this.session.status);
  }

  getTimeRemaining(): string {
    if (!this.session?.recheckScheduledAt) return '';
    const remaining =
      new Date(this.session.recheckScheduledAt).getTime() - Date.now();
    if (remaining <= 0) return 'Re-verificación en cola';
    const hours = Math.floor(remaining / 3_600_000);
    const minutes = Math.ceil((remaining % 3_600_000) / 60_000);
    return `${hours}h ${minutes}m restantes`;
  }

  getPhaseStatus(phase: number): 'pending' | 'active' | 'completed' {
    if (!this.session) return 'pending';
    if (this.session.phase > phase || this.session.status === 'completed') {
      return 'completed';
    }
    if (this.session.phase === phase && this.session.status !== 'failed') {
      return 'active';
    }
    return 'pending';
  }

  statusLabel(status: FunnelDevice['finalStatus']): string {
    const labels: Record<string, string> = {
      pending: 'En proceso',
      recovered: 'Recuperado',
      persistent: 'Requiere contacto',
      error: 'Error técnico',
    };
    return labels[status] || status;
  }

  trackDevice(_: number, device: FunnelDevice): string {
    return device._id;
  }

  private startFunnel(): void {
    this.starting = true;
    this.api
      .startFunnel(this.waitHours)
      .pipe(finalize(() => (this.starting = false)))
      .subscribe({
        next: (result) => {
          this.messageService.add({
            severity: 'success',
            summary: 'Embudo en cola',
            detail: result.message,
          });
          this.loadSession();
        },
        error: (error) =>
          this.showError(error, getApiErrorMessage(error, 'No se pudo iniciar el embudo.')),
      });
  }

  private forceRecheck(): void {
    if (!this.session?._id) return;
    this.api.forceRecheck(this.session._id).subscribe({
      next: (result) => {
        this.messageService.add({
          severity: 'info',
          summary: 'Re-verificación',
          detail: result.message,
        });
        this.loadSession();
      },
      error: (error) =>
        this.showError(error, getApiErrorMessage(error, 'No se pudo iniciar la re-verificación.')),
    });
  }

  private loadSession(showLoading = true): void {
    if (showLoading) this.loading = true;
    this.api
      .getActiveFunnel()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (session) => {
          this.session = session;
          if (session?._id) this.loadDevices();
          else {
            this.devices = [];
            this.total = 0;
          }
        },
        error: (error) =>
          this.showError(error, getApiErrorMessage(error, 'No se pudo cargar el embudo.')),
      });
  }

  private loadDevices(): void {
    if (!this.session?._id) return;
    this.api
      .getFunnelDevices(
        this.session._id,
        this.page,
        this.limit,
        this.search,
        this.finalStatus,
      )
      .subscribe({
        next: (response) => {
          this.devices = response.items || [];
          this.total = response.total || 0;
        },
        error: (error) =>
          this.showError(error, getApiErrorMessage(error, 'No se pudieron cargar los dispositivos.')),
      });
  }

  private showError(error: any, fallback: string): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Embudo de reactivación',
      detail: error?.error?.message || fallback,
    });
  }
}
