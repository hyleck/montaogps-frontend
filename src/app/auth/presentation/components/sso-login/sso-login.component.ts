import { Component, isDevMode, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';

/** Tiempo mínimo del esqueleto: deja ver la animación completa aunque Index responda al instante. */
export const MIN_SKELETON_MS = 1800;

@Component({
  selector: 'app-sso-login',
  templateUrl: './sso-login.component.html',
  styleUrl: './sso-login.component.css',
  standalone: false
})
export class SsoLoginComponent implements OnInit, OnDestroy {
  readonly error = signal('');
  readonly step = signal(0);
  readonly steps = ['Conectando con Montao Index', 'Preparando tu flota', 'Abriendo Gestión'];

  // Medidas del esqueleto: imitan el riel del sidebar, la lista de Gestión y el mapa reales.
  readonly menuItems = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  readonly navbarIcons = [0, 1, 2, 3];
  readonly userCards = [
    { title: 64, text: 82 },
    { title: 52, text: 70 },
    { title: 72, text: 88 },
    { title: 58, text: 64 },
    { title: 66, text: 78 },
  ];
  // Vehículos sobre el mapa (posición en % del mapa); el primero es el seleccionado.
  readonly vehicles = [
    { x: 46, y: 44 },
    { x: 28, y: 64 },
    { x: 63, y: 30 },
    { x: 72, y: 62 },
    { x: 36, y: 26 },
    { x: 84, y: 40 },
  ];

  private readonly timers: ReturnType<typeof setTimeout>[] = [];
  private exchange?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  /** Mensaje de error visible (vacío mientras el acceso sigue en curso). */
  get errorMessage(): string {
    return this.error();
  }

  ngOnInit(): void {
    this.timers.push(
      setTimeout(() => this.step.set(1), 700),
      setTimeout(() => this.step.set(2), 1400)
    );

    // Solo en desarrollo: /auth/sso?preview=1 muestra el esqueleto sin tocar la sesión ni canjear códigos.
    if (isDevMode() && this.route.snapshot.queryParamMap.get('preview') === '1') return;

    this.authService.clearSessionForSso();

    const code = this.route.snapshot.queryParamMap.get('code');

    if (!code) {
      this.fail('No se recibió una autorización válida. Vuelve a abrir Montao GPS desde Index.');
      return;
    }

    const minimum = new Promise<void>(done => this.timers.push(setTimeout(done, MIN_SKELETON_MS)));

    this.exchange = this.authService.exchangeIndexAuthorizationCode(code).subscribe({
      next: async response => {
        const userId = response.user?.id || response.user?._id;
        const destination = userId
          ? ['/admin/management', 'u', userId]
          : ['/admin/dashboard'];
        await minimum;
        void this.router.navigate(destination, { replaceUrl: true });
      },
      error: () => {
        this.fail('La autorización expiró o no pudo ser validada. Vuelve a abrir Montao GPS desde Index.');
      }
    });
  }

  ngOnDestroy(): void {
    this.timers.forEach(clearTimeout);
    this.exchange?.unsubscribe();
  }

  private fail(message: string): void {
    this.timers.forEach(clearTimeout);
    this.error.set(message);
  }
}
