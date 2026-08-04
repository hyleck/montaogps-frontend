import { Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { AnomaliesResponse, AnomalyCategory, AnomalyItem, AnomalySeverity, AnomaliesService } from '../../services/anomalies.service';
import { getApiErrorMessage } from '../../../../../../core/utils/api-error.util';

interface SummaryCard {
  label: string;
  value: number;
  icon: string;
  severity: AnomalySeverity;
}

@Component({
  selector: 'app-anomalies',
  standalone: false,
  templateUrl: './anomalies.component.html',
  styleUrls: ['./anomalies.component.css']
})
export class AnomaliesComponent implements OnInit {
  loading = false;
  errorMessage = '';
  response: AnomaliesResponse | null = null;
  selectedCategory: AnomalyCategory | 'all' = 'all';
  selectedSeverity: AnomalySeverity | 'all' = 'all';
  selectedAnomaly: AnomalyItem | null = null;

  readonly categories: Array<{ label: string; value: AnomalyCategory | 'all' }> = [
    { label: 'Todas', value: 'all' },
    { label: 'GPS', value: 'devices' },
    { label: 'Usuarios', value: 'users' },
    { label: 'Procesos', value: 'processes' },
  ];

  readonly severities: Array<{ label: string; value: AnomalySeverity | 'all' }> = [
    { label: 'Todas', value: 'all' },
    { label: 'Críticas', value: 'critical' },
    { label: 'Advertencias', value: 'warning' },
    { label: 'Informativas', value: 'info' },
  ];

  constructor(private readonly anomaliesService: AnomaliesService) {}

  ngOnInit(): void {
    this.loadAnomalies();
  }

  loadAnomalies(): void {
    this.loading = true;
    this.errorMessage = '';

    this.anomaliesService.getAnomalies(50)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: (response) => this.response = response,
        error: (error) => {
          this.response = null;
          this.errorMessage = getApiErrorMessage(error, 'No se pudieron cargar las anomalías del sistema');
        }
      });
  }

  get summaryCards(): SummaryCard[] {
    const summary = this.response?.summary || { critical: 0, warning: 0, info: 0 };
    return [
      { label: 'Críticas', value: summary.critical, icon: 'pi pi-times-circle', severity: 'critical' },
      { label: 'Advertencias', value: summary.warning, icon: 'pi pi-exclamation-triangle', severity: 'warning' },
      { label: 'Informativas', value: summary.info, icon: 'pi pi-info-circle', severity: 'info' },
    ];
  }

  get filteredAnomalies(): AnomalyItem[] {
    return (this.response?.anomalies || []).filter(item => {
      const categoryMatches = this.selectedCategory === 'all' || item.category === this.selectedCategory;
      const severityMatches = this.selectedSeverity === 'all' || item.severity === this.selectedSeverity;
      return categoryMatches && severityMatches;
    });
  }

  getSeverityLabel(severity: AnomalySeverity): string {
    const labels: Record<AnomalySeverity, string> = {
      critical: 'Crítica',
      warning: 'Advertencia',
      info: 'Informativa',
    };
    return labels[severity];
  }

  getCategoryLabel(category: AnomalyCategory): string {
    const labels: Record<AnomalyCategory, string> = {
      devices: 'GPS',
      users: 'Usuarios',
      processes: 'Procesos',
    };
    return labels[category];
  }

  getCategoryIcon(category: AnomalyCategory): string {
    const icons: Record<AnomalyCategory, string> = {
      devices: 'pi pi-car',
      users: 'pi pi-users',
      processes: 'pi pi-list-check',
    };
    return icons[category];
  }

  openDetails(anomaly: AnomalyItem): void {
    this.selectedAnomaly = anomaly;
  }

  closeDetails(): void {
    this.selectedAnomaly = null;
  }

  getMetadataEntries(anomaly: AnomalyItem | null): Array<{ key: string; label: string; value: string }> {
    if (!anomaly?.metadata) return [];

    return Object.entries(anomaly.metadata)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => ({
        key,
        label: this.formatKey(key),
        value: this.formatValue(value),
      }));
  }

  getRecordEntries(record: Record<string, any>): Array<{ key: string; label: string; value: string }> {
    return Object.entries(record || {})
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => ({
        key,
        label: this.formatKey(key),
        value: this.formatValue(value),
      }));
  }

  getRecordTitle(record: Record<string, any>): string {
    return String(
      record['name'] ||
      [record['name'], record['last_name']].filter(Boolean).join(' ') ||
      record['target'] ||
      record['email'] ||
      record['imei'] ||
      record['id'] ||
      'Registro'
    ).trim();
  }

  getRecordDetail(record: Record<string, any>): string {
    const parts = [
      record['imei'] ? `IMEI: ${record['imei']}` : '',
      record['email'] ? `Email: ${record['email']}` : '',
      record['dni'] ? `DNI: ${record['dni']}` : '',
      record['phone'] ? `Tel: ${record['phone']}` : '',
      record['previousExpiration'] ? `Antes: ${this.formatDate(record['previousExpiration'])}` : '',
      record['newExpiration'] ? `Después: ${this.formatDate(record['newExpiration'])}` : '',
    ].filter(Boolean);

    return parts.join(' · ');
  }

  formatDate(value?: string): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('es-DO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private formatKey(key: string): string {
    const labels: Record<string, string> = {
      id: 'ID',
      imei: 'IMEI',
      dni: 'DNI',
      phone: 'Teléfono',
      email: 'Correo',
      field: 'Campo',
      value: 'Valor',
      processId: 'Proceso',
      changedAt: 'Modificado',
      previousExpiration: 'Expiración anterior',
      newExpiration: 'Expiración nueva',
      daysBeforeExpiration: 'Días antes de vencer',
      parent_id: 'Cuenta',
      affiliation_type_id: 'Afiliación',
      canceled: 'Cancelado',
      deleted: 'Eliminado',
      status: 'Estado',
      creator: 'Creador',
      target: 'Objetivo',
    };

    return labels[key] || key
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, letter => letter.toUpperCase());
  }

  private formatValue(value: any): string {
    if (value instanceof Date) return this.formatDate(value.toISOString());
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return this.formatDate(value);
    }
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }
}
