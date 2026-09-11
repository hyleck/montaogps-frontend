import { Injectable } from '@angular/core';
import { CanActivate, CanMatch, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class ComprobantesGuard implements CanActivate, CanMatch {
  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  canActivate(): boolean {
    return this.canOpenComprobantes();
  }

  canMatch(): boolean {
    return this.canOpenComprobantes();
  }

  private canOpenComprobantes(): boolean {
    const user: any = this.authService.getCurrentUser();
    const elevated = [user?.root, user?.developer]
      .some(value => value === true || ['true', '1'].includes(String(value || '').toLowerCase()));
    const affiliation = String(
      user?.affiliation_type_id || user?.affiliation_type || '',
    ).trim().toLowerCase();

    if (user && (elevated || affiliation === 'empleado')) {
      return true;
    }

    void this.router.navigate(['/admin/dashboard']);
    return false;
  }
}
