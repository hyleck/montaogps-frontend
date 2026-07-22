import { Component, OnInit } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import {
  ProcessesService,
  ProcessItem,
  TechnicianWorkStatsResponse,
} from '../../../../processes/presentation/services/processes.service';
import { ClientVerificationMetrics, UserService } from '../../../../../../core/services/user.service';
import { TargetsService, VehicleDataCompletenessMetrics, VehicleVerificationMetrics } from '../../../../../../core/services/targets.service';
import { MonitoringService } from '../../../../../../core/services/monitoring.service';
import { AuthService } from '../../../../../../core/services/auth.service';

interface MetricCard {
  label: string;
  value: string | number;
  detail: string;
  icon: string;
  tone: 'red' | 'green' | 'blue' | 'amber';
}

interface DeviceConnectionMetrics {
  total: number;
  online: number;
  offline: number;
  onlinePercent: number;
  offlinePercent: number;
}

type HealthLevel = 'critical' | 'warning' | 'stable' | 'good' | 'excellent';

@Component({
  selector: 'app-metrics',
  standalone: false,
  templateUrl: './metrics.component.html',
  styleUrls: ['./metrics.component.css']
})
export class MetricsComponent implements OnInit {
  loading = false;
  errorMessage = '';

  metricCards: MetricCard[] = [];
  clientVerification: ClientVerificationMetrics = {
    total: 0,
    verified: 0,
    pending: 0,
    verifiedPercent: 0,
    pendingPercent: 0,
  };
  vehicleVerification: VehicleVerificationMetrics = {
    total: 0,
    verified: 0,
    pending: 0,
    verifiedPercent: 0,
    pendingPercent: 0,
  };
  vehicleDataCompleteness: VehicleDataCompletenessMetrics = {
    total: 0,
    complete: 0,
    incomplete: 0,
    completePercent: 0,
    incompletePercent: 0,
  };
  deviceConnection: DeviceConnectionMetrics = {
    total: 0,
    online: 0,
    offline: 0,
    onlinePercent: 0,
    offlinePercent: 0,
  };
  technicianWork: TechnicianWorkStatsResponse = this.emptyTechnicianWork();

  constructor(
    private processesService: ProcessesService,
    private userService: UserService,
    private targetsService: TargetsService,
    private monitoringService: MonitoringService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadMetrics();
  }

