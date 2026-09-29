import { formatUserName } from 'src/app/core/utils/user-name.util';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ThemesService } from './shareds/services/themes.service';
import { AuthService } from './core/services/auth.service';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { takeUntil } from 'rxjs/operators';
import { fromEvent, interval, Subject, Subscription } from 'rxjs';
import { isPublicRenewalRoute } from './core/utils/public-renewal-route.util';
import { FirebaseNotificationsService, PublicRegistrationNotification } from './core/services/firebase-notifications.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';
import { CommunicationNotificationService } from './core/services/communication-notification.service';
import { UserActivityService } from './core/services/user-activity.service';
import { DialogOverlayCleanupService } from './core/services/dialog-overlay-cleanup.service';
import { EmployeeMonitoringService } from './core/services/employee-monitoring.service';
import { UserConsoleLogService } from './core/services/user-console-log.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  standalone: false
})
export class AppComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private publicRenewalPage = false;
  private backgroundServicesStarted = false;
  private sessionRequest?: Subscription;
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
    private dialogOverlayCleanup: DialogOverlayCleanupService,
    private employeeMonitoring: EmployeeMonitoringService,
    private userConsoleLogs: UserConsoleLogService,
  ) {
    // this.themes.setTheme('light');
  }

  ngOnInit() {
    this.dialogOverlayCleanup.start();

    this.setPublicRenewalPage(isPublicRenewalRoute(window.location.pathname) || isPublicRenewalRoute(this.router.url));
    this.router.events.pipe(takeUntil(this.destroy$)).subscribe(event => {
      if (event instanceof NavigationStart && isPublicRenewalRoute(event.url)) {
        this.setPublicRenewalPage(true);
      } else if (event instanceof NavigationEnd) {
        this.setPublicRenewalPage(isPublicRenewalRoute(event.urlAfterRedirects));
      } else if (event instanceof NavigationCancel || event instanceof NavigationError) {
        this.setPublicRenewalPage(isPublicRenewalRoute(this.router.url));
      }
    });
    this.monitorAuthentication();
    this.firebaseNotifications.publicRegistrationCompleted$
      .pipe(takeUntil(this.destroy$))
      .subscribe((notification) => {
        if (this.publicRenewalPage) return;
        this.registrationNotification = notification;
        this.registrationNotificationVisible = true;
      });

  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();

    this.sessionRequest?.unsubscribe();
    this.communicationNotifications.stop();
    this.employeeMonitoring.stop();
    this.userActivityService.stop();
    this.userConsoleLogs.stop();
    this.dialogOverlayCleanup.cleanupNow();
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
    fromEvent<StorageEvent>(window, 'storage').pipe(takeUntil(this.destroy$)).subscribe(event => {
      if (event.key === 'authtoken' || event.key === 'user') {
        this.handleAuthenticationChange().catch(error => console.error('Error handling auth change', error));
      }
    });

    interval(5000).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.handleAuthenticationChange().catch(error => console.error('Error handling auth change', error));
    });

    interval(10000).pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (this.publicRenewalPage) return;
      const user = this.authService.getCurrentUser();
      const sessionDate = localStorage.getItem('session_date');
      if (user && user.id && sessionDate && !this.authService.isSupportImpersonating()) {
        this.sessionRequest?.unsubscribe();
        this.sessionRequest = this.http.get<{ valid: boolean }>(`${environment.apiUrl}/users/${user.id}/verify-session?session_date=${sessionDate}`)
          .subscribe({
            next: res => {
              if (!this.publicRenewalPage && !res.valid) {
                this.authService.logout();
                this.router.navigate(['/auth/login']);
              }
            },
            error: err => console.error('Error verificando sesión:', err),
          });
      }
    });
  }

  private setPublicRenewalPage(isPublic: boolean): void {
    this.publicRenewalPage = isPublic;
    if (isPublic) {
      this.sessionRequest?.unsubscribe();
      this.registrationNotificationVisible = false;
      this.registrationNotification = null;
      if (this.backgroundServicesStarted) {
        this.communicationNotifications.stop();
        this.userActivityService.stop();
        this.userConsoleLogs.stop();
        this.employeeMonitoring.stop();
        this.backgroundServicesStarted = false;
      }
    } else if (!this.backgroundServicesStarted) {
      this.communicationNotifications.start();
      this.userActivityService.start();
      this.userConsoleLogs.start();
      this.employeeMonitoring.start();
      this.backgroundServicesStarted = true;
    }
  }

  /**
   * Maneja cambios en el estado de autenticación
   */
  private async handleAuthenticationChange(): Promise<void> {
    if (this.publicRenewalPage) return;
    const isAuthenticated = this.authService.isAuthenticated();

    if (isAuthenticated) {
      await this.firebaseNotifications.subscribeLoggedUserToTopic();
    } else {
    }
  }

  copyRegistrationCredentials(): void {
    if (!this.registrationNotification) return;

    const text = [
      `Cliente: ${formatUserName(this.registrationNotification.clientName) || 'Cliente'}`,
      `Usuario: ${this.registrationNotification.credentialsEmail || this.registrationNotification.clientEmail || ''}`,
      `Contraseña: ${this.registrationNotification.credentialsPassword || ''}`,
    ].join('\n');

    navigator.clipboard?.writeText(text).catch(() => undefined);
  }

}
