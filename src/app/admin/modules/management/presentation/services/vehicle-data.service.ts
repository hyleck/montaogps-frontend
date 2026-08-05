import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { VehicleBrandsService } from '@core/services/vehicle-brands.service';
import { ColorsService } from '@core/services/colors.service';
import { environment } from 'src/environments/environment';
import { lastValueFrom } from 'rxjs';

export interface VehicleType {
  _id: string;
  name?: string;
  nombre?: string;
  thumbnailUrl?: string;
  image?: string;
}

export interface VehicleBrand {
  _id: string;
  name?: string;
  nombre?: string;
}

export interface VehicleModel {
  _id: string;
  name?: string;
  nombre?: string;
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
  private baseDataPromise: Promise<void> | null = null;
  private readonly loadedModelBrandIds = new Set<string>();
  private readonly modelLoadPromises = new Map<string, Promise<void>>();
  private readonly modelLoadConcurrency = 4;

  // AI cache image map: key = "brand|model|year|color", value = { url, thumbnailUrl }
  private aiCacheImages: Map<string, { url: string; thumbnailUrl: string }> = new Map();
  private colorHexToName: Map<string, string> = new Map();
  private montaoBackendUrl: string;

  constructor(
    private vehicleBrandsService: VehicleBrandsService,
    private colorsService: ColorsService,
    private http: HttpClient,
  ) {
    // montaoApiUrl is like 'https://back-montao.dorhu.com', we need /api
    this.montaoBackendUrl = (environment as any).montaoApiUrl
      ? `${(environment as any).montaoApiUrl}/api`
      : 'https://back-montao.dorhu.com/api';
  }

  /**
   * Carga el catálogo base y solamente los modelos de las marcas requeridas.
   * Evita descargar el catálogo completo al entrar a Management.
   */
  async loadVehicleData(brandIds: string[] = []): Promise<void> {
    await this.loadBaseVehicleData();
    await this.loadModelsForBrands(brandIds);
  }

  private async loadBaseVehicleData(): Promise<void> {
    if (this.isDataLoaded) return;

    if (!this.baseDataPromise) {
      this.baseDataPromise = (async () => {
        const colorsPromise = this.colorsService.getAllColors().catch((error) => {
          console.error('Error loading colors:', error);
          return [];
        });

        const [types, brands, colors] = await Promise.all([
          this.vehicleBrandsService.getAllTypes(),
          this.vehicleBrandsService.getAllBrands(),
          colorsPromise,
        ]);

        this.vehicleTypes = Array.isArray(types) ? types : [];
        this.vehicleBrands = Array.isArray(brands) ? brands : [];
        this.colorHexToName.clear();

        if (Array.isArray(colors)) {
          colors.forEach((color: any) => {
            if (color?.hex && color?.nombre) {
              this.colorHexToName.set(color.hex.toUpperCase(), color.nombre);
            }
          });
        }

        this.isDataLoaded = true;
      })()
        .catch((error) => {
          this.isDataLoaded = false;
          console.error('❌ Error al cargar datos base de vehículos:', error);
          throw error;
        })
        .finally(() => {
          this.baseDataPromise = null;
        });
    }

    await this.baseDataPromise;
  }

