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
  currentMarker: any = null;
  currentPopup: any = null;
  currentPopupId: string = '';

  constructor(
    private _theme: ThemesService,
    private _status: StatusService,
    private systemService: SystemService,
    private targetsService: TargetsService
  ) {}

  ngOnInit(): void {
    console.log('🆕 Maps component initialized with provider:', this.provider);
    this.initializeNewProvider();
    this.setupGlobalFunctions();
  }

  private setupGlobalFunctions(): void {
    // Función global para toggle de detalles en popups con ID específico
    (window as any).togglePopupDetails = (popupId: string) => {
      const popup = document.getElementById(popupId);
      if (!popup) return;
      
      const details = popup.querySelector(`#details-${popupId}`) as HTMLElement;
      const expandIcon = popup.querySelector('.expand-icon') as HTMLElement;
      
      if (details && expandIcon) {
        const isExpanded = details.style.maxHeight !== '0px' && details.style.maxHeight !== '';
        
        if (!isExpanded) {
          // Expandir
          details.style.maxHeight = '80px';
          details.style.opacity = '1';
          details.style.paddingTop = '8px';
          details.style.paddingBottom = '8px';
          expandIcon.style.transform = 'rotate(180deg)';
        } else {
          // Contraer
          details.style.maxHeight = '0px';
          details.style.opacity = '0';
          details.style.paddingTop = '0px';
          details.style.paddingBottom = '0px';
          expandIcon.style.transform = 'rotate(0deg)';
        }
      }
    };

    // Función global para actualizar solo el tiempo de parada
    (window as any).updateStopTime = (popupId: string, stopTime: string) => {
      const popup = document.getElementById(popupId);
      if (!popup) return;
      
      const stopTimeElement = popup.querySelector(`#stop-time-${popupId} .detail-value`) as HTMLElement;
      if (stopTimeElement) {
        stopTimeElement.textContent = stopTime;
        console.log('✅ Tiempo de parada actualizado en DOM:', stopTime);
      }
    };
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

    // Manejar cambios en el target seleccionado
    if (changes['selectedTarget']) {
      console.log('Selected target changed:', this.selectedTarget);
      this.updateTargetMarker();
    }
  }

  ngOnDestroy(): void {
    console.log('🧹 Maps component destroyed');
    this.destroyMap();
    this.cleanupGlobalFunctions();
  }

  private cleanupGlobalFunctions(): void {
    // Limpiar funciones globales
    if ((window as any).togglePopupDetails) {
      delete (window as any).togglePopupDetails;
    }
    if ((window as any).updateStopTime) {
      delete (window as any).updateStopTime;
    }
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
        console.log('✅ Mapa inicializado correctamente para provider:', this.provider);
        // Agregar marcador inicial si hay target seleccionado
        this.updateTargetMarker();
      } else {
        console.error('❌ Error: mapa es null después de la creación');
      }
    } catch (error) {
      console.error('❌ Error creating map:', error);
    }
  }

  private updateTargetMarker(): void {
    if (!this.map) return;

    console.log('🔄 Actualizando marcador para target:', this.selectedTarget?.name || 'ninguno');

    // Remover marcador anterior si existe
    if (this.currentMarker) {
      MapUtils.removeMarker(this.currentMarker, this.provider);
      this.currentMarker = null;
      this.currentPopup = null;
      this.currentPopupId = '';
    }

    // Agregar nuevo marcador si hay target seleccionado
    if (this.selectedTarget?.traccarInfo?.geolocation) {
      const lat = parseFloat(this.selectedTarget.traccarInfo.geolocation.latitude);
      const lng = parseFloat(this.selectedTarget.traccarInfo.geolocation.longitude);
      
      if (!isNaN(lat) && !isNaN(lng)) {
        // Recentrar el mapa en la nueva posición
        MapUtils.recenterMap(this.map, this.provider, lat, lng);
        
        // Crear marcador e popup iniciales
        this.createMarkerWithPopup(lat, lng);
        
        console.log('✅ Marcador agregado para:', this.selectedTarget.name);

        // Obtener tiempo de parada de manera asíncrona y actualizar popup
        this.updateMarkerWithStopTime();
      } else {
        console.warn('⚠️ Coordenadas inválidas para el target:', { lat, lng });
      }
    } else {
      console.log('ℹ️ No hay target seleccionado o no tiene geolocalización');
    }
  }

  private createMarkerWithPopup(lat: number, lng: number): void {
    const title = this.selectedTarget.name || 'Target';
    const imei = this.selectedTarget.imei || 'N/A';
    const status = this.selectedTarget.traccarStatus || 'desconocido';

    // Crear contenido inicial del popup (sin tiempo de parada)
    const initialContent = this.createPopupContent(title, imei, status, null);
    
    // Extraer el popupId del contenido HTML
    const popupIdMatch = initialContent.match(/id="(popup-[^"]+)"/);
    this.currentPopupId = popupIdMatch ? popupIdMatch[1] : '';

    if (this.provider === 'google') {
      // Crear marcador Google Maps
      this.currentMarker = new google.maps.Marker({
        position: { lat, lng },
        map: this.map,
        title: title,
        icon: {
          url: 'data:image/svg+xml;base64,' + btoa(`
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="12" fill="#22c55e" stroke="#fff" stroke-width="2"/>
              <circle cx="16" cy="16" r="6" fill="#fff"/>
            </svg>
          `),
          scaledSize: new google.maps.Size(32, 32),
          anchor: new google.maps.Point(16, 16)
        }
      });

      // Crear InfoWindow
      this.currentPopup = new google.maps.InfoWindow({
        content: initialContent
      });

      // Abrir InfoWindow
      this.currentPopup.open(this.map, this.currentMarker);

      // Listener para click en marcador
      this.currentMarker.addListener('click', () => {
        this.currentPopup.open(this.map, this.currentMarker);
      });

    } else {
      // Crear marcador Mapbox
      const mapboxgl = (window as any).mapboxgl;
      
      const markerElement = document.createElement('div');
      markerElement.className = 'custom-marker';
      markerElement.style.cssText = `
        width: 32px;
        height: 32px;
        background: #22c55e;
        border: 2px solid #fff;
        border-radius: 50%;
        cursor: pointer;
        position: relative;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      `;
      
      const centerDot = document.createElement('div');
      centerDot.style.cssText = `
        width: 12px;
        height: 12px;
        background: #fff;
        border-radius: 50%;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      `;
      markerElement.appendChild(centerDot);

      this.currentMarker = new mapboxgl.Marker(markerElement)
        .setLngLat([lng, lat])
        .addTo(this.map);

      // Crear popup Mapbox
      this.currentPopup = new mapboxgl.Popup({ offset: 25 })
        .setHTML(initialContent);

      this.currentMarker.setPopup(this.currentPopup);
      this.currentMarker.togglePopup();
    }
  }

  private async updateMarkerWithStopTime(): Promise<void> {
    const deviceId = this.selectedTarget?.api_device_id || this.selectedTarget?.originalTarget?.api_device_id;
    if (!deviceId || !this.currentMarker) return;

    try {
      console.log('🕒 Solicitando tiempo de parada para deviceId:', deviceId);
      const stopTimeResult = await this.targetsService.getStopTime(deviceId);
      console.log('📊 Resultado del tiempo de parada:', stopTimeResult);

      if (stopTimeResult && stopTimeResult.text) {
        // Actualizar el popup con el tiempo de parada
        this.updateMarkerPopupWithStopTime(stopTimeResult.text);
      }
    } catch (error) {
      console.error('❌ Error al obtener tiempo de parada:', error);
    }
  }

  private updateMarkerPopupWithStopTime(stopTime: string): void {
    if (!this.currentPopupId || !stopTime) return;

    // Usar la función global para actualizar solo el tiempo de parada
    if ((window as any).updateStopTime) {
      (window as any).updateStopTime(this.currentPopupId, stopTime);
      console.log('✅ Popup actualizado con tiempo de parada:', stopTime);
    } else {
      console.warn('⚠️ Función updateStopTime no disponible');
    }
  }

  private createPopupContent(title: string, imei: string, status: string, stopTime: string | null): string {
    // Crear ID único para este popup
    const popupId = `popup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return `
      <div class="custom-popup" id="${popupId}">
        <div class="popup-header">
          <div class="popup-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
          <h3 class="popup-title">${title}</h3>
          <div class="popup-status online">
            <div class="status-dot"></div>
            <span>En línea</span>
          </div>
        </div>
        <div class="popup-content">
          <div class="popup-info-item">
            <div class="info-icon">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2">
                <path d="M12 2v10l8-8z"></path>
                <path d="M2 12h20"></path>
                <path d="M12 22v-10l8 8z"></path>
              </svg>
            </div>
            <div class="info-content">
              <span class="info-label">Velocidad</span>
              <span class="info-value">0 km/h</span>
            </div>
          </div>
          <div class="popup-info-item expandable" onclick="window.togglePopupDetails('${popupId}')">
            <div class="info-icon">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2 2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </div>
            <div class="info-content">
              <span class="info-label">Más información</span>
              <svg class="expand-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" style="transition: transform 0.3s ease;">
                <polyline points="6,9 12,15 18,9"></polyline>
              </svg>
            </div>
          </div>
          <div class="popup-details" id="details-${popupId}" style="max-height: 0px; opacity: 0; overflow: hidden; transition: all 0.3s ease; padding: 0;">
            <div class="detail-item">
              <span class="detail-label">IMEI:</span>
              <span class="detail-value">${imei}</span>
            </div>
            <div class="detail-item" id="stop-time-${popupId}">
              <span class="detail-label">Tiempo detenido:</span>
              <span class="detail-value">${stopTime || 'Cargando...'}</span>
            </div>
          </div>
          <div class="popup-footer">
            <button class="popup-close-btn" onclick="this.closest('${this.provider === 'google' ? '.gm-style-iw' : '.mapboxgl-popup'}').parentElement.style.display='none'">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    `;
  }



  private destroyMap(): void {
    console.log('🧹 Destroying map, provider:', this.provider);
    
    // Limpiar marcador y popup antes de destruir el mapa
    if (this.currentMarker) {
      MapUtils.removeMarker(this.currentMarker, this.provider);
      this.currentMarker = null;
    }
    
    if (this.currentPopup) {
      // Cerrar popup si existe
      if (this.provider === 'google' && this.currentPopup.close) {
        this.currentPopup.close();
      }
      this.currentPopup = null;
      this.currentPopupId = '';
    }
    
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
