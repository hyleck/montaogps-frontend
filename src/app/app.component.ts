import { Component, OnInit, OnDestroy } from '@angular/core';
import { ThemesService } from './shareds/services/themes.service';
import { AuthService } from './core/services/auth.service';
import { Router } from '@angular/router';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { FirebaseNotificationsService, PublicRegistrationNotification } from './core/services/firebase-notifications.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';
import { CommunicationNotificationService } from './core/services/communication-notification.service';
import { UserActivityService } from './core/services/user-activity.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  standalone: false
})
export class AppComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  public registrationNotificationVisible = false;
  public registrationNotification: PublicRegistrationNotification | null = null;

  constructor(
    public themes: ThemesService,
    private authService: AuthService,
    private router: Router,
    private firebaseNotifications: FirebaseNotificationsService,
    private http: HttpClient,
    private communicationNotifications: CommunicationNotificationService,
    private userActivityService: UserActivityService,
  ) {
    // this.themes.setTheme('light');
  }

  ngOnInit() {
    // Monitorear cambios en la autenticación
    this.monitorAuthentication();
    this.communicationNotifications.start();
    this.userActivityService.start();
    this.firebaseNotifications.publicRegistrationCompleted$
      .pipe(takeUntil(this.destroy$))
      .subscribe((notification) => {
        this.registrationNotification = notification;
        this.registrationNotificationVisible = true;
      });

  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();

    this.communicationNotifications.stop();
  }

  /**
   * Monitorea el estado de autenticación y las notificaciones de comunicación.
   */
  private monitorAuthentication(): void {
    // Verificar estado inicial
    this.handleAuthenticationChange().catch((error) =>
      console.error('Error handling auth change', error),
    );

    // Monitorear cambios en localStorage (login/logout)
    window.addEventListener('storage', (event) => {
      if (event.key === 'authtoken' || event.key === 'user') {
        this.handleAuthenticationChange().catch((error) =>
          console.error('Error handling auth change', error),
        );
      }
    });

    // También monitorear cambios directos en el servicio
    // Nota: Esto es un workaround ya que AuthService no emite eventos
    // En una implementación más robusta, AuthService debería usar BehaviorSubject
    setInterval(() => {
      this.handleAuthenticationChange().catch((error) =>
        console.error('Error handling auth change', error),
      );
    }, 5000); // Verificar cada 5 segundos

    // Verificar si la sesión es válida en la base de datos (cada 2 minutos)
    setInterval(() => {
      const user = this.authService.getCurrentUser();
      const sessionDate = localStorage.getItem('session_date');

      if (user && user.id && sessionDate && !this.authService.isSupportImpersonating()) {
        this.http.get<{ valid: boolean }>(`${environment.apiUrl}/users/${user.id}/verify-session?session_date=${sessionDate}`)
          .subscribe({
            next: (res: { valid: boolean }) => {
              if (!res.valid) {
                console.warn('La sesión ha sido invalidada desde el servidor. Cerrando sesión automáticamente...');
                this.authService.logout();
                this.router.navigate(['/auth/login']);
              }
            },
            error: (err: any) => console.error('Error verificando sesión:', err)
          });
      }
    }, 10000); // 10 segundos (10,000 ms)
  }

  /**
   * Maneja cambios en el estado de autenticación
   */
  private async handleAuthenticationChange(): Promise<void> {
    const isAuthenticated = this.authService.isAuthenticated();

    if (isAuthenticated) {
      await this.firebaseNotifications.subscribeLoggedUserToTopic();
    } else {
    }
  }

  copyRegistrationCredentials(): void {
    if (!this.registrationNotification) return;

    const text = [
      `Cliente: ${this.registrationNotification.clientName || 'Cliente'}`,
      `Usuario: ${this.registrationNotification.credentialsEmail || this.registrationNotification.clientEmail || ''}`,
      `Contraseña: ${this.registrationNotification.credentialsPassword || ''}`,
    ].join('\n');

    navigator.clipboard?.writeText(text).catch(() => undefined);
  }

}
