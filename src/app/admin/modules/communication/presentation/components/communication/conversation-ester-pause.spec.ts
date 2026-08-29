import { resolveEsterPauseState } from './conversation-ester-pause';

describe('resolveEsterPauseState', () => {
  it('shows the stored reason while an Ester conversation waits for authorization', () => {
    expect(resolveEsterPauseState({
      assignee_id: null,
      ai_handoff_requested: true,
      ai_handoff_reason: '  El cliente solicitó un cambio de GPS. ',
    }, true)).toEqual({
      paused: true,
      reason:
        'Esperando autorización del departamento para responder: El cliente solicitó un cambio de GPS.',
    });
  });

  it('shows when Ester is globally disabled', () => {
    expect(resolveEsterPauseState({ assignee_id: null }, false)).toEqual({
      paused: true,
      reason: 'La respuesta automática de Ester está desactivada.',
    });
  });

  it('does not mark employee assignments or active Ester chats as paused', () => {
    expect(resolveEsterPauseState({ assignee_id: 'employee-1' }, false))
      .toBeNull();
    expect(resolveEsterPauseState({ assignee_id: null }, true)).toBeNull();
  });
});
