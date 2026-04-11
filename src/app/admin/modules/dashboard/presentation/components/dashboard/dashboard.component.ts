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

    private setupMaplibreClusters() {
        this.map.addSource('devices', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
            cluster: false
        });

        // Configurar capa genérica temporal para marcadores
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
        
        // Cargar imagen de favicon de forma asincrónica e inyectarla en los puntos no agrupados
        this.map.loadImage('logo/favicon.png').then((response: any) => {
            const image = response.data || response;
            if (!this.map.hasImage('custom-marker')) {
                this.map.addImage('custom-marker', image);
            }
            if (this.map.getLayer('unclustered-point')) {
               this.map.removeLayer('unclustered-point');
            }
            this.map.addLayer({
                id: 'unclustered-point',
                type: 'symbol',
                source: 'devices',
                layout: {
                    'icon-image': 'custom-marker',
                    'icon-size': 0.10,
                    'icon-allow-overlap': true,
                    'icon-ignore-placement': true
                },
                paint: {}
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
                    if (geo && geo.latitude && geo.longitude) {
                        features.push({
                            type: 'Feature',
                            geometry: { type: 'Point', coordinates: [geo.longitude, geo.latitude] },
                            properties: {
                                name: d.name || d.device_imei || 'Dispositivo'
                            }
                        });
                    }
                });
            }
        });

        this.updateGeoJSONSource(features);
    }

    private plotFullmapMarkers(devices: Array<{nombre: string, latitud: number, longitud: number}>) {
        if (!this.mapLoaded) {
            this.pendingData = devices;
            this.pendingDataType = 'fullmap';
            return;
        }

        const features = (devices || []).filter(d => d && d.latitud && d.longitud).map(d => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [d.longitud, d.latitud]
            },
            properties: {
                name: d.nombre || 'Dispositivo'
            }
        }));

        this.updateGeoJSONSource(features);
    }

    private updateGeoJSONSource(features: any[]) {
        const source: any = this.map.getSource('devices');
        if (source) {
            
            // Adjust bounds first before drawing
            if (features.length > 0) {
               const bounds = new maplibregl.LngLatBounds();
               features.forEach(f => {
                   if (Array.isArray(f.geometry.coordinates)) {
                       bounds.extend([f.geometry.coordinates[0], f.geometry.coordinates[1]] as [number, number]);
                   }
               });
               this.map.fitBounds(bounds, { padding: 50, maxZoom: 14 });
            }

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
    }
}
