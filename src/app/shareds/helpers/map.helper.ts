export class MapUtils {
  static getApiConfig(systems: any[], provider: 'google' | 'mapbox') {
    if (!systems?.length) return null;
    const mapConfig = provider === 'google' ? systems[0].map_api1 : systems[0].map_api2;
    return mapConfig?.key && mapConfig?.url ? mapConfig : null;
  }

  static loadMapScript(provider: 'google' | 'mapbox', key: string, url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // console.log(`Loading ${provider} script...`);

      if (provider === 'google' && typeof google !== 'undefined' && google.maps) {
        // console.log('Google Maps already loaded');
        return resolve();
      }
      if (provider === 'mapbox' && (window as any).mapboxgl) {
        // console.log('Mapbox already loaded');
        return resolve();
      }

      if (!key || !url) return reject('Clave/API URL no válidas');

      // Limpiar scripts anteriores del proveedor opuesto
      MapUtils.cleanupPreviousScripts(provider);

      if (provider === 'mapbox') {
        // Asegurar que el CSS de Mapbox esté cargado
        const existingLink = document.querySelector('link[href*="mapbox-gl.css"]');
        if (!existingLink) {
          // console.log('Loading Mapbox CSS...');
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css';
          document.head.appendChild(link);
        }
      }

      // Verificar si el script ya existe antes de crearlo
      const existingScript = document.querySelector(`script[src*="${provider === 'google' ? 'maps.googleapis.com' : 'mapbox-gl.js'}"]`);
      if (existingScript) {
        // console.log(`${provider} script already exists in DOM`);
        setTimeout(() => resolve(), 100);
        return;
      }

      const script = document.createElement('script');
      script.src = provider === 'google' ? `${url}${key}&libraries=drawing` : `${url}?access_token=${key}`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        // console.log(`${provider} script loaded successfully`);
        setTimeout(() => resolve(), 200); // Mayor delay para asegurar que esté disponible
      };
      script.onerror = err => {
        // console.error(`Error loading ${provider} script:`, err);
        reject(err);
      };
      document.head.appendChild(script);
    });
  }

  static cleanupPreviousScripts(currentProvider: 'google' | 'mapbox'): void {
    // Cuando cambiamos a Google Maps, no necesitamos limpiar Mapbox porque puede coexistir
    // Cuando cambiamos a Mapbox, no necesitamos limpiar Google Maps porque puede coexistir
    // Solo reiniciamos las variables globales si es necesario

    if (currentProvider === 'mapbox') {
      // Reiniciar cualquier configuración específica de Google Maps si es necesario
    } else {
      // Reiniciar cualquier configuración específica de Mapbox si es necesario
    }
  }

  static getInitialMapCenter(selectedTarget: any) {
    // Centro por defecto: República Dominicana
    const defaultLat = 18.7357;
    const defaultLng = -70.1627;
    const defaultZoom = 7;

    if (selectedTarget?.traccarInfo?.geolocation) {
      return {
        centerLat: selectedTarget.traccarInfo.geolocation.latitude,
        centerLng: selectedTarget.traccarInfo.geolocation.longitude,
        zoomLevel: 16,
      };
    }

    return { centerLat: defaultLat, centerLng: defaultLng, zoomLevel: defaultZoom };
  }

  static createMap(provider: 'google' | 'mapbox', element: HTMLElement, key: string, theme: 'dark' | 'light', lat: number, lng: number, zoom: number): any {
    if (provider === 'google') {
      return new google.maps.Map(element, {
        center: { lat, lng },
        zoom,
        styles: theme === 'dark' ? MapUtils.googleDarkTheme() : []
      });
    }

    const mapboxgl = (window as any).mapboxgl;
    return new mapboxgl.Map({
      container: element,
      accessToken: key,
      style: theme === 'dark' ? 'mapbox://styles/mapbox/dark-v10' : 'mapbox://styles/mapbox/streets-v11',
      center: [lng, lat],
      zoom
    });
  }

  static recenterMap(map: any, provider: 'google' | 'mapbox', lat: number, lng: number) {
    // console.log('🎯 MapUtils.recenterMap EJECUTADO:', {
    //   provider,
    //   lat: lat.toFixed(6),
    //   lng: lng.toFixed(6),
    //   coordsFormatted: `${lat.toFixed(6)}, ${lng.toFixed(6)}`
    // });

    if (provider === 'google') {
      // console.log('🗺️ Centrando Google Maps en:', { lat, lng });
      map.setCenter({ lat, lng });
      map.setZoom(16);
    } else {
      // console.log('🗺️ Centrando Mapbox en:', [lng, lat]);
      map.setCenter([lng, lat]);
      map.setZoom(16);
    }

    // console.log('✅ MapUtils.recenterMap COMPLETADO');
  }

  static recenterMapIfOutOfView(map: any, provider: 'google' | 'mapbox', lat: number, lng: number) {
    if (!map) return;

    if (provider === 'google') {
      const bounds = map.getBounds();

      if (!bounds) return;

      const markerLatLng = new google.maps.LatLng(lat, lng);

      // Verificar si el marcador está fuera de los límites visibles
      if (!bounds.contains(markerLatLng)) {
        map.panTo({ lat, lng });
      }
    } else {
      // Mapbox
      const bounds = map.getBounds();

      if (!bounds) return;

      // Verificar si el marcador está fuera de los límites visibles
      if (lng < bounds.getWest() || lng > bounds.getEast() ||
        lat < bounds.getSouth() || lat > bounds.getNorth()) {
        map.setCenter([lng, lat]);
      }
    }
  }

  static addMarker(
    map: any,
    provider: 'google' | 'mapbox',
    lat: number,
    lng: number,
    title: string = '',
    info: string = '',
    iconUrl?: string,
    openByDefault: boolean = true,
  ): any {

    const fallbackIcon =
      'data:image/svg+xml;base64,' +
      btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="12" fill="#22c55e" stroke="#fff" stroke-width="2"/>
          <circle cx="16" cy="16" r="6" fill="#fff"/>
        </svg>
      `);
    const markerIcon = iconUrl || fallbackIcon;

    if (provider === 'google') {
      const marker = new google.maps.Marker({
        position: { lat, lng },
        map: map,
        title: title,
        icon: {
          url: markerIcon,
          scaledSize: new google.maps.Size(32, 32),
          anchor: new google.maps.Point(16, 16)
        }
      });

      if (info) {
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="font-size: 11px; line-height: 1.2; color: #111; min-width: 160px; padding: 6px 8px;">
              <div style="font-weight: 700; font-size: 11px; margin-bottom: 3px; color: ${info?.toLowerCase() === 'online' ? '#16a34a' : '#111'};">${title || 'Target'}</div>
              <div style="margin-bottom: 2px;">Velocidad: 0 km/h</div>
              <div>Estado: ${info || 'Desconocido'}</div>
            </div>
          `
        });

        let isOpen = openByDefault && info?.toLowerCase() === 'online';

        // Abrir por defecto si está online
        if (isOpen) {
          infoWindow.open(map, marker);
        }

        marker.addListener('click', () => {
          if (isOpen) {
            infoWindow.close();
            isOpen = false;
          } else {
            infoWindow.open(map, marker);
            isOpen = true;
          }
        });

        infoWindow.addListener('closeclick', () => {
          isOpen = false;
        });
      }

      return marker;
    } else {
      const mapboxgl = (window as any).mapboxgl;

      // Crear elemento del marcador
      const markerElement = document.createElement('div');
      markerElement.className = 'custom-marker';
      markerElement.style.cssText = `
        width: 32px;
        height: 32px;
        background-image: url('${markerIcon}');
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
        cursor: pointer;
        position: relative;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      `;

      const marker = new mapboxgl.Marker({ element: markerElement, anchor: 'bottom' })
        .setLngLat([lng, lat])
        .addTo(map);

      if (info) {
        const popup = new mapboxgl.Popup({ offset: 25, closeButton: true })
          .setHTML(`
            <div style="font-size: 11px; line-height: 1.2; color: #111; min-width: 160px; padding: 6px 8px;">
              <div style="font-weight: 700; font-size: 11px; margin-bottom: 3px; color: ${info?.toLowerCase() === 'online' ? '#16a34a' : '#111'};">${title || 'Target'}</div>
              <div style="margin-bottom: 2px;">Velocidad: 0 km/h</div>
              <div>Estado: ${info || 'Desconocido'}</div>
            </div>
          `);

        marker.setPopup(popup);

        // Abrir por defecto si está online y se permite
        if (openByDefault && info?.toLowerCase() === 'online') {
          marker.togglePopup();
        }

        marker.getElement().addEventListener('click', () => {
          popup.isOpen() ? popup.remove() : marker.togglePopup();
        });
      }

      return marker;
    }
  }

  static removeMarker(marker: any, provider: 'google' | 'mapbox'): void {
    if (!marker) return;


    if (provider === 'google') {
      marker.setMap(null);
    } else {
      marker.remove();
    }
  }

  static removeAllMarkers(markers: any[], provider: 'google' | 'mapbox'): void {

    markers.forEach(marker => {
      MapUtils.removeMarker(marker, provider);
    });
  }

  static googleDarkTheme() {
    return [
      { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] }
    ];
  }
} 
