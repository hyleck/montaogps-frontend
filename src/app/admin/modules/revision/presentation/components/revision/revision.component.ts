import { Component, OnInit } from '@angular/core';
import {
  InventoryItem,
  InventoryService,
} from '../../../../../../core/services/inventory.service';

@Component({
  selector: 'app-revision',
  templateUrl: './revision.component.html',
  styleUrls: ['./revision.component.css'],
  standalone: false,
})
export class RevisionComponent implements OnInit {
  devices: InventoryItem[] = [];
  loading = true;
  error = '';
  search = '';
  total = 0;
  page = 1;
  readonly limit = 25;
  lastPage = 1;
  releaseCandidate: InventoryItem | null = null;
  releasingId = '';
  actionError = '';
  success = '';

  constructor(private readonly inventoryService: InventoryService) {}

  ngOnInit(): void {
    this.loadDevices();
  }

  loadDevices(): void {
    this.loading = true;
    this.error = '';
    this.actionError = '';
    this.inventoryService
      .getInspectionRequired(this.search, this.page, this.limit)
      .subscribe({
        next: response => {
          this.devices = response?.data || [];
          this.total = Number(response?.total || 0);
          this.lastPage = Math.max(1, Number(response?.lastPage || 1));
          this.loading = false;
        },
        error: error => {
          this.devices = [];
          this.total = 0;
          this.error = error?.error?.message || 'No se pudieron cargar los GPS pendientes de revisión.';
          this.loading = false;
        },
      });
  }

  applySearch(): void {
    this.search = this.search.trim();
    this.page = 1;
    this.loadDevices();
  }

  clearSearch(): void {
    if (!this.search) return;
    this.search = '';
    this.page = 1;
    this.loadDevices();
  }

  changePage(nextPage: number): void {
    if (nextPage < 1 || nextPage > this.lastPage || nextPage === this.page) return;
    this.page = nextPage;
    this.loadDevices();
  }

  requestRelease(device: InventoryItem): void {
    if (this.releasingId) return;
    this.actionError = '';
    this.success = '';
    this.releaseCandidate = device;
  }

  cancelRelease(): void {
    if (this.releasingId) return;
    this.releaseCandidate = null;
  }

  confirmRelease(cancelOfficeTarget = false): void {
    const candidate = this.releaseCandidate;
    const id = String(candidate?._id || '').trim();
    if (!id || this.releasingId) return;

    const imei = String(candidate?.IMEI || candidate?.imei || '').trim();
    this.releasingId = id;
    this.actionError = '';
    this.inventoryService.releaseInspection(id, { cancelOfficeTarget }).subscribe({
      next: () => {
        this.releasingId = '';
        this.releaseCandidate = null;
        this.success = cancelOfficeTarget
          ? `El GPS ${imei || 'seleccionado'} salió de revisión, se canceló el objetivo temporal y volvió a Inventario disponible.`
          : `El GPS ${imei || 'seleccionado'} salió de revisión correctamente.`;
        if (this.devices.length === 1 && this.page > 1) this.page -= 1;
        this.loadDevices();
        this.inventoryService.checkInspectionRequired();
      },
      error: error => {
        this.releasingId = '';
        this.releaseCandidate = null;
        this.actionError = error?.error?.message
          || 'No se pudo sacar el dispositivo de revisión.';
      },
    });
  }

  canCancelOfficeTarget(device: InventoryItem | null): boolean {
    return String(device?.inspection_solicitud_id || '').startsWith('office-review:');
  }

  protocolName(device: InventoryItem): string {
    const protocol = device?.Protocol || device?.protocol;
    if (protocol && typeof protocol === 'object') {
      return String(protocol.name || protocol.nombre || 'Sin modelo');
    }
    return String(protocol || 'Sin modelo');
  }

  warehouseName(device: InventoryItem): string {
    const warehouse = device?.storage_id;
    if (warehouse && typeof warehouse === 'object') {
      return String((warehouse as any).name || 'Sin almacén');
    }
    return 'Sin almacén';
  }

  formatDate(value?: string): string {
    if (!value) return 'Fecha no disponible';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
    return date.toLocaleString('es-DO', {
      timeZone: 'America/Santo_Domingo',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  trackByDevice(_: number, device: InventoryItem): string {
    return String(device?._id || device?.IMEI || '');
  }
}
