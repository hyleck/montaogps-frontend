import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from './auth.service';
import { BasicUser } from '../interfaces/user.interface';

@Injectable({
  providedIn: 'root'
})
export class ChatwootService {
  private isInitialized = false;
  private isScriptLoaded = false;

  constructor(
    private authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  /**
   * Inicializa el widget de Chatwoot solo si el usuario está autenticado
   */
  initializeChatwoot(): void {
    // Solo ejecutar en el navegador
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    // Verificar si el usuario está autenticado
    if (!this.authService.isAuthenticated()) {
      this.removeChatwoot();
      return;
    }

    // Evitar inicialización múltiple
    if (this.isInitialized) {
      return;
    }

    try {
      // 1. Configurar las opciones de Chatwoot
      (window as any).chatwootSettings = {
        position: 'right',
        type: 'expanded_bubble',
        launcherTitle: 'Ayuda'
      };

      // 2. Inyectar dinámicamente el script de Chatwoot si no existe ya
      const existingScript = document.querySelector('script[src="https://team.montao.net/packs/js/sdk.js"]');
      if (!existingScript && !this.isScriptLoaded) {
        this.loadChatwootScript();
      } else if (this.isScriptLoaded) {
        // Si el script ya está cargado, solo inicializar
        this.initializeChatwootWidget();
      }
    } catch (error) {
      console.error('Error al inicializar Chatwoot:', error);
    }
  }

  /**
   * Carga el script de Chatwoot
   */
  private loadChatwootScript(): void {
    const script = document.createElement('script');
    script.src = 'https://team.montao.net/packs/js/sdk.js';
    script.defer = true;
    script.async = true;

    script.onload = () => {
      this.isScriptLoaded = true;
      this.initializeChatwootWidget();
    };

    script.onerror = (error) => {
      console.error('Error al cargar el script de Chatwoot:', error);
    };

    document.head.appendChild(script);
  }

  /**
   * Inicializa el widget de Chatwoot después de cargar el script
   */
  private initializeChatwootWidget(): void {
    try {
      // Verificar que el SDK esté disponible
      if (!(window as any).chatwootSDK) {
        console.warn('Chatwoot SDK no está disponible aún');
        return;
      }

      // 3. Inicializar Chatwoot
      (window as any).chatwootSDK.run({
        websiteToken: 'ii4Q2GJsKMLXn5Y9B9Es2AzA',
        baseUrl: 'https://team.montao.net'
      });

      // 4. Escuchar el evento "chatwoot:ready"
      window.addEventListener('chatwoot:ready', () => {
        this.setUserData();
      });

      this.isInitialized = true;
      console.log('✅ Chatwoot inicializado correctamente');
    } catch (error) {
      console.error('Error al inicializar el widget de Chatwoot:', error);
    }
  }

  /**
   * Establece los datos del usuario en Chatwoot
   */
  private setUserData(): void {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        console.warn('No se pudo obtener información del usuario para Chatwoot');
        return;
      }

      // Verificar que el widget esté disponible
      if (!(window as any).$chatwoot) {
        console.warn('Chatwoot widget no está disponible aún');
        return;
      }

      // 5. Establecer los datos del usuario
      (window as any).$chatwoot.setUser(currentUser.id, {
        email: currentUser.email,
        name: `${currentUser.name} ${currentUser.last_name}`.trim(),
      });

      console.log('✅ Datos del usuario establecidos en Chatwoot:', {
        id: currentUser.id,
        email: currentUser.email,
        name: `${currentUser.name} ${currentUser.last_name}`.trim()
      });
    } catch (error) {
      console.error('Error al establecer datos del usuario en Chatwoot:', error);
    }
  }

  /**
   * Remueve el widget de Chatwoot
   */
  removeChatwoot(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      // Remover el script si existe
      const existingScript = document.querySelector('script[src="https://team.montao.net/packs/js/sdk.js"]');
      if (existingScript) {
        existingScript.remove();
      }

      // Limpiar variables globales
      if ((window as any).chatwootSettings) {
        delete (window as any).chatwootSettings;
      }

      if ((window as any).chatwootSDK) {
        delete (window as any).chatwootSDK;
      }

      if ((window as any).$chatwoot) {
        delete (window as any).$chatwoot;
      }

      // Resetear estado
      this.isInitialized = false;
      this.isScriptLoaded = false;

      console.log('🧹 Chatwoot removido correctamente');
    } catch (error) {
      console.error('Error al remover Chatwoot:', error);
    }
  }

  /**
   * Verifica si el widget está activo
   */
  isActive(): boolean {
    return this.isInitialized && this.isScriptLoaded;
  }

  /**
   * Método público para forzar la reinicialización
   */
  reinitialize(): void {
    this.isInitialized = false;
    this.isScriptLoaded = false;
    this.initializeChatwoot();
  }
}
