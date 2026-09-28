/** Format a user's name for display without changing the stored/API value. */
export function formatUserName(value: unknown): string {
  if (value == null) return '';
  if (typeof value !== 'string') return typeof value === 'number' ? String(value) : '';
  return value.trim().split(/(\s+)/u).map(word => {
    // Names sometimes fall back to an email or an account identifier.
    if (word.includes('@') || /^[a-f\d]{24}$/iu.test(word) || /^https?:\/\//iu.test(word)) return word;
    return word.toLocaleLowerCase('es').replace(/(^|[\p{Pd}'’])(\p{L})/gu,
      (_match, separator: string, letter: string) => separator + letter.toLocaleUpperCase('es'));
  }).join('');
}
