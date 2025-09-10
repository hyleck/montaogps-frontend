import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MenuItem, MessageService } from 'primeng/api';
import { TargetsService } from '@core/services/targets.service';
import { ProtocolsService } from '@core/services/protocols.service';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from '@core/services/auth.service';
import { ThemesService } from '@shared/services/themes.service';
import { RouteHistoryResponse, RouteHistoryPosition } from '@core/interfaces';

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
export class ReportsComponent implements OnInit {

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
      { label: 'Reporte de Movimientos', value: 'movements', icon: 'pi pi-map' },
      { label: 'Reporte de Paradas', value: 'stops', icon: 'pi pi-pause' },
      { label: 'Reporte de Velocidad', value: 'speed', icon: 'pi pi-clock' },
      { label: 'Reporte de Combustible', value: 'fuel', icon: 'pi pi-dollar' },
      { label: 'Reporte de Actividad', value: 'activity', icon: 'pi pi-chart-line' },
      { label: 'Reporte Detallado', value: 'detailed', icon: 'pi pi-list' }
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

    constructor(
      private targetsService: TargetsService,
      private protocolsService: ProtocolsService,
      private messageService: MessageService,
      private translate: TranslateService,
      private authService: AuthService,
      private themesService: ThemesService,
      private route: ActivatedRoute,
      private cdr: ChangeDetectorRef
    ) {}

