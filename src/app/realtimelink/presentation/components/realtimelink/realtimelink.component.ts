import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MapUtils } from '../../../../shareds/helpers/map.helper';
import { SystemService } from '../../../../core/services/system.service';
import { TargetsService } from '../../../../core/services/targets.service';

@Component({
    selector: 'app-realtimelink',
    templateUrl: './realtimelink.component.html',
    styleUrls: ['./realtimelink.component.css'],
    standalone: false
})
export class RealtimelinkComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('mapContainer') mapContainer!: ElementRef;

    map: any;
    marker: any;
    provider: 'google' | 'mapbox' = 'google';
    theme: 'dark' | 'light' = 'light';
    targetId: string | null = null;
    target: any = null;
    pollingInterval: any = null;
    currentOverlay: any = null;
    expirationDate: Date | null = null;
    timeRemaining: string = '';
    countdownInterval: any = null;
    isExpired: boolean = false;

    constructor(
        private systemService: SystemService,
        private targetsService: TargetsService,
        private route: ActivatedRoute
    ) { }

    apiKey: string | null = null;

    ngOnInit(): void {
        // Leer los query parameters
        this.route.queryParams.subscribe(async params => {
            const shortCode = params['c'] || params['code'];
            if (shortCode) {
                try {
                    const linkData = await this.targetsService.resolvePublicRealtimeShortLink(shortCode);
                    this.targetId = linkData.target_id || null;
                    this.apiKey = linkData.gkey || null;

                    if (linkData.expires_at) {
                        this.expirationDate = new Date(linkData.expires_at);
                        this.startCountdown();
                    }

                    if (this.targetId && this.map) {
                        this.loadAndDisplayTarget();
                    } else if (this.targetId && !this.map) {
                        this.initializeMap();
                    }
                } catch (error) {
                    console.error('Error resolviendo link corto en tiempo real:', error);
                    this.isExpired = true;
                }
                return;
            }

            // Verificar si hay datos encriptados
            const encodedData = params['data'];

            if (encodedData) {
                try {
                    // Desencriptar datos de base64
                    const jsonData = atob(encodedData);
                    const linkData = JSON.parse(jsonData);

                    // Extraer targetId, fecha de expiración y API Key
                    this.targetId = linkData.trgt || null;
                    const exprcn = linkData.exprcn || null;
                    this.apiKey = linkData.gkey || null;

                    // Procesar fecha de expiración si existe
                    if (exprcn) {
                        this.expirationDate = new Date(exprcn);
                        this.startCountdown();
                    }
                } catch (error) {
                    console.error('Error al desencriptar datos del link:', error);
                    // Si falla la desencriptación, intentar leer parámetros legacy
                    this.targetId = params['trgt'] || null;
                    const exprcn = params['exprcn'] || null;

                    if (exprcn) {
                        this.expirationDate = new Date(exprcn);
                        this.startCountdown();
                    }
                }
            } else {
                // Fallback: leer parámetros legacy (sin encriptar)
                this.targetId = params['trgt'] || null;
                const exprcn = params['exprcn'] || null;

                if (exprcn) {
                    this.expirationDate = new Date(exprcn);
                    this.startCountdown();
                }
            }

            if (this.targetId && this.map) {
                this.loadAndDisplayTarget();
            } else if (this.targetId && !this.map) {
                // Si tenemos targetId pero no mapa, inicializar mapa (posiblemente con la key extraída)
                this.initializeMap();
            }
        });
    }

    ngAfterViewInit(): void {
        // La inicialización del mapa se maneja en ngOnInit después de procesar los parámetros
        // para asegurar que tenemos la API key si viene en el link
    }

    ngOnDestroy(): void {
        // Limpiar polling
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }

        // Limpiar countdown
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }

        // Limpiar marcador
        if (this.marker) {
            this.marker.setMap(null);
        }

        // Limpiar overlay
        if (this.currentOverlay) {
            this.currentOverlay.setMap(null);
        }
    }

    private initializeMap(): void {
        // Si tenemos API key del link, usarla directamente
        if (this.apiKey) {
            this.loadMapWithKey(this.apiKey);
        } else {
            // Si no, intentar obtenerla del servicio público (fallback)
            this.systemService.getPublic().subscribe(systems => {
                const config = MapUtils.getApiConfig(systems, this.provider);
                if (!config) {
                    console.error('No config found for provider:', this.provider);
                    return;
                }
                this.loadMapWithKey(config.key);
            }, error => {
                console.error('Error loading system settings:', error);
            });
        }
    }

    private loadMapWithKey(key: string): void {
        const defaultUrl = this.provider === 'google'
            ? 'https://maps.googleapis.com/maps/api/js?key='
            : 'https://api.mapbox.com/mapbox-gl-js/v2.14.1/mapbox-gl.js';

        MapUtils.loadMapScript(this.provider, key, defaultUrl).then(() => {
            const { centerLat, centerLng, zoomLevel } = MapUtils.getInitialMapCenter(null);
            this.map = MapUtils.createMap(
                this.provider,
                this.mapContainer.nativeElement,
                key,
                this.theme,
                centerLat,
                centerLng,
                zoomLevel
            );

            // Si ya tenemos un targetId, cargar y mostrar el target
            if (this.targetId) {
                this.loadAndDisplayTarget();
            }
        }).catch(err => {
            console.error('Error loading map script:', err);
        });
    }

    private async loadAndDisplayTarget(): Promise<void> {
        if (!this.targetId || !this.map) return;

        try {
            this.target = await this.targetsService.getPublicTargetById(this.targetId);
            this.displayTargetOnMap();

            // Iniciar polling para actualizar ubicación cada 10 segundos
            this.startPolling();
        } catch (err: any) {
            console.error('Error loading target:', err);
        }
    }

    private startPolling(): void {
        // Limpiar polling anterior si existe
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }

        // Iniciar nuevo polling cada 10 segundos
        this.pollingInterval = setInterval(async () => {
            await this.updateTargetLocation();
        }, 10000);
    }

    private async updateTargetLocation(): Promise<void> {
        if (!this.targetId || !this.map) return;

        try {
            // Obtener datos actualizados del target
            const updatedTarget = await this.targetsService.getPublicTargetById(this.targetId);

            // Verificar si hay cambios en la ubicación
            const newLat = updatedTarget.traccarInfo?.['geolocation']?.['latitude'] || updatedTarget.traccarInfo?.['latitude'];
            const newLng = updatedTarget.traccarInfo?.['geolocation']?.['longitude'] || updatedTarget.traccarInfo?.['longitude'];

            if (!newLat || !newLng) {
                console.warn('No valid coordinates in updated target');
                return;
            }

            // Actualizar target
            this.target = updatedTarget;

            // Actualizar posición del marcador
            const newPosition = new google.maps.LatLng(newLat, newLng);
            if (this.marker) {
                this.marker.setPosition(newPosition);

                // Actualizar ícono según estado y curso
                const status = this.target.traccarInfo?.status || 'offline';
                const isOffline = status !== 'online';
                const course = updatedTarget.traccarInfo?.['geolocation']?.['course'] || 0;
                const markerType = MapUtils.getMapMarkerType();

                if (markerType === 'vehicle') {
                    const spriteIconUrl = await MapUtils.getCarSpriteIconUrl(course, 48);
                    this.marker.setIcon({
                        url: spriteIconUrl,
                        scaledSize: new google.maps.Size(48, 68),
                        anchor: new google.maps.Point(24, 50)
                    });
                } else {
                    const iconUrl = isOffline ? this.getMarkerIconUrlOffline() : this.getMarkerIconUrl();
                    this.marker.setIcon({
                        url: iconUrl,
                        scaledSize: new google.maps.Size(32, 32),
                        anchor: new google.maps.Point(16, 16)
                    });
                }
                this.marker.setOpacity(isOffline ? 0.65 : 1);
            }

            // Actualizar popup
            this.updatePopup(newLat, newLng);

            // Recentrar mapa si el marcador sale de la vista
            MapUtils.recenterMapIfOutOfView(this.map, this.provider, newLat, newLng);

        } catch (err: any) {
            console.error('Error updating target location:', err);
        }
    }

    private updatePopup(lat: number, lng: number): void {
        // Remover overlay anterior
        if (this.currentOverlay) {
            this.currentOverlay.setMap(null);
        }

        // Crear nuevo popup con datos actualizados
        const status = this.target.traccarInfo?.status || 'offline';
        this.createCustomPopup(lat, lng, status);
    }

    private async displayTargetOnMap(): Promise<void> {
        if (!this.target || !this.map) return;

        const lat = this.target.traccarInfo?.geolocation?.latitude || this.target.traccarInfo?.latitude;
        const lng = this.target.traccarInfo?.geolocation?.longitude || this.target.traccarInfo?.longitude;

        if (!lat || !lng) {
            console.warn('Target does not have valid coordinates');
            return;
        }

        // Limpiar marcador anterior si existe
        if (this.marker) {
            this.marker.setMap(null);
        }

        // Obtener estado del target
        const status = this.target.traccarInfo?.status || 'offline';
        const isOffline = status !== 'online';
        const course = this.target.traccarInfo?.geolocation?.course || 0;
        const markerType = MapUtils.getMapMarkerType();

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

        // Crear marcador
        const position = new google.maps.LatLng(lat, lng);
        this.marker = new google.maps.Marker({
            position: position,
            map: this.map,
            title: this.target.name,
            icon: iconConfig,
            opacity: isOffline ? 0.65 : 1
        });

        // Crear popup personalizado con overlay
        this.createCustomPopup(lat, lng, status);

        // Centrar mapa en el target
        this.map.setCenter(position);
        this.map.setZoom(16);
    }

    private createCustomPopup(lat: number, lng: number, status: string): void {
        const statusColor = status === 'online' ? '#16a34a' : '#dc2626';
        const statusText = status === 'online' ? 'En línea' : 'Desconectado';

        // Crear contenido del popup
        const popupContent = `
            <div class="custom-popup">
                <button class="custom-popup-close" onclick="document.querySelector('.custom-popup-overlay').remove()">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M14 1.41L12.59 0L7 5.59L1.41 0L0 1.41L5.59 7L0 12.59L1.41 14L7 8.41L12.59 14L14 12.59L8.41 7L14 1.41Z" fill="currentColor"/>
                    </svg>
                </button>
                <div class="custom-popup-header">${this.target.name}</div>
                <div class="custom-popup-row">
                    <span class="custom-popup-label" style="color: #2563eb; font-weight: 600;">Compartido</span>
                    <span class="custom-popup-value" style="color: ${statusColor}; font-weight: 600;">${statusText}</span>
                </div>
                <div class="custom-popup-address">${this.target.traccarInfo?.geolocation?.address || 'tracker.montao.net'}</div>
            </div>
        `;

        // Crear overlay personalizado
        const overlay = new google.maps.OverlayView();

        overlay.onAdd = function () {
            const div = document.createElement('div');
            div.className = 'custom-popup-overlay';
            div.innerHTML = popupContent;

            const panes = this.getPanes();
            panes!.floatPane.appendChild(div);
        };

        overlay.draw = function () {
            const projection = this.getProjection();
            const point = projection.fromLatLngToDivPixel(new google.maps.LatLng(lat, lng));

            const div = document.querySelector('.custom-popup-overlay') as HTMLElement;
            if (div && point) {
                div.style.left = point.x + 'px';
                div.style.top = (point.y - 60) + 'px';
            }
        };

        overlay.onRemove = function () {
            const div = document.querySelector('.custom-popup-overlay');
            if (div && div.parentNode) {
                div.parentNode.removeChild(div);
            }
        };

        overlay.setMap(this.map);

        // Guardar referencia al overlay actual
        this.currentOverlay = overlay;
    }

    private getMarkerIconUrl(): string {
        const base = window.location.origin;
        const iconLink = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
        const href = iconLink?.href ?? '/logo/favicon.png';
        const normalized = href.startsWith('http')
            ? href
            : href.startsWith('/')
                ? `${base}${href}`
                : `${base}/logo/favicon.png`;
        return normalized;
    }

    private getMarkerIconUrlOffline(): string {
        const base = window.location.origin;
        return `${base}/logo/favicon-gray.png`;
    }

    openInGoogleMaps(): void {
        if (!this.target) return;

        const lat = this.target.traccarInfo?.['geolocation']?.['latitude'] || this.target.traccarInfo?.['latitude'];
        const lng = this.target.traccarInfo?.['geolocation']?.['longitude'] || this.target.traccarInfo?.['longitude'];

        if (!lat || !lng) {
            console.warn('No valid coordinates for navigation');
            return;
        }

        const url = `https://www.google.com/maps?q=${lat},${lng}`;
        window.open(url, '_blank');
    }

    openInWaze(): void {
        if (!this.target) return;

        const lat = this.target.traccarInfo?.['geolocation']?.['latitude'] || this.target.traccarInfo?.['latitude'];
        const lng = this.target.traccarInfo?.['geolocation']?.['longitude'] || this.target.traccarInfo?.['longitude'];

        if (!lat || !lng) {
            console.warn('No valid coordinates for navigation');
            return;
        }

        const url = `https://www.waze.com/ul?ll=${lat}%2C${lng}&navigate=yes&zoom=17`;
        window.open(url, '_blank');
    }

    private startCountdown(): void {
        // Actualizar inmediatamente
        this.updateCountdown();

        // Actualizar cada segundo
        this.countdownInterval = setInterval(() => {
            this.updateCountdown();
        }, 1000);
    }

    private updateCountdown(): void {
        if (!this.expirationDate) return;

        const now = new Date();
        const diff = this.expirationDate.getTime() - now.getTime();

        if (diff <= 0) {
            this.isExpired = true;
            this.timeRemaining = 'Expirado';
            if (this.countdownInterval) {
                clearInterval(this.countdownInterval);
            }
            return;
        }

        // Calcular tiempo restante
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        // Formatear el tiempo
        if (days > 0) {
            this.timeRemaining = `${days}d ${hours}h ${minutes}m ${seconds}s`;
        } else if (hours > 0) {
            this.timeRemaining = `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
            this.timeRemaining = `${minutes}m ${seconds}s`;
        } else {
            this.timeRemaining = `${seconds}s`;
        }
    }
}
