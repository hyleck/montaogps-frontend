import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MonitoringService, MonitorUserResponse } from '../../../../../../core/services/monitoring.service';
import { UserService } from '../../../../../../core/services/user.service';
import { ProtocolsService } from '../../../../../../core/services/protocols.service';
import { User } from '../../../../../../core/interfaces/user.interface';
import { TranslateService } from '@ngx-translate/core';

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
  protocols: any[] = [];

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

  openUserSearchModal(): void {
    this.showUserSearchModal = true;
  }

  closeUserSearchModal(): void {
    this.showUserSearchModal = false;
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

  getProtocolName(deviceType: string): string {
    if (!deviceType || !this.protocols.length) {
      return deviceType || 'Unknown';
    }

    const protocol = this.protocols.find(p => p._id === deviceType);
    return protocol ? protocol.name : deviceType;
  }

  // Getter to filter out users without devices
  get filteredMonitoringData() {
    if (!this.monitoringResult?.data) {
      return [];
    }

    return this.monitoringResult.data.filter(userData =>
      userData.devices && userData.devices.length > 0
    );
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
}