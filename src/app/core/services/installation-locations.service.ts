import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, finalize, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  DEFAULT_INSTALLATION_LOCATIONS,
  InstallationLocationOption,
} from '../constants/installation-locations.constant';

@Injectable({ providedIn: 'root' })
export class InstallationLocationsService {
  private readonly apiUrl = `${environment.apiUrl}/installation-locations`;
  private readonly locationsSubject = new BehaviorSubject<InstallationLocationOption[]>(
    [...DEFAULT_INSTALLATION_LOCATIONS],
  );
  private loaded = false;
  private loadRequest?: Observable<InstallationLocationOption[]>;

  readonly locations$ = this.locationsSubject.asObservable();

  constructor(private readonly http: HttpClient) {}

  load(force = false): Observable<InstallationLocationOption[]> {
    if (this.loaded && !force) return of(this.locationsSubject.value);
    if (this.loadRequest && !force) return this.loadRequest;

    this.loadRequest = this.http.get<InstallationLocationOption[]>(this.apiUrl).pipe(
      tap(locations => {
        this.locationsSubject.next(this.mergeLocations(locations));
        this.loaded = true;
      }),
      catchError(() => of(this.locationsSubject.value)),
      finalize(() => { this.loadRequest = undefined; }),
      shareReplay(1),
    );
    return this.loadRequest;
  }

  create(label: string): Observable<InstallationLocationOption> {
    return this.http.post<InstallationLocationOption>(this.apiUrl, { label }).pipe(
      tap(location => {
        this.locationsSubject.next(this.mergeLocations([
          ...this.locationsSubject.value,
          location,
        ]));
      }),
    );
  }

  private mergeLocations(locations: InstallationLocationOption[] = []): InstallationLocationOption[] {
    const merged = new Map<string, InstallationLocationOption>();
    [...DEFAULT_INSTALLATION_LOCATIONS, ...locations].forEach(location => {
      const value = String(location?.value || '').trim();
      const label = String(location?.label || '').trim();
      if (!value || !label || merged.has(value)) return;
      merged.set(value, { ...location, label, value });
    });
    return Array.from(merged.values());
  }
}
