import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MessageService } from 'primeng/api';
import {
  InstallationDetail,
  Solicitud,
  SolicitudesService,
  TechnicianAssistancePresenceState,
} from '../../../../../../core/services/solicitudes.service';
import { Command, CommandsService } from '../../../../../../core/services/commands.service';
import {
  InventoryItem,
  InventoryService,
  SimcardItem,
} from '../../../../../../core/services/inventory.service';
import { TargetsService } from '../../../../../../core/services/targets.service';
import { AuthService } from '../../../../../../core/services/auth.service';
import { VehicleBrandsService } from '../../../../../../core/services/vehicle-brands.service';
import { ColorsService } from '../../../../../../core/services/colors.service';
import { SIM_CARD_TYPES } from '../../../../../../core/constants/sim-card-types.constant';
import { getApiErrorMessage } from '../../../../../../core/utils/api-error.util';

type AssistanceActionState =
  | 'done'
  | 'in_progress'
  | 'pending'
  | 'available'
  | 'locked'
  | 'not_applicable';

interface AssistanceActionDetail {
  label: string;
  state: AssistanceActionState;
}

interface AssistanceAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  state: AssistanceActionState;
  details?: AssistanceActionDetail[];
}

interface ProcessStatusView {
  label: string;
  state: 'done' | 'cancelled' | 'omitted' | 'in_progress' | 'pending';
}

interface EvidenceField {
  key: string;
  label: string;
}

interface VehicleCatalogOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-solicitud-assistance',
  templateUrl: './solicitud-assistance.component.html',
  styleUrls: ['./solicitud-assistance.component.css'],
  standalone: false,
})
export class SolicitudAssistanceComponent implements OnChanges, OnDestroy {
  @Input() visible = false;
  @Input() solicitud: Solicitud | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() solicitudUpdated = new EventEmitter<Solicitud>();

  workingSolicitud: Solicitud | null = null;
  selectedIndex = 0;
  activeActionId = '';
  refreshing = false;
  deviceLoading = false;
  currentDevice: any | null = null;
  currentCommands: Command[] = [];
  pendingVehicleCommand: 'shutdown' | 'enable' | null = null;
  deviceError = '';
  working = false;
  actionError = '';
  detailsForm: Record<string, any> = {};
  recoveryForm: Record<string, any> = {};
  inventoryQuery = '';
  inventoryDevices: InventoryItem[] = [];
  inventoryTotal = 0;
  inventoryLoading = false;
  selectedInventoryDevice: InventoryItem | null = null;
  replacementReason = '';
  simQuery = '';
  simcards: SimcardItem[] = [];
  simTotal = 0;
  simLoading = false;
  selectedSimcard: SimcardItem | null = null;
  evidenceFiles: Record<string, File | null> = {};
  cancellationMode = false;
  confirmCancellation = false;
  technicianPresenceState: TechnicianAssistancePresenceState | null = null;
  technicianPresenceLoading = false;
  technicianRefreshLoading = false;
  technicianLogoutLoading = false;
  private technicianPresenceTimer?: ReturnType<typeof setInterval>;
  vehicleBrands: VehicleCatalogOption[] = [];
  vehicleModels: VehicleCatalogOption[] = [];
  vehicleColors: VehicleCatalogOption[] = [];
  vehicleCatalogLoading = false;
  vehicleModelsLoading = false;
  private vehicleCatalogsPromise: Promise<void> | null = null;

  readonly vehicleYears: VehicleCatalogOption[] = Array.from({ length: 60 }, (_, index) => {
    const year = String(new Date().getFullYear() - index);
    return { label: year, value: year };
  });

  readonly targetCategories = [
    { label: 'Sin especificar', value: 'unspecified' },
    { label: 'Vehículo', value: 'vehicle' },
    { label: 'Objeto', value: 'object' },
    { label: 'Persona', value: 'person' },
    { label: 'Mascota', value: 'pet' },
    { label: 'Equipaje', value: 'luggage' },
  ];
  readonly yesNoOptions = [
    { label: 'No', value: 'No' },
    { label: 'Sí', value: 'Si' },
  ];
  readonly simCompanyOptions = SIM_CARD_TYPES;
  readonly connectionStatusOptions = [
    { label: 'Sin confirmar', value: '' },
    { label: 'Bien conectado', value: 'bien_conectado' },
    { label: 'Mal conectado', value: 'mal_conectado' },
  ];
  readonly resolutionOptions = [
    { label: 'Sin cambio', value: 'sin_cambio' },
    { label: 'Corregir conexión', value: 'corregir_conexion' },
    { label: 'Cambio de SIM', value: 'cambio_simcard' },
    { label: 'Cambio de GPS', value: 'cambio_gps' },
    { label: 'Requiere seguimiento', value: 'requiere_seguimiento' },
  ];
  readonly beforeEvidenceFields: EvidenceField[] = [
    { key: 'chasis_img', label: 'Chasis' },
    { key: 'placa_img', label: 'Placa' },
    { key: 'matricula_instalacion_img', label: 'Matrícula o carta de ruta' },
    { key: 'lugar_instalacion_antes_img', label: 'Lugar antes' },
    { key: 'vehiculo_exterior_antes_img', label: 'Exterior antes' },
    { key: 'vehiculo_interior_antes_img', label: 'Interior antes' },
    { key: 'gps_numeracion_img', label: 'Numeración del GPS' },
    { key: 'simcard_numeracion_img', label: 'Numeración de la SIM' },
  ];
  readonly afterEvidenceFields: EvidenceField[] = [
    { key: 'lugar_instalacion_despues_img', label: 'Lugar después' },
    { key: 'vehiculo_exterior_despues_img', label: 'Exterior después' },
    { key: 'vehiculo_interior_despues_img', label: 'Interior después' },
  ];

