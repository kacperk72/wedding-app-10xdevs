import { beforeEach, describe, expect, it } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetailedTable } from './detailed-table';
import { Diet, Guest, Relation, RsvpStatus } from '../../../core/models/guest.model';
import { Table } from '../../../core/models/table.model';

const WEDDING_ID = 'wed-1';

function buildGuest(overrides: Partial<Guest> = {}): Guest {
  return {
    id: 'g-1',
    weddingId: WEDDING_ID,
    firstName: 'Anna',
    lastName: 'Kowalska',
    relation: 'wspolni_znajomi' as Relation,
    rsvpStatus: 'confirmed' as RsvpStatus,
    diet: 'standard' as Diet,
    hasPlusOne: false,
    isChild: false,
    mealOptionId: null,
    tableId: 't-1',
    seatNumber: null,
    contactPhone: null,
    contactEmail: null,
    ...overrides,
  };
}

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

describe('DetailedTable — mapowanie gości na krzesła', () => {
  let fixture: ComponentFixture<DetailedTable>;

  function render(table: Table, guests: Guest[]): DetailedTable {
    fixture = TestBed.createComponent(DetailedTable);
    fixture.componentRef.setInput('table', table);
    fixture.componentRef.setInput('guests', guests);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
  });

  it('jawne numery krzeseł trafiają na swoje pozycje, reszta wypełnia luki alfabetycznie', () => {
    const seatOne = buildGuest({ id: 'b', firstName: 'Barbara', lastName: 'Nowak', seatNumber: 1 });
    const seatThree = buildGuest({ id: 'a', firstName: 'Adam', lastName: 'Wójcik', seatNumber: 3 });
    const noSeatZ = buildGuest({ id: 'z', firstName: 'Zofia', lastName: 'Zielińska', seatNumber: null });
    const noSeatA = buildGuest({ id: 'd', firstName: 'Dorota', lastName: 'Adamska', seatNumber: null });

    const component = render(buildTable({ seatsCount: 8 }), [seatOne, seatThree, noSeatZ, noSeatA]);
    const seats = component.seats();

    // Osiem slotów, jawne numery na swoich miejscach.
    expect(seats).toHaveLength(8);
    expect(seats[0].seatNumber).toBe(1);
    expect(seats[0].guest?.id).toBe('b');
    expect(seats[2].guest?.id).toBe('a');

    // Pozostali (bez seatNumber) wypełniają wolne sloty po kolei, alfabetycznie:
    // Adamska przed Zielińską → seat 2, potem seat 4.
    expect(seats[1].guest?.id).toBe('d');
    expect(seats[3].guest?.id).toBe('z');

    // Reszta krzeseł pusta, brak nadmiaru.
    expect(seats.slice(4).every((seat) => seat.guest === null)).toBe(true);
    expect(component.overflowGuests()).toHaveLength(0);
    expect(component.occupiedCount()).toBe(4);
  });

  it('kąty krzeseł rozkładają się równo wokół okręgu (0° u góry)', () => {
    const component = render(buildTable({ seatsCount: 4 }), []);
    expect(component.seats().map((seat) => seat.angleDeg)).toEqual([0, 90, 180, 270]);
  });

  it('nadmiar gości ponad liczbę miejsc trafia do overflow (nikt nie znika)', () => {
    const guests = [
      buildGuest({ id: 'g1', lastName: 'Aaa' }),
      buildGuest({ id: 'g2', lastName: 'Bbb' }),
      buildGuest({ id: 'g3', lastName: 'Ccc' }),
    ];
    const component = render(buildTable({ seatsCount: 2 }), guests);

    expect(component.seats().filter((seat) => seat.guest !== null)).toHaveLength(2);
    expect(component.overflowGuests()).toHaveLength(1);
    expect(component.overflowGuests()[0].id).toBe('g3');
  });
});
