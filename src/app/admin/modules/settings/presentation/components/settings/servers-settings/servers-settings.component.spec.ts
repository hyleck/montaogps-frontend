import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ServersSettingsComponent } from './servers-settings.component';

describe('ServersSettingsComponent', () => {
  let component: ServersSettingsComponent;
  let fixture: ComponentFixture<ServersSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ServersSettingsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ServersSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
