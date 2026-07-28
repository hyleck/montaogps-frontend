import {
  buildAgentSignatureLabel,
  compactAgentSignatureLabel,
} from './agent-signature';

describe('agent signature', () => {
  it('uses only the first name and keeps the department', () => {
    expect(buildAgentSignatureLabel('Pedro Antonio Pérez', 'Soporte'))
      .toBe('Pedro - Soporte');
  });

  it('compacts previously stored full-name signatures', () => {
    expect(compactAgentSignatureLabel('Pedro Antonio Pérez - Soporte'))
      .toBe('Pedro - Soporte');
  });

  it('preserves Ester Assistant as a system identity', () => {
    expect(compactAgentSignatureLabel('Ester Assistant'))
      .toBe('Ester Assistant');
  });
});
