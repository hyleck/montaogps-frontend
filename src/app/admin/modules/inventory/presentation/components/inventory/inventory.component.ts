import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MenuItem, MessageService, ConfirmationService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import {
  InventoryItem,
  InventoryService,
  Package,
  Warehouse,
} from 'src/app/core/services/inventory.service';
import { PlansService } from 'src/app/core/services/plans.service';
import { Plan } from 'src/app/core/interfaces/plan.interface';
import { ProtocolsService } from 'src/app/core/services/protocols.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { UserService } from 'src/app/core/services/user.service';
import { SIM_CARD_TYPES } from 'src/app/core/constants/sim-card-types.constant';

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.css'],
  providers: [MessageService, ConfirmationService],
  standalone: false,
})
export class InventoryComponent implements OnInit {
  items: MenuItem[] = [{ label: 'Inventario' }];
  home: MenuItem = { icon: 'pi pi-home', routerLink: '/admin/dashboard' };

  packages: Package[] = [];
  warehouses: Warehouse[] = [];
  selectedPackage: Package | null = null;
  selectedWarehouse: Warehouse | null = null;
  packageDialogVisible = false;
  warehouseDialogVisible = false;
  warehouseFormDialogVisible = false;
  isEditPackageMode = false;
  isEditMode = false;
  isEditWarehouseMode = false;

  loading = true;
  loadingWarehouses = false;
  protocols: { label: string; value: string }[] = [];

  globalSearchQuery = '';
  globalSearchStorageId: string | null = null;
  globalSearchStatus: string = '';
  isSearchingGlobal = false;
  allDevicesSearchResults: InventoryItem[] = [];
  showingSearchResults = false;

  // Pagination
  currentPage = 1;
  itemsPerPage = 20;
  totalItems = 0;
  isLoadingMore = false;

  // Device Management Properties
  deviceDialogVisible = false;
  installDialogVisible = false;
  selectedDevice: InventoryItem | null = null;
  deviceToInstall: InventoryItem | null = null;
  lowStockCount = 0;
  installationEmail = '';
  installationSimType = '';
  availableSimCardTypes = SIM_CARD_TYPES;
  installationPlanId = '';
  availablePlans: any[] = [];
  isEditDeviceMode = false;


