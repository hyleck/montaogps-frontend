import { Injectable, NgZone, OnDestroy } from '@angular/core';

/**
 * Keeps PrimeNG's global modal state in sync with the dialogs that are
 * actually rendered. A stale mask captures every click even though its dialog
 * has already disappeared.
 */
@Injectable({ providedIn: 'root' })
export class DialogOverlayCleanupService implements OnDestroy {
  private observer?: MutationObserver;
  private cleanupTimer?: ReturnType<typeof setTimeout>;

  constructor(private readonly zone: NgZone) {}

  start(): void {
    if (
      this.observer
      || typeof document === 'undefined'
      || typeof MutationObserver === 'undefined'
      || !document.body
    ) {
      return;
    }

    this.zone.runOutsideAngular(() => {
      this.observer = new MutationObserver((mutations) => {
        if (!mutations.some(mutation => this.containsDialogMaskMutation(mutation))) {
          return;
        }

        this.scheduleCleanup();
      });

      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.observer = undefined;

    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /** Exposed for deterministic cleanup after route/component teardown. */
  cleanupNow(): void {
    if (typeof document === 'undefined') return;

    document.querySelectorAll<HTMLElement>('.p-dialog-mask').forEach(mask => {
      if (!mask.querySelector('.p-dialog')) {
        mask.remove();
      }
    });

    if (document.querySelector('.p-dialog-mask .p-dialog')) {
      return;
    }

    document.body.classList.remove('p-overflow-hidden');
    Array.from(document.body.style).forEach(propertyName => {
      if (propertyName.endsWith('-scrollbar-width')) {
        document.body.style.removeProperty(propertyName);
      }
    });
  }

  private scheduleCleanup(): void {
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
    }

    // Wait beyond PrimeNG's 150 ms leave animation. Active dialogs still have
    // a .p-dialog child and are therefore never removed by this fallback.
    this.cleanupTimer = setTimeout(() => {
      this.cleanupTimer = undefined;
      this.cleanupNow();
    }, 250);
  }

  private containsDialogMaskMutation(mutation: MutationRecord): boolean {
    return this.isOrContainsDialogMask(mutation.target)
      || [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)]
      .some(node => this.isOrContainsDialogMask(node));
  }

  private isOrContainsDialogMask(node: Node): boolean {
    if (!(node instanceof HTMLElement)) return false;

    return node.classList.contains('p-dialog-mask')
      || Boolean(node.querySelector('.p-dialog-mask'));
  }
}
