export interface DeviceStatusResponse {
  deviceId: string;
  timestamp: string;
  status: 'stopped' | 'moving';
  isCurrentlyStopped: boolean;
  message: string;
  stoppedSince?: string;
  stoppedDuration?: {
    hours: number;
    minutes: number;
    seconds: number;
    totalMinutes: number;
    formatted: string;
  };
  lastMovingTime?: string;
} 