import { formatUserName } from 'src/app/core/utils/user-name.util';
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
  return formatUserName(String(value || '').trim().replace(/\s+/g, ' '));
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
