import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
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
import { UserService } from 'src/app/core/services/user.service';
import { StatusService } from 'src/app/shareds/services/status.service';

@Component({
  selector: 'app-inventory-package-devices',
  templateUrl: './inventory-package-devices.component.html',
  styleUrls: ['../inventory/inventory.component.css'],
  providers: [MessageService, ConfirmationService],
  standalone: false,
})
export class InventoryPackageDevicesComponent implements OnInit, OnDestroy {
  @ViewChild('imeiInput') imeiInput!: ElementRef;

  items: MenuItem[] = [{ label: 'Inventario' }];
  home: MenuItem = { icon: 'pi pi-home', routerLink: '/admin/dashboard' };

  packageDevices: InventoryItem[] = [];
  selectedDevice: InventoryItem | null = null;
  deviceDialogVisible = false;
  isEditDeviceMode = false;

  currentPackageId: string | null = null;
  loading = true;
  protocols: { label: string; value: string }[] = [];
  packageSearchQuery = '';
  isSearchingPackage = false;

  installDialogVisible = false;
  deviceToInstall: InventoryItem | null = null;
  installationEmail = '';
  defaultInstallationEmail = '';

  private routeSub?: Subscription;

  constructor(
    private inventoryService: InventoryService,
    private protocolsService: ProtocolsService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private translate: TranslateService,
    private authService: AuthService,
    private userService: UserService,
    private router: Router,
    private route: ActivatedRoute,
    private statusService: StatusService,
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

    this.loadProtocols();
    this.loadDefaultInstallationEmail();

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

  private loadPackageDevices(packageId: string): void {
    this.loading = true;
    this.currentPackageId = packageId;
    this.inventoryService.getDevicesByPackage(packageId).subscribe({
      next: (devices) => {
        this.packageDevices = devices || [];
        this.loading = false;
      },
      error: () => {
        this.packageDevices = [];
        this.loading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al cargar dispositivos del paquete',
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
      protocol: '',
      package: this.currentPackageId,
      packageId: this.currentPackageId,
    } as InventoryItem;

    this.isEditDeviceMode = false;
    this.deviceDialogVisible = true;

    setTimeout(() => {
      if (this.imeiInput?.nativeElement) {
        this.imeiInput.nativeElement.focus();
      }
    }, 100);
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
      protocol:
        typeof device.Protocol === 'object'
          ? device.Protocol._id
          : device.Protocol || device.protocol || '',
      package: device.package || this.currentPackageId,
      packageId: device.package || this.currentPackageId,
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
      Protocol: this.selectedDevice.protocol || '',
      package: this.currentPackageId,
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
        let errorMessage = 'No se pudo guardar el dispositivo';
        if (err.error?.message) {
          errorMessage = Array.isArray(err.error.message)
            ? err.error.message.join(', ')
            : err.error.message;
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
                detail: 'Dispositivo eliminado correctamente',
              });
              if (this.currentPackageId) {
                this.loadPackageDevices(this.currentPackageId);
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
    } as InventoryItem;

    setTimeout(() => {
      if (this.imeiInput?.nativeElement) {
        this.imeiInput.nativeElement.focus();
      }
    }, 100);
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
    this.inventoryService
      .searchDevicesByPackage(this.currentPackageId, this.packageSearchQuery.trim())
      .subscribe({
        next: (results) => {
          this.packageDevices = results || [];
          this.isSearchingPackage = false;
        },
        error: () => {
          this.isSearchingPackage = false;
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Error al buscar dispositivos del paquete',
          });
        },
      });
  }

  clearPackageSearch(): void {
    this.packageSearchQuery = '';
    this.isSearchingPackage = false;
    if (this.currentPackageId) {
      this.loadPackageDevices(this.currentPackageId);
    }
  }

  installDevice(device: InventoryItem): void {
    if (!this.canUpdateInventory()) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('inventory.no_update_permission'),
        detail: this.translate.instant('inventory.contact_admin'),
      });
      return;
    }

    this.deviceToInstall = device;
    this.installationEmail = this.defaultInstallationEmail || '';
    this.installDialogVisible = true;
  }

  confirmInstallation(): void {
    if (!this.installationEmail?.trim()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Email requerido',
        detail: 'Por favor ingrese una dirección de correo electrónico',
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.installationEmail)) {
      this.messageService.add({
        severity: 'error',
        summary: 'Email inválido',
        detail: 'Por favor ingrese una dirección de correo electrónico válida',
      });
      return;
    }

    if (!this.deviceToInstall) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo procesar la instalación. Intente nuevamente.',
      });
      return;
    }

    if (!this.deviceToInstall._id) {
      return;
    }

    const targetEmail = this.installationEmail.trim();
    this.userService.getByEmail(targetEmail).subscribe({
      next: (foundUser) => {
        const deviceInstallationData = {
          imei: this.deviceToInstall!.IMEI || this.deviceToInstall!.imei || '',
          sim: this.deviceToInstall!.SIM || this.deviceToInstall!.sim || '',
          protocol: this.deviceToInstall!.Protocol || this.deviceToInstall!.protocol || '',
          userId: foundUser._id,
          timestamp: new Date().toISOString(),
        };

        sessionStorage.setItem('deviceInstallationData', JSON.stringify(deviceInstallationData));

        this.messageService.add({
          severity: 'success',
          summary: 'Usuario encontrado',
          detail: `Navegando a management del usuario: ${foundUser.name} ${foundUser.last_name}`,
        });

        this.cancelInstallation();
        this.router.navigate(['/admin/management/t', foundUser._id]);
      },
      error: () => {
        this.messageService.add({
          severity: 'warn',
          summary: 'Usuario no encontrado',
          detail: `No se encontró un usuario con el email ${targetEmail}. Verifique el correo o cree el usuario primero.`,
        });
      },
    });
  }

  cancelInstallation(): void {
    this.installDialogVisible = false;
    this.deviceToInstall = null;
    this.installationEmail = '';
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

  private loadDefaultInstallationEmail(): void {
    const managementState = this.statusService.getState<any>('management');
    const route = managementState?.url_route;
    const userId = Array.isArray(route) && route.length >= 3 ? route[2] : null;
    if (!userId) {
      return;
    }

    this.userService.getById(userId).subscribe({
      next: (user) => {
        this.defaultInstallationEmail = user?.email || '';
      },
      error: () => {
        this.defaultInstallationEmail = '';
      },
    });
  }

  isDeviceInstalled(device: InventoryItem): boolean {
    return !!device?.installed;
  }
}
