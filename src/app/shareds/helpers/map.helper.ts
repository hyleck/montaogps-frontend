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
        script.src = provider === 'google' ? `${url}${key}` : `${url}?access_token=${key}`;
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

  static addMarker(map: any, provider: 'google' | 'mapbox', lat: number, lng: number, title: string = '', info: string = ''): any {
    
    if (provider === 'google') {
      const marker = new google.maps.Marker({
        position: { lat, lng },
        map: map,
        title: title,
        icon: {
          url: 'data:image/svg+xml;base64,' + btoa(`
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="12" fill="#22c55e" stroke="#fff" stroke-width="2"/>
              <circle cx="16" cy="16" r="6" fill="#fff"/>
            </svg>
          `),
          scaledSize: new google.maps.Size(32, 32),
          anchor: new google.maps.Point(16, 16)
        }
      });

      if (info) {
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div class="custom-popup">
              <div class="popup-header">
                <div class="popup-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                </div>
                <h3 class="popup-title">${title}</h3>
                <div class="popup-status online">
                  <div class="status-dot"></div>
                  <span>En línea</span>
                </div>
              </div>
              <div class="popup-content">
                <div class="popup-info-item">
                  <div class="info-icon">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2">
                      <path d="M12 2v10l8-8z"></path>
                      <path d="M2 12h20"></path>
                      <path d="M12 22v-10l8 8z"></path>
                    </svg>
                  </div>
                  <div class="info-content">
                    <span class="info-label">Velocidad</span>
                    <span class="info-value">0 km/h</span>
                  </div>
                </div>
                <div class="popup-info-item expandable" onclick="toggleDetails(this)">
                  <div class="info-icon">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2">
                      <circle cx="12" cy="12" r="3"></circle>
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2 2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                  </div>
                  <div class="info-content">
                    <span class="info-label">Más información</span>
                    <svg class="expand-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2">
                      <polyline points="6,9 12,15 18,9"></polyline>
                    </svg>
                  </div>
                </div>
                <div class="popup-details">
                  <div class="detail-item">
                    <span class="detail-label">IMEI:</span>
                    <span class="detail-value">${info.split('<br/>')[0].replace('IMEI: ', '')}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Estado:</span>
                    <span class="detail-value">${info.split('<br/>')[1] ? info.split('<br/>')[1].replace('Estado: ', '') : 'desconocido'}</span>
                  </div>
                </div>
                <div class="popup-footer">
                  <button class="popup-close-btn" onclick="this.closest('.gm-style-iw').parentElement.style.display='none'">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          `
        });
        
        // Abrir popup automáticamente
        infoWindow.open(map, marker);
        
        marker.addListener('click', () => {
          infoWindow.open(map, marker);
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
        background: #22c55e;
        border: 2px solid #fff;
        border-radius: 50%;
        cursor: pointer;
        position: relative;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      `;
      
      // Agregar punto central
      const centerDot = document.createElement('div');
      centerDot.style.cssText = `
        width: 12px;
        height: 12px;
        background: #fff;
        border-radius: 50%;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      `;
      markerElement.appendChild(centerDot);

      const marker = new mapboxgl.Marker(markerElement)
        .setLngLat([lng, lat])
        .addTo(map);

      if (info) {
        const popup = new mapboxgl.Popup({ offset: 25 })
          .setHTML(`
            <div class="custom-popup">
              <div class="popup-header">
                <div class="popup-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                </div>
                <h3 class="popup-title">${title}</h3>
                <div class="popup-status online">
                  <div class="status-dot"></div>
                  <span>En línea</span>
                </div>
              </div>
              <div class="popup-content">
                <div class="popup-info-item">
                  <div class="info-icon">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2">
                      <path d="M12 2v10l8-8z"></path>
                      <path d="M2 12h20"></path>
                      <path d="M12 22v-10l8 8z"></path>
                    </svg>
                  </div>
                  <div class="info-content">
                    <span class="info-label">Velocidad</span>
                    <span class="info-value">0 km/h</span>
                  </div>
                </div>
                <div class="popup-info-item expandable" onclick="toggleDetails(this)">
                  <div class="info-icon">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2">
                      <circle cx="12" cy="12" r="3"></circle>
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2 2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                  </div>
                  <div class="info-content">
                    <span class="info-label">Más información</span>
                    <svg class="expand-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2">
                      <polyline points="6,9 12,15 18,9"></polyline>
                    </svg>
                  </div>
                </div>
                <div class="popup-details">
                  <div class="detail-item">
                    <span class="detail-label">IMEI:</span>
                    <span class="detail-value">${info.split('<br/>')[0].replace('IMEI: ', '')}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Estado:</span>
                    <span class="detail-value">${info.split('<br/>')[1] ? info.split('<br/>')[1].replace('Estado: ', '') : 'desconocido'}</span>
                  </div>
                </div>
                <div class="popup-footer">
                  <button class="popup-close-btn" onclick="this.closest('.mapboxgl-popup').style.display='none'">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          `);
        
        marker.setPopup(popup);
        
        // Abrir popup automáticamente
        marker.togglePopup();
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