import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SMOKE_IMPORTS, SMOKE_PROVIDERS, SMOKE_SCHEMAS } from '../../../../../../../testing/component-smoke.testing';

import { SimcardVerificationComponent } from './simcard-verification.component';

describe('SimcardVerificationComponent', () => {
  let component: SimcardVerificationComponent;
  let fixture: ComponentFixture<SimcardVerificationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SimcardVerificationComponent],
      imports: SMOKE_IMPORTS,
      providers: SMOKE_PROVIDERS,
      schemas: SMOKE_SCHEMAS,
    })
    .compileComponents();

    fixture = TestBed.createComponent(SimcardVerificationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
