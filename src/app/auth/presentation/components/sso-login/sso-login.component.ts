import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { getApiErrorMessage } from '../../../../core/utils/api-error.util';

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

    const token = this.route.snapshot.queryParamMap.get('token');
    const user = this.route.snapshot.queryParamMap.get('user');
    const sessionDate = this.route.snapshot.queryParamMap.get('session_date') || undefined;

    if (!token) {
      this.errorMessage = 'No se recibió una sesión válida.';
      return;
    }

    if (!user) {
      this.errorMessage = 'No se recibió el usuario de la sesión.';
      return;
    }

    try {
      const parsedUser = JSON.parse(decodeURIComponent(user));
      const userId = parsedUser.id || parsedUser._id;

      if (!userId) {
        this.errorMessage = 'No se recibió el identificador del usuario.';
        return;
      }

      this.authService.completeSsoLogin(token, parsedUser, sessionDate).subscribe({
        next: () => void this.router.navigate(['/admin/management', 'u', userId], { replaceUrl: true }),
        error: (error) => {
          this.errorMessage = getApiErrorMessage(error, 'No se pudieron cargar los permisos del usuario');
        }
      });
    } catch (error) {
      this.errorMessage = getApiErrorMessage(error, 'No se pudo leer el usuario de la sesión');
    }
  }
}
