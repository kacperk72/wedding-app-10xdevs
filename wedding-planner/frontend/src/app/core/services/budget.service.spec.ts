import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { BudgetService } from './budget.service';
import { apiUrl } from '../http/api-url';
import { BudgetSummary, Expense } from '../models/expense.model';

const WEDDING_ID = 'wed-1';

function buildExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'e-1',
    weddingId: WEDDING_ID,
    categoryId: 'c-1',
    vendorId: null,
    vendorName: null,
    description: 'Wydatek',
    amount: 100,
    spentOn: '2026-06-01',
    ...overrides,
  };
}

const SUMMARY: BudgetSummary = {
  budgetTotal: 80000,
  spent: 100,
  remaining: 79900,
  expensesCount: 1,
  isOverBudget: false,
  overBudgetBy: 0,
};

describe('BudgetService', () => {
  let service: BudgetService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(BudgetService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function loadFixture(): void {
    service.listExpenses(WEDDING_ID).subscribe();
    const req = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/expenses`));
    expect(req.request.method).toBe('GET');
    req.flush([buildExpense({ id: 'e-1' }), buildExpense({ id: 'e-2' })]);
  }

  it('listExpenses bez filtra pobiera pod gołym wedding-scoped URL', () => {
    loadFixture();
    expect(service.expenses().map((e) => e.id)).toEqual(['e-1', 'e-2']);
  });

  it('listExpenses z filtrem kategorii dokleja query param categoryId', () => {
    service.listExpenses(WEDDING_ID, { categoryId: 'c-9' }).subscribe();
    const req = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/expenses?categoryId=c-9`));
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('loadSummary pobiera pod wedding-scoped URL i wypełnia signal', () => {
    service.loadSummary(WEDDING_ID).subscribe();
    const req = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/budget/summary`));
    expect(req.request.method).toBe('GET');
    req.flush(SUMMARY);
    expect(service.summary()?.remaining).toBe(79900);
  });

  it('createExpense wstawia nowy wydatek na początek listy i odświeża summary (cascade)', () => {
    loadFixture();
    service
      .createExpense(WEDDING_ID, {
        categoryId: 'c-1',
        amount: 50,
        spentOn: '2026-06-10',
        description: 'Nowy',
      })
      .subscribe();
    const post = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/expenses`));
    expect(post.request.method).toBe('POST');
    post.flush(buildExpense({ id: 'e-3', amount: 50 }));

    // Cascade: createExpense kicks off loadSummary against the scoped URL.
    const summary = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/budget/summary`));
    expect(summary.request.method).toBe('GET');
    summary.flush(SUMMARY);

    // Newest-first prepend, not append.
    expect(service.expenses().map((e) => e.id)).toEqual(['e-3', 'e-1', 'e-2']);
    expect(service.summary()?.budgetTotal).toBe(80000);
  });

  it('removeExpense usuwa wydatek i odświeża summary (cascade)', () => {
    loadFixture();
    service.removeExpense(WEDDING_ID, 'e-1').subscribe();
    const del = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/expenses/e-1`));
    expect(del.request.method).toBe('DELETE');
    del.flush(null);

    const summary = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/budget/summary`));
    summary.flush(SUMMARY);

    expect(service.expenses().map((e) => e.id)).toEqual(['e-2']);
  });
});
