import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProtocolsSettingsComponent } from './protocols-settings.component';

describe('ProtocolsSettingsComponent', () => {
  let component: ProtocolsSettingsComponent;
  let fixture: ComponentFixture<ProtocolsSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProtocolsSettingsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProtocolsSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
