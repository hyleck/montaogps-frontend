import { Component, OnDestroy, OnInit, ViewEncapsulation, ViewChild, ElementRef } from '@angular/core';
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
import { ProtocolsService } from 'src/app/core/services/protocols.service';
import { Protocol } from 'src/app/core/interfaces/protocol.interface';
import { AuthService } from 'src/app/core/services/auth.service';
import { UserService } from 'src/app/core/services/user.service';
import { SystemService } from 'src/app/core/services/system.service';
import { User } from 'src/app/core/interfaces/user.interface';
import { SIM_CARD_TYPES } from 'src/app/core/constants/sim-card-types.constant';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as QRCode from 'qrcode';
import { firstValueFrom } from 'rxjs';
import { formatConduceSimcardCode } from './conduce-simcard-code.util';
import { getApiErrorMessage } from '../../../../../../core/utils/api-error.util';

interface ShippingLabelForm {
  recipient: string;
  recipientPhone: string;
  destination: string;
  sender: string;
  senderPhone: string;
}

type ShippingLabelSocialNetwork = 'instagram' | 'facebook' | 'whatsapp' | 'website';
type ShippingLabelSocialQrs = Record<ShippingLabelSocialNetwork, HTMLImageElement | null>;
type ShippingLabelSocialIcons = Record<ShippingLabelSocialNetwork, HTMLImageElement | null>;

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.css'],
  providers: [MessageService, ConfirmationService],
  standalone: false,
  encapsulation: ViewEncapsulation.None
})
export class InventoryComponent implements OnInit, OnDestroy {
  items: MenuItem[] = [{ label: 'Inventario' }];
  home: MenuItem = { icon: 'pi pi-home', routerLink: '/admin/dashboard' };

  auditUserLabel(user: any): string {
    if (!user || typeof user !== 'object') return 'No registrado';
    const fullName = `${user.name || ''} ${user.last_name || ''}`.trim();
    return fullName || user.email || 'No registrado';
  }

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
  warehouseSearchQuery = '';
  selectedWarehouseAccessUsers: User[] = [];
  warehouseUserSearchDialogVisible = false;
  warehouseUserSearchTerm = '';
  warehouseUserSearchResults: User[] = [];
  isSearchingWarehouseUsers = false;

  loading = true;
  loadingWarehouses = false;
  protocols: { label: string; value: string }[] = [];
  loadedProtocols: Protocol[] = [];

