import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HistorialesSettingsComponent } from './historiales-settings.component';

describe('HistorialesSettingsComponent', () => {
  let component: HistorialesSettingsComponent;
  let fixture: ComponentFixture<HistorialesSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [HistorialesSettingsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(HistorialesSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});