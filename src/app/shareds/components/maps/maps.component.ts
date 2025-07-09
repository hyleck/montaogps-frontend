import { Component, OnInit, OnChanges, OnDestroy, SimpleChanges, Input } from '@angular/core';
import { ThemesService } from '../../services/themes.service';
import { StatusService } from '../../services/status.service';
import { SystemService, SystemSettings } from '../../../core/services/system.service';
import { TargetsService } from '../../../core/services/targets.service';

import { MapUtils } from '../../helpers/map.helper';
import { MapThemeService } from '../../helpers/map-theme.helper';

@Component({
  selector: 'app-maps',
  templateUrl: './maps.component.html',
  styleUrls: ['./maps.component.css'],
  standalone: false
})
export class MapsComponent implements OnInit, OnChanges, OnDestroy {
  @Input() provider: 'google' | 'mapbox' = 'mapbox';
  @Input() theme: 'dark' | 'light' = 'dark';
  @Input() selectedTarget: any = null;
  @Input() vehicleTypeGetter: ((modelId: string) => string) | null = null;
  @Input() preloadedStopTime: string | undefined = undefined;

  map: any;
  apiKey: string = '';
  apiUrl: string = '';

  constructor(
    private _theme: ThemesService,
    private _status: StatusService,
    private systemService: SystemService,
    private targetsService: TargetsService
  ) {}

  ngOnInit(): void {
    console.log('🆕 Maps component initialized with provider:', this.provider);
    this.initializeNewProvider();
  }

  private initializeNewProvider(): void {
    console.log('🚀 Initializing new provider:', this.provider);
    console.log('🔧 Current component state:', {
      provider: this.provider,
      theme: this.theme,
      hasSelectedTarget: !!this.selectedTarget,
      mapExists: !!this.map
    });

    this.systemService.getAll().subscribe((systems: SystemSettings[]) => {
      const config = MapUtils.getApiConfig(systems, this.provider);
      if (!config) {
        console.error('❌ No config found for provider:', this.provider);
        return;
      }

      this.apiKey = config.key;
      this.apiUrl = config.url;
      console.log('📦 Config loaded for', this.provider, { 
        hasKey: !!this.apiKey, 
        hasUrl: !!this.apiUrl,
        keyLength: this.apiKey?.length,
        url: this.apiUrl 
      });

      MapUtils.loadMapScript(this.provider, this.apiKey, this.apiUrl)
        .then(async () => {
          console.log('📜 Script loaded successfully, initializing map...');
          await this.initializeMap();
          console.log('✅ Map initialization completed for provider:', this.provider);
        })
        .catch(err => {
          console.error('❌ Error loading script for', this.provider, ':', err);
        });
    },
    error => {
      console.error('❌ Error loading system settings:', error);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Manejar cambios de proveedor (cuando se recrea el componente)
    if (changes['provider'] && !changes['provider'].firstChange) {
      console.log('Provider changed, reinitializing map:', this.provider);
      this.destroyMap();
      setTimeout(() => {
        this.initializeNewProvider();
      }, 50);
      return;
    }

    // Solo manejar cambios de tema si el mapa ya existe
    if (this.map && changes['theme']) {
      console.log('Theme changed to', this.theme);
      MapThemeService.updateTheme(this.map, this.provider, this.theme, this.selectedTarget);
    }

    // Los cambios de selectedTarget, vehicleTypeGetter y preloadedStopTime se mantienen como inputs
    // pero ya no se procesan para mostrar marcadores
    if (changes['selectedTarget']) {
      console.log('Selected target changed:', this.selectedTarget);
      // Recentrar el mapa si hay target válido
      if (this.map && this.selectedTarget?.traccarInfo?.geolocation) {
        const lat = parseFloat(this.selectedTarget.traccarInfo.geolocation.latitude);
        const lng = parseFloat(this.selectedTarget.traccarInfo.geolocation.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
          MapUtils.recenterMap(this.map, this.provider, lat, lng);
        }
      }
    }
  }

  ngOnDestroy(): void {
    console.log('🧹 Maps component destroyed');
    this.destroyMap();
  }

  private async initializeMap(): Promise<void> {
    console.log('🗺️ Starting map initialization...');
    
    const mapElement = document.getElementById('map') as HTMLElement;
    if (!mapElement) {
      console.error('❌ Map element not found!');
      return;
    }
    
    // Usar coordenadas por defecto si no hay target seleccionado
    const { centerLat, centerLng, zoomLevel } = MapUtils.getInitialMapCenter(this.selectedTarget);
    
    console.log('📍 Map coordinates:', {
      centerLat: centerLat.toFixed(6),
      centerLng: centerLng.toFixed(6),
      zoomLevel,
      fromTarget: !!this.selectedTarget?.traccarInfo?.geolocation
    });

    try {
      // Crear mapa básico sin marcadores
      this.map = MapUtils.createMap(this.provider, mapElement, this.apiKey, this.theme, centerLat, centerLng, zoomLevel);
      
      if (this.map) {
        console.log('✅ Mapa inicializado correctamente sin marcadores para provider:', this.provider);
      } else {
        console.error('❌ Error: mapa es null después de la creación');
      }
    } catch (error) {
      console.error('❌ Error creating map:', error);
    }
  }

  private destroyMap(): void {
    console.log('🧹 Destroying map, provider:', this.provider);
    
    if (this.map) {
      try {
        // Destruir el mapa según el proveedor
        if (this.provider === 'mapbox' && this.map.remove) {
          console.log('🗑️ Removing Mapbox map');
          this.map.remove();
        } else if (this.provider === 'google') {
          console.log('🗑️ Clearing Google map');
          // Para Google Maps, simplemente dejamos que se limpie el contenedor
        }
      } catch (error) {
        console.warn('Error destroying map:', error);
      }
    }
    
    this.map = null;
    
    // Limpiar completamente el contenedor del mapa
    const mapElement = document.getElementById('map');
    if (mapElement) {
      mapElement.innerHTML = '';
      mapElement.className = '';
      mapElement.style.cssText = '';
      console.log('✅ Map container cleaned');
    }
  }
}
