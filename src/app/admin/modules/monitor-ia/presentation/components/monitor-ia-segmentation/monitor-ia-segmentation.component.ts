import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../../../../../environments/environment';

@Component({
  selector: 'app-monitor-ia-segmentation',
  templateUrl: './monitor-ia-segmentation.component.html',
  styleUrls: ['./monitor-ia-segmentation.component.css'],
  standalone: false
})
export class MonitorIaSegmentationComponent implements OnInit {
  records: any[] = [];
  expirados: any[] = [];
  suspendidos: any[] = [];
  estadoInicial: any[] = [];
  vigentes: any[] = [];
  
  loading: boolean = true;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.fetchSegmentations();
  }

  fetchSegmentations() {
    this.loading = true;
    this.http.get<any[]>(`${environment.apiUrl}/monitor-ia/segmentation/offline`).subscribe({
      next: (data) => {
        this.records = data;
        this.categorizeRecords(data);
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching offline segmentations', err);
        this.loading = false;
      }
    });
  }

  categorizeRecords(records: any[]) {
    this.expirados = [];
    this.suspendidos = [];
    this.estadoInicial = [];
    this.vigentes = [];

    records.forEach(r => {
      const dev = r.deviceData;
      if (!dev) return;

      // Estado Inicial: Sin reporte previo
      if (!dev.traccarInfo || !dev.traccarInfo.lastUpdate) {
        this.estadoInicial.push(r);
        return;
      }

      // Suspendidos: Cortados desde plataforma (corte financiero/administrativo)
      if (dev.status === false || dev.status === 'false') {
        this.suspendidos.push(r);
        return;
      }

      // Expirados: Fecha plataforma vencida
      if (dev.isExpired) {
        this.expirados.push(r);
        return;
      }

      // Vigentes: El resto
      this.vigentes.push(r);
    });
  }

  goBack() {
    this.router.navigate(['/admin/monitor-ia']);
  }
}
