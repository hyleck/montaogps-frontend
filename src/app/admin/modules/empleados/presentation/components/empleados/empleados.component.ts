import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Replayer } from '@rrweb/replay';
import { firstValueFrom } from 'rxjs';
import { UserService } from '../../../../../../core/services/user.service';
import { MessageService } from 'primeng/api';
import { User } from '../../../../../../core/interfaces';
import { ProcessService } from '../../../../../../core/services/process.service';
import { PROCESS_TYPE_LABELS } from '../../../../processes/presentation/services/processes.service';
import { getApiErrorMessage } from '../../../../../../core/utils/api-error.util';
import {
  EmployeeMonitoringService,
  EmployeeMonitoringStatus,
  EmployeeReplayChunkResponse,
  EmployeeReplaySession,
} from '../../../../../../core/services/employee-monitoring.service';
import {
  UserActivity,
  UserActivityService,
} from '../../../../../../core/services/user-activity.service';
import {
  UserConsoleLevel,
  UserConsoleLog,
  UserConsoleLogService,
} from '../../../../../../core/services/user-console-log.service';
import {
  getEmployeeActivityDetail,
  getEmployeeActivityTitle,
  groupConsecutiveEmployeeActivities,
  GroupedEmployeeActivity,
} from './employee-activity-display';

@Component({
  selector: 'app-empleados',
  templateUrl: './empleados.component.html',
  styleUrls: ['./empleados.component.css'],
  providers: [MessageService],
  standalone: false
})
export class EmpleadosComponent implements OnInit, OnDestroy {

  @ViewChild('replayHost') replayHost?: ElementRef<HTMLDivElement>;
  @ViewChild('replayStage') replayStage?: ElementRef<HTMLElement>;

  empleados: User[] = [];
  loading: boolean = true;
  searchTerm: string = '';
  employeePageFirst = 0;
  employeePageRows = 12;
  selectedEmpleado: User | null = null;
  displayModal: boolean = false;
  employeeStats: Map<string, any> = new Map();
  processTypeLabels = PROCESS_TYPE_LABELS;
  maxProcesses: number = 0;
  
  chartData: any;
  chartOptions: any;
  
  editingDepartment: boolean = false;
  tempDepartmentId: string = '';
  savingDepartment: boolean = false;

  monitoringStatuses = new Map<string, EmployeeMonitoringStatus>();
  monitoringLoading = false;
  displayReplaySessionPicker = false;
  replaySessionPickerLoading = false;
  replaySessionPickerError = '';
  displayReplay = false;
  replayMode: 'live' | 'last_hour' = 'last_hour';
  replayEmployee: User | null = null;
  replaySessions: EmployeeReplaySession[] = [];
  selectedReplaySessionId = '';
  replayLoading = false;
  replayError = '';
  replayActivities: GroupedEmployeeActivity[] = [];
  private allReplayActivities: UserActivity[] = [];
  replaySidebarTab: 'activity' | 'console' = 'activity';
  replayConsoleFilter: UserConsoleLevel | 'all' = 'all';
  replayConsoleLogs: UserConsoleLog[] = [];
  private allReplayConsoleLogs: UserConsoleLog[] = [];
  replayRangeStart = '';
  replayRangeEnd = '';
  replayPlaying = false;
  replaySpeed = 1;
  replaySkipInactive = true;

  private monitoringPoll?: ReturnType<typeof setInterval>;
  private liveReplayPoll?: ReturnType<typeof setInterval>;
  private observabilityPoll?: ReturnType<typeof setInterval>;
  private observabilityPollBusy = false;
  replayer?: Replayer;
  private replayCursor: string | null = null;
  private replayPollBusy = false;
  private replayResizeObserver?: ResizeObserver;
  private replayFitFrame?: number;
  private replayStartedAt = 0;
  private replayRangePlaybackOffset = 0;

  departments: any[] = [
    { label: 'Administrativo', value: 'Administrativo' },
    { label: 'Cobros', value: 'Cobros' },
    { label: 'Gerencia', value: 'Gerencia' },
    { label: 'Operaciones', value: 'Operaciones' },
    { label: 'Recursos Humanos', value: 'RRHH' },
    { label: 'Soporte Técnico', value: 'Soporte' },
    { label: 'Técnicos (Instaladores)', value: 'Instaladores' },
    { label: 'Ventas', value: 'Ventas' }
  ];

  constructor(
    private userService: UserService,
    private messageService: MessageService,
    private processService: ProcessService,
    private employeeMonitoring: EmployeeMonitoringService,
    private userActivityService: UserActivityService,
    private userConsoleLogService: UserConsoleLogService,
  ) { }

