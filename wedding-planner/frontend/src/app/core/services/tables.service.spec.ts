import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { TablesService } from './tables.service';
import { apiUrl } from '../http/api-url';
import { Table } from '../models/table.model';

const WEDDING_ID = 'wed-1';

function buildTable(overrides: Partial<Table> = {}): Table {
  return {
    id: 't-1',
    weddingId: WEDDING_ID,
    name: 'Stół 1',
    seatsCount: 8,
    sortOrder: 0,
    positionX: null,
    positionY: null,
    ...overrides,
  };
}

describe('TablesService', () => {
  let service: TablesService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(TablesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function loadFixture(): void {
    service.list(WEDDING_ID).subscribe();
    const req = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/tables`));
    expect(req.request.method).toBe('GET');
    req.flush([buildTable({ id: 't-1' }), buildTable({ id: 't-2' })]);
  }

  it('list pobiera pod wedding-scoped URL i wypełnia signal', () => {
    loadFixture();
    expect(service.tables().map((t) => t.id)).toEqual(['t-1', 't-2']);
  });

  it('create POST-uje pod wedding-scoped URL i dokłada rekord', () => {
    loadFixture();
    service.create(WEDDING_ID, { name: 'Stół 3', seatsCount: 10 }).subscribe();
    const req = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/tables`));
    expect(req.request.method).toBe('POST');
    req.flush(buildTable({ id: 't-3', name: 'Stół 3', seatsCount: 10 }));
    expect(service.tables().map((t) => t.id)).toEqual(['t-1', 't-2', 't-3']);
  });

  it('update PATCH-uje pod wedding-scoped URL i podmienia rekord po id', () => {
    loadFixture();
    service.update(WEDDING_ID, 't-1', { name: 'Główny' }).subscribe();
    const req = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/tables/t-1`));
    expect(req.request.method).toBe('PATCH');
    req.flush(buildTable({ id: 't-1', name: 'Główny' }));
    expect(service.tables().find((t) => t.id === 't-1')?.name).toBe('Główny');
  });

  it('remove DELETE-uje pod wedding-scoped URL i usuwa rekord', () => {
    loadFixture();
    service.remove(WEDDING_ID, 't-2').subscribe();
    const req = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/tables/t-2`));
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    expect(service.tables().map((t) => t.id)).toEqual(['t-1']);
  });

  it('create odrzuca liczbę miejsc spoza zakresu 1-24 zanim wykona żądanie', () => {
    expect(() => service.create(WEDDING_ID, { name: 'Zły', seatsCount: 0 })).toThrow(/1-24/);
    expect(() => service.create(WEDDING_ID, { name: 'Zły', seatsCount: 25 })).toThrow(/1-24/);
    // afterEach httpMock.verify() proves no HTTP call leaked out.
  });

  it('update odrzuca liczbę miejsc spoza zakresu zanim wykona żądanie', () => {
    expect(() => service.update(WEDDING_ID, 't-1', { seatsCount: 30 })).toThrow(/1-24/);
  });
});
