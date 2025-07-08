import { Component, OnInit } from '@angular/core';
import { MenuItem, MessageService } from 'primeng/api';
import { TargetsService } from '@core/services/targets.service';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from '@core/services/auth.service';
import { ThemesService } from '@shared/services/themes.service';
import { RouteHistoryResponse, RouteHistoryPosition } from '@core/interfaces';

export interface ReportFilter {
  reportType: string;
  dateRange: {
    start: Date | null;
    end: Date | null;
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
    
    // Filtros del reporte
    reportFilter: ReportFilter = {
      reportType: 'movements',
      dateRange: {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Ayer
        end: new Date() // Hoy
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
      private themesService: ThemesService
    ) {}

    ngOnInit(): void {
      this.loadTargets();
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

    onQuickDateSelect(preset: any): void {
      const range = preset.getRange();
      this.reportFilter.dateRange = range;
      console.log(`Fecha rápida seleccionada: ${preset.label}`, range);
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

      if (this.reportFilter.dateRange.start > this.reportFilter.dateRange.end) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Fechas inválidas',
          detail: 'La fecha de inicio no puede ser mayor que la fecha final'
        });
        return false;
      }

      // Validar que se haya seleccionado al menos un target (excepto para route_history)
      if (this.reportFilter.reportType !== 'route_history' && this.reportFilter.selectedTargets.length === 0) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Sin dispositivos',
          detail: 'Debe seleccionar al menos un dispositivo para el reporte'
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
      if (this.reportFilter.selectedTargets.length === 0 && this.targets.length === 0) {
        throw new Error('No hay dispositivos disponibles para el historial');
      }

      this.loadingRouteHistory = true;
      
      try {
        // Usar el primer target seleccionado o el primer target disponible
        const selectedTargetId = this.reportFilter.selectedTargets.length > 0 
          ? this.reportFilter.selectedTargets[0] 
          : this.targets[0]._id;
          
        const selectedTarget = this.targets.find(t => t._id === selectedTargetId);
        
        // Usar api_device_id que es el ID en Traccar
        const traccarDeviceId = selectedTarget?.api_device_id || selectedTarget?.deviceId;
        
        if (!traccarDeviceId) {
          throw new Error('El dispositivo seleccionado no tiene un ID de Traccar válido');
        }

        // Convertir fechas a formato ISO string
        const fromDate = this.reportFilter.dateRange.start?.toISOString();
        const toDate = this.reportFilter.dateRange.end?.toISOString();

        console.log('Cargando historial de rutas para dispositivo Traccar:', traccarDeviceId, {
          fromDate,
          toDate,
          targetName: selectedTarget?.name
        });
        
        this.routeHistory = await this.targetsService.getRouteHistory(
          traccarDeviceId.toString(), 
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
      this.reportFilter = {
        reportType: 'movements',
        dateRange: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000),
          end: new Date()
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

  onTargetSelectionChange(event: any): void {
    // Con select nativo, los valores seleccionados se almacenan directamente en selectedTargets
    const selectedCount = Array.isArray(this.reportFilter.selectedTargets) ? this.reportFilter.selectedTargets.length : 0;
    console.log('Targets seleccionados:', selectedCount);
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

  // Métodos auxiliares para el estado de los dispositivos
  isDeviceOnline(device: any): boolean {
    return device.status === 'online';
  }

  isDeviceOffline(device: any): boolean {
    return device.status === 'offline';
  }

  getDeviceStatusText(device: any): string {
    return this.isDeviceOnline(device) ? 'Online' : 'Offline';
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
    if (this.reportFilter.selectedTargets.length === 0) {
      return null;
    }
    
    // Buscar el primer target seleccionado
    const selectedTargetId = this.reportFilter.selectedTargets[0];
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