  ngOnInit(): void {
    this.loadEmpleados();
    this.loadStats();
    this.loadMonitoringOverview();
    this.monitoringPoll = setInterval(
      () => this.loadMonitoringOverview(false),
      8_000,
    );
    
    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue('--text-color') || '#495057';
    const textColorSecondary = documentStyle.getPropertyValue('--text-color-secondary') || '#6c757d';
    const surfaceBorder = documentStyle.getPropertyValue('--surface-border') || '#dfe7ef';

    this.chartOptions = {
        plugins: {
            legend: {
                display: false
            }
        },
        scales: {
            x: {
                ticks: {
                    color: textColorSecondary
                },
                grid: {
                    color: surfaceBorder,
                    drawBorder: false
                }
            },
            y: {
                beginAtZero: true,
                ticks: {
                    color: textColorSecondary,
                    stepSize: 1
                },
                grid: {
                    color: surfaceBorder,
                    drawBorder: false
                }
            }
        }
    };
  }

  ngOnDestroy(): void {
    if (this.monitoringPoll) clearInterval(this.monitoringPoll);
    this.destroyReplay();
  }

  loadStats(): void {
    this.processService.getStatsByCreator().subscribe({
      next: (res: any) => {
        if (res && res.statsByCreator) {
          let currentMax = 0;
          res.statsByCreator.forEach((stat: any) => {
            if (stat._id) {
              this.employeeStats.set(stat._id.toString(), stat);
              if (stat.totalProcesses > currentMax) {
                  currentMax = stat.totalProcesses;
              }
            }
          });
          this.maxProcesses = currentMax;
        }
      },
      error: (err) => {
        console.error('Error loading process stats', err);
      }
    });
  }

  loadEmpleados(): void {
    this.loading = true;
    this.userService.getEmployees().subscribe({
      next: (data) => {
        this.empleados = data.filter((employee) => employee.status !== false);
        this.employeePageFirst = 0;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar empleados:', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: getApiErrorMessage(err, 'No se pudieron cargar los empleados') });
        this.loading = false;
      }
    });
  }

  loadMonitoringOverview(showLoader = true): void {
    if (showLoader) this.monitoringLoading = true;
    this.employeeMonitoring.getOverview().subscribe({
      next: (statuses) => {
        this.monitoringStatuses = new Map(
          statuses.map((status) => [status.user_id, status]),
        );
        this.monitoringLoading = false;
      },
      error: (err) => {
        console.error('Error loading employee monitoring overview', err);
        this.monitoringLoading = false;
      },
    });
  }

  get filteredEmpleados(): User[] {
    let result = this.empleados;
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(e => 
        (e.name && e.name.toLowerCase().includes(term)) ||
        (e.last_name && e.last_name.toLowerCase().includes(term)) ||
        (e.email && e.email.toLowerCase().includes(term)) ||
        (e.phone && e.phone.toString().includes(term))
      );
    }

