import { Component, OnInit } from '@angular/core';
import { DialogService } from 'primeng/dynamicdialog';
import { MessageService, MenuItem } from 'primeng/api';
import { MasivoService } from '@core/services/masivo.service';
import { getApiErrorMessage } from '../../../../../../core/utils/api-error.util';

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
    private dialogService: DialogService,
    private messageService: MessageService
  ) {}

  ngOnInit() {
    this.loadDevices();
  }

  private loadDevices(filters?: { search?: string; planId?: string }) {
    this.isLoadingDevices = true;

    this.masivoService.getDevices(filters).subscribe({
      next: (devices: any[]) => {
        this.isLoadingDevices = false;
        this.devices = devices;
        this.filteredDevices = devices; // Backend already filtered
        console.log('Loaded devices:', devices.length, filters ? `with filters: ${JSON.stringify(filters)}` : 'without filters');

      },
      error: (error: any) => {
        this.isLoadingDevices = false;
        console.error('Error loading devices:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: getApiErrorMessage(error, 'No se pudieron cargar los dispositivos')
        });
      }
    });
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
          detail: getApiErrorMessage(error, 'No se pudieron enviar los SMS masivos')
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

  actualizarIndices() {
    console.log('Actualizar Índices functionality');
  }
}
