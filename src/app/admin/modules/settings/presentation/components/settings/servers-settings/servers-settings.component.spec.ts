import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SMOKE_IMPORTS, SMOKE_PROVIDERS, SMOKE_SCHEMAS } from '../../../../../../../../testing/component-smoke.testing';

import { ServersSettingsComponent } from './servers-settings.component';

describe('ServersSettingsComponent', () => {
  let component: ServersSettingsComponent;
  let fixture: ComponentFixture<ServersSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ServersSettingsComponent],
      imports: SMOKE_IMPORTS,
      providers: SMOKE_PROVIDERS,
      schemas: SMOKE_SCHEMAS,
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
