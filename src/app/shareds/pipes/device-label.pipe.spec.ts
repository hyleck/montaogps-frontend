import { DeviceLabelPipe, formatDeviceLabel } from './device-label.pipe';

describe('DeviceLabelPipe', () => {
  const pipe = new DeviceLabelPipe();

  it('shows MLock for the protocol and for every occurrence within a label', () => {
    expect(pipe.transform('MTAG-A')).toBe('MLock');
    expect(pipe.transform('MTAG-A Toyota · MTAG-A adicional')).toBe('MLock Toyota · MLock adicional');
  });

  it('handles capitalization without changing other protocols or the rest of the label', () => {
    expect(pipe.transform('mtag-a Toyota, MTAG-P y GPS')).toBe('MLock Toyota, MTAG-P y GPS');
    expect(pipe.transform('Mtag-A')).toBe('MLock');
    expect(pipe.transform('MLock')).toBe('MLock');
  });

  it('handles empty values and does not mutate canonical data', () => {
    const protocol = { name: 'MTAG-A', value: 'mtag_a' };
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform('')).toBe('');
    expect(pipe.transform(protocol.name)).toBe('MLock');
    expect(protocol).toEqual({ name: 'MTAG-A', value: 'mtag_a' });
  });

  it('shares the same formatter with non-Angular renderers such as map popups', () => {
    expect(formatDeviceLabel('MTAG-A Toyota')).toBe(pipe.transform('MTAG-A Toyota'));
  });
});
