import { Component, OnInit } from '@angular/core';
import {
  EmnifyRealtimeSimcard,
  SimcardsValidationTempService,
} from 'src/app/core/services/simcards-validation-temp.service';
import * as XLSX from 'xlsx-js-style';

@Component({
  selector: 'app-emnify-verification',
  standalone: false,
  templateUrl: './emnify-verification.component.html',
  styleUrl: './emnify-verification.component.css'
})
export class EmnifyVerificationComponent implements OnInit {
  allSimcards: EmnifyRealtimeSimcard[] = [];
  simcards: EmnifyRealtimeSimcard[] = [];
  loading = false;
  exporting = false;
  errorMessage = '';

  search = '';
  estado = 'Habilitado';
  conexion = '';
  existsInMontao = '';
  page = 1;
  limit = 50;
  total = 0;

  estadoOptions = ['Habilitado', 'Deshabilitado', 'Activated', 'Suspended'];
  conexionOptions = ['2G', '3G', '4G', '5G', 'Registrado', 'Conectada', 'Desconocida'];

  constructor(
    private readonly simcardsValidationTempService: SimcardsValidationTempService,
  ) {}

  ngOnInit(): void {
    this.loadSimcards();
  }

  loadSimcards(page: number = 1): void {
    this.loading = true;
    this.errorMessage = '';
    this.page = page;

    this.simcardsValidationTempService.findEmnifyRealtime().subscribe({
      next: (response) => {
        this.allSimcards = response.data;
        this.mergeConnectionOptions(response.data);
        this.applyLocalFilters(page);
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'No se pudo consultar Emnify en tiempo real.';
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    this.applyLocalFilters(1);
  }

  clearFilters(): void {
    this.search = '';
    this.estado = 'Habilitado';
    this.conexion = '';
    this.existsInMontao = '';
    this.applyLocalFilters(1);
  }

  onPageChange(event: any): void {
    const nextPage = Math.floor((event.first || 0) / (event.rows || this.limit)) + 1;
    this.limit = event.rows || this.limit;
    this.applyLocalFilters(nextPage);
  }

  exportExcel(): void {
    this.exporting = true;
    const filteredSimcards = this.getFilteredSimcards();
    const rows = filteredSimcards.map((simcard) => ({
      Nombre: simcard.nombre,
      Estado: simcard.estado,
      'Estado SIM': simcard.simEstado,
      Conexion: simcard.conexion,
      ICCID: simcard.iccid,
      'ICCID con Luhn': simcard.iccidWithLuhn || '',
      'Existe en Montao GPS': simcard.devices?.length ? 'Si' : 'No',
      'Devices Montao GPS': this.formatDevicesForExcel(simcard),
    }));

    if (!rows.length) {
      this.exporting = false;
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    this.styleEmnifyWorksheet(worksheet, filteredSimcards);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Emnify');
    XLSX.writeFile(workbook, `Emnify_Simcards_${new Date().toISOString().slice(0, 10)}.xlsx`);
    this.exporting = false;
  }

  get firstRowIndex(): number {
    return (this.page - 1) * this.limit;
  }

  getDeviceStatusLabel(device: any): string {
    if (device?.canceled) {
      return 'Cancelado';
    }

    if (device?.expirationDate && new Date(device.expirationDate) <= new Date()) {
      return 'Expirado';
    }

    return device?.status ? 'Activo' : 'Suspendido';
  }

  getDeviceConnectionLabel(device: any): string {
    return device?.isOnline ? 'En linea' : 'Fuera de linea';
  }

  private formatDevicesForExcel(simcard: EmnifyRealtimeSimcard): string {
    if (!simcard.devices?.length) {
      return 'No existe en Montao GPS';
    }

    return simcard.devices.map((device) => [
      device.name || 'Sin nombre',
      `IMEI: ${device.imei || 'N/A'}`,
      `Placa: ${device.plate || 'N/A'}`,
      `Estado: ${this.getDeviceStatusLabel(device)}`,
      `Conexion: ${this.getDeviceConnectionLabel(device)}`,
      device.lastUpdate ? `Ultima conexion: ${new Date(device.lastUpdate).toLocaleString()}` : null,
    ].filter(Boolean).join(' | ')).join('\n');
  }

  private styleEmnifyWorksheet(worksheet: any, simcards: EmnifyRealtimeSimcard[]): void {
    const headerStyle = {
      fill: { fgColor: { rgb: '1F2937' } },
      font: { color: { rgb: 'FFFFFF' }, bold: true },
      alignment: { horizontal: 'center', vertical: 'center' },
    };
    const rowStyles = {
      online: {
        fill: { fgColor: { rgb: 'DCFCE7' } },
        font: { color: { rgb: '166534' } },
      },
      expired: {
        fill: { fgColor: { rgb: 'FEE2E2' } },
        font: { color: { rgb: '991B1B' } },
      },
      offline: {
        fill: { fgColor: { rgb: 'E5E7EB' } },
        font: { color: { rgb: '374151' } },
      },
    };
    const columns = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

    worksheet['!cols'] = [
      { wch: 28 },
      { wch: 16 },
      { wch: 16 },
      { wch: 14 },
      { wch: 22 },
      { wch: 24 },
      { wch: 18 },
      { wch: 70 },
    ];

    columns.forEach((column) => {
      const cell = worksheet[`${column}1`];
      if (cell) {
        cell.s = headerStyle;
      }
    });

    simcards.forEach((simcard, index) => {
      const style = this.getExcelRowStyle(simcard, rowStyles);
      if (!style) {
        return;
      }

      const row = index + 2;
      columns.forEach((column) => {
        const cell = worksheet[`${column}${row}`];
        if (cell) {
          cell.s = {
            ...style,
            alignment: {
              vertical: 'top',
              wrapText: column === 'H',
            },
          };
        }
      });
    });
  }

  private getExcelRowStyle(simcard: EmnifyRealtimeSimcard, rowStyles: any): any {
    const devices = simcard.devices || [];
    if (!devices.length) {
      return null;
    }

    if (devices.some((device) => device?.expirationDate && new Date(device.expirationDate) <= new Date())) {
      return rowStyles.expired;
    }

    if (devices.some((device) => device?.isOnline)) {
      return rowStyles.online;
    }

    return rowStyles.offline;
  }

  private applyLocalFilters(page: number = this.page): void {
    const filtered = this.getFilteredSimcards();
    this.total = filtered.length;
    this.page = page;

    const start = (this.page - 1) * this.limit;
    this.simcards = filtered.slice(start, start + this.limit);
  }

  private getFilteredSimcards(): EmnifyRealtimeSimcard[] {
    const normalizedSearch = this.normalize(this.search);
    const normalizedEstado = this.normalize(this.estado);
    const normalizedConexion = this.normalize(this.conexion);
    const normalizedExistsInMontao = this.normalize(this.existsInMontao);

    return this.allSimcards.filter((simcard) => {
      const existsInMontao = !!simcard.devices?.length;
      const matchesSearch = !normalizedSearch || [
        simcard.nombre,
        simcard.iccid,
        simcard.iccidWithLuhn,
        simcard.estado,
        simcard.simEstado,
        simcard.conexion,
        ...(simcard.devices || []).flatMap((device) => [
          device.name,
          device.imei,
          device.plate,
        ]),
      ].some((value) => this.normalize(value).includes(normalizedSearch));

      const matchesEstado = !normalizedEstado
        || this.normalize(simcard.estado) === normalizedEstado
        || this.normalize(simcard.simEstado) === normalizedEstado;

      const matchesConexion = !normalizedConexion
        || this.normalize(simcard.conexion) === normalizedConexion;

      const matchesExistsInMontao = !normalizedExistsInMontao
        || (normalizedExistsInMontao === 'exists' && existsInMontao)
        || (normalizedExistsInMontao === 'missing' && !existsInMontao);

      return matchesSearch && matchesEstado && matchesConexion && matchesExistsInMontao;
    });
  }

  private normalize(value: any): string {
    return String(value || '').trim().toLowerCase();
  }

  private mergeConnectionOptions(simcards: EmnifyRealtimeSimcard[]): void {
    const options = new Set(this.conexionOptions);
    simcards.forEach((simcard) => {
      if (simcard.conexion) {
        options.add(simcard.conexion);
      }
    });
    this.conexionOptions = Array.from(options);
  }
}
