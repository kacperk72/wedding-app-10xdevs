import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, of, tap } from 'rxjs';
import { User } from '../models/user.model';
import { apiUrl } from '../http/api-url';

const TOKEN_STORAGE_KEY = 'wp.token';
const SSO_BASE_URL = 'https://kubitksso.pl';
const SSO_APP = 'wedding-planner';

type MaybeToken = string | null | undefined;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _user = signal<User | null>(null);
  readonly user = this._user.asReadonly();

  private readonly _token = signal<string | null>(this.readInitialToken());
  readonly token = this._token.asReadonly();

  readonly isAuthenticated = computed(() => this._token() !== null);

  me(): Observable<User> {
    return this.http.get<User>(apiUrl('/me')).pipe(tap((user) => this._user.set(user)));
  }

  ensureUser(): Observable<User | null> {
    const user = this._user();
    if (user) return of(user);
    if (!this._token()) return of(null);
    return this.me();
  }

  loginWithSso(returnPath = '/app'): void {
    const redirect = new URL(returnPath, window.location.origin).toString();
    window.location.href = `${SSO_BASE_URL}/login?app=${encodeURIComponent(
      SSO_APP,
    )}&redirect=${encodeURIComponent(redirect)}`;
  }

  logout(): void {
    this._user.set(null);
    this._token.set(null);
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
    window.location.href = `${SSO_BASE_URL}/logout?app=${encodeURIComponent(SSO_APP)}`;
  }

  clearSession(): void {
    this._user.set(null);
    this._token.set(null);
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
    this.router.navigateByUrl('/');
  }

  private readInitialToken(): string | null {
    const token = this.consumeTokenFromUrl() || this.readTokenFromSdk() || this.readStoredToken();
    if (token) this.storeToken(token);
    return token;
  }

  private consumeTokenFromUrl(): string | null {
    const fragment = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    if (!fragment) return null;

    const params = new URLSearchParams(fragment);
    const token =
      params.get('access_token') ||
      params.get('token') ||
      params.get('sso_token') ||
      params.get('jwt') ||
      params.get('sso_code');

    if (token) {
      history.replaceState(null, document.title, window.location.pathname + window.location.search);
    }
    return token;
  }

  private readTokenFromSdk(): MaybeToken {
    const win = window as typeof window & {
      KubitSSO?: { token?: string; getToken?: () => MaybeToken };
      SSO?: { token?: string; getToken?: () => MaybeToken };
      sso?: { token?: string; getToken?: () => MaybeToken };
    };
    return (
      win.KubitSSO?.getToken?.() ||
      win.KubitSSO?.token ||
      win.SSO?.getToken?.() ||
      win.SSO?.token ||
      win.sso?.getToken?.() ||
      win.sso?.token ||
      null
    );
  }

  private readStoredToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private storeToken(token: string): void {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch {
      // ignore storage failures
    }
  }
}
