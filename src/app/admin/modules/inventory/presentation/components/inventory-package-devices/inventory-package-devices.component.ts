import { formatDeviceLabel } from 'src/app/shareds/pipes/device-label.pipe';
import { DeviceLabelMessageService, DeviceLabelConfirmationService } from 'src/app/shareds/services/device-label-messages.service';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MenuItem, MessageService, ConfirmationService } from 'primeng/api';
import { Subscription } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from 'src/app/core/services/auth.service';
import {
  InventoryItem,
  InventoryService,
} from 'src/app/core/services/inventory.service';
import { ProtocolsService } from 'src/app/core/services/protocols.service';
import { getApiErrorMessage } from '../../../../../../core/utils/api-error.util';

@Component({
  selector: 'app-inventory-package-devices',
  templateUrl: './inventory-package-devices.component.html',
  styleUrls: ['../inventory/inventory.component.css'],
  providers: [{ provide: MessageService, useClass: DeviceLabelMessageService }, { provide: ConfirmationService, useClass: DeviceLabelConfirmationService }],
  standalone: false,
})
export class InventoryPackageDevicesComponent implements OnInit, OnDestroy {
  @ViewChild('imeiInput') imeiInput!: ElementRef;

  items: MenuItem[] = [{ label: 'Inventario' }];
  home: MenuItem = { icon: 'pi pi-home', routerLink: '/admin/dashboard' };

  auditUserLabel(user: any): string {
    if (!user || typeof user !== 'object') return 'No registrado';
    const fullName = `${user.name || ''} ${user.last_name || ''}`.trim();
    return fullName || user.email || 'No registrado';
  }

  packageDevices: InventoryItem[] = [];
  selectedDevice: InventoryItem | null = null;
  deviceDialogVisible = false;
  isEditDeviceMode = false;
  lastSelectedStorageId: string | null = null;

  currentPackageId: string | null = null;
  loading = true;
  protocols: { label: string; value: string }[] = [];
  loadedProtocols: any[] = [];
  packageSearchQuery = '';
  packageSearchStatus: string = '';
  selectedProtocolFilter = '';
  isSearchingPackage = false;
  packageFiltersVisible = false;

  // Pagination
  currentPage = 1;
  itemsPerPage = 20;
  totalItems = 0;
  isLoadingMore = false;

  installDialogVisible = false;
  deviceToInstall: InventoryItem | null = null;

  private routeSub?: Subscription;
  private scrollListener: any;

  constructor(
    private inventoryService: InventoryService,
    private protocolsService: ProtocolsService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private translate: TranslateService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) { }

