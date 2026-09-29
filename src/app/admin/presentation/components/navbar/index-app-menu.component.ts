import { Component, ElementRef, EventEmitter, HostListener, OnDestroy, Output, ViewChild } from '@angular/core';
import { Subscription, timeout } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-index-app-menu',
  standalone: true,
  template: `<iframe #frame src="https://index.montao.net/app-menu?application=gps&session=gps"
    title="Aplicaciones disponibles en Montao Index"
    sandbox="allow-scripts allow-same-origin allow-top-navigation allow-forms"></iframe>`,
  styles: [`:host { display: block; width: 100%; height: 100%; }
    iframe { display: block; width: 100%; height: 100%; border: 0; }`],
})
export class IndexAppMenuComponent implements OnDestroy {
  @ViewChild('frame') frame?: ElementRef<HTMLIFrameElement>;
  @Output() openIndex = new EventEmitter<string>();
  private readonly indexOrigin = 'https://index.montao.net';
  private request?: Subscription;
  private pending = false;

  constructor(private readonly auth: AuthService) {}

  @HostListener('window:message', ['$event'])
  onMessage(event: MessageEvent) {
    const target = this.frame?.nativeElement.contentWindow;
    if (!target || event.source !== target || event.origin !== this.indexOrigin) return;
    if (event.data?.type === 'MONTAO_INDEX_GPS_OPEN') {
      if (['apps', 'cloud', 'inbox', 'desk', 'studio'].includes(event.data.application)) {
        this.openIndex.emit(event.data.application);
      }
      return;
    }
    if (event.data?.type !== 'MONTAO_INDEX_GPS_SESSION_REQUEST' ||
        typeof event.data.requestId !== 'string' || event.data.requestId.length > 100 || this.pending) return;
    const requestId = event.data.requestId;
    const gpsUserId = this.auth.getCurrentUser()?.id;
    this.pending = true;
    this.request = this.auth.createIndexBrowserSession().pipe(timeout(15_000)).subscribe({
      next: ({ code }) => {
        this.pending = false;
        if (this.auth.getCurrentUser()?.id !== gpsUserId) return;
        target.postMessage({ type: 'MONTAO_INDEX_GPS_SESSION', requestId, code }, this.indexOrigin);
      },
      error: () => {
        this.pending = false;
        target.postMessage({ type: 'MONTAO_INDEX_GPS_SESSION_ERROR', requestId }, this.indexOrigin);
      },
    });
  }

  ngOnDestroy() { this.request?.unsubscribe(); }
}
