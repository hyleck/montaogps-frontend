import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { Subscription } from 'rxjs';
import { formatUserName } from 'src/app/core/utils/user-name.util';
import { ProcessClientOption, ProcessesService } from '../../services/processes.service';

export interface ProcessTemplateClient {
  label: string;
  id: string;
  email?: string;
  phone?: string;
}

export interface ProcessTemplateConfiguration {
  types: number[];
  client: ProcessTemplateClient | null;
  dateFrom: Date | null;
  dateTo: Date | null;
}

interface ProcessTemplate {
  name: string;
  type: number;
  icon: string;
  description: string;
}

@Component({
  selector: 'app-process-templates-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, AutoCompleteModule, DatePickerModule, DialogModule],
  templateUrl: './process-templates-dialog.component.html',
  styleUrls: ['./process-templates-dialog.component.css'],
})
export class ProcessTemplatesDialogComponent implements OnChanges, OnDestroy {
  @Input() visible = false;
  @Input() initialClient: ProcessTemplateClient | null = null;
  @Input() initialDateFrom: Date | null = null;
  @Input() initialDateTo: Date | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() generated = new EventEmitter<ProcessTemplateConfiguration>();

  readonly templates: ProcessTemplate[] = [
    { name: 'Renovar ( Facturación a crédito )', type: 4, icon: 'pi pi-refresh', description: 'Consulta las renovaciones con facturación a crédito.' },
    { name: 'Renovar ( Facturación al contado )', type: 20, icon: 'pi pi-calendar-plus', description: 'Consulta las renovaciones con facturación al contado.' },
    { name: 'Instalación', type: 1, icon: 'pi pi-map-marker', description: 'Consulta las instalaciones registradas.' },
    { name: 'Reinstalación', type: 18, icon: 'pi pi-sync', description: 'Consulta las reinstalaciones registradas.' },
    { name: 'Revisión', type: 10, icon: 'pi pi-search', description: 'Consulta las revisiones registradas.' },
    { name: 'Desinstalación', type: 19, icon: 'pi pi-minus-circle', description: 'Consulta las desinstalaciones registradas.' },
    { name: 'Renovación pendiente', type: 22, icon: 'pi pi-clock', description: 'Consulta los dispositivos de un cliente por fecha de vencimiento.' },
  ];
  selectedTemplate: ProcessTemplate | null = null;
  clientDraft: ProcessTemplateClient | string | null = null;
  dateFrom: Date | null = null;
  dateTo: Date | null = null;
  clientOptions: ProcessTemplateClient[] = [];
  loadingClients = false;
  clientSelectionPending = false;
  clientSearchError = '';
  validationError = '';

  private clientSearch?: Subscription;
  private searchVersion = 0;
  private lastClientQuery = '';
  private expirationDates = false;
  private registrationDateFrom: Date | null = null;
  private registrationDateTo: Date | null = null;

  constructor(private readonly processesService: ProcessesService) {}

  get isPendingRenewal(): boolean {
    return this.selectedTemplate?.type === 22;
  }

