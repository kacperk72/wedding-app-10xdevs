import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of, switchMap, tap } from 'rxjs';
import { AuthService } from './auth.service';
import { CreateWeddingDto, UpdateWeddingDto, Wedding } from '../models/wedding.model';
import { apiUrl } from '../http/api-url';

const MS_PER_DAY = 86_400_000;

@Injectable({ providedIn: 'root' })
export class WeddingService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private readonly _wedding = signal<Wedding | null>(null);
  readonly wedding = this._wedding.asReadonly();

  readonly daysUntilWedding = computed<number | null>(() => {
    const w = this._wedding();
    if (!w) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(w.weddingDate);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - today.getTime()) / MS_PER_DAY);
  });

  readonly coupleLabel = computed(() => {
    const w = this._wedding();
    return w ? `${w.partnerAName} & ${w.partnerBName}` : '';
  });

  readonly coupleInitials = computed(() => {
    const w = this._wedding();
    if (!w) return { a: '', b: '' };
    return {
      a: w.partnerAName.charAt(0).toUpperCase(),
      b: w.partnerBName.charAt(0).toUpperCase(),
    };
  });

  loadCurrent(): Observable<Wedding | null> {
    return this.auth.me().pipe(
      switchMap((user) => {
        if (!user.weddingId) {
          this._wedding.set(null);
          return of(null);
        }
        return this.http
          .get<Wedding>(apiUrl(`/weddings/${user.weddingId}`))
          .pipe(tap((w) => this._wedding.set(w)));
      }),
    );
  }

  create(dto: CreateWeddingDto): Observable<Wedding> {
    return this.http.post<Wedding>(apiUrl('/weddings'), dto).pipe(
      tap((w) => this._wedding.set(w)),
      switchMap((w) => this.auth.me().pipe(map(() => w))),
    );
  }

  update(id: string, patch: UpdateWeddingDto): Observable<Wedding> {
    return this.http
      .patch<Wedding>(apiUrl(`/weddings/${id}`), patch)
      .pipe(tap((w) => this._wedding.set(w)));
  }
}
