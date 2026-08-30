import { of } from 'rxjs';
import { CommunicationNotificationService } from './communication-notification.service';

describe('CommunicationNotificationService sidebar badge', () => {
  it('counts only unread WhatsApp messages in the sidebar badge', () => {
    const service = new CommunicationNotificationService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    let sidebarCount = -1;
    service.pendingCount$.subscribe(count => {
      sidebarCount = count;
    });

    (service as any).processConversations([
      { id: 10, unread_count: 2, last_message: 'Hola' },
    ]);
    service.syncInternalPendingCount(4);

    expect(sidebarCount).toBe(2);
  });

  it('publishes every active assigned conversation visible to the employee', () => {
    const service = new CommunicationNotificationService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    (service as any).agentId = 'employee-1';
    let assignedChats: any[] = [];
    service.assignedChats$.subscribe(chats => {
      assignedChats = chats;
    });

    (service as any).processConversations([
      {
        id: 10,
        status: 'open',
        assignee_id: 'employee-1',
        unread_count: 2,
        last_message: 'Necesito ayuda',
        last_message_time: 20,
        contact: {
          name: 'Cliente asignado',
          phone: '8095550101',
          avatar: 'https://media.montao.net/users/cliente.jpg',
        },
      },
      {
        id: 11,
        status: 'open',
        assignee_id: 'employee-2',
        unread_count: 4,
        contact: { name: 'Otro empleado' },
      },
      {
        id: 12,
        status: 'resolved',
        assignee_id: 'employee-1',
        unread_count: 0,
        contact: { name: 'Chat resuelto' },
      },
    ]);

    expect(assignedChats.map(chat => chat.conversationId)).toEqual([10, 11]);
    expect(assignedChats[0]).toEqual(jasmine.objectContaining({
      contactName: 'Cliente asignado',
      avatar: 'https://media.montao.net/users/cliente.jpg',
      unreadCount: 2,
    }));
  });

  it('publishes every item returned by the dedicated assigned-conversation query', () => {
    const service = new CommunicationNotificationService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    (service as any).agentId = 'employee-1';
    let assignedChats: any[] = [];
    service.assignedChats$.subscribe(chats => {
      assignedChats = chats;
    });

    (service as any).processConversations(
      [{ id: 90, status: 'open', assignee_id: null }],
      [
        {
          id: 91,
          status: 'open',
          assignee_id: 'employee-1',
          last_message_time: 20,
          contact: { name: 'Primer cliente' },
        },
        {
          id: 92,
          status: 'open',
          assignee_id: 'employee-1',
          last_message_time: 10,
          contact: { name: 'Segundo cliente' },
        },
      ],
    );

    expect(assignedChats.map(chat => chat.conversationId)).toEqual([91, 92]);
  });

  it('combines every page returned by the assigned-conversation query', () => {
    const whatsappApi = {
      getConversations: jasmine.createSpy('getConversations').and.callFake(
        (_inboxId: number, page: number) => of({
          success: true,
          conversations: [{ id: page }],
          meta: { total_pages: 2 },
        }),
      ),
    };
    const service = new CommunicationNotificationService(
      {} as any,
      {} as any,
      whatsappApi as any,
      {} as any,
    );
    let conversationIds: number[] = [];

    (service as any).loadAllAssignedConversations().subscribe((response: any) => {
      conversationIds = response.conversations.map((conversation: any) => conversation.id);
    });

    expect(conversationIds).toEqual([1, 2]);
    expect(whatsappApi.getConversations).toHaveBeenCalledTimes(2);
    expect(whatsappApi.getConversations.calls.argsFor(0)[2]).toBeUndefined();
    expect(whatsappApi.getConversations.calls.argsFor(0)[6]).toBeTrue();
  });

  it('updates the assigned-chat unread badge when the conversation is opened', () => {
    const service = new CommunicationNotificationService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    (service as any).agentId = 'employee-1';
    let unreadCount = -1;
    service.assignedChats$.subscribe(chats => {
      unreadCount = chats[0]?.unreadCount ?? -1;
    });

    (service as any).processConversations([
      {
        id: 20,
        status: 'open',
        assignee_id: 'employee-1',
        unread_count: 3,
        contact: { name: 'Cliente' },
      },
    ]);
    service.markWhatsAppConversationRead(20);

    expect(unreadCount).toBe(0);
  });

  it('publishes the incoming contact so Management can anchor its preview to that contact', () => {
    const service = new CommunicationNotificationService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    (service as any).agentId = 'employee-1';
    (service as any).initialized = true;
    spyOn<any>(service, 'playNotificationSound').and.stub();
    spyOn<any>(service, 'playOtherConversationNotificationSound').and.stub();
    const previews: any[] = [];
    service.floatingMessage$.subscribe(message => previews.push(message));

    (service as any).processConversations([
      {
        id: 30,
        status: 'open',
        assignee_id: 'employee-1',
        unread_count: 1,
        last_message: 'Necesito ayuda con mi GPS',
        last_message_time: 100,
        last_message_type: 0,
        contact: {
          name: 'Cliente asignado',
          phone: '8095550101',
          avatar: 'https://media.montao.net/users/cliente.jpg',
        },
      },
      {
        id: 31,
        status: 'open',
        assignee_id: 'employee-2',
        unread_count: 1,
        last_message: 'Este mensaje pertenece a otro agente',
        last_message_time: 101,
        last_message_type: 0,
        contact: { name: 'Otro cliente' },
      },
    ]);

    expect(previews).toEqual([
      jasmine.objectContaining({
        conversationId: 30,
        contactName: 'Cliente asignado',
        avatar: 'https://media.montao.net/users/cliente.jpg',
        message: 'Necesito ayuda con mi GPS',
      }),
      jasmine.objectContaining({
        conversationId: 31,
        contactName: 'Otro cliente',
        message: 'Este mensaje pertenece a otro agente',
      }),
    ]);
  });

  it('keeps the latest unread preview available while Management finishes loading', () => {
    const service = new CommunicationNotificationService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    (service as any).processConversations([
      {
        id: 40,
        status: 'open',
        unread_count: 1,
        last_message: 'Mensaje pendiente',
        last_message_time: 200,
        last_message_type: 0,
        contact: { name: 'Cliente reciente' },
      },
    ]);

    let preview: any = null;
    service.floatingMessage$.subscribe(message => {
      preview = message;
    });

    expect(preview).toEqual(jasmine.objectContaining({
      conversationId: 40,
      contactName: 'Cliente reciente',
      message: 'Mensaje pendiente',
    }));
    (service as any).clearFloatingMessage();
  });

  it('opens the floating technician chats with the requested group', () => {
    const service = new CommunicationNotificationService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    let requestedGroupId: string | null | undefined;
    service.floatingTechniciansRequested$.subscribe(groupId => {
      requestedGroupId = groupId;
    });

    service.openFloatingTechnicians('technician:123');

    expect(requestedGroupId).toBe('technician:123');
  });

  it('opens the floating employee group with the requested group', () => {
    const service = new CommunicationNotificationService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    let requestedGroupId: string | null | undefined;
    service.floatingAdminRequested$.subscribe(groupId => {
      requestedGroupId = groupId;
    });

    service.openFloatingAdmin('admin');

    expect(requestedGroupId).toBe('admin');
  });

  it('does not publish the legacy floating toast for Ester messages in the employee group', () => {
    const service = new CommunicationNotificationService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const previews: any[] = [];
    service.floatingMessage$.subscribe(message => previews.push(message));

    (service as any).emitInternalFloatingMessage({
      _id: 'ester-message',
      groupId: 'admin',
      text: 'Equipo, revisemos este caso.',
      type: 'text',
      createdAt: '2026-08-29T23:40:00.000Z',
      author: {
        _id: 'ester-assistant',
        name: 'Ester',
        affiliation_type_id: 'assistant',
      },
    });

    expect(previews).toEqual([]);
  });

  it('passes the preview contact to the floating chat even when it is not in the assigned list yet', () => {
    const service = new CommunicationNotificationService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    let request: any = null;
    service.floatingAssignedChatRequested$.subscribe(value => {
      request = value;
    });
    const previewChat = {
      conversationId: 77,
      contactName: 'Cliente reciente',
      contactPhone: '8095550101',
      avatar: '',
      lastMessage: 'Necesito ayuda',
      time: 123,
      unreadCount: 1,
    };

    service.openFloatingAssignedChat(77, previewChat);

    expect(request).toEqual({
      conversationId: 77,
      chat: previewChat,
    });
  });

  it('publishes the unread total for technician installation groups', () => {
    const service = new CommunicationNotificationService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    let pendingCount = -1;
    service.technicianPendingCount$.subscribe(count => {
      pendingCount = count;
    });

    service.syncTechnicianPendingCount(7);

    expect(pendingCount).toBe(7);
  });

  it('publishes the unread total for the employee group', () => {
    const service = new CommunicationNotificationService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    let pendingCount = -1;
    service.adminPendingCount$.subscribe(count => {
      pendingCount = count;
    });

    service.syncAdminPendingCount(4);

    expect(pendingCount).toBe(4);
  });
});
