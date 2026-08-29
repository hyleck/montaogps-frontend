import {
  canParticipateInConversation,
  formatConversationContactName,
  formatConversationDisplayName,
  toTitleCaseName,
} from './conversation-team-filter';

describe('canParticipateInConversation', () => {
  it('applies the same assignment rules to employee contacts', () => {
    expect(canParticipateInConversation({
      assignee_id: null,
      contact: { name: 'Empleado sin asignar' },
    }, ['current-user'])).toBeFalse();
    expect(canParticipateInConversation({
      assignee_id: 'another-user',
      contact: { name: 'Empleado asignado a otro agente' },
    }, ['current-user'])).toBeFalse();
    expect(canParticipateInConversation({
      assignee_id: 'current-user',
      contact: { name: 'Empleado asignado al agente actual' },
    }, ['current-user'])).toBeTrue();
  });

  it('keeps customer conversations restricted to their assignee', () => {
    const customerConversation = {
      assignee_id: 'assigned-user',
      contact: { name: 'Cliente' },
    };
    expect(canParticipateInConversation(
      customerConversation,
      ['assigned-user'],
    )).toBeTrue();
    expect(canParticipateInConversation(
      customerConversation,
      ['another-user'],
    )).toBeFalse();
    expect(canParticipateInConversation({
      assignee_id: null,
      contact: { name: 'Cliente' },
    }, ['assigned-user'])).toBeFalse();
  });
});

describe('conversation contact display names', () => {
  it('shows employee chats as normal full names in title case', () => {
    expect(formatConversationDisplayName({
      contact: {
        name: 'jUAN de la cruz',
      },
    })).toBe('Juan De La Cruz');
  });

  it('removes a legacy group prefix without shortening the name', () => {
    expect(formatConversationDisplayName({
      contact: {
        name: 'GRUPO DE ANA-MARÍA O\'NEILL',
      },
    })).toBe('Ana-María O\'Neill');
  });

  it('keeps the complete employee identity', () => {
    const conversation = {
      contact: {
        name: 'AYLINE NACHELL MADERA MARTINEZ',
      },
    };

    expect(formatConversationDisplayName(conversation))
      .toBe('Ayline Nachell Madera Martinez');
    expect(formatConversationContactName(conversation))
      .toBe('Ayline Nachell Madera Martinez');
  });

  it('formats regular contact names without adding the group prefix', () => {
    expect(toTitleCaseName('  mARÍA   pérez  ')).toBe('María Pérez');
    expect(formatConversationDisplayName({
      contact: { name: 'mARÍA pérez' },
    })).toBe('María Pérez');
  });

  it('shows the full employee name when referring to the contact', () => {
    expect(formatConversationContactName({
      contact: {
        name: 'AYLINE NACHELL MADERA MARTINEZ',
      },
    })).toBe('Ayline Nachell Madera Martinez');
  });
});
