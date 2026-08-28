import { formatDeviceLabel } from 'src/app/shareds/pipes/device-label.pipe';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { HttpBackend, HttpClient, HttpParams } from '@angular/common/http';
import * as maplibregl from 'maplibre-gl';
import type * as GeoJSON from 'geojson';
import { firstValueFrom } from 'rxjs';
import { MonitorUserResponse } from 'src/app/core/services/monitoring.service';
import { VehicleBrandsService } from 'src/app/core/services/vehicle-brands.service';

type MonitoringMapData = MonitorUserResponse['data'];
type DeviceStatusGroup = 'online' | 'localizado' | 'offline';

interface MonitoringMapStats {
  total: number;
  mapped: number;
  withoutLocation: number;
}

interface LocationOption {
  code: string;
  name: string;
}

export interface MonitoringLocationFilterChange {
  active: boolean;
  visibleDeviceKeys: string[];
  province: string;
  municipality: string;
  sector: string;
}

interface AdministrativeBoundary {
  feature: GeoJSON.Feature<
    GeoJSON.Polygon | GeoJSON.MultiPolygon,
    Record<string, any>
  >;
  provinceCode: string;
  municipalityCode: string;
  provinceName: string;
  municipalityName: string;
  bbox: [number, number, number, number];
}

interface SectorBoundary {
  feature: GeoJSON.Feature<
    GeoJSON.Polygon | GeoJSON.MultiPolygon,
    Record<string, any>
  >;
  provinceCode: string;
  municipalityCode: string;
  sectorCode: string;
  identifier: string;
  sectorName: string;
  bbox: [number, number, number, number];
}

