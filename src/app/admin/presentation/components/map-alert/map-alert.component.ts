import { Component, OnInit, OnDestroy, Input, ElementRef, ViewChild, AfterViewInit, OnChanges } from '@angular/core';
import { MapUtils } from '../../../../shareds/helpers/map.helper';
import { SystemService } from '../../../../core/services/system.service';

@Component({
    selector: 'app-map-alert',
    templateUrl: './map-alert.component.html',
    styleUrls: ['./map-alert.component.css'],
    standalone: false
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

    @Input() targets: any[] = [];
    private markers: any[] = [];

    ngOnChanges(changes: any): void {
        if (changes.targets && this.map) {
            this.updateMarkers();
        }
    }

    private updateMarkers(): void {
        // Limpiar marcadores existentes
        this.markers.forEach(marker => marker.setMap(null));
        this.markers = [];

        if (!this.targets || this.targets.length === 0) return;

        const bounds = new google.maps.LatLngBounds();
        let hasValidTargets = false;

        this.targets.forEach(target => {
            const lat = target.traccarInfo?.geolocation?.latitude || target.traccarInfo?.latitude;
            const lng = target.traccarInfo?.geolocation?.longitude || target.traccarInfo?.longitude;

            if (lat && lng) {
                hasValidTargets = true;
                const position = new google.maps.LatLng(lat, lng);

                const marker = new google.maps.Marker({
                    position: position,
                    map: this.map,
                    title: target.name,
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 7,
                        fillColor: '#4285F4',
                        fillOpacity: 1,
                        strokeWeight: 2,
                        strokeColor: '#FFFFFF',
                    }
                });

                const infoWindow = new google.maps.InfoWindow({
                    content: `<div style="padding: 5px; color: black;"><strong>${target.name}</strong></div>`
                });

                marker.addListener('click', () => {
                    infoWindow.open(this.map, marker);
                });

                this.markers.push(marker);
                bounds.extend(position);
            }
        });

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
