import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { Subscription } from 'rxjs';
import { InventoryLotCategory, InventoryLotDetails, InventoryLotPage, InventoryService, ShippingLotSelection, UpdateInventoryLot, Warehouse } from '../../../../../../core/services/inventory.service';
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
  @Input() canUpdate = false;
  @Input() canDelete = false;
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
  editingLot: InventoryLotDetails | null = null;
  deletingLot: InventoryLotDetails | null = null;
  deleteVisible = false;
  deleting = false;
  deleteError = '';
  detailsLoadingId = '';
  actionError = '';
  actionSuccess = '';
  draft = { category: 'relay' as InventoryLotCategory, name: '', quantity: 1, storage_id: null as string | null, description: '', request_id: '' };
  private request?: Subscription;
  private saveRequest?: Subscription;
  private detailsRequest?: Subscription;
  private deleteRequest?: Subscription;

  constructor(private readonly inventory: InventoryService) {}
  ngOnChanges(): void { this.load(1); }
  ngOnDestroy(): void { this.request?.unsubscribe(); this.saveRequest?.unsubscribe(); this.detailsRequest?.unsubscribe(); this.deleteRequest?.unsubscribe(); }

  load(page = 1): void {
    this.request?.unsubscribe();
    this.loading = true;
    this.error = '';
    this.page = page;
    this.request = this.inventory.getLots(this.category || this.filterCategory, this.storage, this.query.trim(), page).subscribe({
      next: result => {
        const lastPage = Math.max(1, result.lastPage);
        if (page > lastPage) { this.load(lastPage); return; }
        this.applyPage(result); this.loading = false;
      },
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
  get canManage(): boolean { return !this.picker && (this.canUpdate || this.canDelete); }
  get stockLocked(): boolean { return !!this.editingLot?.stock_locked; }
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
    if (!this.canCreate || this.saving || this.deleting) return;
    this.detailsRequest?.unsubscribe();
    this.detailsLoadingId = '';
    this.editingLot = null;
    this.draft = { category: this.category || 'relay', name: '', quantity: 1, storage_id: null, description: '', request_id: globalThis.crypto?.randomUUID?.() || `lot-${Date.now()}-${Math.random().toString(36).slice(2)}` };
    this.formError = '';
    this.formVisible = true;
  }
  save(): void {
    if ((this.editingLot ? !this.canUpdate : !this.canCreate) || this.saving) return;
    if (!this.draft.name.trim() || (!this.stockLocked && (!Number.isSafeInteger(this.draft.quantity) || this.draft.quantity <= 0 || this.draft.quantity > 1_000_000))) {
      this.formError = 'Escriba la referencia del lote y una cantidad entera entre 1 y 1,000,000.';
      return;
    }
    this.saving = true;
    this.formError = '';
    const editing = this.editingLot;
    const update: UpdateInventoryLot | null = editing ? {
      version: editing.version, name: this.draft.name.trim(), description: this.draft.description,
      ...(!this.stockLocked ? { category: this.draft.category, quantity: this.draft.quantity, storage_id: this.draft.storage_id } : {}),
    } : null;
    const operation = editing
      ? this.inventory.updateLot(editing._id, update!)
      : this.inventory.createLot({ ...this.draft, name: this.draft.name.trim() });
    this.saveRequest = operation.subscribe({
      next: () => {
        this.saving = false; this.formVisible = false; this.editingLot = null;
        this.actionError = ''; this.actionSuccess = editing ? 'Lote actualizado.' : 'Lote registrado.';
        if (!editing) { this.query = ''; this.storage = ''; }
        this.load(editing ? this.page : 1);
      },
      error: error => { this.saving = false; this.formError = getApiErrorMessage(error, editing ? 'No se pudo actualizar el lote.' : 'No se pudo registrar el lote.'); },
    });
  }

  openEdit(row: LotRow): void {
    if (!this.canUpdate || this.picker || this.saving || this.deleting) return;
    this.loadDetails(row, 'edit');
  }

  openDelete(row: LotRow): void {
    if (!this.canDelete || this.picker || this.saving || this.deleting) return;
    this.loadDetails(row, 'delete');
  }

  private loadDetails(row: LotRow, action: 'edit' | 'delete'): void {
    this.detailsRequest?.unsubscribe();
    this.detailsLoadingId = row.lot_id;
    this.actionError = ''; this.actionSuccess = '';
    this.detailsRequest = this.inventory.getLot(row.lot_id).subscribe({
      next: lot => {
        this.detailsLoadingId = '';
        if (action === 'delete') {
          if (!this.canDelete || this.picker) return;
          this.deletingLot = lot; this.deleteVisible = true; this.deleteError = '';
        } else {
          if (!this.canUpdate || this.picker) return;
          const storage = lot.balances.length === 1 ? lot.balances[0].storage_id : null;
          this.editingLot = lot;
          this.draft = { category: lot.category, name: lot.name, quantity: lot.quantity, storage_id: typeof storage === 'object' ? storage?._id || null : storage, description: lot.description || '', request_id: '' };
          this.formError = ''; this.formVisible = true;
        }
      },
      error: error => { this.detailsLoadingId = ''; this.actionError = getApiErrorMessage(error, 'No se pudieron cargar los datos del lote.'); },
    });
  }

  confirmDelete(): void {
    const lot = this.deletingLot;
    if (!lot || !this.canDelete || this.picker || this.deleting || lot.pending_transfer) return;
    this.deleting = true; this.deleteError = '';
    this.deleteRequest = this.inventory.deleteLot(lot._id, lot.version).subscribe({
      next: () => {
        this.deleting = false; this.deleteVisible = false; this.deletingLot = null;
        this.actionError = ''; this.actionSuccess = 'Lote eliminado. El historial de conduces se conserva.';
        this.load(this.page);
      },
      error: error => { this.deleting = false; this.deleteError = getApiErrorMessage(error, 'No se pudo eliminar el lote.'); },
    });
  }

  warehouseName(storage: InventoryLotDetails['balances'][number]['storage_id']): string {
    if (!storage) return 'Sin asignar';
    return typeof storage === 'object' ? storage.name : this.warehouses.find(warehouse => warehouse._id === storage)?.name || 'Almacén no disponible';
  }
}
