export type ConversationMessageDirection = 'me' | 'incoming' | 'system';

export function resolveConversationMessageTranslationLanguage(
  customerLanguage: unknown,
  direction: ConversationMessageDirection,
  supportLanguage = 'es',
): string {
  const normalizedCustomerLanguage = String(customerLanguage || '').trim().toLowerCase();
  if (!normalizedCustomerLanguage || direction === 'system') return '';

  return direction === 'incoming'
    ? String(supportLanguage || 'es').trim().toLowerCase()
    : normalizedCustomerLanguage;
}
