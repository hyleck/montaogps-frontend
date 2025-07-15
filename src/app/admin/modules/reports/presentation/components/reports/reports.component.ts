import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MenuItem, MessageService } from 'primeng/api';
import { TargetsService } from '@core/services/targets.service';
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
  includeMovements: boolean;
  groupByDate: boolean;
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
      includeMovements: true,
      groupByDate: false,
      exportFormat: 'pdf'
    };

    // Opciones para los dropdowns
    reportTypes = [
      { label: 'Reporte de Movimientos', value: 'movements', icon: 'pi pi-map' },
      { label: 'Reporte de Paradas', value: 'stops', icon: 'pi pi-pause' },
      { label: 'Reporte de Velocidad', value: 'speed', icon: 'pi pi-clock' },
      { label: 'Reporte de Combustible', value: 'fuel', icon: 'pi pi-dollar' },
      { label: 'Reporte de Actividad', value: 'activity', icon: 'pi pi-chart-line' },
      { label: 'Historial de Recorrido', value: 'route_history', icon: 'pi pi-map-marker' },
      { label: 'Reporte Detallado', value: 'detailed', icon: 'pi pi-list' }
    ];

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
          end: new Date(new Date().setHours(23,59,59,999))
        })
      },
      { 
        label: 'Ayer', 
        value: 'yesterday',
        getRange: () => {
          const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
          return {
            start: new Date(yesterday.setHours(0,0,0,0)),
            end: new Date(yesterday.setHours(23,59,59,999))
          };
        }
      },
      { 
        label: 'Últimos 7 días', 
        value: 'week',
        getRange: () => ({
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          end: new Date()
        })
      },
      { 
        label: 'Últimos 30 días', 
        value: 'month',
        getRange: () => ({
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date()
        })
      },
      { 
        label: 'Este mes', 
        value: 'thisMonth',
        getRange: () => {
          const now = new Date();
          return {
            start: new Date(now.getFullYear(), now.getMonth(), 1),
            end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
          };
        }
      }
    ];

    constructor(
      private targetsService: TargetsService,
      private messageService: MessageService,
      private translate: TranslateService,
      private authService: AuthService,
      private themesService: ThemesService,
      private route: ActivatedRoute
    ) {}

    ngOnInit(): void {
      // Inicializar fechas por defecto
      this.initializeDateRange();
      
      this.loadTargets();
      
      // Capturar targetId de la URL si existe (parámetro de ruta)
      this.route.params.subscribe(params => {
        const targetId = params['targetId'];
        if (targetId) {
          console.log('📍 Target ID recibido desde parámetro de ruta:', targetId);
          this.targetIdFromUrl = targetId; // Almacenar el target ID de la ruta
          this.preselectTarget(targetId);
        }
      });

      // Capturar query parameters (target y type)
      this.route.queryParams.subscribe(queryParams => {
        const target = queryParams['target'];
        const type = queryParams['type'];
        
        if (target) {
          console.log('📍 Target ID recibido desde query params:', target);
          this.targetIdFromUrl = target; // Almacenar el target ID de la URL
          this.preselectTarget(target);
        }
        
        if (type) {
          console.log('📊 Tipo de reporte recibido desde query params:', type);
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
          this.targets = await this.targetsService.getTargetsByUserId(currentUser.id);
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

    private preselectTarget(targetId: string): void {
      // Esperar a que los targets se carguen antes de preseleccionar
      const checkTargets = () => {
        if (this.targets.length > 0) {
          const targetToSelect = this.targets.find(target => 
            target._id === targetId || target.id === targetId
          );
          
          if (targetToSelect) {
            this.reportFilter.selectedTargets = [targetToSelect];
            console.log('✅ Target preseleccionado para reportes:', targetToSelect.name || targetToSelect.alias);
            
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
        console.log('✅ Tipo de reporte preseleccionado:', validReportType.label);
        
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
      
      console.log(`Fecha rápida seleccionada: ${preset.label}`, this.reportFilter.dateRange);
    }

    private formatDateForInput(date: Date): string {
      if (!date) return '';
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    }

    private initializeDateRange(): void {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const today = new Date();
      
      this.reportFilter.dateRange = {
        start: this.formatDateForInput(yesterday),
        end: this.formatDateForInput(today)
      };
    }

    onReportTypeChange(): void {
      // Resetear ciertos filtros según el tipo de reporte
      switch (this.reportFilter.reportType) {
        case 'stops':
          this.reportFilter.includeMovements = false;
          this.reportFilter.includeStops = true;
          break;
        case 'movements':
          this.reportFilter.includeMovements = true;
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

      // Convertir a Date para comparar correctamente
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
      
      try {
        console.log('Generando reporte con filtros:', this.reportFilter);
        
        if (this.reportFilter.reportType === 'route_history') {
          // Para historial de recorrido, cargar datos de ruta
          await this.loadRouteHistory();
        } else {
          // Para otros tipos de reporte, simular generación
          await this.simulateReportGeneration();
        }
        
        this.messageService.add({
          severity: 'success',
          summary: 'Reporte generado',
          detail: `Reporte de ${this.getReportTypeName()} generado exitosamente`
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

    private async loadRouteHistory(): Promise<void> {
      this.loadingRouteHistory = true;
      
      try {
        let selectedTarget: any;
        let selectedTargetId: string;
        
        if (this.targetIdFromUrl) {
          // 1. Usar el target específico de la URL - traer del servicio
          selectedTargetId = this.targetIdFromUrl;
          console.log('🎯 Trayendo target desde URL usando servicio:', selectedTargetId);
          
          try {
            selectedTarget = await this.targetsService.getTargetById(selectedTargetId);
            console.log('✅ Target obtenido del servicio:', selectedTarget.name || selectedTarget.alias);
          } catch (error) {
            throw new Error(`No se encontró el dispositivo con ID: ${selectedTargetId}`);
          }
          
        } else if (this.reportFilter.selectedTargets.length > 0) {
          // 2. Usar el primer target seleccionado localmente
          selectedTargetId = this.reportFilter.selectedTargets[0]._id || this.reportFilter.selectedTargets[0];
          selectedTarget = this.targets.find(t => t._id === selectedTargetId);
          console.log('📋 Usando target seleccionado localmente:', selectedTargetId);
          
        } else if (this.targets.length > 0) {
          // 3. Usar el primer target disponible localmente
          selectedTarget = this.targets[0];
          selectedTargetId = selectedTarget._id;
          console.log('📦 Usando primer target disponible localmente:', selectedTargetId);
          
        } else {
          throw new Error('No hay dispositivos disponibles para el historial');
        }
        
        if (!selectedTarget) {
          throw new Error('No se encontró el dispositivo seleccionado');
        }
        
        // Extraer api_device_id del target obtenido
        const apiDeviceId = selectedTarget?.api_device_id || selectedTarget?.deviceId;
        
        if (!apiDeviceId) {
          throw new Error(`El dispositivo "${selectedTarget.name || selectedTarget.alias}" no tiene un API Device ID válido`);
        }

        // Convertir fechas a formato ISO string
        let fromDate: string | undefined;
        let toDate: string | undefined;
        
        if (this.reportFilter.dateRange.start) {
          const startDate = this.reportFilter.dateRange.start instanceof Date 
            ? this.reportFilter.dateRange.start 
            : new Date(this.reportFilter.dateRange.start);
          if (isNaN(startDate.getTime())) {
            throw new Error('Fecha de inicio inválida');
          }
          fromDate = startDate.toISOString();
        }
        
        if (this.reportFilter.dateRange.end) {
          const endDate = this.reportFilter.dateRange.end instanceof Date 
            ? this.reportFilter.dateRange.end 
            : new Date(this.reportFilter.dateRange.end);
          if (isNaN(endDate.getTime())) {
            throw new Error('Fecha de fin inválida');
          }
          toDate = endDate.toISOString();
        }

        console.log('🚀 Cargando historial de rutas:', {
          targetId: selectedTargetId,
          targetName: selectedTarget.name || selectedTarget.alias,
          apiDeviceId,
          fromDate,
          toDate,
          sourceUrl: !!this.targetIdFromUrl
        });
        
        this.routeHistory = await this.targetsService.getRouteHistory(
          apiDeviceId.toString(), 
          fromDate, 
          toDate
        );
        
        console.log('Historial de rutas cargado:', {
          totalPositions: this.routeHistory.totalPositions,
          positionsCount: this.routeHistory.positions.length
        });
        
      } catch (error) {
        console.error('Error cargando historial de rutas:', error);
        throw error;
      } finally {
        this.loadingRouteHistory = false;
      }
    }

    getReportTypeName(): string {
      const reportType = this.reportTypes.find(rt => rt.value === this.reportFilter.reportType);
      return reportType?.label || 'Reporte';
    }

    clearFilters(): void {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const today = new Date();
      
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
        includeMovements: true,
        groupByDate: false,
        exportFormat: 'pdf'
      };
      
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
        console.log('🗺️ Usando target desde URL para mapa:', selectedTargetId);
      } else if (this.reportFilter.selectedTargets.length > 0) {
        selectedTargetId = this.reportFilter.selectedTargets[0]._id || this.reportFilter.selectedTargets[0];
        console.log('🗺️ Usando target seleccionado para mapa:', selectedTargetId);
      } else if (this.reportFilter.reportType === 'route_history' && this.targets.length > 0) {
        selectedTargetId = this.targets[0]._id;
        console.log('🗺️ Usando primer target disponible para mapa:', selectedTargetId);
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

  // Método para exportar reporte (placeholder)
  exportReport(): void {
    this.messageService.add({
      severity: 'info',
      summary: 'Exportar',
      detail: 'Función de exportación en desarrollo'
    });
  }
}
