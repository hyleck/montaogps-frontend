import { AuthService } from './auth.service';

describe('AuthService saved session validation', () => {
  let previous: string | null;
  const create = () => new AuthService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
  const token = (payload: object) => `${btoa('{"alg":"HS256"}')}.${btoa(JSON.stringify(payload))}.signature`;
  beforeEach(() => previous = localStorage.getItem('authtoken'));
  afterEach(() => previous === null ? localStorage.removeItem('authtoken') : localStorage.setItem('authtoken', previous));

  it('initializes safely with a malformed saved token so public links can open', () => {
    localStorage.setItem('authtoken', 'stale-gps-session');
    expect(() => create()).not.toThrow();
    expect(create().isAuthenticated()).toBeFalse();
  });

  it('rejects expired and missing expiration tokens while accepting an unexpired session', () => {
    for (const payload of [{ exp: 1 }, {}, { exp: '99999999999' }]) {
      localStorage.setItem('authtoken', token(payload));
      expect(create().isAuthenticated()).toBeFalse();
    }
    localStorage.setItem('authtoken', token({ exp: Date.now() / 1000 + 3600 }));
    expect(create().isAuthenticated()).toBeTrue();
  });
});
