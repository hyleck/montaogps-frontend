import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  template: '<div>Redirigiendo...</div>',
  standalone: true
})
export class RedirectComponent implements OnInit {
  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/admin']);
    } else {
      this.router.navigate(['/auth/login']);
    }
  }
} 