import { Component, OnInit } from '@angular/core';
import { ProcessesService, ProcessItem, PROCESS_TYPE_LABELS } from '../../services/processes.service';
import { UserService } from 'src/app/core/services/user.service';
import { VehicleBrandsService } from 'src/app/core/services/vehicle-brands.service';
import { ColorsService } from 'src/app/core/services/colors.service';
import { ProtocolsService } from 'src/app/core/services/protocols.service';
import * as XLSX from 'xlsx-js-style';

@Component({
  selector: 'app-processes',
  standalone: false,
  templateUrl: './processes.component.html',
  styleUrls: ['./processes.component.css']
})
export class ProcessesComponent implements OnInit {

  processes: ProcessItem[] = [];
  loading = false;

  // Pagination
  totalRecords = 0;
  currentPage = 1;
  rowsPerPage = 20;

  // Filters
  searchQuery = '';
  selectedType: number | null = null;
  selectedCreator: string | null = null;
  selectedMechanic: string | null = null;
  dateFrom: Date | null = this.getTodayRange().from;
  dateTo: Date | null = this.getTodayRange().to;

  typeOptions = Object.entries(PROCESS_TYPE_LABELS).map(([key, label]) => ({
    label,
    value: Number(key)
  }));

  processTypeLabels = PROCESS_TYPE_LABELS;

  // Stats
  stats: any = null;

  // Detail dialog
  selectedProcess: ProcessItem | null = null;
  detailDialogVisible = false;

  // Technicians map
  techniciansMap: { [id: string]: string } = {};

  // Employee options for filter
  employeeOptions: { label: string; value: string }[] = [];
  mechanicOptions: { label: string; value: string }[] = [];

  // Brand/Model/Color name maps
  brandsMap: { [id: string]: string } = {};
  modelsMap: { [id: string]: string } = {};
  colorsMap: { [hex: string]: string } = {};
  gpsModelsMap: { [id: string]: string } = {};

  constructor(
    private processesService: ProcessesService,
    private userService: UserService,
    private vehicleBrandsService: VehicleBrandsService,
    private colorsService: ColorsService,
    private protocolsService: ProtocolsService
  ) {}

  ngOnInit(): void {
    this.loadProcesses();
    this.loadStats();
    this.loadTechnicians();
    this.loadEmployees();
    this.loadMechanics();
    this.loadBrandsAndModels();
  }

