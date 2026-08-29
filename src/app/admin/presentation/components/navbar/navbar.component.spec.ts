/// <reference types="google.maps" />

import { fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { NavbarComponent } from './navbar.component';

describe('NavbarComponent realtime links', () => {
  function createComponent() {
    const selectionService = {
      selectedTargetsValue: [],
      notifyTargetsUpdated: jasmine.createSpy('notifyTargetsUpdated'),
    };
    const targetsService = {
      createRealtimeShortLink: jasmine.createSpy('createRealtimeShortLink')
        .and.callFake(async (payload: { target_id: string; expires_at: string }) => ({
          short_code: `code-${payload.target_id}`,
          expires_at: payload.expires_at,
        })),
      getTargetById: jasmine.createSpy('getTargetById')
        .and.callFake(async (targetId: string) => ({
          _id: targetId,
          name: `Objetivo ${targetId}`,
          device_imei: `imei-${targetId}`,
          activation_date: '2026-01-01',
          expiration_date: '2027-01-01',
        })),
      updateTarget: jasmine.createSpy('updateTarget')
        .and.callFake(async (_targetId: string, payload: any) => payload),
      createProcess: jasmine.createSpy('createProcess')
        .and.callFake(async (payload: any) => ({ _id: 'process-id', ...payload })),
    };
    const messageService = {
      add: jasmine.createSpy('add'),
    };
    const systemService = {
      getAll: jasmine.createSpy('getAll').and.returnValue(of([{
        map_api1: { key: 'map-key' },
      }])),
    };
    const appUpdateService = {
      updateAvailable$: of(false),
      applyingUpdate$: of(false),
      applyUpdate: jasmine.createSpy('applyUpdate'),
    };
    const component = new NavbarComponent(
      { getState: () => 'light' } as any,
      {} as any,
      { getCurrentUser: () => null } as any,
      {} as any,
      {} as any,
      { getLanguages: () => [] } as any,
      { instant: (key: string) => key } as any,
      selectionService as any,
      targetsService as any,
      {
        getById: () => of({}),
        getTechnicians: () => of([]),
      } as any,
      {} as any,
      messageService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { getAllProtocols: () => of([]) } as any,
      systemService as any,
      appUpdateService as any,
    );
    return {
      component,
      selectionService,
      targetsService,
      messageService,
      systemService,
      appUpdateService,
    };
  }

  it('applies the available frontend update from the navbar', () => {
    const { component, appUpdateService } = createComponent();

    component.applyAvailableAppUpdate();

    expect(appUpdateService.applyUpdate).toHaveBeenCalledTimes(1);
  });

  it('keeps the technicians chat at the bottom while its content finishes rendering', fakeAsync(() => {
    const { component } = createComponent();
    const scrollElement = {
      scrollTop: 0,
      scrollHeight: 700,
    };
    component.floatingTechniciansVisible = true;
    (component as any).floatingTechnicianScroll = {
      nativeElement: scrollElement,
    };

    (component as any).scrollFloatingTechnicianToBottom();
    tick(70);
    scrollElement.scrollHeight = 1450;
    tick(400);

    expect(scrollElement.scrollTop).toBe(1450);
    component.ngOnDestroy();
  }));

  it('opens realtime sharing for multiple selected targets', () => {
    const { component, messageService } = createComponent();
    component.targetsToShare = [
      { _id: 'target-1', name: 'Vehículo 1' },
      { _id: 'target-2', name: 'Vehículo 2' },
    ] as any;

    component.openRealtimeShare();

    expect(component.realtimeLinkDialogVisible).toBeTrue();
    expect(component.targetsToShare.length).toBe(2);
    expect(messageService.add).not.toHaveBeenCalled();
  });

  it('shows Instructivos in the user dropdown before closing the session', () => {
    const { component } = createComponent();

    (component as any).initializeMenus();

    const labels = component.userMenuItems
      .filter(item => !item.separator)
      .map(item => item.label);
    expect(labels).toContain('Instructivos');
    expect(labels.indexOf('Instructivos')).toBeLessThan(
      labels.indexOf('navbar.logout'),
    );
  });

  it('generates one independent realtime link per selected target', async () => {
    const { component, targetsService } = createComponent();
    component.targetsToShare = [
      {
        _id: 'target-1',
        name: 'Camión Uno',
        device_imei: '111111111111111',
      },
      {
        _id: 'target-2',
        name: 'Camión Dos',
        device_imei: '222222222222222',
      },
      {
        _id: 'target-3',
        name: 'Camión Tres',
        device_imei: '333333333333333',
      },
    ] as any;
    const copySpy = spyOn(
      component,
      'copyRealtimeLinkToClipboard',
    ).and.resolveTo();

    await component.generateSelectedRealtimeLink();

    expect(targetsService.createRealtimeShortLink)
      .toHaveBeenCalledTimes(3);
    expect(targetsService.createRealtimeShortLink.calls.allArgs().map(
      args => args[0].target_id,
    )).toEqual(['target-1', 'target-2', 'target-3']);
    expect(component.realtimeGeneratedLinks.map(
      item => item.target_id,
    )).toEqual(['target-1', 'target-2', 'target-3']);
    expect(component.getRealtimeLinksClipboardText()).toContain(
      'Camión Uno · IMEI 111111111111111',
    );
    expect(component.getRealtimeLinksClipboardText()).toContain(
      'code-target-3',
    );
    expect(copySpy).toHaveBeenCalled();
  });

  it('keeps successful links when one target fails', async () => {
    const { component, targetsService, messageService } = createComponent();
    component.targetsToShare = [
      { _id: 'target-ok', name: 'Disponible' },
      { _id: 'target-fail', name: 'Con error' },
    ] as any;
    targetsService.createRealtimeShortLink.and.callFake(
      async (payload: { target_id: string; expires_at: string }) => {
        if (payload.target_id === 'target-fail') {
          throw new Error('No disponible');
        }
        return {
          short_code: `code-${payload.target_id}`,
          expires_at: payload.expires_at,
        };
      },
    );
    spyOn(component, 'copyRealtimeLinkToClipboard').and.resolveTo();

    await component.generateSelectedRealtimeLink();

    expect(component.realtimeGeneratedLinks.length).toBe(1);
    expect(component.realtimeGeneratedLinks[0].target_id)
      .toBe('target-ok');
    expect(messageService.add).toHaveBeenCalledWith(
      jasmine.objectContaining({
        severity: 'warn',
        summary: 'Generación parcial',
      }),
    );
  });

  it('offers the target-form processes except the four unsafe GPS and SIM changes', () => {
    const { component } = createComponent();

    expect(component.bulkProcessOptions.map(option => option.value)).toEqual([
      'installation',
      'expiration',
      'renewal',
      'technician_change',
      'installation_details_change',
      'gps_model_change',
      'sim_type_change',
    ]);
    expect(component.bulkProcessOptions.map(option => option.value))
      .not.toContain('gps_change' as any);
    expect(component.bulkProcessOptions.map(option => option.value))
      .not.toContain('sim_change' as any);
    expect(component.bulkProcessOptions.map(option => option.value))
      .not.toContain('imei_change' as any);
    expect(component.bulkProcessOptions.map(option => option.value))
      .not.toContain('sim_number_change' as any);
  });

  it('updates every selected target and records its process independently', async () => {
    const { component, targetsService } = createComponent();
    component.currentSelectedTargets = [
      { _id: 'target-1', name: 'Vehículo 1' },
      { _id: 'target-2', name: 'Vehículo 2' },
    ] as any;
    component.bulkProcessForm.type = 'installation';
    component.bulkProcessForm.registrationDate = '2026-07-30';
    component.bulkProcessForm.newInstallationDate = '2026-08-05';

    await component.applyBulkProcess();

    expect(targetsService.updateTarget).toHaveBeenCalledTimes(2);
    expect(targetsService.updateTarget).toHaveBeenCalledWith(
      'target-1',
      jasmine.objectContaining({
        activation_date: '2026-08-05',
      }),
    );
    expect(targetsService.createProcess).toHaveBeenCalledTimes(2);
    expect(targetsService.createProcess.calls.allArgs().map(
      args => args[0].type,
    )).toEqual([2, 2]);
    expect(component.bulkProcessSuccessCount).toBe(2);
    expect(component.bulkProcessErrorCount).toBe(0);
    expect(component.bulkProcessProgress).toBe(100);
  });
});
