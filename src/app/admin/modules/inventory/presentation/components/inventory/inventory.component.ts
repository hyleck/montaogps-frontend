import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { MenuItem, MessageService, ConfirmationService } from 'primeng/api';
import { InventoryItem, InventoryService, Package } from 'src/app/core/services/inventory.service';
import { ProtocolsService } from 'src/app/core/services/protocols.service';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from 'src/app/core/services/auth.service';

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.css'],
  providers: [MessageService, ConfirmationService],
  standalone: false,
})
export class InventoryComponent implements OnInit {
  @ViewChild('imeiInput') imeiInput!: ElementRef;
  
  items: MenuItem[] = [{ label: 'Inventario' }];
  home: MenuItem = { icon: 'pi pi-home', routerLink: '/admin/dashboard' };

  // Package management
  packages: Package[] = [];
  selectedPackage: Package | null = null;
  packageDialogVisible: boolean = false;
  isEditPackageMode: boolean = false;

  // Device management for selected package
  packageDevices: InventoryItem[] = [];
  selectedDevice: InventoryItem | null = null;
  deviceDialogVisible: boolean = false;
  isEditDeviceMode: boolean = false;

  // Current package being viewed/edited
  currentPackageId: string | null = null;

  loading: boolean = true;
  protocols: { label: string; value: string }[] = [];

  // Search properties
  globalSearchQuery: string = '';
  packageSearchQuery: string = '';
  isSearchingGlobal: boolean = false;
  isSearchingPackage: boolean = false;
  allDevicesSearchResults: InventoryItem[] = [];
  showingSearchResults: boolean = false;

  constructor(
    private inventoryService: InventoryService,
    private protocolsService: ProtocolsService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private translate: TranslateService,
    private authService: AuthService
  ) {}

  // Métodos de validación de privilegios para inventory
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

