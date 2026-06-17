import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { ContractsService } from './contracts.service';
import { apiUrl } from '../http/api-url';
import { Contract, Payment } from '../models/contract.model';

const WEDDING_ID = 'wed-1';

function buildContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: 'k-1',
    weddingId: WEDDING_ID,
    vendorId: 'v-1',
    vendorName: 'Foto Studio',
    category: 'fotograf',
    totalAmount: 5000,
    signedDate: null,
    status: 'pending',
    payments: [],
    paidCount: 0,
    totalCount: 0,
    ...overrides,
  };
}

function buildPayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'p-1',
    contractId: 'k-1',
    kind: 'rata',
    dueDate: '2026-07-01',
    amount: 1000,
    status: 'planned',
    paidAt: null,
    method: 'przelew',
    ...overrides,
  };
}

describe('ContractsService', () => {
  let service: ContractsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(ContractsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function loadFixture(): void {
    service.list(WEDDING_ID).subscribe();
    const req = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/contracts`));
    expect(req.request.method).toBe('GET');
    req.flush([buildContract({ id: 'k-1' }), buildContract({ id: 'k-2' })]);
  }

  it('list pobiera pod wedding-scoped URL i wypełnia signal contracts', () => {
    loadFixture();
    expect(service.contracts().map((c) => c.id)).toEqual(['k-1', 'k-2']);
  });

  it('upcomingPaymentsList pobiera z osobnego wedding-scoped URL i wypełnia signal', () => {
    service.upcomingPaymentsList(WEDDING_ID).subscribe();
    const req = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/contracts/upcoming-payments`));
    expect(req.request.method).toBe('GET');
    req.flush([buildPayment({ id: 'p-1' })]);
    expect(service.upcomingPayments().map((p) => p.id)).toEqual(['p-1']);
  });

  it('create POST-uje pod wedding-scoped URL i dokłada kontrakt', () => {
    loadFixture();
    service.create(WEDDING_ID, { vendorId: 'v-3', totalAmount: 3000 }).subscribe();
    const req = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/contracts`));
    expect(req.request.method).toBe('POST');
    req.flush(buildContract({ id: 'k-3', vendorId: 'v-3', totalAmount: 3000 }));
    expect(service.contracts().map((c) => c.id)).toEqual(['k-1', 'k-2', 'k-3']);
  });

  it('update PATCH-uje pod wedding-scoped URL i podmienia kontrakt po id', () => {
    loadFixture();
    service.update(WEDDING_ID, 'k-1', { status: 'deposit_paid' }).subscribe();
    const req = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/contracts/k-1`));
    expect(req.request.method).toBe('PATCH');
    req.flush(buildContract({ id: 'k-1', status: 'deposit_paid' }));
    expect(service.contracts().find((c) => c.id === 'k-1')?.status).toBe('deposit_paid');
  });

  it('remove DELETE-uje pod wedding-scoped URL i usuwa kontrakt', () => {
    loadFixture();
    service.remove(WEDDING_ID, 'k-2').subscribe();
    const req = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/contracts/k-2`));
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    expect(service.contracts().map((c) => c.id)).toEqual(['k-1']);
  });
});
