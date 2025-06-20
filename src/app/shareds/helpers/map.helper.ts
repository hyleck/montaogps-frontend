export class MapUtils {
    static getApiConfig(systems: any[], provider: 'google' | 'mapbox') {
      if (!systems?.length) return null;
      const mapConfig = provider === 'google' ? systems[0].map_api1 : systems[0].map_api2;
      return mapConfig?.key && mapConfig?.url ? mapConfig : null;
    }
  
      static loadMapScript(provider: 'google' | 'mapbox', key: string, url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`Loading ${provider} script...`);
      
      if (provider === 'google' && typeof google !== 'undefined' && google.maps) {
        console.log('Google Maps already loaded');
        return resolve();
      }
      if (provider === 'mapbox' && (window as any).mapboxgl) {
        console.log('Mapbox already loaded');
        return resolve();
      }

      if (!key || !url) return reject('Clave/API URL no válidas');

      // Limpiar scripts anteriores del proveedor opuesto
      MapUtils.cleanupPreviousScripts(provider);

      if (provider === 'mapbox') {
        // Asegurar que el CSS de Mapbox esté cargado
        const existingLink = document.querySelector('link[href*="mapbox-gl.css"]');
        if (!existingLink) {
          console.log('Loading Mapbox CSS...');
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css';
          document.head.appendChild(link);
        }
      }

      // Verificar si el script ya existe antes de crearlo
      const existingScript = document.querySelector(`script[src*="${provider === 'google' ? 'maps.googleapis.com' : 'mapbox-gl.js'}"]`);
      if (existingScript) {
        console.log(`${provider} script already exists in DOM`);
        setTimeout(() => resolve(), 100);
        return;
      }

      const script = document.createElement('script');
      script.src = provider === 'google' ? `${url}${key}` : `${url}?access_token=${key}`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        console.log(`${provider} script loaded successfully`);
        setTimeout(() => resolve(), 200); // Mayor delay para asegurar que esté disponible
      };
      script.onerror = err => {
        console.error(`Error loading ${provider} script:`, err);
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
      const centerLat = selectedTarget?.traccarInfo?.geolocation?.latitude ?? 19.4326;
      const centerLng = selectedTarget?.traccarInfo?.geolocation?.longitude ?? -99.1332;
      const zoomLevel = selectedTarget?.traccarInfo?.geolocation ? 16 : 12;
      return { centerLat, centerLng, zoomLevel };
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
      if (provider === 'google') {
        map.setCenter({ lat, lng });
        map.setZoom(16);
      } else {
        map.setCenter([lng, lat]);
        map.setZoom(16);
      }
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