import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MonitoringService, MonitorUserResponse, MonitoringReport } from '../../../../../../core/services/monitoring.service';
import { UserService } from '../../../../../../core/services/user.service';
import { ProtocolsService } from '../../../../../../core/services/protocols.service';
import { User } from '../../../../../../core/interfaces/user.interface';
import { TranslateService } from '@ngx-translate/core';
import * as ExcelJS from 'exceljs';

@Component({
  selector: 'app-monitoring',
  templateUrl: './monitoring.component.html',
  styleUrls: ['./monitoring.component.css'],
  standalone: false
})
export class MonitoringComponent implements OnInit {
  userEmail: string = '';
  userId: string = '';
  monitoringResult: MonitorUserResponse | null = null;
  loading: boolean = false;
  searchingUser: boolean = false;
  error: string = '';
  userFound: boolean = false;
  foundUserName: string = '';
  showUserSearchModal: boolean = false;
  showFiltersModal: boolean = false;
  protocols: any[] = [];

  // Filter options
  statusOptions: any[] = [
    { label: 'All Statuses', value: null },
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' }
  ];

  expirationOptions: any[] = [
    { label: 'All Expirations', value: null },
    { label: 'Valid', value: 'valid' },
    { label: 'Expiring Soon', value: 'expiring-soon' },
    { label: 'Expired', value: 'expired' }
  ];

  private _selectedStatusFilter: string = '';
  private _selectedConnectionFilter: string = '';
  private _selectedExpirationFilter: string = '';
  private _expirationFromDate: Date | null = null;
  private _expirationToDate: Date | null = null;



  get selectedStatusFilter(): string {
    return this._selectedStatusFilter;
  }

  set selectedStatusFilter(value: string) {
    if (this._selectedStatusFilter !== value) {
      this._selectedStatusFilter = value;
    }
  }

  get selectedConnectionFilter(): string {
    return this._selectedConnectionFilter;
  }

  set selectedConnectionFilter(value: string) {
    if (this._selectedConnectionFilter !== value) {
      this._selectedConnectionFilter = value;
    }
  }

  get selectedExpirationFilter(): string {
    return this._selectedExpirationFilter;
  }

  set selectedExpirationFilter(value: string) {
    if (this._selectedExpirationFilter !== value) {
      this._selectedExpirationFilter = value;
    }
  }

  get expirationFromDate(): string {
    return this._expirationFromDate ? this.formatDateForInput(this._expirationFromDate) : '';
  }

  set expirationFromDate(value: string) {
    this._expirationFromDate = value ? new Date(value) : null;
  }

  get expirationToDate(): string {
    return this._expirationToDate ? this.formatDateForInput(this._expirationToDate) : '';
  }

