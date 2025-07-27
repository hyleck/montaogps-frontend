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
  @Input() stops: any[] = [];
  @Input() showStops: boolean = true;
  @Input() showRouteDetails: boolean = true;
  @Input() autoStartReplay: boolean = false;
  @Input() isStreamingMode: boolean = false;

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
  stopMarkers: any[] = []; // Marcadores de paradas
  infoWindow: any = null;
  private popupCloseListener: any = null;

  // Elementos de reproducción
  replayMarker: any = null;
  replayInterval: any = null;
  isReplaying: boolean = false;
  isPaused: boolean = false;
  isManuallyPaused: boolean = false; // Trackear si fue pausado manualmente por el usuario
  isManuallyStop: boolean = false; // Trackear si fue detenido manualmente por el usuario
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
    console.log('🛑 Initial stops data:', this.stops?.length || 0);
    this.initializeMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.map && (changes['routeHistory'] || changes['selectedTarget'])) {
      console.log('🔄 Route history or target changed, updating map');
      
      // Si ya está reproduciendo, solo actualizar posiciones
      if (this.isReplaying && changes['routeHistory'] && this.routeHistory) {
        console.log('📈 Actualizando posiciones durante reproducción activa');
        this.updateReplayPositionsWithNewData();
      } 
      // Si había historial previo y llegan datos nuevos, solo actualizar posiciones sin reiniciar mapa
      else if (changes['routeHistory'] && this.routeHistory && this.replayPositions.length > 0) {
        console.log('📦 Actualizando posiciones sin reproducción activa');
        this.updateReplayPositionsWithNewData();
      }
      // Solo recrear el mapa completamente si es la primera vez o cambió el target
      else {
        console.log('🗺️ Recreando mapa con nuevo historial');
        this.updateMapWithRouteHistory();
      }
    }

    // Detectar cambios en las paradas o en el flag showStops
    if (changes['stops'] || changes['showStops']) {
      console.log('🛑 Stops or showStops input changed');
      if (changes['stops']) {
        console.log('🛑 Stops - Previous value:', changes['stops'].previousValue);
        console.log('🛑 Stops - Current value:', changes['stops'].currentValue);
      }
      if (changes['showStops']) {
        console.log('🛑 ShowStops changed:', changes['showStops'].previousValue, '→', changes['showStops'].currentValue);
      }
      console.log('🛑 Map available:', !!this.map);
      console.log('🛑 ShowStops enabled:', this.showStops);
      
      if (this.map) {
        console.log('🛑 Updating stop markers based on new settings');
        this.updateStopMarkers();
      } else {
        console.log('🛑 Map not ready yet, will update stops when map is available');
        // Reintentar cuando el mapa esté listo
        setTimeout(() => {
          if (this.map) {
            console.log('🛑 Reintentando actualizar paradas después de que el mapa esté listo');
            this.updateStopMarkers();
          }
        }, 1000);
      }
    }
    
    // Detectar cambios en el modo streaming para logging y crear marcador de fin
    if (changes['isStreamingMode']) {
      console.log(`🔄 Streaming mode changed: ${this.isStreamingMode}`);
      
      // Si cambió de streaming mode a normal y tenemos posiciones, crear marcador de fin
      if (!this.isStreamingMode && changes['isStreamingMode'].previousValue === true && 
          this.routeHistory && this.routeHistory.positions.length > 1) {
        console.log('🔄 Streaming completado - creando marcador de fin');
        this.createEndMarker(this.routeHistory.positions);
      }
    }
    
    // Detectar cuando se solicita auto-inicio de reproducción
    if (changes['autoStartReplay']) {
      console.log(`🔄 autoStartReplay changed: ${this.autoStartReplay} | isReplaying: ${this.isReplaying} | isManuallyPaused: ${this.isManuallyPaused} | isManuallyStop: ${this.isManuallyStop}`);
    }
    
    if (this.map && changes['autoStartReplay'] && this.autoStartReplay && 
        this.routeHistory && this.routeHistory.positions.length > 0 && !this.isReplaying &&
        !this.isManuallyPaused && !this.isManuallyStop) {
      console.log('🎬 Auto-iniciando reproducción por streaming progresivo');
      
      // Pequeña pausa para asegurar que el mapa esté completamente actualizado
      setTimeout(() => {
        this.startReplay();
      }, 300);
    } else if (this.autoStartReplay && (this.isManuallyPaused || this.isManuallyStop)) {
      console.log('⏸️ Auto-inicio cancelado - el usuario pausó/detuvo manualmente');
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
    
    // Filtrar posiciones con velocidad 0 para mostrar solo el recorrido real
    const movingPositions = this.routeHistory.positions.filter(pos => pos.speed > 0);
    const allPositions = this.routeHistory.positions;
    
    console.log(`🎯 Posiciones para visualización: ${allPositions.length} totales → ${movingPositions.length} con movimiento`);

    // Verificar si hay posiciones con movimiento para mostrar
    if (movingPositions.length === 0) {
      console.log('⚠️ No hay posiciones con movimiento para mostrar en el mapa');
      // Aún crear marcadores con todas las posiciones si no hay movimiento
      const routePath = allPositions.map(pos => ({
        lat: pos.latitude,
        lng: pos.longitude
      }));
      this.fitMapToRoute(routePath);
      return;
    }

    // Crear el path de la ruta solo con posiciones que tienen movimiento
    const routePath = movingPositions.map(pos => ({
      lat: pos.latitude,
      lng: pos.longitude
    }));

    // NO dibujamos toda la polilínea al inicio, se irá dibujando progresivamente

    // Marcador de inicio (verde) - usar la primera posición con movimiento
    if (movingPositions.length > 0) {
      const startPos = movingPositions[0];
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
        
        // Configurar función global para cerrar InfoWindow
        (window as any).closeCurrentInfoWindow = () => {
          if (this.infoWindow) {
            this.infoWindow.close();
          }
        };
      });
    }

    // Marcador de fin (rojo) - solo mostrar si NO estamos en modo streaming (ya se cargaron todos los datos)
    if (movingPositions.length > 1 && !this.isStreamingMode) {
      const endPos = movingPositions[movingPositions.length - 1];
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
      
      console.log('🔴 Marcador de fin colocado - carga completa');
    } else if (movingPositions.length > 1 && this.isStreamingMode) {
      console.log('⏳ Marcador de fin NO colocado - aún cargando datos en streaming');
    }

    // Marcadores intermedios (opcional, solo cada N posiciones para no saturar) - usar posiciones con movimiento
    if (this.showRouteDetails && movingPositions.length > 2) {
      const step = Math.max(1, Math.floor(movingPositions.length / 10)); // Máximo 10 marcadores intermedios
      
      for (let i = step; i < movingPositions.length - 1; i += step) {
        const pos = movingPositions[i];
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

    // Actualizar marcadores de paradas si hay datos y están habilitadas
    if (this.showStops && this.stops && this.stops.length > 0) {
      console.log('🛑 Actualizando marcadores de paradas desde updateMapWithRouteHistory');
      this.updateStopMarkers();
    } else if (!this.showStops) {
      console.log('🛑 Paradas deshabilitadas por filtro en updateMapWithRouteHistory');
      this.clearStopMarkers(); // Asegurar que se limpien si están deshabilitadas
    } else {
      console.log('🛑 No hay paradas para actualizar en updateMapWithRouteHistory');
    }

    // Solo iniciar reproducción automáticamente si no fue pausada/detenida manualmente
    if (!this.isManuallyPaused && !this.isManuallyStop) {
      console.log('🎬 Iniciando reproducción automática del historial actualizado');
      setTimeout(() => {
        this.startReplay();
      }, 1000);
    } else {
      console.log('⏸️ No iniciando reproducción automática - el usuario la pausó/detuvo manualmente');
    }
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

    // Limpiar marcadores de paradas
    this.clearStopMarkers();

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

    // Preparar datos de reproducción - filtrar posiciones con velocidad 0
    const allPositions = [...this.routeHistory.positions]
      .filter(position => position.speed > 0) // Ignorar posiciones con velocidad 0
      .sort((a, b) => new Date(a.fixTime).getTime() - new Date(b.fixTime).getTime());
    
    this.replayPositions = allPositions;
    
    console.log(`🎬 Preparando reproducción: ${this.routeHistory.positions.length} posiciones totales → ${allPositions.length} posiciones con movimiento (sin velocidad 0)`);
    
    // Verificar si hay suficientes posiciones para reproducir
    if (allPositions.length === 0) {
      console.log('⚠️ No hay posiciones con movimiento para reproducir (todas tienen velocidad 0)');
      // Mostrar mensaje al usuario si es posible
      if ((window as any).showToast) {
        (window as any).showToast('warning', 'Sin movimiento', 'Todas las posiciones tienen velocidad 0, no hay recorrido para reproducir');
      }
      return;
    }
    
    if (allPositions.length < 2) {
      console.log('⚠️ Solo hay una posición con movimiento, no es suficiente para una reproducción');
      // Mostrar mensaje al usuario si es posible
      if ((window as any).showToast) {
        (window as any).showToast('warning', 'Datos insuficientes', 'Solo hay una posición con movimiento, se requieren al menos 2 para la reproducción');
      }
      return;
    }
    
    this.currentPositionIndex = 0;
    this.isReplaying = true;
    this.isPaused = false;
    this.isManuallyPaused = false; // Limpiar estado manual
    this.isManuallyStop = false; // Limpiar estado manual

    // Crear marcador de reproducción
    this.createReplayMarker();
    
    // Iniciar animación
    this.nextPosition();
  }

  pauseReplay(): void {
    if (!this.isReplaying) {
      console.log('⚠️ No se puede pausar: no hay reproducción activa');
      return;
    }
    
    if (this.replayInterval) {
      clearTimeout(this.replayInterval);
      this.replayInterval = null;
      console.log('🔄 Cancelando timeout de reproducción activo');
    }
    
    this.isPaused = true;
    this.isManuallyPaused = true; // Marcar que fue pausado manualmente
    console.log('⏸️ Reproducción pausada manualmente (streaming mode:', this.isStreamingMode, ')');
  }

  resumeReplay(): void {
    if (!this.isReplaying) {
      console.log('⚠️ No se puede reanudar: no hay reproducción activa');
      return;
    }
    
    if (!this.isPaused) {
      console.log('⚠️ La reproducción no está pausada');
      return;
    }
    
    this.isPaused = false;
    this.isManuallyPaused = false; // Limpiar el estado manual al reanudar
    console.log('▶️ Reproducción reanudada manualmente (streaming mode:', this.isStreamingMode, ')');
    
    // Continuar con la siguiente posición
    this.nextPosition();
  }

    stopReplay(): void {
    if (this.replayInterval) {
      clearTimeout(this.replayInterval);
      this.replayInterval = null;
    }
    
    // Verificar si se está deteniendo mientras está en reproducción (manual)
    // vs detención automática al completar la reproducción
    const wasManuallyStop = this.isReplaying;
    
    this.isReplaying = false;
    this.isPaused = false;
    this.isManuallyPaused = false;
    this.isManuallyStop = wasManuallyStop; // Marcar si fue detenido manualmente
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
    
    console.log('⏹️ Reproducción detenida manualmente');
  }

  completeReplay(): void {
    if (this.replayInterval) {
      clearTimeout(this.replayInterval);
      this.replayInterval = null;
    }
    
    this.isReplaying = false;
    this.isPaused = false;
    this.isManuallyPaused = false;
    this.isManuallyStop = false; // NO marcar como manual ya que se completó automáticamente
    this.currentPositionIndex = 0;
    this.isReplayPopupOpen = false;

    // Remover marcador de reproducción
    if (this.replayMarker) {
      this.replayMarker.setMap(null);
      this.replayMarker = null;
    }

    // Limpiar polilíneas dinámicas cuando se completa la reproducción
    this.dynamicPolylines.forEach(polyline => {
      polyline.setMap(null);
    });
    this.dynamicPolylines = [];
    
    console.log('✅ Reproducción completada automáticamente');
  }

  setReplaySpeed(speed: number): void {
    this.replaySpeed = speed;
    console.log(`⚡ Velocidad de reproducción: ${speed}ms`);
  }

  /**
   * Actualizar posiciones de reproducción con nuevos datos sin reiniciar la reproducción
   */
  private updateReplayPositionsWithNewData(): void {
    if (!this.routeHistory || !this.routeHistory.positions.length) {
      return;
    }

    console.log('🔄 Actualizando posiciones de reproducción con nuevos datos');
    
    // Filtrar posiciones con velocidad 0 y ordenar por timestamp
    const allPositions = [...this.routeHistory.positions]
      .filter(position => position.speed > 0) // Ignorar posiciones con velocidad 0
      .sort((a, b) => new Date(a.fixTime).getTime() - new Date(b.fixTime).getTime());
    
    console.log(`📊 Posiciones filtradas: ${this.routeHistory.positions.length} totales → ${allPositions.length} con movimiento (sin velocidad 0)`);
    
    const previousLength = this.replayPositions.length;
    
    // Siempre actualizar con todas las posiciones ordenadas
    this.replayPositions = allPositions;
    
    if (allPositions.length > previousLength) {
      const newPositionsCount = allPositions.length - previousLength;
      console.log(`📈 Agregando ${newPositionsCount} nuevas posiciones a la reproducción (Total: ${allPositions.length})`);
      
      // Solo reanudar automáticamente si:
      // 1. La reproducción está activa
      // 2. NO está pausada
      // 3. NO fue pausada/detenida manualmente por el usuario
      // 4. Había llegado al final de las posiciones o no hay timeout activo
      if (this.isReplaying && !this.isPaused && !this.isManuallyPaused && !this.isManuallyStop && 
          (!this.replayInterval || this.currentPositionIndex >= previousLength)) {
        console.log('🎬 Reanudando reproducción automáticamente con nuevas posiciones');
        
        // Si no hay timeout activo, iniciar nextPosition inmediatamente
        if (!this.replayInterval) {
          this.nextPosition();
        }
        // Si había llegado al final de las posiciones anteriores, el timeout ya se encargará de continuar
      } else if (this.isPaused || this.isManuallyPaused) {
        console.log('⏸️ Nuevas posiciones llegaron pero la reproducción está pausada manualmente');
      } else if (this.isManuallyStop) {
        console.log('⏹️ Nuevas posiciones llegaron pero la reproducción fue detenida manualmente');
      }
      
      // Si ya no estamos en streaming mode y no hay marcador de fin, crearlo
      if (!this.isStreamingMode && !this.endMarker && allPositions.length > 1) {
        this.createEndMarker(allPositions);
      }
    }
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

  private createEndMarker(allPositions: any[]): void {
    if (!this.map || this.endMarker) return;
    
    // Filtrar posiciones con movimiento para obtener la última real
    const movingPositions = allPositions.filter(pos => pos.speed > 0);
    
    if (movingPositions.length < 2) return;
    
    const google = (window as any).google;
    const endPos = movingPositions[movingPositions.length - 1];
    
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
      this.isReplayPopupOpen = false;
      
      // Configurar función global para cerrar InfoWindow
      (window as any).closeCurrentInfoWindow = () => {
        if (this.infoWindow) {
          this.infoWindow.close();
        }
      };
    });
    
    console.log('🔴 Marcador de fin creado tras completar streaming');
  }

  private updateStopMarkers(): void {
    console.log('🛑 updateStopMarkers called');
    console.log('🛑 Map exists:', !!this.map);
    console.log('🛑 ShowStops enabled:', this.showStops);
    console.log('🛑 Stops data:', this.stops);
    console.log('🛑 Stops length:', this.stops?.length);

    if (!this.map) {
      console.log('🛑 No map available, skipping stop markers');
      return;
    }

    // Limpiar marcadores de paradas existentes
    this.clearStopMarkers();

    // Si showStops está deshabilitado, no crear marcadores
    if (!this.showStops) {
      console.log('🛑 Paradas deshabilitadas por filtro - no se mostrarán marcadores');
      return;
    }

    if (!this.stops || this.stops.length === 0) {
      console.log('🛑 No hay paradas para mostrar - stops array is empty or undefined');
      return;
    }

    console.log(`🛑 Creando ${this.stops.length} marcadores de paradas`);

    const google = (window as any).google;

    this.stops.forEach((stop, index) => {
      // Crear marcador para la parada (más pequeño)
      const stopMarker = new google.maps.Marker({
        position: { lat: stop.latitude, lng: stop.longitude },
        map: this.map,
        title: `Parada ${index + 1} - ${stop.durationText}`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6, // Reducido de 10 a 6 para ser más pequeño
          fillColor: stop.ignitionOff ? '#ff6b35' : '#fbbf24', // Naranja si motor apagado, amarillo si encendido
          fillOpacity: 0.9,
          strokeColor: '#ffffff',
          strokeWeight: 2
        },
        zIndex: 1000 + index // Para que estén por encima de otros marcadores
      });

      // InfoWindow para la parada
      stopMarker.addListener('click', () => {
        const content = this.createStopPopupContent(stop, index + 1);
        this.infoWindow.setContent(content);
        this.infoWindow.open(this.map, stopMarker);
        this.isReplayPopupOpen = false;
        
        // Configurar función global para cerrar InfoWindow desde el botón
        (window as any).closeCurrentInfoWindow = () => {
          if (this.infoWindow) {
            this.infoWindow.close();
          }
        };
      });

      this.stopMarkers.push(stopMarker);
    });

    console.log(`✅ Creados ${this.stopMarkers.length} marcadores de paradas`);
  }

  private clearStopMarkers(): void {
    this.stopMarkers.forEach(marker => {
      if (marker) {
        marker.setMap(null);
      }
    });
    this.stopMarkers = [];
  }

  private createStopPopupContent(stop: any, stopNumber: number): string {
    const startTime = new Date(stop.startTime).toLocaleString('es-ES');
    const endTime = new Date(stop.endTime).toLocaleString('es-ES');
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 300px; padding: 10px; color: #000;">
        <div style="background: ${stop.ignitionOff ? '#ff6b35' : '#fbbf24'}; color: #fff; padding: 8px; margin: -10px -10px 10px -10px; border-radius: 4px 4px 0 0; position: relative;">
          <h3 style="margin: 0; font-size: 16px; display: flex; align-items: center; color: #fff;">
            🛑 Parada #${stopNumber}
          </h3>
          <button onclick="if(window.closeCurrentInfoWindow) window.closeCurrentInfoWindow();" 
                  style="position: absolute; top: 4px; right: 8px; background: rgba(0,0,0,0.2); border: none; color: #fff; font-size: 16px; font-weight: bold; cursor: pointer; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center;" 
                  title="Cerrar">
            ×
          </button>
        </div>
        
        <div style="margin-bottom: 8px; color: #000;">
          <strong>⏱️ Duración:</strong> ${stop.durationText}
        </div>
        
        <div style="margin-bottom: 8px; color: #000;">
          <strong>🕐 Inicio:</strong><br/>
          <span style="font-size: 12px; color: #333;">${startTime}</span>
        </div>
        
        <div style="margin-bottom: 8px; color: #000;">
          <strong>🕑 Fin:</strong><br/>
          <span style="font-size: 12px; color: #333;">${endTime}</span>
        </div>
        
        <div style="margin-bottom: 8px; color: #000;">
          <strong>🔧 Motor:</strong> ${stop.ignitionOff ? '🔴 Apagado' : '🟢 Encendido'}
        </div>
        
        <div style="margin-bottom: 8px; color: #000;">
          <strong>📍 Posiciones:</strong> ${stop.positionCount}
        </div>
        
        ${stop.address !== 'Dirección no disponible' ? `
          <div style="margin-bottom: 8px; color: #000;">
            <strong>📍 Dirección:</strong><br/>
            <span style="font-size: 12px; color: #333;">${stop.address}</span>
          </div>
        ` : ''}
        
        <div style="font-size: 10px; color: #666; border-top: 1px solid #eee; padding-top: 6px; margin-top: 8px;">
          Lat: ${stop.latitude.toFixed(6)}, Lng: ${stop.longitude.toFixed(6)}
        </div>
      </div>
    `;
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
    if (!this.isReplaying || this.isPaused) {
      if (this.isPaused) {
        console.log('⏸️ nextPosition cancelado: reproducción pausada');
      }
      return;
    }

    // Si hemos llegado al final de las posiciones actuales
    if (this.currentPositionIndex >= this.replayPositions.length) {
      // Verificar si estamos en modo streaming (aún se están cargando más datos)
      if (this.isStreamingMode) {
        console.log('⏳ Esperando más datos del streaming...');
        // Esperar un poco antes de verificar nuevamente si hay más posiciones
        this.replayInterval = setTimeout(() => {
          // Verificar nuevamente el estado antes de continuar
          if (!this.isReplaying || this.isPaused) {
            console.log('🔄 Cancelando espera de streaming debido a pausa/stop');
            return;
          }
          this.nextPosition();
        }, 1000); // Esperar 1 segundo antes de verificar nuevamente
        return;
      } else {
        console.log('✅ Reproducción completada automáticamente');
        this.completeReplay();
        return;
      }
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
      // Verificar estado antes de continuar
      if (!this.isReplaying || this.isPaused) {
        console.log('🔄 Cancelando timeout normal debido a pausa/stop');
        return;
      }
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