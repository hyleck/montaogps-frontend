import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { finalize } from 'rxjs';
import {
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
  private pollingTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly api: MonitorIaApiService,
    private readonly router: Router,
    private readonly confirmationService: ConfirmationService,
    private readonly messageService: MessageService,
  ) {}

  ngOnInit(): void {
    this.loadActiveSession();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  confirmStartScan(): void {
    this.confirmationService.confirm({
      header: 'Iniciar escaneo profundo',
      icon: 'pi pi-shield',
      message:
        'Se consultará en vivo la telemetría y el estado de las SIM de todo tu árbol de usuarios. El historial anterior se conservará.',
      acceptLabel: 'Iniciar escaneo',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-primary',
      accept: () => this.startScan(),
    });
  }

  applySearch(): void {
    this.page = 1;
    this.loadRecords();
  }

  onPageChange(event: any): void {
    this.page = Number(event?.page || 0) + 1;
    this.loadRecords();
  }

  goToSegmentation(): void {
    this.router.navigate(['/admin/monitor-ia/segmentacion']);
  }

  goToFunnel(): void {
    this.router.navigate(['/admin/monitor-ia/funnel']);
  }

  get isRunning(): boolean {
    return (
      this.session?.status === 'queued' ||
      this.session?.status === 'running'
    );
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

  private startScan(): void {
    this.starting = true;
    this.api
      .startScan(true)
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
            status: 'queued',
            progress: 0,
            totalUsers: 0,
            processedUsers: 0,
            totalDevices: 0,
            offlineDevices: 0,
            errorsCount: 0,
            message: result.message,
          };
          this.records = [];
          this.recordsTotal = 0;
          this.startPolling();
        },
        error: (error) =>
          this.showError(
            error,
            'No se pudo iniciar el escaneo profundo.',
          ),
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
          if (session?._id) this.loadRecords();
          if (
            session?.status === 'queued' ||
            session?.status === 'running'
          ) {
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
        if (
          session.status !== 'queued' &&
          session.status !== 'running'
        ) {
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
          this.records = response.items || [];
          this.recordsTotal = response.total || 0;
        },
        error: (error) =>
          this.showError(error, 'No se pudieron cargar los resultados.'),
      });
  }

  private showError(error: any, fallback: string): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Monitor IA',
      detail: error?.error?.message || fallback,
    });
  }
}
