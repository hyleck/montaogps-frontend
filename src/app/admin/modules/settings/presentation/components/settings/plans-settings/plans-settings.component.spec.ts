import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlansSettingsComponent } from './plans-settings.component';

describe('PlansSettingsComponent', () => {
  let component: PlansSettingsComponent;
  let fixture: ComponentFixture<PlansSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PlansSettingsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlansSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
