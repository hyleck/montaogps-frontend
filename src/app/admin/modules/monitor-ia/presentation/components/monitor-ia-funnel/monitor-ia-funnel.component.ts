import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../../../../../environments/environment';

@Component({
  selector: 'app-monitor-ia-funnel',
  templateUrl: './monitor-ia-funnel.component.html',
  styleUrls: ['./monitor-ia-funnel.component.css'],
  standalone: false
})
export class MonitorIaFunnelComponent implements OnInit, OnDestroy {
  session: any = null;
  devices: any[] = [];
  loading = true;
  waitHours = 5;
  pollingInterval: any;

  phases = [
    { label: 'Detección', icon: 'pi pi-search', phase: 1 },
    { label: 'Reactivación', icon: 'pi pi-bolt', phase: 2 },
    { label: 'Espera', icon: 'pi pi-clock', phase: 3 },
    { label: 'Re-verificación', icon: 'pi pi-refresh', phase: 4 },
    { label: 'Contacto', icon: 'pi pi-phone', phase: 5 }
  ];

  // Contact form state
  contactDeviceId: string | null = null;
  contactResponse = '';

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.fetchSession();
    this.pollingInterval = setInterval(() => this.fetchSession(), 5000);
  }

  ngOnDestroy(): void {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
  }

  fetchSession() {
    this.http.get<any>(`${environment.apiUrl}/monitor-ia/funnel/active`).subscribe({
      next: (data) => {
        this.session = data;
        this.loading = false;
        if (data && data._id) {
          this.fetchDevices(data._id);
        }
      },
      error: () => this.loading = false
    });
  }

  fetchDevices(sessionId: string) {
    this.http.get<any[]>(`${environment.apiUrl}/monitor-ia/funnel/${sessionId}/devices`).subscribe({
      next: (data) => this.devices = data || [],
      error: () => {}
    });
  }

  startFunnel() {
    this.loading = true;
    this.http.post<any>(`${environment.apiUrl}/monitor-ia/funnel/start`, { waitHours: this.waitHours }).subscribe({
      next: () => this.fetchSession(),
      error: (err) => {
        console.error('Error starting funnel', err);
        this.loading = false;
      }
    });
  }

  forceRecheck() {
    if (!this.session?._id) return;
    this.http.post<any>(`${environment.apiUrl}/monitor-ia/funnel/recheck/${this.session._id}`, {}).subscribe({
      next: () => this.fetchSession()
    });
  }

  openContactForm(deviceId: string) {
    this.contactDeviceId = deviceId;
    this.contactResponse = '';
  }

  submitContact() {
    if (!this.contactDeviceId) return;
    this.http.patch<any>(`${environment.apiUrl}/monitor-ia/funnel/device/${this.contactDeviceId}/contact`, {
      response: this.contactResponse,
      contactedBy: 'Operador'
    }).subscribe({
      next: () => {
        this.contactDeviceId = null;
        this.contactResponse = '';
        if (this.session?._id) this.fetchDevices(this.session._id);
      }
    });
  }

  cancelContact() {
    this.contactDeviceId = null;
    this.contactResponse = '';
  }

  get persistentDevices() {
    return this.devices.filter(d => d.finalStatus === 'persistent');
  }

  get recoveredDevices() {
    return this.devices.filter(d => d.finalStatus === 'recovered');
  }

  get contactedCount() {
    return this.persistentDevices.filter(d => d.contacted).length;
  }

  get pendingContactCount() {
    return this.persistentDevices.filter(d => !d.contacted).length;
  }

  getPhaseStatus(phase: number): string {
    if (!this.session) return 'pending';
    if (this.session.phase > phase) return 'completed';
    if (this.session.phase === phase) return 'active';
    return 'pending';
  }

  getTimeRemaining(): string {
    if (!this.session?.recheckScheduledAt) return '';
    const diff = new Date(this.session.recheckScheduledAt).getTime() - Date.now();
    if (diff <= 0) return 'Verificación inminente...';
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${mins}m restantes`;
  }

  goBack() {
    this.router.navigate(['/admin/monitor-ia']);
  }
}
