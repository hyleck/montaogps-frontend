import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { map, of, Subscription, switchMap } from 'rxjs';
import { SIM_CARD_TYPES } from '../../../../../../core/constants/sim-card-types.constant';
import { InventoryAuditUser, InventoryService, SimcardItem, Warehouse } from '../../../../../../core/services/inventory.service';
import { getApiErrorMessage } from '../../../../../../core/utils/api-error.util';

@Component({
  selector: 'app-inventory-simcard-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule],
  templateUrl: './inventory-simcard-selector.component.html',
  styleUrls: ['./inventory-simcard-selector.component.css'],
})
export class InventorySimcardSelectorComponent implements OnChanges, OnDestroy {
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;
  @Input() sim: string | undefined = '';
  @Input() idsim: string | undefined = '';
  @Input() warehouses: Warehouse[] = [];
  @Input() twoColumns = false;
  @Output() simChange = new EventEmitter<string>();
  @Output() idsimChange = new EventEmitter<string>();
  @Output() lookupPendingChange = new EventEmitter<boolean>();

  selected: SimcardItem | null = null;
  resolving = false;
  lookupError = '';
  codeInput = '';
  codeMessage = '';
  private codePending = false;
  visible = false;
  query = '';
  results: SimcardItem[] = [];
  loading = false;
  searchError = '';
  page = 1;
  lastPage = 1;
  total = 0;
  readonly pageSize = 20;
  private lookupRequest?: Subscription;
  private searchRequest?: Subscription;
  private searchTimer?: ReturnType<typeof setTimeout>;
  private codeRequest?: Subscription;
  private codeTimer?: ReturnType<typeof setTimeout>;

