import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef, ElementRef, QueryList, ViewChildren } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as maplibregl from 'maplibre-gl';
import { MenuItem, MessageService } from 'primeng/api';
import { TargetsService } from '@core/services/targets.service';
import { ProtocolsService } from '@core/services/protocols.service';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from '@core/services/auth.service';
import { ThemesService } from '@shared/services/themes.service';
import { SystemService } from '@core/services/system.service';
import { RouteHistoryResponse, RouteHistoryPosition } from '@core/interfaces';
import { ReportsMapInfoPanelData, ReportsMapInfoPanelItem } from '../../../../../../shareds/components/reports-map/reports-map.component';
import { firstValueFrom } from 'rxjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ReportFilter {
  reportType: string;
  dateRange: {
    start: Date | string | null;
    end: Date | string | null;
  };
  selectedTargets: any[];
  speedFilter: {
    min: number | null;
    max: number | null;
  };
  distanceFilter: {
    min: number | null;
    max: number | null;
  };
  stopTimeFilter: {
    min: number | null; // minutos
    max: number | null; // minutos
  };
  includeStops: boolean;
  minStopDurationFilter: number; // minutos: 1, 5, o 20
  exportFormat: string;
}

@Component({
    selector: 'app-reports',
    templateUrl: './reports.component.html',
    styleUrl: './reports.component.css',
    standalone: false
})
export class ReportsComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChildren('stopMap') stopMapElements!: QueryList<ElementRef<HTMLElement>>;

    items: MenuItem[] = [{ label: 'Reportes' }];
    home: MenuItem = { icon: 'pi pi-home', routerLink: '/admin/dashboard' };
    
    // Datos principales
    targets: any[] = [];
    loading: boolean = false;
    generatingReport: boolean = false;
    
    // Datos del historial de rutas
    routeHistory: RouteHistoryResponse | null = null;
    loadingRouteHistory: boolean = false;
    
    // Datos de paradas (solo para compatibilidad con el template - las paradas reales se calculan automáticamente en el mapa)
    stops: any[] = [];
    
    // Protocolo del target seleccionado
    targetProtocol: any = null;
    
    // Estado de carga progresiva
    progressiveLoading: {
      isActive: boolean;
      totalBlocks: number;
      currentBlock: number;
      currentRange: string;
      totalPositionsLoaded: number;
      isStreamingMode: boolean;
      replayStarted: boolean;
    } = {
      isActive: false,
      totalBlocks: 0,
      currentBlock: 0,
      currentRange: '',
      totalPositionsLoaded: 0,
      isStreamingMode: false,
      replayStarted: false
    };
    
    // Target ID específico desde la URL
    targetIdFromUrl: string | null = null;
    
    // Estado del target seleccionado para determinar opciones rápidas
    isTargetOffline: boolean = false;

    mapInfoPanelData: ReportsMapInfoPanelData | null = null;
    routeDistanceMeters: number | null = null;
    loadingRouteDistance: boolean = false;
    hasGeneratedRouteReport: boolean = false;
    calculatedStops: any[] = [];
    private stopPreviewMaps: maplibregl.Map[] = [];
    private stopPreviewKeys: string[] = [];
    private stopPreviewRenderScheduled: boolean = false;
    private mapboxAccessToken: string | null = null;
    private reverseGeocodeCache = new Map<string, string>();
    private routeStopsLoadedFromCache: boolean = false;
    private routeReportCacheContext: {
      deviceImei: string;
      fromDate: string;
      toDate: string;
      source: string;
      minStopDuration: number;
    } | null = null;
    private routeReportCacheSyncTimer: any = null;
    private lastRouteReportCacheSyncSignature: string = '';
    private routeDistanceRefreshTimer: ReturnType<typeof setInterval> | null = null;
    private routeDistanceRefreshInFlight: boolean = false;
    private routeDistanceRefreshContext: {
      deviceId: string;
      fromDate: string;
      toDate: string;
    } | null = null;
    private readonly routeDistanceRefreshIntervalMs = 15000;
    
    // Obtener opciones rápidas según el estado del target
    get availableQuickDateRanges() {
      return this.isTargetOffline ? this.quickDateRangesOffline : this.quickDateRanges;
    }
    
    // Filtros del reporte
    reportFilter: ReportFilter = {
      reportType: 'movements',
      dateRange: {
        start: null, // Se inicializa en ngOnInit
        end: null // Se inicializa en ngOnInit
      },
      selectedTargets: [],
      speedFilter: {
        min: null,
        max: null
      },
      distanceFilter: {
        min: null,
        max: null
      },
      stopTimeFilter: {
        min: null,
        max: null
      },
      includeStops: true,
      minStopDurationFilter: 20, // Valor por defecto: 20 minutos
      exportFormat: 'pdf'
    };

    // Opciones base para los dropdowns (sin Historial de Recorrido)
    private baseReportTypes = [
      // { label: 'Reporte de Movimientos', value: 'movements', icon: 'pi pi-map' },
      // { label: 'Reporte de Paradas', value: 'stops', icon: 'pi pi-pause' },
      // { label: 'Reporte de Velocidad', value: 'speed', icon: 'pi pi-clock' },
      // { label: 'Reporte de Combustible', value: 'fuel', icon: 'pi pi-dollar' },
      // { label: 'Reporte de Actividad', value: 'activity', icon: 'pi pi-chart-line' },
      // { label: 'Reporte Detallado', value: 'detailed', icon: 'pi pi-list' }
    ];

    // Historial de Recorrido (solo disponible con target en URL)
    private routeHistoryType = { label: 'Historial de Recorrido', value: 'route_history', icon: 'pi pi-map-marker' };

    // Opciones dinámicas mostradas en el dropdown
    reportTypes: any[] = [];

    exportFormats = [
      { label: 'PDF', value: 'pdf', icon: 'pi pi-file-pdf' },
      { label: 'Excel', value: 'excel', icon: 'pi pi-file-excel' },
      { label: 'CSV', value: 'csv', icon: 'pi pi-file' }
    ];

    // Presets de fechas rápidas
    quickDateRanges = [
      { 
        label: 'Hoy', 
        value: 'today',
        getRange: () => ({
          start: new Date(new Date().setHours(0,0,0,0)),
          end: new Date(new Date().setHours(23,59,0,0))
        })
      },
      { 
        label: 'Ayer', 
        value: 'yesterday',
        getRange: () => {
          const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
          return {
            start: new Date(yesterday.setHours(0,0,0,0)),
            end: new Date(yesterday.setHours(23,59,0,0))
          };
        }
      },
      { 
        label: 'Últimas 6 horas', 
        value: 'last6hours',
        getRange: () => {
          const now = new Date();
          const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
          return {
            start: sixHoursAgo,
            end: now
          };
        }
      },
      { 
        label: 'Últimas 12 horas', 
        value: 'last12hours',
        getRange: () => {
          const now = new Date();
          const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
          return {
            start: twelveHoursAgo,
            end: now
          };
        }
      },
      { 
        label: 'Últimos 7 días', 
        value: 'week',
        getRange: () => {
          const now = new Date();
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          weekAgo.setHours(0,0,0,0);
          return {
            start: weekAgo,
            end: now
          };
        }
      },
      { 
        label: 'Este mes', 
        value: 'thisMonth',
        getRange: () => {
          const now = new Date();
          return {
            start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
            end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 0, 0)
          };
        }
      }
    ];

    // Presets de fechas rápidas para targets offline (15 días antes de última ubicación)
    quickDateRangesOffline = [
      { 
        label: '15 días antes de última ubicación', 
        value: 'fromLastLocation',
        getRange: (lastUpdate: Date) => {
          const fromDate = new Date(lastUpdate);
          fromDate.setDate(fromDate.getDate() - 15);
          return {
            start: fromDate,
            end: lastUpdate
          };
        }
      },
      { 
        label: '15 días antes de última ubicación', 
        value: 'fromLastLocationMinus15Days',
        getRange: (lastUpdate: Date) => {
          const fromDate = new Date(lastUpdate);
          fromDate.setDate(fromDate.getDate() - 15);
          return {
            start: fromDate,
            end: lastUpdate
          };
        }
      },
      { 
        label: '7 días antes de última ubicación', 
        value: 'fromLastLocationMinus7Days',
        getRange: (lastUpdate: Date) => {
          const fromDate = new Date(lastUpdate);
          fromDate.setDate(fromDate.getDate() - 7);
          return {
            start: fromDate,
            end: lastUpdate
          };
        }
      },
      { 
        label: '3 días antes de última ubicación', 
        value: 'fromLastLocationMinus3Days',
        getRange: (lastUpdate: Date) => {
          const fromDate = new Date(lastUpdate);
          fromDate.setDate(fromDate.getDate() - 3);
          return {
            start: fromDate,
            end: lastUpdate
          };
        }
      }
    ];

    constructor(
      private targetsService: TargetsService,
      private protocolsService: ProtocolsService,
      private messageService: MessageService,
      private translate: TranslateService,
      private authService: AuthService,
      private themesService: ThemesService,
      private systemService: SystemService,
      private route: ActivatedRoute,
      private cdr: ChangeDetectorRef
    ) {}

    ngOnInit(): void {
      // Inicializar fechas por defecto
      this.initializeDateRange();
      
      // Inicializar tipos de reportes básicos (sin Historial de Recorrido)
      this.updateAvailableReportTypes(false);
      this.loadMapboxAccessToken();
      
      this.loadTargets();
      
      // Capturar targetId de la URL si existe (parámetro de ruta)
      this.route.params.subscribe(async params => {
        const targetId = params['targetId'];
        if (targetId) {
          this.targetIdFromUrl = targetId; // Almacenar el target ID de la ruta
          this.updateAvailableReportTypes(true); // Habilitar Historial de Recorrido
          await this.preselectTarget(targetId);
        }
      });

      // Capturar query parameters (target y type)
      this.route.queryParams.subscribe(async queryParams => {
        const target = queryParams['target'];
        const type = queryParams['type'];
        
        if (target) {
          this.targetIdFromUrl = target; // Almacenar el target ID de la URL
          this.updateAvailableReportTypes(true); // Habilitar Historial de Recorrido
          await this.preselectTarget(target);
        }
        
        if (type) {
          this.preselectReportType(type);
        }
      });
    }

    ngAfterViewInit(): void {
      this.stopMapElements?.changes.subscribe(() => {
        this.scheduleStopPreviewMaps();
      });
    }

    ngOnDestroy(): void {
      if (this.routeReportCacheSyncTimer) {
        clearTimeout(this.routeReportCacheSyncTimer);
      }
      this.stopRouteDistanceRefresh();
      this.destroyStopPreviewMaps();
    }

    private async loadTargets(): Promise<void> {
      this.loading = true;
      try {
        // Obtener targets del usuario actual
        const currentUser = this.authService.getCurrentUser();
        if (currentUser) {
          const targetsResponse = await this.targetsService.getTargetsByUserId(currentUser.id);
          this.targets = targetsResponse.devices;
        }
      } catch (error) {
        console.error('Error cargando targets:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los dispositivos'
        });
      } finally {
        this.loading = false;
      }
    }

    /**
     * Actualizar tipos de reportes disponibles según si hay target en URL
     */
    private updateAvailableReportTypes(hasTargetInUrl: boolean): void {
      if (hasTargetInUrl) {
        // Incluir Historial de Recorrido cuando hay target en URL
        this.reportTypes = [...this.baseReportTypes, this.routeHistoryType];
      } else {
        // Solo tipos básicos sin Historial de Recorrido
        this.reportTypes = [...this.baseReportTypes];
        
        // Si el tipo actual es route_history y ya no está disponible, resetear
        if (this.reportFilter.reportType === 'route_history') {
          this.reportFilter.reportType = 'movements'; // Cambiar a un tipo disponible
        }
      }
    }

    private async preselectTarget(targetId: string): Promise<void> {
      try {
        console.log('🔍 [REPORTES] Capturando target ID de la URL:', targetId);
        
        // Cargar información completa del target usando el servicio
        const targetInfo = await this.targetsService.getTargetById(targetId);
        
        console.log('🔍 [REPORTES] Información completa del target cargada:', {
          targetId: targetId,
          targetInfo: targetInfo,
          targetName: targetInfo.name,
          targetImei: targetInfo.device_imei,
          targetPlate: targetInfo.plate,
          targetStatus: targetInfo.status,
          targetPlan: targetInfo.plan,
          targetTraccarInfo: targetInfo.traccarInfo,
          targetCreatedAt: targetInfo.created_at,
          targetUpdatedAt: targetInfo.updated_at
        });
        
        // Buscar el target en la lista cargada para mantener consistencia
        const targetToSelect = this.targets.find(target => 
          target._id === targetId || target.id === targetId
        );
        
        if (targetToSelect) {
          // Usar el target de la lista cargada (mantiene consistencia con la UI)
          this.reportFilter.selectedTargets = [targetToSelect];
          
          console.log('🔍 [REPORTES] Target preseleccionado desde lista cargada:', targetToSelect);
        } else {
          // Si no está en la lista cargada, usar la información completa del servicio
          this.reportFilter.selectedTargets = [targetInfo];
          
          console.log('🔍 [REPORTES] Target preseleccionado desde servicio (no encontrado en lista):', targetInfo);
        }
        
        // Verificar si el target está online y ajustar fechas si es necesario
        this.adjustDateRangeBasedOnTargetStatus(targetInfo);
        
        // Mostrar mensaje informativo
        this.messageService.add({
          severity: 'info',
          summary: 'Target seleccionado',
          detail: `Se ha seleccionado "${targetInfo.name}" para el reporte`
        });
        
      } catch (error) {
        console.error('❌ [REPORTES] Error cargando información del target:', error);
        
        // Fallback: intentar encontrar en la lista cargada
        const checkTargets = () => {
          if (this.targets.length > 0) {
            const targetToSelect = this.targets.find(target => 
              target._id === targetId || target.id === targetId
            );
            
            if (targetToSelect) {
              this.reportFilter.selectedTargets = [targetToSelect];
              console.log('🔍 [REPORTES] Target encontrado en lista cargada (fallback):', targetToSelect);
            } else {
              console.warn('⚠️ [REPORTES] Target no encontrado con ID:', targetId);
            }
          } else if (!this.loading) {
            console.warn('⚠️ [REPORTES] No se encontraron targets o el target no existe');
          } else {
            setTimeout(checkTargets, 100);
          }
        };
        
        checkTargets();
      }
    }

    private preselectReportType(type: string): void {
      // Mapear el tipo recibido a los tipos de reporte disponibles
      const typeMapping: { [key: string]: string } = {
        'history': 'route_history',
        'movements': 'movements',
        'stops': 'stops',
        'speed': 'speed',
        'fuel': 'fuel',
        'activity': 'activity',
        'detailed': 'detailed'
      };

      const mappedType = typeMapping[type] || type;
      
      // Verificar si el tipo de reporte es válido
      const validReportType = this.reportTypes.find(rt => rt.value === mappedType);
      
      if (validReportType) {
        this.reportFilter.reportType = mappedType;
        
        // Llamar a la función de cambio de tipo de reporte para aplicar configuraciones específicas
        this.onReportTypeChange();
        
        // Mostrar mensaje informativo
        this.messageService.add({
          severity: 'info',
          summary: 'Tipo de reporte seleccionado',
          detail: `Se ha seleccionado "${validReportType.label}"`
        });
      } else {
        console.warn('⚠️ Tipo de reporte no válido:', type);
      }
    }

    onQuickDateSelect(preset: any): void {
      let range;
      
      // Verificar si es una opción offline que requiere lastUpdate
      if (preset.value.startsWith('fromLastLocation')) {
        const selectedTarget = this.reportFilter.selectedTargets[0];
        
        // Determinar la última ubicación VÁLIDA
        const lastValidLocationStr = selectedTarget?.traccarInfo?.geolocation?.deviceTime 
          || selectedTarget?.traccarInfo?.geolocation?.fixTime 
          || selectedTarget?.traccarInfo?.lastUpdate;
          
        if (lastValidLocationStr) {
          const lastValidLocationDate = new Date(lastValidLocationStr);
          range = preset.getRange(lastValidLocationDate);
        } else {
          this.messageService.add({
            severity: 'warn',
            summary: 'Opción no disponible',
            detail: 'No se encontró información de última ubicación para este dispositivo'
          });
          return;
        }
      } else {
        range = preset.getRange();
      }
      
      // Convertir las fechas al formato correcto para los inputs de tipo date
      this.reportFilter.dateRange = {
        start: this.formatDateForInput(range.start),
        end: this.formatDateForInput(range.end)
      };
      
    }

    private formatDateForInput(date: Date): string {
      if (!date) return '';
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    /**
     * Convierte el valor local de datetime-local a su instante UTC real.
     * Ejemplo en Santo Domingo: 2026-07-25T00:00 -> 2026-07-25T04:00:00.000Z.
     */
    private convertLocalDateTimeToUTC(dateTimeLocalString: string): string {
      if (!dateTimeLocalString) return '';

      const localDate = new Date(dateTimeLocalString);
      return Number.isNaN(localDate.getTime()) ? '' : localDate.toISOString();
    }

    private initializeDateRange(): void {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      yesterday.setHours(0, 0, 0, 0); // Inicio a las 00:00
      
      const today = new Date();
      today.setHours(23, 59, 0, 0); // Final a las 23:59
      
      this.reportFilter.dateRange = {
        start: this.formatDateForInput(yesterday),
        end: this.formatDateForInput(today)
      };
    }

    /**
     * Ajusta el rango de fechas basándose en el estado del target
     * Si el target no está online, usa la fecha de lastUpdate como "desde"
     */
    private adjustDateRangeBasedOnTargetStatus(targetInfo: any): void {
      console.log('🔍 [REPORTES] Verificando estado del target:', {
        targetName: targetInfo.name,
        traccarStatus: targetInfo.traccarInfo?.status,
        lastUpdate: targetInfo.traccarInfo?.lastUpdate
      });

      // Determinar si el target está offline
      this.isTargetOffline = targetInfo.traccarInfo?.status !== 'online' && !!targetInfo.traccarInfo?.lastUpdate;

      // Verificar si el target no está online
      if (this.isTargetOffline) {
        // Determinar la última ubicación VÁLIDA
        const lastValidLocationStr = targetInfo.traccarInfo?.geolocation?.deviceTime 
          || targetInfo.traccarInfo?.geolocation?.fixTime 
          || targetInfo.traccarInfo?.lastUpdate;
          
        const lastUpdate = new Date(lastValidLocationStr);
        const fromDate = new Date(lastUpdate);
        fromDate.setDate(fromDate.getDate() - 15); // 15 días antes de la última ubicación
        
        console.log('🔍 [REPORTES] Target offline detectado, ajustando fechas desde 15 días antes de última ubicación:', {
          lastValidLocation: lastUpdate.toISOString(),
          fromDate: fromDate.toISOString(),
          range: '15 días antes de última ubicación válida'
        });

        // Establecer la fecha "desde" como 15 días antes de lastUpdate y "hasta" como lastUpdate
        this.reportFilter.dateRange = {
          start: this.formatDateForInput(fromDate),
          end: this.formatDateForInput(lastUpdate)
        };

        // Mostrar mensaje informativo
        this.messageService.add({
          severity: 'info',
          summary: 'Fechas ajustadas',
          detail: `El dispositivo está offline. Se ha ajustado el rango de fechas desde la última ubicación válida: ${lastUpdate.toLocaleString()}`
        });

        console.log('🔍 [REPORTES] Fechas ajustadas para target offline:', {
          start: this.reportFilter.dateRange.start,
          end: this.reportFilter.dateRange.end
        });
      } else {
        console.log('🔍 [REPORTES] Target online o sin lastUpdate, usando fechas por defecto');
        this.isTargetOffline = false;
      }
    }

    onReportTypeChange(): void {
      if (this.reportFilter.reportType !== 'route_history') {
        this.stopRouteDistanceRefresh();
      }

      // Verificar si se está intentando seleccionar Historial de Recorrido sin target en URL
      if (this.reportFilter.reportType === 'route_history' && !this.targetIdFromUrl) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Opción no disponible',
          detail: 'El Historial de Recorrido solo está disponible cuando se accede con un dispositivo específico desde la URL'
        });
        this.reportFilter.reportType = 'movements'; // Resetear a un tipo válido
        return;
      }

      // Resetear ciertos filtros según el tipo de reporte
      switch (this.reportFilter.reportType) {
        case 'stops':
          this.reportFilter.includeStops = true;
          break;
        case 'movements':
          this.reportFilter.includeStops = false;
          break;
        case 'speed':
          this.reportFilter.speedFilter = { min: 0, max: null };
          break;
      }
    }



    validateFilters(): boolean {
      // Validar rango de fechas
      if (!this.reportFilter.dateRange.start || !this.reportFilter.dateRange.end) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Filtros incompletos',
          detail: 'Debe seleccionar un rango de fechas válido'
        });
        return false;
      }

      // Convertir a Date para comparar correctamente (usando hora local para validación)
      const startDate = this.reportFilter.dateRange.start instanceof Date 
        ? this.reportFilter.dateRange.start 
        : new Date(this.reportFilter.dateRange.start);
      const endDate = this.reportFilter.dateRange.end instanceof Date 
        ? this.reportFilter.dateRange.end 
        : new Date(this.reportFilter.dateRange.end);

      // Validar que las fechas sean válidas
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Fechas inválidas',
          detail: 'Las fechas seleccionadas no son válidas'
        });
        return false;
      }

      // Comparar fechas correctamente
      if (startDate > endDate) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Fechas inválidas',
          detail: 'La fecha de inicio no puede ser mayor que la fecha final'
        });
        return false;
      }

      // Validar que haya un dispositivo disponible (desde URL o seleccionado)
      if (!this.targetIdFromUrl && this.reportFilter.selectedTargets.length === 0) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Dispositivo requerido',
          detail: 'No se encontró un dispositivo válido para generar el reporte'
        });
        return false;
      }

      return true;
    }

    async generateReport(): Promise<void> {
      if (!this.validateFilters()) {
        return;
      }

      this.generatingReport = true;
      this.stopRouteDistanceRefresh();
      this.routeDistanceMeters = null;
      this.mapInfoPanelData = null;
      this.hasGeneratedRouteReport = false;
      this.calculatedStops = [];
      this.routeStopsLoadedFromCache = false;
      this.lastRouteReportCacheSyncSignature = '';
      this.destroyStopPreviewMaps();
      
      // Limpiar protocolo anterior para forzar nueva consulta
      this.targetProtocol = null;
      
      try {
        
        if (this.reportFilter.reportType === 'route_history') {
          // Para historial de recorrido, determinar si usar carga progresiva
          if (this.shouldUseProgressiveLoading()) {
            await this.loadRouteHistoryProgressive();
          } else {
            await this.loadRouteHistory();
          }
          
          // Las paradas ahora se calculan automáticamente en el mapa a partir de velocidades 0
          this.stops = []; // Limpiar paradas del backend
          this.applyCachedStopsOrCalculate();
          this.hasGeneratedRouteReport = true;
          this.cdr.detectChanges();
          this.scheduleStopPreviewMaps();
          
        } else {
          // Para otros tipos de reporte, simular generación
          await this.simulateReportGeneration();
        }
        
        let reportDetail = `Reporte de ${this.getReportTypeName()} generado exitosamente`;
        
        // Agregar información de paradas si es un reporte de historial
        if (this.reportFilter.reportType === 'route_history') {
          if (this.reportFilter.includeStops) {
            reportDetail += ` (paradas cargando en segundo plano...)`;
          } else {
            reportDetail += ` (paradas no incluidas)`;
          }
        }
        
        this.messageService.add({
          severity: 'success',
          summary: 'Reporte generado',
          detail: reportDetail
        });
        
      } catch (error) {
        console.error('Error generando reporte:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al generar el reporte. Intente nuevamente.'
        });
      } finally {
        this.generatingReport = false;
        
        // Scroll automático hacia abajo en móvil después de generar reporte
        this.scrollToBottomOnMobile();
      }
    }

    private async simulateReportGeneration(): Promise<void> {
      // Simular tiempo de generación
      return new Promise(resolve => setTimeout(resolve, 2000));
    }

    private scrollToBottomOnMobile(): void {
      // Verificar si estamos en móvil (ancho de pantalla <= 768px)
      if (window.innerWidth <= 768) {
        // Esperar un poco para que el DOM se actualice
        setTimeout(() => {
          const container = document.querySelector('.reports-container');
          if (container) {
            container.scrollTo({
              top: container.scrollHeight,
              behavior: 'smooth'
            });
            console.log('[REPORTS] 📱 Scroll automático hacia abajo en móvil');
          }
        }, 300);
      }
    }

    /**
     * Consulta el protocolo asociado al target usando su propiedad type
     */
    private async loadTargetProtocol(target: any): Promise<void> {
      try {
        // El ID del protocolo está en la propiedad 'type' del target
        const protocolId = target?.type;
        
        if (!protocolId) {
       
          return;
        }

       

        // Consultar el protocolo por ID
        const protocol = await this.protocolsService.getProtocolById(protocolId).toPromise();
        
        if (!protocol) {
          return;
        }
        

        // Almacenar el protocolo para usar en el componente del mapa
        this.targetProtocol = protocol;

     

      } catch (error) {
        console.error('PROTO ❌ Error al consultar protocolo:', {
          protocolId: target?.type,
          targetId: target._id,
          error: error
        });
      }
    }

    private async loadRouteHistory(): Promise<void> {
      this.loadingRouteHistory = true;
      
      try {
        let selectedTarget: any;
        let selectedTargetId: string;
        
        if (this.targetIdFromUrl) {
          // 1. Usar el target específico de la URL - traer del servicio
          selectedTargetId = this.targetIdFromUrl;
          
          try {
            selectedTarget = await this.targetsService.getTargetById(selectedTargetId);
          } catch (error) {
            throw new Error(`No se encontró el dispositivo con ID: ${selectedTargetId}`);
          }
          
        } else if (this.reportFilter.selectedTargets.length > 0) {
          // 2. Usar el primer target seleccionado localmente
          selectedTargetId = this.reportFilter.selectedTargets[0]._id || this.reportFilter.selectedTargets[0];
          selectedTarget = this.targets.find(t => t._id === selectedTargetId);
          
        } else if (this.targets.length > 0) {
          // 3. Usar el primer target disponible localmente
          selectedTarget = this.targets[0];
          selectedTargetId = selectedTarget._id;
          
        } else {
          throw new Error('No hay dispositivos disponibles para el historial');
        }
        
        if (!selectedTarget) {
          throw new Error('No se encontró el dispositivo seleccionado');
        }
        
        // Consultar protocolo del target usando su propiedad 'type'
        await this.loadTargetProtocol(selectedTarget);
        
        // Extraer device_imei del target obtenido
        const deviceImei = selectedTarget?.device_imei || selectedTarget?.imei;
        
        if (!deviceImei) {
          throw new Error(`El dispositivo "${selectedTarget.name}" no tiene un IMEI válido`);
        }

        // Convertir fechas a formato UTC explícitamente
        let fromDate: string | undefined;
        let toDate: string | undefined;
        
        if (this.reportFilter.dateRange.start) {
          if (this.reportFilter.dateRange.start instanceof Date) {
            fromDate = this.reportFilter.dateRange.start.toISOString();
          } else {
            fromDate = this.convertLocalDateTimeToUTC(this.reportFilter.dateRange.start);
          }
        }
        
        if (this.reportFilter.dateRange.end) {
          if (this.reportFilter.dateRange.end instanceof Date) {
            toDate = this.reportFilter.dateRange.end.toISOString();
          } else {
            toDate = this.convertLocalDateTimeToUTC(this.reportFilter.dateRange.end);
          }
        }

        // Ajustar fechas con el utcOffset del protocolo antes de enviar al backend
        if (!fromDate || !toDate) {
          throw new Error('Las fechas de inicio y fin son requeridas para cargar historial');
        }
        
        this.routeHistory = await this.targetsService.getRouteHistory(
          deviceImei, 
          fromDate, 
          toDate,
          this.reportFilter.minStopDurationFilter
        );
        this.routeReportCacheContext = {
          deviceImei,
          fromDate,
          toDate,
          source: 'hybrid',
          minStopDuration: Number(this.reportFilter.minStopDurationFilter || 20)
        };
        await this.loadRouteDistance(selectedTargetId, fromDate, toDate);
        this.refreshRouteSummaryInfoPanel();
        
      
        
      } catch (error) {
        console.error('Error cargando historial de rutas:', error);
        throw error;
      } finally {
        this.loadingRouteHistory = false;
      }
    }

    /**
     * Maneja el cambio del checkbox "Incluir paradas" en tiempo real
     */
    onIncludeStopsChange(includeStops: boolean): void {
      
      // Las paradas ahora se calculan automáticamente en el mapa
                 if (includeStops) {
             this.messageService.add({
               severity: 'info',
          summary: 'Paradas habilitadas',
          detail: 'Las paradas se calcularán automáticamente a partir de posiciones con velocidad 0',
          life: 3000
        });
        } else {
          this.messageService.add({
            severity: 'info',
            summary: 'Paradas ocultas',
            detail: 'Las paradas han sido ocultadas del mapa',
            life: 2000
          });
      }
      
      // Forzar actualización del mapa
      this.cdr.detectChanges();
    }

    onMapInfoPanelChange(data: ReportsMapInfoPanelData | null): void {
      this.mapInfoPanelData = this.withRouteDistanceInfo(data);
    }

    onCalculatedStopsChange(stops: any[]): void {
      if (this.routeStopsLoadedFromCache && this.calculatedStops.length > 0) {
        return;
      }

      const incomingStops = stops?.length ? stops : this.calculateStopsFromRouteHistory();
      this.calculatedStops = [...(incomingStops || [])].sort((a, b) => {
        const aTime = new Date(a.startTime || a.endTime || 0).getTime();
        const bTime = new Date(b.startTime || b.endTime || 0).getTime();
        return aTime - bTime;
      });
      this.enrichStopAddresses();
      this.cdr.detectChanges();
      this.scheduleStopPreviewMaps();
    }

    private applyCachedStopsOrCalculate(): void {
      const cachedStops = this.routeHistory?.cachedStops || [];

      if (cachedStops.length > 0) {
        this.calculatedStops = [...cachedStops].sort((a, b) => {
          const aTime = new Date(a.startTime || a.endTime || 0).getTime();
          const bTime = new Date(b.startTime || b.endTime || 0).getTime();
          return aTime - bTime;
        });
        this.routeStopsLoadedFromCache = true;
        this.enrichStopAddresses();
        return;
      }

      this.routeStopsLoadedFromCache = false;
      this.updateStopsFromRouteHistory();
    }

    private updateStopsFromRouteHistory(): void {
      this.calculatedStops = this.calculateStopsFromRouteHistory();
      this.enrichStopAddresses();
    }

    private async loadMapboxAccessToken(): Promise<void> {
      try {
        const systems = await firstValueFrom(this.systemService.getAll());
        const mapboxConfig = systems?.[0]?.map_api2;
        this.mapboxAccessToken = mapboxConfig?.key || null;
      } catch (error) {
        console.warn('No se pudo cargar la configuración de Mapbox:', error);
        this.mapboxAccessToken = null;
      }
    }

    private enrichStopAddresses(): void {
      if (!this.calculatedStops.length) {
        return;
      }

      if (!this.mapboxAccessToken) {
        this.loadMapboxAccessToken().then(() => this.enrichStopAddresses());
        return;
      }

      this.calculatedStops.forEach((stop, index) => {
        const lat = Number(stop.latitude);
        const lng = Number(stop.longitude);
        if (Number.isNaN(lat) || Number.isNaN(lng)) {
          return;
        }

        const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
        const cachedAddress = this.reverseGeocodeCache.get(cacheKey);
        if (cachedAddress) {
          this.calculatedStops[index] = { ...stop, address: cachedAddress };
          this.scheduleRouteReportCacheSync();
          return;
        }

        if (!stop.address || stop.address === 'Dirección no disponible') {
          this.calculatedStops[index] = { ...stop, address: 'Buscando dirección...' };
        }

        this.getMapboxAddress(lat, lng)
          .then(address => {
            if (!address) {
              return;
            }

            this.reverseGeocodeCache.set(cacheKey, address);
            this.calculatedStops = this.calculatedStops.map((currentStop, currentIndex) =>
              currentIndex === index ? { ...currentStop, address } : currentStop
            );
            this.cdr.detectChanges();
            this.scheduleRouteReportCacheSync();
          })
          .catch(error => {
            console.warn('No se pudo obtener dirección de Mapbox:', error);
          });
      });

      this.scheduleRouteReportCacheSync();
    }

    private async getMapboxAddress(lat: number, lng: number): Promise<string | null> {
      if (!this.mapboxAccessToken) {
        return null;
      }

      const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`);
      url.searchParams.set('access_token', this.mapboxAccessToken);
      url.searchParams.set('language', 'es');
      url.searchParams.set('limit', '1');

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Mapbox geocoding error ${response.status}`);
      }

      const data = await response.json();
      return data?.features?.[0]?.place_name || null;
    }

    private scheduleRouteReportCacheSync(): void {
      if (!this.routeReportCacheContext || !this.routeHistory?.positions?.length) {
        return;
      }

      if (this.routeReportCacheSyncTimer) {
        clearTimeout(this.routeReportCacheSyncTimer);
      }

      this.routeReportCacheSyncTimer = setTimeout(() => {
        this.syncRouteReportCache().catch(error => {
          console.warn('No se pudo sincronizar la caché del reporte:', error);
        });
      }, 1200);
    }

    private async syncRouteReportCache(): Promise<void> {
      if (!this.routeReportCacheContext || !this.routeHistory?.positions?.length) {
        return;
      }

      const stopsToCache = this.calculatedStops.map((stop, index) => ({
        ...stop,
        stopNumber: stop.stopNumber || index + 1,
        durationText: this.getStopDuration(stop),
        address: stop.address && stop.address !== 'Buscando dirección...'
          ? stop.address
          : 'Dirección no disponible'
      }));
      const signature = JSON.stringify({
        context: this.routeReportCacheContext,
        positions: this.routeHistory.totalPositions || this.routeHistory.positions.length,
        stops: stopsToCache.map(stop => ({
          startTime: stop.startTime,
          endTime: stop.endTime,
          latitude: stop.latitude,
          longitude: stop.longitude,
          address: stop.address
        })),
        distanceMeters: this.routeDistanceMeters
      });

      if (signature === this.lastRouteReportCacheSyncSignature) {
        return;
      }

      this.lastRouteReportCacheSyncSignature = signature;
      await this.targetsService.updateRouteHistoryCache(this.routeReportCacheContext.deviceImei, {
        fromDate: this.routeReportCacheContext.fromDate,
        toDate: this.routeReportCacheContext.toDate,
        source: this.routeReportCacheContext.source,
        minStopDuration: this.routeReportCacheContext.minStopDuration,
        positions: this.routeHistory.positions,
        totalPositions: this.routeHistory.totalPositions || this.routeHistory.positions.length,
        stops: stopsToCache,
        distanceMeters: this.routeDistanceMeters
      });
    }

    private calculateStopsFromRouteHistory(): any[] {
      const positions = this.routeHistory?.positions || [];
      if (positions.length === 0) {
        return [];
      }

      const sortedPositions = [...positions].sort((a, b) => {
        const aTime = new Date(a.fixTime || a.deviceTime || a.serverTime || 0).getTime();
        const bTime = new Date(b.fixTime || b.deviceTime || b.serverTime || 0).getTime();
        return aTime - bTime;
      });
      const minStopDurationMs = Math.max(0, Number(this.reportFilter.minStopDurationFilter || 1)) * 60000;
      const maxDistanceMeters = 80;
      const stoppedSpeedThreshold = 1;
      const stops: any[] = [];
      let currentStop: any = null;

      for (const position of sortedPositions) {
        const speed = Number(position.speed || 0);
        const lat = Number(position.latitude);
        const lng = Number(position.longitude);
        const time = position.fixTime || position.deviceTime || position.serverTime;

        if (Number.isNaN(lat) || Number.isNaN(lng) || !time) {
          continue;
        }

        const isStopped = speed <= stoppedSpeedThreshold;

        if (isStopped) {
          if (!currentStop) {
            currentStop = {
              startPosition: position,
              endPosition: position,
              startTime: time,
              endTime: time,
              latitude: lat,
              longitude: lng,
              positions: [position],
              address: position.address || 'Dirección no disponible'
            };
            continue;
          }

          const distance = this.calculateDistanceMeters(currentStop.latitude, currentStop.longitude, lat, lng);
          if (distance <= maxDistanceMeters) {
            currentStop.endPosition = position;
            currentStop.endTime = time;
            currentStop.positions.push(position);
          } else {
            this.pushStopIfValid(stops, currentStop, minStopDurationMs);
            currentStop = {
              startPosition: position,
              endPosition: position,
              startTime: time,
              endTime: time,
              latitude: lat,
              longitude: lng,
              positions: [position],
              address: position.address || 'Dirección no disponible'
            };
          }
        } else if (currentStop) {
          this.pushStopIfValid(stops, currentStop, minStopDurationMs);
          currentStop = null;
        }
      }

      if (currentStop) {
        this.pushStopIfValid(stops, currentStop, minStopDurationMs);
      }

      return stops.map((stop, index) => ({
        ...stop,
        stopNumber: index + 1,
        durationText: this.getStopDuration(stop)
      }));
    }

    private pushStopIfValid(stops: any[], stop: any, minStopDurationMs: number): void {
      const startTime = new Date(stop.startTime || 0).getTime();
      const endTime = new Date(stop.endTime || 0).getTime();

      if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
        return;
      }

      if (endTime - startTime >= minStopDurationMs) {
        stops.push(stop);
      }
    }

    private calculateDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
      const earthRadiusMeters = 6371000;
      const toRadians = (degrees: number) => degrees * Math.PI / 180;
      const deltaLat = toRadians(lat2 - lat1);
      const deltaLng = toRadians(lng2 - lng1);
      const a =
        Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
        Math.cos(toRadians(lat1)) *
          Math.cos(toRadians(lat2)) *
          Math.sin(deltaLng / 2) *
          Math.sin(deltaLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return earthRadiusMeters * c;
    }

    showStopsPanel(): boolean {
      return this.reportFilter.reportType === 'route_history' && this.hasGeneratedRouteReport;
    }

    backToReportFilters(): void {
      this.hasGeneratedRouteReport = false;
      this.destroyStopPreviewMaps();
    }

    formatStopDate(dateString: string): string {
      if (!dateString) {
        return 'Sin fecha';
      }

      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) {
        return 'Sin fecha';
      }

      return date.toLocaleString('es-DO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    }

    getStopDuration(stop: any): string {
      if (stop?.durationText) {
        return stop.durationText;
      }

      const startTime = new Date(stop?.startTime || 0).getTime();
      const endTime = new Date(stop?.endTime || 0).getTime();

      if (!startTime || !endTime || Number.isNaN(startTime) || Number.isNaN(endTime) || endTime < startTime) {
        return 'Sin duración';
      }

      const durationMs = endTime - startTime;
      const hours = Math.floor(durationMs / 3600000);
      const minutes = Math.floor((durationMs % 3600000) / 60000);
      const seconds = Math.floor((durationMs % 60000) / 1000);

      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }

      if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
      }

      return `${seconds}s`;
    }

    generateStopsPdf(): void {
      if (!this.calculatedStops.length) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Sin paradas',
          detail: 'No hay paradas para exportar.'
        });
        return;
      }

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
      const target = this.getSelectedTargetInfo();
      const targetName = target?.name || target?.alias || target?.device_imei || 'Vehiculo';
      const generatedAt = new Date().toLocaleString('es-DO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      const totalDuration = this.formatStopDurationMs(
        this.calculatedStops.reduce((sum, stop) => sum + this.getStopDurationMs(stop), 0)
      );
      const dateRangeLabel = `${this.formatPdfDate(this.reportFilter.dateRange.start)} - ${this.formatPdfDate(this.reportFilter.dateRange.end)}`;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(17);
      doc.setTextColor(31, 41, 55);
      doc.text('Reporte de paradas', 14, 16);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(85, 85, 85);
      doc.text(`Vehiculo: ${targetName}`, 14, 24);
      doc.text(`Rango: ${dateRangeLabel}`, 14, 30);
      doc.text(`Generado: ${generatedAt}`, 14, 36);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(220, 38, 38);
      doc.text(`${this.calculatedStops.length} parada${this.calculatedStops.length === 1 ? '' : 's'}`, pageWidth - 14, 24, { align: 'right' });
      doc.setTextColor(37, 99, 235);
      doc.text(`Duracion total: ${totalDuration}`, pageWidth - 14, 30, { align: 'right' });

      autoTable(doc, {
        startY: 45,
        head: [['#', 'Inicio', 'Fin', 'Duracion', 'Direccion', 'Coordenadas']],
        body: this.calculatedStops.map((stop, index) => [
          String(index + 1),
          this.formatPdfDate(stop.startTime),
          this.formatPdfDate(stop.endTime),
          this.getStopDuration(stop),
          this.getStopAddressForPdf(stop),
          this.getStopCoordinates(stop)
        ]),
        styles: {
          fontSize: 8,
          cellPadding: 2,
          overflow: 'linebreak',
          valign: 'top'
        },
        headStyles: {
          fillColor: [220, 38, 38],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { cellWidth: 9, halign: 'center' },
          1: { cellWidth: 26 },
          2: { cellWidth: 26 },
          3: { cellWidth: 20 },
          4: { cellWidth: 73 },
          5: { cellWidth: 34 }
        },
        margin: { left: 14, right: 14 },
        didDrawPage: () => {
          const pageNumber = doc.getNumberOfPages();
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(120, 120, 120);
          doc.text(`Pagina ${pageNumber}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
        }
      });

      const timestamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
      doc.save(`reporte-paradas-${this.sanitizeFileName(targetName)}-${timestamp}.pdf`);
    }

    private getStopDurationMs(stop: any): number {
      const startTime = new Date(stop?.startTime || 0).getTime();
      const endTime = new Date(stop?.endTime || 0).getTime();

      if (!startTime || !endTime || Number.isNaN(startTime) || Number.isNaN(endTime) || endTime < startTime) {
        return 0;
      }

      return endTime - startTime;
    }

    private formatStopDurationMs(durationMs: number): string {
      if (!durationMs || durationMs < 0) {
        return 'Sin duracion';
      }

      const hours = Math.floor(durationMs / 3600000);
      const minutes = Math.floor((durationMs % 3600000) / 60000);
      const seconds = Math.floor((durationMs % 60000) / 1000);

      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }

      if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
      }

      return `${seconds}s`;
    }

    private formatPdfDate(dateValue: Date | string | null | undefined): string {
      if (!dateValue) {
        return 'Sin fecha';
      }

      const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
      if (Number.isNaN(date.getTime())) {
        return 'Sin fecha';
      }

      return date.toLocaleString('es-DO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    }

    private getStopAddressForPdf(stop: any): string {
      if (stop?.address && stop.address !== 'Buscando dirección...') {
        return stop.address;
      }

      return 'Direccion no disponible';
    }

    private getStopCoordinates(stop: any): string {
      const lat = Number(stop?.latitude);
      const lng = Number(stop?.longitude);

      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        return 'Sin coordenadas';
      }

      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }

    private sanitizeFileName(value: string): string {
      return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase() || 'vehiculo';
    }

    trackByStop(index: number, stop: any): string {
      const lat = Number(stop?.latitude);
      const lng = Number(stop?.longitude);
      const start = stop?.startTime || '';
      const end = stop?.endTime || '';
      const latPart = Number.isNaN(lat) ? 'na' : lat.toFixed(6);
      const lngPart = Number.isNaN(lng) ? 'na' : lng.toFixed(6);

      return `${start}-${end}-${latPart}-${lngPart}-${index}`;
    }

    private scheduleStopPreviewMaps(): void {
      if (this.stopPreviewRenderScheduled) {
        return;
      }

      this.stopPreviewRenderScheduled = true;
      requestAnimationFrame(() => {
        this.stopPreviewRenderScheduled = false;
        this.renderStopPreviewMaps();
      });
    }

    private renderStopPreviewMaps(): void {
      if (!this.showStopsPanel() || !this.stopMapElements) {
        return;
      }

      const elements = this.stopMapElements.toArray();
      this.trimStopPreviewMaps(elements.length);

      elements.forEach((elementRef, index) => {
        const stop = this.calculatedStops[index];
        const lat = Number(stop?.latitude);
        const lng = Number(stop?.longitude);

        if (!stop || Number.isNaN(lat) || Number.isNaN(lng)) {
          return;
        }

        const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
        const existingMap = this.stopPreviewMaps[index];

        if (existingMap && existingMap.getContainer() === elementRef.nativeElement) {
          if (this.stopPreviewKeys[index] !== key) {
            existingMap.jumpTo({ center: [lng, lat], zoom: 15 });
            this.stopPreviewKeys[index] = key;
            existingMap.resize();
          }
          return;
        }

        if (existingMap) {
          existingMap.remove();
          this.stopPreviewMaps[index] = undefined as any;
          this.stopPreviewKeys[index] = '';
        }

        const map = new maplibregl.Map({
          container: elementRef.nativeElement,
          style: {
            version: 8,
            sources: {
              osm: {
                type: 'raster',
                tiles: [
                  'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
                ],
                tileSize: 256,
                attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>'
              }
            },
            layers: [
              {
                id: 'osm-layer',
                type: 'raster',
                source: 'osm',
                minzoom: 0,
                maxzoom: 19
              }
            ]
          },
          center: [lng, lat],
          zoom: 15,
          interactive: false,
          attributionControl: {}
        });

        this.stopPreviewMaps[index] = map;
        this.stopPreviewKeys[index] = key;
      });
    }

    private trimStopPreviewMaps(nextLength: number): void {
      for (let i = this.stopPreviewMaps.length - 1; i >= nextLength; i--) {
        this.stopPreviewMaps[i]?.remove();
        this.stopPreviewMaps.pop();
        this.stopPreviewKeys.pop();
      }
    }

    private destroyStopPreviewMaps(): void {
      this.stopPreviewMaps.forEach(map => map.remove());
      this.stopPreviewMaps = [];
      this.stopPreviewKeys = [];
    }

    private async loadRouteDistance(deviceId: string, fromDate: string, toDate: string): Promise<void> {
      this.loadingRouteDistance = true;

      try {
        const distanceResponse = await this.targetsService.getDeviceDistance(deviceId, fromDate, toDate);
        this.routeDistanceMeters = typeof distanceResponse.distance === 'number'
          ? distanceResponse.distance
          : null;
        this.startRouteDistanceRefresh(deviceId, fromDate, toDate);
      } catch (error) {
        console.warn('No se pudo cargar la distancia recorrida del reporte:', error);
        this.routeDistanceMeters = null;
      } finally {
        this.loadingRouteDistance = false;
      }
    }

    private startRouteDistanceRefresh(deviceId: string, fromDate: string, toDate: string): void {
      this.stopRouteDistanceRefresh();

      const fromTimestamp = new Date(fromDate).getTime();
      const toTimestamp = new Date(toDate).getTime();
      const now = Date.now();
      const isLiveRange =
        Number.isFinite(fromTimestamp) &&
        Number.isFinite(toTimestamp) &&
        fromTimestamp <= now &&
        now <= toTimestamp;

      if (!isLiveRange) {
        return;
      }

      this.routeDistanceRefreshContext = { deviceId, fromDate, toDate };
      this.routeDistanceRefreshTimer = setInterval(() => {
        void this.refreshLiveRouteDistance();
      }, this.routeDistanceRefreshIntervalMs);
    }

    private stopRouteDistanceRefresh(): void {
      if (this.routeDistanceRefreshTimer) {
        clearInterval(this.routeDistanceRefreshTimer);
        this.routeDistanceRefreshTimer = null;
      }
      this.routeDistanceRefreshContext = null;
      this.routeDistanceRefreshInFlight = false;
    }

    private async refreshLiveRouteDistance(): Promise<void> {
      const context = this.routeDistanceRefreshContext;
      if (!context || this.routeDistanceRefreshInFlight) {
        return;
      }

      if (Date.now() > new Date(context.toDate).getTime()) {
        this.stopRouteDistanceRefresh();
        return;
      }

      this.routeDistanceRefreshInFlight = true;
      try {
        const response = await this.targetsService.getDeviceDistance(
          context.deviceId,
          context.fromDate,
          context.toDate
        );

        if (
          this.routeDistanceRefreshContext === context &&
          typeof response?.distance === 'number'
        ) {
          this.routeDistanceMeters = response.distance;
          this.refreshRouteSummaryInfoPanel();
          this.cdr.detectChanges();
        }
      } catch (error) {
        console.warn('No se pudo actualizar la distancia en vivo del reporte:', error);
      } finally {
        this.routeDistanceRefreshInFlight = false;
      }
    }

    private getRouteDistanceInfoItem(): ReportsMapInfoPanelItem {
      return {
        label: 'Kilómetros recorridos',
        value: this.formatRouteDistance(),
        color: this.routeDistanceMeters !== null ? '#2563eb' : undefined
      };
    }

    private formatRouteDistance(): string {
      if (this.loadingRouteDistance) {
        return 'Calculando...';
      }

      if (this.routeDistanceMeters === null) {
        return 'No disponible';
      }

      const kilometers = this.routeDistanceMeters / 1000;
      return `${kilometers.toLocaleString('es-DO', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })} km`;
    }

    private withRouteDistanceInfo(data: ReportsMapInfoPanelData | null): ReportsMapInfoPanelData | null {
      if (this.reportFilter.reportType !== 'route_history') {
        return data;
      }

      const distanceItem = this.getRouteDistanceInfoItem();

      if (!data) {
        if (!this.routeHistory) {
          return null;
        }

        return {
          title: 'Resumen del recorrido',
          items: [distanceItem]
        };
      }

      const allowedLabels = new Set([
        'fecha y hora',
        'fecha y hora final',
        'fecha y hora de detención',
        'velocidad',
        'velocidad final'
      ]);
      const visibleRouteItems = data.items
        .filter(item => allowedLabels.has(item.label.toLowerCase()))
        .map(item => ({
          ...item,
          label: item.label.toLowerCase().startsWith('fecha y hora')
            ? 'Fecha y hora'
            : item.label.toLowerCase().startsWith('velocidad')
              ? 'Velocidad'
              : item.label
        }));

      return {
        ...data,
        title: /^Posición\s+\d+/i.test(data.title) ? 'Recorrido' : data.title,
        items: [distanceItem, ...visibleRouteItems]
      };
    }

    private refreshRouteSummaryInfoPanel(): void {
      this.mapInfoPanelData = this.withRouteDistanceInfo(this.mapInfoPanelData);
      this.cdr.detectChanges();
    }






    /**
     * Maneja el cambio del filtro de duración mínima de paradas
     */
    onMinStopDurationChange(minDuration: number): void {
      
      // Convertir a número por si viene como string del select
      this.reportFilter.minStopDurationFilter = Number(minDuration);
      this.updateStopsFromRouteHistory();
      this.cdr.detectChanges();
      this.scheduleStopPreviewMaps();
      
      // Si hay un reporte ya generado y las paradas están habilitadas, actualizar en tiempo real
      if (this.routeHistory && this.routeHistory.positions && this.routeHistory.positions.length > 0 && this.reportFilter.includeStops) {
        
        this.messageService.add({
          severity: 'info',
          summary: 'Filtro actualizado',
          detail: `Mostrando paradas de ${minDuration} minuto${minDuration > 1 ? 's' : ''} en adelante`,
          life: 3000
        });
        
        // Forzar actualización del mapa (que recalculará las paradas con el nuevo filtro)
        this.cdr.detectChanges();
      }
    }

    /**
     * Carga progresiva del historial de rutas día por día con streaming
     */
    private async loadRouteHistoryProgressive(): Promise<void> {
      this.loadingRouteHistory = true;
      this.progressiveLoading.isActive = true;
      this.progressiveLoading.isStreamingMode = true;
      this.progressiveLoading.replayStarted = false;
      this.progressiveLoading.totalPositionsLoaded = 0;
      
      // Inicializar historial vacío
      this.routeHistory = {
        positions: [],
        totalPositions: 0
      };
      
      try {
        let selectedTarget: any;
        let selectedTargetId: string;
        
        // Obtener target (misma lógica que loadRouteHistory)
        if (this.targetIdFromUrl) {
          selectedTargetId = this.targetIdFromUrl;
          
          try {
            selectedTarget = await this.targetsService.getTargetById(selectedTargetId);
          } catch (error) {
            throw new Error(`No se encontró el dispositivo con ID: ${selectedTargetId}`);
          }
          
        } else if (this.reportFilter.selectedTargets.length > 0) {
          selectedTargetId = this.reportFilter.selectedTargets[0]._id || this.reportFilter.selectedTargets[0];
          selectedTarget = this.targets.find(t => t._id === selectedTargetId);
          
        } else if (this.targets.length > 0) {
          selectedTarget = this.targets[0];
          selectedTargetId = selectedTarget._id;
          
        } else {
          throw new Error('No hay dispositivos disponibles para el historial');
        }
        
        if (!selectedTarget) {
          throw new Error('No se encontró el dispositivo seleccionado');
        }
        
        // Consultar protocolo del target usando su propiedad 'type'
        await this.loadTargetProtocol(selectedTarget);
        
        const deviceImei = selectedTarget?.device_imei || selectedTarget?.imei;
        
        if (!deviceImei) {
          throw new Error(`El dispositivo "${selectedTarget.name}" no tiene un IMEI válido`);
        }

        // Validar y convertir fechas
        if (!this.reportFilter.dateRange.start || !this.reportFilter.dateRange.end) {
          throw new Error('Se requieren fechas de inicio y fin para la carga progresiva');
        }
        
        const startDate = this.reportFilter.dateRange.start instanceof Date 
          ? this.reportFilter.dateRange.start 
          : new Date(this.reportFilter.dateRange.start);
        const endDate = this.reportFilter.dateRange.end instanceof Date 
          ? this.reportFilter.dateRange.end 
          : new Date(this.reportFilter.dateRange.end);
          
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new Error('Fechas inválidas para la carga progresiva');
        }

        const fullFromDate = startDate.toISOString();
        const fullToDate = endDate.toISOString();
        this.routeReportCacheContext = {
          deviceImei,
          fromDate: fullFromDate,
          toDate: fullToDate,
          source: 'hybrid',
          minStopDuration: Number(this.reportFilter.minStopDurationFilter || 20)
        };

        const cachedFullHistory = await this.targetsService.getRouteHistory(
          deviceImei,
          fullFromDate,
          fullToDate,
          this.reportFilter.minStopDurationFilter,
          true
        );

        if (cachedFullHistory?.fromCache && cachedFullHistory.positions?.length) {
          this.routeHistory = cachedFullHistory;
          this.progressiveLoading.totalPositionsLoaded = cachedFullHistory.positions.length;
          this.progressiveLoading.isActive = false;
          this.progressiveLoading.isStreamingMode = false;
          this.progressiveLoading.replayStarted = false;
          await this.loadRouteDistance(selectedTargetId, fullFromDate, fullToDate);
          this.refreshRouteSummaryInfoPanel();
          this.cdr.detectChanges();
          return;
        }

        // Dividir en bloques de 5 horas
        const hourRanges = this.getHourRanges(startDate, endDate);
        this.progressiveLoading.totalBlocks = hourRanges.length;
        this.progressiveLoading.currentBlock = 0;
        await this.loadRouteDistance(selectedTargetId, fullFromDate, fullToDate);
        this.refreshRouteSummaryInfoPanel();
        
        // STREAMING MODE: Cargar primer bloque e iniciar reproducción
        await this.loadFirstBlockAndStartReplay(hourRanges, deviceImei);
        
        // CONTINUAR CARGA EN SEGUNDO PLANO: Cargar bloques restantes mientras se reproduce
        if (hourRanges.length > 1) {
          this.loadRemainingBlocksInBackground(hourRanges.slice(1), deviceImei);
        }
        
   
        
      } catch (error) {
        console.error('❌ Error en carga progresiva:', error);
        
        // Limpiar estado en caso de error
        this.routeHistory = null;
        this.progressiveLoading.totalPositionsLoaded = 0;
        
        throw error;
      } finally {
        this.loadingRouteHistory = false;
        this.progressiveLoading.isActive = false;
        this.progressiveLoading.isStreamingMode = false;
        this.progressiveLoading.replayStarted = false;
        this.progressiveLoading.currentBlock = 0;
        this.progressiveLoading.currentRange = '';
      }
    }

    /**
     * Cargar el primer bloque de 5 horas e iniciar la reproducción inmediatamente
     */
    private async loadFirstBlockAndStartReplay(hourRanges: Array<{start: Date, end: Date, rangeStr: string}>, deviceImei: string): Promise<void> {
      const firstHourRange = hourRanges[0];
      this.progressiveLoading.currentBlock = 1;
      this.progressiveLoading.currentRange = firstHourRange.rangeStr;
      
      
      // Ajustar fechas del bloque con el utcOffset del protocolo
      try {
        const firstBlockHistory = await this.targetsService.getRouteHistory(
          deviceImei,
          firstHourRange.start.toISOString(),
          firstHourRange.end.toISOString(),
          this.reportFilter.minStopDurationFilter
        );
        
        if (firstBlockHistory && firstBlockHistory.positions && firstBlockHistory.positions.length > 0) {
          // Agregar posiciones del primer bloque creando nueva referencia
          this.routeHistory = {
            ...this.routeHistory!,
            positions: [...this.routeHistory!.positions, ...firstBlockHistory.positions],
            totalPositions: this.routeHistory!.positions.length + firstBlockHistory.positions.length
          };
          this.progressiveLoading.totalPositionsLoaded = this.routeHistory.positions.length;
          
          
          // Marcar que la reproducción debería iniciar automáticamente
          this.progressiveLoading.replayStarted = true;
          
          // Forzar detección de cambios para que el mapa reciba los datos
          this.cdr.detectChanges();
          
          // Pequeña pausa para asegurar que el mapa se actualice antes de iniciar reproducción
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Resetear la bandera después de que se haya usado
          this.progressiveLoading.replayStarted = false;
          this.cdr.detectChanges();
          
        } else {
        }
        
      } catch (error) {
        console.error(`❌ Error cargando primer bloque (${firstHourRange.rangeStr}):`, error);
        throw error;
      }
    }

    /**
     * Cargar los bloques restantes en segundo plano mientras se reproduce el historial
     */
    private loadRemainingBlocksInBackground(remainingHourRanges: Array<{start: Date, end: Date, rangeStr: string}>, deviceImei: string): void {
      
      // Usar async/await en una función separada para manejar la carga en segundo plano
      this.processRemainingBlocksAsync(remainingHourRanges, deviceImei);
    }

    /**
     * Procesar los bloques restantes de forma asíncrona
     */
    private async processRemainingBlocksAsync(remainingHourRanges: Array<{start: Date, end: Date, rangeStr: string}>, deviceImei: string): Promise<void> {
      for (let i = 0; i < remainingHourRanges.length; i++) {
        const hourRange = remainingHourRanges[i];
        const blockNumber = i + 2; // +2 porque empezamos desde el segundo bloque
        
        this.progressiveLoading.currentBlock = blockNumber;
        this.progressiveLoading.currentRange = hourRange.rangeStr;
        
        
        // Ajustar fechas del bloque con el utcOffset del protocolo
        try {
          const blockHistory = await this.targetsService.getRouteHistory(
            deviceImei,
            hourRange.start.toISOString(),
            hourRange.end.toISOString(),
            this.reportFilter.minStopDurationFilter
          );
          
          if (blockHistory && blockHistory.positions && blockHistory.positions.length > 0) {
            // Agregar posiciones del bloque al historial total creando nueva referencia
            this.routeHistory = {
              ...this.routeHistory!,
              positions: [...this.routeHistory!.positions, ...blockHistory.positions],
              totalPositions: this.routeHistory!.positions.length + blockHistory.positions.length
            };
            this.progressiveLoading.totalPositionsLoaded = this.routeHistory.positions.length;
            
            
            // Forzar detección de cambios para que el mapa reciba los nuevos datos
            this.cdr.detectChanges();
            
            
          } else {
          }
          
          // Pausa más corta para bloques de 5 horas (menos tiempo que días completos)
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (blockError) {
          console.warn(`⚠️ [Segundo plano] Error cargando bloque ${blockNumber} (${hourRange.rangeStr}):`, blockError);
          // Continuar con el siguiente bloque en caso de error
        }
      }
      
      
      // Finalizar estado de carga pero mantener la reproducción
      this.progressiveLoading.isActive = false;
      this.progressiveLoading.isStreamingMode = false;
      this.loadingRouteHistory = false;
      this.routeStopsLoadedFromCache = false;
      this.updateStopsFromRouteHistory();
      this.scheduleStopPreviewMaps();
      this.scheduleRouteReportCacheSync();
      
      // Forzar detección de cambios para que el mapa sea notificado del cambio de estado
      this.cdr.detectChanges();
      
              // Calcular estadísticas de filtrado por velocidad
        const totalPositions = this.routeHistory!.totalPositions;
        const movingPositions = this.routeHistory!.positions.filter(pos => pos.speed > 0).length;
        const stoppedPositions = totalPositions - movingPositions;
        
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('reports.streaming_complete'),
          detail: `${totalPositions} posiciones cargadas (${this.progressiveLoading.totalBlocks} bloques). ${movingPositions} con movimiento, ${stoppedPositions} detenidas (velocidad 0)`,
          life: 8000
        });
    }

    getReportTypeName(): string {
      const reportType = this.reportTypes.find(rt => rt.value === this.reportFilter.reportType);
      return reportType?.label || 'Reporte';
    }

    clearFilters(): void {
      this.stopRouteDistanceRefresh();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      yesterday.setHours(0, 0, 0, 0); // Inicio a las 00:00
      
      const today = new Date();
      today.setHours(23, 59, 0, 0); // Final a las 23:59
      
      this.reportFilter = {
        reportType: 'movements',
        dateRange: {
          start: this.formatDateForInput(yesterday),
          end: this.formatDateForInput(today)
        },
        selectedTargets: [],
        speedFilter: { min: null, max: null },
        distanceFilter: { min: null, max: null },
        stopTimeFilter: { min: null, max: null },
        includeStops: true,
        minStopDurationFilter: 20,
        exportFormat: 'pdf'
      };
      
      // Limpiar datos cargados
      this.routeHistory = null;
      this.stops = [];
      this.calculatedStops = [];
      this.hasGeneratedRouteReport = false;
      this.routeStopsLoadedFromCache = false;
      this.routeReportCacheContext = null;
      this.lastRouteReportCacheSyncSignature = '';
      if (this.routeReportCacheSyncTimer) {
        clearTimeout(this.routeReportCacheSyncTimer);
      }
      this.destroyStopPreviewMaps();
      
      this.messageService.add({
        severity: 'info',
        summary: 'Filtros limpiados',
        detail: 'Se han restaurado los filtros por defecto'
      });
    }



  // Métodos auxiliares para el template
  getSelectedReportTypeIcon(): string {
    const reportType = this.reportTypes.find(rt => rt.value === this.reportFilter.reportType);
    return reportType?.icon || 'pi pi-chart-line';
  }

  getSelectedReportTypeLabel(): string {
    const reportType = this.reportTypes.find(rt => rt.value === this.reportFilter.reportType);
    return reportType?.label || 'Reporte';
  }

  getSelectedExportFormatIcon(): string {
    const exportFormat = this.exportFormats.find(ef => ef.value === this.reportFilter.exportFormat);
    return exportFormat?.icon || 'pi pi-file';
  }

  getSelectedExportFormatLabel(): string {
    const exportFormat = this.exportFormats.find(ef => ef.value === this.reportFilter.exportFormat);
    return exportFormat?.label || 'Formato';
  }



  // Métodos auxiliares para mostrar filtros según el tipo de reporte
  shouldShowSpeedFilter(): boolean {
    return ['speed', 'movements', 'detailed'].includes(this.reportFilter.reportType);
  }

  shouldShowDistanceFilter(): boolean {
    return ['movements', 'detailed'].includes(this.reportFilter.reportType);
  }

  shouldShowStopTimeFilter(): boolean {
    return this.reportFilter.reportType === 'stops' || this.reportFilter.reportType === 'detailed';
  }

  shouldShowMap(): boolean {
    return this.reportFilter.reportType === 'route_history';
  }

      getSelectedTargetForMap(): any {
      // Priorizar el target ID de la URL
      let selectedTargetId: string | null = null;
      
      if (this.targetIdFromUrl) {
        selectedTargetId = this.targetIdFromUrl;
      } else if (this.reportFilter.selectedTargets.length > 0) {
        selectedTargetId = this.reportFilter.selectedTargets[0]._id || this.reportFilter.selectedTargets[0];
      } else if (this.reportFilter.reportType === 'route_history' && this.targets.length > 0) {
        selectedTargetId = this.targets[0]._id;
      }
      
      if (selectedTargetId) {
        const target = this.targets.find(target => target._id === selectedTargetId);
        
        // Si hay historial de rutas cargado, agregar las posiciones al target
        if (this.routeHistory && this.routeHistory.positions.length > 0 && target) {
          return {
            ...target,
            routeHistory: this.routeHistory
          };
        }
        
        return target || null;
      }
      
      return null;
    }

    getSelectedTargetInfo(): any {
      // Retornar información del target seleccionado para mostrar en la interfaz
      if (this.targetIdFromUrl) {
        return this.targets.find(target => target._id === this.targetIdFromUrl);
      } else if (this.reportFilter.selectedTargets.length > 0) {
        return this.reportFilter.selectedTargets[0];
      }
      return null;
    }

  // Método auxiliar para obtener el target ID actual
  getCurrentTargetId(): string | null {
    if (this.targetIdFromUrl) {
      return this.targetIdFromUrl;
    } else if (this.reportFilter.selectedTargets.length > 0) {
      return this.reportFilter.selectedTargets[0]._id || this.reportFilter.selectedTargets[0];
    } else if (this.targets.length > 0) {
      return this.targets[0]._id;
    }
    return null;
  }

  getRouteHistoryPositions(): RouteHistoryPosition[] {
    return this.routeHistory?.positions || [];
  }

  hasRouteHistoryData(): boolean {
    return !!(this.routeHistory && this.routeHistory.positions.length > 0);
  }

  /**
   * Determina si debe usar carga progresiva basado en el rango de fechas
   */
  private shouldUseProgressiveLoading(): boolean {
    if (!this.reportFilter.dateRange.start || !this.reportFilter.dateRange.end) {
      return false;
    }
    
    const startDate = this.reportFilter.dateRange.start instanceof Date 
      ? this.reportFilter.dateRange.start 
      : new Date(this.reportFilter.dateRange.start);
    const endDate = this.reportFilter.dateRange.end instanceof Date 
      ? this.reportFilter.dateRange.end 
      : new Date(this.reportFilter.dateRange.end);
    
    // Calcular diferencia en horas
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    
    // Usar carga progresiva si es más de 5 horas (más de un bloque)
    return diffHours > 5;
  }

  /**
   * Divide un rango de fechas en bloques de 5 horas
   */
  private getHourRanges(startDate: Date, endDate: Date): Array<{start: Date, end: Date, rangeStr: string}> {
    const blocks: Array<{start: Date, end: Date, rangeStr: string}> = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const blockStart = new Date(current);
      
      // Calcular el final del bloque (5 horas después)
      const blockEnd = new Date(current);
      blockEnd.setHours(blockEnd.getHours() + 5);
      
      // No sobrepasar la fecha final
      if (blockEnd > endDate) {
        blockEnd.setTime(endDate.getTime());
      }
      
      // Crear string descriptivo del rango
      const startTimeStr = blockStart.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const endTimeStr = blockEnd.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric', 
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const rangeStr = `${startTimeStr} - ${endTimeStr}`;
      
      blocks.push({
        start: new Date(blockStart),
        end: new Date(blockEnd),
        rangeStr
      });
      
      // Avanzar 5 horas para el siguiente bloque
      current.setHours(current.getHours() + 5);
      
      // Si hemos llegado al final del rango, salir del bucle
      if (current >= endDate) {
        break;
      }
    }
    
    return blocks;
  }

  // Método para exportar reporte (placeholder)
  exportReport(): void {
    this.messageService.add({
      severity: 'info',
      summary: 'Exportar',
      detail: 'Función de exportación en desarrollo'
    });
  }
}
