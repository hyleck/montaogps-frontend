export interface TeamFilterableConversation {
  assignee_id?: string | null;
  shared_employee_conversation?: boolean;
  shared_team_conversation?: boolean;
  team_chat_name?: string | null;
  contact?: {
    name?: string | null;
    affiliation_type_id?: string | null;
    status?: boolean | null;
  } | null;
}

export function canParticipateInConversation(
  conversation: TeamFilterableConversation | null | undefined,
  participantIds: Array<string | null | undefined> = [],
): boolean {
  if (!conversation) return false;
  if (isEmployeeConversation(conversation)) return true;

  const assigneeId = String(conversation.assignee_id || '').trim();
  if (!assigneeId) return false;
  return participantIds
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .includes(assigneeId);
}

const EMPLOYEE_AFFILIATIONS = new Set([
  'empleado',
  'tecnico',
  'tecnico_empleado',
  'tecnico_independiente',
]);

export function isEmployeeConversation(
  conversation: TeamFilterableConversation | null | undefined,
): boolean {
  if (conversation?.contact?.status === false) return false;
  if (
    conversation?.shared_employee_conversation === true
    || conversation?.shared_team_conversation === true
  ) return true;
  const affiliation = String(
    conversation?.contact?.affiliation_type_id || '',
  ).trim().toLowerCase();
  return EMPLOYEE_AFFILIATIONS.has(affiliation);
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
