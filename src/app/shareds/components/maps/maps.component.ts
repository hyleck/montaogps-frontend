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

  constructor(
    private _theme: ThemesService,
    private _status: StatusService,
    private systemService: SystemService,
    private targetsService: TargetsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    console.log('🆕 Maps component initialized with provider:', this.provider);
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
        console.log('✅ Tiempo de parada actualizado en DOM:', stopTime);
      }
    };

    // Función global para navegar a reportes con ID del target
    (window as any).navigateToReports = (targetId: string) => {
      this.navigateToReports(targetId);
    };
  }

  private navigateToReports(targetId: string): void {
    console.log('🧭 Navegando a reportes con targetId:', targetId);
    // Navegar a reportes con query parameters
    this.router.navigate(['/admin/reports'], {
      queryParams: {
        target: targetId,
        type: 'history' // Tipo de reporte por defecto
      }
    });
  }

  private initializeNewProvider(): void {
    console.log('🚀 Initializing new provider:', this.provider);
    console.log('🔧 Current component state:', {
      provider: this.provider,
      theme: this.theme,
      hasSelectedTarget: !!this.selectedTarget,
      mapExists: !!this.map
    });

    this.systemService.getAll().subscribe((systems: SystemSettings[]) => {
      const config = MapUtils.getApiConfig(systems, this.provider);
      if (!config) {
        console.error('❌ No config found for provider:', this.provider);
        return;
      }

      this.apiKey = config.key;
      this.apiUrl = config.url;
      console.log('📦 Config loaded for', this.provider, { 
        hasKey: !!this.apiKey, 
        hasUrl: !!this.apiUrl,
        keyLength: this.apiKey?.length,
        url: this.apiUrl 
      });

      MapUtils.loadMapScript(this.provider, this.apiKey, this.apiUrl)
        .then(async () => {
          console.log('📜 Script loaded successfully, initializing map...');
          await this.initializeMap();
          console.log('✅ Map initialization completed for provider:', this.provider);
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
      console.log('Provider changed, reinitializing map:', this.provider);
      this.destroyMap();
      setTimeout(() => {
        this.initializeNewProvider();
      }, 50);
      return;
    }

    // Solo manejar cambios de tema si el mapa ya existe
    if (this.map && changes['theme']) {
      console.log('Theme changed to', this.theme);
      MapThemeService.updateTheme(this.map, this.provider, this.theme, this.selectedTarget);
    }

    // Manejar cambios en el target seleccionado
    if (changes['selectedTarget']) {
      console.log('Selected target changed:', this.selectedTarget);
      this.updateTargetMarker();
    }
  }

  ngOnDestroy(): void {
    console.log('🧹 Maps component destroyed');
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
  }

  private async initializeMap(): Promise<void> {
    console.log('🗺️ Starting map initialization...');
    
    const mapElement = document.getElementById('map') as HTMLElement;
    if (!mapElement) {
      console.error('❌ Map element not found!');
      return;
    }
    
    // Usar coordenadas por defecto si no hay target seleccionado
    const { centerLat, centerLng, zoomLevel } = MapUtils.getInitialMapCenter(this.selectedTarget);
    
    console.log('📍 Map coordinates:', {
      centerLat: centerLat.toFixed(6),
      centerLng: centerLng.toFixed(6),
      zoomLevel,
      fromTarget: !!this.selectedTarget?.traccarInfo?.geolocation
    });

    try {
      // Crear mapa básico sin marcadores
      this.map = MapUtils.createMap(this.provider, mapElement, this.apiKey, this.theme, centerLat, centerLng, zoomLevel);
      
      if (this.map) {
        console.log('✅ Mapa inicializado correctamente para provider:', this.provider);
        // Agregar marcador inicial si hay target seleccionado
        this.updateTargetMarker();
      } else {
        console.error('❌ Error: mapa es null después de la creación');
      }
    } catch (error) {
      console.error('❌ Error creating map:', error);
    }
  }

  private updateTargetMarker(): void {
    if (!this.map) return;

    console.log('🔄 Actualizando marcador para target:', this.selectedTarget?.name || 'ninguno');

    // Si no hay target seleccionado, remover marcador existente
    if (!this.selectedTarget?.traccarInfo?.geolocation) {
      if (this.currentMarker) {
        MapUtils.removeMarker(this.currentMarker, this.provider);
        this.currentMarker = null;
        this.currentPopup = null;
        this.currentPopupId = '';
        this.currentTargetId = null;
      }
      console.log('ℹ️ No hay target seleccionado o no tiene geolocalización');
      return;
    }

    const targetId = this.selectedTarget._id || this.selectedTarget.id;
    const isNewTarget = this.currentTargetId !== targetId;

    if (isNewTarget) {
      console.log('🆕 Target cambió de', this.currentTargetId, 'a', targetId, '- Reiniciando marcador');
      this.currentTargetId = targetId;
      
      // Remover marcador anterior si existe para crear uno nuevo
      if (this.currentMarker) {
        MapUtils.removeMarker(this.currentMarker, this.provider);
        this.currentMarker = null;
        this.currentPopup = null;
        this.currentPopupId = '';
      }
    }

    const lat = parseFloat(this.selectedTarget.traccarInfo.geolocation.latitude);
    const lng = parseFloat(this.selectedTarget.traccarInfo.geolocation.longitude);
    
    if (isNaN(lat) || isNaN(lng)) {
      console.warn('⚠️ Coordenadas inválidas para el target:', { lat, lng });
      return;
    }

    // Solo recentrar si el marcador está fuera de la vista
    MapUtils.recenterMapIfOutOfView(this.map, this.provider, lat, lng);

    // Si el marcador no existe o es un target nuevo, crearlo
    if (!this.currentMarker || isNewTarget) {
      this.createMarkerWithPopup(lat, lng);
      console.log('✅ Marcador creado para:', this.selectedTarget.name);
      
      // Para un target nuevo, obtener tiempo de parada desde cero
      console.log('🔄 Solicitando tiempo de parada inicial para target nuevo');
      this.updateMarkerWithStopTime(true);
    } else {
      // Si el marcador existe y es el mismo target, solo actualizar
      this.updateExistingMarker(lat, lng);
      console.log('🔄 Marcador actualizado para:', this.selectedTarget.name);
    }
  }

  private createMarkerWithPopup(lat: number, lng: number): void {
    const title = this.selectedTarget.name || 'Target';
    const imei = this.selectedTarget.imei || 'N/A';
    const status = this.selectedTarget.traccarStatus || 'desconocido';

    // Crear contenido inicial del popup (sin tiempo de parada)
    const initialContent = this.createPopupContent(title, imei, status, null);
    
    // Extraer el popupId del contenido HTML
    const popupIdMatch = initialContent.match(/id="(popup-[^"]+)"/);
    this.currentPopupId = popupIdMatch ? popupIdMatch[1] : '';

    if (this.provider === 'google') {
      // Crear marcador Google Maps
      this.currentMarker = new google.maps.Marker({
        position: { lat, lng },
        map: this.map,
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

      // Crear InfoWindow
      this.currentPopup = new google.maps.InfoWindow({
        content: initialContent
      });

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
    const deviceId = this.selectedTarget?.api_device_id || this.selectedTarget?.originalTarget?.api_device_id;
    if (!deviceId || !this.currentMarker) {
      console.log('⚠️ No se puede obtener tiempo de parada - deviceId:', deviceId, 'currentMarker:', !!this.currentMarker);
      return;
    }

    try {
      const requestType = isInitialRequest ? '[INICIAL]' : '[POLLING]';
      console.log(`🕒 ${requestType} Solicitando tiempo de parada para deviceId:`, deviceId);
      
      const stopTimeResult = await this.targetsService.getStopTime(deviceId);
      console.log(`📊 ${requestType} Resultado del tiempo de parada:`, stopTimeResult);

      if (stopTimeResult && stopTimeResult.text && !stopTimeResult.isMoving) {
        // Actualizar el popup con el tiempo de parada solo si el vehículo no está en movimiento
        this.updateMarkerPopupWithStopTime(stopTimeResult.text);
        console.log(`✅ ${requestType} Tiempo de parada actualizado en popup:`, stopTimeResult.text);
      } else if (stopTimeResult && stopTimeResult.isMoving) {
        console.log(`🚗 ${requestType} Vehículo en movimiento, no hay tiempo de parada`);
        // Si es una solicitud inicial y el vehículo está en movimiento, limpiar cualquier tiempo previo
        if (isInitialRequest) {
          this.clearStopTimeFromPopup();
        }
      } else {
        console.log(`ℹ️ ${requestType} No hay tiempo de parada disponible`);
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
      console.log('✅ Tiempo de parada actualizado vía PopupBuilder:', stopTime);
    } else {
      // Fallback: usar la función global
      if ((window as any).updateStopTime) {
        (window as any).updateStopTime(this.currentPopupId, stopTime);
        console.log('✅ Popup actualizado con tiempo de parada (fallback):', stopTime);
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
      console.log('🧹 Tiempo de parada limpiado del popup (target nuevo)');
    } else {
      // Fallback: usar método manual
      const stopTimeSection = popupElement.querySelector('.popup-stop-time');
      if (stopTimeSection) {
        stopTimeSection.remove();
        console.log('🧹 Tiempo de parada limpiado del popup manualmente');
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

    console.log('✅ Contenido del popup actualizado sin parpadeos');
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
            <button class="popup-close-btn" onclick="this.closest('${this.provider === 'google' ? '.gm-style-iw' : '.mapboxgl-popup'}').parentElement.style.display='none'">
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
    console.log('🧹 Destroying map, provider:', this.provider);
    
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
          console.log('🗑️ Removing Mapbox map');
          this.map.remove();
        } else if (this.provider === 'google') {
          console.log('🗑️ Clearing Google map');
          // Para Google Maps, simplemente dejamos que se limpie el contenedor
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
      console.log('✅ Map container cleaned');
    }
  }
}
