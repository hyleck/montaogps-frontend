import { Component, OnInit, OnDestroy, Input, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { SystemService, SystemSettings } from '../../../core/services/system.service';
import { TargetsService } from '../../../core/services/targets.service';
import { RouteHistoryResponse } from '../../../core/interfaces';

import { MapUtils } from '../../helpers/map.helper';

export interface ReportsMapInfoPanelItem {
  label: string;
  value: string;
  color?: string;
}

export interface ReportsMapInfoPanelData {
  title: string;
  items: ReportsMapInfoPanelItem[];
}

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
  @Input() minStopDuration: number = 20; // Duración mínima en minutos para mostrar paradas
  @Input() showRouteDetails: boolean = true;
  @Input() autoStartReplay: boolean = false;
  @Input() isStreamingMode: boolean = false;
  @Input() targetProtocol: any = null;
  @Output() infoPanelChange = new EventEmitter<ReportsMapInfoPanelData | null>();
  @Output() calculatedStopsChange = new EventEmitter<any[]>();

  // Configuración de zona horaria para los labels de marcadores
  // NOTA: Este valor se usa solo como FALLBACK si el protocolo no tiene utcOffset configurado
  // El sistema prioriza: 1º targetProtocol.utcOffset, 2º esta variable por defecto
  // Ejemplos de uso:
  // GMT-6 (CST): hoursToSubtract = 6
  // GMT-5 (EST): hoursToSubtract = 5  
  // GMT-3 (ART): hoursToSubtract = 3
  // GMT+1 (CET): hoursToSubtract = -1 (para sumar una hora)
  private hoursToSubtract: number = 8; // Valor por defecto mantenido por el usuario

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
  stopMarkers: any[] = []; // Marcadores de paradas del backend
  calculatedStopMarkers: any[] = []; // Marcadores de paradas calculadas localmente
  calculatedStops: any[] = []; // Paradas detectadas a partir de posiciones con velocidad 0
  
  // Estado para actualización incremental de paradas
  private lastProcessedPositionIndex: number = -1;
  private currentActiveStop: any = null; // Parada en curso de ser detectada
  
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
    this.initializeMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.map && (changes['routeHistory'] || changes['selectedTarget'])) {

      
      // Si ya está reproduciendo, solo actualizar posiciones
      if (this.isReplaying && changes['routeHistory'] && this.routeHistory) {
    
        this.updateReplayPositionsWithNewData();
      } 
      // Si había historial previo y llegan datos nuevos, solo actualizar posiciones sin reiniciar mapa
      else if (changes['routeHistory'] && this.routeHistory && this.replayPositions.length > 0) {
        this.updateReplayPositionsWithNewData();
      }
      // Solo recrear el mapa completamente si es la primera vez o cambió el target
      else {
        this.updateMapWithRouteHistory();
      }
    }

    // Detectar cambios en las paradas, en el flag showStops, o en la duración mínima
    if (changes['stops'] || changes['showStops'] || changes['minStopDuration']) {
      if (changes['stops']) {
      }
      if (changes['showStops']) {
      }
      if (changes['minStopDuration']) {
      }
      
      if (this.map) {
        this.updateStopMarkers(); // Paradas del backend (ya no se usan)
        
        // Si cambió la duración mínima y tenemos posiciones, recalcular paradas
        if (changes['minStopDuration'] && this.routeHistory && this.routeHistory.positions && this.routeHistory.positions.length > 0) {
          this.detectStopsFromStaticPositions(this.routeHistory.positions);
        }
        
        this.updateCalculatedStopMarkers(); // Paradas calculadas automáticamente ✅
      } else {
        // Reintentar cuando el mapa esté listo
        setTimeout(() => {
          if (this.map) {
            this.updateStopMarkers(); // Paradas del backend (ya no se usan)
            
            // Si cambió la duración mínima y tenemos posiciones, recalcular paradas
            if (changes['minStopDuration'] && this.routeHistory && this.routeHistory.positions && this.routeHistory.positions.length > 0) {
              this.detectStopsFromStaticPositions(this.routeHistory.positions);
            }
            
            this.updateCalculatedStopMarkers(); // Paradas calculadas automáticamente ✅
          }
        }, 1000);
      }
    }
    
    // Detectar cambios en el modo streaming para logging y crear marcador de fin
    if (changes['isStreamingMode']) {
      
      // Si cambió de streaming mode a normal y tenemos posiciones, crear marcador de fin
      if (!this.isStreamingMode && changes['isStreamingMode'].previousValue === true && 
          this.routeHistory && this.routeHistory.positions.length > 1) {
        // createEndMarker removido por solicitud del usuario
      }
    }
    
    // Detectar cuando se solicita auto-inicio de reproducción
    if (changes['autoStartReplay']) {
    }
    
    if (this.map && changes['autoStartReplay'] && this.autoStartReplay && 
        this.routeHistory && this.routeHistory.positions.length > 0 && !this.isReplaying &&
        !this.isManuallyPaused && !this.isManuallyStop) {
      
      // Pequeña pausa para asegurar que el mapa esté completamente actualizado
      setTimeout(() => {
        this.startReplay();
      }, 300);
    } else if (this.autoStartReplay && (this.isManuallyPaused || this.isManuallyStop)) {
    }
    
    // Detectar cambios en el protocolo del target
    if (changes['targetProtocol']) {
      const previous = changes['targetProtocol'].previousValue;
      const current = changes['targetProtocol'].currentValue;
      
    
      
      if (current && current.utcOffset !== undefined) {
    
      }
    }

    if (
      changes['routeHistory'] &&
      (!this.routeHistory ||
        !this.routeHistory.positions ||
        this.routeHistory.positions.length === 0)
    ) {
      this.emitInfoPanelData(null);
    }
  }

  ngOnDestroy(): void {
    
    // Limpiar listener del botón de cerrar
    if (this.popupCloseListener) {
      document.removeEventListener('click', this.popupCloseListener);
      this.popupCloseListener = null;
    }
    
    this.destroyMap();
  }

  private initializeMap(): void {
    
    this.systemService.getAll().subscribe((systems: SystemSettings[]) => {
      const config = MapUtils.getApiConfig(systems, this.provider);
      if (!config) {
        console.error('❌ No Google Maps config found');
        return;
      }

      this.apiKey = config.key;
      this.apiUrl = config.url;
     

      MapUtils.loadMapScript(this.provider, this.apiKey, this.apiUrl)
        .then(() => {
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

    
    // Si ya hay datos de ruta, mostrarlos
    if (this.routeHistory) {
      this.updateMapWithRouteHistory();
    }
  }

  private updateMapWithRouteHistory(): void {
    if (!this.map || !this.routeHistory || !this.routeHistory.positions.length) {
      return;
    }

  
    // Limpiar elementos existentes
    this.clearMapElements();

    const google = (window as any).google;
    
    // Filtrar posiciones con velocidad 0 para mostrar solo el recorrido real
    const movingPositions = this.routeHistory.positions.filter(pos => pos.speed > 0);
    const allPositions = this.routeHistory.positions;
    

    // Reinicializar estado incremental para nuevo reporte
    this.lastProcessedPositionIndex = -1;
    this.currentActiveStop = null;
    
    // Detectar paradas a partir de posiciones con velocidad 0
    this.detectStopsFromStaticPositions(allPositions);

    // Verificar si hay posiciones con movimiento para mostrar
    if (movingPositions.length === 0) {
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

    // NO crear marcadores de inicio - removido por solicitud del usuario

    // NO crear marcadores de fin - removido por solicitud del usuario

    // Marcadores intermedios (opcional, solo cada N posiciones para no saturar) - usar posiciones con movimiento
    if (this.showRouteDetails && movingPositions.length > 2) {
      const step = Math.max(1, Math.floor(movingPositions.length / 10)); // Máximo 10 marcadores intermedios
      
      for (let i = step; i < movingPositions.length - 1; i += step) {
        const pos = movingPositions[i];
        const marker = new google.maps.Marker({
          position: { lat: pos.latitude, lng: pos.longitude },
          map: this.map,
          title: 'Punto del recorrido',
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
          const content = this.createPositionPopupContent(pos, 'Punto del recorrido', '#3b82f6');
          this.infoWindow.setContent(content);
          this.infoWindow.open(this.map, marker);
          this.isReplayPopupOpen = false; // Marcar que NO es el popup de reproducción
        });

        this.routeMarkers.push(marker);
      }
    }

    // Ajustar la vista del mapa para mostrar toda la ruta
    this.fitMapToRoute(routePath);



    // Actualizar marcadores de paradas si hay datos y están habilitadas
    if (this.showStops && this.stops && this.stops.length > 0) {
      this.updateStopMarkers();
    } else if (!this.showStops) {
      this.clearStopMarkers(); // Asegurar que se limpien si están deshabilitadas
    } else {
    }

    // Solo iniciar reproducción automáticamente si no fue pausada/detenida manualmente
    if (!this.isManuallyPaused && !this.isManuallyStop) {
      setTimeout(() => {
        this.startReplay();
      }, 1000);
    } else {
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
    const date = this.formatDateForPopup(position.fixTime);
    const speed = Math.round(position.speed * 1.852); // Convertir a km/h
    this.updateInfoPanelFromPosition(position, title);
    
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
    // Detener reproducción sin limpiar polilíneas (stopReplay ya no las limpia)
    if (this.replayInterval) {
      clearTimeout(this.replayInterval);
      this.replayInterval = null;
    }
    
    this.isReplaying = false;
    this.isPaused = false;
    this.isManuallyPaused = false;
    this.isManuallyStop = false;
    this.currentPositionIndex = 0;
    this.isReplayPopupOpen = false;

    // Remover marcador de reproducción
    if (this.replayMarker) {
      this.replayMarker.setMap(null);
      this.replayMarker = null;
    }

    // Limpiar polilínea principal
    if (this.routePolyline) {
      this.routePolyline.setMap(null);
      this.routePolyline = null;
    }

    // Limpiar polilíneas dinámicas (solo cuando se carga nuevo reporte)
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

    // Limpiar marcadores de paradas del backend
    this.clearStopMarkers();

    // Limpiar marcadores de paradas calculadas
    this.clearCalculatedStopMarkers();

    // Reinicializar estado incremental
    this.lastProcessedPositionIndex = -1;
    this.currentActiveStop = null;

    // Cerrar InfoWindow
    if (this.infoWindow) {
      this.infoWindow.close();
    }
  }

  private destroyMap(): void {
    
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
    }
  }

  // Métodos de control de reproducción
  startReplay(): void {
    if (!this.routeHistory || !this.routeHistory.positions.length) {

      return;
    }


    
    // Limpiar polilíneas dinámicas de reproducciones anteriores
    this.dynamicPolylines.forEach(polyline => {
      polyline.setMap(null);
    });
    this.dynamicPolylines = [];

    // Preparar datos de reproducción - incluir paradas como puntos especiales
    const movingPositions = [...this.routeHistory.positions]
      .filter(position => position.speed > 0)
      .sort((a, b) => new Date(a.fixTime).getTime() - new Date(b.fixTime).getTime());
    
    // Crear secuencia combinada: movimiento + paradas en orden cronológico
    const combinedSequence = this.createReplaySequenceWithStops(movingPositions);
    
    this.replayPositions = combinedSequence;
    
    
    // Verificar si hay suficientes posiciones para reproducir
    if (combinedSequence.length === 0) {
      // Mostrar mensaje al usuario si es posible
      if ((window as any).showToast) {
        (window as any).showToast('warning', 'Sin movimiento', 'Todas las posiciones tienen velocidad 0, no hay recorrido para reproducir');
      }
      return;
    }
    
    if (combinedSequence.length < 2) {
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
      return;
    }
    
    if (this.replayInterval) {
      clearTimeout(this.replayInterval);
      this.replayInterval = null;
    }
    
    this.isPaused = true;
    this.isManuallyPaused = true; // Marcar que fue pausado manualmente
  }

  resumeReplay(): void {
    if (!this.isReplaying) {
      return;
    }
    
    if (!this.isPaused) {
      return;
    }
    
    this.isPaused = false;
    this.isManuallyPaused = false; // Limpiar el estado manual al reanudar
    
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

    // MANTENER marcador de reproducción en la posición donde se detuvo para análisis
    // Cambiar estilo del marcador para indicar que se detuvo manualmente
    this.setReplayMarkerAsStopped();

    // NO limpiar polilíneas dinámicas para permitir análisis del recorrido
    // Las polilíneas dinámicas quedan visibles para analizar el recorrido
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

    // MANTENER marcador de reproducción en la última posición para análisis
    // Cambiar estilo del marcador para indicar que es la posición final
    this.setReplayMarkerAsFinal();

    // NO limpiar polilíneas dinámicas para permitir análisis del recorrido completo
    // Las polilíneas dinámicas quedan visibles para analizar el recorrido
  }

  setReplaySpeed(speed: number): void {
    this.replaySpeed = speed;
  }

  /**
   * Actualizar posiciones de reproducción con nuevos datos sin reiniciar la reproducción
   */
  private updateReplayPositionsWithNewData(): void {
    if (!this.routeHistory || !this.routeHistory.positions.length) {
      return;
    }


    
    // Usar actualización incremental de paradas (más eficiente)
    const previousStopsCount = this.calculatedStops.length;
    this.updateStopsIncrementally(this.routeHistory.positions);
    
    const newStopsCount = this.calculatedStops.length;
    if (newStopsCount !== previousStopsCount) {
  
    }
    
    // Filtrar posiciones con velocidad 0 y ordenar por timestamp
    const allPositions = [...this.routeHistory.positions]
      .filter(position => position.speed > 0) // Ignorar posiciones con velocidad 0
      .sort((a, b) => new Date(a.fixTime).getTime() - new Date(b.fixTime).getTime());
    

    
    const previousLength = this.replayPositions.length;
    
    // Crear secuencia combinada: movimiento + paradas en orden cronológico
    const combinedSequence = this.createReplaySequenceWithStops(allPositions);
    
    // Siempre actualizar con la secuencia combinada ordenada
    this.replayPositions = combinedSequence;
    
    if (combinedSequence.length > previousLength) {
      const newPositionsCount = combinedSequence.length - previousLength;
      
      
      // Solo reanudar automáticamente si:
      // 1. La reproducción está activa
      // 2. NO está pausada
      // 3. NO fue pausada/detenida manualmente por el usuario
      // 4. Había llegado al final de las posiciones o no hay timeout activo
      if (this.isReplaying && !this.isPaused && !this.isManuallyPaused && !this.isManuallyStop && 
          (!this.replayInterval || this.currentPositionIndex >= previousLength)) {
        
        // Si no hay timeout activo, iniciar nextPosition inmediatamente
        if (!this.replayInterval) {
          this.nextPosition();
        }
        // Si había llegado al final de las posiciones anteriores, el timeout ya se encargará de continuar
      }
      
      // No crear marcadores de fin - removido por solicitud del usuario
      // createEndMarker removido
    }
  }

  onSpeedChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const speed = parseInt(target.value, 10);
    this.setReplaySpeed(speed);
  }

  /**
   * Ajustar fecha usando el utcOffset del protocolo del target o valor por defecto
   */
  private adjustDateForDisplay(date: Date): Date {
    const adjustedDate = new Date(date);
    
    // Usar utcOffset del protocolo si está disponible, sino usar hoursToSubtract por defecto
    let offsetToUse = this.hoursToSubtract; // Valor por defecto
    let offsetSource = 'variable por defecto';
    
    if (this.targetProtocol && this.targetProtocol.utcOffset !== undefined && this.targetProtocol.utcOffset !== null) {
      offsetToUse = this.targetProtocol.utcOffset;
      offsetSource = `protocolo ${this.targetProtocol.name}`;
    }
    
    adjustedDate.setHours(adjustedDate.getHours() - offsetToUse);
    
    console.log(`🕐 Ajuste de hora aplicado: -${offsetToUse} horas`, {
      originalUTC: date.toISOString(),
      adjustedLocal: adjustedDate.toLocaleString('es-ES', { hour12: true }),
      offsetApplied: offsetToUse,
      offsetSource: offsetSource,
      protocolInfo: this.targetProtocol ? {
        protocolName: this.targetProtocol.name,
        protocolUtcOffset: this.targetProtocol.utcOffset
      } : 'sin protocolo'
    });
    
    return adjustedDate;
  }

  /**
   * Formatear fecha para mostrar en popups con formato 12 horas y ajuste de zona horaria
   */
  private formatDateForPopup(dateString: string): string {
    const originalDate = new Date(dateString);
    const adjustedDate = this.adjustDateForDisplay(originalDate);
    
    return adjustedDate.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  }

  /**
   * Configurar la cantidad de horas a restar para mostrar en zona horaria local
   * NOTA: Solo se usa si no hay protocolo con utcOffset configurado
   * @param hours Número de horas a restar (puede ser positivo o negativo)
   */
  public setTimezoneOffset(hours: number): void {
    this.hoursToSubtract = hours;
    console.log(`🌍 Configuración manual de zona horaria actualizada: -${hours} horas`, {
      note: 'Se usará solo si el protocolo no tiene utcOffset configurado',
      protocolOverride: this.targetProtocol?.utcOffset !== undefined ? 
        `Protocolo tiene utcOffset: ${this.targetProtocol.utcOffset}` : 
        'Sin protocolo o sin utcOffset'
    });
  }

  /**
   * Obtener la configuración actual de zona horaria
   * @returns Número de horas que se están restando
   */
  public getTimezoneOffset(): number {
    return this.hoursToSubtract;
  }

  /**
   * Cambiar el estilo del marcador de reproducción para indicar que es la posición final
   */
  private async setReplayMarkerAsFinal(): Promise<void> {
    if (!this.replayMarker) return;

    const google = (window as any).google;
    const markerType = MapUtils.getMapMarkerType();
    
    // Obtener el course de la última posición para mantener la orientación del carro
    const lastPos = this.replayPositions[this.replayPositions.length - 1];
    const course = lastPos?.course || 0;

    if (markerType === 'vehicle') {
      const spriteIconUrl = await MapUtils.getCarSpriteIconUrl(course, 48);
      this.replayMarker.setIcon({
        url: spriteIconUrl,
        scaledSize: new google.maps.Size(48, 68),
        anchor: new google.maps.Point(24, 50)
      });
    } else {
      this.replayMarker.setIcon({
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#28a745',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
        anchor: new google.maps.Point(0, 0)
      });
    }
    this.replayMarker.setOpacity(0.7);
    
    // Actualizar el título
    this.replayMarker.setTitle('Posición final del recorrido');
    
    // Limpiar listeners anteriores y agregar nuevo listener para mostrar contenido de posición final
    google.maps.event.clearListeners(this.replayMarker, 'click');
    this.replayMarker.addListener('click', () => {
      const currentPos = this.replayPositions[this.replayPositions.length - 1];
      if (currentPos) {
        const content = this.createFinalPositionPopupContent(currentPos);
        this.infoWindow.setContent(content);
        this.infoWindow.open(this.map, this.replayMarker);
        this.isReplayPopupOpen = false; // No es un popup de reproducción activa
      }
    });
    
  }

  /**
   * Cambiar el estilo del marcador de reproducción para indicar que se detuvo manualmente
   */
  private async setReplayMarkerAsStopped(): Promise<void> {
    if (!this.replayMarker) return;

    const google = (window as any).google;
    const markerType = MapUtils.getMapMarkerType();
    
    // Obtener el course de la posición actual para mantener la orientación del carro
    const actualIndex = Math.max(0, this.currentPositionIndex - 1);
    const currentPos = this.replayPositions[actualIndex];
    const course = currentPos?.course || 0;

    if (markerType === 'vehicle') {
      const spriteIconUrl = await MapUtils.getCarSpriteIconUrl(course, 48);
      this.replayMarker.setIcon({
        url: spriteIconUrl,
        scaledSize: new google.maps.Size(48, 68),
        anchor: new google.maps.Point(24, 50)
      });
    } else {
      this.replayMarker.setIcon({
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#dc3545',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
        anchor: new google.maps.Point(0, 0)
      });
    }
    this.replayMarker.setOpacity(0.6);
    
    // Actualizar el título
    this.replayMarker.setTitle('Posición donde se detuvo la reproducción');
    
    // Limpiar listeners anteriores y agregar nuevo listener para mostrar contenido de posición detenida
    google.maps.event.clearListeners(this.replayMarker, 'click');
    this.replayMarker.addListener('click', () => {
      const actualIdx = Math.max(0, this.currentPositionIndex - 1);
      const pos = this.replayPositions[actualIdx];
      if (pos) {
        const content = this.createStoppedPositionPopupContent(pos);
        this.infoWindow.setContent(content);
        this.infoWindow.open(this.map, this.replayMarker);
        this.isReplayPopupOpen = false; // No es un popup de reproducción activa
      }
    });
    
  }

  /**
   * Crear contenido del popup para la posición final del recorrido
   */
  private createFinalPositionPopupContent(position: any): string {
    const date = this.formatDateForPopup(position.fixTime);
    const speed = Math.round(position.speed * 1.852); // Convertir a km/h
    this.updateInfoPanelFromPosition(position, '🏁 Posición Final del Recorrido', {
      dateLabel: 'Fecha y hora final',
      speedLabel: 'Velocidad final',
    });
    
    return `
      <div class="reports-popup">
        <div class="reports-popup-header" style="background: #28a745;">
          <div class="reports-popup-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9 12l2 2 4-4"></path>
            </svg>
          </div>
          <h3 class="reports-popup-title">🏁 Posición Final del Recorrido</h3>
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
              <span class="reports-info-label">Fecha y hora final</span>
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
              <span class="reports-info-label">Velocidad final</span>
              <span class="reports-info-value">${speed} km/h</span>
            </div>
          </div>
          <div class="reports-info-item">
            <div class="reports-info-icon">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            </div>
            <div class="reports-info-content">
              <span class="reports-info-label">Coordenadas</span>
              <span class="reports-info-value">${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Crear contenido del popup para la posición donde se detuvo la reproducción
   */
  private createStoppedPositionPopupContent(position: any): string {
    const date = this.formatDateForPopup(position.fixTime);
    const speed = Math.round(position.speed * 1.852); // Convertir a km/h
    this.updateInfoPanelFromPosition(position, '⏹️ Reproducción Detenida', {
      dateLabel: 'Fecha y hora de detención',
    });
    
    return `
      <div class="reports-popup">
        <div class="reports-popup-header" style="background: #dc3545;">
          <div class="reports-popup-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          </div>
          <h3 class="reports-popup-title">⏹️ Reproducción Detenida</h3>
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
              <span class="reports-info-label">Fecha y hora de detención</span>
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
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            </div>
            <div class="reports-info-content">
              <span class="reports-info-label">Coordenadas</span>
              <span class="reports-info-value">${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private async createReplayMarker(): Promise<void> {
    if (!this.map || !this.replayPositions.length) return;

    // Limpiar marcador de reproducción anterior si existe
    if (this.replayMarker) {
      this.replayMarker.setMap(null);
      this.replayMarker = null;
    }

    const google = (window as any).google;
    const firstPosition = this.replayPositions[0];
    const course = firstPosition.course || 0;
    const markerType = MapUtils.getMapMarkerType();

    let iconConfig: any;
    if (markerType === 'vehicle') {
      const spriteIconUrl = await MapUtils.getCarSpriteIconUrl(course, 48);
      iconConfig = {
        url: spriteIconUrl,
        scaledSize: new google.maps.Size(48, 68),
        anchor: new google.maps.Point(24, 50)
      };
    } else {
      iconConfig = {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#3b82f6',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
        anchor: new google.maps.Point(0, 0)
      };
    }

    this.replayMarker = new google.maps.Marker({
      position: { lat: firstPosition.latitude, lng: firstPosition.longitude },
      map: this.map,
      title: 'Reproducción del recorrido',
      icon: iconConfig,
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

  // Método createEndMarker removido - no se crean marcadores de fin por solicitud del usuario

  private updateStopMarkers(): void {

    if (!this.map) {
      return;
    }

    // Limpiar marcadores de paradas del backend (ya no se usan)
    this.clearStopMarkers();
    
    // Las paradas calculadas automáticamente se manejan en updateCalculatedStopMarkers()
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
    const startTime = this.formatDateForPopup(stop.startTime);
    const endTime = this.formatDateForPopup(stop.endTime);
    this.updateInfoPanelForStop(stop, `Parada #${stopNumber}`);
    
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
      this.map.panTo(position);
    }
  }

  private nextPosition(): void {
    if (!this.isReplaying || this.isPaused) {
      if (this.isPaused) {
      }
      return;
    }

    // Si hemos llegado al final de las posiciones actuales
    if (this.currentPositionIndex >= this.replayPositions.length) {
      // Verificar si estamos en modo streaming (aún se están cargando más datos)
      if (this.isStreamingMode) {
        // Esperar un poco antes de verificar nuevamente si hay más posiciones
        this.replayInterval = setTimeout(() => {
          // Verificar nuevamente el estado antes de continuar
          if (!this.isReplaying || this.isPaused) {
            return;
          }
          this.nextPosition();
        }, 1000); // Esperar 1 segundo antes de verificar nuevamente
        return;
      } else {
        this.completeReplay();
        return;
      }
    }

    const currentPosition = this.replayPositions[this.currentPositionIndex];

    if (currentPosition?.type === 'stop' && currentPosition.stopData) {
      this.updateInfoPanelForStop(
        currentPosition.stopData,
        `Parada ${currentPosition.stopData.stopNumber}`,
        [
          {
            label: currentPosition.isStopStart
              ? 'Inicio de parada'
              : 'Fin de parada',
            value: this.formatDateForPopup(currentPosition.fixTime),
          },
        ],
      );
    } else {
      this.updateInfoPanelFromPosition(
        currentPosition,
        'Recorrido',
      );
    }
    
    // Mover marcador a la nueva posición
    if (this.replayMarker) {
      const newLatLng = { lat: currentPosition.latitude, lng: currentPosition.longitude };
      this.replayMarker.setPosition(newLatLng);
      
      // Cambiar estilo del marcador según el tipo de posición
      this.updateReplayMarkerStyle(currentPosition);
      
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

      // Determinar color basado en dbfrom de la posición actual
      const strokeColor = this.getMarkerColorByDbfrom(currentPosition.dbfrom);
      
      const segmentPolyline = new google.maps.Polyline({
        path: segmentPath,
        geodesic: true,
        strokeColor: strokeColor, // Color dinámico basado en dbfrom
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
        return;
      }
      this.nextPosition();
    }, this.replaySpeed);
  }

  /**
   * Actualizar el estilo del marcador de replay según el tipo de posición
   */
  private async updateReplayMarkerStyle(position: any): Promise<void> {
    if (!this.replayMarker) return;

    const google = (window as any).google;
    
    if (position.type === 'stop') {
      // Estilo para paradas: púrpura para distinguir
      this.replayMarker.setIcon({
        path: google.maps.SymbolPath.CIRCLE,
        scale: 14,
        fillColor: position.isStopStart ? '#8b5cf6' : '#6d28d9', // Púrpura más oscuro para fin de parada
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3,
        anchor: new google.maps.Point(0, 0)
      });
      this.replayMarker.setOpacity(1);
      
      this.replayMarker.setTitle(position.isStopStart ? 
        `Inicio de parada - ${position.stopData.durationText}` : 
        `Fin de parada - ${position.stopData.durationText}`
      );
    } else {
      // Actualizar marcador basado en la preferencia del usuario
      const course = position.course || 0;
      const markerType = MapUtils.getMapMarkerType();

      if (markerType === 'vehicle') {
        const spriteIconUrl = await MapUtils.getCarSpriteIconUrl(course, 48);
        this.replayMarker.setIcon({
          url: spriteIconUrl,
          scaledSize: new google.maps.Size(48, 68),
          anchor: new google.maps.Point(24, 50)
        });
      } else {
        this.replayMarker.setIcon({
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#3b82f6',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          anchor: new google.maps.Point(0, 0)
        });
      }
      this.replayMarker.setOpacity(1);
      
      this.replayMarker.setTitle(`Reproduciendo posición ${this.currentPositionIndex + 1}`);
    }
  }

  /**
   * Obtener color del marcador basado en el valor de dbfrom
   */
  private getMarkerColorByDbfrom(dbfrom: string): string {
    if (dbfrom === 'mongodb') {
      return '#10b981'; // Verde para MongoDB
    } else {
      return '#22c55e'; // Verde diferente para otros orígenes
    }
  }

  private createReplayPopupContent(position: any, positionNumber: number): string {
    if (position.type === 'stop') {
      // Contenido especial para paradas
      return this.createStopReplayPopupContent(position, positionNumber);
    } else {
      // Contenido normal para movimiento
      return this.createMovementReplayPopupContent(position, positionNumber);
    }
  }

  private createMovementReplayPopupContent(position: any, positionNumber: number): string {
    const date = this.formatDateForPopup(position.fixTime);
    const speed = Math.round(position.speed * 1.852); // Convertir a km/h
    this.updateInfoPanelFromPosition(position, 'Recorrido');
    
    return `
      <div class="reports-popup">
        <div class="reports-popup-header">
          <div class="reports-popup-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <polygon points="5,3 19,12 5,21"></polygon>
            </svg>
          </div>
          <h3 class="reports-popup-title">🚗 Reproduciendo recorrido</h3>
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

  private createStopReplayPopupContent(position: any, positionNumber: number): string {
    const date = this.formatDateForPopup(position.fixTime);
    const stopData = position.stopData;
    const isStart = position.isStopStart;
    
    const startTime = this.formatDateForPopup(stopData.startTime);
    const endTime = this.formatDateForPopup(stopData.endTime);
    this.updateInfoPanelForStop(
      stopData,
      `${isStart ? 'Inicio' : 'Fin'} de Parada ${stopData.stopNumber}`,
      [
        {
          label: isStart ? 'Inicio de parada' : 'Fin de parada',
          value: date,
        },
      ],
    );
    
    return `
      <div class="reports-popup">
        <div class="reports-popup-header" style="background: ${isStart ? '#8b5cf6' : '#6d28d9'};">
          <div class="reports-popup-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <rect x="6" y="4" width="4" height="16"></rect>
              <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
          </div>
          <h3 class="reports-popup-title">
            ${isStart ? '🛑 Inicio de Parada' : '✅ Fin de Parada'} ${stopData.stopNumber}
          </h3>
        </div>
        <div class="reports-popup-content">
          <div class="reports-info-item">
            <div class="reports-info-icon">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12,6 12,12 16,14"></polyline>
              </svg>
            </div>
            <div class="reports-info-content">
              <span class="reports-info-label">${isStart ? 'Inicio' : 'Fin'} de parada</span>
              <span class="reports-info-value">${date}</span>
            </div>
          </div>
          <div class="reports-info-item">
            <div class="reports-info-icon">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M12 1v6m0 6v6"></path>
                <path d="m21 12-6-6-6 6-6-6"></path>
              </svg>
            </div>
            <div class="reports-info-content">
              <span class="reports-info-label">Duración total</span>
              <span class="reports-info-value">${stopData.durationText}</span>
            </div>
          </div>
        </div>
        <div style="background: #f3f4f6; padding: 8px; margin: 10px -10px -10px -10px; border-radius: 0 0 4px 4px; font-size: 11px; color: #666;">
          <strong>Rango de parada:</strong><br>
          📅 ${startTime}<br>
          📅 ${endTime}<br>
          📊 ${stopData.positions.length} posiciones detectadas
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

  getProgressBarColor(): string {
    // Obtener la posición actual para determinar el color
    if (!this.replayPositions.length || this.currentPositionIndex <= 0) {
      return '#22c55e'; // Verde diferente por defecto
    }

    const currentPosition = this.replayPositions[this.currentPositionIndex - 1];
    
    // Verificar si dbfrom es 'mongodb'
    if (currentPosition && currentPosition.dbfrom === 'mongodb') {
      return '#10b981'; // Verde para MongoDB
    } else {
      return '#22c55e'; // Verde diferente para otros orígenes
    }
  }

  getCurrentPositionInfo(): any {
    if (!this.isReplaying || this.currentPositionIndex <= 0) return null;
    return this.replayPositions[this.currentPositionIndex - 1];
  }

  /**
   * Crear secuencia de reproducción que incluye movimientos y paradas en orden cronológico
   */
  private createReplaySequenceWithStops(movingPositions: any[]): any[] {
    const sequence: any[] = [];
    
    if (!movingPositions || movingPositions.length === 0) {
      return sequence;
    }

    // Si las paradas están deshabilitadas por filtro, devolver solo posiciones de movimiento
    if (!this.showStops) {
      return movingPositions.map(pos => ({ ...pos, type: 'movement' }));
    }

    // Si no hay paradas calculadas, devolver solo las posiciones de movimiento
    if (!this.calculatedStops || this.calculatedStops.length === 0) {
      return movingPositions.map(pos => ({ ...pos, type: 'movement' }));
    }

    // Combinar posiciones de movimiento con paradas en orden cronológico
    let movingIndex = 0;
    let stopIndex = 0;

    while (movingIndex < movingPositions.length || stopIndex < this.calculatedStops.length) {
      const currentMoving = movingPositions[movingIndex];
      const currentStop = this.calculatedStops[stopIndex];

      // Si ya no hay más movimientos, agregar paradas restantes
      if (!currentMoving && currentStop) {
        sequence.push({
          ...currentStop.startPosition,
          type: 'stop',
          stopData: currentStop,
          isStopStart: true
        });
        sequence.push({
          ...currentStop.endPosition,
          type: 'stop',
          stopData: currentStop,
          isStopEnd: true
        });
        stopIndex++;
        continue;
      }

      // Si ya no hay más paradas, agregar movimientos restantes
      if (!currentStop && currentMoving) {
        sequence.push({ ...currentMoving, type: 'movement' });
        movingIndex++;
        continue;
      }

      // Comparar timestamps para decidir qué agregar primero
      const movingTime = new Date(currentMoving.fixTime).getTime();
      const stopStartTime = new Date(currentStop.startTime).getTime();

      if (movingTime <= stopStartTime) {
        // Agregar posición de movimiento
        sequence.push({ ...currentMoving, type: 'movement' });
        movingIndex++;
      } else {
        // Agregar parada (inicio y fin)
        sequence.push({
          ...currentStop.startPosition,
          type: 'stop',
          stopData: currentStop,
          isStopStart: true
        });
        sequence.push({
          ...currentStop.endPosition,
          type: 'stop',
          stopData: currentStop,
          isStopEnd: true
        });
        stopIndex++;
      }
    }

    
    // Asegurar que la reproducción siempre comience con una posición de movimiento
    // Filtrar las paradas que aparezcan al inicio de la secuencia
    while (sequence.length > 0 && sequence[0].type === 'stop') {
      sequence.shift(); // Remover el primer elemento si es una parada
    }
    
    if (sequence.length > 0) {
    }
    
    return sequence;
  }

  /**
   * Actualizar paradas de forma incremental procesando solo nuevas posiciones
   */
  private updateStopsIncrementally(allPositions: any[]): void {
    if (!allPositions || allPositions.length === 0) {
      return;
    }

    // Ordenar posiciones por timestamp
    const sortedPositions = [...allPositions].sort((a, b) => 
      new Date(a.fixTime).getTime() - new Date(b.fixTime).getTime()
    );

    const MIN_STOP_DURATION_MS = this.minStopDuration * 60000;
    const MAX_DISTANCE_METERS = 50;

    // Procesar solo posiciones nuevas desde la última vez
    const startIndex = Math.max(0, this.lastProcessedPositionIndex + 1);
    const newPositions = sortedPositions.slice(startIndex);

    if (newPositions.length === 0) {
      return;
    }


    let stopsUpdated = false;

    for (let i = 0; i < newPositions.length; i++) {
      const position = newPositions[i];
      const hasMovement = position.speed > 0;

      if (!hasMovement) {
        // Posición sin movimiento (velocidad 0)
        if (!this.currentActiveStop) {
          // Inicio de una nueva parada
          this.currentActiveStop = {
            startPosition: position,
            endPosition: position,
            startTime: position.fixTime,
            endTime: position.fixTime,
            latitude: position.latitude,
            longitude: position.longitude,
            positions: [position],
            ignitionOff: false
          };
        } else {
          // Verificar si continúa la parada actual
          const distance = this.calculateDistance(
            this.currentActiveStop.latitude, this.currentActiveStop.longitude,
            position.latitude, position.longitude
          );

          if (distance <= MAX_DISTANCE_METERS) {
            // Continúa la misma parada
            this.currentActiveStop.endPosition = position;
            this.currentActiveStop.endTime = position.fixTime;
            this.currentActiveStop.positions.push(position);
          } else {
            // Nueva parada (muy lejos de la anterior) - finalizar la anterior
            this.finalizeActiveStopIfValid(MIN_STOP_DURATION_MS);
            stopsUpdated = true;

            // Iniciar nueva parada
            this.currentActiveStop = {
              startPosition: position,
              endPosition: position,
              startTime: position.fixTime,
              endTime: position.fixTime,
              latitude: position.latitude,
              longitude: position.longitude,
              positions: [position],
              ignitionOff: false
            };

          }
        }
      } else {
        // Posición con movimiento - finalizar parada si existe
        if (this.currentActiveStop) {
          this.finalizeActiveStopIfValid(MIN_STOP_DURATION_MS);
          stopsUpdated = true;
          this.currentActiveStop = null;
    
        }
      }
    }

    // Actualizar índice de última posición procesada
    this.lastProcessedPositionIndex = sortedPositions.length - 1;

    // Solo actualizar marcadores si hubo cambios
    if (stopsUpdated) {
  
      this.updateCalculatedStopMarkers();
      this.emitCalculatedStops();
    } else {

    }
  }

  /**
   * Finalizar parada activa si cumple con los requisitos de duración
   */
  private finalizeActiveStopIfValid(minDurationMs: number): void {
    if (!this.currentActiveStop) return;

    const stopDuration = new Date(this.currentActiveStop.endTime).getTime() - 
                        new Date(this.currentActiveStop.startTime).getTime();
    
    if (stopDuration >= minDurationMs) {
      this.finalizeCalculatedStop(this.currentActiveStop, this.calculatedStops.length + 1);
      this.calculatedStops.push(this.currentActiveStop);

    } else {

    }
  }

  /**
   * Detectar paradas a partir de secuencias de posiciones con velocidad 0 (método completo para inicialización)
   */
  private detectStopsFromStaticPositions(allPositions: any[]): void {
    if (!allPositions || allPositions.length === 0) {
      this.calculatedStops = [];
      this.emitCalculatedStops();
      return;
    }

    // Limpiar paradas calculadas anteriores
    this.clearCalculatedStopMarkers();
    this.calculatedStops = [];

    // Ordenar posiciones por timestamp para asegurar secuencia correcta
    const sortedPositions = [...allPositions].sort((a, b) => 
      new Date(a.fixTime).getTime() - new Date(b.fixTime).getTime()
    );

    const stops: any[] = [];
    let currentStop: any = null;
    const MIN_STOP_DURATION_MS = this.minStopDuration * 60000; // Convertir minutos a milisegundos
    const MAX_DISTANCE_METERS = 50; // Máxima distancia entre posiciones para considerar la misma parada



    for (let i = 0; i < sortedPositions.length; i++) {
      const position = sortedPositions[i];
      const hasMovement = position.speed > 0;

      if (!hasMovement) {
        // Posición sin movimiento (velocidad 0)
        if (!currentStop) {
          // Inicio de una nueva parada
          currentStop = {
            startPosition: position,
            endPosition: position,
            startTime: position.fixTime,
            endTime: position.fixTime,
            latitude: position.latitude,
            longitude: position.longitude,
            positions: [position],
            ignitionOff: false // Por ahora asumir que el motor está encendido
          };
        } else {
          // Verificar si esta posición está cerca de la parada actual
          const distance = this.calculateDistance(
            currentStop.latitude, currentStop.longitude,
            position.latitude, position.longitude
          );

          if (distance <= MAX_DISTANCE_METERS) {
            // Continúa la misma parada
            currentStop.endPosition = position;
            currentStop.endTime = position.fixTime;
            currentStop.positions.push(position);
          } else {
            // Nueva parada (muy lejos de la anterior)
            // Finalizar parada actual si cumple requisitos
            if (currentStop) {
              const stopDuration = new Date(currentStop.endTime).getTime() - new Date(currentStop.startTime).getTime();
              if (stopDuration >= MIN_STOP_DURATION_MS) {
                this.finalizeCalculatedStop(currentStop, stops.length + 1);
                stops.push(currentStop);
              }
            }

            // Iniciar nueva parada
            currentStop = {
              startPosition: position,
              endPosition: position,
              startTime: position.fixTime,
              endTime: position.fixTime,
              latitude: position.latitude,
              longitude: position.longitude,
              positions: [position],
              ignitionOff: false
            };
          }
        }
      } else {
        // Posición con movimiento - finalizar parada si existe
        if (currentStop) {
          const stopDuration = new Date(currentStop.endTime).getTime() - new Date(currentStop.startTime).getTime();
          if (stopDuration >= MIN_STOP_DURATION_MS) {
            this.finalizeCalculatedStop(currentStop, stops.length + 1);
            stops.push(currentStop);
          }
          currentStop = null;
        }
      }
    }

    // Finalizar última parada si existe
    if (currentStop) {
      const stopDuration = new Date(currentStop.endTime).getTime() - new Date(currentStop.startTime).getTime();
      if (stopDuration >= MIN_STOP_DURATION_MS) {
        this.finalizeCalculatedStop(currentStop, stops.length + 1);
        stops.push(currentStop);
      }
    }

    this.calculatedStops = stops;
    this.emitCalculatedStops();

    // Actualizar índice procesado para futuras actualizaciones incrementales
    this.lastProcessedPositionIndex = sortedPositions.length - 1;

    // Crear marcadores para las paradas detectadas
    this.updateCalculatedStopMarkers();
  }

  /**
   * Finalizar y calcular datos de una parada detectada
   */
  private finalizeCalculatedStop(stop: any, stopNumber: number): void {
    const startTime = new Date(stop.startTime);
    const endTime = new Date(stop.endTime);
    const durationMs = endTime.getTime() - startTime.getTime();

    // Calcular duración en formato legible
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);

    let durationText = '';
    if (hours > 0) {
      durationText = `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      durationText = `${minutes}m ${seconds}s`;
    } else {
      durationText = `${seconds}s`;
    }

    // Agregar datos calculados al objeto de parada
    stop.durationMs = durationMs;
    stop.durationText = durationText;
    stop.stopNumber = stopNumber;
    stop.isCalculated = true; // Marcar como parada calculada localmente
    stop.address = stop.startPosition.address || 'Dirección no disponible';

  }

  /**
   * Calcular distancia entre dos coordenadas en metros
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371e3; // Radio de la Tierra en metros
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distancia en metros
  }

  /**
   * Crear marcadores para las paradas calculadas localmente
   */
  private updateCalculatedStopMarkers(): void {
    if (!this.map) {
      return;
    }

    // Verificar si las paradas están habilitadas por el filtro
    if (!this.showStops) {
      this.clearCalculatedStopMarkers();
      return;
    }

    if (!this.calculatedStops || this.calculatedStops.length === 0) {
      this.clearCalculatedStopMarkers();
      return;
    }

    // Actualización inteligente sin pestañeo
    this.updateMarkersIncrementally();
  }

  /**
   * Actualizar marcadores de forma incremental sin pestañeo
   */
  private updateMarkersIncrementally(): void {
    const google = (window as any).google;
    const existingMarkersCount = this.calculatedStopMarkers.length;
    const requiredMarkersCount = this.calculatedStops.length;



    // Caso 1: Agregar nuevos marcadores (más paradas que marcadores)
    if (requiredMarkersCount > existingMarkersCount) {
      const newMarkersNeeded = requiredMarkersCount - existingMarkersCount;


      for (let i = existingMarkersCount; i < requiredMarkersCount; i++) {
        const stop = this.calculatedStops[i];
        const stopMarker = this.createStopMarker(stop, i);
        this.calculatedStopMarkers.push(stopMarker);
      }
    }
    // Caso 2: Eliminar marcadores sobrantes (menos paradas que marcadores)
    else if (requiredMarkersCount < existingMarkersCount) {
      const markersToRemove = existingMarkersCount - requiredMarkersCount;


      // Eliminar marcadores del final
      for (let i = existingMarkersCount - 1; i >= requiredMarkersCount; i--) {
        const marker = this.calculatedStopMarkers[i];
        if (marker) {
          marker.setMap(null);
        }
      }
      // Recortar array
      this.calculatedStopMarkers = this.calculatedStopMarkers.slice(0, requiredMarkersCount);
    }

    // Caso 3: Actualizar marcadores existentes (mantener posiciones actualizadas)
    for (let i = 0; i < Math.min(existingMarkersCount, requiredMarkersCount); i++) {
      const stop = this.calculatedStops[i];
      const marker = this.calculatedStopMarkers[i];
      
      if (marker && stop) {
        // Actualizar posición y título sin recrear el marcador
        const newPosition = { lat: stop.latitude, lng: stop.longitude };
        const newTitle = `Parada Detectada ${stop.stopNumber} - ${stop.durationText}`;
        
        marker.setPosition(newPosition);
        marker.setTitle(newTitle);
      }
    }


  }

  /**
   * Crear un marcador para una parada específica
   */
  private createStopMarker(stop: any, index: number): any {
    const google = (window as any).google;
    
    const stopMarker = new google.maps.Marker({
      position: { lat: stop.latitude, lng: stop.longitude },
      map: this.map,
      title: `Parada Detectada ${stop.stopNumber} - ${stop.durationText}`,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#8b5cf6',
        fillOpacity: 0.9,
        strokeColor: '#ffffff',
        strokeWeight: 2
      },
      zIndex: 900 + index
    });

    // InfoWindow para la parada calculada
    stopMarker.addListener('click', () => {
      const content = this.createCalculatedStopPopupContent(stop);
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

    return stopMarker;
  }

  /**
   * Limpiar marcadores de paradas calculadas
   */
  private clearCalculatedStopMarkers(): void {
    this.calculatedStopMarkers.forEach(marker => {
      if (marker) {
        marker.setMap(null);
      }
    });
    this.calculatedStopMarkers = [];
  }

  private emitCalculatedStops(): void {
    this.calculatedStopsChange.emit([...(this.calculatedStops || [])]);
  }

  /**
   * Crear contenido del popup para paradas calculadas
   */
  private createCalculatedStopPopupContent(stop: any): string {
    const startTime = this.formatDateForPopup(stop.startTime);
    const endTime = this.formatDateForPopup(stop.endTime);
    this.updateInfoPanelForStop(stop, `Parada Detectada ${stop.stopNumber}`);
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 300px; padding: 10px; color: #000;">
        <div style="background: #8b5cf6; color: #fff; padding: 8px; margin: -10px -10px 10px -10px; border-radius: 4px 4px 0 0; position: relative;">
          <h3 style="margin: 0; font-size: 14px; font-weight: 600;">
            🔍 Parada Detectada ${stop.stopNumber}
          </h3>
          <div style="position: absolute; top: 50%; right: 8px; transform: translateY(-50%); background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 10px; font-size: 11px; font-weight: 500;">
            CALCULADA
          </div>
        </div>
        
        <div style="margin-bottom: 8px;">
          <strong style="color: #8b5cf6;">⏱️ Duración:</strong> ${stop.durationText}
        </div>
        
        <div style="margin-bottom: 8px;">
          <strong style="color: #666;">📍 Dirección:</strong><br>
          <span style="font-size: 12px; color: #888;">${stop.address}</span>
        </div>
        
        <div style="margin-bottom: 8px;">
          <strong style="color: #666;">🕐 Inicio:</strong><br>
          <span style="font-size: 12px;">${startTime}</span>
        </div>
        
        <div style="margin-bottom: 8px;">
          <strong style="color: #666;">🕐 Fin:</strong><br>
          <span style="font-size: 12px;">${endTime}</span>
        </div>
        
        <div style="margin-bottom: 8px;">
          <strong style="color: #666;">📊 Posiciones:</strong> ${stop.positions.length}
        </div>
        
        <div style="background: #f3f4f6; padding: 6px; border-radius: 4px; font-size: 11px; color: #666; margin-top: 8px;">
          💡 Esta parada fue detectada automáticamente a partir de posiciones con velocidad 0
        </div>
        
        <button onclick="closeCurrentInfoWindow()" style="background: #8b5cf6; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-top: 8px; width: 100%;">
          Cerrar
        </button>
      </div>
    `;
  }

  private emitInfoPanelData(
    data: ReportsMapInfoPanelData | null,
  ): void {
    this.infoPanelChange.emit(data);
  }

  private updateInfoPanelFromPosition(
    position: any,
    title: string,
    options: {
      dateLabel?: string;
      speedLabel?: string;
      includeSpeed?: boolean;
      extraItems?: ReportsMapInfoPanelItem[];
    } = {},
  ): void {
    if (!position) {
      this.emitInfoPanelData(null);
      return;
    }

    const items: ReportsMapInfoPanelItem[] = [];
    const rawDate =
      position.fixTime ||
      position.deviceTime ||
      position.serverTime ||
      position.timestamp ||
      new Date().toISOString();
    const formattedDate = this.formatDateForPopup(rawDate);
    items.push({
      label: options.dateLabel || 'Fecha y hora',
      value: formattedDate,
    });

    const includeSpeed = options.includeSpeed !== false;
    if (includeSpeed && typeof position.speed === 'number') {
      const speedValue = Math.round(position.speed * 1.852);
      items.push({
        label: options.speedLabel || 'Velocidad',
        value: `${speedValue} km/h`,
      });
    }

    if (options.extraItems) {
      items.push(...options.extraItems);
    }

    this.emitInfoPanelData({ title, items });
  }

  private updateInfoPanelForStop(
    stop: any,
    title: string,
    extraItems: ReportsMapInfoPanelItem[] = [],
  ): void {
    if (!stop) {
      this.emitInfoPanelData(null);
      return;
    }

    const items: ReportsMapInfoPanelItem[] = [];

    if (stop.durationText) {
      items.push({ label: 'Duración', value: stop.durationText });
    }

    if (stop.startTime) {
      items.push({
        label: 'Inicio',
        value: this.formatDateForPopup(stop.startTime),
      });
    }

    if (stop.endTime) {
      items.push({ label: 'Fin', value: this.formatDateForPopup(stop.endTime) });
    }

    if (stop.address) {
      items.push({ label: 'Dirección', value: stop.address });
    }

    if (stop.ignitionOff !== undefined) {
      items.push({
        label: 'Motor',
        value: stop.ignitionOff ? 'Apagado' : 'Encendido',
      });
    }

    if (extraItems.length) {
      items.push(...extraItems);
    }

    this.emitInfoPanelData({ title, items });
  }
}