  ngOnInit(): void {
    if (!this.canReadInventory()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('inventory.no_read_permission'),
        detail: this.translate.instant('inventory.contact_admin'),
      });
      this.loading = false;
      return;
    }

    this.loadProtocols();
    this.loadWarehouses();
    this.routeSub = this.route.paramMap.subscribe((params) => {
      const packageId = params.get('packageId');
      if (!packageId) {
        this.router.navigate(['/admin/inventory']);
        return;
      }
      this.loadPackageDevices(packageId);
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  // Privilege helpers
  canCreateInventory(): boolean {
    return this.authService.hasPrivilege('inventory', 'create');
  }

  canReadInventory(): boolean {
    return this.authService.hasPrivilege('inventory', 'read');
  }

  canUpdateInventory(): boolean {
    return this.authService.hasPrivilege('inventory', 'update');
  }

  canDeleteInventory(): boolean {
    return this.authService.hasPrivilege('inventory', 'delete');
  }

  get activePackageFiltersCount(): number {
    return [
      this.packageSearchQuery,
      this.selectedWarehouseFilter,
      this.selectedProtocolFilter,
      this.packageSearchStatus,
    ]
      .filter(Boolean).length;
  }

  togglePackageFilters(): void {
    this.packageFiltersVisible = !this.packageFiltersVisible;
  }



  private loadProtocols(): void {
    this.protocolsService.getAllProtocols().subscribe({
      next: (list: any[]) => {
        this.loadedProtocols = list;
        this.protocols = list.map((p) => ({
          label: formatDeviceLabel(p.name || p.type || p._id),
          value: p._id,
        }));
      },
      error: () => {
        this.loadedProtocols = [];
        this.protocols = [];
      },
    });
  }

  private loadPackageDevices(packageId: string, resetPage = true): void {
    if (resetPage) {
      this.loading = true;
      this.currentPage = 1;
      this.packageDevices = [];
    } else {
      this.isLoadingMore = true;
    }

    this.currentPackageId = packageId;
    this.inventoryService.getDevicesByPackage(packageId, this.currentPage, this.itemsPerPage).subscribe({
      next: (response) => {
        const mappedDevices = (response.data || []).map(d => ({ 
          ...d, 
          storage_id: typeof d.storage_id === 'object' && d.storage_id ? (d.storage_id as any)._id : (d.storage_id || null) 
        }));

        if (resetPage) {
          this.packageDevices = mappedDevices;
        } else {
          this.packageDevices = [...this.packageDevices, ...mappedDevices];
        }

        this.totalItems = response.total;
        this.loading = false;
        this.isLoadingMore = false;
      },
      error: (error) => {
        if (resetPage) {
          this.packageDevices = [];
        }
        this.loading = false;
        this.isLoadingMore = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: getApiErrorMessage(error, 'Error al cargar dispositivos del paquete'),
        });
      },
    });
  }

  openNewDevice(): void {
    if (!this.canCreateInventory()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('inventory.no_create_permission'),
        detail: this.translate.instant('inventory.contact_admin'),
      });
      return;
    }

    if (!this.currentPackageId) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'Selecciona un paquete primero',
      });
      return;
    }

    this.selectedDevice = {
      imei: '',
      sim: '',
      idsim: '',
      protocol: '',
      package: this.currentPackageId,
      packageId: this.currentPackageId,
      storage_id: this.lastSelectedStorageId || (this.warehouses.length > 0 ? this.warehouses[0]._id : null),
    } as InventoryItem;

    this.isEditDeviceMode = false;
    this.deviceDialogVisible = true;
  }

  editDevice(device: InventoryItem): void {
    if (!this.canUpdateInventory()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('inventory.no_update_permission'),
        detail: this.translate.instant('inventory.contact_admin'),
      });
      return;
    }

    this.selectedDevice = {
      _id: device._id,
      imei: device.IMEI || device.imei || '',
      sim: device.SIM || device.sim || '',
      idsim: device.IDSIM || device.idsim || '',
      protocol:
        typeof device.Protocol === 'object'
          ? device.Protocol._id
          : device.Protocol || device.protocol || '',
      package: device.package || this.currentPackageId,
      packageId: device.package || this.currentPackageId,
      storage_id: device.storage_id || null,
    };

    this.isEditDeviceMode = true;
    this.deviceDialogVisible = true;
  }

  saveDevice(): void {
    if (this.isEditDeviceMode && !this.canUpdateInventory()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('inventory.no_update_permission'),
        detail: this.translate.instant('inventory.contact_admin'),
      });
      return;
    }

    if (!this.isEditDeviceMode && !this.canCreateInventory()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('inventory.no_create_permission'),
        detail: this.translate.instant('inventory.contact_admin'),
      });
      return;
    }

    if (!this.selectedDevice) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Error',
        detail: 'No hay dispositivo seleccionado',
      });
      return;
    }

    if (!this.selectedDevice.imei?.trim()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Validación',
        detail: 'El IMEI es requerido',
      });
      return;
    }

    if (!this.selectedDevice.protocol) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Validación',
        detail: 'El protocolo es requerido',
      });
      return;
    }

    if (!this.currentPackageId) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Error',
        detail: 'No se ha seleccionado un paquete',
      });
      return;
    }

    const devicePayload: any = {
      IMEI: (this.selectedDevice.imei || '').trim(),
      SIM: (this.selectedDevice.sim || '').trim(),
      IDSIM: (this.selectedDevice.idsim || '').trim(),
      Protocol: this.selectedDevice.protocol || '',
      package: this.currentPackageId,
      storage_id: this.selectedDevice.storage_id || null,
    };

    if (!devicePayload.IMEI || !devicePayload.Protocol || !devicePayload.package) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error de validación',
        detail: 'Faltan campos requeridos en el payload (IMEI y Protocolo son obligatorios)',
      });
      return;
    }

    const operation =
      this.isEditDeviceMode && this.selectedDevice._id
        ? this.inventoryService.update(this.selectedDevice._id, devicePayload)
        : this.inventoryService.create(devicePayload);

    operation.subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: this.isEditDeviceMode ? 'Dispositivo actualizado' : 'Dispositivo agregado',
        });

        // Save the last selected storage_id for sticky selection
        if (devicePayload.storage_id) {
          this.lastSelectedStorageId = devicePayload.storage_id;
        }

        if (this.isEditDeviceMode) {
          this.hideDeviceDialog();
        } else {
          this.resetFormForNewDevice();
        }

        if (this.currentPackageId) {
          this.loadPackageDevices(this.currentPackageId);
        }
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: getApiErrorMessage(err, 'No se pudo guardar el dispositivo'),
        });
      },
    });
  }

  deleteDevice(device: InventoryItem): void {
    if (!this.canDeleteInventory()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('inventory.no_delete_permission'),
        detail: this.translate.instant('inventory.contact_admin'),
      });
      return;
    }

    const imei = device.IMEI || device.imei || 'Sin IMEI';
    this.confirmationService.confirm({
      message: `¿Está seguro de eliminar el dispositivo IMEI: ${imei}?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        if (device._id) {
          this.inventoryService.delete(device._id).subscribe({
            next: () => {
              this.messageService.add({
                severity: 'success',
                summary: 'Eliminado',
                detail: 'Dispositivo eliminado correctamente',
              });
              if (this.currentPackageId) {
                this.loadPackageDevices(this.currentPackageId);
              }
            },
            error: (error) => {
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: getApiErrorMessage(error, 'No se pudo eliminar el dispositivo'),
              });
            },
          });
        }
      },
    });
  }

  hideDeviceDialog(): void {
    this.deviceDialogVisible = false;
    this.selectedDevice = null;
  }

  focusImei(): void {
    setTimeout(() => {
      if (this.imeiInput?.nativeElement) {
        this.imeiInput.nativeElement.focus();
      }
    }, 50);
  }

  resetFormForNewDevice(): void {
    if (!this.selectedDevice || !this.currentPackageId) {
      return;
    }

    const currentProtocol = this.selectedDevice.protocol;
    this.selectedDevice = {
      imei: '',
      sim: '',
      protocol: currentProtocol,
      package: this.currentPackageId,
      packageId: this.currentPackageId,
      storage_id: this.lastSelectedStorageId || (this.warehouses.length > 0 ? this.warehouses[0]._id : null),
    } as InventoryItem;

    setTimeout(() => {
      if (this.imeiInput?.nativeElement) {
        this.imeiInput.nativeElement.focus();
      }
    }, 100);
  }

  selectedWarehouseFilter = '';
  // ... (rest of class) ...

  searchPackageDevices(resetPage = true): void {
    if (!this.currentPackageId) {
      return;
    }

    if (
      !this.packageSearchQuery.trim()
      && !this.selectedWarehouseFilter
      && !this.selectedProtocolFilter
      && !this.packageSearchStatus
    ) {
      this.clearPackageSearch();
      return;
    }

    const query = this.packageSearchQuery.trim() || '.*';

    if (resetPage) {
      this.currentPage = 1;
      this.packageDevices = [];
      this.isSearchingPackage = true;
    } else {
      this.isLoadingMore = true;
    }

    this.inventoryService
      .searchDevicesByPackage(
        this.currentPackageId,
        query,
        this.selectedWarehouseFilter,
        this.currentPage,
        this.itemsPerPage,
        this.packageSearchStatus || undefined,
        this.selectedProtocolFilter || undefined,
      )
      .subscribe({
        next: (response) => {
          const mappedDevices = (response.data || []).map(d => ({ 
            ...d, 
            storage_id: typeof d.storage_id === 'object' && d.storage_id ? (d.storage_id as any)._id : (d.storage_id || null) 
          }));

          if (resetPage) {
            this.packageDevices = mappedDevices;
          } else {
            this.packageDevices = [...this.packageDevices, ...mappedDevices];
          }

          this.totalItems = response.total;
          this.isSearchingPackage = false;
          this.isLoadingMore = false;
        },
        error: (error) => {
          this.isSearchingPackage = false;
          this.isLoadingMore = false;
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: getApiErrorMessage(error, 'Error al buscar dispositivos del paquete'),
          });
        },
      });
  }

  onScroll(event: any): void {
    const element = event.target;
    if (element.scrollHeight - element.scrollTop <= element.clientHeight + 50) {
      if (!this.isLoadingMore && !this.loading && this.packageDevices.length < this.totalItems) {
        this.loadMoreDevices();
      }
    }
  }

  loadMoreDevices(): void {
    if (!this.isLoadingMore && !this.loading && this.packageDevices.length < this.totalItems) {
      this.currentPage++;
      if (
        this.packageSearchQuery.trim()
        || this.selectedWarehouseFilter
        || this.selectedProtocolFilter
        || this.packageSearchStatus
      ) {
        this.searchPackageDevices(false);
      } else {
        this.loadPackageDevices(this.currentPackageId!, false);
      }
    }
  }

  clearPackageSearch(): void {
    this.packageSearchQuery = '';
    this.selectedWarehouseFilter = '';
    this.selectedProtocolFilter = '';
    this.packageSearchStatus = '';
    this.isSearchingPackage = false;
    this.currentPage = 1;
    this.totalItems = 0;
    if (this.currentPackageId) {
      this.loadPackageDevices(this.currentPackageId);
    }
  }

  installDevice(device: InventoryItem): void {
    if (this.isDeviceInspectionRequired(device)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Dispositivo no disponible',
        detail: 'Este equipo está en revisión o averiado y no puede asignarse a una instalación.',
      });
      return;
    }

    if (!this.canUpdateInventory()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('inventory.no_update_permission'),
        detail: this.translate.instant('inventory.contact_admin'),
      });
      return;
    }

    // A reserved device already has a real target. Resume that exact flow in Management.
    if (this.isDeviceInActivation(device) && device.device_parent_id) {
      const imei = device.IMEI || device.imei || '';
      const parentId = device.device_parent_id;
      this.messageService.add({
        severity: 'info',
        summary: 'Continuar asignación',
        detail: 'Abriendo el objetivo asignado en Management...',
        life: 2000,
      });
      this.router.navigate(['/admin/management/t', parentId], {
        queryParams: {
          search: imei,
          inventoryTargetId: device.device_id,
          inventoryAction: device.reservation_intent || 'reserve',
        },
      });
      return;
    }

    this.deviceToInstall = device;
    this.installDialogVisible = true;
  }

  canAssignInventoryDevice(): boolean {
    const user = this.authService.getCurrentUser();
    return this.canUpdateInventory()
      && this.authService.hasPrivilege('devices', 'create')
      && String(user?.affiliation_type_id || '').trim().toLowerCase() === 'empleado';
  }

  cancelInstallation(): void {
    this.installDialogVisible = false;
    this.deviceToInstall = null;
  }

  onInventoryDeviceAssigned(): void {
    if (this.currentPackageId) {
      this.loadPackageDevices(this.currentPackageId);
    }
  }

  goBackToPackages(): void {
    this.router.navigate(['/admin/inventory']);
  }

  getProtocolLabel(protocolData: any): string {
    if (protocolData && typeof protocolData === 'object' && protocolData.name) {
      return protocolData.name;
    }
    if (typeof protocolData === 'string') {
      const protocol = this.protocols.find((p) => p.value === protocolData);
      return protocol ? protocol.label : protocolData;
    }
    return 'Sin protocolo';
  }

  isDeviceInstalled(device: InventoryItem): boolean {
    return device?.inventory_status
      ? device.inventory_status === 'installed'
      : !!device?.installed;
  }

  isDeviceInspectionRequired(device: InventoryItem): boolean {
    return device?.inventory_status
      ? device.inventory_status === 'inspection'
      : device?.inspection_required === true;
  }

  isDeviceInActivation(device: InventoryItem): boolean {
    return device?.inventory_status
      ? device.inventory_status === 'reserved'
      : !!device?.activation_mode;
  }

  isDeviceClientReservation(device: InventoryItem): boolean {
    return device?.status_source === 'client_reservation';
  }

  isDeviceAirtag(device: InventoryItem): boolean {
    const protocolData = (device as any).Protocol || (device as any).protocol;
    let protocolId: string | null = null;
    if (protocolData && typeof protocolData === 'object' && protocolData._id) {
      if (protocolData.isAirtag) return true;
      protocolId = protocolData._id;
    } else if (typeof protocolData === 'string') {
      protocolId = protocolData;
    }
    if (protocolId && this.loadedProtocols.length > 0) {
      const found = this.loadedProtocols.find(p => p._id === protocolId);
      return found?.isAirtag === true;
    }
    return false;
  }

  // Warehouse Logic
  warehouses: any[] = [];

  loadWarehouses(): void {
    this.inventoryService.getWarehouses().subscribe({
      next: (data) => {
        this.warehouses = data;
      },
      error: () => {
        console.error('Error loading warehouses');
      }
    });
  }

  updateDeviceStorage(device: InventoryItem, newStorageId: string | null): void {

    if (!device._id) return;

    this.inventoryService.update(device._id, { storage_id: newStorageId }).subscribe({
      next: (updatedDevice) => {
        this.messageService.add({
          severity: 'success',
          summary: 'Actualizado',
          detail: 'Almacén asignado correctamente'
        });
        device.storage_id = newStorageId;
        device.storageDate = updatedDevice.storageDate;
      },
      error: (error) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: getApiErrorMessage(error, 'No se pudo asignar el almacén')
        });
        // Revert change if needed or reload
      }
    });
  }
}
