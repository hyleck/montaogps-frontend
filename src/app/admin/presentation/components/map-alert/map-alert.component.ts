import { Component, OnInit, OnDestroy, Input, ElementRef, ViewChild, AfterViewInit, OnChanges } from '@angular/core';
import { MapUtils } from '../../../../shareds/helpers/map.helper';
import { SystemService } from '../../../../core/services/system.service';

@Component({
    selector: 'app-map-alert',
    templateUrl: './map-alert.component.html',
    styleUrls: ['./map-alert.component.css'],
    standalone: true
})
export class MapAlertComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges {
    @Input() provider: 'google' | 'mapbox' = 'google';
    @Input() theme: 'dark' | 'light' = 'light';

    @ViewChild('mapContainer') mapContainer!: ElementRef;

    drawingManager: any;
    currentPolygon: any;

    map: any;

    constructor(
        private systemService: SystemService
    ) { }

    ngOnInit(): void { }

    ngAfterViewInit(): void {
        this.initializeMap();
    }

    ngOnDestroy(): void {
        if (this.currentPolygon) {
            this.currentPolygon.setMap(null);
        }
        if (this.drawingManager) {
            this.drawingManager.setMap(null);
        }
    }

    private initializeMap(): void {
        this.systemService.getAll().subscribe(systems => {
            const config = MapUtils.getApiConfig(systems, this.provider);
            if (!config) {
                console.error('No config found for provider:', this.provider);
                return;
            }

            MapUtils.loadMapScript(this.provider, config.key, config.url).then(() => {
                const { centerLat, centerLng, zoomLevel } = MapUtils.getInitialMapCenter(null);
                this.map = MapUtils.createMap(
                    this.provider,
                    this.mapContainer.nativeElement,
                    config.key,
                    this.theme,
                    centerLat,
                    centerLng,
                    zoomLevel
                );

                if (this.provider === 'google') {
                    this.initializeDrawingManager();
                    this.updateMarkers();
                }
            }).catch(err => {
                console.error('Error loading map script:', err);
            });
        });
    }

    private initializeDrawingManager(): void {
        if (!google.maps.drawing) {
            console.error('Google Maps Drawing library not loaded');
            return;
        }

        this.drawingManager = new google.maps.drawing.DrawingManager({
            drawingMode: google.maps.drawing.OverlayType.POLYGON,
            drawingControl: true,
            drawingControlOptions: {
                position: google.maps.ControlPosition.TOP_CENTER,
                drawingModes: [google.maps.drawing.OverlayType.POLYGON]
            },
            polygonOptions: {
                fillColor: '#1a73e8',
                fillOpacity: 0.3,
                strokeWeight: 2,
                strokeColor: '#1a73e8',
                clickable: true,
                editable: true,
                draggable: true,
                zIndex: 1
            }
        });

        this.drawingManager.setMap(this.map);

        google.maps.event.addListener(this.drawingManager, 'polygoncomplete', (polygon: any) => {
            // Si ya existe un polígono, eliminar el anterior (solo permitimos uno a la vez)
            if (this.currentPolygon) {
                this.currentPolygon.setMap(null);
            }

            this.currentPolygon = polygon;

            // Desactivar modo dibujo después de completar uno
            this.drawingManager.setDrawingMode(null);

            // Escuchar cambios en el polígono
            this.addPolygonListeners(polygon);
        });
    }

    private addPolygonListeners(polygon: any): void {
        const path = polygon.getPath();
        google.maps.event.addListener(path, 'set_at', () => {
            this.logPolygonCoordinates();
        });
        google.maps.event.addListener(path, 'insert_at', () => {
            this.logPolygonCoordinates();
        });
        google.maps.event.addListener(path, 'remove_at', () => {
            this.logPolygonCoordinates();
        });
    }

    private logPolygonCoordinates(): void {
        if (!this.currentPolygon) return;
        const path = this.currentPolygon.getPath();
        const coordinates = [];
        for (let i = 0; i < path.getLength(); i++) {
            const xy = path.getAt(i);
            coordinates.push({ lat: xy.lat(), lng: xy.lng() });
        }
        console.log('Perimeter coordinates:', coordinates);
    }

    clearPerimeter(): void {
        if (this.currentPolygon) {
            this.currentPolygon.setMap(null);
            this.currentPolygon = null;
        }
        if (this.drawingManager) {
            this.drawingManager.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
        }
    }

