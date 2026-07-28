import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { Subject, Subscription, interval, of, firstValueFrom } from 'rxjs';
import { takeUntil, switchMap, catchError, map, startWith } from 'rxjs/operators';
import { MonitoringService, MonitorUserResponse, MonitoringSummary, MonitoringStatus } from 'src/app/core/services/monitoring.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { TranslateService } from '@ngx-translate/core';
import { UserService } from 'src/app/core/services/user.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Protocol } from 'src/app/core/interfaces/protocol.interface';
import { ProtocolsService } from 'src/app/core/services/protocols.service';
import { TargetsService } from 'src/app/core/services/targets.service';
import { CreateProcessDto, ProcessResponse, TargetDevice } from 'src/app/core/interfaces/target.interface';
import { PlansService } from 'src/app/core/services/plans.service';
import { Plan } from 'src/app/core/interfaces/plan.interface';
import { User } from 'src/app/core/interfaces/user.interface';
import { SIM_CARD_TYPES } from 'src/app/core/constants/sim-card-types.constant';
import { MessageService } from 'primeng/api';
import * as ExcelJS from 'exceljs';

@Component({
  selector: 'app-monitoring',
  templateUrl: './monitoring.component.html',
  styleUrls: ['./monitoring.component.css'],
  standalone: false
})
export class MonitoringComponent implements OnInit, OnDestroy {
  userEmail: string = '';
  userId: string = '';
  monitoringType: 'device-status' | 'mileage' = 'device-status';
  includeMileage: boolean = false;
  monitoringResult: MonitorUserResponse | null = null;
  mileageFrom: string = '';
  mileageTo: string = '';
  monitoringSummaries: MonitoringSummary[] = [];
  latestSummary: MonitoringSummary | null = null;
  loading: boolean = false;
  reportGenerationStatus: MonitoringStatus | null = null;
  searchingUser: boolean = false;
  error: string = '';
  userFound: boolean = false;
  foundUserName: string = '';
  showUserSearchModal: boolean = false;
  isFiltersDrawerVisible: boolean = false;
  protocols: any[] = [];
  contactsDialogVisible: boolean = false;
  selectedContactsDeviceName: string = '';
  selectedDeviceContacts: string[] = [];
  private filteredMonitoringDataCache: MonitorUserResponse['data'] = [];
  private filteredMonitoringDataSource: MonitorUserResponse['data'] | null = null;
  private filteredMonitoringDataSignature: string = '';
  private filteredMonitoringRenewalsSource: Map<string, string> | null = null;
  private monitoringSummaryStatsSource: any[] | null = null;
  private monitoringSummaryStatsCache = {
    totalUsers: 0,
    totalDevices: 0,
    activeDevices: 0,
    activeValidOnlineDevices: 0,
    activeValidOfflineDevices: 0,
    totalExpiredDevices: 0
  };

  // Filter options
  statusOptions: any[] = [
    { label: 'All Statuses', value: null },
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' }
  ];

  expirationOptions: any[] = [
    { label: 'All renewals', value: null },
    { label: 'Active', value: 'valid' },
    { label: 'Expired', value: 'expired' }
  ];

  affiliationFilterOptions: string[] = [
    'cliente',
    'subcliente',
    'socio',
    'empleado',
    'tecnico_empleado',
    'tecnico_independiente',
    'otro'
  ];

  profileFilterOptions: string[] = ['empresa', 'personal', 'compartido'];

  offlineDurationOptions: Array<{ label: string; value: string; minutes: number; comparison: 'lt' | 'gte' | 'custom' }> = [
    { label: 'MONITORING.FILTERS_OFFLINE_DURATION_NO_DATA', value: 'no-data', minutes: 0, comparison: 'lt' },
    { label: 'MONITORING.FILTERS_OFFLINE_DURATION_LT_1H', value: 'lt-1h', minutes: 60, comparison: 'lt' },
    { label: 'MONITORING.FILTERS_OFFLINE_DURATION_LT_5H', value: 'lt-5h', minutes: 5 * 60, comparison: 'lt' },
    { label: 'MONITORING.FILTERS_OFFLINE_DURATION_LT_20H', value: 'lt-20h', minutes: 20 * 60, comparison: 'lt' },
    { label: 'MONITORING.FILTERS_OFFLINE_DURATION_LT_1D', value: 'lt-1d', minutes: 24 * 60, comparison: 'lt' },
    { label: 'MONITORING.FILTERS_OFFLINE_DURATION_LT_3D', value: 'lt-3d', minutes: 3 * 24 * 60, comparison: 'lt' },
    { label: 'MONITORING.FILTERS_OFFLINE_DURATION_LT_5D', value: 'lt-5d', minutes: 5 * 24 * 60, comparison: 'lt' },
    { label: 'MONITORING.FILTERS_OFFLINE_DURATION_LT_1W', value: 'lt-1w', minutes: 7 * 24 * 60, comparison: 'lt' },
    { label: 'MONITORING.FILTERS_OFFLINE_DURATION_GT_1H', value: 'gt-1h', minutes: 60, comparison: 'gte' },
    { label: 'MONITORING.FILTERS_OFFLINE_DURATION_GT_5H', value: 'gt-5h', minutes: 5 * 60, comparison: 'gte' },
    { label: 'MONITORING.FILTERS_OFFLINE_DURATION_GT_20H', value: 'gt-20h', minutes: 20 * 60, comparison: 'gte' },
    { label: 'MONITORING.FILTERS_OFFLINE_DURATION_GT_1D', value: 'gt-1d', minutes: 24 * 60, comparison: 'gte' },
    { label: 'MONITORING.FILTERS_OFFLINE_DURATION_GT_3D', value: 'gt-3d', minutes: 3 * 24 * 60, comparison: 'gte' },
    { label: 'MONITORING.FILTERS_OFFLINE_DURATION_GT_5D', value: 'gt-5d', minutes: 5 * 24 * 60, comparison: 'gte' },
    { label: 'MONITORING.FILTERS_OFFLINE_DURATION_GT_1W', value: 'gt-1w', minutes: 7 * 24 * 60, comparison: 'gte' },
    { label: 'MONITORING.FILTERS_OFFLINE_DURATION_CUSTOM', value: 'custom', minutes: 0, comparison: 'custom' }
  ];

  customOfflineTimeValue: number | null = null;
  customOfflineTimeUnit: string = 'gt-hours'; // Default to 'More than hours'

