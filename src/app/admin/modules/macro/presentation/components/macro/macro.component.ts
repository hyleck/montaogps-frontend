import { DeviceLabelMessageService } from 'src/app/shareds/services/device-label-messages.service';
import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { MenuItem, MessageService } from 'primeng/api';
import { debounceTime, Subject } from 'rxjs';
import { MacroService, DeviceDto } from 'src/app/core/services/macro.service';
import { ProtocolsService } from 'src/app/core/services/protocols.service';
import { UserService } from 'src/app/core/services/user.service';
import { environment } from 'src/environments/environment';
import { getApiErrorMessage } from '../../../../../../core/utils/api-error.util';

@Component({
  selector: 'app-macro',
  templateUrl: './macro.component.html',
  styleUrls: ['./macro.component.css'],
  standalone: false,
  providers: [{ provide: MessageService, useClass: DeviceLabelMessageService }],
})
export class MacroComponent implements OnInit {
  items: MenuItem[] = [{ label: 'Macro' }];
  home: MenuItem = { icon: 'pi pi-home', routerLink: '/admin/dashboard' };
  devices: DeviceDto[] = [];
  loading = true;
  limit = 50;
  commandIndex = 0;
  selectedAction = '';
  showProcessDialog = false;
  showSmsDialog = false;
  selectedProcessType = '';
  processForm: any = {
    newGpsModel: '',
    newTechnician: '',
    newExpirationDate: '',
    description: '',
  };
  availableGpsModels: any[] = [];
  availableTechnicians: any[] = [];
  private readonly limitChangeSubject = new Subject<void>();

  actionItems: MenuItem[] = [
    { label: 'Ejecutar proceso', icon: 'pi pi-play', command: () => this.executeProcess() },
    { label: 'Enviar SMS', icon: 'pi pi-send', command: () => this.sendSMS() },
  ];

  constructor(
    private readonly http: HttpClient,
    private readonly macroService: MacroService,
    private readonly protocolsService: ProtocolsService,
    private readonly userService: UserService,
    private readonly translate: TranslateService,
    private readonly messageService: MessageService,
  ) {}

  ngOnInit(): void {
    this.loadGpsModels();
    this.loadTechnicians();
    this.loadDevices();
    this.limitChangeSubject.pipe(debounceTime(500)).subscribe(() => this.loadDevices());
  }

  loadDevices(): void {
    this.loading = true;
    this.macroService.getDevices(this.limit, this.commandIndex).subscribe({
      next: devices => {
        this.devices = devices;
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: getApiErrorMessage(error, 'No se pudieron cargar los dispositivos') });
      },
    });
  }

  onLimitChange(): void {
    this.limitChangeSubject.next();
  }

  onCommandIndexChange(): void {
    this.loadDevices();
  }

  onActionSelected(): void {
    if (this.selectedAction === 'execute_process') this.executeProcess();
    if (this.selectedAction === 'send_sms') this.sendSMS();
    this.selectedAction = '';
  }

  executeProcess(): void {
    if (!this.devices.length) {
      this.messageService.add({ severity: 'warn', summary: 'Sin dispositivos', detail: 'No hay dispositivos disponibles para ejecutar procesos' });
      return;
    }
    this.showProcessDialog = true;
  }

  closeProcessDialog(): void {
    this.showProcessDialog = false;
  }

  executeProcessOnDevices(): void {
    this.messageService.add({
      severity: 'info',
      summary: 'Proceso no implementado',
      detail: `El proceso "${this.getProcessTypeName()}" aún no está implementado`,
    });
    this.closeProcessDialog();
  }

  sendSMS(): void {
    if (!this.devices.length) {
      this.messageService.add({ severity: 'warn', summary: 'Sin dispositivos', detail: 'No hay dispositivos disponibles para enviar SMS' });
      return;
    }
    this.showSmsDialog = true;
  }

  closeSmsDialog(): void {
    this.showSmsDialog = false;
  }

  sendSmsToDevices(): void {
    const params: Record<string, string> = {
      limit: String(this.limit),
      commandIndex: String(this.commandIndex),
    };
    this.http.post<{ message: string }>(`${environment.apiUrl}/macro/sendsms`, {}, { params }).subscribe({
      next: response => {
        this.messageService.add({ severity: 'success', summary: 'SMS enviado', detail: response.message });
        this.closeSmsDialog();
      },
      error: (error) => {
        this.messageService.add({ severity: 'error', summary: 'Error al enviar SMS', detail: getApiErrorMessage(error, 'No se pudo completar el envío de SMS.') });
        this.closeSmsDialog();
      },
    });
  }

  loadGpsModels(): void {
    this.protocolsService.getAllProtocols().subscribe({
      next: protocols => {
        this.availableGpsModels = protocols.map((protocol: any) => ({ value: protocol._id, label: protocol.name || protocol._id }));
      },
      error: () => (this.availableGpsModels = []),
    });
  }

  loadTechnicians(): void {
    this.userService.getTechnicians().subscribe({
      next: technicians => {
        this.availableTechnicians = technicians.map((technician: any) => ({
          value: technician._id,
          label: `${technician.name} ${technician.last_name}`.trim(),
        }));
      },
      error: () => (this.availableTechnicians = []),
    });
  }

  onProcessTypeChange(): void {
    this.processForm = { newGpsModel: '', newTechnician: '', newExpirationDate: '', description: '' };
  }

  getProcessTypeName(): string {
    return {
      gps_model_change: 'Cambio de modelo de GPS',
      technician_change: 'Cambio de técnico',
      renewal: 'Renovación',
    }[this.selectedProcessType] || 'Sin seleccionar';
  }

  isProcessFormValid(): boolean {
    if (this.selectedProcessType === 'gps_model_change') return !!this.processForm.newGpsModel;
    if (this.selectedProcessType === 'technician_change') return !!this.processForm.newTechnician;
    if (this.selectedProcessType === 'renewal') return !!this.processForm.newExpirationDate;
    return false;
  }

  translateKey(key: string): string {
    return this.translate.instant(key);
  }
}
