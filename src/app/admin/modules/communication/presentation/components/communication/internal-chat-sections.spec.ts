import {
  countUnreadMessages,
  isTechnicianGroup,
  teamGroupsOf,
  technicianGroupsOf,
} from './internal-chat-sections';

describe('secciones del chat interno', () => {
  const grupos = [
    { id: 'admin', type: 'admin', unreadCount: 2 },
    { id: 'tec-1', type: 'installation', unreadCount: 3 },
    { id: 'tec-2', type: 'installation', unreadCount: 0 },
  ];

  it('deja en Equipo sólo el chat de los empleados', () => {
    expect(teamGroupsOf(grupos).map(grupo => grupo.id)).toEqual(['admin']);
  });

  it('lleva a Técnicos los chats de cada técnico', () => {
    expect(technicianGroupsOf(grupos).map(grupo => grupo.id))
      .toEqual(['tec-1', 'tec-2']);
  });

  it('trata como técnico cualquier grupo que no sea el de empleados', () => {
    expect(isTechnicianGroup({ type: 'installation' })).toBeTrue();
    expect(isTechnicianGroup({ type: 'otro-tipo-futuro' })).toBeTrue();
    expect(isTechnicianGroup({ type: 'admin' })).toBeFalse();
    expect(isTechnicianGroup(null)).toBeFalse();
  });

  it('cuenta los mensajes nuevos por separado en cada sección', () => {
    expect(countUnreadMessages(teamGroupsOf(grupos))).toBe(2);
    expect(countUnreadMessages(technicianGroupsOf(grupos))).toBe(3);
    expect(countUnreadMessages([])).toBe(0);
  });
});