  constructor(private inventoryService: InventoryService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sim'] || changes['idsim']) {
      this.resetCodeSearch();
      if (!this.selected || this.selected.iccid !== this.sim || (this.selected.idsim || '') !== (this.idsim || '')) {
        this.codeInput = this.idsim || this.sim || '';
      }
      this.resolveSelection();
    }
  }

  ngOnDestroy(): void {
    this.lookupRequest?.unsubscribe();
    this.resetCodeSearch();
    this.closePicker();
  }

  get hasIdentifier(): boolean {
    return !!(this.sim?.trim() || this.idsim?.trim());
  }

  get findingCode(): boolean {
    return this.codePending;
  }

  private set findingCode(pending: boolean) {
    if (this.codePending === pending) return;
    this.codePending = pending;
    this.lookupPendingChange.emit(pending);
  }

  resolveSelection(): void {
    this.lookupRequest?.unsubscribe();
    this.resolving = false;
    this.lookupError = '';
    if (this.selected && this.selected.iccid === this.sim && (this.selected.idsim || '') === (this.idsim || '')) return;
    this.selected = null;
    if (!this.hasIdentifier) return;

    this.resolving = true;
    const lookup = this.sim?.trim()
      ? this.inventoryService.findSimcardByIccid(this.sim.trim())
      : of(null);
    this.lookupRequest = lookup.pipe(switchMap(found => {
      if (found || !this.idsim?.trim()) return of(found);
      return this.inventoryService.searchAllSimcards(this.idsim.trim(), undefined, 1, 100).pipe(
        map(response => response.data.find(item => this.normalizeIdentifier(item.idsim) === this.normalizeIdentifier(this.idsim)) || null),
      );
    })).subscribe({
      next: found => {
        // Loading an existing device must never overwrite its saved identifiers.
        this.selected = found;
        this.resolving = false;
      },
      error: error => {
        this.lookupError = getApiErrorMessage(error, 'No se pudieron cargar los datos de la SIM card.');
        this.resolving = false;
      },
    });
  }

  openPicker(): void {
    this.resetCodeSearch();
    this.visible = true;
    this.query = '';
    this.search(1);
  }

  closePicker(): void {
    clearTimeout(this.searchTimer);
    this.searchRequest?.unsubscribe();
    this.loading = false;
    this.visible = false;
  }

  focusSearch(): void {
    this.searchInput?.nativeElement.focus();
  }

  onQueryChange(): void {
    clearTimeout(this.searchTimer);
    this.searchRequest?.unsubscribe();
    this.results = [];
    this.total = 0;
    this.lastPage = 1;
    this.searchError = '';
    this.loading = true;
    this.searchTimer = setTimeout(() => this.search(1), 300);
  }

  search(page = 1): void {
    clearTimeout(this.searchTimer);
    this.searchRequest?.unsubscribe();
    this.page = page;
    this.loading = true;
    this.results = [];
    this.searchError = '';
    this.searchRequest = this.inventoryService.searchAllSimcards(this.query.trim(), undefined, page, this.pageSize).subscribe({
      next: response => {
        this.results = response.data || [];
        this.total = response.total;
        this.lastPage = response.lastPage || 1;
        this.loading = false;
      },
      error: error => {
        this.searchError = getApiErrorMessage(error, 'No se pudieron buscar las SIM cards.');
        this.loading = false;
      },
    });
  }

  searchOnEnter(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.search(1);
  }

  onCodeChange(value: string): void {
    this.resetCodeSearch();
    this.codeInput = value;
    if (!value.trim()) return;
    this.findingCode = true;
    this.codeTimer = setTimeout(() => this.findCode(), 350);
  }

  findCode(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    clearTimeout(this.codeTimer);
    this.codeRequest?.unsubscribe();
    const code = this.codeInput.trim();
    this.codeMessage = '';
    this.findingCode = !!code;
    if (!code) return;

    this.codeRequest = this.inventoryService.findSimcardsByIdentifier(code).subscribe({
      next: matches => {
        this.findingCode = false;
        if (matches.length === 1) {
          this.select(matches[0], code);
          return;
        }
        this.codeMessage = matches.length > 1
          ? 'El código coincide con varias SIM cards. Elige una desde el buscador.'
          : 'No se encontró una SIM card registrada con este código.';
        if (this.hasIdentifier) this.codeMessage += ' Se mantiene la SIM actual.';
      },
      error: error => {
        this.findingCode = false;
        this.codeMessage = getApiErrorMessage(error, 'No se pudo consultar la SIM. Presiona Enter para reintentar.');
      },
    });
  }

  private resetCodeSearch(): void {
    clearTimeout(this.codeTimer);
    this.codeRequest?.unsubscribe();
    this.findingCode = false;
    this.codeMessage = '';
  }

  select(simcard: SimcardItem, code = simcard.idsim || simcard.iccid): void {
    this.resetCodeSearch();
    this.lookupRequest?.unsubscribe();
    this.selected = simcard;
    this.resolving = false;
    this.lookupError = '';
    this.sim = simcard.iccid;
    this.idsim = simcard.idsim || '';
    this.codeInput = code;
    this.simChange.emit(this.sim);
    this.idsimChange.emit(this.idsim);
    this.closePicker();
  }

  remove(): void {
    this.resetCodeSearch();
    this.codeInput = '';
    this.lookupRequest?.unsubscribe();
    this.selected = null;
    this.resolving = false;
    this.lookupError = '';
    this.sim = '';
    this.idsim = '';
    this.simChange.emit('');
    this.idsimChange.emit('');
  }

  companyLabel(company?: string): string {
    return SIM_CARD_TYPES.find(type => type.value === company)?.label || company || 'Sin compañía';
  }

  warehouseLabel(simcard: SimcardItem): string {
    const storage = simcard.storage_id;
    if (!storage) return 'Sin almacén';
    return (typeof storage === 'object' ? storage.name : '')
      || this.warehouses.find(warehouse => warehouse._id === (storage._id || storage))?.name
      || 'Almacén no disponible';
  }

  packageLabel(simcard: SimcardItem): string {
    return simcard.package?.title || (simcard.package ? 'Paquete sin título' : 'Sin paquete');
  }

  auditLabel(user?: InventoryAuditUser | string): string {
    if (!user || typeof user !== 'object') return 'No registrado';
    return `${user.name || ''} ${user.last_name || ''}`.trim() || user.email || 'No registrado';
  }

  trackSimcard(_index: number, simcard: SimcardItem): string {
    return simcard._id || simcard.iccid;
  }

  private normalizeIdentifier(value?: string): string {
    return (value || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  }
}
