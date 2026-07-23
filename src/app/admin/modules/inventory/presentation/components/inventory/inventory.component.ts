import { Component, OnInit, ViewEncapsulation, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { MenuItem, MessageService, ConfirmationService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import {
  InventoryItem,
  SimcardItem,
  InventoryService,
  Package,
  Warehouse,
  Conduce,
} from 'src/app/core/services/inventory.service';
import { PlansService } from 'src/app/core/services/plans.service';
import { Plan } from 'src/app/core/interfaces/plan.interface';
import { ProtocolsService } from 'src/app/core/services/protocols.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { UserService } from 'src/app/core/services/user.service';
import { User } from 'src/app/core/interfaces/user.interface';
import { SIM_CARD_TYPES } from 'src/app/core/constants/sim-card-types.constant';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.css'],
  providers: [MessageService, ConfirmationService],
  standalone: false,
  encapsulation: ViewEncapsulation.None
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
  selectedWarehouseAccessUsers: User[] = [];
  warehouseUserSearchDialogVisible = false;
  warehouseUserSearchTerm = '';
  warehouseUserSearchResults: User[] = [];
  isSearchingWarehouseUsers = false;

  loading = true;
  loadingWarehouses = false;
  protocols: { label: string; value: string }[] = [];
  loadedProtocols: any[] = [];

  globalSearchQuery = '';
  globalSearchStorageId: string | null = null;
  globalSearchStatus: string = '';
  isSearchingGlobal = false;
  allDevicesSearchResults: InventoryItem[] = [];
  showingSearchResults = false;

  // Pagination
  currentPage = 1;
  itemsPerPage = 50;
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
  availableApnNames = [
    { label: 'GigSky', value: 'gigsky-02' },
    { label: 'Altan WiFi', value: 'altanwifi' },
    { label: 'DataOn', value: 'dataon' },
    { label: 'EM', value: 'em' }
  ];
  installationPlanId = '';
  availablePlans: any[] = [];
  isEditDeviceMode = false;

  // View Toggle
  currentView: 'devices' | 'simcards' = 'devices';

  // Simcards State
  @ViewChild('iccidInput') iccidInput?: ElementRef;
  @ViewChild('imeiInput') imeiInput?: ElementRef;
  simcardsList: SimcardItem[] = [];
  simcardDialogVisible = false;
  conducesDialogVisible = false;
  conducesList: Conduce[] = [];
  isLoadingConduces = false;
  conducesTotalItems = 0;
  conduceDetailsDialogVisible = false;
  selectedConduceDetails: any = null;
  shippingDialogVisible = false;
  shippingDestinationWarehouse: string | null = null;
  shippingDescription: string = '';
  shippingDevices: any[] = [];
  shippingSimcards: any[] = [];
  shippingDeviceInput: string = '';
  shippingSimcardInput: string = '';
  assignPackageDialogVisible = false;
  isNewDeviceInShipping = false;
  deviceToAssignPackage: InventoryItem | any | null = null;
  selectedPackageToAssign: string | null = null;
  selectedProtocolToAssign: string | null = null;

  assignPackageDialogSimcardVisible = false;
  isNewSimcardInShipping = false;
  simcardToAssignPackage: SimcardItem | any | null = null;
  selectedPackageToAssignSimcard: string | null = null;

  selectedSimcard: SimcardItem | null = null;
  isEditSimcardMode = false;

  // Simcards Search & Pagination
  simcardSearchQuery = '';
  simcardSearchStorageId: string | null = null;
  simcardSearchStatus = '';
  simcardSearchCompany = '';
  isSearchingSimcards = false;
  simcardCurrentPage = 1;
  simcardItemsPerPage = 50;
  totalConducesRecords = 0;
  simcardTotalItems = 0;
  simcardIsLoadingMore = false;

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
        this.loadedProtocols = list;
        this.protocols = list.map((p) => ({
          label: p.name || p.type || p._id,
          value: p._id,
        }));
      },
      error: () => {
        this.loadedProtocols = [];
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
    if (element.scrollHeight - Math.ceil(element.scrollTop) <= element.clientHeight + 50) {
      if (!this.isLoadingMore && !this.isSearchingGlobal && this.allDevicesSearchResults.length < this.totalItems) {
        this.currentPage++;
        this.searchAllInventory(false);
      }
    }
  }

  loadMoreDevices(): void {
    if (!this.isLoadingMore && !this.isSearchingGlobal && this.allDevicesSearchResults.length < this.totalItems) {
      this.currentPage++;
      this.searchAllInventory(false);
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

  isDeviceInActivation(device: InventoryItem): boolean {
    return !!(device as any)?.activation_mode;
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

  // Warehouse Methods
  get attentionWarehouses(): Warehouse[] {
    return this.warehouses ? this.warehouses.filter(w => (w.stock || 0) < (w.min_quantity || 0)) : [];
  }

  get regularWarehouses(): Warehouse[] {
    return this.warehouses ? this.warehouses.filter(w => (w.stock || 0) >= (w.min_quantity || 0)) : [];
  }

  loadWarehouses(): void {
    // Use cached data from sidebar immediately if available
    const cached = this.inventoryService.warehouses$.getValue();
    if (cached && cached.length > 0) {
      this.warehouses = cached;
      this.loadingWarehouses = false;
      this.updateWarehouseStats(cached, false); // Don't show toasts for cached data

      // Refresh silently in background
      this.inventoryService.getWarehouses().subscribe({
        next: (data) => {
          this.warehouses = data;
          this.updateWarehouseStats(data, false);
        },
        error: () => { /* silent background refresh */ }
      });
    } else {
      // No cached data — load with spinner
      this.loadingWarehouses = true;
      this.inventoryService.getWarehouses().subscribe({
        next: (data) => {
          this.warehouses = data;
          this.loadingWarehouses = false;
          this.updateWarehouseStats(data, true);
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
  }

  private updateWarehouseStats(warehouses: any[], showToasts: boolean): void {
    if (warehouses) {
      const lowStockWarehouses = warehouses.filter(w => (w.stock || 0) < (w.min_quantity || 0));
      this.lowStockCount = lowStockWarehouses.length;

      if (showToasts) {
        lowStockWarehouses.forEach(w => {
          this.messageService.add({
            severity: 'warn',
            summary: 'Stock Bajo detectado',
            detail: `El almacén "${w.name}" tiene ${w.stock || 0} dispositivos (Mínimo: ${w.min_quantity || 0})`,
            life: 5000
          });
        });
      }
    } else {
      this.lowStockCount = 0;
    }
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
    this.switchView('devices');
    this.searchAllInventory(true, () => {
      this.loadingWarehouseId = null;
      this.warehouseDialogVisible = false;
    });
  }

  filterSimcardsByWarehouse(warehouse: Warehouse): void {
    if (!warehouse._id) return;
    this.loadingWarehouseId = warehouse._id;
    this.simcardSearchStorageId = warehouse._id;
    this.simcardSearchStatus = 'available';
    this.switchView('simcards');
    this.searchAllSimcards(true);
    this.loadingWarehouseId = null;
    this.warehouseDialogVisible = false;
  }

  openNewWarehouse(): void {
    this.selectedWarehouse = { name: '', description: '', assigned_user: '', access_users: [] };
    this.selectedWarehouseAccessUsers = [];
    this.isEditWarehouseMode = false;
    this.warehouseFormDialogVisible = true;
  }

  editWarehouse(warehouse: Warehouse): void {
    this.selectedWarehouse = { ...warehouse };
    this.selectedWarehouseAccessUsers = this.getWarehouseAccessUsers(warehouse).map(email => ({
      _id: email,
      name: '',
      last_name: '',
      email,
      access_level_id: null as any,
    }));
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

    this.selectedWarehouse.access_users = this.getSelectedWarehouseAccessEmails();
    this.selectedWarehouse.assigned_user = this.selectedWarehouse.access_users[0] || '';

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
        this.selectedWarehouseAccessUsers = [];
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
    this.selectedWarehouseAccessUsers = [];
    this.closeWarehouseUserSearchDialog();
    this.warehouseFormDialogVisible = false;
  }

  getWarehouseAccessUsers(warehouse: Warehouse | any): string[] {
    const users = Array.isArray(warehouse?.access_users) ? warehouse.access_users : [];
    return Array.from(
      new Set(
        [...users, warehouse?.assigned_user]
          .map((value: string) => String(value || '').trim().toLowerCase())
          .filter(Boolean)
      )
    );
  }

  getWarehouseAccessUsersLabel(warehouse: Warehouse): string {
    const users = this.getWarehouseAccessUsers(warehouse);
    return users.length ? users.join(', ') : '';
  }

  openWarehouseUserSearchDialog(): void {
    this.warehouseUserSearchDialogVisible = true;
    this.warehouseUserSearchTerm = '';
    this.warehouseUserSearchResults = [];
  }

  closeWarehouseUserSearchDialog(): void {
    this.warehouseUserSearchDialogVisible = false;
    this.warehouseUserSearchTerm = '';
    this.warehouseUserSearchResults = [];
    this.isSearchingWarehouseUsers = false;
  }

  searchWarehouseAccessUsers(): void {
    const query = this.warehouseUserSearchTerm.trim();
    if (query.length < 2) {
      this.warehouseUserSearchResults = [];
      return;
    }

    this.isSearchingWarehouseUsers = true;
    this.userService.search(query, undefined, 0, 15).subscribe({
      next: (response) => {
        this.warehouseUserSearchResults = response.users || [];
        this.isSearchingWarehouseUsers = false;
      },
      error: () => {
        this.isSearchingWarehouseUsers = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo buscar usuarios'
        });
      }
    });
  }

  addWarehouseAccessUser(user: User): void {
    const email = this.normalizeWarehouseAccessEmail(user?.email);
    if (!email) return;

    if (this.isWarehouseAccessUserSelected(user)) {
      this.messageService.add({
        severity: 'info',
        summary: 'Usuario ya agregado',
        detail: 'Ese usuario ya tiene acceso al almacén'
      });
      return;
    }

    this.selectedWarehouseAccessUsers = [...this.selectedWarehouseAccessUsers, user];
    this.closeWarehouseUserSearchDialog();
  }

  removeWarehouseAccessUser(user: User): void {
    const email = this.normalizeWarehouseAccessEmail(user?.email);
    this.selectedWarehouseAccessUsers = this.selectedWarehouseAccessUsers.filter(
      selected => this.normalizeWarehouseAccessEmail(selected.email) !== email
    );
  }

  isWarehouseAccessUserSelected(user: User): boolean {
    const email = this.normalizeWarehouseAccessEmail(user?.email);
    return !!email && this.getSelectedWarehouseAccessEmails().includes(email);
  }

  getWarehouseUserDisplayName(user: User): string {
    const fullName = [user?.name, user?.last_name].filter(Boolean).join(' ').trim();
    return fullName || user?.email || 'Usuario';
  }

  private getSelectedWarehouseAccessEmails(): string[] {
    return Array.from(
      new Set(
        this.selectedWarehouseAccessUsers
          .map(user => this.normalizeWarehouseAccessEmail(user?.email))
          .filter(Boolean)
      )
    );
  }

  private normalizeWarehouseAccessEmail(value: string | undefined | null): string {
    return String(value || '').trim().toLowerCase();
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

  focusImei(): void {
    setTimeout(() => {
      if (this.imeiInput?.nativeElement) {
        this.imeiInput.nativeElement.focus();
      }
    }, 50);
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

    // If device is in activation mode (registered without mechanic), navigate to management
    if ((device as any).activation_mode && (device as any).device_parent_id) {
      const imei = device.IMEI || device.imei || '';
      const parentId = (device as any).device_parent_id;
      this.messageService.add({
        severity: 'info',
        summary: 'Modo activación',
        detail: 'Navegando al dispositivo en management...',
        life: 2000,
      });
      this.router.navigate(['/admin/management/t', parentId], {
        queryParams: { search: imei }
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
          technician_id: '',
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

  // --- Simcards Methods ---
  switchView(view: 'devices' | 'simcards'): void {
    this.currentView = view;
    if (view === 'simcards' && this.simcardsList.length === 0) {
      this.searchAllSimcards(true);
    }
  }

  searchAllSimcards(resetPage = true): void {
    if (resetPage) {
      this.simcardCurrentPage = 1;
      this.simcardsList = [];
      this.isSearchingSimcards = true;
    } else {
      this.simcardIsLoadingMore = true;
    }

    this.inventoryService.searchAllSimcards(
      this.simcardSearchQuery.trim(),
      this.simcardSearchStorageId || undefined,
      this.simcardCurrentPage,
      this.simcardItemsPerPage,
      this.simcardSearchStatus || undefined,
      this.simcardSearchCompany || undefined
    ).subscribe({
      next: (response) => {
        if (resetPage) {
          this.simcardsList = response.data || [];
        } else {
          this.simcardsList = [...this.simcardsList, ...(response.data || [])];
        }

        this.simcardTotalItems = response.total;
        this.isSearchingSimcards = false;
        this.simcardIsLoadingMore = false;
      },
      error: () => {
        if (resetPage) {
          this.simcardsList = [];
        }
        this.isSearchingSimcards = false;
        this.simcardIsLoadingMore = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al buscar simcards',
        });
      },
    });
  }

  onSimcardResultsScroll(event: any): void {
    const element = event.target;
    if (element.scrollHeight - Math.ceil(element.scrollTop) <= element.clientHeight + 50) {
      if (!this.simcardIsLoadingMore && !this.isSearchingSimcards && this.simcardsList.length < this.simcardTotalItems) {
        this.simcardCurrentPage++;
        this.searchAllSimcards(false);
      }
    }
  }

  loadMoreSimcards(): void {
    if (!this.simcardIsLoadingMore && !this.isSearchingSimcards && this.simcardsList.length < this.simcardTotalItems) {
      this.simcardCurrentPage++;
      this.searchAllSimcards(false);
    }
  }

  clearSimcardSearch(): void {
    this.simcardSearchQuery = '';
    this.simcardSearchStorageId = null;
    this.simcardSearchStatus = '';
    this.simcardSearchCompany = '';
    this.searchAllSimcards(true);
  }

  onSimcardCompanyChange(company: string): void {
    if (!this.selectedSimcard) return;

    if (company === 'nacionales') {
      this.selectedSimcard.apn_name = '';
    } else {
      this.selectedSimcard.idsim = '';
      if (company === 'global-m') {
        this.selectedSimcard.apn_name = 'altanwifi';
      } else if (company === 'global-m2') {
        this.selectedSimcard.apn_name = 'gigsky-02';
      } else if (company === 'global-e') {
        this.selectedSimcard.apn_name = 'em';
      }
    }
  }

  openNewSimcard(): void {
    this.selectedSimcard = {
      iccid: '',
      sim_company: 'nacionales',
      apn_name: '',
      idsim: '',
      storage_id: null,
    };
    this.isEditSimcardMode = false;
    this.simcardDialogVisible = true;
  }

  editSimcard(simcard: SimcardItem): void {
    if (!this.canUpdateInventory()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('inventory.no_update_permission'),
        detail: this.translate.instant('inventory.contact_admin'),
      });
      return;
    }

    this.selectedSimcard = {
      _id: simcard._id,
      iccid: simcard.iccid,
      sim_company: simcard.sim_company,
      apn_name: simcard.apn_name || '',
      idsim: simcard.idsim || '',
      storage_id: simcard.storage_id ? (typeof simcard.storage_id === 'object' ? (simcard.storage_id as any)._id : simcard.storage_id) : null
    };
    this.isEditSimcardMode = true;
    this.simcardDialogVisible = true;
  }

  saveSimcard(): void {
    if (!this.canUpdateInventory() && this.isEditSimcardMode) return;
    if (!this.canCreateInventory() && !this.isEditSimcardMode) return;

    if (!this.selectedSimcard) return;

    if (!this.selectedSimcard.iccid || !this.selectedSimcard.iccid.trim()) {
      this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'El ICCID es requerido' });
      return;
    }

    const payload: any = {
      iccid: this.selectedSimcard.iccid.trim(),
      sim_company: this.selectedSimcard.sim_company || '',
      apn_name: this.selectedSimcard.apn_name || '',
      storage_id: this.selectedSimcard.storage_id || null
    };

    if (this.selectedSimcard.sim_company === 'nacionales') {
      payload.idsim = this.selectedSimcard.idsim || '';
    }

    const request = this.isEditSimcardMode && this.selectedSimcard._id
      ? this.inventoryService.updateSimcard(this.selectedSimcard._id, payload)
      : this.inventoryService.createSimcard(payload);

    request.subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: this.isEditSimcardMode ? 'Simcard actualizada' : 'Simcard registrada',
        });

        if (this.isEditSimcardMode) {
          this.hideSimcardDialog();
        } else {
          // Continuous registration mode
          if (this.selectedSimcard) {
            this.selectedSimcard.iccid = '';
            this.selectedSimcard.idsim = '';
          }
          setTimeout(() => {
            if (this.iccidInput && this.iccidInput.nativeElement) {
              this.iccidInput.nativeElement.focus();
            }
          }, 100);
        }

        this.searchAllSimcards(true);
      },
      error: (err) => {
        let errorMessage = 'No se pudo guardar la simcard';
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

  deleteSimcard(simcard: SimcardItem): void {
    if (!this.canDeleteInventory()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('inventory.no_delete_permission'),
        detail: this.translate.instant('inventory.contact_admin'),
      });
      return;
    }

    this.confirmationService.confirm({
      message: `¿Está seguro de eliminar la Simcard ICCID: ${simcard.iccid}?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        if (simcard._id) {
          this.inventoryService.deleteSimcard(simcard._id).subscribe({
            next: () => {
              this.messageService.add({
                severity: 'success',
                summary: 'Eliminado',
                detail: 'Simcard eliminada',
              });
              this.searchAllSimcards(true);
            },
            error: () => {
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'No se pudo eliminar la Simcard',
              });
            },
          });
        }
      },
    });
  }

  hideSimcardDialog(): void {
    this.simcardDialogVisible = false;
    this.selectedSimcard = null;
    this.isEditSimcardMode = false;
  }

  focusIccid(): void {
    setTimeout(() => {
      if (this.iccidInput?.nativeElement) {
        this.iccidInput.nativeElement.focus();
      }
    }, 50);
  }

  // --- Shipping & Conduces Methods ---
  openConducesList(): void {
    this.conducesDialogVisible = true;
    // La carga inicial se disparará por el onLazyLoad de p-table
  }

  hideConducesDialog(): void {
    this.conducesDialogVisible = false;
  }

  showConduceDetails(conduce: any): void {
    this.selectedConduceDetails = conduce;
    this.conduceDetailsDialogVisible = true;
  }

  hideConduceDetailsDialog(): void {
    this.conduceDetailsDialogVisible = false;
    this.selectedConduceDetails = null;
  }

  loadConduces(page = 1, limit = 10): void {
    this.isLoadingConduces = true;
    this.inventoryService.getConduces(page, limit).subscribe({
      next: (response) => {
        this.conducesList = response.data;
        this.totalConducesRecords = response.total;
        this.isLoadingConduces = false;
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los conduces.' });
        this.isLoadingConduces = false;
      }
    });
  }

  loadConducesLazy(event: any): void {
    const limit = event.rows || 10;
    const page = (event.first || 0) / limit + 1;
    this.loadConduces(page, limit);
  }

  async generateConducePdf(conduce: any): Promise<void> {
    const doc = new jsPDF();
    const marginX = 15;
    let currentY = 20;

    // Load Logo
    const img = new Image();
    img.src = 'logo/LOGO.png';
    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve; // Continue even if logo fails to load (e.g. adblocker)
    });

    if (img.complete && img.naturalWidth > 0) {
      const imgWidth = 40;
      const imgHeight = imgWidth * (img.naturalHeight / img.naturalWidth);
      doc.addImage(img, 'PNG', doc.internal.pageSize.getWidth() - marginX - imgWidth, 15, imgWidth, imgHeight);
    }

    // Header
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(34, 40, 49);
    doc.text("Conduce de Traslado", marginX, currentY);

    currentY += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text("TEL: (809) 576-1000 | Email: info@montao.net | Web: gps.montao.net", marginX, currentY);
    currentY += 5;
    doc.text("Principal: AV.FRANCO BIDO, NIBAJE #135, Santiago R.D.", marginX, currentY);

    currentY += 10;
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);

    const formatDate = (dateStr: string | Date | undefined) => {
      if (!dateStr) return 'Fecha no disponible';
      const date = new Date(dateStr);
      return date.toLocaleString('es-DO', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    };

    // Metadata
    const leftValX = marginX + 20;
    const rightColX = 90;
    const rightValX = rightColX + 30;

    // Line 1: Número de Conduce (Left) & Autorizado por (Right)
    doc.text(`Conduce:`, marginX, currentY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    doc.text(`${conduce.conduceNumber || 'N/A'}`, leftValX, currentY);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`Autorizado por:`, rightColX, currentY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    const creator = conduce.created_by ? `${conduce.created_by.name || ''} ${conduce.created_by.last_name || ''}`.trim() : 'N/A';
    doc.text(`${creator}`, rightValX, currentY);

    currentY += 7;

    // Line 2: Fecha de Creación (Left) & Almacén Destino (Right)
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`Fecha:`, marginX, currentY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    doc.text(`${formatDate(conduce.createdAt)}`, leftValX, currentY);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`Enviado a:`, rightColX, currentY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(34, 40, 49);
    const destination = typeof conduce.destination_warehouse === 'object' ? (conduce.destination_warehouse as any).name : 'N/A';
    doc.text(`${destination}`, rightValX, currentY);

    if (conduce.description) {
      currentY += 10;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(`Observación:`, marginX, currentY);
      doc.setFont("helvetica", "italic");
      const splitDesc = doc.splitTextToSize(conduce.description, 180);
      doc.text(splitDesc, marginX, currentY + 6);
      currentY += (splitDesc.length * 6) + 4;
    }

    currentY += 15;

    // Dispositivos Table
    if (conduce.devices && conduce.devices.length > 0) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(34, 40, 49);
      doc.text(`Dispositivos Incluidos (${conduce.devices.length})`, marginX, currentY);

      const deviceRows = conduce.devices.map((d: any, index: number) => [
        index + 1,
        d.IMEI || d.imei || 'N/A',
        this.getProtocolLabel(d.Protocol) || 'N/A',
        d.SIM || d.sim || 'N/A'
      ]);

      const midIndex = Math.ceil(deviceRows.length / 2);
      const leftCol = deviceRows.slice(0, midIndex);
      const rightCol = deviceRows.slice(midIndex);

      const combinedDeviceRows = [];
      for (let i = 0; i < leftCol.length; i++) {
        const leftItem = leftCol[i];
        const rightItem = rightCol[i] || ['', '', '', ''];
        combinedDeviceRows.push([...leftItem, ...rightItem]);
      }

      autoTable(doc, {
        startY: currentY + 5,
        head: [['#', 'GPS', 'Modelo', 'Simcard', '#', 'GPS', 'Modelo', 'Simcard']],
        body: combinedDeviceRows,
        theme: 'striped',
        headStyles: { fillColor: [189, 53, 53] },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { fontStyle: 'bold' },
          4: { fontStyle: 'bold' }
        },
        margin: { left: marginX, right: marginX }
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // Simcards Table
    if (conduce.simcards && conduce.simcards.length > 0) {
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(34, 40, 49);
      doc.text(`Simcards Incluidas (${conduce.simcards.length})`, marginX, currentY);

      const simcardRows = conduce.simcards.map((s: any, index: number) => {
        let finalIccid = s.iccid || 'N/A';
        if (s.sim_company && s.sim_company.toLowerCase() === 'nacionales' && s.iccid) {
          const onlyNumbers = s.iccid.replace(/\D/g, '');
          if (onlyNumbers) {
            try {
              finalIccid = (BigInt(onlyNumbers) * 2n).toString();
            } catch (e) {
              finalIccid = onlyNumbers; // Fallback if parsing fails
            }
          }
        }

        return [
          index + 1,
          finalIccid,
          s.sim_company || 'N/A'
        ];
      });

      const midIndex = Math.ceil(simcardRows.length / 2);
      const leftCol = simcardRows.slice(0, midIndex);
      const rightCol = simcardRows.slice(midIndex);

      const combinedSimcardRows = [];
      for (let i = 0; i < leftCol.length; i++) {
        const leftItem = leftCol[i];
        const rightItem = rightCol[i] || ['', '', ''];
        combinedSimcardRows.push([...leftItem, ...rightItem]);
      }

      autoTable(doc, {
        startY: currentY + 5,
        head: [['#', 'ICCID', 'Compañía', '#', 'ICCID', 'Compañía']],
        body: combinedSimcardRows,
        theme: 'striped',
        headStyles: { fillColor: [189, 53, 53] },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { fontStyle: 'bold' },
          3: { fontStyle: 'bold' }
        },
        margin: { left: marginX, right: marginX }
      });
    }

    // Pie de página (Firmas)
    const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : currentY;

    if (finalY < 230) {
      currentY = 250;
    } else {
      doc.addPage();
      currentY = 250;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);

    doc.setLineWidth(0.5);
    doc.setDrawColor(150, 150, 150);
    // Linea Firma Entrega
    doc.line(marginX + 10, currentY, marginX + 70, currentY);
    doc.text("Entregado por (Firma)", marginX + 20, currentY + 5);

    // Linea Firma Recibe
    doc.line(130, currentY, 190, currentY);
    doc.text("Recibido por (Firma)", 140, currentY + 5);

    const filename = `Conduce_${conduce.conduceNumber || new Date().getTime()}.pdf`;
    doc.save(filename);
  }

  openShippingModal(): void {
    this.shippingDialogVisible = true;
  }

  hideShippingDialog(): void {
    this.shippingDialogVisible = false;
    this.shippingDestinationWarehouse = null;
    this.shippingDescription = '';
    this.shippingDevices = [];
    this.shippingSimcards = [];
    this.shippingDeviceInput = '';
    this.shippingSimcardInput = '';
  }

  addShippingDevice(): void {
    const imei = this.shippingDeviceInput.trim();
    if (!imei || this.shippingDevices.includes(imei)) return;

    this.inventoryService.searchAllDevices(imei).subscribe({
      next: (response) => {
        const device = response.data?.find(d => (d.IMEI === imei || d.imei === imei));
        if (!device) {
          this.isNewDeviceInShipping = true;
          this.deviceToAssignPackage = { imei: imei, IMEI: imei };
          this.assignPackageDialogVisible = true;
          return;
        }

        const packageId = device.packageId || (typeof device.package === 'object' ? device.package?._id : device.package);

        if (!packageId) {
          this.isNewDeviceInShipping = false;
          this.deviceToAssignPackage = device;
          this.assignPackageDialogVisible = true;
        } else {
          // Check if it's already in the list by IMEI
          if (!this.shippingDevices.find(d => (d.IMEI === imei || d.imei === imei))) {
            this.shippingDevices.push(device);
            this.shippingDeviceInput = '';
            this.messageService.add({ severity: 'success', summary: 'Agregado', detail: `Dispositivo ${imei} preparado para envío.` });
          }
        }
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al buscar el dispositivo.' });
      }
    });
  }

  hideAssignPackageDialog(): void {
    this.assignPackageDialogVisible = false;
    this.deviceToAssignPackage = null;
    this.selectedPackageToAssign = null;
    this.selectedProtocolToAssign = null;
    this.selectedSimcardToAssign = '';
    this.isNewDeviceInShipping = false;
  }

  // Simcard state
  selectedCompanyToAssignSimcard: string | null = null;
  selectedApnToAssignSimcard: string = '';
  selectedSimcardToAssign: string = '';

  onShippingSimcardCompanyChange(company: string): void {
    if (!company) {
      this.selectedApnToAssignSimcard = '';
      return;
    }

    if (company === 'nacionales') {
      this.selectedApnToAssignSimcard = '';
    } else if (company === 'global-m') {
      this.selectedApnToAssignSimcard = 'altanwifi';
    } else if (company === 'global-m2') {
      this.selectedApnToAssignSimcard = 'gigsky-02';
    } else if (company === 'global-e') {
      this.selectedApnToAssignSimcard = 'em';
    }
  }

  assignPackageAndAdd(): void {
    if (!this.deviceToAssignPackage || !this.selectedPackageToAssign) return;

    if (this.isNewDeviceInShipping) {
      if (!this.selectedProtocolToAssign) {
        this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'El protocolo es requerido para registrar un dispositivo nuevo.' });
        return;
      }
      const newDevicePayload = {
        IMEI: this.deviceToAssignPackage.imei || this.deviceToAssignPackage.IMEI,
        SIM: this.selectedSimcardToAssign || '',
        Protocol: this.selectedProtocolToAssign,
        package: this.selectedPackageToAssign
      };

      this.inventoryService.create(newDevicePayload).subscribe({
        next: (createdDevice) => {
          this.messageService.add({ severity: 'success', summary: 'Registrado', detail: 'Dispositivo registrado y agregado al envío.' });
          const imei = createdDevice.IMEI || createdDevice.imei;
          if (imei && !this.shippingDevices.find(d => (d.IMEI === imei || d.imei === imei))) {
            this.shippingDevices.push(createdDevice);
            this.shippingDeviceInput = '';
          }
          this.hideAssignPackageDialog();
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo registrar el dispositivo.' });
        }
      });
    } else {
      if (!this.deviceToAssignPackage._id) return;
      this.inventoryService.update(this.deviceToAssignPackage._id, { package: this.selectedPackageToAssign }).subscribe({
        next: () => {
          const imei = this.deviceToAssignPackage!.IMEI || this.deviceToAssignPackage!.imei;
          this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Paquete asignado y dispositivo agregado al envío.' });

          if (imei && !this.shippingDevices.find(d => (d.IMEI === imei || d.imei === imei))) {
            this.shippingDevices.push(this.deviceToAssignPackage);
            this.shippingDeviceInput = '';
          }
          this.hideAssignPackageDialog();
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo asignar el paquete.' });
        }
      });
    }
  }

  removeShippingDevice(index: number): void {
    this.shippingDevices.splice(index, 1);
  }

  addShippingSimcard(): void {
    const iccid = this.shippingSimcardInput.trim();
    if (!iccid || this.shippingSimcards.includes(iccid)) return;

    this.inventoryService.searchAllSimcards(iccid).subscribe({
      next: (response) => {
        const simcard = response.data?.find(s => s.iccid === iccid);

        if (!simcard) {
          this.isNewSimcardInShipping = true;
          this.simcardToAssignPackage = { iccid: iccid };
          this.selectedCompanyToAssignSimcard = 'nacionales';
          this.selectedApnToAssignSimcard = '';
          this.assignPackageDialogSimcardVisible = true;
          return;
        }

        // Simcard exists, no package needed
        if (!this.shippingSimcards.find(s => s.iccid === iccid)) {
          this.shippingSimcards.push(simcard);
          this.shippingSimcardInput = '';
          this.messageService.add({ severity: 'success', summary: 'Agregado', detail: `Simcard ${iccid} preparada para envío.` });
        }
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al buscar el simcard.' });
      }
    });
  }

  hideAssignPackageSimcardDialog(): void {
    this.assignPackageDialogSimcardVisible = false;
    this.simcardToAssignPackage = null;
    this.selectedPackageToAssignSimcard = null;
    this.selectedCompanyToAssignSimcard = null;
    this.selectedApnToAssignSimcard = '';
    this.isNewSimcardInShipping = false;
  }

  assignPackageAndAddSimcard(): void {
    if (!this.simcardToAssignPackage) return;

    if (this.isNewSimcardInShipping) {
      if (!this.selectedCompanyToAssignSimcard) {
        this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'Debe seleccionar la compañía de la simcard.' });
        return;
      }
      const newSimcardPayload = {
        iccid: this.simcardToAssignPackage.iccid,
        sim_company: this.selectedCompanyToAssignSimcard,
        apn_name: this.selectedApnToAssignSimcard || ''
      };

      this.inventoryService.createSimcard(newSimcardPayload).subscribe({
        next: (createdSimcard) => {
          this.messageService.add({ severity: 'success', summary: 'Registrado', detail: 'Simcard registrada y agregada al envío.' });
          const iccid = createdSimcard.iccid;
          if (iccid && !this.shippingSimcards.find(s => s.iccid === iccid)) {
            this.shippingSimcards.push(createdSimcard);
            this.shippingSimcardInput = '';
          }
          this.hideAssignPackageSimcardDialog();
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo registrar la simcard.' });
        }
      });
    } else {
      if (!this.simcardToAssignPackage._id) return;
      this.inventoryService.updateSimcard(this.simcardToAssignPackage._id, { package: this.selectedPackageToAssignSimcard }).subscribe({
        next: () => {
          const iccid = this.simcardToAssignPackage!.iccid;
          this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Paquete asignado y simcard agregada al envío.' });

          if (iccid && !this.shippingSimcards.find(s => s.iccid === iccid)) {
            this.shippingSimcards.push(this.simcardToAssignPackage);
            this.shippingSimcardInput = '';
          }
          this.hideAssignPackageSimcardDialog();
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo asignar el paquete a la simcard.' });
        }
      });
    }
  }

  removeShippingSimcard(index: number): void {
    this.shippingSimcards.splice(index, 1);
  }

  confirmConduce(): void {
    if (!this.shippingDestinationWarehouse) {
      this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'Debe seleccionar un almacén destino.' });
      return;
    }

    if (this.shippingDevices.length === 0 && this.shippingSimcards.length === 0) {
      this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'Debe agregar al menos un dispositivo o simcard.' });
      return;
    }

    // Since our shipping arrays are currently arrays of strings (IMEI and ICCID),
    // we need to resolve them to their ObjectIds to send to the backend.
    // For simplicity given the current arrays, we'll map them by looking them up in our search caches,
    // or we'll dispatch a request if needed. Actually, `allDevicesSearchResults` and `simcardsList`
    // don't always contain the newly added items. It's better to modify the add functions 
    // to store the `_id` as well. But right now we'll do the backend call with what we have.
    // Actually, I'll modify the arrays to store objects { id: string, name: string } later if needed.
    // Wait, let's just use `shippingDevices` and `shippingSimcards` directly in the backend `ConduceService` using a lookup by IMEI/ICCID?
    // No, DTO requires MongoId. I need to store the ObjectIds in the array.

    // Let's refactor `shippingDevices` and `shippingSimcards` to hold the objects we already fetched in `addShippingDevice` and `addShippingSimcard`.
    const payload: any = {
      destination_warehouse: this.shippingDestinationWarehouse,
      description: this.shippingDescription,
      devices: this.shippingDevices.map((d: any) => d._id).filter((id: any) => id),
      simcards: this.shippingSimcards.map((s: any) => s._id).filter((id: any) => id)
    };

    if (payload.devices.length === 0 && payload.simcards.length === 0) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron recuperar los IDs de los dispositivos/simcards. Asegurese de que tengan un _id válido.' });
      return;
    }

    this.inventoryService.createConduce(payload).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Conduce creado correctamente.' });
        this.hideShippingDialog();
        this.loadConduces(); // Refresh the list if it's open, or just in background
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Ocurrió un error al crear el conduce.' });
      }
    });
  }
}
