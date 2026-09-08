import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-sso-login',
  templateUrl: './sso-login.component.html',
  styleUrl: './sso-login.component.css',
  standalone: false
})
export class SsoLoginComponent implements OnInit {
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.authService.clearSessionForSso();

    const code = this.route.snapshot.queryParamMap.get('code');

    if (!code) {
      this.errorMessage = 'No se recibió una autorización válida.';
      return;
    }

    this.authService.exchangeIndexAuthorizationCode(code).subscribe({
      next: response => {
        const userId = response.user?.id || response.user?._id;
        const destination = userId
          ? ['/admin/management', 'u', userId]
          : ['/admin/dashboard'];
        void this.router.navigate(destination, { replaceUrl: true });
      },
      error: () => {
        this.errorMessage =
          'La autorización expiró o no pudo ser validada. Vuelve a abrir Montao GPS desde Index.';
      }
    });
  }
}
