import { of } from 'rxjs';
import { AppUpdateService, AppVersionManifest } from './app-update.service';

describe('AppUpdateService', () => {
  function createHarness(manifest: AppVersionManifest) {
    const replace = jasmine.createSpy('replace');
    const documentMock = {
      baseURI: 'https://appgps.montao.net/admin/dashboard',
      visibilityState: 'visible',
      defaultView: {
        location: {
          href: 'https://appgps.montao.net/admin/dashboard',
          replace,
        },
      },
      querySelectorAll: jasmine.createSpy('querySelectorAll').and.returnValue([
        {
          tagName: 'SCRIPT',
          src: 'https://appgps.montao.net/main-current.js',
        },
        {
          tagName: 'LINK',
          href: 'https://appgps.montao.net/styles-current.css',
        },
      ]),
      addEventListener: jasmine.createSpy('addEventListener'),
      removeEventListener: jasmine.createSpy('removeEventListener'),
    };
    const http = {
      get: jasmine.createSpy('get').and.returnValue(of(manifest)),
    };
    const service = new AppUpdateService(
      http as any,
      documentMock as any,
      'browser' as any,
    );
    return { service, http, replace };
  }

  it('does not announce an update when the loaded assets are current', async () => {
    const { service } = createHarness({
      version: 'current-version',
      assets: ['/styles-current.css', '/main-current.js'],
    });
    const states: boolean[] = [];
    service.updateAvailable$.subscribe(value => states.push(value));

    await service.checkForUpdates();

    expect(states.at(-1)).toBeFalse();
  });

  it('announces and applies a newer compiled frontend', async () => {
    const { service, replace } = createHarness({
      version: 'new-version',
      assets: ['/styles-new.css', '/main-new.js'],
    });
    const states: boolean[] = [];
    service.updateAvailable$.subscribe(value => states.push(value));

    await service.checkForUpdates();
    service.applyUpdate();

    expect(states.at(-1)).toBeTrue();
    expect(replace).toHaveBeenCalledWith(
      'https://appgps.montao.net/admin/dashboard?app-update=new-version',
    );
  });
});
