import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, OnDestroy, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, Subject, firstValueFrom, takeUntil, timer } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AppVersionManifest {
  version: string;
  assets: string[];
  builtAt?: string;
}

@Injectable({ providedIn: 'root' })
export class AppUpdateService implements OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly updateAvailableSubject = new BehaviorSubject(false);
  private readonly applyingUpdateSubject = new BehaviorSubject(false);
  private readonly isBrowser: boolean;
  private readonly loadedAssets: string[];
  private latestVersion = '';
  private checking = false;
  private readonly visibilityHandler = () => {
    if (this.document.visibilityState === 'visible') {
      void this.checkForUpdates();
    }
  };

  readonly updateAvailable$ = this.updateAvailableSubject.asObservable();
  readonly applyingUpdate$ = this.applyingUpdateSubject.asObservable();

  constructor(
    private readonly http: HttpClient,
    @Inject(DOCUMENT) private readonly document: Document,
    @Inject(PLATFORM_ID) platformId: object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.loadedAssets = this.isBrowser ? this.readLoadedAssets() : [];

    if (this.isBrowser && environment.production) {
      timer(0, 60_000)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => void this.checkForUpdates());
      this.document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  async checkForUpdates(): Promise<void> {
    if (!this.isBrowser || this.checking || this.applyingUpdateSubject.value) {
      return;
    }

    this.checking = true;
    try {
      const manifest = await firstValueFrom(
        this.http.get<AppVersionManifest>(
          `/app-version?_=${Date.now()}`,
        ),
      );
      const remoteAssets = this.normalizeAssets(manifest?.assets);
      if (!manifest?.version || !remoteAssets.length || !this.loadedAssets.length) {
        return;
      }

      this.latestVersion = String(manifest.version);
      this.updateAvailableSubject.next(
        !this.sameAssets(this.loadedAssets, remoteAssets),
      );
    } catch {
      // La comprobación es silenciosa: una caída temporal no debe interrumpir
      // el trabajo del usuario ni mostrar errores globales en la aplicación.
    } finally {
      this.checking = false;
    }
  }

  applyUpdate(): void {
    if (!this.isBrowser || !this.updateAvailableSubject.value) return;
    const currentLocation = this.document.defaultView?.location;
    if (!currentLocation) return;

    this.applyingUpdateSubject.next(true);
    const target = new URL(currentLocation.href);
    target.searchParams.set(
      'app-update',
      this.latestVersion || String(Date.now()),
    );
    currentLocation.replace(target.toString());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.isBrowser) {
      this.document.removeEventListener(
        'visibilitychange',
        this.visibilityHandler,
      );
    }
  }

  private readLoadedAssets(): string[] {
    const resources = Array.from(
      this.document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>(
        'script[src], link[rel="stylesheet"][href]',
      ),
    ).map(element =>
      element.tagName.toLowerCase() === 'script'
        ? (element as HTMLScriptElement).src
        : (element as HTMLLinkElement).href,
    );
    return this.normalizeAssets(resources);
  }

  private normalizeAssets(values: unknown): string[] {
    if (!Array.isArray(values)) return [];
    return Array.from(new Set(values
      .map(value => this.normalizeAsset(value))
      .filter((value): value is string => Boolean(value))))
      .sort();
  }

  private normalizeAsset(value: unknown): string {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const base = this.document.baseURI || 'https://montao.invalid/';
      const url = new URL(raw, base);
      if (!/\.(?:js|css)$/i.test(url.pathname)) return '';
      return url.pathname;
    } catch {
      return '';
    }
  }

  private sameAssets(current: string[], remote: string[]): boolean {
    return current.length === remote.length
      && current.every((asset, index) => asset === remote[index]);
  }
}
