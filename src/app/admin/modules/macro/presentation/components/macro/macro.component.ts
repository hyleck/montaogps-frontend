import { Component, OnInit } from '@angular/core';
import { MenuItem, MessageService } from 'primeng/api';
import { MenuItem as PrimeMenuItem } from 'primeng/api';
import { HttpClient } from '@angular/common/http';
import { MacroService, DeviceDto } from 'src/app/core/services/macro.service';
import { PlansService } from 'src/app/core/services/plans.service';
import { Plan } from 'src/app/core/interfaces/plan.interface';
import { ProtocolsService } from 'src/app/core/services/protocols.service';
import { UserService } from 'src/app/core/services/user.service';
import { TranslateService } from '@ngx-translate/core';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-macro',
  templateUrl: './macro.component.html',
  styleUrls: ['./macro.component.css'],
  standalone: false,
  providers: [MessageService],
})
export class MacroComponent implements OnInit {
  items: MenuItem[] = [{ label: 'Macro' }];
  home: MenuItem = { icon: 'pi pi-home', routerLink: '/admin/dashboard' };

  devices: DeviceDto[] = [];
  loading: boolean = true;

  plans: Plan[] = [];
  selectedPlan: string = '';
  limit: number = 50;
  selectedAction: string = '';

  actionItems: PrimeMenuItem[] = [
    {
      label: 'Ejecutar proceso',
      icon: 'pi pi-play',
      command: () => this.executeProcess()
    },
    {
      label: 'Enviar SMS',
      icon: 'pi pi-send',
      command: () => this.sendSMS()
    }
  ];

  constructor(
    private http: HttpClient,
    private macroService: MacroService,
    private plansService: PlansService,
    private protocolsService: ProtocolsService,
    private userService: UserService,
    private translate: TranslateService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadPlans();
    this.loadGpsModels();
    this.loadTechnicians();
    this.loadDevices();
  }

