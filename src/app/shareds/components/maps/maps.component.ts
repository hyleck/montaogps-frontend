import { Component, OnInit, OnChanges, SimpleChanges, Input } from '@angular/core';
import { ThemesService } from '../../services/themes.service';
import { StatusService } from '../../services/status.service';
import { SystemService, SystemSettings } from '../../../core/services/system.service';

@Component({
    selector: 'app-maps',
    templateUrl: './maps.component.html',
    styleUrls: ['./maps.component.css'],
    standalone: false
})
export class MapsComponent implements OnInit, OnChanges {
  @Input() provider: 'google' | 'mapbox' = 'google';
  @Input() theme: 'dark' | 'light' = 'dark';
  @Input() selectedTarget: any = null;
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
    // Verificar si cambió el tema
    if (this.map && changes['theme']) {
      console.log('🎨 Tema cambió, actualizando estilo del mapa');
      this.updateMapTheme();
    }
    
    // Solo proceder si el mapa ya está inicializado y selectedTarget cambió
    if (this.map && changes['selectedTarget']) {
      console.log('🔄 Target seleccionado cambió, actualizando mapa');
      
      // Verificar si solo cambió la posición (mismo target, nueva ubicación)
      const previousTarget = changes['selectedTarget'].previousValue;
      const currentTarget = changes['selectedTarget'].currentValue;
      
      if (previousTarget && currentTarget && 
          previousTarget._id === currentTarget._id &&
          this.currentMarkers.length > 0) {
        // Solo actualizar posición del marcador existente
        console.log('🎯 Actualizando solo posición del marcador existente');
        this.updateMarkerPosition();
      } else {
        // Crear nuevo marcador o cambio completo de target
        console.log('🆕 Creando nuevo marcador');
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
       console.log('Centrando mapa en target:', this.selectedTarget.name, centerLat, centerLng);
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
    
    if (this.provider === 'google') {
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
      
      console.log('✅ Tema de Google Maps actualizado a:', this.theme);
      
    } else if (this.provider === 'mapbox') {
      // Para Mapbox, cambiar el estilo completo
      const newStyle = this.theme === 'dark'
        ? 'mapbox://styles/mapbox/dark-v10'
        : 'mapbox://styles/mapbox/streets-v11';
      
      // Guardar información del marcador actual si existe
      const shouldRestoreMarker = this.currentMarkers.length > 0 && this.selectedTarget;
      let markerLat: number | undefined, markerLng: number | undefined, markerTitle: string | undefined;
      
      if (shouldRestoreMarker) {
        markerLat = this.selectedTarget.traccarInfo?.geolocation?.latitude;
        markerLng = this.selectedTarget.traccarInfo?.geolocation?.longitude;
        markerTitle = this.selectedTarget.name;
      }
      
      // Cambiar el estilo
      this.map.setStyle(newStyle);
      
      // Re-añadir marcador después de que se cargue el nuevo estilo
      if (shouldRestoreMarker && markerLat && markerLng && markerTitle) {
        this.map.once('style.load', () => {
          this.currentMarkers = []; // Limpiar referencias viejas
          this.addMapboxMarker(markerLng!, markerLat!, markerTitle!);
          console.log('🔄 Marcador restaurado después del cambio de estilo');
        });
      }
      
      console.log('✅ Tema de Mapbox actualizado a:', this.theme, 'con estilo:', newStyle);
    }
  }

  // Método para actualizar solo la posición del marcador existente
  private updateMarkerPosition(): void {
    if (!this.map || !this.selectedTarget || this.currentMarkers.length === 0) return;
    
    // Obtener las nuevas coordenadas
    const newLat = this.selectedTarget.traccarInfo?.geolocation?.latitude;
    const newLng = this.selectedTarget.traccarInfo?.geolocation?.longitude;
    
    if (!newLat || !newLng) {
      console.warn('❌ No se encontraron coordenadas válidas para actualizar posición');
      return;
    }
    
    console.log('📍 Actualizando posición del marcador a:', newLat, newLng);
    
    // Obtener nueva velocidad para actualizar etiquetas
    const newSpeed = this.selectedTarget.traccarInfo?.['speed'] || 0;
    const newStatus = this.selectedTarget.traccarInfo?.status || 'desconocido';
    
    // Actualizar posición según el proveedor
    if (this.provider === 'google') {
      // Para Google Maps - actualizar posición suavemente
      const marker = this.currentMarkers[0];
      if (marker && marker.setPosition) {
        // Actualizar posición sin recrear el marcador
        marker.setPosition({ lat: newLat, lng: newLng });
        
        // Actualizar título del marcador con nueva velocidad
        marker.setTitle(`${this.selectedTarget.name} - ${Math.round(newSpeed)} km/h`);
        
        console.log('✅ Posición actualizada en Google Maps (sin recrear marcador)');
      }
    } else if (this.provider === 'mapbox') {
      // Para Mapbox - actualizar posición suavemente
      const marker = this.currentMarkers[0];
      if (marker && marker.setLngLat) {
        // Actualizar posición sin modificar el marcador
        marker.setLngLat([newLng, newLat]);
        console.log('✅ Posición actualizada en Mapbox');
      }
    }
  }

  // Método para actualizar el mapa cuando cambia el target seleccionado
  private updateMapWithNewTarget(): void {
    if (!this.map) return;
    
    console.log('🔄 Actualizando mapa con nuevo target:', this.selectedTarget);
    
    // Limpiar marcadores existentes
    this.clearExistingMarkers();
    
    // Si hay un target seleccionado con geolocalización
    if (this.selectedTarget?.traccarInfo?.geolocation?.latitude && 
        this.selectedTarget?.traccarInfo?.geolocation?.longitude) {
      
      const lat = this.selectedTarget.traccarInfo.geolocation.latitude;
      const lng = this.selectedTarget.traccarInfo.geolocation.longitude;
      
      console.log('🎯 Centrando mapa en nuevo target:', this.selectedTarget.name, lat, lng);
      
      // Centrar el mapa en las nuevas coordenadas
      if (this.provider === 'google') {
        this.map.setCenter({ lat: lat, lng: lng });
        this.map.setZoom(16);
        this.addGoogleMarker(lat, lng, this.selectedTarget.name);
      } else if (this.provider === 'mapbox') {
        this.map.setCenter([lng, lat]);
        this.map.setZoom(16);
        this.addMapboxMarker(lng, lat, this.selectedTarget.name);
      }
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
      title: `${title} - ${Math.round(markerSpeed)} km/h`,
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
    const speedUnit = 'km/h'; // Puedes cambiar esto según tu configuración
    
    // Crear contenido de la ventana de información con velocidad
    const infoContent = `
      <div style="font-family: Arial, sans-serif; min-width: 200px; color: #000000;">
        <h4 style="margin: 0 0 10px 0; color: #000000; font-size: 16px;">
          <strong>${title}</strong>
        </h4>
        <div style="margin-bottom: 5px; color: #000000;">
          <strong style="color: #000000;">🚗 Velocidad:</strong> 
          <span style="color: #2196F3; font-weight: bold;">${popupSpeed} ${speedUnit}</span>
        </div>
        <div style="margin-bottom: 5px; color: #000000;">
          <strong style="color: #000000;">📡 Estado:</strong> 
          <span style="color: ${popupStatus === 'online' ? '#4CAF50' : '#F44336'}; font-weight: bold;">
            ${popupStatus === 'online' ? '🟢 En línea' : '🔴 Desconectado'}
          </span>
        </div>
      </div>
    `;
    
    // Agregar ventana de información
    const infoWindow = new google.maps.InfoWindow({
      content: infoContent
    });
    
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
    
    // Obtener información adicional del target
    const speed = this.selectedTarget?.traccarInfo?.['speed'] || 0;
    const status = this.selectedTarget?.traccarInfo?.status || 'desconocido';
    const speedUnit = 'km/h'; // Puedes cambiar esto según tu configuración
    
    // Crear contenido del popup con velocidad
    const popupContent = `
      <div style="font-family: Arial, sans-serif; min-width: 200px; color: #000000;">
        <h4 style="margin: 0 0 10px 0; color: #000000; font-size: 16px;">
          <strong>${title}</strong>
        </h4>
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
}
