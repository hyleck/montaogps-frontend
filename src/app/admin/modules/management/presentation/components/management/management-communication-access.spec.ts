import { ManagementComponent } from './management.component';

describe('Management communication chat access', () => {
  let component: any;
  let notifications: {
    openFloatingAssignedChat: jasmine.Spy;
    openFloatingAdmin: jasmine.Spy;
    openFloatingTechnicians: jasmine.Spy;
  };

  beforeEach(() => {
    component = Object.create(ManagementComponent.prototype);
    notifications = {
      openFloatingAssignedChat: jasmine.createSpy('openFloatingAssignedChat'),
      openFloatingAdmin: jasmine.createSpy('openFloatingAdmin'),
      openFloatingTechnicians: jasmine.createSpy('openFloatingTechnicians'),
    };
    component.communicationNotifications = notifications;
    component.assignedCommunicationChats = [{
      conversationId: 42,
      contactName: 'Cliente',
      contactPhone: '8095550101',
      avatar: '',
      lastMessage: 'Hola',
      time: 10,
      unreadCount: 1,
    }];
    component.assignedCommunicationMessagePreview = null;
  });

  it('hides and blocks client, admin and technician chats for non-employees', () => {
    component.currentUserAffiliationTypeId = 'cliente';

    expect(component.canAccessManagementCommunicationChats).toBeFalse();
    expect(component.activeFloatingCommunicationContact).toBeNull();

    component.openFloatingAssignedCommunicationChat(42);
    component.openFloatingAdminChat();
    component.openFloatingTechniciansChat();

    expect(notifications.openFloatingAssignedChat).not.toHaveBeenCalled();
    expect(notifications.openFloatingAdmin).not.toHaveBeenCalled();
    expect(notifications.openFloatingTechnicians).not.toHaveBeenCalled();
  });

  it('keeps all three Management chats available to employees', () => {
    component.currentUserAffiliationTypeId = 'empleado';

    expect(component.canAccessManagementCommunicationChats).toBeTrue();
    expect(component.activeFloatingCommunicationContact?.conversationId).toBe(42);

    component.openFloatingAssignedCommunicationChat(42);
    component.openFloatingAdminChat();
    component.openFloatingTechniciansChat();

    expect(notifications.openFloatingAssignedChat).toHaveBeenCalledWith(
      42,
      jasmine.objectContaining({ conversationId: 42 }),
    );
    expect(notifications.openFloatingAdmin).toHaveBeenCalled();
    expect(notifications.openFloatingTechnicians).toHaveBeenCalled();
  });
});
