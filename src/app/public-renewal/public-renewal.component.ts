import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { distinctUntilChanged, map, Subscription } from 'rxjs';
import { PublicRenewalDevice, PublicRenewalInfo, RenewalDecision, RenewalLinksService } from '../core/services/renewal-links.service';
import { parseProcessDisplayDate } from '../core/utils/process-date.util';
import { renewalExpirationFilterLabel } from '../core/utils/renewal-expiration-filter.util';
import { UserNamePipe } from '../shareds/pipes/user-name.pipe';
import { groupByRenewalAccount, RenewalAccountGroup } from '../core/utils/renewal-account-groups.util';

interface RenewalDeviceView extends PublicRenewalDevice {
  expiration: Date | null;
}

@Component({
  selector: 'app-public-renewal',
  standalone: true,
  imports: [CommonModule, FormsModule, UserNamePipe],
  templateUrl: './public-renewal.component.html',
  styleUrls: ['./public-renewal.component.css'],
})
export class PublicRenewalComponent implements OnInit, OnDestroy {
  info: PublicRenewalInfo | null = null;
  devices: RenewalDeviceView[] = [];
  query = '';
  loading = true;
  submitting = false;
  requiresRefresh = false;
  loadError = '';
  loadErrorTitle = '';
  submitError = '';
  refreshNotice = '';
  submittedOn: Date | null = null;
  /** Choices recovered from the link when it was reopened. */
  restoredCount = 0;
  linkExpiresOn: Date | null = null;

