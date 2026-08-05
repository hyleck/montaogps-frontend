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
    drawingClickListener: any;
    vertexMarkers: any[] = [];
    manualCoordinates: Array<{ lat: number; lng: number }> = [];
    isManualDrawing = false;
    isRadiusPlacement = false;
    private lastVertexClick: { lat: number; lng: number; at: number } | null = null;

    map: any;

    constructor(
        private systemService: SystemService
    ) { }

    ngOnInit(): void { }

    ngAfterViewInit(): void {
        this.initializeMap();
    }

    ngOnDestroy(): void {
        this.disableManualDrawing();
        this.removeCurrentPolygon();
        this.clearTargetMarkers();
        if (this.drawingManager) {
            google.maps.event.clearInstanceListeners(this.drawingManager);
            this.drawingManager.setMap(null);
        }
        if (this.map) {
            google.maps.event.clearInstanceListeners(this.map);
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

        try {
            this.drawingManager = new google.maps.drawing.DrawingManager({
                drawingMode: null,
                drawingControl: false,
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
        } catch (error) {
            console.warn('Google Maps DrawingManager unavailable, using manual perimeter drawing', error);
            return;
        }

        this.drawingManager.setMap(this.map);

        google.maps.event.addListener(this.drawingManager, 'polygoncomplete', (polygon: any) => {
            // Si ya existe un polígono, eliminar el anterior (solo permitimos uno a la vez)
            if (this.currentPolygon) {
                this.currentPolygon.setMap(null);
            }

            this.currentPolygon = polygon;
            this.rebuildVertexMarkers();

            // Desactivar modo dibujo después de completar uno
            this.drawingManager.setDrawingMode(null);
            this.disableManualDrawing();

            // Escuchar cambios en el polígono
            this.addPolygonListeners(polygon);
        });
    }

    private addPolygonListeners(polygon: any): void {
        const path = polygon.getPath?.();
        if (!path) return;
        google.maps.event.addListener(path, 'set_at', () => {
            this.syncManualCoordinatesFromPolygon();
            this.logPolygonCoordinates();
            this.rebuildVertexMarkers();
        });
        google.maps.event.addListener(path, 'insert_at', () => {
            this.syncManualCoordinatesFromPolygon();
            this.logPolygonCoordinates();
            this.rebuildVertexMarkers();
        });
        google.maps.event.addListener(path, 'remove_at', () => {
            this.syncManualCoordinatesFromPolygon();
            this.logPolygonCoordinates();
            this.rebuildVertexMarkers();
        });
    }

    private logPolygonCoordinates(): void {
        if (!this.currentPolygon) return;
        const path = this.currentPolygon.getPath?.();
        if (!path) {
            console.log('Perimeter coordinates:', this.manualCoordinates);
            return;
        }

        const coordinates = [];
        for (let i = 0; i < path.getLength(); i++) {
            const xy = path.getAt(i);
            coordinates.push({ lat: xy.lat(), lng: xy.lng() });
        }
        console.log('Perimeter coordinates:', coordinates);
    }

    startDrawing(clearExisting: boolean = true): void {
        if (!this.map || this.provider !== 'google') return;

        if (clearExisting) {
            this.removeCurrentPolygon();
        }

        if (this.drawingManager) {
            this.drawingManager.setDrawingMode(null);
        }

        this.disableManualDrawing();
        this.isManualDrawing = true;
        this.map.setOptions?.({ draggableCursor: 'crosshair' });
        this.drawingClickListener = google.maps.event.addListener(this.map, 'click', (event: any) => {
            if (event?.latLng) {
                this.addManualVertex(event.latLng);
            }
        });
    }

    startRadiusPlacement(radiusMeters: number = 150): void {
        if (!this.map || this.provider !== 'google') return;

        const safeRadius = Math.min(10000, Math.max(50, Number(radiusMeters) || 150));
        this.removeCurrentPolygon();
        this.disableManualDrawing();
        this.isRadiusPlacement = true;
        this.map.setOptions?.({ draggableCursor: 'crosshair' });
        this.drawingClickListener = google.maps.event.addListener(this.map, 'click', (event: any) => {
            if (!event?.latLng) return;
            this.setCircularPerimeter(event.latLng.lat(), event.latLng.lng(), safeRadius);
            this.disableManualDrawing();
        });
    }

    setCircularPerimeter(lat: number, lng: number, radiusMeters: number = 150): void {
        if (!this.map || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

        const safeRadius = Math.min(10000, Math.max(50, Number(radiusMeters) || 150));
        const earthRadiusMeters = 6378137;
        const latitudeRadians = lat * Math.PI / 180;
        const coordinates = Array.from({ length: 48 }, (_, index) => {
            const bearing = (index / 48) * Math.PI * 2;
            const deltaLat = (safeRadius / earthRadiusMeters) * Math.sin(bearing);
            const deltaLng = (safeRadius / (earthRadiusMeters * Math.cos(latitudeRadians))) * Math.cos(bearing);
            return {
                lat: lat + deltaLat * 180 / Math.PI,
                lng: lng + deltaLng * 180 / Math.PI,
            };
        });
        this.setPerimeter(coordinates);
    }

    finishDrawing(): void {
        this.disableManualDrawing();
    }

    clearPerimeter(): void {
        this.removeCurrentPolygon();
        this.startDrawing(false);
    }

    private createEditablePolygon(paths: any[]): any {
        return new google.maps.Polygon({
            paths,
            fillColor: '#1a73e8',
            fillOpacity: 0.3,
            strokeWeight: 2,
            strokeColor: '#1a73e8',
            clickable: false,
            editable: true,
            draggable: false,
            zIndex: 1
        });
    }

    private addManualVertex(latLng: any): void {
        const lat = latLng.lat();
        const lng = latLng.lng();
        const now = Date.now();

        if (
            this.lastVertexClick &&
            now - this.lastVertexClick.at < 250 &&
            Math.abs(this.lastVertexClick.lat - lat) < 0.000001 &&
            Math.abs(this.lastVertexClick.lng - lng) < 0.000001
        ) {
            return;
        }

        this.lastVertexClick = { lat, lng, at: now };
        this.manualCoordinates.push({ lat, lng });

        if (!this.currentPolygon) {
            this.currentPolygon = this.createEditablePolygon(this.manualCoordinates);
            this.currentPolygon.setMap(this.map);
            this.addPolygonListeners(this.currentPolygon);
        } else {
            this.currentPolygon.setPath(this.manualCoordinates);
        }

        this.addVertexMarker(latLng);
        this.logPolygonCoordinates();
    }

    private disableManualDrawing(): void {
        if (this.drawingClickListener) {
            google.maps.event.removeListener(this.drawingClickListener);
            this.drawingClickListener = null;
        }
        this.isManualDrawing = false;
        this.isRadiusPlacement = false;
        this.map?.setOptions?.({ draggableCursor: null });
    }

    private removeCurrentPolygon(): void {
        if (this.currentPolygon) {
            const path = this.currentPolygon.getPath?.();
            if (path) {
                google.maps.event.clearInstanceListeners(path);
            }
            google.maps.event.clearInstanceListeners(this.currentPolygon);
            this.currentPolygon.setMap(null);
            this.currentPolygon = null;
        }
        this.manualCoordinates = [];
        this.clearVertexMarkers();
    }

    private addVertexMarker(position: any): void {
        const marker = new google.maps.Marker({
            position,
            map: this.map,
            clickable: false,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 5,
                fillColor: '#1a73e8',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2
            },
            zIndex: 2
        });

        this.vertexMarkers.push(marker);
    }

    private clearVertexMarkers(): void {
        this.vertexMarkers.forEach(marker => {
            google.maps.event.clearInstanceListeners(marker);
            marker.setMap(null);
        });
        this.vertexMarkers = [];
    }

    private rebuildVertexMarkers(): void {
        this.clearVertexMarkers();
        if (!this.currentPolygon) return;

        const path = this.currentPolygon.getPath?.();
        if (!path) {
            this.manualCoordinates.forEach(coord => {
                this.addVertexMarker(new google.maps.LatLng(coord.lat, coord.lng));
            });
            return;
        }

        for (let i = 0; i < path.getLength(); i++) {
            this.addVertexMarker(path.getAt(i));
        }
    }

    private syncManualCoordinatesFromPolygon(): void {
        const path = this.currentPolygon?.getPath?.();
        if (!path) return;

        const coordinates: Array<{ lat: number; lng: number }> = [];
        for (let i = 0; i < path.getLength(); i++) {
            const point = path.getAt(i);
            coordinates.push({ lat: point.lat(), lng: point.lng() });
        }
        this.manualCoordinates = coordinates;
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
        this.removeCurrentPolygon();
        this.manualCoordinates = coordinates.map(coord => ({ lat: coord.lat, lng: coord.lng }));

        // Crear nuevo polígono con las coordenadas proporcionadas
        this.currentPolygon = this.createEditablePolygon(this.manualCoordinates);

        this.currentPolygon.setMap(this.map);
        this.rebuildVertexMarkers();

        // Desactivar modo dibujo
        this.disableManualDrawing();
        if (this.drawingManager) this.drawingManager.setDrawingMode(null);

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
        this.clearTargetMarkers();

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
                    const statusText = String(target?.traccarInfo?.status ?? target?.traccarStatus ?? 'desconocido');
                    const isOnline = statusText.toLowerCase() === 'online';
                    const isOffline = !isOnline;

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
                    
                    const rawSpeed = Number(geo?.speed);
                    const speedText = Number.isFinite(rawSpeed)
                        ? `${(rawSpeed * 1.852).toFixed(1)} km/h`
                        : 'Sin datos';
                    const safeName = this.escapeHtml(target?.name || 'Dispositivo');
                    const safeStatus = this.escapeHtml(statusText);
                    const infoWindow = new google.maps.InfoWindow({
                        content: `
                          <div style="font-size: 11px; line-height: 1.2; color: #111; min-width: 160px; padding: 6px 8px;">
                            <div style="font-weight: 700; font-size: 11px; margin-bottom: 3px; color: ${isOnline ? '#16a34a' : '#111'};">${safeName}</div>
                            <div style="margin-bottom: 2px;">Velocidad: ${speedText}</div>
                            <div>Estado: ${safeStatus}</div>
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

    private clearTargetMarkers(): void {
        this.markers.forEach(marker => {
            google.maps.event.clearInstanceListeners(marker);
            marker.setMap(null);
        });
        this.markers = [];
    }

    private escapeHtml(value: unknown): string {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        })[character] ?? character);
    }

    getPolygonCoordinates(): Array<{ lat: number; lng: number }> | null {
        if (this.manualCoordinates.length >= 3) {
            return [...this.manualCoordinates];
        }

        if (!this.currentPolygon) {
            return null;
        }

        const path = this.currentPolygon.getPath?.();
        if (!path) return null;

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
