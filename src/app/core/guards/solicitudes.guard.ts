import { Injectable } from '@angular/core';
import { CanActivate, CanMatch, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class SolicitudesGuard implements CanActivate, CanMatch {
  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  canActivate(): boolean {
    return this.canOpenSolicitudes();
  }

  canMatch(): boolean {
    return this.canOpenSolicitudes();
  }

  private canOpenSolicitudes(): boolean {
    const user: any = this.authService.getCurrentUser();
    const elevated = [user?.root, user?.developer]
      .some(value => value === true || ['true', '1'].includes(String(value || '').toLowerCase()));
    const affiliation = String(user?.affiliation_type_id || '').trim().toLowerCase();
    if (user && (elevated || affiliation === 'empleado' || affiliation === 'admin')) {
      return true;
    }
    void this.router.navigate(['/admin/dashboard']);
    return false;
  }
}