    return [...result].sort((a, b) => {
      const perfA = this.getEmployeeProcessCount(a._id);
      const perfB = this.getEmployeeProcessCount(b._id);
      return perfB - perfA;
    });
  }

  get paginatedEmpleados(): User[] {
    return this.filteredEmpleados.slice(
      this.employeePageFirst,
      this.employeePageFirst + this.employeePageRows,
    );
  }

  onEmployeeSearchChange(): void {
    this.employeePageFirst = 0;
  }

  onEmployeePageChange(event: { first?: number; rows?: number }): void {
    this.employeePageFirst = event.first || 0;
    this.employeePageRows = event.rows || 12;
  }

  get onlineEmployees(): number {
    return this.empleados.filter((employee) => this.isEmployeeOnline(employee)).length;
  }

  get employeesWithRecentActivity(): number {
    return this.empleados.filter(
      (employee) => (this.getMonitoringStatus(employee)?.events_last_hour || 0) > 0,
    ).length;
  }

  getMonitoringStatus(employee: User): EmployeeMonitoringStatus | undefined {
    return this.monitoringStatuses.get(employee._id);
  }

  isEmployeeOnline(employee: User): boolean {
    return this.getMonitoringStatus(employee)?.online === true;
  }

  getCurrentScreen(employee: User): string {
    const status = this.getMonitoringStatus(employee);
    if (!status) return 'Sin actividad registrada';
    return status.current_page_title || this.humanizeRoute(status.current_route) || 'Navegando';
  }

  getMonitoringPlatformLabel(employee: User): string {
    return this.getMonitoringStatus(employee)?.platform === 'mobile'
      ? 'Teléfono'
      : 'Computadora';
  }

  getMonitoringPlatformIcon(employee: User): string {
    return this.getMonitoringStatus(employee)?.platform === 'mobile'
      ? 'pi-mobile'
      : 'pi-desktop';
  }

  getReplayPlatform(): 'mobile' | 'desktop' {
    const selectedSession = this.replaySessions.find(
      (session) => session.session_id === this.selectedReplaySessionId,
    );
    return selectedSession?.platform ||
      (this.replayEmployee
        ? this.getMonitoringStatus(this.replayEmployee)?.platform
        : null) ||
      'desktop';
  }

  getLastSeenLabel(employee: User): string {
    const value = this.getMonitoringStatus(employee)?.last_seen;
    if (!value) return 'Nunca';
    const diffSeconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1_000));
    if (diffSeconds < 30) return 'Ahora mismo';
    if (diffSeconds < 60) return `Hace ${diffSeconds} s`;
    const minutes = Math.floor(diffSeconds / 60);
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours} h`;
    return new Date(value).toLocaleString('es-DO');
  }

  async openLiveReplay(employee: User, event?: Event): Promise<void> {
    event?.stopPropagation();
    const status = this.getMonitoringStatus(employee);
    if (!status?.online || !status.current_session_id) return;
    await this.openReplay(employee, 'live', status.current_session_id);
  }

  async openLastHourReplay(employee: User, event?: Event): Promise<void> {
    event?.stopPropagation();
    await this.openReplaySessionPicker(employee);
  }

  async openReplaySessionPicker(employee: User): Promise<void> {
    this.destroyReplay();
    this.replayEmployee = employee;
    this.replayMode = 'last_hour';
    this.displayReplaySessionPicker = true;
    this.replaySessionPickerLoading = true;
    this.replaySessionPickerError = '';

    try {
      this.replaySessions = await firstValueFrom(
        this.employeeMonitoring.getSessions(employee._id, 24),
      );
      if (!this.replaySessions.length) {
        this.replaySessionPickerError =
          'No hay sesiones grabadas para este empleado durante las últimas 24 horas.';
        return;
      }
      this.selectReplaySessionForRange(this.replaySessions[0]);
    } catch (err) {
      console.error('Error loading employee replay sessions', err);
      this.replaySessionPickerError = getApiErrorMessage(
        err,
        'No se pudieron cargar las sesiones del empleado',
      );
    } finally {
      this.replaySessionPickerLoading = false;
    }
  }

  selectReplaySessionForRange(session: EmployeeReplaySession): void {
    this.selectedReplaySessionId = session.session_id;
    this.replayRangeStart = this.toDateTimeLocalInput(session.first_event_at);
    this.replayRangeEnd = this.toDateTimeLocalInput(session.last_event_at);
  }

  async openSelectedReplayRange(): Promise<void> {
    const session = this.getSelectedReplaySession();
    if (!this.replayEmployee || !session) return;
    if (!this.applyReplayRange(false)) return;

    const employee = this.replayEmployee;
    const sessions = this.replaySessions;
    const selectedSessionId = this.selectedReplaySessionId;
    const range = {
      start: this.replayRangeStart,
      end: this.replayRangeEnd,
    };
    this.displayReplaySessionPicker = false;
    await this.openReplay(
      employee,
      'last_hour',
      selectedSessionId,
      sessions,
      range,
    );
  }

  closeReplay(): void {
    this.displayReplay = false;
    this.destroyReplay();
  }

  async onReplaySessionChange(): Promise<void> {
    const session = this.getSelectedReplaySession();
    if (session) this.selectReplaySessionForRange(session);
    await this.renderSelectedReplay();
  }

  applyReplayRange(render = true): boolean {
    const session = this.getSelectedReplaySession();
    if (!session) return false;
    const sessionStart = new Date(session.first_event_at).getTime();
    const sessionEnd = new Date(session.last_event_at).getTime();
    const requestedStart = this.parseDateTimeLocalInput(this.replayRangeStart);
    const requestedEnd = this.parseDateTimeLocalInput(this.replayRangeEnd);

    if (!requestedStart || !requestedEnd || requestedStart > requestedEnd) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Rango inválido',
        detail: 'Selecciona una hora de inicio anterior a la hora final.',
      });
      return false;
    }

    const start = Math.max(sessionStart, requestedStart);
    const end = Math.min(sessionEnd, requestedEnd);
    if (start > end) return false;
    this.replayRangeStart = this.toDateTimeLocalInput(new Date(start));
    this.replayRangeEnd = this.toDateTimeLocalInput(new Date(end));
    this.updateReplayActivitiesForRange();
    if (render) void this.renderSelectedReplay();
    return true;
  }

  toggleReplayPlayback(): void {
    if (!this.replayer) return;
    if (this.replayPlaying) {
      this.replayer.pause();
      this.replayPlaying = false;
      return;
    }
    if (this.replayMode === 'live') {
      this.playLiveReplayAtPresent();
    } else {
      this.replayer.play(this.replayer.getCurrentTime());
      this.replayPlaying = true;
    }
  }

  goToLive(): void {
    if (!this.replayer) return;
    this.playLiveReplayAtPresent();
  }

  updateReplaySpeed(): void {
    this.replayer?.setConfig({ speed: Number(this.replaySpeed) || 1 });
  }

  updateSkipInactive(): void {
    this.replayer?.setConfig({ skipInactive: this.replaySkipInactive });
  }

  formatReplaySession(session: EmployeeReplaySession): string {
    const startDate = new Date(session.first_event_at);
    const endDate = new Date(session.last_event_at);
    const date = startDate.toLocaleDateString('es-DO', {
      day: '2-digit',
      month: 'short',
    });
    const start = startDate.toLocaleTimeString('es-DO', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const end = endDate.toLocaleTimeString('es-DO', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const platform = session.platform === 'mobile' ? 'Teléfono' : 'Computadora';
    return `${platform} · ${date}, ${start} – ${end} · ${session.event_count} eventos`;
  }

  getActivityTitle(activity: UserActivity & { groupCount?: number }): string {
    return getEmployeeActivityTitle(activity);
  }

  getActivityDetail(activity: UserActivity & { groupCount?: number }): string {
    return getEmployeeActivityDetail(activity);
  }

  getActivityTime(activity: UserActivity): string {
    return new Date(activity.occurred_at).toLocaleTimeString('es-DO', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  setReplaySidebarTab(tab: 'activity' | 'console'): void {
    this.replaySidebarTab = tab;
  }

  onReplayConsoleFilterChange(): void {
    this.updateReplayActivitiesForRange();
  }

  getConsoleLogTime(log: UserConsoleLog): string {
    return new Date(log.occurred_at).toLocaleTimeString('es-DO', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  getConsoleLevelLabel(level: UserConsoleLevel): string {
    const labels: Record<UserConsoleLevel, string> = {
      log: 'Log',
      info: 'Info',
      warn: 'Advertencia',
      error: 'Error',
      debug: 'Debug',
    };
    return labels[level] || level;
  }

  private async openReplay(
    employee: User,
    mode: 'live' | 'last_hour',
    preferredSessionId?: string,
    preloadedSessions?: EmployeeReplaySession[],
    preferredRange?: { start: string; end: string },
  ): Promise<void> {
    this.destroyReplay();
    this.replayEmployee = employee;
    this.replayMode = mode;
    this.displayReplay = true;
    this.replayLoading = true;
    this.replayError = '';
    this.replayActivities = [];
    this.replayConsoleLogs = [];
    this.replaySidebarTab = 'activity';
    this.replayConsoleFilter = 'all';

    try {
      const [sessions, activities, consoleLogs] = await Promise.all([
        preloadedSessions
          ? Promise.resolve(preloadedSessions)
          : firstValueFrom(this.employeeMonitoring.getSessions(employee._id, mode === 'live' ? 1 : 24)),
        firstValueFrom(this.userActivityService.getByUser(employee._id, 5_000, this.getObservabilitySince())).catch(
          () => ({ activities: [], totalCount: 0 }),
        ),
        firstValueFrom(this.userConsoleLogService.getByUser(employee._id, 5000)).catch(
          () => ({ logs: [], totalCount: 0 }),
        ),
      ]);
      this.replaySessions = sessions;
      this.allReplayActivities = activities.activities || [];
      this.allReplayConsoleLogs = consoleLogs.logs || [];
      this.selectedReplaySessionId =
        preferredSessionId || sessions[0]?.session_id || '';

      if (
        preferredSessionId &&
        !sessions.some((session) => session.session_id === preferredSessionId)
      ) {
        const currentPlatform =
          this.getMonitoringStatus(employee)?.platform || 'desktop';
        this.replaySessions = [
          {
            session_id: preferredSessionId,
            platform: currentPlatform,
            route: this.getMonitoringStatus(employee)?.current_route || null,
            page_title:
              this.getMonitoringStatus(employee)?.current_page_title || null,
            first_event_at: new Date().toISOString(),
            last_event_at: new Date().toISOString(),
            event_count: 0,
            chunk_count: 0,
          },
          ...sessions,
        ];
      }

      const selectedSession = this.getSelectedReplaySession();
      if (selectedSession && mode !== 'live') {
        if (preferredRange?.start && preferredRange?.end) {
          this.replayRangeStart = preferredRange.start;
          this.replayRangeEnd = preferredRange.end;
        } else {
          this.selectReplaySessionForRange(selectedSession);
        }
      }
      this.updateReplayActivitiesForRange();

      this.employeeMonitoring
        .recordReplayAccess(employee._id, this.selectedReplaySessionId || null, mode)
        .subscribe({ error: () => undefined });

      await new Promise((resolve) => setTimeout(resolve, 0));
      await this.renderSelectedReplay();
      this.startObservabilityPolling();
    } catch (err) {
      console.error('Error opening employee replay', err);
      this.replayError = getApiErrorMessage(
        err,
        'No se pudo cargar la sesión del empleado',
      );
      this.replayLoading = false;
    }
  }

  private async renderSelectedReplay(): Promise<void> {
    this.destroyReplay(false);
    this.replayLoading = true;
    this.replayError = '';
    this.replayCursor = null;

    if (!this.replayEmployee || !this.selectedReplaySessionId) {
      this.replayError = 'No hay actividad grabada en el período seleccionado.';
      this.replayLoading = false;
      return;
    }

    try {
      const allEvents = await this.loadAllReplayEvents(
        this.replayEmployee._id,
        this.selectedReplaySessionId,
      );
      const events = this.getEventsForSelectedRange(allEvents);
      const host = this.replayHost?.nativeElement;
      if (!host) throw new Error('No se encontró el reproductor');
      host.replaceChildren();

      if (!events.length) {
        this.replayError =
          this.replayMode === 'live'
            ? 'La sesión está conectada. Esperando la primera captura…'
            : 'Esta sesión no tiene eventos disponibles.';
        this.replayLoading = false;
        if (this.replayMode === 'live') this.startLivePolling();
        return;
      }

      this.replayer = new Replayer(events, {
        root: host,
        liveMode: this.replayMode === 'live',
        speed: this.replaySpeed,
        skipInactive: this.replaySkipInactive,
        showWarning: false,
        mouseTail: true,
        insertStyleRules: this.getReplayFontStyleRules(),
      });
      this.replayStartedAt = Number(events[0]?.timestamp) || Date.now();
      this.initializeReplayViewport();
      this.replayLoading = false;

      if (this.replayMode === 'live') {
        this.playLiveReplayAtPresent();
        this.startLivePolling();
      } else {
        this.replayer.play(this.replayRangePlaybackOffset);
        this.replayPlaying = true;
      }
    } catch (err) {
      console.error('Error rendering employee replay', err);
      this.replayError = getApiErrorMessage(
        err,
        'No se pudo reproducir esta sesión',
      );
      this.replayLoading = false;
    }
  }

  private async loadAllReplayEvents(
    userId: string,
    sessionId: string,
  ): Promise<any[]> {
    const events: any[] = [];
    let hasMore = true;
    let cursor: string | null = null;

    while (hasMore) {
      const response: EmployeeReplayChunkResponse = await firstValueFrom(
        this.employeeMonitoring.getSessionEvents(userId, sessionId, cursor, 100),
      );
      response.chunks.forEach((chunk) => events.push(...chunk.events));
      cursor = response.cursor;
      hasMore = response.has_more;
    }

    this.replayCursor = cursor;
    return events.sort(
      (left, right) => Number(left?.timestamp || 0) - Number(right?.timestamp || 0),
    );
  }

  private getEventsForSelectedRange(events: any[]): any[] {
    this.replayRangePlaybackOffset = 0;
    if (this.replayMode === 'live' || !events.length) return events;

    const start = this.parseDateTimeLocalInput(this.replayRangeStart);
    const end = this.parseDateTimeLocalInput(this.replayRangeEnd);
    if (!start || !end) return events;

    const snapshotIndex = events.reduce(
      (latestIndex, event, index) =>
        event?.type === 2 && Number(event.timestamp) <= start ? index : latestIndex,
      -1,
    );
    let firstIndex = snapshotIndex >= 0 ? snapshotIndex : events.findIndex(
      (event) => Number(event?.timestamp) >= start,
    );
    if (snapshotIndex >= 0) {
      // A checkpoint includes Meta immediately before FullSnapshot. Preserve
      // its viewport so mobile media queries render at the recorded size.
      for (let index = snapshotIndex - 1; index >= 0; index--) {
        if (events[index]?.type === 4) {
          firstIndex = index;
          break;
        }
      }
    }
    const selectedEvents = events.slice(Math.max(0, firstIndex)).filter(
      (event) => Number(event?.timestamp) <= end,
    );
    const firstTimestamp = Number(selectedEvents[0]?.timestamp) || start;
    this.replayRangePlaybackOffset = Math.max(0, start - firstTimestamp);
    return selectedEvents;
  }

  getSelectedReplaySession(): EmployeeReplaySession | undefined {
    return this.replaySessions.find(
      (session) => session.session_id === this.selectedReplaySessionId,
    );
  }

  getReplayRangeMin(): string {
    const session = this.getSelectedReplaySession();
    return session ? this.toDateTimeLocalInput(session.first_event_at) : '';
  }

  getReplayRangeMax(): string {
    const session = this.getSelectedReplaySession();
    return session ? this.toDateTimeLocalInput(session.last_event_at) : '';
  }

  private updateReplayActivitiesForRange(): void {
    const start = this.parseDateTimeLocalInput(this.replayRangeStart);
    const end = this.parseDateTimeLocalInput(this.replayRangeEnd);
    const activitiesInRange = this.allReplayActivities.filter((activity) => {
      const timestamp = new Date(activity.occurred_at).getTime();
      return (!start || timestamp >= start) && (!end || timestamp <= end);
    });
    this.replayActivities = groupConsecutiveEmployeeActivities(activitiesInRange);
    this.replayConsoleLogs = this.allReplayConsoleLogs.filter((log) => {
      const timestamp = new Date(log.occurred_at).getTime();
      const isInRange = (!start || timestamp >= start) && (!end || timestamp <= end);
      const matchesLevel = this.replayConsoleFilter === 'all' || log.level === this.replayConsoleFilter;
      return isInRange && matchesLevel;
    });
  }

  private startObservabilityPolling(): void {
    if (this.observabilityPoll) clearInterval(this.observabilityPoll);
    this.observabilityPoll = setInterval(() => this.pollObservability(), 3_000);
  }

  private async pollObservability(): Promise<void> {
    if (this.observabilityPollBusy || !this.displayReplay || !this.replayEmployee) return;
    this.observabilityPollBusy = true;
    try {
      const activitySince = this.getNewestObservabilityTimestamp(this.allReplayActivities)
        || this.getObservabilitySince();
      const consoleSince = this.getNewestObservabilityTimestamp(this.allReplayConsoleLogs);
      const [activityResponse, consoleResponse] = await Promise.all([
        firstValueFrom(this.userActivityService.getByUser(this.replayEmployee._id, 5_000, activitySince)),
        firstValueFrom(this.userConsoleLogService.getByUser(this.replayEmployee._id, 5000, 'all', consoleSince)),
      ]);
      this.allReplayActivities = this.mergeObservabilityRecords(
        this.allReplayActivities,
        activityResponse?.activities || [],
      );
      this.allReplayConsoleLogs = this.mergeObservabilityRecords(
        this.allReplayConsoleLogs,
        consoleResponse?.logs || [],
      );
      this.updateReplayActivitiesForRange();
    } catch (err) {
      console.error('Error actualizando actividad y consola del empleado', err);
    } finally {
      this.observabilityPollBusy = false;
    }
  }

  private toDateTimeLocalInput(value: string | Date): string {
    const date = new Date(value);
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }

  private parseDateTimeLocalInput(value: string): number {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  private startLivePolling(): void {
    if (this.liveReplayPoll) clearInterval(this.liveReplayPoll);
    this.liveReplayPoll = setInterval(() => this.pollLiveReplay(), 2_000);
  }

  private async pollLiveReplay(): Promise<void> {
    if (
      this.replayPollBusy ||
      !this.displayReplay ||
      this.replayMode !== 'live' ||
      !this.replayEmployee ||
      !this.selectedReplaySessionId
    ) {
      return;
    }

    this.replayPollBusy = true;
    try {
      const response = await firstValueFrom(
        this.employeeMonitoring.getSessionEvents(
          this.replayEmployee._id,
          this.selectedReplaySessionId,
          this.replayCursor,
          100,
        ),
      );
      this.replayCursor = response.cursor;
      const newEvents = response.chunks.flatMap((chunk) => chunk.events || []);

      if (!this.replayer && newEvents.length) {
        await this.renderSelectedReplay();
      } else {
        newEvents.forEach((event) => this.replayer?.addEvent(event));
      }
    } catch (err) {
      console.error('Error polling live employee replay', err);
    } finally {
      this.replayPollBusy = false;
    }
  }

  private destroyReplay(clearDialogState = true): void {
    if (this.liveReplayPoll) clearInterval(this.liveReplayPoll);
    this.liveReplayPoll = undefined;
    this.replayResizeObserver?.disconnect();
    this.replayResizeObserver = undefined;
    if (this.replayFitFrame !== undefined) {
      cancelAnimationFrame(this.replayFitFrame);
      this.replayFitFrame = undefined;
    }
    this.replayer?.destroy();
    this.replayer = undefined;
    this.replayPlaying = false;
    this.replayStartedAt = 0;
    this.replayRangePlaybackOffset = 0;
    this.replayCursor = null;
    this.replayPollBusy = false;
    this.replayHost?.nativeElement.replaceChildren();

    if (clearDialogState) {
      if (this.observabilityPoll) clearInterval(this.observabilityPoll);
      this.observabilityPoll = undefined;
      this.observabilityPollBusy = false;
      this.replaySessions = [];
      this.selectedReplaySessionId = '';
      this.replayActivities = [];
      this.allReplayActivities = [];
      this.replayConsoleLogs = [];
      this.allReplayConsoleLogs = [];
      this.replayRangeStart = '';
      this.replayRangeEnd = '';
      this.replayEmployee = null;
      this.replayError = '';
    }
  }

  private getObservabilitySince(): string {
    return new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString();
  }

  private getNewestObservabilityTimestamp(records: Array<{ occurred_at: string | Date }>): string | undefined {
    const timestamp = records.reduce((latest, record) => {
      const value = new Date(record.occurred_at).getTime();
      return Number.isFinite(value) ? Math.max(latest, value) : latest;
    }, 0);
    return timestamp ? new Date(timestamp).toISOString() : undefined;
  }

  private mergeObservabilityRecords<T extends { _id?: string; occurred_at: string | Date }>(
    current: T[],
    incoming: T[],
  ): T[] {
    const records = new Map<string, T>();
    [...incoming, ...current].forEach((record) => {
      const key = String(record._id || `${new Date(record.occurred_at).getTime()}-${JSON.stringify(record)}`);
      if (!records.has(key)) records.set(key, record);
    });
    const since = Date.now() - 24 * 60 * 60 * 1_000;
    return Array.from(records.values())
      .filter((record) => new Date(record.occurred_at).getTime() >= since)
      .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
      .slice(0, 5_000);
  }

  private initializeReplayViewport(): void {
    const stage = this.replayStage?.nativeElement;
    if (!stage || !this.replayer) return;

    this.replayResizeObserver?.disconnect();
    this.replayResizeObserver = new ResizeObserver(() =>
      this.scheduleReplayFit(),
    );
    this.replayResizeObserver.observe(stage);
    this.replayer.on('resize', () => this.scheduleReplayFit());
    this.replayer.on('fullsnapshot-rebuilded', () =>
      this.scheduleReplayFit(),
    );
    this.scheduleReplayFit();
  }

  private playLiveReplayAtPresent(): void {
    if (!this.replayer || !this.replayStartedAt) return;
    const timeOffset = Math.max(
      0,
      Date.now() - this.replayStartedAt - 1_000,
    );
    this.replayer.play(timeOffset);
    this.replayPlaying = true;
  }

  private scheduleReplayFit(): void {
    if (this.replayFitFrame !== undefined) {
      cancelAnimationFrame(this.replayFitFrame);
    }
    this.replayFitFrame = requestAnimationFrame(() => {
      this.replayFitFrame = requestAnimationFrame(() => {
        this.replayFitFrame = undefined;
        this.fitReplayToStage();
      });
    });
  }

  private fitReplayToStage(): void {
    const host = this.replayHost?.nativeElement;
    const wrapper = this.replayer?.wrapper;
    const iframe = this.replayer?.iframe;
    if (!host || !wrapper || !iframe) return;

    const replayWidth =
      Number(iframe.getAttribute('width')) || iframe.offsetWidth;
    const replayHeight =
      Number(iframe.getAttribute('height')) || iframe.offsetHeight;
    const availableWidth = host.clientWidth;
    const availableHeight = host.clientHeight;
    if (
      replayWidth <= 0 ||
      replayHeight <= 0 ||
      availableWidth <= 0 ||
      availableHeight <= 0
    ) {
      return;
    }

    const scale = Math.min(
      availableWidth / replayWidth,
      availableHeight / replayHeight,
      1,
    );
    wrapper.style.setProperty('--replay-fit-scale', scale.toFixed(4));
  }

  private getReplayFontStyleRules(): string[] {
    const fontRules = new Set<string>();
    for (const stylesheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = stylesheet.cssRules;
      } catch {
        continue;
      }
      const baseUrl = stylesheet.href || document.baseURI;
      for (const rule of Array.from(rules)) {
        if (rule.type !== CSSRule.FONT_FACE_RULE) continue;
        fontRules.add(this.absolutizeCssUrls(rule.cssText, baseUrl));
      }
    }
    return Array.from(fontRules);
  }

  private absolutizeCssUrls(cssText: string, baseUrl: string): string {
    return cssText.replace(
      /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
      (_match, _quote: string, rawUrl: string) => {
        const value = rawUrl.trim();
        if (/^(?:data:|blob:|https?:|\/\/)/i.test(value)) {
          return `url("${value}")`;
        }
        try {
          return `url("${new URL(value, baseUrl).href}")`;
        } catch {
          return `url("${value}")`;
        }
      },
    );
  }

  private humanizeRoute(route?: string | null): string {
    if (!route) return '';
    const clean = route.split('?')[0].replace(/^\//, '').replace(/[-_/]+/g, ' ');
    return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : 'Inicio';
  }

  showCurriculum(empleado: User): void {
    this.selectedEmpleado = empleado;
    this.editingDepartment = false;
    this.tempDepartmentId = empleado.department_id || '';
    this.displayModal = true;
    
    // Load timeline graph data
    this.chartData = null; // Clear previous
    this.processService.getTimelineByCreator(empleado._id).subscribe({
      next: (timeline: any[]) => {
          // Preparamos últimos 30 días, completando los días vacíos
          const labels: string[] = [];
          const data: number[] = [];
          
          const today = new Date();
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(today.getDate() - 30);
          
          let currentDate = new Date(thirtyDaysAgo);
          // Helper para normalizar la fecha
          const getFormattedDate = (date: Date) => {
             const y = date.getFullYear();
             const m = String(date.getMonth() + 1).padStart(2, '0');
             const d = String(date.getDate()).padStart(2, '0');
             return `${y}-${m}-${d}`;
          };
          
          // Llenamos el array de fechas (labels) y datos iniciales (0)
          while (currentDate <= today) {
             const dStr = getFormattedDate(currentDate);
             labels.push(dStr);
             
             // Buscamos si en la base de datos hay algo para esa fecha
             const found = (timeline || []).find(t => t._id === dStr);
             data.push(found ? found.count : 0);
             
             currentDate.setDate(currentDate.getDate() + 1);
          }
          
          // Formateamos para que la gráfica solo muestre Mes/Día (ej. 01/15)
          const shortLabels = labels.map(l => {
              const [, m, d] = l.split('-');
              return `${d}/${m}`;
          });

          this.chartData = {
              labels: shortLabels,
              datasets: [
                  {
                      label: 'Procesos completados',
                      data: data,
                      fill: true,
                      borderColor: '#105378', // Un azul corporativo
                      backgroundColor: 'rgba(16, 83, 120, 0.2)', // El mismo con transparencia
                      tension: 0.4
                  }
              ]
          };
      },
      error: (err) => console.error("Error al obtener grafico timeline", err)
    });
  }

  toggleEditDepartment(): void {
    if (!this.selectedEmpleado) return;
    this.editingDepartment = !this.editingDepartment;
    if (this.editingDepartment) {
      this.tempDepartmentId = this.selectedEmpleado.department_id || '';
    }
  }

  saveDepartment(): void {
    if (!this.selectedEmpleado) return;
    this.savingDepartment = true;
    this.userService.update(this.selectedEmpleado._id, { department_id: this.tempDepartmentId }).subscribe({
      next: (updatedUser: User) => {
        if (this.selectedEmpleado) {
          this.selectedEmpleado.department_id = this.tempDepartmentId;
        }

        // Encontrar y actualizar en la lista principal
        const index = this.empleados.findIndex(e => e._id === this.selectedEmpleado?._id);
        if (index !== -1) {
          this.empleados[index].department_id = this.tempDepartmentId;
        }

        this.editingDepartment = false;
        this.savingDepartment = false;
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Departamento asignado correctamente' });
      },
      error: (err) => {
        console.error('Error al actualizar el departamento:', err);
        this.savingDepartment = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: getApiErrorMessage(err, 'No se pudo actualizar el departamento') });
      }
    });
  }

  getEmployeeProcessCount(id: string): number {
    const stat = this.employeeStats.get(id);
    return stat ? stat.totalProcesses : 0;
  }

  getEmployeeProcessBreakdown(id: string): any[] {
    const stat = this.employeeStats.get(id);
    return stat ? stat.processesByType || [] : [];
  }

  getEmployeePerformance(id: string): number {
    if (this.maxProcesses === 0) return 0;
    const count = this.getEmployeeProcessCount(id);
    return Math.round((count / this.maxProcesses) * 100);
  }

}
