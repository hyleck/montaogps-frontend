export interface EsterPauseConversation {
  assignee_id?: string | null;
  ai_handoff_requested?: boolean;
  ai_handoff_reason?: string;
}

export interface EsterPauseState {
  paused: true;
  reason: string;
}

export function resolveEsterPauseState(
  conversation: EsterPauseConversation | null | undefined,
  autoReplyActive: boolean | null,
): EsterPauseState | null {
  if (!conversation || String(conversation.assignee_id || '').trim()) {
    return null;
  }

  if (conversation.ai_handoff_requested) {
    const detail = String(conversation.ai_handoff_reason || '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[.!?]+$/, '');
    return {
      paused: true,
      reason: detail
        ? `Esperando autorización del departamento para responder: ${detail}.`
        : 'Esperando autorización de un empleado para responderle al cliente.',
    };
  }

  if (autoReplyActive === false) {
    return {
      paused: true,
      reason: 'La respuesta automática de Ester está desactivada.',
    };
  }

  return null;
}
