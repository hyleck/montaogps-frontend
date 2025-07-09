import { Injectable } from '@angular/core';
import { StatusService } from '@shared/services/status.service';

export interface MapProviderConfig {
  selectedMap: string;
  providerType: 'google' | 'mapbox';
  providerTheme: 'light' | 'dark';
  mapsKey: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class MapProviderService {
  private config: MapProviderConfig = {
    selectedMap: 'mapbox-light',
    providerType: 'mapbox',
    providerTheme: 'light',
    mapsKey: 'mapbox'
  };

  constructor(private status: StatusService) {
    this.initializeProvider();
  }

  /**
   * Inicializa el proveedor de mapas desde el estado guardado
   */
  private initializeProvider(): void {
    const savedProvider = this.status.getState('map_provider');
    let defaultTheme: 'light' | 'dark' = 'light';
    const globalTheme = this.status.getState('theme');
    
    if (globalTheme === 'dark') {
      defaultTheme = 'dark';  
    }
    
    if (typeof savedProvider === 'string') {
      this.setProvider(savedProvider);
      console.log('🗺️ Proveedor de mapa cargado desde estado:', savedProvider);
    } else {
      this.setProvider(`mapbox-${defaultTheme}`);
      console.log('🗺️ Usando proveedor de mapa por defecto:', this.config.selectedMap);
    }
  }

  /**
   * Establece el proveedor de mapa y actualiza la configuración
   */
  setProvider(value: string): void {
    console.log('🗺️ Iniciando cambio de proveedor de mapa:', value);
    
    this.config.selectedMap = value;
    const [type, theme] = value.split('-');
    this.config.providerType = type as 'google' | 'mapbox';
    this.config.providerTheme = theme as 'light' | 'dark';
    
    console.log('🔧 Configuración actualizada:', {
      selectedMap: this.config.selectedMap,
      providerType: this.config.providerType,
      providerTheme: this.config.providerTheme
    });
    
    // Guardar la selección en el estado
    this.status.setState('map_provider', value);
  }

  /**
   * Genera una nueva key para forzar recreación del mapa
   */
  generateNewMapKey(): string {
    this.config.mapsKey = `${this.config.providerType}-${Date.now()}`;
    console.log('🔑 Nueva key para recrear mapa:', this.config.mapsKey);
    return this.config.mapsKey;
  }

  /**
   * Destruye el mapa actual (establece key a null)
   */
  destroyMap(): void {
    this.config.mapsKey = null;
  }

  /**
   * Cambia el proveedor con recreación controlada del mapa
   */
  changeProviderWithRecreation(value: string): Promise<string> {
    return new Promise((resolve) => {
      this.setProvider(value);
      
      // Primero destruir el mapa actual
      this.destroyMap();
      
      // Dar tiempo para que Angular procese la destrucción, luego recrear
      setTimeout(() => {
        const newKey = this.generateNewMapKey();
        console.log('✅ Cambio de proveedor completado');
        resolve(newKey);
      }, 100);
    });
  }

  /**
   * Getters para acceder a la configuración
   */
  get selectedMap(): string {
    return this.config.selectedMap;
  }

  get providerType(): 'google' | 'mapbox' {
    return this.config.providerType;
  }

  get providerTheme(): 'light' | 'dark' {
    return this.config.providerTheme;
  }

  get mapsKey(): string | null {
    return this.config.mapsKey;
  }

  /**
   * Obtiene toda la configuración actual
   */
  getConfig(): MapProviderConfig {
    return { ...this.config };
  }
} 