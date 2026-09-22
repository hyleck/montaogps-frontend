import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SMOKE_IMPORTS, SMOKE_PROVIDERS, SMOKE_SCHEMAS } from 'src/testing/component-smoke.testing';
import { TargetFormModule } from './target-form.module';

import { TargetFormComponent } from './target-form.component';

describe('TargetFormComponent', () => {
  let component: TargetFormComponent;
  let fixture: ComponentFixture<TargetFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // Se usa el módulo real: declara el componente con su directiva de etiquetas y sus componentes.
      imports: [TargetFormModule, ...SMOKE_IMPORTS],
      providers: SMOKE_PROVIDERS,
      schemas: SMOKE_SCHEMAS,
    })
    .compileComponents();

    fixture = TestBed.createComponent(TargetFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