  get hasSelectedClient(): boolean {
    return typeof this.clientDraft === 'object' && this.clientDraft !== null
      && typeof this.clientDraft.id === 'string' && Boolean(this.clientDraft.id.trim());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['visible']) return;
    if (this.visible) this.resetDraft();
    else this.cancelClientSearch();
  }

  ngOnDestroy(): void {
    this.cancelClientSearch();
  }

  chooseTemplate(template: ProcessTemplate): void {
    if (template.type === 22) {
      if (!this.expirationDates) {
        this.registrationDateFrom = this.cloneDate(this.dateFrom);
        this.registrationDateTo = this.cloneDate(this.dateTo);
      }
      this.dateFrom = null;
      this.dateTo = null;
      this.expirationDates = true;
    } else if (this.expirationDates) {
      this.dateFrom = this.cloneDate(this.registrationDateFrom);
      this.dateTo = this.cloneDate(this.registrationDateTo);
      this.expirationDates = false;
    }
    this.selectedTemplate = template;
    this.validationError = '';
  }

  back(): void {
    this.cancelClientSearch();
    this.selectedTemplate = null;
    this.validationError = '';
    this.clientSearchError = '';
  }

  close(): void {
    this.cancelClientSearch();
    this.visible = false;
    this.visibleChange.emit(false);
  }

  onVisibleChange(visible: boolean): void {
    if (!visible) this.close();
  }

  clearClient(): void {
    this.clientDraft = null;
    this.clientSelectionPending = false;
    this.validationError = '';
  }

  onClientInput(event: Event): void {
    this.clientSelectionPending = Boolean((event.target as HTMLInputElement)?.value?.trim());
    this.validationError = '';
  }

  onClientSelected(): void {
    this.clientSelectionPending = false;
    this.validationError = '';
  }

  searchClients(event: { query?: string }): void {
    this.cancelClientSearch();
    if (!this.visible || !this.selectedTemplate) return;
    const version = this.searchVersion;
    this.lastClientQuery = String(event?.query || '').trim();
    this.loadingClients = true;
    this.clientSearchError = '';
    this.clientOptions = [];
    this.clientSearch = this.processesService.searchClients(this.lastClientQuery, 50).subscribe({
      next: clients => {
        if (version !== this.searchVersion || !this.visible) return;
        this.clientOptions = (clients || []).map(client => this.clientOption(client)).filter(client => Boolean(client.id));
        this.loadingClients = false;
      },
      error: () => {
        if (version !== this.searchVersion || !this.visible) return;
        this.clientOptions = [];
        this.loadingClients = false;
        this.clientSearchError = 'No se pudieron cargar los clientes. Intenta nuevamente.';
      },
    });
  }

  retryClientSearch(): void {
    this.searchClients({ query: this.lastClientQuery });
  }

  generate(): void {
    this.validationError = '';
    if (!this.visible || !this.selectedTemplate) return;
    if (this.isPendingRenewal && (this.clientSelectionPending || !this.hasSelectedClient)) {
      this.validationError = 'Selecciona un cliente de la lista para consultar sus renovaciones pendientes.';
      return;
    }
    if (!this.isPendingRenewal && (!this.validDate(this.dateFrom) || !this.validDate(this.dateTo))) {
      this.validationError = 'Selecciona las fechas Desde y Hasta.';
      return;
    }
    if ((this.dateFrom !== null && !this.validDate(this.dateFrom)) || (this.dateTo !== null && !this.validDate(this.dateTo))) {
      this.validationError = 'Introduce una fecha de vencimiento válida o deja el campo vacío.';
      return;
    }
    const dateFrom = this.dateFrom === null ? null : this.startOfDay(this.dateFrom);
    const dateTo = this.dateTo === null ? null : this.endOfDay(this.dateTo);
    if (dateFrom && dateTo && dateFrom > dateTo) {
      this.validationError = this.isPendingRenewal
        ? 'La fecha Vencimiento desde debe ser anterior o igual a Vencimiento hasta.'
        : 'La fecha Desde debe ser anterior o igual a Hasta.';
      return;
    }
    if (this.clientSelectionPending || (typeof this.clientDraft === 'string' && this.clientDraft.trim())) {
      this.validationError = 'Selecciona un cliente de la lista o limpia el campo para incluir todos los clientes.';
      return;
    }
    const client = typeof this.clientDraft === 'object' && this.clientDraft && this.hasSelectedClient
      ? { ...this.clientDraft, id: this.clientDraft.id.trim(), label: formatUserName(this.clientDraft.label) }
      : null;
    this.generated.emit({ types: [this.selectedTemplate.type], client, dateFrom, dateTo });
    this.close();
  }

  private resetDraft(): void {
    this.cancelClientSearch();
    this.selectedTemplate = null;
    this.expirationDates = false;
    this.registrationDateFrom = null;
    this.registrationDateTo = null;
    this.clientDraft = this.initialClient ? { ...this.initialClient, label: formatUserName(this.initialClient.label) } : null;
    this.clientOptions = [];
    this.clientSelectionPending = false;
    this.clientSearchError = '';
    this.validationError = '';
    this.lastClientQuery = '';
    if (this.validDate(this.initialDateFrom) && this.validDate(this.initialDateTo)
      && this.startOfDay(this.initialDateFrom) <= this.endOfDay(this.initialDateTo)) {
      this.dateFrom = this.startOfDay(this.initialDateFrom);
      this.dateTo = this.endOfDay(this.initialDateTo);
    } else {
      const now = new Date();
      this.dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
      this.dateTo = this.endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    }
  }

  private cancelClientSearch(): void {
    this.searchVersion++;
    this.clientSearch?.unsubscribe();
    this.clientSearch = undefined;
    this.loadingClients = false;
  }

  private clientOption(client: ProcessClientOption): ProcessTemplateClient {
    return {
      id: String(client._id || client.id || client.email || client.phone || '').trim(),
      label: formatUserName(`${client.name || ''} ${client.last_name || ''}`) || client.email || client.phone || 'Cliente sin nombre',
      email: client.email,
      phone: client.phone,
    };
  }

  private validDate(value: unknown): value is Date {
    return value instanceof Date && Number.isFinite(value.getTime());
  }

  private cloneDate(value: Date | null): Date | null {
    return value === null ? null : new Date(value);
  }

  private startOfDay(value: Date): Date {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private endOfDay(value: Date): Date {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
  }
}
