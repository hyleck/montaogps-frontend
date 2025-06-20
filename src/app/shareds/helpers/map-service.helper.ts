// utils/marker-service.ts
import mapboxgl from 'mapbox-gl';
import { PopupBuilder } from './map-popup.helper';

export class MarkerService {
  static createMarker(map: any, provider: 'google' | 'mapbox', lat: number, lng: number, target: any, vehicleTypeGetter?: (id: string) => string) {
    const speedKnots = target?.traccarInfo?.geolocation?.speed || 0;
    const speedKmh = Math.round(speedKnots * 1.852);
    const status = target?.traccarInfo?.status || 'desconocido';
    const vehicleType = vehicleTypeGetter?.(target.model);
    const title = target.name;

    if (provider === 'google') {
      const marker = new google.maps.Marker({
        position: { lat, lng },
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: status === 'online' ? '#4CAF50' : '#F44336',
          fillOpacity: 0.8,
          strokeColor: '#FFFFFF',
          strokeWeight: 2
        }
      });

      const infoWindow = new google.maps.InfoWindow({
        content: PopupBuilder.buildPopupHtml({ title, vehicleType, speedKmh, status }),
        disableAutoPan: false,
        headerDisabled: true
      });

      (marker as any).infoWindow = infoWindow;
      infoWindow.open(map, marker);

      marker.addListener('click', () => infoWindow.open(map, marker));

      return marker;
    } else {
      const el = document.createElement('div');
      el.style.width = '20px';
      el.style.height = '20px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = status === 'online' ? '#4CAF50' : '#F44336';
      el.style.border = '2px solid #FFF';

      const marker = new mapboxgl.Marker(el).setLngLat([lng, lat]).addTo(map);

      const popup = new mapboxgl.Popup({ 
        closeButton: false, 
        closeOnClick: false,
        closeOnMove: false 
      }).setHTML(PopupBuilder.buildPopupHtml({ title, vehicleType, speedKmh, status, width: 215 }));

      marker.setPopup(popup);
      marker.togglePopup();
      return marker;
    }
  }

  static updatePosition({
    map,
    provider,
    marker,
    target,
    lastPosition,
    vehicleTypeGetter,
    onUpdate
  }: {
    map: any;
    provider: 'google' | 'mapbox';
    marker: any;
    target: any;
    lastPosition: { lat: number; lng: number } | null;
    vehicleTypeGetter?: (id: string) => string;
    onUpdate: (pos: { lat: number; lng: number }, speed: number) => void;
  }) {
    const lat = target?.traccarInfo?.geolocation?.latitude;
    const lng = target?.traccarInfo?.geolocation?.longitude;
    if (typeof lat !== 'number' || typeof lng !== 'number') return;

    const speedKnots = target?.traccarInfo?.geolocation?.speed || 0;
    const speedKmh = Math.round(speedKnots * 1.852);

    if (provider === 'google') {
      marker.setPosition(new google.maps.LatLng(lat, lng));
      const infoWindow = marker.infoWindow;
      if (infoWindow) {
        const html = PopupBuilder.buildPopupHtml({
          title: target.name,
          vehicleType: vehicleTypeGetter?.(target.model),
          speedKmh,
          status: target?.traccarInfo?.status || 'desconocido'
        });
        infoWindow.setContent(html);
      }
    } else {
      marker.setLngLat([lng, lat]);
      const popup = marker.getPopup();
      if (popup) {
        const html = PopupBuilder.buildPopupHtml({
          title: target.name,
          vehicleType: vehicleTypeGetter?.(target.model),
          speedKmh,
          status: target?.traccarInfo?.status || 'desconocido',
          width: 215
        });
        popup.setHTML(html);
      }
    }

    onUpdate({ lat, lng }, speedKmh);
  }

  static removeMarker(marker: any, provider: 'google' | 'mapbox') {
    if (provider === 'google') {
      marker.setMap(null);
    } else {
      marker.remove();
    }
  }

  static destroyMap(map: any, provider: 'google' | 'mapbox') {
    if (provider === 'mapbox') {
      map.remove?.();
    }
  }
} 
