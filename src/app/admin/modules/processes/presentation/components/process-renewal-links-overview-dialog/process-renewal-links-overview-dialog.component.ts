import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { UserNamePipe } from 'src/app/shareds/pipes/user-name.pipe';
import { Subscription } from 'rxjs';
import {
  RenewalExpirationFilter, RenewalLinkShare, RenewalLinkSummary, RenewalLinksOverviewPage, RenewalLinksOverviewStatus, RenewalLinksService,
} from 'src/app/core/services/renewal-links.service';
import { formatUserName } from 'src/app/core/utils/user-name.util';
import { getApiErrorMessage } from 'src/app/core/utils/api-error.util';
import { parseProcessDisplayDate } from 'src/app/core/utils/process-date.util';
import { renewalExpirationFilterLabel } from 'src/app/core/utils/renewal-expiration-filter.util';
import { copyText, copyWithSelection } from 'src/app/core/utils/clipboard.util';
import { groupByRenewalAccount, RenewalAccountGroup } from 'src/app/core/utils/renewal-account-groups.util';

type OverviewLink = RenewalLinksOverviewPage['items'][number];

const PAGE_SIZE = 30;

@Component({
  selector: 'app-process-renewal-links-overview-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, UserNamePipe],
  templateUrl: './process-renewal-links-overview-dialog.component.html',
  styleUrls: ['./process-renewal-links-overview-dialog.component.css'],
})
export class ProcessRenewalLinksOverviewDialogComponent implements OnChanges, OnDestroy {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  /** Opens the client's renewal dialog on this link to review, process, change its range or annul it. */
  @Output() manage = new EventEmitter<RenewalLinkSummary>();

  readonly statusOptions: Array<{ value: RenewalLinksOverviewStatus; label: string }> = [
    { value: 'all', label: 'Todos' },
    { value: 'active', label: 'Esperando respuesta' },
    { value: 'pending_processing', label: 'Por procesar' },
    { value: 'submitted', label: 'Respondidos' },
    { value: 'processed', label: 'Procesados' },
    { value: 'revoked', label: 'Anulados' },
  ];

  status: RenewalLinksOverviewStatus = 'all';
  search = '';
  links: OverviewLink[] = [];
  total = 0;
  counts: Partial<RenewalLinksOverviewPage['counts']> = {};
  loading = false;
  loadingMore = false;
  error = '';
  expandedId = '';
  sharingId = '';
  /** Link shown with its URL after copying, sharing or issuing a new one. */
  shared: { id: string; url: string; message: string } | null = null;
  shareError: { id: string; message: string } | null = null;
  regenerateOfferId = '';
  private requests = new Subscription();
  private generation = 0;

  constructor(private readonly service: RenewalLinksService) {}

