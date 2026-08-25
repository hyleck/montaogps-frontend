import { buildConversationListPreview } from './conversation-list-preview';

describe('buildConversationListPreview', () => {
  it('uses an incoming audio transcription and marks it as audio', () => {
    expect(buildConversationListPreview({
      last_message: '',
      last_message_type: 0,
      last_message_preview: {
        type: 'audio',
        direction: 'incoming',
        content: '[audio: nota-de-voz.ogg]',
        transcription: 'Necesito ayuda con mi GPS.',
      },
    })).toEqual(jasmine.objectContaining({
      kind: 'audio',
      label: 'Audio',
      text: 'Necesito ayuda con mi GPS.',
      direction: 'incoming',
      audio: true,
    }));
  });

  it('keeps an outgoing employee message as the current preview', () => {
    expect(buildConversationListPreview({
      last_message: '> Chanel Montao\nYa verificamos tu equipo.',
      last_message_type: 1,
      last_message_preview: {
        type: 'text',
        direction: 'outgoing',
        content: '> Chanel Montao\nYa verificamos tu equipo.',
      },
    })).toEqual(jasmine.objectContaining({
      kind: 'text',
      text: 'Ya verificamos tu equipo.',
      direction: 'outgoing',
    }));
  });

  ([
    ['image', 'Foto', 'pi-image'],
    ['video', 'Video', 'pi-video'],
    ['document', 'Documento', 'pi-file'],
    ['location', 'Ubicación', 'pi-map-marker'],
    ['contacts', 'Contacto', 'pi-user'],
    ['sticker', 'Sticker', 'pi-face-smile'],
    ['template', 'Plantilla', 'pi-bookmark'],
    ['interactive', 'Respuesta', 'pi-check-square'],
    ['unsupported', 'Mensaje', 'pi-exclamation-circle'],
  ] as const).forEach(([type, label, icon]) => {
    it(`represents a ${type} message with its own visual type`, () => {
      expect(buildConversationListPreview({
        last_message_preview: {
          type,
          direction: 'incoming',
          content: type === 'location'
            ? 'Taller principal\nhttps://maps.google.com/?q=1,2'
            : 'Contenido',
        },
      })).toEqual(jasmine.objectContaining({ label, icon }));
    });
  });

  it('recognizes a legacy audio attachment even without new metadata', () => {
    expect(buildConversationListPreview({
      last_message: '[Archivo enviado por WhatsApp]\naudio\nnota.ogg\nhttps://example.com/audio',
      last_message_type: 1,
    })).toEqual(jasmine.objectContaining({
      kind: 'audio',
      label: 'Audio',
      direction: 'outgoing',
    }));
  });
});