  constructor(
    private inventoryService: InventoryService,
    private plansService: PlansService,
    private protocolsService: ProtocolsService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private translate: TranslateService,
    private authService: AuthService,
    private userService: UserService,
    private router: Router,
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
    this.loadPackages();
    this.loadPlans();
    this.loadWarehouses();
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

  private loadProtocols(): void {
    this.protocolsService.getAllProtocols().subscribe({
      next: (list: any[]) => {
        this.protocols = list.map((p) => ({
          label: p.name || p.type || p._id,
          value: p._id,
        }));
      },
      error: () => {
        this.protocols = [];
      },
    });
  }

  loadPackages(): void {
    this.loading = true;
    this.inventoryService.findAllPackages().subscribe({
      next: (packages) => {
        this.packages = packages || [];
        this.loading = false;
      },
      error: () => {
        this.packages = [];
        this.loading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al cargar paquetes',
        });
      },
    });
  }

  loadPlans(): void {
    this.plansService.getAllPlans().subscribe({
      next: (plans: Plan[]) => {
        this.availablePlans = plans.map(plan => ({
          label: plan.plan_name,
          value: plan._id
        })).sort((a, b) => a.label.localeCompare(b.label));
      },
      error: (error) => {
        console.error('Error loading plans', error);
      }
    });
  }

  openNewPackage(): void {
    this.selectedPackage = {
      title: '',
      date: new Date().toISOString().split('T')[0],
      price: 0,
      description: '',
    };
    this.isEditPackageMode = false;
    this.packageDialogVisible = true;
  }

  editPackage(pkg: Package): void {
    if (!this.canUpdateInventory()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('inventory.no_update_permission'),
        detail: this.translate.instant('inventory.contact_admin'),
      });
      return;
    }

    this.selectedPackage = { ...pkg };
    this.isEditPackageMode = true;
    this.packageDialogVisible = true;
  }

  savePackage(): void {
    if (this.isEditPackageMode && !this.canUpdateInventory()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('inventory.no_update_permission'),
        detail: this.translate.instant('inventory.contact_admin'),
      });
      return;
    }

    if (!this.isEditPackageMode && !this.canCreateInventory()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('inventory.no_create_permission'),
        detail: this.translate.instant('inventory.contact_admin'),
      });
      return;
    }

    if (!this.selectedPackage?.title) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Validación',
        detail: 'El título del paquete es requerido',
      });
      return;
    }

    const operation =
      this.isEditPackageMode && this.selectedPackage?._id
        ? this.inventoryService.updatePackage(this.selectedPackage._id, this.selectedPackage)
        : this.inventoryService.createPackage(this.selectedPackage as Package);

    operation.subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: this.isEditPackageMode ? 'Paquete actualizado' : 'Paquete creado',
        });
        this.hidePackageDialog();
        this.loadPackages();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo guardar el paquete',
        });
      },
    });
  }

  deletePackage(pkg: Package): void {
    if (!this.canDeleteInventory()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('inventory.no_delete_permission'),
        detail: this.translate.instant('inventory.contact_admin'),
      });
      return;
    }

    this.confirmationService.confirm({
      message: `¿Está seguro de eliminar el paquete "${pkg.title}"?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        if (pkg._id) {
          this.inventoryService.deletePackage(pkg._id).subscribe({
            next: () => {
              this.messageService.add({
                severity: 'success',
                summary: 'Eliminado',
                detail: 'Paquete eliminado correctamente',
              });
              this.loadPackages();
            },
            error: () => {
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'No se pudo eliminar el paquete',
              });
            },
          });
        }
      },
    });
  }

  hidePackageDialog(): void {
    this.packageDialogVisible = false;
    this.selectedPackage = null;
  }

  viewPackageDevices(pkg: Package): void {
    if (!pkg?._id) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Paquete inválido',
        detail: 'No fue posible determinar el paquete seleccionado',
      });
      return;
    }
    this.router.navigate(['/admin/inventory', pkg._id]);
  }

  searchAllInventory(resetPage = true, onComplete?: () => void): void {
    const hasQuery = !!this.globalSearchQuery.trim();
    const hasStorage = !!this.globalSearchStorageId;
    const hasStatus = !!this.globalSearchStatus;

    if (!hasQuery && !hasStorage && !hasStatus) {
      this.clearGlobalSearch();
      return;
    }

    if (resetPage) {
      this.currentPage = 1;
      this.allDevicesSearchResults = [];
      this.isSearchingGlobal = true;
    } else {
      this.isLoadingMore = true;
    }

    this.inventoryService.searchAllDevices(
      this.globalSearchQuery.trim(),
      this.globalSearchStorageId || undefined,
      this.currentPage,
      this.itemsPerPage,
      this.globalSearchStatus || undefined
    ).subscribe({
      next: (response) => {
        if (resetPage) {
          this.allDevicesSearchResults = response.data || [];
        } else {
          this.allDevicesSearchResults = [...this.allDevicesSearchResults, ...(response.data || [])];
        }

        this.totalItems = response.total;
        this.showingSearchResults = true;
        this.isSearchingGlobal = false;
        this.isLoadingMore = false;
        if (onComplete) onComplete();
      },
      error: () => {
        if (resetPage) {
          this.allDevicesSearchResults = [];
          this.showingSearchResults = false;
        }
        this.isSearchingGlobal = false;
        this.isLoadingMore = false;
        if (onComplete) onComplete();
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al buscar dispositivos',
        });
      },
    });
  }

  onSearchResultsScroll(event: any): void {
    const element = event.target;
    // Check if we reached the bottom (with a small threshold)
    if (element.scrollHeight - element.scrollTop <= element.clientHeight + 50) {
      if (!this.isLoadingMore && !this.isSearchingGlobal && this.allDevicesSearchResults.length < this.totalItems) {
        this.currentPage++;
        this.searchAllInventory(false);
      }
    }
  }

  clearGlobalSearch(): void {
    this.globalSearchQuery = '';
    this.globalSearchStorageId = null;
    this.globalSearchStatus = '';
    this.allDevicesSearchResults = [];
    this.showingSearchResults = false;
    this.isSearchingGlobal = false;
    this.currentPage = 1;
    this.totalItems = 0;
  }

  navigateToDevicePackage(device: InventoryItem): void {
    const pkg = device.package;
    const packageId =
      typeof pkg === 'object' && pkg !== null ? pkg._id || pkg.id : (pkg as string | undefined);

    if (!packageId) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sin paquete',
        detail: 'No se pudo identificar el paquete del dispositivo seleccionado',
      });
      return;
    }

    this.router.navigate(['/admin/inventory', packageId]);
  }

  getPackageTitle(device: InventoryItem): string {
    if (device.package && typeof device.package === 'object') {
      return device.package.title || device.package.name || 'N/A';
    }
    return 'N/A';
  }

  getWarehouseName(device: InventoryItem): string {
    if (device.storage_id && typeof device.storage_id === 'object' && (device.storage_id as any).name) {
      return (device.storage_id as any).name;
    }
    return 'N/A';
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
    return !!device?.installed;
  }

  // Warehouse Methods
  get attentionWarehouses(): Warehouse[] {
    return this.warehouses ? this.warehouses.filter(w => (w.stock || 0) < (w.min_quantity || 0)) : [];
  }

  get regularWarehouses(): Warehouse[] {
    return this.warehouses ? this.warehouses.filter(w => (w.stock || 0) >= (w.min_quantity || 0)) : [];
  }

  loadWarehouses(): void {
    this.loadingWarehouses = true;
    this.inventoryService.getWarehouses().subscribe({
      next: (data) => {
        this.warehouses = data;
        this.loadingWarehouses = false;

        // Calculate and notify low stock
        if (this.warehouses) {
          const lowStockWarehouses = this.warehouses.filter(w => (w.stock || 0) < (w.min_quantity || 0));
          this.lowStockCount = lowStockWarehouses.length;

          // Show toast for each low stock warehouse
          lowStockWarehouses.forEach(w => {
            this.messageService.add({
              severity: 'warn',
              summary: 'Stock Bajo detectado',
              detail: `El almacén "${w.name}" tiene ${w.stock || 0} dispositivos (Mínimo: ${w.min_quantity || 0})`,
              life: 5000
            });
          });
        } else {
          this.lowStockCount = 0;
        }
      },
      error: () => {
        this.loadingWarehouses = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al cargar almacenes'
        });
      }
    });
  }

  openWarehouses(): void {
    this.loadWarehouses();
    this.warehouseDialogVisible = true;
  }

  loadingWarehouseId: string | null = null;

  filterByWarehouse(warehouse: Warehouse): void {
    if (!warehouse._id) return;
    this.loadingWarehouseId = warehouse._id;
    this.globalSearchStorageId = warehouse._id;
    this.globalSearchStatus = 'available';
    this.searchAllInventory(true, () => {
      this.loadingWarehouseId = null;
      this.warehouseDialogVisible = false;
    });
  }

  openNewWarehouse(): void {
    this.selectedWarehouse = { name: '', description: '' };
    this.isEditWarehouseMode = false;
    this.warehouseFormDialogVisible = true;
  }

  editWarehouse(warehouse: Warehouse): void {
    this.selectedWarehouse = { ...warehouse };
    this.isEditWarehouseMode = true;
    this.warehouseFormDialogVisible = true;
  }

  saveWarehouse(): void {
    if (!this.selectedWarehouse || !this.selectedWarehouse.name) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Error',
        detail: 'El nombre del almacén es requerido'
      });
      return;
    }

    const request = this.isEditWarehouseMode
      ? this.inventoryService.updateWarehouse(this.selectedWarehouse._id!, this.selectedWarehouse)
      : this.inventoryService.createWarehouse(this.selectedWarehouse);

    request.subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: this.isEditWarehouseMode ? 'Almacén actualizado' : 'Almacén creado'
        });
        this.loadWarehouses();
        this.warehouseFormDialogVisible = false;
        this.selectedWarehouse = null;
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo guardar el almacén'
        });
      }
    });
  }

  deleteWarehouse(warehouse: Warehouse): void {
    this.confirmationService.confirm({
      message: `¿Está seguro de eliminar el almacén ${warehouse.name}?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.inventoryService.deleteWarehouse(warehouse._id!).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Eliminado',
              detail: 'Almacén eliminado'
            });
            this.loadWarehouses();
          },
          error: () => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'No se pudo eliminar el almacén'
            });
          }
        });
      }
    });
  }

  cancelWarehouseEdit(): void {
    this.selectedWarehouse = null;
    this.warehouseFormDialogVisible = false;
  }

  // Device Management Methods
  editDevice(device: InventoryItem): void {
    if (!this.canUpdateInventory()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('inventory.no_update_permission'),
        detail: this.translate.instant('inventory.contact_admin'),
      });
      return;
    }

    // Exact mapping from InventoryPackageDevicesComponent to flatten objects
    this.selectedDevice = {
      _id: device._id,
      imei: device.IMEI || device.imei || '',
      sim: device.SIM || device.sim || '',
      protocol: typeof device.Protocol === 'object' ? device.Protocol._id : device.Protocol || device.protocol || '',
      package: typeof device.package === 'object' ? device.package._id : device.package,
      storage_id: device.storage_id || null, // Map storage_id
      // packageId: device.packageId // Optional, if needed
    };

    this.isEditDeviceMode = true;
    this.deviceDialogVisible = true;
  }

  saveDevice(): void {
    if (!this.canUpdateInventory()) return;

    if (!this.selectedDevice) {
      this.messageService.add({ severity: 'warn', summary: 'Error', detail: 'No hay dispositivo seleccionado' });
      return;
    }

    if (!this.selectedDevice.imei) {
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

    // Construct payload strictly as executed in the working component
    // Note: InventoryPackageDevicesComponent relies on this.currentPackageId.
    // Here we must rely on the device's existing package field.
    if (!this.selectedDevice.package) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'El dispositivo no pertenece a ningún paquete conocido.'
      });
      return;
    }

    const devicePayload: any = {
      IMEI: (this.selectedDevice.imei || '').trim(),
      SIM: (this.selectedDevice.sim || '').trim(),
      Protocol: this.selectedDevice.protocol,
      package: this.selectedDevice.package,
      storage_id: this.selectedDevice.storage_id || null,
    };

    const request = this.isEditDeviceMode && this.selectedDevice._id
      ? this.inventoryService.update(this.selectedDevice._id, devicePayload)
      : this.inventoryService.create(devicePayload);

    request.subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: this.isEditDeviceMode ? 'Dispositivo actualizado' : 'Dispositivo creado',
        });
        this.hideDeviceDialog();
        // Refresh search if active
        if (this.showingSearchResults && this.globalSearchQuery) {
          this.searchAllInventory();
        }
      },
      error: (err) => {
        let errorMessage = 'No se pudo guardar el dispositivo';
        if (err.error?.message) {
          errorMessage = Array.isArray(err.error.message) ? err.error.message.join(', ') : err.error.message;
        }
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: errorMessage,
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
                detail: 'Dispositivo eliminado',
              });
              if (this.showingSearchResults && this.globalSearchQuery) {
                this.searchAllInventory();
              }
            },
            error: () => {
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'No se pudo eliminar el dispositivo',
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
    this.isEditDeviceMode = false;
  }

  // Installation Methods
  installDevice(device: InventoryItem): void {
    if (device.installed) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Aviso',
        detail: 'El dispositivo ya está instalado',
      });
      return;
    }
    this.deviceToInstall = device;
    this.installationEmail = '';
    this.installationSimType = '';
    this.installationPlanId = '';
    this.installDialogVisible = true;
  }

  confirmInstallation(): void {
    if (!this.installationEmail?.trim()) {
      this.messageService.add({ severity: 'warn', summary: 'Email requerido', detail: 'Por favor ingrese una dirección de correo electrónico' });
      return;
    }

    // Email validation regex as in original component
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.installationEmail)) {
      this.messageService.add({ severity: 'error', summary: 'Email inválido', detail: 'Por favor ingrese una dirección de correo electrónico válida' });
      return;
    }

    if (!this.deviceToInstall || !this.deviceToInstall._id) return;

    const targetEmail = this.installationEmail.trim();

    this.userService.getByEmail(targetEmail).subscribe({
      next: (foundUser: any) => {
        const deviceInstallationData = {
          imei: this.deviceToInstall!.IMEI || this.deviceToInstall!.imei || '',
          sim: this.deviceToInstall!.SIM || this.deviceToInstall!.sim || '',
          protocol: this.deviceToInstall!.Protocol || this.deviceToInstall!.protocol || '',
          userId: foundUser._id,
          timestamp: new Date().toISOString(),
          name: `EN_ESPERA-${this.deviceToInstall!.IMEI || this.deviceToInstall!.imei || ''}`,
          brand: '6945e94df8034f4089c27394',
          model: '6945e987f8034f4089c2739e',
          plan: this.installationPlanId || '68e23db7015d99b2bd1b25c2',
          expiration_date: new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString(),
          technician_id: '68c68dba49db10f3cb6e3f8d',
          installation_details: 'EN_ESPERA',
          plate_number: `EN_ESPERA-${this.deviceToInstall!.IMEI || this.deviceToInstall!.imei || ''}`,
          sim_company: this.installationSimType || '',
        };

        // Store in session storage for the management module to pick up
        sessionStorage.setItem('deviceInstallationData', JSON.stringify(deviceInstallationData));

        this.messageService.add({
          severity: 'success',
          summary: 'Usuario encontrado',
          detail: `Navegando a management del usuario: ${foundUser.name} ${foundUser.last_name}`,
        });

        this.cancelInstallation();
        // Navigate to management module
        this.router.navigate(['/admin/management/t', foundUser._id]);
      },
      error: () => {
        this.messageService.add({
          severity: 'warn',
          summary: 'Usuario no encontrado',
          detail: `No se encontró un usuario con el email ${targetEmail}.`
        });
      }
    });

  }

  cancelInstallation(): void {
    this.installDialogVisible = false;
    this.deviceToInstall = null;
    this.installationEmail = '';
    this.installationSimType = '';
    this.installationPlanId = '';
  }
}
