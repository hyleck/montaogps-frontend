import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VehicleModelsSettingsComponent } from './vehicle-models-settings.component';

describe('VehicleModelsSettingsComponent', () => {
  let component: VehicleModelsSettingsComponent;
  let fixture: ComponentFixture<VehicleModelsSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VehicleModelsSettingsComponent]
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
