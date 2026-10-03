import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { SystemService } from './system.service';

describe('SystemService public Google Maps configuration', () => {
  let service: SystemService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SystemService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('gets browser map configuration from its dedicated public endpoint', () => {
    let result: unknown;
    service.getPublicGoogleMapConfig().subscribe(value => result = value);
    const request = http.expectOne(`${environment.apiUrl}/systems-public/google-map-config`);
    expect(request.request.method).toBe('GET');
    expect(request.request.body).toBeNull();
    expect(request.request.headers.has('Authorization')).toBeFalse();
    const config = { name: 'Google Maps', url: 'browser-map-url', key: 'current-browser-key' };
    request.flush(config);
    expect(result).toEqual(config);
  });

  it('preserves the separate public system endpoint and supports absent map configuration', () => {
    let config: unknown = 'pending';
    service.getPublicGoogleMapConfig().subscribe(value => config = value);
    http.expectOne(`${environment.apiUrl}/systems-public/google-map-config`).flush(null);
    expect(config).toBeNull();

    service.getPublic().subscribe();
    http.expectOne(`${environment.apiUrl}/systems-public`).flush([{ company_name: 'Montao GPS' }]);
  });
});
