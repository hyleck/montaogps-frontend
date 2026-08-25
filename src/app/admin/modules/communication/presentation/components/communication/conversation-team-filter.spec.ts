import {
  canViewConversationInTeamSection,
  canParticipateInConversation,
  formatConversationContactName,
  formatConversationDisplayName,
  isTeamConversation,
  toTitleCaseName,
} from './conversation-team-filter';

describe('canParticipateInConversation', () => {
  it('allows every user to participate in an internal team conversation', () => {
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

describe('isTeamConversation', () => {
  it('recognizes administrative employees and every technician affiliation', () => {
    for (const affiliation of [
      'empleado',
      'tecnico',
      'tecnico_empleado',
      'tecnico_independiente',
    ]) {
      expect(isTeamConversation({
        contact: { affiliation_type_id: affiliation },
      })).toBeTrue();
    }
  });

  it('does not include customers or unlinked WhatsApp contacts', () => {
    expect(isTeamConversation({
      contact: { affiliation_type_id: 'cliente' },
    })).toBeFalse();
    expect(isTeamConversation({ contact: {} })).toBeFalse();
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

    expect(isTeamConversation(suspendedEmployee)).toBeFalse();
    expect(formatConversationDisplayName(suspendedEmployee))
      .toBe('Empleado Suspendido');
  });
});

describe('canViewConversationInTeamSection', () => {
  const administrativeEmployee = {
    contact: {
      affiliation_type_id: 'empleado',
      status: true,
    },
  };

  it('only shows non-technician employees to root users', () => {
    expect(canViewConversationInTeamSection(
      administrativeEmployee,
      false,
    )).toBeFalse();
    expect(canViewConversationInTeamSection(
      administrativeEmployee,
      true,
    )).toBeTrue();
  });

  it('continues showing technicians to non-root users', () => {
    for (const affiliation of [
      'tecnico',
      'tecnico_empleado',
      'tecnico_independiente',
    ]) {
      expect(canViewConversationInTeamSection({
        contact: { affiliation_type_id: affiliation, status: true },
      }, false)).toBeTrue();
    }
  });
});

describe('conversation employee display names', () => {
  it('prefixes team chats and formats the user name in title case', () => {
    expect(formatConversationDisplayName({
      contact: {
        name: 'jUAN de la cruz',
        affiliation_type_id: 'empleado',
      },
    })).toBe('Grupo De Juan');
  });

  it('does not duplicate an existing group prefix', () => {
    expect(formatConversationDisplayName({
      contact: {
        name: 'GRUPO DE ANA-MARÍA O\'NEILL',
        affiliation_type_id: 'tecnico',
      },
    })).toBe('Grupo De Ana-María');
  });

  it('uses a custom team chat name without modifying the employee name', () => {
    const conversation = {
      team_chat_name: 'GRUPO DE operaciones técnicas',
      contact: {
        name: 'AYLINE NACHELL MADERA MARTINEZ',
        affiliation_type_id: 'empleado',
      },
    };

    expect(formatConversationDisplayName(conversation))
      .toBe('Grupo De Operaciones Técnicas');
    expect(formatConversationContactName(conversation)).toBe('Ayline');
  });

  it('formats regular contact names without adding the group prefix', () => {
    expect(toTitleCaseName('  mARÍA   pérez  ')).toBe('María Pérez');
    expect(formatConversationDisplayName({
      contact: { name: 'mARÍA pérez', affiliation_type_id: 'cliente' },
    })).toBe('María Pérez');
  });

  it('shows only the first name when referring to an employee', () => {
    expect(formatConversationContactName({
      contact: {
        name: 'AYLINE NACHELL MADERA MARTINEZ',
        affiliation_type_id: 'empleado',
      },
    })).toBe('Ayline');
  });
});
