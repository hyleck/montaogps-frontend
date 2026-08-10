import {
  buildAgentSignatureLabel,
  compactAgentSignatureLabel,
  parseAgentSignedMessage,
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

  it('separates a signed message that starts with the greater-than symbol', () => {
    expect(parseAgentSignedMessage('> Frankely Garcia Diaz - Soporte\nYes'))
      .toEqual({
        signature: 'Frankely - Soporte',
        body: 'Yes',
        signed: true,
      });
  });

  it('keeps an unsigned message intact', () => {
    expect(parseAgentSignedMessage('How much does it cost?'))
      .toEqual({
        signature: '',
        body: 'How much does it cost?',
        signed: false,
      });
  });
});
