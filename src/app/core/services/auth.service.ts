import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment.development';
import { jwtDecode } from 'jwt-decode';
import { User, TokenPayload } from '../interfaces';
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

  constructor(
    private _httpClient: HttpClient, 
    private _router: Router,
    private themesService: ThemesService,
    private translate: TranslateService,
    private langService: LangService,
    private userService: UserService
  ) { }

  login(email: string, password: string): Observable<any> {
    return this._httpClient.post<any>(this.LOGIN_URL, { email, password }).pipe(
      tap(response => {
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
              console.log('Configurando ajustes del usuario');
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
  }

  private removeToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  private saveUser(user: User): void {
    try {
      // Guardar solo la información básica del usuario
      const basicUserInfo = {
        id: user.id,
        name: user.name,
        last_name: user.last_name,
        email: user.email,
        access_level_id: user.access_level_id
      };
      localStorage.setItem(this.USER_KEY, JSON.stringify(basicUserInfo));
      console.log('Información básica del usuario guardada en localStorage:', basicUserInfo);
    } catch (error) {
      console.error('Error al guardar usuario:', error);
    }
  }

  getCurrentUser(): User | null {
    try {
      const userStr = localStorage.getItem(this.USER_KEY);
      return userStr ? JSON.parse(userStr) : null;
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

  logout(): void {
    this.removeToken();
    localStorage.removeItem(this.USER_KEY);
  }
}