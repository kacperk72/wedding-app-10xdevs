import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { Dashboard } from '../models/dashboard.model';
import { apiUrl } from '../http/api-url';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);

  private readonly _dashboard = signal<Dashboard | null>(null);
  readonly dashboard = this._dashboard.asReadonly();

  load(weddingId: string): Observable<Dashboard> {
    return this.http
      .get<Dashboard>(apiUrl(`/weddings/${weddingId}/dashboard`))
      .pipe(tap((dashboard) => this._dashboard.set(dashboard)));
  }
}
