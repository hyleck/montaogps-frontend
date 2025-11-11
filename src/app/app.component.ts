import { Component, OnInit, OnDestroy } from '@angular/core';
import { ThemesService } from './shareds/services/themes.service';
import { AuthService } from './core/services/auth.service';
import { ChatwootService } from './core/services/chatwoot.service';
import { Router, NavigationEnd } from '@angular/router';
import { filter, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { FirebaseNotificationsService } from './core/services/firebase-notifications.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrl: './app.component.css',
    standalone: false
})
export class AppComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  constructor(
    public themes: ThemesService,
    private authService: AuthService,
    private chatwootService: ChatwootService,
    private router: Router,
    private firebaseNotifications: FirebaseNotificationsService
  ) {
    // this.themes.setTheme('light');
  }

  ngOnInit() {
    // Monitorear cambios en la autenticación
    this.monitorAuthentication();
    
    // Monitorear cambios de ruta para reinicializar Chatwoot si es necesario
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.handleRouteChange();
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    
    // Limpiar Chatwoot al destruir el componente
    this.chatwootService.removeChatwoot();
  }

  /**
   * Monitorea el estado de autenticación y gestiona Chatwoot
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
  }

  /**
   * Maneja cambios en el estado de autenticación
   */
  private async handleAuthenticationChange(): Promise<void> {
    const isAuthenticated = this.authService.isAuthenticated();
    
    if (isAuthenticated) {
      // Usuario está logueado, inicializar Chatwoot
      // this.chatwootService.initializeChatwoot();
      await this.firebaseNotifications.subscribeLoggedUserToTopic();
    } else {
      // Usuario no está logueado, remover Chatwoot
      // this.chatwootService.removeChatwoot();
    }
  }

  /**
   * Maneja cambios de ruta
   */
  private handleRouteChange(): void {
    // Si el usuario está autenticado y Chatwoot no está activo, reinicializarlo
    if (this.authService.isAuthenticated() && !this.chatwootService.isActive()) {
      setTimeout(() => {
        this.chatwootService.reinitialize();
      }, 1000); // Pequeño delay para asegurar que la ruta esté completamente cargada
    }
  }
}
