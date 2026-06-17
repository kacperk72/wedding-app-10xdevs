import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { MealOptionsService } from './meal-options.service';
import { apiUrl } from '../http/api-url';
import { MealOption } from '../models/meal-option.model';

const WEDDING_ID = 'wed-1';

function buildOption(overrides: Partial<MealOption> = {}): MealOption {
  return { id: 'm-1', weddingId: WEDDING_ID, label: 'Danie', sortOrder: 0, ...overrides };
}

describe('MealOptionsService', () => {
  let service: MealOptionsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(MealOptionsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function loadFixture(): void {
    service.list(WEDDING_ID).subscribe();
    const req = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/meal-options`));
    expect(req.request.method).toBe('GET');
    req.flush([buildOption({ id: 'm-1' }), buildOption({ id: 'm-2' })]);
  }

  it('list pobiera pod wedding-scoped URL i wypełnia signal', () => {
    loadFixture();
    expect(service.mealOptions().map((o) => o.id)).toEqual(['m-1', 'm-2']);
  });

  it('create POST-uje pod wedding-scoped URL i dokłada rekord', () => {
    loadFixture();
    service.create(WEDDING_ID, { label: 'Wege' }).subscribe();
    const req = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/meal-options`));
    expect(req.request.method).toBe('POST');
    req.flush(buildOption({ id: 'm-3', label: 'Wege' }));
    expect(service.mealOptions().map((o) => o.id)).toEqual(['m-1', 'm-2', 'm-3']);
  });

  it('update PATCH-uje pod wedding-scoped URL i podmienia rekord po id', () => {
    loadFixture();
    service.update(WEDDING_ID, 'm-1', { label: 'Zmienione' }).subscribe();
    const req = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/meal-options/m-1`));
    expect(req.request.method).toBe('PATCH');
    req.flush(buildOption({ id: 'm-1', label: 'Zmienione' }));
    expect(service.mealOptions().find((o) => o.id === 'm-1')?.label).toBe('Zmienione');
  });

  it('remove DELETE-uje pod wedding-scoped URL i usuwa rekord', () => {
    loadFixture();
    service.remove(WEDDING_ID, 'm-2').subscribe();
    const req = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/meal-options/m-2`));
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    expect(service.mealOptions().map((o) => o.id)).toEqual(['m-1']);
  });
});
