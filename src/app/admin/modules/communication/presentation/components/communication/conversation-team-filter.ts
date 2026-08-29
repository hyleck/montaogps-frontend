export interface TeamFilterableConversation {
  assignee_id?: string | null;
  contact?: {
    name?: string | null;
  } | null;
}

export function canParticipateInConversation(
  conversation: TeamFilterableConversation | null | undefined,
  participantIds: Array<string | null | undefined> = [],
): boolean {
  if (!conversation) return false;

  const assigneeId = String(conversation.assignee_id || '').trim();
  if (!assigneeId) return false;
  return participantIds
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .includes(assigneeId);
}

export function toTitleCaseName(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es-DO')
    .replace(
      /(^|[\s'-])([a-záéíóúüñ])/g,
      (_match, separator: string, letter: string) => (
        `${separator}${letter.toLocaleUpperCase('es-DO')}`
      ),
    );
}

export function formatConversationDisplayName(
  conversation: TeamFilterableConversation | null | undefined,
): string {
  return formatConversationContactName(conversation);
}

export function formatConversationContactName(
  conversation: TeamFilterableConversation | null | undefined,
): string {
  const rawName = String(
    conversation?.contact?.name || 'Sin nombre',
  ).replace(/^grupo\s+de\s+/i, '');
  return toTitleCaseName(rawName) || 'Sin Nombre';
}