  get hasMore(): boolean { return this.links.length < this.total; }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) this.reload();
    if (!this.visible) this.cancel();
  }

  ngOnDestroy(): void { this.cancel(); }

  close(): void {
    this.cancel();
    this.visible = false;
    this.visibleChange.emit(false);
  }

  onVisibleChange(visible: boolean): void { if (!visible) this.close(); }

  setStatus(status: RenewalLinksOverviewStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.reload();
  }

  applySearch(): void { this.reload(); }

  clearSearch(): void {
    if (!this.search) return;
    this.search = '';
    this.reload();
  }

  reload(): void {
    this.cancel();
    this.links = [];
    this.total = 0;
    this.expandedId = '';
    this.load(0);
  }

  loadMore(): void {
    if (!this.loading && !this.loadingMore && this.hasMore) this.load(this.links.length);
  }

  toggle(link: OverviewLink): void { this.expandedId = this.expandedId === link.id ? '' : link.id; }

  open(link: OverviewLink): void { this.manage.emit(link); }

  /** Only links the client can still open: waiting for an answer or answered. */
  canShare(link: OverviewLink): boolean {
    return link.status === 'active' || link.status === 'submitted';
  }

  copyLink(link: OverviewLink): void { this.fetchShare(link, 'copy'); }

  shareLink(link: OverviewLink): void { this.fetchShare(link, 'share'); }

  confirmRegenerate(link: OverviewLink): void {
    if (this.sharingId || this.regenerateOfferId !== link.id) return;
    const generation = this.generation;
    this.sharingId = link.id;
    this.shareError = null;
    this.requests.add(this.service.regenerateLink(link.id).subscribe({
      next: share => {
        if (generation !== this.generation) return;
        this.sharingId = this.regenerateOfferId = '';
        void this.deliver(link, share, 'copy', 'Enlace nuevo listo. El anterior ya no funciona: envíale este al cliente.');
      },
      error: error => {
        if (generation !== this.generation) return;
        this.sharingId = '';
        this.shareError = { id: link.id, message: getApiErrorMessage(error, 'No se pudo generar el enlace nuevo.') };
      },
    }));
  }

  cancelRegenerate(): void { this.regenerateOfferId = ''; }

  private fetchShare(link: OverviewLink, mode: 'copy' | 'share'): void {
    if (this.sharingId || !this.canShare(link)) return;
    const generation = this.generation;
    this.sharingId = link.id;
    this.shared = this.shareError = null;
    this.regenerateOfferId = '';
    this.requests.add(this.service.getShareLink(link.id).subscribe({
      next: share => {
        if (generation !== this.generation) return;
        this.sharingId = '';
        void this.deliver(link, share, mode);
      },
      error: error => {
        if (generation !== this.generation) return;
        this.sharingId = '';
        if (error?.error?.code === 'RENEWAL_LINK_UNAVAILABLE') { this.regenerateOfferId = link.id; return; }
        this.shareError = { id: link.id, message: getApiErrorMessage(error, 'No se pudo obtener el enlace.') };
      },
    }));
  }

  private async deliver(link: OverviewLink, share: RenewalLinkShare, mode: 'copy' | 'share', notice = ''): Promise<void> {
    const url = `${window.location.origin}/renovar/${encodeURIComponent(share.token)}`;
    const generation = this.generation;
    let message = notice;
    if (mode === 'share' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Renovación Montao GPS', text: 'Selecciona los dispositivos que deseas renovar.', url });
        message ||= 'Enlace compartido.';
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') message ||= 'Puedes copiar el enlace desde el campo.';
        else message ||= await this.copy(url);
      }
    } else {
      const copied = await this.copy(url);
      message = notice ? `${notice} ${copied}` : copied;
    }
    if (generation !== this.generation) return;
    this.shared = { id: link.id, url, message };
  }

  private async copy(url: string): Promise<string> {
    return await copyText(url) ? 'Enlace copiado.' : 'El navegador no permitió copiarlo solo: pulsa «Copiar».';
  }

  /** Copies the URL already shown, straight from the click, so the browser always allows it. */
  copyShown(): void {
    if (!this.shared) return;
    this.shared = { ...this.shared,
      message: copyWithSelection(this.shared.url) ? 'Enlace copiado.' : 'Selecciona el enlace del campo y cópialo con Cmd+C.' };
  }

  private load(offset: number): void {
    const generation = this.generation;
    if (offset) this.loadingMore = true; else this.loading = true;
    this.error = '';
    this.requests.add(this.service.listAll({ status: this.status, search: this.search, offset, limit: PAGE_SIZE }).subscribe({
      next: page => {
        if (generation !== this.generation) return;
        this.loading = this.loadingMore = false;
        const known = new Set(this.links.map(link => link.id));
        this.links = [...this.links, ...page.items.filter(link => !known.has(link.id))];
        this.total = page.total;
        this.counts = page.counts;
      },
      error: error => {
        if (generation !== this.generation) return;
        this.loading = this.loadingMore = false;
        this.error = getApiErrorMessage(error, 'No se pudieron cargar los enlaces de renovación.');
      },
    }));
  }

  private cancel(): void {
    this.generation++;
    this.requests.unsubscribe();
    this.requests = new Subscription();
    this.loading = this.loadingMore = false;
    this.sharingId = this.regenerateOfferId = '';
    this.shared = this.shareError = null;
  }

  clientName(link: OverviewLink): string { return formatUserName(link.client?.name) || 'Cliente'; }
  creatorName(link: OverviewLink): string { return formatUserName(link.createdBy?.name) || ''; }
  rangeLabel(filter?: RenewalExpirationFilter): string { return renewalExpirationFilterLabel(filter); }
  renewCount(link: OverviewLink): number { return (link.decisions || []).filter(decision => decision.renew).length; }
  declineCount(link: OverviewLink): number { return (link.decisions || []).filter(decision => !decision.renew).length; }
  displayDate(value?: string): Date | null { return parseProcessDisplayDate(value); }

  statusLabel(link: OverviewLink): string {
    if (link.status === 'active') return 'Esperando respuesta';
    if (link.status === 'revoked') return 'Anulado';
    if (link.execution) {
      return link.execution.status === 'completed' ? 'Procesado'
        : link.execution.status === 'partial' ? 'Procesado con pendientes' : 'En proceso';
    }
    return this.renewCount(link) ? 'Por procesar' : 'Respondido sin renovaciones';
  }

  statusTone(link: OverviewLink): 'waiting' | 'action' | 'done' | 'muted' {
    if (link.status === 'active') return 'waiting';
    if (link.status === 'submitted' && !link.execution && this.renewCount(link)) return 'action';
    if (link.status === 'submitted' && (link.execution?.status === 'completed' || !this.renewCount(link))) return 'done';
    if (link.status === 'submitted') return 'action';
    return 'muted';
  }

  resultLabel(link: OverviewLink, deviceId: string): string {
    const result = link.execution?.results.find(item => item.deviceId === deviceId);
    if (!result) return '';
    if (result.status === 'succeeded') return link.execution?.action === 'pre_renewal' ? 'Renovación al contado registrada' : 'Renovado';
    return result.status === 'failed' ? 'No completado' : 'Pendiente';
  }

  decisionGroups(link: OverviewLink): RenewalAccountGroup<NonNullable<OverviewLink['decisions']>[number]>[] {
    return groupByRenewalAccount(link.decisions || []);
  }

  trackLink(_index: number, link: OverviewLink): string { return link.id; }
}
