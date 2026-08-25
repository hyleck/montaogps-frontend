import { orderConversationsByAttention } from './conversation-order';

describe('orderConversationsByAttention', () => {
  it('places conversations with unread messages before read conversations', () => {
    const ordered = orderConversationsByAttention([
      { id: 1, unread_count: 0, last_message_time: 300 },
      { id: 2, unread_count: 1, last_message_time: 100 },
    ]);

    expect(ordered.map(conversation => conversation.id)).toEqual([2, 1]);
  });

  it('orders unread conversations by their latest interaction, not unread quantity', () => {
    const ordered = orderConversationsByAttention([
      { id: 1, unread_count: 8, last_message_time: 100 },
      { id: 2, unread_count: 1, last_message_time: 300 },
      { id: 3, unread_count: 2, last_message_time: 200 },
    ]);

    expect(ordered.map(conversation => conversation.id)).toEqual([2, 3, 1]);
  });

  it('orders read conversations by their latest available activity', () => {
    const ordered = orderConversationsByAttention([
      { id: 1, unread_count: 0, last_message_time: 100 },
      { id: 2, unread_count: 0, contact_last_seen_at: 300 },
      { id: 3, unread_count: 0, last_message_time: 200 },
    ]);

    expect(ordered.map(conversation => conversation.id)).toEqual([2, 3, 1]);
  });

  it('does not mutate the received list', () => {
    const conversations = [
      { id: 1, unread_count: 0, last_message_time: 100 },
      { id: 2, unread_count: 1, last_message_time: 200 },
    ];

    orderConversationsByAttention(conversations);

    expect(conversations.map(conversation => conversation.id)).toEqual([1, 2]);
  });
});
