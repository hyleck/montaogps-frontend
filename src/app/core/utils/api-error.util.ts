export function getApiErrorMessage(error: any, fallback: string): string {
  const status = Number(error?.status || error?.error?.statusCode || 0);
  const payload = error?.error ?? error;
  const candidates = [
    payload?.message,
    payload?.error?.message,
    typeof payload?.error === 'string' ? payload.error : undefined,
    payload?.detail,
    payload?.reason,
    error?.cause?.message,
    error?.message,
  ];

  for (const candidate of candidates) {
    const message = normalizeMessage(candidate);
    if (message && !isAngularTransportMessage(message) && !isGenericMessage(message)) {
      return appendReference(message, payload?.requestId);
    }
  }

  if (status === 0) {
    return `${fallback}: no fue posible conectar con el servidor. Verifique la conexión a internet y que la API esté disponible.`;
  }
  if (status === 401) return 'La sesión expiró o no es válida. Inicie sesión nuevamente.';
  if (status === 403) return 'Su usuario no tiene permiso para realizar esta operación.';
  if (status === 404) return `${fallback}: el servidor no encontró el recurso solicitado (HTTP 404).`;
  if (status === 408 || status === 504) return `${fallback}: el servidor agotó el tiempo de espera (HTTP ${status}).`;
  if (status === 413) return `${fallback}: el archivo excede el tamaño máximo permitido (HTTP 413).`;
  if (status) {
    return appendReference(
      `${fallback}: el servidor respondió HTTP ${status} sin informar una causa específica.`,
      payload?.requestId,
    );
  }

  const localMessage = candidates.map(normalizeMessage).find(Boolean);
  return localMessage && !isAngularTransportMessage(localMessage)
    ? `${fallback}: ${localMessage}`
    : `${fallback}: la operación falló sin proporcionar detalles técnicos.`;
}

function normalizeMessage(value: any): string {
  if (Array.isArray(value)) return value.map(normalizeMessage).filter(Boolean).join(', ');
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return String(value).trim();
}

function isAngularTransportMessage(message: string): boolean {
  return /^Http failure response for /i.test(message) || message === '[object Object]';
}

function isGenericMessage(message: string): boolean {
  return /^(internal server error|error|unknown error|something went wrong|unable to (send a message|get all messages))\.?$/i.test(message.trim());
}

function appendReference(message: string, requestId: any): string {
  const reference = String(requestId || '').trim();
  return reference ? `${message} (referencia: ${reference})` : message;
}
