import { TargetFormComponent } from './target-form.component';

describe('TargetFormComponent installation dates', () => {
  const deviceId = '507f1f77bcf86cd799439042';

  function buildComponent() {
    const component = Object.create(TargetFormComponent.prototype) as TargetFormComponent;
    const targetsService = {
      registerOfficeInstallation: jasmine.createSpy('registerOfficeInstallation').and.resolveTo({
        device: { _id: deviceId, activation_date: '2026-08-26T00:00:00.000Z' },
        process: { registrationDate: '2026-08-26T00:00:00.000Z' },
      }),
    };
    Object.assign(component, {
      target: {
        _id: deviceId,
        activation_date: '2026-08-28',
        installation_date: '2026-08-28',
        expiration_date: '2027-08-28',
      },
      currentUserAffiliationTypeId: 'empleado',
      processList: [],
      isRegisteringInstallation: false,
      pendingInstallationEvidence: {},
      installationRegistrationForm: {
        installationDate: '2026-08-26',
        mechanicId: 'technician-id',
        installationLocation: '',
        installationDetails: '',
        engineShutdown: 'No',
        ignitionSensor: 'No',
      },
      targetsService,
      messageService: { add: jasmine.createSpy('add') },
      targetUpdatedWithoutClose: { emit: jasmine.createSpy('emit') },
      loadProcessesList: jasmine.createSpy('loadProcessesList').and.resolveTo(undefined),
      clearPendingInstallationEvidence: jasmine.createSpy('clearPendingInstallationEvidence'),
      resetInstallationChassisScan: jasmine.createSpy('resetInstallationChassisScan'),
      isInstallationChassisVerified: jasmine.createSpy('isInstallationChassisVerified').and.returnValue(false),
    });
    return { component, targetsService };
  }

  it('sends the chosen date and refreshes both installation fields after saving', async () => {
    const { component, targetsService } = buildComponent();

    await component.registerInstallationProcess();

    expect(targetsService.registerOfficeInstallation).toHaveBeenCalledOnceWith(
      deviceId, jasmine.objectContaining({ installationDate: '2026-08-26' }),
    );
    expect(component.target.activation_date).toBe('2026-08-26');
    expect(component.target.installation_date).toBe('2026-08-26');
    expect(component.target.expiration_date).toBe('2027-08-28');
    expect(component.targetUpdatedWithoutClose.emit).toHaveBeenCalledWith(
      jasmine.objectContaining({ activation_date: '2026-08-26', installation_date: '2026-08-26' }),
    );
    expect(component.isRegisteringInstallation).toBeFalse();
  });

  it('uses the persisted date rather than a stale installation alias from the response', async () => {
    const { component, targetsService } = buildComponent();
    targetsService.registerOfficeInstallation.and.resolveTo({
      device: { activation_date: '2026-08-25T00:00:00.000Z', installation_date: '2026-08-28' },
    });

    await component.registerInstallationProcess();

    expect(component.target.activation_date).toBe('2026-08-25');
    expect(component.target.installation_date).toBe('2026-08-25');
  });

  it('uses the saved process date if a legacy response omits the device date', async () => {
    const { component, targetsService } = buildComponent();
    targetsService.registerOfficeInstallation.and.resolveTo({
      process: { registrationDate: '2026-08-26T00:00:00.000Z' },
    });

    await component.registerInstallationProcess();

    expect(component.target.installation_date).toBe('2026-08-26');
    expect(component.target.activation_date).toBe('2026-08-26');
  });

  it('does not change the dates or emit a successful update when registration fails', async () => {
    const { component, targetsService } = buildComponent();
    targetsService.registerOfficeInstallation.and.rejectWith(new Error('Registration failed'));
    spyOn(console, 'error');

    await component.registerInstallationProcess();

    expect(component.target.activation_date).toBe('2026-08-28');
    expect(component.target.installation_date).toBe('2026-08-28');
    expect(component.targetUpdatedWithoutClose.emit).not.toHaveBeenCalled();
    expect(component.isRegisteringInstallation).toBeFalse();
  });

  it('shows the selected day in the Management history without a timezone shift', () => {
    const { component } = buildComponent();
    expect(component.formatDate('2026-08-26T00:00:00.000Z')).toBe('26/08/2026');
  });
});
