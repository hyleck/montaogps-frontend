export interface ConversationMessageAttachmentPreview {
  file_type?: string;
  content_type?: string;
  name?: string;
}

export interface ConversationLastMessagePreview {
  id?: number | null;
  type?: string;
  direction?: 'incoming' | 'outgoing' | 'unknown';
  content?: string;
  transcription?: string;
  image_analysis?: string;
  video_analysis?: string;
  video_transcription?: string;
  attachments?: ConversationMessageAttachmentPreview[];
  contacts?: Array<{ name?: string }>;
  reaction?: { emoji?: string; sender_name?: string } | null;
  unsupported?: { kind?: string; subtype?: string } | null;
}

export interface ConversationListPreviewSource {
  last_message?: string;
  last_message_type?: number | null;
  last_message_preview?: ConversationLastMessagePreview | null;
}

export interface ConversationListPreviewView {
  kind: string;
  icon: string;
  label: string;
  text: string;
  direction: 'incoming' | 'outgoing' | 'unknown';
  audio: boolean;
}

function cleanText(value: unknown): string {
  let text = String(value || '').trim();
  if (!text) return '';

  const signed = text.match(/^>\s*([^\n]+)(?:\n([\s\S]*))?$/);
  if (signed) text = signed[2] || '';

  return text
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isMediaPlaceholder(value: string): boolean {
  return /^\[(?:audio|image|video|document|sticker)(?::[^\]]*)?\]$/i.test(value)
    || /^\[Archivo enviado por WhatsApp\]/i.test(value);
}

function attachmentKind(
  attachments: ConversationMessageAttachmentPreview[],
): string {
  const attachment = attachments[0];
  const fileType = String(attachment?.file_type || '').toLowerCase();
  const contentType = String(attachment?.content_type || '').toLowerCase();
  if (fileType === 'audio' || contentType.startsWith('audio/')) return 'audio';
  if (fileType === 'video' || contentType.startsWith('video/')) return 'video';
  if (fileType === 'image' || contentType.startsWith('image/')) return 'image';
  if (['file', 'document'].includes(fileType) || contentType) return 'document';
  return '';
}

function legacyKind(value: string): string {
  const match = value.match(
    /^\[Archivo enviado por WhatsApp\]\s*(image|video|audio|document)/i,
  );
  if (match) return match[1].toLowerCase();
  if (/^\[audio(?::[^\]]*)?\]$/i.test(value)) return 'audio';
  if (/^\[image(?::[^\]]*)?\]$/i.test(value)) return 'image';
  if (/^\[video(?::[^\]]*)?\]$/i.test(value)) return 'video';
  if (/^\[document(?::[^\]]*)?\]$/i.test(value)) return 'document';
  if (/^\[sticker(?::[^\]]*)?\]$/i.test(value)) return 'sticker';
  return '';
}

function normalizeKind(source: ConversationListPreviewSource): string {
  const preview = source.last_message_preview;
  const rawType = String(preview?.type || '').trim().toLowerCase();
  const aliases: Record<string, string> = {
    voice: 'audio',
    file: 'document',
    photo: 'image',
    contacts: 'contact',
    button: 'interactive',
  };
  const normalizedType = aliases[rawType] || rawType;
  if (normalizedType && normalizedType !== 'text') return normalizedType;
  return attachmentKind(preview?.attachments || [])
    || legacyKind(String(preview?.content || source.last_message || '').trim())
    || normalizedType
    || 'text';
}

function resolveDirection(
  source: ConversationListPreviewSource,
): 'incoming' | 'outgoing' | 'unknown' {
  const direction = source.last_message_preview?.direction;
  if (direction === 'incoming' || direction === 'outgoing') return direction;
  if (Number(source.last_message_type) === 0) return 'incoming';
  if (Number(source.last_message_type) === 1) return 'outgoing';
  return 'unknown';
}

export function buildConversationListPreview(
  source: ConversationListPreviewSource,
): ConversationListPreviewView {
  const preview = source.last_message_preview;
  const kind = normalizeKind(source);
  const direction = resolveDirection(source);
  const content = cleanText(preview?.content || source.last_message);
  const transcription = cleanText(preview?.transcription);
  const attachmentName = cleanText(preview?.attachments?.[0]?.name);
  const safeContent = isMediaPlaceholder(content) ? '' : content;

  switch (kind) {
    case 'audio':
      return {
        kind,
        icon: 'pi-volume-up',
        label: 'Audio',
        text: transcription || safeContent || 'Sin transcripción',
        direction,
        audio: true,
      };
    case 'image':
      return {
        kind,
        icon: 'pi-image',
        label: 'Foto',
        text: safeContent || cleanText(preview?.image_analysis) || 'Imagen',
        direction,
        audio: false,
      };
    case 'video':
      return {
        kind,
        icon: 'pi-video',
        label: 'Video',
        text: safeContent
          || cleanText(preview?.video_transcription)
          || cleanText(preview?.video_analysis)
          || 'Video',
        direction,
        audio: false,
      };
    case 'document':
      return {
        kind,
        icon: 'pi-file',
        label: 'Documento',
        text: safeContent || attachmentName || 'Archivo adjunto',
        direction,
        audio: false,
      };
    case 'location':
      return {
        kind,
        icon: 'pi-map-marker',
        label: 'Ubicación',
        text: safeContent.replace(/https?:\/\/\S+/g, '').trim() || 'Ubicación compartida',
        direction,
        audio: false,
      };
    case 'contact': {
      const names = (preview?.contacts || [])
        .map(contact => cleanText(contact?.name))
        .filter(Boolean)
        .join(', ');
      return {
        kind,
        icon: 'pi-user',
        label: 'Contacto',
        text: names || safeContent || 'Contacto compartido',
        direction,
        audio: false,
      };
    }
    case 'sticker':
      return {
        kind,
        icon: 'pi-face-smile',
        label: 'Sticker',
        text: safeContent || 'Sticker',
        direction,
        audio: false,
      };
    case 'reaction':
      return {
        kind,
        icon: 'pi-heart',
        label: 'Reacción',
        text: cleanText(preview?.reaction?.emoji) || safeContent || 'Reacción',
        direction,
        audio: false,
      };
    case 'template':
      return {
        kind,
        icon: 'pi-bookmark',
        label: 'Plantilla',
        text: safeContent || 'Plantilla enviada',
        direction,
        audio: false,
      };
    case 'interactive':
      return {
        kind,
        icon: 'pi-check-square',
        label: 'Respuesta',
        text: safeContent || 'Respuesta interactiva',
        direction,
        audio: false,
      };
    case 'unsupported':
    case 'unknown':
      return {
        kind,
        icon: 'pi-exclamation-circle',
        label: preview?.unsupported?.kind === 'poll' ? 'Encuesta' : 'Mensaje',
        text: safeContent || 'Tipo de mensaje no compatible',
        direction,
        audio: false,
      };
    default:
      return {
        kind: 'text',
        icon: 'pi-comment',
        label: '',
        text: safeContent || 'Sin mensajes',
        direction,
        audio: false,
      };
  }
}
