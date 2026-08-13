import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChild, OnInit } from '@angular/core';
import { AuthService } from '../../../../../../core/services/auth.service';
import { SystemService } from '../../../../../../core/services/system.service';
import { MonitoringService } from '../../../../../../core/services/monitoring.service';
import { User } from '../../../../../../core/interfaces/user.interface';
import { LocatedUser, UserLatestLocation, UserService } from '../../../../../../core/services/user.service';
import { firstValueFrom } from 'rxjs';
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
    isRoot: boolean = false;
    canSeeTechnicians: boolean = false;
    private mapLoaded = false;
    private pendingData: any[] | null = null;
    private pendingDataType: 'fullmap' | 'reports' | null = null;
    private currentFeatures: any[] = [];
    private technicianFeatures: any[] = [];
    private locatedUserFeatures: any[] = [];
    private techniciansRequested = false;
    private locatedUsersRequested = false;
    private fullmapUserId: string | null = null;
    private readonly dashboardMapCacheMaxAgeMs = 24 * 60 * 60 * 1000;
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
    filterTechnicians = false;
    filterClients = false;

    private readonly americasBounds = {
        minLat: -60,
        maxLat: 85,
        minLng: -170,
        maxLng: -30,
    };

    constructor(
        private authService: AuthService,
        private systemService: SystemService,
        private monitoringService: MonitoringService,
        private userService: UserService
    ) {}

    ngOnInit() {
        this.currentUser = this.authService.getCurrentUser();
        this.isRoot = this.currentUser?.root === true;
        this.canSeeTechnicians = this.currentUser?.affiliation_type_id === 'empleado';
        this.isEmployee = this.canSeeTechnicians || this.isRoot;
        if (this.isEmployee) {
            this.userService.getMainAccount().subscribe({
                next: (response) => {
                    this.fullmapUserId = String(response?.account?._id || '').trim() || null;
                    this.restoreCachedFullmap();
                    this.requestLatestFullmap();
                },
                error: (error) => console.error('[Dashboard] No se pudo resolver la cuenta principal:', error),
            });
        } else {
            this.fullmapUserId = String(this.currentUser?.id || '').trim() || null;
            this.restoreCachedFullmap();
            this.requestLatestFullmap();
        }
    }

    ngAfterViewInit() {
        console.log('[Dashboard] DOM montado. Llamando initializeMap()...');
        this.initializeMap();
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
                                'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
                            ],
                            tileSize: 256,
                            attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>'
                        }
                    },
                    layers: [
                        {
                            id: 'osm-layer',
                            type: 'raster',
                            source: 'osm',
                            minzoom: 0,
                            maxzoom: 19
                        }
                    ]
                },
                center: [-69.9312, 18.4861], // [lng, lat]
                zoom: 8,
                attributionControl: {}
            });

            this.map.addControl(new maplibregl.NavigationControl(), 'top-right');
            this.map.addControl(new maplibregl.FullscreenControl(), 'top-right');

            let dashboardLayersInitialized = false;
            const initializeDashboardLayers = () => {
                if (dashboardLayersInitialized) return;
                dashboardLayersInitialized = true;
                this.mapLoaded = true;
                this.setupMaplibreClusters();
                this.setupLocatedUserLayers();
                this.setupTechnicianLayers();
                
                if (this.pendingData && this.pendingDataType === 'fullmap') {
                    this.plotFullmapMarkers(this.pendingData);
                    this.pendingData = null;
                    this.pendingDataType = null;
                } else if (this.pendingData && this.pendingDataType === 'reports') {
                    this.plotDeviceMarkers(this.pendingData);
                    this.pendingData = null;
                    this.pendingDataType = null;
                }
            };

            this.map.once('style.load', initializeDashboardLayers);
            this.map.once('load', initializeDashboardLayers);
        } catch(error) {
            console.error('Failed constructing map element:', error);
        }
    }

    private requestLatestFullmap(): void {
        if (!this.fullmapUserId) return;

        this.monitoringService.getLatestFullmap(this.fullmapUserId).subscribe({
            next: (response) => {
                const devices = Array.isArray(response?.data) ? response.data : [];
                if (!devices.length) return;

                this.plotFullmapMarkers(devices);
                this.persistFullmapCache(devices);
            },
            error: (error) => console.error('[Dashboard] Error actualizando marcadores:', error),
        });
    }

    private restoreCachedFullmap(): void {
        if (!this.fullmapUserId) return;

        try {
            const rawCache = localStorage.getItem(this.dashboardMapCacheKey());
            if (!rawCache) return;

            const cache = JSON.parse(rawCache);
            const cachedAt = Number(cache?.cachedAt || 0);
            if (
                !Array.isArray(cache?.data)
                || !cache.data.length
                || Date.now() - cachedAt > this.dashboardMapCacheMaxAgeMs
            ) {
                localStorage.removeItem(this.dashboardMapCacheKey());
                return;
            }

            this.plotFullmapMarkers(cache.data);
        } catch {
            localStorage.removeItem(this.dashboardMapCacheKey());
        }
    }

    private persistFullmapCache(devices: any[]): void {
        if (!this.fullmapUserId || !devices.length) return;

        try {
            localStorage.setItem(this.dashboardMapCacheKey(), JSON.stringify({
                cachedAt: Date.now(),
                data: devices,
            }));
        } catch (error) {
            console.warn('[Dashboard] No se pudo guardar el mapa localmente:', error);
        }
    }

    private dashboardMapCacheKey(): string {
        return `dashboard-fullmap:v2:${this.fullmapUserId}`;
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
                    ['==', ['get', 'statusGroup'], 'localizado'], 'pulsing-dot-localizado',
                    ['==', ['get', 'statusGroup'], 'online'], 'pulsing-dot-online',
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
                        ['==', ['get', 'statusGroup'], 'online'], 'custom-marker',
                        ['==', ['get', 'statusGroup'], 'localizado'], 'custom-marker',
                        'custom-marker-offline'
                    ],
                    'icon-size': 0.15,
                    'icon-allow-overlap': true,
                    'icon-ignore-placement': true
                },
                paint: {
                    'icon-opacity': [
                        'case',
                        ['==', ['get', 'statusGroup'], 'online'], 1,
                        ['==', ['get', 'statusGroup'], 'localizado'], 1,
                        0.6 // Translucidez para offline
                    ]
                }
            });
            this.applyMapFilters();
            this.bringPeopleLayersToFront();
        }).catch((err: any) => console.log('Sin imagen de fallback'));
    }

    private setupTechnicianLayers() {
        if (!this.canSeeTechnicians || this.map.getSource('technicians')) return;

        this.map.addSource('technicians', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });

        if (!this.map.hasImage('pulsing-dot-technician')) {
            this.map.addImage('pulsing-dot-technician', this.createPulsingDot(168, 85, 247), { pixelRatio: 2 });
        }

        this.map.addLayer({
            id: 'technician-pulse-layer',
            type: 'symbol',
            source: 'technicians',
            layout: {
                'icon-image': 'pulsing-dot-technician',
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
                'icon-size': 0.8
            }
        });

        this.map.addLayer({
            id: 'technician-point-layer',
            type: 'circle',
            source: 'technicians',
            paint: {
                'circle-color': '#a855f7',
                'circle-radius': 8,
                'circle-stroke-width': 3,
                'circle-stroke-color': '#ffffff'
            }
        });

        this.map.addLayer({
            id: 'technician-label-layer',
            type: 'symbol',
            source: 'technicians',
            layout: {
                'text-field': ['get', 'label'],
                'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
                'text-size': 12,
                'text-anchor': 'bottom',
                'text-offset': [0, -1.4],
                'text-allow-overlap': true,
                'text-ignore-placement': true
            },
            paint: {
                'text-color': '#ffffff',
                'text-halo-color': '#7e22ce',
                'text-halo-width': 2
            }
        });

        this.bringPeopleLayersToFront();
    }

    private setupLocatedUserLayers() {
        if (!this.isRoot || this.map.getSource('located-users')) return;

        this.map.addSource('located-users', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });

        if (!this.map.hasImage('pulsing-dot-located-user')) {
            this.map.addImage('pulsing-dot-located-user', this.createPulsingDot(234, 179, 8), { pixelRatio: 2 });
        }

        this.map.addLayer({
            id: 'located-user-pulse-layer',
            type: 'symbol',
            source: 'located-users',
            layout: {
                'icon-image': 'pulsing-dot-located-user',
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
                'icon-size': 0.7
            }
        });

        this.map.addLayer({
            id: 'located-user-point-layer',
            type: 'circle',
            source: 'located-users',
            paint: {
                'circle-color': '#eab308',
                'circle-radius': 7,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#fff7ed'
            }
        });

        this.map.addLayer({
            id: 'located-user-label-layer',
            type: 'symbol',
            source: 'located-users',
            layout: {
                'text-field': ['get', 'label'],
                'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
                'text-size': 11,
                'text-anchor': 'top',
                'text-offset': [0, 1.2],
                'text-allow-overlap': true,
                'text-ignore-placement': true
            },
            paint: {
                'text-color': '#111827',
                'text-halo-color': '#fef3c7',
                'text-halo-width': 2
            }
        });

        this.bringPeopleLayersToFront();
    }

    private bringPeopleLayersToFront(): void {
        if (!this.map) return;

        [
            'located-user-pulse-layer',
            'located-user-point-layer',
            'located-user-label-layer',
            'technician-pulse-layer',
            'technician-point-layer',
            'technician-label-layer',
        ].forEach(layerId => {
            try {
                if (this.map.getLayer(layerId)) {
                    this.map.moveLayer(layerId);
                }
            } catch (error) {
                console.warn(`[Dashboard] No se pudo mover la capa ${layerId} al frente`, error);
            }
        });
    }

    private async loadTechniciansOnDashboardMap(): Promise<void> {
        if (!this.canSeeTechnicians || !this.mapLoaded || this.techniciansRequested) return;
        this.setupTechnicianLayers();
        this.techniciansRequested = true;

        try {
            const technicians = await firstValueFrom(this.userService.getTechnicians());
            const results = await Promise.all(
                (technicians || []).map(async (technician: User) => {
                    const technicianId = String((technician as any)._id || (technician as any).id || '').trim();
                    if (!technicianId) return null;

                    try {
                        const location = await firstValueFrom(this.userService.getLatestLocation(technicianId));
                        if (!this.isCoordinateInAmericas(location?.latitude, location?.longitude)) return null;

                        return this.createTechnicianFeature(technician, location);
                    } catch {
                        return null;
                    }
                })
            );

            this.technicianFeatures = results.filter(Boolean) as any[];
            this.updateTechnicianSource();
            this.setPeopleLayersVisibility();
        } catch (error) {
            this.techniciansRequested = false;
            console.error('[Dashboard] Error cargando ubicaciones de técnicos:', error);
        }
    }

    private async loadLocatedUsersOnDashboardMap(): Promise<void> {
        if (!this.isRoot || !this.mapLoaded || this.locatedUsersRequested) return;
        this.setupLocatedUserLayers();
        this.locatedUsersRequested = true;

        try {
            const users = await firstValueFrom(this.userService.getLocatedUsers());
            this.locatedUserFeatures = (users || [])
                .filter(user => this.isCoordinateInAmericas(user?.latitude, user?.longitude))
                .map(user => this.createLocatedUserFeature(user));
            this.updateLocatedUserSource();
            this.setPeopleLayersVisibility();
        } catch (error) {
            this.locatedUsersRequested = false;
            console.error('[Dashboard] Error cargando ubicaciones de usuarios:', error);
        }
    }

    private createTechnicianFeature(technician: User, location: UserLatestLocation | null): any {
        const name = this.getTechnicianName(technician);

        return {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [Number(location?.longitude), Number(location?.latitude)]
            },
            properties: {
                name,
                label: `${name} · ${this.getRelativeLocationAge(location?.recordedAt)}`
            }
        };
    }

    private updateTechnicianSource(): void {
        const source: any = this.map?.getSource('technicians');
        if (!source) return;

        source.setData({
            type: 'FeatureCollection',
            features: this.technicianFeatures
        });
    }

    private createLocatedUserFeature(user: LocatedUser): any {
        const name = this.getLocatedUserName(user);

        return {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [Number(user.longitude), Number(user.latitude)]
            },
            properties: {
                name,
                label: `${name} · ${this.getRelativeLocationAge(user.recordedAt)}`
            }
        };
    }

    private updateLocatedUserSource(): void {
        const source: any = this.map?.getSource('located-users');
        if (!source) return;

        source.setData({
            type: 'FeatureCollection',
            features: this.locatedUserFeatures
        });
    }

    private getTechnicianName(technician: User): string {
        return `${technician?.name || ''} ${technician?.last_name || ''}`.replace(/\s+/g, ' ').trim()
            || technician?.email
            || 'Técnico';
    }

    private getLocatedUserName(user: LocatedUser): string {
        return `${user?.name || ''} ${user?.last_name || ''}`.replace(/\s+/g, ' ').trim()
            || user?.email
            || 'Usuario';
    }

    private getRelativeLocationAge(recordedAt?: string | Date): string {
        if (!recordedAt) return 'sin fecha';
        const date = new Date(recordedAt);
        if (Number.isNaN(date.getTime())) return 'sin fecha';

        const diffMs = Math.max(0, Date.now() - date.getTime());
        const diffMinutes = Math.floor(diffMs / 60000);
        if (diffMinutes < 1) return 'ahora';
        if (diffMinutes < 60) return `hace ${diffMinutes} min`;

        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) return `hace ${diffHours} h`;

        const diffDays = Math.floor(diffHours / 24);
        return `hace ${diffDays} d`;
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
                        const status = d.traccarInfo?.status || d.status || 'offline';
                        features.push({
                            type: 'Feature',
                            geometry: { type: 'Point', coordinates: [geo.longitude, geo.latitude] },
                            properties: {
                                name: d.name || d.device_imei || 'Dispositivo',
                                status,
                                statusGroup: this.getDeviceStatusGroup(status),
                                isExpired: this.isDeviceExpired(this.getDeviceExpirationDate(d), status, d.isExpired)
                            }
                        });
                    }
                });
            }
        });

        this.updateGeoJSONSource(features);
    }

    private plotFullmapMarkers(devices: Array<{nombre: string, latitud: number, longitud: number, status?: string, isExpired?: boolean, expiration_date?: string | Date, expirationDate?: string | Date, expiration?: string | Date, expires_at?: string | Date}>) {
        if (!this.mapLoaded) {
            this.pendingData = devices;
            this.pendingDataType = 'fullmap';
            return;
        }

        const features = (devices || [])
            .filter(d => this.isCoordinateInAmericas(d?.latitud, d?.longitud))
            .map(d => {
                const status = d.status || 'offline';
                return {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [d.longitud, d.latitud]
                    },
                    properties: {
                        name: d.nombre || 'Dispositivo',
                        status,
                        statusGroup: this.getDeviceStatusGroup(status),
                        isExpired: this.isDeviceExpired(this.getDeviceExpirationDate(d), status, d.isExpired)
                    }
                };
            });

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

            source.setData({
                type: 'FeatureCollection',
                features
            });
        }
        this.applyMapFilters();
    }

    toggleFilter(type: 'online' | 'offline' | 'localizado' | 'expired' | 'technicians' | 'clients') {
        if (type === 'online') this.filterOnline = !this.filterOnline;
        if (type === 'offline') this.filterOffline = !this.filterOffline;
        if (type === 'localizado') this.filterLocalizado = !this.filterLocalizado;
        if (type === 'expired') this.filterExpired = !this.filterExpired;
        if (type === 'technicians') this.filterTechnicians = !this.filterTechnicians;
        if (type === 'clients') this.filterClients = !this.filterClients;

        if (type === 'technicians' && this.filterTechnicians) {
            this.loadTechniciansOnDashboardMap();
        }

        if (type === 'clients' && this.filterClients) {
            this.loadLocatedUsersOnDashboardMap();
        }

        this.applyMapFilters();
    }

    private applyMapFilters() {
        if (!this.map || !this.map.getLayer('pulsing-layer')) return;

        const hasVisibleDeviceFilters = this.filterExpired || this.filterLocalizado || this.filterOnline || this.filterOffline;
        const filter: any[] = ['any'];

        if (this.filterExpired) {
            filter.push(['==', ['get', 'isExpired'], true]);
        }
        
        if (this.filterLocalizado) {
            filter.push(['all', ['==', ['get', 'isExpired'], false], ['==', ['get', 'statusGroup'], 'localizado']]);
        }
        
        if (this.filterOnline) {
            filter.push(['all', ['==', ['get', 'isExpired'], false], ['==', ['get', 'statusGroup'], 'online']]);
        }
        
        if (this.filterOffline) {
            filter.push(['all', ['==', ['get', 'isExpired'], false], ['==', ['get', 'statusGroup'], 'offline']]);
        }

        this.setDeviceLayersVisibility(hasVisibleDeviceFilters);
        if (!hasVisibleDeviceFilters) {
            this.setPeopleLayersVisibility();
            this.adjustMapViewport([
                ...(this.isRoot && this.filterClients ? this.locatedUserFeatures : []),
                ...(this.canSeeTechnicians && this.filterTechnicians ? this.technicianFeatures : []),
            ]);
            return;
        }

        const finalFilter = filter.length > 1 ? filter : ['==', ['get', '__hidden__'], true];

        this.map.setFilter('pulsing-layer', finalFilter);
        if (this.map.getLayer('unclustered-point')) {
            this.map.setFilter('unclustered-point', finalFilter);
        }

        this.setPeopleLayersVisibility();
        this.adjustMapViewport([
            ...this.visibleFeatures(this.currentFeatures),
            ...(this.isRoot && this.filterClients ? this.locatedUserFeatures : []),
            ...(this.canSeeTechnicians && this.filterTechnicians ? this.technicianFeatures : []),
        ]);
    }

    private setDeviceLayersVisibility(visible: boolean): void {
        this.setLayerVisibility([
            'pulsing-layer',
            'unclustered-point',
        ], visible);
    }

    private setPeopleLayersVisibility(): void {
        this.setLayerVisibility([
            'located-user-pulse-layer',
            'located-user-point-layer',
            'located-user-label-layer',
        ], this.isRoot && this.filterClients);

        this.setLayerVisibility([
            'technician-pulse-layer',
            'technician-point-layer',
            'technician-label-layer',
        ], this.canSeeTechnicians && this.filterTechnicians);
    }

    private setLayerVisibility(layerIds: string[], visible: boolean): void {
        layerIds.forEach(layerId => {
            if (this.map?.getLayer(layerId)) {
                this.map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
            }
        });
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
            const statusGroup = feature.properties?.statusGroup || this.getDeviceStatusGroup(feature.properties?.status);
            const isExpired = Boolean(feature.properties?.isExpired);

            if (isExpired) {
                return this.filterExpired;
            }

            if (statusGroup === 'localizado') {
                return this.filterLocalizado;
            }

            if (statusGroup === 'online') {
                return this.filterOnline;
            }

            return this.filterOffline;
        });
    }

    private getDeviceStatusGroup(status: any): 'online' | 'localizado' | 'offline' {
        const value = String(status || '').trim().toLowerCase();
        if (value === 'online' || value === 'en linea' || value === 'en línea' || value === 'senal debil' || value === 'señal debil' || value === 'señal débil') {
            return 'online';
        }
        if (value === 'localizado' || value === 'localized' || value === 'located') {
            return 'localizado';
        }
        return 'offline';
    }

    private isDeviceExpired(expirationDate?: any, status?: any, explicitExpired?: any): boolean {
        if (explicitExpired === true || explicitExpired === 1 || String(explicitExpired).trim().toLowerCase() === 'true') {
            return true;
        }

        const statusValue = String(status || '').trim().toLowerCase();
        if (['expirado', 'expired', 'vencido'].includes(statusValue)) {
            return true;
        }

        if (!expirationDate) return false;

        const date = new Date(expirationDate);
        if (Number.isNaN(date.getTime())) return false;

        return date.setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0);
    }

    private getDeviceExpirationDate(device: any): any {
        return device?.expiration_date
            || device?.expirationDate
            || device?.expiration
            || device?.expires_at
            || device?.expiresAt;
    }
}
