import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment.development';
import { jwtDecode } from 'jwt-decode';

interface TokenPayload {
  user: string;
  exp: number;
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private LOGIN_URL = environment.backend_url + '/auth/login';
  private readonly TOKEN_KEY = 'authtoken';

  constructor(private _httpClient: HttpClient, private _router: Router) { }

  login(email: string, password: string): Observable<any> {
    return this._httpClient.post<any>(this.LOGIN_URL, { email, password }).pipe(
      tap(response => {
        if (response.access_token) {
          this.saveToken(response.access_token);
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

  private getUser(): string | null {
    const token = this.getToken();
    if (token) {
      const decodedToken = jwtDecode<TokenPayload>(token);
      return decodedToken.user;
    }
    return null;
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
  }
}