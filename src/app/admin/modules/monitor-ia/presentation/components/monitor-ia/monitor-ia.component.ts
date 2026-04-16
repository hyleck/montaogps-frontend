import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-monitor-ia',
  templateUrl: './monitor-ia.component.html',
  styleUrls: ['./monitor-ia.component.css'],
  providers: [MessageService],
  standalone: false
})
export class MonitorIaComponent implements OnInit, OnDestroy {
  apiUrl = environment.apiUrl;
  
  session: any = null;
  records: any[] = [];
  
  isLoadingStart: boolean = false;
  pollingInterval: any;

  constructor(
    private http: HttpClient,
    private messageService: MessageService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.checkActiveSession();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  checkActiveSession() {
    this.http.get<any>(`${this.apiUrl}/monitor-ia/session/active`).subscribe({
      next: (res) => {
        if (res && res.status === 'running') {
          this.session = res;
          this.fetchRecords(res._id); // Fetch live
          this.startPolling(res._id);
        } else if (res && (res.status === 'completed' || res.status === 'failed')) {
          this.session = res;
          this.fetchRecords(res._id);
        }
      },
      error: (err) => {
        console.error('Error checking active session', err);
      }
    });
  }

  expandedOfflineRecords: { [userId: string]: boolean } = {};

  toggleOfflineRecord(userId: string) {
    this.expandedOfflineRecords[userId] = !this.expandedOfflineRecords[userId];
  }

  formatTimeOffline(lastUpdate: any): string {
    if (!lastUpdate) return 'Estado inicial';
    const date = new Date(lastUpdate);
    if (isNaN(date.getTime()) || date.getFullYear() < 2010) return 'Estado inicial';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return 'Estado inicial';

    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays === 0) {
      if (diffHours > 0) return `Hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
      if (diffMins > 0) return `Hace ${diffMins} ${diffMins === 1 ? 'min' : 'mins'}`;
      return 'Hace un momento';
    }

    const years = Math.floor(diffDays / 365);
    const remainingDaysAfterYears = diffDays % 365;
    const months = Math.floor(remainingDaysAfterYears / 30);
    const days = remainingDaysAfterYears % 30;

    const parts = [];
    if (years > 0) parts.push(`${years} ${years === 1 ? 'año' : 'años'}`);
    if (months > 0) parts.push(`${months} ${months === 1 ? 'mes' : 'meses'}`);
    if (days > 0) parts.push(`${days} ${days === 1 ? 'día' : 'días'}`);

    if (parts.length === 0) return 'Hace un momento';
    
    if (parts.length === 1) return `Hace ${parts[0]}`;
    if (parts.length === 2) return `Hace ${parts[0]} y ${parts[1]}`;
    
    const lastPart = parts.pop();
    return `Hace ${parts.join(', ')} y ${lastPart}`;
  }

  get packagedCompletedDevices() {
    return this.createPackages(this.session?.currentActivity?.completedDevices || []);
  }

  get packagedPendingDevices() {
    return this.createPackages(this.session?.currentActivity?.pendingDevices || []);
  }

  private createPackages(devices: string[]): any[] {
    const result = [];
    let i = 0;
    while(i < devices.length) {
       // Empaquetar estricto de 50 en 50
       if (devices.length - i >= 50) {
           result.push({ isPackage: true, count: 50, label: `Pack (50 disp.)`, range: `${i+1} a ${i+50}` });
           i += 50;
       } else {
           result.push({ isPackage: false, detail: devices[i] });
           i++;
       }
    }
    return result;
  }

  iniciarMonitoreoProfundo() {
    this.isLoadingStart = true;
    this.http.post<any>(`${this.apiUrl}/monitor-ia/start`, {}).subscribe({
      next: (res) => {
        this.isLoadingStart = false;
        this.messageService.add({ severity: 'success', summary: 'Iniciado', detail: res.message });
        
        if (res.sessionId) {
          // Mock session to show immediate UI feedback
          this.session = {
            _id: res.sessionId,
            status: 'running',
            progress: 0,
            message: 'Iniciando recolección de árbol de usuarios...'
          };
          this.records = []; // Clear old records
          this.startPolling(res.sessionId);
        }
      },
      error: (err) => {
        this.isLoadingStart = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo iniciar el monitoreo' });
      }
    });
  }

  startPolling(sessionId: string) {
    this.stopPolling();
    
    // Poll every 3 seconds
    this.pollingInterval = setInterval(() => {
      this.pollStatus(sessionId);
      this.fetchRecords(sessionId);
    }, 3000);
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  pollStatus(sessionId: string) {
    this.http.get<any>(`${this.apiUrl}/monitor-ia/session/${sessionId}`).subscribe({
      next: (res) => {
        this.session = res;
        
        if (res.status === 'completed' || res.status === 'failed') {
          this.stopPolling();
          if (res.status === 'completed') {
            this.messageService.add({ severity: 'success', summary: 'Completado', detail: 'El análisis IA ha finalizado. Iniciando embudo de reactivación...' });
            // Auto-start the funnel and navigate to its view
            this.autoStartFunnel();
          } else {
            this.messageService.add({ severity: 'error', summary: 'Fallo', detail: res.error || 'El proceso falló' });
          }
        }
      },
      error: (err) => {
        // If error fetching status, we shouldn't necessarily kill it, but maybe log
        console.error('Error polling status', err);
      }
    });
  }

  fetchRecords(sessionId: string) {
    this.http.get<any[]>(`${this.apiUrl}/monitor-ia/session/${sessionId}/records`).subscribe({
      next: (res) => {
        this.records = res || [];
      },
      error: (err) => {
        console.error('Error fetching records', err);
      }
    });
  }

  getOfflineUsers() {
    if (!this.records) return [];
    
    const now = new Date().getTime();
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;

    const mapped = this.records.map(record => {
       const offlineList = record.devices ? record.devices.filter((d: any) => {
         if (d.isOnline !== false) return false;
         
         const lastUpdate = d.traccarInfo?.lastUpdate;
         if (!lastUpdate) return true; // Estado inicial, siempre se considera offline extremo
         
         const date = new Date(lastUpdate);
         if (isNaN(date.getTime()) || date.getFullYear() < 2010) return true;
         
         const diff = now - date.getTime();
         return diff >= twoDaysMs;
       }) : [];

       return {
         ...record,
         offlineDevices: offlineList
       };
    });

    return mapped.filter(record => record.offlineDevices.length > 0);
  }

  getTotalOfflineDevicesCount(): number {
    return this.getOfflineUsers().reduce((acc, user) => acc + (user.offlineDevices?.length || 0), 0);
  }

  private autoStartFunnel() {
    this.http.post<any>(`${this.apiUrl}/monitor-ia/funnel/start`, { waitHours: 5 }).subscribe({
      next: () => {
        this.messageService.add({ severity: 'info', summary: 'Embudo Iniciado', detail: 'El embudo de reactivación ha sido iniciado automáticamente.' });
        // Navigate to the funnel view
        this.router.navigate(['/admin/monitor-ia/funnel']);
      },
      error: (err) => {
        console.error('Error auto-starting funnel:', err);
        this.messageService.add({ severity: 'warn', summary: 'Aviso', detail: 'No se pudo iniciar el embudo automáticamente. Inícialo manualmente.' });
        // Navigate anyway so user can start manually
        this.router.navigate(['/admin/monitor-ia/funnel']);
      }
    });
  }
}
