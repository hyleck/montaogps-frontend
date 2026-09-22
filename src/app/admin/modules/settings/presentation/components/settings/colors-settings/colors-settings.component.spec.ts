import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SMOKE_IMPORTS, SMOKE_PROVIDERS, SMOKE_SCHEMAS } from '../../../../../../../../testing/component-smoke.testing';

import { ColorsSettingsComponent } from './colors-settings.component';

describe('ColorsSettingsComponent', () => {
  let component: ColorsSettingsComponent;
  let fixture: ComponentFixture<ColorsSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ColorsSettingsComponent],
      imports: SMOKE_IMPORTS,
      providers: SMOKE_PROVIDERS,
      schemas: SMOKE_SCHEMAS,
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
