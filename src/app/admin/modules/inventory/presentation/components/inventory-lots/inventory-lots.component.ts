import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { Subscription } from 'rxjs';
import { InventoryLotCategory, InventoryLotPage, InventoryService, ShippingLotSelection, Warehouse } from '../../../../../../core/services/inventory.service';
import { getApiErrorMessage } from '../../../../../../core/utils/api-error.util';

interface LotRow extends ShippingLotSelection { key: string; createdAt?: string; }

@Component({
  selector: 'app-inventory-lots', standalone: true,
  imports: [CommonModule, FormsModule, DialogModule],
  templateUrl: './inventory-lots.component.html', styleUrl: './inventory-lots.component.css',
})
export class InventoryLotsComponent implements OnChanges, OnDestroy {
  @Input() category: InventoryLotCategory | '' = '';
  @Input() warehouses: Warehouse[] = [];
  @Input() canCreate = false;
  @Input() picker = false;
  @Input() destination: string | null = null;
  @Input() refreshKey = 0;
  @Output() selectLot = new EventEmitter<ShippingLotSelection>();
  rows: LotRow[] = [];
  quantities: Record<string, number> = {};
  query = '';
  storage = '';
  filterCategory = '';
  page = 1;
  total = 0;
  totalQuantity = 0;
  lastPage = 0;
  loading = false;
  error = '';
  formVisible = false;
  saving = false;
  formError = '';
  draft = { category: 'relay' as InventoryLotCategory, name: '', quantity: 1, storage_id: null as string | null, description: '', request_id: '' };
  private request?: Subscription;
  private saveRequest?: Subscription;

  constructor(private readonly inventory: InventoryService) {}
  ngOnChanges(): void { this.load(1); }
  ngOnDestroy(): void { this.request?.unsubscribe(); this.saveRequest?.unsubscribe(); }

  load(page = 1): void {
    this.request?.unsubscribe();
    this.loading = true;
    this.error = '';
    this.page = page;
    this.request = this.inventory.getLots(this.category || this.filterCategory, this.storage, this.query.trim(), page).subscribe({
      next: result => { this.applyPage(result); this.loading = false; },
      error: error => { this.rows = []; this.loading = false; this.error = getApiErrorMessage(error, 'No se pudieron cargar los lotes.'); },
    });
  }

  private applyPage(result: InventoryLotPage): void {
    this.total = result.total;
    this.totalQuantity = result.total_quantity;
    this.lastPage = result.lastPage;
    this.rows = result.data.flatMap(lot => lot.balances.map(balance => {
      const source = typeof balance.storage_id === 'object' ? balance.storage_id?._id || null : balance.storage_id;
      const sourceName = typeof balance.storage_id === 'object' ? balance.storage_id?.name : this.warehouses.find(w => w._id === source)?.name;
      return { key: `${lot._id}:${source || 'unassigned'}`, lot_id: lot._id, source_warehouse: source, source_name: sourceName || (source ? 'Almacén no disponible' : 'Sin asignar'), name: lot.name, category: lot.category, quantity: 1, available: balance.quantity, createdAt: lot.createdAt };
    }));
    this.quantities = {};
    this.rows.forEach(row => this.quantities[row.key] = 1);
  }

  label(category: string | undefined): string { return category === 'cables' ? 'Cables' : 'Relay'; }
  get hasFilters(): boolean { return !!(this.query.trim() || this.storage || this.filterCategory); }
  clearFilters(): void {
    this.query = '';
    this.storage = '';
    this.filterCategory = '';
    this.load(1);
  }
  trackRow(_index: number, row: LotRow): string { return row.key; }
  validQuantity(row: LotRow): boolean {
    const quantity = this.quantities[row.key];
    return Number.isSafeInteger(quantity) && quantity > 0 && quantity <= row.available && (!this.destination || this.destination !== row.source_warehouse);
  }
  choose(row: LotRow): void {
    if (!this.canCreate || !this.validQuantity(row)) return;
    this.selectLot.emit({ lot_id: row.lot_id, source_warehouse: row.source_warehouse, source_name: row.source_name, category: row.category, name: row.name, available: row.available, quantity: this.quantities[row.key] });
  }
  openNew(): void {
    if (!this.canCreate) return;
    this.draft = { category: this.category || 'relay', name: '', quantity: 1, storage_id: null, description: '', request_id: globalThis.crypto?.randomUUID?.() || `lot-${Date.now()}-${Math.random().toString(36).slice(2)}` };
    this.formError = '';
    this.formVisible = true;
  }
  save(): void {
    if (!this.canCreate || this.saving) return;
    if (!this.draft.name.trim() || !Number.isSafeInteger(this.draft.quantity) || this.draft.quantity <= 0 || this.draft.quantity > 1_000_000) {
      this.formError = 'Escriba la referencia del lote y una cantidad entera entre 1 y 1,000,000.';
      return;
    }
    this.saving = true;
    this.formError = '';
    this.saveRequest = this.inventory.createLot({ ...this.draft, name: this.draft.name.trim() }).subscribe({
      next: () => { this.saving = false; this.formVisible = false; this.query = ''; this.storage = ''; this.load(1); },
      error: error => { this.saving = false; this.formError = getApiErrorMessage(error, 'No se pudo registrar el lote.'); },
    });
  }
}
