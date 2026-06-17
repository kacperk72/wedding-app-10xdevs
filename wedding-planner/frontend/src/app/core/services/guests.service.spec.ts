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
import { Diet, Guest, GuestAggregates, Relation, RsvpStatus } from '../models/guest.model';

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

  it('create POST-uje pod wedding-scoped URL i dokłada gościa do signala', () => {
    loadFixture();
    const created = buildGuest({ firstName: 'Filip', lastName: 'Adamczyk' });

    service
      .create(WEDDING_ID, {
        firstName: 'Filip',
        lastName: 'Adamczyk',
        relation: 'wspolni_znajomi' as Relation,
        diet: 'pending' as Diet,
      })
      .subscribe();
    const req = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/guests`));
    expect(req.request.method).toBe('POST');
    req.flush(created);

    expect(service.guests().length).toBe(6);
    expect(service.guests().at(-1)?.id).toBe(created.id);
  });

  it('update PATCH-uje pod wedding-scoped URL i podmienia gościa po id', () => {
    loadFixture();
    const target = service.guests()[0];
    const updated = { ...target, lastName: 'Zmieniona' };

    service.update(WEDDING_ID, target.id, { lastName: 'Zmieniona' }).subscribe();
    const req = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/guests/${target.id}`));
    expect(req.request.method).toBe('PATCH');
    req.flush(updated);

    expect(service.guests().find((g) => g.id === target.id)?.lastName).toBe('Zmieniona');
    expect(service.guests().length).toBe(5);
  });

  it('remove DELETE-uje pod wedding-scoped URL i usuwa gościa z signala', () => {
    loadFixture();
    const target = service.guests()[0];

    service.remove(WEDDING_ID, target.id).subscribe();
    const req = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/guests/${target.id}`));
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(service.guests().some((g) => g.id === target.id)).toBe(false);
    expect(service.guests().length).toBe(4);
  });

  it('aggregates używa wartości serwera, dopóki mutacja nie zresetuje fallbacku na klienta', () => {
    loadFixture();

    // Server aggregates deliberately diverge from the client-derived numbers
    // so we can observe which source `aggregates()` is reading.
    const serverAggregates: GuestAggregates = {
      invited: 99,
      confirmed: 80,
      pending: 10,
      declined: 9,
      vegeOrVegan: 40,
      children: 5,
      noMealPick: 3,
    };
    service.loadAggregates(WEDDING_ID).subscribe();
    const aggReq = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/guests/aggregates`));
    expect(aggReq.request.method).toBe('GET');
    aggReq.flush(serverAggregates);

    expect(service.aggregates().invited).toBe(99);

    // Any mutation clears the server snapshot → aggregates fall back to the
    // client-side recomputation over the (now 6-guest) list.
    const created = buildGuest({ firstName: 'Filip', lastName: 'Adamczyk' });
    service
      .create(WEDDING_ID, {
        firstName: 'Filip',
        lastName: 'Adamczyk',
        relation: 'wspolni_znajomi' as Relation,
        diet: 'pending' as Diet,
      })
      .subscribe();
    httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/guests`)).flush(created);

    expect(service.aggregates().invited).toBe(6);
  });
});
