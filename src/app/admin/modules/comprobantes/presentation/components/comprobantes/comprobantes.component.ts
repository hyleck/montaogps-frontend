import { Component, OnInit } from '@angular/core';
import {
  ExpenseReceipt,
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
export class ComprobantesComponent implements OnInit {
  receipts: ExpenseReceipt[] = [];
  total = 0;
  page = 1;
  readonly limit = 30;
  loading = true;
  error = '';
  search = '';
  accountingCategory = '';
  status = '';
  dateFrom = '';
  dateTo = '';
  selectedReceipt: ExpenseReceipt | null = null;
  reprocessingId = '';
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
