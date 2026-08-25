export interface ConversationOrderCandidate {
  id?: number | null;
  unread_count?: number | null;
  has_unread?: boolean | null;
  last_message_type?: number | null;
  waiting_for_reply?: boolean | null;
  priority_urgent?: boolean | null;
  reminder_eligible?: boolean | null;
  labels?: string[] | null;
  last_message_time?: number | null;
  contact_last_seen_at?: number | null;
}

export interface ConversationOrderOptions {
  pinnedConversationId?: number | null;
  pinnedIndex?: number | null;
}

/**
 * Ordena el inbox por atención pendiente y actividad reciente.
 *
 * Prioriza urgencia, respuesta humana pendiente, mensajes sin leer y, dentro
 * de cada grupo, la fecha de la última interacción. La cantidad de mensajes
 * pendientes no altera el orden.
 */
export function orderConversationsByAttention<T extends ConversationOrderCandidate>(
  conversations: T[],
  options: ConversationOrderOptions = {},
): T[] {
  const ordered = [...conversations].sort((left, right) => {
    const urgentPriorityDifference =
      Number(isUrgentConversation(right))
      - Number(isUrgentConversation(left));

    if (urgentPriorityDifference !== 0) {
      return urgentPriorityDifference;
    }

    const waitingReplyPriorityDifference =
      Number(isWaitingForReply(right))
      - Number(isWaitingForReply(left));

    if (waitingReplyPriorityDifference !== 0) {
      return waitingReplyPriorityDifference;
    }

    const unreadPriorityDifference =
      Number(hasUnreadMessages(right))
      - Number(hasUnreadMessages(left));

    if (unreadPriorityDifference !== 0) {
      return unreadPriorityDifference;
    }

    const leftActivity = Number(
      left.last_message_time || left.contact_last_seen_at || 0,
    );
    const rightActivity = Number(
      right.last_message_time || right.contact_last_seen_at || 0,
    );
    const activityDifference = rightActivity - leftActivity;

    if (activityDifference !== 0) {
      return activityDifference;
    }

    return Number(right.id || 0) - Number(left.id || 0);
  });

  const pinnedConversationId = Number(options.pinnedConversationId || 0);
  const pinnedIndex = Number(options.pinnedIndex);
  if (!pinnedConversationId || !Number.isInteger(pinnedIndex) || pinnedIndex < 0) {
    return ordered;
  }

  const orderedPinnedIndex = ordered.findIndex(
    conversation => Number(conversation.id || 0) === pinnedConversationId,
  );
  if (orderedPinnedIndex < 0 || orderedPinnedIndex === pinnedIndex) {
    return ordered;
  }

  const [pinnedConversation] = ordered.splice(orderedPinnedIndex, 1);
  ordered.splice(Math.min(pinnedIndex, ordered.length), 0, pinnedConversation);
  return ordered;
}

function isUrgentConversation(
  conversation: ConversationOrderCandidate,
): boolean {
  if (conversation.priority_urgent === true || conversation.reminder_eligible === true) {
    return true;
  }

  return (conversation.labels || []).some(label => (
    /(^|[\s_-])(urgent|urgente|priority|prioridad|prioritario|prioritaria)($|[\s_-])/i
      .test(String(label || ''))
  ));
}

function isWaitingForReply(
  conversation: ConversationOrderCandidate,
): boolean {
  return conversation.waiting_for_reply === true
    || Number(conversation.last_message_type) === 0;
}

function hasUnreadMessages(
  conversation: ConversationOrderCandidate,
): boolean {
  return conversation.has_unread === true
    || Number(conversation.unread_count || 0) > 0;
}
