import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import {
  CreateMealOptionDto,
  MealOption,
  UpdateMealOptionDto,
} from '../models/meal-option.model';
import { apiUrl } from '../http/api-url';

@Injectable({ providedIn: 'root' })
export class MealOptionsService {
  private readonly http = inject(HttpClient);

  private readonly _mealOptions = signal<MealOption[]>([]);
  readonly mealOptions = this._mealOptions.asReadonly();

  list(weddingId: string): Observable<MealOption[]> {
    return this.http
      .get<MealOption[]>(apiUrl(`/weddings/${weddingId}/meal-options`))
      .pipe(tap((opts) => this._mealOptions.set(opts)));
  }

  create(weddingId: string, dto: CreateMealOptionDto): Observable<MealOption> {
    return this.http
      .post<MealOption>(apiUrl(`/weddings/${weddingId}/meal-options`), dto)
      .pipe(tap((created) => this._mealOptions.update((list) => [...list, created])));
  }

  update(weddingId: string, id: string, patch: UpdateMealOptionDto): Observable<MealOption> {
    return this.http
      .patch<MealOption>(apiUrl(`/weddings/${weddingId}/meal-options/${id}`), patch)
      .pipe(
        tap((updated) =>
          this._mealOptions.update((list) =>
            list.map((option) => (option.id === id ? updated : option)),
          ),
        ),
      );
  }

  remove(weddingId: string, id: string): Observable<void> {
    return this.http
      .delete<void>(apiUrl(`/weddings/${weddingId}/meal-options/${id}`))
      .pipe(tap(() => this._mealOptions.update((list) => list.filter((o) => o.id !== id))));
  }
}
