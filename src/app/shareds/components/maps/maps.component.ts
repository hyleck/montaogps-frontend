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
  @Input() provider: 'google' | 'mapbox' = 'google';
  @Input() theme: 'dark' | 'light' = 'dark';
  @Input() selectedTarget: any = null;
  @Input() vehicleTypeGetter: ((modelId: string) => string) | null = null;
  map: any;
  apiKey: string = '';
  apiUrl: string = '';
  private currentMarkers: any[] = []; // Array para guardar marcadores actuales

  constructor(
    private _theme: ThemesService,
    private _status: StatusService,
    private systemService: SystemService
  ) {
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
    
    if (this.provider === 'google' && this.currentMarkers.length > 0) {
      // Actualizar posición del marcador en Google Maps
      const marker = this.currentMarkers[0];
      const newPosition = new google.maps.LatLng(newLat, newLng);
      marker.setPosition(newPosition);
    } else if (this.provider === 'mapbox' && this.currentMarkers.length > 0) {
      // Actualizar posición del marcador en Mapbox
      const marker = this.currentMarkers[0];
        marker.setLngLat([newLng, newLat]);
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
    const markerSpeed = this.selectedTarget?.traccarInfo?.['speed'] || 0;
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
    
    // Obtener información adicional del target para el popup
    const popupSpeed = this.selectedTarget?.traccarInfo?.['speed'] || 0;
    const popupStatus = this.selectedTarget?.traccarInfo?.status || 'desconocido';
    const speedUnit = 'km/h';
    
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
          <button onclick="this.closest('#custom-info-window').parentElement.parentElement.parentElement.style.display='none'" 
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
            <span style="color: #333; font-weight: 600; font-size: 18px;">${Math.round(popupSpeed)} ${speedUnit}</span>
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
    
    marker.addListener('click', () => {
      // Cerrar otros InfoWindows abiertos antes de abrir el nuevo
      this.currentMarkers.forEach((m: any) => {
        if (m.infoWindow) {
          m.infoWindow.close();
        }
      });
      
      // Guardar referencia del InfoWindow en el marcador
      (marker as any).infoWindow = infoWindow;
      
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
    
    // Obtener información adicional del target
    const speed = this.selectedTarget?.traccarInfo?.['speed'] || 0;
    const status = this.selectedTarget?.traccarInfo?.status || 'desconocido';
    const speedUnit = 'km/h'; // Puedes cambiar esto según tu configuración
    
    // Obtener tipo de vehículo si está disponible
    let vehicleTypeInfo = '';
    if (this.vehicleTypeGetter && this.selectedTarget?.model) {
      const vehicleType = this.vehicleTypeGetter(this.selectedTarget.model);
      if (vehicleType && vehicleType !== 'Desconocido') {
        vehicleTypeInfo = `
          <div style="margin-bottom: 5px; color: #000000;">
            <strong style="color: #000000;">🚙 Tipo:</strong> 
            <span style="color: #9C27B0; font-weight: bold;">${vehicleType}</span>
          </div>`;
      }
    }
    
    // Crear contenido del popup con velocidad
    const popupContent = `
      <div style="font-family: Arial, sans-serif; min-width: 200px; color: #000000;">
        <h4 style="margin: 0 0 10px 0; color: #000000; font-size: 16px;">
          <strong>${title}</strong>
        </h4>
        ${vehicleTypeInfo}
        <div style="margin-bottom: 5px; color: #000000;">
          <strong style="color: #000000;">🚗 Velocidad:</strong> 
          <span style="color: #2196F3; font-weight: bold;">${speed} ${speedUnit}</span>
        </div>
        <div style="margin-bottom: 5px; color: #000000;">
          <strong style="color: #000000;">📡 Estado:</strong> 
          <span style="color: ${status === 'online' ? '#4CAF50' : '#F44336'}; font-weight: bold;">
            ${status === 'online' ? '🟢 En línea' : '🔴 Desconectado'}
          </span>
        </div>
      </div>
    `;
    
    // Agregar popup
    const popup = new mapboxgl.Popup({ offset: 25 })
      .setHTML(popupContent);
    
    marker.setPopup(popup);
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
    this.destroyMap();
  }
}
