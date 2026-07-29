import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { finalize } from 'rxjs';
import {
  OfflineCategory,
  OfflineDeviceRecord,
  SegmentationSummary,
} from '../../models/monitor-ia.models';
import { MonitorIaApiService } from '../../services/monitor-ia-api.service';

@Component({
  selector: 'app-monitor-ia-segmentation',
  templateUrl: './monitor-ia-segmentation.component.html',
  styleUrls: ['./monitor-ia-segmentation.component.css'],
  standalone: false,
})
export class MonitorIaSegmentationComponent implements OnInit {
  records: OfflineDeviceRecord[] = [];
  summary: SegmentationSummary = {
    vigente: 0,
    estado_inicial: 0,
    suspendido: 0,
    expirado: 0,
  };
  total = 0;
  page = 1;
  readonly limit = 30;
  search = '';
  category: OfflineCategory | '' = '';
  loading = true;
  sessionCreatedAt?: string;

  readonly categories: Array<{
    value: OfflineCategory | '';
    label: string;
    icon: string;
  }> = [
    { value: '', label: 'Todas', icon: 'pi pi-th-large' },
    { value: 'vigente', label: 'Vigentes', icon: 'pi pi-check-circle' },
    {
      value: 'estado_inicial',
      label: 'Estado inicial',
      icon: 'pi pi-clock',
    },
    { value: 'suspendido', label: 'Suspendidos', icon: 'pi pi-pause' },
    { value: 'expirado', label: 'Expirados', icon: 'pi pi-calendar-times' },
  ];

  constructor(
    private readonly api: MonitorIaApiService,
    private readonly router: Router,
    private readonly messageService: MessageService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  selectCategory(category: OfflineCategory | ''): void {
    this.category = category;
    this.page = 1;
    this.load();
  }

  applySearch(): void {
    this.page = 1;
    this.load();
  }

  onPageChange(event: any): void {
    this.page = Number(event?.page || 0) + 1;
    this.load();
  }

  goBack(): void {
    this.router.navigate(['/admin/monitor-ia']);
  }

  goToFunnel(): void {
    this.router.navigate(['/admin/monitor-ia/funnel']);
  }

  categoryLabel(category: OfflineCategory): string {
    return (
      this.categories.find((item) => item.value === category)?.label ||
      category
    );
  }

  categoryCount(category: OfflineCategory | ''): number {
    if (!category) {
      return Object.values(this.summary).reduce(
        (total, value) => total + Number(value || 0),
        0,
      );
    }
    return this.summary[category] || 0;
  }

  get selectedCategoryLabel(): string {
    return (
      this.categories.find((item) => item.value === this.category)?.label ||
      'Todas'
    );
  }

  trackRecord(_: number, record: OfflineDeviceRecord): string {
    return record._id;
  }

  private load(): void {
    this.loading = true;
    this.api
      .getSegmentation({
        page: this.page,
        limit: this.limit,
        search: this.search,
        category: this.category,
      })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (response) => {
          this.records = response.items || [];
          this.total = response.total || 0;
          this.summary = response.summary || this.summary;
          this.sessionCreatedAt = response.session?.createdAt;
        },
        error: (error) =>
          this.messageService.add({
            severity: 'error',
            summary: 'Segmentación',
            detail:
              error?.error?.message ||
              'No se pudo cargar la segmentación.',
          }),
      });
  }
}
