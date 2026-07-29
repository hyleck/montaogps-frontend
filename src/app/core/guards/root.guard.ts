import { Injectable } from '@angular/core';
import { CanActivate, CanMatch, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class RootGuard implements CanActivate, CanMatch {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): boolean {
    return this.allowRootOnly();
  }

  canMatch(): boolean {
    return this.allowRootOnly();
  }

  private allowRootOnly(): boolean {
    const currentUser = this.authService.getCurrentUser();

    if (currentUser && currentUser.root === true) {
      return true;
    }

    // Redirect to dashboard if user is not root
    this.router.navigate(['/admin/dashboard']);
    return false;
  }
}
