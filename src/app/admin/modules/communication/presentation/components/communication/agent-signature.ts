export function buildAgentSignatureLabel(
  name: string,
  department: string,
): string {
  const firstName = getAgentFirstName(name);
  const normalizedDepartment = String(department || '').trim();
  return normalizedDepartment
    ? `${firstName} - ${normalizedDepartment}`
    : firstName;
}

export function compactAgentSignatureLabel(signature: string): string {
  const normalized = String(signature || '').trim();
  if (!normalized) return '';
  if (/^(ester assistant|montao gps)$/i.test(normalized)) {
    return normalized;
  }

  const [name, ...departmentParts] = normalized.split(/\s+-\s+/);
  const firstName = getAgentFirstName(name);
  const department = departmentParts.join(' - ').trim();
  return department ? `${firstName} - ${department}` : firstName;
}

function getAgentFirstName(name: string): string {
  return String(name || '').trim().split(/\s+/)[0] || 'Agente';
}
