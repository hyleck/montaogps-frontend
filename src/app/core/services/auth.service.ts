import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap, switchMap, BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { jwtDecode } from 'jwt-decode';
import { User, BasicUser } from '../interfaces/user.interface';
import { TokenPayload } from '../interfaces/token-payload.interface';
import { ThemesService } from '../../shareds/services/themes.service';
import { TranslateService } from '@ngx-translate/core';
import { LangService } from '../../shareds/services/langi18/lang.service';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private LOGIN_URL = environment.apiUrl + '/auth/login';
  private readonly TOKEN_KEY = 'authtoken';
  private readonly USER_KEY = 'user';

  // BehaviorSubject para emitir cambios en el estado de autenticación
  private authStateSubject = new BehaviorSubject<boolean>(false);

  constructor(
    private _httpClient: HttpClient,
    private _router: Router,
    private themesService: ThemesService,
    private translate: TranslateService,
    private langService: LangService,
    private userService: UserService
  ) {
    // Inicializar el estado de autenticación
    this.authStateSubject.next(this.isAuthenticated());
  }

  /**
   * Observable para escuchar cambios en el estado de autenticación
   */
  get authState$(): Observable<boolean> {
    return this.authStateSubject.asObservable();
  }

  /**
   * Obtener el estado actual de autenticación
   */
  get isAuthenticatedValue(): boolean {
    return this.authStateSubject.value;
  }

  login(email: string, password: string): Observable<any> {
    const normalizedEmail = this.normalizeEmail(email);
    const normalizedPassword = this.normalizePassword(password);

    return this._httpClient.post<any>(this.LOGIN_URL, { email: normalizedEmail, password: normalizedPassword }).pipe(
      tap(response => {
        // 🔍 DEBUG: Imprimir respuesta completa del login
        console.log('🔍 DEBUG - RESPUESTA COMPLETA DEL LOGIN:', response);
        if (response.user) {
          console.log('🔍 DEBUG - USUARIO EN RESPUESTA DEL LOGIN:', response.user);
        }

        if (response.access_token) {
          this.saveToken(response.access_token);
          if (response.user) {
            // Guardar solo la información básica del usuario
            this.saveUser(response.user);
          }
        }
      }),
      switchMap(response => {
        if (response.user && response.user.id) {
          // Obtener datos completos solo para configuración inicial
          return this.userService.getById(response.user.id).pipe(
            tap(userData => {
              // 🔍 DEBUG: Imprimir usuario completo como llega del backend
              console.log('🔍 DEBUG - USUARIO COMPLETO DEL BACKEND:', userData);
              // Actualizar el usuario en localStorage con los privilegios completos
              this.updateUserWithPrivileges(userData);
              this.configureUserSettings(userData);
            }),
            // Devolver la respuesta original del login
            switchMap(() => new Observable(observer => observer.next(response)))
          );
        }
        return new Observable(observer => observer.next(response));
      })
    );
  }

  private configureUserSettings(userData: any) {
    if (userData.settings && Array.isArray(userData.settings) && userData.settings.length > 0) {
      const userSettings = userData.settings[0];

      // Configurar tema
      if (userSettings.theme) {
        this.themesService.setTheme(userSettings.theme);
      }

      // Configurar idioma
      if (userSettings.language) {
        this.langService.setLanguage(userSettings.language);
        this.translate.use(userSettings.language);
      }
    }
  }

  private getToken(): string {
    return localStorage.getItem(this.TOKEN_KEY) || '';
  }

  private saveToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    // Emitir cambio en el estado de autenticación
    this.authStateSubject.next(true);
  }

  private removeToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  private saveUser(user: BasicUser): void {
    try {
      // Convertir root y developer de string a boolean si es necesario
      // Manejamos tanto string como boolean del backend
      const userRoot = user.root as any;
      const userDeveloper = (user as any).developer as any;
      const rootBoolean = userRoot === "true" || userRoot === true;
      const developerBoolean = userDeveloper === "true" || userDeveloper === true;

      // Guardar solo la información básica del usuario
      const basicUserInfo = {
        id: user.id,
        name: user.name,
        last_name: user.last_name,
        email: this.normalizeEmail(user.email),
        access_level_id: user.access_level_id,
        affiliation_type_id: (user as any).affiliation_type_id || (user as any).affiliation_type,
        company_type_id: (user as any).company_type_id,
        company_type: (user as any).company_type,
        root: rootBoolean,
        developer: developerBoolean
      };

      // 🔍 DEBUG: Imprimir información del usuario que se va a guardar
      console.log('🔍 DEBUG - GUARDANDO USUARIO:', basicUserInfo);

      localStorage.setItem(this.USER_KEY, JSON.stringify(basicUserInfo));
    } catch (error) {
      console.error('Error al guardar usuario:', error);
    }
  }

  private updateUserWithPrivileges(completeUserData: any): void {
    try {
      // Obtener el usuario actual del localStorage directamente
      const userStr = localStorage.getItem(this.USER_KEY);
      const currentUser = userStr ? JSON.parse(userStr) : null;

      if (!currentUser) return;

      let privilegesToSave = completeUserData.privileges || [];

      // Si el usuario es root, generar todos los privilegios automáticamente
      if (currentUser.root === true) {
        privilegesToSave = this.generateAllPrivileges();
        console.log('🔍 DEBUG - USUARIO ROOT DETECTADO - GENERANDO TODOS LOS PRIVILEGIOS:', privilegesToSave);
      }

      // Agregar los privilegios, affiliation_type_id y access_level_id al usuario existente
      const updatedUser = {
        ...currentUser,
        privileges: privilegesToSave,
        affiliation_type_id: completeUserData.affiliation_type_id || completeUserData.affiliation_type,
        access_level_id: completeUserData.access_level_id
      };

      // 🔍 DEBUG: Imprimir usuario actualizado con privilegios
      console.log('🔍 DEBUG - ACTUALIZANDO USUARIO CON PRIVILEGIOS:', updatedUser);

      // Guardar el usuario actualizado en localStorage
      localStorage.setItem(this.USER_KEY, JSON.stringify(updatedUser));
    } catch (error) {
      console.error('Error al actualizar usuario con privilegios:', error);
    }
  }

  private generateAllPrivileges(): any[] {
    // Lista de todos los módulos disponibles en el sistema
    const modules = [
      'users',
      'devices',
      'roles',
      'system',
      'protocols',
      'plans',
      'servers',
      'colors',
      'brands',
      'models',
      'historiales',
      'sectors',
      'tags',
      'inventory'
    ];

    // Generar privilegios completos para cada módulo
    return modules.map((module, index) => ({
      module: module,
      actions: {
        create: true,
        read: true,
        update: true,
        delete: true,
        _id: `generated_action_${module}_${index}`
      },
      _id: `generated_privilege_${module}_${index}`
    }));
  }

  getCurrentUser(): BasicUser | null {
    try {
      const userStr = localStorage.getItem(this.USER_KEY);
      const user = userStr ? JSON.parse(userStr) : null;

      // 🔍 DEBUG: Imprimir toda la información del usuario logueado

      return user;
    } catch (error) {
      console.error('Error al obtener usuario:', error);
      return null;
    }
  }

  private isTokenExpired(token: string): boolean {
    const decodedToken = jwtDecode<TokenPayload>(token);
    const currentTime = Date.now() / 1000;
    return decodedToken.exp < currentTime;
  }

  private getExpirationTime(token: string): number {
    const decodedToken = jwtDecode<TokenPayload>(token);
    return decodedToken['exp'];
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    return !!token && !this.isTokenExpired(token);
  }

  // Método para verificar privilegios específicos
  hasPrivilege(module: string, action: string): boolean {
    const currentUser = this.getCurrentUser();
    if (!currentUser || !currentUser.privileges) return false;

    const modulePrivilege = currentUser.privileges.find(p => p.module === module);
    if (!modulePrivilege) return false;

    return modulePrivilege.actions[action as keyof typeof modulePrivilege.actions] === true;
  }

  // Método para obtener todos los privilegios de un módulo
  getModulePrivileges(module: string): any | null {
    const currentUser = this.getCurrentUser();
    if (!currentUser || !currentUser.privileges) return null;

    const modulePrivilege = currentUser.privileges.find(p => p.module === module);
    return modulePrivilege ? modulePrivilege.actions : null;
  }

  logout(): void {
    const rememberedEmail = localStorage.getItem('rememberedEmail');
    localStorage.clear();
    if (rememberedEmail) {
      localStorage.setItem('rememberedEmail', rememberedEmail);
    }
    // Emitir cambio en el estado de autenticación
    this.authStateSubject.next(false);
  }

  private normalizeEmail(value: string | undefined | null): string {
    return (value || '').trim().toLowerCase();
  }

  private normalizePassword(value: string | undefined | null): string {
    return (value || '').trim();
  }
}
