import { Router } from '@angular/router';
import { AuthService } from '@app/core/services/auth.service';
import { UserService } from '@app/core/services/user.service';
import { StatusService } from '@app/shareds/services/status.service';
import { ManagementService } from './management.service';

describe('ManagementService', () => {
  it('clears the active search when navigation enters another account', () => {
    const router = jasmine.createSpyObj<Router>('Router', [
      'navigate',
      'parseUrl',
    ]);
    router.navigate.and.returnValue(Promise.resolve(true));
    router.parseUrl.and.returnValue({ queryParams: {} } as any);
    const userService = jasmine.createSpyObj<UserService>('UserService', [
      'getById',
    ]);
    const status = jasmine.createSpyObj<StatusService>('StatusService', [
      'setState',
      'getState',
      'removeState',
    ]);
    const auth = jasmine.createSpyObj<AuthService>('AuthService', [
      'getCurrentUser',
    ]);
    auth.getCurrentUser.and.returnValue({
      id: '507f1f77bcf86cd799439010',
    } as any);
    const service = new ManagementService(
      router,
      userService,
      status,
      auth,
    );

    service.setOp('u', '507f1f77bcf86cd799439011');
    service.setSearchUsersTerm('8293880992');
    service.setOp('u', '507f1f77bcf86cd799439012');

    const navigationOptions = router.navigate.calls.mostRecent().args[1] as any;
    expect(navigationOptions.queryParams).toEqual({});
  });
});
