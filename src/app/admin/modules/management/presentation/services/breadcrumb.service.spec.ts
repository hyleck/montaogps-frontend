import { BreadcrumbService } from './breadcrumb.service';
import { ManagementService } from './management.service';

describe('BreadcrumbService', () => {
  let managementService: jasmine.SpyObj<ManagementService>;
  let service: BreadcrumbService;

  beforeEach(() => {
    managementService = jasmine.createSpyObj<ManagementService>(
      'ManagementService',
      ['setOp'],
    );
    service = new BreadcrumbService(managementService);
  });

  it('navigates to the actual parent from the loaded hierarchy', () => {
    service.updateFromUserPath([
      { id: 'root', fullName: 'Cuenta principal' },
      { id: 'parent', fullName: 'Distribuidor' },
      { id: 'child', fullName: 'Cliente' },
    ]);

    expect(service.canNavigateBack()).toBeTrue();
    service.navigateToParent();
    expect(managementService.setOp).toHaveBeenCalledOnceWith('u', 'parent');
  });

  it('does not show or execute back navigation at the hierarchy root', () => {
    service.updateFromUserPath([
      { id: 'root', fullName: 'Cuenta principal' },
    ]);

    expect(service.canNavigateBack()).toBeFalse();
    service.navigateToParent();
    expect(managementService.setOp).not.toHaveBeenCalled();
  });
});
