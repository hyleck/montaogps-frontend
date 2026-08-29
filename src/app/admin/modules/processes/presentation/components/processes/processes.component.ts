import { DeviceLabelMessageService } from 'src/app/shareds/services/device-label-messages.service';
import { Component, OnInit } from '@angular/core';
import {
  ProcessesService,
  ProcessItem,
  PROCESS_TYPE_LABELS,
  PROCESS_VERIFICATION_STATUS_LABELS,
  ProcessVerificationStatus,
} from '../../services/processes.service';
import { UserService } from 'src/app/core/services/user.service';
import { VehicleBrandsService } from 'src/app/core/services/vehicle-brands.service';
import { ColorsService } from 'src/app/core/services/colors.service';
import { ProtocolsService } from 'src/app/core/services/protocols.service';
import * as XLSX from 'xlsx-js-style';
import { MessageService } from 'primeng/api';
import { getApiErrorMessage } from 'src/app/core/utils/api-error.util';
import { parseProcessDisplayDate } from 'src/app/core/utils/process-date.util';

type StructuredDetailTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

interface StructuredDetailMetric {
  label: string;
  value: string;
  icon: string;
  tone: StructuredDetailTone;
}

interface StructuredDetailStep {
  label: string;
  description: string;
  status: string;
  icon: string;
  tone: StructuredDetailTone;
}

interface StructuredDetailEvent {
  message: string;
  time: string;
  icon: string;
  tone: StructuredDetailTone;
}

interface StructuredDetailField {
  label: string;
  value: string;
  tone: StructuredDetailTone;
}

interface StructuredDetailValue {
  metrics: StructuredDetailMetric[];
  steps: StructuredDetailStep[];
  events: StructuredDetailEvent[];
  fields: StructuredDetailField[];
}

interface DetailChangeRow {
  key: string;
  label: string;
  before: string;
  after: string;
  beforeStructured: StructuredDetailValue | null;
  afterStructured: StructuredDetailValue | null;
  isStructured: boolean;
}

@Component({
  selector: 'app-processes',
  standalone: false,
  templateUrl: './processes.component.html',
  styleUrls: ['./processes.component.css'],
  providers: [{ provide: MessageService, useClass: DeviceLabelMessageService }],
})
export class ProcessesComponent implements OnInit {

  processes: ProcessItem[] = [];
  loading = false;

  // Pagination
  totalRecords = 0;
  currentPage = 1;
  rowsPerPage = 20;

  // Filters
  searchQuery = '';
  selectedType: number | null = null;
  selectedCreator: string | null = null;
  selectedMechanic: string | null = null;
  selectedClient: { label: string; id: string; email?: string; phone?: string } | null = null;
  selectedVerificationStatus: ProcessVerificationStatus | null = null;
  dateFrom: Date | null = this.getCurrentMonthRange().from;
  dateTo: Date | null = this.getCurrentMonthRange().to;
  filtersExpanded = false;

  typeOptions = Object.entries(PROCESS_TYPE_LABELS).map(([key, label]) => ({
    label,
    value: Number(key)
  }));

  processTypeLabels = PROCESS_TYPE_LABELS;
  verificationStatusOptions = Object.entries(PROCESS_VERIFICATION_STATUS_LABELS).map(([value, label]) => ({
    label,
    value: value as ProcessVerificationStatus,
  }));
  updatingVerificationId: string | null = null;

  // Detail dialog
  selectedProcess: ProcessItem | null = null;
  detailDialogVisible = false;
  detailSimpleChangeRows: DetailChangeRow[] = [];
  detailStructuredChangeRows: DetailChangeRow[] = [];

  // Technicians map
  techniciansMap: { [id: string]: string } = {};

  // Employee options for filter
  employeeOptions: { label: string; value: string }[] = [];
  mechanicOptions: { label: string; value: string }[] = [];
  clientOptions: Array<{ label: string; id: string; email?: string; phone?: string }> = [];

