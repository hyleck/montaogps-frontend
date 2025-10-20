import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MonitoringService, MonitorUserResponse, MonitoringStatus, MonitoringSummary } from '../../../../../../core/services/monitoring.service';
import { UserService } from '../../../../../../core/services/user.service';
import { ProtocolsService } from '../../../../../../core/services/protocols.service';
import { User } from '../../../../../../core/interfaces/user.interface';
import { TranslateService } from '@ngx-translate/core';
import * as ExcelJS from 'exceljs';
import { interval, Subscription } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-monitoring',
  templateUrl: './monitoring.component.html',
  styleUrls: ['./monitoring.component.css'],
  standalone: false
})
export class MonitoringComponent implements OnInit, OnDestroy {
  userEmail: string = '';
  userId: string = '';
  monitoringResult: MonitorUserResponse | null = null;
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

  offlineDurationOptions: Array<{ label: string; value: string; minutes: number; comparison: 'lt' | 'gte' }> = [
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
    { label: 'MONITORING.FILTERS_OFFLINE_DURATION_GT_1W', value: 'gt-1w', minutes: 7 * 24 * 60, comparison: 'gte' }
  ];

  accountSizeThresholds: number[] = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];

  private _selectedStatusFilter: string = '';
  private _selectedConnectionFilter: string = '';
  private _selectedOfflineDurationFilter: string = '';
  private _selectedExpirationFilter: string = '';
  private _selectedAffiliationFilter: string = '';
  private _selectedProfileFilter: string = '';
  private _selectedAccountSizeFilter: number | null = null;
  private _expirationFromDate: Date | null = null;
  private _expirationToDate: Date | null = null;

  private statusPollingSubscription: Subscription | null = null;
  private readonly statusPollingIntervalMs = 10000;
  private currentStatusRequestId: string | null = null;
  private monitoringRequestStartTimestamp: number | null = null;
  cancellingStatus: boolean = false;



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
      if (value !== 'offline') {
        this._selectedOfflineDurationFilter = '';
      }
    }
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
    }
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
    this._expirationFromDate = value ? new Date(value) : null;
  }

  get expirationToDate(): string {
    return this._expirationToDate ? this.formatDateForInput(this._expirationToDate) : '';
  }

  set expirationToDate(value: string) {
    this._expirationToDate = value ? new Date(value) : null;
  }

  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

    this.monitoringService.monitorUser(this.userId).subscribe({
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

    this.monitoringService.monitorUser(this.userId).subscribe({
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
          totalExpiredDevices: summary.totalExpiredDevices ?? 0
        }));
        this.monitoringSummaries = summaries;
        this.latestSummary = summaries.length > 0 ? summaries[0] : null;
        this.userMonitoringReports = summaries;
        this.selectedUserReports = summaries;
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
    this.selectedAccountSizeFilter = null;
    this.stopStatusPolling();
  }

  private loadProtocols(): void {
    this.protocolsService.getAllProtocols().subscribe({
      next: (protocols: any[]) => {
        this.protocols = protocols;
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

  // Getter to filter out users without devices and apply status/expiration filters
  get filteredMonitoringData() {
    if (!this.monitoringResult?.data) {
      return [];
    }

    return this.monitoringResult.data
      .map(userData => {
        // Filter devices based on selected filters
        let filteredDevices = userData.devices;

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
            case 'offline':
              filteredDevices = filteredDevices.filter(device => !this.isDeviceOnline(device));
              break;
          }
        }

        if (this._selectedConnectionFilter === 'offline' && this._selectedOfflineDurationFilter) {
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
                if (!expirationDate) {
                  return false;
                }
                if (hasDateRange) {
                  return this.isDateInRange(expirationDate, this._expirationFromDate, this._expirationToDate);
                }
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
                  return !this.isDateInRange(expirationDate, this._expirationFromDate, this._expirationToDate);
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
  }

  get monitoringSummaryStats() {
    const data = this.filteredMonitoringData;
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

    return {
      totalUsers,
      totalDevices,
      activeDevices,
      activeValidOnlineDevices,
      activeValidOfflineDevices,
      totalExpiredDevices
    };
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

  isExpired(expirationDate: Date | string): boolean {
    if (!expirationDate) {
      return false;
    }

    const date = new Date(expirationDate);
    if (isNaN(date.getTime())) {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    return date < today;
  }

  isExpiringSoon(expirationDate: Date | string): boolean {
    if (!expirationDate) {
      return false;
    }

    const date = new Date(expirationDate);
    if (isNaN(date.getTime())) {
      return false;
    }

    const today = new Date();
    const fifteenDaysFromNow = new Date();
    fifteenDaysFromNow.setDate(today.getDate() + 15);

    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    fifteenDaysFromNow.setHours(0, 0, 0, 0);

    return date >= today && date <= fifteenDaysFromNow;
  }

  isValid(expirationDate: Date | string): boolean {
    if (!expirationDate) {
      return false;
    }

    const date = new Date(expirationDate);
    if (isNaN(date.getTime())) {
      return false;
    }

    const today = new Date();
    const fifteenDaysFromNow = new Date();
    fifteenDaysFromNow.setDate(today.getDate() + 15);

    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    fifteenDaysFromNow.setHours(0, 0, 0, 0);

    return date > fifteenDaysFromNow;
  }

  isDeviceOnline(device: any): boolean {
    return device?.traccarInfo?.status === 'online';
  }

  getConnectionDisplay(device: any): string {
    if (this.isDeviceOnline(device)) {
      return 'En línea';
    }

    const lastUpdate =
      device?.traccarInfo?.lastUpdate ||
      device?.traccarInfo?.last_update ||
      device?.traccarInfo?.['lastUpdate'];

    if (!lastUpdate) {
      return 'Fuera de línea (estado inicial)';
    }

    return this.formatOfflineDuration(lastUpdate);
  }

  private formatOfflineDuration(lastUpdate: string | Date): string {
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

      if (diffInYears > 0) {
        return `Fuera de línea hace ${diffInYears} año${diffInYears > 1 ? 's' : ''}`;
      }
      if (diffInMonths > 0) {
        return `Fuera de línea hace ${diffInMonths} mes${diffInMonths > 1 ? 'es' : ''}`;
      }
      if (diffInWeeks > 0) {
        return `Fuera de línea hace ${diffInWeeks} semana${diffInWeeks > 1 ? 's' : ''}`;
      }
      if (diffInDays > 0) {
        return `Fuera de línea hace ${diffInDays} día${diffInDays > 1 ? 's' : ''}`;
      }
      if (diffInHours > 0) {
        return `Fuera de línea hace ${diffInHours} hora${diffInHours > 1 ? 's' : ''}`;
      }
      if (diffInMinutes > 0) {
        return `Fuera de línea hace ${diffInMinutes} minuto${diffInMinutes > 1 ? 's' : ''}`;
      }

      return 'Fuera de línea hace menos de 1 minuto';
    } catch (error) {
      console.error('Error formateando tiempo offline:', error);
      return 'Fuera de línea (error al calcular)';
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

  private matchesOfflineDuration(
    device: any,
    option: { minutes: number; comparison: 'lt' | 'gte' }
  ): boolean {
    const duration = this.getOfflineDurationInMinutes(device);
    if (this._selectedOfflineDurationFilter === 'no-data') {
      return duration === null;
    }

    if (duration === null) {
      return false;
    }
    if (option.comparison === 'lt') {
      return duration < option.minutes;
    }
    return duration > option.minutes;
  }

  isDateInRange(date: Date | string, fromDate: Date | null, toDate: Date | null): boolean {
    if (!date || (!fromDate && !toDate)) {
      return true; // No range set, include all
    }

    const deviceDate = new Date(date);
    if (isNaN(deviceDate.getTime())) {
      return false;
    }

    const normalizedDeviceDate = new Date(deviceDate);
    normalizedDeviceDate.setHours(0, 0, 0, 0);

    let normalizedFrom = fromDate ? new Date(fromDate) : null;
    let normalizedTo = toDate ? new Date(toDate) : null;

    if (normalizedFrom) {
      normalizedFrom.setHours(0, 0, 0, 0);
    }

    if (normalizedTo) {
      normalizedTo.setHours(23, 59, 59, 999);
    }

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
        this.loading = false;
        console.log('Report loaded:', report);
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

  async exportToExcel(): Promise<void> {
    if (!this.monitoringResult?.data) {
      return;
    }

    // Create a new workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Monitoreo');

    // Set column widths
    worksheet.columns = [
      { key: 'col1', width: 5 }, // Empty column for spacing
      { key: 'col2', width: 25 },
      { key: 'col3', width: 20 },
      { key: 'col4', width: 15 },
      { key: 'col5', width: 12 },
      { key: 'col6', width: 15 },
      { key: 'col7', width: 15 },
      { key: 'col8', width: 15 }
    ];

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
      // Add user route as title
      const userHierarchy = userData.route && userData.route.length > 0
        ? userData.route.map(item => item.fullName).join(' > ')
        : 'Sin jerarquía';

      const userName = userData.route && userData.route.length > 0
        ? userData.route[userData.route.length - 1].fullName
        : 'Sin nombre';

      // Add user title row
      const titleRow = worksheet.addRow({
        col1: '',
        col2: `Usuario: ${userName}`,
        col3: '',
        col4: '',
        col5: '',
        col6: '',
        col7: '',
        col8: ''
      });

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

      // Merge cells for title
      worksheet.mergeCells(`B${currentRow}:H${currentRow}`);
      currentRow++;

      // Add hierarchy info
      const hierarchyRow = worksheet.addRow({
        col1: '',
        col2: `Jerarquía: ${userHierarchy}`,
        col3: '',
        col4: '',
        col5: '',
        col6: '',
        col7: '',
        col8: ''
      });

      hierarchyRow.getCell(2).font = {
        italic: true,
        color: { argb: 'FF666666' },
        size: 11
      };
      worksheet.mergeCells(`B${currentRow}:H${currentRow}`);
      currentRow++;

      // Add device count
      const deviceCountRow = worksheet.addRow({
        col1: '',
        col2: `Total de dispositivos: ${userData.devices.length}`,
        col3: '',
        col4: '',
        col5: '',
        col6: '',
        col7: '',
        col8: ''
      });

      deviceCountRow.getCell(2).font = {
        bold: true,
        color: { argb: 'FF333333' },
        size: 11
      };
      worksheet.mergeCells(`B${currentRow}:H${currentRow}`);
      currentRow++;

      // Add empty row for spacing
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
      currentRow++;

      // Add device table headers
      const headerRow = worksheet.addRow({
        col1: '',
        col2: 'Nombre Dispositivo',
        col3: 'IMEI',
        col4: 'Protocolo',
        col5: 'Estado',
        col6: 'Conexión',
        col7: 'Fecha Expiración',
        col8: 'Número SIM'
      });

      // Style header row
      headerRow.eachCell((cell, colNumber) => {
        if (colNumber > 1) { // Skip first column (empty)
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
      currentRow++;

      // Add device data rows
      userData.devices.forEach((device, deviceIndex) => {
        const dataRow = worksheet.addRow({
          col1: '',
          col2: device.name || '',
          col3: device.device_imei || '',
          col4: this.getProtocolName(device.type) || '',
          col5: device.status ? 'Activo' : 'Inactivo',
          col6: this.getConnectionDisplay(device),
          col7: this.formatExpirationDate(device.expiration_date) || '',
          col8: device.sim_card_number || ''
        });

        // Style data row
        dataRow.eachCell((cell, colNumber) => {
          if (colNumber > 1) { // Skip first column (empty)
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

        // Special styling for status column (column E - Estado)
        const statusCell = dataRow.getCell(5);
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

        // Special styling for connection column (column F - Conexión)
        const connectionCell = dataRow.getCell(6);
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

        // Special styling for expiration column (column G - Fecha Expiración)
        const expirationCell = dataRow.getCell(7);
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
    const filename = `monitoreo_${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}.xlsx`;

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

}
