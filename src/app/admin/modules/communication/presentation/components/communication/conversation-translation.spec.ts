import { resolveConversationMessageTranslationLanguage } from './conversation-translation';

describe('conversation translation direction', () => {
  it('translates incoming customer messages to Spanish for support', () => {
    expect(resolveConversationMessageTranslationLanguage('en', 'incoming'))
      .toBe('es');
  });

  it('translates outgoing support messages to the customer language', () => {
    expect(resolveConversationMessageTranslationLanguage('en', 'me'))
      .toBe('en');
  });

  it('does not translate when the conversation language is disabled', () => {
    expect(resolveConversationMessageTranslationLanguage('', 'incoming'))
      .toBe('');
  });

  it('does not translate system messages', () => {
    expect(resolveConversationMessageTranslationLanguage('en', 'system'))
      .toBe('');
  });
});
