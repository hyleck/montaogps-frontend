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