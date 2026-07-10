import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChild, OnInit } from '@angular/core';
import { AuthService } from '../../../../../../core/services/auth.service';
import { SystemService } from '../../../../../../core/services/system.service';
import { MonitoringService } from '../../../../../../core/services/monitoring.service';
import * as maplibregl from 'maplibre-gl';

@Component({
    selector: 'app-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrl: './dashboard.component.css',
    standalone: false
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('mapElement') mapElement!: ElementRef;
    map: maplibregl.Map | any;
    currentUser: any = null;
    isEmployee: boolean = false;
    private mapLoaded = false;
    private pendingData: any[] | null = null;
    private pendingDataType: 'fullmap' | 'reports' | null = null;
    private currentFeatures: any[] = [];
    private readonly dominicanRepublicBounds: [[number, number], [number, number]] = [
        [-72.1, 17.45],
        [-68.2, 20.1],
    ];
    private readonly dominicanRepublicMarkerThreshold = 200;

    // ── Map Filtering State ──
    filterOnline = true;
    filterOffline = true;
    filterLocalizado = true;
    filterExpired = true;

    private readonly americasBounds = {
        minLat: -60,
        maxLat: 85,
        minLng: -170,
        maxLng: -30,
    };

    constructor(
        private authService: AuthService,
        private systemService: SystemService,
        private monitoringService: MonitoringService
    ) {}

    ngOnInit() {
        this.currentUser = this.authService.getCurrentUser();
        this.isEmployee = this.currentUser?.affiliation_type_id === 'empleado' || this.currentUser?.root === true;
    }

    ngAfterViewInit() {
        console.log('[Dashboard] DOM montado. Llamando initializeMap()...');
        // Garantizamos que el contenedor CSS esté completamente asimilado por el navegador
        setTimeout(() => {
            this.initializeMap();
        }, 300);
    }

    ngOnDestroy() {
        // Limpieza si es necesaria
    }

    private async initializeMap() {
        console.log('[Dashboard] Dentro de initializeMap() - Generando base MapLibre...');
        
        try {
            this.map = new maplibregl.Map({
                container: this.mapElement.nativeElement,
                style: {
                    version: 8,
                    sources: {
                        'osm': {
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
                },
                center: [-69.9312, 18.4861], // [lng, lat]
                zoom: 8,
                attributionControl: false
            });

            this.map.addControl(new maplibregl.NavigationControl(), 'top-right');
            this.map.addControl(new maplibregl.FullscreenControl(), 'top-right');

            this.map.on('load', () => {
                this.mapLoaded = true;
                this.setupMaplibreClusters();
                
                if (this.pendingData && this.pendingDataType === 'fullmap') {
                    this.plotFullmapMarkers(this.pendingData);
                    this.pendingData = null;
                    this.pendingDataType = null;
                } else if (this.pendingData && this.pendingDataType === 'reports') {
                    this.plotDeviceMarkers(this.pendingData);
                    this.pendingData = null;
                    this.pendingDataType = null;
                }
            });

            // Condicionar según tipo de usuario
            if (this.isEmployee) {
                console.log(`[Dashboard] Identificado como Empleado. Solicitando Fullmap ligero específico: 68a9ccf19bb280482272477f`);
                this.monitoringService.getLatestFullmap('68a9ccf19bb280482272477f').subscribe({
                    next: (res) => {
                        console.log('[Dashboard] 🗺️ Colección Fullmap cargada (Empleado):', res.data);
                        this.plotFullmapMarkers(res.data);
                    },
                    error: (err) => console.error('[Dashboard] Error cargando Fullmap del empleado', err)
                });
            } else {
                console.log(`[Dashboard] Identificado como Cliente. Solicitando Fullmap ligero para: ${this.currentUser.id}`);
                this.monitoringService.getLatestFullmap(this.currentUser.id).subscribe({
                    next: (res) => {
                        console.log('[Dashboard] 🗺️ Colección Fullmap cargada directamente desde el Backend:', res.data);
                        this.plotFullmapMarkers(res.data);
                    },
                    error: (err) => console.error('[Dashboard] Error cargando Fullmap del cliente', err)
                });
            }
        } catch(error) {
            console.error('Failed constructing map element:', error);
        }
    }

    private createPulsingDot(r: number, g: number, b: number): any {
        const size = 150;
        const mapInstance = this.map;
        
        return {
            width: size,
            height: size,
            data: new Uint8Array(size * size * 4),

            onAdd: function() {
                const canvas = document.createElement('canvas');
                canvas.width = this.width;
                canvas.height = this.height;
                this.context = canvas.getContext('2d', { willReadFrequently: true });
            },

            render: function() {
                const duration = 3000;
                const t1 = (performance.now() % duration) / duration;
                const t2 = ((performance.now() + duration / 2) % duration) / duration;

                const radius = (size / 2) * 0.1;
                const context = this.context;

                context.clearRect(0, 0, this.width, this.height);

                context.beginPath();
                const outerRadius1 = (size / 2) * 0.8 * t1 + radius;
                const opacity1 = Math.max(0, 1 - t1);
                context.arc(this.width / 2, this.height / 2, outerRadius1, 0, Math.PI * 2);
                context.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity1})`;
                context.fill();

                context.beginPath();
                const outerRadius2 = (size / 2) * 0.8 * t2 + radius;
                const opacity2 = Math.max(0, 1 - t2);
                context.arc(this.width / 2, this.height / 2, outerRadius2, 0, Math.PI * 2);
                context.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity2})`;
                context.fill();

                this.data = context.getImageData(0, 0, this.width, this.height).data;
                mapInstance.triggerRepaint();

                return true;
            }
        };
    }

    private setupMaplibreClusters() {
        this.map.addSource('devices', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
            cluster: false
        });

        if (!this.map.hasImage('pulsing-dot-online')) {
            this.map.addImage('pulsing-dot-online', this.createPulsingDot(34, 197, 94), { pixelRatio: 2 });     // Verde
            this.map.addImage('pulsing-dot-localizado', this.createPulsingDot(6, 182, 212), { pixelRatio: 2 }); // Verde azulado (Cyan)
            this.map.addImage('pulsing-dot-offline', this.createPulsingDot(156, 163, 175), { pixelRatio: 2 });  // Gris
            this.map.addImage('pulsing-dot-expired', this.createPulsingDot(239, 68, 68), { pixelRatio: 2 });    // Rojo
        }

        // Add the radar layer below the primary markers
        this.map.addLayer({
            id: 'pulsing-layer',
            type: 'symbol',
            source: 'devices',
            layout: {
                'icon-image': [
                    'case',
                    ['==', ['get', 'isExpired'], true], 'pulsing-dot-expired',
                    ['==', ['get', 'status'], 'Localizado'], 'pulsing-dot-localizado',
                    ['==', ['get', 'status'], 'online'], 'pulsing-dot-online',
                    'pulsing-dot-offline'
                ],
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
                'icon-size': 1
            }
        });

        // Configurar capa genérica temporal para marcadores estáticos (por si falla la carga)
        this.map.addLayer({
            id: 'unclustered-point',
            type: 'circle',
            source: 'devices',
            paint: {
                'circle-color': '#11b4da',
                'circle-radius': 6,
                'circle-stroke-width': 1,
                'circle-stroke-color': '#fff'
            }
        });
        
        // Cargar imágenes de favicon de forma asincrónica e inyectarlas
        Promise.all([
            this.map.loadImage('logo/favicon.png'),
            this.map.loadImage('logo/favicon-gray.png')
        ]).then(([normalResponse, grayResponse]: [any, any]) => {
            const normalImage = normalResponse.data || normalResponse;
            const grayImage = grayResponse.data || grayResponse;

            if (!this.map.hasImage('custom-marker')) {
                this.map.addImage('custom-marker', normalImage);
            }

            if (!this.map.hasImage('custom-marker-offline')) {
                this.map.addImage('custom-marker-offline', grayImage);
            }

            if (this.map.getLayer('unclustered-point')) {
               this.map.removeLayer('unclustered-point');
            }
            this.map.addLayer({
                id: 'unclustered-point',
                type: 'symbol',
                source: 'devices',
                layout: {
                    'icon-image': [
                        'case',
                        ['==', ['get', 'status'], 'online'], 'custom-marker',
                        ['==', ['get', 'status'], 'Localizado'], 'custom-marker',
                        'custom-marker-offline'
                    ],
                    'icon-size': 0.15,
                    'icon-allow-overlap': true,
                    'icon-ignore-placement': true
                },
                paint: {
                    'icon-opacity': [
                        'case',
                        ['==', ['get', 'status'], 'online'], 1,
                        ['==', ['get', 'status'], 'Localizado'], 1,
                        0.6 // Translucidez para offline
                    ]
                }
            });
        }).catch((err: any) => console.log('Sin imagen de fallback'));
    }

    private loadUserDevicesOnMap(userId: string) {
        console.log(`[Dashboard] Solicitando historial de monitoreo para: ${userId}`);
        this.monitoringService.getUserMonitoringReports(userId).subscribe({
            next: (reports) => {
                if (reports && reports.length > 0) {
                    console.log(`[Dashboard] Reporte capturado. Total en record: ${reports.length}`);
                    const latestReport = reports[0];
                    if (latestReport && latestReport.data) {
                        const allDevices = latestReport.data.flatMap((pkg: any) => pkg.devices || []);
                        const allLocations = allDevices
                            .filter((d: any) => d.traccarInfo?.lastLocation && Object.keys(d.traccarInfo.lastLocation).length > 0)
                            .map((d: any) => ({
                                nombre: d.name || 'Desconocido',
                                latitud: d.traccarInfo.lastLocation.latitude,
                                longitud: d.traccarInfo.lastLocation.longitude
                            }));
                        console.log('[Dashboard] Listado EXCLUSIVO de Coordenadas (Lat/Lng/Name):', allLocations);
                        this.plotDeviceMarkers(latestReport.data);
                    }
                } else {
                    console.warn(`[Dashboard] ¡Sin reportes! Solicitando al servidor un escaneo en tiempo real para: ${userId}`);
                    this.monitoringService.monitorUser(userId).subscribe({
                        next: (freshReport) => {
                            if (freshReport && freshReport.data) {
                                const allDevices = freshReport.data.flatMap((pkg: any) => pkg.devices || []);
                                const allLocations = allDevices
                                    .filter((d: any) => d.traccarInfo?.lastLocation && Object.keys(d.traccarInfo.lastLocation).length > 0)
                                    .map((d: any) => ({
                                        nombre: d.name || 'Desconocido',
                                        latitud: d.traccarInfo.lastLocation.latitude,
                                        longitud: d.traccarInfo.lastLocation.longitude
                                    }));
                                console.log(`[Dashboard] Listado EXCLUSIVO de Coordenadas (Lat/Lng/Name) (En Vivo):`, allLocations);
                                this.plotDeviceMarkers(freshReport.data);
                            }
                        },
                        error: (err) => console.error('[Dashboard] Error generando reporte en vivo:', err)
                    });
                }
            },
            error: (err) => console.error('[Dashboard] Error de conexión obteniendo reportes:', err)
        });
    }

    private plotDeviceMarkers(dataPackages: Array<{ route: any[], devices: any[] }>) {
        if (!this.mapLoaded) {
            this.pendingData = dataPackages;
            this.pendingDataType = 'reports';
            return;
        }

        const features: any[] = [];
        dataPackages.forEach(dataPackage => {
            if (dataPackage.devices && Array.isArray(dataPackage.devices)) {
                dataPackage.devices.forEach(d => {
                    const geo = d?.traccarInfo?.geolocation;
                    if (this.isCoordinateInAmericas(geo?.latitude, geo?.longitude)) {
                        features.push({
                            type: 'Feature',
                            geometry: { type: 'Point', coordinates: [geo.longitude, geo.latitude] },
                            properties: {
                                name: d.name || d.device_imei || 'Dispositivo',
                                status: d.traccarInfo?.status || 'offline',
                                isExpired: d.expiration_date ? new Date(d.expiration_date).setHours(0,0,0,0) < new Date().setHours(0,0,0,0) : false
                            }
                        });
                    }
                });
            }
        });

        this.updateGeoJSONSource(features);
    }

    private plotFullmapMarkers(devices: Array<{nombre: string, latitud: number, longitud: number, status?: string, isExpired?: boolean}>) {
        if (!this.mapLoaded) {
            this.pendingData = devices;
            this.pendingDataType = 'fullmap';
            return;
        }

        const features = (devices || [])
            .filter(d => this.isCoordinateInAmericas(d?.latitud, d?.longitud))
            .map(d => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [d.longitud, d.latitud]
            },
            properties: {
                name: d.nombre || 'Dispositivo',
                status: d.status || 'offline',
                isExpired: d.isExpired || false
            }
        }));

        this.updateGeoJSONSource(features);
    }

    private isCoordinateInAmericas(latValue: any, lngValue: any): boolean {
        const lat = Number(latValue);
        const lng = Number(lngValue);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;

        return lat >= this.americasBounds.minLat
            && lat <= this.americasBounds.maxLat
            && lng >= this.americasBounds.minLng
            && lng <= this.americasBounds.maxLng;
    }

    private updateGeoJSONSource(features: any[]) {
        const source: any = this.map.getSource('devices');
        if (source) {
            this.currentFeatures = features;
            this.adjustMapViewport(features);

            // Animación de aparición consecutiva y aleatoria
            const shuffledFeatures = features.slice().sort(() => Math.random() - 0.5);
            let currentIndex = 0;
            const batchSize = Math.max(1, Math.floor(features.length / 60)); // Aproximadamente 1 segundo en llenar el mapa

            const animatePoints = () => {
                if (currentIndex < shuffledFeatures.length) {
                    currentIndex += batchSize;
                    const chunk = shuffledFeatures.slice(0, currentIndex);
                    
                    source.setData({
                        type: 'FeatureCollection',
                        features: chunk
                    });

                    // Delegar al pintado del navegador
                    requestAnimationFrame(animatePoints);
                } else {
                    // Fianza para evitar desincronía
                    source.setData({
                        type: 'FeatureCollection',
                        features: features 
                    });
                }
            };

            // Iniciar animación
            requestAnimationFrame(animatePoints);
        }
        this.applyMapFilters();
    }

    toggleFilter(type: 'online' | 'offline' | 'localizado' | 'expired') {
        if (type === 'online') this.filterOnline = !this.filterOnline;
        if (type === 'offline') this.filterOffline = !this.filterOffline;
        if (type === 'localizado') this.filterLocalizado = !this.filterLocalizado;
        if (type === 'expired') this.filterExpired = !this.filterExpired;

        this.applyMapFilters();
    }

    private applyMapFilters() {
        if (!this.map || !this.map.getLayer('pulsing-layer')) return;

        const filter: any[] = ['any'];

        if (this.filterExpired) {
            filter.push(['==', ['get', 'isExpired'], true]);
        }
        
        if (this.filterLocalizado) {
            filter.push(['all', ['==', ['get', 'isExpired'], false], ['==', ['get', 'status'], 'Localizado']]);
        }
        
        if (this.filterOnline) {
            filter.push(['all', ['==', ['get', 'isExpired'], false], ['==', ['get', 'status'], 'online']]);
        }
        
        if (this.filterOffline) {
            filter.push(['all', ['==', ['get', 'isExpired'], false], ['!=', ['get', 'status'], 'online'], ['!=', ['get', 'status'], 'Localizado']]);
        }

        const finalFilter = filter.length > 1 ? filter : ['==', 1, 0];

        this.map.setFilter('pulsing-layer', finalFilter);
        if (this.map.getLayer('unclustered-point')) {
            this.map.setFilter('unclustered-point', finalFilter);
        }

        this.adjustMapViewport(this.visibleFeatures(this.currentFeatures));
    }

    private adjustMapViewport(features: any[]) {
        if (!this.map || !features.length) return;

        if (features.length > this.dominicanRepublicMarkerThreshold) {
            this.map.fitBounds(this.dominicanRepublicBounds, {
                padding: 30,
                maxZoom: 8,
                duration: 0,
            });
            return;
        }

        const bounds = new maplibregl.LngLatBounds();
        let hasValidCoordinate = false;

        features.forEach(f => {
            if (Array.isArray(f.geometry?.coordinates)) {
                bounds.extend([f.geometry.coordinates[0], f.geometry.coordinates[1]] as [number, number]);
                hasValidCoordinate = true;
            }
        });

        if (hasValidCoordinate) {
            this.map.fitBounds(bounds, { padding: 50, maxZoom: 14 });
        }
    }

    private visibleFeatures(features: any[]): any[] {
        return features.filter(feature => {
            const status = feature.properties?.status;
            const isExpired = Boolean(feature.properties?.isExpired);

            if (isExpired) {
                return this.filterExpired;
            }

            if (status === 'Localizado') {
                return this.filterLocalizado;
            }

            if (status === 'online') {
                return this.filterOnline;
            }

            return this.filterOffline;
        });
    }
}
