import { of, Subject } from 'rxjs';
import { IndexAppMenuComponent } from './index-app-menu.component';

describe('IndexAppMenuComponent', () => {
  let component: IndexAppMenuComponent;
  let auth: any;
  let frame: any;
  beforeEach(() => {
    auth = { getCurrentUser: jasmine.createSpy().and.returnValue({ id: 'gps-user' }), createIndexBrowserSession: jasmine.createSpy().and.returnValue(of({ code: 'one-use-code' })) };
    component = new IndexAppMenuComponent(auth);
    frame = { postMessage: jasmine.createSpy() };
    component.frame = { nativeElement: { contentWindow: frame } } as any;
  });
  function message(overrides = {}) {
    return { origin: 'https://index.montao.net', source: frame, data: { type: 'MONTAO_INDEX_GPS_SESSION_REQUEST', requestId: 'request-1' }, ...overrides } as MessageEvent;
  }
  it('sends a one-use code only to the trusted Index frame', () => {
    component.onMessage(message());
    expect(auth.createIndexBrowserSession).toHaveBeenCalledTimes(1);
    expect(frame.postMessage).toHaveBeenCalledWith({ type: 'MONTAO_INDEX_GPS_SESSION', requestId: 'request-1', code: 'one-use-code' }, 'https://index.montao.net');
    expect(JSON.stringify(frame.postMessage.calls.allArgs())).not.toContain('gps-token');
  });
  it('ignores spoofed origins and messages from other windows', () => {
    component.onMessage(message({ origin: 'https://evil.example' }));
    component.onMessage(message({ source: {} }));
    expect(auth.createIndexBrowserSession).not.toHaveBeenCalled();
  });
  it('does not deliver a session after the GPS account changes', () => {
    const result = new Subject<{ code: string }>(); auth.createIndexBrowserSession.and.returnValue(result);
    component.onMessage(message());
    auth.getCurrentUser.and.returnValue({ id: 'another-gps-user' });
    result.next({ code: 'code' });
    expect(frame.postMessage).not.toHaveBeenCalled();
    component.ngOnDestroy();
  });
  it('cancels the pending request when the menu closes', () => {
    const result = new Subject<{ code: string }>(); auth.createIndexBrowserSession.and.returnValue(result);
    component.onMessage(message()); component.ngOnDestroy(); result.next({ code: 'code' });
    expect(frame.postMessage).not.toHaveBeenCalled();
  });
});
