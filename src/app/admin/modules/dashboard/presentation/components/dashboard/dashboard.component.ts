import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChild, OnInit } from '@angular/core';
import { AuthService } from '../../../../../../core/services/auth.service';
import { SystemService } from '../../../../../../core/services/system.service';
import { MonitoringService } from '../../../../../../core/services/monitoring.service';
import { MapUtils } from '../../../../../../shareds/helpers/map.helper';
import { MarkerClusterer } from '@googlemaps/markerclusterer';


declare const google: any;

@Component({
    selector: 'app-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrl: './dashboard.component.css',
    standalone: false
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('mapElement') mapElement!: ElementRef;
    
    map: any;
    markers: any[] = [];
    markerCluster: any = null;
    currentUser: any = null;
    isEmployee: boolean = false;

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
        console.log('[Dashboard] Dentro de initializeMap() - Buscando configuración...');
        try {
            // Obtener configuración del sistema para la API de Maps
            const systems = await this.systemService.getAll().toPromise();
            console.log('[Dashboard] Configuración del sistema obtenida.');
            const systemConfigs = systems && systems.length > 0 ? systems[0] : null;
            const MAP_API1_KEY = systemConfigs?.map_api1?.key;

            if (MAP_API1_KEY) {
                // Inyectar el script de Google API dinámicamente
                await MapUtils.loadMapScript('google', MAP_API1_KEY, systemConfigs?.map_api1?.url || 'https://maps.googleapis.com/maps/api/js');
            }

            if (typeof google === 'undefined' || !google.maps) {
                console.warn('[Dashboard] Google Maps object not found. Map bounds will be blank.');
                return;
            }

            const mapOptions = {
                center: { lat: 18.4861, lng: -69.9312 }, // República Dominicana
                zoom: 8,
                mapTypeId: google.maps.MapTypeId.ROADMAP,
                disableDefaultUI: false, // Permitir controles
                fullscreenControl: false,
                streetViewControl: false,
                mapTypeControl: false,
                zoomControl: true
            };

            this.map = new google.maps.Map(this.mapElement.nativeElement, mapOptions);

            // Condicionar según tipo de usuario
            if (this.isEmployee) {
                // Cargar el fullmap ligero explícitamente para el Empleado
                console.log(`[Dashboard] Identificado como Empleado. Solicitando Fullmap ligero específico: 68a9ccf19bb280482272477f`);
                this.monitoringService.getLatestFullmap('68a9ccf19bb280482272477f').subscribe({
                    next: (res) => {
                        console.log('[Dashboard] 🗺️ Colección Fullmap cargada (Empleado):', res.data);
                        this.plotFullmapMarkers(res.data);
                    },
                    error: (err) => console.error('[Dashboard] Error cargando Fullmap del empleado', err)
                });
            } else {
                // Si es Cliente, consumir la nueva colección ultraligera (Fullmaps)
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
            console.error('Failed retrieving API key or constructing map element:', error);
        }
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
        if (!this.map || typeof google === 'undefined') return;

        if (this.markerCluster) {
            this.markerCluster.clearMarkers();
        }

        let bounds = new google.maps.LatLngBounds();
        let addedMarkers = 0;
        const currentMarkers: any[] = [];

        dataPackages.forEach(dataPackage => {
            if (dataPackage.devices && Array.isArray(dataPackage.devices)) {
                dataPackage.devices.forEach(device => {
                    const geo = device?.traccarInfo?.geolocation;
                    
                    if (geo && geo.latitude && geo.longitude) {
                        const position = { lat: geo.latitude, lng: geo.longitude };
                        
                        const nameStr = device.name || device.device_imei || 'Dispositivo';
                        const marker = new google.maps.Marker({
                            position,
                            map: this.map,
                            title: nameStr,
                            label: {
                                text: nameStr,
                                className: 'custom-map-label'
                            },
                            icon: {
                                url: 'logo/favicon.png',
                                scaledSize: new google.maps.Size(32, 32)
                            }
                        });

                        bounds.extend(position);
                        currentMarkers.push(marker);
                        addedMarkers++;
                    }
                });
            }
        });

        if (addedMarkers > 0) {
            this.markerCluster = new MarkerClusterer({ map: this.map, markers: currentMarkers });
            this.map.fitBounds(bounds);
        }
    }

    private plotFullmapMarkers(devices: Array<{nombre: string, latitud: number, longitud: number}>) {
        if (!this.map || typeof google === 'undefined' || !devices) return;

        if (this.markerCluster) {
            this.markerCluster.clearMarkers();
        }

        let bounds = new google.maps.LatLngBounds();
        let addedMarkers = 0;
        const currentMarkers: any[] = [];

        devices.forEach(device => {
            if (device.latitud && device.longitud) {
                const position = { lat: device.latitud, lng: device.longitud };
                
                const nameStr = device.nombre || 'Dispositivo';
                const marker = new google.maps.Marker({
                    position,
                    map: this.map,
                    title: nameStr,
                    label: {
                        text: nameStr,
                        className: 'custom-map-label'
                    },
                    icon: {
                        url: 'logo/favicon.png',
                        scaledSize: new google.maps.Size(32, 32)
                    }
                });

                bounds.extend(position);
                currentMarkers.push(marker);
                addedMarkers++;
            }
        });

        if (addedMarkers > 0) {
            this.markerCluster = new MarkerClusterer({ map: this.map, markers: currentMarkers });
            this.map.fitBounds(bounds);
        }
    }
}
