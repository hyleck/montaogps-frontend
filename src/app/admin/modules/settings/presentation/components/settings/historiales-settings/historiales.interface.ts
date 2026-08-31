// Interfaces para el módulo de Historiales

// Dispositivo en la lista
export interface HistoryDevice {
  _id: string;
  name: string;
  device_imei: string;
  api_device_id: string;
  status: string;
  creator_id: string;
}

// Respuesta de GET /history/devices
export interface HistoryDevicesResponse {
  success: boolean;
  totalDevices: number;
  devices: HistoryDevice[];
}

// Body para POST /history/analyze
export interface AnalyzeHistoryRequest {
  fromDate: string;
  toDate: string;
  intervalHours: number;
}

// Resultado de análisis de un dispositivo
export interface DeviceAnalysisResult {
  deviceIndex: number;
  deviceName: string;
  deviceImei: string;
  totalPositions: number;
  success: boolean;
  processingTimeMs: number;
  error: string | null;
}

// Resumen del análisis masivo
export interface AnalysisSummary {
  totalDevices: number;
  totalDays: number;
  totalHours: number;
  expectedChunks: number;
  intervalHours: number;
  processingTimeMs: number;
  successfulDevices: number;
  failedDevices: number;
  totalPositionsFound: number;
}

// Respuesta de POST /history/analyze
export interface AnalyzeHistoryResponse {
  success: boolean;
  message: string;
  summary: AnalysisSummary;
  results: DeviceAnalysisResult[];
}

// Información del análisis individual
export interface IndividualAnalysisInfo {
  totalDays: number;
  totalHours: number;
  expectedChunks: number;
  intervalHours: number;
  processingTimeMs: number;
}

// Resultado del análisis individual
export interface IndividualAnalysisResult {
  totalPositions: number;
  success: boolean;
  error: string | null;
}

// Respuesta de GET /history/analyze/device/:deviceImei
export interface AnalyzeDeviceResponse {
  success: boolean;
  message: string;
  device: HistoryDevice;
  analysisInfo: IndividualAnalysisInfo;
  result: IndividualAnalysisResult;
}

// Query parameters para análisis individual
export interface AnalyzeDeviceParams {
  fromDate: string;
  toDate: string;
  intervalHours?: number;
}

// ========================
// INTERFACES DE PROGRESO
// ========================

// Progreso de un dispositivo individual
export interface DeviceProgress {
  deviceIndex: number;
  deviceName: string;
  deviceImei: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  currentBlock?: number;
  totalBlocks?: number;
  positionsFound?: number;
  error?: string;
}

// Progreso general del análisis
export interface AnalysisProgress {
  analysisId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  overallProgress: number;
  currentDeviceIndex: number;
  totalDevices: number;
  completedDevices: number;
  failedDevices: number;
  elapsedTimeMs: number;
  totalPositionsFound: number;
  currentMessage: string;
  deviceProgress: DeviceProgress[];
}

// Respuesta de GET /history/progress
export interface ProgressResponse {
  success: boolean;
  progress: AnalysisProgress;
}

// Respuesta de DELETE /history/cancel
export interface CancelResponse {
  success: boolean;
  message: string;
  analysisId?: string;
}

// ========================
// INTERFACES PARA DISPOSITIVO ACTUAL
// ========================

// Información del dispositivo actual en procesamiento
export interface CurrentDeviceInfo {
  deviceIndex: number;
  deviceName: string;
  deviceImei: string;
  status: 'processing' | 'completed' | 'failed' | 'pending';
  progress: number;
  progressPercentage: string;
  chunksProcessed: number;
  totalChunks: number;
  chunksInfo: string;
  positionsFound: number;
  processingTimeMs: number;
  processingTimeSeconds: number;
  estimatedTimeRemaining: number;
  error: string | null;
}

// Información del análisis general
export interface CurrentAnalysisInfo {
  analysisId: string;
  currentDeviceIndex: number;
  totalDevices: number;
  overallProgress: number;
  currentMessage: string;
  elapsedTimeMs: number;
  completedDevices: number;
  failedDevices: number;
  totalPositionsFound: number;
}

// Respuesta de GET /history/progress/current-device
export interface CurrentDeviceResponse {
  success: boolean;
  message: string;
  currentDevice: CurrentDeviceInfo;
  analysisInfo: CurrentAnalysisInfo;
}

export interface RetentionServerStatus {
  enabled: boolean;
  archiveReady: boolean;
  serverId: string | null;
  serverName: string | null;
  retentionDays: number;
  safeBefore: string | null;
  coverageMode: string | null;
  verificationVersion: number;
  verifiedSafeBefore: string | null;
  retentionVerifiedAt: string | null;
  deviceSetDigest: string | null;
  deviceCount: number;
  archiveCoverageFrom: string | null;
  archiveCoverageTo: string | null;
  lastSuccessFrom: string | null;
  lastSuccessTo: string | null;
  lastSuccessAt: string | null;
  reason: string | null;
}

export interface ArchiveRun {
  id: string;
  serverId: string | null;
  serverName: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  fromDate: string | null;
  toDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  totalDevices: number;
  completedDevices: number;
  failedDevices: number;
  totalPositionsFound: number;
  insertedPositions: number;
  retentionSafeBefore: string | null;
  retentionDeviceCount: number;
  retentionVerifiedPositionCount: number;
  error: string | null;
}

export interface ArchiveDashboardResponse {
  success: boolean;
  generatedAt: string;
  worker: {
    enabled: boolean;
    archiveSchedule: string;
    cleanupSchedule: string;
    timezone: string;
    startupRecovery: boolean;
    chunkHours: number;
    concurrency: number;
    retentionDays: number;
  };
  summary: {
    totalServers: number;
    protectedServers: number;
    blockedServers: number;
    runningRuns: number;
  };
  retention: {
    enabled: boolean;
    archiveReady: boolean;
    retentionDays: number;
    safeBefore: string | null;
    reason: string | null;
    servers: RetentionServerStatus[];
  };
  recentRuns: ArchiveRun[];
}

export interface TriggerArchiveResponse {
  success: boolean;
  accepted: boolean;
  message: string;
  servers?: Array<{ id: string; name: string }>;
}
