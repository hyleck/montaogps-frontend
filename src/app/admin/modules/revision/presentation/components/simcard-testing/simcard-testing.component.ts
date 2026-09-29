import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { Subscription, timeout, TimeoutError } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';
import { InventoryItem, InventoryService, SimcardItem } from 'src/app/core/services/inventory.service';
import { SimcardTestingContext, SimcardTestingService, SimcardTestingSession, TestingConnection, TestingGpsPosition, TestingHistorySession, TestingLogEvent, TestingSmsMessage } from 'src/app/core/services/simcard-testing.service';
import { getApiErrorMessage } from 'src/app/core/utils/api-error.util';
import { SmsCommandsDialogComponent, SmsDialogCommand } from 'src/app/shareds/components/sms-commands-dialog/sms-commands-dialog.component';
import { DeviceLabelPipe } from 'src/app/shareds/pipes/device-label.pipe';
import { UserNamePipe } from 'src/app/shareds/pipes/user-name.pipe';
import { SmsLocationPipe } from 'src/app/shareds/pipes/sms-location.pipe';
import { getValidGpsPosition } from 'src/app/shareds/helpers/gps-position.helper';
import { TestingGpsMapComponent } from '../testing-gps-map/testing-gps-map.component';
import { InventorySimcardSelectorComponent } from '../../../../inventory/presentation/components/inventory-simcard-selector/inventory-simcard-selector.component';

