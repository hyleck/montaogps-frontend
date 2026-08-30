import { of } from 'rxjs';
import { CommunicationComponent } from './communication.component';

describe('Communication conversation pagination', () => {
  it('loads the next backend page with the current search and filter', () => {
    const component: any = Object.create(CommunicationComponent.prototype);
    component.loadingConversations = false;
    component.loadingMoreConversations = false;
    component.hasMoreConversations = true;
    component.conversationPage = 1;
    component.conversationTotalPages = 3;
    component.conversationListGeneration = 4;
    component.userInboxId = 5;
    component.whatsappAgentId = 'employee-id';
    component.searchTerm = 'cliente santiago';
    component.conversationAttentionFilter = 'waiting';
    component.conversations = [
      { id: 1 },
      { id: 2 },
      { id: 3 },
      { id: 4 },
      { id: 5 },
    ];
    component.whatsappApi = {
      getConversations: jasmine.createSpy().and.returnValue(of({
        success: true,
        conversations: [
          { id: 6 },
          { id: 7 },
          { id: 8 },
          { id: 9 },
          { id: 10 },
        ],
        meta: {
          current_page: 2,
          total_pages: 3,
          page_size: 5,
          has_more: true,
        },
      })),
    };
    component.messageService = { add: jasmine.createSpy() };
    component.filterConversations = jasmine.createSpy();
    component.getConversationsFingerprint = jasmine.createSpy().and.returnValue('page-2');

    component.loadMoreConversations();

    expect(component.whatsappApi.getConversations).toHaveBeenCalledWith(
      5,
      2,
      'employee-id',
      true,
      'cliente santiago',
      'waiting',
      false,
      5,
    );
    expect(component.conversations.map((conversation: any) => conversation.id))
      .toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(component.conversationPage).toBe(2);
    expect(component.hasMoreConversations).toBeTrue();
    expect(component.loadingMoreConversations).toBeFalse();
  });

  it('requests another page when the conversation list reaches its bottom', () => {
    const component: any = Object.create(CommunicationComponent.prototype);
    component.loadMoreConversations = jasmine.createSpy();

    component.onConversationsScroll({
      target: {
        scrollHeight: 1000,
        scrollTop: 720,
        clientHeight: 220,
      },
    } as any);

    expect(component.loadMoreConversations).toHaveBeenCalled();
  });
});