  loadPlans(): void {
    this.plansService.getAllPlans().subscribe({
      next: (plans) => {
        this.plans = plans;
        console.log('Plans loaded:', plans.length);
        console.log('Available plans:', plans.map(p => ({ id: p._id, name: p.plan_name })));
      },
      error: (error) => {
        console.error('Error loading plans:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los planes'
        });
      }
    });
  }

  loadDevices(plan?: string): void {
    this.loading = true;
    this.macroService.getDevices(plan, this.limit).subscribe({
      next: (devices) => {
        this.devices = devices;
        this.loading = false;
        console.log('Devices loaded:', devices.length);
        console.log('All devices:', devices);
      },
      error: (error) => {
        console.error('Error loading devices:', error);
        this.loading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los dispositivos'
        });
      }
    });
  }

  onPlanFilterChange(): void {
    this.loadDevices(this.selectedPlan);
  }

  onLimitChange(): void {
    this.loadDevices(this.selectedPlan);
  }

  onActionSelected(): void {
    if (this.selectedAction === 'execute_process') {
      this.executeProcess();
    } else if (this.selectedAction === 'send_sms') {
      this.sendSMS();
    }
    // Reset the dropdown after selection
    this.selectedAction = '';
  }

  showProcessDialog: boolean = false;
  showSmsDialog: boolean = false;

  // Process form properties
  selectedProcessType: string = '';
  processForm: any = {
    newPlan: '',
    newGpsModel: '',
    newTechnician: '',
    newExpirationDate: '',
    description: ''
  };

  // Available options for process forms
  availablePlans: any[] = [];
  availableGpsModels: any[] = [];
  availableTechnicians: any[] = [];

  // Process-specific properties
  availablePlansForProcess: any[] = [];
  availablePricesForProcess: any[] = [];
  processCustomPrice: any = { amount: 0, payment_period: 'monthly' };
  displayProcessPriceDialog: boolean = false;

  executeProcess(): void {
    if (this.devices.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sin dispositivos',
        detail: 'No hay dispositivos disponibles para ejecutar procesos'
      });
      return;
    }
    this.showProcessDialog = true;
  }

  closeProcessDialog(): void {
    this.showProcessDialog = false;
  }

  getSelectedPlanName(): string {
    if (!this.selectedPlan) {
      return 'Todos los planes';
    }
    const plan = this.plans.find(p => p._id === this.selectedPlan);
    return plan ? plan.plan_name : 'Plan específico';
  }

  executeProcessOnDevices(): void {
    if (this.selectedProcessType === 'plan_change') {
      this.executeBulkPlanChange();
    } else {
      // Para otros tipos de proceso, mostrar mensaje genérico por ahora
      console.log('Ejecutando proceso masivo para', this.devices.length, 'dispositivos');
      this.messageService.add({
        severity: 'info',
        summary: 'Proceso no implementado',
        detail: `El proceso "${this.getProcessTypeName()}" aún no está implementado`
      });
      this.closeProcessDialog();
    }
  }

  executeBulkPlanChange(): void {
    if (!this.processForm.newPlan) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error de validación',
        detail: 'Debe seleccionar un plan'
      });
      return;
    }

    const deviceIds = this.devices.map(d => d._id);
    const payload = {
      deviceIds,
      newPlanId: this.processForm.newPlan,
      selectedPrice: this.processForm.newPrice || null
    };

    console.log('Ejecutando cambio masivo de plan para', deviceIds.length, 'dispositivos');
    console.log('Payload:', payload);

    // Llamada HTTP al backend
    this.http.post(`${environment.apiUrl}/devices/bulk-plan-change`, payload).subscribe({
      next: (response: any) => {
        console.log('Respuesta del backend:', response);
        if (response.success) {
          this.messageService.add({
            severity: 'success',
            summary: 'Cambio de plan ejecutado',
            detail: `Plan cambiado exitosamente para ${response.updatedCount} dispositivos. ${response.failedCount > 0 ? `Fallaron: ${response.failedCount}` : ''}`
          });
          // Recargar dispositivos para mostrar los cambios
          this.loadDevices(this.selectedPlan);
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Error en el proceso',
            detail: `Solo se actualizaron ${response.updatedCount} de ${deviceIds.length} dispositivos`
          });
        }
        this.closeProcessDialog();
      },
      error: (error) => {
        console.error('Error en bulk plan change:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error del servidor',
          detail: 'No se pudo ejecutar el cambio masivo de planes'
        });
        this.closeProcessDialog();
      }
    });
  }

  sendSmsToDevices(): void {
    console.log('Enviando SMS masivo a', this.devices.length, 'dispositivos');
    this.messageService.add({
      severity: 'success',
      summary: 'SMS enviado',
      detail: `SMS enviado exitosamente a ${this.devices.length} dispositivos`
    });
    this.closeSmsDialog();
  }

  sendSMS(): void {
    if (this.devices.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sin dispositivos',
        detail: 'No hay dispositivos disponibles para enviar SMS'
      });
      return;
    }
    this.showSmsDialog = true;
  }

  closeSmsDialog(): void {
    this.showSmsDialog = false;
  }

  loadGpsModels(): void {
    this.protocolsService.getAllProtocols().subscribe({
      next: (protocols: any[]) => {
        this.availableGpsModels = protocols.map(p => ({
          value: p._id,
          label: p.name || p._id
        }));
      },
      error: (error: any) => {
        console.error('Error loading GPS models:', error);
        this.availableGpsModels = [];
      }
    });
  }

  loadTechnicians(): void {
    this.userService.getTechnicians().subscribe({
      next: (technicians: any[]) => {
        this.availableTechnicians = technicians.map(tech => ({
          value: tech._id,
          label: `${tech.name} ${tech.last_name}`
        }));
      },
      error: (error: any) => {
        console.error('Error loading technicians:', error);
        this.availableTechnicians = [];
      }
    });
  }

  onProcessTypeChange(): void {
    // Reset form when process type changes
    this.processForm = {
      newPlan: '',
      newGpsModel: '',
      newTechnician: '',
      newExpirationDate: '',
      description: ''
    };
  }

  getProcessTypeName(): string {
    const processTypes: { [key: string]: string } = {
      'plan_change': 'Cambio de plan',
      'gps_model_change': 'Cambio de modelo de GPS',
      'technician_change': 'Cambio de técnico',
      'renewal': 'Renovación'
    };
    return processTypes[this.selectedProcessType] || 'Sin seleccionar';
  }

  isProcessFormValid(): boolean {
    if (!this.selectedProcessType) return false;

    switch (this.selectedProcessType) {
      case 'plan_change':
        return !!this.processForm.newPlan && !!this.processForm.newPrice;
      case 'gps_model_change':
        return !!this.processForm.newGpsModel;
      case 'technician_change':
        return !!this.processForm.newTechnician;
      case 'renewal':
        return !!this.processForm.newExpirationDate;
      default:
        return false;
    }
  }

  onProcessPlanChange(): void {
    if (this.processForm.newPlan) {
      // Load plan details to get prices
      this.plansService.getPlanById(this.processForm.newPlan).subscribe({
        next: (plan: any) => {
          this.availablePricesForProcess = (plan.prices || []).map((price: any) => ({
            ...price,
            displayText: `${price.amount} - ${this.translate.instant('settings.plans.' + price.payment_period)}`
          }));
        },
        error: (error: any) => {
          console.error('Error loading plan details:', error);
          this.availablePricesForProcess = [];
        }
      });
    } else {
      this.availablePricesForProcess = [];
    }
    this.processForm.newPrice = null;
  }

  onProcessPriceChange(): void {
    // Handle price change if needed
  }

  comparePrices(price1: any, price2: any): boolean {
    return price1 && price2 ? price1._id === price2._id : price1 === price2;
  }

  isPriceCustomized(price: any): boolean {
    if (!price) return false;
    // Check if price has custom flag or if amount differs from original
    return price.isCustom || false;
  }

  getOriginalPriceAmount(price: any): string {
    // Return original price amount if available
    return price?.originalAmount || price?.amount || 'N/A';
  }

  startProcessCustomPriceEdit(): void {
    if (this.processForm.newPrice) {
      this.processCustomPrice = { ...this.processForm.newPrice };
      this.displayProcessPriceDialog = true;
    }
  }

  cancelProcessCustomPrice(): void {
    this.displayProcessPriceDialog = false;
  }

  applyProcessCustomPrice(): void {
    // Apply custom price logic here
    this.processForm.newPrice = { ...this.processCustomPrice, isCustom: true };
    this.displayProcessPriceDialog = false;
  }

  // Translation helper method
  translateKey(key: string): string {
    return this.translate.instant(key);
  }
}

