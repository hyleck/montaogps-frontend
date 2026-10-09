import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { Subscription } from 'rxjs';
import { CreatedRenewalLink, ExecuteRenewalLink, RenewalExpirationFilter, RenewalLinkAction, RenewalLinkExecutionResult, RenewalLinkPreview, RenewalLinkPreviewItem, RenewalLinkSummary, RenewalLinksService } from 'src/app/core/services/renewal-links.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { formatUserName } from 'src/app/core/utils/user-name.util';
import { getApiErrorMessage } from 'src/app/core/utils/api-error.util';
import { PROCESS_TYPE_LABELS } from '../../services/processes.service';
import { parseProcessDisplayDate } from 'src/app/core/utils/process-date.util';
import { renewalExpirationFilterLabel, renewalFilterDate } from 'src/app/core/utils/renewal-expiration-filter.util';

@Component({
  selector: 'app-process-renewal-links-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule],
  templateUrl: './process-renewal-links-dialog.component.html',
  styleUrls: ['./process-renewal-links-dialog.component.css'],
})
export class ProcessRenewalLinksDialogComponent implements OnChanges, OnDestroy {
  @Input() visible = false;
  @Input() client: { id: string; label: string; email?: string; phone?: string } | null = null;
  @Input() mode: 'generate' | 'responses' = 'generate';
  @Input() dateFrom: Date | null = null;
  @Input() dateTo: Date | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() processed = new EventEmitter<void>();

  created: CreatedRenewalLink | null = null;
  linkUrl = '';
  links: RenewalLinkSummary[] = [];
  selectedId = '';
  responseVisible = false;
  creating = false;
  loading = false;
  revokingId = '';
  confirmRevokeId = '';
  editingRangeId = '';
  rangeFrom = '';
  rangeTo = '';
  savingRangeId = '';
  rangeError = '';
  rangeMessage = '';
  error = '';
  historyError = '';
  copyMessage = '';
  readonly yearOptions = Array.from({ length: 10 }, (_, index) => index + 1);
  action: RenewalLinkAction | null = null;
  renewalYears = 1;
  registrationDate = '';
  useCommonExpiration = false;
  expirationDate = '';
  notes = '';
  executing = false;
  executionError = '';
  confirmationVisible = false;
  previewLoading = false;
  previewError = '';
  executionPreview: RenewalLinkPreview | null = null;
  private previewSubscription?: Subscription;
  private previewGeneration = 0;
  private previewKey = '';
  private previewItems = new Map<string, RenewalLinkPreviewItem>();
  private attemptedRequest: ExecuteRenewalLink | null = null;
  private attemptedLinkId = '';
  private preserveAttemptOnRefresh = false;
  private requests = new Subscription();
  private generation = 0;

  constructor(private readonly service: RenewalLinksService, private readonly auth: AuthService) {}

  get clientName(): string {
    return formatUserName(this.client?.label) || 'Cliente';
  }

  expirationFilterLabel(filter?: RenewalExpirationFilter): string {
    return renewalExpirationFilterLabel(filter);
  }

  get selectedExpirationRangeLabel(): string {
    const dateFrom = renewalFilterDate(this.dateFrom);
    const dateTo = renewalFilterDate(this.dateTo);
    return renewalExpirationFilterLabel({ mode: dateFrom || dateTo ? 'range' : 'expired', dateFrom, dateTo });
  }

  get selectedLink(): RenewalLinkSummary | undefined {
    return this.links.find(link => link.id === this.selectedId && link.client.id === this.client?.id && link.status === 'submitted');
  }

  get responseClientName(): string {
    return formatUserName(this.selectedLink?.client.name) || this.clientName;
  }

  get responseClientContact(): { email?: string; phone?: string } | null {
    return this.selectedLink?.client.id === this.client?.id ? this.client : null;
  }

  get canProcess(): boolean {
    const root: unknown = this.auth.getCurrentUser()?.root;
    if (root === true || root === 'true') return true;
    return this.auth.hasPrivilege('processes', 'read') && this.auth.hasPrivilege('processes', 'create')
      && this.auth.hasPrivilege('devices', 'update');
  }

  get remainingCount(): number {
    return (this.selectedLink?.decisions || []).filter(decision => decision.renew
      && this.resultFor(decision.deviceId)?.status !== 'succeeded').length;
  }

  get actionLocked(): boolean {
    return !!this.selectedLink?.execution || (this.attemptedLinkId === this.selectedId && !!this.attemptedRequest);
  }

