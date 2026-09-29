import { Subject } from 'rxjs';
import { IncosisClientBillingProfile } from 'src/app/core/services/targets.service';
import { TargetFormComponent } from './target-form.component';

describe('TargetFormComponent renewal method', () => {
  const deviceId = '507f1f77bcf86cd799439042';
  const profile: IncosisClientBillingProfile = {
    ownerId: 'client-1', ownerName: 'Cliente', found: true, active: true,
    commercialType: 'regular', isConsignment: false, gpsRenewalMethod: 'cash',
  };

  function buildComponent() {
    const component = Object.create(TargetFormComponent.prototype) as TargetFormComponent;
    const targetsService = {
      getIncosisBillingProfile: jasmine.createSpy('getIncosisBillingProfile').and.resolveTo(profile),
      createProcess: jasmine.createSpy('createProcess').and.resolveTo({ _id: 'process-1' }),
      updateTarget: jasmine.createSpy('updateTarget').and.resolveTo({}),
    };
    const messageService = { add: jasmine.createSpy('add') };
    Object.assign(component as any, {
      target: { _id: deviceId, name: 'GPS', device_imei: '123', expiration_date: '2026-09-29' },
      processForm: { type: 'cash_renewal', registrationDate: '2026-09-29', newRenewalDate: '2027-09-29', renewalYears: 1, description: '' },
      processTypeMap: { renewal: 4, cash_renewal: 20 },
      incosisProfileRequestId: 0, gpsRenewalMethod: null, incosisClientProfileError: '', isCheckingIncosisClientProfile: false,
      targetsService, messageService, cdr: { detectChanges: jasmine.createSpy('detectChanges') },
      authService: { getCurrentUser: () => ({ id: 'staff-1', name: 'Oficina', email: 'office@example.com' }) },
      targetCreated: { emit: jasmine.createSpy('emit') }, loadProcessesList: jasmine.createSpy('loadProcessesList'),
      clearVehicleRegistrationAudio: jasmine.createSpy('clearVehicleRegistrationAudio'),
      stopSmsPolling: jasmine.createSpy('stopSmsPolling'), clearPendingInstallationEvidence: jasmine.createSpy('clearPendingInstallationEvidence'),
      destroy$: new Subject<void>(),
    });
    return { component, targetsService, messageService };
  }

  async function load(component: TargetFormComponent) { await (component as any).loadIncosisClientProfile(); }

  it('uses the explicit cash method even when the client is not on consignment', async () => {
    const { component, targetsService } = buildComponent();
    await load(component);
    expect(targetsService.getIncosisBillingProfile).toHaveBeenCalledOnceWith(deviceId);
    expect(component.canUseRenewalProcessType('cash_renewal')).toBeTrue();
    expect(component.canUseRenewalProcessType('renewal')).toBeFalse();
  });

  it('uses the explicit credit method even when the client is on consignment', async () => {
    const { component, targetsService } = buildComponent();
    targetsService.getIncosisBillingProfile.and.resolveTo({ ...profile, gpsRenewalMethod: 'credit', isConsignment: true, commercialType: 'consignment' });
    await load(component);
    expect(component.canUseRenewalProcessType('renewal')).toBeTrue();
    expect(component.canUseRenewalProcessType('cash_renewal')).toBeFalse();
  });

  it('does not infer a missing or invalid method from commercial type or consignment', async () => {
    const { component, targetsService } = buildComponent();
    for (const method of [undefined, null, 'other']) {
      targetsService.getIncosisBillingProfile.and.resolveTo({ ...profile, isConsignment: true, commercialType: 'consignment', gpsRenewalMethod: method });
      await load(component);
      expect(component.gpsRenewalMethod).toBeNull();
      expect(component.incosisClientProfileError).toContain('método de renovación');
      expect(component.canUseRenewalProcessType('renewal')).toBeFalse();
      expect(component.canUseRenewalProcessType('cash_renewal')).toBeFalse();
    }
  });

  it('rejects missing and inactive client profiles despite an explicit method', async () => {
    const { component, targetsService } = buildComponent();
    for (const extra of [{ found: false }, { active: false }]) {
      targetsService.getIncosisBillingProfile.and.resolveTo({ ...profile, ...extra });
      await load(component);
      expect(component.gpsRenewalMethod).toBeNull();
      expect(component.incosisClientProfileError).toBeTruthy();
    }
  });

  it('blocks both actions while loading and lets the user retry an integration failure', async () => {
    const { component, targetsService } = buildComponent();
    let fail!: (error: unknown) => void;
    targetsService.getIncosisBillingProfile.and.returnValue(new Promise((_resolve, reject) => fail = reject));
    const pending = load(component);
    expect(component.isCheckingIncosisClientProfile).toBeTrue();
    expect(component.canUseRenewalProcessType('cash_renewal')).toBeFalse();
    component.retryIncosisClientProfile(); expect(targetsService.getIncosisBillingProfile).toHaveBeenCalledTimes(1);
    fail(new Error('Unavailable')); await pending;
    expect(component.gpsRenewalMethod).toBeNull();
    expect(component.incosisClientProfileError).toContain('Intenta nuevamente');
    targetsService.getIncosisBillingProfile.and.resolveTo(profile);
    component.retryIncosisClientProfile(); await Promise.resolve();
    expect(component.gpsRenewalMethod).toBe('cash'); expect(component.incosisClientProfileError).toBe('');
  });

  it('ignores profile responses for an old target and after the form is destroyed', async () => {
    const { component, targetsService } = buildComponent();
    let resolve!: (value: IncosisClientBillingProfile) => void;
    targetsService.getIncosisBillingProfile.and.returnValue(new Promise(done => resolve = done));
    const first = load(component);
    component.target._id = '507f1f77bcf86cd799439043';
    targetsService.getIncosisBillingProfile.and.resolveTo({ ...profile, gpsRenewalMethod: 'credit' });
    await load(component); resolve(profile); await first;
    expect(component.gpsRenewalMethod).toBe('credit');
    targetsService.getIncosisBillingProfile.and.returnValue(new Promise(done => resolve = done));
    const late = load(component); component.ngOnDestroy(); resolve(profile); await late;
    expect(component.gpsRenewalMethod).toBeNull();
  });

  it('guards process creation and device updates for the wrong or unknown renewal method', async () => {
    const { component, targetsService, messageService } = buildComponent();
    for (const [method, type] of [[null, 'renewal'], ['cash', 'renewal'], ['credit', 'cash_renewal']] as const) {
      component.gpsRenewalMethod = method; component.processForm.type = type;
      await component.onSubmitProcess();
      expect(targetsService.createProcess).not.toHaveBeenCalled();
      expect(targetsService.updateTarget).not.toHaveBeenCalled();
    }
    expect(messageService.add).toHaveBeenCalled();
    expect(component.target.expiration_date).toBe('2026-09-29');
  });

  it('registers cash pre-renewal without updating the current expiration', async () => {
    const { component, targetsService } = buildComponent();
    component.gpsRenewalMethod = 'cash';
    await component.onSubmitProcess();
    expect(targetsService.createProcess).toHaveBeenCalledOnceWith(jasmine.objectContaining({ type: 20, after: jasmine.objectContaining({ status: 'pending_invoice', processType: 'pre_renewal' }) }));
    expect(targetsService.updateTarget).not.toHaveBeenCalled();
    expect(component.target.expiration_date).toBe('2026-09-29');
    expect(component.target.pending_renewal_process_id).toBe('process-1');
  });

  it('updates credit expiration only after the process was successfully registered', async () => {
    const { component, targetsService } = buildComponent();
    component.gpsRenewalMethod = 'credit'; component.processForm.type = 'renewal';
    let done!: (value: unknown) => void;
    targetsService.createProcess.and.returnValue(new Promise(resolve => done = resolve));
    const pending = component.onSubmitProcess();
    expect(targetsService.updateTarget).not.toHaveBeenCalled();
    expect(component.target.expiration_date).toBe('2026-09-29');
    done({ _id: 'process-1' }); await pending;
    expect(targetsService.createProcess).toHaveBeenCalledOnceWith(jasmine.objectContaining({ type: 4 }));
    expect(targetsService.updateTarget).toHaveBeenCalledOnceWith(deviceId, jasmine.objectContaining({ expiration_date: jasmine.any(Date) }));
    expect(component.target.expiration_date).toBe('2027-09-29');
  });

  it('does not update credit expiration when the backend rejects process creation', async () => {
    const { component, targetsService } = buildComponent();
    component.gpsRenewalMethod = 'credit'; component.processForm.type = 'renewal';
    targetsService.createProcess.and.rejectWith(new Error('El método cambió')); spyOn(console, 'error');
    await component.onSubmitProcess();
    expect(targetsService.updateTarget).not.toHaveBeenCalled();
    expect(component.target.expiration_date).toBe('2026-09-29');
  });
});
