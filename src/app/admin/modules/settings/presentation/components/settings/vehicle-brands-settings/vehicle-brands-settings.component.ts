import { Component, OnInit } from '@angular/core';
import { VehicleBrandsService } from 'src/app/core/services/vehicle-brands.service';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';

interface Brand {
  _id?: string;
  nombre: string;
}

interface VehicleType {
  _id?: string;
  nombre: string;
}

@Component({
  selector: 'app-vehicle-brands-settings',
  standalone: false,
  templateUrl: './vehicle-brands-settings.component.html',
  styleUrl: './vehicle-brands-settings.component.css'
})
export class VehicleBrandsSettingsComponent implements OnInit {
  brands: Brand[] = [];
  vehicleTypes: VehicleType[] = [];
  loading = false;
  isEditing = false;
  selectedBrand: Brand | null = null;
  brandForm: Brand = {
    nombre: ''
  };

  constructor(
    private vehicleBrandsService: VehicleBrandsService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private translate: TranslateService
  ) { }

  ngOnInit(): void {
    this.loadBrands();
  }

  async loadBrands() {
    try {
      this.loading = true;
      this.brands = await this.vehicleBrandsService.getAllBrands();
      // Ordenar alfabéticamente por nombre
      this.brands.sort((a, b) => a.nombre.localeCompare(b.nombre));
    } catch (error) {
      console.error('Error al cargar las marcas:', error);
      this.showErrorMessage('error_loading_brands');
    } finally {
      this.loading = false;
    }
  }

  editBrand(brand: Brand) {
    this.isEditing = true;
    this.selectedBrand = brand;
    this.brandForm = {
      ...brand
    };
  }

  async saveBrand() {
    try {
      this.loading = true;
      if (this.isEditing && this.selectedBrand?._id) {
        // Actualizar marca existente
        await this.vehicleBrandsService.updateBrand(this.selectedBrand._id, this.brandForm);
        this.showSuccessMessage('brand_updated', this.brandForm.nombre);
      } else {
        // Crear nueva marca
        await this.vehicleBrandsService.createBrand(this.brandForm);
        this.showSuccessMessage('brand_created', this.brandForm.nombre);
      }
      // Recargar marcas y resetear formulario
      await this.loadBrands();
      this.cancelEdit();
    } catch (error) {
      console.error('Error al guardar la marca:', error);
      this.showErrorMessage(this.isEditing ? 'error_update' : 'error_create');
    } finally {
      this.loading = false;
    }
  }

  deleteBrand(brand: Brand) {
    if (!brand._id) return;

    this.translate.get('settings.vehicle_brands.messages.confirm_delete', { name: brand.nombre })
      .subscribe(message => {
        this.translate.get('settings.vehicle_brands.messages.confirm_delete_header')
          .subscribe(header => {
            this.confirmationService.confirm({
              message: message,
              header: header,
              icon: 'pi pi-exclamation-triangle',
              acceptLabel: this.translate.instant('settings.vehicle_brands.messages.yes_delete'),
              rejectLabel: this.translate.instant('settings.vehicle_brands.messages.no_cancel'),
              accept: async () => {
                try {
                  this.loading = true;
                  await this.vehicleBrandsService.deleteBrand(brand._id!);
                  this.showSuccessMessage('brand_deleted', brand.nombre);
                  await this.loadBrands();
                } catch (error) {
                  console.error('Error al eliminar la marca:', error);
                  this.showErrorMessage('error_delete');
                } finally {
                  this.loading = false;
                }
              }
            });
          });
      });
  }

  cancelEdit() {
    this.isEditing = false;
    this.selectedBrand = null;
    this.brandForm = {
      nombre: ''
    };
  }

  private showSuccessMessage(key: string, nombre: string) {
    const summary = this.translate.instant(`settings.vehicle_brands.messages.${key}`);
    const detail = this.translate.instant(`settings.vehicle_brands.messages.${key}_detail`).replace('{name}', nombre);
    
    this.messageService.add({
      severity: 'success',
      summary: summary,
      detail: detail
    });
  }

  private showErrorMessage(key: string) {
    const messageKey = `settings.vehicle_brands.messages.${key}`;
    const summary = this.translate.instant('settings.vehicle_brands.messages.error');
    const detail = this.translate.instant(messageKey);
    
    this.messageService.add({
      severity: 'error',
      summary: summary,
      detail: detail
    });
  }
}
