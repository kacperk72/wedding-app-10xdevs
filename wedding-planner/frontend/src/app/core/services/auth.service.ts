import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { AuthSession, LoginRequest, User } from '../models/user.model';
import { apiUrl } from '../http/api-url';

const TOKEN_STORAGE_KEY = 'wp.token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _user = signal<User | null>(null);
  readonly user = this._user.asReadonly();

  private readonly _token = signal<string | null>(this.readStoredToken());
  readonly token = this._token.asReadonly();

  readonly isAuthenticated = computed(() => this._token() !== null);

  login(req: LoginRequest): Observable<AuthSession> {
    return this.http
      .post<AuthSession>(apiUrl('/auth/login'), req)
      .pipe(tap((session) => this.setSession(session)));
  }

  me(): Observable<User> {
    return this.http
      .get<User>(apiUrl('/auth/me'))
      .pipe(tap((user) => this._user.set(user)));
  }

  refresh(): Observable<AuthSession> {
    return this.http
      .post<AuthSession>(apiUrl('/auth/refresh'), {})
      .pipe(tap((session) => this.setSession(session)));
  }

  logout(): void {
    this._user.set(null);
    this._token.set(null);
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // ignore storage failures (private mode, etc.)
    }
    this.router.navigateByUrl('/');
  }

  private setSession(session: AuthSession): void {
    this._user.set(session.user);
    this._token.set(session.token);
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, session.token);
    } catch {
      // ignore
    }
  }

  private readStoredToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  }
}