  private async loadModelsForBrands(brandIds: string[]): Promise<void> {
    const pendingBrandIds = Array.from(new Set(
      (brandIds || []).filter((brandId): brandId is string => !!brandId)
    )).filter(brandId => !this.loadedModelBrandIds.has(brandId));

    if (pendingBrandIds.length === 0) return;

    let nextIndex = 0;
    const worker = async (): Promise<void> => {
      while (nextIndex < pendingBrandIds.length) {
        const brandId = pendingBrandIds[nextIndex++];
        await this.loadModelsForBrand(brandId);
      }
    };

    const workerCount = Math.min(this.modelLoadConcurrency, pendingBrandIds.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
  }

  private async loadModelsForBrand(brandId: string): Promise<void> {
    if (this.loadedModelBrandIds.has(brandId)) return;

    const activeRequest = this.modelLoadPromises.get(brandId);
    if (activeRequest) {
      await activeRequest;
      return;
    }

    const request = this.vehicleBrandsService.getAllModelsByBrand(brandId)
      .then((models: VehicleModel[]) => {
        const mergedModels = new Map(this.vehicleModels.map(model => [model._id, model]));
        (Array.isArray(models) ? models : [])
          .filter(model => model?._id)
          .forEach(model => mergedModels.set(model._id, model));

        this.vehicleModels = Array.from(mergedModels.values());
        this.loadedModelBrandIds.add(brandId);
      })
      .catch((error) => {
        console.error(`Error loading models for brand ${brandId}:`, error);
      })
      .finally(() => {
        this.modelLoadPromises.delete(brandId);
      });

    this.modelLoadPromises.set(brandId, request);
    await request;
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
    
    return vehicleType.nombre || vehicleType.name || 'Desconocido';
  }

  /**
   * Obtiene la imagen del tipo de vehículo por ID del modelo
   */
  getVehicleTypeImage(modelId: string): string | null {
    if (!modelId || this.vehicleModels.length === 0 || this.vehicleTypes.length === 0) {
      return null;
    }

    const model = this.vehicleModels.find(m => m._id === modelId);
    if (!model || !model.id_tipo_vehiculo) {
      return null;
    }

    const vehicleType = this.vehicleTypes.find(t => t._id === model.id_tipo_vehiculo);
    if (!vehicleType) {
      return null;
    }

    return vehicleType.thumbnailUrl || vehicleType.image || null;
  }

  /**
   * Obtiene el nombre del modelo por ID
   */
  getVehicleModelName(modelId: string): string {
    if (!modelId || this.vehicleModels.length === 0) {
      return 'Modelo no especificado';
    }
    
    const model = this.vehicleModels.find(m => m._id === modelId);
    return model?.nombre || model?.name || 'Modelo no encontrado';
  }

  /**
   * Obtiene el nombre de la marca por ID
   */
  getVehicleBrandName(brandId: string): string {
    if (!brandId || this.vehicleBrands.length === 0) {
      return 'Marca no especificada';
    }
    
    const brand = this.vehicleBrands.find(b => b._id === brandId);
    return brand?.nombre || brand?.name || 'Marca no encontrada';
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
      (type.nombre || type.name || '').toLowerCase().includes(term)
    );
  }

  /**
   * Busca marcas de vehículos por nombre
   */
  searchVehicleBrands(searchTerm: string): VehicleBrand[] {
    if (!searchTerm) return this.vehicleBrands;
    
    const term = searchTerm.toLowerCase();
    return this.vehicleBrands.filter(brand => 
      (brand.nombre || brand.name || '').toLowerCase().includes(term)
    );
  }

