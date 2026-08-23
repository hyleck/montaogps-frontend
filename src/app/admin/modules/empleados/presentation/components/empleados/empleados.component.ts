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
  displayReplay = false;
  replayMode: 'live' | 'last_hour' = 'last_hour';
  replayEmployee: User | null = null;
  replaySessions: EmployeeReplaySession[] = [];
  selectedReplaySessionId = '';
  replayLoading = false;
  replayError = '';
  replayActivities: UserActivity[] = [];
  replayPlaying = false;
  replaySpeed = 1;
  replaySkipInactive = true;

  private monitoringPoll?: ReturnType<typeof setInterval>;
  private liveReplayPoll?: ReturnType<typeof setInterval>;
  replayer?: Replayer;
  private replayCursor: string | null = null;
  private replayPollBusy = false;
  private replayResizeObserver?: ResizeObserver;
  private replayFitFrame?: number;

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
        this.empleados = data;
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
    await this.openReplay(employee, 'last_hour');
  }

  closeReplay(): void {
    this.displayReplay = false;
    this.destroyReplay();
  }

  async onReplaySessionChange(): Promise<void> {
    await this.renderSelectedReplay();
  }

  toggleReplayPlayback(): void {
    if (!this.replayer) return;
    if (this.replayPlaying) {
      this.replayer.pause();
      this.replayPlaying = false;
      return;
    }
    if (this.replayMode === 'live') {
      this.replayer.startLive(Date.now() - 1_000);
    } else {
      this.replayer.play(this.replayer.getCurrentTime());
    }
    this.replayPlaying = true;
  }

  goToLive(): void {
    if (!this.replayer) return;
    this.replayer.startLive(Date.now() - 1_000);
    this.replayPlaying = true;
  }

  updateReplaySpeed(): void {
    this.replayer?.setConfig({ speed: Number(this.replaySpeed) || 1 });
  }

  updateSkipInactive(): void {
    this.replayer?.setConfig({ skipInactive: this.replaySkipInactive });
  }

  formatReplaySession(session: EmployeeReplaySession): string {
    const start = new Date(session.first_event_at).toLocaleTimeString('es-DO', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const end = new Date(session.last_event_at).toLocaleTimeString('es-DO', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${start} – ${end} · ${session.event_count} eventos`;
  }

  getActivityTitle(activity: UserActivity): string {
    if (activity.action) return activity.action;
    if (activity.screen) return `Visitó ${activity.screen}`;
    return 'Actividad en la plataforma';
  }

  getActivityTime(activity: UserActivity): string {
    return new Date(activity.occurred_at).toLocaleTimeString('es-DO', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  private async openReplay(
    employee: User,
    mode: 'live' | 'last_hour',
    preferredSessionId?: string,
  ): Promise<void> {
    this.destroyReplay();
    this.replayEmployee = employee;
    this.replayMode = mode;
    this.displayReplay = true;
    this.replayLoading = true;
    this.replayError = '';
    this.replayActivities = [];

    try {
      const [sessions, activities] = await Promise.all([
        firstValueFrom(this.employeeMonitoring.getSessions(employee._id, 1)),
        firstValueFrom(this.userActivityService.getByUser(employee._id, 100)).catch(
          () => ({ activities: [], totalCount: 0 }),
        ),
      ]);
      this.replaySessions = sessions;
      this.replayActivities = activities.activities || [];
      this.selectedReplaySessionId =
        preferredSessionId || sessions[0]?.session_id || '';

      if (
        preferredSessionId &&
        !sessions.some((session) => session.session_id === preferredSessionId)
      ) {
        this.replaySessions = [
          {
            session_id: preferredSessionId,
            platform: 'desktop',
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

      this.employeeMonitoring
        .recordReplayAccess(employee._id, this.selectedReplaySessionId || null, mode)
        .subscribe({ error: () => undefined });

      await new Promise((resolve) => setTimeout(resolve, 0));
      await this.renderSelectedReplay();
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
      this.replayError = 'No hay actividad grabada durante la última hora.';
      this.replayLoading = false;
      return;
    }

    try {
      const events = await this.loadAllReplayEvents(
        this.replayEmployee._id,
        this.selectedReplaySessionId,
      );
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
      this.initializeReplayViewport();
      this.replayLoading = false;

      if (this.replayMode === 'live') {
        this.replayer.startLive(Date.now() - 1_000);
        this.replayPlaying = true;
        this.startLivePolling();
      } else {
        this.replayer.play(0);
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
    this.replayCursor = null;
    this.replayPollBusy = false;
    this.replayHost?.nativeElement.replaceChildren();

    if (clearDialogState) {
      this.replaySessions = [];
      this.selectedReplaySessionId = '';
      this.replayActivities = [];
      this.replayEmployee = null;
      this.replayError = '';
    }
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
