import { Subject } from 'rxjs';

import { CommunicationFloatingMessage } from '@core/services/communication-notification.service';
import { AdminComponent } from './admin.component';

describe('AdminComponent', () => {
  function createComponent() {
    const chatTransferReceived$ = new Subject<any>();
    const conversationReminderReceived$ = new Subject<any>();
    const floatingMessage$ = new Subject<CommunicationFloatingMessage>();
    const firebaseNotifications = {
      chatTransferReceived$,
      conversationReminderReceived$,
    };
    const communicationNotifications = {
      floatingMessage$,
      openFloatingTechnicians: jasmine.createSpy('openFloatingTechnicians'),
      openFloatingAdmin: jasmine.createSpy('openFloatingAdmin'),
      playReminderBuzz: jasmine.createSpy('playReminderBuzz'),
    };
    const authService = {
      getSupportImpersonationState: jasmine.createSpy('getSupportImpersonationState')
        .and.returnValue(null),
    };
    const router = {
      url: '/admin/management',
      navigate: jasmine.createSpy('navigate').and.resolveTo(true),
    };
    const component = new AdminComponent(
      firebaseNotifications as any,
      communicationNotifications as any,
      authService as any,
      router as any,
    );

    component.ngOnInit();
    return {
      component,
      floatingMessage$,
      conversationReminderReceived$,
      communicationNotifications,
      router,
    };
  }

  it('creates the Management shell', () => {
    const { component } = createComponent();

    expect(component).toBeTruthy();
    component.ngOnDestroy();
  });

  it('opens the exact technician floating chat from its message preview', () => {
    const {
      component,
      floatingMessage$,
      communicationNotifications,
      router,
    } = createComponent();
    floatingMessage$.next({
      source: 'internal',
      conversationId: 0,
      groupId: 'technician:507f1f77bcf86cd799439012',
      contactName: 'Isaac Jimenez',
      contactPhone: 'Grupo de instalaciones',
      message: 'Instalación completada',
      time: 1_788_189_600,
    });

    component.openFloatingConversation();

    expect(communicationNotifications.openFloatingTechnicians)
      .toHaveBeenCalledOnceWith('technician:507f1f77bcf86cd799439012');
    expect(communicationNotifications.openFloatingAdmin).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.floatingMessage).toBeNull();
    component.ngOnDestroy();
  });

  it('forwards the targeted reminder without opening a global modal', () => {
    const {
      component,
      conversationReminderReceived$,
      communicationNotifications,
    } = createComponent();

    conversationReminderReceived$.next({
      conversationId: '202',
      contactName: 'María Taveras',
      senderName: 'Supervisor',
      targetAgentId: 'assigned-employee',
      messages: [],
    });

    expect(communicationNotifications.playReminderBuzz).toHaveBeenCalledWith({
      conversationId: 202,
      contactName: 'María Taveras',
      senderName: 'Supervisor',
    });
    component.ngOnDestroy();
  });
});
