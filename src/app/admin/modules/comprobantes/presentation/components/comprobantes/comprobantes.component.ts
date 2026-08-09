import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  ExpenseReceipt,
  ExpenseReceiptAccountingCategory,
  ExpenseReceiptsService,
} from '../../../../../../core/services/expense-receipts.service';

interface ReceiptCategoryGroup {
  category: string;
  label: string;
  items: ExpenseReceipt[];
}

interface ReceiptDateGroup {
  key: string;
  label: string;
  categories: ReceiptCategoryGroup[];
  count: number;
}

@Component({
  selector: 'app-comprobantes',
  templateUrl: './comprobantes.component.html',
  styleUrls: ['./comprobantes.component.css'],
  standalone: false,
})
export class ComprobantesComponent implements OnInit, OnDestroy {
  receipts: ExpenseReceipt[] = [];
  total = 0;
  page = 1;
  readonly limit = 30;
  loading = true;
  error = '';
  success = '';
  search = '';
  accountingCategory = '';
  status = '';
  dateFrom = '';
  dateTo = '';
  selectedReceipt: ExpenseReceipt | null = null;
  reprocessingId = '';
  uploadModalOpen = false;
  uploadFile: File | null = null;
  uploadPreviewUrl = '';
  uploadCategory: ExpenseReceiptAccountingCategory | '' = '';
  uploadError = '';
  uploading = false;
  private readonly dateKeyFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Santo_Domingo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  readonly categories = [
    'gasto_operativo',
    'gasto_representacion',
  ];

  readonly categoryLabels: Record<string, string> = {
    gasto_operativo: 'Gasto operativo',
    gasto_representacion: 'Gasto de representación',
    sin_clasificar: 'Sin clasificar',
  };

  readonly detectedCategoryLabels: Record<string, string> = {
    alimentacion: 'Alimentación',
    combustible: 'Combustible',
    transporte: 'Transporte',
    alojamiento: 'Alojamiento',
    peaje_estacionamiento: 'Peaje y estacionamiento',
    materiales_suministros: 'Materiales y suministros',
    mantenimiento_reparacion: 'Mantenimiento y reparación',
    comunicaciones: 'Comunicaciones',
    servicios: 'Servicios',
    otros: 'Otros',
  };

  constructor(private readonly receiptsService: ExpenseReceiptsService) {}

  ngOnInit(): void {
    this.loadReceipts();
  }