  private token = '';
  private decisions = new Map<string, boolean>();
  /** Saving the marked choices on the link: '' (nothing to save), saving, saved or failed. */
  draftState: '' | 'saving' | 'saved' | 'failed' = '';
  private draftTimer: ReturnType<typeof setTimeout> | null = null;
  private draftDirty = false;
  private draftSubscription?: Subscription;
  private static readonly DRAFT_DELAY_MS = 700;
  private routeSubscription?: Subscription;
  private loadSubscription?: Subscription;
  private submitSubscription?: Subscription;
  private requestVersion = 0;
  private previousReferrer: string | null = null;
  private previousRobots: string | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly renewalLinks: RenewalLinksService,
    private readonly meta: Meta,
  ) {}

  ngOnInit(): void {
    this.previousReferrer = this.meta.getTag('name="referrer"')?.content ?? null;
    this.previousRobots = this.meta.getTag('name="robots"')?.content ?? null;
    this.meta.updateTag({ name: 'referrer', content: 'no-referrer' });
    this.meta.updateTag({ name: 'robots', content: 'noindex,nofollow' });
    this.routeSubscription = this.route.paramMap.pipe(
      map(params => params.get('token') || ''),
      distinctUntilChanged(),
    ).subscribe(token => {
      this.token = token;
      this.requiresRefresh = false;
      this.reload();
    });
  }

  ngOnDestroy(): void {
    this.flushDraftOnExit();
    this.requestVersion++;
    this.draftSubscription?.unsubscribe();
    this.routeSubscription?.unsubscribe();
    this.loadSubscription?.unsubscribe();
    this.submitSubscription?.unsubscribe();
    if (this.meta.getTag('name="referrer"')?.content === 'no-referrer') {
      if (this.previousReferrer === null) this.meta.removeTag('name="referrer"');
      else this.meta.updateTag({ name: 'referrer', content: this.previousReferrer });
    }
    if (this.meta.getTag('name="robots"')?.content === 'noindex,nofollow') {
      if (this.previousRobots === null) this.meta.removeTag('name="robots"');
      else this.meta.updateTag({ name: 'robots', content: this.previousRobots });
    }
  }

  get submitted(): boolean {
    return this.info?.status === 'submitted';
  }

  get expirationRangeLabel(): string {
    return renewalExpirationFilterLabel(this.info?.expirationFilter);
  }

  get renewCount(): number {
    return this.devices.filter(device => this.decisions.get(device.id) === true).length;
  }

  get noRenewCount(): number {
    return this.devices.filter(device => this.decisions.get(device.id) === false).length;
  }

  get undecidedCount(): number {
    return this.devices.length - this.renewCount - this.noRenewCount;
  }

  get canSubmit(): boolean {
    return this.info?.status === 'active' && !this.loading && !this.submitting && !this.requiresRefresh
      && this.devices.length > 0 && this.undecidedCount === 0;
  }

  get filteredDevices(): RenewalDeviceView[] {
    const query = this.searchText(this.query);
    if (!query) return this.devices;
    return this.devices.filter(device => this.searchText(
      `${device.name} ${device.imei} ${device.plate || ''} ${(device.account?.path || []).join(' ')}`).includes(query));
  }

  /** The GPS grouped by the account that owns them, like the monitoring module (Cliente › Subcliente). */
  get deviceGroups(): RenewalAccountGroup<RenewalDeviceView>[] {
    return groupByRenewalAccount(this.filteredDevices);
  }

  /** Headers only when the client's GPS are spread across more than one account. */
  get showAccountHeaders(): boolean {
    return groupByRenewalAccount(this.devices).length > 1;
  }

  trackGroup(_index: number, group: RenewalAccountGroup<RenewalDeviceView>): string {
    return group.key;
  }

  decisionFor(deviceId: string): boolean | undefined {
    return this.decisions.get(deviceId);
  }

  setDecision(deviceId: string, renew: boolean): void {
    if (!this.canEdit() || !this.devices.some(device => device.id === deviceId)) return;
    this.decisions.set(deviceId, renew);
    this.submitError = '';
    this.scheduleDraftSave();
  }

  selectAll(renew: boolean): void {
    if (!this.canEdit()) return;
    for (const device of this.devices) this.decisions.set(device.id, renew);
    this.submitError = '';
    this.scheduleDraftSave();
  }

  /** The last change is sent even if the client closes the page right after marking it. */
  @HostListener('window:pagehide')
  onPageHide(): void { this.flushDraftOnExit(); }

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') this.flushDraftOnExit();
  }

  private draftChoices(): RenewalDecision[] {
    return this.devices.filter(device => this.decisions.has(device.id))
      .map(device => ({ deviceId: device.id, renew: this.decisions.get(device.id)! }));
  }

  private scheduleDraftSave(): void {
    if (this.info?.status !== 'active' || !this.token) return;
    this.draftDirty = true;
    this.draftState = 'saving';
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => this.saveDraft(), PublicRenewalComponent.DRAFT_DELAY_MS);
  }

  private saveDraft(): void {
    this.draftTimer = null;
    if (!this.draftDirty || this.info?.status !== 'active') return;
    const version = this.requestVersion;
    this.draftDirty = false;
    this.draftSubscription?.unsubscribe();
    this.draftSubscription = this.renewalLinks.saveDraftPublic(this.token, this.draftChoices()).subscribe({
      next: () => {
        if (version !== this.requestVersion) return;
        if (!this.draftDirty) this.draftState = 'saved';
      },
      error: () => {
        if (version !== this.requestVersion) return;
        // Keep the choices on screen and try again with the next change or on retry.
        this.draftDirty = true;
        this.draftState = 'failed';
      },
    });
  }

  retryDraftSave(): void {
    if (this.draftState === 'failed') { this.draftDirty = true; this.saveDraft(); }
  }

  private flushDraftOnExit(): void {
    if (!this.draftDirty || this.info?.status !== 'active' || !this.token || typeof fetch !== 'function') return;
    if (this.draftTimer) { clearTimeout(this.draftTimer); this.draftTimer = null; }
    this.draftDirty = false;
    try {
      void fetch(this.renewalLinks.publicDraftUrl(this.token), {
        method: 'PUT', keepalive: true, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisions: this.draftChoices() }),
      }).catch(() => undefined);
    } catch {
      // Nothing else can be done while the page closes.
    }
  }

  reload(): void {
    const afterConflict = this.requiresRefresh;
    this.loadSubscription?.unsubscribe();
    this.submitSubscription?.unsubscribe();
    const version = ++this.requestVersion;
    this.loading = true;
    this.submitting = false;
    this.requiresRefresh = false;
    this.loadError = '';
    this.loadErrorTitle = '';
    this.submitError = '';
    this.refreshNotice = '';
    this.query = '';
    this.info = null;
    this.devices = [];
    this.decisions.clear();
    this.restoredCount = 0;
    this.submittedOn = null;
    this.linkExpiresOn = null;
    if (!this.token) {
      this.setLoadError(404);
      return;
    }
    this.loadSubscription = this.renewalLinks.getPublic(this.token).subscribe({
      next: info => {
        if (version !== this.requestVersion) return;
        this.applyInfo(info);
        this.loading = false;
        if (afterConflict && !this.submitted) this.refreshNotice = 'Lista actualizada. Revisa los dispositivos y vuelve a elegir una opción para cada uno.';
      },
      error: error => {
        if (version !== this.requestVersion) return;
        this.setLoadError(error?.status);
      },
    });
  }

  confirmSelection(): void {
    if (!this.canSubmit) return;
    const version = this.requestVersion;
    const decisions: RenewalDecision[] = this.devices.map(device => ({ deviceId: device.id, renew: this.decisions.get(device.id)! }));
    if (this.draftTimer) { clearTimeout(this.draftTimer); this.draftTimer = null; }
    this.draftDirty = false;
    this.draftSubscription?.unsubscribe();
    this.submitting = true;
    this.submitError = '';
    this.refreshNotice = '';
    this.submitSubscription = this.renewalLinks.submitPublic(this.token, decisions).subscribe({
      next: info => {
        if (version !== this.requestVersion) return;
        this.applyInfo(info);
        this.submitting = false;
        if (!this.submitted) {
          this.requiresRefresh = true;
          this.submitError = 'No pudimos comprobar la confirmación. Actualiza el estado de la solicitud.';
        }
      },
      error: error => {
        if (version !== this.requestVersion) return;
        this.submitting = false;
        if (error?.status === 409) {
          this.requiresRefresh = true;
          this.submitError = 'La lista de dispositivos o el estado del enlace cambió. Actualiza la lista y revisa tu selección antes de confirmar.';
        } else if ([403, 404, 410].includes(error?.status)) {
          this.setLoadError(error.status);
        } else {
          this.submitError = 'No pudimos comprobar si tu selección se guardó. Puedes intentarlo de nuevo o actualizar el estado.';
        }
      },
    });
  }

  trackDevice(_index: number, device: RenewalDeviceView): string {
    return device.id;
  }

  private canEdit(): boolean {
    return this.info?.status === 'active' && !this.loading && !this.submitting && !this.requiresRefresh;
  }

  private applyInfo(info: PublicRenewalInfo): void {
    this.info = info;
    this.devices = info.devices.map(device => ({ ...device, expiration: parseProcessDisplayDate(device.expirationDate) }));
    this.submittedOn = this.timestamp(info.submittedAt);
    this.linkExpiresOn = this.timestamp(info.expiresAt);
    this.decisions.clear();
    if (info.status === 'submitted') {
      for (const device of info.devices) {
        if (typeof device.renew === 'boolean') this.decisions.set(device.id, device.renew);
      }
      this.draftState = '';
      return;
    }
    const visible = new Set(this.devices.map(device => device.id));
    for (const choice of info.draft || []) {
      if (visible.has(choice.deviceId) && typeof choice.renew === 'boolean') this.decisions.set(choice.deviceId, choice.renew);
    }
    this.restoredCount = this.decisions.size;
    this.draftState = this.decisions.size ? 'saved' : '';
  }

  private setLoadError(status?: number): void {
    this.loading = false;
    this.submitting = false;
    this.info = null;
    this.devices = [];
    this.decisions.clear();
    if ([400, 403, 404, 410].includes(status || 0)) {
      this.loadErrorTitle = 'Enlace no disponible';
      this.loadError = status === 410
        ? 'Este enlace venció o fue revocado. Solicita un nuevo enlace a Montao GPS.'
        : 'Este enlace no es válido o ya no está disponible. Solicita un nuevo enlace a Montao GPS.';
    } else {
      this.loadErrorTitle = 'No pudimos cargar tu solicitud';
      this.loadError = 'Revisa tu conexión e intenta nuevamente.';
    }
  }

  private timestamp(value?: string): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  private searchText(value: string): string {
    return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es').trim();
  }
}
