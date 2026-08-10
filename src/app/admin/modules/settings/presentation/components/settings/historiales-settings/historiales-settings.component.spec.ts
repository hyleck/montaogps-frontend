import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';

import { HistorialesSettingsComponent } from './historiales-settings.component';
import { HistorialesService } from '@core/services/historiales.service';

describe('HistorialesSettingsComponent', () => {
  let component: HistorialesSettingsComponent;
  let fixture: ComponentFixture<HistorialesSettingsComponent>;
  let messageService: jasmine.SpyObj<MessageService>;

  beforeEach(async () => {
    messageService = jasmine.createSpyObj<MessageService>('MessageService', [
      'add',
    ]);

    await TestBed.configureTestingModule({
      declarations: [HistorialesSettingsComponent],
      providers: [
        {
          provide: HistorialesService,
          useValue: {
            getDevices: () => of({ success: true, devices: [] }),
            getCurrentProgress: () => of({ success: false, progress: null }),
          },
        },
        { provide: MessageService, useValue: messageService },
        { provide: ConfirmationService, useValue: {} },
        {
          provide: TranslateService,
          useValue: { instant: (key: string) => key },
        },
      ],
    })
      .overrideComponent(HistorialesSettingsComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(HistorialesSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the backend failure reason when an analysis fails', () => {
    component.currentProgress = {
      analysisId: 'analysis-1',
      status: 'failed',
      overallProgress: 100,
      currentDeviceIndex: 10,
      totalDevices: 10,
      completedDevices: 4,
      failedDevices: 6,
      elapsedTimeMs: 1000,
      totalPositionsFound: 50,
      currentMessage: 'Error en análisis: MongoDB no disponible',
      deviceProgress: [],
    };

    (component as any).handleAnalysisCompletion('failed');

    expect(messageService.add).toHaveBeenCalledWith(
      jasmine.objectContaining({
        severity: 'error',
        detail: 'Error en análisis: MongoDB no disponible',
      }),
    );
  });
});
