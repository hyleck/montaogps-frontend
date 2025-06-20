import { Component, OnInit, OnChanges, OnDestroy, SimpleChanges, Input } from '@angular/core';
import { ThemesService } from '../../services/themes.service';
import { StatusService } from '../../services/status.service';
import { SystemService, SystemSettings } from '../../../core/services/system.service';

import { MapUtils } from '../../helpers/map.helper';
import { PopupBuilder } from '../../helpers/map-popup.helper';
import { MapThemeService } from '../../helpers/map-theme.helper';
import { MarkerService } from '../../helpers/map-service.helper';

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

  map: any;
  apiKey: string = '';
  apiUrl: string = '';

  private currentMarkers: any[] = [];
  private animationFrameId: number | null = null;
  private lastPosition: { lat: number; lng: number } | null = null;
  private currentDisplayedSpeed: number = 0;

  constructor(
    private _theme: ThemesService,
    private _status: StatusService,
    private systemService: SystemService
  ) {}

  ngOnInit(): void {
    this.initializeNewProvider();
  }

  private initializeNewProvider(): void {
    console.log('Initializing new provider:', this.provider);
    this.systemService.getAll().subscribe((systems: SystemSettings[]) => {
      const config = MapUtils.getApiConfig(systems, this.provider);
      if (!config) {
        console.error('No config found for provider:', this.provider);
        return;
      }

      this.apiKey = config.key;
      this.apiUrl = config.url;
      console.log('Config loaded for', this.provider, { hasKey: !!this.apiKey, hasUrl: !!this.apiUrl });

      MapUtils.loadMapScript(this.provider, this.apiKey, this.apiUrl)
        .then(() => {
          console.log('Script loaded, initializing map...');
          this.initializeMap();
        })
        .catch(err => {
          console.error('Error loading script:', err);
        });
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Como estamos usando recreación del componente para cambios de proveedor,
    // solo necesitamos manejar cambios de tema y target
    if (this.map && changes['theme']) {
      console.log('Theme changed to', this.theme);
      MapThemeService.updateTheme(this.map, this.provider, this.theme, this.selectedTarget, () => this.addMarker());
    }

    if (this.map && changes['selectedTarget']) {
      this.handleTargetChange(changes['selectedTarget']);
    }
  }

  ngOnDestroy(): void {
    if (this.animationFrameId) {
      clearTimeout(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.destroyMap();
  }

  private initializeMap(): void {
    const mapElement = document.getElementById('map') as HTMLElement;
    const { centerLat, centerLng, zoomLevel } = MapUtils.getInitialMapCenter(this.selectedTarget);

    this.map = MapUtils.createMap(this.provider, mapElement, this.apiKey, this.theme, centerLat, centerLng, zoomLevel);

    // Añadir marcador si hay target seleccionado
    if (this.hasValidTarget()) {
      this.addMarker();
    }
  }

  private handleTargetChange(change: any): void {
    const prev = change.previousValue;
    const curr = change.currentValue;

    if (!curr) {
      // No hay target seleccionado, limpiar marcadores
      this.clearExistingMarkers();
      return;
    }

    if (!this.hasValidTarget()) {
      // Target no tiene coordenadas válidas
      this.clearExistingMarkers();
      return;
    }

    if (prev && curr && prev._id === curr._id && this.currentMarkers.length > 0) {
      // Mismo target, solo actualizar posición
      this.updateMarkerPosition();
    } else {
      // Nuevo target o no hay marcadores, crear nuevo marcador
      this.createNewMarker();
    }
  }

  private hasValidTarget(): boolean {
    if (!this.selectedTarget?.traccarInfo?.geolocation?.latitude || 
        !this.selectedTarget?.traccarInfo?.geolocation?.longitude) {
      return false;
    }
    
    const lat = parseFloat(this.selectedTarget.traccarInfo.geolocation.latitude);
    const lng = parseFloat(this.selectedTarget.traccarInfo.geolocation.longitude);
    
    return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
  }

  private createNewMarker(): void {
    this.clearExistingMarkers();
    
    if (!this.hasValidTarget()) return;
    
    const rawLat = this.selectedTarget.traccarInfo.geolocation.latitude;
    const rawLng = this.selectedTarget.traccarInfo.geolocation.longitude;
    
    // Asegurar que sean números válidos
    const lat = parseFloat(rawLat);
    const lng = parseFloat(rawLng);
    
    if (isNaN(lat) || isNaN(lng)) {
      console.error('Invalid coordinates for new marker:', { rawLat, rawLng, lat, lng });
      return;
    }
    
    // Centrar el mapa en el nuevo target
    MapUtils.recenterMap(this.map, this.provider, lat, lng);
    
    // Crear el marcador
    this.addMarker();
  }

  private addMarker(): void {
    if (!this.hasValidTarget() || !this.map) return;

    const rawLat = this.selectedTarget.traccarInfo.geolocation.latitude;
    const rawLng = this.selectedTarget.traccarInfo.geolocation.longitude;
    
    // Asegurar que sean números válidos
    const lat = parseFloat(rawLat);
    const lng = parseFloat(rawLng);
    
    if (isNaN(lat) || isNaN(lng)) {
      console.error('Invalid coordinates:', { rawLat, rawLng, lat, lng });
      return;
    }

    try {
      const marker = MarkerService.createMarker(
        this.map, 
        this.provider, 
        lat, 
        lng, 
        this.selectedTarget, 
        this.vehicleTypeGetter || undefined
      );
      
      if (marker) {
        this.currentMarkers.push(marker);
        this.lastPosition = { lat, lng };
      }
    } catch (error) {
      console.error('Error creating marker:', error);
      // Reintentar después de un breve delay
      setTimeout(() => {
        if (this.currentMarkers.length === 0 && this.hasValidTarget()) {
          this.addMarker();
        }
      }, 500);
    }
  }

  private updateMarkerPosition(): void {
    if (this.currentMarkers.length === 0 || !this.hasValidTarget()) return;

    MarkerService.updatePosition({
      map: this.map,
      provider: this.provider,
      marker: this.currentMarkers[0],
      target: this.selectedTarget,
      lastPosition: this.lastPosition,
      vehicleTypeGetter: this.vehicleTypeGetter || undefined,
      onUpdate: (pos, speed) => {
        this.lastPosition = pos;
        this.currentDisplayedSpeed = speed;
      }
    });
  }

  private clearExistingMarkers(): void {
    this.currentMarkers.forEach(marker => MarkerService.removeMarker(marker, this.provider));
    this.currentMarkers = [];
  }

  private destroyMap(): void {
    this.clearExistingMarkers();
    if (this.map) {
      MarkerService.destroyMap(this.map, this.provider);
    }
    this.map = null;
    
    // Limpiar completamente el contenedor del mapa
    const mapElement = document.getElementById('map');
    if (mapElement) {
      mapElement.innerHTML = '';
      mapElement.className = '';
      mapElement.style.cssText = '';
    }
  }
}
