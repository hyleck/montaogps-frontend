import { Component, OnInit } from '@angular/core';
import { VehicleBrandsService } from 'src/app/core/services/vehicle-brands.service';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';

interface VehicleType {
  _id?: string;
  nombre: string;
}

interface Brand {
  _id?: string;
  nombre: string;
}

interface VehicleModel {
  _id?: string;
  nombre: string;
  id_marca: string;
  id_tipo_vehiculo: string;
}

@Component({
  selector: 'app-vehicle-models-settings',
  standalone: false,
  templateUrl: './vehicle-models-settings.component.html',
  styleUrl: './vehicle-models-settings.component.css'
})
export class VehicleModelsSettingsComponent implements OnInit {
  models: VehicleModel[] = [];
  brands: Brand[] = [];
  vehicleTypes: VehicleType[] = [];
  loading = false;
  isEditing = false;
  selectedModel: VehicleModel | null = null;
  modelForm: VehicleModel = {
    nombre: '',
    id_marca: '',
    id_tipo_vehiculo: ''
  };
  currentBrandFilter: string = 'all'; // Para mantener el filtro actual de marca

  constructor(
    private vehicleBrandsService: VehicleBrandsService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private translate: TranslateService
  ) { }

  ngOnInit(): void {
    this.loadVehicleTypes();
    this.loadBrands();
    this.loadModels();
  }

  async loadVehicleTypes() {
    try {
      this.loading = true;
      this.vehicleTypes = await this.vehicleBrandsService.getAllTypes();
    } catch (error) {
      console.error('Error al cargar los tipos de vehículos:', error);
      this.showErrorMessage('error_loading_types');
    } finally {
      this.loading = false;
    }
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

  async loadModels(brandId: string = 'all') {
    try {
      this.loading = true;
      // Guardar el filtro actual
      this.currentBrandFilter = brandId;
      
      const response = await this.vehicleBrandsService.getAllModelsByBrand(brandId);
      this.models = response;
      // Ordenar alfabéticamente por nombre
      this.models.sort((a, b) => a.nombre.localeCompare(b.nombre));
    } catch (error) {
      console.error('Error al cargar los modelos:', error);
      this.showErrorMessage('error_loading_models');
    } finally {
      this.loading = false;
    }
  }

  async onBrandChange(event: Event) {
    const selectedBrandId = (event.target as HTMLSelectElement).value;
    if (selectedBrandId) {
      await this.loadModels(selectedBrandId);
    } else {
      await this.loadModels('all');
    }
  }

  editModel(model: VehicleModel) {
    this.isEditing = true;
    this.selectedModel = model;
    this.modelForm = {
      ...model
    };
  }

  async saveModel() {
    try {
      this.loading = true;
      if (this.isEditing && this.selectedModel?._id) {
        // Actualizar modelo existente
        // Extraer solo las propiedades que se deben actualizar (sin incluir _id)
        const modelToUpdate = {
          nombre: this.modelForm.nombre,
          id_marca: this.modelForm.id_marca,
          id_tipo_vehiculo: this.modelForm.id_tipo_vehiculo
        };
        await this.vehicleBrandsService.updateModel(this.selectedModel._id, modelToUpdate);
        this.showSuccessMessage('model_updated', this.modelForm.nombre);
        
        // Recargar modelos manteniendo el filtro actual
        await this.loadModels(this.currentBrandFilter);
        
        // No resetear el formulario cuando se está editando
        // Solo actualizar el selectedModel con los nuevos valores
        this.selectedModel = {
          ...this.selectedModel,
          ...modelToUpdate
        };
      } else {
        // Crear nuevo modelo
        await this.vehicleBrandsService.createModel(this.modelForm);
        this.showSuccessMessage('model_created', this.modelForm.nombre);
        
        // Recargar modelos manteniendo el filtro actual
        await this.loadModels(this.currentBrandFilter);
        
        // Al registrar nuevo modelo, solo limpiar nombre y tipo de vehículo
        // manteniendo la marca seleccionada
        const currentBrandId = this.modelForm.id_marca;
        this.isEditing = false;
        this.selectedModel = null;
        this.modelForm = {
          nombre: '',
          id_marca: currentBrandId, // Mantener la marca seleccionada
          id_tipo_vehiculo: ''
        };
      }
    } catch (error) {
      console.error('Error al guardar el modelo:', error);
      this.showErrorMessage(this.isEditing ? 'error_update' : 'error_create');
    } finally {
      this.loading = false;
    }
  }

  deleteModel(model: VehicleModel) {
    if (!model._id) return;

    this.translate.get('settings.vehicle_models.messages.confirm_delete', { name: model.nombre })
      .subscribe(message => {
        this.translate.get('settings.vehicle_models.messages.confirm_delete_header')
          .subscribe(header => {
            this.confirmationService.confirm({
              message: message,
              header: header,
              icon: 'pi pi-exclamation-triangle',
              acceptLabel: this.translate.instant('settings.vehicle_models.messages.yes_delete'),
              rejectLabel: this.translate.instant('settings.vehicle_models.messages.no_cancel'),
              accept: async () => {
                try {
                  this.loading = true;
                  await this.vehicleBrandsService.deleteModel(model._id!);
                  this.showSuccessMessage('model_deleted', model.nombre);
                  
                  // Si estamos eliminando el modelo actualmente en edición, limpiar el formulario
                  if (this.selectedModel?._id === model._id) {
                    this.cancelEdit();
                  }
                  
                  // Recargar modelos manteniendo el filtro actual
                  await this.loadModels(this.currentBrandFilter);
                } catch (error) {
                  console.error('Error al eliminar el modelo:', error);
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
    this.selectedModel = null;
    this.modelForm = {
      nombre: '',
      id_marca: '',
      id_tipo_vehiculo: ''
    };
  }

  getBrandName(brandId: string): string {
    const brand = this.brands.find(b => b._id === brandId);
    return brand ? brand.nombre : 'N/A';
  }

  getVehicleTypeName(typeId: string): string {
    const type = this.vehicleTypes.find(t => t._id === typeId);
    return type ? type.nombre : 'N/A';
  }

  private showSuccessMessage(key: string, nombre: string) {
    const summary = this.translate.instant(`settings.vehicle_models.messages.${key}`);
    const detail = this.translate.instant(`settings.vehicle_models.messages.${key}_detail`).replace('{name}', nombre);
    
    this.messageService.add({
      severity: 'success',
      summary: summary,
      detail: detail
    });
  }

  private showErrorMessage(key: string) {
    const messageKey = `settings.vehicle_models.messages.${key}`;
    const summary = this.translate.instant('settings.vehicle_models.messages.error');
    const detail = this.translate.instant(messageKey);
    
    this.messageService.add({
      severity: 'error',
      summary: summary,
      detail: detail
    });
  }
}
