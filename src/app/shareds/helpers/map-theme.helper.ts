// utils/map-theme.ts
import { MapUtils } from './map.helper';

export class MapThemeService {
  static updateTheme(map: any, provider: 'google' | 'mapbox', theme: 'dark' | 'light', selectedTarget: any): void {
    if (!map) return;

    try {
      if (provider === 'google') {
        map.setOptions?.({ styles: theme === 'dark' ? MapUtils.googleDarkTheme() : [] });
      } else if (provider === 'mapbox') {
        const styleUrl = theme === 'dark' ? 'mapbox://styles/mapbox/dark-v10' : 'mapbox://styles/mapbox/light-v10';
        map.setStyle?.(styleUrl);
        // Ya no necesitamos restaurar marcadores
      }
    } catch (e) {
      console.error('Error actualizando tema:', e);
    }
  }
}
