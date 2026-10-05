import { DeviceLabelMessageService } from 'src/app/shareds/services/device-label-messages.service';
import { AfterViewInit, Component, ElementRef, HostListener, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { formatUserName } from 'src/app/core/utils/user-name.util';
import { TargetsService } from 'src/app/core/services/targets.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { Contact, ContactsService } from 'src/app/core/services/contacts.service';
import { TagsService } from 'src/app/core/services/tags.service';
import { DeviceRecordEntry } from 'src/app/core/interfaces/target.interface';
import { firstValueFrom, Subscription } from 'rxjs';
import { InstallationDetail, Solicitud, SolicitudesService } from 'src/app/core/services/solicitudes.service';
import { buildInstallationProgress, InstallationProgressStep } from './installation-progress';
import { environment } from 'src/environments/environment';
import {
  ProcessesService,
  ProcessItem,
  ProcessClientGroupResult,
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
import { isOfficeReviewProcess } from 'src/app/core/utils/office-review-process.util';
import { renewalFilterDate } from 'src/app/core/utils/renewal-expiration-filter.util';
import { ProcessTemplateConfiguration } from '../process-templates-dialog/process-templates-dialog.component';

type StructuredDetailTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';
type ProcessFilters = NonNullable<Parameters<ProcessesService['getPaginated']>[2]>;

interface ProcessClientGroup extends ProcessClientGroupResult {
  loading: boolean;
  error: string;
}

interface InstallationAccount {
  id: string;
  fullName: string;
  affiliation_type_id?: string;
}

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
export class ProcessesComponent implements OnInit, AfterViewInit, OnDestroy {

  processes: ProcessItem[] = [];
  private processGroups: ProcessClientGroup[] = [];
  private clientGroupRequests = new Map<string, Subscription>();
  private clientGroupsGeneration = 0;

  get clientProcessGroups(): ProcessClientGroup[] {
    return this.processGroups;
  }

  trackByClientGroup(_index: number, group: ProcessClientGroup): string {
    return group.id;
  }

  trackByProcess(_index: number, process: ProcessItem): string {
    return process._id;
  }

  private mergeProcesses(current: ProcessItem[], incoming: ProcessItem[]): ProcessItem[] {
    const rows = new Map(current.map(process => [process._id, process]));
    incoming.forEach(process => rows.set(process._id, process));
    return [...rows.values()];
  }

  private syncProcessesFromGroups(): void {
    this.processes = this.mergeProcesses([], this.processGroups.flatMap(group => group.processes));
  }

  loadMoreClientProcesses(group: ProcessClientGroup): void {
    if (this.destroyed || group.loading || group.page >= group.lastPage) return;
    const generation = this.clientGroupsGeneration;
    const page = group.page + 1;
    group.loading = true;
    group.error = '';
    this.clientGroupRequests.get(group.id)?.unsubscribe();
    const request = this.processesService.getClientGroupProcesses(group.id, page, this.rowsPerPage, this.activeFilters).subscribe({
      next: response => {
        if (this.destroyed || generation !== this.clientGroupsGeneration) return;
        group.processes = this.mergeProcesses(group.processes, response.data);
        group.total = response.total;
        group.page = response.page;
        group.lastPage = response.lastPage;
        group.loading = false;
        this.syncProcessesFromGroups();
      },
      error: error => {
        if (this.destroyed || generation !== this.clientGroupsGeneration) return;
        group.loading = false;
        group.error = getApiErrorMessage(error, 'No se pudieron cargar los demás procesos de este cliente.');
      },
    });
    this.clientGroupRequests.set(group.id, request);
  }

  private cancelClientGroupRequests(): void {
    this.clientGroupsGeneration++;
    this.clientGroupRequests.forEach(request => request.unsubscribe());
    this.clientGroupRequests.clear();
  }

  loading = false;
  loadingMore = false;
  hasMoreProcesses = false;
  processesLoadError = '';
  private processesRequest?: Subscription;
  private processesRequestId = 0;
  private activeFilters: ProcessFilters = {};
  private failedPage = 1;
  private destroyed = false;
  private scrollCheckFrame: number | null = null;
  private scrollResizeObserver?: ResizeObserver;
  @ViewChild('processesScroll') private processesScroll?: ElementRef<HTMLElement>;

  // The outer scroll loads clients; each card loads only its own process history.
  totalRecords = 0;
  totalClientGroups = 0;
  currentPage = 1;
  rowsPerPage = 20;
  groupsPerPage = 10;

  // Filters
  searchQuery = '';
  selectedTypes: number[] = [];
  selectedCreator: string | null = null;
  selectedMechanic: string | null = null;
  selectedClient: { label: string; id: string; email?: string; phone?: string } | null = null;
  selectedVerificationStatus: ProcessVerificationStatus | null = null;
  dateFrom: Date | null = null;
  dateTo: Date | null = null;
  filtersExpanded = false;
  templatesDialogVisible = false;
  templateFiltersApplied = false;
  renewalLinksDialogVisible = false;
  renewalLinksMode: 'generate' | 'responses' = 'generate';
  renewalLinksClient: { id: string; label: string; email?: string; phone?: string } | null = null;

  private readonly allTypeOptions = Object.entries(PROCESS_TYPE_LABELS).map(([key, label]) => ({
    label,
    value: Number(key)
  }));
  get typeOptions(): Array<{ label: string; value: number }> {
    return this.allTypeOptions;
  }

  get hasSelectedClient(): boolean {
    return typeof this.selectedClient?.id === 'string' && !!this.selectedClient.id.trim();
  }

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

  installationTarget: any | null = null;
  installationTargetLoading = false;
  installationTargetError = '';
  installationContacts: Contact[] | null = null;
  installationContactsLoading = false;
  installationContactsError = '';
  installationTagName = '';
  installationTagLoading = false;
  deviceRecordsVisible = false;
  deviceRecords: DeviceRecordEntry[] = [];
  deviceRecordsLoading = false;
  deviceRecordsError = '';
  private detailRequestId = 0;
  private recordsRequestId = 0;
  installationSolicitud: Solicitud | null = null;
  installationProgressRecord: InstallationDetail | null = null;
  installationProgressLoading = false;
  installationProgressError = '';
  private installationProgressRequestId = 0;
  private expandedInstallationStep = '';
  installationOwnerPath: InstallationAccount[] = [];
  installationOwnershipLoading = false;
  installationOwnershipError = '';
  installationTechnicianLoading = false;
  private installationTechnicianRequestId = 0;
  private installationTechnicianLookupId = '';

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
    private targetsService: TargetsService,
    private authService: AuthService,
    private tagsService: TagsService,
    private contactsService: ContactsService,
    private solicitudesService: SolicitudesService,
    private ngZone: NgZone,
  ) {}

  ngOnInit(): void {
    this.loadProcesses();
    this.loadTechnicians();
    this.loadEmployees();
    this.loadMechanics();
    this.loadBrandsAndModels();
  }

  loadProcesses(): void {
    this.processesRequestId++;
    this.processesRequest?.unsubscribe();
    this.cancelClientGroupRequests();
    this.currentPage = 1;
    this.processes = [];
    this.processGroups = [];
    this.totalRecords = 0;
    this.totalClientGroups = 0;
    this.hasMoreProcesses = false;
    this.loadingMore = false;
    this.processesLoadError = '';
    if (this.processesScroll) this.processesScroll.nativeElement.scrollTop = 0;
    const filters: ProcessFilters = {};
    if (this.selectedTypes.length) filters.types = [...this.selectedTypes];
    if (this.selectedCreator) filters.creator = this.selectedCreator;
    if (this.selectedMechanic) filters.mechanic = this.selectedMechanic;
    if (this.selectedClient?.id) filters.client = this.selectedClient.id;
    if (this.selectedVerificationStatus) filters.verificationStatus = this.selectedVerificationStatus;
    if (this.dateFrom) filters.dateFrom = this.hasPendingRenewalFilter ? renewalFilterDate(this.dateFrom) : this.dateFrom.toISOString();
    if (this.dateTo) filters.dateTo = this.hasPendingRenewalFilter ? renewalFilterDate(this.dateTo) : this.dateTo.toISOString();
    if (this.searchQuery?.trim()) filters.search = this.searchQuery.trim();
    this.activeFilters = filters;
    this.fetchProcessesPage(1);
  }

  loadMoreProcesses(): void {
    if (this.destroyed || this.loading || this.loadingMore || !this.hasMoreProcesses) return;
    this.fetchProcessesPage(this.currentPage + 1);
  }

  retryProcesses(): void {
    if (this.destroyed || this.loading || this.loadingMore || !this.processesLoadError) return;
    this.fetchProcessesPage(this.failedPage);
  }

  private fetchProcessesPage(page: number): void {
    if (this.destroyed) return;
    const requestId = ++this.processesRequestId;
    this.processesRequest?.unsubscribe();
    this.loading = page === 1;
    this.loadingMore = page > 1;
    this.processesLoadError = '';
    this.processesRequest = this.processesService.getClientGroups(page, this.groupsPerPage, this.activeFilters, this.rowsPerPage).subscribe({
      next: (res) => {
        if (this.destroyed || requestId !== this.processesRequestId) return;
        const groups = new Map((page === 1 ? [] : this.processGroups).map(group => [group.id, group]));
        for (const result of res.groups) {
          const existing = groups.get(result.id);
          if (existing) {
            existing.processes = this.mergeProcesses(existing.processes, result.processes);
            existing.total = result.total;
            existing.lastPage = result.lastPage;
          } else {
            groups.set(result.id, {
              ...result,
              name: formatUserName(result.name),
              route: result.route.map(account => ({ ...account, fullName: formatUserName(account.fullName) })),
              processes: this.mergeProcesses([], result.processes),
              loading: false,
              error: '',
            });
          }
        }
        this.processGroups = [...groups.values()];
        this.syncProcessesFromGroups();
        this.totalRecords = res.total;
        this.totalClientGroups = res.totalGroups;
        this.currentPage = page;
        this.hasMoreProcesses = res.groups.length > 0 && page < res.lastPage;
        this.loading = false;
        this.loadingMore = false;
        this.scheduleScrollCheck();
      },
      error: (error) => {
        if (this.destroyed || requestId !== this.processesRequestId) return;
        this.loading = false;
        this.loadingMore = false;
        this.failedPage = page;
        this.processesLoadError = getApiErrorMessage(error, 'Intenta nuevamente.');
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudieron cargar los procesos',
          detail: this.processesLoadError,
          life: 4000,
        });
      }
    });
  }

  ngAfterViewInit(): void {
    if (typeof ResizeObserver !== 'undefined' && this.processesScroll) {
      this.scrollResizeObserver = new ResizeObserver(() => this.scheduleScrollCheck());
      this.scrollResizeObserver.observe(this.processesScroll.nativeElement);
    }
    this.scheduleScrollCheck();
  }

  onProcessesScroll(): void {
    const container = this.processesScroll?.nativeElement;
    if (!container || container.clientHeight <= 0 || this.processesLoadError) return;
    if (container.scrollHeight - container.scrollTop - container.clientHeight <= 160) this.loadMoreProcesses();
  }

  @HostListener('window:resize')
  private scheduleScrollCheck(): void {
    if (this.destroyed || this.scrollCheckFrame !== null) return;
    this.scrollCheckFrame = requestAnimationFrame(() => {
      this.scrollCheckFrame = null;
      if (!this.destroyed) this.ngZone.run(() => this.onProcessesScroll());
    });
  }

  applyFilters(): void {
    this.templateFiltersApplied = false;
    this.currentPage = 1;
    this.loadProcesses();
  }

  applyTemplate(configuration: ProcessTemplateConfiguration): void {
    this.selectedTypes = [...configuration.types];
    this.selectedClient = configuration.client ? { ...configuration.client } : null;
    this.dateFrom = configuration.dateFrom ? new Date(configuration.dateFrom.getTime()) : null;
    this.dateTo = configuration.dateTo ? new Date(configuration.dateTo.getTime()) : null;
    this.searchQuery = '';
    this.selectedCreator = null;
    this.selectedMechanic = null;
    this.selectedVerificationStatus = null;
    this.clientOptions = [];
    this.templatesDialogVisible = false;
    this.filtersExpanded = false;
    this.applyFilters();
    this.templateFiltersApplied = true;
  }

  onProcessTypesChange(types: number[] | null): void {
    types = types ?? [];
    if (types.includes(22) && !this.selectedTypes.includes(22)) {
      // Renewal dates describe expiration rather than process registration.
      this.dateFrom = null;
      this.dateTo = null;
      this.selectedCreator = null;
      this.selectedVerificationStatus = null;
    }
    this.selectedTypes = types ?? [];
    this.applyFilters();
  }

  get hasPendingRenewalFilter(): boolean {
    return this.selectedTypes.includes(22);
  }

  openRenewalLinks(mode: 'generate' | 'responses'): void {
    if (!this.hasPendingRenewalFilter || !this.hasSelectedClient) return;
    this.renewalLinksClient = { ...this.selectedClient! };
    this.renewalLinksMode = mode;
    this.renewalLinksDialogVisible = true;
  }

  onRenewalResponseProcessed(): void {
    this.currentPage = 1;
    this.loadProcesses();
  }

  get onlyPendingRenewals(): boolean {
    return this.selectedTypes.length === 1 && this.hasPendingRenewalFilter;
  }

  isPendingRenewal(process: ProcessItem): boolean {
    return Number(process.type) === 22;
  }

  canVerifyProcess(process: ProcessItem): boolean {
    return !process.readOnly && !this.isPendingRenewal(process);
  }

  clearFilters(): void {
    this.templateFiltersApplied = false;
    this.searchQuery = '';
    this.selectedTypes = [];
    this.selectedCreator = null;
    this.selectedMechanic = null;
    this.selectedClient = null;
    this.clientOptions = [];
    this.selectedVerificationStatus = null;
    this.dateFrom = null;
    this.dateTo = null;
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
    if (this.selectedTypes.length) filters.types = [...this.selectedTypes];
    if (this.selectedCreator) filters.creator = this.selectedCreator;
    if (this.selectedMechanic) filters.mechanic = this.selectedMechanic;
    if (this.selectedClient?.id) filters.client = this.selectedClient.id;
    if (this.selectedVerificationStatus) filters.verificationStatus = this.selectedVerificationStatus;
    if (this.dateFrom) filters.dateFrom = this.hasPendingRenewalFilter ? renewalFilterDate(this.dateFrom) : this.dateFrom.toISOString();
    if (this.dateTo) filters.dateTo = this.hasPendingRenewalFilter ? renewalFilterDate(this.dateTo) : this.dateTo.toISOString();
    if (this.searchQuery?.trim()) filters.search = this.searchQuery.trim();

    const res = await this.processesService.getPaginated(1, 10000, filters).toPromise();
    const allProcesses = res?.data || [];

    const data = allProcesses.map(p => ({
      'Fecha': this.getProcessDate(p)?.toLocaleDateString('es-DO') || '',
      'Tipo': this.getTypeLabel(p.type, p),
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
      22: 'B45309',  // Renovación pendiente
      23: '2563EB',  // Revisión
    };

    // Apply type colors to column B (Tipo)
    allProcesses.forEach((p, i) => {
      const cell = ws[`B${i + 2}`];
      if (cell) {
        cell.s = {
          font: { color: { rgb: typeColors[isOfficeReviewProcess(p.type, p) ? 23 : p.type] || '000000' }, bold: true }
        };
      }
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Procesos');
    XLSX.writeFile(wb, `procesos_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  getTypeLabel(type: number, process?: ProcessItem): string {
    if (isOfficeReviewProcess(type, process)) return PROCESS_TYPE_LABELS[23];
    return PROCESS_TYPE_LABELS[type] || `Tipo ${type}`;
  }

  getTypeSeverity(type: number, process?: ProcessItem): string {
    if (isOfficeReviewProcess(type, process)) return 'info';
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
      22: 'warn',     // Renovación pendiente
      23: 'info',     // Revisión
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
      this.selectedTypes.length ? this.selectedTypes : null,
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
    if (!this.canVerifyProcess(process) || this.updatingVerificationId || this.getVerificationStatus(process.verificationStatus) === status) {
      return;
    }

    this.updatingVerificationId = process._id;
    this.processesService.updateVerificationStatus(process._id, status).subscribe({
      next: (updated) => {
        const index = this.processes.findIndex(item => item._id === updated._id);
        const current = index >= 0 ? this.processes[index] : null;
        const refreshed = {
          ...current,
          ...updated,
          // The API omits these fields after removing a previous review.
          verifiedBy: updated.verifiedBy,
          verifiedAt: updated.verifiedAt,
          verificationNote: updated.verificationNote,
          ...(current ? { client: current.client, clientRoute: current.clientRoute, target: current.target } : {}),
        };
        if (index >= 0) {
          this.processGroups.forEach(group => {
            group.processes = group.processes.map(item => item._id === updated._id ? refreshed : item);
          });
          this.syncProcessesFromGroups();
        }
        if (this.selectedProcess?._id === updated._id) {
          // Preserve the enriched account and target while updating the review.
          Object.assign(this.selectedProcess, refreshed);
        }
        this.updatingVerificationId = null;
        if (this.activeFilters.verificationStatus
          && this.activeFilters.verificationStatus !== this.getVerificationStatus(updated.verificationStatus)) {
          // Removing a filtered row shifts every later page, so reload before appending more history.
          this.loadProcesses();
        }
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
    this.resetInstallationDetail();
    this.selectedProcess = process;
    const changes = this.buildChangeRows(process.before, process.after);
    this.detailSimpleChangeRows = changes.filter(change => !change.isStructured);
    this.detailStructuredChangeRows = changes.filter(change => change.isStructured);
    this.detailDialogVisible = true;
    if (this.isInstallationProcess) {
      void this.loadInstallationTarget();
      void this.loadInstallationProgress();
      void this.loadInstallationTechnician();
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.processesRequestId++;
    this.processesRequest?.unsubscribe();
    this.cancelClientGroupRequests();
    this.scrollResizeObserver?.disconnect();
    if (this.scrollCheckFrame !== null) cancelAnimationFrame(this.scrollCheckFrame);
    this.closeDetail();
  }

  closeDetail(): void {
    this.detailDialogVisible = false;
    this.resetInstallationDetail();
    this.selectedProcess = null;
  }

  private resetInstallationDetail(): void {
    this.detailRequestId++;
    this.recordsRequestId++;
    this.installationProgressRequestId++;
    this.installationSolicitud = null;
    this.installationProgressRecord = null;
    this.installationProgressLoading = false;
    this.installationProgressError = '';
    this.expandedInstallationStep = '';
    this.installationOwnerPath = [];
    this.installationOwnershipLoading = false;
    this.installationOwnershipError = '';
    this.installationTechnicianRequestId++;
    this.installationTechnicianLookupId = '';
    this.installationTechnicianLoading = false;
    this.installationTarget = null;
    this.installationTargetLoading = false;
    this.installationTargetError = '';
    this.installationContacts = null;
    this.installationContactsLoading = false;
    this.installationContactsError = '';
    this.installationTagName = '';
    this.installationTagLoading = false;
    this.deviceRecordsVisible = false;
    this.deviceRecords = [];
    this.deviceRecordsLoading = false;
    this.deviceRecordsError = '';
  }

  get isInstallationProcess(): boolean {
    return [1, 18].includes(Number(this.selectedProcess?.type));
  }

  get installationSolicitudId(): string {
    const after = this.toComparableRecord(this.selectedProcess?.after);
    return String(this.selectedProcess?.target?.solicitud_id || after['solicitud_id'] || '').trim();
  }

  async loadInstallationProgress(): Promise<void> {
    const process = this.selectedProcess;
    const solicitudId = this.installationSolicitudId;
    if (!process || !this.isInstallationProcess || !solicitudId) return;
    const requestId = ++this.installationProgressRequestId;
    this.installationSolicitud = null;
    this.installationProgressRecord = null;
    this.installationProgressLoading = true;
    this.installationProgressError = '';
    const isCurrent = () => requestId === this.installationProgressRequestId
      && this.selectedProcess === process && this.detailDialogVisible;
    try {
      if (!this.mongoId(solicitudId)) throw new Error('La referencia de la solicitud no es válida.');
      const solicitud = await firstValueFrom(this.solicitudesService.getById(solicitudId));
      if (!isCurrent()) return;
      if (solicitud?._id !== solicitudId) throw new Error('La solicitud recibida no corresponde a este proceso.');
      const after = this.toComparableRecord(process.after);
      const imei = String(after['device_imei'] || process.target?.device_imei || '').trim();
      const rows = Array.isArray(solicitud.installations) ? solicitud.installations : [];
      const indexValue = process.target?.solicitud_installation_index;
      const hasIndex = indexValue !== undefined && indexValue !== null && String(indexValue).trim() !== '';
      const index = hasIndex && /^\d+$/.test(String(indexValue)) ? Number(indexValue) : -1;
      const installationId = process.target?.solicitud_installation_id;
      let installation: InstallationDetail | undefined;
      if (hasIndex) {
        if (Number.isInteger(index) && index >= 0) installation = rows[index];
      } else if (installationId) {
        installation = rows.find(row => row._id === installationId);
      } else if (imei) {
        const matches = rows.filter(row => String(row.device_imei || '').trim() === imei);
        if (matches.length === 1) installation = matches[0];
      }
      if (!installation) throw new Error('No se pudo identificar la instalación de este proceso en la solicitud.');
      if (imei && String(installation.device_imei || '').trim() !== imei) {
        throw new Error('El GPS de la instalación no coincide con el de este proceso.');
      }
      const expectedType = Number(process.type) === 18 ? 'reinstalacion' : 'instalacion';
      const rowType = String(installation.process_type || '').trim();
      const mixedTypes = ['instalacion', 'reinstalacion', 'chequeo', 'cambio', 'desinstalacion', 'cambio_vehiculo'];
      const effectiveType = solicitud.type === 'instalacion' && rowType === 'reinstalacion'
        ? 'reinstalacion'
        : solicitud.type !== 'mixta' ? solicitud.type : mixedTypes.includes(rowType) ? rowType : 'instalacion';
      if (effectiveType !== expectedType) {
        throw new Error('El tipo de instalación no coincide con el de este proceso.');
      }
      this.installationSolicitud = solicitud;
      this.installationProgressRecord = installation;
      void this.loadInstallationTechnician();
    } catch (error) {
      if (!isCurrent()) return;
      this.installationProgressError = getApiErrorMessage(error, 'No se pudieron comprobar los pasos de esta instalación.');
    } finally {
      if (isCurrent()) this.installationProgressLoading = false;
    }
  }

  get installationProgressSteps(): InstallationProgressStep[] {
    if (!this.selectedProcess || !this.isInstallationProcess) return [];
    return buildInstallationProgress({
      process: this.selectedProcess,
      target: this.installationTarget,
      targetLoading: this.installationTargetLoading,
      targetError: this.installationTargetError,
      linked: !!this.installationSolicitudId,
      installation: this.installationProgressRecord,
      solicitud: this.installationSolicitud,
      loading: this.installationProgressLoading,
      error: this.installationProgressError,
      technicians: this.techniciansMap,
      catalogs: { brands: this.brandsMap, models: this.modelsMap, colors: this.colorsMap, gpsModels: this.gpsModelsMap },
    });
  }

  get installationProgressTotal(): number {
    return this.installationProgressSteps.filter(step => step.status !== 'not-applicable').length;
  }

  get installationProgressComplete(): number {
    return this.installationProgressSteps.filter(step => step.status === 'complete').length;
  }

  get selectedInstallationProgressStep(): InstallationProgressStep | undefined {
    const steps = this.installationProgressSteps;
    return steps.find(step => step.id === this.expandedInstallationStep)
      || steps[0];
  }

  selectInstallationProgressStep(id: string): void {
    this.expandedInstallationStep = id;
  }

  trackInstallationStep(_index: number, step: InstallationProgressStep): string {
    return step.id;
  }

  trackInstallationCheck(_index: number, check: InstallationProgressStep['checks'][number]): string {
    return check.label;
  }

  installationStepLabel(status: InstallationProgressStep['status']): string {
    return ({ complete: 'Completo', pending: 'Pendiente', warning: 'Revisar', unavailable: 'No disponible', loading: 'Cargando', 'not-applicable': 'No aplica' })[status];
  }

  installationStepIcon(status: InstallationProgressStep['status']): string {
    return ({ complete: 'pi pi-check', pending: 'pi pi-clock', warning: 'pi pi-exclamation-triangle', unavailable: 'pi pi-question-circle', loading: 'pi pi-spin pi-spinner', 'not-applicable': 'pi pi-minus' })[status];
  }

  get installationCurrentAccount(): InstallationAccount | null {
    return this.installationOwnerPath[this.installationOwnerPath.length - 1] || null;
  }

  get installationCurrentSubclient(): InstallationAccount | null {
    const account = this.installationCurrentAccount;
    return account?.affiliation_type_id === 'subcliente' ? account : null;
  }

  get installationCurrentClient(): InstallationAccount | null {
    const account = this.installationCurrentAccount;
    if (account?.affiliation_type_id === 'cliente') return account;
    if (!this.installationCurrentSubclient) return null;
    return [...this.installationOwnerPath].reverse().find(item => item.affiliation_type_id === 'cliente') || null;
  }

  private async loadInstallationOwnership(process: ProcessItem, requestId: number): Promise<void> {
    const deviceId = this.mongoId(this.installationTarget?._id);
    const ownerId = this.mongoId(this.installationTarget?.parent_id);
    try {
      if (!ownerId) throw new Error('El dispositivo no tiene una cuenta propietaria identificada.');
      const path = await firstValueFrom(this.userService.getUserPath(ownerId));
      if (!this.isCurrentInstallationDetail(process, requestId, deviceId)) return;
      if (!Array.isArray(path) || path[path.length - 1]?.id !== ownerId
        || path.some(item => !item || typeof item.id !== 'string' || typeof item.fullName !== 'string')) {
        throw new Error('La cuenta recibida no corresponde al propietario actual del dispositivo.');
      }
      this.installationOwnerPath = path.map(item => ({
        id: item.id,
        fullName: item.fullName.trim() || 'Nombre no disponible',
        affiliation_type_id: String(item.affiliation_type_id || '').trim().toLowerCase(),
      }));
    } catch (error) {
      if (!this.isCurrentInstallationDetail(process, requestId, deviceId)) return;
      this.installationOwnerPath = [];
      this.installationOwnershipError = getApiErrorMessage(error, 'No se pudo consultar el propietario actual del dispositivo.');
    } finally {
      if (this.isCurrentInstallationDetail(process, requestId, deviceId)) this.installationOwnershipLoading = false;
    }
  }

  private get installationTechnicianId(): string {
    const row = this.installationProgressRecord;
    if (row?.completed && row.completion_source === 'technician' && row.completed_by_id) return this.mongoId(row.completed_by_id);
    if (this.installationSolicitudId) return this.mongoId(this.installationSolicitud?.mechanic_id);
    return this.mongoId(this.selectedProcess?.target?.['mechanic_id'])
      || this.mongoId(this.installationTarget?.mechanic_id);
  }

  get installationTechnicianName(): string {
    if (this.installationSolicitudId && this.installationProgressLoading) return 'Cargando técnico…';
    if (this.installationSolicitudId && this.installationProgressError) return 'Técnico no disponible';
    const row = this.installationProgressRecord;
    if (row?.completed && row.completion_source === 'technician' && row.completed_by_name) return formatUserName(row.completed_by_name);
    const id = this.installationTechnicianId;
    if (id && this.techniciansMap[id]) return formatUserName(this.techniciansMap[id]);
    const snapshot = this.selectedProcess?.target;
    if (snapshot?.['mechanic_name'] && (id ? snapshot['mechanic_id'] === id : !this.installationSolicitudId)) return formatUserName(snapshot['mechanic_name']);
    if (this.installationTechnicianLoading || this.installationProgressLoading) return 'Cargando técnico…';
    if (id) return 'Nombre del técnico no disponible';
    return this.installationProgressError || this.installationTargetError ? 'Técnico no disponible' : 'Sin técnico asignado';
  }

  private async loadInstallationTechnician(): Promise<void> {
    const process = this.selectedProcess;
    const id = this.installationTechnicianId;
    if (this.installationTechnicianLoading && this.installationTechnicianLookupId === id) return;
    const requestId = ++this.installationTechnicianRequestId;
    this.installationTechnicianLookupId = id;
    this.installationTechnicianLoading = false;
    if (!process || !id) return;
    if (this.techniciansMap[id]) return;
    if (process.target?.['mechanic_name'] && process.target['mechanic_id'] === id) {
      this.techniciansMap[id] = process.target['mechanic_name'];
      return;
    }
    this.installationTechnicianLoading = true;
    const isCurrent = () => requestId === this.installationTechnicianRequestId
      && this.selectedProcess === process && this.detailDialogVisible && this.installationTechnicianId === id;
    try {
      const technician = await firstValueFrom(this.userService.getById(id));
      if (!isCurrent() || technician?._id !== id) return;
      const name = [technician.name, technician.last_name].filter(Boolean).join(' ').trim() || technician.email;
      if (name) this.techniciansMap[id] = name;
    } catch {
      // The assignment remains visible when its account details cannot be read.
    } finally {
      if (isCurrent()) this.installationTechnicianLoading = false;
    }
  }

  get installationData(): any {
    const data = { ...(this.selectedProcess?.target || {}) };
    for (const [key, value] of Object.entries(this.installationTarget || {})) {
      if (value !== undefined) data[key] = value;
    }
    return data;
  }

  private mongoId(value: unknown): string {
    const id = typeof value === 'string' ? value.trim() : '';
    return /^[a-f\d]{24}$/i.test(id) ? id : '';
  }

  get recordsDeviceId(): string {
    return this.mongoId(this.installationTarget?._id)
      || this.mongoId(this.selectedProcess?.target?._id)
      || this.mongoId(this.selectedProcess?.reference);
  }

  get canViewDeviceRecords(): boolean {
    return this.isInstallationProcess
      && this.authService?.getCurrentUser()?.affiliation_type_id === 'empleado';
  }

  async loadInstallationTarget(): Promise<void> {
    const process = this.selectedProcess;
    if (!process || !this.isInstallationProcess) return;
    const requestId = ++this.detailRequestId;
    this.installationTargetLoading = true;
    this.installationTargetError = '';
    this.installationContacts = null;
    this.installationContactsLoading = true;
    this.installationContactsError = '';
    this.installationTagName = '';
    this.installationTagLoading = false;
    this.installationOwnerPath = [];
    this.installationOwnershipLoading = true;
    this.installationOwnershipError = '';
    const deviceId = this.mongoId(process.target?._id) || this.mongoId(process.reference);
    const imei = String(process.target?.device_imei || (/^\d{10,20}$/.test(process.reference || '') ? process.reference : '')).trim();
    try {
      if (!deviceId && !imei) throw new Error('El proceso no tiene un objetivo identificado.');
      const device = deviceId
        ? await this.targetsService.getTargetById(deviceId)
        : await this.targetsService.getTargetByImei(imei);
      if (requestId !== this.detailRequestId || this.selectedProcess !== process || !this.detailDialogVisible) return;
      if ((deviceId && String(device?._id) !== deviceId)
        || (!deviceId && String(device?.device_imei || device?.imei || '') !== imei)) {
        throw new Error('No se encontró un objetivo que corresponda a este proceso.');
      }
      this.installationTarget = device;
      void this.loadInstallationContacts(process, requestId);
      void this.loadInstallationOwnership(process, requestId);
      void this.loadInstallationTechnician();
    } catch (error) {
      if (requestId !== this.detailRequestId || this.selectedProcess !== process) return;
      this.installationTargetError = getApiErrorMessage(error, 'No se pudieron cargar los datos actuales del objetivo. Se muestran los datos disponibles en el proceso.');
      this.installationContactsLoading = false;
      this.installationContactsError = 'No se pudieron cargar los contactos actuales del objetivo.';
      this.installationOwnershipLoading = false;
      this.installationOwnershipError = 'No se pudo comprobar el propietario actual del dispositivo.';
    } finally {
      if (this.isCurrentInstallationDetail(process, requestId)) {
        this.installationTargetLoading = false;
        void this.loadInstallationTag(process, requestId);
      }
    }
  }

  private isCurrentInstallationDetail(process: ProcessItem, requestId: number, deviceId?: string): boolean {
    return requestId === this.detailRequestId
      && this.selectedProcess === process
      && this.detailDialogVisible
      && (!deviceId || this.recordsDeviceId === deviceId);
  }

  private async loadInstallationContacts(process: ProcessItem, requestId: number): Promise<void> {
    const deviceId = this.mongoId(this.installationTarget?._id);
    if (!deviceId) {
      this.installationContactsLoading = false;
      this.installationContactsError = 'El objetivo no tiene un identificador para consultar sus contactos.';
      return;
    }
    try {
      const contacts = await firstValueFrom(this.contactsService.getAll(deviceId));
      if (!this.isCurrentInstallationDetail(process, requestId, deviceId)) return;
      if (!Array.isArray(contacts) || contacts.some(contact => contact.reference !== deviceId)) {
        throw new Error('Los contactos recibidos no corresponden a este objetivo.');
      }
      this.installationContacts = contacts;
    } catch (error) {
      if (!this.isCurrentInstallationDetail(process, requestId, deviceId)) return;
      this.installationContacts = null;
      this.installationContactsError = getApiErrorMessage(error, 'No se pudieron cargar los contactos del objetivo.');
    } finally {
      if (this.isCurrentInstallationDetail(process, requestId, deviceId)) this.installationContactsLoading = false;
    }
  }

  private async loadInstallationTag(process: ProcessItem, requestId: number): Promise<void> {
    const tag = this.installationData.tag;
    if (tag?.name) return;
    const tagId = this.mongoId(typeof tag === 'string' ? tag : tag?._id);
    if (!tagId) return;
    const deviceId = this.recordsDeviceId;
    this.installationTagLoading = true;
    try {
      const currentTag = await firstValueFrom(this.tagsService.getTagById(tagId));
      if (!this.isCurrentInstallationDetail(process, requestId, deviceId)) return;
      if (currentTag?._id === tagId) this.installationTagName = currentTag.name || '';
    } catch {
      // A missing catalog entry must not hide the device's other fields.
      if (this.isCurrentInstallationDetail(process, requestId, deviceId)) this.installationTagName = '';
    } finally {
      if (this.isCurrentInstallationDetail(process, requestId, deviceId)) this.installationTagLoading = false;
    }
  }

  get installationContactsValue(): string {
    if (this.installationContactsLoading) return 'Cargando contactos…';
    if (this.installationContactsError || this.installationContacts === null) return 'Contactos no disponibles';
    return this.installationContacts.map(contact => [formatUserName(contact.full_name), contact.phone, contact.relationship]
      .filter(value => !!value).join(' · ')).filter(Boolean).join('; ') || 'Sin registrar';
  }

  get installationTagValue(): string {
    const tag = this.installationData.tag;
    if (!tag) return 'Sin registrar';
    if (tag?.name) return String(tag.name);
    if (this.installationTagName) return this.installationTagName;
    if (this.installationTagLoading) return 'Cargando etiqueta…';
    if (this.mongoId(typeof tag === 'string' ? tag : tag?._id)) return 'Etiqueta no disponible';
    return this.detailValue(tag);
  }

  toggleDeviceRecords(): void {
    if (!this.canViewDeviceRecords || !this.recordsDeviceId) return;
    this.deviceRecordsVisible = !this.deviceRecordsVisible;
    if (this.deviceRecordsVisible) void this.loadDeviceRecords();
  }

  async loadDeviceRecords(): Promise<void> {
    const deviceId = this.recordsDeviceId;
    if (!this.canViewDeviceRecords || !deviceId || !this.deviceRecordsVisible) return;
    const requestId = ++this.recordsRequestId;
    const process = this.selectedProcess;
    this.deviceRecordsLoading = true;
    this.deviceRecordsError = '';
    try {
      const response = await this.targetsService.getDeviceRecords(deviceId);
      if (requestId !== this.recordsRequestId || this.selectedProcess !== process || !this.detailDialogVisible) return;
      if (String(response?.deviceId) !== deviceId) throw new Error('El historial recibido no corresponde a este objetivo.');
      this.deviceRecords = Array.isArray(response?.entries) ? response.entries : [];
    } catch (error) {
      if (requestId !== this.recordsRequestId || this.selectedProcess !== process) return;
      this.deviceRecords = [];
      this.deviceRecordsError = getApiErrorMessage(error, 'No se pudo cargar el historial de registros del objetivo.');
    } finally {
      if (requestId === this.recordsRequestId) this.deviceRecordsLoading = false;
    }
  }

  installationValue(...keys: string[]): string {
    for (const key of keys) {
      const value = this.installationData[key];
      if (value !== null && value !== undefined && value !== '') return this.detailValue(value);
    }
    return 'Sin registrar';
  }

  private detailValue(value: any): string {
    if (Array.isArray(value)) return value.map(item => this.detailValue(item)).join(', ') || 'Sin registrar';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (value && typeof value === 'object') return value.name || value.nombre || value.label || value.phone || value.email || 'Sin registrar';
    if (typeof value === 'string' && /^(yes|true)$/i.test(value)) return 'Sí';
    if (typeof value === 'string' && /^(no|false)$/i.test(value)) return 'No';
    return String(value ?? 'Sin registrar');
  }

  get installationVehicleFields(): Array<{ label: string; value: string }> {
    const data = this.installationData;
    return [
      { label: 'Nombre del objetivo', value: this.installationValue('name') },
      { label: 'Marca', value: this.brandsMap[data.target_brand_id] || this.installationValue('brand', 'target_brand_name', 'target_brand_id') },
      { label: 'Modelo', value: this.modelsMap[data.target_model_id] || this.installationValue('model', 'target_model_name', 'target_model_id') },
      { label: 'Año', value: this.installationValue('target_year', 'year') },
      { label: 'Color', value: this.colorsMap[data.target_color] || this.installationValue('target_color', 'color') },
      { label: 'Placa', value: this.installationValue('target_plate_number', 'plate') },
      { label: 'Chasis', value: this.installationValue('target_chassis_number', 'chassis') },
      { label: 'Vehículo verificado', value: this.installationValue('verificado') },
      { label: 'Contactos', value: this.installationContactsValue },
      { label: 'Descripción', value: this.installationValue('description') },
    ];
  }

  get installationGpsFields(): Array<{ label: string; value: string }> {
    const data = this.installationData;
    const model = data.protocol?.name || this.gpsModelsMap[data.type || data.device_type] || this.installationValue('gps_model', 'device_type', 'type');
    const plan = data.service_plan;
    const connectionLabels: Record<string, string> = { online: 'En línea', offline: 'Fuera de línea', unknown: 'Desconocida' };
    const priorityLabels: Record<string, string> = { maximum: 'Máxima', important: 'Importante', standard: 'Estándar', normal: 'Normal' };
    return [
      { label: 'IMEI / ID del GPS', value: this.installationValue('device_imei', 'imei') },
      { label: 'Modelo GPS', value: model },
      { label: 'SIM card', value: this.installationValue('sim_card_number', 'sim_card') },
      { label: 'Proveedor de SIM', value: this.installationValue('sim_company') },
      { label: 'Sensor de ignición', value: this.installationValue('ignition_sensor') },
      { label: 'Apagado de motor', value: this.installationValue('engine_shutdown', 'shutdown_control') },
      { label: 'Conexión', value: connectionLabels[data.traccarInfo?.status] || data.traccarInfo?.status || 'Sin información' },
      { label: 'Prioridad de conexión', value: priorityLabels[data.connection_priority] || this.installationValue('connection_priority') },
      { label: 'GPS principal vinculado', value: this.installationValue('gps_adicional') },
      { label: 'Estado del objetivo', value: data.canceled ? 'Cancelado' : data.status === true || data.status === 'active' ? 'Activo' : data.status === false || data.status === 'inactive' ? 'Inactivo' : 'Sin información' },
      { label: 'Fecha de instalación', value: data.activation_date || data.installation_date ? this.formatStructuredDate(data.activation_date || data.installation_date) : 'Sin registrar' },
      { label: 'Fecha de expiración', value: data.expiration_date ? this.formatStructuredDate(data.expiration_date) : 'Sin registrar' },
      { label: 'Plan de servicio', value: plan?.name || plan?.plan_name || (plan?.years ? String(plan.years) + (Number(plan.years) === 1 ? ' año' : ' años') : 'Sin registrar') },
      { label: 'Etiqueta', value: this.installationTagValue },
    ];
  }

  get installationEvidence(): Array<{ label: string; url: string }> {
    const data = this.installationData;
    const fields = [
      ['target_image', 'Vehículo'], ['chasis_img', 'Chasis'], ['placa_img', 'Placa'],
      ['matricula_instalacion_img', 'Matrícula de instalación'], ['matricula_img', 'Matrícula'],
      ['lugar_instalacion_antes_img', 'Lugar antes de instalar'], ['vehiculo_exterior_antes_img', 'Exterior antes de instalar'],
      ['vehiculo_interior_antes_img', 'Interior antes de instalar'],
      ['lugar_instalacion_despues_img', 'Lugar después de instalar'], ['vehiculo_exterior_despues_img', 'Exterior después de instalar'],
      ['vehiculo_interior_despues_img', 'Interior después de instalar'],
      ['vehiculo_exterior_img', 'Exterior del vehículo'], ['vehiculo_interior_img', 'Interior del vehículo'],
      ['gps_numeracion_img', 'Numeración del GPS'], ['simcard_numeracion_img', 'Numeración de SIM card'],
    ];
    return fields.map(([key, label]) => ({ label, url: this.installationEvidenceUrl(data[key]) }))
      .filter(image => !!image.url);
  }

  installationEvidenceUrl(stored: any): string {
    const url = typeof stored === 'string' ? stored : stored?.url || stored?.location_cdn || stored?.location;
    if (!url || typeof url !== 'string') return '';
    if (/^(https?:|blob:|data:)/i.test(url)) return url;
    return `${environment.apiUrl.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
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
        office_review: 23,
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
    if (typeof creator === 'string') return formatUserName(creator);
    const name = creator.name || '';
    const lastName = creator.last_name || '';
    return formatUserName(name + ' ' + lastName) || creator.email || 'Desconocido';
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
    return formatUserName(fullName) || client.email || client.phone || 'Sin cliente asociado';
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
        return formatUserName(match[1]);
      }
    }
    // Fallback to target.mechanic_id resolved via technicians map
    if (process.target) {
      const mechanicId = String(process.target['mechanic_id'] || '').trim();
      if (mechanicId) return formatUserName(this.techniciansMap[mechanicId]) || mechanicId;
    }
    return [1, 18].includes(Number(process.type)) ? 'Sin técnico registrado' : 'Ninguno';
  }

  private loadTechnicians(): void {
    this.userService.getTechnicians().subscribe({
      next: (techs) => {
        techs.forEach(t => {
          this.techniciansMap[t._id] = [t.name, t.last_name].filter(Boolean).join(' ').trim() || t.email || 'Nombre no disponible';
        });
      },
      error: () => {}
    });
  }

  private loadEmployees(): void {
    this.userService.getEmployees().subscribe({
      next: (employees: any[]) => {
        this.employeeOptions = employees.map(e => ({
          label: formatUserName((e.name || '') + ' ' + (e.last_name || '')) || e.email,
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
          label: formatUserName((t.name || '') + ' ' + (t.last_name || '')) || t.email,
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
            const label = formatUserName(`${client.name || ''} ${client.last_name || ''}`)
              || client.email
              || client.phone
              || 'Cliente sin nombre';
            const id = String(client._id || client.id || client.email || client.phone || '').trim();
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

  onClientFilterChange(client: typeof this.selectedClient | string): void {
    const previouslySelected = this.hasSelectedClient;
    this.selectedClient = typeof client === 'object' && client?.id?.trim() ? client : null;
    this.templateFiltersApplied = false;
    if (!this.hasSelectedClient && (previouslySelected || this.hasPendingRenewalFilter)) {
      this.processes = [];
      this.totalRecords = 0;
      this.applyFilters();
    }
  }

  clearClientFilter(): void {
    this.onClientFilterChange(null);
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