  get permittedNewAction(): RenewalLinkAction | null {
    if (this.loading || this.historyError || this.selectedLink?.renewalMethodError) return null;
    const method = this.selectedLink?.renewalMethod;
    return method === 'cash' ? 'pre_renewal' : method === 'credit' ? 'renewal' : null;
  }

  renewalActionLabel(action: RenewalLinkAction | null): string {
    return action ? PROCESS_TYPE_LABELS[action === 'pre_renewal' ? 20 : 4] : '';
  }

  get renewalMethodMessage(): string {
    if (this.loading) return 'Consultando el método de renovación en Incosis…';
    if (this.historyError) return 'No se pudo actualizar el método de renovación. Actualiza la respuesta antes de iniciar una operación.';
    if (this.selectedLink?.renewalMethodError) return this.selectedLink.renewalMethodError;
    if (this.selectedLink?.renewalMethod === 'cash') return `Método de renovación en Incosis: ${this.renewalActionLabel('pre_renewal')}.`;
    if (this.selectedLink?.renewalMethod === 'credit') return `Método de renovación en Incosis: ${this.renewalActionLabel('renewal')}.`;
    return 'El método de renovación no está disponible. Revisa la configuración en Incosis y actualiza la respuesta.';
  }

  get busy(): boolean { return this.creating || this.loading || !!this.revokingId || !!this.savingRangeId || this.executing; }

  /** Links can be edited or annulled until staff start processing the response. */
  canModify(link: RenewalLinkSummary): boolean {
    return link.status !== 'revoked' && !link.execution && link.client.id === this.client?.id;
  }

  get executionValidation(): string { return this.action ? this.validateExecution() : ''; }

  get canReviewExecution(): boolean {
    return this.visible && this.responseVisible && this.canProcess && !this.busy && !!this.action
      && this.selectedLink?.status === 'submitted' && this.remainingCount > 0
      && (this.actionLocked || this.action === this.permittedNewAction)
      && !this.validateExecution();
  }

  get hasCurrentPreview(): boolean {
    return !!this.executionPreview && this.previewKey === this.executionPreviewKey();
  }

  get canConfirmExecution(): boolean {
    return this.canReviewExecution && !this.previewLoading && this.hasCurrentPreview
      && !!this.executionPreview?.items.some(item => item.canExecute);
  }

