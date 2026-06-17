import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { VendorsService } from './vendors.service';
import { apiUrl } from '../http/api-url';
import { Vendor } from '../models/vendor.model';

const WEDDING_ID = 'wed-1';

function buildVendor(overrides: Partial<Vendor> = {}): Vendor {
  return {
    id: 'v-1',
    weddingId: WEDDING_ID,
    category: 'fotograf',
    companyName: 'Foto Studio',
    contactPerson: null,
    phone: null,
    email: null,
    status: 'rozwazany',
    contractAmount: null,
    notes: null,
    hasContract: false,
    ...overrides,
  };
}

describe('VendorsService', () => {
  let service: VendorsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(VendorsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function loadFixture(): Vendor[] {
    const fixture = [buildVendor({ id: 'v-1' }), buildVendor({ id: 'v-2' })];
    service.list(WEDDING_ID).subscribe();
    const req = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/vendors`));
    expect(req.request.method).toBe('GET');
    req.flush(fixture);
    return fixture;
  }

  it('list pobiera pod wedding-scoped URL i wypełnia signal', () => {
    loadFixture();
    expect(service.vendors().map((v) => v.id)).toEqual(['v-1', 'v-2']);
  });

  it('create POST-uje pod wedding-scoped URL i dokłada rekord', () => {
    loadFixture();
    service.create(WEDDING_ID, { category: 'dj', companyName: 'DJ Max' }).subscribe();
    const req = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/vendors`));
    expect(req.request.method).toBe('POST');
    req.flush(buildVendor({ id: 'v-3', category: 'dj', companyName: 'DJ Max' }));
    expect(service.vendors().map((v) => v.id)).toEqual(['v-1', 'v-2', 'v-3']);
  });

  it('update PATCH-uje pod wedding-scoped URL i podmienia rekord po id', () => {
    loadFixture();
    service.update(WEDDING_ID, 'v-1', { companyName: 'Nowa' }).subscribe();
    const req = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/vendors/v-1`));
    expect(req.request.method).toBe('PATCH');
    req.flush(buildVendor({ id: 'v-1', companyName: 'Nowa' }));
    expect(service.vendors().find((v) => v.id === 'v-1')?.companyName).toBe('Nowa');
    expect(service.vendors().length).toBe(2);
  });

  it('remove DELETE-uje pod wedding-scoped URL i usuwa rekord', () => {
    loadFixture();
    service.remove(WEDDING_ID, 'v-2').subscribe();
    const req = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/vendors/v-2`));
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    expect(service.vendors().map((v) => v.id)).toEqual(['v-1']);
  });
});
