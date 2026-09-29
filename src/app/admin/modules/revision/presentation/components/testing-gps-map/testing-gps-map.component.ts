import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import { TestingConnection, TestingGpsPosition } from 'src/app/core/services/simcard-testing.service';
import { getValidGpsPosition } from 'src/app/shareds/helpers/gps-position.helper';
import { MapUtils } from 'src/app/shareds/helpers/map.helper';

@Component({
  selector: 'app-testing-gps-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './testing-gps-map.component.html',
  styleUrls: ['./testing-gps-map.component.css'],
})
export class TestingGpsMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() sessionId = '';
  @Input() imei = '';
  @Input() position: TestingGpsPosition | null = null;
  @Input() stale = false;
  @Input() status: TestingConnection['status'] = 'unknown';
  @Input() statusLabel = 'Estado desconocido';
  @Input() positionReason = '';
  @ViewChild('mapContainer') mapContainer?: ElementRef<HTMLDivElement>;

  point: TestingGpsPosition | null = null;
  followGps = true;
  mapError = '';
  private map: any;
  private marker: any;
  private viewReady = false;
  private resizeObserver?: ResizeObserver;
  private renderTimer?: ReturnType<typeof setTimeout>;
  private renderedCoordinates = '';
  private readonly onDragStart = () => { this.followGps = false; };
  private readonly onMapLoad = () => { this.map?.resize(); };
  private readonly onMapError = () => { this.mapError = 'No se pudo cargar el mapa. Puedes reintentar; la ubicación permanece indicada debajo.'; };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sessionId']) {
      this.destroyMap();
      this.point = null;
      this.followGps = true;
      this.mapError = '';
    }
    if (changes['position'] || changes['sessionId']?.firstChange) {
      const coordinates = getValidGpsPosition(this.position);
      this.point = coordinates && this.position && Number.isFinite(Date.parse(this.position.fixTime))
        ? { ...this.position, latitude: coordinates.lat, longitude: coordinates.lng }
        : null;
    }
    if (changes['position'] || changes['sessionId']) this.scheduleRender();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    if (typeof ResizeObserver !== 'undefined' && this.mapContainer) {
      this.resizeObserver = new ResizeObserver(() => this.map?.resize());
      this.resizeObserver.observe(this.mapContainer.nativeElement);
    }
    this.scheduleRender();
  }

  recenter(): void {
    if (!this.point || !this.map) return;
    this.map.setCenter([this.point.longitude, this.point.latitude]);
    this.map.setZoom(16);
  }

  toggleFollow(): void {
    this.followGps = !this.followGps;
    if (this.followGps) this.recenter();
  }

  retryMap(): void {
    this.destroyMap();
    this.mapError = '';
    this.scheduleRender();
  }

  ngOnDestroy(): void {
    this.viewReady = false;
    clearTimeout(this.renderTimer);
    this.resizeObserver?.disconnect();
    this.destroyMap();
    this.point = null;
  }

  private scheduleRender(): void {
    if (!this.viewReady) return;
    clearTimeout(this.renderTimer);
    // Wait for Angular and the dialog to make the projected container visible.
    this.renderTimer = setTimeout(() => this.renderMap(), 0);
  }

  private renderMap(): void {
    const element = this.mapContainer?.nativeElement;
    if (!this.viewReady || !element || !this.point || !this.sessionId) {
      this.destroyMap();
      return;
    }
    if (this.mapError) return;
    try {
      if (!this.map) {
        this.map = MapUtils.createMap('osm', element, '', 'light', this.point.latitude, this.point.longitude, 16);
        this.map.on('dragstart', this.onDragStart);
        this.map.on('load', this.onMapLoad);
        this.map.on('error', this.onMapError);
      }
      const coordinates: [number, number] = [this.point.longitude, this.point.latitude];
      const nextCoordinates = coordinates.join(',');
      if (!this.marker) {
        const library = MapUtils.getMapLibrary('osm');
        this.marker = new library.Marker({ color: '#2563eb' }).setLngLat(coordinates).addTo(this.map);
        this.marker.getElement?.()?.setAttribute('aria-label', `GPS ${this.imei}`);
      } else this.marker.setLngLat(coordinates);
      if (this.followGps && nextCoordinates !== this.renderedCoordinates) this.map.setCenter(coordinates);
      this.renderedCoordinates = nextCoordinates;
      this.map.resize();
    } catch {
      this.destroyMap();
      element.replaceChildren();
      this.mapError = 'No se pudo abrir el mapa en este navegador. Puedes reintentar; la ubicación permanece indicada debajo.';
    }
  }

  private destroyMap(): void {
    try { this.marker?.remove(); } catch { /* The WebGL context may already be gone. */ }
    this.marker = null;
    if (this.map) {
      try {
        this.map.off('dragstart', this.onDragStart);
        this.map.off('load', this.onMapLoad);
        this.map.off('error', this.onMapError);
      } catch {
        // A partially initialized renderer may have already removed its listeners.
      } finally {
        try { this.map.remove(); } catch { /* Release the reference even after a renderer failure. */ }
      }
    }
    this.map = null;
    this.renderedCoordinates = '';
  }
}
