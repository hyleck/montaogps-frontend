import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment.development';
import { jwtDecode } from 'jwt-decode';
import { User, TokenPayload } from '../interfaces';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private LOGIN_URL = environment.apiUrl + '/auth/login';
  private readonly TOKEN_KEY = 'authtoken';
  private readonly USER_KEY = 'user';

  constructor(private _httpClient: HttpClient, private _router: Router) { }

  login(email: string, password: string): Observable<any> {
    return this._httpClient.post<any>(this.LOGIN_URL, { email, password }).pipe(
      tap(response => {
        console.log('Respuesta del login:', response);
        if (response.access_token) {
          this.saveToken(response.access_token);
          if (response.user) {
            console.log('Guardando información del usuario:', response.user);
            this.saveUser(response.user);
          }
        }
      })
    );
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
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      console.log('Usuario guardado en localStorage:', user);
    } catch (error) {
      console.error('Error al guardar usuario:', error);
    }
  }

  getCurrentUser(): User | null {
    try {
      const userStr = localStorage.getItem(this.USER_KEY);
      console.log('Usuario recuperado del localStorage:', userStr);
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