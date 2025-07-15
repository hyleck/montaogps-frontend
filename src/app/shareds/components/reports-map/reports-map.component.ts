import { Component, OnInit, OnDestroy, Input, OnChanges, SimpleChanges } from '@angular/core';
import { SystemService, SystemSettings } from '../../../core/services/system.service';
import { TargetsService } from '../../../core/services/targets.service';
import { RouteHistoryResponse } from '../../../core/interfaces';

import { MapUtils } from '../../helpers/map.helper';

@Component({
  selector: 'app-reports-map',
  templateUrl: './reports-map.component.html',
  styleUrls: ['./reports-map.component.css'],
  standalone: false
})
export class ReportsMapComponent implements OnInit, OnDestroy, OnChanges {
  @Input() selectedTarget: any = null;
  @Input() routeHistory: RouteHistoryResponse | null = null;
  @Input() showRouteDetails: boolean = true;

  map: any;
  apiKey: string = '';
  apiUrl: string = '';
  provider: 'google' = 'google'; // Por defecto Google Maps
  
  // Elementos del mapa
  routePolyline: any = null;
  dynamicPolylines: any[] = []; // Para las polilíneas que se van dibujando
  startMarker: any = null;
  endMarker: any = null;
  routeMarkers: any[] = [];
  infoWindow: any = null;
  private popupCloseListener: any = null;

  // Elementos de reproducción
  replayMarker: any = null;
  replayInterval: any = null;
  isReplaying: boolean = false;
  isPaused: boolean = false;
  currentPositionIndex: number = 0;
  replaySpeed: number = 500; // milisegundos entre posiciones
  replayPositions: any[] = [];
  isReplayPopupOpen: boolean = false; // Trackear si el popup abierto es del marcador de reproducción

  constructor(
    private systemService: SystemService,
    private targetsService: TargetsService
  ) {}

