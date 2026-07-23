import * as maplibregl from 'maplibre-gl';

export type MapProvider = 'google' | 'mapbox' | 'osm';

export class MapUtils {
  private static isOnlineLikeStatus(status?: string | null): boolean {
    const normalized = (status || '').toLowerCase();
    return normalized === 'online' || normalized === 'señal débil' || normalized === 'senal debil';
  }

  /**
   * Read the user's map marker type preference from localStorage.
   * Returns 'vehicle' for car sprite or 'default' for the classic favicon marker.
   */
  static getMapMarkerType(): 'default' | 'vehicle' {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        const settings = user.settings;
        if (Array.isArray(settings) && settings.length > 0) {
          return settings[0].map_marker_type === 'vehicle' ? 'vehicle' : 'default';
        }
        if (settings && typeof settings === 'object' && !Array.isArray(settings)) {
          return settings.map_marker_type === 'vehicle' ? 'vehicle' : 'default';
        }
      }
    } catch (_) { /* ignore */ }
    return 'default';
  }

  static getApiConfig(systems: any[], provider: MapProvider) {
    if (provider === 'osm') {
      return { key: 'osm', url: 'osm' };
    }
    if (!systems?.length) return null;
    const mapConfig = provider === 'google' ? systems[0].map_api1 : systems[0].map_api2;
    return mapConfig?.key && mapConfig?.url ? mapConfig : null;
  }

  static loadMapScript(provider: MapProvider, key: string, url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // console.log(`Loading ${provider} script...`);

      if (provider === 'osm') {
        return resolve();
      }

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
      script.src = provider === 'google' ? MapUtils.buildGoogleMapsUrl(url, key) : `${url}?access_token=${key}`;
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

  private static buildGoogleMapsUrl(url: string, key: string): string {
    const googleUrl = new URL(url, window.location.origin);
    googleUrl.searchParams.set('key', key);
    const currentLibraries = googleUrl.searchParams.get('libraries') || '';
    const libraries = new Set(
      currentLibraries
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
    );
    libraries.add('drawing');
    libraries.add('places');
    googleUrl.searchParams.set('libraries', Array.from(libraries).join(','));
    return googleUrl.toString();
  }

  static cleanupPreviousScripts(currentProvider: MapProvider): void {
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

  static createMap(provider: MapProvider, element: HTMLElement, key: string, theme: 'dark' | 'light', lat: number, lng: number, zoom: number): any {
    if (provider === 'google') {
      return new google.maps.Map(element, {
        center: { lat, lng },
        zoom,
        styles: theme === 'dark' ? MapUtils.googleDarkTheme() : []
      });
    }

    if (provider === 'osm') {
      const map = new maplibregl.Map({
        container: element,
        style: MapUtils.openStreetMapRasterStyle(),
        center: [lng, lat],
        zoom,
        attributionControl: false
      });
      map.addControl(new maplibregl.NavigationControl(), 'top-right');
      map.addControl(new maplibregl.FullscreenControl(), 'top-right');
      return map;
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

  static getMapLibrary(provider: MapProvider): any {
    return provider === 'osm' ? maplibregl : (window as any).mapboxgl;
  }

  static openStreetMapRasterStyle(): any {
    return {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: [
            'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
            'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
            'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
          ],
          tileSize: 256,
          attribution: '© OpenStreetMap Contributors'
        }
      },
      layers: [
        {
          id: 'osm-layer',
          type: 'raster',
          source: 'osm',
          minzoom: 0,
          maxzoom: 22
        }
      ]
    };
  }

  static recenterMap(map: any, provider: MapProvider, lat: number, lng: number) {
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

  static recenterMapIfOutOfView(map: any, provider: MapProvider, lat: number, lng: number) {
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
    provider: MapProvider,
    lat: number,
    lng: number,
    title: string = '',
    info: string = '',
    iconUrl?: string,
    openByDefault: boolean = true,
    course: number = 0,
  ): any {

    const normalizedInfo = info?.toLowerCase();
    const isOnlineLike = MapUtils.isOnlineLikeStatus(normalizedInfo);
    const isOffline = !isOnlineLike && normalizedInfo !== 'localizado';

    if (provider === 'google') {
      // Build fallback favicon URL based on window location and offline status
      let fallbackIcon = '';
      if (typeof window !== 'undefined') {
        if (isOffline) {
          fallbackIcon = `${window.location.origin}/logo/favicon-gray.png`;
        } else {
          fallbackIcon = `${window.location.origin}/logo/favicon.png`;
        }
      }

      const markerIcon = iconUrl || fallbackIcon;

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
              <div style="font-weight: 700; font-size: 11px; margin-bottom: 3px; color: ${isOnlineLike ? '#16a34a' : (normalizedInfo === 'localizado' ? '#14b8a6' : '#111')};">${title || 'Target'}</div>
              <div style="margin-bottom: 2px;">Velocidad: 0 km/h</div>
              <div>Estado: ${info || 'Desconocido'}</div>
            </div>
          `
        });

        let isOpen = openByDefault && (isOnlineLike || normalizedInfo === 'localizado');

        // Abrir por defecto si está online o localizado
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

      // Async update: replace icon with car sprite once canvas renders (only for vehicle mode)
      const markerType = MapUtils.getMapMarkerType();
      if (markerType === 'vehicle') {
        MapUtils.getCarSpriteIconUrl(course, 40).then(spriteUrl => {
          marker.setIcon({
            url: spriteUrl,
            scaledSize: new google.maps.Size(40, 40),
            anchor: new google.maps.Point(20, 38),
          });
          if (isOffline) {
            marker.setOpacity(0.65);
          }
        }).catch(() => { /* keep fallback icon */ });
      } else {
        if (isOffline) {
          marker.setOpacity(0.65);
        }
      }

      return marker;
    } else {
      const mapboxgl = MapUtils.getMapLibrary(provider);

      const markerType = provider === 'osm' ? 'default' : MapUtils.getMapMarkerType();
      let markerElement: HTMLElement;

      if (markerType === 'vehicle') {
        // Crear elemento del marcador con sprite
        markerElement = MapUtils.createCarSpriteElement(course, isOffline, 40);
      } else {
        // Crear elemento con favicon
        const img = document.createElement('img');
        img.src = `${window.location.origin}/logo/favicon.png`;
        img.style.cssText = `width: 32px; height: 32px; cursor: pointer; filter: ${isOffline ? 'grayscale(100%) brightness(0.75)' : 'none'};`;

        if (provider === 'osm') {
          const wrapper = document.createElement('div');
          wrapper.style.cssText = 'width: 32px; height: 32px; cursor: pointer; position: absolute; top: 0; left: 0; overflow: visible;';
          wrapper.appendChild(img);

          const label = document.createElement('div');
          label.className = 'gps-map-marker-label';
          label.textContent = title || 'Target';
          wrapper.appendChild(label);
          markerElement = wrapper;
        } else {
          markerElement = img;
        }
      }
      markerElement.classList.add('gps-map-marker');
      markerElement.style.zIndex = '20';
      markerElement.style.pointerEvents = 'auto';

      const marker = new mapboxgl.Marker({ element: markerElement, anchor: 'center' })
        .setLngLat([lng, lat])
        .addTo(map);

      if (info) {
        const popup = new mapboxgl.Popup({ offset: 25, closeButton: true })
          .setHTML(`
            <div style="font-size: 11px; line-height: 1.2; color: #111; min-width: 160px; padding: 6px 8px;">
              <div style="font-weight: 700; font-size: 11px; margin-bottom: 3px; color: ${isOnlineLike ? '#16a34a' : (normalizedInfo === 'localizado' ? '#14b8a6' : '#111')};">${title || 'Target'}</div>
              <div style="margin-bottom: 2px;">Velocidad: 0 km/h</div>
              <div>Estado: ${info || 'Desconocido'}</div>
            </div>
          `);

        marker.setPopup(popup);

        // Abrir por defecto si está online o localizado y se permite
        if (openByDefault && (isOnlineLike || normalizedInfo === 'localizado')) {
          marker.togglePopup();
        }

        marker.getElement().addEventListener('click', () => {
          popup.isOpen() ? popup.remove() : marker.togglePopup();
        });
      }

      return marker;
    }
  }

  static removeMarker(marker: any, provider: MapProvider): void {
    if (!marker) return;


    if (provider === 'google') {
      marker.setMap(null);
    } else {
      marker.remove();
    }
  }

  static removeAllMarkers(markers: any[], provider: MapProvider): void {

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

  // ─── Car Sprite helpers ──────────────────────────────────────────
  // Sprite sheet: 6 columns × 4 rows = 24 frames.
  // Calibrated mapping: FRAME_TO_COURSE[frameIndex] = traccar course angle.
  private static readonly SPRITE_COLS = 6;
  private static readonly SPRITE_ROWS = 4;
  private static readonly SPRITE_TOTAL = 24;

  /** Calibrated: each frame's Traccar course angle (user-verified). */
  private static readonly FRAME_TO_COURSE: number[] = [
    240, // Frame 0
    225, // Frame 1
    210, // Frame 2
    195, // Frame 3
    150, // Frame 4
    135, // Frame 5
    120, // Frame 6
    115, // Frame 7
    105, // Frame 8
     75, // Frame 9
     70, // Frame 10
     65, // Frame 11
     60, // Frame 12
     45, // Frame 13
     30, // Frame 14
      0, // Frame 15
    340, // Frame 16
    330, // Frame 17
    315, // Frame 18
    300, // Frame 19
    285, // Frame 20
    270, // Frame 21
    255, // Frame 22
    240, // Frame 23
  ];

  /**
   * Map a 0-360 course angle to the sprite frame index (0-23).
   * Uses the calibrated lookup table and finds the frame with the
   * smallest angular distance to the given course.
   */
  static courseToFrame(course: number): number {
    const c = ((course % 360) + 360) % 360;
    let bestFrame = 0;
    let bestDist = 360;
    for (let i = 0; i < MapUtils.FRAME_TO_COURSE.length; i++) {
      const diff = Math.abs(c - MapUtils.FRAME_TO_COURSE[i]);
      const dist = Math.min(diff, 360 - diff); // shortest angular distance
      if (dist < bestDist) {
        bestDist = dist;
        bestFrame = i;
      }
    }
    return bestFrame;
  }

  /**
   * Return the CSS background-position-x / -y percentages for the given frame.
   * Uses percentage-based positioning so the element can be any display size.
   */
  static getCarSpritePosition(course: number): { bgPosX: string; bgPosY: string } {
    const frame = MapUtils.courseToFrame(course);
    const col = frame % MapUtils.SPRITE_COLS;
    const row = Math.floor(frame / MapUtils.SPRITE_COLS);
    // percentage formula: (col / (cols-1)) * 100  — maps 0..5 ⇒ 0%..100%
    const bgPosX = MapUtils.SPRITE_COLS > 1 ? `${(col / (MapUtils.SPRITE_COLS - 1)) * 100}%` : '0%';
    const bgPosY = MapUtils.SPRITE_ROWS > 1 ? `${(row / (MapUtils.SPRITE_ROWS - 1)) * 100}%` : '0%';
    return { bgPosX, bgPosY };
  }

  /**
   * Create a DOM element styled as a car-sprite marker.
   */
  static createCarSpriteElement(course: number, isOffline: boolean, size: number = 48): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'car-sprite-marker';
    const { bgPosX, bgPosY } = MapUtils.getCarSpritePosition(course);
    const spriteUrl = `${window.location.origin}/logo/car-sprite.png`;
    el.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      background-image: url('${spriteUrl}');
      background-size: ${MapUtils.SPRITE_COLS * 100}% ${MapUtils.SPRITE_ROWS * 100}%;
      background-position: ${bgPosX} ${bgPosY};
      background-repeat: no-repeat;
      cursor: pointer;
      position: absolute;
      top: 0;
      left: 0;
      filter: ${isOffline ? 'grayscale(100%) brightness(0.75) drop-shadow(0 2px 6px rgba(0,0,0,0.45))' : 'drop-shadow(0 2px 6px rgba(0,0,0,0.45))'};
      transition: background-position 0.3s ease;
    `;
    return el;
  }

  /**
   * Update an existing car-sprite element when course changes.
   */
  static updateCarSpriteElement(el: HTMLElement, course: number, isOffline: boolean): void {
    const { bgPosX, bgPosY } = MapUtils.getCarSpritePosition(course);
    el.style.backgroundPosition = `${bgPosX} ${bgPosY}`;
    el.style.filter = isOffline
      ? 'grayscale(100%) brightness(0.75) drop-shadow(0 2px 6px rgba(0,0,0,0.45))'
      : 'drop-shadow(0 2px 6px rgba(0,0,0,0.45))';
  }

  // ─── Canvas icon for Google Maps markers ─────────────────────────
  private static spriteImg: HTMLImageElement | null = null;
  private static spriteImgPromise: Promise<HTMLImageElement> | null = null;
  private static spriteIconCache: Map<string, string> = new Map();

  private static loadSpriteImage(): Promise<HTMLImageElement> {
    if (MapUtils.spriteImg) return Promise.resolve(MapUtils.spriteImg);
    if (MapUtils.spriteImgPromise) return MapUtils.spriteImgPromise;
    MapUtils.spriteImgPromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { MapUtils.spriteImg = img; resolve(img); };
      img.onerror = reject;
      img.src = `${window.location.origin}/logo/car-sprite.png`;
    });
    return MapUtils.spriteImgPromise;
  }

  /**
   * Returns a data-URL icon of the car at the given course angle.
   * Suitable for google.maps.Marker icon.url
   */
  static async getCarSpriteIconUrl(course: number, size: number = 48): Promise<string> {
    const frame = MapUtils.courseToFrame(course);
    const cacheKey = `${frame}_${size}`;
    if (MapUtils.spriteIconCache.has(cacheKey)) {
      return MapUtils.spriteIconCache.get(cacheKey)!;
    }
    const img = await MapUtils.loadSpriteImage();
    const col = frame % MapUtils.SPRITE_COLS;
    const row = Math.floor(frame / MapUtils.SPRITE_COLS);
    const frameW = img.naturalWidth / MapUtils.SPRITE_COLS;
    const frameH = img.naturalHeight / MapUtils.SPRITE_ROWS;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, col * frameW, row * frameH, frameW, frameH, 0, 0, size, size);
    const dataUrl = canvas.toDataURL('image/png');
    MapUtils.spriteIconCache.set(cacheKey, dataUrl);
    return dataUrl;
  }
} 
