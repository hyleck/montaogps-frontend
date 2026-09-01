/// <reference types="google.maps" />

import { fakeAsync, tick } from '@angular/core/testing';
import { NEVER, of } from 'rxjs';
import { InternalChatMessage } from '../../../../core/services/internal-chat.service';
import { NavbarComponent } from './navbar.component';
import { FloatingCommunicationMessage } from './floating-communication-message';

describe('NavbarComponent realtime links', () => {
  function createComponent() {
    const selectionService = {
      selectedTargetsValue: [],
      notifyTargetsUpdated: jasmine.createSpy('notifyTargetsUpdated'),
    };
    const router = {
      url: '/admin/management',
      navigate: jasmine.createSpy('navigate').and.resolveTo(true),
    };
    const targetsService = {
      createRealtimeShortLink: jasmine.createSpy('createRealtimeShortLink')
        .and.callFake(async (payload: { target_id: string; expires_at: string }) => ({
          short_code: `code-${payload.target_id}`,
          expires_at: payload.expires_at,
        })),
      getTargetById: jasmine.createSpy('getTargetById')
        .and.callFake(async (targetId: string) => ({
          _id: targetId,
          name: `Objetivo ${targetId}`,
          device_imei: `imei-${targetId}`,
          activation_date: '2026-01-01',
          expiration_date: '2027-01-01',
        })),
      updateTarget: jasmine.createSpy('updateTarget')
        .and.callFake(async (_targetId: string, payload: any) => payload),
      createProcess: jasmine.createSpy('createProcess')
        .and.callFake(async (payload: any) => ({ _id: 'process-id', ...payload })),
    };
    const messageService = {
      add: jasmine.createSpy('add'),
    };
    const systemService = {
      getAll: jasmine.createSpy('getAll').and.returnValue(of([{
        map_api1: { key: 'map-key' },
      }])),
    };
    const appUpdateService = {
      updateAvailable$: of(false),
      applyingUpdate$: of(false),
      applyUpdate: jasmine.createSpy('applyUpdate'),
    };
    const communicationNotifications = {
      markWhatsAppConversationRead: jasmine.createSpy('markWhatsAppConversationRead'),
      syncTechnicianPendingCount: jasmine.createSpy('syncTechnicianPendingCount'),
      syncAdminPendingCount: jasmine.createSpy('syncAdminPendingCount'),
    };
    const whatsappApi = {
      getConversationMessages: jasmine.createSpy('getConversationMessages'),
    };
    const internalChatService = {
      getGroups: jasmine.createSpy('getGroups').and.returnValue(of({
        groups: [],
        canClearMessages: false,
      })),
      getMessages: jasmine.createSpy('getMessages').and.returnValue(of({
        messages: [],
        total: 0,
        hasMore: false,
        groupId: '',
      })),
      markGroupRead: jasmine.createSpy('markGroupRead').and.returnValue(of({
        success: true,
        groupId: 'group-1',
        unreadCount: 0,
      })),
    };
    const supportCapture = {
      diagnostics: {
        route: '/admin/management',
        browser: 'Chrome',
        captured_at: '2026-08-29T12:00:00.000Z',
        viewport: '1280x720 @1x',
      },
      summary: 'CONTEXTO DE PANTALLA CAPTURADO AUTOMÁTICAMENTE',
    };
    const supportService = {
      floatingAquilesRequested$: of(),
      captureAquilesDiagnostics: jasmine.createSpy('captureAquilesDiagnostics')
        .and.resolveTo(supportCapture),
      chatWithAquiles: jasmine.createSpy('chatWithAquiles'),
      createTicket: jasmine.createSpy('createTicket'),
      getTickets: jasmine.createSpy('getTickets').and.returnValue(of([])),
    };
    const component = new NavbarComponent(
      { getState: () => 'light' } as any,
      {} as any,
      { getCurrentUser: () => null } as any,
      router as any,
      {} as any,
      { getLanguages: () => [] } as any,
      { instant: (key: string) => key } as any,
      selectionService as any,
      targetsService as any,
      {
        getById: () => of({}),
        getTechnicians: () => of([]),
      } as any,
      {} as any,
      messageService as any,
      {} as any,
      {} as any,
      supportService as any,
      communicationNotifications as any,
      whatsappApi as any,
      internalChatService as any,
      { getAllProtocols: () => of([]) } as any,
      systemService as any,
      appUpdateService as any,
    );
    return {
      component,
      router,
      selectionService,
      targetsService,
      messageService,
      systemService,
      appUpdateService,
      communicationNotifications,
      whatsappApi,
      internalChatService,
      supportService,
      supportCapture,
    };
  }

  it('applies the available frontend update from the navbar', () => {
    const { component, appUpdateService } = createComponent();

    component.applyAvailableAppUpdate();

    expect(appUpdateService.applyUpdate).toHaveBeenCalledTimes(1);
  });

  it('shows Aquiles typing before the natural initial greeting', fakeAsync(() => {
    const { component } = createComponent();
    component.currentUser = { name: 'Frankely' };

    component.resetSupportChat();

    expect(component.supportAssistantThinking).toBeTrue();
    expect(component.supportChatMessages).toEqual([]);

    tick(1199);
    expect(component.supportChatMessages).toEqual([]);

    tick(1);
    expect(component.supportAssistantThinking).toBeFalse();
    expect(component.supportChatMessages.length).toBe(1);
    expect(component.supportChatMessages[0].content).toBe(
      'Hola, Frankely. Cuéntame qué pasó y te ayudo a dejar el ticket bien explicado.',
    );
    component.ngOnDestroy();
  }));

  it('creates the Aquiles ticket in the background as soon as the case is ready', fakeAsync(() => {
    const { component, supportService } = createComponent();
    supportService.chatWithAquiles.and.returnValue(of({
      message: 'Ya, con eso basta. Voy a crear el ticket ahora.',
      ready: true,
      title: 'El objetivo no abre en el mapa',
      description: 'El usuario no puede abrir su objetivo desde Management.',
      priority: 'high',
    }));
    supportService.createTicket.and.returnValue(of({
      _id: 'ticket-1',
      title: 'El objetivo no abre en el mapa',
      description: 'El usuario no puede abrir su objetivo desde Management.',
      priority: 'high',
      status: 'open',
    }));
    component.supportChatInput = 'No puedo abrir mi objetivo en el mapa';

    component.sendSupportChatMessage();
    tick();

    expect(supportService.captureAquilesDiagnostics).not.toHaveBeenCalled();
    expect(supportService.chatWithAquiles).toHaveBeenCalledWith(
      jasmine.objectContaining({
        messages: jasmine.arrayContaining([
          jasmine.objectContaining({
            role: 'user',
            content: 'No puedo abrir mi objetivo en el mapa',
          }),
        ]),
      }),
    );
    expect(supportService.chatWithAquiles.calls.mostRecent().args[0].diagnostics)
      .toBeUndefined();
    expect(supportService.createTicket).toHaveBeenCalledWith({
      title: 'El objetivo no abre en el mapa',
      description: 'El usuario no puede abrir su objetivo desde Management.',
      priority: 'high',
    }, null);
    expect(component.supportChatMessages.at(-1)?.content).toBe(
      'Listo, ya creé el ticket y lo envié al equipo de soporte.',
    );
    expect(component.savingTicket).toBeFalse();
    component.ngOnDestroy();
  }));

  it('renders and sends the user message without waiting for a screen capture', () => {
    const { component, supportService } = createComponent();
    supportService.chatWithAquiles.and.returnValue(NEVER);
    component.currentSelectedTargets = [{
      _id: 'target-1',
      name: 'Camión azul',
      device_imei: '862667088279339',
      sim_card_number: '8490000000',
      expiration_date: '2027-08-29',
      traccarInfo: { status: 'online' },
    }] as any;
    (component as any).lastSupportUserAction = 'Modificar objetivo';
    const visibleGps = document.createElement('div');
    visibleGps.className = 'target-card';
    visibleGps.innerText = 'Camión azul IMEI: 862667088279339 SIM: 8490000000 En línea';
    spyOn(visibleGps, 'getBoundingClientRect').and.returnValue({
      width: 420,
      height: 90,
      top: 120,
      right: 520,
      bottom: 210,
      left: 100,
      x: 100,
      y: 120,
      toJSON: () => ({}),
    } as DOMRect);
    document.body.appendChild(visibleGps);
    component.supportChatInput = 'La ubicación no se está actualizando';

    component.sendSupportChatMessage();

    expect(component.supportChatMessages).toEqual([
      jasmine.objectContaining({
        role: 'user',
        content: 'La ubicación no se está actualizando',
      }),
    ]);
    expect(component.supportChatInput).toBe('');
    expect(component.supportAssistantThinking).toBeTrue();
    expect(supportService.chatWithAquiles).toHaveBeenCalledTimes(1);
    const pageContext = supportService.chatWithAquiles.calls.mostRecent().args[0].page_context;
    expect(pageContext).toContain('Módulo: Management');
    expect(pageContext).toContain('Última acción relevante: Modificar objetivo');
    expect(pageContext).toContain('Camión azul | IMEI: 862667088279339');
    expect(pageContext).toContain('GPS visibles en pantalla');
    expect(supportService.captureAquilesDiagnostics).not.toHaveBeenCalled();
    visibleGps.remove();
    component.ngOnDestroy();
  });

  it('opens navbar support directly on the ticket status list', () => {
    const { component } = createComponent();
    const loadTickets = spyOn(component, 'loadUserTickets');
    const resetChat = spyOn(component, 'resetSupportChat');

    component.openSupportModal();

    expect(component.supportDialogVisible).toBeTrue();
    expect(component.activeSupportTab).toBe('list');
    expect(loadTickets).toHaveBeenCalledTimes(1);
    expect(resetChat).not.toHaveBeenCalled();
    component.ngOnDestroy();
  });

  it('keeps the technicians chat at the bottom while its content finishes rendering', fakeAsync(() => {
    const { component } = createComponent();
    const scrollElement = {
      scrollTop: 0,
      scrollHeight: 700,
    };
    component.floatingTechniciansVisible = true;
    (component as any).floatingTechnicianScroll = {
      nativeElement: scrollElement,
    };

    (component as any).scrollFloatingTechnicianToBottom();
    tick(70);
    scrollElement.scrollHeight = 1450;
    tick(400);

    expect(scrollElement.scrollTop).toBe(1450);
    component.ngOnDestroy();
  }));

  it('opens the employee group in the shared floating chat', () => {
    const { component, internalChatService, communicationNotifications } = createComponent();
    internalChatService.getGroups.and.returnValue(of({
      groups: [
        { id: 'admin', name: 'Montao GPS', type: 'admin', unreadCount: 3 },
        { id: 'technician:1', name: 'Instalaciones - Isaac', type: 'installation', unreadCount: 2 },
      ],
      canClearMessages: false,
    }));

    component.openFloatingAdmin();

    expect(component.isFloatingAdminChat).toBeTrue();
    expect(component.floatingTechniciansVisible).toBeTrue();
    expect(component.floatingTechnicianGroups.map(group => group.id)).toEqual(['admin']);
    expect(component.selectedFloatingTechnicianGroup?.id).toBe('admin');
    expect(communicationNotifications.syncAdminPendingCount).toHaveBeenCalledWith(3);
    expect(communicationNotifications.syncTechnicianPendingCount).toHaveBeenCalledWith(2);
    expect(internalChatService.getMessages).toHaveBeenCalledWith({
      limit: 8,
      groupId: 'admin',
      includeTotal: false,
    });
    component.ngOnDestroy();
  });

  it('opens the technician with unread messages instead of the previous chat', () => {
    const { component, internalChatService } = createComponent();
    component.selectedFloatingTechnicianGroup = {
      id: 'technician:amauris',
      name: 'Instalaciones Amauris',
      type: 'installation',
      unreadCount: 0,
    };
    internalChatService.getGroups.and.returnValue(of({
      groups: [
        {
          id: 'technician:amauris',
          name: 'Instalaciones Amauris',
          type: 'installation',
          unreadCount: 0,
        },
        {
          id: 'technician:juan',
          name: 'Instalaciones Juan',
          type: 'installation',
          unreadCount: 1,
        },
      ],
      canClearMessages: false,
    }));

    component.openFloatingTechnicians();

    expect(component.selectedFloatingTechnicianGroup?.id).toBe('technician:juan');
    expect(internalChatService.getMessages).toHaveBeenCalledWith({
      limit: 8,
      groupId: 'technician:juan',
      includeTotal: false,
    });
    component.ngOnDestroy();
  });

  it('opens an Admin message reference in the exact customer conversation', () => {
    const { component, router } = createComponent();
    component.floatingTechniciansVisible = true;

    component.openFloatingInternalMessageReference({
      _id: 'admin-message-1',
      groupId: 'admin',
      text: 'Miren, aquí pueden ver el mensaje exacto:',
      type: 'text',
      createdAt: '2026-08-31T10:16:00.000Z',
      referenceConversationId: 1787412043813291,
      referenceMessageId: 847,
      author: {
        _id: 'ester',
        name: 'Ester',
      },
    });

    expect(component.floatingTechniciansVisible).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(
      ['/admin/communication', 'chat', 1787412043813291],
      { queryParams: { messageId: 847 } },
    );
    component.ngOnDestroy();
  });

  it('loads the previous client message page and preserves the visible scroll position', fakeAsync(() => {
    const { component, whatsappApi } = createComponent();
    const currentMessage: FloatingCommunicationMessage = {
      id: 30,
      from: 'incoming',
      text: 'Mensaje reciente',
      createdAt: new Date('2026-08-29T12:00:00Z'),
      authorName: 'Cliente',
      isCurrentUser: false,
      attachments: [],
      transcription: '',
    };
    const scrollElement = {
      scrollTop: 5,
      scrollHeight: 500,
      clientHeight: 300,
    };
    component.selectedFloatingCommunicationChat = {
      conversationId: 123,
      contactName: 'Cliente',
    } as any;
    component.floatingCommunicationMessages = [currentMessage];
    component.floatingCommunicationHasOlder = true;
    (component as any).floatingCommunicationScroll = {
      nativeElement: scrollElement,
    };
    whatsappApi.getConversationMessages.and.returnValue(of({
      success: true,
      messages: [{
        id: 10,
        from: 'incoming',
        content: 'Mensaje anterior',
        created_at: 1_777_460_400,
        attachments: [],
      }],
    }));

    component.loadOlderFloatingCommunicationMessages();

    expect(whatsappApi.getConversationMessages).toHaveBeenCalledWith(123, 20, 30);
    expect(component.floatingCommunicationMessages.map(message => message.id)).toEqual([10, 30]);
    expect(component.floatingCommunicationHasOlder).toBeFalse();
    scrollElement.scrollHeight = 800;
    tick();
    expect(scrollElement.scrollTop).toBe(305);
    component.ngOnDestroy();
  }));

  it('requests older client messages only while the chat is scrolling upward', () => {
    const { component } = createComponent();
    const loadOlder = spyOn(component, 'loadOlderFloatingCommunicationMessages');
    const scrollElement = {
      scrollTop: 70,
      scrollHeight: 600,
      clientHeight: 300,
    };

    (component as any).floatingCommunicationLastScrollTop = 200;
    component.onFloatingCommunicationScroll({ currentTarget: scrollElement } as any);
    expect(loadOlder).toHaveBeenCalledTimes(1);

    loadOlder.calls.reset();
    (component as any).floatingCommunicationLastScrollTop = 20;
    component.onFloatingCommunicationScroll({ currentTarget: scrollElement } as any);
    expect(loadOlder).not.toHaveBeenCalled();
    component.ngOnDestroy();
  });

  it('loads the previous technician message page and preserves the visible scroll position', fakeAsync(() => {
    const { component, internalChatService } = createComponent();
    const currentMessage: InternalChatMessage = {
      _id: 'message-30',
      groupId: 'group-1',
      text: 'Mensaje reciente',
      type: 'text',
      createdAt: '2026-08-29T12:00:00.000Z',
      author: { _id: 'technician-1', name: 'Isaac' },
    };
    const olderMessage: InternalChatMessage = {
      _id: 'message-10',
      groupId: 'group-1',
      text: 'Mensaje anterior',
      type: 'text',
      createdAt: '2026-08-28T12:00:00.000Z',
      author: { _id: 'technician-1', name: 'Isaac' },
    };
    const scrollElement = {
      scrollTop: 8,
      scrollHeight: 600,
      clientHeight: 300,
    };
    component.selectedFloatingTechnicianGroup = {
      id: 'group-1',
      name: 'Instalaciones - Isaac',
      type: 'installation',
    };
    component.floatingTechnicianMessages = [currentMessage];
    component.floatingTechnicianHasOlder = true;
    (component as any).floatingTechnicianScroll = {
      nativeElement: scrollElement,
    };
    internalChatService.getMessages.and.returnValue(of({
      messages: [olderMessage],
      hasMore: false,
      groupId: 'group-1',
    }));

    component.loadOlderFloatingTechnicianMessages();

    expect(internalChatService.getMessages).toHaveBeenCalledWith({
      limit: 20,
      before: 'message-30',
      groupId: 'group-1',
      includeTotal: false,
    });
    expect(component.floatingTechnicianMessages.map(message => message._id))
      .toEqual(['message-10', 'message-30']);
    expect(component.floatingTechnicianHasOlder).toBeFalse();
    scrollElement.scrollHeight = 950;
    tick();
    expect(scrollElement.scrollTop).toBe(358);
    component.ngOnDestroy();
  }));

  it('requests older technician messages only while the chat is scrolling upward', () => {
    const { component } = createComponent();
    const loadOlder = spyOn(component, 'loadOlderFloatingTechnicianMessages');
    const scrollElement = {
      scrollTop: 70,
      scrollHeight: 600,
      clientHeight: 300,
    };

    (component as any).floatingTechnicianLastScrollTop = 200;
    component.onFloatingTechnicianScroll({ currentTarget: scrollElement } as any);
    expect(loadOlder).toHaveBeenCalledTimes(1);

    loadOlder.calls.reset();
    (component as any).floatingTechnicianLastScrollTop = 20;
    component.onFloatingTechnicianScroll({ currentTarget: scrollElement } as any);
    expect(loadOlder).not.toHaveBeenCalled();
    component.ngOnDestroy();
  });

  it('opens realtime sharing for multiple selected targets', () => {
    const { component, messageService } = createComponent();
    component.targetsToShare = [
      { _id: 'target-1', name: 'Vehículo 1' },
      { _id: 'target-2', name: 'Vehículo 2' },
    ] as any;

    component.openRealtimeShare();

    expect(component.realtimeLinkDialogVisible).toBeTrue();
    expect(component.targetsToShare.length).toBe(2);
    expect(messageService.add).not.toHaveBeenCalled();
  });

  it('shows Instructivos in the user dropdown before closing the session', () => {
    const { component } = createComponent();

    (component as any).initializeMenus();

    const labels = component.userMenuItems
      .filter(item => !item.separator)
      .map(item => item.label);
    expect(labels).toContain('Instructivos');
    expect(labels.indexOf('Instructivos')).toBeLessThan(
      labels.indexOf('navbar.logout'),
    );
  });

  it('generates one independent realtime link per selected target', async () => {
    const { component, targetsService } = createComponent();
    component.targetsToShare = [
      {
        _id: 'target-1',
        name: 'Camión Uno',
        device_imei: '111111111111111',
      },
      {
        _id: 'target-2',
        name: 'Camión Dos',
        device_imei: '222222222222222',
      },
      {
        _id: 'target-3',
        name: 'Camión Tres',
        device_imei: '333333333333333',
      },
    ] as any;
    const copySpy = spyOn(
      component,
      'copyRealtimeLinkToClipboard',
    ).and.resolveTo();

    await component.generateSelectedRealtimeLink();

    expect(targetsService.createRealtimeShortLink)
      .toHaveBeenCalledTimes(3);
    expect(targetsService.createRealtimeShortLink.calls.allArgs().map(
      args => args[0].target_id,
    )).toEqual(['target-1', 'target-2', 'target-3']);
    expect(component.realtimeGeneratedLinks.map(
      item => item.target_id,
    )).toEqual(['target-1', 'target-2', 'target-3']);
    expect(component.getRealtimeLinksClipboardText()).toContain(
      'Camión Uno · IMEI 111111111111111',
    );
    expect(component.getRealtimeLinksClipboardText()).toContain(
      'code-target-3',
    );
    expect(copySpy).toHaveBeenCalled();
  });

  it('keeps successful links when one target fails', async () => {
    const { component, targetsService, messageService } = createComponent();
    component.targetsToShare = [
      { _id: 'target-ok', name: 'Disponible' },
      { _id: 'target-fail', name: 'Con error' },
    ] as any;
    targetsService.createRealtimeShortLink.and.callFake(
      async (payload: { target_id: string; expires_at: string }) => {
        if (payload.target_id === 'target-fail') {
          throw new Error('No disponible');
        }
        return {
          short_code: `code-${payload.target_id}`,
          expires_at: payload.expires_at,
        };
      },
    );
    spyOn(component, 'copyRealtimeLinkToClipboard').and.resolveTo();

    await component.generateSelectedRealtimeLink();

    expect(component.realtimeGeneratedLinks.length).toBe(1);
    expect(component.realtimeGeneratedLinks[0].target_id)
      .toBe('target-ok');
    expect(messageService.add).toHaveBeenCalledWith(
      jasmine.objectContaining({
        severity: 'warn',
        summary: 'Generación parcial',
      }),
    );
  });

  it('offers the target-form processes except the four unsafe GPS and SIM changes', () => {
    const { component } = createComponent();

    expect(component.bulkProcessOptions.map(option => option.value)).toEqual([
      'installation',
      'expiration',
      'renewal',
      'technician_change',
      'installation_details_change',
      'gps_model_change',
      'sim_type_change',
    ]);
    expect(component.bulkProcessOptions.map(option => option.value))
      .not.toContain('gps_change' as any);
    expect(component.bulkProcessOptions.map(option => option.value))
      .not.toContain('sim_change' as any);
    expect(component.bulkProcessOptions.map(option => option.value))
      .not.toContain('imei_change' as any);
    expect(component.bulkProcessOptions.map(option => option.value))
      .not.toContain('sim_number_change' as any);
  });

  it('updates every selected target and records its process independently', async () => {
    const { component, targetsService } = createComponent();
    component.currentSelectedTargets = [
      { _id: 'target-1', name: 'Vehículo 1' },
      { _id: 'target-2', name: 'Vehículo 2' },
    ] as any;
    component.bulkProcessForm.type = 'installation';
    component.bulkProcessForm.registrationDate = '2026-07-30';
    component.bulkProcessForm.newInstallationDate = '2026-08-05';

    await component.applyBulkProcess();

    expect(targetsService.updateTarget).toHaveBeenCalledTimes(2);
    expect(targetsService.updateTarget).toHaveBeenCalledWith(
      'target-1',
      jasmine.objectContaining({
        activation_date: '2026-08-05',
      }),
    );
    expect(targetsService.createProcess).toHaveBeenCalledTimes(2);
    expect(targetsService.createProcess.calls.allArgs().map(
      args => args[0].type,
    )).toEqual([2, 2]);
    expect(component.bulkProcessSuccessCount).toBe(2);
    expect(component.bulkProcessErrorCount).toBe(0);
    expect(component.bulkProcessProgress).toBe(100);
  });
});