  set expirationToDate(value: string) {
    this._expirationToDate = value ? new Date(value) : null;
  }

  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  // Monitoring reports
  userMonitoringReports: MonitoringReport[] = [];
  selectedUserReports: MonitoringReport[] = [];
  loadingReports: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private monitoringService: MonitoringService,
    private userService: UserService,
    private protocolsService: ProtocolsService,
    private translate: TranslateService
  ) { }

  ngOnInit(): void {
    // Load protocols data
    this.loadProtocols();

    // Get user ID from route parameter but don't start monitoring automatically
    this.route.params.subscribe(params => {
      this.userId = params['user'];
      if (this.userId) {
        // If we have a user ID from route, try to get user info for display
        this.loadUserInfo(this.userId);
        // Load monitoring reports for the current user
        this.loadUserMonitoringReports(this.userId);
      }
      // Don't show modal automatically - user must click "Seleccionar Usuario"
    });
  }

  searchUserByEmail(): void {
    if (!this.userEmail || !this.userEmail.trim()) {
      this.error = this.translate.instant('MONITORING.ENTER_VALID_EMAIL');
      return;
    }

    this.searchingUser = true;
    this.error = '';
    this.userFound = false;
    this.foundUserName = '';

    this.userService.getByEmail(this.userEmail.trim()).subscribe({
      next: (user: User) => {
        this.userId = user._id;
        this.userFound = true;
        this.foundUserName = `${user.name} ${user.last_name}`;
        this.searchingUser = false;
        // Load monitoring reports for the selected user
        this.loadSelectedUserReports(user._id);
        console.log('User found:', user);
      },
      error: (error: any) => {
        this.error = this.translate.instant('MONITORING.USER_NOT_FOUND');
        this.searchingUser = false;
        this.userFound = false;
        console.error('User search error:', error);
      }
    });
  }

  startMonitoring(): void {
    if (!this.userId) {
      this.error = this.translate.instant('MONITORING.SEARCH_USER_FIRST');
      return;
    }

    // Close the modal and start monitoring
    this.showUserSearchModal = false;
    this.loading = true;
    this.error = '';

    this.monitoringService.monitorUser(this.userId).subscribe({
      next: (result) => {
        this.monitoringResult = result;
        this.loading = false;
        console.log('Monitoring result:', result);
      },
      error: (error) => {
        this.error = 'Error monitoring user: ' + error.message;
        this.loading = false;
        console.error('Monitoring error:', error);
      }
    });
  }

  startMonitoringWithFilters(): void {
    if (!this.userId) {
      this.error = this.translate.instant('MONITORING.SEARCH_USER_FIRST');
      return;
    }

    // Close the modal and start monitoring
    this.showUserSearchModal = false;
    this.loading = true;
    this.error = '';

    this.monitoringService.monitorUser(this.userId).subscribe({
      next: (result) => {
        this.monitoringResult = result;
        this.loading = false;
        console.log('Monitoring result:', result);
      },
      error: (error) => {
        this.error = 'Error monitoring user: ' + error.message;
        this.loading = false;
        console.error('Monitoring error:', error);
      }
    });
  }

  openUserSearchModal(): void {
    this.showUserSearchModal = true;
  }

  closeUserSearchModal(): void {
    this.showUserSearchModal = false;
  }

  openFiltersModal(): void {
    this.showFiltersModal = true;
  }

  closeFiltersModal(): void {
    this.showFiltersModal = false;
  }




  private loadUserInfo(userId: string): void {
    // Optional: load user info if we have ID from route
    this.userService.getById(userId).subscribe({
      next: (user) => {
        this.userEmail = user.email;
        this.userFound = true;
        this.foundUserName = `${user.name} ${user.last_name}`;
      },
      error: (error) => {
        console.warn('Could not load user info from route ID:', error);
      }
    });
  }

  resetSearch(): void {
    this.userEmail = '';
    this.userId = '';
    this.userFound = false;
    this.foundUserName = '';
    this.monitoringResult = null;
    this.error = '';
  }

  private loadProtocols(): void {
    this.protocolsService.getAllProtocols().subscribe({
      next: (protocols: any[]) => {
        this.protocols = protocols;
      },
      error: (error: any) => {
        console.error('Error loading protocols:', error);
      }
    });
  }

  private loadUserMonitoringReports(userId: string): void {
    this.loadingReports = true;
    this.monitoringService.getUserMonitoringReports(userId).subscribe({
      next: (reports: MonitoringReport[]) => {
        this.userMonitoringReports = reports;
        this.loadingReports = false;
        console.log('Loaded monitoring reports:', reports);
      },
      error: (error: any) => {
        console.error('Error loading monitoring reports:', error);
        this.loadingReports = false;
      }
    });
  }

  private loadSelectedUserReports(userId: string): void {
    this.loadingReports = true;
    this.monitoringService.getUserMonitoringReports(userId).subscribe({
      next: (reports: MonitoringReport[]) => {
        this.selectedUserReports = reports;
        this.loadingReports = false;
        console.log('Loaded selected user monitoring reports:', reports);
      },
      error: (error: any) => {
        console.error('Error loading selected user monitoring reports:', error);
        this.loadingReports = false;
      }
    });
  }

  getProtocolName(deviceType: string): string {
    if (!deviceType || !this.protocols.length) {
      return deviceType || 'Unknown';
    }

    const protocol = this.protocols.find(p => p._id === deviceType);
    return protocol ? protocol.name : deviceType;
  }

  // Getter to filter out users without devices and apply status/expiration filters
  get filteredMonitoringData() {
    if (!this.monitoringResult?.data) {
      return [];
    }

    return this.monitoringResult.data
      .map(userData => {
        // Filter devices based on selected filters
        let filteredDevices = userData.devices;

        // Apply status filter
        if (this._selectedStatusFilter && this._selectedStatusFilter !== '') {
          switch (this._selectedStatusFilter) {
            case 'active':
              filteredDevices = filteredDevices.filter(device => device.status === true);
              break;
            case 'inactive':
              filteredDevices = filteredDevices.filter(device => device.status === false);
              break;
          }
        }

        // Apply connection filter
        if (this._selectedConnectionFilter && this._selectedConnectionFilter !== '') {
          switch (this._selectedConnectionFilter) {
            case 'online':
              filteredDevices = filteredDevices.filter(device => this.isDeviceOnline(device));
              break;
            case 'offline':
              filteredDevices = filteredDevices.filter(device => !this.isDeviceOnline(device));
              break;
          }
        }

        // Apply expiration filter
        if (this._selectedExpirationFilter && this._selectedExpirationFilter !== '') {
          switch (this._selectedExpirationFilter) {
            case 'expired':
              filteredDevices = filteredDevices.filter(device =>
                this.isExpired(device.expiration_date) &&
                this.isDateInRange(device.expiration_date, this._expirationFromDate, this._expirationToDate)
              );
              break;
            case 'expiring-soon':
              filteredDevices = filteredDevices.filter(device => this.isExpiringSoon(device.expiration_date));
              break;
            case 'valid':
              filteredDevices = filteredDevices.filter(device =>
                this.isValid(device.expiration_date) &&
                this.isDateInRange(device.expiration_date, this._expirationFromDate, this._expirationToDate)
              );
              break;
          }
        }

        return {
          ...userData,
          devices: filteredDevices
        };
      })
      .filter(userData => userData.devices && userData.devices.length > 0); // Remove users with no devices after filtering
  }

  formatExpirationDate(expirationDate: Date | string): string {
    if (!expirationDate) {
      return '-';
    }

    const date = new Date(expirationDate);
    if (isNaN(date.getTime())) {
      return '-';
    }

    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  isExpired(expirationDate: Date | string): boolean {
    if (!expirationDate) {
      return false;
    }

    const date = new Date(expirationDate);
    if (isNaN(date.getTime())) {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    return date < today;
  }

  isExpiringSoon(expirationDate: Date | string): boolean {
    if (!expirationDate) {
      return false;
    }

    const date = new Date(expirationDate);
    if (isNaN(date.getTime())) {
      return false;
    }

    const today = new Date();
    const fifteenDaysFromNow = new Date();
    fifteenDaysFromNow.setDate(today.getDate() + 15);

    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    fifteenDaysFromNow.setHours(0, 0, 0, 0);

    return date >= today && date <= fifteenDaysFromNow;
  }

  isValid(expirationDate: Date | string): boolean {
    if (!expirationDate) {
      return false;
    }

    const date = new Date(expirationDate);
    if (isNaN(date.getTime())) {
      return false;
    }

    const today = new Date();
    const fifteenDaysFromNow = new Date();
    fifteenDaysFromNow.setDate(today.getDate() + 15);

    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    fifteenDaysFromNow.setHours(0, 0, 0, 0);

    return date > fifteenDaysFromNow;
  }

  isDeviceOnline(device: any): boolean {
    return device?.traccarInfo?.status === 'online';
  }

  isDateInRange(date: Date | string, fromDate: Date | null, toDate: Date | null): boolean {
    if (!date || (!fromDate && !toDate)) {
      return true; // No range set, include all
    }

    const deviceDate = new Date(date);
    if (isNaN(deviceDate.getTime())) {
      return false;
    }

    if (fromDate) {
      if (deviceDate < fromDate) {
        return false;
      }
    }

    if (toDate) {
      if (deviceDate > toDate) {
        return false;
      }
    }

    return true;
  }

  formatReportDate(dateString: string): string {
    if (!dateString) {
      return '-';
    }

    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return '-';
    }

    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getTotalDevices(data: Array<{ devices: any[] }>): number {
    return data.reduce((total, userData) => total + (userData.devices?.length || 0), 0);
  }

  getTimeAgo(dateString: string): string {
    if (!dateString) {
      return '';
    }

    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return '';
    }

    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) {
      return 'hace un momento';
    } else if (diffInMinutes < 60) {
      return `hace ${diffInMinutes} minuto${diffInMinutes !== 1 ? 's' : ''}`;
    } else if (diffInHours < 24) {
      return `hace ${diffInHours} hora${diffInHours !== 1 ? 's' : ''}`;
    } else if (diffInDays < 7) {
      return `hace ${diffInDays} día${diffInDays !== 1 ? 's' : ''}`;
    } else if (diffInDays < 30) {
      const weeks = Math.floor(diffInDays / 7);
      return `hace ${weeks} semana${weeks !== 1 ? 's' : ''}`;
    } else if (diffInDays < 365) {
      const months = Math.floor(diffInDays / 30);
      return `hace ${months} mes${months !== 1 ? 'es' : ''}`;
    } else {
      const years = Math.floor(diffInDays / 365);
      return `hace ${years} año${years !== 1 ? 's' : ''}`;
    }
  }

  openReport(reportId: string): void {
    console.log('Opening report:', reportId);
    this.loading = true;
    this.error = '';

    this.monitoringService.getMonitoringReport(reportId).subscribe({
      next: (report) => {
        this.monitoringResult = report;
        this.loading = false;
        console.log('Report loaded:', report);
      },
      error: (error) => {
        this.error = 'Error loading report: ' + error.message;
        this.loading = false;
        console.error('Error loading report:', error);
      }
    });
  }

  backToReports(): void {
    this.monitoringResult = null;
    this.error = '';
    console.log('Back to reports list');
  }

  trackByUser(index: number, userData: any): any {
    // Use the first route item's id as unique identifier, fallback to index
    return userData.route && userData.route.length > 0 ? userData.route[0].id : index;
  }

  async exportToExcel(): Promise<void> {
    if (!this.monitoringResult?.data) {
      return;
    }

    // Create a new workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Monitoreo');

    // Define columns
    worksheet.columns = [
      { header: 'Usuario', key: 'usuario', width: 20 },
      { header: 'Jerarquía', key: 'jerarquia', width: 40 },
      { header: 'Nombre Dispositivo', key: 'nombreDispositivo', width: 25 },
      { header: 'IMEI', key: 'imei', width: 20 },
      { header: 'Protocolo', key: 'protocolo', width: 15 },
      { header: 'Estado', key: 'estado', width: 10 },
      { header: 'Conexión', key: 'conexion', width: 12 },
      { header: 'Fecha Expiración', key: 'fechaExpiracion', width: 15 },
      { header: 'Número SIM', key: 'numeroSim', width: 15 },
      { header: 'Compañía SIM', key: 'companiaSim', width: 15 }
    ];

    // Style header row
    worksheet.getRow(1).eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF007BFF' } // Blue background
      };
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' }, // White text
        size: 12
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
    });

    // Add data rows
    let rowIndex = 2; // Start from row 2 (after header)
    this.filteredMonitoringData.forEach(userData => {
      const userHierarchy = userData.route && userData.route.length > 0
        ? userData.route.map(item => item.fullName).join(' > ')
        : 'Sin jerarquía';

      userData.devices.forEach(device => {
        const row = worksheet.addRow({
          usuario: userData.route && userData.route.length > 0 ? userData.route[userData.route.length - 1].fullName : 'Sin nombre',
          jerarquia: userHierarchy,
          nombreDispositivo: device.name || '',
          imei: device.device_imei || '',
          protocolo: this.getProtocolName(device.type) || '',
          estado: device.status ? 'Activo' : 'Inactivo',
          conexion: this.isDeviceOnline(device) ? 'En línea' : 'Fuera de línea',
          fechaExpiracion: this.formatExpirationDate(device.expiration_date) || '',
          numeroSim: device.sim_card_number || '',
          companiaSim: device.sim_company || ''
        });

        // Style the row with alternating colors
        const isEvenRow = (rowIndex - 1) % 2 === 0; // -1 because rowIndex starts at 2
        const backgroundColor = isEvenRow ? 'FFF8F9FA' : 'FFFFFFFF'; // Light gray for even rows

        row.eachCell(cell => {
          // Default styling
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: backgroundColor }
          };
          cell.font = {
            color: { argb: 'FF000000' }, // Black text
            size: 10
          };
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFDEDEDE' } },
            bottom: { style: 'thin', color: { argb: 'FFDEDEDE' } },
            left: { style: 'thin', color: { argb: 'FFDEDEDE' } },
            right: { style: 'thin', color: { argb: 'FFDEDEDE' } }
          };
        });

        // Special styling for status column (column F - Estado)
        const statusCell = row.getCell('estado');
        if (device.status) {
          statusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD4EDDA' } // Light green for active
          };
          statusCell.font = {
            color: { argb: 'FF155724' }, // Dark green text
            size: 10,
            bold: true
          };
        } else {
          statusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8D7DA' } // Light red for inactive
          };
          statusCell.font = {
            color: { argb: 'FF721C24' }, // Dark red text
            size: 10,
            bold: true
          };
        }

        // Special styling for connection column (column G - Conexión)
        const connectionCell = row.getCell('conexion');
        if (this.isDeviceOnline(device)) {
          connectionCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD4EDDA' } // Light green for online
          };
          connectionCell.font = {
            color: { argb: 'FF155724' }, // Dark green text
            size: 10,
            bold: true
          };
        } else {
          connectionCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8D7DA' } // Light red for offline
          };
          connectionCell.font = {
            color: { argb: 'FF721C24' }, // Dark red text
            size: 10,
            bold: true
          };
        }

        // Special styling for expiration column (column G - Fecha Expiración)
        const expirationCell = row.getCell('fechaExpiracion');
        if (device.expiration_date) {
          if (this.isExpired(device.expiration_date)) {
            expirationCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF8D7DA' } // Light red for expired
            };
            expirationCell.font = {
              color: { argb: 'FF721C24' }, // Dark red text
              size: 10,
              bold: true
            };
          } else if (this.isExpiringSoon(device.expiration_date)) {
            expirationCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFF3CD' } // Light yellow for expiring soon
            };
            expirationCell.font = {
              color: { argb: 'FF856404' }, // Dark yellow text
              size: 10,
              bold: true
            };
          } else {
            expirationCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFD4EDDA' } // Light green for valid
            };
            expirationCell.font = {
              color: { argb: 'FF155724' }, // Dark green text
              size: 10,
              bold: true
            };
          }
        }

        rowIndex++;
      });
    });

    // Generate filename with current date
    const now = new Date();
    const filename = `monitoreo_${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}.xlsx`;

    // Save file
    try {
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
    }
  }

}