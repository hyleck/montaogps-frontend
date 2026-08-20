import { TargetFormComponent } from './target-form.component';

describe('TargetFormComponent office review flow', () => {
  const buildComponent = () => {
    const component = Object.create(
      TargetFormComponent.prototype,
    ) as TargetFormComponent;
    const targetsService = {
      registerOfficeReview: jasmine.createSpy('registerOfficeReview')
        .and.resolveTo({}),
      registerOfficeVehicleChange: jasmine.createSpy('registerOfficeVehicleChange')
        .and.resolveTo({
          device: {
            _id: '507f1f77bcf86cd799439042',
            name: 'Vehículo nuevo',
            device_imei: '868000000000042',
            target_plate_number: 'NEW456',
          },
          process: { type: 21 },
        }),
    };
    const messageService = {
      add: jasmine.createSpy('add'),
    };

    Object.assign(component as any, {
      target: {
        _id: '507f1f77bcf86cd799439042',
        name: 'GPS de prueba',
        device_imei: '868000000000042',
        target_brand_id: 'brand-old',
        target_model_id: 'model-old',
        target_year: '2020',
        target_color: '#ffffff',
        target_plate_number: 'OLD123',
        target_chassis_number: 'OLD-CHASSIS',
      },
      selectedProtocol: { name: 'GPS', isAirtag: false },
      currentUserAffiliationTypeId: 'empleado',
      currentUserIsRoot: false,
      currentUserIsDeveloper: false,
      processList: [],
      isUpdatingOfficeReview: false,
      displayOfficeReviewDialog: false,
      officeReviewReason: '',
      officeReviewReasonTouched: false,
      displayVehicleChangeDialog: false,
      isRegisteringVehicleChange: false,
      vehicleChangeFormTouched: false,
      vehicleChangeModels: [],
      vehicleChangeForm: {
        targetName: '',
        targetBrandId: '',
        targetModelId: '',
        targetYear: '',
        targetColor: '',
        targetPlateNumber: '',
        targetChassisNumber: '',
        details: '',
      },
      targetsService,
      messageService,
      targetUpdatedWithoutClose: { emit: jasmine.createSpy('emit') },
      loadProcessesList: jasmine.createSpy('loadProcessesList')
        .and.resolveTo(undefined),
    });

    return { component, targetsService, messageService };
  };

  it('allows opening the review dialog even when the GPS is online', () => {
    const { component } = buildComponent();
    spyOn(component as any, 'getNormalizedDeviceStatus')
      .and.returnValue('online');

    expect(component.canStartOfficeReviewProcess()).toBeTrue();
    component.openOfficeReviewDialog();

    expect(component.displayOfficeReviewDialog).toBeTrue();
    expect(component.isOfficeReviewDeviceOnline()).toBeTrue();
    expect(component.getOfficeReviewDeviceStatusLabel()).toBe('En línea');
  });

  it('keeps office review available for an already installed GPS', () => {
    const { component } = buildComponent();
    component.target.mechanic_id = '507f1f77bcf86cd799439099';
    component.processList = [{
      type: 1,
      target: { mechanic_id: '507f1f77bcf86cd799439099' },
    }] as any;

    expect(component.hasActiveInstallationAuthorization()).toBeTrue();
    expect(component.shouldShowInstallationRegistration()).toBeFalse();
    expect(component.canShowOfficeReviewAction()).toBeTrue();
  });

  it('keeps office review available when the target has additional installations', () => {
    const { component } = buildComponent();
    component.target.instalaciones_adicionales = [
      { device_imei: '868000000000043' },
    ] as any;

    expect(component.getAdditionalInstallations().length).toBe(1);
    expect(component.canShowOfficeReviewAction()).toBeTrue();
  });

  it('does not create a review without a description', async () => {
    const { component, targetsService } = buildComponent();
    component.officeReviewReason = '   ';

    await component.registerOfficeReviewProcess();

    expect(component.officeReviewReasonTouched).toBeTrue();
    expect(targetsService.registerOfficeReview).not.toHaveBeenCalled();
  });

  it('sends the trimmed description when starting the review', async () => {
    const { component, targetsService, messageService } = buildComponent();
    component.displayOfficeReviewDialog = true;
    component.officeReviewReason = '  Ubicación diferente a la real.  ';

    await component.registerOfficeReviewProcess();

    expect(targetsService.registerOfficeReview).toHaveBeenCalledOnceWith(
      '507f1f77bcf86cd799439042',
      'Ubicación diferente a la real.',
    );
    expect(component.displayOfficeReviewDialog).toBeFalse();
    expect(messageService.add).toHaveBeenCalledWith(
      jasmine.objectContaining({ severity: 'success' }),
    );
  });

  it('registers a vehicle change as a dedicated office process', async () => {
    const { component, targetsService, messageService } = buildComponent();
    spyOn(component as any, 'syncVehicleCatalogDisplayAfterVerification')
      .and.resolveTo(undefined);
    component.vehicleChangeForm = {
      targetName: 'Vehículo nuevo',
      targetBrandId: 'brand-new',
      targetModelId: 'model-new',
      targetYear: '2024',
      targetColor: '#000000',
      targetPlateNumber: 'NEW456',
      targetChassisNumber: 'NEW-CHASSIS',
      details: 'Cambio registrado desde Management.',
    };

    await component.registerOfficeVehicleChange();

    expect(targetsService.registerOfficeVehicleChange).toHaveBeenCalledOnceWith(
      '507f1f77bcf86cd799439042',
      jasmine.objectContaining({
        targetName: 'Vehículo nuevo',
        targetPlateNumber: 'NEW456',
      }),
    );
    expect(component.target.name).toBe('Vehículo nuevo');
    expect(component.target.target_plate_number).toBe('NEW456');
    expect(messageService.add).toHaveBeenCalledWith(
      jasmine.objectContaining({ severity: 'success' }),
    );
  });
});
