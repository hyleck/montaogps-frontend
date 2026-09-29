import { fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { ManagementComponent } from './management.component';

describe('Management renewal status refresh', () => {
  let component: any;
  const oldExpiration = '2025-09-22T12:00:00.000Z';
  const renewedExpiration = '2027-09-22T12:00:00.000Z';

  beforeEach(() => {
    component = Object.create(ManagementComponent.prototype);
    component.selectedUser = { _id: 'client-1' };
    component.targetsLoadRequestId = 0;
    component.destroyed = false;
    component.pollingInProgress = false;
    component.previousTargetsStatus = new Map([['device-1', 'offline']]);
    component.buildLinkedTargetCardRows = (rows: any[]) => rows;
    component.validLocationDates = { resolve: () => null };
    component.getDisplayTraccarStatus = (target: any) => target.traccarInfo?.status || 'offline';
    component.translate = { instant: (key: string) => key };
    component.messageService = { add: jasmine.createSpy('add') };
    component.cdr = { detectChanges: jasmine.createSpy('detectChanges') };
    component.targetsService = {
      getTargetStatuses: jasmine.createSpy('getTargetStatuses').and.resolveTo([]),
      getTargetById: jasmine.createSpy('getTargetById'),
    };
    const target = {
      _id: 'device-1', name: 'GPS Pablo', device_imei: '862667088345023',
      expiration_date: oldExpiration,
      pending_renewal_date: renewedExpiration,
      pending_renewal_process_id: 'process-1',
      pending_renewal_requested_at: '2026-09-29T12:00:00.000Z',
      traccarInfo: { status: 'offline' },
    };
    component.targets = [{ ...target }];
    component.targetsList = [{ ...target, originalTarget: { ...target } }];
    component.selectedTargetForMap = component.targetsList[0];
    component.targetToEdit = { ...component.targetsList[0], originalTarget: { ...target } };
    component.targetFormRef = { applyRenewalStatus: jasmine.createSpy('applyRenewalStatus') };
  });

  it('updates the list, source data, map and open editor after invoicing without reloading the list', async () => {
    const editingInput = component.targetToEdit;
    const status = {
      _id: 'device-1', device_imei: '862667088345023', traccarInfo: { status: 'online' },
      expiration_date: renewedExpiration,
      pending_renewal_date: null, pending_renewal_process_id: null, pending_renewal_requested_at: null,
    };
    component.targetsService.getTargetStatuses.and.resolveTo([status]);
    await component.updateAllTargetsStatusInPolling();

    expect(component.targetsService.getTargetStatuses).toHaveBeenCalledOnceWith('client-1', ['device-1']);
    expect(component.targetsService.getTargetById).not.toHaveBeenCalled();
    for (const target of [component.targets[0], component.targetsList[0], component.targetsList[0].originalTarget,
      component.targetsCardList[0], component.selectedTargetForMap, component.targetToEdit, component.targetToEdit.originalTarget]) {
      expect(target.expiration_date).toBe(renewedExpiration);
      expect(target.pending_renewal_date).toBeNull();
      expect(target.pending_renewal_process_id).toBeNull();
      expect(target.pending_renewal_requested_at).toBeNull();
      expect(target.name).toBe('GPS Pablo');
    }
    expect(component.targetToEdit).toBe(editingInput);
    expect(component.targetFormRef.applyRenewalStatus).toHaveBeenCalledOnceWith(status);
    expect(component.targetsList[0].traccarStatus).toBe('online');
  });

  it('preserves renewal fields if the server omits them and accepts an explicitly cleared expiry', async () => {
    component.targetsService.getTargetStatuses.and.resolveTo([
      { _id: 'device-1', device_imei: '862667088345023', traccarInfo: { status: 'offline' } },
    ]);
    await component.updateAllTargetsStatusInPolling();
    expect(component.targetsList[0].expiration_date).toBe(oldExpiration);
    expect(component.targets[0].pending_renewal_process_id).toBe('process-1');
    expect(component.targetToEdit.pending_renewal_date).toBe(renewedExpiration);

    component.targetsService.getTargetStatuses.and.resolveTo([
      { _id: 'device-1', device_imei: '862667088345023', expiration_date: null },
    ]);
    await component.updateAllTargetsStatusInPolling();
    expect(component.targetsList[0].expiration_date).toBeNull();
    expect(component.targets[0].expiration_date).toBeNull();
    expect(component.targetToEdit.expiration_date).toBeNull();
    expect(component.targets[0].pending_renewal_process_id).toBe('process-1');
  });

  for (const changedContext of ['client', 'list', 'destroyed']) {
    it(`ignores a response when the ${changedContext} context changed`, async () => {
      let complete!: (statuses: any[]) => void;
      component.targetsService.getTargetStatuses.and.returnValue(new Promise(resolve => { complete = resolve; }));
      const refresh = component.updateAllTargetsStatusInPolling();
      if (changedContext === 'client') component.selectedUser = { _id: 'client-2' };
      if (changedContext === 'list') component.targetsLoadRequestId++;
      if (changedContext === 'destroyed') component.destroyed = true;
      complete([{ _id: 'device-1', expiration_date: renewedExpiration }]);
      await refresh;
      expect(component.targets[0].expiration_date).toBe(oldExpiration);
      expect(component.targetsList[0].expiration_date).toBe(oldExpiration);
      expect(component.targetToEdit.expiration_date).toBe(oldExpiration);
      expect(component.targetFormRef.applyRenewalStatus).not.toHaveBeenCalled();
    });
  }

  it('refreshes immediately on returning and combines overlapping focus and timer polls', fakeAsync(() => {
    spyOnProperty(document, 'visibilityState', 'get').and.returnValue('visible');
    let complete!: (statuses: any[]) => void;
    component.targetsService.getTargetStatuses.and.returnValue(new Promise(resolve => { complete = resolve; }));

    component.refreshTargetsOnResume();
    component.refreshTargetsOnResume();
    void component.updateSelectedTargetData();
    expect(component.targetsService.getTargetStatuses).toHaveBeenCalledTimes(1);
    complete([{ _id: 'device-1', expiration_date: renewedExpiration }]);
    flushMicrotasks();
    expect(component.targetsList[0].expiration_date).toBe(renewedExpiration);
    expect(component.pollingInProgress).toBeFalse();
    tick(50);
  }));

  it('does not request statuses on a hidden or destroyed view', () => {
    const visibility = spyOnProperty(document, 'visibilityState', 'get').and.returnValue('hidden');
    component.refreshTargetsOnResume();
    visibility.and.returnValue('visible');
    component.destroyed = true;
    component.refreshTargetsOnResume();
    expect(component.targetsService.getTargetStatuses).not.toHaveBeenCalled();
  });

  it('keeps periodic refresh available after a failed request', fakeAsync(() => {
    spyOn(console, 'error');
    component.targetsService.getTargetStatuses.and.rejectWith(new Error('Temporary failure'));
    void component.updateSelectedTargetData();
    flushMicrotasks();
    expect(component.pollingInProgress).toBeFalse();
    component.targetsService.getTargetStatuses.and.resolveTo([{ _id: 'device-1', expiration_date: renewedExpiration }]);
    void component.updateSelectedTargetData();
    flushMicrotasks();
    expect(component.targetsService.getTargetStatuses).toHaveBeenCalledTimes(2);
    expect(component.targets[0].expiration_date).toBe(renewedExpiration);
    tick(50);
  }));
});
