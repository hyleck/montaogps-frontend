export type MonitorSessionStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'completed_with_errors'
  | 'failed';

export type OfflineCategory =
  | 'vigente'
  | 'estado_inicial'
  | 'suspendido'
  | 'expirado';

export interface MonitorSession {
  _id: string;
  status: MonitorSessionStatus;
  progress: number;
  totalUsers: number;
  processedUsers: number;
  totalDevices: number;
  offlineDevices: number;
  errorsCount: number;
  errorSamples?: string[];
  message?: string;
  error?: string;
  currentActivity?: {
    userId?: string;
    userName?: string;
    deviceName?: string;
  } | null;
  createdAt?: string;
  completedAt?: string;
}

export interface MonitorRecord {
  _id: string;
  userId: string;
  userName: string;
  userPhone?: string;
  route: Array<{ id: string; fullName: string }>;
  devices: any[];
  offlineDevices: any[];
}

export interface OfflineDeviceRecord {
  _id: string;
  sessionId: string;
  userId: string;
  userName: string;
  userPhone?: string;
  deviceId: string;
  category: OfflineCategory;
  eligibleForReactivation: boolean;
  deviceData: any;
  createdAt?: string;
}

export interface SegmentationSummary {
  vigente: number;
  estado_inicial: number;
  suspendido: number;
  expirado: number;
}

export type FunnelStatus =
  | 'queued'
  | 'detecting'
  | 'activating'
  | 'waiting'
  | 'rechecking'
  | 'completed'
  | 'failed';

export interface FunnelSession {
  _id: string;
  scanSessionId: string;
  status: FunnelStatus;
  phase: number;
  waitHours: number;
  totalDevices: number;
  activationsTriggered: number;
  devicesRecovered: number;
  devicesPersistent: number;
  devicesErrored: number;
  recheckScheduledAt?: string;
  campaignListId?: string;
  message?: string;
  error?: string;
  createdAt?: string;
}

export interface FunnelDevice {
  _id: string;
  userId: string;
  userName: string;
  userPhone?: string;
  conversationId?: number;
  deviceId: string;
  deviceName: string;
  imei?: string;
  simCompany?: string;
  activationTriggered: boolean;
  activationResult?: string;
  statusAfterRecheck: 'pending' | 'online' | 'offline' | 'error';
  finalStatus: 'pending' | 'recovered' | 'persistent' | 'error';
  recheckError?: string;
  contacted: boolean;
  contactResponse?: string;
  contactedBy?: string;
  contactedAt?: string;
}

export interface PagedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface SegmentationResponse
  extends PagedResponse<OfflineDeviceRecord> {
  summary: SegmentationSummary;
  session: MonitorSession | null;
}
