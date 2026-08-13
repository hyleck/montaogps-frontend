import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NEVER } from 'rxjs';

import { SystemService } from '../../../core/services/system.service';
import { ReportsMapComponent } from './reports-map.component';

describe('ReportsMapComponent', () => {
  let component: ReportsMapComponent;
  let fixture: ComponentFixture<ReportsMapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ReportsMapComponent],
      providers: [
        {
          provide: SystemService,
          useValue: { getAll: () => NEVER },
        },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReportsMapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses Google Maps as the provider for the main route map', () => {
    expect(component.provider).toBe('google');
  });

  it('labels stop markers with a centered P', () => {
    expect((component as any).getStopMarkerLabel()).toEqual(jasmine.objectContaining({
      text: 'P',
      color: '#ffffff',
    }));
  });
});
