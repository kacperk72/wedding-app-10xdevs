import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, Subject, of, race, tap, timer, take, map, catchError } from 'rxjs';
import { User } from '../models/user.model';
import { apiUrl } from '../http/api-url';
import { SKIP_TOAST_HEADER } from '../http/error.interceptor';

// Contract: see SSO/backend/public/sdk/sso-sdk.js. SDK exposes window.SSOAuth
// after script tag in index.html resolves. We do NOT reimplement the protocol
// (code exchange, state CSRF, refresh rotation) — SDK owns all of it.
interface SsoSdk {
  login: (returnUrl?: string) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  getToken: () => string | null;
  getSubscription: () => Record<string, unknown> | null;
  isAuthenticated: () => boolean;
  hasAppAccess: (slug: string) => boolean;
  onAuthChange: (fn: (sub: Record<string, unknown> | null) => void) => () => void;
}

const SDK_INIT_TIMEOUT_MS = 1500;

function getSdk(): SsoSdk | null {
  const sdk = (window as unknown as { SSOAuth?: SsoSdk }).SSOAuth;
  if (!sdk) {
    console.error(
      '[AuthService] window.SSOAuth is not defined. Check the <script> tag in index.html.',
    );
    return null;
  }
  return sdk;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly sdk = getSdk();
  private readonly authChange$ = new Subject<string | null>();

  private readonly _user = signal<User | null>(null);
  readonly user = this._user.asReadonly();

  private readonly _token = signal<string | null>(this.sdk?.getToken() ?? null);
  readonly token = this._token.asReadonly();

  readonly isAuthenticated = computed(() => this._token() !== null);

  constructor() {
    // Subscribe to SDK state changes (login completes, refresh succeeds, logout).
    // SDK does NOT notify on initial refresh failure (no active session) — that
    // path is handled by the timeout in ensureToken().
    this.sdk?.onAuthChange(() => {
      const token = this.sdk?.getToken() ?? null;
      this._token.set(token);
      this.authChange$.next(token);
      if (!token) this._user.set(null);
    });
  }

  me(): Observable<User> {
    return this.http
      .get<User>(apiUrl('/me'), {
        headers: new HttpHeaders({ [SKIP_TOAST_HEADER]: '1' }),
      })
      .pipe(tap((user) => this._user.set(user)));
  }

  ensureUser(): Observable<User | null> {
    const user = this._user();
    if (user) return of(user);
    if (!this._token()) return of(null);
    return this.me();
  }

  ensureToken(): Observable<string | null> {
    const token = this._token();
    if (token) return of(token);
    if (!this.sdk) return of(null);

    // Race: first auth change from SDK vs init timeout. Covers three cases:
    //   1. User returned with #sso_code — SDK exchange resolves within ~hundreds of ms.
    //   2. User has refresh cookie — SDK silent refresh resolves similarly.
    //   3. No session at all — SDK refresh fails silently, we time out and return null.
    return race(
      this.authChange$.pipe(take(1)),
      timer(SDK_INIT_TIMEOUT_MS).pipe(map(() => null)),
    ).pipe(catchError(() => of(null)));
  }

  loginWithSso(returnPath = '/app'): void {
    if (!this.sdk) return;
    const returnUrl = new URL(returnPath, window.location.origin).toString();
    this.sdk.login(returnUrl);
  }

  logout(): void {
    this._user.set(null);
    this._token.set(null);
    if (!this.sdk) {
      this.router.navigateByUrl('/');
      return;
    }
    this.sdk.logout().finally(() => this.sdk?.login());
  }

  clearSession(): void {
    this._user.set(null);
    this._token.set(null);
    this.router.navigateByUrl('/');
  }
}
