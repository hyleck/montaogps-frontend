import { Component, OnDestroy, OnInit } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { interval, Subscription } from 'rxjs';

import { HistorialesService } from '@core/services/historiales.service';
import {
  ArchiveDashboardResponse,
  ArchiveRun,
  RetentionServerStatus,
} from './historiales.interface';

@Component({
  selector: 'app-historiales-settings',
  standalone: false,
  templateUrl: './historiales-settings.component.html',
  styleUrl: './historiales-settings.component.css',
})
export class HistorialesSettingsComponent implements OnInit, OnDestroy {
  loading = true;
  refreshing = false;
  triggering = false;
  errorMessage = '';
  dashboard: ArchiveDashboardResponse | null = null;

  private refreshSubscription: Subscription | null = null;

  constructor(
    private readonly historialesService: HistorialesService,
    private readonly messageService: MessageService,
    private readonly confirmationService: ConfirmationService,
  ) {}

  ngOnInit(): void {
    this.loadDashboard(true);
    this.refreshSubscription = interval(15000).subscribe(() => {
      this.loadDashboard(false);
    });
  }

  ngOnDestroy(): void {
    this.refreshSubscription?.unsubscribe();
  }

  loadDashboard(showLoading = false): void {
    if (this.refreshing) return;
    this.refreshing = true;
    if (showLoading && !this.dashboard) this.loading = true;

    this.historialesService.getArchiveDashboard().subscribe({
      next: (response) => {
        this.dashboard = response;
        this.errorMessage = '';
        this.loading = false;
        this.refreshing = false;
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message ||
          'No se pudo consultar el estado de protección de los historiales.';
        this.loading = false;
        this.refreshing = false;
      },
    });
  }

  requestArchiveRun(): void {
    if (this.triggering || !this.dashboard?.worker.enabled) return;
    this.confirmationService.confirm({
      header: 'Ejecutar protección histórica',
      message:
        'Se copiarán los datos pendientes, se compararán con Traccar y solo se autorizará la limpieza si la verificación es exacta.',
      icon: 'pi pi-shield',
      acceptLabel: 'Ejecutar ahora',
      rejectLabel: 'Cancelar',
      accept: () => this.triggerArchiveRun(),
    });
  }

  private triggerArchiveRun(): void {
    this.triggering = true;
    this.historialesService.triggerArchive().subscribe({
      next: (response) => {
        this.triggering = false;
        this.messageService.add({
          severity: response.accepted ? 'success' : 'warn',
          summary: response.accepted
            ? 'Corrida iniciada'
            : 'No se pudo iniciar',
          detail: response.message,
        });
        window.setTimeout(() => this.loadDashboard(false), 800);
      },
      error: (error) => {
        this.triggering = false;
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo iniciar',
          detail:
            error?.error?.message ||
            'Ocurrió un error al solicitar la corrida histórica.',
        });
      },
    });
  }

  get servers(): RetentionServerStatus[] {
    return this.dashboard?.retention?.servers || [];
  }

  get isRunning(): boolean {
    return (this.dashboard?.summary.runningRuns || 0) > 0;
  }

  get verificationReady(): boolean {
    return (
      this.servers.length > 0 &&
      this.servers.every(
        (server) =>
          server.verificationVersion >= 3 &&
          !!server.retentionVerifiedAt &&
          server.deviceCount > 0,
      )
    );
  }

  get latestSuccessAt(): string | null {
    const values = this.servers
      .map((server) => server.lastSuccessAt)
      .filter((value): value is string => !!value)
      .sort();
    return values.at(-1) || null;
  }

  get earliestSafeBefore(): string | null {
    const values = this.servers
      .map((server) => server.safeBefore)
      .filter((value): value is string => !!value)
      .sort();
    return values[0] || null;
  }

  getRunProgress(run: ArchiveRun): number {
    if (run.status === 'completed') return 100;
    if (!run.totalDevices) return 0;
    return Math.min(
      100,
      Math.round(
        ((run.completedDevices + run.failedDevices) / run.totalDevices) * 100,
      ),
    );
  }

  getRunStatusLabel(status: ArchiveRun['status']): string {
    const labels: Record<ArchiveRun['status'], string> = {
      running: 'En ejecución',
      completed: 'Completada',
      failed: 'Fallida',
      cancelled: 'Cancelada',
    };
    return labels[status] || status;
  }

  getServerStatusLabel(server: RetentionServerStatus): string {
    if (server.enabled) return 'Protegido';
    if (server.archiveReady) return 'Pendiente de verificación';
    return 'Limpieza bloqueada';
  }

  getBlockingReasons(reason: string | null): string[] {
    if (!reason) return [];
    return reason
      .split(/\.\s+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  shortDigest(digest: string | null): string {
    if (!digest) return 'Sin huella';
    return `${digest.slice(0, 10)}…${digest.slice(-6)}`;
  }

  formatRunDuration(run: ArchiveRun): string {
    if (!run.startedAt) return '—';
    const end = run.completedAt || run.failedAt || new Date().toISOString();
    const milliseconds = Math.max(
      0,
      new Date(end).getTime() - new Date(run.startedAt).getTime(),
    );
    const minutes = Math.floor(milliseconds / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${Math.max(1, Math.floor(milliseconds / 1000))}s`;
  }

  trackServer(index: number, server: RetentionServerStatus): string {
    return server.serverId || server.serverName || String(index);
  }

  trackRun(_: number, run: ArchiveRun): string {
    return run.id;
  }
}
