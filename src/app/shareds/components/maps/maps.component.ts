import { Component, OnInit, OnChanges, OnDestroy, SimpleChanges, Input } from '@angular/core';
import { ThemesService } from '../../services/themes.service';
import { StatusService } from '../../services/status.service';
import { SystemService, SystemSettings } from '../../../core/services/system.service';
import { TargetsService } from '../../../core/services/targets.service';

import { MapUtils } from '../../helpers/map.helper';
import { PopupBuilder } from '../../helpers/map-popup.helper';
import { MapThemeService } from '../../helpers/map-theme.helper';
import { MarkerService } from '../../helpers/map-service.helper';

@Component({
  selector: 'app-maps',
  templateUrl: './maps.component.html',
  styleUrls: ['./maps.component.css'],
  standalone: false
})
export class MapsComponent implements OnInit, OnChanges, OnDestroy {
  @Input() provider: 'google' | 'mapbox' = 'mapbox';
  @Input() theme: 'dark' | 'light' = 'dark';
  @Input() selectedTarget: any = null;
  @Input() vehicleTypeGetter: ((modelId: string) => string) | null = null;
  @Input() preloadedStopTime: string | undefined = undefined;

  map: any;
  apiKey: string = '';
  apiUrl: string = '';

  private currentMarkers: any[] = [];
  private lastPosition: { lat: number; lng: number } | null = null;
  private currentDisplayedSpeed: number = 0;
  private lastSpeed: number = 0;
  private isFirstTimeSelection: boolean = true;
  private isProcessingTargetChange: boolean = false;

  constructor(
    private _theme: ThemesService,
    private _status: StatusService,
    private systemService: SystemService,
    private targetsService: TargetsService
  ) {}

  ngOnInit(): void {
    this.initializeNewProvider();
  }

