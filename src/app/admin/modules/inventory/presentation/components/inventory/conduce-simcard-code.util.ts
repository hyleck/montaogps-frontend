export function isNationalSimCompany(value: unknown): boolean {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  return normalized === 'nacionales' || normalized === 'nacional';
}

export function formatConduceSimcardCode(
  value: unknown,
  simCompany: unknown,
): string {
  const originalValue = String(value || '').trim();
  if (!originalValue) return 'N/A';
  if (!isNationalSimCompany(simCompany)) return originalValue;

  const digits = originalValue.replace(/\D/g, '');
  if (!digits) return originalValue;

  const seed = digits
    .split('')
    .reduce(
      (total, digit, index) =>
        (total + Number(digit) * (index + 3)) % 10,
      0,
    );
  const groups: string[] = [];

  for (let index = 0; index < digits.length; index += 2) {
    const pair = digits.slice(index, index + 2);
    const firstDigit = Number(pair[0] || 0);
    const secondDigit = Number(pair[1] || 0);
    const groupIndex = index / 2;
    const decoyDigit =
      (
        seed
        + firstDigit * 3
        + secondDigit * 7
        + groupIndex * 5
      ) % 10;

    groups.push(`${decoyDigit}${pair}`);
  }

  return groups.join(' ');
}
