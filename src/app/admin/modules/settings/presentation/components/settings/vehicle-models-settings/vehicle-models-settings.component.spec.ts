import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SMOKE_IMPORTS, SMOKE_PROVIDERS, SMOKE_SCHEMAS } from '../../../../../../../../testing/component-smoke.testing';

import { VehicleModelsSettingsComponent } from './vehicle-models-settings.component';

describe('VehicleModelsSettingsComponent', () => {
  let component: VehicleModelsSettingsComponent;
  let fixture: ComponentFixture<VehicleModelsSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VehicleModelsSettingsComponent],
      imports: SMOKE_IMPORTS,
      providers: SMOKE_PROVIDERS,
      schemas: SMOKE_SCHEMAS,
    })
    .compileComponents();

    fixture = TestBed.createComponent(VehicleModelsSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