  ngOnInit(): void {
    console.log('🆕 Reports Map component initialized');
    this.initializeMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.map && (changes['routeHistory'] || changes['selectedTarget'])) {
      console.log('🔄 Route history or target changed, updating map');
      this.updateMapWithRouteHistory();
    }
  }

  ngOnDestroy(): void {
    console.log('🧹 Reports Map component destroyed');
    
    // Limpiar listener del botón de cerrar
    if (this.popupCloseListener) {
      document.removeEventListener('click', this.popupCloseListener);
      this.popupCloseListener = null;
    }
    
    this.destroyMap();
  }

  private initializeMap(): void {
    console.log('🗺️ Initializing Google Maps for reports...');
    
    this.systemService.getAll().subscribe((systems: SystemSettings[]) => {
      const config = MapUtils.getApiConfig(systems, this.provider);
      if (!config) {
        console.error('❌ No Google Maps config found');
        return;
      }

      this.apiKey = config.key;
      this.apiUrl = config.url;
      console.log('📦 Google Maps config loaded', { 
        hasKey: !!this.apiKey, 
        hasUrl: !!this.apiUrl 
      });

      MapUtils.loadMapScript(this.provider, this.apiKey, this.apiUrl)
        .then(() => {
          console.log('📜 Google Maps script loaded, creating map...');
          this.createGoogleMap();
        })
        .catch(err => {
          console.error('❌ Error loading Google Maps script:', err);
        });
    },
    error => {
      console.error('❌ Error loading system settings:', error);
    });
  }

  private createGoogleMap(): void {
    const mapElement = document.getElementById('reports-map') as HTMLElement;
    if (!mapElement) {
      console.error('❌ Reports map element not found!');
      return;
    }

    // Coordenadas por defecto (centro de España)
    let centerLat = 40.4168;
    let centerLng = -3.7038;
    let zoomLevel = 6;

    // Si hay un target seleccionado, centrar en él
    if (this.selectedTarget?.traccarInfo?.geolocation) {
      centerLat = this.selectedTarget.traccarInfo.geolocation.latitude;
      centerLng = this.selectedTarget.traccarInfo.geolocation.longitude;
      zoomLevel = 12;
    }

    console.log('📍 Creating map at coordinates:', {
      centerLat: centerLat.toFixed(6),
      centerLng: centerLng.toFixed(6),
      zoomLevel
    });

    const google = (window as any).google;
    
    this.map = new google.maps.Map(mapElement, {
      center: { lat: centerLat, lng: centerLng },
      zoom: zoomLevel,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ],
      disableDefaultUI: false,
      zoomControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      mapTypeControl: true,
      gestureHandling: 'greedy',
      scrollwheel: true
    });

    // Crear InfoWindow global
    this.infoWindow = new google.maps.InfoWindow();

    // Listener para cuando se cierre el InfoWindow
    this.infoWindow.addListener('closeclick', () => {
      this.isReplayPopupOpen = false;
    });

    // Configurar listener para cerrar popup
    this.setupPopupCloseListener();

    console.log('✅ Google Maps created successfully');
    
    // Si ya hay datos de ruta, mostrarlos
    if (this.routeHistory) {
      this.updateMapWithRouteHistory();
    }
  }

  private updateMapWithRouteHistory(): void {
    if (!this.map || !this.routeHistory || !this.routeHistory.positions.length) {
      console.log('⚠️ No map, route history, or positions available');
      return;
    }

    console.log('🛣️ Updating map with route history:', {
      totalPositions: this.routeHistory.totalPositions,
      positionsCount: this.routeHistory.positions.length
    });

    // Limpiar elementos existentes
    this.clearMapElements();

    const google = (window as any).google;
    const positions = this.routeHistory.positions;

    // Crear el path de la ruta
    const routePath = positions.map(pos => ({
      lat: pos.latitude,
      lng: pos.longitude
    }));

    // NO dibujamos toda la polilínea al inicio, se irá dibujando progresivamente

    // Marcador de inicio (verde)
    if (positions.length > 0) {
      const startPos = positions[0];
      this.startMarker = new google.maps.Marker({
        position: { lat: startPos.latitude, lng: startPos.longitude },
        map: this.map,
        title: 'Inicio del recorrido',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#10b981',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2
        }
      });

      // InfoWindow para inicio
      this.startMarker.addListener('click', () => {
        const content = this.createPositionPopupContent(startPos, 'Inicio del recorrido', '#10b981');
        this.infoWindow.setContent(content);
        this.infoWindow.open(this.map, this.startMarker);
        this.isReplayPopupOpen = false; // Marcar que NO es el popup de reproducción
      });
    }

    // Marcador de fin (rojo)
    if (positions.length > 1) {
      const endPos = positions[positions.length - 1];
      this.endMarker = new google.maps.Marker({
        position: { lat: endPos.latitude, lng: endPos.longitude },
        map: this.map,
        title: 'Final del recorrido',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#ef4444',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2
        }
      });

      // InfoWindow para final
      this.endMarker.addListener('click', () => {
        const content = this.createPositionPopupContent(endPos, 'Final del recorrido', '#ef4444');
        this.infoWindow.setContent(content);
        this.infoWindow.open(this.map, this.endMarker);
        this.isReplayPopupOpen = false; // Marcar que NO es el popup de reproducción
      });
    }

    // Marcadores intermedios (opcional, solo cada N posiciones para no saturar)
    if (this.showRouteDetails && positions.length > 2) {
      const step = Math.max(1, Math.floor(positions.length / 10)); // Máximo 10 marcadores intermedios
      
      for (let i = step; i < positions.length - 1; i += step) {
        const pos = positions[i];
        const marker = new google.maps.Marker({
          position: { lat: pos.latitude, lng: pos.longitude },
          map: this.map,
          title: `Posición ${i + 1}`,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 4,
            fillColor: '#3b82f6',
            fillOpacity: 0.7,
            strokeColor: '#ffffff',
            strokeWeight: 1
          }
        });

        // InfoWindow para posición intermedia
        marker.addListener('click', () => {
          const content = this.createPositionPopupContent(pos, `Posición ${i + 1}`, '#3b82f6');
          this.infoWindow.setContent(content);
          this.infoWindow.open(this.map, marker);
          this.isReplayPopupOpen = false; // Marcar que NO es el popup de reproducción
        });

        this.routeMarkers.push(marker);
      }
    }

    // Ajustar la vista del mapa para mostrar toda la ruta
    this.fitMapToRoute(routePath);

    console.log('✅ Route history updated on map');

    // Iniciar reproducción automáticamente después de un breve delay
    setTimeout(() => {
      this.startReplay();
    }, 1000);
  }

  private setupPopupCloseListener(): void {
    // Configurar listener para eventos click en el documento
    this.popupCloseListener = (event: any) => {
      if (event.target && event.target.classList.contains('reports-close-btn')) {
        this.closePopup();
      }
    };
    
    // Agregar listener al documento para capturar clicks en botones de cerrar
    document.addEventListener('click', this.popupCloseListener);
  }

  private closePopup(): void {
    if (this.infoWindow) {
      this.infoWindow.close();
      this.isReplayPopupOpen = false; // Resetear el estado del popup
    }
  }

  private createPositionPopupContent(position: any, title: string, color: string): string {
    const date = new Date(position.fixTime).toLocaleString('es-ES');
    const speed = Math.round(position.speed * 1.852); // Convertir a km/h
    
    return `
      <div class="reports-popup">
        <div class="reports-popup-header">
          <div class="reports-popup-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
          <h3 class="reports-popup-title">${title}</h3>
        </div>
        <div class="reports-popup-content">
          <div class="reports-info-item">
            <div class="reports-info-icon">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12,6 12,12 16,14"></polyline>
              </svg>
            </div>
            <div class="reports-info-content">
              <span class="reports-info-label">Fecha y hora</span>
              <span class="reports-info-value">${date}</span>
            </div>
          </div>
          <div class="reports-info-item">
            <div class="reports-info-icon">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2">
                <path d="M12 2v10l8-8z"></path>
                <path d="M2 12h20"></path>
                <path d="M12 22v-10l8 8z"></path>
              </svg>
            </div>
            <div class="reports-info-content">
              <span class="reports-info-label">Velocidad</span>
              <span class="reports-info-value">${speed} km/h</span>
            </div>
          </div>
        </div>
        <div class="reports-popup-footer">
          <button class="reports-close-btn" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            Cerrar
          </button>
        </div>
      </div>
    `;
  }

  private fitMapToRoute(routePath: any[]): void {
    if (!this.map || !routePath.length) return;

    const google = (window as any).google;
    const bounds = new google.maps.LatLngBounds();
    
    routePath.forEach(point => {
      bounds.extend(point);
    });

    this.map.fitBounds(bounds);
    
    // Asegurar un zoom mínimo
    google.maps.event.addListenerOnce(this.map, 'bounds_changed', () => {
      if (this.map.getZoom() > 16) {
        this.map.setZoom(16);
      }
    });
  }

  private clearMapElements(): void {
    // Detener reproducción
    this.stopReplay();

    // Limpiar polilínea
    if (this.routePolyline) {
      this.routePolyline.setMap(null);
      this.routePolyline = null;
    }

    // Limpiar polilíneas dinámicas
    this.dynamicPolylines.forEach(polyline => {
      polyline.setMap(null);
    });
    this.dynamicPolylines = [];

    // Limpiar marcadores
    if (this.startMarker) {
      this.startMarker.setMap(null);
      this.startMarker = null;
    }

    if (this.endMarker) {
      this.endMarker.setMap(null);
      this.endMarker = null;
    }

    // Limpiar marcadores intermedios
    this.routeMarkers.forEach(marker => {
      marker.setMap(null);
    });
    this.routeMarkers = [];

    // Cerrar InfoWindow
    if (this.infoWindow) {
      this.infoWindow.close();
    }
  }

  private destroyMap(): void {
    console.log('🧹 Destroying reports map');
    
    // Detener reproducción si está activa
    this.stopReplay();
    
    // Limpiar elementos del mapa
    this.clearMapElements();
    
    if (this.infoWindow) {
      this.infoWindow.close();
      this.infoWindow = null;
    }
    
    this.map = null;
    
    // Limpiar contenedor del mapa
    const mapElement = document.getElementById('reports-map');
    if (mapElement) {
      mapElement.innerHTML = '';
      mapElement.className = '';
      mapElement.style.cssText = '';
      console.log('✅ Reports map container cleaned');
    }
  }

  // Métodos de control de reproducción
  startReplay(): void {
    if (!this.routeHistory || !this.routeHistory.positions.length) {
      console.log('⚠️ No hay datos de ruta para reproducir');
      return;
    }

    console.log('🎬 Iniciando reproducción del recorrido');
    
    // Limpiar polilíneas dinámicas de reproducciones anteriores
    this.dynamicPolylines.forEach(polyline => {
      polyline.setMap(null);
    });
    this.dynamicPolylines = [];

    // Preparar datos de reproducción
    this.replayPositions = [...this.routeHistory.positions].sort((a, b) => 
      new Date(a.fixTime).getTime() - new Date(b.fixTime).getTime()
    );
    
    this.currentPositionIndex = 0;
    this.isReplaying = true;
    this.isPaused = false;

    // Crear marcador de reproducción
    this.createReplayMarker();
    
    // Iniciar animación
    this.nextPosition();
  }

  pauseReplay(): void {
    if (this.replayInterval) {
      clearTimeout(this.replayInterval);
      this.replayInterval = null;
    }
    this.isPaused = true;
    console.log('⏸️ Reproducción pausada');
  }

  resumeReplay(): void {
    if (this.isReplaying && this.isPaused) {
      this.isPaused = false;
      this.nextPosition();
      console.log('▶️ Reproducción reanudada');
    }
  }

  stopReplay(): void {
    if (this.replayInterval) {
      clearTimeout(this.replayInterval);
      this.replayInterval = null;
    }
    
    this.isReplaying = false;
    this.isPaused = false;
    this.currentPositionIndex = 0;
    this.isReplayPopupOpen = false; // Resetear estado del popup de reproducción
    
    // Remover marcador de reproducción
    if (this.replayMarker) {
      this.replayMarker.setMap(null);
      this.replayMarker = null;
    }

    // Limpiar polilíneas dinámicas cuando se detiene la reproducción
    this.dynamicPolylines.forEach(polyline => {
      polyline.setMap(null);
    });
    this.dynamicPolylines = [];
    
    console.log('⏹️ Reproducción detenida');
  }

  setReplaySpeed(speed: number): void {
    this.replaySpeed = speed;
    console.log(`⚡ Velocidad de reproducción: ${speed}ms`);
  }

  onSpeedChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const speed = parseInt(target.value, 10);
    this.setReplaySpeed(speed);
  }

  private createReplayMarker(): void {
    if (!this.map || !this.replayPositions.length) return;

    const google = (window as any).google;
    const firstPosition = this.replayPositions[0];

    this.replayMarker = new google.maps.Marker({
      position: { lat: firstPosition.latitude, lng: firstPosition.longitude },
      map: this.map,
      title: 'Reproducción del recorrido',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#ff6b35',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3,
        anchor: new google.maps.Point(0, 0)
      },
      zIndex: 1000
    });

    // InfoWindow para el marcador de reproducción
    this.replayMarker.addListener('click', () => {
      // Usar currentPositionIndex - 1 porque el índice ya se incrementó después de mover el marcador
      const actualIndex = Math.max(0, this.currentPositionIndex - 1);
      const currentPos = this.replayPositions[actualIndex];
      if (currentPos) {
        const content = this.createReplayPopupContent(currentPos, actualIndex + 1);
        this.infoWindow.setContent(content);
        this.infoWindow.open(this.map, this.replayMarker);
        this.isReplayPopupOpen = true; // Marcar que el popup de reproducción está abierto
      }
    });
  }

  private centerIfMarkerOutOfView(position: { lat: number; lng: number }): void {
    if (!this.map) return;

    const google = (window as any).google;
    const bounds = this.map.getBounds();
    
    if (!bounds) return;

    const markerLatLng = new google.maps.LatLng(position.lat, position.lng);
    
    // Verificar si el marcador está fuera de los límites visibles
    if (!bounds.contains(markerLatLng)) {
      console.log('🎯 Marcador fuera de vista, centrando mapa');
      this.map.panTo(position);
    }
  }

  private nextPosition(): void {
    if (!this.isReplaying || this.isPaused || this.currentPositionIndex >= this.replayPositions.length) {
      if (this.currentPositionIndex >= this.replayPositions.length) {
        console.log('✅ Reproducción completada');
        this.stopReplay();
      }
      return;
    }

    const currentPosition = this.replayPositions[this.currentPositionIndex];
    
    // Mover marcador a la nueva posición
    if (this.replayMarker) {
      const newLatLng = { lat: currentPosition.latitude, lng: currentPosition.longitude };
      this.replayMarker.setPosition(newLatLng);
      
      // Actualizar el popup solo si es el popup del marcador de reproducción
      if (this.infoWindow && this.infoWindow.getMap() && this.isReplayPopupOpen) {
        const content = this.createReplayPopupContent(currentPosition, this.currentPositionIndex + 1);
        this.infoWindow.setContent(content);
      }
      
      // Solo centrar si el marcador está saliendo de la vista
      this.centerIfMarkerOutOfView(newLatLng);
    }

    // Dibujar segmento de ruta desde la posición anterior hasta la actual
    if (this.currentPositionIndex > 0) {
      const previousPosition = this.replayPositions[this.currentPositionIndex - 1];
      const google = (window as any).google;
      
      const segmentPath = [
        { lat: previousPosition.latitude, lng: previousPosition.longitude },
        { lat: currentPosition.latitude, lng: currentPosition.longitude }
      ];

      const segmentPolyline = new google.maps.Polyline({
        path: segmentPath,
        geodesic: true,
        strokeColor: '#00ff00',
        strokeOpacity: 1.0,
        strokeWeight: 4
      });

      segmentPolyline.setMap(this.map);
      this.dynamicPolylines.push(segmentPolyline);
    }

    this.currentPositionIndex++;

    // Programar siguiente posición
    this.replayInterval = setTimeout(() => {
      this.nextPosition();
    }, this.replaySpeed);
  }

  private createReplayPopupContent(position: any, positionNumber: number): string {
    const date = new Date(position.fixTime).toLocaleString('es-ES');
    const speed = Math.round(position.speed * 1.852); // Convertir a km/h
    
    return `
      <div class="reports-popup">
        <div class="reports-popup-header">
          <div class="reports-popup-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <polygon points="5,3 19,12 5,21"></polygon>
            </svg>
          </div>
          <h3 class="reports-popup-title">Reproduciendo - Posición ${positionNumber}</h3>
        </div>
        <div class="reports-popup-content">
          <div class="reports-info-item">
            <div class="reports-info-icon">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12,6 12,12 16,14"></polyline>
              </svg>
            </div>
            <div class="reports-info-content">
              <span class="reports-info-label">Fecha y hora</span>
              <span class="reports-info-value">${date}</span>
            </div>
          </div>
          <div class="reports-info-item">
            <div class="reports-info-icon">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2">
                <path d="M12 2v10l8-8z"></path>
                <path d="M2 12h20"></path>
                <path d="M12 22v-10l8 8z"></path>
              </svg>
            </div>
            <div class="reports-info-content">
              <span class="reports-info-label">Velocidad</span>
              <span class="reports-info-value">${speed} km/h</span>
            </div>
          </div>
          <div class="reports-info-item">
            <div class="reports-info-icon">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2">
                <path d="M9 11H7l5-5 5 5h-2v8h-6v-8z"></path>
              </svg>
            </div>
            <div class="reports-info-content">
              <span class="reports-info-label">Progreso</span>
              <span class="reports-info-value">${positionNumber} de ${this.replayPositions.length}</span>
            </div>
          </div>
        </div>
        <div class="reports-popup-footer">
          <button class="reports-close-btn" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            Cerrar
          </button>
        </div>
      </div>
    `;
  }

  // Getters para el template
  getReplayProgress(): number {
    if (!this.replayPositions.length) return 0;
    return Math.round((this.currentPositionIndex / this.replayPositions.length) * 100);
  }

  getCurrentPositionInfo(): any {
    if (!this.isReplaying || this.currentPositionIndex <= 0) return null;
    return this.replayPositions[this.currentPositionIndex - 1];
  }
} 