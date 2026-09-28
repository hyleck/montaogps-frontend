import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SMOKE_IMPORTS, SMOKE_PROVIDERS, SMOKE_SCHEMAS } from '../../../../testing/component-smoke.testing';

import { MapsComponent } from './maps.component';

describe('MapsComponent', () => {
  let component: MapsComponent;
  let fixture: ComponentFixture<MapsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MapsComponent],
      imports: SMOKE_IMPORTS,
      providers: SMOKE_PROVIDERS,
      schemas: SMOKE_SCHEMAS,
    })
    .compileComponents();

    fixture = TestBed.createComponent(MapsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps navigation at the last valid fix after an invalid live update', () => {
    component.selectedTarget = {
      _id: '863874080932787',
      traccarInfo: { geolocation: { valid: true, latitude: 19.63116, longitude: -70.28124 } },
    };
    expect(component.getGoogleMapsUrl()).toBe('https://www.google.com/maps?q=19.63116,-70.28124');

    component.selectedTarget = {
      _id: '863874080932787',
      traccarInfo: { geolocation: { valid: false, latitude: 0, longitude: 0 } },
    };
    expect(component.getGoogleMapsUrl()).toBe('https://www.google.com/maps?q=19.63116,-70.28124');
    expect(component.getWazeUrl()).toContain('19.63116%2C-70.28124');
  });

  it('does not offer navigation when no valid fix exists', () => {
    component.selectedTarget = {
      _id: 'never-located',
      traccarInfo: { geolocation: { valid: false, latitude: 19.6, longitude: -70.2 } },
    };
    expect(component.getGoogleMapsUrl()).toBeNull();
    expect(component.getWazeUrl()).toBeNull();
  });
});
