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

  constructor(private readonly inventoryService: InventoryService) {}

  ngOnInit(): void {
    this.loadDevices();
  }

  loadDevices(): void {
    this.loading = true;
    this.error = '';
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
