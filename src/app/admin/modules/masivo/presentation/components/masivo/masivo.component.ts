import { Component, OnInit } from '@angular/core';
import { DialogService } from 'primeng/dynamicdialog';
import { MessageService, MenuItem } from 'primeng/api';
import { MasivoService } from '@core/services/masivo.service';
import { PlansService } from '@core/services/plans.service';

@Component({
  selector: 'app-masivo',
  templateUrl: './masivo.component.html',
  styleUrl: './masivo.component.css',
  standalone: false,
  providers: [DialogService, MessageService]
})
export class MasivoComponent implements OnInit {

  devices: any[] = [];
  filteredDevices: any[] = [];
  selectedDevices: any[] = [];
  results: any[] = [];
  selectedPlan: string = '';

  planOptions: any[] = [];

  isLoadingDevices: boolean = false;
  isProcessing: boolean = false;

  actionMenuItems: MenuItem[] = [
    {
      label: 'Enviar SMS',
      icon: 'pi pi-send',
      command: () => this.enviarSms()
    },
    {
      label: 'Registrar Proceso',
      icon: 'pi pi-plus-circle',
      command: () => this.registrarProceso()
    }
  ];

  constructor(
    private masivoService: MasivoService,
    private plansService: PlansService,
    private dialogService: DialogService,
    private messageService: MessageService
  ) {}

  ngOnInit() {
    this.loadDevices(); // Load devices first, then plans will be loaded after
  }

  private loadPlans() {
    console.log('Loading all plans (like in settings module)');

    this.plansService.getAllPlans().subscribe({
      next: (plans: any[]) => {
        console.log('All plans from API:', plans.length);

        // Show ALL plans, just like in the settings module
        this.planOptions = [
          { label: 'Todos los planes', value: '' },
          ...plans.map(plan => ({
            label: plan.plan_name,
            value: plan._id
          }))
        ];

        console.log('Plan options loaded:', this.planOptions.length - 1, 'plans available');
      },
      error: (error: any) => {
        console.error('Error loading plans:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los planes'
        });
      }
    });
  }

  private loadDevices(filters?: { search?: string; planId?: string }) {
    this.isLoadingDevices = true;

    this.masivoService.getDevices(filters).subscribe({
      next: (devices: any[]) => {
        this.isLoadingDevices = false;
        this.devices = devices;
        this.filteredDevices = devices; // Backend already filtered
        console.log('Loaded devices:', devices.length, filters ? `with filters: ${JSON.stringify(filters)}` : 'without filters');

        // Now load plans after devices are loaded (only if no filters applied)
        if (!filters) {
          console.log('Calling loadPlans after devices loaded');
          this.loadPlans();
        }
      },
      error: (error: any) => {
        this.isLoadingDevices = false;
        console.error('Error loading devices:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los dispositivos'
        });
      }
    });
  }

  onPlanFilterChange() {
    console.log('Plan filter changed:', this.selectedPlan);
    this.applyFilters();
  }

  applyFilters() {
    const filters: { planId?: string } = {};

    if (this.selectedPlan) {
      filters.planId = this.selectedPlan;
    }

    console.log('Applying filters:', filters);
    this.loadDevices(filters);
  }

  enviarSms() {
    if (this.selectedDevices.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'Seleccione al menos un dispositivo para enviar SMS'
      });
      return;
    }

    this.isProcessing = true;
    this.results = [];

    // For now, we'll send SMS to all selected devices
    // In a real implementation, you might want to send SMS only to selected devices
    this.masivoService.sendMassSMS().subscribe({
      next: (response: any) => {
        this.isProcessing = false;
        this.results = response.results || [];

        // Show success message
        this.messageService.add({
          severity: 'success',
          summary: 'Proceso Completado',
          detail: response.message
        });

        console.log('Mass SMS results:', response);
      },
      error: (error) => {
        this.isProcessing = false;
        console.error('Error sending mass SMS:', error);

        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron enviar los SMS masivos'
        });
      }
    });
  }

  registrarProceso() {
    if (this.selectedDevices.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'Seleccione al menos un dispositivo para registrar proceso'
      });
      return;
    }

    this.messageService.add({
      severity: 'info',
      summary: 'Función en desarrollo',
      detail: 'La función de registrar proceso estará disponible próximamente'
    });

    console.log('Registrar proceso para dispositivos:', this.selectedDevices);
  }

  cambiarPlan() {
    console.log('Cambiar Plan functionality');
  }

  actualizarIndices() {
    console.log('Actualizar Índices functionality');
  }
}