@Component({
  selector: 'app-simcard-testing',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, DeviceLabelPipe, UserNamePipe, SmsLocationPipe, InventorySimcardSelectorComponent, SmsCommandsDialogComponent, TestingGpsMapComponent],
  templateUrl: './simcard-testing.component.html',
  styleUrls: ['./simcard-testing.component.css'],
})
export class SimcardTestingComponent implements OnInit, OnDestroy {
  setupVisible = false;
  visible = false;
  selected: SimcardItem | null = null;
  selectedGps: InventoryItem | null = null;
  session: SimcardTestingSession | null = null;
  context: SimcardTestingContext | null = null;
  loadingActive = false;
  starting = false;
  ending = false;
  finishRequested = false;
  loadingContext = false;
  error = '';
  feedback = '';
  historyError = '';
  sessionError = '';
  gpsQuery = '';
  gpsResults: InventoryItem[] = [];
  gpsLoading = false;
  gpsError = '';
  gpsPage = 1;
  gpsLastPage = 1;
  gpsTotal = 0;
  messages: TestingSmsMessage[] = [];
  loadingMessages = false;
  hasLoadedMessages = false;
  sending = false;
  sendingKey = '';
  logsVisible = false;
  testHistoryQuery = '';
  testHistory: TestingHistorySession[] = [];
  testHistoryLoading = false;
  testHistoryError = '';
  testHistoryPage = 1;
  testHistoryLastPage = 1;
  testHistoryTotal = 0;
  logSessionId = '';
  logSession: TestingHistorySession | null = null;
  logEvents: TestingLogEvent[] = [];
  logsLoading = false;
  logsError = '';
  logsPage = 1;
  logsLastPage = 1;
  logsTotal = 0;
  connection: TestingConnection | null = null;
  connectionLoading = false;
  connectionError = '';
  testingPosition: TestingGpsPosition | null = null;
  private positionCurrent = false;
  private connectionExpired = false;
  private connectionReceivedAt: number | null = null;
  private activeChecked = false;
  private contextRequest?: Subscription;
  private historyRequest?: Subscription;
  private sendRequest?: Subscription;
  private lifecycleRequest?: Subscription;
  private statusRequest?: Subscription;
  private heartbeatRequest?: Subscription;
  private gpsRequest?: Subscription;
  private testHistoryRequest?: Subscription;
  private logsRequest?: Subscription;
  private connectionRequest?: Subscription;
  private gpsSearchTimer?: ReturnType<typeof setTimeout>;
  private pollTimer?: ReturnType<typeof setInterval>;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private connectionTimer?: ReturnType<typeof setInterval>;
  private connectionStaleTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly testing: SimcardTestingService,
    private readonly auth: AuthService,
    private readonly inventory: InventoryService,
  ) {}

  get allowed(): boolean {
    const user = this.auth.getCurrentUser();
    return !!user && (user.root === true || user.developer === true
      || ['empleado', 'admin'].includes(String(user.affiliation_type_id || '').toLowerCase().trim()));
  }

  get sendDisabled(): boolean {
    const quota = this.context?.quota;
    return this.loadingContext || this.finishRequested || this.ending || this.session?.status !== 'active' || !this.context?.canSend
      || (!!quota && !quota.unlimited && (quota.remaining ?? 0) <= 0);
  }

  get sessionStatus(): string {
    if (this.finishRequested && this.session?.status === 'active') return 'Finalización de la prueba pendiente';
    switch (this.session?.status) {
      case 'active': return 'GPS registrado para la prueba en S5';
      case 'starting': return 'Registrando GPS en el servidor 5';
      case 'cleanup_pending': return 'Retiro del servidor 5 pendiente';
      case 'finished': return 'Prueba finalizada';
      case 'failed': return 'No se pudo iniciar la prueba';
      default: return '';
    }
  }

  get canStart(): boolean {
    return this.activeChecked && !this.starting && !this.loadingActive && !!this.selected?._id && !!this.selectedGps?._id;
  }

  get recoveryRequired(): boolean { return !this.activeChecked; }

  get connectionStale(): boolean {
    if (!this.connection) return false;
    return this.connectionExpired || (this.connectionReceivedAt !== null && Date.now() - this.connectionReceivedAt > 15000);
  }

  get connectionStatus(): TestingConnection['status'] {
    if (this.connectionStale || this.connectionError) return 'unavailable';
    return this.connection?.status || 'unknown';
  }

  get connectionLabel(): string {
    if (this.connectionStale) return 'Estado desactualizado';
    if (!this.connection && this.connectionLoading) return 'Comprobando…';
    return this.connectionStatusLabel(this.connectionStatus);
  }

  get testingPositionStale(): boolean {
    return !!this.testingPosition && (this.connectionStatus !== 'online' || !this.positionCurrent);
  }

  connectionStatusLabel(status: string): string {
    const labels: Record<string, string> = { online: 'En línea', offline: 'Fuera de línea', unknown: 'Estado desconocido', unavailable: 'No disponible' };
    return labels[status] || status;
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (document.visibilityState === 'visible') this.refreshConnection();
  }

  refreshConnection(): void {
    if (!this.session || !this.visible || this.finishRequested || this.ending || this.session.status !== 'active' || this.connectionLoading) return;
    const sessionId = this.session.sessionId;
    const imei = this.session.imei;
    this.connectionLoading = true;
    this.connectionRequest = this.testing.getConnection(sessionId).pipe(timeout(15000)).subscribe({
      next: connection => {
        if (this.session?.sessionId !== sessionId || !this.visible || this.finishRequested || this.session.status !== 'active') return;
        this.connectionLoading = false;
        if (connection.sessionId !== sessionId || connection.imei !== imei) {
          this.connectionError = 'No se pudo verificar la conexión de este GPS.';
          return;
        }
        if (connection.sessionStatus !== 'active') {
          this.session = { ...this.session, status: connection.sessionStatus };
          this.finishRequested = connection.sessionStatus !== 'starting';
          if (connection.sessionStatus === 'finished') this.finishLocally();
          else this.stopConnectionMonitoring();
          return;
        }
        const coordinates = getValidGpsPosition(connection.position);
        const fixTime = connection.position ? Date.parse(connection.position.fixTime) : NaN;
        if (coordinates && connection.position && Number.isFinite(fixTime)
          && (!this.testingPosition || fixTime >= Date.parse(this.testingPosition.fixTime))) {
          this.testingPosition = { ...connection.position, latitude: coordinates.lat, longitude: coordinates.lng };
          this.positionCurrent = !connection.positionReason;
        } else this.positionCurrent = false;
        this.connection = connection.status === 'unavailable' && !connection.lastCommunicationAt
          ? { ...connection, lastCommunicationAt: this.connection?.lastCommunicationAt || null }
          : connection;
        this.connectionReceivedAt = Date.now();
        this.connectionError = '';
        this.connectionExpired = false;
        clearTimeout(this.connectionStaleTimer);
        this.connectionStaleTimer = setTimeout(() => { this.connectionExpired = true; }, 15001);
      },
      error: error => {
        if (this.session?.sessionId !== sessionId || this.finishRequested || !this.visible) return;
        this.connectionLoading = false;
        this.connectionError = error instanceof TimeoutError
          ? 'No se pudo consultar la conexión del GPS en 15 segundos. Se volverá a intentar automáticamente.'
          : getApiErrorMessage(error, 'No se pudo consultar la conexión del GPS. Se volverá a intentar automáticamente.');
      },
    });
  }

  openHistory(): void {
    if (!this.allowed) return;
    this.logsVisible = true;
    this.logSessionId = '';
    this.logSession = null;
    this.logEvents = [];
    this.logsRequest?.unsubscribe();
    this.loadHistory(1);
  }

  loadHistory(page = 1): void {
    if (!this.logsVisible) return;
    this.testHistoryRequest?.unsubscribe();
    this.testHistoryLoading = true;
    this.testHistoryPage = page;
    this.testHistoryError = '';
    this.testHistoryRequest = this.testing.getHistory(this.testHistoryQuery, page, 20).subscribe({
      next: response => {
        this.testHistory = response.data;
        this.testHistoryPage = response.page;
        this.testHistoryLastPage = Math.max(response.lastPage, 1);
        this.testHistoryTotal = response.total;
        this.testHistoryLoading = false;
      },
      error: error => {
        this.testHistoryLoading = false;
        this.testHistoryError = getApiErrorMessage(error, 'No se pudieron cargar los logs de pruebas.');
      },
    });
  }

  openLogs(sessionId: string): void {
    if (!this.allowed || !sessionId) return;
    this.logsVisible = true;
    this.logSessionId = sessionId;
    this.logSession = null;
    this.logEvents = [];
    this.testHistoryRequest?.unsubscribe();
    this.testHistoryLoading = false;
    this.loadLogs(1);
  }

  loadLogs(page = 1): void {
    if (!this.logsVisible || !this.logSessionId) return;
    this.logsRequest?.unsubscribe();
    this.logsLoading = true;
    this.logsPage = page;
    this.logsError = '';
    this.logsRequest = this.testing.getLogs(this.logSessionId, page, 50).subscribe({
      next: response => {
        this.logSession = response.session;
        this.logEvents = response.data;
        this.logsPage = response.page;
        this.logsLastPage = Math.max(response.lastPage, 1);
        this.logsTotal = response.total;
        this.logsLoading = false;
      },
      error: error => {
        this.logsLoading = false;
        this.logsError = getApiErrorMessage(error, 'No se pudo cargar el detalle de esta prueba.');
      },
    });
  }

  backToHistory(): void {
    this.logsRequest?.unsubscribe();
    this.logsLoading = false;
    this.logSessionId = '';
    this.logSession = null;
    this.loadHistory(this.testHistoryPage);
  }

  closeHistory(): void {
    this.logsVisible = false;
    this.testHistoryRequest?.unsubscribe();
    this.logsRequest?.unsubscribe();
    this.testHistoryLoading = false;
    this.logsLoading = false;
  }

  historyStatus(status: SimcardTestingSession['status']): string {
    return ({ starting: 'Iniciando', active: 'En curso', cleanup_pending: 'Retiro pendiente', finished: 'Finalizada', failed: 'No iniciada' })[status];
  }

  logIsError(event: TestingLogEvent): boolean {
    return /error|fail|pending|denied|reject|uncertain/i.test(event.type);
  }

  logDetails(event: TestingLogEvent): Array<{ label: string; value: string; code: boolean }> {
    const fields: Array<[string, string]> = [
      ['commandName', 'Comando'], ['command', 'Contenido del comando'], ['provider', 'Proveedor'],
      ['content', 'Mensaje SMS'], ['direction', 'Dirección'], ['result', 'Resultado'],
      ['delivered', 'Entrega confirmada'], ['reason', 'Motivo'], ['serverName', 'Servidor'],
      ['imei', 'IMEI'], ['simIccid', 'SIM card'], ['modelName', 'Modelo GPS'],
      ['submitted', 'Enviado al proveedor'], ['skipped', 'Acción omitida'],
      ['restorationAvailable', 'Configuración original disponible'], ['requestId', 'Referencia'],
      ['status', 'Estado'], ['previousStatus', 'Estado anterior'], ['lastCommunicationAt', 'Última comunicación'],
    ];
    return fields.flatMap(([key, label]) => {
      const raw = event.details?.[key];
      if (!['string', 'number', 'boolean'].includes(typeof raw) || raw === '') return [];
      let value = typeof raw === 'boolean' ? (raw ? 'Sí' : 'No') : String(raw);
      if (key === 'direction') {
        if (['sent', 'MT', 'out'].includes(String(raw))) value = 'Enviado';
        if (['received', 'MO', 'in'].includes(String(raw))) value = 'Recibido';
      }
      if (key === 'result') {
        const results: Record<string, string> = { success: 'Correcto', submitted: 'Enviado', failed: 'Fallido', uncertain: 'Sin confirmación', skipped: 'Omitido' };
        value = results[value] || value;
      }
      if (key === 'status' || key === 'previousStatus') value = this.historyStatus(value as SimcardTestingSession['status']) || this.connectionStatusLabel(value);
      if (key === 'lastCommunicationAt') {
        const timestamp = new Date(value);
        if (Number.isFinite(timestamp.getTime())) value = timestamp.toLocaleString('es-DO');
      }
      return [{ label, value, code: key === 'command' || key === 'content' }];
    });
  }

  ngOnInit(): void {
    if (this.allowed) this.recoverSession();
  }

  openTesting(): void {
    if (!this.allowed || this.loadingActive || this.starting || this.ending) return;
    this.feedback = '';
    if (this.session) { this.visible = true; return; }
    if (!this.activeChecked) { this.recoverSession(true); return; }
    this.openSetup();
  }

  recoverSession(openSetupWhenEmpty = false): void {
    if (this.loadingActive) return;
    this.loadingActive = true;
    this.error = '';
    this.lifecycleRequest = this.testing.getActiveSession().subscribe({
      next: session => {
        this.loadingActive = false;
        this.activeChecked = true;
        if (session?.status === 'finished') {
          this.session = session;
          this.finishLocally();
          if (openSetupWhenEmpty) this.openSetup();
        } else if (session?.status === 'failed') {
          this.session = null;
          this.error = session.reason || 'No se pudo iniciar la prueba anterior.';
          if (openSetupWhenEmpty) this.openSetup();
        } else if (session) this.openSession(session);
        else if (openSetupWhenEmpty) this.openSetup();
      },
      error: error => {
        this.loadingActive = false;
        this.activeChecked = false;
        this.error = getApiErrorMessage(error, 'No se pudo comprobar si tienes una prueba activa. Vuelve a pulsar Testing para reintentar.');
      },
    });
  }

  selectSim(card: SimcardItem): void {
    if (this.starting || this.session || !card._id) return;
    this.selected = card;
    this.error = '';
  }

  selectGps(gps: InventoryItem): void {
    if (this.starting || this.session || !gps._id || this.isMtag(gps)) return;
    this.selectedGps = gps;
    this.error = '';
  }

  onGpsQueryChange(query: string): void {
    this.gpsQuery = query;
    clearTimeout(this.gpsSearchTimer);
    this.gpsRequest?.unsubscribe();
    this.gpsResults = [];
    this.gpsLoading = true;
    this.gpsSearchTimer = setTimeout(() => this.searchGps(1), 300);
  }

  searchGps(page = 1): void {
    if (!this.setupVisible || this.starting) return;
    clearTimeout(this.gpsSearchTimer);
    this.gpsRequest?.unsubscribe();
    this.gpsLoading = true;
    this.gpsError = '';
    this.gpsRequest = this.inventory.searchAllDevices(this.gpsQuery.trim(), undefined, page, 20).subscribe({
      next: result => {
        this.gpsResults = result.data;
        this.gpsPage = result.page;
        this.gpsLastPage = result.lastPage;
        this.gpsTotal = result.total;
        this.gpsLoading = false;
      },
      error: error => {
        this.gpsResults = [];
        this.gpsLoading = false;
        this.gpsError = getApiErrorMessage(error, 'No se pudieron buscar los GPS del inventario.');
      },
    });
  }

  gpsImei(gps: InventoryItem): string {
    return gps.IMEI || gps.imei || 'Sin IMEI';
  }

  gpsModel(gps: InventoryItem): string {
    const protocol = gps.Protocol || gps.protocol;
    return typeof protocol === 'object' && protocol ? protocol.name || protocol.nombre || 'Sin modelo' : String(protocol || 'Sin modelo');
  }

  isMtag(gps: InventoryItem): boolean {
    const protocol = gps.Protocol || gps.protocol;
    const name = this.gpsModel(gps).replace(/[^a-z0-9]/gi, '').toUpperCase();
    return (typeof protocol === 'object' && protocol?.isAirtag === true) || name === 'MTAGA' || name === 'MTAGP';
  }

  start(): void {
    if (!this.allowed || !this.canStart || this.session || !this.selected?._id || !this.selectedGps?._id) return;
    this.starting = true;
    this.error = '';
    this.lifecycleRequest = this.testing.startSession(this.selected._id, this.selectedGps._id).subscribe({
      next: session => {
        this.starting = false;
        this.openSession(session);
      },
      error: error => {
        this.starting = false;
        this.error = getApiErrorMessage(error, 'No se pudo registrar el GPS para la prueba.');
        // A failed response can still leave a server registration: recover before retrying.
        this.activeChecked = false;
      },
    });
  }

  closeSetup(): void {
    if (this.starting) return;
    this.setupVisible = false;
    this.gpsRequest?.unsubscribe();
    clearTimeout(this.gpsSearchTimer);
    this.gpsLoading = false;
  }

  loadContext(): void {
    if (!this.session || !this.visible || this.sending || this.ending || this.session.status !== 'active') return;
    this.contextRequest?.unsubscribe();
    this.loadingContext = true;
    this.error = '';
    this.contextRequest = this.testing.getContext(this.session.simId, this.session.sessionId).subscribe({
      next: context => { this.context = context; this.loadingContext = false; },
      error: error => {
        this.context = null;
        this.loadingContext = false;
        this.error = getApiErrorMessage(error, 'No se pudieron cargar los comandos de esta prueba.');
      },
    });
  }

  loadMessages(): void {
    if (!this.session || !this.visible || this.ending || this.session.status !== 'active') return;
    this.historyRequest?.unsubscribe();
    this.loadingMessages = true;
    this.historyError = '';
    this.historyRequest = this.testing.getMessages(this.session.simId, this.session.sessionId).subscribe({
      next: messages => {
        this.messages = messages;
        this.loadingMessages = false;
        this.hasLoadedMessages = true;
      },
      error: error => {
        this.loadingMessages = false;
        this.historyError = getApiErrorMessage(error, 'No se pudo cargar el historial SMS.');
      },
    });
  }

  async copyCommand(command: SmsDialogCommand): Promise<void> {
    const sessionId = this.session?.sessionId;
    try {
      await navigator.clipboard.writeText(command.value);
      if (this.visible && this.session?.sessionId === sessionId) this.feedback = 'Comando copiado.';
    } catch {
      if (this.visible && this.session?.sessionId === sessionId) this.error = 'No se pudo copiar el comando. Puedes seleccionarlo y copiarlo manualmente.';
    }
  }

  sendCommand(command: SmsDialogCommand): void {
    if (this.sending || this.sendDisabled || command.canSend === false || !this.session
      || !Number.isInteger(command.commandIndex)) return;
    this.sending = true;
    this.sendingKey = `${command.name || ''}|${command.value || ''}`;
    this.error = '';
    this.feedback = '';
    this.sendRequest = this.testing.sendCommand(this.session.simId, command.commandIndex!, this.session.sessionId).subscribe({
      next: result => {
        this.sending = false;
        this.sendingKey = '';
        if (!result.success) { this.error = result.message || 'No se pudo confirmar el envío del comando.'; return; }
        if (this.context && result.quota) this.context = { ...this.context, quota: result.quota };
        this.feedback = 'Comando enviado. El historial mostrará la respuesta del dispositivo cuando esté disponible.';
        this.loadMessages();
      },
      error: error => {
        this.sending = false;
        this.sendingKey = '';
        this.error = getApiErrorMessage(error, 'No se pudo enviar el comando.');
      },
    });
  }

  close(): void {
    if (this.logsVisible || this.sending || this.ending || !this.session) return;
    this.ending = true;
    this.finishRequested = true;
    this.stopConnectionMonitoring();
    this.sessionError = '';
    this.statusRequest?.unsubscribe();
    this.heartbeatRequest?.unsubscribe();
    this.lifecycleRequest = this.testing.finishSession(this.session.sessionId).subscribe({
      next: session => {
        this.ending = false;
        this.session = session;
        if (session.status === 'finished') this.finishLocally();
        else this.sessionError = session.reason || 'El retiro del GPS del servidor 5 sigue pendiente. Pulsa Finalizar prueba para reintentar.';
      },
      error: error => {
        this.ending = false;
        this.sessionError = getApiErrorMessage(error, 'No se pudo confirmar el retiro del GPS del servidor 5. Pulsa Finalizar prueba para reintentar.');
      },
    });
  }

  ngOnDestroy(): void {
    this.clearRequests();
    this.lifecycleRequest?.unsubscribe();
    this.sendRequest?.unsubscribe();
    this.gpsRequest?.unsubscribe();
    this.testHistoryRequest?.unsubscribe();
    this.logsRequest?.unsubscribe();
    clearTimeout(this.gpsSearchTimer);
  }

  private openSetup(): void {
    this.setupVisible = true;
    this.error = '';
    this.searchGps();
  }

  private openSession(session: SimcardTestingSession): void {
    this.clearRequests();
    this.closeSetup();
    this.session = session;
    this.selected = { _id: session.simId, ...session.sim };
    this.context = null;
    this.messages = [];
    this.hasLoadedMessages = false;
    this.error = '';
    this.historyError = '';
    this.sessionError = session.reason || '';
    this.finishRequested = session.status === 'cleanup_pending';
    this.feedback = '';
    this.visible = true;
    this.loadContext();
    this.loadMessages();
    this.startConnectionMonitoring();
    this.pollTimer = setInterval(() => {
      if (!this.ending) this.refreshSession();
      if (!this.sending && !this.loadingMessages) this.loadMessages();
    }, 15000);
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), 30000);
  }

  private refreshSession(): void {
    if (!this.session || !this.visible || this.ending || (this.statusRequest && !this.statusRequest.closed)) return;
    this.statusRequest = this.testing.getSession(this.session.sessionId).subscribe({
      next: session => {
        if (this.ending) return;
        if (this.finishRequested && session.status === 'active') return;
        const becameActive = this.session?.status !== 'active' && session.status === 'active';
        this.session = session;
        if (session.status === 'finished') this.finishLocally();
        else if (session.status !== 'active') {
          this.finishRequested = session.status !== 'starting';
          this.stopConnectionMonitoring();
        }
        else if (becameActive) { this.loadContext(); this.loadMessages(); this.startConnectionMonitoring(); }
      },
      error: error => { this.sessionError = getApiErrorMessage(error, 'No se pudo actualizar el estado de la prueba.'); },
    });
  }

  private sendHeartbeat(): void {
    if (!this.session || !this.visible || this.ending || this.finishRequested || this.session.status !== 'active'
      || (this.heartbeatRequest && !this.heartbeatRequest.closed)) return;
    this.heartbeatRequest = this.testing.heartbeat(this.session.sessionId).subscribe({
      next: session => {
        if (this.ending || this.session?.status !== 'active') return;
        this.session = session;
        this.sessionError = session.reason || '';
        if (session.status !== 'active') {
          this.finishRequested = session.status !== 'starting';
          this.stopConnectionMonitoring();
        }
      },
      error: error => { this.sessionError = getApiErrorMessage(error, 'No se pudo mantener la prueba activa. Comprueba tu conexión.'); },
    });
  }

  private finishLocally(): void {
    const restoreSubmitted = this.session?.restoreSubmitted === true;
    this.clearRequests();
    this.visible = false;
    this.session = null;
    this.context = null;
    this.selected = null;
    this.selectedGps = null;
    this.messages = [];
    this.error = '';
    this.sessionError = '';
    this.feedback = 'Prueba finalizada. El GPS fue retirado del servidor 5.';
    if (restoreSubmitted) this.feedback += ' Se envió la configuración del servidor original.';
  }

  private clearRequests(): void {
    this.stopConnectionMonitoring();
    this.contextRequest?.unsubscribe();
    this.historyRequest?.unsubscribe();
    this.statusRequest?.unsubscribe();
    this.heartbeatRequest?.unsubscribe();
    clearInterval(this.pollTimer);
    clearInterval(this.heartbeatTimer);
    this.loadingContext = false;
    this.loadingMessages = false;
  }

  private startConnectionMonitoring(): void {
    this.stopConnectionMonitoring();
    if (this.session?.status !== 'active' || this.finishRequested || !this.visible) return;
    this.connectionTimer = setInterval(() => this.refreshConnection(), 5000);
    this.refreshConnection();
  }

  private stopConnectionMonitoring(): void {
    clearInterval(this.connectionTimer);
    clearTimeout(this.connectionStaleTimer);
    this.connectionRequest?.unsubscribe();
    this.connection = null;
    this.connectionLoading = false;
    this.connectionError = '';
    this.connectionExpired = false;
    this.connectionReceivedAt = null;
    this.testingPosition = null;
    this.positionCurrent = false;
  }
}
