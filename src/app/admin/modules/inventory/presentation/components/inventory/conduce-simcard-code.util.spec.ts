import {
  formatConduceSimcardCode,
  isNationalSimCompany,
} from './conduce-simcard-code.util';

describe('Conduce SIM card code', () => {
  it('adds one decoy before every two real digits for national SIM cards', () => {
    const code = formatConduceSimcardCode(
      '849-279-1071',
      'nacionales',
    );

    expect(code).toBe('884 292 079 410 471');
    expect(
      code
        .split(' ')
        .map(group => group.slice(1))
        .join(''),
    ).toBe('8492791071');
  });

  it('keeps non-national SIM cards unchanged', () => {
    expect(
      formatConduceSimcardCode(
        '894450010000000001',
        'emnify',
      ),
    ).toBe('894450010000000001');
  });

  it('recognizes the national company without depending on casing', () => {
    expect(isNationalSimCompany('NACIONALES')).toBeTrue();
    expect(isNationalSimCompany('Nacional')).toBeTrue();
    expect(isNationalSimCompany('GigSky')).toBeFalse();
  });
});
