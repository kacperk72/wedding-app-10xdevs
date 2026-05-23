import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { MealOption } from '../models/meal-option.model';
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
}
