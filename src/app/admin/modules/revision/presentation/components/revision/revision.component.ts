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
  preventiveDays: number | null = null;
  readonly preventiveDayOptions = Array.from({ length: 10 }, (_, index) => index + 1);
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
      .getInspectionRequired(
        this.search,
        this.page,
        this.limit,
        this.preventiveDays || undefined,
      )
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

  applyPreventiveFilter(value: number | null): void {
    const parsedValue = Number(value);
    this.preventiveDays = Number.isInteger(parsedValue)
      && parsedValue >= 1
      && parsedValue <= 10
        ? parsedValue
        : null;
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

  isPreventive(device: InventoryItem): boolean {
    return device?.revision_source === 'preventive';
  }

  isMtag(device: InventoryItem): boolean {
    const protocol = device?.Protocol || device?.protocol;
    const name = this.protocolName(device)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/gi, '')
      .toUpperCase();
    return Boolean(
      protocol && typeof protocol === 'object' && protocol.isAirtag === true
    ) || name === 'MTAGA' || name === 'MTAGP';
  }

  statusLabel(device: InventoryItem): string {
    return String(device?.live_status || (this.isMtag(device) ? 'No localizado' : 'Fuera de línea'));
  }

  statusClass(device: InventoryItem): string {
    const key = String(device?.live_status_key || (this.isMtag(device) ? 'not-located' : 'offline'));
    return `device-status--${key}`;
  }

  statusIcon(device: InventoryItem): string {
    switch (device?.live_status_key) {
      case 'online': return 'pi-wifi';
      case 'located': return 'pi-map-marker';
      case 'not-located': return 'pi-map-marker';
      default: return 'pi-wifi';
    }
  }

  reviewReason(device: InventoryItem): string {
    if (this.isPreventive(device)) {
      const days = Number(device?.preventive_days || this.preventiveDays || 0);
      if (this.isMtag(device)) {
        return `Nunca ha reportado ubicación dentro de ${days === 1 ? 'su primer día' : `sus primeros ${days} días`} desde la instalación.`;
      }
      return `Fuera de línea dentro de ${days === 1 ? 'su primer día' : `sus primeros ${days} días`} desde la instalación.`;
    }
    return device?.inspection_reason || 'Sin motivo registrado';
  }

  relevantDate(device: InventoryItem): string | undefined {
    return this.isPreventive(device)
      ? device?.installed_at || device?.activation_date
      : device?.inspection_requested_at;
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
