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
import { ProtocolsService } from 'src/app/core/services/protocols.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { UserService } from 'src/app/core/services/user.service';

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
  isEditPackageMode = false;
  isEditMode = false;
  isEditWarehouseMode = false;

  loading = true;
  loadingWarehouses = false;
  protocols: { label: string; value: string }[] = [];

  globalSearchQuery = '';
  isSearchingGlobal = false;
  allDevicesSearchResults: InventoryItem[] = [];
  showingSearchResults = false;

  // Device Management Properties
  deviceDialogVisible = false;
  installDialogVisible = false;
  selectedDevice: InventoryItem | null = null;
  deviceToInstall: InventoryItem | null = null;
  installationEmail = '';
  isEditDeviceMode = false;


  constructor(
    private inventoryService: InventoryService,
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

    this.openNewPackage();
    this.loadProtocols();
    this.loadPackages();
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

  searchAllInventory(): void {
    if (!this.globalSearchQuery.trim()) {
      this.clearGlobalSearch();
      return;
    }

    this.isSearchingGlobal = true;
    this.inventoryService.searchAllDevices(this.globalSearchQuery.trim()).subscribe({
      next: (results) => {
        this.allDevicesSearchResults = results || [];
        this.showingSearchResults = true;
        this.isSearchingGlobal = false;
      },
      error: () => {
        this.allDevicesSearchResults = [];
        this.showingSearchResults = false;
        this.isSearchingGlobal = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al buscar dispositivos',
        });
      },
    });
  }

  clearGlobalSearch(): void {
    this.globalSearchQuery = '';
    this.allDevicesSearchResults = [];
    this.showingSearchResults = false;
    this.isSearchingGlobal = false;
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
  loadWarehouses(): void {
    this.loadingWarehouses = true;
    this.inventoryService.getWarehouses().subscribe({
      next: (data) => {
        this.warehouses = data;
        this.loadingWarehouses = false;
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

  openNewWarehouse(): void {
    this.selectedWarehouse = { name: '', description: '' };
    this.isEditWarehouseMode = false;
  }

  editWarehouse(warehouse: Warehouse): void {
    this.selectedWarehouse = { ...warehouse };
    this.isEditWarehouseMode = true;
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
        this.selectedWarehouse = null; // Clear form/selection
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
  }
}