  loadProcesses(): void {
    this.loading = true;
    const filters: any = {};
    if (this.selectedType !== null && this.selectedType !== undefined) filters.type = this.selectedType;
    if (this.selectedCreator) filters.creator = this.selectedCreator;
    if (this.selectedMechanic) filters.mechanic = this.selectedMechanic;
    if (this.dateFrom) filters.dateFrom = this.dateFrom.toISOString();
    if (this.dateTo) filters.dateTo = this.dateTo.toISOString();
    if (this.searchQuery?.trim()) filters.search = this.searchQuery.trim();

    this.processesService.getPaginated(this.currentPage, this.rowsPerPage, filters).subscribe({
      next: (res) => {
        this.processes = res.data;
        this.totalRecords = res.total;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  loadStats(): void {
    this.processesService.getStats().subscribe({
      next: (s) => this.stats = s,
      error: () => {}
    });
  }

  onPageChange(event: any): void {
    this.currentPage = Math.floor(event.first / event.rows) + 1;
    this.rowsPerPage = event.rows;
    this.loadProcesses();
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.loadProcesses();
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedType = null;
    this.selectedCreator = null;
    this.selectedMechanic = null;
    const todayRange = this.getTodayRange();
    this.dateFrom = todayRange.from;
    this.dateTo = todayRange.to;
    this.currentPage = 1;
    this.loadProcesses();
  }

  async exportExcel(): Promise<void> {
    // Ensure brands/models are loaded before exporting
    if (Object.keys(this.brandsMap).length === 0) {
      await this.loadBrandsAndModels();
    }

    // Fetch ALL records with current filters (not just current page)
    const filters: any = {};
    if (this.selectedType !== null && this.selectedType !== undefined) filters.type = this.selectedType;
    if (this.selectedCreator) filters.creator = this.selectedCreator;
    if (this.selectedMechanic) filters.mechanic = this.selectedMechanic;
    if (this.dateFrom) filters.dateFrom = this.dateFrom.toISOString();
    if (this.dateTo) filters.dateTo = this.dateTo.toISOString();
    if (this.searchQuery?.trim()) filters.search = this.searchQuery.trim();

    const res = await this.processesService.getPaginated(1, 10000, filters).toPromise();
    const allProcesses = res?.data || [];

    const data = allProcesses.map(p => ({
      'Fecha': new Date(p.createdAt).toLocaleString('es-DO'),
      'Tipo': this.getTypeLabel(p.type),
      'Target': this.getTargetName(p.target),
      'IMEI': this.getTargetImei(p.target),
      'Marca': this.brandsMap[p.target?.['target_brand_id']] || p.target?.['target_brand_id'] || '',
      'Modelo': this.modelsMap[p.target?.['target_model_id']] || p.target?.['target_model_id'] || '',
      'Año': p.target?.['target_year'] || '',
      'Color': this.colorsMap[p.target?.['target_color']] || p.target?.['target_color'] || '',
      'Matrícula': p.target?.['target_plate_number'] || '',
      'Chasis': p.target?.['target_chassis_number'] || '',
      'SIM Card': p.target?.['sim_card_number'] || '',
      'Tipo SIM': p.target?.['sim_company'] || '',
      'Modelo GPS': this.gpsModelsMap[p.target?.['device_type']] || p.target?.['gps_model'] || '',
      'Empleado': this.getCreatorName(p.creator),
      'Técnico': this.getTechnicianName(p),
    }));

    const ws = XLSX.utils.json_to_sheet(data);

    // Column widths
    ws['!cols'] = [
      { wch: 20 },  // Fecha
      { wch: 22 },  // Tipo
      { wch: 25 },  // Target
      { wch: 18 },  // IMEI
      { wch: 15 },  // Marca
      { wch: 15 },  // Modelo
      { wch: 8 },   // Año
      { wch: 12 },  // Color
      { wch: 14 },  // Matrícula
      { wch: 20 },  // Chasis
      { wch: 22 },  // SIM Card
      { wch: 14 },  // Tipo SIM
      { wch: 16 },  // Modelo GPS
      { wch: 20 },  // Empleado
      { wch: 20 },  // Técnico
    ];

    // Style header row (red background, white bold text)
    const headerStyle = {
      fill: { fgColor: { rgb: 'CC0000' } },
      font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 11 },
      alignment: { horizontal: 'center' }
    };
    const colLetters = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O'];
    colLetters.forEach(col => {
      const cell = ws[`${col}1`];
      if (cell) cell.s = headerStyle;
    });

    // Color map for process types
    const typeColors: { [key: number]: string } = {
      1: '2E7D32',   // Instalación
      2: '1565C0',   // Mod. Fecha Instalación
      3: '0277BD',   // Mod. Fecha Expiración
      4: '388E3C',   // Renovación
      5: 'E65100',   // Cambio de Plan
      6: 'EF6C00',   // Cambio de Plan
      7: 'F57F17',   // Cambio de SIM
      8: '5E35B1',   // Mod. Técnico
      9: 'C62828',   // Cambio de GPS
      10: '00838F',  // Mod. Detalles Instalación
      11: '4527A0',  // Mod. Modelo GPS
      12: 'AD1457',  // Mod. IMEI / GPS ID
      13: 'FF8F00',  // Cambio de SIM Card
      14: '00695C',  // Mod. Número SIM
      15: '37474F',  // Mod. Tipo SIM
      16: '1B5E20',  // Restauración
    };

    // Apply type colors to column B (Tipo)
    allProcesses.forEach((p, i) => {
      const cell = ws[`B${i + 2}`];
      if (cell) {
        cell.s = {
          font: { color: { rgb: typeColors[p.type] || '000000' }, bold: true }
        };
      }
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Procesos');
    XLSX.writeFile(wb, `procesos_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  private getTodayRange(): { from: Date; to: Date } {
    const from = new Date();
    from.setHours(0, 0, 0, 0);

    const to = new Date();
    to.setHours(23, 59, 59, 999);

    return { from, to };
  }

  getTypeLabel(type: number): string {
    return PROCESS_TYPE_LABELS[type] || `Tipo ${type}`;
  }

  getTypeSeverity(type: number): string {
    const severities: { [key: number]: string } = {
      1: 'success',   // Instalación
      2: 'info',      // Mod. Fecha Instalación
      3: 'info',      // Mod. Fecha Expiración
      4: 'success',   // Renovación
      5: 'warning',   // Cambio de Plan
      6: 'warning',   // Cambio de Plan
      7: 'warning',   // Cambio de SIM
      8: 'info',      // Mod. Técnico
      9: 'danger',    // Cambio de GPS
      10: 'info',     // Mod. Detalles Instalación
      11: 'info',     // Mod. Modelo GPS
      12: 'warning',  // Mod. IMEI / GPS ID
      13: 'warning',  // Cambio de SIM Card
      14: 'info',     // Mod. Número SIM
      15: 'info',     // Mod. Tipo SIM
      16: 'success',  // Restauración
    };
    return severities[type] || 'info';
  }

  showDetail(process: ProcessItem): void {
    this.selectedProcess = process;
    this.detailDialogVisible = true;
  }

  getCreatorName(creator: any): string {
    if (!creator) return 'Sistema';
    if (typeof creator === 'string') return creator;
    const name = creator.name || '';
    const lastName = creator.last_name || '';
    return (name + ' ' + lastName).trim() || creator.email || 'Desconocido';
  }

  getTargetName(target: any): string {
    if (!target) return '-';
    return target.name || target.device_imei || '-';
  }

  getTargetImei(target: any): string {
    if (!target) return '-';
    return target.device_imei || '-';
  }

  getTechnicianName(process: ProcessItem): string {
    // Extract from details field: "Técnico asignado: [name]."
    if (process.details) {
      const match = process.details.match(/T[eé]cnico asignado:\s*([^.]+)/i);
      if (match && match[1] && match[1].trim() !== 'No asignado') {
        return match[1].trim();
      }
    }
    // Fallback to target.mechanic_id resolved via technicians map
    if (process.target) {
      const mechanicId = process.target['mechanic_id'];
      if (mechanicId) return this.techniciansMap[mechanicId] || mechanicId;
    }
    return 'Ninguno';
  }

  private loadTechnicians(): void {
    this.userService.getTechnicians().subscribe({
      next: (techs) => {
        techs.forEach(t => {
          this.techniciansMap[t._id] = t.name || t.email || t._id;
        });
      },
      error: () => {}
    });
  }

  private loadEmployees(): void {
    this.userService.getEmployees().subscribe({
      next: (employees: any[]) => {
        this.employeeOptions = employees.map(e => ({
          label: ((e.name || '') + ' ' + (e.last_name || '')).trim() || e.email,
          value: e._id
        }));
      },
      error: () => {}
    });
  }

  private loadMechanics(): void {
    this.userService.getTechnicians().subscribe({
      next: (techs: any[]) => {
        this.mechanicOptions = techs.map(t => ({
          label: ((t.name || '') + ' ' + (t.last_name || '')).trim() || t.email,
          value: t._id
        }));
      },
      error: () => {}
    });
  }

  private async loadBrandsAndModels(): Promise<void> {
    try {
      const brands = await this.vehicleBrandsService.getAllBrands();
      if (brands && brands.length) {
        brands.forEach((b: any) => {
          this.brandsMap[b._id] = b.nombre;
        });
        // Load all models for each brand
        const modelPromises = brands.map((b: any) =>
          this.vehicleBrandsService.getAllModelsByBrand(b._id).catch(() => [])
        );
        const allModels = await Promise.all(modelPromises);
        allModels.forEach((models: any[]) => {
          if (models) {
            models.forEach((m: any) => {
              this.modelsMap[m._id] = m.nombre;
            });
          }
        });
      }
    } catch (e) {}

    // Load colors
    try {
      const colors = await this.colorsService.getAllColors();
      if (colors && colors.length) {
        colors.forEach((c: any) => {
          this.colorsMap[c.hex] = c.nombre;
        });
      }
    } catch (e) {}

    // Load GPS models (protocols)
    this.protocolsService.getAllProtocols().subscribe({
      next: (protocols) => {
        protocols.forEach(p => {
          this.gpsModelsMap[p._id] = p.name;
        });
      },
      error: () => {}
    });
  }
}
