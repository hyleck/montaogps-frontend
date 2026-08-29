import { mapFloatingCommunicationMessage } from './floating-communication-message';

describe('mapFloatingCommunicationMessage', () => {
  const currentUser = {
    id: 'frankely-id',
    name: 'Frankely',
    last_name: 'Garcia Diaz',
    email: 'frankely@montao.net',
  };

  it('keeps the real author for an outgoing message sent by another employee', () => {
    const result = mapFloatingCommunicationMessage({
      id: 10,
      from: 'outgoing',
      sender: 'AYLINE NACHELL MADERA MARTINEZ',
      sender_id: 'ayline-id',
      content: 'Ayline Nachell Madera Martinez: Buenas tardes',
      created_at: 1788012000,
    }, currentUser, 'Yoeli Bernabe');

    expect(result.authorName).toBe('Ayline Nachell Madera Martinez');
    expect(result.isCurrentUser).toBeFalse();
    expect(result.text).toBe('Buenas tardes');
  });

  it('uses Tú only when the stored sender id belongs to the signed-in user', () => {
    const result = mapFloatingCommunicationMessage({
      id: 11,
      from: 'outgoing',
      sender: 'Frankely Garcia Diaz',
      sender_id: 'frankely-id',
      content: 'Mensaje propio',
    }, currentUser, 'Yoeli Bernabe');

    expect(result.authorName).toBe('Tú');
    expect(result.isCurrentUser).toBeTrue();
  });

  it('uses the historical message signature when sender metadata is absent', () => {
    const result = mapFloatingCommunicationMessage({
      id: 12,
      from: 'outgoing',
      content: '> Carmen Severino Hidalgo\nMensaje anterior',
    }, currentUser, 'Yoeli Bernabe');

    expect(result.authorName).toBe('Carmen Severino Hidalgo');
    expect(result.text).toBe('Mensaje anterior');
  });

  it('labels incoming messages with the contact name', () => {
    const result = mapFloatingCommunicationMessage({
      id: 13,
      from: 'incoming',
      sender: 'Perfil de WhatsApp',
      content: 'Hola',
    }, currentUser, 'Yoeli Bernabe Valdez');

    expect(result.authorName).toBe('Yoeli Bernabe Valdez');
  });

  it('preserves documents so the floating chat can open the real file', () => {
    const result = mapFloatingCommunicationMessage({
      id: 14,
      from: 'incoming',
      content: '',
      attachments: [{
        data_url: 'https://files.montao.net/documentos/reporte%20gps.pdf?token=abc',
        file_type: 'file',
        content_type: 'application/pdf',
        name: 'Reporte del GPS.pdf',
      }],
    }, currentUser, 'Elvin Estevez');

    expect(result.text).toBe('');
    expect(result.attachments).toEqual([{
      url: 'https://files.montao.net/documentos/reporte%20gps.pdf?token=abc',
      fileType: 'file',
      mimeType: 'application/pdf',
      name: 'Reporte del GPS.pdf',
    }]);
    expect(result.transcription).toBe('');
  });

  it('shows the transcription delivered with an audio attachment', () => {
    const result = mapFloatingCommunicationMessage({
      id: 15,
      from: 'incoming',
      content: '[audio:https://files.montao.net/notas/voz.ogg]',
      transcription: 'El GPS no está actualizando desde anoche.',
      attachments: [{
        data_url: 'https://files.montao.net/notas/voz.ogg',
        file_type: 'audio',
        content_type: 'audio/ogg',
      }],
    }, currentUser, 'Elvin Estevez');

    expect(result.text).toBe('');
    expect(result.transcription).toBe('El GPS no está actualizando desde anoche.');
    expect(result.attachments[0].fileType).toBe('audio');
  });
});
