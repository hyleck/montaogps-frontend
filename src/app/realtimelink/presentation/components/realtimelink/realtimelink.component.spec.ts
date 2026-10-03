import { ElementRef } from '@angular/core';
import { fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { NEVER, of, Subject, throwError } from 'rxjs';
import { MapUtils } from '../../../../shareds/helpers/map.helper';
import { RealtimelinkComponent } from './realtimelink.component';

describe('RealtimelinkComponent current browser map key', () => {
  let component: RealtimelinkComponent;
  let params: Subject<any>;
  let systems: any;
  let targets: any;
  let loadScript: jasmine.Spy;
  let createMap: jasmine.Spy;
  const config = {
    name: 'Google Maps',
    url: 'https://maps.googleapis.com/maps/api/js?key=',
    key: 'current-browser-key',
  };

  beforeEach(() => {
    params = new Subject();
    systems = { getPublicGoogleMapConfig: jasmine.createSpy('getPublicGoogleMapConfig').and.returnValue(of(config)) };
    targets = {
      resolvePublicRealtimeShortLink: jasmine.createSpy('resolvePublicRealtimeShortLink').and.resolveTo({
        target_id: 'short-link-target',
        expires_at: '2099-01-01T00:00:00.000Z',
        gkey: 'old-stored-key',
      }),
    };
    component = new RealtimelinkComponent(systems, targets, { queryParams: params } as any);
    component.mapContainer = new ElementRef(document.createElement('div'));
    loadScript = spyOn(MapUtils, 'loadMapScript').and.resolveTo();
    createMap = spyOn(MapUtils, 'createMap').and.returnValue({} as any);
    spyOn<any>(component, 'loadAndDisplayTarget').and.stub();
    spyOn<any>(component, 'startCountdown').and.callFake(() => (component as any).updateCountdown());
    spyOn(console, 'error');
    component.ngOnInit();
  });

  afterEach(() => component.ngOnDestroy());

  function openLegacyLink(key: string | undefined = 'old-embedded-key'): void {
    params.next({ data: btoa(JSON.stringify({ trgt: 'legacy-target', gkey: key })) });
  }

  it('repairs an existing base64 link by preferring the current configuration over its embedded key', fakeAsync(() => {
    openLegacyLink();
    flushMicrotasks();

    expect(component.targetId).toBe('legacy-target');
    expect(systems.getPublicGoogleMapConfig).toHaveBeenCalledTimes(1);
    expect(loadScript).toHaveBeenCalledOnceWith('google', 'current-browser-key', config.url);
    expect(createMap.calls.mostRecent().args[2]).toBe('current-browser-key');
    expect(component.apiKey).toBe('current-browser-key');
  }));

  it('repairs an existing short link without changing its target or expiration', fakeAsync(() => {
    params.next({ c: 'existing-code' });
    flushMicrotasks();

    expect(targets.resolvePublicRealtimeShortLink).toHaveBeenCalledWith('existing-code');
    expect(component.targetId).toBe('short-link-target');
    expect(component.expirationDate?.toISOString()).toBe('2099-01-01T00:00:00.000Z');
    expect(loadScript).toHaveBeenCalledOnceWith('google', 'current-browser-key', config.url);
  }));

  it('loads a legacy link with no embedded key using current browser configuration', fakeAsync(() => {
    params.next({ trgt: 'older-target' });
    flushMicrotasks();

    expect(component.targetId).toBe('older-target');
    expect(loadScript).toHaveBeenCalledOnceWith('google', 'current-browser-key', config.url);
  }));

  it('keeps old links usable while the dedicated endpoint is unavailable during rollout', fakeAsync(() => {
    systems.getPublicGoogleMapConfig.and.returnValue(throwError(() => ({ status: 404 })));
    openLegacyLink();
    flushMicrotasks();

    expect(loadScript).toHaveBeenCalledOnceWith('google', 'old-embedded-key', config.url);
  }));

  for (const unavailable of [null, {}, { ...config, key: '  ' }, { ...config, url: '' }]) {
    it(`uses the embedded key if current configuration is incomplete: ${JSON.stringify(unavailable)}`, fakeAsync(() => {
      systems.getPublicGoogleMapConfig.and.returnValue(of(unavailable));
      openLegacyLink();
      flushMicrotasks();
      expect(loadScript).toHaveBeenCalledOnceWith('google', 'old-embedded-key', config.url);
    }));
  }

  it('falls back after five seconds if the configuration endpoint never responds', fakeAsync(() => {
    systems.getPublicGoogleMapConfig.and.returnValue(NEVER);
    openLegacyLink();
    tick(4999);
    expect(loadScript).not.toHaveBeenCalled();
    tick(1);
    flushMicrotasks();
    expect(loadScript).toHaveBeenCalledOnceWith('google', 'old-embedded-key', config.url);
  }));

  it('does not load an invalid script when neither current nor embedded configuration is available', fakeAsync(() => {
    systems.getPublicGoogleMapConfig.and.returnValue(of(null));
    params.next({ trgt: 'older-target' });
    flushMicrotasks();
    expect(loadScript).not.toHaveBeenCalled();
    expect(createMap).not.toHaveBeenCalled();
  }));

  it('unsubscribes a pending configuration request and route listener when destroyed', fakeAsync(() => {
    const pending = new Subject<any>();
    systems.getPublicGoogleMapConfig.and.returnValue(pending);
    openLegacyLink();
    component.ngOnDestroy();
    pending.next(config);
    params.next({ trgt: 'later-target' });
    flushMicrotasks();

    expect(systems.getPublicGoogleMapConfig).toHaveBeenCalledTimes(1);
    expect(loadScript).not.toHaveBeenCalled();
  }));

  it('cancels a superseded configuration response when another link is opened', fakeAsync(() => {
    const first = new Subject<any>();
    systems.getPublicGoogleMapConfig.and.returnValues(first, of(config));
    openLegacyLink();
    params.next({ data: btoa(JSON.stringify({ trgt: 'second-target', gkey: 'second-old-key' })) });
    first.next({ ...config, key: 'stale-response-key' });
    flushMicrotasks();

    expect(component.targetId).toBe('second-target');
    expect(loadScript).toHaveBeenCalledOnceWith('google', 'current-browser-key', config.url);
  }));

  it('does not create a map if its script finishes loading after the component is destroyed', fakeAsync(() => {
    let resolveScript!: () => void;
    loadScript.and.returnValue(new Promise<void>(resolve => resolveScript = resolve));
    openLegacyLink();
    component.ngOnDestroy();
    resolveScript();
    flushMicrotasks();
    expect(createMap).not.toHaveBeenCalled();
  }));

  it('preserves expiration and does not initialize an expired link with the new key', fakeAsync(() => {
    params.next({ data: btoa(JSON.stringify({
      trgt: 'expired-target', gkey: 'old-embedded-key', exprcn: '2000-01-01T00:00:00.000Z',
    })) });
    flushMicrotasks();

    expect(component.isExpired).toBeTrue();
    expect(systems.getPublicGoogleMapConfig).not.toHaveBeenCalled();
    expect(loadScript).not.toHaveBeenCalled();
  }));
});
