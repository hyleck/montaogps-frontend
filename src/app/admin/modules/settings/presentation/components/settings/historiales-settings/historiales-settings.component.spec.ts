import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ConfirmationService, MessageService } from 'primeng/api';

import { HistorialesSettingsComponent } from './historiales-settings.component';
import { HistorialesService } from '@core/services/historiales.service';
import { ArchiveDashboardResponse } from './historiales.interface';

describe('HistorialesSettingsComponent', () => {
  let component: HistorialesSettingsComponent;
  let fixture: ComponentFixture<HistorialesSettingsComponent>;
  let historialesService: jasmine.SpyObj<HistorialesService>;
  let confirmationService: jasmine.SpyObj<ConfirmationService>;
  let messageService: jasmine.SpyObj<MessageService>;

  const dashboard: ArchiveDashboardResponse = {
    success: true,
    generatedAt: '2026-08-31T12:00:00.000Z',
    worker: {
      enabled: true,
      archiveSchedule: '02:00',
      cleanupSchedule: '04:30',
      timezone: 'America/Santo_Domingo',
      startupRecovery: true,
      chunkHours: 72,
      concurrency: 4,
      retentionDays: 30,
    },
    summary: {
      totalServers: 1,
      protectedServers: 0,
      blockedServers: 1,
      runningRuns: 0,
    },
    retention: {
      enabled: false,
      archiveReady: true,
      retentionDays: 30,
      safeBefore: null,
      reason: 'Uno o más servidores todavía no tienen una copia verificable',
      servers: [
        {
          enabled: false,
          archiveReady: true,
          serverId: 'server-1',
          serverName: 'S1',
          retentionDays: 30,
          safeBefore: null,
          coverageMode: 'complete_before_cutoff',
          verificationVersion: 3,
          verifiedSafeBefore: null,
          retentionVerifiedAt: null,
          deviceSetDigest: null,
          deviceCount: 0,
          archiveCoverageFrom: '2026-07-01T00:00:00.000Z',
          archiveCoverageTo: '2026-08-31T11:00:00.000Z',
          lastSuccessFrom: '2026-08-30T00:00:00.000Z',
          lastSuccessTo: '2026-08-31T11:00:00.000Z',
          lastSuccessAt: '2026-08-31T11:30:00.000Z',
          reason:
            'Falta la marca de cobertura histórica verificada. Falta la huella verificable de los dispositivos certificados',
        },
      ],
    },
    recentRuns: [],
  };

  beforeEach(async () => {
    historialesService = jasmine.createSpyObj<HistorialesService>(
      'HistorialesService',
      ['getArchiveDashboard', 'triggerArchive'],
    );
    historialesService.getArchiveDashboard.and.returnValue(of(dashboard));
    historialesService.triggerArchive.and.returnValue(
      of({ success: true, accepted: true, message: 'Corrida iniciada' }),
    );
    confirmationService = jasmine.createSpyObj<ConfirmationService>(
      'ConfirmationService',
      ['confirm'],
    );
    messageService = jasmine.createSpyObj<MessageService>('MessageService', [
      'add',
    ]);

    await TestBed.configureTestingModule({
      declarations: [HistorialesSettingsComponent],
      providers: [
        { provide: HistorialesService, useValue: historialesService },
        { provide: MessageService, useValue: messageService },
        { provide: ConfirmationService, useValue: confirmationService },
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

  afterEach(() => component.ngOnDestroy());

  it('loads the operational archive dashboard', () => {
    expect(component.dashboard).toEqual(dashboard);
    expect(component.servers[0].serverName).toBe('S1');
    expect(component.loading).toBeFalse();
  });

  it('separates each blocking reason for the server card', () => {
    expect(
      component.getBlockingReasons(dashboard.retention.servers[0].reason),
    ).toEqual([
      'Falta la marca de cobertura histórica verificada',
      'Falta la huella verificable de los dispositivos certificados',
    ]);
  });

  it('requests confirmation before starting a manual run', () => {
    component.requestArchiveRun();

    const confirmation = confirmationService.confirm.calls.mostRecent().args[0];
    confirmation.accept?.();

    expect(historialesService.triggerArchive).toHaveBeenCalled();
    expect(messageService.add).toHaveBeenCalledWith(
      jasmine.objectContaining({ severity: 'success' }),
    );
  });
});
