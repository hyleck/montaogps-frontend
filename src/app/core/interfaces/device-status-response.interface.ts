export interface DeviceStatusResponse {
  deviceId: string;
  status: 'online' | 'offline' | 'idle';
  lastUpdate: string;
  stopTime?: string; // Tiempo de parada en formato legible (ej: "2h 30m")
  stopTimeMinutes?: number; // Tiempo de parada en minutos
  lastPosition?: {
    latitude: number;
    longitude: number;
    timestamp: string;
  };
} 