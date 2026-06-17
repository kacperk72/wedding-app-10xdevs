import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Observable, of } from 'rxjs';

import { WeddingService } from './wedding.service';
import { AuthService } from './auth.service';
import { apiUrl } from '../http/api-url';
import { Wedding } from '../models/wedding.model';
import { User } from '../models/user.model';

const FROZEN_NOW = new Date('2026-06-17T12:00:00');

function buildWedding(overrides: Partial<Wedding> = {}): Wedding {
  return {
    id: 'wed-1',
    partnerAName: 'Ania',
    partnerBName: 'Bartek',
    weddingDate: '2026-09-12',
    ceremonyLocation: 'Pałac Polanka',
    createdByUserId: 'user-a',
    budgetTotal: 80000,
    ...overrides,
  };
}

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-a',
    email: 'ania@example.com',
    firstName: 'Ania',
    lastName: 'Nowak',
    weddingId: null,
    weddingMembership: null,
    partner: null,
    ...overrides,
  };
}

// Minimal AuthService stub — WeddingService only depends on `me()`. The returned
// user is mutable per-test so we can exercise both loadCurrent branches.
let stubUser: User;
const authStub: Pick<AuthService, 'me'> = {
  me: (): Observable<User> => of(stubUser),
};

describe('WeddingService', () => {
  let service: WeddingService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_NOW);
    stubUser = buildUser();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authStub },
      ],
    });
    service = TestBed.inject(WeddingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  // Populate the wedding signal without touching auth: update() PATCHes and
  // sets the signal directly from the response.
  function loadWedding(overrides: Partial<Wedding> = {}): Wedding {
    const wedding = buildWedding(overrides);
    service.update(wedding.id, {}).subscribe();
    const req = httpMock.expectOne(apiUrl(`/weddings/${wedding.id}`));
    expect(req.request.method).toBe('PATCH');
    req.flush(wedding);
    return wedding;
  }

  it('daysUntilWedding liczy całkowitą liczbę dni do daty ślubu (frozen clock)', () => {
    loadWedding({ weddingDate: '2026-09-12' });
    // 2026-06-17 → 2026-09-12: 13 (czerwiec) + 31 (lipiec) + 31 (sierpień) + 12 = 87.
    // Uwaga: weddingDate w formacie date-only parsuje się jako UTC; przy ujemnym
    // offsecie strefy (Ameryki) wynik mógłby przesunąć się o 1 dzień. CI (UTC) i
    // dev (UTC+) dają tu stabilne 87.
    expect(service.daysUntilWedding()).toBe(87);
  });

  it('daysUntilWedding zwraca null, gdy nie wczytano wesela', () => {
    expect(service.daysUntilWedding()).toBeNull();
  });

  it('coupleLabel składa imiona partnerów, a coupleInitials zwraca wielkie inicjały', () => {
    loadWedding({ partnerAName: 'Ania', partnerBName: 'Bartek' });
    expect(service.coupleLabel()).toBe('Ania & Bartek');
    expect(service.coupleInitials()).toEqual({ a: 'A', b: 'B' });
  });

  it('coupleLabel i coupleInitials mają puste wartości domyślne bez wesela', () => {
    expect(service.coupleLabel()).toBe('');
    expect(service.coupleInitials()).toEqual({ a: '', b: '' });
  });

  it('loadCurrent pobiera wesele pod URL-em wziętym z weddingId użytkownika', () => {
    stubUser = buildUser({ weddingId: 'w-9' });
    const wedding = buildWedding({ id: 'w-9' });

    service.loadCurrent().subscribe();
    const req = httpMock.expectOne(apiUrl('/weddings/w-9'));
    expect(req.request.method).toBe('GET');
    req.flush(wedding);

    expect(service.wedding()?.id).toBe('w-9');
  });

  it('loadCurrent nie wykonuje żądania i czyści signal, gdy użytkownik nie ma wesela', () => {
    stubUser = buildUser({ weddingId: null });

    let emitted: Wedding | null | undefined;
    service.loadCurrent().subscribe((w) => (emitted = w));

    httpMock.expectNone(() => true);
    expect(emitted).toBeNull();
    expect(service.wedding()).toBeNull();
  });
});