  loadMetrics(): void {
    this.loading = true;
    this.errorMessage = '';

    forkJoin({
      aggregate: this.processesService.getPaginated(1, 1000),
      clientVerification: this.userService.getClientVerificationMetrics().pipe(
        catchError(() => of(this.emptyClientVerification()))
      ),
      vehicleVerification: this.targetsService.getVehicleVerificationMetrics().pipe(
        catchError(() => of(this.emptyVehicleVerification()))
      ),
      vehicleDataCompleteness: this.targetsService.getVehicleDataCompletenessMetrics().pipe(
        catchError(() => of(this.emptyVehicleDataCompleteness()))
      ),
      deviceConnection: this.getDeviceConnectionMetricsFromFullmap(),
      technicianWork: this.processesService.getTechnicianWorkStats().pipe(
        catchError(() => of(this.emptyTechnicianWork()))
      ),
    })
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: ({ aggregate, clientVerification, vehicleVerification, vehicleDataCompleteness, deviceConnection, technicianWork }) => {
          const processes = aggregate?.data || [];
          this.clientVerification = clientVerification || this.emptyClientVerification();
          this.vehicleVerification = vehicleVerification || this.emptyVehicleVerification();
          this.vehicleDataCompleteness = vehicleDataCompleteness || this.emptyVehicleDataCompleteness();
          this.deviceConnection = deviceConnection || this.emptyDeviceConnection();
          this.technicianWork = technicianWork || this.emptyTechnicianWork();
          this.metricCards = this.buildMetricCards(processes);
        },
        error: () => {
          this.errorMessage = 'No se pudieron cargar las métricas de procesos.';
          this.metricCards = [];
          this.clientVerification = this.emptyClientVerification();
          this.vehicleVerification = this.emptyVehicleVerification();
          this.vehicleDataCompleteness = this.emptyVehicleDataCompleteness();
          this.deviceConnection = this.emptyDeviceConnection();
          this.technicianWork = this.emptyTechnicianWork();
        }
      });
  }

  getCreatorName(creator: any): string {
    if (!creator) return 'Sistema';
    if (typeof creator === 'string') return creator;
    return [creator.name, creator.last_name].filter(Boolean).join(' ').trim() || creator.email || 'Sistema';
  }

  getHealthClass(goodPercent: number): string {
    return `health-badge health-badge--${this.getHealthLevel(goodPercent)}`;
  }

  getHealthIcon(goodPercent: number): string {
    const level = this.getHealthLevel(goodPercent);
    const icons: Record<HealthLevel, string> = {
      critical: 'pi pi-times-circle',
      warning: 'pi pi-exclamation-triangle',
      stable: 'pi pi-minus-circle',
      good: 'pi pi-check-circle',
      excellent: 'pi pi-verified',
    };
    return icons[level];
  }

  getHealthLabel(goodPercent: number): string {
    const level = this.getHealthLevel(goodPercent);
    const labels: Record<HealthLevel, string> = {
      critical: 'Crítico',
      warning: 'En riesgo',
      stable: 'Regular',
      good: 'Bien',
      excellent: 'Excelente',
    };
    return labels[level];
  }

  getTechnicianWorkHealthPercent(): number {
    const total = this.technicianWork.totalInstallations + this.technicianWork.totalChecks;
    return total ? Math.round((this.technicianWork.totalInstallations / total) * 100) : 0;
  }

  private buildMetricCards(processes: ProcessItem[]): MetricCard[] {
    const todayCount = processes.filter(process => this.isToday(new Date(process.createdAt))).length;
    const creatorsCount = new Set(processes.map(process => this.getCreatorName(process.creator))).size;

    return [
      {
        label: 'Registrados hoy',
        value: todayCount,
        detail: 'Procesos creados durante el día',
        icon: 'pi pi-calendar-clock',
        tone: 'green',
      },
      {
        label: 'Empleados activos',
        value: creatorsCount,
        detail: 'Usuarios que registraron procesos',
        icon: 'pi pi-users',
        tone: 'amber',
      },
      {
        label: 'Clientes verificados',
        value: `${this.clientVerification.verified}/${this.clientVerification.total}`,
        detail: `${this.clientVerification.pending} pendientes por verificar`,
        icon: 'pi pi-verified',
        tone: 'green',
      },
      {
        label: 'Vehículos verificados',
        value: `${this.vehicleVerification.verified}/${this.vehicleVerification.total}`,
        detail: `${this.vehicleVerification.pending} vehículos sin verificar`,
        icon: 'pi pi-car',
        tone: 'blue',
      },
      {
        label: 'Datos de vehículos',
        value: `${this.vehicleDataCompleteness.complete}/${this.vehicleDataCompleteness.total}`,
        detail: `${this.vehicleDataCompleteness.incomplete} sin marca, modelo, año o color`,
        icon: 'pi pi-list-check',
        tone: 'green',
      },
    ];
  }

  private getHealthLevel(goodPercent: number): HealthLevel {
    const percent = Number.isFinite(goodPercent) ? Math.max(0, Math.min(100, goodPercent)) : 0;
    if (percent < 30) return 'critical';
    if (percent < 50) return 'warning';
    if (percent < 70) return 'stable';
    if (percent < 85) return 'good';
    return 'excellent';
  }

  private emptyClientVerification(): ClientVerificationMetrics {
    return {
      total: 0,
      verified: 0,
      pending: 0,
      verifiedPercent: 0,
      pendingPercent: 0,
    };
  }

  private emptyVehicleVerification(): VehicleVerificationMetrics {
    return {
      total: 0,
      verified: 0,
      pending: 0,
      verifiedPercent: 0,
      pendingPercent: 0,
    };
  }

  private emptyVehicleDataCompleteness(): VehicleDataCompletenessMetrics {
    return {
      total: 0,
      complete: 0,
      incomplete: 0,
      completePercent: 0,
      incompletePercent: 0,
    };
  }

  private emptyDeviceConnection(): DeviceConnectionMetrics {
    return {
      total: 0,
      online: 0,
      offline: 0,
      onlinePercent: 0,
      offlinePercent: 0,
    };
  }

  private emptyTechnicianWork(): TechnicianWorkStatsResponse {
    return {
      totalInstallations: 0,
      totalChecks: 0,
      technicians: [],
      generatedAt: new Date(),
    };
  }

  private getDeviceConnectionMetricsFromFullmap(): Observable<DeviceConnectionMetrics> {
    const currentUser = this.authService.getCurrentUser();
    const fullmapUserId = currentUser?.affiliation_type_id === 'empleado'
      ? '68a9ccf19bb280482272477f'
      : currentUser?.id;

    if (!fullmapUserId) {
      return of(this.emptyDeviceConnection());
    }

    return this.monitoringService.getLatestFullmap(fullmapUserId).pipe(
      map(response => this.buildConnectionMetricsFromFullmap(response?.data || [])),
      catchError(() => of(this.emptyDeviceConnection()))
    );
  }

  private buildConnectionMetricsFromFullmap(devices: any[]): DeviceConnectionMetrics {
    const activeDevices = (devices || []).filter(device => !this.isFullmapDeviceExpired(device));
    const online = activeDevices.filter(device => this.getDeviceStatusGroup(device?.status) === 'online').length;
    const offline = activeDevices.filter(device => this.getDeviceStatusGroup(device?.status) === 'offline').length;
    const total = online + offline;

    return {
      total,
      online,
      offline,
      onlinePercent: total ? Math.round((online / total) * 100) : 0,
      offlinePercent: total ? Math.round((offline / total) * 100) : 0,
    };
  }

  private getDeviceStatusGroup(status: any): 'online' | 'localizado' | 'offline' {
    const value = String(status || '').trim().toLowerCase();
    if (value === 'online' || value === 'en linea' || value === 'en línea' || value === 'senal debil' || value === 'señal debil' || value === 'señal débil') {
      return 'online';
    }
    if (value === 'localizado' || value === 'localized' || value === 'located') {
      return 'localizado';
    }
    return 'offline';
  }

  private isFullmapDeviceExpired(device: any): boolean {
    if (device?.isExpired === true || device?.isExpired === 1 || String(device?.isExpired).trim().toLowerCase() === 'true') {
      return true;
    }

    const statusValue = String(device?.status || '').trim().toLowerCase();
    if (['expirado', 'expired', 'vencido'].includes(statusValue)) {
      return true;
    }

    const expirationDate = device?.expiration_date || device?.expirationDate || device?.expiration || device?.expires_at;
    if (!expirationDate) return false;
    const date = new Date(expirationDate);
    if (Number.isNaN(date.getTime())) return false;
    return date.setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0);
  }

  private isToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

}
