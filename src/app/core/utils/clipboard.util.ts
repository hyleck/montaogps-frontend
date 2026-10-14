/**
 * Copies text even when the asynchronous Clipboard API is refused: browsers deny it
 * without permission or once the click that started a request is no longer recent.
 * The selection-based copy still works in those cases.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Falls back to copying a selection.
  }
  return copyWithSelection(text);
}

/** Synchronous copy; call it directly from a click to always keep the user activation. */
export function copyWithSelection(text: string): boolean {
  const active = document.activeElement as HTMLElement | null;
  // Inside a modal the textarea must stay within it so its focus trap does not steal focus.
  const host = active?.closest('.p-dialog') || document.body;
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.top = '0';
  field.style.left = '0';
  field.style.opacity = '0';
  field.style.pointerEvents = 'none';
  host.appendChild(field);
  field.focus({ preventScroll: true });
  field.select();
  field.setSelectionRange(0, text.length);
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  field.remove();
  active?.focus?.({ preventScroll: true });
  return copied;
}
