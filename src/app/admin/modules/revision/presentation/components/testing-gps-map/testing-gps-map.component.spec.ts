import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { TestingGpsPosition } from 'src/app/core/services/simcard-testing.service';
import { MapUtils } from 'src/app/shareds/helpers/map.helper';
import { TestingGpsMapComponent } from './testing-gps-map.component';

describe('TestingGpsMapComponent', () => {
  let fixture: ComponentFixture<TestingGpsMapComponent>;
  let component: TestingGpsMapComponent;
  let map: jasmine.SpyObj<any>;
  let marker: jasmine.SpyObj<any>;
  let createMap: jasmine.Spy;
  let resizeCallback: ResizeObserverCallback;
  let resizeObserver: jasmine.SpyObj<ResizeObserver>;
  let handlers: Record<string, () => void>;
  const position: TestingGpsPosition = {
    id: 10, latitude: 18.4861, longitude: -69.9312, fixTime: '2026-09-29T18:00:00Z',
    receivedAt: '2026-09-29T18:00:01Z', speed: 0, course: 180, accuracy: 5,
  };

  beforeEach(async () => {
    handlers = {};
    map = jasmine.createSpyObj('map', ['on', 'off', 'resize', 'setCenter', 'setZoom', 'remove']);
    map.on.and.callFake((event: string, handler: () => void) => { handlers[event] = handler; return map; });
    marker = jasmine.createSpyObj('marker', ['setLngLat', 'addTo', 'remove', 'getElement']);
    marker.setLngLat.and.returnValue(marker);
    marker.addTo.and.returnValue(marker);
    marker.getElement.and.returnValue(document.createElement('div'));
    createMap = spyOn(MapUtils, 'createMap').and.returnValue(map);
    spyOn(MapUtils, 'getMapLibrary').and.returnValue({ Marker: jasmine.createSpy('Marker').and.returnValue(marker) });
    resizeObserver = jasmine.createSpyObj('ResizeObserver', ['observe', 'disconnect', 'unobserve']);
    spyOn(window, 'ResizeObserver').and.callFake(function(callback: ResizeObserverCallback) {
      resizeCallback = callback;
      return resizeObserver;
    } as any);
    await TestBed.configureTestingModule({ imports: [TestingGpsMapComponent] }).compileComponents();
    fixture = TestBed.createComponent(TestingGpsMapComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('sessionId', 'test-1');
    fixture.componentRef.setInput('imei', '123456789012345');
  });

  afterEach(() => fixture.destroy());

  it('waits for a valid session position instead of drawing a default or zero marker', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    expect(fixture.nativeElement.textContent).toContain('Esperando la primera ubicación válida');
    expect(createMap).not.toHaveBeenCalled();
    for (const invalid of [
      { ...position, latitude: 0, longitude: 0 },
      { ...position, latitude: 95 },
      { ...position, longitude: NaN },
      { ...position, fixTime: 'invalid' },
    ]) {
      fixture.componentRef.setInput('position', invalid);
      fixture.detectChanges();
      tick();
    }
    expect(createMap).not.toHaveBeenCalled();
    expect(component.point).toBeNull();
  }));

  it('renders the session point and changes marker coordinates without rebuilding the map', fakeAsync(() => {
    fixture.componentRef.setInput('position', position);
    fixture.detectChanges();
    tick();
    expect(createMap).toHaveBeenCalledOnceWith('osm', jasmine.any(HTMLElement), '', 'light', position.latitude, position.longitude, 16);
    expect(marker.setLngLat).toHaveBeenCalledWith([-69.9312, 18.4861]);
    const moved = { ...position, id: 11, latitude: 18.4862, longitude: -69.9313, fixTime: '2026-09-29T18:00:05Z' };
    fixture.componentRef.setInput('position', moved);
    fixture.detectChanges();
    tick();
    expect(createMap).toHaveBeenCalledTimes(1);
    expect(marker.setLngLat).toHaveBeenCalledWith([-69.9313, 18.4862]);
    expect(map.setCenter).toHaveBeenCalledWith([-69.9313, 18.4862]);
    expect(component.point?.fixTime).toBe(moved.fixTime);
  }));

  it('resizes when a previously hidden modal container becomes visible and on map load', fakeAsync(() => {
    fixture.nativeElement.style.display = 'none';
    fixture.componentRef.setInput('position', position);
    fixture.detectChanges();
    tick();
    expect(resizeObserver.observe).toHaveBeenCalledWith(fixture.nativeElement.querySelector('.testing-map-canvas'));
    map.resize.calls.reset();
    fixture.nativeElement.style.display = 'block';
    resizeCallback([], resizeObserver);
    expect(map.resize).toHaveBeenCalledTimes(1);
    handlers['load']();
    expect(map.resize).toHaveBeenCalledTimes(2);
  }));

  it('lets the operator explore the map, then recenter and resume following', fakeAsync(() => {
    fixture.componentRef.setInput('position', position);
    fixture.detectChanges();
    tick();
    handlers['dragstart']();
    map.setCenter.calls.reset();
    fixture.componentRef.setInput('position', { ...position, latitude: 18.49 });
    fixture.detectChanges();
    tick();
    expect(component.followGps).toBeFalse();
    expect(map.setCenter).not.toHaveBeenCalled();
    expect(marker.setLngLat).toHaveBeenCalledWith([-69.9312, 18.49]);
    component.toggleFollow();
    expect(component.followGps).toBeTrue();
    expect(map.setCenter).toHaveBeenCalledWith([-69.9312, 18.49]);
    expect(map.setZoom).toHaveBeenCalledWith(16);
  }));

  it('shows the GPS fix date and labels an unavailable update as last known', fakeAsync(() => {
    fixture.componentRef.setInput('position', position);
    fixture.componentRef.setInput('stale', true);
    fixture.componentRef.setInput('status', 'unavailable');
    fixture.componentRef.setInput('statusLabel', 'No disponible');
    fixture.componentRef.setInput('positionReason', 'Se descartó un reporte sin ubicación válida.');
    fixture.detectChanges();
    tick();
    expect(fixture.nativeElement.textContent).toContain('Última ubicación conocida');
    expect(fixture.nativeElement.textContent).toContain('29/09/2026');
    expect(fixture.nativeElement.textContent).toContain('Se descartó un reporte');
    expect(fixture.nativeElement.querySelector('.testing-map-status').textContent).toBe('No disponible');
    expect(component.point?.fixTime).toBe(position.fixTime);
  }));

  it('clears the previous marker on a new session before accepting another position', fakeAsync(() => {
    fixture.componentRef.setInput('position', position);
    fixture.detectChanges();
    tick();
    fixture.componentRef.setInput('sessionId', 'test-2');
    fixture.detectChanges();
    tick();
    expect(map.remove).toHaveBeenCalledTimes(1);
    expect(marker.remove).toHaveBeenCalledTimes(1);
    expect(component.point).toBeNull();
    expect(createMap).toHaveBeenCalledTimes(1);
    fixture.componentRef.setInput('position', { ...position, id: 20, latitude: 19 });
    fixture.detectChanges();
    tick();
    expect(createMap).toHaveBeenCalledTimes(2);
  }));

  it('handles WebGL initialization failure without losing the location details and supports retry', fakeAsync(() => {
    createMap.and.throwError('WebGL unavailable');
    fixture.componentRef.setInput('position', position);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
    expect(component.mapError).toContain('No se pudo abrir el mapa');
    expect(component.point?.latitude).toBe(position.latitude);
    expect(fixture.nativeElement.querySelector('.testing-map-canvas').hidden).toBeTrue();
    createMap.and.returnValue(map);
    component.retryMap();
    fixture.detectChanges();
    tick();
    expect(component.mapError).toBe('');
    expect(marker.addTo).toHaveBeenCalledWith(map);
  }));

  it('releases the marker, map, listeners and observer when the modal is destroyed', fakeAsync(() => {
    fixture.componentRef.setInput('position', position);
    fixture.detectChanges();
    tick();
    fixture.destroy();
    expect(marker.remove).toHaveBeenCalledTimes(1);
    expect(map.off).toHaveBeenCalledTimes(3);
    expect(map.remove).toHaveBeenCalledTimes(1);
    expect(resizeObserver.disconnect).toHaveBeenCalledTimes(1);
    resizeCallback([], resizeObserver);
    expect(component.point).toBeNull();
  }));
});