  ngOnInit(): void {
    // Solo cargar si tiene permisos de lectura
    if (this.canReadInventory()) {
      this.openNewPackage(); // Initialize selectedPackage
      this.loadProtocols();
      this.loadPackages();
    } else {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('inventory.no_permissions'),
        detail: this.translate.instant('inventory.contact_admin')
      });
      this.loading = false;
    }
  }

  loadProtocols(): void {
    this.protocolsService.getAllProtocols().subscribe({
      next: (list: any[]) => {
        this.protocols = list.map((p) => ({ 
          label: p.name || p.type || p._id, 
          value: p._id 
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
          detail: 'Error al cargar paquetes' 
        });
      },
    });
  }

  // Package management methods
  openNewPackage(): void {
    this.selectedPackage = {
      title: '',
      date: new Date().toISOString().split('T')[0],
      price: 0,
      description: ''
    };
    this.isEditPackageMode = false;
    this.packageDialogVisible = true;
  }

  editPackage(pkg: Package): void {
    // Validar permisos antes de permitir editar paquetes
    if (!this.canUpdateInventory()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('inventory.no_update_permission'),
        detail: this.translate.instant('inventory.contact_admin')
      });
      return;
    }

    this.selectedPackage = { ...pkg };
    this.isEditPackageMode = true;
    this.packageDialogVisible = true;
  }

  savePackage(): void {
    // Validar privilegios antes de proceder
    if (this.isEditPackageMode && !this.canUpdateInventory()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('inventory.no_update_permission'),
        detail: this.translate.instant('inventory.contact_admin')
      });
      return;
    }
    
    if (!this.isEditPackageMode && !this.canCreateInventory()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('inventory.no_create_permission'),
        detail: this.translate.instant('inventory.contact_admin')
      });
      return;
    }

    if (!this.selectedPackage || !this.selectedPackage.title) {
      this.messageService.add({ 
        severity: 'warn', 
        summary: 'Validación', 
        detail: 'El título del paquete es requerido' 
      });
      return;
    }

    const operation = this.isEditPackageMode && this.selectedPackage._id
      ? this.inventoryService.updatePackage(this.selectedPackage._id, this.selectedPackage)
      : this.inventoryService.createPackage(this.selectedPackage);

    operation.subscribe({
      next: () => {
        this.messageService.add({ 
          severity: 'success', 
          summary: 'Éxito', 
          detail: this.isEditPackageMode ? 'Paquete actualizado' : 'Paquete creado' 
        });
        this.hidePackageDialog();
        this.loadPackages();
      },
      error: () => {
        this.messageService.add({ 
          severity: 'error', 
          summary: 'Error', 
          detail: 'No se pudo guardar el paquete' 
        });
      }
    });
  }

  deletePackage(pkg: Package): void {
    // Validar permisos antes de permitir eliminar paquetes
    if (!this.canDeleteInventory()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('inventory.no_delete_permission'),
        detail: this.translate.instant('inventory.contact_admin')
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
                detail: 'Paquete eliminado correctamente' 
              });
              this.loadPackages();
            },
            error: () => {
              this.messageService.add({ 
                severity: 'error', 
                summary: 'Error', 
                detail: 'No se pudo eliminar el paquete' 
              });
            }
          });
        }
      }
    });
  }

  hidePackageDialog(): void {
    this.packageDialogVisible = false;
    this.selectedPackage = null;
  }

  // Device management methods
  viewPackageDevices(pkg: Package): void {
    this.currentPackageId = pkg._id || null;
    console.log('viewPackageDevices - Package selected:', pkg);
    console.log('viewPackageDevices - Package ID:', pkg._id);
    
    if (pkg._id) {
      this.inventoryService.getDevicesByPackage(pkg._id).subscribe({
        next: (devices) => {
          this.packageDevices = devices || [];
          console.log('viewPackageDevices - Devices loaded:', devices);
          console.log('viewPackageDevices - Number of devices:', devices?.length || 0);
          console.log('viewPackageDevices - packageDevices array:', this.packageDevices);
        },
        error: (err) => {
          console.error('viewPackageDevices - Error loading devices:', err);
          this.packageDevices = [];
          this.messageService.add({ 
            severity: 'error', 
            summary: 'Error', 
            detail: 'Error al cargar dispositivos del paquete' 
          });
        }
      });
    } else {
      console.warn('viewPackageDevices - No package ID provided');
    }
  }

  openNewDevice(): void {
    // Validar permisos antes de permitir crear dispositivos
    if (!this.canCreateInventory()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('inventory.no_create_permission'),
        detail: this.translate.instant('inventory.contact_admin')
      });
      return;
    }

    if (!this.currentPackageId) {
      this.messageService.add({ 
        severity: 'warn', 
        summary: 'Advertencia', 
        detail: 'Selecciona un paquete primero' 
      });
      return;
    }

    // Forzar la inicialización con valores explícitos
    this.selectedDevice = {
      imei: '',
      sim: '', 
      protocol: '',
      package: this.currentPackageId,
      packageId: this.currentPackageId
    } as InventoryItem;
    
    this.isEditDeviceMode = false;
    this.deviceDialogVisible = true;
    
    // Enfocar el campo IMEI después de que se abra el diálogo
    setTimeout(() => {
      if (this.imeiInput && this.imeiInput.nativeElement) {
        this.imeiInput.nativeElement.focus();
      }
    }, 100);
  }

  editDevice(device: InventoryItem): void {
    // Validar permisos antes de permitir editar dispositivos
    if (!this.canUpdateInventory()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('inventory.no_update_permission'),
        detail: this.translate.instant('inventory.contact_admin')
      });
      return;
    }
    // Normalizar los datos del dispositivo para el formulario
    this.selectedDevice = {
      _id: device._id,
      imei: device.IMEI || device.imei || '',
      sim: device.SIM || device.sim || '',
      protocol: typeof device.Protocol === 'object' ? device.Protocol._id : (device.Protocol || device.protocol || ''),
      package: device.package || this.currentPackageId,
      packageId: device.package || this.currentPackageId
    };
    
    console.log('editDevice - Original device:', device);
    console.log('editDevice - Normalized selectedDevice:', this.selectedDevice);
    
    this.isEditDeviceMode = true;
    this.deviceDialogVisible = true;
  }

  saveDevice(): void {
    // Validar privilegios antes de proceder
    if (this.isEditDeviceMode && !this.canUpdateInventory()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('inventory.no_update_permission'),
        detail: this.translate.instant('inventory.contact_admin')
      });
      return;
    }
    
    if (!this.isEditDeviceMode && !this.canCreateInventory()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('inventory.no_create_permission'),
        detail: this.translate.instant('inventory.contact_admin')
      });
      return;
    }

    // Validaciones específicas
    if (!this.selectedDevice) {
      this.messageService.add({ 
        severity: 'warn', 
        summary: 'Error', 
        detail: 'No hay dispositivo seleccionado' 
      });
      return;
    }

    if (!this.selectedDevice.imei || this.selectedDevice.imei.trim() === '') {
      this.messageService.add({ 
        severity: 'warn', 
        summary: 'Validación', 
        detail: 'El IMEI es requerido' 
      });
      return;
    }

    // SIM es opcional, no se valida

    if (!this.selectedDevice.protocol || this.selectedDevice.protocol === '') {
      this.messageService.add({ 
        severity: 'warn', 
        summary: 'Validación', 
        detail: 'El protocolo es requerido' 
      });
      return;
    }

    if (!this.currentPackageId) {
      this.messageService.add({ 
        severity: 'warn', 
        summary: 'Error', 
        detail: 'No se ha seleccionado un paquete' 
      });
      return;
    }

    // Preparar el payload con el formato correcto - MAYÚSCULAS como espera el backend
    const devicePayload: any = {};
    devicePayload.IMEI = (this.selectedDevice.imei || '').trim();
    devicePayload.SIM = (this.selectedDevice.sim || '').trim();
    devicePayload.Protocol = this.selectedDevice.protocol || '';
    devicePayload.package = this.currentPackageId; // Este se mantiene en minúscula

    // Validar que el payload tenga valores válidos antes de enviar (SIM es opcional)
    if (!devicePayload.IMEI || !devicePayload.Protocol || !devicePayload.package) {
      this.messageService.add({ 
        severity: 'error', 
        summary: 'Error de validación', 
        detail: 'Faltan campos requeridos en el payload (IMEI y Protocolo son obligatorios)' 
      });
      return;
    }

    const operation = this.isEditDeviceMode && this.selectedDevice._id
      ? this.inventoryService.update(this.selectedDevice._id, devicePayload)
      : this.inventoryService.create(devicePayload);

    operation.subscribe({
      next: () => {
        this.messageService.add({ 
          severity: 'success', 
          summary: 'Éxito', 
          detail: this.isEditDeviceMode ? 'Dispositivo actualizado' : 'Dispositivo agregado' 
        });
        
        if (this.isEditDeviceMode) {
          // Si estamos editando, cerrar el formulario
          this.hideDeviceDialog();
        } else {
          // Si estamos creando, reiniciar el formulario pero mantener el protocolo
          this.resetFormForNewDevice();
        }
        
        if (this.currentPackageId) {
          this.viewPackageDevices({ _id: this.currentPackageId } as Package);
        }
      },
      error: (err) => {
        console.error('Error saving device:', err);
        let errorMessage = 'No se pudo guardar el dispositivo';
        if (err.error && err.error.message) {
          if (Array.isArray(err.error.message)) {
            errorMessage = err.error.message.join(', ');
          } else {
            errorMessage = err.error.message;
          }
        }
        this.messageService.add({ 
          severity: 'error', 
          summary: 'Error', 
          detail: errorMessage 
        });
      }
    });
  }

  deleteDevice(device: InventoryItem): void {
    // Validar permisos antes de permitir eliminar dispositivos
    if (!this.canDeleteInventory()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('inventory.no_delete_permission'),
        detail: this.translate.instant('inventory.contact_admin')
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
                detail: 'Dispositivo eliminado correctamente' 
              });
              if (this.currentPackageId) {
                this.viewPackageDevices({ _id: this.currentPackageId } as Package);
              }
            },
            error: () => {
              this.messageService.add({ 
                severity: 'error', 
                summary: 'Error', 
                detail: 'No se pudo eliminar el dispositivo' 
              });
            }
          });
        }
      }
    });
  }

  hideDeviceDialog(): void {
    this.deviceDialogVisible = false;
    this.selectedDevice = null;
  }

  resetFormForNewDevice(): void {
    if (!this.selectedDevice || !this.currentPackageId) return;
    
    // Guardar el protocolo actual
    const currentProtocol = this.selectedDevice.protocol;
    
    // Reiniciar el dispositivo manteniendo solo el protocolo
    this.selectedDevice = {
      imei: '',
      sim: '', 
      protocol: currentProtocol, // Mantener el protocolo
      package: this.currentPackageId,
      packageId: this.currentPackageId
    } as InventoryItem;
    
    // Enfocar el campo IMEI después de un breve delay para asegurar que el DOM se ha actualizado
    setTimeout(() => {
      if (this.imeiInput && this.imeiInput.nativeElement) {
        this.imeiInput.nativeElement.focus();
      }
    }, 100);
  }

  getProtocolLabel(protocolData: any): string {
    // Si es un objeto con propiedades de protocolo, usar el name
    if (protocolData && typeof protocolData === 'object' && protocolData.name) {
      return protocolData.name;
    }
    // Si es un string (ID), buscar en la lista de protocolos
    if (typeof protocolData === 'string') {
      const protocol = this.protocols.find(p => p.value === protocolData);
      return protocol ? protocol.label : protocolData;
    }
    // Fallback
    return 'Sin protocolo';
  }

  goBackToPackages(): void {
    this.currentPackageId = null;
    this.packageDevices = [];
    this.packageSearchQuery = '';
    this.isSearchingPackage = false;
  }

  // Search methods
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
        console.log('Global search results:', results);
      },
      error: (err) => {
        console.error('Error searching all devices:', err);
        this.allDevicesSearchResults = [];
        this.showingSearchResults = false;
        this.isSearchingGlobal = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al buscar dispositivos'
        });
      }
    });
  }

  clearGlobalSearch(): void {
    this.globalSearchQuery = '';
    this.allDevicesSearchResults = [];
    this.showingSearchResults = false;
    this.isSearchingGlobal = false;
  }

  searchPackageDevices(): void {
    if (!this.currentPackageId) {
      return;
    }

    if (!this.packageSearchQuery.trim()) {
      this.clearPackageSearch();
      return;
    }

    this.isSearchingPackage = true;
    this.inventoryService.searchDevicesByPackage(this.currentPackageId, this.packageSearchQuery.trim()).subscribe({
      next: (results) => {
        this.packageDevices = results || [];
        this.isSearchingPackage = false;
        console.log('Package search results:', results);
      },
      error: (err) => {
        console.error('Error searching package devices:', err);
        this.isSearchingPackage = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al buscar dispositivos del paquete'
        });
      }
    });
  }

  clearPackageSearch(): void {
    this.packageSearchQuery = '';
    this.isSearchingPackage = false;
    if (this.currentPackageId) {
      this.viewPackageDevices({ _id: this.currentPackageId } as Package);
    }
  }


}