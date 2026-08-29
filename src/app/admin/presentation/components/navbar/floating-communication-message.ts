export interface FloatingCommunicationMessage {
  id: number | string;
  from: 'incoming' | 'me' | 'system';
  text: string;
  createdAt: Date;
  authorName: string;
  isCurrentUser: boolean;
}

interface FloatingCommunicationCurrentUser {
  id?: string;
  _id?: string;
  name?: string;
  last_name?: string;
  email?: string;
}

export function mapFloatingCommunicationMessage(
  message: any,
  currentUser: FloatingCommunicationCurrentUser | null | undefined,
  contactName: string,
): FloatingCommunicationMessage {
  const from = message?.from === 'incoming' ? 'incoming' : 'me';
  const rawText = String(message?.content || '').trim();
  const signed = rawText.match(/^>\s*([^\r\n]+)(?:\r?\n([\s\S]*))?$/);
  const senderName = String(message?.sender || signed?.[1] || '').trim();
  const visibleSenderPrefix = from === 'me' && senderName
    ? rawText.match(/^([^:\r\n]{2,120}):\s*([\s\S]*)$/)
    : null;
  const hasVisibleSenderPrefix = !!visibleSenderPrefix
    && sameIdentity(visibleSenderPrefix[1], senderName);
  const text = from === 'me' && signed
    ? String(signed[2] || '').trim()
    : hasVisibleSenderPrefix
      ? String(visibleSenderPrefix?.[2] || '').trim()
      : rawText;
  const visibleSenderName = hasVisibleSenderPrefix
    ? String(visibleSenderPrefix?.[1] || '').trim()
    : senderName;
  const senderId = String(message?.sender_id || '').trim();
  const currentUserId = String(currentUser?.id || currentUser?._id || '').trim();
  const currentUserName = [currentUser?.name, currentUser?.last_name]
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .join(' ');
  const isCurrentUser = from === 'me' && (
    (!!senderId && !!currentUserId && senderId === currentUserId)
    || (!senderId && sameIdentity(senderName, currentUserName))
    || (!senderId && sameIdentity(senderName, currentUser?.email))
  );
  const createdAtValue = Number(message?.created_at || 0);

  return {
    id: Number(message?.id || 0) || `message-${Math.random()}`,
    from,
    text: text || (message?.attachments?.length ? '📎 Archivo adjunto' : 'Mensaje'),
    createdAt: createdAtValue
      ? new Date(createdAtValue * 1000)
      : new Date(),
    authorName: from === 'incoming'
      ? String(contactName || senderName || 'Contacto').trim()
      : isCurrentUser
        ? 'Tú'
        : visibleSenderName || 'Equipo Montao',
    isCurrentUser,
  };
}

function sameIdentity(first: unknown, second: unknown): boolean {
  const normalize = (value: unknown) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('es');
  const normalizedFirst = normalize(first);
  const normalizedSecond = normalize(second);
  return !!normalizedFirst && normalizedFirst === normalizedSecond;
}
