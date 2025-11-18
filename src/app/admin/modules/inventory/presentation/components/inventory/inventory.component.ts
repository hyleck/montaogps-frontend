import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MenuItem, MessageService, ConfirmationService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import {
  InventoryItem,
  InventoryService,
  Package,
} from 'src/app/core/services/inventory.service';
import { ProtocolsService } from 'src/app/core/services/protocols.service';
import { AuthService } from 'src/app/core/services/auth.service';

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
  selectedPackage: Package | null = null;
  packageDialogVisible = false;
  isEditPackageMode = false;

  loading = true;
  protocols: { label: string; value: string }[] = [];

  globalSearchQuery = '';
  isSearchingGlobal = false;
  allDevicesSearchResults: InventoryItem[] = [];
  showingSearchResults = false;

  constructor(
    private inventoryService: InventoryService,
    private protocolsService: ProtocolsService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private translate: TranslateService,
    private authService: AuthService,
    private router: Router,
  ) {}

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
}