  /**
   * Busca modelos de vehículos por nombre
   */
  searchVehicleModels(searchTerm: string): VehicleModel[] {
    if (!searchTerm) return this.vehicleModels;
    
    const term = searchTerm.toLowerCase();
    return this.vehicleModels.filter(model => 
      (model.nombre || model.name || '').toLowerCase().includes(term)
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
    this.clearCache();
    await this.loadVehicleData();
  }

  /**
   * Carga imágenes AI del cache de montao-backend para los targets dados
   */
  async loadAICacheForTargets(targets: any[]): Promise<Map<string, { url: string; thumbnailUrl: string }>> {
    const results = new Map<string, { url: string; thumbnailUrl: string }>();
    if (!targets?.length) return results;

    const requiredBrandIds = targets
      .map(target => (target.originalTarget || target)?.target_brand_id)
      .filter((brandId): brandId is string => !!brandId);

    await this.loadVehicleData(requiredBrandIds);

    // Group targets by unique brand+model+year+color, skipping those that already have an image
    const comboToTargets = new Map<string, { brand: string; model: string; year: string; color: string; targetIds: string[] }>();

    for (const target of targets) {
      const t = target.originalTarget || target;
      // Skip if already has an image
      if (t.target_image || t.target_image_thumbnail) continue;
      if (!t.target_brand_id || !t.target_model_id || !t.target_year || !t.target_color) continue;

      const brandName = this.getVehicleBrandName(t.target_brand_id);
      const modelName = this.getVehicleModelName(t.target_model_id);
      if (!brandName || brandName === 'Marca no especificada' || brandName === 'Marca no encontrada') continue;

      const colorName = this.getColorName(t.target_color);
      if (!colorName) continue; // Skip if color is invalid
      const key = `${brandName}|${modelName}|${t.target_year}|${colorName}`;
      if (!comboToTargets.has(key)) {
        comboToTargets.set(key, { brand: brandName, model: modelName, year: t.target_year, color: colorName, targetIds: [] });
      }
      comboToTargets.get(key)!.targetIds.push(target._id);
    }

    if (comboToTargets.size === 0) return results;

    // Check cache via gps-backend
    const gpsApiUrl = (environment as any).apiUrl || 'http://localhost:3333';
    const promises = Array.from(comboToTargets.entries()).map(async ([_key, { brand, model, year, color, targetIds }]) => {
      try {
        const url = `${gpsApiUrl}/devices/check-ai-cache?brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}&year=${encodeURIComponent(year)}&color=${encodeURIComponent(color)}`;
        const response = await lastValueFrom(this.http.get<any>(url));
        if (response?.success && response?.thumbnailUrl) {
          for (const id of targetIds) {
            results.set(id, { url: response.url, thumbnailUrl: response.thumbnailUrl });
          }
        }
      } catch (err) {
        // Cache miss or error, silently ignore
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Obtiene la imagen AI del cache por los IDs del target
   */
  getAICacheImage(brandId: string, modelId: string, year: string, color: string): { url: string; thumbnailUrl: string } | null {
    if (!brandId || !modelId || !year || !color) return null;

    const brandName = this.getVehicleBrandName(brandId);
    const modelName = this.getVehicleModelName(modelId);
    const colorName = this.getColorName(color);
    const key = `${brandName}|${modelName}|${year}|${colorName}`;
    return this.aiCacheImages.get(key) || null;
  }

  /**
   * Agrega imagen AI al cache local después de generar
   */
  setAICacheImage(brandId: string, modelId: string, year: string, color: string, url: string, thumbnailUrl: string): void {
    const brandName = this.getVehicleBrandName(brandId);
    const modelName = this.getVehicleModelName(modelId);
    const colorName = this.getColorName(color);
    const key = `${brandName}|${modelName}|${year}|${colorName}`;
    this.aiCacheImages.set(key, { url, thumbnailUrl });
  }

  /**
   * Convierte hex de color a nombre (ej: '#FFFFFF' -> 'Blanco')
   * Retorna null si el color no es válido
   */
  getColorName(hexOrName: string): string | null {
    if (!hexOrName) return null;
    // If it's a hex code, look up the name
    if (hexOrName.startsWith('#')) {
      if (this.colorHexToName.size === 0) return null;
      return this.colorHexToName.get(hexOrName.toUpperCase()) || null;
    }
    // Text value: always validate against known color names
    if (this.colorHexToName.size === 0) return null; // Colors not loaded yet
    const knownNames = new Set(Array.from(this.colorHexToName.values()).map(n => n.toLowerCase()));
    if (knownNames.has(hexOrName.toLowerCase())) return hexOrName;
    return null;
  }

  /**
   * Limpia todos los datos en cache
   */
  clearCache(): void {
    this.vehicleTypes = [];
    this.vehicleBrands = [];
    this.vehicleModels = [];
    this.colorHexToName.clear();
    this.loadedModelBrandIds.clear();
    this.modelLoadPromises.clear();
    this.baseDataPromise = null;
    this.isDataLoaded = false;
  }
}