  // Brand/Model/Color name maps
  brandsMap: { [id: string]: string } = {};
  modelsMap: { [id: string]: string } = {};
  colorsMap: { [hex: string]: string } = {};
  gpsModelsMap: { [id: string]: string } = {};

  constructor(
    private processesService: ProcessesService,
    private userService: UserService,
    private vehicleBrandsService: VehicleBrandsService,
    private colorsService: ColorsService,
    private protocolsService: ProtocolsService,
    private messageService: MessageService,
  ) {}

  ngOnInit(): void {
    this.loadProcesses();
    this.loadTechnicians();
    this.loadEmployees();
    this.loadMechanics();
    this.loadBrandsAndModels();
  }

  loadProcesses(): void {
    this.loading = true;
    const filters: any = {};
    if (this.selectedType !== null && this.selectedType !== undefined) filters.type = this.selectedType;
    if (this.selectedCreator) filters.creator = this.selectedCreator;
    if (this.selectedMechanic) filters.mechanic = this.selectedMechanic;
    if (this.selectedClient?.id) filters.client = this.selectedClient.id;
    if (this.selectedVerificationStatus) filters.verificationStatus = this.selectedVerificationStatus;
    if (this.dateFrom) filters.dateFrom = this.dateFrom.toISOString();
    if (this.dateTo) filters.dateTo = this.dateTo.toISOString();
    if (this.searchQuery?.trim()) filters.search = this.searchQuery.trim();

    this.processesService.getPaginated(this.currentPage, this.rowsPerPage, filters).subscribe({
      next: (res) => {
        this.processes = res.data;
        this.totalRecords = res.total;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  onPageChange(event: any): void {
    this.currentPage = Math.floor(event.first / event.rows) + 1;
    this.rowsPerPage = event.rows;
    this.loadProcesses();
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.loadProcesses();
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedType = null;
    this.selectedCreator = null;
    this.selectedMechanic = null;
    this.selectedClient = null;
    this.clientOptions = [];
    this.selectedVerificationStatus = null;
    const currentMonthRange = this.getCurrentMonthRange();
    this.dateFrom = currentMonthRange.from;
    this.dateTo = currentMonthRange.to;
    this.currentPage = 1;
    this.loadProcesses();
  }

  async exportExcel(): Promise<void> {
    // Ensure brands/models are loaded before exporting
    if (Object.keys(this.brandsMap).length === 0) {
      await this.loadBrandsAndModels();
    }

    // Fetch ALL records with current filters (not just current page)
    const filters: any = {};
    if (this.selectedType !== null && this.selectedType !== undefined) filters.type = this.selectedType;
    if (this.selectedCreator) filters.creator = this.selectedCreator;
    if (this.selectedMechanic) filters.mechanic = this.selectedMechanic;
    if (this.selectedClient?.id) filters.client = this.selectedClient.id;
    if (this.selectedVerificationStatus) filters.verificationStatus = this.selectedVerificationStatus;
    if (this.dateFrom) filters.dateFrom = this.dateFrom.toISOString();
    if (this.dateTo) filters.dateTo = this.dateTo.toISOString();
    if (this.searchQuery?.trim()) filters.search = this.searchQuery.trim();

    const res = await this.processesService.getPaginated(1, 10000, filters).toPromise();
    const allProcesses = res?.data || [];

    const data = allProcesses.map(p => ({
      'Fecha': this.getProcessDate(p)?.toLocaleDateString('es-DO') || '',
      'Tipo': this.getTypeLabel(p.type),
      'Estado': this.getVerificationStatusLabel(p.verificationStatus),
      'Target': this.getTargetName(p.target),
      'IMEI': this.getTargetImei(p.target),
      'Cliente': this.getClientName(p),
      'Marca': this.brandsMap[p.target?.['target_brand_id']] || p.target?.['target_brand_id'] || '',
      'Modelo': this.modelsMap[p.target?.['target_model_id']] || p.target?.['target_model_id'] || '',
      'Año': p.target?.['target_year'] || '',
      'Color': this.colorsMap[p.target?.['target_color']] || p.target?.['target_color'] || '',
      'Matrícula': p.target?.['target_plate_number'] || '',
      'Chasis': p.target?.['target_chassis_number'] || '',
      'SIM Card': p.target?.['sim_card_number'] || '',
      'Tipo SIM': p.target?.['sim_company'] || '',
      'Modelo GPS': this.gpsModelsMap[p.target?.['device_type']] || p.target?.['gps_model'] || '',
      'Empleado': this.getCreatorName(p.creator),
      'Técnico': this.getTechnicianName(p),
    }));

    const ws = XLSX.utils.json_to_sheet(data);

    // Column widths
    ws['!cols'] = [
      { wch: 20 },  // Fecha
      { wch: 22 },  // Tipo
      { wch: 14 },  // Estado
      { wch: 25 },  // Target
      { wch: 18 },  // IMEI
      { wch: 24 },  // Cliente
      { wch: 15 },  // Marca
      { wch: 15 },  // Modelo
      { wch: 8 },   // Año
      { wch: 12 },  // Color
      { wch: 14 },  // Matrícula
      { wch: 20 },  // Chasis
      { wch: 22 },  // SIM Card
      { wch: 14 },  // Tipo SIM
      { wch: 16 },  // Modelo GPS
      { wch: 20 },  // Empleado
      { wch: 20 },  // Técnico
    ];

    // Style header row (red background, white bold text)
    const headerStyle = {
      fill: { fgColor: { rgb: 'CC0000' } },
      font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 11 },
      alignment: { horizontal: 'center' }
    };
    const colLetters = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q'];
    colLetters.forEach(col => {
      const cell = ws[`${col}1`];
      if (cell) cell.s = headerStyle;
    });

    // Color map for process types
    const typeColors: { [key: number]: string } = {
      1: '2E7D32',   // Instalación
      2: '1565C0',   // Mod. Fecha Instalación
      3: '0277BD',   // Mod. Fecha Expiración
      4: '388E3C',   // Renovación
      5: 'E65100',   // Cambio de Plan
      6: 'EF6C00',   // Cambio de Plan
      7: 'F57F17',   // Cambio de SIM
      8: '5E35B1',   // Mod. Técnico
      9: 'C62828',   // Cambio de GPS
      10: '00838F',  // Chequeo
      11: '4527A0',  // Mod. Modelo GPS
      12: 'AD1457',  // Mod. IMEI / GPS ID
      13: 'FF8F00',  // Cambio de SIM Card
      14: '00695C',  // Mod. Número SIM
      15: '37474F',  // Mod. Tipo SIM
      16: '1B5E20',  // Restauración
      17: '2E7D32',  // Activación Automática
      18: '1565C0',  // Reinstalación
      19: 'B71C1C',  // Desinstalación
      20: '2E7D32',  // Pre-renovación
      21: '0284C7',  // Cambio de vehículo
    };

    // Apply type colors to column B (Tipo)
    allProcesses.forEach((p, i) => {
      const cell = ws[`B${i + 2}`];
      if (cell) {
        cell.s = {
          font: { color: { rgb: typeColors[p.type] || '000000' }, bold: true }
        };
      }
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Procesos');
    XLSX.writeFile(wb, `procesos_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  private getCurrentMonthRange(): { from: Date; to: Date } {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    from.setHours(0, 0, 0, 0);

    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    to.setHours(23, 59, 59, 999);

    return { from, to };
  }

  getTypeLabel(type: number): string {
    return PROCESS_TYPE_LABELS[type] || `Tipo ${type}`;
  }

  getTypeSeverity(type: number): string {
    const severities: { [key: number]: string } = {
      1: 'success',   // Instalación
      2: 'info',      // Mod. Fecha Instalación
      3: 'info',      // Mod. Fecha Expiración
      4: 'success',   // Renovación
      5: 'warning',   // Cambio de Plan
      6: 'warning',   // Cambio de Plan
      7: 'warning',   // Cambio de SIM
      8: 'info',      // Mod. Técnico
      9: 'danger',    // Cambio de GPS
      10: 'info',     // Chequeo
      11: 'info',     // Mod. Modelo GPS
      12: 'warning',  // Mod. IMEI / GPS ID
      13: 'warning',  // Cambio de SIM Card
      14: 'info',     // Mod. Número SIM
      15: 'info',     // Mod. Tipo SIM
      16: 'success',  // Restauración
      17: 'success',  // Activación Automática
      18: 'info',     // Reinstalación
      19: 'danger',   // Desinstalación
      20: 'success',  // Pre-renovación
      21: 'info',     // Cambio de vehículo
    };
    return severities[type] || 'info';
  }

  getVerificationStatus(status?: ProcessVerificationStatus): ProcessVerificationStatus {
    return status || 'pending';
  }

  getVerificationStatusLabel(status?: ProcessVerificationStatus): string {
    return PROCESS_VERIFICATION_STATUS_LABELS[this.getVerificationStatus(status)];
  }

  getVerificationStatusClass(status?: ProcessVerificationStatus): string {
    return `process-status--${this.getVerificationStatus(status)}`;
  }

  getVerificationStatusIcon(status?: ProcessVerificationStatus): string {
    const icons: Record<ProcessVerificationStatus, string> = {
      pending: 'pi pi-clock',
      verified: 'pi pi-check-circle',
      rejected: 'pi pi-times-circle',
    };
    return icons[this.getVerificationStatus(status)];
  }

  getProcessRowClass(status?: ProcessVerificationStatus): string {
    return this.getVerificationStatus(status) === 'verified' ? 'process-row--verified' : '';
  }

  getProcessDate(process: ProcessItem): Date | null {
    return parseProcessDisplayDate(process.registrationDate)
      || parseProcessDisplayDate(process.createdAt);
  }

  getAppliedFilterCount(): number {
    return [
      this.selectedType,
      this.selectedCreator,
      this.selectedMechanic,
      this.selectedClient?.id,
      this.selectedVerificationStatus,
    ].filter(value => value !== null && value !== undefined && value !== '').length;
  }

  updateProcessVerificationStatus(
    process: ProcessItem,
    status: ProcessVerificationStatus,
  ): void {
    if (this.updatingVerificationId || this.getVerificationStatus(process.verificationStatus) === status) {
      return;
    }

    this.updatingVerificationId = process._id;
    this.processesService.updateVerificationStatus(process._id, status).subscribe({
      next: (updated) => {
        const index = this.processes.findIndex(item => item._id === updated._id);
        if (index >= 0) this.processes[index] = updated;
        if (this.selectedProcess?._id === updated._id) this.selectedProcess = updated;
        this.updatingVerificationId = null;
        this.messageService.add({
          severity: 'success',
          summary: 'Estado actualizado',
          detail: `El proceso quedó ${this.getVerificationStatusLabel(updated.verificationStatus).toLowerCase()}.`,
          life: 2800,
        });
      },
      error: (error) => {
        this.updatingVerificationId = null;
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo actualizar',
          detail: getApiErrorMessage(error, 'No se pudo cambiar el estado del proceso.'),
          life: 4000,
        });
      },
    });
  }

  getReviewerName(reviewer: any): string {
    return this.getCreatorName(reviewer);
  }

  showDetail(process: ProcessItem): void {
    this.selectedProcess = process;
    const changes = this.buildChangeRows(process.before, process.after);
    this.detailSimpleChangeRows = changes.filter(change => !change.isStructured);
    this.detailStructuredChangeRows = changes.filter(change => change.isStructured);
    this.detailDialogVisible = true;
  }

  private buildChangeRows(before: any, after: any): DetailChangeRow[] {
    const previous = this.toComparableRecord(before);
    const current = this.toComparableRecord(after);
    const keys = Array.from(new Set([...Object.keys(previous), ...Object.keys(current)]));

    return keys
      .filter(key => JSON.stringify(previous[key] ?? null) !== JSON.stringify(current[key] ?? null))
      .map(key => {
        const beforeStructured = this.buildStructuredDetailValue(previous[key]);
        const afterStructured = this.buildStructuredDetailValue(current[key]);

        return {
          key,
          label: this.getChangeFieldLabel(key),
          before: this.formatChangeValue(key, previous[key], beforeStructured),
          after: this.formatChangeValue(key, current[key], afterStructured),
          beforeStructured,
          afterStructured,
          isStructured: !!beforeStructured || !!afterStructured,
        };
      });
  }

  private toComparableRecord(value: any): Record<string, any> {
    const parsed = this.parseStructuredValue(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  }

  private parseStructuredValue(value: any): any {
    if (value && typeof value === 'object') return value;
    if (typeof value !== 'string') return value;

    const trimmed = value.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value;

    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }

  private buildStructuredDetailValue(value: any): StructuredDetailValue | null {
    const parsed = this.parseStructuredValue(value);
    if (!parsed || typeof parsed !== 'object') return null;

    const source: any = Array.isArray(parsed) ? {} : parsed;
    const metrics: StructuredDetailMetric[] = [];

    if (Object.prototype.hasOwnProperty.call(source, 'completed')) {
      metrics.push({
        label: 'Completado',
        value: source.completed ? 'Sí' : 'No',
        icon: source.completed ? 'pi pi-check-circle' : 'pi pi-clock',
        tone: source.completed ? 'success' : 'warning',
      });
    }
    if (Object.prototype.hasOwnProperty.call(source, 'cancelled')) {
      metrics.push({
        label: 'Cancelado',
        value: source.cancelled ? 'Sí' : 'No',
        icon: source.cancelled ? 'pi pi-times-circle' : 'pi pi-shield',
        tone: source.cancelled ? 'danger' : 'neutral',
      });
    }
    if (source.status !== undefined && source.status !== null) {
      metrics.push({
        label: 'Estado',
        value: this.getStructuredStatusLabel(source.status),
        icon: this.getStructuredStatusIcon(source.status),
        tone: this.getStructuredTone(source.status),
      });
    }
    if (source.startedAt) {
      metrics.push({
        label: 'Inicio',
        value: this.formatStructuredDate(source.startedAt),
        icon: 'pi pi-play-circle',
        tone: 'info',
      });
    }
    if (source.heartbeatAt) {
      metrics.push({
        label: 'Última actividad',
        value: this.formatStructuredDate(source.heartbeatAt),
        icon: 'pi pi-bolt',
        tone: 'info',
      });
    }
    if (source.run_id) {
      metrics.push({
        label: 'ID de ejecución',
        value: String(source.run_id),
        icon: 'pi pi-hashtag',
        tone: 'neutral',
      });
    }

    const steps: StructuredDetailStep[] = Array.isArray(source.steps)
      ? source.steps.map((step: any, index: number) => {
          const status = step?.status || 'pending';
          return {
            label: step?.label || `Paso ${index + 1}`,
            description: step?.description || '',
            status: this.getStructuredStatusLabel(status),
            icon: this.getSafeStructuredIcon(step?.icon, status),
            tone: this.getStructuredTone(status),
          };
        })
      : [];

    const events: StructuredDetailEvent[] = Array.isArray(source.logs)
      ? source.logs.map((event: any) => {
          const type = event?.type || 'info';
          return {
            message: event?.message || 'Evento registrado',
            time: event?.time ? this.formatStructuredDate(event.time) : '',
            icon: this.getStructuredStatusIcon(type),
            tone: this.getStructuredTone(type),
          };
        })
      : [];

    const fields: StructuredDetailField[] = [];
    if (Array.isArray(parsed)) {
      this.flattenStructuredFields(parsed, 'Elemento', fields);
    } else {
      const displayedKeys = new Set([
        'completed', 'cancelled', 'status', 'startedAt', 'heartbeatAt', 'run_id', 'steps', 'logs',
      ]);
      Object.entries(source)
        .filter(([key]) => !displayedKeys.has(key))
        .forEach(([key, fieldValue]) => {
          this.flattenStructuredFields(fieldValue, this.getChangeFieldLabel(key), fields);
        });
    }

    return { metrics, steps, events, fields };
  }

  private flattenStructuredFields(
    value: any,
    label: string,
    fields: StructuredDetailField[],
    depth = 0,
  ): void {
    if (depth > 4) {
      fields.push({ label, value: 'Contenido agrupado', tone: 'neutral' });
      return;
    }

    if (Array.isArray(value)) {
      if (!value.length) {
        fields.push({ label, value: 'Sin elementos', tone: 'neutral' });
        return;
      }
      if (value.every(item => item === null || typeof item !== 'object')) {
        fields.push({
          label,
          value: value.map(item => this.formatStructuredPrimitive(label, item)).join(' · '),
          tone: 'neutral',
        });
        return;
      }
      value.forEach((item, index) => {
        this.flattenStructuredFields(item, `${label} ${index + 1}`, fields, depth + 1);
      });
      return;
    }

    if (value && typeof value === 'object') {
      const entries = Object.entries(value);
      if (!entries.length) {
        fields.push({ label, value: 'Sin datos', tone: 'neutral' });
        return;
      }
      entries.forEach(([key, nestedValue]) => {
        this.flattenStructuredFields(
          nestedValue,
          `${label} · ${this.getChangeFieldLabel(key)}`,
          fields,
          depth + 1,
        );
      });
      return;
    }

    fields.push({
      label,
      value: this.formatStructuredPrimitive(label, value),
      tone: this.getStructuredTone(value),
    });
  }

  private getChangeFieldLabel(key: string): string {
    const labels: Record<string, string> = {
      status: 'Estado',
      lastProcess: 'Último proceso',
      processType: 'Tipo de proceso',
      processDate: 'Fecha del proceso',
      device_imei: 'IMEI',
      sim_card_number: 'Número SIM',
      expiration_date: 'Fecha de expiración',
      installation_date: 'Fecha de instalación',
      mechanic_id: 'Técnico',
      gps_model: 'Modelo GPS',
      activation_status: 'Estado de activación',
      run_id: 'ID de ejecución',
      startedAt: 'Inicio',
      heartbeatAt: 'Última actividad',
      completedAt: 'Finalización',
      completed: 'Completado',
      cancelled: 'Cancelado',
      provider: 'Proveedor',
      enabled: 'Habilitado',
    };

    return labels[key] || key
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/^./, value => value.toUpperCase());
  }

  private getStructuredStatusLabel(value: any): string {
    const normalized = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    const statuses: Record<string, string> = {
      success: 'Completado',
      completed: 'Completado',
      active: 'Activo',
      enabled: 'Habilitado',
      pending: 'Pendiente',
      in_progress: 'En progreso',
      running: 'En progreso',
      info: 'Información',
      warning: 'Advertencia',
      failed: 'Fallido',
      error: 'Error',
      danger: 'Error',
      cancelled: 'Cancelado',
      skipped: 'Omitido',
    };
    return statuses[normalized] || this.formatStructuredPrimitive('Estado', value);
  }

  private getStructuredTone(value: any): StructuredDetailTone {
    if (value === true) return 'success';
    if (value === false || value === null || value === undefined) return 'neutral';

    const normalized = String(value).trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (['success', 'completed', 'active', 'enabled', 'ok', 'true'].includes(normalized)) return 'success';
    if (['failed', 'error', 'danger', 'cancelled', 'inactive'].includes(normalized)) return 'danger';
    if (['pending', 'warning', 'in_progress', 'running'].includes(normalized)) return 'warning';
    if (['info', 'skipped'].includes(normalized)) return 'info';
    return 'neutral';
  }

  private getStructuredStatusIcon(value: any): string {
    const tone = this.getStructuredTone(value);
    const icons: Record<StructuredDetailTone, string> = {
      success: 'pi pi-check-circle',
      danger: 'pi pi-times-circle',
      warning: 'pi pi-clock',
      info: 'pi pi-info-circle',
      neutral: 'pi pi-circle',
    };
    return icons[tone];
  }

  private getSafeStructuredIcon(icon: any, status: any): string {
    const value = typeof icon === 'string' ? icon.trim() : '';
    if (/^pi pi-[a-z0-9-]+$/i.test(value)) return value;
    if (/^pi-[a-z0-9-]+$/i.test(value)) return `pi ${value}`;
    return this.getStructuredStatusIcon(status);
  }

  private formatStructuredDate(value: any): string {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat('es-DO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);
  }

  private formatStructuredPrimitive(key: string, value: any): string {
    if (value === null || value === undefined || value === '') return 'Sin dato';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (typeof value === 'number') return value.toLocaleString('es-DO');

    const text = String(value);
    const looksLikeDate = /(fecha|date|inicio|actividad|time|(?:^|\s)at$)/i.test(key)
      || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text);
    return looksLikeDate ? this.formatStructuredDate(text) : text;
  }

  private formatChangeValue(
    key: string,
    value: any,
    knownStructuredValue?: StructuredDetailValue | null,
  ): string {
    if (value === null || value === undefined || value === '') return 'Sin dato';
    if (key === 'status') {
      const statuses: Record<string, string> = {
        pending: 'Pendiente',
        completed: 'Completado',
        cancelled: 'Cancelado',
        in_progress: 'En progreso',
      };
      return statuses[String(value)] || String(value);
    }
    if (key === 'processType') {
      const numericType = Number(value);
      if (Number.isFinite(numericType)) return this.getTypeLabel(numericType);

      const normalizedType = String(value).trim().toLowerCase().replace(/[\s-]+/g, '_');
      const processTypes: Record<string, number> = {
        installation: 1,
        installation_date: 2,
        expiration: 3,
        renewal: 4,
        technician_change: 8,
        gps_change: 9,
        checkup: 10,
        installation_details_change: 10,
        gps_model_change: 11,
        imei_change: 12,
        sim_change: 13,
        sim_number: 14,
        sim_type_change: 15,
        restoration: 16,
        automatic_activation: 17,
        reinstallation: 18,
        uninstall: 19,
      };
      return processTypes[normalizedType]
        ? this.getTypeLabel(processTypes[normalizedType])
        : String(value);
    }
    if (/(?:date|fecha|_at|At)$/i.test(key)) {
      return this.formatStructuredDate(value);
    }
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    const structured = knownStructuredValue === undefined
      ? this.buildStructuredDetailValue(value)
      : knownStructuredValue;
    if (structured) {
      const summary = [
        structured.steps.length
          ? `${structured.steps.length} ${structured.steps.length === 1 ? 'paso' : 'pasos'}`
          : '',
        structured.events.length
          ? `${structured.events.length} ${structured.events.length === 1 ? 'evento' : 'eventos'}`
          : '',
        structured.fields.length
          ? `${structured.fields.length} ${structured.fields.length === 1 ? 'dato' : 'datos'}`
          : '',
      ].filter(Boolean);
      return summary.join(' · ') || 'Datos estructurados';
    }
    return String(value);
  }

  getCreatorName(creator: any): string {
    if (!creator) return 'Sistema';
    if (typeof creator === 'string') return creator;
    const name = creator.name || '';
    const lastName = creator.last_name || '';
    return (name + ' ' + lastName).trim() || creator.email || 'Desconocido';
  }

  getTargetName(target: any): string {
    if (!target) return '-';
    return target.name || target.device_imei || '-';
  }

  getTargetImei(target: any): string {
    if (!target) return '-';
    return target.device_imei || '-';
  }

  getClientName(process: ProcessItem): string {
    const client = process?.client;
    if (!client) return 'Sin cliente asociado';
    const fullName = `${client.name || ''} ${client.last_name || ''}`.trim();
    return fullName || client.email || client.phone || 'Sin cliente asociado';
  }

  getClientContact(process: ProcessItem): string {
    const client = process?.client;
    if (!client) return '';
    return client.email || client.phone || '';
  }

  getTechnicianName(process: ProcessItem): string {
    // Extract from details field: "Técnico asignado: [name]."
    if (process.details) {
      const match = process.details.match(/T[eé]cnico asignado:\s*([^.]+)/i);
      if (match && match[1] && match[1].trim() !== 'No asignado') {
        return match[1].trim();
      }
    }
    // Fallback to target.mechanic_id resolved via technicians map
    if (process.target) {
      const mechanicId = process.target['mechanic_id'];
      if (mechanicId) return this.techniciansMap[mechanicId] || mechanicId;
    }
    return 'Ninguno';
  }

  private loadTechnicians(): void {
    this.userService.getTechnicians().subscribe({
      next: (techs) => {
        techs.forEach(t => {
          this.techniciansMap[t._id] = t.name || t.email || t._id;
        });
      },
      error: () => {}
    });
  }

  private loadEmployees(): void {
    this.userService.getEmployees().subscribe({
      next: (employees: any[]) => {
        this.employeeOptions = employees.map(e => ({
          label: ((e.name || '') + ' ' + (e.last_name || '')).trim() || e.email,
          value: e._id
        }));
      },
      error: () => {}
    });
  }

  private loadMechanics(): void {
    this.userService.getTechnicians().subscribe({
      next: (techs: any[]) => {
        this.mechanicOptions = techs.map(t => ({
          label: ((t.name || '') + ' ' + (t.last_name || '')).trim() || t.email,
          value: t._id
        }));
      },
      error: () => {}
    });
  }

  searchClients(event: { query?: string }): void {
    const query = String(event?.query || '').trim();
    this.processesService.searchClients(query, 50).subscribe({
      next: (clients) => {
        this.clientOptions = (clients || [])
          .map((client: any) => {
            const label = `${client.name || ''} ${client.last_name || ''}`.trim()
              || client.email
              || client.phone
              || 'Cliente sin nombre';
            const id = String(client._id || client.email || client.phone || '').trim();
            return {
              label,
              id,
              email: client.email,
              phone: client.phone,
            };
          })
          .filter(client => Boolean(client.id));
      },
      error: () => {
        this.clientOptions = [];
      },
    });
  }

  onClientSelected(): void {
    this.applyFilters();
  }

  clearClientFilter(): void {
    this.selectedClient = null;
    this.applyFilters();
  }

  private async loadBrandsAndModels(): Promise<void> {
    try {
      const brands = await this.vehicleBrandsService.getAllBrands();
      if (brands && brands.length) {
        brands.forEach((b: any) => {
          this.brandsMap[b._id] = b.nombre;
        });
        // Load all models for each brand
        const modelPromises = brands.map((b: any) =>
          this.vehicleBrandsService.getAllModelsByBrand(b._id).catch(() => [])
        );
        const allModels = await Promise.all(modelPromises);
        allModels.forEach((models: any[]) => {
          if (models) {
            models.forEach((m: any) => {
              this.modelsMap[m._id] = m.nombre;
            });
          }
        });
      }
    } catch (e) {}

    // Load colors
    try {
      const colors = await this.colorsService.getAllColors();
      if (colors && colors.length) {
        colors.forEach((c: any) => {
          this.colorsMap[c.hex] = c.nombre;
        });
      }
    } catch (e) {}

    // Load GPS models (protocols)
    this.protocolsService.getAllProtocols().subscribe({
      next: (protocols) => {
        protocols.forEach(p => {
          this.gpsModelsMap[p._id] = p.name;
        });
      },
      error: () => {}
    });
  }
}
