import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import {
  BudgetCategory,
  BudgetSummary,
  CreateExpenseDto,
  Expense,
  UpdateExpenseDto,
} from '../models/expense.model';
import { apiUrl } from '../http/api-url';

interface ExpenseFilters {
  categoryId?: string | null;
}

@Injectable({ providedIn: 'root' })
export class BudgetService {
  private readonly http = inject(HttpClient);

  private readonly _summary = signal<BudgetSummary | null>(null);
  readonly summary = this._summary.asReadonly();

  private readonly _expenses = signal<Expense[]>([]);
  readonly expenses = this._expenses.asReadonly();

  private readonly _categories = signal<BudgetCategory[]>([]);
  readonly categories = this._categories.asReadonly();

  loadSummary(weddingId: string): Observable<BudgetSummary> {
    return this.http
      .get<BudgetSummary>(apiUrl(`/weddings/${weddingId}/budget/summary`))
      .pipe(tap((summary) => this._summary.set(summary)));
  }

  loadCategories(weddingId: string): Observable<BudgetCategory[]> {
    return this.http
      .get<BudgetCategory[]>(apiUrl(`/weddings/${weddingId}/budget/categories`))
      .pipe(tap((categories) => this._categories.set(categories)));
  }

  listExpenses(weddingId: string, filters: ExpenseFilters = {}): Observable<Expense[]> {
    const query = filters.categoryId ? `?categoryId=${encodeURIComponent(filters.categoryId)}` : '';
    return this.http
      .get<Expense[]>(apiUrl(`/weddings/${weddingId}/expenses${query}`))
      .pipe(tap((expenses) => this._expenses.set(expenses)));
  }

  createExpense(weddingId: string, dto: CreateExpenseDto): Observable<Expense> {
    return this.http.post<Expense>(apiUrl(`/weddings/${weddingId}/expenses`), dto).pipe(
      tap((created) => {
        this._expenses.update((list) => [created, ...list]);
        this.loadSummary(weddingId).subscribe();
      }),
    );
  }

  updateExpense(weddingId: string, id: string, patch: UpdateExpenseDto): Observable<Expense> {
    return this.http.patch<Expense>(apiUrl(`/weddings/${weddingId}/expenses/${id}`), patch).pipe(
      tap((updated) => {
        this._expenses.update((list) =>
          list.map((expense) => (expense.id === id ? updated : expense)),
        );
        this.loadSummary(weddingId).subscribe();
      }),
    );
  }

  removeExpense(weddingId: string, id: string): Observable<void> {
    return this.http.delete<void>(apiUrl(`/weddings/${weddingId}/expenses/${id}`)).pipe(
      tap(() => {
        this._expenses.update((list) => list.filter((expense) => expense.id !== id));
        this.loadSummary(weddingId).subscribe();
      }),
    );
  }
}
