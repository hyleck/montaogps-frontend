import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { Subscription } from 'rxjs';
import { CreatedRenewalLink, ExecuteRenewalLink, RenewalLinkAction, RenewalLinkExecutionResult, RenewalLinkSummary, RenewalLinksService } from 'src/app/core/services/renewal-links.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { formatUserName } from 'src/app/core/utils/user-name.util';
import { getApiErrorMessage } from 'src/app/core/utils/api-error.util';
import { parseProcessDisplayDate } from 'src/app/core/utils/process-date.util';

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
  private attemptedRequest: ExecuteRenewalLink | null = null;
  private attemptedLinkId = '';
  private requests = new Subscription();
  private generation = 0;

  constructor(private readonly service: RenewalLinksService, private readonly auth: AuthService) {}

  get clientName(): string {
    return formatUserName(this.client?.label) || 'Cliente';
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

  get busy(): boolean { return this.creating || this.loading || !!this.revokingId || this.executing; }

  get executionValidation(): string { return this.action ? this.validateExecution() : ''; }

  get canConfirmExecution(): boolean {
    return this.visible && this.responseVisible && this.canProcess && !this.busy && !!this.action
      && this.selectedLink?.status === 'submitted' && this.remainingCount > 0
      && !this.validateExecution();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.visible) { this.cancelRequests(); this.responseVisible = false; return; }
    if (changes['visible'] || changes['client']) {
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
    this.responseVisible = false;
  }

  generate(): void {
    if (this.busy || !this.visible || this.responseVisible) return;
    if (!this.client?.id?.trim()) { this.error = 'Selecciona un cliente para generar su enlace.'; return; }
    const generation = this.generation;
    this.creating = true;
    this.error = this.copyMessage = '';
    this.requests.add(this.service.create(this.client.id).subscribe({
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

  revoke(link: RenewalLinkSummary): void {
    if (this.busy || link.status !== 'active' || !this.visible) return;
    const generation = this.generation;
    this.revokingId = link.id;
    this.error = '';
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
        this.error = getApiErrorMessage(error, 'No se pudo revocar el enlace.');
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
  }

  beginExecution(action: RenewalLinkAction): void {
    if (!this.visible || !this.responseVisible || !this.canProcess || this.busy || this.actionLocked
      || this.selectedLink?.status !== 'submitted' || !this.remainingCount) return;
    this.resetExecution();
    this.action = action;
    this.registrationDate = this.localToday();
  }

  previewExecution(): void {
    if (this.busy || !this.canProcess || !this.action) return;
    this.executionError = this.validateExecution();
    if (this.canConfirmExecution) this.confirmationVisible = true;
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
        this.executionError = getApiErrorMessage(error, 'No pudimos comprobar el resultado. Actualiza la respuesta o reintenta con los mismos datos. Los GPS completados no se volverán a procesar.');
      },
    }));
  }

  resultFor(deviceId: string): RenewalLinkExecutionResult | undefined {
    return this.selectedLink?.execution?.results.find(result => result.deviceId === deviceId);
  }

  resultLabel(result?: RenewalLinkExecutionResult): string {
    if (!result) return 'Por procesar';
    if (result.status === 'succeeded') return this.selectedLink?.execution?.action === 'pre_renewal' ? 'Pre-renovación registrada' : 'Renovado';
    return result.status === 'failed' ? 'No completado' : 'Pendiente';
  }

  executionActorName(): string { return formatUserName(this.selectedLink?.execution?.actor.name) || 'Usuario'; }

  private restoreExecution(): void {
    const execution = this.selectedLink?.execution;
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
  }

  private resetExecution(): void {
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
    return { active: 'Disponible', submitted: 'Respuesta recibida', expired: 'Vencido', revoked: 'Revocado' }[status];
  }

  renewalCount(link: RenewalLinkSummary): number { return (link.decisions || []).filter(decision => decision.renew).length; }
  declineCount(link: RenewalLinkSummary): number { return (link.decisions || []).filter(decision => !decision.renew).length; }
  displayDate(value?: string): Date | null { return parseProcessDisplayDate(value); }

  private cancelRequests(): void {
    this.generation++;
    this.requests.unsubscribe();
    this.requests = new Subscription();
    this.creating = this.loading = false;
    this.executing = false;
    this.revokingId = '';
  }
}
