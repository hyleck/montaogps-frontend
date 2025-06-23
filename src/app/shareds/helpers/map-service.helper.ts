// utils/marker-service.ts
import mapboxgl from 'mapbox-gl';
import { PopupBuilder } from './map-popup.helper';

export class MarkerService {
  private static currentTargetId: string | null = null;
  private static activePromises: Set<Promise<any>> = new Set();
  private static abortController: AbortController | null = null;

  static async createMarker(
    map: any, 
    provider: 'google' | 'mapbox', 
    lat: number, 
    lng: number, 
    target: any, 
    vehicleTypeGetter?: (id: string) => string,
    targetsService?: any,
    isInitialSelection: boolean = true,
    preloadedStopTime?: string
  ) {
    // DEBUG: Verificar todos los parámetros recibidos
    console.log('🔍 DEBUG MarkerService.createMarker - Parámetros recibidos:', {
      targetId: target._id || target.id,
      isInitialSelection,
      preloadedStopTime,
      preloadedStopTimeType: typeof preloadedStopTime,
      preloadedStopTimeLength: preloadedStopTime?.length,
      hasTargetsService: !!targetsService
    });

    // CANCELAR PROCESOS ANTERIORES INMEDIATAMENTE
    const targetId = target._id || target.id;
    console.log('🎯 Creando marcador para target:', targetId, 'isInitialSelection:', isInitialSelection);
    
    // VERIFICACIÓN ADICIONAL: Asegurar que no hay marcadores residuales en el mapa
    if (provider === 'mapbox' && map) {
      // Para Mapbox, verificar si hay marcadores existentes y removerlos
      const existingMarkers = map._markers || [];
      if (existingMarkers.length > 0) {
        console.log('⚠️ Detectados', existingMarkers.length, 'marcadores residuales en Mapbox, limpiando...');
        existingMarkers.forEach((marker: any) => {
          if (marker && marker.remove) {
            marker.remove();
          }
        });
      }
    }
    
    // Si es un target diferente, cancelar todo lo anterior
    if (this.currentTargetId && this.currentTargetId !== targetId) {
      console.log('🛑 Cancelando procesos del target anterior:', this.currentTargetId);
      this.cancelAllProcesses();
      
      // Para Mapbox, también detener cualquier animación de flyTo en curso
      if (provider === 'mapbox' && map) {
        console.log('🛑 Deteniendo animaciones Mapbox en curso');
        map.stop();
      }
    }
    
    // Establecer el nuevo target como activo
    this.currentTargetId = targetId;
    this.abortController = new AbortController();
    
    const speedKnots = target?.traccarInfo?.geolocation?.speed || 0;
    const speedKmh = Math.round(speedKnots * 1.852);
    const status = target?.traccarInfo?.status || 'desconocido';
    const vehicleType = vehicleTypeGetter?.(target.model);
    const title = target.name;

    // Extraer fecha de última ubicación para dispositivos offline
    let lastLocationDate: string | undefined = undefined;
    if (status === 'offline' && target?.traccarInfo?.geolocation) {
      const geolocation = target.traccarInfo.geolocation;
      
      // Buscar campos de timestamp en diferentes formatos posibles
      const timestampField = geolocation.serverTime || 
                           geolocation.fixTime || 
                           geolocation.deviceTime || 
                           geolocation.timestamp ||
                           geolocation.time ||
                           geolocation.lastUpdate;
      
      if (timestampField) {
        try {
          const date = new Date(timestampField);
          if (!isNaN(date.getTime())) {
            // Formatear fecha en español
            lastLocationDate = date.toLocaleString('es-ES', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
            console.log('📅 Fecha de última ubicación extraída:', lastLocationDate, 'de campo:', timestampField);
          }
        } catch (error) {
          console.warn('Error formateando fecha de última ubicación:', error);
        }
      } else {
        console.log('🔍 Campos disponibles en geolocation:', Object.keys(geolocation));
      }
    }

    // Centrar el mapa en la ubicación del target sin animaciones
    console.log('🎯 Creando marcador para target:', target._id);
    const MapUtils = (await import('./map.helper')).MapUtils;
    MapUtils.recenterMap(map, provider, lat, lng);

    // Crear marcador y agregarlo inmediatamente al mapa
    let marker: any;
    let popupHtml: string;

    if (provider === 'google') {
      marker = new google.maps.Marker({
        position: { lat, lng },
        map: map, // Agregar inmediatamente al mapa
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: status === 'online' ? '#4CAF50' : '#F44336',
          fillOpacity: 0.8,
          strokeColor: '#FFFFFF',
          strokeWeight: 2
        }
      });

      popupHtml = PopupBuilder.buildPopupHtml({ 
        title, 
        vehicleType, 
        speedKmh, 
        status, 
        lastLocationDate,
        width: 320 
      });

      const infoWindow = new google.maps.InfoWindow({
        content: popupHtml,
        disableAutoPan: false,
        headerDisabled: true
      });

      (marker as any).infoWindow = infoWindow;
      marker.addListener('click', () => infoWindow.open(map, marker));

      // Abrir popup inmediatamente
      infoWindow.open(map, marker);
    } else {
      const el = document.createElement('div');
      el.style.width = '20px';
      el.style.height = '20px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = status === 'online' ? '#4CAF50' : '#F44336';
      el.style.border = '2px solid #FFF';

      marker = new mapboxgl.Marker(el).setLngLat([lng, lat]);

      popupHtml = PopupBuilder.buildPopupHtml({ 
        title, 
        vehicleType, 
        speedKmh, 
        status, 
        lastLocationDate,
        width: 280 
      });

      const popup = new mapboxgl.Popup({ 
        closeButton: false, 
        closeOnClick: false,
        closeOnMove: false,
        maxWidth: '310px',
        offset: [0, -15]
      }).setHTML(popupHtml);

      marker.setPopup(popup);

      // Agregar marcador y abrir popup inmediatamente
      marker.addTo(map);
      marker.togglePopup();
      
      // Verificar si el marcador está visible y centrarlo si no lo está (solo para Mapbox)
      this.centerMapboxMarkerIfOutOfView(map, lng, lat);
    }

    // Mostrar skeleton SOLO si NO hay tiempo precargado
    if (!preloadedStopTime) {
      setTimeout(() => {
        console.log('🔍 Buscando popup element para skeleton (selección de target)...');
        const popupElement = document.querySelector('#custom-info-window') as HTMLElement;
        if (popupElement) {
          console.log('✅ Popup element encontrado, mostrando skeleton');
          PopupBuilder.addStopTimeSkeletonWithAnimation(popupElement, speedKmh);
        } else {
          console.log('⚠️ No se encontró popup element, reintentando en 200ms...');
          // Reintentar una vez más con delay mayor
          setTimeout(() => {
            const retryPopupElement = document.querySelector('#custom-info-window') as HTMLElement;
            if (retryPopupElement) {
              console.log('✅ Popup element encontrado en reintento, mostrando skeleton');
              PopupBuilder.addStopTimeSkeletonWithAnimation(retryPopupElement, speedKmh);
            } else {
              console.log('❌ No se pudo encontrar popup element después de reintento');
            }
          }, 200);
        }
      }, 150); // Delay mínimo para que el popup se establezca
    } else {
      console.log('⚡ Tiempo precargado disponible, saltando skeleton y agregando directamente');
    }

    // Paso 4: Consultar tiempo de parada en segundo plano - USAR PRELOADED SI EXISTE
    let stopTimePromise: Promise<string | undefined>;
    
    // Si hay tiempo de parada precargado, usarlo directamente
    if (preloadedStopTime) {
      console.log('⚡ Usando tiempo de parada PRECARGADO:', preloadedStopTime);
      stopTimePromise = Promise.resolve(preloadedStopTime);
    } else {
      console.log('🔄 No hay tiempo precargado, consultando desde cero...');
      console.log('📋 Target info:', {
        mongoId: target._id || target.id,
        api_device_id: target.api_device_id,
        traccar_device_id: target.traccar_device_id,
        device_id: target.device_id,
        traccarInfoId: target.traccarInfo?.id,
        hasTargetsService: !!targetsService
      });
      
      // Priorizar api_device_id (Traccar ID) sobre MongoDB _id, añadiendo traccarInfo.id como fallback
      const deviceId = target.api_device_id || target.traccar_device_id || target.device_id || target.deviceId || target.traccarInfo?.id?.toString();
      
      if (targetsService && deviceId) {
        const deviceIdSource = target.api_device_id ? 'api_device_id' : 
                              target.traccar_device_id ? 'traccar_device_id' : 
                              target.device_id ? 'device_id' : 
                              target.deviceId ? 'deviceId' : 'traccarInfo.id';
        console.log('✅ Device ID seleccionado:', deviceId, '(fuente:', deviceIdSource, ')');
        console.log('✅ Enviando solicitud tiempo de parada para device:', deviceId);
        stopTimePromise = this.loadStopTimeInBackground(deviceId, targetsService);
      } else {
        console.log('❌ FALLO: No se puede consultar tiempo de parada');
        console.log('❌ targetsService:', !!targetsService);
        console.log('❌ deviceId encontrado:', deviceId);
        console.log('❌ target completo:', target);
        stopTimePromise = Promise.resolve(undefined);
      }
    }

    // Cuando esté listo el tiempo de parada, reemplazar skeleton o agregarlo directamente
    const stopTime = await stopTimePromise;
    
    // Verificar nuevamente que el target no haya cambiado
    const currentTargetId = target._id || target.id;
    if (this.currentTargetId !== currentTargetId) {
      console.log('🛑 Target cambió antes de procesar tiempo de parada, cancelando');
      return marker;
    }
    
    // Para tiempo precargado, aplicar inmediatamente con delay menor
    // Para tiempo consultado, usar delay normal para reemplazar skeleton
    const delay = preloadedStopTime ? 50 : 100;
    
    setTimeout(() => {
      // Verificar una vez más antes de manipular el DOM
      if (this.currentTargetId === currentTargetId) {
        const popupElement = document.querySelector('#custom-info-window') as HTMLElement;
        if (popupElement) {
          if (stopTime) {
            if (preloadedStopTime) {
              console.log('⚡ Agregando tiempo de parada PRECARGADO directamente:', stopTime);
              PopupBuilder.addStopTimeWithAnimation(popupElement, stopTime, speedKmh);
            } else {
              console.log('⏱️ Reemplazando skeleton con tiempo de parada consultado:', stopTime);
              PopupBuilder.replaceSkeletonWithStopTime(popupElement, stopTime, speedKmh);
            }
          } else {
            if (preloadedStopTime) {
              console.log('⚠️ Tiempo precargado era inválido, no mostrar nada');
            } else {
              console.log('🚗 Removiendo skeleton - vehículo en movimiento o sin datos');
              PopupBuilder.replaceSkeletonWithStopTime(popupElement, undefined, speedKmh);
            }
          }
        }
      }
    }, delay);

      return marker;
  }

