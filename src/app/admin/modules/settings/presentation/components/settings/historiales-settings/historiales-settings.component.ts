import { Component, OnInit, OnDestroy } from '@angular/core';
import { interval, Subscription } from 'rxjs';
import { HistorialesService } from '@core/services/historiales.service';
import { MessageService, ConfirmationService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { 
  HistoryDevice, 
  AnalyzeHistoryRequest, 
  AnalyzeHistoryResponse,
  AnalysisProgress,
  DeviceProgress,
  CurrentDeviceInfo,
  CurrentAnalysisInfo,
  CurrentDeviceResponse
} from './historiales.interface';

@Component({
  selector: 'app-historiales-settings',
  standalone: false,
  templateUrl: './historiales-settings.component.html',
  styleUrl: './historiales-settings.component.css'
})
export class HistorialesSettingsComponent implements OnInit, OnDestroy {
  
  // Estado general
  loading = false;
  devices: HistoryDevice[] = [];
  
  // Formulario de análisis
  fromDate: Date = new Date();
  toDate: Date = new Date();
  intervalHours: number = 6;
  
  // Resultados del análisis
  analysisResults: AnalyzeHistoryResponse | null = null;
  showResults = false;
  
  // Estado de la operación
  analyzing = false;

  // ========================
  // VARIABLES DE PROGRESO
  // ========================
  currentProgress: AnalysisProgress | null = null;
  showProgress = false;
  progressSubscription: Subscription | null = null;
  currentAnalysisId: string | null = null;

  // ========================
  // VARIABLES DISPOSITIVO ACTUAL
  // ========================
  currentDeviceInfo: CurrentDeviceInfo | null = null;
  currentAnalysisInfo: CurrentAnalysisInfo | null = null;
  showCurrentDevice = false;
  currentDeviceSubscription: Subscription | null = null;
  
  // Opciones para dropdown de intervalos
  intervalOptions = [
    { label: '1 hora', value: 1 },
    { label: '3 horas', value: 3 },
    { label: '6 horas', value: 6 },
    { label: '12 horas', value: 12 },
    { label: '24 horas (1 día)', value: 24 },
    { label: '48 horas (2 días)', value: 48 },
    { label: '72 horas (3 días)', value: 72 },
    { label: '120 horas (5 días)', value: 120 },
    { label: '168 horas (1 semana)', value: 168 },
    { label: '336 horas (2 semanas)', value: 336 },
    { label: '504 horas (3 semanas)', value: 504 },
    { label: '720 horas (1 mes)', value: 720 }
  ];

  constructor(
    private historialesService: HistorialesService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private translate: TranslateService
  ) {
    // Configurar fechas automáticamente (readonly)
    this.setupAutomaticDates();
    
    // Asegurar que intervalHours tenga un valor numérico válido
    this.intervalHours = 6;
  }

  ngOnInit(): void {
    // Actualizar fechas cada vez que se inicializa el componente
    this.setupAutomaticDates();
    this.loadDevices();
    // Verificar si hay un análisis en progreso al abrir el modal
    this.checkExistingProgress();
  }

  /**
   * Configurar fechas automáticamente (readonly)
   * Fecha fin: Fecha actual + 1 día
   * Fecha inicio: Fecha actual - 60 días
   */
  private setupAutomaticDates(): void {
    const now = new Date();
    
    // Fecha fin: mañana (fecha actual + 1 día)
    this.toDate = new Date(now);
    this.toDate.setDate(now.getDate() + 1);
    // Asegurar que sea al final del día
    this.toDate.setHours(23, 59, 59, 999);
    
    // Fecha inicio: hace 60 días (fecha actual - 60 días)
    this.fromDate = new Date(now);
    this.fromDate.setDate(now.getDate() - 60);
    // Asegurar que sea al inicio del día
    this.fromDate.setHours(0, 0, 0, 0);
  }

  /**
   * Refrescar fechas automáticamente
   * Útil si el modal ha estado abierto por mucho tiempo
   */
  refreshDates(): void {
    this.setupAutomaticDates();
  }

  /**
   * Cargar lista de dispositivos
   */
  loadDevices(): void {
    this.loading = true;
    this.historialesService.getDevices().subscribe({
      next: (response) => {
        if (response.success) {
          this.devices = response.devices;
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading devices:', error);
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('settings.historiales.messages.error'),
          detail: this.translate.instant('settings.historiales.messages.error_loading_devices')
        });
        this.loading = false;
      }
    });
  }

  /**
   * Analizar todos los dispositivos
   */
  analyzeAllDevices(): void {
    // Verificar primero si ya hay un análisis en progreso
    if (this.analyzing) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('settings.historiales.messages.warning'),
        detail: this.translate.instant('settings.historiales.messages.analysis_already_running')
      });
      return;
    }

    this.confirmationService.confirm({
      message: this.translate.instant('settings.historiales.messages.confirm_analyze_all'),
      header: this.translate.instant('settings.historiales.messages.confirm_header'),
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.executeAnalyzeAll();
      }
    });
  }

  private executeAnalyzeAll(): void {
    const request: AnalyzeHistoryRequest = {
      fromDate: this.fromDate.toISOString(),
      toDate: this.toDate.toISOString(),
      intervalHours: Number(this.intervalHours)
    };

    this.analyzing = true;
    this.showResults = false;
    this.showProgress = true;
    this.currentProgress = null;

    // Iniciar análisis
    this.historialesService.analyzeAllDevices(request).subscribe({
      next: (response) => {
        if (response.success) {
          this.analysisResults = response;
          this.showResults = true;
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('settings.historiales.messages.analysis_completed'),
            detail: this.translate.instant('settings.historiales.messages.analysis_all_detail', {
              successful: response.summary.successfulDevices,
              total: response.summary.totalDevices,
              positions: response.summary.totalPositionsFound
            })
          });
        }
        this.analyzing = false;
        this.showProgress = false;
        this.stopProgressMonitoring();
      },
      error: (error) => {
        console.error('Error analyzing devices:', error);
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('settings.historiales.messages.error'),
          detail: this.translate.instant('settings.historiales.messages.error_analysis')
        });
        this.analyzing = false;
        this.showProgress = false;
        this.stopProgressMonitoring();
      }
    });

    // Iniciar monitoreo de progreso
    this.startProgressMonitoring();
  }

  /**
   * Limpiar resultados
   */
  clearResults(): void {
    this.showResults = false;
    this.analysisResults = null;
  }

  /**
   * Formatear duración en milisegundos a texto legible
   */
  formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  }

  /**
   * Obtener clase CSS según el estado del resultado
   */
  getResultClass(success: boolean): string {
    return success ? 'text-green-600' : 'text-red-600';
  }

  /**
   * Validar formulario
   * Las fechas se calculan automáticamente, solo validamos el intervalo
   */
  isFormValid(): boolean {
    const intervalValue = Number(this.intervalHours);
    return !isNaN(intervalValue) && intervalValue > 0;
  }

  // ========================
  // MÉTODOS DE PROGRESO
  // ========================

  /**
   * Iniciar monitoreo de progreso
   */
  private startProgressMonitoring(): void {
    // Consultar progreso cada 2 segundos
    this.progressSubscription = interval(2000).subscribe(() => {
      this.historialesService.getCurrentProgress().subscribe({
        next: (response) => {
          if (response.success) {
            this.currentProgress = response.progress;
            this.currentAnalysisId = response.progress.analysisId;
            
            // Si el análisis terminó, detener el monitoreo y manejar estado final
            if (response.progress.status === 'completed' || 
                response.progress.status === 'failed' || 
                response.progress.status === 'cancelled') {
              this.handleAnalysisCompletion(response.progress.status);
            }
          }
        },
        error: (error) => {
          console.error('Error getting progress:', error);
          // No mostrar error al usuario, puede ser normal si no hay análisis activo
        }
      });
    });

    // Iniciar también el monitoreo del dispositivo actual
    this.startCurrentDeviceMonitoring();
  }

  /**
   * Detener monitoreo de progreso
   */
  private stopProgressMonitoring(): void {
    if (this.progressSubscription) {
      this.progressSubscription.unsubscribe();
      this.progressSubscription = null;
    }
    // Detener también el monitoreo del dispositivo actual
    this.stopCurrentDeviceMonitoring();
  }

  // ========================
  // MÉTODOS DISPOSITIVO ACTUAL
  // ========================

  /**
   * Iniciar monitoreo del dispositivo actual
   */
  private startCurrentDeviceMonitoring(): void {
    // Consultar dispositivo actual cada 1.5 segundos (más frecuente para detalles)
    this.currentDeviceSubscription = interval(1500).subscribe(() => {
      this.historialesService.getCurrentDeviceProgress().subscribe({
        next: (response) => {
          if (response.success) {
            this.currentDeviceInfo = response.currentDevice;
            this.currentAnalysisInfo = response.analysisInfo;
            this.showCurrentDevice = true;

            // Si el dispositivo terminó o falló, continuar monitoreando
            // porque puede haber más dispositivos en cola
          }
        },
        error: (error) => {
          console.error('Error getting current device progress:', error);
          // No mostrar error al usuario, puede ser normal si no hay análisis activo
          this.showCurrentDevice = false;
        }
      });
    });
  }

  /**
   * Detener monitoreo del dispositivo actual
   */
  private stopCurrentDeviceMonitoring(): void {
    if (this.currentDeviceSubscription) {
      this.currentDeviceSubscription.unsubscribe();
      this.currentDeviceSubscription = null;
    }
    this.showCurrentDevice = false;
    this.currentDeviceInfo = null;
    this.currentAnalysisInfo = null;
  }

  /**
   * Formatear tiempo restante estimado
   */
  formatEstimatedTime(milliseconds: number): string {
    if (milliseconds <= 0) {
      return 'Calculando...';
    }

    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Cancelar análisis actual
   */
  cancelAnalysis(): void {
    this.confirmationService.confirm({
      message: this.translate.instant('settings.historiales.messages.confirm_cancel'),
      header: this.translate.instant('settings.historiales.messages.confirm_cancel_header'),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.executeCancelAnalysis();
      }
    });
  }

  /**
   * Ejecutar cancelación del análisis
   */
  private executeCancelAnalysis(): void {
    this.historialesService.cancelCurrentAnalysis().subscribe({
      next: (response) => {
        if (response.success) {
          this.messageService.add({
            severity: 'warn',
            summary: this.translate.instant('settings.historiales.messages.analysis_cancelled'),
            detail: response.message
          });
          this.analyzing = false;
          this.showProgress = false;
          this.currentProgress = null;
          this.stopProgressMonitoring();
        }
      },
      error: (error) => {
        console.error('Error canceling analysis:', error);
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('settings.historiales.messages.error'),
          detail: this.translate.instant('settings.historiales.messages.error_cancel')
        });
      }
    });
  }

  /**
   * Obtener el progreso de un dispositivo específico
   */
  getDeviceProgress(deviceImei: string): DeviceProgress | undefined {
    if (!this.currentProgress?.deviceProgress) {
      return undefined;
    }
    return this.currentProgress.deviceProgress.find(dp => dp.deviceImei === deviceImei);
  }

  /**
   * Obtener clase CSS para el estado del dispositivo
   */
  getDeviceStatusClass(status: string): string {
    switch (status) {
      case 'completed': return 'status-success';
      case 'failed': return 'status-error';
      case 'running': return 'status-running';
      case 'pending': return 'status-pending';
      default: return '';
    }
  }

  /**
   * Manejar la finalización del análisis
   */
  private handleAnalysisCompletion(status: string): void {
    // Detener todos los monitoreos
    this.stopProgressMonitoring();
    
    // Resetear estados de análisis para permitir nuevo análisis
    this.analyzing = false;
    this.showProgress = false;
    this.showCurrentDevice = false;
    
    // Mostrar mensaje según el resultado
    switch (status) {
      case 'completed':
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('settings.historiales.messages.analysis_completed_final'),
          detail: this.translate.instant('settings.historiales.messages.analysis_completed_final_detail'),
          life: 8000 // Mantener el mensaje más tiempo
        });
        
        // Opcional: Mostrar resumen final si tenemos los datos
        if (this.currentProgress) {
          this.messageService.add({
            severity: 'info',
            summary: this.translate.instant('settings.historiales.messages.final_summary'),
            detail: this.translate.instant('settings.historiales.messages.final_summary_detail', {
              devices: this.currentProgress.completedDevices,
              total: this.currentProgress.totalDevices,
              positions: this.currentProgress.totalPositionsFound,
              time: this.formatDuration(this.currentProgress.elapsedTimeMs)
            }),
            life: 10000
          });
        }
        break;
        
      case 'failed':
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('settings.historiales.messages.analysis_failed'),
          detail: this.translate.instant('settings.historiales.messages.analysis_failed_detail'),
          life: 6000
        });
        break;
        
      case 'cancelled':
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('settings.historiales.messages.analysis_cancelled_final'),
          detail: this.translate.instant('settings.historiales.messages.analysis_cancelled_final_detail'),
          life: 5000
        });
        break;
    }
    
    // Limpiar datos de progreso después de un breve delay para que el usuario vea el progreso final
    setTimeout(() => {
      this.currentProgress = null;
      this.currentDeviceInfo = null;
      this.currentAnalysisInfo = null;
    }, 3000);
  }

  /**
   * Cleanup al destruir el componente
   */
  ngOnDestroy(): void {
    this.stopProgressMonitoring();
  }

  // ========================
  // MÉTODOS DE VERIFICACIÓN INICIAL
  // ========================

  /**
   * Verificar si hay un análisis en progreso al abrir el modal
   */
  private checkExistingProgress(): void {
    this.historialesService.getCurrentProgress().subscribe({
      next: (response) => {
        if (response.success && response.progress) {
          // Hay un análisis en progreso
          this.currentProgress = response.progress;
          this.currentAnalysisId = response.progress.analysisId;
          
          // Verificar el estado del análisis
          if (response.progress.status === 'running') {
            // El análisis está corriendo, mostrar progreso y deshabilitar botón
            this.analyzing = true;
            this.showProgress = true;
            this.startProgressMonitoring();
          } else if (response.progress.status === 'completed') {
            // El análisis terminó
            this.handleAnalysisCompletion('completed');
          } else if (response.progress.status === 'failed' || response.progress.status === 'cancelled') {
            // El análisis falló o fue cancelado
            this.handleAnalysisCompletion(response.progress.status);
          }
        }
      },
      error: (error) => {
        // No hay análisis en progreso o error de conexión, esto es normal
        console.log('No hay análisis en progreso:', error);
        this.currentProgress = null;
        this.showProgress = false;
        this.analyzing = false;
      }
    });
  }
}