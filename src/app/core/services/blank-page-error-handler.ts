import { ErrorHandler, Injectable } from '@angular/core';

/**
 * Keeps Angular's console logging and also tells the boot screen about the
 * error. The boot screen only appears if the page is left empty — for example a
 * screen whose code an older browser cannot load — so ordinary errors on a page
 * with content change nothing for the user.
 */
@Injectable()
export class BlankPageErrorHandler extends ErrorHandler {
  override handleError(error: unknown): void {
    super.handleError(error);
    try {
      const message = (error as any)?.message || (error as any)?.rejection?.message || String(error || '');
      (window as any).montaoFalloDeNavegacion?.(String(message));
    } catch {
      // Reporting must never add a second failure.
    }
  }
}
