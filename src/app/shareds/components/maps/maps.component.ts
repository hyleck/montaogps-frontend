import { Component, OnInit, Input } from '@angular/core';
import { ThemesService } from '../../services/themes.service';
import { StatusService } from '../../services/status.service';
import { SystemService, SystemSettings } from '../../../core/services/system.service';

@Component({
    selector: 'app-maps',
    templateUrl: './maps.component.html',
    styleUrls: ['./maps.component.css'],
    standalone: false
})
export class MapsComponent implements OnInit {
  @Input() provider: 'google' | 'mapbox' = 'google';
  @Input() theme: 'dark' | 'light' = 'dark';
  map: any;
  apiKey: string = '';
  apiUrl: string = '';

  constructor(
    private _theme: ThemesService,
    private _status: StatusService,
    private systemService: SystemService
  ) {
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
        center: { lat: 19.4326, lng: -99.1332 },
        zoom: 12,
        styles: this.theme === 'dark' ? darkTheme : [],
      });
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
        center: [-99.1332, 19.4326],
        zoom: 12
      });
    }
  }
}
