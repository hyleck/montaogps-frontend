import { Component, OnInit } from '@angular/core';
import { ThemesService } from '../../services/themes.service';
import { StatusService } from '../../services/status.service';

@Component({
  selector: 'app-maps',
  templateUrl: './maps.component.html',
  styleUrls: ['./maps.component.css']
})
export class MapsComponent implements OnInit {
  map!: google.maps.Map;
  theme: 'dark' | 'light' = 'dark'; // Cambia este valor a 'light' si deseas el tema claro por defecto

  constructor(private _theme: ThemesService, private _status: StatusService) {
    const currentTheme = this._theme.getCurrentTheme();
    if (currentTheme === 'dark' || currentTheme === 'light') {
      this.theme = currentTheme;
    } else {
      console.warn(`Invalid theme: ${currentTheme}. Falling back to default theme.`);
    }

    this._status.statusChanges$.subscribe(( status:any ) => {
      const currentTheme = this._theme.getCurrentTheme();
      if (currentTheme === 'dark' || currentTheme === 'light') {
       
        if(this.theme !== currentTheme){
          this.theme = currentTheme;
          this.initializeMap();
        }
        
        // inicailizar
       
      } else {
        console.warn(`Invalid theme: ${currentTheme}. Falling back to default theme.`);
      }
    });
  }

  // Definir el tema por defecto como 'light', pero puede ser cambiado dinámicamente

  ngOnInit(): void {
    this.loadGoogleMapsScript().then(() => {
      this.initializeMap();
    });
  }

  private loadGoogleMapsScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof google !== 'undefined' && google.maps) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyDTcpHcDElgnEB8fXzoZ5Ee30H_kpIwEjI`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = (error) => reject(error);
      document.head.appendChild(script);
    });
  }

  private initializeMap(): void {
    const mapElement = document.getElementById('map') as HTMLElement;

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

    // Crear el mapa con el estilo correspondiente
    this.map = new google.maps.Map(mapElement, {
      center: { lat: 19.4326, lng: -99.1332 },
      zoom: 12,
      styles: this.theme === 'dark' ? darkTheme : [], // Si es tema dark, usa los estilos, si no, usa el tema por defecto
    });
  }
}
