import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Wedding } from '../models/wedding.model';
import { apiUrl } from '../http/api-url';

const MS_PER_DAY = 86_400_000;
const DEMO_WEDDING: Wedding = {
  id: 'demo-wedding',
  partnerAName: 'Weronika',
  partnerBName: 'Kacper',
  weddingDate: '2026-07-25',
  ceremonyLocation: 'Pałac Polanka',
  createdByUserId: 'demo-user',
};

@Injectable({ providedIn: 'root' })
export class WeddingService {
  private readonly http = inject(HttpClient);

  private readonly _wedding = signal<Wedding | null>(DEMO_WEDDING);
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

  loadCurrent(): Observable<Wedding> {
    return this.http
      .get<Wedding>(apiUrl('/me/wedding'))
      .pipe(tap((w) => this._wedding.set(w)));
  }
}
