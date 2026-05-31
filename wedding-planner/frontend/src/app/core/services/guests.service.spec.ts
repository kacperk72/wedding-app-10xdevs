import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { GuestsService } from './guests.service';
import { apiUrl } from '../http/api-url';
import { Diet, Guest, Relation, RsvpStatus } from '../models/guest.model';

const WEDDING_ID = 'wed-1';

let seq = 0;
function buildGuest(overrides: Partial<Guest> = {}): Guest {
  seq += 1;
  return {
    id: `g-${seq}`,
    weddingId: WEDDING_ID,
    firstName: 'Imię',
    lastName: 'Nazwisko',
    relation: 'wspolni_znajomi' as Relation,
    rsvpStatus: 'pending' as RsvpStatus,
    diet: 'pending' as Diet,
    hasPlusOne: false,
    isChild: false,
    mealOptionId: null,
    tableId: null,
    seatNumber: null,
    contactPhone: null,
    contactEmail: null,
    ...overrides,
  };
}

const FIXTURE: Guest[] = [
  buildGuest({ firstName: 'Anna', lastName: 'Kowalska', relation: 'rodzina_panny_mlodej', rsvpStatus: 'confirmed', diet: 'vege', mealOptionId: 'm-1' }),
  buildGuest({ firstName: 'Bartek', lastName: 'Nowak', relation: 'przyjaciele_pana_mlodego', rsvpStatus: 'confirmed', diet: 'standard' }),
  buildGuest({ firstName: 'Celina', lastName: 'Wiśniewska', relation: 'wspolni_znajomi', rsvpStatus: 'pending', diet: 'vegan', isChild: true }),
  buildGuest({ firstName: 'Damian', lastName: 'Lewandowski', relation: 'znajomi_z_pracy', rsvpStatus: 'declined', diet: 'standard' }),
  buildGuest({ firstName: 'Ewa', lastName: 'Zielińska', relation: 'rodzina_pana_mlodego', rsvpStatus: 'confirmed', diet: 'gluten_free' }),
];

describe('GuestsService', () => {
  let service: GuestsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(GuestsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function loadFixture(): void {
    service.list(WEDDING_ID).subscribe();
    const req = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/guests`));
    expect(req.request.method).toBe('GET');
    req.flush(FIXTURE);
  }

  it('ładuje gości pod właściwym URL-em i wypełnia signal', () => {
    loadFixture();
    expect(service.guests().length).toBe(5);
  });

  it('wylicza agregaty po stronie klienta z listy gości', () => {
    loadFixture();
    const a = service.aggregates();
    expect(a.invited).toBe(5);
    expect(a.confirmed).toBe(3);
    expect(a.pending).toBe(1);
    expect(a.declined).toBe(1);
    expect(a.vegeOrVegan).toBe(2);
    expect(a.children).toBe(1);
    expect(a.noMealPick).toBe(4);
  });

  it('filtruje po statusie RSVP', () => {
    loadFixture();
    service.setFilters({ rsvp: 'confirmed' });
    expect(service.filteredGuests().map((g) => g.firstName)).toEqual(['Anna', 'Bartek', 'Ewa']);
  });

  it('filtruje po wyszukiwaniu w imieniu i nazwisku', () => {
    loadFixture();
    service.setFilters({ search: 'nowak' });
    const matches = service.filteredGuests();
    expect(matches.length).toBe(1);
    expect(matches[0].lastName).toBe('Nowak');
  });

  it('sortuje po nazwisku (domyślnie) i po imieniu z polskim localeCompare', () => {
    loadFixture();
    expect(service.filteredGuests().map((g) => g.lastName)).toEqual([
      'Kowalska',
      'Lewandowski',
      'Nowak',
      'Wiśniewska',
      'Zielińska',
    ]);

    service.setFilters({ sort: 'firstName' });
    expect(service.filteredGuests().map((g) => g.firstName)).toEqual([
      'Anna',
      'Bartek',
      'Celina',
      'Damian',
      'Ewa',
    ]);
  });
});
