import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ColorsSettingsComponent } from './colors-settings.component';

describe('ColorsSettingsComponent', () => {
  let component: ColorsSettingsComponent;
  let fixture: ComponentFixture<ColorsSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ColorsSettingsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ColorsSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
