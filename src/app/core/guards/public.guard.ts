import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class PublicGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(_: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    if (state.url.startsWith('/auth/sso')) {
      return true;
    }

    if (!this.authService.isAuthenticated()) {
      return true;
    }

    this.router.navigate(['/admin/dashboard']);
    return false;
  }
} 
