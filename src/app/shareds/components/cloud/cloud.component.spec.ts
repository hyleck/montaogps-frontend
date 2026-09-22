import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SMOKE_IMPORTS, SMOKE_PROVIDERS } from 'src/testing/component-smoke.testing';

import { CloudComponent } from './cloud.component';

describe('CloudComponent', () => {
  let component: CloudComponent;
  let fixture: ComponentFixture<CloudComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CloudComponent, ...SMOKE_IMPORTS],
      providers: SMOKE_PROVIDERS,
    })
    .compileComponents();

    fixture = TestBed.createComponent(CloudComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
