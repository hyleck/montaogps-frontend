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
    return `${year}-${month}-${day}`;
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

  getConnectionDisplay(device: any): string {
    if (this.isDeviceOnline(device)) {
      return 'En línea';
    }

    const lastUpdate =
      device?.traccarInfo?.lastUpdate ||
      device?.traccarInfo?.last_update ||
      device?.traccarInfo?.['lastUpdate'];

    if (!lastUpdate) {
      return 'Fuera de línea (sin fecha de actualización)';
    }

    return this.formatOfflineDuration(lastUpdate);
  }

  private formatOfflineDuration(lastUpdate: string | Date): string {
    try {
      const lastUpdateDate = new Date(lastUpdate);
      const now = new Date();
      const diffInMs = now.getTime() - lastUpdateDate.getTime();

      if (isNaN(lastUpdateDate.getTime())) {
        return 'Fuera de línea (fecha inválida)';
      }

      if (diffInMs < 0) {
        return 'Fuera de línea (fecha futura)';
      }

      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
      const diffInWeeks = Math.floor(diffInDays / 7);
      const diffInMonths = Math.floor(diffInDays / 30);
      const diffInYears = Math.floor(diffInDays / 365);

      if (diffInYears > 0) {
        return `Fuera de línea hace ${diffInYears} año${diffInYears > 1 ? 's' : ''}`;
      }
      if (diffInMonths > 0) {
        return `Fuera de línea hace ${diffInMonths} mes${diffInMonths > 1 ? 'es' : ''}`;
      }
      if (diffInWeeks > 0) {
        return `Fuera de línea hace ${diffInWeeks} semana${diffInWeeks > 1 ? 's' : ''}`;
      }
      if (diffInDays > 0) {
        return `Fuera de línea hace ${diffInDays} día${diffInDays > 1 ? 's' : ''}`;
      }
      if (diffInHours > 0) {
        return `Fuera de línea hace ${diffInHours} hora${diffInHours > 1 ? 's' : ''}`;
      }
      if (diffInMinutes > 0) {
        return `Fuera de línea hace ${diffInMinutes} minuto${diffInMinutes > 1 ? 's' : ''}`;
      }

      return 'Fuera de línea hace menos de 1 minuto';
    } catch (error) {
      console.error('Error formateando tiempo offline:', error);
      return 'Fuera de línea (error al calcular)';
    }
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

    // Set column widths
    worksheet.columns = [
      { key: 'col1', width: 5 }, // Empty column for spacing
      { key: 'col2', width: 25 },
      { key: 'col3', width: 20 },
      { key: 'col4', width: 15 },
      { key: 'col5', width: 12 },
      { key: 'col6', width: 15 },
      { key: 'col7', width: 15 },
      { key: 'col8', width: 15 }
    ];

    let currentRow = 1; // Start from row 1

    // Process each user
    this.filteredMonitoringData.forEach((userData, userIndex) => {
      // Add user route as title
      const userHierarchy = userData.route && userData.route.length > 0
        ? userData.route.map(item => item.fullName).join(' > ')
        : 'Sin jerarquía';

      const userName = userData.route && userData.route.length > 0
        ? userData.route[userData.route.length - 1].fullName
        : 'Sin nombre';

      // Add user title row
      const titleRow = worksheet.addRow({
        col1: '',
        col2: `Usuario: ${userName}`,
        col3: '',
        col4: '',
        col5: '',
        col6: '',
        col7: '',
        col8: ''
      });

      // Style user title
      titleRow.getCell(2).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF007BFF' } // Blue background
      };
      titleRow.getCell(2).font = {
        bold: true,
        color: { argb: 'FFFFFFFF' }, // White text
        size: 14
      };
      titleRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };

      // Merge cells for title
      worksheet.mergeCells(`B${currentRow}:H${currentRow}`);
      currentRow++;

      // Add hierarchy info
      const hierarchyRow = worksheet.addRow({
        col1: '',
        col2: `Jerarquía: ${userHierarchy}`,
        col3: '',
        col4: '',
        col5: '',
        col6: '',
        col7: '',
        col8: ''
      });

      hierarchyRow.getCell(2).font = {
        italic: true,
        color: { argb: 'FF666666' },
        size: 11
      };
      worksheet.mergeCells(`B${currentRow}:H${currentRow}`);
      currentRow++;

      // Add device count
      const deviceCountRow = worksheet.addRow({
        col1: '',
        col2: `Total de dispositivos: ${userData.devices.length}`,
        col3: '',
        col4: '',
        col5: '',
        col6: '',
        col7: '',
        col8: ''
      });

      deviceCountRow.getCell(2).font = {
        bold: true,
        color: { argb: 'FF333333' },
        size: 11
      };
      worksheet.mergeCells(`B${currentRow}:H${currentRow}`);
      currentRow++;

      // Add empty row for spacing
      worksheet.addRow({
        col1: '',
        col2: '',
        col3: '',
        col4: '',
        col5: '',
        col6: '',
        col7: '',
        col8: ''
      });
      currentRow++;

      // Add device table headers
      const headerRow = worksheet.addRow({
        col1: '',
        col2: 'Nombre Dispositivo',
        col3: 'IMEI',
        col4: 'Protocolo',
        col5: 'Estado',
        col6: 'Conexión',
        col7: 'Fecha Expiración',
        col8: 'Número SIM'
      });

      // Style header row
      headerRow.eachCell((cell, colNumber) => {
        if (colNumber > 1) { // Skip first column (empty)
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF007BFF' } // Blue background
          };
          cell.font = {
            bold: true,
            color: { argb: 'FFFFFFFF' }, // White text
            size: 11
          };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
          };
        }
      });
      currentRow++;

      // Add device data rows
      userData.devices.forEach((device, deviceIndex) => {
        const dataRow = worksheet.addRow({
          col1: '',
          col2: device.name || '',
          col3: device.device_imei || '',
          col4: this.getProtocolName(device.type) || '',
          col5: device.status ? 'Activo' : 'Inactivo',
          col6: this.getConnectionDisplay(device),
          col7: this.formatExpirationDate(device.expiration_date) || '',
          col8: device.sim_card_number || ''
        });

        // Style data row
        dataRow.eachCell((cell, colNumber) => {
          if (colNumber > 1) { // Skip first column (empty)
            const isEvenRow = deviceIndex % 2 === 0;
            const backgroundColor = isEvenRow ? 'FFF8F9FA' : 'FFFFFFFF';

            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: backgroundColor }
            };
            cell.font = {
              color: { argb: 'FF000000' },
              size: 10
            };
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFDEDEDE' } },
              bottom: { style: 'thin', color: { argb: 'FFDEDEDE' } },
              left: { style: 'thin', color: { argb: 'FFDEDEDE' } },
              right: { style: 'thin', color: { argb: 'FFDEDEDE' } }
            };
          }
        });

        // Special styling for status column (column E - Estado)
        const statusCell = dataRow.getCell(5);
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

        // Special styling for connection column (column F - Conexión)
        const connectionCell = dataRow.getCell(6);
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
        const expirationCell = dataRow.getCell(7);
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

        currentRow++;
      });

      // Add spacing between users (except for the last user)
      if (userIndex < this.filteredMonitoringData.length - 1) {
        worksheet.addRow({
          col1: '',
          col2: '',
          col3: '',
          col4: '',
          col5: '',
          col6: '',
          col7: '',
          col8: ''
        });
        worksheet.addRow({
          col1: '',
          col2: '',
          col3: '',
          col4: '',
          col5: '',
          col6: '',
          col7: '',
          col8: ''
        });
        currentRow += 2;
      }
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
