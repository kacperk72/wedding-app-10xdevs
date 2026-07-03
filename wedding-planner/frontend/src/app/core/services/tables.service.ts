import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of, tap } from 'rxjs';
import { CreateTableDto, Table, UpdateTableDto } from '../models/table.model';
import { apiUrl } from '../http/api-url';

@Injectable({ providedIn: 'root' })
export class TablesService {
  private readonly http = inject(HttpClient);

  private readonly _tables = signal<Table[]>([]);
  readonly tables = this._tables.asReadonly();

  list(weddingId: string): Observable<Table[]> {
    return this.http
      .get<Table[]>(apiUrl(`/weddings/${weddingId}/tables`))
      .pipe(tap((tables) => this._tables.set(tables)));
  }

  create(weddingId: string, dto: CreateTableDto): Observable<Table> {
    this.assertSeatsCount(dto.seatsCount);
    return this.http
      .post<Table>(apiUrl(`/weddings/${weddingId}/tables`), dto)
      .pipe(tap((created) => this._tables.update((list) => [...list, created])));
  }

  update(weddingId: string, id: string, patch: UpdateTableDto): Observable<Table> {
    if (patch.seatsCount !== undefined) this.assertSeatsCount(patch.seatsCount);
    return this.http
      .patch<Table>(apiUrl(`/weddings/${weddingId}/tables/${id}`), patch)
      .pipe(
        tap((updated) =>
          this._tables.update((list) =>
            list.map((table) => (table.id === id ? updated : table)),
          ),
        ),
      );
  }

  /**
   * Utrwala nową kolejność stołów. `orderedTables` to lista w docelowej
   * kolejności; `sortOrder` jest przeliczany na indeks. Sygnał jest
   * aktualizowany od razu (optymistycznie), a na backend lecą PATCH-e tylko
   * dla stołów, których `sortOrder` faktycznie się zmienił.
   */
  reorder(weddingId: string, orderedTables: Table[]): Observable<Table[]> {
    const reordered = orderedTables.map((table, index) => ({ ...table, sortOrder: index }));
    this._tables.set(reordered);

    const changed = orderedTables
      .map((table, index) => ({ table, index }))
      .filter(({ table, index }) => table.sortOrder !== index);
    if (changed.length === 0) return of([]);

    return forkJoin(
      changed.map(({ table, index }) => this.update(weddingId, table.id, { sortOrder: index })),
    );
  }

  remove(weddingId: string, id: string): Observable<void> {
    return this.http
      .delete<void>(apiUrl(`/weddings/${weddingId}/tables/${id}`))
      .pipe(tap(() => this._tables.update((list) => list.filter((table) => table.id !== id))));
  }

  private assertSeatsCount(value: number): void {
    if (!Number.isInteger(value) || value < 1 || value > 24) {
      throw new Error('Liczba miejsc musi być w zakresie 1-24.');
    }
  }
}