  previewFor(deviceId: string): RenewalLinkPreviewItem | undefined {
    return this.hasCurrentPreview ? this.previewItems.get(deviceId) : undefined;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.visible) { this.cancelRequests(); this.responseVisible = false; return; }
    if (changes['visible'] || changes['client'] || changes['dateFrom'] || changes['dateTo']) {
      this.cancelRequests();
      this.created = null;
      this.linkUrl = '';
      this.links = [];
      this.selectedId = '';
      this.responseVisible = false;
      this.resetExecution();
      this.error = this.historyError = this.copyMessage = '';
      if (this.mode === 'generate') this.generate();
      else this.refresh();
    }
  }

  ngOnDestroy(): void { this.cancelRequests(); }

  close(): void {
    if (this.executing) return;
    this.cancelRequests();
    this.responseVisible = false;
    this.visible = false;
    this.visibleChange.emit(false);
  }

  onVisibleChange(visible: boolean): void { if (!visible) this.close(); }

  backToResponses(): void {
    if (this.executing) return;
    this.clearPreview();
    this.responseVisible = false;
  }

  generate(): void {
    if (this.busy || !this.visible || this.responseVisible) return;
    if (!this.client?.id?.trim()) { this.error = 'Selecciona un cliente para generar su enlace.'; return; }
    const dateFrom = renewalFilterDate(this.dateFrom);
    const dateTo = renewalFilterDate(this.dateTo);
    if ((this.dateFrom && !dateFrom) || (this.dateTo && !dateTo) || (dateFrom && dateTo && dateFrom > dateTo)) {
      this.error = 'Selecciona un rango de vencimientos válido antes de generar el enlace.';
      return;
    }
    const generation = this.generation;
    this.creating = true;
    this.error = this.copyMessage = '';
    this.requests.add(this.service.create(this.client.id, { dateFrom, dateTo }).subscribe({
      next: created => {
        if (generation !== this.generation) return;
        this.creating = false;
        this.created = created;
        this.linkUrl = `${window.location.origin}/renovar/${encodeURIComponent(created.token)}`;
        this.refresh();
      },
      error: error => {
        if (generation !== this.generation) return;
        this.creating = false;
        this.error = getApiErrorMessage(error, 'No se pudo generar el enlace. Intenta nuevamente.');
        this.refresh();
      },
    }));
  }

  refresh(): void {
    if (this.loading || this.revokingId || this.executing || !this.visible || !this.client?.id) return;
    this.clearPreview();
    const generation = this.generation;
    this.loading = true;
    this.historyError = '';
    this.requests.add(this.service.getForClient(this.client.id).subscribe({
      next: links => {
        if (generation !== this.generation) return;
        this.links = links;
        this.loading = false;
        if (!this.selectedLink) {
          if (this.responseVisible) this.historyError = 'Esta respuesta ya no está disponible. Selecciona otra respuesta del cliente.';
          this.selectedId = '';
          this.responseVisible = false;
        }
        this.restoreExecution();
      },
      error: error => {
        if (generation !== this.generation) return;
        this.loading = false;
        this.historyError = getApiErrorMessage(error, 'No se pudieron cargar los enlaces del cliente.');
      },
    }));
  }

  askRevoke(link: RenewalLinkSummary): void {
    if (this.busy || !this.canModify(link)) return;
    this.cancelRangeEdit();
    this.confirmRevokeId = link.id;
  }

  revoke(link: RenewalLinkSummary): void {
    if (this.busy || !this.canModify(link) || !this.visible) return;
    const generation = this.generation;
    this.revokingId = link.id;
    this.confirmRevokeId = '';
    this.error = this.rangeMessage = '';
    this.requests.add(this.service.revoke(link.id).subscribe({
      next: updated => {
        if (generation !== this.generation) return;
        this.revokingId = '';
        this.links = this.links.map(item => item.id === updated.id ? updated : item);
        if (this.created?.id === updated.id) { this.created = null; this.linkUrl = ''; this.copyMessage = ''; }
      },
      error: error => {
        if (generation !== this.generation) return;
        this.revokingId = '';
        this.error = getApiErrorMessage(error, 'No se pudo anular el enlace.');
      },
    }));
  }

  startRangeEdit(link: RenewalLinkSummary): void {
    if (this.busy || !this.canModify(link)) return;
    this.confirmRevokeId = '';
    this.editingRangeId = link.id;
    this.rangeFrom = link.expirationFilter?.mode === 'range' ? link.expirationFilter.dateFrom || '' : '';
    this.rangeTo = link.expirationFilter?.mode === 'range' ? link.expirationFilter.dateTo || '' : '';
    this.rangeError = this.rangeMessage = '';
  }

  cancelRangeEdit(): void {
    if (this.savingRangeId) return;
    this.editingRangeId = this.rangeFrom = this.rangeTo = this.rangeError = '';
  }

  saveRange(link: RenewalLinkSummary): void {
    if (this.busy || !this.visible || this.editingRangeId !== link.id || !this.canModify(link)) return;
    const valid = (value: string) => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !!parseProcessDisplayDate(value));
    if (!valid(this.rangeFrom) || !valid(this.rangeTo) || (this.rangeFrom && this.rangeTo && this.rangeFrom > this.rangeTo)) {
      this.rangeError = 'Selecciona un rango de vencimientos válido.';
      return;
    }
    const generation = this.generation;
    this.savingRangeId = link.id;
    this.rangeError = this.rangeMessage = this.error = '';
    this.requests.add(this.service.updateRange(link.id, { dateFrom: this.rangeFrom || undefined, dateTo: this.rangeTo || undefined }).subscribe({
      next: updated => {
        if (generation !== this.generation) return;
        this.savingRangeId = '';
        this.links = this.links.map(item => item.id === updated.id ? updated : item);
        this.editingRangeId = this.rangeFrom = this.rangeTo = '';
        this.rangeMessage = `Rango actualizado. El enlace volvió a quedar pendiente con ${updated.deviceCount} dispositivos; el cliente puede revisarlo con el mismo enlace.`;
      },
      error: error => {
        if (generation !== this.generation) return;
        this.savingRangeId = '';
        this.rangeError = getApiErrorMessage(error, 'No se pudo cambiar el rango del enlace.');
      },
    }));
  }

  selectResponse(link: RenewalLinkSummary): void {
    if (!this.visible || this.busy || link.status !== 'submitted' || link.client.id !== this.client?.id
      || !this.links.some(item => item.id === link.id && item.client.id === this.client?.id)) return;
    const sameResponse = this.selectedId === link.id;
    this.selectedId = link.id;
    this.responseVisible = true;
    if (!sameResponse) this.restoreExecution();
    else if (this.action) this.loadExecutionPreview();
  }

  beginExecution(action: RenewalLinkAction): void {
    if (!this.visible || !this.responseVisible || !this.canProcess || this.busy || this.actionLocked || action !== this.permittedNewAction
      || this.selectedLink?.status !== 'submitted' || !this.remainingCount) return;
    this.resetExecution();
    this.action = action;
    this.registrationDate = this.localToday();
    this.loadExecutionPreview();
  }

  previewExecution(): void {
    if (this.busy || !this.canProcess || !this.action) return;
    this.executionError = this.validateExecution();
    if (this.canReviewExecution && !this.previewLoading) this.loadExecutionPreview(true);
  }

  onExecutionOptionsChange(): void {
    if (this.executing || this.actionLocked) return;
    this.loadExecutionPreview();
  }

  refreshExecutionPreview(): void {
    if (!this.busy && !this.previewLoading) this.loadExecutionPreview();
  }

  private executionPreviewKey(): string {
    return JSON.stringify([this.client?.id, this.selectedId, this.action ? this.executionRequest() : null]);
  }

  private clearPreview(): void {
    this.previewGeneration++;
    this.previewSubscription?.unsubscribe();
    this.previewSubscription = undefined;
    this.previewLoading = false;
    this.previewError = '';
    this.executionPreview = null;
    this.previewItems.clear();
    this.previewKey = '';
    this.confirmationVisible = false;
  }

  private loadExecutionPreview(confirm = false): void {
    this.clearPreview();
    if (!this.visible || !this.responseVisible || !this.canProcess || !this.action || this.validateExecution()
      || !this.selectedLink || this.loading || this.historyError) return;
    const generation = this.previewGeneration;
    const key = this.executionPreviewKey();
    this.previewLoading = true;
    this.previewSubscription = this.service.preview(this.selectedId, this.executionRequest()).subscribe({
      next: preview => {
        if (generation !== this.previewGeneration || key !== this.executionPreviewKey()) return;
        this.previewLoading = false;
        const ids = new Set(preview.items.map(item => item.deviceId));
        if (this.selectedLink?.decisions?.some(decision => !ids.has(decision.deviceId))) {
          this.previewError = 'La vista previa está incompleta. Actualiza las fechas antes de confirmar.';
          return;
        }
        this.executionPreview = preview;
        this.previewItems = new Map(preview.items.map(item => [item.deviceId, item]));
        this.previewKey = key;
        if (confirm && this.canConfirmExecution) this.confirmationVisible = true;
      },
      error: error => {
        if (generation !== this.previewGeneration || key !== this.executionPreviewKey()) return;
        this.previewLoading = false;
        this.previewError = getApiErrorMessage(error, 'No se pudieron consultar los vencimientos actuales. Intenta actualizar la vista previa.');
      },
    });
  }

  cancelExecution(): void {
    if (this.executing) return;
    this.confirmationVisible = false;
    if (!this.actionLocked) this.resetExecution();
  }

  confirmExecution(): void {
    if (!this.confirmationVisible || !this.canConfirmExecution) return;
    const link = this.selectedLink!;
    const generation = this.generation;
    const request = this.attemptedLinkId === link.id && this.attemptedRequest
      ? { ...this.attemptedRequest } : this.executionRequest();
    this.attemptedRequest = request;
    this.attemptedLinkId = link.id;
    this.preserveAttemptOnRefresh = true;
    this.executing = true;
    this.executionError = '';
    this.requests.add(this.service.execute(link.id, request).subscribe({
      next: updated => {
        if (generation !== this.generation) return;
        this.executing = false;
        this.links = this.links.map(item => item.id === updated.id ? updated : item);
        this.restoreExecution();
        this.processed.emit();
      },
      error: error => {
        if (generation !== this.generation) return;
        this.executing = false;
        this.confirmationVisible = false;
        this.clearPreview();
        this.preserveAttemptOnRefresh = !error?.status || error.status >= 500;
        this.executionError = getApiErrorMessage(error, 'No pudimos comprobar el resultado. Actualiza la respuesta o reintenta con los mismos datos. Los GPS completados no se volverán a procesar.');
      },
    }));
  }

  resultFor(deviceId: string): RenewalLinkExecutionResult | undefined {
    return this.selectedLink?.execution?.results.find(result => result.deviceId === deviceId);
  }

  resultLabel(result?: RenewalLinkExecutionResult): string {
    if (!result) return 'Por procesar';
    if (result.status === 'succeeded') return this.selectedLink?.execution?.action === 'pre_renewal' ? 'Renovación al contado registrada' : 'Renovado a crédito';
    return result.status === 'failed' ? 'No completado' : 'Pendiente';
  }

  executionActorName(): string { return formatUserName(this.selectedLink?.execution?.actor.name) || 'Usuario'; }

  private restoreExecution(): void {
    const execution = this.selectedLink?.execution;
    if (!execution && this.preserveAttemptOnRefresh && this.attemptedRequest && this.attemptedLinkId === this.selectedId) {
      this.loadExecutionPreview();
      return;
    }
    this.resetExecution();
    if (!execution) return;
    this.action = execution.action;
    this.renewalYears = execution.years;
    this.registrationDate = execution.registrationDate;
    this.useCommonExpiration = !!execution.expirationDate;
    this.expirationDate = execution.expirationDate || '';
    this.notes = execution.notes || '';
    this.attemptedRequest = this.executionRequest();
    this.attemptedLinkId = this.selectedId;
    this.loadExecutionPreview();
  }

  private resetExecution(): void {
    this.clearPreview();
    this.action = null;
    this.renewalYears = 1;
    this.registrationDate = '';
    this.useCommonExpiration = false;
    this.expirationDate = '';
    this.notes = '';
    this.executionError = '';
    this.confirmationVisible = false;
    this.attemptedRequest = null;
    this.attemptedLinkId = '';
    this.preserveAttemptOnRefresh = false;
  }

  private executionRequest(): ExecuteRenewalLink {
    return {
      action: this.action!, years: this.renewalYears, registrationDate: this.registrationDate,
      ...(this.useCommonExpiration ? { expirationDate: this.expirationDate } : {}),
      ...(this.notes.trim() ? { notes: this.notes.trim() } : {}),
    };
  }

  private validateExecution(): string {
    if (!Number.isInteger(this.renewalYears) || this.renewalYears < 1 || this.renewalYears > 10) return 'Selecciona una duración entre 1 y 10 años.';
    if (!this.validDate(this.registrationDate)) return 'Selecciona una fecha de registro válida.';
    if (this.useCommonExpiration && !this.validDate(this.expirationDate)) return 'Selecciona un nuevo vencimiento válido para todos.';
    if (this.notes.trim().length > 1000) return 'La observación no puede superar 1000 caracteres.';
    return '';
  }

  private validDate(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !!parseProcessDisplayDate(value);
  }

  private localToday(): string {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  async copyLink(): Promise<void> {
    if (!this.linkUrl) return;
    const generation = this.generation;
    const linkUrl = this.linkUrl;
    try {
      await navigator.clipboard.writeText(linkUrl);
      if (generation === this.generation && linkUrl === this.linkUrl) this.copyMessage = 'Enlace copiado.';
    } catch {
      if (generation === this.generation && linkUrl === this.linkUrl) this.copyMessage = 'Selecciona el enlace y cópialo desde el campo.';
    }
  }

  async shareLink(): Promise<void> {
    if (!this.linkUrl) return;
    if (!navigator.share) { await this.copyLink(); return; }
    const generation = this.generation;
    try {
      await navigator.share({ title: 'Renovación Montao GPS', text: 'Selecciona los dispositivos que deseas renovar.', url: this.linkUrl });
    } catch (error) {
      if (generation === this.generation && (error as Error)?.name !== 'AbortError') await this.copyLink();
    }
  }

  statusLabel(status: RenewalLinkSummary['status']): string {
    return { active: 'Pendiente', submitted: 'Respuesta recibida', expired: 'Vencido', revoked: 'Anulado' }[status];
  }

  renewalCount(link: RenewalLinkSummary): number { return (link.decisions || []).filter(decision => decision.renew).length; }
  declineCount(link: RenewalLinkSummary): number { return (link.decisions || []).filter(decision => !decision.renew).length; }
  displayDate(value?: string): Date | null { return parseProcessDisplayDate(value); }

  displayPreviewDate(value?: string | null): Date | null {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}(?:T00:00:00(?:\.0{1,3})?Z)?$/.test(value)) return parseProcessDisplayDate(value);
    const date = new Date(value);
    if (!Number.isFinite(+date)) return null;
    // Match the renewal service's Dominican calendar day in every browser.
    return parseProcessDisplayDate(new Date(+date - 4 * 60 * 60_000).toISOString().slice(0, 10));
  }

  private cancelRequests(): void {
    this.clearPreview();
    this.generation++;
    this.requests.unsubscribe();
    this.requests = new Subscription();
    this.creating = this.loading = false;
    this.executing = false;
    this.revokingId = this.savingRangeId = this.confirmRevokeId = '';
    this.editingRangeId = this.rangeError = this.rangeMessage = '';
  }
}