    ngOnInit(): void {
      // Inicializar fechas por defecto
      this.initializeDateRange();
      
      // Inicializar tipos de reportes básicos (sin Historial de Recorrido)
      this.updateAvailableReportTypes(false);
      
      this.loadTargets();
      
      // Capturar targetId de la URL si existe (parámetro de ruta)
      this.route.params.subscribe(params => {
        const targetId = params['targetId'];
        if (targetId) {
          this.targetIdFromUrl = targetId; // Almacenar el target ID de la ruta
          this.updateAvailableReportTypes(true); // Habilitar Historial de Recorrido
          this.preselectTarget(targetId);
        }
      });

      // Capturar query parameters (target y type)
      this.route.queryParams.subscribe(queryParams => {
        const target = queryParams['target'];
        const type = queryParams['type'];
        
        if (target) {
          this.targetIdFromUrl = target; // Almacenar el target ID de la URL
          this.updateAvailableReportTypes(true); // Habilitar Historial de Recorrido
          this.preselectTarget(target);
        }
        
        if (type) {
          this.preselectReportType(type);
        }
      });
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

    private preselectTarget(targetId: string): void {
      // Esperar a que los targets se carguen antes de preseleccionar
      const checkTargets = () => {
        if (this.targets.length > 0) {
          const targetToSelect = this.targets.find(target => 
            target._id === targetId || target.id === targetId
          );
          
          if (targetToSelect) {
            this.reportFilter.selectedTargets = [targetToSelect];
            
            // Mostrar mensaje informativo
            this.messageService.add({
              severity: 'info',
              summary: 'Target seleccionado',
              detail: `Se ha seleccionado "${targetToSelect.name || targetToSelect.alias}" para el reporte`
            });
          } else {
            console.warn('⚠️ Target no encontrado con ID:', targetId);
          }
        } else if (!this.loading) {
          // Si no está cargando y no hay targets, el target no existe
          console.warn('⚠️ No se encontraron targets o el target no existe');
        } else {
          // Reintentar después de un momento si aún está cargando
          setTimeout(checkTargets, 100);
        }
      };
      
      checkTargets();
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
      const range = preset.getRange();
      
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
     * Convierte una fecha del input datetime-local a UTC explícitamente
     * Trata la hora local como si fuera UTC (sin conversión de zona horaria)
     */
    private convertLocalDateTimeToUTC(dateTimeLocalString: string): string {
      if (!dateTimeLocalString) return '';
      
      // Parsear el string datetime-local
      const [datePart, timePart] = dateTimeLocalString.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, minutes] = timePart.split(':').map(Number);
      
      // Crear fecha UTC directamente con los valores locales
      // Esto trata la hora ingresada como UTC sin conversión de zona horaria
      const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
      
      console.log(`🔄 Conversión datetime-local → UTC:`, {
        input: dateTimeLocalString,
        parsedValues: { year, month, day, hours, minutes },
        utcOutput: utcDate.toISOString(),
        localDate: new Date(dateTimeLocalString).toISOString(),
        isExplicitUTC: true
      });
      
      return utcDate.toISOString();
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

    onReportTypeChange(): void {
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
      }
    }

    private async simulateReportGeneration(): Promise<void> {
      // Simular tiempo de generación
      return new Promise(resolve => setTimeout(resolve, 2000));
    }

    /**
     * Ajusta las fechas del filtro sumando el utcOffset del protocolo antes de enviar al backend
     * Esto compensa la diferencia horaria para que el servidor consulte el rango correcto
     */
    private adjustDatesWithProtocolOffset(fromDate: string | undefined, toDate: string | undefined): { fromDate: string | undefined, toDate: string | undefined } {
      if (!this.targetProtocol || this.targetProtocol.utcOffset === undefined || this.targetProtocol.utcOffset === null) {
     
        return { fromDate, toDate };
      }

      const offsetHours = this.targetProtocol.utcOffset;
      let adjustedFromDate = fromDate;
      let adjustedToDate = toDate;

      if (fromDate) {
        const fromDateObj = new Date(fromDate);
        fromDateObj.setHours(fromDateObj.getHours() + offsetHours);
        adjustedFromDate = fromDateObj.toISOString();
      }

      if (toDate) {
        const toDateObj = new Date(toDate);
        toDateObj.setHours(toDateObj.getHours() + offsetHours);
        adjustedToDate = toDateObj.toISOString();
      }

   

      return { 
        fromDate: adjustedFromDate, 
        toDate: adjustedToDate 
      };
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
          throw new Error(`El dispositivo "${selectedTarget.name || selectedTarget.alias}" no tiene un IMEI válido`);
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
        const adjustedDates = this.adjustDatesWithProtocolOffset(fromDate, toDate);
        
    
        
        if (!adjustedDates.fromDate || !adjustedDates.toDate) {
          throw new Error('Las fechas de inicio y fin son requeridas para cargar historial');
        }
        
        this.routeHistory = await this.targetsService.getRouteHistory(
          deviceImei, 
          adjustedDates.fromDate, 
          adjustedDates.toDate
        );
        
      
        
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






    /**
     * Maneja el cambio del filtro de duración mínima de paradas
     */
    onMinStopDurationChange(minDuration: number): void {
      
      // Convertir a número por si viene como string del select
      this.reportFilter.minStopDurationFilter = Number(minDuration);
      
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
          throw new Error(`El dispositivo "${selectedTarget.name || selectedTarget.alias}" no tiene un IMEI válido`);
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

        // Dividir en bloques de 5 horas
        const hourRanges = this.getHourRanges(startDate, endDate);
        this.progressiveLoading.totalBlocks = hourRanges.length;
        this.progressiveLoading.currentBlock = 0;
        
     
        
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
      const adjustedDates = this.adjustDatesWithProtocolOffset(
        firstHourRange.start.toISOString(),
        firstHourRange.end.toISOString()
      );
      
      if (!adjustedDates.fromDate || !adjustedDates.toDate) {
        throw new Error('Error ajustando fechas del primer bloque');
      }
      
      try {
        const firstBlockHistory = await this.targetsService.getRouteHistory(
          deviceImei,
          adjustedDates.fromDate,
          adjustedDates.toDate
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
        const adjustedDates = this.adjustDatesWithProtocolOffset(
          hourRange.start.toISOString(),
          hourRange.end.toISOString()
        );
        
        if (!adjustedDates.fromDate || !adjustedDates.toDate) {
          console.error(`❌ Error ajustando fechas del bloque ${blockNumber}`);
          continue;
        }
        
        try {
          const blockHistory = await this.targetsService.getRouteHistory(
            deviceImei,
            adjustedDates.fromDate,
            adjustedDates.toDate
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
