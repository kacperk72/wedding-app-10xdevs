import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { Guest } from '../models/guest.model';
import {
  AssignTableResponse,
  CreateConflictDto,
  SeatingConflict,
  SeatingStats,
  UpdateConflictDto,
} from '../models/seating.model';
import { apiUrl } from '../http/api-url';
import { GuestsService } from './guests.service';

@Injectable({ providedIn: 'root' })
export class SeatingService {
  private readonly http = inject(HttpClient);
  private readonly guestsService = inject(GuestsService);

  private readonly _conflicts = signal<SeatingConflict[]>([]);
  readonly conflicts = this._conflicts.asReadonly();

  private readonly _stats = signal<SeatingStats | null>(null);
  readonly stats = this._stats.asReadonly();

  loadConflicts(weddingId: string): Observable<SeatingConflict[]> {
    return this.http
      .get<SeatingConflict[]>(apiUrl(`/weddings/${weddingId}/seating-conflicts`))
      .pipe(tap((conflicts) => this._conflicts.set(conflicts)));
  }

  createConflict(weddingId: string, dto: CreateConflictDto): Observable<SeatingConflict> {
    return this.http
      .post<SeatingConflict>(apiUrl(`/weddings/${weddingId}/seating-conflicts`), dto)
      .pipe(
        tap((created) => {
          this._conflicts.update((list) => [created, ...list]);
          this.loadStats(weddingId).subscribe();
        }),
      );
  }

  updateConflict(
    weddingId: string,
    id: string,
    patch: UpdateConflictDto,
  ): Observable<SeatingConflict> {
    return this.http
      .patch<SeatingConflict>(apiUrl(`/weddings/${weddingId}/seating-conflicts/${id}`), patch)
      .pipe(
        tap((updated) =>
          this._conflicts.update((list) =>
            list.map((conflict) => (conflict.id === id ? updated : conflict)),
          ),
        ),
      );
  }

  removeConflict(weddingId: string, id: string): Observable<void> {
    return this.http.delete<void>(apiUrl(`/weddings/${weddingId}/seating-conflicts/${id}`)).pipe(
      tap(() => {
        this._conflicts.update((list) => list.filter((conflict) => conflict.id !== id));
        this.loadStats(weddingId).subscribe();
      }),
    );
  }

  loadStats(weddingId: string): Observable<SeatingStats> {
    return this.http
      .get<SeatingStats>(apiUrl(`/weddings/${weddingId}/seating/stats`))
      .pipe(tap((stats) => this._stats.set(stats)));
  }

  assignTable(
    weddingId: string,
    guestId: string,
    tableId: string,
  ): Observable<AssignTableResponse> {
    return this.http
      .post<AssignTableResponse>(apiUrl(`/weddings/${weddingId}/guests/${guestId}/assign-table`), {
        tableId,
      })
      .pipe(tap(() => this.refreshSeating(weddingId)));
  }

  unassignTable(weddingId: string, guestId: string): Observable<Guest> {
    return this.http
      .post<Guest>(apiUrl(`/weddings/${weddingId}/guests/${guestId}/unassign-table`), {})
      .pipe(tap(() => this.refreshSeating(weddingId)));
  }

  releaseTable(weddingId: string, tableId: string): Observable<{ released: number }> {
    return this.http
      .post<{ released: number }>(
        apiUrl(`/weddings/${weddingId}/tables/${tableId}/release`),
        {},
      )
      .pipe(tap(() => this.refreshSeating(weddingId)));
  }

  private refreshSeating(weddingId: string): void {
    this.guestsService.list(weddingId).subscribe();
    this.loadStats(weddingId).subscribe();
  }
}
