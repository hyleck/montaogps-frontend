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
    // // DEBUG: Verificar todos los parámetros recibidos
    // console.log('🔍 DEBUG MarkerService.createMarker - Parámetros recibidos:', {
    //   targetId: target._id || target.id,
    //   isInitialSelection,
    //   preloadedStopTime,
    //   preloadedStopTimeType: typeof preloadedStopTime,
    //   preloadedStopTimeLength: preloadedStopTime?.length,
    //   hasTargetsService: !!targetsService
    // });

    // CANCELAR PROCESOS ANTERIORES INMEDIATAMENTE
    const targetId = target._id || target.id;
    // console.log('🎯 Creando marcador para target:', targetId, 'isInitialSelection:', isInitialSelection);
    
    // VALIDACIÓN CRÍTICA: Si ya estamos procesando el mismo target, no crear duplicados
    if (this.currentTargetId === targetId) {
    //   console.log('⚠️ PREVENCIÓN DUPLICADOS: Ya hay un marcador para este target:', targetId);
    //   console.log('⚠️ Cancelando creación de marcador duplicado');
      return null; // Evitar crear marcador duplicado
    }
    
    // VERIFICACIÓN ADICIONAL: Asegurar que no hay marcadores residuales en el mapa
    if (provider === 'mapbox' && map) {
      // Para Mapbox, verificar si hay marcadores existentes y removerlos
      const existingMarkers = map._markers || [];
      if (existingMarkers.length > 0) {
        // console.log('⚠️ Detectados', existingMarkers.length, 'marcadores residuales en Mapbox, limpiando...');
        existingMarkers.forEach((marker: any) => {
          if (marker && marker.remove) {
            marker.remove();
          }
        });
      }
    }
    
    // Si es un target diferente, cancelar todo lo anterior
    if (this.currentTargetId && this.currentTargetId !== targetId) {
    //   console.log('🛑 Cancelando procesos del target anterior:', this.currentTargetId);
      this.cancelAllProcesses();
      
      // Para Mapbox, también detener cualquier animación de flyTo en curso
      if (provider === 'mapbox' && map) {
        // console.log('🛑 Deteniendo animaciones Mapbox en curso');
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
    
    // Obtener estado de ignición desde múltiples fuentes posibles
    const ignitionStatus = this.getIgnitionStatus(target);

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
            // console.log('📅 Fecha de última ubicación extraída:', lastLocationDate, 'de campo:', timestampField);
          }
        } catch (error) {
          console.warn('Error formateando fecha de última ubicación:', error);
        }
      } else {
        // console.log('🔍 Campos disponibles en geolocation:', Object.keys(geolocation));
      }
    }

    // CENTRAR EL MAPA CON LOGS DETALLADOS PARA DEBUG
    // console.log('🎯 DEBUG CENTRADO: Creando marcador para target:', target._id);
    // console.log('🎯 DEBUG CENTRADO: Coordenadas que se usarán para centrar:', { lat: lat.toFixed(6), lng: lng.toFixed(6) });
    // console.log('🎯 DEBUG CENTRADO: Target completo:', { 
    //   _id: target._id, 
    //   name: target.name,
    //   traccarGeolocation: target.traccarInfo?.geolocation,
    //   latitude: target.traccarInfo?.geolocation?.latitude,
    //   longitude: target.traccarInfo?.geolocation?.longitude
    // });
    
    const MapUtils = (await import('./map.helper')).MapUtils;
    
    // VERIFICACIONES CRÍTICAS ANTES DE CENTRAR
    if (isNaN(lat) || isNaN(lng)) {
      console.error('❌ ERROR CENTRADO: Coordenadas inválidas para centrar:', { lat, lng });
      return;
    }
    
    // VERIFICACIÓN ADICIONAL: Asegurar que el target actual siga siendo el correcto
    const currentTargetIdToCheck = target._id || target.id; 
    if (this.currentTargetId && this.currentTargetId !== currentTargetIdToCheck) {
    //   console.log('🛑 CENTRADO CANCELADO: Target cambió durante creación del marcador');
    //   console.log('🛑 Target esperado:', this.currentTargetId);
    //   console.log('🛑 Target recibido:', currentTargetIdToCheck);
      return;
    }
    
    // RETRASAR LIGERAMENTE EL CENTRADO PARA ASEGURAR SINCRONIZACIÓN
    setTimeout(() => {
      // Verificar una vez más antes de centrar
      if (this.currentTargetId && this.currentTargetId !== currentTargetIdToCheck) {
        // console.log('🛑 CENTRADO CANCELADO EN TIMEOUT: Target cambió');
        return;
      }
      
      // console.log('🎯 EJECUTANDO CENTRADO del mapa en:', { lat: lat.toFixed(6), lng: lng.toFixed(6) });
      MapUtils.recenterMapIfOutOfView(map, provider, lat, lng);
      // console.log('✅ CENTRADO COMPLETADO para target:', target._id);
    }, 10); // Delay mínimo de 10ms para asegurar sincronización

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
        width: 320,
        ignitionStatus,
        target
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
        width: 280,
        ignitionStatus,
        target
      });

      const popup = new mapboxgl.Popup({ 
        closeButton: false, 
        closeOnClick: false,
        closeOnMove: false,
        maxWidth: '310px',
        offset: [0, -15],
        anchor: 'bottom' // Forzar que el popup siempre aparezca ARRIBA del marcador
      }).setHTML(popupHtml);

      marker.setPopup(popup);

      // Agregar marcador y abrir popup inmediatamente
      marker.addTo(map);
      marker.togglePopup();
      
      // Verificar si el marcador está visible y centrarlo si no lo está (solo para Mapbox)
      this.centerMapboxMarkerIfOutOfView(map, lng, lat);
    }

    // AGREGAR INMEDIATAMENTE LA SECCIÓN DEL MOTOR después de crear el popup
    setTimeout(() => {
      // console.log('🔋 DEBUG: Iniciando timeout para agregar sección del motor inmediatamente');
      // console.log('🔋 DEBUG: ignitionStatus a agregar:', ignitionStatus);
      const popupElement = document.querySelector('#custom-info-window') as HTMLElement;
      if (popupElement) {
        // console.log('🔋 DEBUG: popupElement encontrado');
        // Agregar la sección del motor SIEMPRE (si aplica) en la sección de detalles
        const contentDiv = popupElement.querySelector('#popup-content');
        if (contentDiv) {
          // console.log('🔋 DEBUG: contentDiv encontrado');
          const detailsSection = contentDiv.querySelector('#details-section') || contentDiv;
          // console.log('🔋 DEBUG: detailsSection encontrado:', detailsSection ? 'sí' : 'no');
          PopupBuilder.addOrUpdateIgnitionSection(detailsSection, ignitionStatus);
        }
        
        // Mostrar skeleton SOLO si NO hay tiempo precargado Y la velocidad es 0
        if (!preloadedStopTime && speedKmh === 0) {
          // console.log('✅ Popup element encontrado, mostrando skeleton');
          PopupBuilder.addStopTimeSkeletonWithAnimation(popupElement, speedKmh);
        }
      } else {
        // console.log('🔋 DEBUG: popupElement NO encontrado');
        // console.log('⚠️ No se encontró popup element, reintentando en 200ms...');
        // Reintentar una vez más con delay mayor
        setTimeout(() => {
          const retryPopupElement = document.querySelector('#custom-info-window') as HTMLElement;
          if (retryPopupElement) {
            // Agregar la sección del motor en el reintento
            const retryContentDiv = retryPopupElement.querySelector('#popup-content');
            if (retryContentDiv) {
              const retryDetailsSection = retryContentDiv.querySelector('#details-section') || retryContentDiv;
              PopupBuilder.addOrUpdateIgnitionSection(retryDetailsSection, ignitionStatus);
            }
            
            if (!preloadedStopTime && speedKmh === 0) {
              // console.log('✅ Popup element encontrado en reintento, mostrando skeleton');
              PopupBuilder.addStopTimeSkeletonWithAnimation(retryPopupElement, speedKmh);
            }
          } else {
            // console.log('❌ No se pudo encontrar popup element después de reintento');
          }
        }, 200);
      }
    }, 150); // Delay mínimo para que el popup se establezca

    // Paso 4: Consultar tiempo de parada en segundo plano - USAR PRELOADED SI EXISTE
    let stopTimePromise: Promise<string | undefined>;
    
    // Si hay tiempo de parada precargado, usarlo directamente
    if (preloadedStopTime) {
      // console.log('⚡ Usando tiempo de parada PRECARGADO:', preloadedStopTime);
      stopTimePromise = Promise.resolve(preloadedStopTime);
    } else {
      // console.log('🔄 No hay tiempo precargado, consultando desde cero...');
    //   console.log('📋 Target info:', {
    //     mongoId: target._id || target.id,
    //     api_device_id: target.api_device_id,
    //     traccar_device_id: target.traccar_device_id,
    //     device_id: target.device_id,
    //     traccarInfoId: target.traccarInfo?.id,
    //     hasTargetsService: !!targetsService
    //   });
      
      // Priorizar api_device_id (Traccar ID) sobre MongoDB _id, añadiendo traccarInfo.id como fallback
      const deviceId = target.api_device_id || target.traccar_device_id || target.device_id || target.deviceId || target.traccarInfo?.id?.toString();
      
      if (targetsService && deviceId) {
        const deviceIdSource = target.api_device_id ? 'api_device_id' : 
                              target.traccar_device_id ? 'traccar_device_id' : 
                              target.device_id ? 'device_id' : 
                              target.deviceId ? 'deviceId' : 'traccarInfo.id';
        // console.log('✅ Device ID seleccionado:', deviceId, '(fuente:', deviceIdSource, ')');
        // console.log('✅ Enviando solicitud tiempo de parada para device:', deviceId);
        stopTimePromise = this.loadStopTimeInBackground(deviceId, targetsService);
      } else {
        // console.log('❌ FALLO: No se puede consultar tiempo de parada');
        // console.log('❌ targetsService:', !!targetsService);
        // console.log('❌ deviceId encontrado:', deviceId);
        // console.log('❌ target completo:', target);
        stopTimePromise = Promise.resolve(undefined);
      }
    }

    // Cuando esté listo el tiempo de parada, reemplazar skeleton o agregarlo directamente
    const stopTime = await stopTimePromise;
    
    // Verificar nuevamente que el target no haya cambiado
    const currentTargetId = target._id || target.id;
    if (this.currentTargetId !== currentTargetId) {
      // console.log('🛑 Target cambió antes de procesar tiempo de parada, cancelando');
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
              // console.log('⚡ Agregando tiempo de parada PRECARGADO directamente:', stopTime);
              PopupBuilder.addStopTimeWithAnimation(popupElement, stopTime, speedKmh, ignitionStatus);
            } else {
              // console.log('⏱️ Reemplazando skeleton con tiempo de parada consultado:', stopTime);
              PopupBuilder.replaceSkeletonWithStopTime(popupElement, stopTime, speedKmh, ignitionStatus);
            }
          } else {
            if (preloadedStopTime) {
              // console.log('⚠️ Tiempo precargado era inválido, no mostrar nada');
            } else {
              // console.log('🚗 Removiendo skeleton - vehículo en movimiento o sin datos');
              PopupBuilder.replaceSkeletonWithStopTime(popupElement, undefined, speedKmh, ignitionStatus);
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
      // console.log('🚀 INICIANDO consulta tiempo de parada para device:', deviceId);
      // console.log('🚀 targetsService methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(targetsService)));
      
      // Verificar si el proceso ha sido cancelado
      if (this.abortController?.signal.aborted) {
        // console.log('🛑 Proceso cancelado antes de cargar tiempo de parada');
        return undefined;
      }
      
      // Validar que el método existe
      if (!targetsService.getStopTime) {
        // console.log('❌ ERROR: método getStopTime no existe en targetsService');
        return undefined;
      }
      
      // console.log('📡 ENVIANDO solicitud getStopTime...');
      const stopTimeResponse = await targetsService.getStopTime(deviceId);
      // console.log('📨 RESPUESTA RECIBIDA de getStopTime');
      
      // Verificar nuevamente después de la operación async
      if (this.abortController?.signal.aborted) {
        // console.log('🛑 Proceso cancelado después de cargar tiempo de parada');
        return undefined;
      }
      
      // console.log('📊 Respuesta tiempo de parada completa:', stopTimeResponse);
      
      if (!stopTimeResponse.isMoving && stopTimeResponse.text && !stopTimeResponse.error) {
        // console.log('✅ Tiempo de parada obtenido:', stopTimeResponse.text);
        return stopTimeResponse.text;
      } else if (stopTimeResponse.isMoving) {
        // console.log('🚗 Vehículo en movimiento');
        return undefined; // No mostrar tiempo de parada si está en movimiento
      } else if (stopTimeResponse.error) {
        // console.log('❌ Error en respuesta:', stopTimeResponse.error);
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
    // console.log('🔄 MarkerService.updatePosition LLAMADO para target:', targetId);

    // Verificar que estamos actualizando el target correcto
    if (this.currentTargetId !== targetId) {
      // console.log('🛑 Cancelando actualización - target cambió de', targetId, 'a', this.currentTargetId);
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
    
    // console.log('📍 updatePosition: Coordenadas actuales:', { 
    //   lat: lat.toFixed(6), 
    //   lng: lng.toFixed(6),
    //   speedKmh: currentSpeedKmh,
    //   lastPosition: lastPosition ? `${lastPosition.lat.toFixed(6)}, ${lastPosition.lng.toFixed(6)}` : 'null'
    // });
    
    // Verificar si necesitamos animación suave basada en la distancia
    const shouldAnimate = lastPosition && MarkerService.shouldUseAnimation(lastPosition, { lat, lng });
    
    if (shouldAnimate && lastPosition) {
      console.log('🎬 Iniciando animación suave del marcador');
      await MarkerService.animateMarkerToPosition({
        map,
        provider,
        marker,
        fromLat: lastPosition.lat,
        fromLng: lastPosition.lng,
        toLat: lat,
        toLng: lng,
        target,
        speedKmh: currentSpeedKmh,
        vehicleTypeGetter,
        targetsService,
        onUpdate
      });
    } else {
      // Actualización directa para movimientos pequeños o primera posición
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
    // console.log('🔧 updateMarkerDirectly EJECUTANDO para target:', targetId, 'en coordenadas:', lat.toFixed(6), lng.toFixed(6));    
    
    if (this.currentTargetId !== targetId) {
      // console.log('🛑 Cancelando updateMarkerDirectly - target cambió');
      return;
    }
    
    const finalSpeedKmh = speedKmh !== undefined ? speedKmh : (() => {
      const speedKnots = target?.traccarInfo?.geolocation?.speed || 0;
      return Math.round(speedKnots * 1.852);
    })();

    const status = target?.traccarInfo?.status || 'desconocido';
    
    // Obtener estado de ignición desde múltiples fuentes posibles
    const ignitionStatus = this.getIgnitionStatus(target);
    // console.log('🔋 DEBUG UPDATE: ignitionStatus obtenido:', ignitionStatus, 'para target:', target._id);

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

    // Obtener tiempo de parada actualizado en cada polling
    let stopTime: string | undefined = undefined;
    const deviceImei = target.device_imei || target.imei;
    if (targetsService && deviceImei) {
      try {
        console.log('🔄 Actualizando tiempo de parada para device:', deviceImei, '(estado:', status + ')');
        const stopTimeResponse = await targetsService.getStopTime(deviceImei);
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
        console.warn('❌ Error obteniendo tiempo de parada en actualización:', error);
      }
    } else {
      console.log('⚠️ No se puede obtener tiempo de parada - targetsService:', !!targetsService, 'api_device_id:', target.api_device_id);
    }

    // Actualizar posición y popup con los datos obtenidos
    if (provider === 'google') {
      marker.setPosition(new google.maps.LatLng(lat, lng));
      const infoWindow = marker.infoWindow;
      if (infoWindow && infoWindow.getMap()) {
        // Obtener el elemento actual del popup
        const popupElement = infoWindow.getContent();
        
        if (popupElement && popupElement.querySelector) {
          // Actualizar elementos específicos sin regenerar HTML
          PopupBuilder.updatePopupElementsDirectly(popupElement, {
            title: target.name,
            speedKmh: finalSpeedKmh,
            status,
            stopTime,
            ignitionStatus
          });
        } else {
          // Fallback: regenerar HTML si no se puede actualizar directamente
          const newHtml = PopupBuilder.buildPopupHtml({
            title: target.name,
            vehicleType: vehicleTypeGetter?.(target.model),
            speedKmh: finalSpeedKmh,
            status,
            stopTime,
            lastLocationDate,
            width: 320,
            ignitionStatus,
            target
          });
          
          const preservedHtml = PopupBuilder.preserveMoreInfoState(popupElement, newHtml);
          infoWindow.setContent(preservedHtml);
          
          setTimeout(() => {
            PopupBuilder.showMoreInfoButtonIfNeeded(infoWindow.getContent());
          }, 10);
        }
      }
    } else {
      // Mapbox: actualizar posición del marcador
      marker.setLngLat([lng, lat]);
      
      // Verificar si el marcador está visible y centrarlo si no lo está
      this.centerMapboxMarkerIfOutOfView(map, lng, lat);
      
      const popup = marker.getPopup();
      if (popup && popup.isOpen()) {
        // Obtener el elemento actual del popup
        const popupElement = popup._content;
        
        if (popupElement && popupElement.querySelector) {
          // Actualizar elementos específicos sin regenerar HTML
          PopupBuilder.updatePopupElementsDirectly(popupElement, {
            title: target.name,
            speedKmh: finalSpeedKmh,
            status,
            stopTime,
            ignitionStatus
          });
        } else {
          // Fallback: regenerar HTML si no se puede actualizar directamente
          const newHtml = PopupBuilder.buildPopupHtml({
            title: target.name,
            vehicleType: vehicleTypeGetter?.(target.model),
            speedKmh: finalSpeedKmh,
            status,
            stopTime,
            lastLocationDate,
            width: 280,
            ignitionStatus,
            target
          });
          
          const preservedHtml = PopupBuilder.preserveMoreInfoState(popupElement, newHtml);
          popup.setHTML(preservedHtml);
          
          setTimeout(() => {
            const popupElement = popup._content;
            if (popupElement) {
              PopupBuilder.showMoreInfoButtonIfNeeded(popupElement);
            }
          }, 10);
        }
      }
    }

    // console.log('✅ updateMarkerDirectly COMPLETADO - Marcador actualizado en:', lat.toFixed(6), lng.toFixed(6), 'Velocidad:', finalSpeedKmh, 'km/h');
    onUpdate({ lat, lng }, finalSpeedKmh);
  }

  static removeMarker(marker: any, provider: 'google' | 'mapbox') {
    // console.log('🗑️ Removiendo marcador:', provider);
    
    if (provider === 'google') {
      // Cerrar InfoWindow si está abierto
      if (marker.infoWindow) {
        marker.infoWindow.close();
      }
      marker.setMap(null);
      // console.log('✅ Marcador Google Maps removido');
    } else {
      // Mapbox: cerrar popup si está abierto y remover marcador
      const popup = marker.getPopup();
      if (popup && popup.isOpen()) {
        popup.remove();
        // console.log('🗑️ Popup Mapbox cerrado');
      }
      
      // Verificar si el marcador está en el mapa antes de removerlo
      if (marker._map) {
      marker.remove();
        // console.log('✅ Marcador Mapbox removido del mapa');
        
        // Verificar que efectivamente se removió
        if (!marker._map) {
          // console.log('✅ Confirmado: marcador Mapbox completamente removido');
        } else {
          // console.warn('⚠️ Marcador Mapbox puede no haberse removido completamente');
        }
      } else {
        // console.log('ℹ️ Marcador Mapbox ya no estaba en el mapa');
      }
    }
  }

  static destroyMap(map: any, provider: 'google' | 'mapbox') {
    // console.log('🗑️ Destruyendo mapa:', provider);
    
    // Para Mapbox, cancelar animaciones específicas antes de destruir
    if (provider === 'mapbox' && map) {
      // console.log('🛑 Cancelando animaciones Mapbox antes de destruir');
      map.stop();
      
      // Remover el mapa completamente
      map.remove?.();
      // console.log('✅ Mapa Mapbox destruido');
    } else if (provider === 'google') {
      // console.log('✅ Mapa Google Maps limpiado');
    }
  }

  static cancelTargetProcesses(targetId: string) {
    // console.log('🛑 MarkerService cancelando procesos para target:', targetId);
    
    // Cancelar movimientos si el target coincide
    if (this.currentTargetId === targetId) {
      this.currentTargetId = null;
        // console.log('✅ Procesos del target', targetId, 'cancelados en MarkerService');
    }
    
    // Cancelar procesos activos
    this.cancelAllProcesses();
  }

  static resetService() {
    // console.log('🧹 Reseteando MarkerService completamente');
    
    // Cancelar todos los procesos
    this.cancelAllProcesses();
    
    // Resetear el target actual
    this.currentTargetId = null;
    
    // console.log('✅ MarkerService reseteado completamente');
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
        // console.log('📍 Marcador fuera de vista, centrando mapa en:', lat.toFixed(6), lng.toFixed(6));
        
        // Centrar el mapa sin animación suave para evitar conflictos
        map.jumpTo({
          center: [lng, lat],
          zoom: Math.max(map.getZoom(), 14) // Mantener zoom actual o usar mínimo 14
        });
      } else {
        //  console.log('👁️ Marcador visible en viewport actual');
      }
    } catch (error) {
      console.warn('Error verificando visibilidad del marcador:', error);
    }
  }

  // Método auxiliar para obtener el estado de ignición desde múltiples fuentes (optimizado)
  private static getIgnitionStatus(target: any): 'on' | 'off' | null {
    // DEBUG: Agregar logs detallados para debugging
    // console.log('🔋 DEBUG getIgnitionStatus para target:', target._id || target.id);
    // console.log('🔋 DEBUG ignition_sensor del target:', target?.ignition_sensor);
    // console.log('🔋 DEBUG target completo (claves):', target ? Object.keys(target) : 'target es null/undefined');
    
    // BUSCAR ignition_sensor en el target principal o en originalTarget
    let ignitionSensor = target?.ignition_sensor;
    if (!ignitionSensor && target?.originalTarget) {
      // console.log('🔋 DEBUG: Buscando ignition_sensor en originalTarget');
      ignitionSensor = target.originalTarget.ignition_sensor;
      // console.log('🔋 DEBUG: ignition_sensor en originalTarget:', ignitionSensor);
    }
    
    // VALIDACIÓN CRÍTICA: Solo mostrar información de ignición si el sensor está configurado en 'yes'
    if (ignitionSensor !== 'yes') {
      // console.log('🔋 DEBUG: ignition_sensor no es "yes", retornando null. Valor actual:', ignitionSensor);
      return null;
    }
    
    try {
      // Búsqueda rápida en múltiples ubicaciones posibles
      const ignitionSources = [
        target?.traccarInfo?.geolocation?.attributes?.ignition,
        target?.traccarInfo?.attributes?.ignition,
        target?.traccarInfo?.geolocation?.ignition
      ];
      
      // console.log('🔋 DEBUG ignitionSources:', ignitionSources);
      
      // Verificar si encontramos un valor explícito de ignición
      for (const ignitionValue of ignitionSources) {
        if (ignitionValue !== undefined && ignitionValue !== null) {
          const result = ignitionValue ? 'on' : 'off';  
          // console.log('🔋 DEBUG: Encontrado valor explícito de ignición:', ignitionValue, '→', result);
          return result;
        }
      }

      // Si no hay datos explícitos de ignición, inferir por velocidad
      const speed = target?.traccarInfo?.geolocation?.speed || 0;
      const result = speed > 0 ? 'on' : 'off';  
      // console.log('🔋 DEBUG: Infiriendo por velocidad:', speed, '→', result);
      return result;

    } catch (error) {
      console.warn('⚠️ Error obteniendo estado de ignición:', error);
      return null;
    }
  }

  // Determinar si usar animación basado en la distancia del movimiento
  private static shouldUseAnimation(fromPos: { lat: number; lng: number }, toPos: { lat: number; lng: number }): boolean {
    const latDiff = Math.abs(toPos.lat - fromPos.lat);
    const lngDiff = Math.abs(toPos.lng - fromPos.lng);
    
    // Calcular distancia aproximada en metros usando la fórmula de Haversine simplificada
    const avgLat = (fromPos.lat + toPos.lat) / 2;
    const latDistanceM = latDiff * 111000; // 1 grado lat ≈ 111km
    const lngDistanceM = lngDiff * 111000 * Math.cos(avgLat * Math.PI / 180);
    const totalDistanceM = Math.sqrt(latDistanceM * latDistanceM + lngDistanceM * lngDistanceM);
    
    // Animar si el movimiento es mayor a 10 metros pero menor a 1km
    const MIN_ANIMATION_DISTANCE = 10; // metros
    const MAX_ANIMATION_DISTANCE = 1000; // metros
    
    console.log(`📏 Distancia calculada: ${totalDistanceM.toFixed(1)}m - Animar: ${totalDistanceM >= MIN_ANIMATION_DISTANCE && totalDistanceM <= MAX_ANIMATION_DISTANCE}`);
    
    return totalDistanceM >= MIN_ANIMATION_DISTANCE && totalDistanceM <= MAX_ANIMATION_DISTANCE;
  }

  // Animar el marcador suavemente a través de posiciones intermedias
  private static async animateMarkerToPosition({
    map,
    provider,
    marker,
    fromLat,
    fromLng,
    toLat,
    toLng,
    target,
    speedKmh,
    vehicleTypeGetter,
    targetsService,
    onUpdate
  }: {
    map: any;
    provider: 'google' | 'mapbox';
    marker: any;
    fromLat: number;
    fromLng: number;
    toLat: number;
    toLng: number;
    target: any;
    speedKmh?: number;
    vehicleTypeGetter?: (id: string) => string;
    targetsService?: any;
    onUpdate: (pos: { lat: number; lng: number }, speed: number) => void;
  }): Promise<void> {
    const targetId = target._id || target.id;
    
    // Verificar que el target sigue siendo el correcto
    if (MarkerService.currentTargetId !== targetId) {
      console.log('🛑 Animación cancelada - target cambió');
      return;
    }

    const steps = 12; // Número de pasos intermedios (más pasos = más suave)
    const duration = 4000; // 4 segundos total (más lento)
    const stepDuration = duration / steps;
    
    console.log(`🎬 Animando desde [${fromLat.toFixed(6)}, ${fromLng.toFixed(6)}] hasta [${toLat.toFixed(6)}, ${toLng.toFixed(6)}] en ${steps} pasos durante ${duration/1000}s`);

    for (let i = 1; i <= steps; i++) {
      // Verificar si el target cambió durante la animación
      if (MarkerService.currentTargetId !== targetId) {
        console.log('🛑 Animación interrumpida - target cambió durante animación');
        return;
      }

      // Usar easing suave (ease-in-out) para hacer la animación más natural
      const progress = i / steps;
      const easedProgress = progress < 0.5 
        ? 2 * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      const easedLat = fromLat + (toLat - fromLat) * easedProgress;
      const easedLng = fromLng + (toLng - fromLng) * easedProgress;

      console.log(`📍 Paso ${i}/${steps}: [${easedLat.toFixed(6)}, ${easedLng.toFixed(6)}] (progreso: ${(easedProgress * 100).toFixed(1)}%)`);

      // Actualizar posición del marcador
      if (provider === 'google') {
        marker.setPosition(new google.maps.LatLng(easedLat, easedLng));
      } else if (provider === 'mapbox') {
        marker.setLngLat([easedLng, easedLat]);
      }

      // Actualizar callback en el último paso
      if (i === steps) {
        onUpdate({ lat: toLat, lng: toLng }, speedKmh || 0);
        
        // Actualizar popup en la posición final
        await MarkerService.updateMarkerPopup({
          provider,
          marker,
          target,
          speedKmh: speedKmh || 0,
          vehicleTypeGetter,
          targetsService
        });
      }

      // Esperar antes del siguiente paso (excepto en el último)
      if (i < steps) {
        await MarkerService.sleep(stepDuration);
      }
    }

    console.log('✅ Animación completada');
  }

  // Actualizar solo el popup del marcador
  private static async updateMarkerPopup({
    provider,
    marker,
    target,
    speedKmh,
    vehicleTypeGetter,
    targetsService
  }: {
    provider: 'google' | 'mapbox';
    marker: any;
    target: any;
    speedKmh: number;
    vehicleTypeGetter?: (id: string) => string;
    targetsService?: any;
  }): Promise<void> {
    const status = target?.traccarInfo?.status || 'desconocido';
    const ignitionStatus = MarkerService.getIgnitionStatus(target);

    // Extraer fecha de última ubicación para dispositivos offline
    let lastLocationDate: string | undefined = undefined;
    if (status === 'offline' && target?.traccarInfo?.geolocation) {
      const geolocation = target.traccarInfo.geolocation;
      const timestampField = geolocation.serverTime || geolocation.fixTime || 
                           geolocation.deviceTime || geolocation.timestamp ||
                           geolocation.time || geolocation.lastUpdate;
      
      if (timestampField) {
        try {
          const date = new Date(timestampField);
          if (!isNaN(date.getTime())) {
            lastLocationDate = date.toLocaleString('es-ES', {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit'
            });
          }
        } catch (error) {
          console.warn('Error formateando fecha:', error);
        }
      }
    }

    // Obtener tiempo de parada
    let stopTime: string | undefined = undefined;
    const deviceImei = target.device_imei || target.imei;
    if (targetsService && deviceImei && status === 'online') {
      try {
        const stopTimeResponse = await targetsService.getStopTime(deviceImei);
        if (!stopTimeResponse.isMoving && stopTimeResponse.text && !stopTimeResponse.error) {
          stopTime = stopTimeResponse.text;
        }
      } catch (error) {
        console.warn('Error obteniendo tiempo de parada:', error);
      }
    }

    // Actualizar popup
    if (provider === 'google') {
      const infoWindow = marker.infoWindow;
      if (infoWindow) {
        const newHtml = PopupBuilder.buildPopupHtml({
          title: target.name,
          vehicleType: vehicleTypeGetter?.(target.model),
          speedKmh,
          status,
          stopTime,
          lastLocationDate,
          width: 320,
          ignitionStatus,
          target
        });
        infoWindow.setContent(newHtml);
      }
    } else if (provider === 'mapbox') {
      const popup = marker.getPopup();
      if (popup) {
        const newHtml = PopupBuilder.buildPopupHtml({
          title: target.name,
          vehicleType: vehicleTypeGetter?.(target.model),
          speedKmh,
          status,
          stopTime,
          lastLocationDate,
          width: 280,
          ignitionStatus,
          target
        });
        popup.setHTML(newHtml);
      }
    }
  }

  // Función helper para esperar
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 