  gpsModelsDialogVisible = false;
  gpsModelFormVisible = false;
  gpsModelsLoading = false;
  gpsModelSaving = false;
  gpsModelSearchQuery = '';
  selectedGpsModel: Protocol | null = null;
  gpsModelImageFile: File | null = null;
  gpsModelImageObjectUrl = '';
  readonly gpsModelImageMaxSize = 5 * 1024 * 1024;
  readonly gpsModelImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  gpsModelForm: { name: string; templateProtocolId: string } = {
    name: '',
    templateProtocolId: '',
  };

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
  availableSimCardTypes = SIM_CARD_TYPES;
  availableApnNames = [
    { label: 'GigSky', value: 'gigsky-02' },
    { label: 'Altan WiFi', value: 'altanwifi' },
    { label: 'DataOn', value: 'dataon' },
    { label: 'EM', value: 'em' }
  ];
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
  conducePrintDialogVisible = false;
  shippingLabelDialogVisible = false;
  selectedConduceForPrint: Conduce | null = null;
  shippingLabelFormTouched = false;
  isGeneratingShippingLabelPdf = false;
  private officialCompanyPhone = '';
  shippingLabelForm: ShippingLabelForm = this.createEmptyShippingLabelForm();
  shippingDialogVisible = false;
  shippingDestinationWarehouse: string | null = null;
  shippingDescription: string = '';
  shippingDevices: any[] = [];
  shippingSimcards: any[] = [];
  shippingDeviceInput: string = '';
  shippingSimcardInput: string = '';
  shippingRequestId: string = '';
  isCreatingConduce = false;
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
    private protocolsService: ProtocolsService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private translate: TranslateService,
    private authService: AuthService,
    private userService: UserService,
    private systemService: SystemService,
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
    this.loadWarehouses();
    this.loadOfficialCompanyPhone();
  }

  ngOnDestroy(): void {
    this.resetGpsModelImageSelection();
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

  canReadGpsModels(): boolean {
    return this.authService.hasPrivilege('protocols', 'read');
  }

  canCreateGpsModels(): boolean {
    return this.authService.hasPrivilege('protocols', 'create');
  }

  canUpdateGpsModels(): boolean {
    return this.authService.hasPrivilege('protocols', 'update');
  }

  canDeleteGpsModels(): boolean {
    return this.authService.hasPrivilege('protocols', 'delete');
  }

  private loadProtocols(): void {
    this.protocolsService.getAllProtocols().subscribe({
      next: (list: Protocol[]) => this.applyProtocols(list),
      error: () => {
        this.loadedProtocols = [];
        this.protocols = [];
      },
    });
  }

  openGpsModels(): void {
    if (!this.canReadGpsModels()) {
      this.messageService.add({
        severity: 'error',
        summary: 'Sin permiso',
        detail: 'No tienes permiso para consultar los modelos de GPS.',
      });
      return;
    }

    this.gpsModelsDialogVisible = true;
    this.gpsModelSearchQuery = '';
    this.cancelGpsModelForm();
    this.refreshGpsModels();
  }

  refreshGpsModels(): void {
    this.gpsModelsLoading = true;
    this.protocolsService.getAllProtocols().subscribe({
      next: (list) => {
        this.applyProtocols(list);
        this.gpsModelsLoading = false;
      },
      error: (error) => {
        this.gpsModelsLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudieron cargar los modelos',
          detail: getApiErrorMessage(error, 'No se pudieron consultar los modelos de GPS.'),
        });
      },
    });
  }

  startCreateGpsModel(): void {
    if (!this.canCreateGpsModels()) return;
    this.resetGpsModelImageSelection();
    this.selectedGpsModel = null;
    this.gpsModelForm = { name: '', templateProtocolId: '' };
    this.gpsModelFormVisible = true;
  }

  editGpsModel(model: Protocol): void {
    if (!this.canUpdateGpsModels()) return;
    this.resetGpsModelImageSelection();
    this.selectedGpsModel = model;
    this.gpsModelForm = {
      name: model.name,
      templateProtocolId: this.resolveTemplateProtocolId(model.templateProtocolId),
    };
    this.gpsModelFormVisible = true;
  }

  cancelGpsModelForm(): void {
    this.resetGpsModelImageSelection();
    this.gpsModelFormVisible = false;
    this.selectedGpsModel = null;
    this.gpsModelForm = { name: '', templateProtocolId: '' };
    this.gpsModelSaving = false;
  }

  saveGpsModel(): void {
    const name = this.gpsModelForm.name.trim();
    if (!name) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Nombre requerido',
        detail: 'Escribe el nombre del modelo GPS.',
      });
      return;
    }
    if (!this.selectedGpsModel && !this.gpsModelForm.templateProtocolId) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Plantilla requerida',
        detail: 'Selecciona el protocolo que servirá como plantilla.',
      });
      return;
    }

    this.gpsModelSaving = true;
    const operation = this.selectedGpsModel
      ? this.protocolsService.updateGpsModelFromTemplate(this.selectedGpsModel._id, {
          name,
          ...(this.gpsModelForm.templateProtocolId
            ? { templateProtocolId: this.gpsModelForm.templateProtocolId }
            : {}),
        }, this.gpsModelImageFile || undefined)
      : this.protocolsService.createGpsModelFromTemplate({
          name,
          templateProtocolId: this.gpsModelForm.templateProtocolId,
        }, this.gpsModelImageFile || undefined);

    operation.subscribe({
      next: (savedModel) => {
        this.messageService.add({
          severity: 'success',
          summary: this.selectedGpsModel ? 'Modelo actualizado' : 'Modelo creado',
          detail: `${savedModel.name} está listo para usarse en inventario.`,
        });
        this.cancelGpsModelForm();
        this.refreshGpsModels();
      },
      error: (error) => {
        this.gpsModelSaving = false;
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo guardar el modelo',
          detail: getApiErrorMessage(error, 'No se pudo guardar el modelo GPS.'),
        });
      },
    });
  }

  deleteGpsModel(model: Protocol): void {
    if (!this.canDeleteGpsModels()) return;
    this.confirmationService.confirm({
      header: 'Eliminar modelo GPS',
      message: `¿Seguro que deseas eliminar ${model.name}? Solo podrá eliminarse si no está asignado a ningún equipo.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cerrar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.protocolsService.deleteProtocol(model._id).subscribe({
          next: () => {
            if (this.selectedGpsModel?._id === model._id) {
              this.cancelGpsModelForm();
            }
            this.messageService.add({
              severity: 'success',
              summary: 'Modelo eliminado',
              detail: `${model.name} fue eliminado correctamente.`,
            });
            this.refreshGpsModels();
          },
          error: (error) => {
            this.messageService.add({
              severity: 'error',
              summary: 'No se puede eliminar',
              detail: getApiErrorMessage(error, 'El modelo está siendo utilizado por equipos del sistema.'),
            });
          },
        });
      },
    });
  }

  get filteredGpsModels(): Protocol[] {
    const query = this.gpsModelSearchQuery.trim().toLowerCase();
    if (!query) return this.loadedProtocols;
    return this.loadedProtocols.filter((model) =>
      [model.name, this.getGpsModelTemplateName(model)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }

  get gpsModelTemplateOptions(): Protocol[] {
    return this.loadedProtocols.filter(
      (model) => model._id !== this.selectedGpsModel?._id,
    );
  }

  get selectedGpsModelTemplate(): Protocol | null {
    return (
      this.loadedProtocols.find(
        (model) => model._id === this.gpsModelForm.templateProtocolId,
      ) || null
    );
  }

  get gpsModelImagePreview(): string {
    return (
      this.gpsModelImageObjectUrl ||
      this.selectedGpsModelTemplate?.img ||
      this.selectedGpsModel?.img ||
      ''
    );
  }

  onGpsModelImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!this.gpsModelImageMimeTypes.has(file.type)) {
      input.value = '';
      this.messageService.add({
        severity: 'warn',
        summary: 'Formato no permitido',
        detail: 'Selecciona una imagen JPG, PNG o WEBP.',
      });
      return;
    }
    if (file.size > this.gpsModelImageMaxSize) {
      input.value = '';
      this.messageService.add({
        severity: 'warn',
        summary: 'Imagen demasiado grande',
        detail: 'La imagen del modelo GPS no puede superar los 5 MB.',
      });
      return;
    }

    this.resetGpsModelImageSelection();
    this.gpsModelImageFile = file;
    this.gpsModelImageObjectUrl = URL.createObjectURL(file);
  }

  clearGpsModelSelectedImage(): void {
    this.resetGpsModelImageSelection();
  }

  hideBrokenGpsModelImage(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  getGpsModelTemplateName(model: Protocol): string {
    const templateId = this.resolveTemplateProtocolId(model.templateProtocolId);
    if (!templateId) return 'Configuración original';
    return this.loadedProtocols.find((item) => item._id === templateId)?.name || 'Plantilla no disponible';
  }

  getGpsModelKind(model: Protocol): string {
    if (!model.isAirtag) return 'GPS normal';
    const normalizedName = model.name.toUpperCase();
    if (normalizedName.includes('MTAG-P')) return 'MTAG-P';
    if (normalizedName.includes('MTAG-A')) return 'MTAG-A';
    return 'Localizador inteligente';
  }

  private applyProtocols(list: Protocol[]): void {
    this.loadedProtocols = list || [];
    this.protocols = this.loadedProtocols.map((protocol) => ({
      label: protocol.name || protocol._id,
      value: protocol._id,
    }));
  }

  private resolveTemplateProtocolId(
    template: Protocol['templateProtocolId'],
  ): string {
    return typeof template === 'object' ? template?._id || '' : template || '';
  }

  private resetGpsModelImageSelection(): void {
    if (this.gpsModelImageObjectUrl) {
      URL.revokeObjectURL(this.gpsModelImageObjectUrl);
    }
    this.gpsModelImageObjectUrl = '';
    this.gpsModelImageFile = null;
  }

  loadPackages(): void {
    this.loading = true;
    this.inventoryService.findAllPackages().subscribe({
      next: (packages) => {
        this.packages = packages || [];
        this.loading = false;
      },
      error: (error) => {
        this.packages = [];
        this.loading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: getApiErrorMessage(error, 'Error al cargar paquetes'),
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
      error: (error) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: getApiErrorMessage(error, 'No se pudo guardar el paquete'),
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
            error: (error) => {
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: getApiErrorMessage(error, 'No se pudo eliminar el paquete'),
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
    this.isEditPackageMode = false;
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
      error: (error) => {
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
          detail: getApiErrorMessage(error, 'Error al buscar dispositivos'),
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
        detail: 'El dispositivo seleccionado no tiene package ni package._id asignado.',
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

  get selectedGlobalWarehouseName(): string | null {
    if (!this.globalSearchStorageId) return null;
    return this.warehouses.find((warehouse) => warehouse._id === this.globalSearchStorageId)?.name || null;
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

  // Warehouse Methods
  get filteredWarehouses(): Warehouse[] {
    const query = this.normalizeWarehouseSearch(this.warehouseSearchQuery);
    if (!query) return this.warehouses || [];

    return (this.warehouses || []).filter((warehouse) => {
      const accessUsersText = this.getWarehouseAccessUsers(warehouse).join(' ');

      const searchable = this.normalizeWarehouseSearch([
        warehouse.name,
        warehouse.description,
        warehouse.stock,
        warehouse.simcard_stock,
        warehouse.min_quantity,
        accessUsersText,
      ].join(' '));

      return searchable.includes(query);
    });
  }

  get attentionWarehouses(): Warehouse[] {
    return this.filteredWarehouses.filter(w => (w.stock || 0) < (w.min_quantity || 0));
  }

  get regularWarehouses(): Warehouse[] {
    return this.filteredWarehouses.filter(w => (w.stock || 0) >= (w.min_quantity || 0));
  }

  get orderedWarehouses(): Warehouse[] {
    return [...this.attentionWarehouses, ...this.regularWarehouses];
  }

  private normalizeWarehouseSearch(value: any): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
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
        error: (error) => {
          this.loadingWarehouses = false;
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: getApiErrorMessage(error, 'Error al cargar almacenes')
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
    this.selectedWarehouseAccessUsers = this.getWarehouseAccessUsers(warehouse).slice(0, 1).map(email => ({
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

    this.selectedWarehouse.access_users = this.getSelectedWarehouseAccessEmails().slice(0, 1);
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
      error: (error) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: getApiErrorMessage(error, 'No se pudo guardar el almacén')
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
          error: (error) => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: getApiErrorMessage(error, 'No se pudo eliminar el almacén')
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
        [warehouse?.assigned_user, ...users]
          .map((value: string) => String(value || '').trim().toLowerCase())
          .filter(Boolean)
      )
    ).slice(0, 1);
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
      error: (error) => {
        this.isSearchingWarehouseUsers = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: getApiErrorMessage(error, 'No se pudo buscar usuarios')
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
        summary: 'Usuario ya vinculado',
        detail: 'Ese usuario ya está vinculado al almacén'
      });
      return;
    }

    this.selectedWarehouseAccessUsers = [user];
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
        this.selectedWarehouseAccessUsers.slice(0, 1)
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
      idsim: device.IDSIM || device.idsim || '',
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
      IDSIM: (this.selectedDevice.idsim || '').trim(),
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
                detail: 'Dispositivo eliminado',
              });
              if (this.showingSearchResults && this.globalSearchQuery) {
                this.searchAllInventory();
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
    if (this.isDeviceInspectionRequired(device)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Dispositivo no disponible',
        detail: 'Este equipo está en revisión o averiado y no puede asignarse a una instalación.',
      });
      return;
    }

    if (this.isDeviceInstalled(device)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Aviso',
        detail: 'El dispositivo ya está instalado',
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
    if (this.showingSearchResults) {
      this.searchAllInventory();
    }
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
      error: (error) => {
        if (resetPage) {
          this.simcardsList = [];
        }
        this.isSearchingSimcards = false;
        this.simcardIsLoadingMore = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: getApiErrorMessage(error, 'Error al buscar simcards'),
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

  getSimcardCompanyLabel(company?: string): string {
    return this.availableSimCardTypes.find((type) => type.value === company)?.label || company || 'Otros';
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
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: getApiErrorMessage(err, 'No se pudo guardar la simcard'),
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
            error: (error) => {
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: getApiErrorMessage(error, 'No se pudo eliminar la Simcard'),
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
      error: (error) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: getApiErrorMessage(error, 'No se pudieron cargar los conduces.') });
        this.isLoadingConduces = false;
      }
    });
  }

  loadConducesLazy(event: any): void {
    const limit = event.rows || 10;
    const page = (event.first || 0) / limit + 1;
    this.loadConduces(page, limit);
  }

  openConducePrintDialog(conduce: Conduce): void {
    this.selectedConduceForPrint = conduce;
    this.conducePrintDialogVisible = true;
  }

  hideConducePrintDialog(): void {
    this.conducePrintDialogVisible = false;
    if (!this.shippingLabelDialogVisible) {
      this.selectedConduceForPrint = null;
    }
  }

  async printSelectedConduce(): Promise<void> {
    if (!this.selectedConduceForPrint) return;

    const conduce = this.selectedConduceForPrint;
    this.conducePrintDialogVisible = false;
    await this.generateConducePdf(conduce);
    this.selectedConduceForPrint = null;
  }

  openShippingLabelForm(): void {
    if (!this.selectedConduceForPrint) return;

    const destinationWarehouse = this.resolveConduceDestinationWarehouse(this.selectedConduceForPrint);
    const destinationName = String(destinationWarehouse?.name || '').trim();
    const currentUserName = this.auditUserLabel(this.authService.getCurrentUser());

    this.shippingLabelForm = {
      recipient: destinationName,
      recipientPhone: String(destinationWarehouse?.last_shipping_recipient_phone || '').trim(),
      destination: String(destinationWarehouse?.last_shipping_destination || '').trim(),
      sender: currentUserName === 'No registrado'
        ? 'Montao GPS'
        : `Montao GPS - ${currentUserName}`,
      senderPhone: this.officialCompanyPhone,
    };
    this.shippingLabelFormTouched = false;
    this.conducePrintDialogVisible = false;
    this.shippingLabelDialogVisible = true;
    this.loadOfficialCompanyPhone();
  }

  private getConduceDestinationWarehouseId(conduce: Conduce): string {
    const destinationWarehouse = conduce.destination_warehouse;
    return typeof destinationWarehouse === 'object'
      ? String(destinationWarehouse?._id || '').trim()
      : String(destinationWarehouse || '').trim();
  }

  private resolveConduceDestinationWarehouse(conduce: Conduce): Warehouse | null {
    const destinationWarehouse = conduce.destination_warehouse;
    if (destinationWarehouse && typeof destinationWarehouse === 'object') {
      return destinationWarehouse as Warehouse;
    }

    const warehouseId = this.getConduceDestinationWarehouseId(conduce);
    return this.warehouses.find(warehouse => String(warehouse._id || '') === warehouseId) || null;
  }

  private cacheWarehouseLastShippingDestination(
    warehouseId: string,
    updatedWarehouse: Warehouse,
  ): void {
    const lastShippingFields: Partial<Warehouse> = {
      last_shipping_recipient_phone: updatedWarehouse.last_shipping_recipient_phone,
      last_shipping_destination: updatedWarehouse.last_shipping_destination,
      last_shipping_at: updatedWarehouse.last_shipping_at,
    };

    const applyToConduce = (conduce: Conduce | null): void => {
      if (!conduce || this.getConduceDestinationWarehouseId(conduce) !== warehouseId) return;
      if (conduce.destination_warehouse && typeof conduce.destination_warehouse === 'object') {
        Object.assign(conduce.destination_warehouse, lastShippingFields);
      }
    };

    applyToConduce(this.selectedConduceForPrint);
    this.conducesList.forEach(conduce => applyToConduce(conduce));

    this.warehouses = this.warehouses.map(warehouse =>
      String(warehouse._id || '') === warehouseId
        ? { ...warehouse, ...lastShippingFields }
        : warehouse,
    );

    const cachedWarehouses = this.inventoryService.warehouses$.getValue();
    this.inventoryService.warehouses$.next(cachedWarehouses.map(warehouse =>
      String(warehouse._id || '') === warehouseId
        ? { ...warehouse, ...lastShippingFields }
        : warehouse,
    ));
  }

  hideShippingLabelDialog(): void {
    this.shippingLabelDialogVisible = false;
    this.shippingLabelFormTouched = false;
    this.shippingLabelForm = this.createEmptyShippingLabelForm();
    if (!this.conducePrintDialogVisible) {
      this.selectedConduceForPrint = null;
    }
  }

  returnToConducePrintDialog(): void {
    this.shippingLabelDialogVisible = false;
    this.shippingLabelFormTouched = false;
    this.conducePrintDialogVisible = true;
  }

  isShippingLabelFormValid(): boolean {
    return Object.values(this.shippingLabelForm).every(value => String(value || '').trim().length > 0);
  }

  private createEmptyShippingLabelForm(): ShippingLabelForm {
    return {
      recipient: '',
      recipientPhone: '',
      destination: '',
      sender: 'Montao GPS',
      senderPhone: this.officialCompanyPhone,
    };
  }

  private loadOfficialCompanyPhone(): void {
    this.systemService.getPublic().subscribe({
      next: (systems) => {
        const phone = String(systems?.[0]?.phone || '').trim();
        if (!phone) return;

        const previousDefault = this.officialCompanyPhone;
        this.officialCompanyPhone = phone;

        const currentSenderPhone = this.shippingLabelForm.senderPhone.trim();
        if (!currentSenderPhone || currentSenderPhone === previousDefault) {
          this.shippingLabelForm.senderPhone = phone;
        }
      },
      error: () => {
        // Mantener el número de respaldo si la configuración no está disponible.
      },
    });
  }

  private async loadPdfImage(source: string): Promise<HTMLImageElement | null> {
    const image = new Image();
    image.src = source;

    await new Promise<void>((resolve) => {
      image.onload = () => resolve();
      image.onerror = () => resolve();
    });

    return image.complete && image.naturalWidth > 0 ? image : null;
  }

  private loadPdfLogo(): Promise<HTMLImageElement | null> {
    return this.loadPdfImage('logo/LOGO.png');
  }

  private async loadPdfSvgAsPng(
    source: string,
    monochrome = false,
  ): Promise<HTMLImageElement | null> {
    const svgImage = await this.loadPdfImage(source);
    if (!svgImage) return null;

    const canvas = document.createElement('canvas');
    canvas.width = 144;
    canvas.height = 144;
    const context = canvas.getContext('2d');
    if (!context) return null;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(svgImage, 0, 0, canvas.width, canvas.height);

    if (monochrome) {
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      for (let index = 0; index < imageData.data.length; index += 4) {
        const gray = Math.round(
          imageData.data[index] * 0.299
          + imageData.data[index + 1] * 0.587
          + imageData.data[index + 2] * 0.114,
        );
        imageData.data[index] = gray;
        imageData.data[index + 1] = gray;
        imageData.data[index + 2] = gray;
      }
      context.putImageData(imageData, 0, 0);
    }

    return this.loadPdfImage(canvas.toDataURL('image/png'));
  }

  private getCompanyWhatsAppUrl(phone: string): string {
    const nationalNumber = phone.replace(/\D/g, '').slice(-10);
    return `https://wa.me/1${nationalNumber}`;
  }

  private async createPdfQrImage(url: string): Promise<HTMLImageElement | null> {
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 220,
        color: {
          dark: '#111827',
          light: '#FFFFFFFF',
        },
      });
      return this.loadPdfImage(dataUrl);
    } catch {
      return null;
    }
  }

  private drawFittedPdfText(
    doc: jsPDF,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    initialSize: number,
    minSize = 7,
  ): void {
    let fontSize = initialSize;
    doc.setFontSize(fontSize);

    while (fontSize > minSize && doc.getTextWidth(text) > maxWidth) {
      fontSize -= 0.5;
      doc.setFontSize(fontSize);
    }

    doc.text(text, x, y);
  }

  private drawShippingLabelFlyer(
    doc: jsPDF,
    socialQrs: ShippingLabelSocialQrs,
    socialIcons: ShippingLabelSocialIcons,
    officialPhone: string,
  ): void {
    const flyerX = 20;
    const flyerY = 132;
    const flyerWidth = 170;
    const flyerHeight = 140;
    const dark = [30, 41, 59] as [number, number, number];
    const muted = [100, 116, 139] as [number, number, number];
    const border = [203, 213, 225] as [number, number, number];

    // Low-ink layout: the flyer is intentionally white and uses only thin
    // brand accents so it remains economical on office printers.
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...border);
    doc.setLineWidth(0.35);
    doc.roundedRect(flyerX, flyerY, flyerWidth, flyerHeight, 4, 4, 'FD');

    doc.setTextColor(...dark);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('MONTAO GPS', 29, 147.5);
    doc.setTextColor(...muted);
    doc.setFontSize(7.2);
    doc.text('SEGURIDAD Y CONTROL EN CADA TRAYECTO', 29, 154.5);

    doc.setDrawColor(...border);
    doc.setLineWidth(0.25);
    doc.line(29, 181, 181, 181);

    doc.setTextColor(...dark);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('CONECTA CON NOSOTROS', 29, 190);

    const socialItems: Array<{
      network: ShippingLabelSocialNetwork;
      label: string;
      value: string;
      url: string;
    }> = [
      {
        network: 'instagram',
        label: 'Instagram',
        value: '@montao.cloud',
        url: 'https://www.instagram.com/montao.cloud/',
      },
      {
        network: 'facebook',
        label: 'Facebook',
        value: 'Montao.cloud',
        url: 'https://web.facebook.com/Montao.cloud/',
      },
      {
        network: 'whatsapp',
        label: 'WhatsApp',
        value: officialPhone,
        url: this.getCompanyWhatsAppUrl(officialPhone),
      },
      {
        network: 'website',
        label: 'Sitio web',
        value: 'gps.montao.net',
        url: 'https://gps.montao.net',
      },
    ];
    const cardWidth = 73.5;
    const cardHeight = 23;
    const cardGap = 5;

    socialItems.forEach((item, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const cardX = 29 + column * (cardWidth + cardGap);
      const cardY = 193 + row * 26;
      const qrSize = 18;
      const qrX = cardX + cardWidth - qrSize - 2.5;
      const qrY = cardY + 2.5;

      doc.setDrawColor(...border);
      doc.setLineWidth(0.3);
      doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 2.5, 2.5, 'S');
      const iconImage = socialIcons[item.network];
      if (iconImage) {
        doc.addImage(iconImage, 'PNG', cardX + 3.3, cardY + 3.7, 7.5, 7.5);
      }

      doc.setTextColor(...muted);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.4);
      doc.text(item.label.toUpperCase(), cardX + 13, cardY + 5.7);
      doc.setTextColor(...dark);
      doc.setFontSize(7.2);
      doc.text(item.value, cardX + 13, cardY + 11);
      doc.setTextColor(...muted);
      doc.setFontSize(4.8);
      doc.text('ESCANEA PARA ABRIR', cardX + 13, cardY + 16.8);

      const qrImage = socialQrs[item.network];
      if (qrImage) {
        doc.addImage(qrImage, 'PNG', qrX, qrY, qrSize, qrSize);
      } else {
        doc.setTextColor(...muted);
        doc.setFontSize(7);
        doc.text('QR', qrX + qrSize / 2, qrY + qrSize / 2, { align: 'center' });
      }
      doc.link(cardX, cardY, cardWidth, cardHeight, { url: item.url });
    });

    doc.setDrawColor(...dark);
    doc.setLineWidth(0.45);
    doc.line(29, 247.5, 181, 247.5);
    doc.setTextColor(...dark);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.text('SEGURIDAD PARA TU VEHICULO, TRANQUILIDAD PARA TI.', 105, 253.5, { align: 'center' });
  }

  async generateShippingLabelPdf(): Promise<void> {
    this.shippingLabelFormTouched = true;
    if (!this.selectedConduceForPrint || !this.isShippingLabelFormValid()) return;

    this.isGeneratingShippingLabelPdf = true;

    try {
      const conduce = this.selectedConduceForPrint;
      const form = {
        recipient: this.shippingLabelForm.recipient.trim(),
        recipientPhone: this.shippingLabelForm.recipientPhone.trim(),
        destination: this.shippingLabelForm.destination.trim(),
        sender: this.shippingLabelForm.sender.trim(),
        senderPhone: this.shippingLabelForm.senderPhone.trim(),
      };
      const destinationWarehouseId = this.getConduceDestinationWarehouseId(conduce);
      if (!destinationWarehouseId) {
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo guardar el último envío',
          detail: 'No se pudo identificar el almacén destino de este conduce.',
        });
        return;
      }

      try {
        const updatedWarehouse = await firstValueFrom(
          this.inventoryService.updateWarehouseLastShippingDestination(
            destinationWarehouseId,
            {
              recipient_phone: form.recipientPhone,
              destination: form.destination,
            },
          ),
        );
        this.cacheWarehouseLastShippingDestination(destinationWarehouseId, updatedWarehouse);
      } catch (error) {
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo guardar el último envío',
          detail: getApiErrorMessage(
            error,
            'No se pudieron guardar el teléfono y el destino del almacén.',
          ),
        });
        return;
      }

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const labelWidth = 152.4;
      const labelHeight = 101.6;
      const labelX = (pageWidth - labelWidth) / 2;
      const labelY = 15;
      const x = (value: number) => labelX + value;
      const y = (value: number) => labelY + value;
      const red = [189, 53, 53] as [number, number, number];
      const redDark = [139, 35, 40] as [number, number, number];
      const blue = [29, 91, 174] as [number, number, number];
      const ink = [30, 41, 59] as [number, number, number];
      const muted = [100, 116, 139] as [number, number, number];
      const whatsappUrl = this.getCompanyWhatsAppUrl(form.senderPhone);
      const [logo, instagramQr, facebookQr, whatsappQr, websiteQr] = await Promise.all([
        this.loadPdfLogo(),
        this.createPdfQrImage('https://www.instagram.com/montao.cloud/'),
        this.createPdfQrImage('https://web.facebook.com/Montao.cloud/'),
        this.createPdfQrImage(whatsappUrl),
        this.createPdfQrImage('https://gps.montao.net'),
      ]);
      const socialQrs: ShippingLabelSocialQrs = {
        instagram: instagramQr,
        facebook: facebookQr,
        whatsapp: whatsappQr,
        website: websiteQr,
      };
      const [instagramIcon, facebookIcon, whatsappIcon, websiteIcon] = await Promise.all([
        this.loadPdfSvgAsPng('logo/social/instagram.svg', true),
        this.loadPdfSvgAsPng('logo/social/facebook.svg', true),
        this.loadPdfSvgAsPng('logo/social/whatsapp.svg', true),
        this.loadPdfSvgAsPng('logo/social/website.svg', true),
      ]);
      const socialIcons: ShippingLabelSocialIcons = {
        instagram: instagramIcon,
        facebook: facebookIcon,
        whatsapp: whatsappIcon,
        website: websiteIcon,
      };

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(labelX, labelY, labelWidth, labelHeight, 'FD');

      doc.setFillColor(...red);
      doc.rect(labelX, labelY, labelWidth, 27, 'F');
      doc.setFillColor(...redDark);
      doc.rect(x(labelWidth - 4), labelY, 4, 27, 'F');

      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x(8), y(5), 36, 17, 2.5, 2.5, 'F');
      if (logo) {
        const logoWidth = 30;
        const logoHeight = logoWidth * (logo.naturalHeight / logo.naturalWidth);
        doc.addImage(logo, 'PNG', x(11), y(7.3), logoWidth, Math.min(12.5, logoHeight));
      } else {
        doc.setTextColor(...red);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('MONTAO GPS', x(12), y(15.5));
      }

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('FICHA DE ENVIO', x(51), y(12.5));
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`Conduce ${conduce.conduceNumber || 'sin numero'}`, x(51), y(18));
      doc.text('Control de entrega y recepcion', x(51), y(22));

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x(8), y(32), labelWidth - 16, 34, 3, 3, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...red);
      doc.setFontSize(7);
      doc.text('ENVIADO A', x(15), y(39));
      doc.setTextColor(...ink);
      doc.setFont('helvetica', 'bold');
      this.drawFittedPdfText(doc, form.recipient, x(15), y(48), labelWidth - 30, 15, 9);

      doc.setDrawColor(226, 232, 240);
      doc.line(x(15), y(52), x(labelWidth - 15), y(52));

      doc.setTextColor(...blue);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text('TELEFONO', x(15), y(58));
      doc.text('DESTINO', x(80), y(58));
      doc.setTextColor(...blue);
      doc.setFontSize(9);
      this.drawFittedPdfText(doc, form.recipientPhone, x(34), y(58), 40, 9, 7);
      this.drawFittedPdfText(doc, form.destination, x(96), y(58), labelWidth - 111, 9, 7);

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x(8), y(71), labelWidth - 16, 19, 3, 3, 'FD');
      doc.setFillColor(254, 242, 242);
      doc.roundedRect(x(8), y(71), 72, 19, 3, 3, 'F');
      doc.setTextColor(...red);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text('REMITENTE', x(13), y(77.5));
      doc.setTextColor(...ink);
      this.drawFittedPdfText(doc, form.sender, x(13), y(84.5), 62, 9, 6.5);

      doc.setTextColor(...muted);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.text('TELEFONO DE CONTACTO', x(87), y(77.5));
      doc.setTextColor(...ink);
      this.drawFittedPdfText(doc, form.senderPhone, x(87), y(85), labelWidth - 95, 10, 7);

      const generatedAt = new Date().toLocaleString('es-DO', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
      doc.setTextColor(...muted);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.8);
      doc.text(`Av. Franco Bido #135, Nibaje, Santiago R.D. | info@montao.net | ${this.officialCompanyPhone}`, x(8), y(labelHeight - 5));
      doc.text(generatedAt, x(labelWidth - 8), y(labelHeight - 5), { align: 'right' });

      this.drawShippingLabelFlyer(doc, socialQrs, socialIcons, form.senderPhone);

      const safeConduceNumber = String(conduce.conduceNumber || Date.now()).replace(/[^a-zA-Z0-9_-]+/g, '_');
      doc.save(`Ficha_envio_${safeConduceNumber}.pdf`);
      this.shippingLabelDialogVisible = false;
      this.selectedConduceForPrint = null;
      this.shippingLabelFormTouched = false;
      this.shippingLabelForm = this.createEmptyShippingLabelForm();
    } finally {
      this.isGeneratingShippingLabelPdf = false;
    }
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
        Array.from(this.getProtocolLabel(d.Protocol) || 'N/A').reverse().join(''),
        formatConduceSimcardCode(
          d.SIM || d.sim,
          d.sim_company,
        )
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
        head: [['#', 'GPS / Localizador', 'Modelo', 'Simcard', '#', 'GPS / Localizador', 'Modelo', 'Simcard']],
        body: combinedDeviceRows,
        theme: 'striped',
        headStyles: { fillColor: [189, 53, 53] },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { fontStyle: 'bold' },
          3: { fontSize: 7 },
          4: { fontStyle: 'bold' },
          7: { fontSize: 7 }
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
        const finalIccid = formatConduceSimcardCode(
          s.iccid,
          s.sim_company,
        );

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
    this.shippingRequestId = this.createConduceRequestId();
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
    this.shippingRequestId = '';
    this.isCreatingConduce = false;
  }

  onShippingDestinationChange(destinationId: string | null): void {
    this.shippingDestinationWarehouse = destinationId || null;
    if (!this.shippingDestinationWarehouse) return;

    const previousDeviceCount = this.shippingDevices.length;
    const previousSimcardCount = this.shippingSimcards.length;
    this.shippingDevices = this.shippingDevices.filter(
      item => !this.isAlreadyAtShippingDestination(item),
    );
    this.shippingSimcards = this.shippingSimcards.filter(
      item => !this.isAlreadyAtShippingDestination(item),
    );

    const removed = (previousDeviceCount - this.shippingDevices.length)
      + (previousSimcardCount - this.shippingSimcards.length);
    if (removed) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Artículos retirados',
        detail: `${removed} artículo(s) ya pertenecían al almacén destino y fueron retirados del conduce.`,
      });
    }
  }

  addShippingDevice(): void {
    const imei = this.shippingDeviceInput.trim();
    if (!imei || this.shippingDevices.some(d => (d.IMEI === imei || d.imei === imei))) return;

    this.inventoryService.searchAllDevices(imei).subscribe({
      next: (response) => {
        const device = response.data?.find(d => (d.IMEI === imei || d.imei === imei));
        if (!device) {
          this.messageService.add({
            severity: 'warn',
            summary: 'No encontrado',
            detail: `El dispositivo ${imei} no existe en inventario. Debe registrarlo desde Dispositivos antes de crear el conduce.`,
          });
          return;
        }

        if (this.isAlreadyAtShippingDestination(device)) {
          this.messageService.add({
            severity: 'warn',
            summary: 'Traslado no permitido',
            detail: `El dispositivo ${imei} ya pertenece al almacén destino.`,
          });
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
      error: (error) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: getApiErrorMessage(error, 'Error al buscar el dispositivo.') });
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
        error: (error) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: getApiErrorMessage(error, 'No se pudo registrar el dispositivo.') });
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
        error: (error) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: getApiErrorMessage(error, 'No se pudo asignar el paquete.') });
        }
      });
    }
  }

  removeShippingDevice(index: number): void {
    this.shippingDevices.splice(index, 1);
  }

  addShippingSimcard(): void {
    const iccid = this.shippingSimcardInput.trim();
    if (!iccid || this.shippingSimcards.some(s => s.iccid === iccid)) return;

    this.inventoryService.searchAllSimcards(iccid).subscribe({
      next: (response) => {
        const simcard = response.data?.find(s => s.iccid === iccid);

        if (!simcard) {
          this.messageService.add({
            severity: 'warn',
            summary: 'No encontrada',
            detail: `La simcard ${iccid} no existe en inventario. Debe registrarla desde Simcards antes de crear el conduce.`,
          });
          return;
        }

        if (this.isAlreadyAtShippingDestination(simcard)) {
          this.messageService.add({
            severity: 'warn',
            summary: 'Traslado no permitido',
            detail: `La simcard ${iccid} ya pertenece al almacén destino.`,
          });
          return;
        }

        // Simcard exists, no package needed
        if (!this.shippingSimcards.find(s => s.iccid === iccid)) {
          this.shippingSimcards.push(simcard);
          this.shippingSimcardInput = '';
          this.messageService.add({ severity: 'success', summary: 'Agregado', detail: `Simcard ${iccid} preparada para envío.` });
        }
      },
      error: (error) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: getApiErrorMessage(error, 'Error al buscar el simcard.') });
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
        error: (error) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: getApiErrorMessage(error, 'No se pudo registrar la simcard.') });
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
        error: (error) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: getApiErrorMessage(error, 'No se pudo asignar el paquete a la simcard.') });
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

    const invalidDevices = this.shippingDevices.filter(item => this.isAlreadyAtShippingDestination(item));
    const invalidSimcards = this.shippingSimcards.filter(item => this.isAlreadyAtShippingDestination(item));
    if (invalidDevices.length || invalidSimcards.length) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Traslado no permitido',
        detail: 'El conduce contiene artículos que ya pertenecen al almacén destino. Retírelos antes de continuar.',
      });
      return;
    }

    const payload: any = {
      destination_warehouse: this.shippingDestinationWarehouse,
      request_id: this.shippingRequestId || this.createConduceRequestId(),
      description: this.shippingDescription,
      devices: this.shippingDevices.map((d: any) => d._id).filter((id: any) => id),
      simcards: this.shippingSimcards.map((s: any) => s._id).filter((id: any) => id)
    };

    if (payload.devices.length === 0 && payload.simcards.length === 0) {
      this.messageService.add({
        severity: 'error',
        summary: 'Artículos inválidos',
        detail: 'Todos los dispositivos y simcards seleccionados carecen de _id; vuelva a buscarlos en inventario antes de crear el conduce.',
      });
      return;
    }

    this.isCreatingConduce = true;
    this.inventoryService.createConduce(payload).subscribe({
      next: () => {
        this.isCreatingConduce = false;
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Conduce creado correctamente.' });
        this.hideShippingDialog();
        this.loadConduces(); // Refresh the list if it's open, or just in background
      },
      error: (error) => {
        this.isCreatingConduce = false;
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo crear el conduce',
          detail: getApiErrorMessage(error, 'No se pudo crear el conduce'),
        });
      }
    });
  }

  private isAlreadyAtShippingDestination(item: any): boolean {
    if (!this.shippingDestinationWarehouse) return false;
    const storage = item?.storage_id;
    const storageId = typeof storage === 'object' ? storage?._id : storage;
    return String(storageId || '') === String(this.shippingDestinationWarehouse);
  }

  private createConduceRequestId(): string {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
    return `conduce-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
