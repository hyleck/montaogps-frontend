import { ManagementComponent } from './management.component';
import { of } from 'rxjs';

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
    component.assignedCommunicationReminderBuzz = null;
    component.assignedCommunicationReminderBuzzing = false;
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

  it('vibrates and points the contact button to the reminded conversation', () => {
    component.currentUserAffiliationTypeId = 'empleado';
    component.assignedCommunicationChats.push({
      conversationId: 77,
      contactName: 'María Taveras',
      contactPhone: '8095550177',
      avatar: '',
      lastMessage: 'Sigo esperando',
      time: 20,
      unreadCount: 0,
    });

    component.showAssignedCommunicationReminderBuzz({
      conversationId: 77,
      contactName: 'María Taveras',
      senderName: 'Supervisor',
    });

    expect(component.assignedCommunicationReminderBuzzing).toBeTrue();
    expect(component.activeFloatingCommunicationContact?.conversationId).toBe(77);

    component.openFloatingAssignedCommunicationChat();

    expect(notifications.openFloatingAssignedChat).toHaveBeenCalledWith(
      77,
      jasmine.objectContaining({ contactName: 'María Taveras' }),
    );
    expect(component.assignedCommunicationReminderBuzzing).toBeFalse();
  });

  it('signs the explicitly selected role into a registration link request', async () => {
    const roleId = '507f1f77bcf86cd799439099';
    const createRegistrationLink = jasmine.createSpy('createRegistrationLink')
      .and.returnValue(of({
        short_code: 'abc123',
        expires_at: '2026-09-08T12:00:00.000Z',
        target_count: 0,
      }));
    component.currentUserAffiliationTypeId = 'empleado';
    component.authService = {
      getCurrentUser: () => ({
        id: '507f1f77bcf86cd799439011',
        affiliation_type_id: 'empleado',
      }),
    };
    component.route = {
      snapshot: { params: { user: '507f1f77bcf86cd799439012' } },
    };
    component.userService = { createRegistrationLink };
    component.messageService = { add: jasmine.createSpy('add') };
    component.selectedUser = {
      _id: '507f1f77bcf86cd799439012',
      email: 'cliente@example.com',
    };
    component.pendingCreateUserTransferTargets = [];
    component.registrationLinkFlow = 'create';
    component.registrationLinkParentEmail = 'cliente@example.com';
    component.selectedRegistrationLinkAffiliation = 'cliente';
    component.selectedRegistrationLinkRoleId = roleId;
    component.registrationLinkRoles = [{
      _id: roleId,
      name: 'Cliente limitado',
      description: '',
      status: 'active',
      createdAt: new Date(),
      privileges: [],
    }];

    await component.createRegistrationLinkForSelectedTargets();

    expect(createRegistrationLink).toHaveBeenCalledWith(jasmine.objectContaining({
      access_level_id: roleId,
      affiliation_type_id: 'cliente',
    }));
    expect(component.registrationLinkRoleName).toBe('Cliente limitado');
  });
});