  accountSizeThresholds: number[] = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];

  private _selectedStatusFilter: string = '';
  private _selectedConnectionFilter: string = '';
  private _selectedOfflineDurationFilter: string = '';
  private _selectedExpirationFilter: string = '';
  private _selectedAffiliationFilter: string = '';
  private _selectedProfileFilter: string = '';
  private _selectedProtocolFilter: string = '';
  private _selectedSimCompanyFilter: string = '';
  private _selectedSimStatusFilter: string = '';
  private _selectedActivationFilter: string = 'all';
  private _selectedAccountSizeFilter: number | null = null;
  private _expirationFromDate: Date | null = null;
  private _expirationToDate: Date | null = null;
  private _activationFromDate: Date | null = null;
  private _activationToDate: Date | null = null;

  private statusPollingSubscription: Subscription | null = null;
  private readonly statusPollingIntervalMs = 10000;
  private currentStatusRequestId: string | null = null;
  private monitoringRequestStartTimestamp: number | null = null;
  cancellingStatus: boolean = false;

  // Renewed devices filter state
  _renewedDeviceIds: Map<string, string> = new Map();
  loadingRenewals: boolean = false;
  private _includeRenewed: boolean = false;

  get includeRenewed(): boolean {
    return this._includeRenewed;
  }

  set includeRenewed(value: boolean) {
    if (this._includeRenewed !== value) {
      this._includeRenewed = value;
      this.fetchRenewalDeviceIds();
    }
  }



  get selectedStatusFilter(): string {
    return this._selectedStatusFilter;
  }

  get monitoringPanelTitle(): string {
    const fallback = this.translate.instant('MONITORING.DESCRIPTION');
    const prefix = this.translate.instant('MONITORING.PANEL_PREFIX');

    if (this.foundUserName) {
      return `${prefix} ${this.foundUserName}`;
    }

    if (this.userEmail) {
      return `${prefix} ${this.userEmail}`;
    }

    return fallback;
  }

  get monitoringPanelSubtitle(): string {
    if (this.userEmail) {
      return this.userEmail;
    }

    return this.translate.instant('MONITORING.PANEL_SUBTITLE_DEFAULT');
  }

  get isMileageMonitoring(): boolean {
    return this.monitoringType === 'mileage';
  }

  onMileageToggle(enabled: boolean): void {
    this.includeMileage = enabled;
    this.monitoringType = enabled ? 'mileage' : 'device-status';
    if (!enabled) {
      this.mileageFrom = '';
      this.mileageTo = '';
    }
  }

  formatDeviceDistance(device: any): string {
    const rawDistance = device?.distanceReport?.distance;
    const distance = typeof rawDistance === 'number' ? rawDistance : Number(rawDistance);
    if (Number.isNaN(distance)) {
      return 'N/D';
    }
    const kilometers = distance / 1000;
    return `${kilometers.toFixed(2)} km`;
  }

  getDeviceKilometers(device: any): number | string {
    const rawDistance = device?.distanceReport?.distance;
    const distance = typeof rawDistance === 'number' ? rawDistance : Number(rawDistance);
    if (!Number.isFinite(distance)) {
      return 'N/D';
    }

    return Number((distance / 1000).toFixed(2));
  }

  formatDistanceRange(device: any): string {
    const report = device?.distanceReport;
    if (!report?.from || !report?.to) {
      return '';
    }
    const from = new Date(report.from);
    const to = new Date(report.to);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return '';
    }
    return `${from.toLocaleDateString()} - ${to.toLocaleDateString()}`;
  }

  private buildMileageRange(): { from: string; to: string } | undefined {
    if (this.monitoringType !== 'mileage') {
      return undefined;
    }

    return {
      from: new Date(this.mileageFrom).toISOString(),
      to: new Date(this.mileageTo).toISOString()
    };
  }

  getMonitoringTypeLabel(type?: 'device-status' | 'mileage'): string {
    const base = 'Estados de los dispositivos';
    if (type === 'mileage') {
      return `${base} + Kilometraje`;
    }
    return base;
  }

  private startStatusPolling(userId: string, initialStatus: MonitoringStatus | null = null, startTimestamp?: number): void {
    if (!userId) {
      return;
    }

    this.stopStatusPolling();
    if (initialStatus) {
      this.reportGenerationStatus = initialStatus;
      this.currentStatusRequestId = initialStatus.requestId || null;
    } else {
      this.reportGenerationStatus = null;
      this.currentStatusRequestId = null;
    }

    if (typeof startTimestamp === 'number') {
      this.monitoringRequestStartTimestamp = startTimestamp;
    } else if (!this.monitoringRequestStartTimestamp) {
      this.monitoringRequestStartTimestamp = Date.now();
    }

    this.statusPollingSubscription = interval(this.statusPollingIntervalMs)
      .pipe(
        startWith(0),
        switchMap(() => this.monitoringService.getMonitoringStatus(userId))
      )
      .subscribe({
        next: (status) => {
          if (!status || status.status === 'idle') {
            this.currentStatusRequestId = null;
            if (this.reportGenerationStatus?.status !== 'pending') {
              this.reportGenerationStatus = null;
              this.monitoringRequestStartTimestamp = null;
            }
            return;
          }

          if (this.monitoringRequestStartTimestamp && status.updatedAt) {
            const statusUpdatedAt = new Date(status.updatedAt).getTime();
            if (statusUpdatedAt < this.monitoringRequestStartTimestamp) {
              return;
            }
          }

          if (!this.currentStatusRequestId && status.requestId) {
            this.currentStatusRequestId = status.requestId;
          }

          if (status.requestId && this.currentStatusRequestId && status.requestId !== this.currentStatusRequestId) {
            // Ignore previous status records when a new request is being tracked
            if (status.status === 'completed' || status.status === 'failed') {
              return;
            }
            this.currentStatusRequestId = status.requestId;
          }

          if (
            (status.status === 'completed' || status.status === 'failed') &&
            (!status.requestId || !this.currentStatusRequestId || status.requestId === this.currentStatusRequestId)
          ) {
            if (status.status === 'completed') {
              this.clearMonitoringStatus({
                requestId: status.requestId,
                refreshSummaries: true,
                stopPolling: false
              });
              return;
            }

            this.clearMonitoringStatus({
              requestId: status.requestId,
              stopPolling: false
            });
            return;
          }

          if (!this.monitoringRequestStartTimestamp) {
            this.monitoringRequestStartTimestamp = status.updatedAt
              ? new Date(status.updatedAt).getTime()
              : Date.now();
          }

          this.reportGenerationStatus = status;
        },
        error: (error) => {
          console.error('Monitoring status polling error:', error);
          this.currentStatusRequestId = null;
        }
      });
  }
  private stopStatusPolling = (): void => {
    if (this.statusPollingSubscription) {
      this.statusPollingSubscription.unsubscribe();
      this.statusPollingSubscription = null;
    }
    this.monitoringRequestStartTimestamp = null;
  };

  private clearMonitoringStatus(options: { requestId?: string | null; refreshSummaries?: boolean; stopPolling?: boolean } = {}): void {
    const { requestId, refreshSummaries = false, stopPolling = false } = options;

    if (stopPolling) {
      this.stopStatusPolling();
    }

    const id = requestId || this.currentStatusRequestId;

    const finalize = () => {
      this.reportGenerationStatus = null;
      this.currentStatusRequestId = null;
      this.cancellingStatus = false;
      if (!stopPolling) {
        this.monitoringRequestStartTimestamp = null;
      }
      if (refreshSummaries && this.userId) {
        this.fetchMonitoringSummaries(this.userId, true);
      }
    };

    if (!id) {
      finalize();
      return;
    }

    this.monitoringService.cancelMonitoringStatus(id).subscribe({
      next: finalize,
      error: (error) => {
        console.error('Error clearing monitoring status:', error);
        finalize();
      }
    });
  }

  private buildPendingMonitoringStatus(userId: string): MonitoringStatus {
    return {
      userId,
      status: 'pending',
      processedUsers: 0,
      totalUsers: 0,
      progress: 0,
      message: this.translate.instant('MONITORING.STATUS_PREPARING')
    } as MonitoringStatus;
  }

  private checkMonitoringStatus(userId: string, startPollingAfterFetch: boolean = false): void {
    if (!userId) {
      return;
    }

    this.monitoringService.getMonitoringStatus(userId).subscribe({
      next: (status) => {
        if (!status || status.status === 'idle') {
          this.currentStatusRequestId = null;
          if (this.reportGenerationStatus?.status !== 'pending') {
            this.reportGenerationStatus = null;
          }
          return;
        }

        this.reportGenerationStatus = status;
        this.currentStatusRequestId = status.requestId || null;

        if (startPollingAfterFetch && !this.statusPollingSubscription) {
          const resumeTimestamp = status.updatedAt
            ? new Date(status.updatedAt).getTime()
            : Date.now();
          this.startStatusPolling(userId, status, resumeTimestamp);
        }
      },
      error: (error) => {
        console.error('Monitoring status fetch error:', error);
      }
    });
  }

  set selectedStatusFilter(value: string) {
    if (this._selectedStatusFilter !== value) {
      this._selectedStatusFilter = value;
    }
  }

  get selectedConnectionFilter(): string {
    return this._selectedConnectionFilter;
  }

  set selectedConnectionFilter(value: string) {
    if (this._selectedConnectionFilter !== value) {
      this._selectedConnectionFilter = value;

      if (!this.supportsOfflineDurationFilter(value)) {
        this._selectedOfflineDurationFilter = '';
      }

      this.ensureSelectedProtocolIsAvailable();
    }
  }

  get filteredProtocolOptions(): any[] {
    if (!this.shouldLimitProtocolFilterToTags()) {
      return this.protocols;
    }

    return this.protocols.filter(protocol => this.isTagProtocol(protocol));
  }

  get selectedOfflineDurationFilter(): string {
    return this._selectedOfflineDurationFilter;
  }

  set selectedOfflineDurationFilter(value: string) {
    if (this._selectedOfflineDurationFilter !== value) {
      this._selectedOfflineDurationFilter = value;
    }
  }

  get selectedExpirationFilter(): string {
    return this._selectedExpirationFilter;
  }

  set selectedExpirationFilter(value: string) {
    if (this._selectedExpirationFilter !== value) {
      this._selectedExpirationFilter = value;
      this._includeRenewed = false;
      this._renewedDeviceIds = new Map();
    }
  }

  private fetchRenewalDeviceIds(): void {
    const from = this._expirationFromDate;
    const to = this._expirationToDate;
    if (!this._includeRenewed || !from || !to || this._selectedExpirationFilter !== 'expired') {
      this._renewedDeviceIds = new Map();
      return;
    }

    this.loadingRenewals = true;
    const fromStr = this.formatDateForInput(from);
    const toStr = this.formatDateForInput(to);

    this.monitoringService.getRenewalDeviceIds(fromStr, toStr).subscribe({
      next: (items) => {
        this._renewedDeviceIds = new Map(items.map(i => [i.deviceId, i.renewalDate]));
        this.loadingRenewals = false;
      },
      error: (error) => {
        console.error('Error fetching renewal device IDs:', error);
        this._renewedDeviceIds = new Map();
        this.loadingRenewals = false;
      }
    });
  }

  get selectedAffiliationFilter(): string {
    return this._selectedAffiliationFilter;
  }

  set selectedAffiliationFilter(value: string) {
    if (this._selectedAffiliationFilter !== value) {
      this._selectedAffiliationFilter = value;
    }
  }

  get selectedProfileFilter(): string {
    return this._selectedProfileFilter;
  }

  set selectedProfileFilter(value: string) {
    if (this._selectedProfileFilter !== value) {
      this._selectedProfileFilter = value;
    }
  }

  get selectedProtocolFilter(): string {
    return this._selectedProtocolFilter;
  }

  set selectedProtocolFilter(value: string) {
    if (this._selectedProtocolFilter !== value) {
      this._selectedProtocolFilter = value;
    }
  }

  get selectedSimCompanyFilter(): string {
    return this._selectedSimCompanyFilter;
  }

  set selectedSimCompanyFilter(value: string) {
    if (this._selectedSimCompanyFilter !== value) {
      this._selectedSimCompanyFilter = value;
      // Reset SIM status filter when SIM company changes
      if (!this.supportsSimStatusFilter(value)) {
        this._selectedSimStatusFilter = '';
      }
    }
  }

  get selectedSimStatusFilter(): string {
    return this._selectedSimStatusFilter;
  }

  set selectedSimStatusFilter(value: string) {
    if (this._selectedSimStatusFilter !== value) {
      this._selectedSimStatusFilter = value;
    }
  }

  supportsSimStatusFilter(simCompany: string | null | undefined): boolean {
    const normalizedCompany = simCompany?.toString().toLowerCase();
    return normalizedCompany === 'global-m'
      || normalizedCompany === 'global-m2'
      || normalizedCompany === 'global-e';
  }

  private getNormalizedSimStatus(device: any): 'active' | 'suspended' | '' {
    const simCompany = device?.sim_company?.toString().toLowerCase() ?? '';
    const status = device?.simStatus?.status?.toString().toLowerCase() ?? '';

    if (status === 'active' || status === 'activated') {
      return 'active';
    }

    if (status.includes('suspend')) {
      return 'suspended';
    }

    if (simCompany === 'global-e' && this.supportsSimStatusFilter(simCompany)) {
      return 'suspended';
    }

    return '';
  }

  get selectedActivationFilter(): string {
    return this._selectedActivationFilter;
  }

  set selectedActivationFilter(value: string) {
    if (this._selectedActivationFilter !== value) {
      this._selectedActivationFilter = value;
    }
  }

  get selectedAccountSizeFilter(): number | null {
    return this._selectedAccountSizeFilter;
  }

  set selectedAccountSizeFilter(value: number | null) {
    if (this._selectedAccountSizeFilter !== value) {
      this._selectedAccountSizeFilter = value;
    }
  }

  get expirationFromDate(): string {
    return this._expirationFromDate ? this.formatDateForInput(this._expirationFromDate) : '';
  }

  set expirationFromDate(value: string) {
    this._expirationFromDate = this.parseDateInput(value);
    if (this._includeRenewed) this.fetchRenewalDeviceIds();
  }

  get expirationToDate(): string {
    return this._expirationToDate ? this.formatDateForInput(this._expirationToDate) : '';
  }

  set expirationToDate(value: string) {
    this._expirationToDate = this.parseDateInput(value);
    if (this._includeRenewed) this.fetchRenewalDeviceIds();
  }

  get activationFromDate(): string {
    return this._activationFromDate ? this.formatDateForInput(this._activationFromDate) : '';
  }

  set activationFromDate(value: string) {
    this._activationFromDate = this.parseDateInput(value);
  }

  get activationToDate(): string {
    return this._activationToDate ? this.formatDateForInput(this._activationToDate) : '';
  }

  set activationToDate(value: string) {
    this._activationToDate = this.parseDateInput(value);
  }

  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private parseDateInput(value: string): Date | null {
    if (!value) {
      return null;
    }

    const parts = value.split('-');
    if (parts.length !== 3) {
      return null;
    }

    const [yearStr, monthStr, dayStr] = parts;
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);

    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
      return null;
    }

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }

    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  private normalizeDateOnly(value: Date | string | null | undefined): Date | null {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      if (isNaN(value.getTime())) {
        return null;
      }
      return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }

    if (typeof value === 'string') {
      // Extract YYYY-MM-DD from ISO strings (e.g. "2025-03-15T00:00:00.000Z")
      // to avoid timezone shift when parsing UTC dates in local time
      let datePart = value;
      if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
        datePart = value.substring(0, 10);
      }

      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        const [yearStr, monthStr, dayStr] = datePart.split('-');
        const year = Number(yearStr);
        const month = Number(monthStr);
        const day = Number(dayStr);

        if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
          return null;
        }

        if (month < 1 || month > 12 || day < 1 || day > 31) {
          return null;
        }

        const parsedDate = new Date(year, month - 1, day);
        if (
          parsedDate.getFullYear() !== year ||
          parsedDate.getMonth() !== month - 1 ||
          parsedDate.getDate() !== day
        ) {
          return null;
        }

        return parsedDate;
      }

      const parsedStringDate = new Date(value);
      if (!isNaN(parsedStringDate.getTime())) {
        return new Date(
          parsedStringDate.getFullYear(),
          parsedStringDate.getMonth(),
          parsedStringDate.getDate()
        );
      }

      return null;
    }

    const parsed = new Date(value as any);
    if (isNaN(parsed.getTime())) {
      return null;
    }

    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  // Monitoring reports
  userMonitoringReports: MonitoringSummary[] = [];
  selectedUserReports: MonitoringSummary[] = [];
  loadingReports: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private monitoringService: MonitoringService,
    private userService: UserService,
    private protocolsService: ProtocolsService,
    private targetsService: TargetsService,
    private plansService: PlansService,
    private messageService: MessageService,
    private authService: AuthService,
    private translate: TranslateService
  ) { }

  ngOnInit(): void {
    // Load protocols data
    this.loadProtocols();

    // Get user ID from route parameter but don't start monitoring automatically
    this.route.params.subscribe(params => {
      this.userId = params['user'];
      if (this.userId) {
        // If we have a user ID from route, try to get user info for display
        this.loadUserInfo(this.userId);
        // Load monitoring reports for the current user
        this.loadUserMonitoringReports(this.userId);
      }
      // Don't show modal automatically - user must click "Seleccionar Usuario"
    });
  }

  ngOnDestroy(): void {
    this.stopStatusPolling();
  }

  searchUserByEmail(): void {
    if (!this.userEmail || !this.userEmail.trim()) {
      this.error = this.translate.instant('MONITORING.ENTER_VALID_EMAIL');
      return;
    }

    this.searchingUser = true;
    this.error = '';
    this.userFound = false;
    this.foundUserName = '';

    this.userService.getByEmail(this.userEmail.trim()).subscribe({
      next: (user: User) => {
        this.userId = user._id;
        this.userFound = true;
        this.foundUserName = `${user.name} ${user.last_name}`;
        this.searchingUser = false;
        // Load monitoring reports for the selected user
        this.loadSelectedUserReports(user._id);
        console.log('User found:', user);
      },
      error: (error: any) => {
        this.error = this.translate.instant('MONITORING.USER_NOT_FOUND');
        this.searchingUser = false;
        this.userFound = false;
        console.error('User search error:', error);
      }
    });
  }

  startMonitoring(): void {
    if (!this.userId) {
      this.error = this.translate.instant('MONITORING.SEARCH_USER_FIRST');
      return;
    }

    // Close the modal and start monitoring
    this.showUserSearchModal = false;
    this.error = '';
    this.monitoringResult = null;
    this.monitoringRequestStartTimestamp = Date.now();
    const pendingStatus = this.buildPendingMonitoringStatus(this.userId);
    this.reportGenerationStatus = pendingStatus;
    this.currentStatusRequestId = null;
    this.startStatusPolling(this.userId, pendingStatus, this.monitoringRequestStartTimestamp);

    if (this.monitoringType === 'mileage') {
      if (!this.mileageFrom || !this.mileageTo) {
        this.error = 'Selecciona el rango de fechas (desde y hasta).';
        return;
      }
      if (new Date(this.mileageFrom) > new Date(this.mileageTo)) {
        this.error = 'La fecha inicial debe ser menor o igual a la final.';
        return;
      }
    }

    const range = this.buildMileageRange();

    this.monitoringService.monitorUser(this.userId, this.monitoringType, range).subscribe({
      next: (result) => {
        if (result?.statusRequestId) {
          this.currentStatusRequestId = result.statusRequestId;
        }
        console.log('Monitoring result:', result);
        this.fetchMonitoringSummaries(this.userId);
      },
      error: (error) => {
        this.error = 'Error monitoring user: ' + error.message;
        console.error('Monitoring error:', error);
        this.stopStatusPolling();
      }
    });
  }

  startMonitoringWithFilters(): void {
    if (!this.userId) {
      this.error = this.translate.instant('MONITORING.SEARCH_USER_FIRST');
      return;
    }

    // Close the modal and start monitoring
    this.showUserSearchModal = false;
    this.error = '';
    this.monitoringResult = null;
    this.monitoringRequestStartTimestamp = Date.now();
    const pendingStatus = this.buildPendingMonitoringStatus(this.userId);
    this.reportGenerationStatus = pendingStatus;
    this.currentStatusRequestId = null;
    this.startStatusPolling(this.userId, pendingStatus, this.monitoringRequestStartTimestamp);

    if (this.monitoringType === 'mileage') {
      if (!this.mileageFrom || !this.mileageTo) {
        this.error = 'Selecciona el rango de fechas (desde y hasta).';
        return;
      }
      if (new Date(this.mileageFrom) > new Date(this.mileageTo)) {
        this.error = 'La fecha inicial debe ser menor o igual a la final.';
        return;
      }
    }

    const range = this.buildMileageRange();

    this.monitoringService.monitorUser(this.userId, this.monitoringType, range).subscribe({
      next: (result) => {
        if (result?.statusRequestId) {
          this.currentStatusRequestId = result.statusRequestId;
        }
        console.log('Monitoring result:', result);
        this.fetchMonitoringSummaries(this.userId);
      },
      error: (error) => {
        this.error = 'Error monitoring user: ' + error.message;
        console.error('Monitoring error:', error);
        this.stopStatusPolling();
      }
    });
  }

  // Massive Processes Properties
  displayMassiveProcessesDialog: boolean = false;
  isLoadingMassiveProcess: boolean = false;
  massiveProcessProgress: number = 0;
  massiveProcessStatus: string = '';
  massiveProcessResults: { success: number; failed: number; cancelled: number; errors: any[] } = { success: 0, failed: 0, cancelled: 0, errors: [] };
  renewalYearOptions: number[] = Array.from({ length: 10 }, (_, i) => i + 1);
  massiveProcessDevices: (TargetDevice & { customRenewalYears?: number; customDescription?: string })[] = [];
  renewalProgressList: { deviceName: string; status: 'processing' | 'success' | 'error' | 'cancelled'; newDate?: string; error?: string }[] = [];
  showOutdatedDataWarning: boolean = false;
  isDataStale: boolean = false;
  massiveProcessGroups: { route: any[], devices: any[] }[] = [];

  // Data for Form
  availablePlans: any[] = [];
  availableTechnicians: any[] = [];
  availableSimCardTypes: any[] = [];

  // Process Form Data
  processForm: any = {
    type: '',
    registrationDate: new Date().toISOString().substring(0, 10),
    description: '',
    // Dynamic fields
    newPlan: '',
    newPrice: 0, // Not used in massive but kept for compatibility
    newInstallationDate: '',
    newExpirationDate: '',
    newRenewalDate: '',
    renewalYears: null,
    newTechnician: '',
    newInstallationDetails: '',
    newSimType: '',
    // payment_period: 'monthly' // Not used in massive
  };

  // Process Type Map
  private processTypeMap: { [key: string]: number } = {
    'installation': 2,
    'expiration': 3,
    'renewal': 4,
    'plan_change': 5,
    'technician_change': 8,
    'installation_details_change': 10,
    'sim_type_change': 15
  };

  openMassiveProcesses(): void {
    console.log('Open Massive Renewal for user:', this.userId);

    // Flatten and group devices from filtered data for preview
    this.massiveProcessDevices = [];
    this.massiveProcessGroups = [];
    if (this.filteredMonitoringData) {
      this.filteredMonitoringData.forEach((group: any) => {
        if (group.devices && group.devices.length > 0) {
          this.massiveProcessGroups.push({
            route: group.route,
            devices: group.devices
          });
          this.massiveProcessDevices.push(...group.devices);
        }
      });
    }

    const isStale = this.shouldWarnAboutDataFreshness();
    this.isDataStale = isStale;

    if (isStale) {
      this.showOutdatedDataWarning = true;
      return;
    }

    this.displayMassiveProcessesDialog = true;
    this.resetMassiveProcessForm();
    this.processForm.type = 'renewal'; // Default and only type now
    this.loadMassiveProcessData();
  }

  shouldWarnAboutDataFreshness(): boolean {
    const monitoringResult = this.monitoringResult;
    const latestSummary = this.latestSummary;
    const userId = this.userId;

    console.log('=== Data Freshness Check ===');
    console.log('monitoringResult:', monitoringResult);
    console.log('latestSummary:', latestSummary);
    console.log('userId:', userId);

    // Check if we have monitoring result loaded
    if (!monitoringResult) {
      console.log('❌ No monitoringResult loaded');
      return true; // No report loaded, warn user
    }

    // Check if we have a latest summary
    if (!latestSummary) {
      console.log('❌ No latestSummary available');
      return true; // No summary, warn user
    }

    // Check if the current report is from the current user
    if (monitoringResult.userId !== userId) {
      console.log('❌ Different user - monitoringResult.userId:', monitoringResult.userId, 'vs userId:', userId);
      return true; // Different user, warn
    }

    // Check if the currently viewed report is NOT the latest one
    if (monitoringResult.id !== latestSummary.id) {
      const currentReportDate = new Date(monitoringResult.createdAt).getTime();
      const latestSummaryDate = new Date(latestSummary.createdAt).getTime();

      console.log('Current report date:', new Date(monitoringResult.createdAt));
      console.log('Latest summary date:', new Date(latestSummary.createdAt));

      if (latestSummaryDate > currentReportDate) {
        console.log('❌ There is a newer monitoring available (latest summary is newer)');
        return true; // Latest summary is newer, warn
      }
    }

    // Check if data is older than 4 hours
    const reportDate = new Date(monitoringResult.createdAt);
    const now = new Date();
    const diffMinutes = (now.getTime() - reportDate.getTime()) / (1000 * 60);
    console.log('Age in minutes:', diffMinutes);

    if (diffMinutes > 240) { // 4 hours = 240 minutes
      console.log('❌ Data is older than 4 hours');
      return true; // Data is older than 4 hours
    }

    console.log('✅ Data is fresh');
    return false;
  }


  executeNewMonitoring(): void {
    this.showOutdatedDataWarning = false;
    // Trigger new monitoring
    this.startMonitoring();
  }

  removeFromMassiveProcess(device: any): void {
    // Mark as excluded instead of removing from array so we can show it as "Cancelled" in results
    device.isExcluded = true;

    // Update data stale check if needed
    this.isDataStale = this.shouldWarnAboutDataFreshness();
  }

  hasActiveDevices(group: any): boolean {
    return group.devices && group.devices.some((d: any) => !d.isExcluded);
  }

  get activeDeviceCount(): number {
    return this.massiveProcessDevices.filter(d => !d['isExcluded']).length;
  }

  closeMassiveProcesses(): void {
    this.displayMassiveProcessesDialog = false;
  }

  applyYearsToAll(): void {
    if (this.processForm.renewalYears) {
      this.massiveProcessDevices.forEach(device => {
        device.customRenewalYears = this.processForm.renewalYears;
      });
    }
  }

  hasDevicesWithYears(): boolean {
    return this.massiveProcessDevices.some(device => device.customRenewalYears && device.customRenewalYears > 0);
  }

  applyDescriptionToAll(): void {
    this.massiveProcessDevices.forEach(device => {
      device.customDescription = this.processForm.description || '';
    });
  }

  resetMassiveProcessForm(): void {
    this.processForm = {
      type: '',
      registrationDate: new Date().toISOString().substring(0, 10),
      description: '',
      newPlan: '',
      newPrice: 0,
      newInstallationDate: '',
      newExpirationDate: '',
      newRenewalDate: '',
      renewalYears: null,
      newTechnician: '',
      newInstallationDetails: '',
      newSimType: ''
    };
    this.massiveProcessProgress = 0;
    this.massiveProcessStatus = '';
    this.massiveProcessResults = { success: 0, failed: 0, cancelled: 0, errors: [] };
    this.isLoadingMassiveProcess = false;
  }

  loadMassiveProcessData(): void {
    // Load Plans
    this.plansService.getAllPlans().subscribe({
      next: (plans: Plan[]) => {
        this.availablePlans = plans.map(plan => ({
          label: plan.plan_name,
          value: plan._id
        })).sort((a, b) => a.label.localeCompare(b.label));
      },
      error: (error) => console.error('Error loading plans:', error)
    });

    // Load Technicians
    this.userService.getTechnicians().subscribe({
      next: (technicians: User[]) => {
        this.availableTechnicians = technicians.map(tech => ({
          label: `${tech.name} ${tech.last_name}`.trim(),
          value: tech._id
        })).sort((a, b) => a.label.localeCompare(b.label));
      },
      error: (error) => console.error('Error loading technicians:', error)
    });

    // Load SIM Types
    this.availableSimCardTypes = [...SIM_CARD_TYPES];
  }

  async executeMassiveProcess(): Promise<void> {
    if (!this.processForm.type) {
      this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'Seleccione un tipo de proceso' });
      return;
    }

    if (!this.monitoringResult || !this.filteredMonitoringData) {
      this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'No hay dispositivos para procesar' });
      return;
    }

    // 1. Use the pre-flattened list which contains our state and exclusions
    const allDevices = this.massiveProcessDevices;

    if (allDevices.length === 0) {
      this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'No hay dispositivos para procesar' });
      return;
    }

    // Count active (non-excluded) devices for confirmation
    const activeCount = allDevices.filter(d => !d['isExcluded']).length;

    if (!confirm(`¿Está seguro de ejecutar este proceso masivo en ${activeCount} dispositivos? Esta acción no se puede deshacer.`)) {
      return;
    }

    this.isLoadingMassiveProcess = true;
    this.massiveProcessStatus = 'Iniciando proceso masivo...';
    this.massiveProcessProgress = 0;
    this.massiveProcessResults = { success: 0, failed: 0, cancelled: 0, errors: [] };
    this.renewalProgressList = [];

    const currentUser = this.authService.getCurrentUser();
    const totalDevices = allDevices.length;
    let processedCount = 0;

    // 2. Iterate and process
    for (const device of allDevices) {
      // Check if device was manually excluded
      if (device['isExcluded']) {
        this.renewalProgressList.push({
          deviceName: device.name,
          status: 'cancelled' as any,
          error: 'Renovación cancelada'
        });
        this.massiveProcessResults.cancelled++; // Use the new counter
        processedCount++;
        this.massiveProcessProgress = Math.round((processedCount / totalDevices) * 100);
        continue;
      }

      // Add device to progress list with processing status
      this.renewalProgressList.push({
        deviceName: device.name,
        status: 'processing'
      });

      try {
        // Validar si el dispositivo tiene ID
        if (!device._id) {
          throw new Error(`Dispositivo ${device.name} no tiene ID válido`);
        }

        // Preparar datos específicos según el tipo de proceso
        let details = '';

        switch (this.processForm.type) {
          case 'installation':
            details = `Cambio de fecha de instalación a ${this.processForm.newInstallationDate}.`;
            break;
          case 'expiration':
            details = `Cambio de fecha de expiración a ${this.processForm.newExpirationDate}.`;
            break;
          case 'renewal':
            // Try to parse the date robustly
            let expDate: Date | null = null;
            if (device.expiration_date) {
              // Try standard Date constructor first (handles ISO strings)
              const d = new Date(device.expiration_date);
              if (!isNaN(d.getTime())) {
                expDate = d;
              } else {
                // Fallback to custom parser for YYYY-MM-DD
                expDate = this.parseDateInput(device.expiration_date);
              }
            }

            // Use custom renewal years for this specific device
            const renewalYearsRaw = (device as any).customRenewalYears;
            const renewalYears = typeof renewalYearsRaw === 'string' ? parseInt(renewalYearsRaw, 10) : renewalYearsRaw;

            if (expDate && renewalYears && !isNaN(renewalYears)) {
              // Timezone-safe date calculation: add years directly
              const year = expDate.getFullYear();
              const month = expDate.getMonth();
              const day = expDate.getDate();

              const newDate = new Date(year + renewalYears, month, day);

              // Format as YYYY-MM-DD manually to be safe
              const newYear = newDate.getFullYear();
              const newMonth = String(newDate.getMonth() + 1).padStart(2, '0');
              const newDay = String(newDate.getDate()).padStart(2, '0');
              const newExpDateCalculated = `${newYear}-${newMonth}-${newDay}`;

              details = `Renovación de servicio por ${renewalYears} año(s). Nueva fecha de expiración: ${newExpDateCalculated}.`;
              (device as any)._calculatedNewExpiration = newExpDateCalculated;
            } else if (!device.expiration_date) {
              throw new Error(`El dispositivo no tiene una fecha de expiración actual.`);
            } else if (!renewalYears) {
              throw new Error(`No se especificaron años de renovación para el dispositivo.`);
            } else {
              throw new Error(`No se pudo procesar la fecha de expiración actual del dispositivo: ${device.expiration_date}`);
            }
            break;
          case 'plan_change':
            const planName = this.availablePlans.find(p => p.value === this.processForm.newPlan)?.label || 'Desconocido';
            details = `Cambio de plan a ${planName}.`;
            break;
          case 'technician_change':
            const techName = this.availableTechnicians.find(t => t.value === this.processForm.newTechnician)?.label || 'Desconocido';
            details = `Cambio de técnico asignado a ${techName}.`;
            break;
          case 'installation_details_change':
            details = `Actualización de detalles de instalación: ${this.processForm.newInstallationDetails}`;
            break;
          case 'sim_type_change':
            details = `Cambio de tipo de SIM a ${this.processForm.newSimType}.`;
            break;
        }

        // Use custom description for this specific device
        const deviceDescription = (device as any).customDescription || '';

        if (deviceDescription) {
          details += ` Notas: ${deviceDescription}`;
        }

        const currentDate = new Date().toISOString().substring(0, 10);

        const processData: CreateProcessDto = {
          type: this.processTypeMap[this.processForm.type] || 1,
          registrationDate: currentDate,
          description: deviceDescription || 'Proceso masivo',
          details: details,
          target: {
            _id: device._id,
            name: device.name,
            device_imei: device.device_imei,
            sim_card_number: device.sim_card_number
          },
          user: {
            _id: currentUser?.id || "sistema",
            name: currentUser?.name || "Sistema",
            email: currentUser?.email || "sistema@montao.net"
          },
          reference: device._id,
          before: {
            status: "pending",
            lastProcess: null
          },
          after: {
            status: "completed",
            processType: this.processForm.type,
            processDate: currentDate
          },
          creator: currentUser?.id || "sistema"
        };

        // Assign specific fields based on type and update local state
        if (this.processForm.type === 'plan_change') {
          await this.targetsService.updateTarget(device._id!, { plan: this.processForm.newPlan });
          device.plan = this.processForm.newPlan;
        } else if (this.processForm.type === 'technician_change') {
          await this.targetsService.updateTarget(device._id!, { mechanic_id: this.processForm.newTechnician });
          device.mechanic_id = this.processForm.newTechnician;
        } else if (this.processForm.type === 'expiration') {
          await this.targetsService.updateTarget(device._id!, { expiration_date: this.processForm.newExpirationDate });
          device.expiration_date = this.processForm.newExpirationDate;
        } else if (this.processForm.type === 'renewal' && (device as any)._calculatedNewExpiration) {
          const newExpDate = (device as any)._calculatedNewExpiration;
          await this.targetsService.updateTarget(device._id!, { expiration_date: newExpDate });
          device.expiration_date = newExpDate;
        } else if (this.processForm.type === 'installation') {
          await this.targetsService.updateTarget(device._id!, { installation_date: this.processForm.newInstallationDate });
          device.installation_date = this.processForm.newInstallationDate;
        } else if (this.processForm.type === 'installation_details_change') {
          await this.targetsService.updateTarget(device._id!, { installation_details: this.processForm.newInstallationDetails });
          device.installation_details = this.processForm.newInstallationDetails;
        } else if (this.processForm.type === 'sim_type_change') {
          await this.targetsService.updateTarget(device._id!, { sim_company: this.processForm.newSimType });
          device.sim_company = this.processForm.newSimType;
        }

        // Call create process
        await this.targetsService.createProcess(processData);

        this.massiveProcessResults.success++;

        // Update progress list with success status
        const currentIndex = this.renewalProgressList.findIndex(item => item.deviceName === device.name && item.status === 'processing');
        if (currentIndex !== -1) {
          this.renewalProgressList[currentIndex].status = 'success';
          this.renewalProgressList[currentIndex].newDate = (device as any)._calculatedNewExpiration || device.expiration_date;
        }

        // Show success toast
        this.messageService.add({
          severity: 'success',
          summary: 'Renovación Exitosa',
          detail: `${device.name} renovado correctamente`,
          life: 3000
        });

      } catch (error: any) {
        console.error(`Error processing device ${device.name}:`, error);
        this.massiveProcessResults.failed++;
        this.massiveProcessResults.errors.push({ device: device.name, error: error.message || 'Unknown error' });

        // Update progress list with error status
        const currentIndex = this.renewalProgressList.findIndex(item => item.deviceName === device.name && item.status === 'processing');
        if (currentIndex !== -1) {
          this.renewalProgressList[currentIndex].status = 'error';
          this.renewalProgressList[currentIndex].error = error.message || 'Error desconocido';
        }

        // Show error toast
        this.messageService.add({
          severity: 'error',
          summary: 'Error en Renovación',
          detail: `${device.name}: ${error.message || 'Error desconocido'}`,
          life: 5000
        });
      }

      processedCount++;
      this.massiveProcessProgress = Math.round((processedCount / totalDevices) * 100);
      this.massiveProcessStatus = `Procesando ${processedCount} de ${totalDevices} dispositivos...`;
    }

    this.isLoadingMassiveProcess = false;
    this.massiveProcessStatus = 'Proceso finalizado.';
    this.messageService.add({
      severity: 'success',
      summary: 'Proceso Masivo Completado',
      detail: `Exitosos: ${this.massiveProcessResults.success}, Fallidos: ${this.massiveProcessResults.failed}`
    });
  }

  openUserSearchModal(): void {
    this.showUserSearchModal = true;
  }

  closeUserSearchModal(): void {
    this.showUserSearchModal = false;
  }

  openFiltersDrawer(): void {
    this.isFiltersDrawerVisible = true;
  }

  closeFiltersDrawer(): void {
    this.isFiltersDrawerVisible = false;
  }




  private loadUserInfo(userId: string): void {
    // Optional: load user info if we have ID from route
    this.userService.getById(userId).subscribe({
      next: (user) => {
        this.userEmail = user.email;
        this.userFound = true;
        this.foundUserName = `${user.name} ${user.last_name}`;
      },
      error: (error) => {
        console.warn('Could not load user info from route ID:', error);
      }
    });
  }

  private fetchMonitoringSummaries(userId: string, showLoader: boolean = false, checkStatus: boolean = false): void {
    if (!userId) {
      return;
    }

    if (showLoader) {
      this.loadingReports = true;
    }

    this.monitoringService.monitorUserSummary(userId).subscribe({
      next: (response) => {
        const summaries = (response?.summaries || []).map(summary => ({
          ...summary,
          activeValidOnlineDevices: summary.activeValidOnlineDevices ?? 0,
          activeValidOfflineDevices: summary.activeValidOfflineDevices ?? 0,
          totalExpiredDevices: summary.totalExpiredDevices ?? 0,
          monitoringType: (summary as any).monitoringType || 'device-status'
        }));
        this.monitoringSummaries = summaries;
        this.latestSummary = summaries.length > 0 ? summaries[0] : null;
        this.userMonitoringReports = summaries;
        this.selectedUserReports = summaries;
        this.isDataStale = this.shouldWarnAboutDataFreshness();
        if (checkStatus) {
          this.checkMonitoringStatus(userId, true);
        }
        if (showLoader) {
          this.loadingReports = false;
        }
      },
      error: (error) => {
        console.error('Monitoring summary error:', error);
        if (showLoader) {
          this.loadingReports = false;
        }
        if (checkStatus) {
          this.checkMonitoringStatus(userId, true);
        }
      }
    });
  }

  resetSearch(): void {
    this.userEmail = '';
    this.userId = '';
    this.userFound = false;
    this.foundUserName = '';
    this.monitoringResult = null;
    this.error = '';
    this.monitoringSummaries = [];
    this.latestSummary = null;
    this.userMonitoringReports = [];
    this.selectedUserReports = [];
    this.reportGenerationStatus = null;
    this.currentStatusRequestId = null;
    this.selectedProtocolFilter = '';
    this.selectedSimCompanyFilter = '';
    this.selectedSimStatusFilter = '';
    this.selectedActivationFilter = 'all';
    this._activationFromDate = null;
    this._activationToDate = null;
    this.selectedAccountSizeFilter = null;
    this.stopStatusPolling();
  }

  private loadProtocols(): void {
    this.protocolsService.getAllProtocols().subscribe({
      next: (protocols: any[]) => {
        this.protocols = protocols;
        this.ensureSelectedProtocolIsAvailable();
      },
      error: (error: any) => {
        console.error('Error loading protocols:', error);
      }
    });
  }

  private loadUserMonitoringReports(userId: string): void {
    this.fetchMonitoringSummaries(userId, true, true);
  }

  private loadSelectedUserReports(userId: string): void {
    this.fetchMonitoringSummaries(userId, true, true);
  }

  getMonitoringStatusTitle(status: MonitoringStatus | null): string {
    if (!status) {
      return '';
    }

    switch (status.status) {
      case 'pending':
        return this.translate.instant('MONITORING.STATUS_PENDING');
      case 'in-progress':
        return this.translate.instant('MONITORING.STATUS_IN_PROGRESS', {
          processed: status.processedUsers ?? 0,
          total: status.totalUsers ?? 0
        });
      case 'failed':
        return this.translate.instant('MONITORING.STATUS_FAILED');
      default:
        return this.translate.instant('MONITORING.STATUS_PENDING');
    }
  }

  getMonitoringStatusIcon(status: MonitoringStatus | null): string {
    if (!status) {
      return '';
    }

    switch (status.status) {
      case 'completed':
        return 'pi pi-check-circle';
      case 'failed':
        return 'pi pi-exclamation-triangle';
      default:
        return 'pi pi-spinner pi-spin';
    }
  }

  getStatusCreatorLabel(status: MonitoringStatus | null): string | null {
    const creator = status?.creator as any;
    if (!creator) {
      return null;
    }

    const nameParts = [creator?.name, creator?.last_name].filter(Boolean);
    const name = nameParts.join(' ').trim();
    const email = (creator?.email ?? '').trim();

    if (name && email) {
      return `${name} (${email})`;
    }

    if (name) {
      return name;
    }

    if (email) {
      return email;
    }

    return null;
  }

  getProtocolName(deviceType: string): string {
    if (!deviceType || !this.protocols.length) {
      return deviceType || 'Unknown';
    }

    const protocol = this.protocols.find(p => p._id === deviceType);
    return protocol ? protocol.name : deviceType;
  }

  get availableSimCompanies(): string[] {
    if (!this.monitoringResult?.data) {
      return [];
    }

    const companies = new Set<string>();
    this.monitoringResult.data.forEach(userData => {
      (userData.devices ?? []).forEach(device => {
        const value = device?.sim_company;
        if (value) {
          companies.add(value.toString());
        }
      });
    });

    return Array.from(companies).sort((a, b) => a.localeCompare(b));
  }

  // Getter to filter out users without devices and apply status/expiration filters
  get filteredMonitoringData(): MonitorUserResponse['data'] {
    const sourceData = this.monitoringResult?.data;
    if (!sourceData) {
      this.clearMonitoringViewCache();
      return [];
    }

    const filterSignature = this.getMonitoringFilterSignature();
    if (
      this.filteredMonitoringDataSource === sourceData &&
      this.filteredMonitoringDataSignature === filterSignature &&
      this.filteredMonitoringRenewalsSource === this._renewedDeviceIds
    ) {
      return this.filteredMonitoringDataCache;
    }

    const filteredData = sourceData
      .map(userData => {
        // Filter devices based on selected filters
        let filteredDevices = (userData.devices || []).filter(device => !device.canceled);

        const userRoute = Array.isArray(userData.route) ? userData.route : [];
        const targetRouteEntry = userRoute.length > 0 ? userRoute[userRoute.length - 1] : null;

        // Apply affiliation filter on user route
        if (this._selectedAffiliationFilter && this._selectedAffiliationFilter !== '') {
          const matchesAffiliation =
            targetRouteEntry?.affiliation_type_id === this._selectedAffiliationFilter;
          if (!matchesAffiliation) {
            filteredDevices = [];
          }
        }

        // Apply profile filter on user route
        if (this._selectedProfileFilter && this._selectedProfileFilter !== '') {
          const matchesProfile = targetRouteEntry?.profile_type_id === this._selectedProfileFilter;
          if (!matchesProfile) {
            filteredDevices = [];
          }
        }

        if (this._selectedProtocolFilter && this._selectedProtocolFilter !== '') {
          filteredDevices = filteredDevices.filter(device => device.type === this._selectedProtocolFilter);
        }

        if (this._selectedSimCompanyFilter && this._selectedSimCompanyFilter !== '') {
          filteredDevices = filteredDevices.filter(device => {
            const simCompany = device?.sim_company?.toString().toLowerCase() ?? '';
            return simCompany === this._selectedSimCompanyFilter.toLowerCase();
          });
        }

        if (this._selectedSimStatusFilter && this._selectedSimStatusFilter !== '') {
          filteredDevices = filteredDevices.filter(device => {
            const simStatus = this.getNormalizedSimStatus(device);
            return simStatus === this._selectedSimStatusFilter.toLowerCase();
          });
        }

        if (this._selectedActivationFilter === 'range') {
          filteredDevices = filteredDevices.filter(device => {
            const activationDate = device?.activation_date;
            if (!activationDate) {
              return false;
            }
            return this.isDateInRange(activationDate, this._activationFromDate, this._activationToDate);
          });
        }

        // Apply status filter
        if (this._selectedStatusFilter && this._selectedStatusFilter !== '') {
          switch (this._selectedStatusFilter) {
            case 'active':
              filteredDevices = filteredDevices.filter(device => device.status === true);
              break;
            case 'inactive':
              filteredDevices = filteredDevices.filter(device => device.status === false);
              break;
          }
        }

        // Apply connection filter
        if (this._selectedConnectionFilter && this._selectedConnectionFilter !== '') {
          switch (this._selectedConnectionFilter) {
            case 'online':
              filteredDevices = filteredDevices.filter(device => this.isDeviceOnline(device));
              break;
            case 'weak-signal':
              filteredDevices = filteredDevices.filter(device => this.isDeviceWeakSignal(device));
              break;
            case 'localizado':
              filteredDevices = filteredDevices.filter(device => this.isDeviceLocalizado(device));
              break;
            case 'no-localizado':
              filteredDevices = filteredDevices.filter(device => this.isDeviceNoLocalizado(device));
              break;
            case 'initial':
              filteredDevices = filteredDevices.filter(device => this.isDeviceInitialState(device));
              break;
            case 'initial-or-offline':
              filteredDevices = filteredDevices.filter(device => !this.isDeviceOnline(device));
              break;
            case 'offline':
              filteredDevices = filteredDevices.filter(device =>
                !this.isDeviceOnline(device) &&
                !this.isDeviceWeakSignal(device) &&
                !this.isDeviceLocalizado(device) &&
                !this.isDeviceNoLocalizado(device) &&
                !this.isDeviceInitialState(device)
              );
              break;
          }
        }

        if (this.supportsOfflineDurationFilter(this._selectedConnectionFilter) && this._selectedOfflineDurationFilter) {
          const durationOption = this.offlineDurationOptions.find(
            option => option.value === this._selectedOfflineDurationFilter
          );

          if (durationOption) {
            filteredDevices = filteredDevices.filter(device =>
              this.matchesOfflineDuration(device, durationOption)
            );
          }
        }

        // Apply expiration filter
        if (this._selectedExpirationFilter && this._selectedExpirationFilter !== '') {
          const hasDateRange = !!(this._expirationFromDate || this._expirationToDate);
          switch (this._selectedExpirationFilter) {
            case 'expired':
              filteredDevices = filteredDevices.filter(device => {
                const expirationDate = device.expiration_date;
                if (hasDateRange) {
                  if (this._includeRenewed && this._renewedDeviceIds.has(device._id)) {
                    return true;
                  }
                  if (!expirationDate) return false;
                  // When date range is set, show all devices whose expiration_date falls within the range
                  return this.isDateInRange(expirationDate, this._expirationFromDate, this._expirationToDate);
                }
                if (!expirationDate) return false;
                return this.isExpired(expirationDate);
              });
              break;
            case 'valid':
              filteredDevices = filteredDevices.filter(device => {
                const expirationDate = device.expiration_date;
                if (!expirationDate) {
                  return false;
                }
                if (hasDateRange) {
                  // When date range is set, show all devices whose expiration_date falls within the range
                  return this.isDateInRange(expirationDate, this._expirationFromDate, this._expirationToDate);
                }
                return !this.isExpired(expirationDate);
              });
              break;
          }
        }

        return {
          ...userData,
          devices: filteredDevices
        };
      })
      .filter(userData => userData.devices && userData.devices.length > 0) // Remove users with no devices after filtering
      .filter(userData => {
        if (this._selectedAccountSizeFilter === null) {
          return true;
        }
        return (userData.devices?.length ?? 0) > this._selectedAccountSizeFilter;
      });

    this.filteredMonitoringDataSource = sourceData;
    this.filteredMonitoringDataSignature = filterSignature;
    this.filteredMonitoringRenewalsSource = this._renewedDeviceIds;
    this.filteredMonitoringDataCache = filteredData;
    this.monitoringSummaryStatsSource = null;

    return filteredData;
  }

  get monitoringSummaryStats() {
    const data = this.filteredMonitoringData;
    if (this.monitoringSummaryStatsSource === data) {
      return this.monitoringSummaryStatsCache;
    }

    let totalUsers = data.length;
    let totalDevices = 0;
    let activeDevices = 0;
    let activeValidOnlineDevices = 0;
    let activeValidOfflineDevices = 0;
    let totalExpiredDevices = 0;

    data.forEach(userData => {
      const devices = userData.devices ?? [];
      totalDevices += devices.length;

      devices.forEach(device => {
        const isActive = !!device.status;
        const isOnline = this.isDeviceOnline(device);
        const isValid = this.isValid(device.expiration_date);
        const isExpired = this.isExpired(device.expiration_date);

        if (isActive) {
          activeDevices++;
          if (isValid && isOnline) {
            activeValidOnlineDevices++;
          } else if (isValid && !isOnline) {
            activeValidOfflineDevices++;
          }
        }

        if (isExpired) {
          totalExpiredDevices++;
        }
      });
    });

    this.monitoringSummaryStatsSource = data;
    this.monitoringSummaryStatsCache = {
      totalUsers,
      totalDevices,
      activeDevices,
      activeValidOnlineDevices,
      activeValidOfflineDevices,
      totalExpiredDevices
    };

    return this.monitoringSummaryStatsCache;
  }

  private getMonitoringFilterSignature(): string {
    return [
      this._selectedStatusFilter,
      this._selectedConnectionFilter,
      this._selectedOfflineDurationFilter,
      this._selectedExpirationFilter,
      this._selectedAffiliationFilter,
      this._selectedProfileFilter,
      this._selectedProtocolFilter,
      this._selectedSimCompanyFilter,
      this._selectedSimStatusFilter,
      this._selectedActivationFilter,
      this._selectedAccountSizeFilter ?? '',
      this._expirationFromDate?.getTime() ?? '',
      this._expirationToDate?.getTime() ?? '',
      this._activationFromDate?.getTime() ?? '',
      this._activationToDate?.getTime() ?? '',
      this.customOfflineTimeValue ?? '',
      this.customOfflineTimeUnit,
      this._includeRenewed
    ].join('|');
  }

  private clearMonitoringViewCache(): void {
    this.filteredMonitoringDataCache = [];
    this.filteredMonitoringDataSource = null;
    this.filteredMonitoringDataSignature = '';
    this.filteredMonitoringRenewalsSource = null;
    this.monitoringSummaryStatsSource = null;
  }

  formatExpirationDate(expirationDate: Date | string): string {
    if (!expirationDate) {
      return '-';
    }

    const date = new Date(expirationDate);
    if (isNaN(date.getTime())) {
      return '-';
    }

    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  calculateNewExpirationDate(currentExpiration: Date | string, yearsToAdd: number): string {
    if (!currentExpiration || !yearsToAdd) {
      return '-';
    }

    try {
      // Ensure yearsToAdd is a number
      const years = typeof yearsToAdd === 'string' ? parseInt(yearsToAdd, 10) : yearsToAdd;

      if (isNaN(years) || years <= 0) {
        return '-';
      }

      // Parse current expiration date
      let expDate: Date | null = null;
      if (currentExpiration) {
        const d = new Date(currentExpiration);
        if (!isNaN(d.getTime())) {
          expDate = d;
        } else {
          expDate = this.parseDateInput(currentExpiration as string);
        }
      }

      if (!expDate) {
        return '-';
      }

      // Calculate new date
      const newDate = new Date(expDate);
      newDate.setFullYear(newDate.getFullYear() + years);

      return newDate.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error calculating new expiration date:', error);
      return '-';
    }
  }

  formatActivationDate(activationDate: Date | string): string {
    if (!activationDate) {
      return '-';
    }

    const date = new Date(activationDate);
    if (isNaN(date.getTime())) {
      return '-';
    }

    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  openDeviceContacts(device: any): void {
    this.selectedContactsDeviceName =
      String(device?.name || device?.target_plate_number || device?.device_imei || 'GPS').trim();
    this.selectedDeviceContacts = this.parseDeviceContacts(device?.contacts);
    this.contactsDialogVisible = true;
  }

  closeDeviceContacts(): void {
    this.contactsDialogVisible = false;
    this.selectedContactsDeviceName = '';
    this.selectedDeviceContacts = [];
  }

  private parseDeviceContacts(contacts: unknown): string[] {
    if (contacts === null || contacts === undefined || contacts === '') {
      return [];
    }

    let values: unknown[] = Array.isArray(contacts) ? contacts : [contacts];

    if (typeof contacts === 'string') {
      const trimmedContacts = contacts.trim();

      if (trimmedContacts.startsWith('[')) {
        try {
          const parsedContacts = JSON.parse(trimmedContacts);
          values = Array.isArray(parsedContacts) ? parsedContacts : [parsedContacts];
        } catch {
          values = trimmedContacts.split(/[,;\n]+/);
        }
      } else {
        values = trimmedContacts.split(/[,;\n]+/);
      }
    }

    return Array.from(new Set(
      values
        .map((contact) => {
          if (contact && typeof contact === 'object') {
            const contactRecord = contact as Record<string, unknown>;
            const name = String(contactRecord['name'] || '').trim();
            const phone = String(
              contactRecord['phone'] ||
              contactRecord['phone_number'] ||
              contactRecord['number'] ||
              ''
            ).trim();

            if (name && phone) {
              return `${name}: ${phone}`;
            }

            return name || phone;
          }

          return String(contact ?? '').trim();
        })
        .filter((contact) => contact.length > 0)
    ));
  }

  isExpired(expirationDate: Date | string): boolean {
    const normalizedExpiration = this.normalizeDateOnly(expirationDate);
    if (!normalizedExpiration) {
      return false;
    }

    const today = this.normalizeDateOnly(new Date());
    if (!today) {
      return false;
    }

    return normalizedExpiration.getTime() < today.getTime();
  }

  isExpiringSoon(expirationDate: Date | string): boolean {
    const normalizedExpiration = this.normalizeDateOnly(expirationDate);
    if (!normalizedExpiration) {
      return false;
    }

    const today = this.normalizeDateOnly(new Date());
    if (!today) {
      return false;
    }

    const fifteenDaysFromNow = new Date(today);
    fifteenDaysFromNow.setDate(fifteenDaysFromNow.getDate() + 15);

    return (
      normalizedExpiration.getTime() >= today.getTime() &&
      normalizedExpiration.getTime() <= fifteenDaysFromNow.getTime()
    );
  }

  isValid(expirationDate: Date | string): boolean {
    const normalizedExpiration = this.normalizeDateOnly(expirationDate);
    if (!normalizedExpiration) {
      return false;
    }

    const today = this.normalizeDateOnly(new Date());
    if (!today) {
      return false;
    }

    const fifteenDaysFromNow = new Date(today);
    fifteenDaysFromNow.setDate(fifteenDaysFromNow.getDate() + 15);

    return normalizedExpiration.getTime() > fifteenDaysFromNow.getTime();
  }

  isDeviceOnline(device: any): boolean {
    if (device?.traccarInfo?.status === 'online') {
      return true;
    }

    if (this.isDeviceTagProtocol(device)) {
      return false;
    }

    const duration = this.getOfflineDurationInMinutes(device);
    return duration !== null && duration <= 10;
  }

  isDeviceWeakSignal(device: any): boolean {
    if (device?.traccarInfo?.status === 'Señal débil') {
      return true;
    }

    if (device?.traccarInfo?.status === 'online') {
      return false;
    }

    if (this.isDeviceTagProtocol(device)) {
      return false;
    }

    const duration = this.getOfflineDurationInMinutes(device);
    return duration !== null && duration > 10 && duration <= 60;
  }

  isDeviceLocalizado(device: any): boolean {
    return device?.traccarInfo?.status === 'Localizado';
  }

  isDeviceNoLocalizado(device: any): boolean {
    return device?.traccarInfo?.status === 'No localizado';
  }

  private shouldLimitProtocolFilterToTags(): boolean {
    return this._selectedConnectionFilter === 'localizado' || this._selectedConnectionFilter === 'no-localizado';
  }

  private isTagProtocol(protocol: any): boolean {
    const protocolName = String(protocol?.name || '').toLowerCase();
    return protocol?.isAirtag === true || protocolName.includes('tag') || protocolName.includes('airtag');
  }

  private isDeviceTagProtocol(device: any): boolean {
    const protocol = this.protocols.find(item => item._id === device?.type);
    return this.isTagProtocol(protocol);
  }

  private ensureSelectedProtocolIsAvailable(): void {
    if (!this._selectedProtocolFilter || !this.shouldLimitProtocolFilterToTags()) {
      return;
    }

    const selectedProtocol = this.protocols.find(protocol => protocol._id === this._selectedProtocolFilter);
    if (selectedProtocol && !this.isTagProtocol(selectedProtocol)) {
      this._selectedProtocolFilter = '';
    }
  }

  isDeviceInitialState(device: any): boolean {
    const lastUpdate =
      device?.traccarInfo?.lastUpdate ||
      device?.traccarInfo?.last_update ||
      device?.traccarInfo?.['lastUpdate'];

    return !lastUpdate || lastUpdate?.toString().toLowerCase() === 'never';
  }

  supportsOfflineDurationFilter(connectionFilter: string): boolean {
    return connectionFilter === 'offline' || connectionFilter === 'initial' || connectionFilter === 'initial-or-offline' || connectionFilter === 'no-localizado';
  }

  getConnectionDurationFilterLabel(): string {
    if (this.selectedConnectionFilter === 'no-localizado') {
      return 'MONITORING.FILTERS_NO_LOCALIZADO_DURATION';
    }

    if (this.selectedConnectionFilter === 'initial') {
      return 'MONITORING.FILTERS_INITIAL_DURATION';
    }

    if (this.selectedConnectionFilter === 'initial-or-offline') {
      return 'MONITORING.FILTERS_INITIAL_OR_OFFLINE_DURATION';
    }

    return 'MONITORING.FILTERS_OFFLINE_DURATION';
  }

  getConnectionDisplay(device: any): string {
    if (this.isDeviceWeakSignal(device)) {
      return 'Señal débil';
    }

    if (this.isDeviceOnline(device)) {
      return 'En línea';
    }

    if (this.isDeviceLocalizado(device)) {
      const lastUpdate = device?.traccarInfo?.lastUpdate;
      if (lastUpdate && lastUpdate.toString().toLowerCase() !== 'never') {
        return this.formatOfflineDuration(lastUpdate, true);
      }
      return 'Localizado';
    }

    if (this.isDeviceNoLocalizado(device)) {
      return 'No localizado';
    }


    const isTraccar = device?.traccarInfo;

    if (!isTraccar) {
      console.log(device,
        '[pokemon]'
      )

      return 'Error';
    }
    const lastUpdate = device?.traccarInfo?.lastUpdate;

    if (!lastUpdate || lastUpdate?.toString().toLowerCase() === 'never') {
      const referenceDate = device.createdAt || device.activation_date;
      if (referenceDate) {
        return this.formatRegistrationDuration(referenceDate);
      }
      return 'Estado inicial';
    }

    return this.formatOfflineDuration(lastUpdate);
  }

  getSimStatusClass(device: any): string {
    // Si es de la compañía "nacionales", siempre mostrar en verde
    if (device?.sim_company && device.sim_company.toLowerCase() === 'nacionales') {
      return 'sim-active';
    }
    const simStatus = device?.simStatus;
    const normalizedStatus = this.getNormalizedSimStatus(device);
    if (!simStatus?.status && normalizedStatus !== 'suspended') {
      return '';
    }
    return normalizedStatus === 'active' ? 'sim-active' : normalizedStatus === 'suspended' ? 'sim-suspended' : '';
  }

  applyFilters(): void {
    // This method is triggered by custom filter inputs to ensure change detection runs
    // The actual filtering happens in the filteredMonitoringData getter
  }

  private formatOfflineDuration(lastUpdate: string | Date, isLocalizado: boolean = false): string {
    try {
      const lastUpdateDate = new Date(lastUpdate);
      const now = new Date();
      const diffInMs = now.getTime() - lastUpdateDate.getTime();

      if (isNaN(lastUpdateDate.getTime())) {
        return 'Fuera de línea (fecha inválida)';
      }

      if (diffInMs < 0) {
        return 'Fuera de línea (fecha futura)';
      }

      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
      const diffInWeeks = Math.floor(diffInDays / 7);
      const diffInMonths = Math.floor(diffInDays / 30);
      const diffInYears = Math.floor(diffInDays / 365);

      const prefix = isLocalizado ? 'Última ubicación hace' : 'Fuera de línea hace';

      if (diffInYears > 0) {
        return `${prefix} ${diffInYears} año${diffInYears > 1 ? 's' : ''}`;
      }
      if (diffInMonths > 0) {
        return `${prefix} ${diffInMonths} mes${diffInMonths > 1 ? 'es' : ''}`;
      }
      if (diffInWeeks > 0) {
        return `${prefix} ${diffInWeeks} semana${diffInWeeks > 1 ? 's' : ''}`;
      }
      if (diffInDays > 0) {
        return `${prefix} ${diffInDays} día${diffInDays > 1 ? 's' : ''}`;
      }
      if (diffInHours > 0) {
        return `${prefix} ${diffInHours} hora${diffInHours > 1 ? 's' : ''}`;
      }
      if (diffInMinutes > 0) {
        return `${prefix} ${diffInMinutes} minuto${diffInMinutes > 1 ? 's' : ''}`;
      }

      return `${prefix} menos de 1 minuto`;
    } catch (error) {
      console.error('Error formateando tiempo offline:', error);
      return 'Fuera de línea (error al calcular)';
    }
  }

  private formatRegistrationDuration(registrationDate: string | Date): string {
    try {
      const regDate = new Date(registrationDate);
      const now = new Date();
      const diffInMs = now.getTime() - regDate.getTime();

      if (isNaN(regDate.getTime())) {
        return 'Estado inicial (fecha inválida)';
      }

      if (diffInMs < 0) {
        return 'Estado inicial (fecha futura)';
      }

      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
      const diffInWeeks = Math.floor(diffInDays / 7);
      const diffInMonths = Math.floor(diffInDays / 30);
      const diffInYears = Math.floor(diffInDays / 365);

      if (diffInYears > 0) {
        return `Estado inicial desde hace ${diffInYears} año${diffInYears > 1 ? 's' : ''}`;
      }
      if (diffInMonths > 0) {
        return `Estado inicial desde hace ${diffInMonths} mes${diffInMonths > 1 ? 'es' : ''}`;
      }
      if (diffInWeeks > 0) {
        return `Estado inicial desde hace ${diffInWeeks} semana${diffInWeeks > 1 ? 's' : ''}`;
      }
      if (diffInDays > 0) {
        return `Estado inicial desde hace ${diffInDays} día${diffInDays > 1 ? 's' : ''}`;
      }
      if (diffInHours > 0) {
        return `Estado inicial invariable desde hace ${diffInHours} hora${diffInHours > 1 ? 's' : ''}`;
      }
      if (diffInMinutes > 0) {
        return `Estado inicial desde hace ${diffInMinutes} minuto${diffInMinutes > 1 ? 's' : ''}`;
      }

      return 'Estado inicial desde hace menos de 1 minuto';
    } catch (error) {
      console.error('Error formateando tiempo de estado inicial:', error);
      return 'Estado inicial (error al calcular)';
    }
  }

  private getOfflineDurationInMinutes(device: any): number | null {
    const lastUpdate =
      device?.traccarInfo?.lastUpdate ||
      device?.traccarInfo?.last_update ||
      device?.traccarInfo?.['lastUpdate'];

    if (!lastUpdate) {
      return null;
    }

    if (lastUpdate?.toString().toLowerCase() === 'never') {
      return null;
    }

    const lastUpdateDate = new Date(lastUpdate);
    if (isNaN(lastUpdateDate.getTime())) {
      return null;
    }

    const diffInMs = Date.now() - lastUpdateDate.getTime();
    if (diffInMs < 0) {
      return 0;
    }

    return Math.floor(diffInMs / (1000 * 60));
  }

  private getInitialStateDurationInMinutes(device: any): number | null {
    const referenceDate = device.createdAt || device.activation_date;
    if (!referenceDate) {
      return null;
    }

    const parsedDate = new Date(referenceDate);
    if (isNaN(parsedDate.getTime())) {
      return null;
    }

    const diffInMs = Date.now() - parsedDate.getTime();
    if (diffInMs < 0) {
      return 0;
    }

    return Math.floor(diffInMs / (1000 * 60));
  }

  private getConnectionDurationInMinutes(device: any): number | null {
    if (this.isDeviceInitialState(device)) {
      return this.getInitialStateDurationInMinutes(device);
    }

    return this.getOfflineDurationInMinutes(device);
  }

  private matchesOfflineDuration(
    device: any,
    option: { minutes: number; comparison: 'lt' | 'gte' | 'custom' }
  ): boolean {
    const duration = this.getConnectionDurationInMinutes(device);
    if (this._selectedOfflineDurationFilter === 'no-data') {
      return duration === null;
    }

    if (duration === null) {
      return false;
    }
    if (option.comparison === 'lt') {
      return duration < option.minutes;
    }
    if (option.comparison === 'gte') {
      return duration > option.minutes;
    }
    if (option.comparison === 'custom') {
      return this.evaluateCustomOfflineDuration(duration);
    }
    return false;
  }

  private evaluateCustomOfflineDuration(durationInMinutes: number): boolean {
    if (this.customOfflineTimeValue === null || this.customOfflineTimeValue === undefined) {
      return true; // No value set, ignore filter or treat as match all
    }
    let minutesThreshold = 0;
    const [comparison, unit] = this.customOfflineTimeUnit.split('-'); // e.g. 'lt' and 'hours' from 'lt-hours'

    switch (unit) {
      case 'hours':
        minutesThreshold = this.customOfflineTimeValue * 60;
        break;
      case 'days':
        minutesThreshold = this.customOfflineTimeValue * 24 * 60;
        break;
      case 'weeks':
        minutesThreshold = this.customOfflineTimeValue * 7 * 24 * 60;
        break;
      case 'months':
        minutesThreshold = this.customOfflineTimeValue * 30 * 24 * 60; // Approx
        break;
      default:
        // Fallback if no split (legacy or default 'hours')
        if (this.customOfflineTimeUnit === 'hours') minutesThreshold = this.customOfflineTimeValue * 60;
        else if (this.customOfflineTimeUnit === 'days') minutesThreshold = this.customOfflineTimeValue * 24 * 60;
        else if (this.customOfflineTimeUnit === 'weeks') minutesThreshold = this.customOfflineTimeValue * 7 * 24 * 60;
        else if (this.customOfflineTimeUnit === 'months') minutesThreshold = this.customOfflineTimeValue * 30 * 24 * 60;
        break;
    }

    if (comparison === 'lt') {
      return durationInMinutes < minutesThreshold;
    } else if (comparison === 'eq') {
      // Exact match: between threshold and threshold + 1 unit
      let nextUnitMinutes = 0;
      switch (unit) {
        case 'hours': nextUnitMinutes = 60; break;
        case 'days': nextUnitMinutes = 24 * 60; break;
        case 'weeks': nextUnitMinutes = 7 * 24 * 60; break;
        case 'months': nextUnitMinutes = 30 * 24 * 60; break;
        default: nextUnitMinutes = 60; break;
      }
      return durationInMinutes >= minutesThreshold && durationInMinutes < (minutesThreshold + nextUnitMinutes);
    } else {
      // Default to greater than (gt) or if no comparison prefix
      return durationInMinutes > minutesThreshold;
    }
  }

  isDateInRange(date: Date | string, fromDate: Date | null, toDate: Date | null): boolean {
    if (!date || (!fromDate && !toDate)) {
      return true; // No range set, include all
    }

    const normalizedDeviceDate = this.normalizeDateOnly(date);
    if (!normalizedDeviceDate) {
      return false;
    }

    let normalizedFrom = this.normalizeDateOnly(fromDate);
    let normalizedTo = this.normalizeDateOnly(toDate);

    if (normalizedFrom && normalizedTo && normalizedFrom.getTime() > normalizedTo.getTime()) {
      const temp = normalizedFrom;
      normalizedFrom = normalizedTo;
      normalizedTo = temp;
    }

    if (normalizedFrom) {
      if (normalizedDeviceDate.getTime() < normalizedFrom.getTime()) {
        return false;
      }
    }

    if (normalizedTo) {
      if (normalizedDeviceDate.getTime() > normalizedTo.getTime()) {
        return false;
      }
    }

    return true;
  }

  formatReportDate(dateString: string): string {
    if (!dateString) {
      return '-';
    }

    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return '-';
    }

    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getTotalDevices(data: Array<{ devices: any[] }>): number {
    return data.reduce((total, userData) => total + (userData.devices?.length || 0), 0);
  }

  getTimeAgo(dateString: string): string {
    if (!dateString) {
      return '';
    }

    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return '';
    }

    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) {
      return 'hace un momento';
    } else if (diffInMinutes < 60) {
      return `hace ${diffInMinutes} minuto${diffInMinutes !== 1 ? 's' : ''}`;
    } else if (diffInHours < 24) {
      return `hace ${diffInHours} hora${diffInHours !== 1 ? 's' : ''}`;
    } else if (diffInDays < 7) {
      return `hace ${diffInDays} día${diffInDays !== 1 ? 's' : ''}`;
    } else if (diffInDays < 30) {
      const weeks = Math.floor(diffInDays / 7);
      return `hace ${weeks} semana${weeks !== 1 ? 's' : ''}`;
    } else if (diffInDays < 365) {
      const months = Math.floor(diffInDays / 30);
      return `hace ${months} mes${months !== 1 ? 'es' : ''}`;
    } else {
      const years = Math.floor(diffInDays / 365);
      return `hace ${years} año${years !== 1 ? 's' : ''}`;
    }
  }

  isReportNew(dateString: string | Date): boolean {
    if (!dateString) {
      return false;
    }

    const reportDate = new Date(dateString);
    if (isNaN(reportDate.getTime())) {
      return false;
    }

    const now = new Date();
    const diffInMs = now.getTime() - reportDate.getTime();
    const diffInMinutes = diffInMs / (1000 * 60);
    return diffInMinutes <= 5;
  }

  openReport(reportId: string): void {
    console.log('Opening report:', reportId);
    this.loading = true;
    this.error = '';

    this.monitoringService.getMonitoringReport(reportId).subscribe({
      next: (report) => {
        this.monitoringResult = report;
        if (report?.monitoringType) {
          this.monitoringType = report.monitoringType;
        } else {
          this.monitoringType = 'device-status';
        }
        this.includeMileage = this.monitoringType === 'mileage';
        if (report?.distanceRange) {
          this.mileageFrom = report.distanceRange.from;
          this.mileageTo = report.distanceRange.to;
        } else if (this.monitoringType !== 'mileage') {
          this.mileageFrom = '';
          this.mileageTo = '';
        }
        this.loading = false;
        console.log('Report loaded:', report);
        this.isDataStale = this.shouldWarnAboutDataFreshness();
      },
      error: (error) => {
        this.error = 'Error loading report: ' + error.message;
        this.loading = false;
        console.error('Error loading report:', error);
      }
    });
  }

  backToReports(): void {
    this.monitoringResult = null;
    this.error = '';
    console.log('Back to reports list');
  }

  cancelMonitoringStatus(): void {
    const requestId = this.reportGenerationStatus?.requestId || this.currentStatusRequestId;
    if (this.cancellingStatus || !requestId) {
      return;
    }

    this.cancellingStatus = true;
    this.clearMonitoringStatus({
      requestId,
      refreshSummaries: true,
      stopPolling: false
    });
  }

  trackByUser(index: number, userData: any): any {
    // Use the first route item's id as unique identifier, fallback to index
    return userData.route && userData.route.length > 0 ? userData.route[0].id : index;
  }

  trackByDevice(index: number, device: any): string | number {
    return device?._id || device?.device_imei || index;
  }

  hasNoAssistance(userData: { route?: Array<{ no_assistance?: boolean }> }): boolean {
    if (!this.isCurrentUserEmployee()) {
      return false;
    }

    const route = userData?.route;
    return Array.isArray(route) && route.length > 0 && route[route.length - 1]?.no_assistance === true;
  }

  async exportToExcel(): Promise<void> {
    if (!this.monitoringResult?.data) {
      return;
    }

    const includeMileage = this.monitoringType === 'mileage';
    const includeRenewalDate = this.selectedExpirationFilter === 'expired' && this.includeRenewed;
    const includeSimCardColumn = !this.isCurrentUserClient();

    // Create a new workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Monitoreo');

    // Set column widths
    const cols = [
      { key: 'col1', width: 5 }, // Empty column for spacing
      { key: 'col2', width: 25 },
      { key: 'col3', width: 15 }, // Placa
      { key: 'col4', width: 20 }, // IMEI
      { key: 'col5', width: 15 }, // Protocolo
      { key: 'col6', width: 12 }, // Estado
      { key: 'col7', width: 15 }, // Conexión
      { key: 'col8', width: 15 }, // Fecha Instalación
      { key: 'col9', width: 15 } // Fecha Expiración
    ];

    let currentColCount = 9;
    if (includeSimCardColumn) {
      currentColCount++;
      cols.push({ key: `col${currentColCount}`, width: 15 }); // Número SIM
    }

    let mileageKilometersColKey: string | null = null;
    let mileageRangeColKey: string | null = null;
    let renewalColKey: string | null = null;

    if (includeMileage) {
      currentColCount++;
      mileageKilometersColKey = `col${currentColCount}`;
      cols.push({ key: mileageKilometersColKey, width: 15 });
      currentColCount++;
      mileageRangeColKey = `col${currentColCount}`;
      cols.push({ key: mileageRangeColKey, width: 24 });
    }

    if (includeRenewalDate) {
      currentColCount++;
      renewalColKey = `col${currentColCount}`;
      cols.push({ key: renewalColKey, width: 20 });
    }

    worksheet.columns = cols;

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lastColumnLetter = alphabet[currentColCount]; // e.g. 10 -> 'K', 11 -> 'L', 12 -> 'M' (because array is 0-indexed, so index 10 is the 11th letter 'K'. Wait, 0 is 'A', 1 is 'B'. If currentColCount is 10, alphabet[10] is 'K'. But Excel cols are 1-indexed. Wait, let's fix this.)
    // If currentColCount = 10 (J), then we want alphabet[9] -> 'J'
    // Let's do:
    const excelLastColumnLetter = alphabet[currentColCount - 1];
    const lastColIndex = currentColCount;

    let currentRow = 1; // Start from row 1

    // Add summary header for current filters
    const summary = this.monitoringSummaryStats;
    if (summary.totalUsers > 0 || summary.totalDevices > 0) {
      const summaryTitle = worksheet.addRow({
        col1: '',
        col2: 'Resumen del monitoreo (según filtros aplicados)'
      });
      summaryTitle.getCell(2).font = {
        bold: true,
        color: { argb: 'FF1F2937' },
        size: 14
      };
      currentRow = summaryTitle.number + 1;

      const summaryRows = [
        { label: 'Usuarios encontrados', value: summary.totalUsers },
        { label: 'Dispositivos encontrados', value: summary.totalDevices },
        { label: 'Dispositivos activos', value: summary.activeDevices },
        { label: 'Vigentes en línea', value: summary.activeValidOnlineDevices },
        { label: 'Vigentes fuera de línea', value: summary.activeValidOfflineDevices },
        { label: 'Dispositivos expirados', value: summary.totalExpiredDevices }
      ];

      summaryRows.forEach(item => {
        const row = worksheet.addRow({
          col1: '',
          col2: item.label,
          col3: item.value
        });

        row.getCell(2).font = {
          bold: true,
          color: { argb: 'FF374151' }
        };
        row.getCell(3).font = {
          color: { argb: 'FF111827' }
        };
        row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
        row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
        currentRow = row.number + 1;
      });

      const spacerRow = worksheet.addRow({});
      currentRow = spacerRow.number + 1;
    }

    // Process each user
    this.filteredMonitoringData.forEach((userData, userIndex) => {
      const hasNoAssistance = this.hasNoAssistance(userData);
      // Add user route as title
      const userHierarchy = userData.route && userData.route.length > 0
        ? userData.route.map(item => item.fullName).join(' > ')
        : 'Sin jerarquía';

      const userName = userData.route && userData.route.length > 0
        ? userData.route[userData.route.length - 1].fullName
        : 'Sin nombre';

      // Add user title row
      const titleRowData: any = {
        col1: '',
        col2: `Usuario: ${userName}`,
        col3: '', col4: '', col5: '', col6: '', col7: '', col8: '', col9: ''
      };
      if (includeSimCardColumn) titleRowData.col10 = '';
      if (mileageKilometersColKey) titleRowData[mileageKilometersColKey] = '';
      if (mileageRangeColKey) titleRowData[mileageRangeColKey] = '';
      if (renewalColKey) titleRowData[renewalColKey] = '';

      const titleRow = worksheet.addRow(titleRowData);

      // Style user title
      titleRow.getCell(2).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF007BFF' } // Blue background
      };
      titleRow.getCell(2).font = {
        bold: true,
        color: { argb: 'FFFFFFFF' }, // White text
        size: 14
      };
      titleRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };

      if (hasNoAssistance) {
        titleRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4B5563' } };
      }

      // Merge cells for title
      worksheet.mergeCells(`B${currentRow}:${excelLastColumnLetter}${currentRow}`);
      currentRow++;

      // Add hierarchy info
      const hierarchyRowData: any = {
        col1: '',
        col2: `Jerarquía: ${userHierarchy}`,
        col3: '', col4: '', col5: '', col6: '', col7: '', col8: '', col9: ''
      };
      if (includeSimCardColumn) hierarchyRowData.col10 = '';
      if (mileageKilometersColKey) hierarchyRowData[mileageKilometersColKey] = '';
      if (mileageRangeColKey) hierarchyRowData[mileageRangeColKey] = '';
      if (renewalColKey) hierarchyRowData[renewalColKey] = '';
      const hierarchyRow = worksheet.addRow(hierarchyRowData);

      hierarchyRow.getCell(2).font = {
        italic: true,
        color: { argb: 'FF666666' },
        size: 11
      };
      worksheet.mergeCells(`B${currentRow}:${excelLastColumnLetter}${currentRow}`);
      currentRow++;

      // Add device count
      const deviceCountRowData: any = {
        col1: '',
        col2: `Total de dispositivos: ${userData.devices.length}`,
        col3: '', col4: '', col5: '', col6: '', col7: '', col8: '', col9: ''
      };
      if (includeSimCardColumn) deviceCountRowData.col10 = '';
      if (mileageKilometersColKey) deviceCountRowData[mileageKilometersColKey] = '';
      if (mileageRangeColKey) deviceCountRowData[mileageRangeColKey] = '';
      if (renewalColKey) deviceCountRowData[renewalColKey] = '';
      const deviceCountRow = worksheet.addRow(deviceCountRowData);

      deviceCountRow.getCell(2).font = {
        bold: true,
        color: { argb: 'FF333333' },
        size: 11
      };
      worksheet.mergeCells(`B${currentRow}:${excelLastColumnLetter}${currentRow}`);
      currentRow++;

      // Add empty row for spacing
      const spacerRowData: any = { col1: '', col2: '', col3: '', col4: '', col5: '', col6: '', col7: '', col8: '', col9: '' };
      if (includeSimCardColumn) spacerRowData.col10 = '';
      if (mileageKilometersColKey) spacerRowData[mileageKilometersColKey] = '';
      if (mileageRangeColKey) spacerRowData[mileageRangeColKey] = '';
      if (renewalColKey) spacerRowData[renewalColKey] = '';
      worksheet.addRow(spacerRowData);
      currentRow++;

      // Add device table headers
      const headerRowData: any = {
        col1: '',
        col2: 'Nombre Dispositivo',
        col3: 'Placa',
        col4: 'IMEI',
        col5: 'Protocolo',
        col6: 'Estado',
        col7: 'Conexión',
        col8: 'Fecha Instalación',
        col9: 'Fecha Expiración'
      };
      if (includeSimCardColumn) headerRowData.col10 = 'Número SIM';
      if (mileageKilometersColKey) headerRowData[mileageKilometersColKey] = 'Kilómetros';
      if (mileageRangeColKey) headerRowData[mileageRangeColKey] = 'Rango de kilometraje';
      if (renewalColKey) headerRowData[renewalColKey] = 'Fecha Renovación';

      const headerRow = worksheet.addRow(headerRowData);

      // Style header row
      headerRow.eachCell((cell, colNumber) => {
        if (colNumber > 1 && colNumber <= lastColIndex) { // Skip first column (empty)
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF007BFF' } // Blue background
          };
          cell.font = {
            bold: true,
            color: { argb: 'FFFFFFFF' }, // White text
            size: 11
          };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
          };
        }
      });

      if (hasNoAssistance) {
        headerRow.eachCell((cell, colNumber) => {
          if (colNumber > 1 && colNumber <= lastColIndex) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6B7280' } };
          }
        });
      }
      currentRow++;

      // Add device data rows
      userData.devices.forEach((device, deviceIndex) => {
        const dataRowData: any = {
          col1: '',
          col2: device.name || '',
          col3: device.target_plate_number || '',
          col4: device.device_imei || '',
          col5: this.getProtocolName(device.type) || '',
          col6: device.status ? 'Activo' : 'Inactivo',
          col7: this.getConnectionDisplay(device),
          col8: this.formatActivationDate(device.activation_date) || '',
          col9: this.formatExpirationDate(device.expiration_date) || '',
        };
        if (includeSimCardColumn) dataRowData.col10 = device.sim_card_number || '';

        if (mileageKilometersColKey) {
          dataRowData[mileageKilometersColKey] = this.getDeviceKilometers(device);
        }

        if (mileageRangeColKey) {
          dataRowData[mileageRangeColKey] = this.formatDistanceRange(device) || '-';
        }
        
        if (renewalColKey) {
          const renDate = this._renewedDeviceIds.get(device._id);
          dataRowData[renewalColKey] = renDate ? this.formatExpirationDate(renDate) : '-';
        }

        const dataRow = worksheet.addRow(dataRowData);

        // Style data row
        dataRow.eachCell((cell, colNumber) => {
          if (colNumber > 1 && colNumber <= lastColIndex) { // Skip first column (empty)
            const isEvenRow = deviceIndex % 2 === 0;
            const backgroundColor = isEvenRow ? 'FFF8F9FA' : 'FFFFFFFF';

            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: backgroundColor }
            };
            cell.font = {
              color: { argb: 'FF000000' },
              size: 10
            };
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFDEDEDE' } },
              bottom: { style: 'thin', color: { argb: 'FFDEDEDE' } },
              left: { style: 'thin', color: { argb: 'FFDEDEDE' } },
              right: { style: 'thin', color: { argb: 'FFDEDEDE' } }
            };
          }
        });

        // Special styling for status column (column F - Estado)
        const statusCell = dataRow.getCell(6);
        if (device.status) {
          statusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD4EDDA' } // Light green for active
          };
          statusCell.font = {
            color: { argb: 'FF155724' }, // Dark green text
            size: 10,
            bold: true
          };
        } else {
          statusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8D7DA' } // Light red for inactive
          };
          statusCell.font = {
            color: { argb: 'FF721C24' }, // Dark red text
            size: 10,
            bold: true
          };
        }

        // Special styling for connection column (column G - Conexión)
        const connectionCell = dataRow.getCell(7);
        if (this.isDeviceOnline(device)) {
          connectionCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD4EDDA' } // Light green for online
          };
          connectionCell.font = {
            color: { argb: 'FF155724' }, // Dark green text
            size: 10,
            bold: true
          };
        } else {
          connectionCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8D7DA' } // Light red for offline
          };
          connectionCell.font = {
            color: { argb: 'FF721C24' }, // Dark red text
            size: 10,
            bold: true
          };
        }

        // Special styling for expiration column (column I - Fecha Expiración)
        const expirationCell = dataRow.getCell(9);
        if (device.expiration_date) {
          if (this.isExpired(device.expiration_date)) {
            expirationCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF8D7DA' } // Light red for expired
            };
            expirationCell.font = {
              color: { argb: 'FF721C24' }, // Dark red text
              size: 10,
              bold: true
            };
          } else if (this.isExpiringSoon(device.expiration_date)) {
            expirationCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFF3CD' } // Light yellow for expiring soon
            };
            expirationCell.font = {
              color: { argb: 'FF856404' }, // Dark yellow text
              size: 10,
              bold: true
            };
          } else {
            expirationCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFD4EDDA' } // Light green for valid
            };
            expirationCell.font = {
              color: { argb: 'FF155724' }, // Dark green text
              size: 10,
              bold: true
            };
          }
        }

        if (hasNoAssistance) {
          dataRow.eachCell((cell, colNumber) => {
            if (colNumber > 1 && colNumber <= lastColIndex) {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: deviceIndex % 2 === 0 ? 'FFF3F4F6' : 'FFE5E7EB' }
              };
              cell.font = { color: { argb: 'FF374151' }, size: 10, bold: colNumber === 6 || colNumber === 7 || colNumber === 9 };
            }
          });
        }

        currentRow++;
      });

      // Add spacing between users (except for the last user)
      if (userIndex < this.filteredMonitoringData.length - 1) {
        worksheet.addRow({
          col1: '',
          col2: '',
          col3: '',
          col4: '',
          col5: '',
          col6: '',
          col7: '',
          col8: ''
        });
        worksheet.addRow({
          col1: '',
          col2: '',
          col3: '',
          col4: '',
          col5: '',
          col6: '',
          col7: '',
          col8: ''
        });
        currentRow += 2;
      }
    });

    // Generate filename with current date
    const now = new Date();
    const filename = `monitoreo_${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}.xlsx`;

    // Save file
    try {
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
    }
  }

  private isCurrentUserClient(): boolean {
    const currentUser = this.authService.getCurrentUser() as any;
    const affiliationType = String(
      currentUser?.affiliation_type_id ||
      currentUser?.affiliation_type ||
      ''
    ).trim().toLowerCase();

    return affiliationType === 'cliente';
  }

  private isCurrentUserEmployee(): boolean {
    const currentUser = this.authService.getCurrentUser() as any;
    return String(
      currentUser?.affiliation_type_id || currentUser?.affiliation_type || ''
    ).trim().toLowerCase() === 'empleado';
  }

}
