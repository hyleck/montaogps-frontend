import { Component, OnInit, OnChanges, OnDestroy, SimpleChanges, Input } from '@angular/core';
import { Router } from '@angular/router';
import { ThemesService } from '../../services/themes.service';
import { StatusService } from '../../services/status.service';
import { SystemService, SystemSettings } from '../../../core/services/system.service';
import { TargetsService } from '../../../core/services/targets.service';

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
   currentPopup: any = null;
   currentPopupId: string = '';
   currentTargetId: string | null = null; // Para rastrear cambios de target
   offlineDuration: string = '';
   isTargetOffline: boolean = false;

  constructor(
    private _theme: ThemesService,
    private _status: StatusService,
    private systemService: SystemService,
    private targetsService: TargetsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initializeNewProvider();
    this.setupGlobalFunctions();
  }

  private setupGlobalFunctions(): void {
    // Función global para toggle de detalles en popups con ID específico
    (window as any).togglePopupDetails = (popupId: string) => {
      const popup = document.getElementById(popupId);
      if (!popup) return;
      
      const details = popup.querySelector(`#details-${popupId}`) as HTMLElement;
      const expandIcon = popup.querySelector('.expand-icon') as HTMLElement;
      
      if (details && expandIcon) {
        const isExpanded = details.style.maxHeight !== '0px' && details.style.maxHeight !== '';
        
        if (!isExpanded) {
          // Expandir
          details.style.maxHeight = '80px';
          details.style.opacity = '1';
          details.style.paddingTop = '8px';
          details.style.paddingBottom = '8px';
          expandIcon.style.transform = 'rotate(180deg)';
        } else {
          // Contraer
          details.style.maxHeight = '0px';
          details.style.opacity = '0';
          details.style.paddingTop = '0px';
          details.style.paddingBottom = '0px';
          expandIcon.style.transform = 'rotate(0deg)';
        }
      }
    };

    // Función global para actualizar solo el tiempo de parada
    (window as any).updateStopTime = (popupId: string, stopTime: string) => {
      const popup = document.getElementById(popupId);
      if (!popup) return;
      
      const stopTimeElement = popup.querySelector(`#stop-time-${popupId} .detail-value`) as HTMLElement;
      if (stopTimeElement) {
        stopTimeElement.textContent = stopTime;
      }
    };

    // Función global para navegar a reportes con ID del target
    (window as any).navigateToReports = (targetId: string) => {
      this.navigateToReports(targetId);
    };
  }

  private navigateToReports(targetId: string): void {
    // Navegar a reportes con query parameters
    this.router.navigate(['/admin/reports'], {
      queryParams: {
        target: targetId,
        type: 'history' // Tipo de reporte por defecto
      }
    });
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
    }
  }

  ngOnDestroy(): void {
    this.destroyMap();
    this.cleanupGlobalFunctions();
  }

  private cleanupGlobalFunctions(): void {
    // Limpiar funciones globales
    if ((window as any).togglePopupDetails) {
      delete (window as any).togglePopupDetails;
    }
    if ((window as any).updateStopTime) {
      delete (window as any).updateStopTime;
    }
    if ((window as any).navigateToReports) {
      delete (window as any).navigateToReports;
    }
    if ((window as any).closeCurrentMapPopup) {
      delete (window as any).closeCurrentMapPopup;
    }
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

    if (!this.isTargetOffline) {
      this.offlineDuration = '';
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
      return;
    }

    if (diffInMs < 0) {
      this.offlineDuration = 'Fecha futura';
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
        this.currentPopup = null;
        this.currentPopupId = '';
        this.currentTargetId = null;
      }
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
        this.currentPopup = null;
        this.currentPopupId = '';
        this.currentTargetId = null;
      }
      return;
    }

    const targetId = this.selectedTarget._id || this.selectedTarget.id;
    const isNewTarget = this.currentTargetId !== targetId;

    if (isNewTarget) {
      this.currentTargetId = targetId;

      // Remover marcador anterior si existe para crear uno nuevo
      if (this.currentMarker) {
        MapUtils.removeMarker(this.currentMarker, this.provider);
        this.currentMarker = null;
        this.currentPopup = null;
        this.currentPopupId = '';
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
      this.createMarkerWithPopup(lat, lng);

      // Para un target nuevo, obtener tiempo de parada desde cero
      this.updateMarkerWithStopTime(true);
    } else {
      // Si el marcador existe y es el mismo target, solo actualizar
      this.updateExistingMarker(lat, lng);
    }
  }

  private createMarkerWithPopup(lat: number, lng: number): void {
    const title = this.selectedTarget.name || 'Target';
    const imei = this.selectedTarget.imei || 'N/A';
    const status = this.selectedTarget.traccarStatus || 'desconocido';
    const isOffline = this.isTargetOffline;

    // Crear contenido inicial del popup (sin tiempo de parada)
    const initialContent = this.createPopupContent(title, imei, status, null);
    
    // Extraer el popupId del contenido HTML
    const popupIdMatch = initialContent.match(/id="(popup-[^"]+)"/);
    this.currentPopupId = popupIdMatch ? popupIdMatch[1] : '';

    if (this.provider === 'google') {
      // Crear marcador Google Maps
      const markerColor = isOffline ? '#ef4444' : '#22c55e'; // Red for offline, green for online
      this.currentMarker = new google.maps.Marker({
        position: { lat, lng },
        map: this.map,
        title: title,
        icon: {
          url: 'data:image/svg+xml;base64,' + btoa(`
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="12" fill="${markerColor}" stroke="#fff" stroke-width="2"/>
              <circle cx="16" cy="16" r="6" fill="#fff"/>
            </svg>
          `),
          scaledSize: new google.maps.Size(32, 32),
          anchor: new google.maps.Point(16, 16)
        }
      });

      // Crear InfoWindow
      this.currentPopup = new google.maps.InfoWindow({
        content: initialContent
      });

      // Configurar función global para cerrar popup
      (window as any).closeCurrentMapPopup = () => {
        if (this.currentPopup) {
          this.currentPopup.close();
        }
      };

      // Abrir InfoWindow
      this.currentPopup.open(this.map, this.currentMarker);

      // Listener para click en marcador
      this.currentMarker.addListener('click', () => {
        this.currentPopup.open(this.map, this.currentMarker);
      });

    } else {
      // Crear marcador Mapbox
      const mapboxgl = (window as any).mapboxgl;
      
      const markerElement = document.createElement('div');
      markerElement.className = 'custom-marker';
      const markerColor = isOffline ? '#ef4444' : '#22c55e'; // Red for offline, green for online
      markerElement.style.cssText = `
        width: 32px;
        height: 32px;
        background: ${markerColor};
        border: 2px solid #fff;
        border-radius: 50%;
        cursor: pointer;
        position: relative;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      `;
      
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

      this.currentMarker = new mapboxgl.Marker(markerElement)
        .setLngLat([lng, lat])
        .addTo(this.map);

      // Crear popup Mapbox
      this.currentPopup = new mapboxgl.Popup({ offset: 25 })
        .setHTML(initialContent);

      // Configurar función global para cerrar popup
      (window as any).closeCurrentMapPopup = () => {
        if (this.currentPopup) {
          this.currentPopup.remove();
        }
      };

      this.currentMarker.setPopup(this.currentPopup);
      this.currentMarker.togglePopup();
    }
  }

  private updateExistingMarker(lat: number, lng: number): void {
    if (!this.currentMarker) return;

    const title = this.selectedTarget.name || 'Target';
    const imei = this.selectedTarget.imei || 'N/A';
    const status = this.selectedTarget.traccarStatus || 'desconocido';
    const speed = this.selectedTarget.traccarInfo?.geolocation?.speed ? 
                  Math.round(this.selectedTarget.traccarInfo.geolocation.speed * 1.852) : 0;

    if (this.provider === 'google') {
      // Actualizar posición del marcador Google Maps
      this.currentMarker.setPosition({ lat, lng });
      
      // Actualizar título del marcador
      this.currentMarker.setTitle(title);

      // Actualizar contenido del popup si está abierto (sin regenerar HTML)
      if (this.currentPopup && this.currentPopup.getMap()) {
        this.updatePopupContent(title, imei, status, speed);
      }

    } else {
      // Actualizar posición del marcador Mapbox
      this.currentMarker.setLngLat([lng, lat]);

      // Actualizar contenido del popup si está abierto (sin regenerar HTML)
      if (this.currentPopup && this.currentPopup.isOpen()) {
        this.updatePopupContent(title, imei, status, speed);
      }
    }

    // Solicitar tiempo de parada actualizado en cada polling
    this.updateMarkerWithStopTime();
  }

  private async updateMarkerWithStopTime(isInitialRequest: boolean = false): Promise<void> {
    const deviceId = this.selectedTarget?.device_imei || this.selectedTarget?.imei || this.selectedTarget?.originalTarget?.device_imei || this.selectedTarget?.originalTarget?.imei;
    if (!deviceId || !this.currentMarker) {
      return;
    }

    try {
      const requestType = isInitialRequest ? '[INICIAL]' : '[POLLING]';
      
      const stopTimeResult = await this.targetsService.getStopTime(deviceId);

      if (stopTimeResult && stopTimeResult.text && !stopTimeResult.isMoving) {
        // Actualizar el popup con el tiempo de parada solo si el vehículo no está en movimiento
        this.updateMarkerPopupWithStopTime(stopTimeResult.text);
      } else if (stopTimeResult && stopTimeResult.isMoving) {
        // Si es una solicitud inicial y el vehículo está en movimiento, limpiar cualquier tiempo previo
        if (isInitialRequest) {
          this.clearStopTimeFromPopup();
        }
      } else {
        // Si es una solicitud inicial, limpiar cualquier tiempo previo
        if (isInitialRequest) {
          this.clearStopTimeFromPopup();
        }
      }
    } catch (error) {
      console.error(`❌ ${isInitialRequest ? '[INICIAL]' : '[POLLING]'} Error al obtener tiempo de parada:`, error);
    }
  }

  private updateMarkerPopupWithStopTime(stopTime: string): void {
    if (!this.currentPopupId || !stopTime) return;

    const popupElement = document.querySelector(`#${this.currentPopupId}`) as HTMLElement;
    if (!popupElement) return;

    // Usar el método optimizado del PopupBuilder para actualizar tiempo de parada
    const PopupBuilder = (window as any).PopupBuilder;
    if (PopupBuilder && PopupBuilder.updatePopupElementsDirectly) {
      const speed = this.selectedTarget.traccarInfo?.geolocation?.speed ? 
                   Math.round(this.selectedTarget.traccarInfo.geolocation.speed * 1.852) : 0;
      
      PopupBuilder.updatePopupElementsDirectly(popupElement, {
        stopTime: stopTime,
        speedKmh: speed
      });
    } else {
      // Fallback: usar la función global
      if ((window as any).updateStopTime) {
        (window as any).updateStopTime(this.currentPopupId, stopTime);
      } else {
        console.warn('⚠️ Función updateStopTime no disponible');
      }
    }
  }

  private clearStopTimeFromPopup(): void {
    if (!this.currentPopupId) return;

    const popupElement = document.querySelector(`#${this.currentPopupId}`) as HTMLElement;
    if (!popupElement) return;

    // Usar el método optimizado del PopupBuilder para limpiar tiempo de parada
    const PopupBuilder = (window as any).PopupBuilder;
    if (PopupBuilder && PopupBuilder.updatePopupElementsDirectly) {
      PopupBuilder.updatePopupElementsDirectly(popupElement, {
        stopTime: null // Limpiar tiempo de parada
      });
    } else {
      // Fallback: usar método manual
      const stopTimeSection = popupElement.querySelector('.popup-stop-time');
      if (stopTimeSection) {
        stopTimeSection.remove();
      }
    }
  }

  private updatePopupContent(title: string, imei: string, status: string, speed?: number): void {
    if (!this.currentPopupId) return;

    const popupElement = document.querySelector(`#${this.currentPopupId}`) as HTMLElement;
    if (!popupElement) return;

    // Usar el método optimizado del PopupBuilder
    const PopupBuilder = (window as any).PopupBuilder;
    if (PopupBuilder && PopupBuilder.updatePopupElementsDirectly) {
      PopupBuilder.updatePopupElementsDirectly(popupElement, {
        title,
        speedKmh: speed,
        status
      });
    } else {
      // Fallback: actualización manual
      this.updatePopupElementsManually(popupElement, title, status, speed);
    }

  }

  private updatePopupElementsManually(popupElement: HTMLElement, title: string, status: string, speed?: number): void {
    // Actualizar título
    const titleElement = popupElement.querySelector('.popup-title');
    if (titleElement) {
      titleElement.textContent = title;
    }

    // Actualizar velocidad
    const speedElement = popupElement.querySelector('.popup-info-item .info-value');
    if (speedElement) {
      const speedText = speed === 0 ? 'Estacionado' : `${speed} km/h`;
      speedElement.textContent = speedText;
    }

    // Actualizar estado
    const statusElement = popupElement.querySelector('.popup-status span');
    if (statusElement) {
      statusElement.textContent = status === 'online' ? 'En línea' : 'Desconectado';
    }
  }

  private createPopupContent(title: string, imei: string, status: string, stopTime: string | null): string {
    // Crear ID único para este popup
    const popupId = `popup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Obtener el ID del target para la navegación
    const targetId = this.selectedTarget?._id || this.selectedTarget?.id || '';
    
    return `
      <div class="custom-popup" id="${popupId}">
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
          <div class="popup-info-item expandable" onclick="window.togglePopupDetails('${popupId}')">
            <div class="info-icon">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2 2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </div>
            <div class="info-content">
              <span class="info-label">Más información</span>
              <svg class="expand-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" style="transition: transform 0.3s ease;">
                <polyline points="6,9 12,15 18,9"></polyline>
              </svg>
            </div>
          </div>
          <div class="popup-details" id="details-${popupId}" style="max-height: 0px; opacity: 0; overflow: hidden; transition: all 0.3s ease; padding: 0;">
            <div class="detail-item">
              <span class="detail-label">IMEI:</span>
              <span class="detail-value">${imei}</span>
            </div>
            <div class="detail-item" id="stop-time-${popupId}">
              <span class="detail-label">Tiempo detenido:</span>
              <span class="detail-value">${stopTime || 'Cargando...'}</span>
            </div>
          </div>
          <div class="popup-footer">
            <div class="popup-history-btn" onclick="window.navigateToReports('${targetId}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12,6 12,12 16,14"></polyline>
              </svg>
              Historial
            </div>
            <button class="popup-close-btn" onclick="if(window.closeCurrentMapPopup) window.closeCurrentMapPopup()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    `;
  }



  private destroyMap(): void {
    
    // Limpiar marcador y popup antes de destruir el mapa
    if (this.currentMarker) {
      MapUtils.removeMarker(this.currentMarker, this.provider);
      this.currentMarker = null;
    }
    
    if (this.currentPopup) {
      // Cerrar popup si existe
      if (this.provider === 'google' && this.currentPopup.close) {
        this.currentPopup.close();
      }
      this.currentPopup = null;
      this.currentPopupId = '';
    }
    
    if (this.map) {
      try {
        // Destruir el mapa según el proveedor
        if (this.provider === 'mapbox' && this.map.remove) {
          this.map.remove();
        }
      } catch (error) {
        console.warn('Error destroying map:', error);
      }
    }
    
    this.map = null;
    
    // Limpiar completamente el contenedor del mapa
    const mapElement = document.getElementById('map');
    if (mapElement) {
      mapElement.innerHTML = '';
      mapElement.className = '';
      mapElement.style.cssText = '';
    }
  }
}
