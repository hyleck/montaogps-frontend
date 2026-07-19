import { Component, OnInit, OnChanges, OnDestroy, SimpleChanges, Input, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { ThemesService } from '../../services/themes.service';
import { SystemService, SystemSettings } from '../../../core/services/system.service';
import { TargetsService } from '../../../core/services/targets.service';
import { TranslateService } from '@ngx-translate/core';

import { MapProvider, MapUtils } from '../../helpers/map.helper';
import { MapThemeService } from '../../helpers/map-theme.helper';

@Component({
  selector: 'app-maps',
  templateUrl: './maps.component.html',
  styleUrls: ['./maps.component.css'],
  standalone: false
})
export class MapsComponent implements OnInit, OnChanges, OnDestroy {
  @Input() provider: MapProvider = 'mapbox';
  @Input() theme: 'dark' | 'light' = 'dark';
  @Input() selectedTarget: any = null;
  @Input() targetsForMap: any[] = [];
  @Input() vehicleTypeGetter: ((modelId: string) => string) | null = null;
  @Input() preloadedStopTime: string | undefined = undefined;
  @Output() additionalTargetSelected = new EventEmitter<any>();

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
  isStopTimeLoading: boolean = false;
  multipleMarkers: any[] = [];
  private currentPopup: any = null;
  private mapReady: boolean = false;
  private pendingMapRender: boolean = false;
  private osmMarkerImagesReady: boolean = false;
  showToolsModal: boolean = false;
  private cachedMarkerIconUrl: string | null = null;
  showShareLinkModal: boolean = false;
  selectedExpirationTime: string = '24h';
  generatedLink: string = '';
  showCopySuccess: boolean = false;
  showVehicleImageModal: boolean = false;
  discrepancyMessage: string | null = null;
  showAdditionalOnlineModal: boolean = false;
  onlineAdditionalTarget: any = null;
  additionalOnlineModalMode: 'online' | 'localizedTag' | 'recentLocation' = 'online';
  additionalTagLastLocationText: string = '';
  private lastAdditionalOnlinePromptTargetId: string | null = null;

  constructor(
    private _theme: ThemesService,
    private systemService: SystemService,
    private targetsService: TargetsService,
    private translate: TranslateService,
    private router: Router
  ) { }

  private isOnlineLikeStatus(status?: string | null): boolean {
    const normalized = (status || '').toLowerCase();
    return normalized === 'online' || normalized === 'señal débil' || normalized === 'senal debil';
  }

  isSelectedTargetOnlineLike(): boolean {
    return this.isOnlineLikeStatus(this.selectedTarget?.traccarStatus);
  }

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
      const previousTargetId = changes['selectedTarget'].previousValue?._id || changes['selectedTarget'].previousValue?.id;
      const currentTargetId = changes['selectedTarget'].currentValue?._id || changes['selectedTarget'].currentValue?.id;
      if (previousTargetId !== currentTargetId) {
        this.closeAdditionalOnlineModal();
        this.lastAdditionalOnlinePromptTargetId = null;
      }
      this.updateTargetMarker();
      this.loadDistanceTraveled();
    }

    if (changes['targetsForMap'] && !this.selectedTarget) {
      console.log('🗺️ [MapsComponent] targetsForMap changed:', this.targetsForMap?.length);
      this.renderMultipleTargetsMarkers();
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

  openShareLinkModal(): void {
    this.showShareLinkModal = true;
    this.selectedExpirationTime = '24h'; // Reset to default
    this.generatedLink = ''; // Reset link
  }

  closeShareLinkModal(): void {
    this.showShareLinkModal = false;
    this.generatedLink = '';
  }

  closeAdditionalOnlineModal(): void {
    this.showAdditionalOnlineModal = false;
    this.onlineAdditionalTarget = null;
    this.additionalOnlineModalMode = 'online';
    this.additionalTagLastLocationText = '';
  }

  viewOnlineAdditionalTarget(): void {
    if (!this.onlineAdditionalTarget) return;
    const target = this.onlineAdditionalTarget;
    this.closeAdditionalOnlineModal();
    this.additionalTargetSelected.emit(target);
  }

  generateRealtimeLink(): void {
    const targetId = this.selectedTarget?._id || this.selectedTarget?.id;
    if (!targetId) return;

    // Calcular fecha de expiración basada en la selección
    const expirationDate = new Date();
    const timeValue = this.selectedExpirationTime;

    if (timeValue.endsWith('m')) {
      // Minutos
      const minutes = parseInt(timeValue);
      expirationDate.setMinutes(expirationDate.getMinutes() + minutes);
    } else if (timeValue.endsWith('h')) {
      // Horas
      const hours = parseInt(timeValue);
      expirationDate.setHours(expirationDate.getHours() + hours);
    } else if (timeValue.endsWith('d')) {
      // Días
      const days = parseInt(timeValue);
      expirationDate.setDate(expirationDate.getDate() + days);
    } else if (timeValue.endsWith('w')) {
      // Semanas
      const weeks = parseInt(timeValue);
      expirationDate.setDate(expirationDate.getDate() + (weeks * 7));
    } else if (timeValue.endsWith('M')) {
      // Meses
      const months = parseInt(timeValue);
      expirationDate.setMonth(expirationDate.getMonth() + months);
    }

    const exprcn = expirationDate.toISOString();

    // Crear objeto con los datos a encriptar
    const linkData = {
      trgt: targetId,
      exprcn: exprcn,
      gkey: this.apiKey
    };

    // Convertir a JSON y encriptar en base64
    const jsonData = JSON.stringify(linkData);
    const encodedData = btoa(jsonData);

    // Construir URL del link en tiempo real con datos encriptados
    const baseUrl = window.location.origin;
    const realtimeUrl = `${baseUrl}/realtimelink?data=${encodedData}`;

    // Guardar el link generado para mostrarlo en el modal
    this.generatedLink = realtimeUrl;
  }

  copyLinkToClipboard(): void {
    if (!this.generatedLink) return;

    navigator.clipboard.writeText(this.generatedLink).then(() => {
      this.showCopySuccess = true;

      // Ocultar mensaje después de 3 segundos
      setTimeout(() => {
        this.showCopySuccess = false;
      }, 3000);
    }).catch(err => {
      console.error('Error al copiar al portapapeles:', err);
      alert('Error al copiar el link al portapapeles');
    });
  }

  getExpirationText(timeValue: string): string {
    const expirationTexts: { [key: string]: string } = {
      '15m': '15 minutos',
      '30m': '30 minutos',
      '1h': '1 hora',
      '2h': '2 horas',
      '8h': '8 horas',
      '15h': '15 horas',
      '24h': '24 horas',
      '2d': '2 días',
      '3d': '3 días',
      '1w': '1 semana',
      '1M': '1 mes'
    };
    return expirationTexts[timeValue] || timeValue;
  }

  private getCurrentLatLng(): { lat: number; lng: number } | null {
    const coords = this.getTargetCoordinates(this.selectedTarget);
    return coords ? { lat: coords.lat, lng: coords.lng } : null;
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
        this.mapReady = this.isMapReady();
        this.registerMapReadyHandlers();
        this.scheduleMapResize();
        // Agregar marcador inicial si hay target seleccionado
        this.updateTargetMarker();
      } else {
        console.error('❌ Error: mapa es null después de la creación');
      }
    } catch (error) {
      console.error('❌ Error creating map:', error);
    }
  }

  private scheduleMapResize(): void {
    const resize = () => {
      try {
        this.map?.resize?.();
      } catch (_) {
        // Some providers do not expose resize.
      }
    };

    requestAnimationFrame(resize);
    [0, 120, 350, 800].forEach((delay) => {
      setTimeout(() => {
        resize();
      }, delay);
    });

    try {
      this.map?.once?.('load', resize);
      this.map?.once?.('idle', resize);
    } catch (_) {
      // Map event APIs vary by provider.
    }
  }

  private registerMapReadyHandlers(): void {
    if (!this.map || this.provider === 'google') {
      this.mapReady = true;
      return;
    }

    const onReady = () => {
      this.mapReady = true;
      this.scheduleMapResize();
      if (this.pendingMapRender) {
        this.pendingMapRender = false;
        this.updateTargetMarker();
      }
    };

    try {
      this.map.once?.('load', onReady);
      this.map.once?.('idle', onReady);
    } catch (_) {
      setTimeout(onReady, 200);
    }
  }

  private isMapReady(): boolean {
    if (!this.map || this.provider === 'google') {
      return true;
    }

    try {
      return !!this.map.loaded?.() || !!this.map.isStyleLoaded?.();
    } catch (_) {
      return false;
    }
  }

  private async calculateOfflineDuration(): Promise<void> {
    // Check if target is offline
    this.isTargetOffline = !this.isSelectedTargetOnlineLike();
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
      timeText = `Hace ${diffInYears} año${diffInYears > 1 ? 's' : ''}`;
    } else if (diffInMonths > 0) {
      timeText = `Hace ${diffInMonths} mes${diffInMonths > 1 ? 'es' : ''}`;
    } else if (diffInWeeks > 0) {
      timeText = `Hace ${diffInWeeks} semana${diffInWeeks > 1 ? 's' : ''}`;
    } else if (diffInDays > 0) {
      timeText = `Hace ${diffInDays} día${diffInDays > 1 ? 's' : ''}`;
    } else if (diffInHours > 0) {
      timeText = `Hace ${diffInHours} hora${diffInHours > 1 ? 's' : ''}`;
    } else if (diffInMinutes > 0) {
      timeText = `Hace ${diffInMinutes} minuto${diffInMinutes > 1 ? 's' : ''}`;
    } else {
      timeText = 'Hace menos de 1 minuto';
    }

    this.offlineDuration = timeText;
    this.lastUpdateText = lastUpdateDate.toLocaleString();
    
    this.discrepancyMessage = null;
    const lastValidLocationStr = this.selectedTarget?.traccarInfo?.geolocation?.deviceTime 
        || this.selectedTarget?.traccarInfo?.geolocation?.fixTime
        || this.selectedTarget?.historicalLocation?.deviceTime
        || this.selectedTarget?.historicalLocation?.fixTime;
        
    if (lastUpdate && lastValidLocationStr) {
      const validDate = new Date(lastValidLocationStr);
      if (!isNaN(validDate.getTime())) {
        const diffMs = lastUpdateDate.getTime() - validDate.getTime();
        // Si hay una diferencia mayor a 60 minutos (3600000 ms)
        if (diffMs > 3600000) {
          const formatOptions: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' };
          const formattedUpdate = lastUpdateDate.toLocaleString('es-ES', formatOptions);
          const formattedValid = validDate.toLocaleString('es-ES', formatOptions);
          this.discrepancyMessage = `Este vehículo entró en línea por última vez el ${formattedUpdate} pero su última ubicación válida registrada fue el ${formattedValid}`;
        }
      }
    }
  }

  private async checkOnlineAdditionalGps(): Promise<void> {
    const selectedId = this.selectedTarget?._id || this.selectedTarget?.id;
    if (!selectedId) {
      this.closeAdditionalOnlineModal();
      this.lastAdditionalOnlinePromptTargetId = null;
      return;
    }

    if (!this.isTargetOffline) {
      this.closeAdditionalOnlineModal();
      this.lastAdditionalOnlinePromptTargetId = null;
      return;
    }

    if (this.lastAdditionalOnlinePromptTargetId === selectedId) {
      return;
    }

    try {
      const detailedTarget = Array.isArray(this.selectedTarget?.instalaciones_adicionales)
        ? this.selectedTarget
        : await this.targetsService.getTargetById(selectedId);

      const additions = Array.isArray(detailedTarget?.instalaciones_adicionales)
        ? detailedTarget.instalaciones_adicionales
        : [];

      const localizedTagAddition = additions.find((target: any) => {
        const status = target?.traccarStatus || target?.traccarInfo?.status;
        return this.isAdditionalMtag(target) && this.isLocalizedStatus(status);
      });

      const onlineAddition = additions.find((target: any) => {
        const status = target?.traccarStatus || target?.traccarInfo?.status;
        return this.isOnlineLikeStatus(status);
      });

      const recentLocationAddition = !localizedTagAddition && !onlineAddition
        ? this.findAdditionalWithMoreRecentLocation(additions, detailedTarget)
        : null;
      const matchedAddition = localizedTagAddition || onlineAddition || recentLocationAddition;

      if (!matchedAddition) {
        this.closeAdditionalOnlineModal();
        this.lastAdditionalOnlinePromptTargetId = null;
        return;
      }

      this.additionalOnlineModalMode = localizedTagAddition
        ? 'localizedTag'
        : (recentLocationAddition ? 'recentLocation' : 'online');
      this.additionalTagLastLocationText = localizedTagAddition || recentLocationAddition
        ? this.getAdditionalTagLastLocationText(matchedAddition)
        : '';
      this.onlineAdditionalTarget = {
        ...matchedAddition,
        traccarStatus: matchedAddition.traccarStatus || matchedAddition.traccarInfo?.status,
      };
      this.showAdditionalOnlineModal = true;
      this.lastAdditionalOnlinePromptTargetId = selectedId;
    } catch (error) {
      console.error('❌ Error verificando GPS adicionales en línea:', error);
    }
  }

  private findAdditionalWithMoreRecentLocation(additions: any[], selectedTarget: any): any | null {
    const selectedLocationTime = this.getLocationTimestamp(selectedTarget);
    if (!selectedLocationTime) {
      return null;
    }

    return additions
      .filter((target: any) => {
        const status = target?.traccarStatus || target?.traccarInfo?.status;
        return !this.isOnlineLikeStatus(status) && !this.isLocalizedStatus(status);
      })
      .map((target: any) => ({
        target,
        timestamp: this.getLocationTimestamp(target),
      }))
      .filter((entry: { target: any; timestamp: number | null }) => !!entry.timestamp && entry.timestamp > selectedLocationTime)
      .sort((a: { timestamp: number | null }, b: { timestamp: number | null }) => (b.timestamp || 0) - (a.timestamp || 0))[0]?.target || null;
  }

  private isAdditionalMtag(target: any): boolean {
    const protocol = target?.protocol || target?.originalTarget?.protocol;
    if (protocol && typeof protocol === 'object' && protocol.isAirtag !== undefined) {
      return !!protocol.isAirtag;
    }

    const status = target?.traccarStatus || target?.traccarInfo?.status;
    if (this.isLocalizedStatus(status)) {
      return true;
    }

    const typeName = String(protocol?.name || target?.type?.name || target?.tag || target?.gps_model || '').toLowerCase();
    return typeName.includes('mtag') || typeName.includes('tag') || typeName.includes('airtag');
  }

  private isLocalizedStatus(status?: string | null): boolean {
    const normalized = (status || '').toLowerCase();
    return normalized === 'localizado' || normalized === 'no localizado';
  }

  private getAdditionalTagLastLocationText(target: any): string {
    const lastLocation = this.getLocationDateValue(target);

    if (!lastLocation) {
      return 'no disponible';
    }

    const date = new Date(lastLocation);
    const diffMs = Date.now() - date.getTime();
    if (Number.isNaN(date.getTime())) {
      return 'no disponible';
    }
    if (diffMs < 0) {
      return 'en una fecha futura';
    }

    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (years > 0) return `hace ${years} año${years > 1 ? 's' : ''}`;
    if (months > 0) return `hace ${months} mes${months > 1 ? 'es' : ''}`;
    if (weeks > 0) return `hace ${weeks} semana${weeks > 1 ? 's' : ''}`;
    if (days > 0) return `hace ${days} día${days > 1 ? 's' : ''}`;
    if (hours > 0) return `hace ${hours} hora${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
    return 'hace menos de 1 minuto';
  }

  private getLocationTimestamp(target: any): number | null {
    const value = this.getLocationDateValue(target);
    if (!value) {
      return null;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }

  private getLocationDateValue(target: any): string | Date | null {
    return (
      target?.traccarInfo?.geolocation?.deviceTime ||
      target?.traccarInfo?.geolocation?.fixTime ||
      target?.historicalLocation?.deviceTime ||
      target?.historicalLocation?.fixTime ||
      target?.historicalLocation?.timestamp ||
      target?.traccarInfo?.lastUpdate ||
      null
    );
  }

  private async updateTargetMarker(): Promise<void> {
    if (!this.map) return;
    if (!this.isMapReady()) {
      this.pendingMapRender = true;
      return;
    }
    this.mapReady = true;

    // Calcular tiempo fuera de línea si hay target seleccionado
    await this.calculateOfflineDuration();
    await this.checkOnlineAdditionalGps();

    // Si no hay target seleccionado, remover marcador existente
    if (!this.selectedTarget) {
      if (this.currentMarker) {
        MapUtils.removeMarker(this.currentMarker, this.provider);
        this.currentMarker = null;
        this.currentTargetId = null;
      }
      this.resetStopTimeInfo();
      this.renderMultipleTargetsMarkers();
      return;
    }

    const coords = this.getTargetCoordinates(this.selectedTarget);

    // If no location data at all, remove marker
    if (!coords) {
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

      // Limpiar marcadores múltiples si existían
      this.clearMultipleMarkers();
    }

    const { lat, lng } = coords;

    if (this.provider === 'osm') {
      this.map.easeTo?.({
        center: [lng, lat],
        zoom: 16,
        duration: isNewTarget ? 500 : 250,
      }) ?? (() => {
        this.map.setCenter([lng, lat]);
        this.map.setZoom(16);
      })();
    } else {
      // Solo recentrar si el marcador está fuera de la vista
      MapUtils.recenterMapIfOutOfView(this.map, this.provider, lat, lng);
    }

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
    if (this.isOnlineLikeStatus(status)) return 'online';
    if (status === 'offline') return 'offline';
    if (status === 'localizado') return 'localizado';
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

  private async createMarker(lat: number, lng: number): Promise<void> {
    const title = this.selectedTarget?.name || 'Target';
    const statusLower = (this.selectedTarget?.traccarStatus || '').toLowerCase();
    const isOffline = !this.isOnlineLikeStatus(statusLower) && statusLower !== 'localizado';
    const statusText = (this.selectedTarget?.traccarStatus || 'desconocido').toLowerCase();
    const isOnline = this.isOnlineLikeStatus(statusText);
    const course = this.selectedTarget?.traccarInfo?.geolocation?.course ?? 0;
    const markerType = this.provider === 'osm' ? 'default' : MapUtils.getMapMarkerType();

    if (this.provider === 'google') {
      let iconConfig: any;

      if (markerType === 'vehicle') {
        const spriteIconUrl = await MapUtils.getCarSpriteIconUrl(course, 48);
        iconConfig = {
          url: spriteIconUrl,
          scaledSize: new google.maps.Size(48, 68),
          anchor: new google.maps.Point(24, 50)
        };
      } else {
        const iconUrl = isOffline ? this.getMarkerIconUrlOffline() : this.getMarkerIconUrl();
        iconConfig = {
          url: iconUrl,
          scaledSize: new google.maps.Size(32, 32),
          anchor: new google.maps.Point(16, 16)
        };
      }

      this.currentMarker = new google.maps.Marker({
        position: { lat, lng },
        map: this.map,
        title,
        icon: iconConfig,
        opacity: isOffline ? 0.65 : 1,
      });

      // Popup para marcador seleccionado (Google)
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="font-size: 11px; line-height: 1.2; color: #111; min-width: 160px; padding: 6px 8px;">
            <div style="font-weight: 700; font-size: 11px; margin-bottom: 3px; color: ${isOnline ? '#16a34a' : '#111'};">${title}</div>
            <div style="margin-bottom: 2px;">Velocidad: 0 km/h</div>
            <div>Estado: ${statusText || 'desconocido'}</div>
          </div>
        `,
      });
      this.currentPopup = infoWindow;
      let isOpen = isOnline;
      if (isOpen) {
        infoWindow.open(this.map, this.currentMarker);
      }
      this.currentMarker.addListener('click', () => {
        if (isOpen) {
          infoWindow.close();
          isOpen = false;
        } else {
          infoWindow.open(this.map, this.currentMarker);
        }
      });
      infoWindow.addListener('closeclick', () => {
        isOpen = false;
      });
    } else {
      const mapboxgl = MapUtils.getMapLibrary(this.provider);

      let markerElement: HTMLElement;
      if (markerType === 'vehicle') {
        markerElement = MapUtils.createCarSpriteElement(course, isOffline, 48);
      } else {
        const img = document.createElement('img');
        img.src = isOffline ? `${window.location.origin}/logo/favicon-gray.png` : `${window.location.origin}/logo/favicon.png`;
        img.style.cssText = `width: 32px; height: 32px; cursor: pointer;`;

        if (this.provider === 'osm') {
          const wrapper = document.createElement('div');
          wrapper.style.cssText = 'width: 32px; height: 32px; cursor: pointer; position: absolute; top: 0; left: 0; overflow: visible;';
          wrapper.appendChild(img);

          const label = document.createElement('div');
          label.className = 'gps-map-marker-label';
          label.textContent = title;
          wrapper.appendChild(label);
          markerElement = wrapper;
        } else {
          markerElement = img;
        }
      }
      markerElement.classList.add('gps-map-marker');
      markerElement.style.zIndex = '20';
      markerElement.style.pointerEvents = 'auto';

      this.currentMarker = new mapboxgl.Marker({
        element: markerElement,
        anchor: 'center',
      })
        .setLngLat([lng, lat])
        .addTo(this.map);

      // Popup para marcador seleccionado (Mapbox)
      const popup = new mapboxgl.Popup({ offset: 25, closeButton: true }).setHTML(
        `
          <div style="font-size: 11px; line-height: 1.2; color: #111; min-width: 160px; padding: 6px 8px;">
            <div style="font-weight: 700; font-size: 11px; margin-bottom: 3px; color: ${isOnline ? '#16a34a' : '#111'};">${title}</div>
            <div style="margin-bottom: 2px;">Velocidad: 0 km/h</div>
            <div>Estado: ${statusText || 'desconocido'}</div>
          </div>
        `,
      );
      this.currentPopup = popup;
      this.currentMarker.setPopup(popup);
      if (isOnline) {
        popup.addTo(this.map);
      }
      const el = this.currentMarker.getElement();
      el.addEventListener('click', () => {
        popup.isOpen() ? popup.remove() : this.currentMarker?.togglePopup();
      });
    }
  }

  private async updateExistingMarker(lat: number, lng: number): Promise<void> {
    if (!this.currentMarker) return;

    const title = this.selectedTarget?.name || 'Target';
    const statusLower = (this.selectedTarget?.traccarStatus || '').toLowerCase();
    const isOffline = !this.isOnlineLikeStatus(statusLower) && statusLower !== 'localizado';
    const statusText = (this.selectedTarget?.traccarStatus || 'desconocido').toLowerCase();
    const isOnline = this.isOnlineLikeStatus(statusText);
    const course = this.selectedTarget?.traccarInfo?.geolocation?.course ?? 0;
    const markerType = this.provider === 'osm' ? 'default' : MapUtils.getMapMarkerType();

    if (this.provider === 'google') {
      // Actualizar posición del marcador Google Maps
      this.currentMarker.setPosition({ lat, lng });

      // Actualizar título del marcador
      this.currentMarker.setTitle(title);
      this.currentMarker.setOpacity(isOffline ? 0.65 : 1);

      if (markerType === 'vehicle') {
        // Actualizar ícono de sprite con el nuevo course
        const spriteIconUrl = await MapUtils.getCarSpriteIconUrl(course, 48);
        this.currentMarker.setIcon({
          url: spriteIconUrl,
          scaledSize: new google.maps.Size(48, 68),
          anchor: new google.maps.Point(24, 50)
        });
      } else {
        const iconUrl = isOffline ? this.getMarkerIconUrlOffline() : this.getMarkerIconUrl();
        this.currentMarker.setIcon({
          url: iconUrl,
          scaledSize: new google.maps.Size(32, 32),
          anchor: new google.maps.Point(16, 16)
        });
      }

      // Actualizar popup si existe
      if (this.currentPopup && this.currentPopup.setContent) {
        this.currentPopup.setContent(`
          <div style="font-size: 11px; line-height: 1.2; color: #111; min-width: 160px; padding: 6px 8px;">
            <div style="font-weight: 700; font-size: 11px; margin-bottom: 3px; color: ${isOnline ? '#16a34a' : '#111'};">${title}</div>
            <div style="margin-bottom: 2px;">Velocidad: 0 km/h</div>
            <div>Estado: ${statusText || 'desconocido'}</div>
          </div>
        `);
      }
    } else {
      // Actualizar posición del marcador Mapbox
      this.currentMarker.setLngLat([lng, lat]);
      const el = this.currentMarker.getElement?.();
      if (el) {
        MapUtils.updateCarSpriteElement(el, course, isOffline);
      }

      if (this.currentPopup && this.currentPopup.setHTML) {
        this.currentPopup.setHTML(`
          <div style="font-size: 11px; line-height: 1.2; color: #111; min-width: 160px; padding: 6px 8px;">
            <div style="font-weight: 700; font-size: 11px; margin-bottom: 3px; color: ${isOnline ? '#16a34a' : '#111'};">${title}</div>
            <div style="margin-bottom: 2px;">Velocidad: 0 km/h</div>
            <div>Estado: ${statusText || 'desconocido'}</div>
          </div>
        `);
      }
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

    const shouldShowLoading = !this.stopTimeText && !this.isStopTimeMoving;
    if (shouldShowLoading) {
      this.isStopTimeLoading = true;
    }

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
    } finally {
      this.isStopTimeLoading = false;
    }
  }

  get stopTimeInfoDisplay(): string {
    if (this.isStopTimeLoading) {
      return 'Cargando...';
    }
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
    this.isStopTimeLoading = false;
  }

  getVehicleImageUrl(fullSize: boolean = false): string | null {
    const ot = this.selectedTarget?.originalTarget;
    const img = fullSize
      ? (ot?.target_image || ot?.target_image_thumbnail)
      : (ot?.target_image_thumbnail || ot?.target_image);
    if (!img) return null;
    if (img.startsWith('/')) {
      return `https://back-montao.dorhu.com${img}`;
    }
    return img;
  }

  onVehicleImageError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  private clearMultipleMarkers(): void {
    if (this.multipleMarkers && this.multipleMarkers.length) {
      this.multipleMarkers.forEach((marker) => {
        try {
          marker.remove ? marker.remove() : MapUtils.removeMarker(marker, this.provider);
        } catch (_) {
          // silently ignore
        }
      });
    }
    this.multipleMarkers = [];
    if (this.provider === 'osm') {
      this.setOsmMarkerFeatures([]);
    }
  }

  private getTargetCoordinates(target: any): { lat: number; lng: number; geo: any } | null {
    const source = target?.originalTarget || target || {};
    const locationCandidates = [
      target?.traccarInfo?.geolocation,
      target?.traccarInfo?.lastLocation,
      target?.traccarInfo?.last_location,
      target?.historicalLocation,
      target?.lastLocation,
      target?.last_location,
      source?.traccarInfo?.geolocation,
      source?.traccarInfo?.lastLocation,
      source?.traccarInfo?.last_location,
      source?.historicalLocation,
      source?.lastLocation,
      source?.last_location,
      source?.position,
      source?.lastPosition,
    ].filter(Boolean);

    const geo = locationCandidates.find(location => {
      const lat = location?.latitude ?? location?.lat ?? location?.Lat;
      const lng = location?.longitude ?? location?.lng ?? location?.lon ?? location?.Long;
      return lat !== undefined && lng !== undefined;
    });

    const lat = geo?.latitude ?? geo?.lat ?? geo?.Lat;
    const lng = geo?.longitude ?? geo?.lng ?? geo?.lon ?? geo?.Long;
    const latNum = parseFloat(lat !== undefined ? String(lat) : '');
    const lngNum = parseFloat(lng !== undefined ? String(lng) : '');

    if (isNaN(latNum) || isNaN(lngNum)) {
      return null;
    }

    return { lat: latNum, lng: lngNum, geo };
  }

  private buildOsmMarkerFeature(target: any, lat: number, lng: number, selected: boolean = false): any {
    const status = target?.traccarStatus || target?.traccarInfo?.status || 'Desconocido';
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lng, lat],
      },
      properties: {
        id: target?._id || target?.id || '',
        title: target?.name || 'Target',
        status,
        selected,
      },
    };
  }

  private setOsmMarkerFeatures(features: any[]): void {
    if (this.provider !== 'osm' || !this.map || !this.isMapReady()) {
      return;
    }

    const data = {
      type: 'FeatureCollection',
      features,
    };

    try {
      const source = this.map.getSource?.('gps-osm-markers');
      if (source?.setData) {
        source.setData(data);
      } else {
        this.map.addSource('gps-osm-markers', {
          type: 'geojson',
          data,
        });
      }

      this.ensureOsmMarkerImages()
        .then(() => this.ensureOsmMarkerLayers())
        .catch((error) => console.error('❌ Error cargando marcador personalizado OSM:', error));
    } catch (error) {
      console.error('❌ Error pintando marcadores OSM:', error);
    }
  }

  private async ensureOsmMarkerImages(): Promise<void> {
    if (this.osmMarkerImagesReady || !this.map) {
      return;
    }

    const loadImage = (url: string): Promise<any> => new Promise((resolve, reject) => {
      this.map.loadImage(url, (error: any, image: any) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(image);
      });
    });

    const [normalImage, grayImage] = await Promise.all([
      loadImage('logo/favicon.png'),
      loadImage('logo/favicon-gray.png'),
    ]);

    if (!this.map.hasImage?.('custom-marker')) {
      this.map.addImage('custom-marker', normalImage);
    }

    if (!this.map.hasImage?.('custom-marker-offline')) {
      this.map.addImage('custom-marker-offline', grayImage);
    }

    this.osmMarkerImagesReady = true;
  }

  private ensureOsmMarkerLayers(): void {
    if (!this.map || !this.map.getSource?.('gps-osm-markers')) {
      return;
    }

    if (!this.map.getLayer?.('gps-osm-marker-symbols')) {
      this.map.addLayer({
        id: 'gps-osm-marker-symbols',
        type: 'symbol',
        source: 'gps-osm-markers',
        layout: {
          'icon-image': [
            'case',
            ['==', ['get', 'status'], 'online'], 'custom-marker',
            ['==', ['get', 'status'], 'Señal débil'], 'custom-marker',
            ['==', ['get', 'status'], 'Localizado'], 'custom-marker',
            'custom-marker-offline'
          ],
          'icon-size': ['case', ['==', ['get', 'selected'], true], 0.2, 0.15],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: {
          'icon-opacity': [
            'case',
            ['==', ['get', 'status'], 'online'], 1,
            ['==', ['get', 'status'], 'Señal débil'], 1,
            ['==', ['get', 'status'], 'Localizado'], 1,
            0.6
          ],
        },
      });
    }

    if (!this.map.getLayer?.('gps-osm-marker-labels')) {
      this.map.addLayer({
        id: 'gps-osm-marker-labels',
        type: 'symbol',
        source: 'gps-osm-markers',
        layout: {
          'text-field': ['get', 'title'],
          'text-size': 11,
          'text-offset': [0, 1.55],
          'text-anchor': 'top',
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#111827',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
      });
    }
  }

  private clearOsmMarkerLayers(): void {
    if (!this.map || this.provider !== 'osm') {
      return;
    }

    try {
      if (this.map.getLayer?.('gps-osm-marker-labels')) {
        this.map.removeLayer('gps-osm-marker-labels');
      }
      if (this.map.getLayer?.('gps-osm-marker-symbols')) {
        this.map.removeLayer('gps-osm-marker-symbols');
      }
      if (this.map.getSource?.('gps-osm-markers')) {
        this.map.removeSource('gps-osm-markers');
      }
    } catch (_) {
      // The map may already be tearing down.
    }
  }

  private renderMultipleTargetsMarkers(): void {
    if (!this.map) return;
    if (!this.isMapReady()) {
      this.pendingMapRender = true;
      return;
    }
    this.mapReady = true;

    this.clearMultipleMarkers();

    if (!Array.isArray(this.targetsForMap) || this.targetsForMap.length === 0) {
      return;
    }

    const validMarkers: { lat: number; lng: number }[] = [];

    console.log(`🗺️ [MapsComponent] Rendering ${this.targetsForMap.length} targets`);

    this.targetsForMap.forEach((target) => {
      const coordinates = this.getTargetCoordinates(target);

      if (!coordinates) {
        console.warn(`🗺️ [MapsComponent] ⚠️ ID: ${target._id || target.id} - ${target.name} has invalid coords. Data dump:`, {
          traccarInfo: target.traccarInfo,
          historicalLocation: target.historicalLocation,
          originalTarget: target.originalTarget
        });
        return;
      }

      const statusLower = (target?.traccarStatus || '').toLowerCase();
      const isOffline = !this.isOnlineLikeStatus(statusLower) && statusLower !== 'localizado';
      const course = coordinates.geo?.course ?? 0;
      const openByDefault = !isOffline && (this.targetsForMap?.length || 0) <= 100;

      const marker = MapUtils.addMarker(
        this.map,
        this.provider,
        coordinates.lat,
        coordinates.lng,
        target?.name || 'Target',
        target?.traccarStatus || 'Desconocido',
        undefined,
        openByDefault,
        course,
      );

      if (!marker) {
        console.error(`🗺️ [MapsComponent] ❌ Failed to create marker for ${target.name}`);
      } else {
        // console.log(`🗺️ [MapsComponent] ✅ Marker added for ${target.name}`);
      }

      // Cerrar popups por defecto si hay más de 100 targets
      if ((this.targetsForMap?.length || 0) > 100 && marker?.getElement) {
        const el = marker.getElement();
        el && el.classList.add('mapbox-popup-closed');
      }

      if (marker) {
        this.multipleMarkers.push(marker);
        validMarkers.push({ lat: coordinates.lat, lng: coordinates.lng });
      }
    });

    console.log(`🗺️ [MapsComponent] Valid markers created: ${validMarkers.length}`);

    if (validMarkers.length) {
      // Al mostrar múltiples sin selección, usar vista amplia de RD
      const centerLat = 19.0751848387914;
      const centerLng = -70.59920843919267
      const zoom = 9;
      if (this.provider === 'google') {
        this.map.setCenter({ lat: centerLat, lng: centerLng });
        this.map.setZoom(zoom);
      } else {
        this.map.setCenter([centerLng, centerLat]);
        this.map.setZoom(zoom);
      }
    }
  }

  private destroyMap(): void {
    if (this.currentMarker) {
      MapUtils.removeMarker(this.currentMarker, this.provider);
      this.currentMarker = null;
    }
    if (this.currentPopup) {
      try {
        this.currentPopup.close ? this.currentPopup.close() : this.currentPopup.remove();
      } catch (_) {
        // ignore
      }
      this.currentPopup = null;
    }
    this.clearMultipleMarkers();
    this.clearOsmMarkerLayers();

    if (this.map) {
      try {
        if ((this.provider === 'mapbox' || this.provider === 'osm') && this.map.remove) {
          this.map.remove();
        }
      } catch (error) {
        console.warn('Error destroying map:', error);
      }
    }

    this.mapReady = false;
    this.pendingMapRender = false;
    this.osmMarkerImagesReady = false;
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
      this.cachedMarkerIconUrl = '/logo/favicon.png';
      return this.cachedMarkerIconUrl;
    }

    const iconLink =
      (document.querySelector("link[rel*='icon']") as HTMLLinkElement | null) ??
      null;
    const href = iconLink?.href ?? '/logo/favicon.png';
    const normalized = href.startsWith('http')
      ? href
      : href.startsWith('/')
        ? `${window.location.origin}${href}`
        : `${window.location.origin}/logo/favicon.png`;
    this.cachedMarkerIconUrl = normalized;

    return this.cachedMarkerIconUrl;
  }

  private getMarkerIconUrlOffline(): string {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return '/logo/favicon-gray.png';
    }

    // Intentar construir la URL absoluta
    const base = window.location.origin;
    return `${base}/logo/favicon-gray.png`;
  }
}