  // Método auxiliar para cargar tiempo de parada en segundo plano
  private static async loadStopTimeInBackground(deviceId: string, targetsService: any): Promise<string | undefined> {
    try {
      console.log('🚀 INICIANDO consulta tiempo de parada para device:', deviceId);
      console.log('🚀 targetsService methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(targetsService)));
      
      // Verificar si el proceso ha sido cancelado
      if (this.abortController?.signal.aborted) {
        console.log('🛑 Proceso cancelado antes de cargar tiempo de parada');
        return undefined;
      }
      
      // Validar que el método existe
      if (!targetsService.getStopTime) {
        console.log('❌ ERROR: método getStopTime no existe en targetsService');
        return undefined;
      }
      
      console.log('📡 ENVIANDO solicitud getStopTime...');
      const stopTimeResponse = await targetsService.getStopTime(deviceId);
      console.log('📨 RESPUESTA RECIBIDA de getStopTime');
      
      // Verificar nuevamente después de la operación async
      if (this.abortController?.signal.aborted) {
        console.log('🛑 Proceso cancelado después de cargar tiempo de parada');
        return undefined;
      }
      
      console.log('📊 Respuesta tiempo de parada completa:', stopTimeResponse);
      
      if (!stopTimeResponse.isMoving && stopTimeResponse.text && !stopTimeResponse.error) {
        console.log('✅ Tiempo de parada obtenido:', stopTimeResponse.text);
        return stopTimeResponse.text;
      } else if (stopTimeResponse.isMoving) {
        console.log('🚗 Vehículo en movimiento');
        return undefined; // No mostrar tiempo de parada si está en movimiento
      } else if (stopTimeResponse.error) {
        console.log('❌ Error en respuesta:', stopTimeResponse.error);
        return undefined; // No mostrar tiempo de parada si hay error
      }
    } catch (error) {
      console.error('❌ ERROR cargando tiempo de parada:', error);
      console.error('❌ Error detalles:', {
        message: (error as any)?.message,
        name: (error as any)?.name,
        stack: (error as any)?.stack,
        deviceId: deviceId
      });
    }
    return undefined;
  }

  static async updatePosition({
    map,
    provider,
    marker,
    target,
    lastPosition,
    lastSpeed,
    vehicleTypeGetter,
    targetsService,
    onUpdate
  }: {
    map: any;
    provider: 'google' | 'mapbox';
    marker: any;
    target: any;
    lastPosition: { lat: number; lng: number } | null;
    lastSpeed?: number;
    vehicleTypeGetter?: (id: string) => string;
    targetsService?: any;
    onUpdate: (pos: { lat: number; lng: number }, speed: number) => void;
  }) {
    const targetId = target._id || target.id;
    console.log('🔄 MarkerService.updatePosition LLAMADO para target:', targetId);
    
    // Verificar que estamos actualizando el target correcto
    if (this.currentTargetId !== targetId) {
      console.log('🛑 Cancelando actualización - target cambió de', targetId, 'a', this.currentTargetId);
      return;
    }
    
    const rawLat = target.traccarInfo?.geolocation?.latitude;
    const rawLng = target.traccarInfo?.geolocation?.longitude;
    
    if (isNaN(rawLat) || isNaN(rawLng)) {
      console.log('❌ updatePosition: Coordenadas inválidas:', { rawLat, rawLng });
      return;
    }

    const lat = parseFloat(rawLat);
    const lng = parseFloat(rawLng);
    const speedKnots = target?.traccarInfo?.geolocation?.speed || 0;
    const currentSpeedKmh = Math.round(speedKnots * 1.852);
    
    console.log('📍 updatePosition: Coordenadas actuales:', { 
      lat: lat.toFixed(6), 
      lng: lng.toFixed(6),
      speedKmh: currentSpeedKmh,
      lastPosition: lastPosition ? `${lastPosition.lat.toFixed(6)}, ${lastPosition.lng.toFixed(6)}` : 'null'
    });
    
    // Para actualizaciones de polling frecuentes, actualizar directamente sin animación
    // Las animaciones se cancelan constantemente por el polling cada 10 segundos
    console.log('📍 Actualizando marcador directamente (polling activo)');
    await this.updateMarkerDirectly({
      map,
      provider,
      marker,
      lat,
      lng,
      target,
      speedKmh: currentSpeedKmh,
      vehicleTypeGetter,
      targetsService,
      onUpdate
    });
  }

  private static async updateMarkerDirectly({
    map,
    provider,
    marker,
    lat,
    lng,
    target,
    speedKmh,
    vehicleTypeGetter,
    targetsService,
    onUpdate
  }: {
    map: any;
    provider: 'google' | 'mapbox';
    marker: any;
    lat: number;
    lng: number;
    target: any;
    speedKmh?: number;
    vehicleTypeGetter?: (id: string) => string;
    targetsService?: any;
    onUpdate: (pos: { lat: number; lng: number }, speed: number) => void;
  }) {
    // Verificar que estamos actualizando el target correcto
    const targetId = target._id || target.id;
    console.log('🔧 updateMarkerDirectly EJECUTANDO para target:', targetId, 'en coordenadas:', lat.toFixed(6), lng.toFixed(6));
    
    if (this.currentTargetId !== targetId) {
      console.log('🛑 Cancelando updateMarkerDirectly - target cambió');
      return;
    }
    
    const finalSpeedKmh = speedKmh !== undefined ? speedKmh : (() => {
      const speedKnots = target?.traccarInfo?.geolocation?.speed || 0;
      return Math.round(speedKnots * 1.852);
    })();

    const status = target?.traccarInfo?.status || 'desconocido';

    // Extraer fecha de última ubicación para dispositivos offline
    let lastLocationDate: string | undefined = undefined;
    if (status === 'offline' && target?.traccarInfo?.geolocation) {
      const geolocation = target.traccarInfo.geolocation;
      
      // Buscar campos de timestamp en diferentes formatos posibles
      const timestampField = geolocation.serverTime || 
                           geolocation.fixTime || 
                           geolocation.deviceTime || 
                           geolocation.timestamp ||
                           geolocation.time ||
                           geolocation.lastUpdate;
      
      if (timestampField) {
        try {
          const date = new Date(timestampField);
          if (!isNaN(date.getTime())) {
            lastLocationDate = date.toLocaleString('es-ES', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
          }
        } catch (error) {
          console.warn('Error formateando fecha de última ubicación en update:', error);
        }
      }
    }

    // Obtener tiempo de parada solo para dispositivos online
    let stopTime: string | undefined = undefined;
    if (targetsService && target.api_device_id && status === 'online') {
      try {
        console.log('🔄 Actualizando tiempo de parada para device:', target.api_device_id);
        const stopTimeResponse = await targetsService.getStopTime(target.api_device_id);
        console.log('📊 Respuesta actualización tiempo de parada:', stopTimeResponse);
        
        if (!stopTimeResponse.isMoving && stopTimeResponse.text && !stopTimeResponse.error) {
          stopTime = stopTimeResponse.text;
          console.log('✅ Tiempo de parada actualizado:', stopTime);
        } else if (stopTimeResponse.isMoving) {
          console.log('🚗 Vehículo en movimiento durante actualización');
        } else if (stopTimeResponse.error) {
          console.log('❌ Error en actualización:', stopTimeResponse.error);
        }
      } catch (error) {
        console.warn('Could not get stop time in update:', error);
      }
    }

    // Actualizar posición y popup con los datos obtenidos
    if (provider === 'google') {
      marker.setPosition(new google.maps.LatLng(lat, lng));
      const infoWindow = marker.infoWindow;
      if (infoWindow) {
        const html = PopupBuilder.buildPopupHtml({
          title: target.name,
          vehicleType: vehicleTypeGetter?.(target.model),
          speedKmh: finalSpeedKmh,
          status,
          stopTime,
          lastLocationDate,
          width: 320
        });
        infoWindow.setContent(html);
      }
    } else {
      // Mapbox: actualizar posición del marcador
      marker.setLngLat([lng, lat]);
      
      // Verificar si el marcador está visible y centrarlo si no lo está
      this.centerMapboxMarkerIfOutOfView(map, lng, lat);
      
      const popup = marker.getPopup();
      if (popup) {
        const html = PopupBuilder.buildPopupHtml({
          title: target.name,
          vehicleType: vehicleTypeGetter?.(target.model),
          speedKmh: finalSpeedKmh,
          status,
          stopTime,
          lastLocationDate,
          width: 280
        });
        popup.setHTML(html);
      }
    }

    console.log('✅ updateMarkerDirectly COMPLETADO - Marcador actualizado en:', lat.toFixed(6), lng.toFixed(6), 'Velocidad:', finalSpeedKmh, 'km/h');
    onUpdate({ lat, lng }, finalSpeedKmh);
  }

  static removeMarker(marker: any, provider: 'google' | 'mapbox') {
    console.log('🗑️ Removiendo marcador:', provider);
    
    if (provider === 'google') {
      // Cerrar InfoWindow si está abierto
      if (marker.infoWindow) {
        marker.infoWindow.close();
      }
      marker.setMap(null);
      console.log('✅ Marcador Google Maps removido');
    } else {
      // Mapbox: cerrar popup si está abierto y remover marcador
      const popup = marker.getPopup();
      if (popup && popup.isOpen()) {
        popup.remove();
        console.log('🗑️ Popup Mapbox cerrado');
      }
      
      // Verificar si el marcador está en el mapa antes de removerlo
      if (marker._map) {
      marker.remove();
        console.log('✅ Marcador Mapbox removido del mapa');
        
        // Verificar que efectivamente se removió
        if (!marker._map) {
          console.log('✅ Confirmado: marcador Mapbox completamente removido');
        } else {
          console.warn('⚠️ Marcador Mapbox puede no haberse removido completamente');
        }
      } else {
        console.log('ℹ️ Marcador Mapbox ya no estaba en el mapa');
      }
    }
  }

  static destroyMap(map: any, provider: 'google' | 'mapbox') {
    console.log('🗑️ Destruyendo mapa:', provider);
    
    // Para Mapbox, cancelar animaciones específicas antes de destruir
    if (provider === 'mapbox' && map) {
      console.log('🛑 Cancelando animaciones Mapbox antes de destruir');
      map.stop();
      
      // Remover el mapa completamente
      map.remove?.();
      console.log('✅ Mapa Mapbox destruido');
    } else if (provider === 'google') {
      console.log('✅ Mapa Google Maps limpiado');
    }
  }

  static cancelTargetProcesses(targetId: string) {
    console.log('🛑 MarkerService cancelando procesos para target:', targetId);
    
    // Cancelar movimientos si el target coincide
    if (this.currentTargetId === targetId) {
      this.currentTargetId = null;
      console.log('✅ Procesos del target', targetId, 'cancelados en MarkerService');
    }
    
    // Cancelar procesos activos
    this.cancelAllProcesses();
  }

  static resetService() {
    console.log('🧹 Reseteando MarkerService completamente');
    
    // Cancelar todos los procesos
    this.cancelAllProcesses();
    
    // Resetear el target actual
    this.currentTargetId = null;
    
    console.log('✅ MarkerService reseteado completamente');
  }

  private static cancelAllProcesses() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    
    // Cancelar todas las promesas activas
    this.activePromises.clear();
  }

  // Verificar si el marcador está visible en el viewport de Mapbox y centrarlo si no lo está
  private static centerMapboxMarkerIfOutOfView(map: any, lng: number, lat: number): void {
    if (!map || !map.getBounds) return;
    
    try {
      const bounds = map.getBounds();
      const markerPoint = { lng, lat };
      
      // Verificar si el marcador está dentro de los bounds actuales
      const isVisible = bounds.contains(markerPoint);
      
      if (!isVisible) {
        console.log('📍 Marcador fuera de vista, centrando mapa en:', lat.toFixed(6), lng.toFixed(6));
        
        // Centrar el mapa sin animación suave para evitar conflictos
        map.jumpTo({
          center: [lng, lat],
          zoom: Math.max(map.getZoom(), 14) // Mantener zoom actual o usar mínimo 14
        });
      } else {
        console.log('👁️ Marcador visible en viewport actual');
      }
    } catch (error) {
      console.warn('Error verificando visibilidad del marcador:', error);
    }
  }
} 