  private initializeNewProvider(): void {
    // console.log('Initializing new provider:', this.provider);
    this.systemService.getAll().subscribe((systems: SystemSettings[]) => {
      const config = MapUtils.getApiConfig(systems, this.provider);
      if (!config) {
        console.error('No config found for provider:', this.provider);
        return;
      }

      this.apiKey = config.key;
      this.apiUrl = config.url;
      // console.log('Config loaded for', this.provider, { hasKey: !!this.apiKey, hasUrl: !!this.apiUrl });

      MapUtils.loadMapScript(this.provider, this.apiKey, this.apiUrl)
        .then(async () => {
          // console.log('Script loaded, initializing map...');
          await this.initializeMap();
        })
        .catch(err => {
          console.error('Error loading script:', err);
        });
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Como estamos usando recreación del componente para cambios de proveedor,
    // solo necesitamos manejar cambios de tema y target
    if (this.map && changes['theme']) {
      // console.log('Theme changed to', this.theme);
      MapThemeService.updateTheme(this.map, this.provider, this.theme, this.selectedTarget, async () => await this.addMarker());
    }

    if (this.map && changes['selectedTarget']) {
      this.handleTargetChange(changes['selectedTarget']);
    }

    // DEBUG: Rastrear cambios en preloadedStopTime
    if (changes['preloadedStopTime']) {
      // console.log('🔍 DEBUG: preloadedStopTime cambió:', {
      //   previousValue: changes['preloadedStopTime'].previousValue,
      //   currentValue: changes['preloadedStopTime'].currentValue,
      //   isFirstChange: changes['preloadedStopTime'].firstChange
      // });
    }
  }

  ngOnDestroy(): void {
    // console.log('🧹 Maps component destroyed');
    
    // Limpiar la bandera de procesamiento
    this.isProcessingTargetChange = false;
    
    // Limpiar marcadores
    this.clearExistingMarkers();
    
    // Destruir el mapa
    this.destroyMap();
    
    // Limpiar el servicio de marcadores  
    MarkerService.resetService();
  }

  private async initializeMap(): Promise<void> {
    const mapElement = document.getElementById('map') as HTMLElement;
    const { centerLat, centerLng, zoomLevel } = MapUtils.getInitialMapCenter(this.selectedTarget);

    this.map = MapUtils.createMap(this.provider, mapElement, this.apiKey, this.theme, centerLat, centerLng, zoomLevel);

    // Añadir marcador si hay target seleccionado (es selección inicial)
    if (this.hasValidTarget()) {
      await this.addMarker(true);
    }
  }

  private async handleTargetChange(change: any): Promise<void> {
    const prev = change.previousValue;
    const curr = change.currentValue;

      // console.log('🔄 Target change detected:', {   
      //   prevId: prev?._id, 
      //   currId: curr?._id, 
      //   hasMarkers: this.currentMarkers.length > 0,
      //   isFirstTime: this.isFirstTimeSelection,
      //   isProcessing: this.isProcessingTargetChange,
      //   reason: !curr ? 'target_cleared' : (!prev ? 'initial_selection' : (prev._id !== curr._id ? 'different_target' : 'same_target_update'))
      // });

    // PREVENIR DOBLE PROCESAMIENTO
    if (this.isProcessingTargetChange) {
      // console.log('⏸️ Ya procesando cambio de target, saltando handleTargetChange...');
      return;
    }

    // VALIDACIÓN PRINCIPAL: Si es el mismo target y ya hay marcadores, 
    // SIEMPRE solo actualizar posición (sin importar isFirstTimeSelection)
    const isSameTarget = prev && curr && prev._id === curr._id;
    if (isSameTarget && this.currentMarkers.length > 0) {
      // console.log('⚠️ Mismo target con marcadores existentes - SOLO actualizar posición');
      // console.log('📍 currentMarkers.length:', this.currentMarkers.length, 'isFirstTime:', this.isFirstTimeSelection);
      await this.updateMarkerPosition();
      return;
    }

    // MARCAR COMO PROCESANDO
    this.isProcessingTargetChange = true;

    try {
      if (!curr) {
        // No hay target seleccionado, limpiar todo
        // console.log('❌ No target selected (posible cambio de proveedor), limpieza completada');
        await this.clearExistingMarkers();
        this.isFirstTimeSelection = true; // Reset para próxima selección
        return;
      }

      if (!this.hasValidTarget()) {
        // Target no tiene coordenadas válidas, limpiar todo
        // console.log('❌ Invalid target coordinates, limpieza completada');
        await this.clearExistingMarkers();
        this.isFirstTimeSelection = true; // Reset para próxima selección
        return;
      }

      // Es un target diferente o es la primera vez - crear nuevo marcador (CON animación)
      const isInitialSelection = !isSameTarget || this.isFirstTimeSelection;
      // console.log('✅ Creando marcador:', isInitialSelection ? 'CON animación (selección inicial)' : 'SIN animación (actualización)');
      
      // Limpiar marcadores anteriores
      await this.clearExistingMarkers();
      
      // Si es un target diferente, resetear el flag
      if (!isSameTarget) {
        this.isFirstTimeSelection = true;
      }
      
      // IMPORTANTE: Dar tiempo para que la limpieza se complete antes de crear nuevos marcadores
      setTimeout(async () => {
        // Verificar que el target no haya cambiado durante el delay
        if (this.selectedTarget && this.selectedTarget._id === curr._id) {
          // console.log('🆕 Procediendo a crear marcador después de limpieza para:', curr._id);
          // Crear nuevo marcador
          await this.createNewMarker(isInitialSelection);
          
          // Marcar que ya no es la primera vez para este target
          this.isFirstTimeSelection = false;
        } else {
          //  console.log('🛑 Target cambió durante delay
        }
      }, 50); // Delay pequeño pero suficiente para asegurar limpieza

    } finally {
      // DESMARCAR COMO PROCESANDO
      setTimeout(() => {
        this.isProcessingTargetChange = false;
        // console.log('✅ Procesamiento de target completado en Maps component');
      }, 100); // Delay para asegurar que el procesamiento se complete
    }
  }

  private hasValidTarget(): boolean {
    if (!this.selectedTarget?.traccarInfo?.geolocation?.latitude || 
        !this.selectedTarget?.traccarInfo?.geolocation?.longitude) {
      return false;
    }
    
    const lat = parseFloat(this.selectedTarget.traccarInfo.geolocation.latitude);
    const lng = parseFloat(this.selectedTarget.traccarInfo.geolocation.longitude);
    
    // Validar coordenadas independientemente del estado del dispositivo (online/offline)
    const hasValidCoordinates = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    
    if (hasValidCoordinates) {
      const status = this.selectedTarget?.traccarInfo?.status || 'desconocido';
      // console.log(`📍 Target ${this.selectedTarget._id} tiene coordenadas válidas [${lat.toFixed(6)}, ${lng.toFixed(6)}] - Estado: ${status}`);
    }
    
    return hasValidCoordinates;
  }

  private async createNewMarker(isInitialSelection: boolean = true): Promise<void> {
    // console.log('🆕 Creating new marker');
    
    if (!this.hasValidTarget()) { 
      // console.log('❌ No valid target, cannot create marker');
      return;
    }
    
    const rawLat = this.selectedTarget.traccarInfo.geolocation.latitude;
    const rawLng = this.selectedTarget.traccarInfo.geolocation.longitude;
    
    // Asegurar que sean números válidos
    const lat = parseFloat(rawLat);
    const lng = parseFloat(rawLng);
    
    if (isNaN(lat) || isNaN(lng)) {
      console.error('❌ Invalid coordinates for new marker:', { rawLat, rawLng, lat, lng });
      return;
    }
    
    // console.log(`🎯 Creating marker with animation sequence at [${lat.toFixed(6)}, ${lng.toFixed(6)}] for target ${this.selectedTarget._id}`);
    
    // El MarkerService ahora maneja toda la secuencia de animación
    await this.addMarker(isInitialSelection); // Es una selección inicial de target
  }

  private async addMarker(isInitialSelection: boolean = true): Promise<void> {
    if (!this.hasValidTarget() || !this.map) return;

    // VALIDACIÓN CRÍTICA: Si ya hay marcadores, no crear más
    if (this.currentMarkers.length > 0) {
      // console.log('⚠️ PREVENCIÓN DUPLICADOS: Ya existen', this.currentMarkers.length, 'marcadores para target:', this.selectedTarget._id);
      // console.log('⚠️ Cancelando creación de marcador adicional');
      return;
    }

    const rawLat = this.selectedTarget.traccarInfo.geolocation.latitude;
    const rawLng = this.selectedTarget.traccarInfo.geolocation.longitude;
    
    // Asegurar que sean números válidos
    const lat = parseFloat(rawLat);
    const lng = parseFloat(rawLng);
    
    if (isNaN(lat) || isNaN(lng)) {
      console.error('Invalid coordinates:', { rawLat, rawLng, lat, lng });
      return;
    }

    // DEBUG: Verificar valor de preloadedStopTime antes de pasar al MarkerService
    // console.log('🔍 DEBUG: addMarker llamado con:', {
      // targetId: this.selectedTarget._id,
      // isInitialSelection,
      // preloadedStopTime: this.preloadedStopTime,
      // preloadedStopTimeType: typeof this.preloadedStopTime,
      // preloadedStopTimeLength: this.preloadedStopTime?.length,
      // coordenadas: { lat: lat.toFixed(6), lng: lng.toFixed(6) },
      // targetGeolocation: this.selectedTarget.traccarInfo?.geolocation
    // });

    try {
      const marker = await MarkerService.createMarker(
        this.map, 
        this.provider, 
        lat, 
        lng,  
        this.selectedTarget, 
        this.vehicleTypeGetter || undefined,
        this.targetsService,
        isInitialSelection,
        this.preloadedStopTime
      );
      
      if (marker) {
    this.currentMarkers.push(marker);
    this.lastPosition = { lat, lng };
        const speedKnots = this.selectedTarget?.traccarInfo?.geolocation?.speed || 0;
        this.lastSpeed = Math.round(speedKnots * 1.852);
        this.currentDisplayedSpeed = this.lastSpeed;
      }
    } catch (error) {
      console.error('Error creating marker:', error);
      // Reintentar después de un breve delay
      setTimeout(() => {
        if (this.currentMarkers.length === 0 && this.hasValidTarget()) {
          this.addMarker(isInitialSelection);
        }
      }, 500);
    }
  }

  private async updateMarkerPosition(): Promise<void> {
    if (this.currentMarkers.length === 0 || !this.hasValidTarget()) {
      // console.log('❌ Cannot update marker position: no markers or invalid target');
      // console.log('📊 Estado actual:', {
      //   currentMarkersCount: this.currentMarkers.length,
      //   hasValidTarget: this.hasValidTarget(),
      //   selectedTargetId: this.selectedTarget?._id
      // });
      return;
    } 

    // console.log(`🔄 Updating marker position for target ${this.selectedTarget._id}`);
    // console.log('📊 Marcadores actuales:', this.currentMarkers.length);

    await MarkerService.updatePosition({
      map: this.map,
      provider: this.provider,
      marker: this.currentMarkers[0],
      target: this.selectedTarget,
      lastPosition: this.lastPosition,
      lastSpeed: this.lastSpeed,
      vehicleTypeGetter: this.vehicleTypeGetter || undefined,
      targetsService: this.targetsService,
      onUpdate: (pos, speed) => {
        this.lastPosition = pos;
        this.lastSpeed = this.currentDisplayedSpeed;
        this.currentDisplayedSpeed = speed;
      }
    });
  }

  private async clearExistingMarkers(): Promise<void> {
    // console.log('🧹 Limpiando marcadores existentes y cancelando procesos');
    
    // Cancelar animaciones específicas de Mapbox si es necesario
    if (this.provider === 'mapbox' && this.map) {
      // console.log('🛑 Deteniendo animaciones Mapbox en clearExistingMarkers');
      this.map.stop();
    }
    
    // Eliminar marcadores existentes con verificación
    if (this.currentMarkers.length > 0) {
      // console.log('🗑️ Eliminando', this.currentMarkers.length, 'marcadores');
      
      this.currentMarkers.forEach((marker, index) => {
        // console.log(`🗑️ Removiendo marcador ${index + 1}/${this.currentMarkers.length}`);
        MarkerService.removeMarker(marker, this.provider);
      });
      
      // Limpiar el array de marcadores
    this.currentMarkers = [];
      // console.log('✅ Array de marcadores limpiado');
      
     
   
    } 
    
    // Resetear estado de posición y velocidad
    this.lastPosition = null;
    this.lastSpeed = 0;
    this.currentDisplayedSpeed = 0;
    
    //  console.log('✅ Limpieza completada');
  }

  private destroyMap(): void {
    this.clearExistingMarkers();
    if (this.map) {
      MarkerService.destroyMap(this.map, this.provider);
    }
    this.map = null;
    
    // Limpiar completamente el contenedor del mapa
    const mapElement = document.getElementById('map');
    if (mapElement) {
      mapElement.innerHTML = '';
      mapElement.className = '';
      mapElement.style.cssText = '';
    }
  }
}
