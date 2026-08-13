import { TargetFormComponent } from './target-form.component';

describe('TargetFormComponent office review flow', () => {
  const buildComponent = () => {
    const component = Object.create(
      TargetFormComponent.prototype,
    ) as TargetFormComponent;
    const targetsService = {
      registerOfficeReview: jasmine.createSpy('registerOfficeReview')
        .and.resolveTo({}),
    };
    const messageService = {
      add: jasmine.createSpy('add'),
    };

    Object.assign(component as any, {
      target: {
        _id: '507f1f77bcf86cd799439042',
        name: 'GPS de prueba',
        device_imei: '868000000000042',
      },
      processList: [],
      isUpdatingOfficeReview: false,
      displayOfficeReviewDialog: false,
      officeReviewReason: '',
      officeReviewReasonTouched: false,
      targetsService,
      messageService,
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
});
