export interface ConversationOrderCandidate {
  id?: number | null;
  unread_count?: number | null;
  last_message_time?: number | null;
  contact_last_seen_at?: number | null;
}

/**
 * Ordena el inbox por atención pendiente y actividad reciente.
 *
 * Una conversación con cualquier cantidad de mensajes sin leer tiene
 * prioridad sobre una ya leída. Dentro de cada grupo manda la fecha de la
 * última interacción, no la cantidad de mensajes pendientes.
 */
export function orderConversationsByAttention<T extends ConversationOrderCandidate>(
  conversations: T[],
): T[] {
  return [...conversations].sort((left, right) => {
    const unreadPriorityDifference =
      Number(Number(right.unread_count || 0) > 0)
      - Number(Number(left.unread_count || 0) > 0);

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
}
