import { ManagementComponent } from './management.component';

describe('Management target search refresh', () => {
  it('reloads the active search instead of the complete target list', async () => {
    const component: any = Object.create(ManagementComponent.prototype);
    const searchResponse = {
      devices: [{ _id: 'target-1', name: 'GPS encontrado' }],
      totalCount: 1,
    };

    component.targetsLoadRequestId = 0;
    component.selectedUser = { _id: 'user-1', email: 'cliente@montao.net' };
    component.searchTargetsTerm = ' 862667088345023 ';
    component.currentOffset = 0;
    component.initialPageSize = 60;
    component.pageSize = 30;
    component.hasMoreTargets = true;
    component.targets = [];
    component.targetsListValue = [];
    component.filterStatus = 'all';
    component.filterTag = null;
    component.filterSimCompany = null;
    component.pendingInitialSearchTerm = '';
    component.initialSearchExecuted = true;
    component.targetIdFromUrl = null;
    component.pollingInterval = null;

    component.targetsService = {
      searchTargets: jasmine.createSpy('searchTargets').and.resolveTo(searchResponse),
      getTargetsByUserId: jasmine.createSpy('getTargetsByUserId'),
      getSharedTargets: jasmine.createSpy('getSharedTargets'),
    };
    component.managementService = { getCurrentUserId: () => 'parent-1' };
    component.messageService = { add: jasmine.createSpy('add') };
    component.translate = { instant: (key: string) => key };
    component.uiService = {
      autoShowMapsIfMobileAndHasTargets: jasmine.createSpy(
        'autoShowMapsIfMobileAndHasTargets',
      ),
    };

    component.canReadDevices = () => true;
    component.buildLinkedTargetCardRows = (targets: any[]) => targets;
    component.buildTargetsView = (targets: any[]) => targets;
    component.populateDeviceImagesFromCache = () => undefined;
    component.initializePreviousTargetsStatus = () => undefined;
    component.startPolling = () => undefined;
    component.tryOpenInventoryAssignedTarget = () => undefined;

    await component.loadTargetsForUser('user-1');

    expect(component.targetsService.searchTargets).toHaveBeenCalledOnceWith(
      '862667088345023',
      'parent-1',
      0,
      60,
      'all',
      undefined,
      undefined,
    );
    expect(component.targetsService.getTargetsByUserId).not.toHaveBeenCalled();
    expect(component.targetsService.getSharedTargets).not.toHaveBeenCalled();
    expect(component.targetsList).toEqual(searchResponse.devices);
    expect(component.isSearchingTargets).toBeTrue();
  });
});
