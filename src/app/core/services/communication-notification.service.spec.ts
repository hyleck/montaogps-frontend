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
});