  ngOnDestroy(): void {
    this.releaseUploadPreview();
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.limit));
  }

  get digitizedCount(): number {
    return this.receipts.filter(item => item.processing_status === 'completed').length;
  }

  get reviewCount(): number {
    return this.receipts.filter(item => ['needs_review', 'failed'].includes(item.processing_status)).length;
  }

  get visibleCategoryCount(): number {
    return new Set(this.receipts.map(item => item.accounting_category || 'sin_clasificar')).size;
  }

  get dateGroups(): ReceiptDateGroup[] {
    const dateMap = new Map<string, Map<string, ExpenseReceipt[]>>();
    for (const receipt of this.receipts) {
      const dateKey = this.getDateKey(receipt);
      if (!dateMap.has(dateKey)) dateMap.set(dateKey, new Map());
      const categoryMap = dateMap.get(dateKey)!;
      const category = receipt.accounting_category || 'sin_clasificar';
      if (!categoryMap.has(category)) categoryMap.set(category, []);
      categoryMap.get(category)!.push(receipt);
    }

    return [...dateMap.entries()].map(([key, categoryMap]) => ({
      key,
      label: this.dateGroupLabel(key),
      count: [...categoryMap.values()].reduce((total, items) => total + items.length, 0),
      categories: [...categoryMap.entries()]
        .sort(([left], [right]) => this.categoryOrder(left) - this.categoryOrder(right))
        .map(([category, items]) => ({
          category,
          label: this.categoryLabel(category),
          items,
        })),
    }));
  }

  loadReceipts(): void {
    this.loading = true;
    this.error = '';
    this.receiptsService.getAll({
      search: this.search.trim() || undefined,
      accounting_category: this.accountingCategory || undefined,
      status: this.status || undefined,
      date_from: this.dateFrom || undefined,
      date_to: this.dateTo || undefined,
      page: this.page,
      limit: this.limit,
    }).subscribe({
      next: response => {
        this.receipts = response.data || [];
        this.total = Number(response.total || 0);
        this.loading = false;
      },
      error: error => {
        this.error = error?.error?.message || 'No se pudieron cargar los comprobantes.';
        this.receipts = [];
        this.loading = false;
      },
    });
  }

  applyFilters(): void {
    this.page = 1;
    this.loadReceipts();
  }

  clearFilters(): void {
    this.search = '';
    this.accountingCategory = '';
    this.status = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.applyFilters();
  }

  changePage(nextPage: number): void {
    if (nextPage < 1 || nextPage > this.totalPages || nextPage === this.page) return;
    this.page = nextPage;
    this.loadReceipts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  openReceipt(receipt: ExpenseReceipt): void {
    this.selectedReceipt = receipt;
  }

  closeReceipt(): void {
    this.selectedReceipt = null;
  }

  openUploadModal(): void {
    this.resetUploadForm();
    this.success = '';
    this.uploadModalOpen = true;
  }

  closeUploadModal(): void {
    if (this.uploading) return;
    this.uploadModalOpen = false;
    this.resetUploadForm();
  }

  onUploadFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    input.value = '';
    if (file) this.selectUploadFile(file);
  }

  onUploadDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  onUploadFileDropped(event: DragEvent): void {
    event.preventDefault();
    if (this.uploading) return;
    const file = event.dataTransfer?.files?.[0];
    if (file) this.selectUploadFile(file);
  }

  clearUploadFile(): void {
    if (this.uploading) return;
    this.uploadFile = null;
    this.uploadError = '';
    this.releaseUploadPreview();
  }

  submitReceipt(): void {
    if (this.uploading) return;
    if (!this.uploadCategory) {
      this.uploadError = 'Seleccione si corresponde a un gasto operativo o de representación.';
      return;
    }
    if (!this.uploadFile) {
      this.uploadError = 'Seleccione la imagen del comprobante.';
      return;
    }

    this.uploading = true;
    this.uploadError = '';
    this.receiptsService.upload(this.uploadFile, this.uploadCategory).subscribe({
      next: receipt => {
        this.uploading = false;
        this.uploadModalOpen = false;
        this.resetUploadForm();
        this.success = receipt.processing_status === 'failed'
          ? 'El comprobante se guardó, pero la digitalización requiere atención.'
          : 'Comprobante subido y digitalizado correctamente.';
        this.page = 1;
        this.loadReceipts();
      },
      error: error => {
        this.uploading = false;
        const message = error?.error?.message;
        this.uploadError = Array.isArray(message)
          ? message.join(' ')
          : String(message || 'No se pudo subir el comprobante. Intente nuevamente.');
      },
    });
  }

  reprocess(receipt: ExpenseReceipt, event?: Event): void {
    event?.stopPropagation();
    if (this.reprocessingId) return;
    this.reprocessingId = receipt._id;
    this.receiptsService.reprocess(receipt._id).subscribe({
      next: updated => {
        const index = this.receipts.findIndex(item => item._id === updated._id);
        if (index >= 0) this.receipts[index] = updated;
        if (this.selectedReceipt?._id === updated._id) this.selectedReceipt = updated;
        this.reprocessingId = '';
      },
      error: error => {
        this.error = error?.error?.message || 'No se pudo reintentar la digitalización.';
        this.reprocessingId = '';
      },
    });
  }

  categoryLabel(category?: string): string {
    return this.categoryLabels[String(category || '')] || 'Sin clasificar';
  }

  detectedCategoryLabel(category?: string): string {
    return this.detectedCategoryLabels[String(category || '')] || 'Otros';
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Digitalizando',
      completed: 'Digitalizado',
      needs_review: 'Requiere revisión',
      failed: 'Error de IA',
    };
    return labels[status] || status;
  }

  displayReceiptDate(receipt: ExpenseReceipt, includeTime = false): string {
    const value = receipt.expense_date || receipt.createdAt;
    if (!value) return 'Fecha no detectada';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Fecha no detectada';
    return date.toLocaleDateString('es-DO', {
      timeZone: 'America/Santo_Domingo',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    });
  }

  displayAmount(receipt: ExpenseReceipt): string {
    if (receipt.total_amount === undefined || receipt.total_amount === null) return 'Monto no detectado';
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: receipt.currency || 'DOP',
      maximumFractionDigits: 2,
    }).format(receipt.total_amount);
  }

  private selectUploadFile(file: File): void {
    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!supportedTypes.includes(String(file.type || '').toLowerCase())) {
      this.uploadError = 'Use una imagen JPG, PNG o WEBP.';
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      this.uploadError = 'La imagen no puede superar 12 MB.';
      return;
    }
    if (!file.size) {
      this.uploadError = 'La imagen seleccionada está vacía.';
      return;
    }

    this.uploadError = '';
    this.releaseUploadPreview();
    this.uploadFile = file;
    this.uploadPreviewUrl = URL.createObjectURL(file);
  }

  private resetUploadForm(): void {
    this.uploadFile = null;
    this.uploadCategory = '';
    this.uploadError = '';
    this.releaseUploadPreview();
  }

  private releaseUploadPreview(): void {
    if (this.uploadPreviewUrl) URL.revokeObjectURL(this.uploadPreviewUrl);
    this.uploadPreviewUrl = '';
  }

  private getDateKey(receipt: ExpenseReceipt): string {
    const value = receipt.expense_date || receipt.createdAt;
    if (!value) return 'sin-fecha';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'sin-fecha';
    const parts = this.dateKeyFormatter.formatToParts(date);
    const year = parts.find(part => part.type === 'year')?.value;
    const month = parts.find(part => part.type === 'month')?.value;
    const day = parts.find(part => part.type === 'day')?.value;
    return year && month && day ? `${year}-${month}-${day}` : 'sin-fecha';
  }

  private categoryOrder(category: string): number {
    const index = this.categories.indexOf(category);
    return index >= 0 ? index : this.categories.length;
  }

  private dateGroupLabel(key: string): string {
    if (key === 'sin-fecha') return 'Sin fecha detectada';
    const date = new Date(`${key}T12:00:00`);
    return date.toLocaleDateString('es-DO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
}