  constructor(
    private readonly solicitudesService: SolicitudesService,
    private readonly commandsService: CommandsService,
    private readonly inventoryService: InventoryService,
    private readonly targetsService: TargetsService,
    private readonly authService: AuthService,
    private readonly messageService: MessageService,
    private readonly vehicleBrandsService: VehicleBrandsService,
    private readonly colorsService: ColorsService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['visible'] || changes['solicitud']) && this.visible && this.solicitud) {
      this.initialize(this.solicitud);
      this.startTechnicianPresencePolling();
    } else if (changes['visible'] && !this.visible) {
      this.stopTechnicianPresencePolling();
    }
  }

  ngOnDestroy(): void {
    this.stopTechnicianPresencePolling();
  }

  get installation(): InstallationDetail | null {
    return this.workingSolicitud?.installations?.[this.selectedIndex] || null;
  }

  get processType(): string {
    const request = this.workingSolicitud;
    if (!request) return 'instalacion';
    return request.type === 'mixta'
      ? String(this.installation?.process_type || 'instalacion')
      : request.type;
  }

  get processLabel(): string {
    return this.getProcessLabel(this.processType);
  }

  get deviceType(): 'gps' | 'mtag_p' | 'mtag_a' {
    const value = String(this.installation?.device_type || 'gps')
      .trim()
      .toLowerCase()
      .replace(/[-\s]/g, '_');
    return value === 'mtag_p' || value === 'mtag_a' ? value : 'gps';
  }

  get deviceTypeLabel(): string {
    if (this.deviceType === 'mtag_p') return 'MTAG-P';
    if (this.deviceType === 'mtag_a') return 'MTAG-A';
    return 'GPS normal';
  }

  get isLocationOnly(): boolean {
    return this.deviceType !== 'gps';
  }

  get activeImei(): string {
    const installation = this.installation;
    if (!installation) return '';
    if (this.processType === 'cambio') {
      return String(installation.new_device_imei || installation.device_imei || '').trim();
    }
    if (this.processType === 'chequeo') {
      return String(
        installation.checkup_recovery?.replacement_device_imei
        || installation.new_device_imei
        || installation.device_imei
        || '',
      ).trim();
    }
    return String(installation.device_imei || '').trim();
  }

  get currentDeviceStatus(): string {
    const reported = String(
      this.currentDevice?.traccarInfo?.status
      || this.installation?.final_device_status
      || '',
    ).trim();
    if (reported) return reported;
    return this.isLocationOnly ? 'No localizado' : 'Sin consultar';
  }

  get currentDeviceOnline(): boolean {
    const status = this.currentDeviceStatus.toLowerCase();
    return ['online', 'señal débil', 'localizado', 'en línea'].includes(status);
  }

  get actions(): AssistanceAction[] {
    if (!this.installation) return [];
    if (this.processType === 'chequeo') return this.buildCheckupActions();
    return this.buildInstallationActions();
  }

  get activeAction(): AssistanceAction | null {
    if (!this.activeActionId) return null;
    return this.actions.find(action => action.id === this.activeActionId) || null;
  }

  get hasMultipleProcesses(): boolean {
    return (this.workingSolicitud?.installations?.length || 0) > 1;
  }

  get isRequestLocked(): boolean {
    return this.workingSolicitud?.locked === true;
  }

  get completedActionCount(): number {
    return this.actions.filter(action => action.state === 'done' || action.state === 'not_applicable').length;
  }

  get measurableActionCount(): number {
    return this.actions.filter(action => action.state !== 'available' && action.state !== 'locked').length;
  }

  get progressPercent(): number {
    const total = this.measurableActionCount;
    return total ? Math.round((this.completedActionCount / total) * 100) : 0;
  }

  close(): void {
    this.stopTechnicianPresencePolling();
    this.visibleChange.emit(false);
  }

  isTechnicianHere(actionId: string): boolean {
    const state = this.technicianPresenceState;
    return state?.online === true
      && state.presence?.installation_index === this.selectedIndex
      && state.presence?.action_id === actionId;
  }

  get technicianHereName(): string {
    return String(
      this.technicianPresenceState?.presence?.technician_name
      || 'El técnico',
    ).trim();
  }

  async requestTechnicianDataRefresh(): Promise<void> {
    if (this.isRequestLocked) {
      this.notifyLockedRequest();
      return;
    }
    const requestId = this.workingSolicitud?._id;
    if (!requestId || this.technicianRefreshLoading) return;
    this.technicianRefreshLoading = true;
    try {
      const response = await firstValueFrom(
        this.solicitudesService.requestTechnicianDataRefresh(requestId),
      );
      this.notify(
        response.technician_online ? 'success' : 'warn',
        response.technician_online ? 'Actualización enviada' : 'Actualización en espera',
        response.technician_online
          ? 'GPS Mobile se reiniciará y volverá a cargar los datos más recientes.'
          : 'La orden quedó pendiente y se aplicará cuando el técnico vuelva a una acción activa.',
      );
      await this.loadTechnicianPresence();
    } catch (error) {
      this.notify(
        'error',
        'No se pudo actualizar al técnico',
        getApiErrorMessage(error, 'No se pudo enviar la orden de actualización.'),
      );
    } finally {
      this.technicianRefreshLoading = false;
    }
  }

  async requestTechnicianLogout(): Promise<void> {
    if (this.isRequestLocked) {
      this.notifyLockedRequest();
      return;
    }
    const requestId = this.workingSolicitud?._id;
    if (!requestId || this.technicianLogoutLoading) return;
    this.technicianLogoutLoading = true;
    try {
      const response = await firstValueFrom(
        this.solicitudesService.requestTechnicianLogout(requestId),
      );
      this.notify(
        response.technician_online ? 'success' : 'warn',
        response.technician_online ? 'Cierre de sesión enviado' : 'Cierre de sesión en espera',
        response.technician_online
          ? 'GPS Mobile mostrará el aviso y cerrará la sesión del técnico.'
          : 'La orden quedó pendiente y se aplicará cuando el técnico vuelva a conectarse.',
      );
      await this.loadTechnicianPresence();
    } catch (error) {
      this.notify(
        'error',
        'No se pudo cerrar la sesión',
        getApiErrorMessage(error, 'No se pudo enviar la orden de cierre de sesión.'),
      );
    } finally {
      this.technicianLogoutLoading = false;
    }
  }

  selectProcess(index: number): void {
    if (index === this.selectedIndex) {
      this.backToActions();
      return;
    }
    this.selectedIndex = index;
    this.activeActionId = '';
    this.currentDevice = null;
    this.currentCommands = [];
    this.deviceError = '';
    this.resetActionWorkspace();
    this.syncForms();
    void this.loadCurrentDevice();
  }

  openAction(action: AssistanceAction, event?: Event, scrollContainer?: HTMLElement): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.isRequestLocked) {
      this.notifyLockedRequest();
      return;
    }
    this.dismissCancellation();
    this.activeActionId = action.id;
    this.actionError = '';
    if (scrollContainer) scrollContainer.scrollTop = 0;
    if (['device', 'gps'].includes(action.id) && !this.inventoryDevices.length) {
      void this.searchInventory();
    }
    if (action.id === 'sim' && !this.simcards.length) {
      void this.searchSimcards();
    }
    if (action.id === 'details' && this.deviceType !== 'mtag_p') {
      void this.ensureVehicleCatalogs();
    }
  }

  backToActions(scrollContainer?: HTMLElement): void {
    this.dismissCancellation();
    this.activeActionId = '';
    this.actionError = '';
    if (scrollContainer) scrollContainer.scrollTop = 0;
  }

  trackAction(_index: number, action: AssistanceAction): string {
    return action.id;
  }

  trackActionDetail(_index: number, detail: AssistanceActionDetail): string {
    return detail.label;
  }

  async refreshSolicitud(): Promise<void> {
    const id = this.workingSolicitud?._id;
    if (!id || this.refreshing) return;
    this.refreshing = true;
    try {
      const updated = await firstValueFrom(this.solicitudesService.getById(id));
      this.workingSolicitud = this.clone(updated);
      this.selectedIndex = Math.min(
        this.selectedIndex,
        Math.max((updated.installations?.length || 1) - 1, 0),
      );
      this.solicitudUpdated.emit(updated);
      this.syncForms();
      await this.loadCurrentDevice();
    } catch (error) {
      this.deviceError = getApiErrorMessage(error, 'No se pudo actualizar la solicitud.');
    } finally {
      this.refreshing = false;
    }
  }

  async loadCurrentDevice(): Promise<void> {
    const requestId = this.workingSolicitud?._id;
    if (!requestId || !this.activeImei || this.deviceLoading) return;
    this.deviceLoading = true;
    this.deviceError = '';
    this.currentCommands = [];
    try {
      const response = await firstValueFrom(
        this.solicitudesService.getInstallationDeviceDetails(requestId, this.selectedIndex),
      );
      this.currentDevice = response?.device || null;
      this.mergeCurrentDeviceVehicleData();
      const deviceId = String(this.currentDevice?._id || this.currentDevice?.id || '').trim();
      if (!this.currentDevice) {
        this.deviceError = `No se encontró el objetivo asociado al IMEI ${this.activeImei}.`;
      } else if (deviceId) {
        try {
          this.currentCommands = await this.commandsService.getCommandsByDevice(deviceId);
        } catch {
          this.currentCommands = [];
        }
      }
    } catch (error) {
      this.deviceError = getApiErrorMessage(error, 'No se pudo consultar el estado del dispositivo.');
    } finally {
      this.deviceLoading = false;
    }
  }

  getProcessStatus(installation: InstallationDetail): ProcessStatusView {
    if (installation.cancelled) return { label: 'Cancelado', state: 'cancelled' };
    if (installation.omitted) return { label: 'Omitido', state: 'omitted' };
    if (installation.completed) return { label: 'Realizado', state: 'done' };
    const hasProgress = Boolean(
      installation.device_imei
      || installation.new_device_imei
      || installation.diagnosis
      || installation.installation_evidence?.length,
    );
    return hasProgress
      ? { label: 'En curso', state: 'in_progress' }
      : { label: 'Pendiente', state: 'pending' };
  }

  getProcessLabel(type: string): string {
    const labels: Record<string, string> = {
      instalacion: 'Instalación',
      reinstalacion: 'Reinstalación',
      chequeo: 'Chequeo',
      cambio: 'Cambio de GPS',
      desinstalacion: 'Desinstalación',
    };
    return labels[type] || 'Proceso';
  }

  processTabClass(index: number): string {
    const item = this.workingSolicitud?.installations?.[index];
    const status = item ? this.getProcessStatus(item) : null;
    return [
      index === this.selectedIndex ? 'is-active' : '',
      status ? `is-${status.state}` : '',
    ].filter(Boolean).join(' ');
  }

  actionStateLabel(state: AssistanceActionState): string {
    const labels: Record<AssistanceActionState, string> = {
      done: 'Realizada',
      in_progress: 'En curso',
      pending: 'Pendiente',
      available: 'Disponible',
      locked: 'Aún no disponible',
      not_applicable: 'No aplica',
    };
    return labels[state];
  }

  actionStateIcon(state: AssistanceActionState): string {
    const icons: Record<AssistanceActionState, string> = {
      done: 'pi-check',
      in_progress: 'pi-spin pi-spinner',
      pending: 'pi-clock',
      available: 'pi-play',
      locked: 'pi-lock',
      not_applicable: 'pi-minus',
    };
    return icons[state];
  }

  get currentDeviceId(): string {
    return String(this.currentDevice?._id || this.currentDevice?.id || '').trim();
  }

  get canEditProcess(): boolean {
    return Boolean(
      this.installation
      && !this.isRequestLocked
      && !this.installation.completed
      && !this.installation.cancelled
      && !this.installation.omitted,
    );
  }

  get visibleBeforeEvidenceFields(): EvidenceField[] {
    if (this.deviceType === 'mtag_p') return [];
    if (this.deviceType === 'mtag_a') {
      return this.beforeEvidenceFields.filter(field => field.key !== 'simcard_numeracion_img');
    }
    return this.beforeEvidenceFields;
  }

  async searchInventory(): Promise<void> {
    if (this.inventoryLoading) return;
    this.inventoryLoading = true;
    this.actionError = '';
    try {
      const response = await firstValueFrom(
        this.inventoryService.searchInstallationDevices(
          this.inventoryQuery,
          this.deviceType,
          'available',
          1,
          50,
        ),
      );
      this.inventoryDevices = response?.data || [];
      this.inventoryTotal = Number(response?.total || 0);
      if (
        this.selectedInventoryDevice
        && !this.inventoryDevices.some(item => item._id === this.selectedInventoryDevice?._id)
      ) {
        this.selectedInventoryDevice = null;
      }
    } catch (error) {
      this.actionError = getApiErrorMessage(error, 'No se pudo consultar el inventario disponible.');
    } finally {
      this.inventoryLoading = false;
    }
  }

  selectInventoryDevice(device: InventoryItem): void {
    this.selectedInventoryDevice = device;
  }

  inventoryIdentifier(device: InventoryItem): string {
    return String(device.IMEI || device.imei || '').trim();
  }

  inventoryProtocol(device: InventoryItem): string {
    const protocol: any = device.Protocol || device.protocol;
    return String(protocol?.name || protocol?.nombre || protocol || 'Sin protocolo');
  }

  async applySelectedDevice(): Promise<void> {
    const requestId = this.workingSolicitud?._id;
    const selected = this.selectedInventoryDevice;
    const imei = selected ? this.inventoryIdentifier(selected) : '';
    if (!requestId || !selected || !imei || this.working) {
      this.notify('warn', 'Selecciona un dispositivo', 'Elige primero un equipo disponible del inventario.');
      return;
    }

    this.working = true;
    this.actionError = '';
    try {
      let response: { solicitud: Solicitud; installation: InstallationDetail; device: any };
      if (this.activeImei) {
        if (this.replacementReason.trim().length < 10) {
          this.notify('warn', 'Motivo requerido', 'Describe el motivo del cambio con al menos 10 caracteres.');
          return;
        }
        response = await firstValueFrom(
          this.solicitudesService.replaceInstallationDevice(requestId, this.selectedIndex, {
            new_imei: imei,
            expected_current_imei: this.activeImei,
            reason: this.replacementReason.trim(),
          }),
        );
      } else {
        const protocol: any = selected.Protocol || selected.protocol;
        const protocolId = String(protocol?._id || protocol?.id || protocol || '').trim();
        const sim = String(selected.SIM || selected.sim || '').trim();
        const targetName = String(this.detailsForm['target_name'] || `EN_ESPERA-${imei}`).trim();
        const configuredAt = new Date();
        const expirationDate = new Date(configuredAt);
        expirationDate.setFullYear(expirationDate.getFullYear() + 1);
        response = await firstValueFrom(
          this.solicitudesService.configureInstallationDevice(requestId, this.selectedIndex, {
            device: {
              name: targetName,
              target_category: this.detailsForm['target_category'] || 'unspecified',
              device_imei: imei,
              type: protocolId,
              sim_card_number: sim,
              sim_company: selected.sim_company || '',
              target_plate_number: this.detailsForm['plate'] || '',
              target_year: this.detailsForm['year'] || '',
              target_brand_id: this.detailsForm['brand'] || '',
              target_model_id: this.detailsForm['model'] || '',
              target_color: this.detailsForm['color'] || '',
              target_chassis_number: this.detailsForm['chassis'] || '',
              activation_date: configuredAt.toISOString(),
              expiration_date: expirationDate.toISOString().split('T')[0],
              last_change_date: configuredAt.toISOString(),
              engine_shutdown: this.detailsForm['engine_shutdown'] || 'No',
              ignition_sensor: this.detailsForm['ignition_sensor'] || 'No',
              installation_details: this.detailsForm['installation_details'] || '',
            },
            installation: {
              ...this.detailsForm,
              device_type: this.resolveInventoryDeviceType(selected),
              sim_card_number: sim,
              sim_company: selected.sim_company || '',
            },
          }),
        );
      }

      this.currentDevice = response.device;
      this.applyUpdatedSolicitud(response.solicitud);
      this.selectedInventoryDevice = null;
      this.inventoryDevices = [];
      this.replacementReason = '';
      this.notify('success', 'Dispositivo aplicado', `${imei} quedó vinculado al proceso.`);
      await this.loadCurrentDevice();
    } catch (error) {
      this.actionError = getApiErrorMessage(error, 'No se pudo aplicar el dispositivo seleccionado.');
      this.notify('error', 'No se pudo aplicar', this.actionError);
    } finally {
      this.working = false;
    }
  }

  async saveDetails(): Promise<void> {
    if (this.deviceType !== 'mtag_p') {
      const requiredVehicleFields: Array<[string, string]> = [
        ['target_name', 'nombre del objetivo'],
        ['brand', 'marca'],
        ['model', 'modelo'],
        ['plate', 'placa'],
      ];
      const missingField = requiredVehicleFields.find(([field]) =>
        !String(this.detailsForm[field] || '').trim(),
      );
      if (missingField) {
        this.notify('warn', 'Dato requerido', `Completa el campo ${missingField[1]} para continuar.`);
        return;
      }
    }

    await this.updateProgress({
      target_name: this.detailsForm['target_name'] || '',
      target_category: this.detailsForm['target_category'] || 'unspecified',
      brand: this.detailsForm['brand'] || '',
      model: this.detailsForm['model'] || '',
      year: this.detailsForm['year'] || '',
      color: this.detailsForm['color'] || '',
      plate: this.detailsForm['plate'] || '',
      chassis: this.detailsForm['chassis'] || '',
      sim_card_number: this.detailsForm['sim_card_number'] || '',
      sim_company: this.detailsForm['sim_company'] || '',
      engine_shutdown: this.detailsForm['engine_shutdown'] || 'No',
      ignition_sensor: this.detailsForm['ignition_sensor'] || 'No',
      installation_details: this.detailsForm['installation_details'] || '',
    }, undefined, 'Datos del proceso guardados.');
  }

  async onVehicleBrandChange(brandId: string): Promise<void> {
    this.detailsForm['brand'] = String(brandId || '');
    this.detailsForm['model'] = '';
    await this.loadVehicleModels(this.detailsForm['brand'], false);
  }

  async saveLocation(): Promise<void> {
    if (!this.detailsForm['installation_location']) {
      this.notify('warn', 'Selecciona el lugar', 'Indica dónde quedó instalado el dispositivo.');
      return;
    }
    await this.updateProgress(
      { installation_location: this.detailsForm['installation_location'] },
      undefined,
      'Lugar de instalación guardado.',
    );
  }

  async saveRecoveryStep(step: 'connection' | 'power'): Promise<void> {
    const recovery = {
      ...(this.installation?.checkup_recovery || {}),
      connection_checked: !!this.recoveryForm['connection_checked'],
      connection_corrected: !!this.recoveryForm['connection_corrected'],
      power_checked: !!this.recoveryForm['power_checked'],
      power_corrected: !!this.recoveryForm['power_corrected'],
    };
    if (step === 'connection') recovery.connection_checked = true;
    if (step === 'power') recovery.power_checked = true;
    await this.updateProgress({
      connection_status: this.recoveryForm['connection_status'] || undefined,
      checkup_recovery: recovery,
    }, undefined, step === 'connection' ? 'Revisión de conexión guardada.' : 'Revisión de alimentación guardada.');
  }

  async saveDiagnosis(): Promise<void> {
    const diagnosis = String(this.recoveryForm['diagnosis'] || '').trim();
    if (!diagnosis) {
      this.notify('warn', 'Diagnóstico requerido', 'Describe las pruebas realizadas y su resultado.');
      return;
    }
    await this.updateProgress({
      diagnosis,
      resolution_type: this.recoveryForm['resolution_type'] || 'sin_cambio',
      connection_status: this.recoveryForm['connection_status'] || undefined,
      checkup_recovery: {
        ...(this.installation?.checkup_recovery || {}),
        connection_checked: !!this.recoveryForm['connection_checked'],
        connection_corrected: !!this.recoveryForm['connection_corrected'],
        power_checked: !!this.recoveryForm['power_checked'],
        power_corrected: !!this.recoveryForm['power_corrected'],
      },
    }, undefined, 'Diagnóstico del chequeo guardado.');
  }

  async confirmOnlineStatus(): Promise<void> {
    await this.loadCurrentDevice();
    if (!this.currentDeviceOnline) {
      this.notify('warn', 'El GPS continúa fuera de línea', 'Puedes probar conexión, alimentación, cambio de SIM o cambio de GPS.');
      return;
    }
    const recovery = {
      ...(this.installation?.checkup_recovery || {}),
      online_confirmed: true,
      online_confirmed_at: new Date().toISOString(),
    };
    await this.updateProgress({
      connection_status: 'bien_conectado',
      checkup_recovery: recovery,
    }, undefined, 'Conexión en línea confirmada.');
  }

  async searchSimcards(): Promise<void> {
    if (this.simLoading) return;
    this.simLoading = true;
    this.actionError = '';
    try {
      const response = await firstValueFrom(
        this.inventoryService.searchInstallationSimcards(this.simQuery, 1, 100),
      );
      this.simcards = response?.data || [];
      this.simTotal = Number(response?.total || 0);
      if (this.selectedSimcard && !this.simcards.some(item => item._id === this.selectedSimcard?._id)) {
        this.selectedSimcard = null;
      }
    } catch (error) {
      this.actionError = getApiErrorMessage(error, 'No se pudo consultar el inventario de SIM cards.');
    } finally {
      this.simLoading = false;
    }
  }

  selectSimcard(simcard: SimcardItem): void {
    this.selectedSimcard = simcard;
  }

  async applySelectedSimcard(): Promise<void> {
    const selected = this.selectedSimcard;
    const replacementSim = String(selected?.iccid || '').trim();
    if (!selected || !replacementSim || !this.currentDeviceId || this.working) {
      this.notify('warn', 'Selecciona una SIM', 'Elige una SIM card disponible para continuar.');
      return;
    }
    this.working = true;
    this.actionError = '';
    try {
      const previousSim = String(
        this.currentDevice?.sim_card_number || this.installation?.sim_card_number || '',
      ).trim();
      const replacementCompany = String(selected.sim_company || '').trim();
      this.currentDevice = await this.targetsService.updateTarget(this.currentDeviceId, {
        sim_card_number: replacementSim,
        ...(replacementCompany ? { sim_company: replacementCompany } : {}),
        last_change_date: new Date().toISOString(),
      } as any);
      await this.updateProgress({
        new_sim_card_number: replacementSim,
        new_sim_company: replacementCompany,
        resolution_type: 'cambio_simcard',
        checkup_recovery: {
          ...(this.installation?.checkup_recovery || {}),
          sim_replacement_attempted: true,
          previous_sim_card_number: previousSim,
          replacement_sim_card_number: replacementSim,
          replacement_sim_company: replacementCompany,
          online_confirmed: false,
        },
      }, undefined, 'SIM reemplazada; ya puedes ejecutar la activación.', true);
      this.selectedSimcard = null;
      this.simcards = [];
      this.simQuery = '';
    } catch (error) {
      this.actionError = getApiErrorMessage(error, 'No se pudo reemplazar la SIM card.');
      this.notify('error', 'No se pudo reemplazar', this.actionError);
    } finally {
      this.working = false;
    }
  }

  async activateDevice(): Promise<void> {
    if (!this.currentDeviceId || this.isLocationOnly || this.working) return;
    this.working = true;
    this.actionError = '';
    try {
      await this.targetsService.startActivation(this.currentDeviceId);
      this.notify('success', 'Activación iniciada', 'La validación de SIM, APN, servidor y conexión continúa en segundo plano.');
      await this.loadCurrentDevice();
    } catch (error) {
      this.actionError = getApiErrorMessage(error, 'No se pudo iniciar la activación.');
      this.notify('error', 'Activación no iniciada', this.actionError);
    } finally {
      this.working = false;
    }
  }

  async sendVehicleCommand(command: 'shutdown' | 'enable'): Promise<void> {
    if (!this.currentDeviceId || this.working) return;
    const currentUser: any = this.authService.getCurrentUser();
    const creator = String(currentUser?.id || currentUser?._id || '').trim();
    if (!creator) {
      this.notify('error', 'Sesión inválida', 'No se pudo identificar al usuario que enviará el comando.');
      return;
    }
    this.working = true;
    this.pendingVehicleCommand = command;
    this.actionError = '';
    try {
      await this.commandsService.createCommand({
        name: command === 'shutdown' ? 'Apagar Vehículo' : 'Permitir Encendido',
        description: command === 'shutdown'
          ? 'Prueba de apagado enviada durante la asistencia de una instalación.'
          : 'Prueba para habilitar nuevamente el encendido.',
        observation: `Asistencia administrativa - Solicitud ${this.workingSolicitud?._id || ''}`,
        targetId: this.currentDeviceId,
        creator,
      });
      this.currentCommands = await this.commandsService.getCommandsByDevice(this.currentDeviceId);
      this.notify('success', 'Comando enviado', command === 'shutdown' ? 'Se envió la prueba de apagado.' : 'Se habilitó el encendido.');
    } catch (error) {
      this.actionError = getApiErrorMessage(error, 'No se pudo enviar el comando.');
      this.notify('error', 'Comando no enviado', this.actionError);
    } finally {
      this.working = false;
      this.pendingVehicleCommand = null;
    }
  }

  onEvidenceSelected(field: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    input.value = '';
    if (file && !file.type.startsWith('image/')) {
      this.notify('warn', 'Archivo no válido', 'Las evidencias deben ser imágenes.');
      return;
    }
    this.evidenceFiles[field] = file;
  }

  async uploadEvidence(actionId: string): Promise<void> {
    if (!this.currentDeviceId || this.working) return;
    const allowed = new Set(
      (actionId === 'before-evidence' ? this.visibleBeforeEvidenceFields : this.afterEvidenceFields)
        .map(field => field.key),
    );
    const files = Object.entries(this.evidenceFiles).reduce<Record<string, File>>((result, [field, file]) => {
      if (file && allowed.has(field)) result[field] = file;
      return result;
    }, {});
    if (!Object.keys(files).length) {
      this.notify('warn', 'Sin imágenes', 'Selecciona al menos una evidencia para subir.');
      return;
    }
    this.working = true;
    this.actionError = '';
    try {
      const response = await this.targetsService.uploadInstallationEvidence(this.currentDeviceId, files);
      this.currentDevice = response.device;
      this.evidenceFiles = {};
      const installationEvidence = this.buildEvidenceSnapshot(response.device as any);
      await this.updateProgress(
        { installation_evidence: installationEvidence },
        undefined,
        'Evidencias guardadas en el dispositivo y el proceso.',
        true,
      );
    } catch (error) {
      this.actionError = getApiErrorMessage(error, 'No se pudieron subir las evidencias.');
      this.notify('error', 'Evidencias no guardadas', this.actionError);
    } finally {
      this.working = false;
    }
  }

  async finishProcess(): Promise<void> {
    const otherProcessesDone = (this.workingSolicitud?.installations || []).every((item, index) =>
      index === this.selectedIndex || item.completed || item.cancelled || item.omitted,
    );
    const normalizedStatus = this.currentDeviceStatus.toLowerCase();
    const online = ['online', 'señal débil', 'localizado', 'en línea'].includes(normalizedStatus);
    const finalStatus = online
      ? this.currentDeviceStatus
      : this.isLocationOnly ? 'No localizado' : 'Fuera de línea';
    await this.updateProgress({
      completed: true,
      cancelled: false,
      final_device_status: finalStatus,
      final_device_online: online,
      final_device_status_at: new Date().toISOString(),
    }, otherProcessesDone ? 'por_confirmar' : 'en_progreso', `Proceso finalizado como “${finalStatus}”.`);
  }

  beginCancellation(): void {
    this.cancellationMode = true;
    this.confirmCancellation = false;
  }

  dismissCancellation(): void {
    this.cancellationMode = false;
    this.confirmCancellation = false;
  }

  async cancelProcess(): Promise<void> {
    if (!this.confirmCancellation) {
      this.notify('warn', 'Confirma la cancelación', 'Marca la casilla de confirmación antes de cancelar el proceso.');
      return;
    }
    try {
      await this.updateProgress({
        completed: false,
        cancelled: true,
        final_device_status: 'Proceso cancelado',
        final_device_online: false,
        final_device_status_at: new Date().toISOString(),
      }, 'en_progreso', 'Proceso cancelado.', true);
      this.dismissCancellation();
    } catch {
      // updateProgress already displays the API error; keep the confirmation visible for retrying.
    }
  }

  private initialize(solicitud: Solicitud): void {
    this.workingSolicitud = this.clone(solicitud);
    this.technicianPresenceState = null;
    this.selectedIndex = Math.min(
      this.selectedIndex,
      Math.max((solicitud.installations?.length || 1) - 1, 0),
    );
    this.activeActionId = '';
    this.currentDevice = null;
    this.currentCommands = [];
    this.deviceError = '';
    this.resetActionWorkspace();
    this.syncForms();
    void this.loadCurrentDevice();
  }

  private buildInstallationActions(): AssistanceAction[] {
    const installation = this.installation || {};
    const isMtagP = this.deviceType === 'mtag_p';
    const isChange = this.processType === 'cambio';
    const deviceSelected = Boolean(this.activeImei);
    const dataDone = isMtagP
      ? Boolean(installation.target_name || this.currentDevice?.name)
      : Boolean(
        installation.target_name
        || installation.plate
        || installation.chassis
        || installation.brand
        || this.currentDevice?.name,
      );
    const beforeEvidence = this.evidenceDetails([
      ['chasis_img', 'Foto del chasis'],
      ['placa_img', 'Foto de la placa'],
      ['matricula_instalacion_img', 'Matrícula o carta de ruta'],
      ['lugar_instalacion_antes_img', 'Lugar antes de instalar'],
      ['vehiculo_exterior_antes_img', 'Exterior antes'],
      ['vehiculo_interior_antes_img', 'Interior antes'],
      ['gps_numeracion_img', 'Numeración del GPS'],
      ...(this.deviceType === 'gps'
        ? [['simcard_numeracion_img', 'Numeración de la SIM'] as [string, string]]
        : []),
    ]);
    const afterEvidence = this.evidenceDetails([
      ['lugar_instalacion_despues_img', 'Lugar después de instalar'],
      ['vehiculo_exterior_despues_img', 'Exterior después'],
      ['vehiculo_interior_despues_img', 'Interior después'],
    ]);
    const activationDetails = this.activationDetails();
    const activationState = this.activationState(activationDetails);
    const shutdownDone = this.hasRequestCommand('Apagar Vehículo');
    const enableDone = this.hasRequestCommand('Permitir Encendido');
    const processClosed = Boolean(installation.completed || installation.cancelled || installation.omitted);

    return [
      {
        id: 'device',
        title: isChange ? 'Seleccionar el GPS de reemplazo' : 'Seleccionar y configurar el dispositivo',
        description: isChange
          ? 'Elegir el nuevo equipo y conservar el IMEI anterior en el proceso.'
          : 'Buscar el equipo en inventario y vincularlo al objetivo.',
        icon: 'pi-microchip',
        state: deviceSelected ? 'done' : 'pending',
        details: [
          { label: deviceSelected ? `Dispositivo ${this.activeImei}` : 'Dispositivo sin seleccionar', state: deviceSelected ? 'done' : 'pending' },
        ],
      },
      {
        id: 'details',
        title: isMtagP ? 'Completar datos del objetivo' : 'Completar datos del vehículo y la instalación',
        description: isMtagP
          ? 'Nombre y categoría del objeto, persona, mascota o equipaje.'
          : 'Nombre, vehículo, SIM y características de la instalación.',
        icon: 'pi-pencil',
        state: dataDone ? 'done' : deviceSelected ? 'in_progress' : 'pending',
        details: this.targetDataDetails(),
      },
      {
        id: 'before-evidence',
        title: 'Registrar evidencias antes de instalar',
        description: isMtagP
          ? 'GPS Mobile omite las fotografías previas para MTAG-P.'
          : 'Chasis, placa, matrícula, vehículo y numeraciones del equipo.',
        icon: 'pi-camera',
        state: isMtagP ? 'not_applicable' : this.collectionState(beforeEvidence),
        details: isMtagP
          ? [{ label: 'Este paso no se muestra para MTAG-P', state: 'not_applicable' }]
          : beforeEvidence,
      },
      {
        id: 'activation',
        title: this.isLocationOnly ? 'Esperar y comprobar la localización' : 'Activar el GPS',
        description: this.isLocationOnly
          ? 'Confirmar que el MTAG ya reportó su primera posición.'
          : 'Validar SIM, configurar APN y servidor, y verificar conexión.',
        icon: this.isLocationOnly ? 'pi-map-marker' : 'pi-bolt',
        state: this.isLocationOnly
          ? (this.currentDeviceOnline ? 'done' : deviceSelected ? 'in_progress' : 'pending')
          : activationState,
        details: this.isLocationOnly
          ? [{ label: this.currentDeviceOnline ? `Localizado: ${this.currentDeviceStatus}` : 'Esperando primera localización', state: this.currentDeviceOnline ? 'done' : 'in_progress' }]
          : activationDetails,
      },
      {
        id: 'shutdown',
        title: 'Probar apagado del vehículo',
        description: 'Probar el corte y permitir nuevamente el encendido antes de entregar el vehículo.',
        icon: 'pi-power-off',
        state: this.deviceType === 'gps'
          ? shutdownDone && enableDone
            ? 'done'
            : shutdownDone || enableDone
              ? 'in_progress'
              : 'available'
          : 'not_applicable',
        details: this.deviceType === 'gps'
          ? [
              { label: 'Comando Apagar Vehículo', state: shutdownDone ? 'done' : 'available' },
              { label: 'Comando Permitir Encendido', state: enableDone ? 'done' : 'available' },
            ]
          : [{ label: 'Los MTAG no ejecutan comandos de motor', state: 'not_applicable' }],
      },
      {
        id: 'location',
        title: 'Registrar el lugar de instalación',
        description: isMtagP
          ? 'MTAG-P no requiere una ubicación fija dentro de un vehículo.'
          : 'Indicar dónde quedó instalado físicamente el dispositivo.',
        icon: 'pi-map-marker',
        state: isMtagP ? 'not_applicable' : installation.installation_location ? 'done' : 'pending',
        details: [{
          label: isMtagP
            ? 'Sin lugar fijo'
            : installation.installation_location || 'Lugar aún no registrado',
          state: isMtagP ? 'not_applicable' : installation.installation_location ? 'done' : 'pending',
        }],
      },
      {
        id: 'after-evidence',
        title: 'Registrar evidencias después de instalar',
        description: isMtagP
          ? 'GPS Mobile finaliza MTAG-P sin fotografías posteriores.'
          : 'Lugar de instalación y estado exterior e interior al terminar.',
        icon: 'pi-images',
        state: isMtagP ? 'not_applicable' : this.collectionState(afterEvidence),
        details: isMtagP
          ? [{ label: 'Este paso no se muestra para MTAG-P', state: 'not_applicable' }]
          : afterEvidence,
      },
      {
        id: 'finish',
        title: 'Finalizar o cancelar el proceso',
        description: 'Guardar el estado final del dispositivo, incluso si queda fuera de línea o no localizado.',
        icon: installation.cancelled ? 'pi-times-circle' : 'pi-check-circle',
        state: processClosed ? 'done' : 'pending',
        details: [{
          label: installation.cancelled
            ? 'Proceso cancelado'
            : installation.completed
              ? `Proceso finalizado: ${installation.final_device_status || 'sin estado final'}`
              : 'Cierre pendiente',
          state: processClosed ? 'done' : 'pending',
        }],
      },
    ];
  }

  private buildCheckupActions(): AssistanceAction[] {
    const installation = this.installation || {};
    const recovery = installation.checkup_recovery || {};
    const processClosed = Boolean(installation.completed || installation.cancelled || installation.omitted);
    const replacementImei = String(recovery.replacement_device_imei || '').trim();
    const gpsChangeAvailable = installation.completed === true
      && ['por_confirmar', 'completada'].includes(String(this.workingSolicitud?.status || ''));

    return [
      {
        id: 'device',
        title: 'Revisar el dispositivo del chequeo',
        description: 'Abrir el GPS registrado y consultar su estado en vivo.',
        icon: 'pi-microchip',
        state: this.activeImei ? 'done' : 'pending',
        details: [{ label: this.activeImei || 'IMEI no registrado', state: this.activeImei ? 'done' : 'pending' }],
      },
      {
        id: 'connection',
        title: 'Verificar o corregir la conexión',
        description: 'Comprobar cableado, terminales y conexiones físicas.',
        icon: 'pi-link',
        state: recovery.connection_checked ? 'done' : processClosed ? 'available' : 'pending',
        details: [
          { label: 'Conexión revisada', state: recovery.connection_checked ? 'done' : 'pending' },
          { label: recovery.connection_corrected ? 'Conexión corregida' : 'No se registró corrección', state: recovery.connection_corrected ? 'done' : 'available' },
        ],
      },
      {
        id: 'power',
        title: 'Verificar o corregir la alimentación',
        description: 'Confirmar que el GPS recibe voltaje estable y permanece encendido.',
        icon: 'pi-bolt',
        state: recovery.power_checked ? 'done' : processClosed ? 'available' : 'pending',
        details: [
          { label: 'Alimentación revisada', state: recovery.power_checked ? 'done' : 'pending' },
          { label: recovery.power_corrected ? 'Alimentación corregida' : 'No se registró corrección', state: recovery.power_corrected ? 'done' : 'available' },
        ],
      },
      {
        id: 'sim',
        title: 'Cambiar la SIM y volver a activar',
        description: 'Seleccionar una SIM disponible, vincularla al GPS y ejecutar la activación.',
        icon: 'pi-credit-card',
        state: recovery.sim_replacement_attempted ? 'done' : 'available',
        details: [
          { label: recovery.replacement_sim_card_number ? `Nueva SIM: ${recovery.replacement_sim_card_number}` : 'Cambio de SIM opcional', state: recovery.sim_replacement_attempted ? 'done' : 'available' },
        ],
      },
      {
        id: 'gps',
        title: 'Cambiar el GPS',
        description: 'Elegir otro equipo cuando el dispositivo no logra recuperarse.',
        icon: 'pi-sync',
        state: recovery.gps_replacement_attempted || replacementImei ? 'done' : 'available',
        details: [
          { label: replacementImei ? `Reemplazo: ${replacementImei}` : 'Cambio de GPS opcional', state: recovery.gps_replacement_attempted || replacementImei ? 'done' : 'available' },
        ],
      },
      {
        id: 'online',
        title: 'Confirmar que el GPS volvió en línea',
        description: 'Consultar el dispositivo después de cualquiera de las pruebas de recuperación.',
        icon: 'pi-wifi',
        state: recovery.online_confirmed || this.currentDeviceOnline ? 'done' : processClosed ? 'available' : 'pending',
        details: [{
          label: recovery.online_confirmed || this.currentDeviceOnline
            ? `Conexión confirmada: ${this.currentDeviceStatus}`
            : 'No se confirmó conexión en línea',
          state: recovery.online_confirmed || this.currentDeviceOnline ? 'done' : 'pending',
        }],
      },
      {
        id: 'diagnosis',
        title: 'Registrar el diagnóstico',
        description: 'Documentar las pruebas, el estado de conexión y la resolución aplicada.',
        icon: 'pi-file-edit',
        state: installation.diagnosis ? 'done' : 'pending',
        details: [
          { label: installation.diagnosis || 'Diagnóstico pendiente', state: installation.diagnosis ? 'done' : 'pending' },
          { label: installation.resolution_type ? `Resolución: ${installation.resolution_type}` : 'Resolución sin registrar', state: installation.resolution_type ? 'done' : 'pending' },
        ],
      },
      {
        id: 'finish',
        title: 'Finalizar el chequeo',
        description: 'Cerrar en línea o fuera de línea y conservar el estado final.',
        icon: installation.cancelled ? 'pi-times-circle' : 'pi-check-circle',
        state: processClosed ? 'done' : 'pending',
        details: [{
          label: installation.cancelled
            ? 'Chequeo cancelado'
            : installation.completed
              ? `Chequeo finalizado: ${installation.final_device_status || 'sin estado final'}`
              : 'Cierre pendiente',
          state: processClosed ? 'done' : 'pending',
        }],
      },
      {
        id: 'start-change',
        title: 'Realizar cambio de GPS',
        description: 'Después de cerrar el chequeo, Mobile puede crear un proceso de cambio enlazado sin duplicarlo.',
        icon: 'pi-arrow-right-arrow-left',
        state: gpsChangeAvailable ? 'available' : 'locked',
        details: [{
          label: gpsChangeAvailable ? 'Disponible al técnico asignado' : 'Se habilita después de finalizar el chequeo',
          state: gpsChangeAvailable ? 'available' : 'locked',
        }],
      },
    ];
  }

  private targetDataDetails(): AssistanceActionDetail[] {
    const installation = this.installation || {};
    if (this.deviceType === 'mtag_p') {
      return [
        { label: installation.target_name ? `Nombre: ${installation.target_name}` : 'Nombre del objetivo', state: installation.target_name ? 'done' : 'pending' },
        { label: installation.target_category ? `Categoría: ${installation.target_category}` : 'Categoría del objetivo', state: installation.target_category ? 'done' : 'pending' },
      ];
    }
    return [
      { label: installation.target_name ? `Nombre: ${installation.target_name}` : 'Nombre del objetivo', state: installation.target_name ? 'done' : 'pending' },
      { label: installation.plate ? `Placa: ${installation.plate}` : 'Placa', state: installation.plate ? 'done' : 'pending' },
      { label: installation.chassis ? `Chasis: ${installation.chassis}` : 'Chasis', state: installation.chassis ? 'done' : 'pending' },
      { label: installation.sim_card_number || installation.new_sim_card_number ? 'SIM registrada' : 'SIM', state: installation.sim_card_number || installation.new_sim_card_number ? 'done' : 'pending' },
    ];
  }

  private evidenceDetails(fields: Array<[string, string]>): AssistanceActionDetail[] {
    return fields.map(([field, label]) => ({
      label,
      state: this.hasEvidence(field) ? 'done' : 'pending',
    }));
  }

  hasEvidence(field: string): boolean {
    const processEvidence = this.installation?.installation_evidence || [];
    if (processEvidence.some(item => item.field === field && Boolean(item.url))) return true;
    const deviceValue = this.currentDevice?.[field];
    return typeof deviceValue === 'string' ? Boolean(deviceValue) : Boolean(deviceValue?.url);
  }

  private collectionState(details: AssistanceActionDetail[]): AssistanceActionState {
    if (details.every(detail => detail.state === 'done')) return 'done';
    if (details.some(detail => detail.state === 'done')) return 'in_progress';
    return 'pending';
  }

  private activationDetails(): AssistanceActionDetail[] {
    const savedSteps = Array.isArray(this.currentDevice?.activation_status?.steps)
      ? this.currentDevice.activation_status.steps
      : [];
    const defaults = [
      'Validar SIM',
      'Configurar APN',
      'Configurar Servidor',
      'Verificar Conexión',
    ];
    return defaults.map(label => {
      const saved = savedSteps.find((step: any) =>
        String(step?.label || '').trim().toLowerCase() === label.toLowerCase(),
      );
      const status = String(saved?.status || '').trim().toLowerCase();
      const state: AssistanceActionState = ['success', 'completed', 'done'].includes(status)
        ? 'done'
        : ['running', 'processing', 'in_progress'].includes(status)
          ? 'in_progress'
          : 'pending';
      return { label, state };
    });
  }

  private activationState(details: AssistanceActionDetail[]): AssistanceActionState {
    const activation = this.currentDevice?.activation_status;
    const hasErrors = details.some(detail => detail.state === 'pending')
      && Array.isArray(activation?.steps)
      && activation.steps.some((step: any) => String(step?.status || '').toLowerCase() === 'error');
    if ((activation?.completed && !hasErrors) || (!activation && this.currentDeviceOnline)) return 'done';
    if (activation && !activation.completed) return 'in_progress';
    if (details.some(detail => detail.state === 'done')) return 'in_progress';
    return this.activeImei ? 'pending' : 'locked';
  }

  private hasRequestCommand(name: string): boolean {
    const requestId = String(this.workingSolicitud?._id || '').trim();
    return this.currentCommands.some(command => {
      if (String(command.name || '').trim().toLowerCase() !== name.toLowerCase()) return false;
      const observation = String(command.observation || '');
      return requestId ? observation.includes(requestId) : false;
    });
  }

  private syncForms(): void {
    const installation = this.installation || {};
    this.detailsForm = {
      target_name: installation.target_name || this.currentDevice?.name || '',
      target_category: installation.target_category || 'unspecified',
      brand: installation.brand || this.currentDevice?.target_brand_id || '',
      model: installation.model || this.currentDevice?.target_model_id || '',
      year: installation.year || this.currentDevice?.target_year || '',
      color: installation.color || this.currentDevice?.target_color || '',
      plate: installation.plate || this.currentDevice?.target_plate_number || '',
      chassis: installation.chassis || this.currentDevice?.target_chassis_number || '',
      sim_card_number: installation.new_sim_card_number || installation.sim_card_number || '',
      sim_company: this.normalizeSimCompany(
        installation.new_sim_company
        || installation.sim_company
        || this.currentDevice?.sim_company
        || '',
      ),
      engine_shutdown: installation.engine_shutdown || this.currentDevice?.engine_shutdown || 'No',
      ignition_sensor: installation.ignition_sensor || this.currentDevice?.ignition_sensor || 'No',
      installation_details: installation.installation_details || this.currentDevice?.installation_details || '',
      installation_location: installation.installation_location || this.currentDevice?.installation_location || '',
    };
    if (this.vehicleBrands.length) {
      void this.normalizeAndLoadCurrentVehicleCatalogValues();
    }
    this.recoveryForm = {
      diagnosis: installation.diagnosis || '',
      resolution_type: installation.resolution_type || 'sin_cambio',
      connection_status: installation.connection_status || '',
      ...(installation.checkup_recovery || {}),
    };
  }

  private resetActionWorkspace(): void {
    this.actionError = '';
    this.inventoryQuery = '';
    this.inventoryDevices = [];
    this.inventoryTotal = 0;
    this.selectedInventoryDevice = null;
    this.replacementReason = '';
    this.simQuery = '';
    this.simcards = [];
    this.simTotal = 0;
    this.selectedSimcard = null;
    this.evidenceFiles = {};
    this.dismissCancellation();
    this.pendingVehicleCommand = null;
  }

  private startTechnicianPresencePolling(): void {
    this.stopTechnicianPresencePolling();
    void this.loadTechnicianPresence();
    this.technicianPresenceTimer = setInterval(
      () => void this.loadTechnicianPresence(),
      3_000,
    );
  }

  private stopTechnicianPresencePolling(): void {
    if (this.technicianPresenceTimer) {
      clearInterval(this.technicianPresenceTimer);
      this.technicianPresenceTimer = undefined;
    }
    this.technicianPresenceLoading = false;
  }

  private async loadTechnicianPresence(): Promise<void> {
    const requestId = this.workingSolicitud?._id;
    if (!requestId || this.technicianPresenceLoading || !this.visible) return;
    this.technicianPresenceLoading = true;
    try {
      this.technicianPresenceState = await firstValueFrom(
        this.solicitudesService.getTechnicianAssistancePresence(requestId),
      );
    } catch {
      this.technicianPresenceState = null;
    } finally {
      this.technicianPresenceLoading = false;
    }
  }

  private async ensureVehicleCatalogs(): Promise<void> {
    if (!this.vehicleCatalogsPromise) {
      this.vehicleCatalogsPromise = this.loadVehicleCatalogs().catch(error => {
        this.vehicleCatalogsPromise = null;
        throw error;
      });
    }
    try {
      await this.vehicleCatalogsPromise;
      await this.normalizeAndLoadCurrentVehicleCatalogValues();
    } catch (error) {
      this.actionError = getApiErrorMessage(error, 'No se pudieron cargar las marcas, modelos y colores.');
    }
  }

  private async loadVehicleCatalogs(): Promise<void> {
    this.vehicleCatalogLoading = true;
    try {
      const [brands, colors] = await Promise.all([
        this.vehicleBrandsService.getAllBrands(),
        this.colorsService.getAllColors(),
      ]);
      this.vehicleBrands = this.toCatalogOptions(brands, 'nombre', '_id');
      this.vehicleColors = this.toCatalogOptions(colors, 'nombre', 'hex');
    } finally {
      this.vehicleCatalogLoading = false;
    }
  }

  private async normalizeAndLoadCurrentVehicleCatalogValues(): Promise<void> {
    this.detailsForm['brand'] = this.normalizeCatalogValue(
      this.vehicleBrands,
      this.detailsForm['brand'],
    );
    this.detailsForm['color'] = this.normalizeCatalogValue(
      this.vehicleColors,
      this.detailsForm['color'],
    );
    await this.loadVehicleModels(this.detailsForm['brand'], true);
  }

  private async loadVehicleModels(brandId: string, preserveSelection: boolean): Promise<void> {
    const normalizedBrandId = String(brandId || '').trim();
    const selectedModel = preserveSelection ? String(this.detailsForm['model'] || '') : '';
    if (!normalizedBrandId) {
      this.vehicleModels = [];
      this.detailsForm['model'] = '';
      return;
    }

    this.vehicleModelsLoading = true;
    try {
      const models = await this.vehicleBrandsService.getAllModelsByBrand(normalizedBrandId);
      if (String(this.detailsForm['brand'] || '') !== normalizedBrandId) return;
      this.vehicleModels = this.toCatalogOptions(models, 'nombre', '_id');
      this.detailsForm['model'] = preserveSelection
        ? this.normalizeCatalogValue(this.vehicleModels, selectedModel)
        : '';
    } catch (error) {
      if (String(this.detailsForm['brand'] || '') === normalizedBrandId) {
        this.vehicleModels = [];
        this.detailsForm['model'] = '';
      }
      this.actionError = getApiErrorMessage(error, 'No se pudieron cargar los modelos de esta marca.');
    } finally {
      this.vehicleModelsLoading = false;
    }
  }

  private toCatalogOptions(items: any, labelField: string, valueField: string): VehicleCatalogOption[] {
    return (Array.isArray(items) ? items : [])
      .map(item => ({
        label: String(item?.[labelField] || '').trim(),
        value: String(item?.[valueField] || '').trim(),
      }))
      .filter(item => item.label && item.value)
      .sort((left, right) => left.label.localeCompare(right.label));
  }

  private normalizeCatalogValue(options: VehicleCatalogOption[], rawValue: unknown): string {
    const value = String(rawValue || '').trim();
    if (!value) return '';
    const normalized = value.toLocaleLowerCase();
    return options.find(option =>
      option.value.toLocaleLowerCase() === normalized
      || option.label.toLocaleLowerCase() === normalized,
    )?.value || '';
  }

  private normalizeSimCompany(rawValue: unknown): string {
    const value = String(rawValue || '').trim().toLocaleLowerCase();
    if (!value) return '';
    return this.simCompanyOptions.find(option =>
      option.value.toLocaleLowerCase() === value
      || option.label.toLocaleLowerCase() === value,
    )?.value || '';
  }

  private mergeCurrentDeviceVehicleData(): void {
    if (!this.currentDevice) return;
    const deviceValues: Record<string, any> = {
      target_name: this.currentDevice.name,
      brand: this.currentDevice.target_brand_id,
      model: this.currentDevice.target_model_id,
      year: this.currentDevice.target_year,
      color: this.currentDevice.target_color,
      plate: this.currentDevice.target_plate_number,
      chassis: this.currentDevice.target_chassis_number,
      engine_shutdown: this.currentDevice.engine_shutdown,
      ignition_sensor: this.currentDevice.ignition_sensor,
      installation_details: this.currentDevice.installation_details,
      installation_location: this.currentDevice.installation_location,
    };
    Object.entries(deviceValues).forEach(([field, value]) => {
      if (!this.detailsForm[field] && value !== undefined && value !== null) {
        this.detailsForm[field] = value;
      }
    });
    if (this.vehicleBrands.length) {
      void this.normalizeAndLoadCurrentVehicleCatalogValues();
    }
  }

  private async updateProgress(
    changes: Record<string, any>,
    status: string | undefined,
    successMessage: string,
    rethrow = false,
  ): Promise<void> {
    if (this.isRequestLocked) {
      this.notifyLockedRequest();
      return;
    }
    const requestId = this.workingSolicitud?._id;
    if (!requestId) return;
    const wasWorking = this.working;
    this.working = true;
    this.actionError = '';
    try {
      const response = await firstValueFrom(
        this.solicitudesService.updateInstallationProgress(
          requestId,
          this.selectedIndex,
          changes,
          status,
          this.workingSolicitud?.__v,
        ),
      );
      this.applyUpdatedSolicitud(response.solicitud);
      this.notify('success', 'Asistencia aplicada', successMessage);
      (response.operation_warnings || []).forEach(warning =>
        this.notify('warn', 'Proceso guardado con advertencia', warning),
      );
    } catch (error) {
      this.actionError = getApiErrorMessage(error, 'No se pudieron guardar los cambios del proceso.');
      this.notify('error', 'No se pudo guardar', this.actionError);
      if (this.actionError.toLowerCase().includes('actualizada desde otro')) {
        await this.refreshSolicitud();
      }
      if (rethrow) throw error;
    } finally {
      this.working = wasWorking;
    }
  }

  private applyUpdatedSolicitud(solicitud: Solicitud): void {
    this.workingSolicitud = this.clone(solicitud);
    this.syncForms();
    this.solicitudUpdated.emit(solicitud);
  }

  private notifyLockedRequest(): void {
    this.notify(
      'warn',
      'Solicitud bloqueada',
      'Desbloquea la solicitud antes de ejecutar acciones o actualizar al técnico.',
    );
  }

  private buildEvidenceSnapshot(device: any): Array<{
    field: string;
    label: string;
    url: string;
    uploaded_at?: string;
  }> {
    const fields = [...this.beforeEvidenceFields, ...this.afterEvidenceFields];
    return fields.reduce<Array<{
      field: string;
      label: string;
      url: string;
      uploaded_at?: string;
    }>>((result, field) => {
      const evidence = device?.[field.key];
      const url = typeof evidence === 'string' ? evidence : evidence?.url;
      if (!url) return result;
      result.push({
        field: field.key,
        label: evidence?.label || field.label,
        url,
        ...(evidence?.uploaded_at ? { uploaded_at: evidence.uploaded_at } : {}),
      });
      return result;
    }, []);
  }

  private resolveInventoryDeviceType(device: InventoryItem): 'gps' | 'mtag_p' | 'mtag_a' {
    const protocol: any = device.Protocol || device.protocol;
    const compact = String(protocol?.name || protocol?.nombre || protocol || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/gi, '')
      .toUpperCase();
    if (compact === 'MTAGP') return 'mtag_p';
    if (compact === 'MTAGA' || protocol?.isAirtag === true) return 'mtag_a';
    return 'gps';
  }

  private notify(severity: string, summary: string, detail: string): void {
    this.messageService.add({ severity, summary, detail, life: 5000 });
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
  }
}
