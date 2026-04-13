import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SimcardVerificationComponent } from './simcard-verification.component';

describe('SimcardVerificationComponent', () => {
  let component: SimcardVerificationComponent;
  let fixture: ComponentFixture<SimcardVerificationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SimcardVerificationComponent]
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
