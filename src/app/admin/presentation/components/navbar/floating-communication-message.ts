export interface FloatingCommunicationAttachment {
  url: string;
  fileType: 'image' | 'video' | 'audio' | 'file';
  mimeType: string;
  name: string;
}

export interface FloatingCommunicationMessage {
  id: number | string;
  from: 'incoming' | 'me' | 'system';
  text: string;
  createdAt: Date;
  authorName: string;
  isCurrentUser: boolean;
  attachments: FloatingCommunicationAttachment[];
  transcription: string;
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
  const rawAttachments: any[] = Array.isArray(message?.attachments) ? message.attachments : [];
  const attachments: FloatingCommunicationAttachment[] = rawAttachments
    .map(normalizeFloatingCommunicationAttachment)
    .filter((attachment: FloatingCommunicationAttachment | null): attachment is FloatingCommunicationAttachment => !!attachment);
  const hasAudioAttachment = attachments.some(attachment => attachment.fileType === 'audio');
  const transcription = hasAudioAttachment
    ? normalizeAudioTranscription(message?.transcription || text)
    : '';

  return {
    id: Number(message?.id || 0) || `message-${Math.random()}`,
    from,
    text: hasAudioAttachment ? '' : text || (attachments.length ? '' : 'Mensaje'),
    createdAt: createdAtValue
      ? new Date(createdAtValue * 1000)
      : new Date(),
    authorName: from === 'incoming'
      ? String(contactName || senderName || 'Contacto').trim()
      : isCurrentUser
        ? 'Tú'
        : visibleSenderName || 'Equipo Montao',
    isCurrentUser,
    attachments,
    transcription,
  };
}

function normalizeAudioTranscription(value: unknown): string {
  let transcription = String(value || '')
    .replace(/\s*\[audio\s*:[^\]]+\]\s*/gi, '\n')
    .trim();
  if (!transcription) return '';

  const signatureMatch = transcription.match(/^>\s*[^\n]+(?:\r?\n([\s\S]*))?$/);
  if (signatureMatch) {
    transcription = String(signatureMatch[1] || '').trim();
  }
  return transcription;
}

function normalizeFloatingCommunicationAttachment(
  attachment: any,
): FloatingCommunicationAttachment | null {
  const url = String(attachment?.data_url || attachment?.url || '').trim();
  if (!url) return null;

  const mimeType = String(
    attachment?.content_type || attachment?.mimeType || attachment?.mimetype || '',
  ).trim().toLowerCase();
  const rawType = String(attachment?.file_type || attachment?.fileType || '').trim().toLowerCase();
  const urlWithoutQuery = url.toLowerCase().split(/[?#]/)[0];
  let fileType: FloatingCommunicationAttachment['fileType'] = 'file';

  if (rawType === 'image' || mimeType.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp|svg)$/.test(urlWithoutQuery)) {
    fileType = 'image';
  } else if (rawType === 'video' || mimeType.startsWith('video/') || /\.(mp4|mov|m4v|webm|avi|mkv)$/.test(urlWithoutQuery)) {
    fileType = 'video';
  } else if (rawType === 'audio' || mimeType.startsWith('audio/') || /\.(mp3|m4a|aac|ogg|oga|wav|opus)$/.test(urlWithoutQuery)) {
    fileType = 'audio';
  }

  const explicitName = String(
    attachment?.file_name || attachment?.name || attachment?.filename || '',
  ).trim();
  const nameFromUrl = url.startsWith('data:')
    ? ''
    : decodeUrlFileName(url);

  return {
    url,
    fileType,
    mimeType,
    name: explicitName || nameFromUrl || defaultAttachmentName(fileType, mimeType),
  };
}

function decodeUrlFileName(url: string): string {
  const rawName = String(url).split(/[?#]/)[0].split('/').pop() || '';
  try {
    return decodeURIComponent(rawName);
  } catch {
    return rawName;
  }
}

function defaultAttachmentName(
  fileType: FloatingCommunicationAttachment['fileType'],
  mimeType: string,
): string {
  if (mimeType === 'application/pdf') return 'Documento PDF';
  if (fileType === 'image') return 'Imagen';
  if (fileType === 'video') return 'Video';
  if (fileType === 'audio') return 'Audio';
  return 'Archivo adjunto';
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
