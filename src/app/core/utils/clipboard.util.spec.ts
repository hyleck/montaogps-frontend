import { copyText, copyWithSelection } from './clipboard.util';

describe('clipboard util', () => {
  it('uses the Clipboard API when the browser allows it', async () => {
    const write = spyOn(navigator.clipboard, 'writeText').and.resolveTo();
    const exec = spyOn(document, 'execCommand');
    expect(await copyText('https://example.test/a')).toBeTrue();
    expect(write).toHaveBeenCalledWith('https://example.test/a');
    expect(exec).not.toHaveBeenCalled();
  });

  it('falls back to a selection copy when the Clipboard API is refused', async () => {
    spyOn(navigator.clipboard, 'writeText').and.rejectWith(new DOMException('Write permission denied.', 'NotAllowedError'));
    const exec = spyOn(document, 'execCommand').and.returnValue(true);
    expect(await copyText('https://example.test/b')).toBeTrue();
    expect(exec).toHaveBeenCalledWith('copy');
    expect(document.querySelectorAll('textarea[readonly]').length).toBe(0);
  });

  it('reports a failure when no copy method works', () => {
    spyOn(document, 'execCommand').and.throwError('blocked');
    expect(copyWithSelection('x')).toBeFalse();
  });
});
