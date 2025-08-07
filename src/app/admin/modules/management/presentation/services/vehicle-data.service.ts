import { Injectable } from '@angular/core';
import { VehicleBrandsService } from '@core/services/vehicle-brands.service';

export interface VehicleType {
  _id: string;
  name: string;
}

export interface VehicleBrand {
  _id: string;
  name: string;
}

export interface VehicleModel {
  _id: string;
  name: string;
  id_tipo_vehiculo: string;
}

export interface VehicleSpeedData {
  speedInKnots: number;
  speedInKmh: number;
  displayText: string;
}

@Injectable({
  providedIn: 'root'
})
export class VehicleDataService {
  private vehicleTypes: VehicleType[] = [];
  private vehicleBrands: VehicleBrand[] = [];
  private vehicleModels: VehicleModel[] = [];
  private isDataLoaded: boolean = false;

  constructor(private vehicleBrandsService: VehicleBrandsService) {}

  /**
   * Carga todos los datos de vehículos (tipos, marcas, modelos)
   */
  async loadVehicleData(): Promise<void> {
    try {
      
      // Cargar tipos de vehículos, marcas y modelos en paralelo
      const [types, brands] = await Promise.all([
        this.vehicleBrandsService.getAllTypes(),
        this.vehicleBrandsService.getAllBrands()
      ]);
      
      this.vehicleTypes = types || [];
      this.vehicleBrands = brands || [];
      
 
      
      // Cargar todos los modelos para todas las marcas
      if (this.vehicleBrands.length > 0) {
        const allModels = await this.vehicleBrandsService.getAllModelsByBrand('all');
        this.vehicleModels = allModels || [];
        
      }
      
      this.isDataLoaded = true;
      
    } catch (error) {
      console.error('❌ Error al cargar datos de vehículos:', error);
      this.isDataLoaded = false;
    }
  }

  /**
   * Obtiene el tipo de vehículo por ID del modelo
   */
  getVehicleTypeByModelId(modelId: string): string {
    if (!modelId || this.vehicleModels.length === 0) {
      return 'Desconocido';
    }
    
    // Buscar el modelo por ID
    const model = this.vehicleModels.find(m => m._id === modelId);
    if (!model || !model.id_tipo_vehiculo) {
      return 'Desconocido';
    }
    
    // Buscar el tipo por ID
    const vehicleType = this.vehicleTypes.find(t => t._id === model.id_tipo_vehiculo);
    if (!vehicleType) {
      return 'Desconocido';
    }
    
    return vehicleType.name || 'Desconocido';
  }

  /**
   * Obtiene el nombre del modelo por ID
   */
  getVehicleModelName(modelId: string): string {
    if (!modelId || this.vehicleModels.length === 0) {
      return 'Modelo no especificado';
    }
    
    const model = this.vehicleModels.find(m => m._id === modelId);
    return model?.name || 'Modelo no encontrado';
  }

  /**
   * Obtiene el nombre de la marca por ID
   */
  getVehicleBrandName(brandId: string): string {
    if (!brandId || this.vehicleBrands.length === 0) {
      return 'Marca no especificada';
    }
    
    const brand = this.vehicleBrands.find(b => b._id === brandId);
    return brand?.name || 'Marca no encontrada';
  }

  /**
   * Convierte velocidad de nudos a km/h
   */
  convertKnotsToKmh(speedInKnots: number): number {
    // 1 knot = 1.852 km/h
    return speedInKnots * 1.852;
  }

  /**
   * Formatea la velocidad para mostrar
   */
  formatSpeedDisplay(speedInKmh: number): string {
    if (!speedInKmh || speedInKmh < 0.1) {
      return '0 km/h';
    }
    return `${Math.round(speedInKmh)} km/h`;
  }

  /**
   * Obtiene la velocidad del dispositivo formateada
   */
  getDeviceSpeed(target: any): string {
    const speedInKnots = target?.traccarInfo?.speed || target?.originalTarget?.traccarInfo?.speed || 0;
    const speedInKmh = this.convertKnotsToKmh(speedInKnots);
    return this.formatSpeedDisplay(speedInKmh);
  }

  /**
   * Obtiene datos completos de velocidad del dispositivo
   */
  getDeviceSpeedData(target: any): VehicleSpeedData {
    const speedInKnots = target?.traccarInfo?.speed || target?.originalTarget?.traccarInfo?.speed || 0;
    const speedInKmh = this.convertKnotsToKmh(speedInKnots);
    const displayText = this.formatSpeedDisplay(speedInKmh);

    return {
      speedInKnots,
      speedInKmh,
      displayText
    };
  }

  /**
   * Busca tipos de vehículos por nombre
   */
  searchVehicleTypes(searchTerm: string): VehicleType[] {
    if (!searchTerm) return this.vehicleTypes;
    
    const term = searchTerm.toLowerCase();
    return this.vehicleTypes.filter(type => 
      type.name.toLowerCase().includes(term)
    );
  }

  /**
   * Busca marcas de vehículos por nombre
   */
  searchVehicleBrands(searchTerm: string): VehicleBrand[] {
    if (!searchTerm) return this.vehicleBrands;
    
    const term = searchTerm.toLowerCase();
    return this.vehicleBrands.filter(brand => 
      brand.name.toLowerCase().includes(term)
    );
  }

  /**
   * Busca modelos de vehículos por nombre
   */
  searchVehicleModels(searchTerm: string): VehicleModel[] {
    if (!searchTerm) return this.vehicleModels;
    
    const term = searchTerm.toLowerCase();
    return this.vehicleModels.filter(model => 
      model.name.toLowerCase().includes(term)
    );
  }

  // Getters para acceder a los datos
  get types(): VehicleType[] {
    return [...this.vehicleTypes];
  }

  get brands(): VehicleBrand[] {
    return [...this.vehicleBrands];
  }

  get models(): VehicleModel[] {
    return [...this.vehicleModels];
  }

  get isLoaded(): boolean {
    return this.isDataLoaded;
  }

  /**
   * Fuerza la recarga de los datos
   */
  async reloadData(): Promise<void> {
    this.isDataLoaded = false;
    await this.loadVehicleData();
  }

  /**
   * Limpia todos los datos en cache
   */
  clearCache(): void {
    this.vehicleTypes = [];
    this.vehicleBrands = [];
    this.vehicleModels = [];
    this.isDataLoaded = false;
  }
} 