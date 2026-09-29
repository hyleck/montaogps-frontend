import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { Subscription } from 'rxjs';
import { CreatedRenewalLink, RenewalLinkSummary, RenewalLinksService } from 'src/app/core/services/renewal-links.service';
import { formatUserName } from 'src/app/core/utils/user-name.util';
import { getApiErrorMessage } from 'src/app/core/utils/api-error.util';
import { parseProcessDisplayDate } from 'src/app/core/utils/process-date.util';

@Component({
  selector: 'app-process-renewal-links-dialog',
  standalone: true,
  imports: [CommonModule, DialogModule],
  templateUrl: './process-renewal-links-dialog.component.html',
  styleUrls: ['./process-renewal-links-dialog.component.css'],
})
export class ProcessRenewalLinksDialogComponent implements OnChanges, OnDestroy {
  @Input() visible = false;
  @Input() client: { id: string; label: string } | null = null;
  @Input() mode: 'generate' | 'responses' = 'generate';
  @Output() visibleChange = new EventEmitter<boolean>();

  created: CreatedRenewalLink | null = null;
  linkUrl = '';
  links: RenewalLinkSummary[] = [];
  selectedId = '';
  creating = false;
  loading = false;
  revokingId = '';
  error = '';
  historyError = '';
  copyMessage = '';
  private requests = new Subscription();
  private generation = 0;

  constructor(private readonly service: RenewalLinksService) {}

  get clientName(): string {
    return formatUserName(this.client?.label) || 'Cliente';
  }

  get selectedLink(): RenewalLinkSummary | undefined {
    return this.links.find(link => link.id === this.selectedId);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.visible) { this.cancelRequests(); return; }
    if (changes['visible'] || changes['client']) {
      this.cancelRequests();
      this.created = null;
      this.linkUrl = '';
      this.links = [];
      this.selectedId = '';
      this.error = this.historyError = this.copyMessage = '';
      if (this.mode === 'generate') this.generate();
      else this.refresh();
    }
  }

  ngOnDestroy(): void { this.cancelRequests(); }

  close(): void {
    this.cancelRequests();
    this.visible = false;
    this.visibleChange.emit(false);
  }

  onVisibleChange(visible: boolean): void { if (!visible) this.close(); }

  generate(): void {
    if (this.creating || this.loading || this.revokingId || !this.visible) return;
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
    if (this.loading || this.revokingId || !this.visible || !this.client?.id) return;
    const generation = this.generation;
    this.loading = true;
    this.historyError = '';
    this.requests.add(this.service.getForClient(this.client.id).subscribe({
      next: links => {
        if (generation !== this.generation) return;
        this.links = links;
        this.loading = false;
        if (!this.selectedLink) this.selectedId = links.find(link => link.status === 'submitted')?.id || '';
      },
      error: error => {
        if (generation !== this.generation) return;
        this.loading = false;
        this.historyError = getApiErrorMessage(error, 'No se pudieron cargar los enlaces del cliente.');
      },
    }));
  }

  revoke(link: RenewalLinkSummary): void {
    if (this.revokingId || this.creating || this.loading || link.status !== 'active' || !this.visible) return;
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
    this.revokingId = '';
  }
}
