import {
  canParticipateInConversation,
  formatConversationContactName,
  formatConversationDisplayName,
  isEmployeeConversation,
  toTitleCaseName,
} from './conversation-team-filter';

describe('canParticipateInConversation', () => {
  it('allows every employee to participate in an active employee WhatsApp chat', () => {
    expect(canParticipateInConversation({
      assignee_id: null,
      contact: { affiliation_type_id: 'empleado' },
    })).toBeTrue();
    expect(canParticipateInConversation({
      assignee_id: 'another-user',
      contact: { affiliation_type_id: 'tecnico_empleado' },
    }, ['current-user'])).toBeTrue();
  });

  it('keeps customer conversations restricted to their assignee', () => {
    const customerConversation = {
      assignee_id: 'assigned-user',
      contact: { affiliation_type_id: 'cliente' },
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
      contact: { affiliation_type_id: 'cliente' },
    }, ['assigned-user'])).toBeFalse();
  });
});

describe('isEmployeeConversation', () => {
  it('recognizes active employees and every technician affiliation', () => {
    for (const affiliation of [
      'empleado',
      'tecnico',
      'tecnico_empleado',
      'tecnico_independiente',
    ]) {
      expect(isEmployeeConversation({
        contact: { affiliation_type_id: affiliation },
      })).toBeTrue();
    }
  });

  it('does not include customers or unlinked WhatsApp contacts', () => {
    expect(isEmployeeConversation({
      contact: { affiliation_type_id: 'cliente' },
    })).toBeFalse();
    expect(isEmployeeConversation({ contact: {} })).toBeFalse();
  });

  it('treats suspended employees as normal contacts', () => {
    const suspendedEmployee = {
      shared_team_conversation: false,
      contact: {
        name: 'EMPLEADO SUSPENDIDO',
        affiliation_type_id: 'empleado',
        status: false,
      },
    };

    expect(isEmployeeConversation(suspendedEmployee)).toBeFalse();
    expect(formatConversationDisplayName(suspendedEmployee))
      .toBe('Empleado Suspendido');
  });
  it('accepts the explicit shared employee marker without treating it as a group', () => {
    expect(isEmployeeConversation({
      shared_employee_conversation: true,
      shared_team_conversation: false,
      contact: { status: true },
    })).toBeTrue();
  });

  it('keeps legacy shared employee records writable during cache migration', () => {
    expect(isEmployeeConversation({
      shared_team_conversation: true,
      contact: { status: true },
    })).toBeTrue();
    expect(formatConversationDisplayName({
      shared_team_conversation: true,
      team_chat_name: 'Operaciones',
      contact: { name: 'MARÍA PÉREZ', status: true },
    })).toBe('María Pérez');
  });
});

describe('conversation employee display names', () => {
  it('shows employee chats as normal full names in title case', () => {
    expect(formatConversationDisplayName({
      contact: {
        name: 'jUAN de la cruz',
        affiliation_type_id: 'empleado',
      },
    })).toBe('Juan De La Cruz');
  });

  it('removes a legacy group prefix without shortening the name', () => {
    expect(formatConversationDisplayName({
      contact: {
        name: 'GRUPO DE ANA-MARÍA O\'NEILL',
        affiliation_type_id: 'tecnico',
      },
    })).toBe('Ana-María O\'Neill');
  });

  it('ignores a legacy custom group name and keeps the employee identity', () => {
    const conversation = {
      team_chat_name: 'GRUPO DE operaciones técnicas',
      contact: {
        name: 'AYLINE NACHELL MADERA MARTINEZ',
        affiliation_type_id: 'empleado',
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
      contact: { name: 'mARÍA pérez', affiliation_type_id: 'cliente' },
    })).toBe('María Pérez');
  });

  it('shows the full employee name when referring to the contact', () => {
    expect(formatConversationContactName({
      contact: {
        name: 'AYLINE NACHELL MADERA MARTINEZ',
        affiliation_type_id: 'empleado',
      },
    })).toBe('Ayline Nachell Madera Martinez');
  });
});
