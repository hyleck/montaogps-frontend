const TYPE_LABELS: Record<string, string> = {
  cliente: 'Cliente',
  subcliente: 'Subcliente',
  empleado: 'Empleado',
  tecnico: 'Técnico',
  tecnico_empleado: 'Técnico empleado',
  personal: 'Personal',
  empresa: 'Empresa',
  compartido: 'Compartido',
};

export function buildCustomerSignatureLabel(
  user: any,
  fallbackName = 'Cliente',
): string {
  const firstName = getFirstName(user?.name || fallbackName);
  if (!user?._id) {
    return `${firstName} - Contacto/WhatsApp`;
  }

  const affiliation = formatTypeLabel(
    user?.affiliation_type_id
      || user?.affiliation_type
      || user?.settings?.affiliation_type
      || 'cliente',
  );
  const profile = formatTypeLabel(
    user?.profile_type_id
      || user?.profile_type
      || user?.settings?.profile_type
      || 'personal',
  );

  return `${firstName} - ${affiliation}/${profile}`;
}

function getFirstName(value: unknown): string {
  return String(value || '')
    .trim()
    .split(/\s+/)[0]
    || 'Cliente';
}

function formatTypeLabel(value: unknown): string {
  const normalized = String(value || '')
    .trim()
    .toLocaleLowerCase('es-DO')
    .replace(/[\s-]+/g, '_');
  if (!normalized) return 'Sin definir';
  if (TYPE_LABELS[normalized]) return TYPE_LABELS[normalized];

  const readable = normalized.replace(/_/g, ' ');
  return readable.charAt(0).toLocaleUpperCase('es-DO') + readable.slice(1);
}