    /**
     * Dibuja un perímetro existente en el mapa para edición
     */
    setPerimeter(coordinates: Array<{ lat: number; lng: number }>): void {
        if (!coordinates || coordinates.length < 3) {
            console.warn('Se necesitan al menos 3 coordenadas para dibujar un perímetro');
            return;
        }

        // Limpiar polígono existente
        if (this.currentPolygon) {
            this.currentPolygon.setMap(null);
        }

        // Crear nuevo polígono con las coordenadas proporcionadas
        this.currentPolygon = new google.maps.Polygon({
            paths: coordinates,
            fillColor: '#1a73e8',
            fillOpacity: 0.3,
            strokeWeight: 2,
            strokeColor: '#1a73e8',
            clickable: true,
            editable: true,
            draggable: true,
            zIndex: 1
        });

        this.currentPolygon.setMap(this.map);

        // Desactivar modo dibujo
        if (this.drawingManager) {
            this.drawingManager.setDrawingMode(null);
        }

        // Agregar listeners para detectar cambios
        this.addPolygonListeners(this.currentPolygon);

        // Centrar mapa en el polígono
        const bounds = new google.maps.LatLngBounds();
        coordinates.forEach(coord => {
            bounds.extend(new google.maps.LatLng(coord.lat, coord.lng));
        });
        this.map.fitBounds(bounds);
    }

    @Input() targets: any[] = [];
    private markers: any[] = [];

    ngOnChanges(changes: any): void {
        if (changes.targets && this.map) {
            this.updateMarkers();
        }
    }

    private async updateMarkers(): Promise<void> {
        // Limpiar marcadores existentes
        this.markers.forEach(marker => marker.setMap(null));
        this.markers = [];

        if (!this.targets || this.targets.length === 0) return;

        const bounds = new google.maps.LatLngBounds();
        let hasValidTargets = false;

        const markerType = MapUtils.getMapMarkerType();

        for (const target of this.targets) {
            const geo = target?.traccarInfo?.geolocation || target?.traccarInfo?.lastLocation;
            const historical = target?.historicalLocation;
            
            const rawLat = geo?.latitude ?? historical?.latitude ?? target?.latitude;
            const rawLng = geo?.longitude ?? historical?.longitude ?? target?.longitude;

            if (rawLat !== undefined && rawLat !== null && rawLng !== undefined && rawLng !== null) {
                const lat = typeof rawLat === 'string' ? parseFloat(rawLat) : rawLat;
                const lng = typeof rawLng === 'string' ? parseFloat(rawLng) : rawLng;

                if (!isNaN(lat) && !isNaN(lng)) {
                    hasValidTargets = true;
                    const position = new google.maps.LatLng(lat, lng);
                    const course = geo?.course ?? 0;
                    const isOffline = (target?.traccarStatus || '').toLowerCase() !== 'online';

                    let iconConfig: any;

                    if (this.provider === 'google') {
                        if (markerType === 'vehicle') {
                            const spriteIconUrl = await MapUtils.getCarSpriteIconUrl(course, 48);
                            iconConfig = {
                                url: spriteIconUrl,
                                scaledSize: new google.maps.Size(48, 68),
                                anchor: new google.maps.Point(24, 50)
                            };
                        } else {
                            let fallbackIcon = '';
                            if (typeof window !== 'undefined') {
                                fallbackIcon = isOffline ? `${window.location.origin}/logo/favicon-gray.png` : `${window.location.origin}/logo/favicon.png`;
                            }
                            iconConfig = {
                                url: fallbackIcon,
                                scaledSize: new google.maps.Size(32, 32),
                                anchor: new google.maps.Point(16, 16)
                            };
                        }
                    }

                    const marker = new google.maps.Marker({
                        position: position,
                        map: this.map,
                        title: target.name,
                        icon: iconConfig,
                        opacity: isOffline ? 0.65 : 1
                    });
                    
                    const statusText = target.traccarStatus || 'desconocido';
                    const isOnline = statusText.toLowerCase() === 'online';
                    const infoWindow = new google.maps.InfoWindow({
                        content: `
                          <div style="font-size: 11px; line-height: 1.2; color: #111; min-width: 160px; padding: 6px 8px;">
                            <div style="font-weight: 700; font-size: 11px; margin-bottom: 3px; color: ${isOnline ? '#16a34a' : '#111'};">${target.name || 'Target'}</div>
                            <div style="margin-bottom: 2px;">Velocidad: 0 km/h</div>
                            <div>Estado: ${statusText}</div>
                          </div>
                        `
                    });

                    marker.addListener('click', () => {
                        infoWindow.open(this.map, marker);
                    });

                    this.markers.push(marker);
                    bounds.extend(position);
                }
            }
        }

        if (hasValidTargets) {
            this.map.fitBounds(bounds);
            // Si solo hay un punto o están muy cerca, evitar zoom excesivo
            const listener = google.maps.event.addListener(this.map, "idle", () => {
                if (this.map.getZoom() > 16) this.map.setZoom(16);
                google.maps.event.removeListener(listener);
            });
        }
    }

    getPolygonCoordinates(): Array<{ lat: number; lng: number }> | null {
        if (!this.currentPolygon) {
            return null;
        }

        const path = this.currentPolygon.getPath();
        const coordinates: Array<{ lat: number; lng: number }> = [];

        for (let i = 0; i < path.getLength(); i++) {
            const point = path.getAt(i);
            coordinates.push({
                lat: point.lat(),
                lng: point.lng()
            });
        }

        return coordinates.length >= 3 ? coordinates : null;
    }
}