@Component({
  selector: 'app-monitoring-map',
  templateUrl: './monitoring-map.component.html',
  styleUrls: ['./monitoring-map.component.css'],
  standalone: false,
})
export class MonitoringMapComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @Input() data: MonitoringMapData = [];
  @Output() locationFilterChange =
    new EventEmitter<MonitoringLocationFilterChange>();
  @ViewChild('mapElement', { static: true })
  mapElement!: ElementRef<HTMLDivElement>;

  stats: MonitoringMapStats = {
    total: 0,
    mapped: 0,
    withoutLocation: 0,
  };
  provinces: LocationOption[] = [];
  municipalities: LocationOption[] = [];
  sectors: LocationOption[] = [];
  selectedProvince = '';
  selectedMunicipality = '';
  selectedSector = '';
  loadingLocationFilters = false;
  loadingMunicipalities = false;
  loadingSectors = false;
  locationFilterError = '';

  private map: maplibregl.Map | null = null;
  private mapLoaded = false;
  private popup: maplibregl.Popup | null = null;
  private readonly externalHttp: HttpClient;
  private pendingFeatures: GeoJSON.Feature<GeoJSON.Point>[] = [];
  private totalDevices = 0;
  private devicesWithoutLocation = 0;
  private administrativeBoundaries: AdministrativeBoundary[] = [];
  private sectorBoundaries: SectorBoundary[] = [];
  private readonly sourceId = 'monitoring-devices';
  private readonly pulseLayerId = 'monitoring-device-pulses';
  private readonly pointLayerId = 'monitoring-device-points';
  private readonly iconLayerId = 'monitoring-device-icons';
  private readonly labelLayerId = 'monitoring-device-labels';
  private readonly dominicanRepublicBounds: [[number, number], [number, number]] =
    [
      [-72.1, 17.45],
      [-68.2, 20.1],
    ];
  private readonly dominicanRepublicMarkerThreshold = 200;
  private readonly americasBounds = {
    minLat: -60,
    maxLat: 85,
    minLng: -170,
    maxLng: -30,
  };
  private readonly administrativeBoundariesUrl =
    'https://mapageneral.mineria.gob.do/arcgis/rest/services/PortalMapa/Portal_AP/MapServer/5/query';
  private readonly sectorBoundariesUrl =
    'https://services.arcgis.com/4TKcmj8FHh5Vtobt/ArcGIS/rest/services/Dominican_Division_view/FeatureServer/3/query';

  constructor(
    httpBackend: HttpBackend,
    private readonly locationCatalog: VehicleBrandsService,
  ) {
    this.externalHttp = new HttpClient(httpBackend);
  }

  ngAfterViewInit(): void {
    this.initializeMap();
    void this.loadLocationFilters();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data']) {
      this.refreshFeatures();
    }
  }

  ngOnDestroy(): void {
    this.popup?.remove();
    this.popup = null;
    this.map?.remove();
    this.map = null;
    this.mapLoaded = false;
  }

  async onProvinceChange(provinceCode: string): Promise<void> {
    this.locationFilterError = '';
    this.selectedProvince = String(provinceCode || '');
    this.selectedMunicipality = '';
    this.selectedSector = '';
    this.municipalities = [];
    this.sectors = [];
    this.sectorBoundaries = [];
    this.applyLocationFilters();

    if (!this.selectedProvince) {
      return;
    }

    this.loadingMunicipalities = true;
    try {
      const municipalities = await this.locationCatalog.getMunicipalities(
        this.selectedProvince,
      );
      this.municipalities = this.normalizeLocationOptions(municipalities);
    } catch {
      this.locationFilterError =
        'No se pudieron cargar los municipios de esta provincia.';
    } finally {
      this.loadingMunicipalities = false;
    }
  }

  async onMunicipalityChange(municipalityCode: string): Promise<void> {
    this.locationFilterError = '';
    this.selectedMunicipality = String(municipalityCode || '');
    this.selectedSector = '';
    this.sectors = [];
    this.sectorBoundaries = [];
    this.applyLocationFilters();

    if (!this.selectedProvince || !this.selectedMunicipality) {
      return;
    }

    this.loadingSectors = true;
    try {
      const sectors = await this.locationCatalog.getSectors(
        this.selectedMunicipality,
        this.selectedProvince,
      );
      this.sectors = this.normalizeLocationOptions(sectors);

      try {
        const boundariesResponse = await firstValueFrom(
          this.externalHttp.get<GeoJSON.FeatureCollection>(
            this.sectorBoundariesUrl,
            {
              params: new HttpParams()
                .set(
                  'where',
                  `PROV='${this.escapeArcGisValue(this.selectedProvince)}' AND MUN='${this.escapeArcGisValue(this.selectedMunicipality)}'`,
                )
                .set(
                  'outFields',
                  'PROV,MUN,BP,TOPONIMIA,ENLACE,CODIGO',
                )
                .set('returnGeometry', 'true')
                .set('outSR', '4326')
                .set('maxAllowableOffset', '0.00015')
                .set('geometryPrecision', '6')
                .set('resultRecordCount', '2000')
              .set('f', 'geojson'),
            },
          ),
        );
        this.sectorBoundaries = (boundariesResponse?.features || [])
          .map((feature) => this.toSectorBoundary(feature))
          .filter(
            (boundary): boundary is SectorBoundary => boundary !== null,
          );
      } catch {
        this.sectorBoundaries = [];
        this.locationFilterError =
          'La delimitación de sectores no está disponible; se usará la dirección reportada por el GPS.';
      }

      this.assignSectorAreas(this.pendingFeatures);
      this.applyLocationFilters();
    } catch {
      this.locationFilterError =
        'No se pudieron cargar los sectores de este municipio.';
    } finally {
      this.loadingSectors = false;
    }
  }

  onSectorChange(sectorCode: string): void {
    this.selectedSector = String(sectorCode || '');
    this.applyLocationFilters();
  }

  clearLocationFilters(): void {
    this.selectedProvince = '';
    this.selectedMunicipality = '';
    this.selectedSector = '';
    this.municipalities = [];
    this.sectors = [];
    this.sectorBoundaries = [];
    this.applyLocationFilters();
  }

  private initializeMap(): void {
    if (this.map || !this.mapElement?.nativeElement) {
      return;
    }

    this.map = new maplibregl.Map({
      container: this.mapElement.nativeElement,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: [
              'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>',
          },
        },
        layers: [
          {
            id: 'osm-layer',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [-69.9312, 18.4861],
      zoom: 8,
      attributionControl: {},
    });

    this.map.addControl(new maplibregl.NavigationControl(), 'top-right');
    this.map.addControl(new maplibregl.FullscreenControl(), 'top-right');

    this.map.on('load', () => {
      if (!this.map) {
        return;
      }

      this.mapLoaded = true;
      this.setupDeviceLayers();
      this.bindMapInteractions();
      this.applyLocationFilters();
    });

    this.refreshFeatures();
  }

  private setupDeviceLayers(): void {
    if (!this.map || this.map.getSource(this.sourceId)) {
      return;
    }

    this.map.addSource(this.sourceId, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
      cluster: false,
    });

    this.map.addImage(
      'monitoring-pulse-online',
      this.createPulsingDot(34, 197, 94),
      { pixelRatio: 2 },
    );
    this.map.addImage(
      'monitoring-pulse-localizado',
      this.createPulsingDot(6, 182, 212),
      { pixelRatio: 2 },
    );
    this.map.addImage(
      'monitoring-pulse-offline',
      this.createPulsingDot(156, 163, 175),
      { pixelRatio: 2 },
    );
    this.map.addImage(
      'monitoring-pulse-expired',
      this.createPulsingDot(239, 68, 68),
      { pixelRatio: 2 },
    );

    this.map.addLayer({
      id: this.pulseLayerId,
      type: 'symbol',
      source: this.sourceId,
      layout: {
        'icon-image': [
          'case',
          ['==', ['get', 'isExpired'], true],
          'monitoring-pulse-expired',
          ['==', ['get', 'statusGroup'], 'localizado'],
          'monitoring-pulse-localizado',
          ['==', ['get', 'statusGroup'], 'online'],
          'monitoring-pulse-online',
          'monitoring-pulse-offline',
        ],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-size': 1,
      },
    });

    this.map.addLayer({
      id: this.pointLayerId,
      type: 'circle',
      source: this.sourceId,
      paint: {
        'circle-color': [
          'case',
          ['==', ['get', 'isExpired'], true],
          '#ef4444',
          ['==', ['get', 'statusGroup'], 'localizado'],
          '#06b6d4',
          ['==', ['get', 'statusGroup'], 'online'],
          '#22c55e',
          '#9ca3af',
        ],
        'circle-radius': 7,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    });

    this.map.addLayer({
      id: this.labelLayerId,
      type: 'symbol',
      source: this.sourceId,
      minzoom: 7,
      layout: {
        'text-field': ['get', 'name'],
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          7,
          10,
          14,
          13,
        ],
        'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
        'text-offset': [0, 1.5],
        'text-anchor': 'top',
        'text-max-width': 16,
        'text-padding': 4,
        'text-allow-overlap': false,
        'text-ignore-placement': false,
      },
      paint: {
        'text-color': '#111827',
        'text-halo-color': 'rgba(255, 255, 255, 0.96)',
        'text-halo-width': 2,
        'text-halo-blur': 0.5,
      },
    });

    this.loadDashboardMarkerImages();
  }

  private loadDashboardMarkerImages(): void {
    if (!this.map) {
      return;
    }

    const mapInstance = this.map;
    Promise.all([
      mapInstance.loadImage('logo/favicon.png'),
      mapInstance.loadImage('logo/favicon-gray.png'),
    ])
      .then(([normalResponse, grayResponse]: [any, any]) => {
        if (!this.map || !this.mapLoaded) {
          return;
        }

        const normalImage = normalResponse.data || normalResponse;
        const grayImage = grayResponse.data || grayResponse;

        if (!this.map.hasImage('monitoring-marker')) {
          this.map.addImage('monitoring-marker', normalImage);
        }
        if (!this.map.hasImage('monitoring-marker-offline')) {
          this.map.addImage('monitoring-marker-offline', grayImage);
        }
        if (!this.map.getLayer(this.iconLayerId)) {
          this.map.addLayer({
            id: this.iconLayerId,
            type: 'symbol',
            source: this.sourceId,
            layout: {
              'icon-image': [
                'case',
                ['==', ['get', 'statusGroup'], 'online'],
                'monitoring-marker',
                ['==', ['get', 'statusGroup'], 'localizado'],
                'monitoring-marker',
                'monitoring-marker-offline',
              ],
              'icon-size': 0.15,
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
            },
            paint: {
              'icon-opacity': [
                'case',
                ['==', ['get', 'statusGroup'], 'online'],
                1,
                ['==', ['get', 'statusGroup'], 'localizado'],
                1,
                0.65,
              ],
            },
          });
        }
      })
      .catch(() => {
        // El círculo permanece como marcador de respaldo.
      });
  }

  private bindMapInteractions(): void {
    if (!this.map) {
      return;
    }

    this.map.on('click', this.pointLayerId, (event: any) => {
      const feature = event.features?.[0];
      const coordinates = feature?.geometry?.coordinates;
      if (!feature || !Array.isArray(coordinates)) {
        return;
      }

      this.popup?.remove();
      this.popup = new maplibregl.Popup({
        offset: 18,
        closeButton: true,
        maxWidth: '340px',
      })
        .setLngLat([Number(coordinates[0]), Number(coordinates[1])])
        .setDOMContent(this.createPopupContent(feature.properties || {}))
        .addTo(this.map!);
    });

    this.map.on('mouseenter', this.pointLayerId, () => {
      if (this.map) {
        this.map.getCanvas().style.cursor = 'pointer';
      }
    });
    this.map.on('mouseleave', this.pointLayerId, () => {
      if (this.map) {
        this.map.getCanvas().style.cursor = '';
      }
    });
  }

  private refreshFeatures(): void {
    const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
    let total = 0;

    for (const userData of this.data || []) {
      const route = Array.isArray(userData.route) ? userData.route : [];
      const routeOwner = route.length ? route[route.length - 1] : null;
      const clientName =
        routeOwner?.fullName ||
        (routeOwner as any)?.name ||
        (userData as any)?.userName ||
        'Cliente';

      for (const device of userData.devices || []) {
        total += 1;
        const coordinates = this.getCoordinates(device);
        if (!coordinates) {
          continue;
        }

        const statusGroup = this.getStatusGroup(device);
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates,
          },
          properties: {
            id: device?._id || device?.id || '',
            deviceKey: this.getDeviceKey(device),
            name: device?.name || device?.device_imei || 'GPS',
            plate: device?.target_plate_number || 'Sin placa',
            imei: device?.device_imei || 'Sin IMEI',
            address: this.getDeviceAddress(device),
            sectorCode: this.getExplicitSectorCode(device),
            sectorName: this.getExplicitSectorName(device),
            clientName,
            connection: this.getConnectionLabel(device, statusGroup),
            expiration: this.formatDate(device?.expiration_date),
            statusGroup,
            isExpired: this.isExpired(device?.expiration_date),
          },
        });
      }
    }

    this.totalDevices = total;
    this.devicesWithoutLocation = Math.max(0, total - features.length);
    if (this.administrativeBoundaries.length) {
      this.assignAdministrativeAreas(features);
    }
    if (this.sectorBoundaries.length) {
      this.assignSectorAreas(features);
    }
    this.pendingFeatures = features;

    if (this.mapLoaded) {
      this.applyLocationFilters();
    } else {
      this.updateStats(features.length);
    }
  }

  private async loadLocationFilters(): Promise<void> {
    this.loadingLocationFilters = true;
    this.locationFilterError = '';

    try {
      const [provinces, boundariesResponse] = await Promise.all([
        this.locationCatalog.getProvinces(),
        firstValueFrom(
          this.externalHttp.get<GeoJSON.FeatureCollection>(
            this.administrativeBoundariesUrl,
            {
              params: new HttpParams()
                .set('where', '1=1')
                .set(
                  'outFields',
                  'COD_PROV,PROVINCIA,COD_MUN,MUNICIPIO,CodeMUN',
                )
                .set('returnGeometry', 'true')
                .set('outSR', '4326')
                .set('maxAllowableOffset', '0.0008')
                .set('geometryPrecision', '5')
                .set('f', 'geojson'),
            },
          ),
        ),
      ]);

      this.provinces = this.normalizeLocationOptions(provinces);
      this.administrativeBoundaries = (
        boundariesResponse?.features || []
      )
        .map((feature) => this.toAdministrativeBoundary(feature))
        .filter(
          (boundary): boundary is AdministrativeBoundary =>
            boundary !== null,
        );
      this.assignAdministrativeAreas(this.pendingFeatures);
      this.applyLocationFilters();
    } catch {
      this.locationFilterError =
        'No fue posible preparar los filtros geográficos.';
    } finally {
      this.loadingLocationFilters = false;
    }
  }

  private applyLocationFilters(): void {
    const features = this.pendingFeatures.filter((feature) => {
      const properties = feature.properties || {};
      if (
        this.selectedProvince &&
        properties['provinceCode'] !== this.selectedProvince
      ) {
        return false;
      }
      if (
        this.selectedMunicipality &&
        properties['municipalityCode'] !== this.selectedMunicipality
      ) {
        return false;
      }
      if (this.selectedSector && !this.matchesSelectedSector(properties)) {
        return false;
      }
      return true;
    });

    this.updateStats(features.length);
    this.emitLocationFilterChange(features);
    if (this.mapLoaded) {
      this.applyFeatures(features);
    }
  }

  private emitLocationFilterChange(
    features: GeoJSON.Feature<GeoJSON.Point>[],
  ): void {
    const active = Boolean(
      this.selectedProvince ||
        this.selectedMunicipality ||
        this.selectedSector,
    );
    const selectedProvince = this.provinces.find(
      (option) => option.code === this.selectedProvince,
    );
    const selectedMunicipality = this.municipalities.find(
      (option) => option.code === this.selectedMunicipality,
    );
    const selectedSector = this.sectors.find(
      (option) => option.code === this.selectedSector,
    );

    this.locationFilterChange.emit({
      active,
      visibleDeviceKeys: active
        ? features
            .map((feature) =>
              String(feature.properties?.['deviceKey'] || '').trim(),
            )
            .filter(Boolean)
        : [],
      province: selectedProvince?.name || '',
      municipality: selectedMunicipality?.name || '',
      sector: selectedSector?.name || '',
    });
  }

  private matchesSelectedSector(
    properties: GeoJSON.GeoJsonProperties,
  ): boolean {
    const selectedSector = this.sectors.find(
      (option) => option.code === this.selectedSector,
    );
    if (!selectedSector) {
      return false;
    }

    const explicitCode = this.normalizeCode(properties?.['sectorCode']);
    const numericExplicitCode = Number(explicitCode);
    const numericSelectedCode = Number(selectedSector.code);
    if (
      explicitCode &&
      (explicitCode === selectedSector.code ||
        (Number.isFinite(numericExplicitCode) &&
          Number.isFinite(numericSelectedCode) &&
          numericExplicitCode === numericSelectedCode))
    ) {
      return true;
    }

    const sectorAliases = this.getSectorSearchAliases(selectedSector.name);
    if (!sectorAliases.length) {
      return false;
    }

    return [properties?.['sectorName'], properties?.['address']].some(
      (value) => {
        const normalizedValue = this.normalizeSearchText(value);
        return sectorAliases.some(
          (alias) =>
            normalizedValue === alias || normalizedValue.includes(alias),
        );
      },
    );
  }

  private getSectorSearchAliases(name: string): string[] {
    const normalizedName = this.normalizeSearchText(name);
    if (!normalizedName) {
      return [];
    }

    const withoutCommonPrefix = normalizedName.replace(
      /^(?:barrio|ensanche|urbanizacion|residencial|sector)\s+/,
      '',
    );
    return [...new Set([normalizedName, withoutCommonPrefix])]
      .filter((alias) => alias.length >= 3);
  }

  private getDeviceKey(device: any): string {
    return String(
      device?._id ||
        device?.id ||
        device?.device_imei ||
        device?.api_device_id ||
        '',
    ).trim();
  }

  private getDeviceAddress(device: any): string {
    return String(
      device?.traccarInfo?.lastLocation?.address ||
        device?.traccarInfo?.geolocation?.address ||
        device?.lastLocation?.address ||
        device?.address ||
        '',
    ).trim();
  }

  private getExplicitSectorCode(device: any): string {
    return this.normalizeCode(
      device?.sector_code ||
        device?.sectorCode ||
        device?.traccarInfo?.lastLocation?.sectorCode ||
        '',
    );
  }

  private getExplicitSectorName(device: any): string {
    return String(
      device?.sector_name ||
        device?.sectorName ||
        device?.sector ||
        device?.traccarInfo?.lastLocation?.sector ||
        '',
    ).trim();
  }

  private normalizeSearchText(value: any): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private updateStats(mapped: number): void {
    this.stats = {
      total: this.totalDevices,
      mapped,
      withoutLocation: this.devicesWithoutLocation,
    };
  }

  private assignAdministrativeAreas(
    features: GeoJSON.Feature<GeoJSON.Point>[],
  ): void {
    for (const feature of features) {
      const coordinates = feature.geometry.coordinates as [number, number];
      const boundary = this.findAdministrativeBoundary(coordinates);
      feature.properties = {
        ...(feature.properties || {}),
        provinceCode: boundary?.provinceCode || '',
        municipalityCode: boundary?.municipalityCode || '',
        provinceName: boundary?.provinceName || 'Fuera de cobertura',
        municipalityName: boundary?.municipalityName || 'Fuera de cobertura',
      };
    }
  }

  private assignSectorAreas(
    features: GeoJSON.Feature<GeoJSON.Point>[],
  ): void {
    for (const feature of features) {
      const coordinates = feature.geometry.coordinates as [number, number];
      const boundary = this.findSectorBoundary(coordinates);
      feature.properties = {
        ...(feature.properties || {}),
        sectorCode:
          boundary?.sectorCode ||
          feature.properties?.['sectorCode'] ||
          '',
        sectorIdentifier: boundary?.identifier || '',
        sectorName:
          boundary?.sectorName ||
          feature.properties?.['sectorName'] ||
          '',
      };
    }
  }

  private findSectorBoundary(
    point: [number, number],
  ): SectorBoundary | undefined {
    return this.sectorBoundaries.find((boundary) => {
      const [minLng, minLat, maxLng, maxLat] = boundary.bbox;
      if (
        point[0] < minLng ||
        point[0] > maxLng ||
        point[1] < minLat ||
        point[1] > maxLat
      ) {
        return false;
      }
      return this.isPointInGeometry(point, boundary.feature.geometry);
    });
  }

  private findAdministrativeBoundary(
    point: [number, number],
  ): AdministrativeBoundary | undefined {
    return this.administrativeBoundaries.find((boundary) => {
      const [minLng, minLat, maxLng, maxLat] = boundary.bbox;
      if (
        point[0] < minLng ||
        point[0] > maxLng ||
        point[1] < minLat ||
        point[1] > maxLat
      ) {
        return false;
      }
      return this.isPointInGeometry(point, boundary.feature.geometry);
    });
  }

  private isPointInGeometry(
    point: [number, number],
    geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
  ): boolean {
    const polygons =
      geometry.type === 'Polygon'
        ? [geometry.coordinates]
        : geometry.coordinates;

    return polygons.some((polygon) => {
      const [outerRing, ...holes] = polygon;
      return (
        this.isPointInRing(point, outerRing) &&
        !holes.some((hole) => this.isPointInRing(point, hole))
      );
    });
  }

  private isPointInRing(
    point: [number, number],
    ring: GeoJSON.Position[],
  ): boolean {
    let inside = false;
    for (
      let current = 0, previous = ring.length - 1;
      current < ring.length;
      previous = current++
    ) {
      const currentPoint = ring[current];
      const previousPoint = ring[previous];
      const intersects =
        currentPoint[1] > point[1] !== previousPoint[1] > point[1] &&
        point[0] <
          ((previousPoint[0] - currentPoint[0]) *
            (point[1] - currentPoint[1])) /
            (previousPoint[1] - currentPoint[1]) +
            currentPoint[0];
      if (intersects) {
        inside = !inside;
      }
    }
    return inside;
  }

  private toAdministrativeBoundary(
    rawFeature: GeoJSON.Feature,
  ): AdministrativeBoundary | null {
    if (
      !rawFeature?.geometry ||
      !['Polygon', 'MultiPolygon'].includes(rawFeature.geometry.type)
    ) {
      return null;
    }

    const feature = rawFeature as GeoJSON.Feature<
      GeoJSON.Polygon | GeoJSON.MultiPolygon,
      Record<string, any>
    >;
    const properties = feature.properties || {};
    const bbox = this.calculateGeometryBounds(feature.geometry);
    if (!bbox) {
      return null;
    }

    return {
      feature,
      provinceCode: this.normalizeCode(properties['COD_PROV']),
      municipalityCode: this.normalizeCode(properties['COD_MUN']),
      provinceName: String(properties['PROVINCIA'] || ''),
      municipalityName: String(properties['MUNICIPIO'] || ''),
      bbox,
    };
  }

  private toSectorBoundary(
    rawFeature: GeoJSON.Feature,
  ): SectorBoundary | null {
    if (
      !rawFeature?.geometry ||
      !['Polygon', 'MultiPolygon'].includes(rawFeature.geometry.type)
    ) {
      return null;
    }

    const feature = rawFeature as GeoJSON.Feature<
      GeoJSON.Polygon | GeoJSON.MultiPolygon,
      Record<string, any>
    >;
    const properties = feature.properties || {};
    const bbox = this.calculateGeometryBounds(feature.geometry);
    if (!bbox) {
      return null;
    }

    return {
      feature,
      provinceCode: this.normalizeCode(properties['PROV']),
      municipalityCode: this.normalizeCode(properties['MUN']),
      sectorCode: String(properties['BP'] || '').trim(),
      identifier: String(
        properties['ENLACE'] || properties['CODIGO'] || '',
      ).trim(),
      sectorName: String(properties['TOPONIMIA'] || '').trim(),
      bbox,
    };
  }

  private calculateGeometryBounds(
    geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
  ): [number, number, number, number] | null {
    const polygons =
      geometry.type === 'Polygon'
        ? [geometry.coordinates]
        : geometry.coordinates;
    let minLng = Number.POSITIVE_INFINITY;
    let minLat = Number.POSITIVE_INFINITY;
    let maxLng = Number.NEGATIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;

    for (const polygon of polygons) {
      for (const ring of polygon) {
        for (const coordinate of ring) {
          minLng = Math.min(minLng, coordinate[0]);
          minLat = Math.min(minLat, coordinate[1]);
          maxLng = Math.max(maxLng, coordinate[0]);
          maxLat = Math.max(maxLat, coordinate[1]);
        }
      }
    }

    if (![minLng, minLat, maxLng, maxLat].every(Number.isFinite)) {
      return null;
    }
    return [minLng, minLat, maxLng, maxLat];
  }

  private normalizeLocationOptions(items: any[]): LocationOption[] {
    return (Array.isArray(items) ? items : [])
      .map((item) => ({
        code: this.normalizeCode(item?.code),
        name: String(item?.name || '').trim(),
      }))
      .filter((item) => item.code && item.name)
      .sort((first, second) =>
        first.name.localeCompare(second.name, 'es', {
          sensitivity: 'base',
        }),
      );
  }

  private normalizeCode(value: any): string {
    const code = String(value ?? '').trim();
    return code.length === 1 ? code.padStart(2, '0') : code;
  }

  private escapeArcGisValue(value: string): string {
    return String(value || '').replace(/'/g, "''");
  }

  private applyFeatures(
    features: GeoJSON.Feature<GeoJSON.Point>[],
  ): void {
    if (!this.map || !this.mapLoaded) {
      return;
    }

    const source = this.map.getSource(this.sourceId) as
      | maplibregl.GeoJSONSource
      | undefined;
    source?.setData({
      type: 'FeatureCollection',
      features,
    });

    this.adjustViewport(features);
  }

  private adjustViewport(
    features: GeoJSON.Feature<GeoJSON.Point>[],
  ): void {
    if (!this.map) {
      return;
    }

    if (!features.length) {
      const selectedBounds = this.getSelectedAdministrativeBounds();
      if (selectedBounds) {
        this.map.fitBounds(
          [
            [selectedBounds[0], selectedBounds[1]],
            [selectedBounds[2], selectedBounds[3]],
          ],
          {
            padding: 45,
            maxZoom: 11,
            duration: 0,
          },
        );
        return;
      }
      this.map.jumpTo({
        center: [-69.9312, 18.4861],
        zoom: 8,
      });
      return;
    }

    if (features.length > this.dominicanRepublicMarkerThreshold) {
      this.map.fitBounds(this.dominicanRepublicBounds, {
        padding: 30,
        maxZoom: 8,
        duration: 0,
      });
      return;
    }

    const bounds = new maplibregl.LngLatBounds();
    for (const feature of features) {
      bounds.extend(feature.geometry.coordinates as [number, number]);
    }
    this.map.fitBounds(bounds, {
      padding: 60,
      maxZoom: 14,
      duration: 0,
    });
  }

  private getCoordinates(device: any): [number, number] | null {
    const geolocation =
      device?.traccarInfo?.geolocation ||
      device?.traccarInfo?.lastLocation ||
      device?.traccarInfo?.position ||
      device?.geolocation ||
      device?.position ||
      {};
    const latitude = Number(
      geolocation?.latitude ??
        geolocation?.lat ??
        device?.latitude ??
        device?.latitud,
    );
    const longitude = Number(
      geolocation?.longitude ??
        geolocation?.lng ??
        geolocation?.lon ??
        device?.longitude ??
        device?.longitud,
    );

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }
    if (
      latitude < this.americasBounds.minLat ||
      latitude > this.americasBounds.maxLat ||
      longitude < this.americasBounds.minLng ||
      longitude > this.americasBounds.maxLng
    ) {
      return null;
    }

    return [longitude, latitude];
  }

  private getStatusGroup(device: any): DeviceStatusGroup {
    const status = String(device?.traccarInfo?.status || '')
      .trim()
      .toLowerCase();
    if (status === 'localizado') {
      return 'localizado';
    }
    if (
      status === 'online' ||
      status === 'en linea' ||
      status === 'en línea' ||
      status === 'señal débil' ||
      status === 'senal debil'
    ) {
      return 'online';
    }

    const lastUpdate =
      device?.traccarInfo?.lastUpdate ||
      device?.traccarInfo?.last_update;
    if (lastUpdate) {
      const updateTime = new Date(lastUpdate).getTime();
      const minutes = (Date.now() - updateTime) / 60_000;
      if (Number.isFinite(minutes) && minutes >= 0 && minutes <= 60) {
        return 'online';
      }
    }

    return 'offline';
  }

  private getConnectionLabel(
    device: any,
    statusGroup: DeviceStatusGroup,
  ): string {
    const rawStatus = String(device?.traccarInfo?.status || '').trim();
    if (rawStatus) {
      return rawStatus;
    }
    if (statusGroup === 'online') {
      return 'En línea';
    }
    if (statusGroup === 'localizado') {
      return 'Localizado';
    }
    return 'Fuera de línea';
  }

  private isExpired(value: Date | string | null | undefined): boolean {
    if (!value) {
      return false;
    }
    const expiration = new Date(value);
    if (Number.isNaN(expiration.getTime())) {
      return false;
    }
    expiration.setHours(23, 59, 59, 999);
    return expiration.getTime() < Date.now();
  }

  private formatDate(value: Date | string | null | undefined): string {
    if (!value) {
      return 'Sin fecha';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Sin fecha';
    }
    return date.toLocaleDateString('es-DO');
  }

  private createPopupContent(properties: Record<string, any>): HTMLElement {
    const content = document.createElement('div');
    content.className = 'monitoring-map-popup';

    const title = document.createElement('strong');
    title.className = 'monitoring-map-popup__title';
    title.textContent = formatDeviceLabel(properties['name'] || 'GPS');
    content.appendChild(title);

    const rows: Array<[string, string]> = [
      ['Cliente', properties['clientName']],
      ['Provincia', properties['provinceName']],
      ['Municipio', properties['municipalityName']],
      ['Sector', properties['sectorName']],
      ['Placa', properties['plate']],
      ['IMEI', properties['imei']],
      ['Conexión', properties['connection']],
      ['Vencimiento', properties['expiration']],
    ];

    for (const [label, value] of rows) {
      const row = document.createElement('div');
      row.className = 'monitoring-map-popup__row';

      const labelElement = document.createElement('span');
      labelElement.textContent = label;
      const valueElement = document.createElement('b');
      valueElement.textContent = String(value || 'N/D');

      row.append(labelElement, valueElement);
      content.appendChild(row);
    }

    return content;
  }

  private getSelectedAdministrativeBounds():
    | [number, number, number, number]
    | null {
    if (!this.selectedProvince) {
      return null;
    }

    if (this.selectedSector) {
      const selectedSectorBounds = this.sectorBoundaries
        .filter((boundary) => {
          const sameSectorCode =
            boundary.sectorCode === this.selectedSector ||
            Number(boundary.sectorCode) === Number(this.selectedSector);
          return (
            boundary.provinceCode === this.selectedProvince &&
            boundary.municipalityCode === this.selectedMunicipality &&
            sameSectorCode
          );
        })
        .map((boundary) => boundary.bbox);
      if (selectedSectorBounds.length) {
        return this.mergeBounds(selectedSectorBounds);
      }
    }

    const selectedBoundaries = this.administrativeBoundaries.filter(
      (boundary) =>
        boundary.provinceCode === this.selectedProvince &&
        (!this.selectedMunicipality ||
          boundary.municipalityCode === this.selectedMunicipality),
    );
    if (!selectedBoundaries.length) {
      return null;
    }

    return this.mergeBounds(
      selectedBoundaries.map((boundary) => boundary.bbox),
    );
  }

  private mergeBounds(
    bounds: Array<[number, number, number, number]>,
  ): [number, number, number, number] {
    return bounds.reduce<[number, number, number, number]>(
      (result, boundary) => [
        Math.min(result[0], boundary[0]),
        Math.min(result[1], boundary[1]),
        Math.max(result[2], boundary[2]),
        Math.max(result[3], boundary[3]),
      ],
      [
        Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
      ],
    );
  }

  private createPulsingDot(r: number, g: number, b: number): any {
    const size = 150;
    const mapInstance = this.map;

    return {
      width: size,
      height: size,
      data: new Uint8Array(size * size * 4),
      onAdd: function () {
        const canvas = document.createElement('canvas');
        canvas.width = this.width;
        canvas.height = this.height;
        this.context = canvas.getContext('2d', {
          willReadFrequently: true,
        });
      },
      render: function () {
        const duration = 3000;
        const firstProgress = (performance.now() % duration) / duration;
        const secondProgress =
          ((performance.now() + duration / 2) % duration) / duration;
        const radius = (size / 2) * 0.1;
        const context = this.context;

        context.clearRect(0, 0, this.width, this.height);
        [
          firstProgress,
          secondProgress,
        ].forEach((progress: number) => {
          context.beginPath();
          const outerRadius = (size / 2) * 0.8 * progress + radius;
          context.arc(
            this.width / 2,
            this.height / 2,
            outerRadius,
            0,
            Math.PI * 2,
          );
          context.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.max(
            0,
            1 - progress,
          )})`;
          context.fill();
        });

        this.data = context.getImageData(
          0,
          0,
          this.width,
          this.height,
        ).data;
        mapInstance?.triggerRepaint();
        return true;
      },
    };
  }
}
