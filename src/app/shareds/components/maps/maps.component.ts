import { Component, OnInit, OnChanges, OnDestroy, SimpleChanges, Input } from '@angular/core';
import { Router } from '@angular/router';
import { ThemesService } from '../../services/themes.service';
import { SystemService, SystemSettings } from '../../../core/services/system.service';
import { TargetsService } from '../../../core/services/targets.service';
import { TranslateService } from '@ngx-translate/core';

import { MapUtils } from '../../helpers/map.helper';
import { MapThemeService } from '../../helpers/map-theme.helper';

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
   @Input() preloadedStopTime: string | undefined = undefined;

   map: any;
   apiKey: string = '';
   apiUrl: string = '';
   currentMarker: any = null;
   currentTargetId: string | null = null; // Para rastrear cambios de target
   offlineDuration: string = '';
   lastUpdateText: string = '';
   isTargetOffline: boolean = false;
   distanceDisplay: string = '';
   stopTimeText: string = '';
   isStopTimeMoving: boolean = false;
   showToolsModal: boolean = false;
   private cachedMarkerIconUrl: string | null = null;

  constructor(
    private _theme: ThemesService,
    private systemService: SystemService,
    private targetsService: TargetsService,
    private translate: TranslateService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initializeNewProvider();
  }

  private initializeNewProvider(): void {
  
    this.systemService.getAll().subscribe((systems: SystemSettings[]) => {
      const config = MapUtils.getApiConfig(systems, this.provider);
      if (!config) {
        console.error('❌ No config found for provider:', this.provider);
        return;
      }

      this.apiKey = config.key;
      this.apiUrl = config.url;
   

      MapUtils.loadMapScript(this.provider, this.apiKey, this.apiUrl)
        .then(async () => {
          await this.initializeMap();
        })
        .catch(err => {
          console.error('❌ Error loading script for', this.provider, ':', err);
        });
    },
    error => {
      console.error('❌ Error loading system settings:', error);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['preloadedStopTime']) {
      this.resetStopTimeInfo(this.preloadedStopTime);
    }

    // Manejar cambios de proveedor (cuando se recrea el componente)
    if (changes['provider'] && !changes['provider'].firstChange) {
      this.destroyMap();
      setTimeout(() => {
        this.initializeNewProvider();
      }, 50);
      return;
    }

    // Solo manejar cambios de tema si el mapa ya existe
    if (this.map && changes['theme']) {
      MapThemeService.updateTheme(this.map, this.provider, this.theme, this.selectedTarget);
    }

    // Manejar cambios en el target seleccionado
    if (changes['selectedTarget']) {
      this.updateTargetMarker();
      this.loadDistanceTraveled();
    }
  }

  ngOnDestroy(): void {
    if (this.showToolsModal) {
      this.toggleExternalControls(true);
    }
    this.destroyMap();
  }

  openToolsModal(): void {
    this.showToolsModal = true;
    this.toggleExternalControls(false);
  }

  closeToolsModal(): void {
    this.showToolsModal = false;
    this.toggleExternalControls(true);
  }

  openInGoogleMaps(): void {
    const url = this.getGoogleMapsUrl();
    if (!url) return;
    window.open(url, '_blank');
  }

  openInWaze(): void {
    const url = this.getWazeUrl();
    if (!url) return;
    window.open(url, '_blank');
  }

  openHistory(): void {
    const targetId = this.selectedTarget?._id || this.selectedTarget?.id;
    if (!targetId) return;
    this.router.navigate(['/admin/reports'], {
      queryParams: {
        target: targetId,
        type: 'history'
      }
    });
    this.closeToolsModal();
  }

  private getCurrentLatLng(): { lat: number; lng: number } | null {
    const geo = this.selectedTarget?.traccarInfo?.geolocation;
    const historical = this.selectedTarget?.historicalLocation;
    const latitude = geo?.latitude ?? historical?.latitude;
    const longitude = geo?.longitude ?? historical?.longitude;

    const latNum = parseFloat(latitude !== undefined ? String(latitude) : '');
    const lngNum = parseFloat(longitude !== undefined ? String(longitude) : '');

    if (isNaN(latNum) || isNaN(lngNum)) {
      return null;
    }
    return { lat: latNum, lng: lngNum };
  }

  getGoogleMapsUrl(): string | null {
    const coords = this.getCurrentLatLng();
    if (!coords) return null;
    return `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;
  }

  getWazeUrl(): string | null {
    const coords = this.getCurrentLatLng();
    if (!coords) return null;
    return `https://www.waze.com/ul?ll=${coords.lat}%2C${coords.lng}&navigate=yes&zoom=17`;
  }

  private toggleExternalControls(show: boolean): void {
    const elements = document.querySelectorAll<HTMLElement>('.map-provider-select-wrapper, .mobile-back-button');
    elements.forEach((el) => {
      if (show) {
        el.style.removeProperty('display');
      } else {
        el.style.display = 'none';
      }
    });
  }

  private async initializeMap(): Promise<void> {
    
    const mapElement = document.getElementById('map') as HTMLElement;
    if (!mapElement) {
      console.error('❌ Map element not found!');
      return;
    }
    
    // Usar coordenadas por defecto si no hay target seleccionado
    const { centerLat, centerLng, zoomLevel } = MapUtils.getInitialMapCenter(this.selectedTarget);
    
  

    try {
      // Crear mapa básico sin marcadores
      this.map = MapUtils.createMap(this.provider, mapElement, this.apiKey, this.theme, centerLat, centerLng, zoomLevel);
      
      if (this.map) {
        // Agregar marcador inicial si hay target seleccionado
        this.updateTargetMarker();
      } else {
        console.error('❌ Error: mapa es null después de la creación');
      }
    } catch (error) {
      console.error('❌ Error creating map:', error);
    }
  }

  private async calculateOfflineDuration(): Promise<void> {
    // Check if target is offline
    this.isTargetOffline = this.selectedTarget?.traccarStatus !== 'online';
    this.lastUpdateText = '';

    if (!this.isTargetOffline) {
      this.offlineDuration = '';

      const onlineLastUpdate = this.selectedTarget?.traccarInfo?.lastUpdate;
      if (onlineLastUpdate) {
        const onlineDate = new Date(onlineLastUpdate);
        if (!Number.isNaN(onlineDate.getTime())) {
          this.lastUpdateText = onlineDate.toLocaleString();
        }
      }
      return;
    }

    let lastUpdate = this.selectedTarget?.traccarInfo?.lastUpdate;

    // If no lastUpdate available, try to get the latest location from history
    if (!lastUpdate) {
      try {
        const deviceImei = this.selectedTarget?.device_imei || this.selectedTarget?.imei;
        if (deviceImei) {
          console.log(`[OFFLINE DEBUG] No lastUpdate available, trying to get latest location from history for IMEI: ${deviceImei}`);
          const historyResponse = await this.targetsService.getLatestLocationFromHistory(deviceImei);

          if (historyResponse.success && historyResponse.location) {
            lastUpdate = historyResponse.location.deviceTime || historyResponse.location.fixTime;
            console.log(`[OFFLINE DEBUG] Got location from history: ${lastUpdate}`);

            // Store historical location data for marker creation
            if (this.selectedTarget && !this.selectedTarget.historicalLocation) {
              this.selectedTarget.historicalLocation = {
                latitude: historyResponse.location.latitude,
                longitude: historyResponse.location.longitude,
                fixTime: historyResponse.location.fixTime,
                deviceTime: historyResponse.location.deviceTime
              };
            }
          } else {
            console.log(`[OFFLINE DEBUG] No location found in history for IMEI: ${deviceImei}`);
            this.offlineDuration = '';
            return;
          }
        } else {
          console.log(`[OFFLINE DEBUG] No IMEI available for history lookup`);
          this.offlineDuration = '';
          return;
        }
      } catch (error) {
        console.error(`[OFFLINE DEBUG] Error getting location from history:`, error);
        this.offlineDuration = '';
        return;
      }
    }

    // Use the same calculation logic as the management component
    const lastUpdateDate = new Date(lastUpdate);
    const now = new Date();
    const diffInMs = now.getTime() - lastUpdateDate.getTime();

    if (isNaN(lastUpdateDate.getTime())) {
      this.offlineDuration = 'Fecha inválida';
      this.lastUpdateText = this.translate.instant('maps.notAvailable');
      return;
    }

    if (diffInMs < 0) {
      this.offlineDuration = 'Fecha futura';
      this.lastUpdateText = this.translate.instant('maps.notAvailable');
      return;
    }

    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    const diffInWeeks = Math.floor(diffInDays / 7);
    const diffInMonths = Math.floor(diffInDays / 30);
    const diffInYears = Math.floor(diffInDays / 365);

    let timeText = '';
    if (diffInYears > 0) {
      timeText = `Última ubicación hace ${diffInYears} año${diffInYears > 1 ? 's' : ''}`;
    } else if (diffInMonths > 0) {
      timeText = `Última ubicación hace ${diffInMonths} mes${diffInMonths > 1 ? 'es' : ''}`;
    } else if (diffInWeeks > 0) {
      timeText = `Última ubicación hace ${diffInWeeks} semana${diffInWeeks > 1 ? 's' : ''}`;
    } else if (diffInDays > 0) {
      timeText = `Última ubicación hace ${diffInDays} día${diffInDays > 1 ? 's' : ''}`;
    } else if (diffInHours > 0) {
      timeText = `Última ubicación hace ${diffInHours} hora${diffInHours > 1 ? 's' : ''}`;
    } else if (diffInMinutes > 0) {
      timeText = `Última ubicación hace ${diffInMinutes} minuto${diffInMinutes > 1 ? 's' : ''}`;
    } else {
      timeText = 'Última ubicación hace menos de 1 minuto';
    }

    this.offlineDuration = timeText;
    this.lastUpdateText = lastUpdateDate.toLocaleString();
  }

  private async updateTargetMarker(): Promise<void> {
    if (!this.map) return;

    // Calcular tiempo fuera de línea si hay target seleccionado
    await this.calculateOfflineDuration();

    // Si no hay target seleccionado, remover marcador existente
    if (!this.selectedTarget) {
      if (this.currentMarker) {
        MapUtils.removeMarker(this.currentMarker, this.provider);
        this.currentMarker = null;
        this.currentTargetId = null;
      }
      this.resetStopTimeInfo();
      return;
    }

    // Check if we have real-time location or historical location
    const hasRealTimeLocation = this.selectedTarget?.traccarInfo?.geolocation;
    const hasHistoricalLocation = this.isTargetOffline && this.selectedTarget?.historicalLocation;

    // If no location data at all, remove marker
    if (!hasRealTimeLocation && !hasHistoricalLocation) {
      if (this.currentMarker) {
        MapUtils.removeMarker(this.currentMarker, this.provider);
        this.currentMarker = null;
        this.currentTargetId = null;
      }
      this.resetStopTimeInfo();
      return;
    }

    const targetId = this.selectedTarget._id || this.selectedTarget.id;
    const isNewTarget = this.currentTargetId !== targetId;

    if (isNewTarget) {
      this.currentTargetId = targetId;
      this.resetStopTimeInfo(this.preloadedStopTime);

      // Remover marcador anterior si existe para crear uno nuevo
      if (this.currentMarker) {
        MapUtils.removeMarker(this.currentMarker, this.provider);
        this.currentMarker = null;
      }
    }

    // Get coordinates from real-time or historical location
    let lat: number, lng: number;

    if (hasRealTimeLocation) {
      lat = parseFloat(this.selectedTarget.traccarInfo.geolocation.latitude);
      lng = parseFloat(this.selectedTarget.traccarInfo.geolocation.longitude);
    } else if (hasHistoricalLocation) {
      lat = parseFloat(this.selectedTarget.historicalLocation.latitude);
      lng = parseFloat(this.selectedTarget.historicalLocation.longitude);
    } else {
      console.warn('⚠️ No se pudieron obtener coordenadas para el target');
      return;
    }

    if (isNaN(lat) || isNaN(lng)) {
      console.warn('⚠️ Coordenadas inválidas para el target:', { lat, lng });
      return;
    }

    // Solo recentrar si el marcador está fuera de la vista
    MapUtils.recenterMapIfOutOfView(this.map, this.provider, lat, lng);

    // Si el marcador no existe o es un target nuevo, crearlo
    if (!this.currentMarker || isNewTarget) {
      this.createMarker(lat, lng);

      // Para un target nuevo, obtener tiempo de parada desde cero
      this.updateMarkerWithStopTime(true);
    } else {
      // Si el marcador existe y es el mismo target, solo actualizar
      this.updateExistingMarker(lat, lng);
    }
  }

  // ----- UI helpers for detail panel -----
  get statusLabel(): string {
    if (!this.selectedTarget?.traccarStatus) {
      return this.translate.instant('maps.statusUnknown');
    }
    const status = this.selectedTarget.traccarStatus.toLowerCase();
    if (status === 'online') {
      return this.translate.instant('maps.statusOnline');
    }
    if (status === 'offline') {
      return this.translate.instant('maps.statusOffline');
    }
    return this.selectedTarget.traccarStatus;
  }

  get statusClass(): string {
    const status = this.selectedTarget?.traccarStatus?.toLowerCase();
    if (status === 'online') return 'online';
    if (status === 'offline') return 'offline';
    return 'unknown';
  }

  get currentSpeedDisplay(): string {
    const speed = this.selectedTarget?.traccarInfo?.geolocation?.speed;
    if (speed === undefined || speed === null) {
      return this.translate.instant('maps.notAvailable');
    }
    const kmh = Math.round(speed * 1.852);
    return `${kmh} km/h`;
  }

  get lastUpdateDisplay(): string {
    if (this.lastUpdateText) {
      return this.lastUpdateText;
    }

    const lastUpdate = this.selectedTarget?.traccarInfo?.lastUpdate;
    if (!lastUpdate) {
      return this.translate.instant('maps.notAvailable');
    }
    const date = new Date(lastUpdate);
    return Number.isNaN(date.getTime())
      ? this.translate.instant('maps.notAvailable')
      : date.toLocaleString();
  }

  get simDisplay(): string {
    return (
      this.selectedTarget?.sim_card_number ||
      (this.selectedTarget as any)?.sim_card?.number ||
      this.translate.instant('maps.notAvailable')
    );
  }

  get imeiDisplay(): string {
    return (
      this.selectedTarget?.device_imei ||
      this.selectedTarget?.imei ||
      this.translate.instant('maps.notAvailable')
    );
  }

  private async loadDistanceTraveled(): Promise<void> {
    if (!this.selectedTarget?._id || this.isTargetOffline) {
      this.distanceDisplay = this.translate.instant('maps.notAvailable');
      return;
    }

    try {
      const now = new Date();
      const from = new Date(now);
      from.setHours(0, 0, 0, 0);
      const to = new Date(now);
      to.setHours(23, 59, 59, 999);
      const response = await this.targetsService.getDeviceDistance(
        this.selectedTarget._id,
        from.toISOString(),
        to.toISOString()
      );

      const distanceKm =
        response && typeof response.distance === 'number'
          ? (response.distance / 1000).toFixed(1)
          : null;

      this.distanceDisplay = distanceKm
        ? `${distanceKm} km`
        : this.translate.instant('maps.notAvailable');
    } catch (error) {
      console.error('❌ Error obteniendo distancia recorrida:', error);
      this.distanceDisplay = this.translate.instant('maps.notAvailable');
    }
  }

  private createMarker(lat: number, lng: number): void {
    const title = this.selectedTarget?.name || 'Target';
    const markerIconUrl = this.getMarkerIconUrl();

    if (this.provider === 'google') {
      this.currentMarker = new google.maps.Marker({
        position: { lat, lng },
        map: this.map,
        title,
        icon: {
          url: markerIconUrl,
          scaledSize: new google.maps.Size(36, 36),
          anchor: new google.maps.Point(18, 35)
        }
      });
    } else {
      const mapboxgl = (window as any).mapboxgl;

      const markerElement = document.createElement('div');
      markerElement.className = 'custom-marker';
      markerElement.style.cssText = `
        width: 60px;
        height: 40px;
        background-image: url('${markerIconUrl}');
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
        cursor: pointer;
        position: relative;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35));
        transform: translateY(-10px);
      `;

      this.currentMarker = new mapboxgl.Marker({
        element: markerElement,
        offset: [0, -10],
      })
        .setLngLat([lng, lat])
        .addTo(this.map);
    }
  }

  private updateExistingMarker(lat: number, lng: number): void {
    if (!this.currentMarker) return;

    const title = this.selectedTarget?.name || 'Target';

    if (this.provider === 'google') {
      // Actualizar posición del marcador Google Maps
      this.currentMarker.setPosition({ lat, lng });
      
      // Actualizar título del marcador
      this.currentMarker.setTitle(title);

    } else {
      // Actualizar posición del marcador Mapbox
      this.currentMarker.setLngLat([lng, lat]);
    }

    // Solicitar tiempo de parada actualizado en cada polling
    this.updateMarkerWithStopTime();
  }

  private async updateMarkerWithStopTime(isInitialRequest: boolean = false): Promise<void> {
    const deviceId =
      this.selectedTarget?.device_imei ||
      this.selectedTarget?.imei ||
      this.selectedTarget?.originalTarget?.device_imei ||
      this.selectedTarget?.originalTarget?.imei;

    if (!deviceId) {
      this.resetStopTimeInfo();
      return;
    }

    const requestType = isInitialRequest ? '[INICIAL]' : '[POLLING]';

    try {
      const stopTimeResult = await this.targetsService.getStopTime(deviceId);

      this.isStopTimeMoving = !!stopTimeResult?.isMoving;

      if (stopTimeResult && stopTimeResult.text && !stopTimeResult.isMoving) {
        this.stopTimeText = stopTimeResult.text;
      } else if (stopTimeResult?.isMoving) {
        this.stopTimeText = '';
      } else if (isInitialRequest && this.preloadedStopTime) {
        this.stopTimeText = this.preloadedStopTime;
      } else if (!this.isStopTimeMoving) {
        this.stopTimeText = '';
      }
    } catch (error) {
      console.error(`❌ ${requestType} Error al obtener tiempo de parada:`, error);
      if (isInitialRequest && this.preloadedStopTime) {
        this.stopTimeText = this.preloadedStopTime;
      }
    }
  }

  get stopTimeInfoDisplay(): string {
    if (this.stopTimeText) {
      return this.stopTimeText;
    }
    if (this.isStopTimeMoving) {
      return this.translate.instant('maps.stopTimeMoving');
    }
    return this.translate.instant('maps.notAvailable');
  }

  private resetStopTimeInfo(initialValue?: string | null): void {
    this.stopTimeText = initialValue || '';
    this.isStopTimeMoving = false;
  }

  private destroyMap(): void {
    if (this.currentMarker) {
      MapUtils.removeMarker(this.currentMarker, this.provider);
      this.currentMarker = null;
    }

    if (this.map) {
      try {
        if (this.provider === 'mapbox' && this.map.remove) {
          this.map.remove();
        }
      } catch (error) {
        console.warn('Error destroying map:', error);
      }
    }

    this.map = null;

    const mapElement = document.getElementById('map');
    if (mapElement) {
      mapElement.innerHTML = '';
      mapElement.className = '';
      mapElement.style.cssText = '';
    }
  }

  private getMarkerIconUrl(): string {
    if (this.cachedMarkerIconUrl) {
      return this.cachedMarkerIconUrl;
    }

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      this.cachedMarkerIconUrl = '/favicon.ico';
      return this.cachedMarkerIconUrl;
    }

    const iconLink =
      (document.querySelector("link[rel*='icon']") as HTMLLinkElement | null) ??
      null;
    const href = iconLink?.href ?? '/favicon.ico';
    if (href.startsWith('http')) {
      this.cachedMarkerIconUrl = href;
    } else {
      const normalized =
        href.startsWith('/') || href.startsWith('http')
          ? href
          : `/${href}`;
      this.cachedMarkerIconUrl = `${window.location.origin}${normalized}`;
    }

    return this.cachedMarkerIconUrl;
  }
}
