import { Component, OnInit, OnChanges, OnDestroy, SimpleChanges, Input } from '@angular/core';
import { ThemesService } from '../../services/themes.service';
import { StatusService } from '../../services/status.service';
import { SystemService, SystemSettings } from '../../../core/services/system.service';

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
  private currentMarkers: any[] = []; // Array para guardar marcadores actuales
  private animationFrameId: number | null = null; // ID del frame de animación
  private lastPosition: { lat: number; lng: number } | null = null; // Última posición conocida
  private currentDisplayedSpeed: number = 0; // Velocidad actualmente mostrada en el UI

  constructor(
    private _theme: ThemesService,
    private _status: StatusService,
    private systemService: SystemService
  ) {
  }

  /**
   * Convierte velocidad de nudos (knots) a kilómetros por hora (km/h)
   * Factor de conversión: 1 nudo = 1.852 km/h
   * @param speedInKnots Velocidad en nudos (desde Traccar)
   * @returns Velocidad en km/h redondeada para mostrar al usuario
   */
  private convertKnotsToKmh(speedInKnots: number): number {
    if (!speedInKnots || speedInKnots < 0) return 0;
    // Conversión: nudos × 1.852 = km/h
    return Math.round(speedInKnots * 1.852);
  }

  /**
   * Formatea la velocidad para mostrar al usuario
   * @param speedInKmh Velocidad en km/h
   * @returns String formateado: "Estacionado" si es 0, o "X km/h" si tiene velocidad
   */
  private formatSpeedDisplay(speedInKmh: number): string {
    if (speedInKmh === 0) {
      return 'Estacionado'; // TODO: Usar traducción cuando esté disponible el servicio de idiomas
    }
    return `${speedInKmh} km/h`;
  }

  /**
   * Genera velocidades intermedias entre la velocidad actual y la nueva
   * @param currentSpeed Velocidad actual en km/h
   * @param targetSpeed Velocidad objetivo en km/h
   * @param numberOfSteps Número de pasos para la transición
   * @returns Array de velocidades intermedias
   */
  private generateIntermediateSpeeds(currentSpeed: number, targetSpeed: number, numberOfSteps: number): number[] {
    const speeds: number[] = [];
    const speedDiff = targetSpeed - currentSpeed;
    
    for (let i = 1; i <= numberOfSteps; i++) {
      const progress = i / numberOfSteps;
      const intermediateSpeed = Math.round(currentSpeed + (speedDiff * progress));
      speeds.push(intermediateSpeed);
    }
    
    return speeds;
  }

  /**
   * Genera posiciones intermedias entre dos puntos y mueve el marcador paso a paso
   * También interpola la velocidad gradualmente
   * @param fromLat Latitud inicial
   * @param fromLng Longitud inicial
   * @param toLat Latitud final
   * @param toLng Longitud final
   * @param targetSpeed Velocidad objetivo en km/h
   * @param stepDelayMs Delay entre cada paso en millisegundos
   */
  private generateIntermediateMovement(
    fromLat: number, 
    fromLng: number, 
    toLat: number, 
    toLng: number, 
    targetSpeed: number,
    stepDelayMs: number = 800
  ): void {
    // Cancelar movimiento anterior si existe
    if (this.animationFrameId) {
      clearTimeout(this.animationFrameId);
    }

    // Calcular distancia para determinar número de pasos
    const distance = this.calculateDistance(fromLat, fromLng, toLat, toLng);
    const distanceInMeters = distance * 1000;
    
    // Determinar número de pasos basado en la distancia (aumentado para movimiento más lento)
    let numberOfSteps: number;
    if (distanceInMeters < 50) {
      numberOfSteps = 5; // Distancias cortas: más pasos para suavidad
    } else if (distanceInMeters < 200) {
      numberOfSteps = 8; // Distancias medias: más pasos
    } else if (distanceInMeters < 500) {
      numberOfSteps = 12; // Distancias largas: muchos más pasos
    } else {
      numberOfSteps = 16; // Distancias muy largas: máximos pasos
    }

    // Generar velocidades intermedias
    const intermediateSpeeds = this.generateIntermediateSpeeds(
      this.currentDisplayedSpeed, 
      targetSpeed, 
      numberOfSteps
    );

    console.log('🎯 GENERANDO MOVIMIENTO POR PASOS:', {
      desde: { lat: fromLat, lng: fromLng },
      hacia: { lat: toLat, lng: toLng },
      distancia: `${Math.round(distanceInMeters)}m`,
      numeroDepasos: numberOfSteps,
      delayEntrePasos: `${stepDelayMs}ms`,
      velocidadActual: this.currentDisplayedSpeed,
      velocidadObjetivo: targetSpeed,
      velocidadesIntermedias: intermediateSpeeds
    });

    // Generar posiciones intermedias con ligera variación para movimiento más realista
    const intermediatePositions: { lat: number; lng: number }[] = [];
    
    for (let i = 1; i <= numberOfSteps; i++) {
      const progress = i / numberOfSteps;
      
      // Interpolación lineal básica
      let lat = fromLat + (toLat - fromLat) * progress;
      let lng = fromLng + (toLng - fromLng) * progress;
      
      // Agregar ligera variación aleatoria para simular movimiento real del vehículo
      // Solo para pasos intermedios (no el último paso)
      if (i < numberOfSteps && distanceInMeters > 100) {
        const variationFactor = 0.0001; // Muy pequeña variación (~10 metros)
        const latVariation = (Math.random() - 0.5) * variationFactor;
        const lngVariation = (Math.random() - 0.5) * variationFactor;
        
        lat += latVariation;
        lng += lngVariation;
      }
      
      intermediatePositions.push({ lat, lng });
    }

    // Ejecutar movimiento paso a paso
    let currentStep = 0;
    const executeStep = () => {
      if (currentStep < intermediatePositions.length) {
        const position = intermediatePositions[currentStep];
        const currentSpeed = intermediateSpeeds[currentStep];
        
        console.log(`📍 PASO ${currentStep + 1}/${numberOfSteps}:`, {
          coordenadas: `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`,
          velocidad: `${currentSpeed} km/h`,
          porcentaje: `${Math.round((currentStep + 1) / numberOfSteps * 100)}%`
        });
        
        // Mover marcador a la posición intermedia
        this.updateMarkerPositionInstant(position.lat, position.lng);
        
        // Actualizar velocidad mostrada
        this.currentDisplayedSpeed = currentSpeed;
        
        // Actualizar popups/InfoWindows con la nueva velocidad
        this.updatePopupSpeeds(currentSpeed);
        
        currentStep++;
        
        // Programar siguiente paso
        this.animationFrameId = setTimeout(executeStep, stepDelayMs) as any;
      } else {
        // Movimiento completado
        this.animationFrameId = null;
        this.lastPosition = { lat: toLat, lng: toLng };
        this.currentDisplayedSpeed = targetSpeed;
        console.log('✅ MOVIMIENTO COMPLETADO');
      }
    };

    // Iniciar el movimiento paso a paso
    executeStep();
  }

  /**
   * Actualiza instantáneamente la posición del marcador sin animación
   * @param lat Nueva latitud
   * @param lng Nueva longitud
   */
  private updateMarkerPositionInstant(lat: number, lng: number): void {
    if (this.currentMarkers.length === 0) return;

    if (this.provider === 'google') {
      const marker = this.currentMarkers[0];
      const newPosition = new google.maps.LatLng(lat, lng);
      marker.setPosition(newPosition);
    } else if (this.provider === 'mapbox') {
      const marker = this.currentMarkers[0];
      marker.setLngLat([lng, lat]);
    }
  }

  /**
   * Actualiza la velocidad mostrada en los popups/InfoWindows existentes
   * @param speedKmh Nueva velocidad en km/h
   */
  private updatePopupSpeeds(speedKmh: number): void {
    if (this.currentMarkers.length === 0) return;

    const formattedSpeed = this.formatSpeedDisplay(speedKmh);
    const updatedStatus = this.selectedTarget?.traccarInfo?.status || 'desconocido';

    if (this.provider === 'google') {
      const marker = this.currentMarkers[0];
      if ((marker as any).infoWindow) {
        const infoWindow = (marker as any).infoWindow;
        
        // Obtener información adicional del target para el popup actualizado
        let vehicleTypeInfo = '';
        if (this.vehicleTypeGetter && this.selectedTarget?.model) {
          const vehicleType = this.vehicleTypeGetter(this.selectedTarget.model);
          if (vehicleType && vehicleType !== 'Desconocido') {
            vehicleTypeInfo = `<span style="color: #9C27B0; font-size: 11px; margin-left: 4px;">(${vehicleType})</span>`;
          }
        }
        
        // Crear contenido actualizado del InfoWindow con la nueva velocidad
        const updatedInfoContent = `
          <div id="custom-info-window" style="
            font-family: 'Segoe UI', sans-serif; 
            width: 230px; 
            background: white; 
            border: 1px solid #e0e0e0;
            border-radius: 4px; 
            margin-right: 10px;
            margin-bottom: 10px;
          ">
            <!-- Header minimalista -->
            <div style="
              background: #f8f9fa; 
              color: #333; 
              padding: 10px 12px; 
              display: flex; 
              justify-content: space-between; 
              align-items: center;
              border-bottom: 1px solid #e0e0e0;
            ">
              <div style="flex: 1; min-width: 0;">
                <div style="
                  font-size: 14px; 
                  font-weight: 500; 
                  color: #333;
                  white-space: nowrap; 
                  overflow: hidden; 
                  text-overflow: ellipsis;
                ">
                  ${this.selectedTarget?.name}${vehicleTypeInfo}
                </div>
              </div>
              <button onclick="
                        const iwOuter = this.closest('.gm-style-iw');
                        const iwContainer = this.closest('.gm-style-iw-c');
                        const iwBackground = document.querySelector('.gm-style-iw-d');
                        const iwTail = document.querySelector('.gm-style-iw-t');
                        
                        if (iwOuter) iwOuter.style.display = 'none';
                        if (iwContainer) iwContainer.style.display = 'none';
                        if (iwBackground) iwBackground.style.display = 'none';
                        if (iwTail) iwTail.style.display = 'none';
                        
                        setTimeout(() => {
                          if (iwOuter && iwOuter.parentNode) iwOuter.parentNode.removeChild(iwOuter);
                          if (iwContainer && iwContainer.parentNode) iwContainer.parentNode.removeChild(iwContainer);
                          if (iwBackground && iwBackground.parentNode) iwBackground.parentNode.removeChild(iwBackground);
                          if (iwTail && iwTail.parentNode) iwTail.parentNode.removeChild(iwTail);
                        }, 50);" 
                      style="
                        background: none; 
                        border: none; 
                        color: #666; 
                        width: 20px; 
                        height: 20px; 
                        cursor: pointer; 
                        font-size: 16px; 
                        line-height: 1; 
                        margin-left: 10px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                      "
                      onmouseover="this.style.color='#333'"
                      onmouseout="this.style.color='#666'">
                ×
              </button>
            </div>
            
            <!-- Contenido minimalista -->
            <div style="padding: 12px;">
              <div style="
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                margin-bottom: 10px; 
              ">
                <span style="color: #666; font-size: 13px;">Velocidad</span>
                <span style="color: #333; font-weight: 600; font-size: 18px;">${formattedSpeed}</span>
              </div>
              
              <div style="
                display: flex; 
                align-items: center; 
                gap: 8px;
              ">
                <span style="
                  width: 8px; 
                  height: 8px; 
                  border-radius: 50%; 
                  background: ${updatedStatus === 'online' ? '#4CAF50' : '#F44336'};
                "></span>
                <span style="
                  color: #666; 
                  font-size: 13px;
                ">
                  ${updatedStatus === 'online' ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
            </div>
          </div>
        `;
        
        // Actualizar el contenido del InfoWindow
        infoWindow.setContent(updatedInfoContent);
      }
    } else if (this.provider === 'mapbox') {
      const marker = this.currentMarkers[0];
      const popup = marker.getPopup();
      if (popup) {
        // Obtener información adicional del target para el popup actualizado
        let vehicleTypeInfo = '';
        if (this.vehicleTypeGetter && this.selectedTarget?.model) {
          const vehicleType = this.vehicleTypeGetter(this.selectedTarget.model);
          if (vehicleType && vehicleType !== 'Desconocido') {
            vehicleTypeInfo = `<span style="color: #9C27B0; font-size: 11px; margin-left: 4px;">(${vehicleType})</span>`;
          }
        }
        
        // Crear contenido actualizado del popup con la nueva velocidad
        const updatedPopupContent = `
          <div id="custom-info-window" style="
            font-family: 'Segoe UI', sans-serif; 
            width: 215px;
            background: white; 
            border: 1px solid #e0e0e0;
            border-radius: 4px; 
            margin-right: 15px;
            margin-bottom: 10px;
          ">
            <!-- Header minimalista -->
            <div style="
              background: #f8f9fa; 
              color: #333; 
              padding: 10px 12px; 
              display: flex; 
              justify-content: space-between; 
              align-items: center;
              border-bottom: 1px solid #e0e0e0;
            ">
              <div style="flex: 1; min-width: 0;">
                <div style="
                  font-size: 14px; 
                  font-weight: 500; 
                  color: #333;
                  white-space: nowrap; 
                  overflow: hidden; 
                  text-overflow: ellipsis;
                ">
                  ${this.selectedTarget?.name}${vehicleTypeInfo}
                </div>
              </div>
              <button onclick="
                        this.closest('.mapboxgl-popup').style.display = 'none';
                        setTimeout(() => { 
                          const popup = this.closest('.mapboxgl-popup'); 
                          if (popup && popup.parentNode) popup.parentNode.removeChild(popup); 
                        }, 50);" 
                      style="
                        background: none; 
                        border: none; 
                        color: #666; 
                        width: 20px; 
                        height: 20px; 
                        cursor: pointer; 
                        font-size: 16px; 
                        line-height: 1; 
                        margin-left: 10px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                      "
                      onmouseover="this.style.color='#333'"
                      onmouseout="this.style.color='#666'">
                ×
              </button>
            </div>
            
            <!-- Contenido minimalista -->
            <div style="padding: 12px;">
              <div style="
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                margin-bottom: 10px; 
              ">
                <span style="color: #666; font-size: 13px;">Velocidad</span>
                <span style="color: #333; font-weight: 600; font-size: 18px;">${formattedSpeed}</span>
              </div>
              
              <div style="
                display: flex; 
                align-items: center; 
                gap: 8px;
              ">
                <span style="
                  width: 8px; 
                  height: 8px; 
                  border-radius: 50%; 
                  background: ${updatedStatus === 'online' ? '#4CAF50' : '#F44336'};
                "></span>
                <span style="
                  color: #666; 
                  font-size: 13px;
                ">
                  ${updatedStatus === 'online' ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
            </div>
          </div>
        `;
        
        // Actualizar el contenido del popup
        popup.setHTML(updatedPopupContent);
      }
    }
  }

  /**
   * Calcula la distancia entre dos puntos geográficos usando la fórmula de Haversine
   * @param lat1 Latitud del primer punto
   * @param lng1 Longitud del primer punto
   * @param lat2 Latitud del segundo punto
   * @param lng2 Longitud del segundo punto
   * @returns Distancia en kilómetros
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Radio de la Tierra en kilómetros
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
  }

  /**
   * Convierte grados a radianes
   * @param degrees Grados
   * @returns Radianes
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Si cambió el proveedor de mapas, necesitamos reinicializar completamente el mapa
    if (changes['provider'] && this.map) {
      this.destroyMap();
      // Esperar un poco para que se limpie el DOM antes de reinicializar
      setTimeout(() => {
        this.ngOnInit();
      }, 100);
      return;
    }
    
    // Verificar si cambió el tema
    if (this.map && changes['theme']) {
      this.updateMapTheme();
    }
    
    // Solo proceder si el mapa ya está inicializado y selectedTarget cambió
    if (this.map && changes['selectedTarget']) {
      
      // Verificar si solo cambió la posición (mismo target, nueva ubicación)
      const previousTarget = changes['selectedTarget'].previousValue;
      const currentTarget = changes['selectedTarget'].currentValue;
      
      if (previousTarget && currentTarget && 
          previousTarget._id === currentTarget._id &&
          this.currentMarkers.length > 0) {
        // Solo actualizar posición del marcador existente
        this.updateMarkerPosition();
      } else {
        // Crear nuevo marcador o cambio completo de target
        this.updateMapWithNewTarget();
      }
    }
  }

  ngOnInit(): void {
    this.systemService.getAll().subscribe((systems: SystemSettings[]) => {
      if (systems && systems.length > 0) {
        if (this.provider === 'google' && systems[0].map_api1?.key && systems[0].map_api1?.url) {
          this.apiKey = systems[0].map_api1.key;
          this.apiUrl = systems[0].map_api1.url;
        } else if (this.provider === 'mapbox' && systems[0].map_api2?.key && systems[0].map_api2?.url) {
          this.apiKey = systems[0].map_api2.key;
          this.apiUrl = systems[0].map_api2.url;
        }
      }
      this.loadMapScript().then(() => {
        this.initializeMap();
      });
    });
  }

  private loadMapScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.provider === 'google') {
        if (typeof google !== 'undefined' && google.maps) {
          resolve();
          return;
        }
        if (!this.apiKey || !this.apiUrl) {
          reject('No se encontró configuración de Google Maps');
          return;
        }
        const script = document.createElement('script');
        script.src = `${this.apiUrl}${this.apiKey}`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = (error) => reject(error);
        document.head.appendChild(script);
      } else if (this.provider === 'mapbox') {
        if ((window as any).mapboxgl) {
          resolve();
          return;
        }
        if (!this.apiKey || !this.apiUrl) {
          reject('No se encontró configuración de Mapbox');
          return;
        }
        // Cargar CSS de Mapbox
        const link = document.createElement('link');
        link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
        // Cargar script de Mapbox
        const script = document.createElement('script');
        script.src = `${this.apiUrl}?access_token=${this.apiKey}`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = (error) => reject(error);
        document.head.appendChild(script);
      } else {
        reject('Proveedor de mapas no soportado');
      }
    });
  }

  private initializeMap(): void {
    const mapElement = document.getElementById('map') as HTMLElement;
    
    // Determinar centro del mapa y zoom
    let centerLat = 19.4326; // Default México DF
    let centerLng = -99.1332;
    let zoomLevel = 12;
    
         // Si hay un target seleccionado con geolocalización, usar sus coordenadas
     if (this.selectedTarget?.traccarInfo?.geolocation?.latitude && 
         this.selectedTarget?.traccarInfo?.geolocation?.longitude) {
       centerLat = this.selectedTarget.traccarInfo.geolocation.latitude;
       centerLng = this.selectedTarget.traccarInfo.geolocation.longitude;
       zoomLevel = 16; // Zoom más cercano para el target específico
     }
    
    if (this.provider === 'google') {
      // Estilos para el tema oscuro
      const darkTheme = [
        { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
        {
          featureType: "administrative.locality",
          elementType: "labels.text.fill",
          stylers: [{ color: "#d59563" }],
        },
        {
          featureType: "poi",
          elementType: "labels.text.fill",
          stylers: [{ color: "#d59563" }],
        },
        {
          featureType: "poi.park",
          elementType: "geometry",
          stylers: [{ color: "#263c3f" }],
        },
        {
          featureType: "poi.park",
          elementType: "labels.text.fill",
          stylers: [{ color: "#6b9a76" }],
        },
        {
          featureType: "road",
          elementType: "geometry",
          stylers: [{ color: "#38414e" }],
        },
        {
          featureType: "road",
          elementType: "geometry.stroke",
          stylers: [{ color: "#212a37" }],
        },
        {
          featureType: "road",
          elementType: "labels.text.fill",
          stylers: [{ color: "#9ca5b3" }],
        },
        {
          featureType: "road.highway",
          elementType: "geometry",
          stylers: [{ color: "#746855" }],
        },
        {
          featureType: "road.highway",
          elementType: "geometry.stroke",
          stylers: [{ color: "#1f2835" }],
        },
        {
          featureType: "road.highway",
          elementType: "labels.text.fill",
          stylers: [{ color: "#f3d19c" }],
        },
        {
          featureType: "transit",
          elementType: "geometry",
          stylers: [{ color: "#2f3948" }],
        },
        {
          featureType: "transit.station",
          elementType: "labels.text.fill",
          stylers: [{ color: "#d59563" }],
        },
        {
          featureType: "water",
          elementType: "geometry",
          stylers: [{ color: "#17263c" }],
        },
        {
          featureType: "water",
          elementType: "labels.text.fill",
          stylers: [{ color: "#515c6d" }],
        },
        {
          featureType: "water",
          elementType: "labels.text.stroke",
          stylers: [{ color: "#17263c" }],
        },
      ];
      
      this.map = new google.maps.Map(mapElement, {
        center: { lat: centerLat, lng: centerLng },
        zoom: zoomLevel,
        styles: this.theme === 'dark' ? darkTheme : [],
      });
      
             // Agregar marcador si hay un target seleccionado
       if (this.selectedTarget?.traccarInfo?.geolocation?.latitude && 
           this.selectedTarget?.traccarInfo?.geolocation?.longitude) {
         this.addGoogleMarker(centerLat, centerLng, this.selectedTarget.name);
       }
      
    } else if (this.provider === 'mapbox') {
      // @ts-ignore
      const mapboxgl = (window as any).mapboxgl;
      if (!mapboxgl) return;
      
      this.map = new mapboxgl.Map({
        container: mapElement,
        accessToken: this.apiKey,
        style: this.theme === 'dark'
          ? 'mapbox://styles/mapbox/dark-v10'
          : 'mapbox://styles/mapbox/streets-v11',
        center: [centerLng, centerLat],
        zoom: zoomLevel
      });
      
             // Agregar marcador si hay un target seleccionado
       if (this.selectedTarget?.traccarInfo?.geolocation?.latitude && 
           this.selectedTarget?.traccarInfo?.geolocation?.longitude) {
         this.addMapboxMarker(centerLng, centerLat, this.selectedTarget.name);
       }
    }
  }
  
  // Método para actualizar el tema del mapa
  private updateMapTheme(): void {
    if (!this.map) return;
    
    try {
    if (this.provider === 'google') {
        // Validar que sea realmente un mapa de Google antes de usar setOptions
        if (this.map.setOptions && typeof this.map.setOptions === 'function') {
      // Para Google Maps, actualizar los estilos
      const darkTheme = [
        { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
        {
          featureType: "administrative.locality",
          elementType: "labels.text.fill",
          stylers: [{ color: "#d59563" }],
        },
        {
          featureType: "poi",
          elementType: "labels.text.fill",
          stylers: [{ color: "#d59563" }],
        },
        {
          featureType: "poi.park",
          elementType: "geometry",
          stylers: [{ color: "#263c3f" }],
        },
        {
          featureType: "poi.park",
          elementType: "labels.text.fill",
          stylers: [{ color: "#6b9a76" }],
        },
        {
          featureType: "road",
          elementType: "geometry",
          stylers: [{ color: "#38414e" }],
        },
        {
          featureType: "road",
          elementType: "geometry.stroke",
          stylers: [{ color: "#212a37" }],
        },
        {
          featureType: "road",
          elementType: "labels.text.fill",
          stylers: [{ color: "#9ca5b3" }],
        },
        {
          featureType: "road.highway",
          elementType: "geometry",
          stylers: [{ color: "#746855" }],
        },
        {
          featureType: "road.highway",
          elementType: "geometry.stroke",
          stylers: [{ color: "#1f2835" }],
        },
        {
          featureType: "road.highway",
          elementType: "labels.text.fill",
          stylers: [{ color: "#f3d19c" }],
        },
        {
          featureType: "transit",
          elementType: "geometry",
          stylers: [{ color: "#2f3948" }],
        },
        {
          featureType: "transit.station",
          elementType: "labels.text.fill",
          stylers: [{ color: "#d59563" }],
        },
        {
          featureType: "water",
          elementType: "geometry",
          stylers: [{ color: "#17263c" }],
        },
        {
          featureType: "water",
          elementType: "labels.text.fill",
          stylers: [{ color: "#515c6d" }],
        },
        {
          featureType: "water",
          elementType: "labels.text.stroke",
          stylers: [{ color: "#17263c" }],
        },
      ];
      
      this.map.setOptions({
        styles: this.theme === 'dark' ? darkTheme : []
      });
        } else {
          console.error('El mapa no es compatible con Google Maps API o no está inicializado correctamente');
          // Reinicializar el mapa si hay un problema
          this.destroyMap();
          setTimeout(() => {
            this.ngOnInit();
          }, 100);
        }
      
    } else if (this.provider === 'mapbox') {
        // Validar que sea realmente un mapa de Mapbox antes de usar setStyle
        if (this.map.setStyle && typeof this.map.setStyle === 'function') {
      // Para Mapbox, cambiar el estilo completo
          const styleUrl = this.theme === 'dark' 
        ? 'mapbox://styles/mapbox/dark-v10'
            : 'mapbox://styles/mapbox/light-v10';
            
          this.map.setStyle(styleUrl);
          
          // Después de cambiar el estilo, restaurar marcadores si existen
          this.map.once('styledata', () => {
            if (this.selectedTarget?.traccarInfo?.geolocation?.latitude && 
                this.selectedTarget?.traccarInfo?.geolocation?.longitude) {
              this.addMapboxMarker(
                this.selectedTarget.traccarInfo.geolocation.longitude,
                this.selectedTarget.traccarInfo.geolocation.latitude,
                this.selectedTarget.name
              );
            }
          });
        } else {
          console.error('El mapa no es compatible con Mapbox API o no está inicializado correctamente');
          // Reinicializar el mapa si hay un problema
          this.destroyMap();
          setTimeout(() => {
            this.ngOnInit();
          }, 100);
        }
      }
    } catch (error) {
      console.error('Error actualizando tema del mapa:', error);
      // En caso de error, reinicializar el mapa
      this.destroyMap();
      setTimeout(() => {
        this.ngOnInit();
      }, 100);
    }
  }

  private updateMarkerPosition(): void {
    if (!this.selectedTarget?.traccarInfo?.geolocation?.latitude || 
        !this.selectedTarget?.traccarInfo?.geolocation?.longitude) {
      return;
    }
    
    const newLat = this.selectedTarget.traccarInfo.geolocation.latitude;
    const newLng = this.selectedTarget.traccarInfo.geolocation.longitude;
    
    // Obtener información actualizada para el popup
    const speedInKnots = this.selectedTarget?.traccarInfo?.geolocation?.speed || 0;
    const updatedSpeed = this.convertKnotsToKmh(speedInKnots);
    const updatedStatus = this.selectedTarget?.traccarInfo?.status || 'desconocido';
    const speedUnit = 'km/h';
    
    console.log('🔄 ACTUALIZANDO VELOCIDAD EN TIEMPO REAL:', {
      targetName: this.selectedTarget?.name,
      velocidadEnNudos: speedInKnots,
      velocidadEnKmh: updatedSpeed,
      conversionAplicada: speedInKnots > 0 ? `${speedInKnots} nudos → ${this.formatSpeedDisplay(updatedSpeed)}` : 'Sin velocidad',
      statusActualizado: updatedStatus,
      coordenadas: { lat: newLat, lng: newLng },
      ultimaPosicion: this.lastPosition
    });
    
    // Verificar si hay una posición anterior para animar
    if (this.lastPosition && this.currentMarkers.length > 0) {
      // Calcular la distancia para determinar si vale la pena animar
      const distance = this.calculateDistance(
        this.lastPosition.lat, 
        this.lastPosition.lng, 
        newLat, 
        newLng
      );
      
      // Solo animar si la distancia es significativa (más de 5 metros) pero no demasiado grande (menos de 1km)
      if (distance > 0.005 && distance < 1) { // 5 metros a 1 km
                 console.log('🚶 MOVIMIENTO PASO A PASO DEL MARCADOR:', {
           desde: this.lastPosition,
           hacia: { lat: newLat, lng: newLng },
           distancia: `${Math.round(distance * 1000)}m`
         });
        
                 // Calcular delay basado en la velocidad del vehículo
         const vehicleSpeed = this.convertKnotsToKmh(speedInKnots);
         let stepDelay = 800; // Delay por defecto más lento
         
         if (vehicleSpeed === 0) {
           stepDelay = 1200; // Vehículo estacionado: movimiento muy lento
         } else if (vehicleSpeed < 20) {
           stepDelay = 1000; // Velocidad baja: movimiento lento
         } else if (vehicleSpeed < 50) {
           stepDelay = 800; // Velocidad media: movimiento pausado
         } else {
           stepDelay = 600; // Velocidad alta: movimiento moderado
         }
         
         console.log('⚡ CALCULANDO DELAY BASADO EN VELOCIDAD:', {
           velocidadKmh: vehicleSpeed,
           delayCalculado: `${stepDelay}ms`
         });
         
         // Generar movimiento por pasos intermedios
         this.generateIntermediateMovement(
           this.lastPosition.lat,
           this.lastPosition.lng,
           newLat,
           newLng,
           updatedSpeed,
           stepDelay
         );
      } else {
        // Si la distancia es muy pequeña o muy grande, mover instantáneamente
        console.log('📍 MOVIMIENTO INSTANTÁNEO:', {
          distancia: `${Math.round(distance * 1000)}m`,
          razon: distance <= 0.005 ? 'Distancia muy pequeña' : 'Distancia muy grande'
        });
        this.updateMarkerPositionInstant(newLat, newLng);
        this.lastPosition = { lat: newLat, lng: newLng };
        // Actualizar velocidad mostrada instantáneamente
        this.currentDisplayedSpeed = updatedSpeed;
      }
    } else {
      // Primera posición o no hay marcadores, mover instantáneamente
      this.updateMarkerPositionInstant(newLat, newLng);
      this.lastPosition = { lat: newLat, lng: newLng };
      // Inicializar velocidad mostrada para futuros cálculos
      this.currentDisplayedSpeed = updatedSpeed;
    }
    
    if (this.provider === 'google' && this.currentMarkers.length > 0) {
      const marker = this.currentMarkers[0];
      
      // NUEVO: Actualizar el InfoWindow si está abierto
      if ((marker as any).infoWindow) {
        const infoWindow = (marker as any).infoWindow;
        
        // Obtener información adicional del target para el popup actualizado
        let vehicleTypeInfo = '';
        if (this.vehicleTypeGetter && this.selectedTarget?.model) {
          const vehicleType = this.vehicleTypeGetter(this.selectedTarget.model);
          if (vehicleType && vehicleType !== 'Desconocido') {
            vehicleTypeInfo = `<span style="color: #9C27B0; font-size: 11px; margin-left: 4px;">(${vehicleType})</span>`;
          }
        }
        
        // Crear contenido actualizado del InfoWindow
        const updatedInfoContent = `
          <div id="custom-info-window" style="
            font-family: 'Segoe UI', sans-serif; 
            width: 230px; 
            background: white; 
            border: 1px solid #e0e0e0;
            border-radius: 4px; 
            margin-right: 10px;
            margin-bottom: 10px;
          ">
            <!-- Header minimalista -->
            <div style="
              background: #f8f9fa; 
              color: #333; 
              padding: 10px 12px; 
              display: flex; 
              justify-content: space-between; 
              align-items: center;
              border-bottom: 1px solid #e0e0e0;
            ">
              <div style="flex: 1; min-width: 0;">
                <div style="
                  font-size: 14px; 
                  font-weight: 500; 
                  color: #333;
                  white-space: nowrap; 
                  overflow: hidden; 
                  text-overflow: ellipsis;
                ">
                  ${this.selectedTarget?.name}${vehicleTypeInfo}
                </div>
              </div>
              <button onclick="
                        const iwOuter = this.closest('.gm-style-iw');
                        const iwContainer = this.closest('.gm-style-iw-c');
                        const iwBackground = document.querySelector('.gm-style-iw-d');
                        const iwTail = document.querySelector('.gm-style-iw-t');
                        
                        if (iwOuter) iwOuter.style.display = 'none';
                        if (iwContainer) iwContainer.style.display = 'none';
                        if (iwBackground) iwBackground.style.display = 'none';
                        if (iwTail) iwTail.style.display = 'none';
                        
                        setTimeout(() => {
                          if (iwOuter && iwOuter.parentNode) iwOuter.parentNode.removeChild(iwOuter);
                          if (iwContainer && iwContainer.parentNode) iwContainer.parentNode.removeChild(iwContainer);
                          if (iwBackground && iwBackground.parentNode) iwBackground.parentNode.removeChild(iwBackground);
                          if (iwTail && iwTail.parentNode) iwTail.parentNode.removeChild(iwTail);
                        }, 50);" 
                      style="
                        background: none; 
                        border: none; 
                        color: #666; 
                        width: 20px; 
                        height: 20px; 
                        cursor: pointer; 
                        font-size: 16px; 
                        line-height: 1; 
                        margin-left: 10px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                      "
                      onmouseover="this.style.color='#333'"
                      onmouseout="this.style.color='#666'">
                ×
              </button>
            </div>
            
            <!-- Contenido minimalista -->
            <div style="padding: 12px;">
              <div style="
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                margin-bottom: 10px; 
              ">
                <span style="color: #666; font-size: 13px;">Velocidad</span>
                <span style="color: #333; font-weight: 600; font-size: 18px;">${this.formatSpeedDisplay(updatedSpeed)}</span>
              </div>
              
              <div style="
                display: flex; 
                align-items: center; 
                gap: 8px;
              ">
                <span style="
                  width: 8px; 
                  height: 8px; 
                  border-radius: 50%; 
                  background: ${updatedStatus === 'online' ? '#4CAF50' : '#F44336'};
                "></span>
                <span style="
                  color: #666; 
                  font-size: 13px;
                ">
                  ${updatedStatus === 'online' ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
            </div>
          </div>
        `;
        
        // Actualizar el contenido del InfoWindow
        infoWindow.setContent(updatedInfoContent);
        
        // Reconfigurar eventos para el botón de cerrar
        google.maps.event.addListener(infoWindow, 'domready', () => {
          const closeBtns = document.querySelectorAll('.gm-ui-hover-effect, [title="Close"], [aria-label="Close"]');
          closeBtns.forEach((btn: any) => {
            if (btn && btn.style) {
              btn.style.display = 'none';
            }
          });
        });
      }
      
    } else if (this.provider === 'mapbox' && this.currentMarkers.length > 0) {
      const marker = this.currentMarkers[0];
      
      // NUEVO: Actualizar el popup si existe
      const popup = marker.getPopup();
      if (popup) {
        // Obtener información adicional del target para el popup actualizado
        let vehicleTypeInfo = '';
        if (this.vehicleTypeGetter && this.selectedTarget?.model) {
          const vehicleType = this.vehicleTypeGetter(this.selectedTarget.model);
          if (vehicleType && vehicleType !== 'Desconocido') {
            vehicleTypeInfo = `<span style="color: #9C27B0; font-size: 11px; margin-left: 4px;">(${vehicleType})</span>`;
          }
        }
        
        // Crear contenido actualizado del popup con el MISMO diseño que Google Maps
        const updatedPopupContent = `
          <div id="custom-info-window" style="
            font-family: 'Segoe UI', sans-serif; 
            width: 215px;
            background: white; 
            border: 1px solid #e0e0e0;
            border-radius: 4px; 
            margin-right: 15px;
            margin-bottom: 10px;
          ">
            <!-- Header minimalista -->
            <div style="
              background: #f8f9fa; 
              color: #333; 
              padding: 10px 12px; 
              display: flex; 
              justify-content: space-between; 
              align-items: center;
              border-bottom: 1px solid #e0e0e0;
            ">
              <div style="flex: 1; min-width: 0;">
                <div style="
                  font-size: 14px; 
                  font-weight: 500; 
                  color: #333;
                  white-space: nowrap; 
                  overflow: hidden; 
                  text-overflow: ellipsis;
                ">
                  ${this.selectedTarget?.name}${vehicleTypeInfo}
                </div>
              </div>
              <button onclick="
                        this.closest('.mapboxgl-popup').style.display = 'none';
                        setTimeout(() => { 
                          const popup = this.closest('.mapboxgl-popup'); 
                          if (popup && popup.parentNode) popup.parentNode.removeChild(popup); 
                        }, 50);" 
                      style="
                        background: none; 
                        border: none; 
                        color: #666; 
                        width: 20px; 
                        height: 20px; 
                        cursor: pointer; 
                        font-size: 16px; 
                        line-height: 1; 
                        margin-left: 10px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                      "
                      onmouseover="this.style.color='#333'"
                      onmouseout="this.style.color='#666'">
                ×
              </button>
            </div>
            
            <!-- Contenido minimalista -->
            <div style="padding: 12px;">
              <div style="
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                margin-bottom: 10px; 
              ">
                <span style="color: #666; font-size: 13px;">Velocidad</span>
                <span style="color: #333; font-weight: 600; font-size: 18px;">${this.formatSpeedDisplay(updatedSpeed)}</span>
              </div>
              
              <div style="
                display: flex; 
                align-items: center; 
                gap: 8px;
              ">
                <span style="
                  width: 8px; 
                  height: 8px; 
                  border-radius: 50%; 
                  background: ${updatedStatus === 'online' ? '#4CAF50' : '#F44336'};
                "></span>
                <span style="
                  color: #666; 
                  font-size: 13px;
                ">
                  ${updatedStatus === 'online' ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
            </div>
          </div>
        `;
        
        // Actualizar el contenido del popup
        popup.setHTML(updatedPopupContent);
      }
    }
  }

  private updateMapWithNewTarget(): void {
    // Limpiar marcadores existentes primero
    this.clearExistingMarkers();
    
    if (!this.selectedTarget?.traccarInfo?.geolocation?.latitude || 
        !this.selectedTarget?.traccarInfo?.geolocation?.longitude) {
      return;
    }
      
      const lat = this.selectedTarget.traccarInfo.geolocation.latitude;
      const lng = this.selectedTarget.traccarInfo.geolocation.longitude;
      
    // Centrar mapa en el nuevo target
      if (this.provider === 'google') {
      this.map.setCenter({ lat, lng });
        this.map.setZoom(16);
        this.addGoogleMarker(lat, lng, this.selectedTarget.name);
      } else if (this.provider === 'mapbox') {
        this.map.setCenter([lng, lat]);
        this.map.setZoom(16);
        this.addMapboxMarker(lng, lat, this.selectedTarget.name);
    }
  }
  
  // Método para limpiar marcadores existentes
  private clearExistingMarkers(): void {
    if (this.provider === 'google') {
      // Para Google Maps, necesitamos guardar referencias a los marcadores
      this.currentMarkers.forEach(marker => {
        if (marker.setMap) {
          marker.setMap(null);
        }
      });
    } else if (this.provider === 'mapbox') {
      // Para Mapbox, necesitamos guardar referencias a los marcadores  
      this.currentMarkers.forEach(marker => {
        if (marker.remove) {
          marker.remove();
        }
      });
    }
    this.currentMarkers = [];
  }
  
  // Método para agregar marcador en Google Maps
  private addGoogleMarker(lat: number, lng: number, title: string): void {
    if (!this.map) return;
    
    // Obtener información del target para el marcador
    const markerSpeedInKnots = this.selectedTarget?.traccarInfo?.geolocation?.speed || 0;
    const markerSpeed = this.convertKnotsToKmh(markerSpeedInKnots);
    const markerStatus = this.selectedTarget?.traccarInfo?.status || 'desconocido';
    
    // Crear un marcador personalizado con velocidad para Google Maps
    const markerColor = markerStatus === 'online' ? '#4CAF50' : '#F44336';
    
    const marker = new google.maps.Marker({
      position: { lat: lat, lng: lng },
      map: this.map,
      title: '', // Quitar el title por defecto
      label: '', // Quitar cualquier label por defecto
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: markerColor,
        fillOpacity: 0.8,
        strokeColor: '#FFFFFF',
        strokeWeight: 2
      }
    });
    
    // Guardar referencia del marcador para poder eliminarlo después
    this.currentMarkers.push(marker);
    
    // Establecer la posición inicial para futuras animaciones
    this.lastPosition = { lat: lat, lng: lng };
    
    // Obtener información adicional del target para el popup
    const popupSpeedInKnots = this.selectedTarget?.traccarInfo?.geolocation?.speed || 0;
    const popupSpeed = this.convertKnotsToKmh(popupSpeedInKnots);
    const popupStatus = this.selectedTarget?.traccarInfo?.status || 'desconocido';
    const speedUnit = 'km/h';
    
    // Console para verificar los datos de velocidad
    console.log('🗺️ DATOS DE VELOCIDAD EN MAPA (GOOGLE):', {
      targetName: title,
      velocidadEnNudos: popupSpeedInKnots,
      velocidadEnKmh: popupSpeed,
      conversionAplicada: popupSpeedInKnots > 0 ? `${popupSpeedInKnots} nudos → ${this.formatSpeedDisplay(popupSpeed)}` : 'Sin velocidad',
      rutaCompleta: 'traccarInfo.geolocation.speed',
      traccarInfo: this.selectedTarget?.traccarInfo,
      geolocation: this.selectedTarget?.traccarInfo?.geolocation,
      geolocationAttributes: this.selectedTarget?.traccarInfo?.geolocation?.attributes,
      possibleSpeedPaths: {
        'geolocation.speed': this.selectedTarget?.traccarInfo?.geolocation?.speed,
        'geolocation.velocity': this.selectedTarget?.traccarInfo?.geolocation?.velocity,
        'geolocation.attributes.speed': this.selectedTarget?.traccarInfo?.geolocation?.attributes?.speed,
        'geolocation.attributes.velocity': this.selectedTarget?.traccarInfo?.geolocation?.attributes?.velocity,
        'traccarInfo.geolocation.speed': this.selectedTarget?.traccarInfo?.geolocation?.speed
      },
      allGeolocationProps: this.selectedTarget?.traccarInfo?.geolocation ? Object.keys(this.selectedTarget.traccarInfo.geolocation) : [],
      speedFound: !!this.selectedTarget?.traccarInfo?.geolocation?.speed
    });
    
    // Obtener tipo de vehículo si está disponible
    let vehicleTypeInfo = '';
    if (this.vehicleTypeGetter && this.selectedTarget?.model) {
      const vehicleType = this.vehicleTypeGetter(this.selectedTarget.model);
      if (vehicleType && vehicleType !== 'Desconocido') {
        vehicleTypeInfo = `<span style="color: #9C27B0; font-size: 11px; margin-left: 4px;">(${vehicleType})</span>`;
      }
    }
    
    // Crear contenido minimalista
    const infoContent = `
      <div id="custom-info-window" style="
        font-family: 'Segoe UI', sans-serif; 
        width: 230px; 
        
        
        background: white; 
        border: 1px solid #e0e0e0;
        border-radius: 4px; 
        // margin: -8px;
        margin-right: 10px;
        margin-bottom: 10px;
      ">
        <!-- Header minimalista -->
        <div style="
          background: #f8f9fa; 
          color: #333; 
          padding: 10px 12px; 
          display: flex; 
          justify-content: space-between; 
          align-items: center;
          border-bottom: 1px solid #e0e0e0;
        ">
          <div style="flex: 1; min-width: 0;">
            <div style="
              font-size: 14px; 
              font-weight: 500; 
              color: #333;
              white-space: nowrap; 
              overflow: hidden; 
              text-overflow: ellipsis;
               
            ">
              ${title}${vehicleTypeInfo}
            </div>
          </div>
          <button onclick="
                    const iwOuter = this.closest('.gm-style-iw');
                    const iwContainer = this.closest('.gm-style-iw-c');
                    const iwBackground = document.querySelector('.gm-style-iw-d');
                    const iwTail = document.querySelector('.gm-style-iw-t');
                    
                    if (iwOuter) iwOuter.style.display = 'none';
                    if (iwContainer) iwContainer.style.display = 'none';
                    if (iwBackground) iwBackground.style.display = 'none';
                    if (iwTail) iwTail.style.display = 'none';
                    
                    setTimeout(() => {
                      if (iwOuter && iwOuter.parentNode) iwOuter.parentNode.removeChild(iwOuter);
                      if (iwContainer && iwContainer.parentNode) iwContainer.parentNode.removeChild(iwContainer);
                      if (iwBackground && iwBackground.parentNode) iwBackground.parentNode.removeChild(iwBackground);
                      if (iwTail && iwTail.parentNode) iwTail.parentNode.removeChild(iwTail);
                    }, 50);" 
                  style="
                    background: none; 
                    border: none; 
                    color: #666; 
                    width: 20px; 
                    height: 20px; 
                    cursor: pointer; 
                    font-size: 16px; 
                    line-height: 1; 
                    margin-left: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                  "
                  onmouseover="this.style.color='#333'"
                  onmouseout="this.style.color='#666'">
            ×
          </button>
        </div>
        
        <!-- Contenido minimalista -->
        <div style="padding: 12px;">
          <div style="
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            margin-bottom: 10px; 
           
          ">
            <span style="color: #666; font-size: 13px;">Velocidad</span>
            <span style="color: #333; font-weight: 600; font-size: 18px;">${this.formatSpeedDisplay(popupSpeed)}</span>
          </div>
          
          <div style="
            display: flex; 
            align-items: center; 
            
            gap: 8px;
          ">
            <span style="
              width: 8px; 
              height: 8px; 
              border-radius: 50%; 
              background: ${popupStatus === 'online' ? '#4CAF50' : '#F44336'};
            "></span>
            <span style="
              color: #666; 
              font-size: 13px;
            ">
              ${popupStatus === 'online' ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
        </div>
      </div>
    `;
    
    // Crear InfoWindow minimalista
    const infoWindow = new google.maps.InfoWindow({
      content: infoContent,
      disableAutoPan: false,
      maxWidth: 280
    });
    
    // Ocultar botones por defecto de Google Maps
    google.maps.event.addListener(infoWindow, 'domready', () => {
      const closeBtns = document.querySelectorAll('.gm-ui-hover-effect, [title="Close"], [aria-label="Close"]');
      closeBtns.forEach((btn: any) => {
        if (btn && btn.style) {
          btn.style.display = 'none';
        }
      });
    });
    
      // Cerrar otros InfoWindows abiertos antes de abrir el nuevo
      this.currentMarkers.forEach((m: any) => {
        if (m.infoWindow) {
          m.infoWindow.close();
        }
      });
      
      // Guardar referencia del InfoWindow en el marcador
      (marker as any).infoWindow = infoWindow;
      
    // Abrir automáticamente el InfoWindow
    infoWindow.open(this.map, marker);
    
    // Mantener el evento click para re-abrir si se cierra
    marker.addListener('click', () => {
      infoWindow.open(this.map, marker);
    });
  }
  
  // Método para agregar marcador en Mapbox
  private addMapboxMarker(lng: number, lat: number, title: string): void {
    if (!this.map) return;
    
    const mapboxgl = (window as any).mapboxgl;
    if (!mapboxgl) return;
    
    // Crear elemento personalizado para el marcador
    const markerElement = document.createElement('div');
    markerElement.style.width = '20px';
    markerElement.style.height = '20px';
    markerElement.style.borderRadius = '50%';
    markerElement.style.backgroundColor = '#FF0000';
    markerElement.style.border = '2px solid #FFFFFF';
    markerElement.style.cursor = 'pointer';
    
    const marker = new mapboxgl.Marker(markerElement)
      .setLngLat([lng, lat])
      .addTo(this.map);
    
    // Guardar referencia del marcador para poder eliminarlo después
    this.currentMarkers.push(marker);
    
    // Establecer la posición inicial para futuras animaciones
    this.lastPosition = { lat: lat, lng: lng };
    
    // Obtener información adicional del target
    const popupSpeedInKnots = this.selectedTarget?.traccarInfo?.geolocation?.speed || 0;
    const popupSpeed = this.convertKnotsToKmh(popupSpeedInKnots);
    const popupStatus = this.selectedTarget?.traccarInfo?.status || 'desconocido';
    const speedUnit = 'km/h';
    
    // Console para verificar los datos de velocidad
    console.log('🗺️ DATOS DE VELOCIDAD EN MAPA (MAPBOX):', {
      targetName: title,
      velocidadEnNudos: popupSpeedInKnots,
      velocidadEnKmh: popupSpeed,
      conversionAplicada: popupSpeedInKnots > 0 ? `${popupSpeedInKnots} nudos → ${this.formatSpeedDisplay(popupSpeed)}` : 'Sin velocidad',
      rutaCompleta: 'traccarInfo.geolocation.speed',
      traccarInfo: this.selectedTarget?.traccarInfo,
      geolocation: this.selectedTarget?.traccarInfo?.geolocation,
      geolocationAttributes: this.selectedTarget?.traccarInfo?.geolocation?.attributes,
      possibleSpeedPaths: {
        'geolocation.speed': this.selectedTarget?.traccarInfo?.geolocation?.speed,
        'geolocation.velocity': this.selectedTarget?.traccarInfo?.geolocation?.velocity,
        'geolocation.attributes.speed': this.selectedTarget?.traccarInfo?.geolocation?.attributes?.speed,
        'geolocation.attributes.velocity': this.selectedTarget?.traccarInfo?.geolocation?.attributes?.velocity,
        'traccarInfo.geolocation.speed': this.selectedTarget?.traccarInfo?.geolocation?.speed
      },
      allGeolocationProps: this.selectedTarget?.traccarInfo?.geolocation ? Object.keys(this.selectedTarget.traccarInfo.geolocation) : [],
      speedFound: !!this.selectedTarget?.traccarInfo?.geolocation?.speed
    });
    
    // Obtener tipo de vehículo si está disponible
    let vehicleTypeInfo = '';
    if (this.vehicleTypeGetter && this.selectedTarget?.model) {
      const vehicleType = this.vehicleTypeGetter(this.selectedTarget.model);
      if (vehicleType && vehicleType !== 'Desconocido') {
        vehicleTypeInfo = `<span style="color: #9C27B0; font-size: 11px; margin-left: 4px;">(${vehicleType})</span>`;
      }
    }
    
    // Crear contenido del popup con el MISMO diseño que Google Maps
    const popupContent = `
      <div id="custom-info-window" style="
        font-family: 'Segoe UI', sans-serif; 
        width: 215px;
        background: white; 
        border: 1px solid #e0e0e0;
        border-radius: 4px; 
        margin-right: 15px;
        margin-bottom: 10px;
      ">
        <!-- Header minimalista -->
        <div style="
          background: #f8f9fa; 
          color: #333; 
          padding: 10px 12px; 
          display: flex; 
          justify-content: space-between; 
          align-items: center;
          border-bottom: 1px solid #e0e0e0;
        ">
          <div style="flex: 1; min-width: 0;">
            <div style="
              font-size: 14px; 
              font-weight: 500; 
              color: #333;
              white-space: nowrap; 
              overflow: hidden; 
              text-overflow: ellipsis;
            ">
              ${title}${vehicleTypeInfo}
        </div>
          </div>
          <button onclick="
                    this.closest('.mapboxgl-popup').style.display = 'none';
                    setTimeout(() => { 
                      const popup = this.closest('.mapboxgl-popup'); 
                      if (popup && popup.parentNode) popup.parentNode.removeChild(popup); 
                    }, 50);" 
                  style="
                    background: none; 
                    border: none; 
                    color: #666; 
                    width: 20px; 
                    height: 20px; 
                    cursor: pointer; 
                    font-size: 16px; 
                    line-height: 1; 
                    margin-left: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                  "
                  onmouseover="this.style.color='#333'"
                  onmouseout="this.style.color='#666'">
            ×
          </button>
        </div>
        
        <!-- Contenido minimalista -->
        <div style="padding: 12px;">
          <div style="
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            margin-bottom: 10px; 
          ">
            <span style="color: #666; font-size: 13px;">Velocidad</span>
            <span style="color: #333; font-weight: 600; font-size: 18px;">${this.formatSpeedDisplay(popupSpeed)}</span>
          </div>
          
          <div style="
            display: flex; 
            align-items: center; 
            gap: 8px;
          ">
            <span style="
              width: 8px; 
              height: 8px; 
              border-radius: 50%; 
              background: ${popupStatus === 'online' ? '#4CAF50' : '#F44336'};
            "></span>
            <span style="
              color: #666; 
              font-size: 13px;
            ">
              ${popupStatus === 'online' ? 'Conectado' : 'Desconectado'}
          </span>
          </div>
        </div>
      </div>
    `;
    
    // Agregar popup con configuración personalizada
    const popup = new mapboxgl.Popup({ 
      offset: 25, // Volver al offset original
      closeButton: false, // Deshabilitamos el botón por defecto para usar el nuestro
      closeOnClick: false // Evitamos que se cierre al hacer click fuera
    })
      .setHTML(popupContent);
    
    marker.setPopup(popup);
    
    // Abrir automáticamente el popup
    marker.togglePopup();
  }

  // Método para limpiar completamente el mapa
  private destroyMap(): void {
    if (!this.map) return;
    
    try {
      // Limpiar marcadores primero
      this.clearExistingMarkers();
      
      if (this.provider === 'google') {
        // Para Google Maps, no hay un método específico de destroy
        // Solo limpiar las referencias
        this.map = null;
      } else if (this.provider === 'mapbox') {
        // Para Mapbox, usar el método remove
        if (this.map.remove && typeof this.map.remove === 'function') {
          this.map.remove();
        }
        this.map = null;
      }
    } catch (error) {
      console.error('Error al limpiar el mapa:', error);
      this.map = null;
    }
  }

  ngOnDestroy(): void {
    // Cancelar cualquier movimiento paso a paso en progreso
    if (this.animationFrameId) {
      clearTimeout(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    this.destroyMap();
  }
}