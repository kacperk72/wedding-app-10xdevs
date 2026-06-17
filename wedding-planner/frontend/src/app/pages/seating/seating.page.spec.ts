import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { of } from 'rxjs';

import { SeatingPage } from './seating.page';
import { GuestsService } from '../../core/services/guests.service';
import { TablesService } from '../../core/services/tables.service';
import { SeatingService } from '../../core/services/seating.service';
import { WeddingService } from '../../core/services/wedding.service';
import { ToastService } from '../../core/services/toast.service';
import { Diet, Guest, Relation, RsvpStatus } from '../../core/models/guest.model';
import { Table } from '../../core/models/table.model';
import { AssignTableResponse } from '../../core/models/seating.model';

const WEDDING_ID = 'wed-1';

// Protected members are compile-time only; cast through unknown to drive the
// fallback paths exactly as the template's keyboard handlers do.
interface SeatingInternals {
  openGuestMenu(guest: Guest): void;
  assignFromMenu(): void;
  dropGuest(event: CdkDragDrop<Table>): void;
  assignSeatById(tableId: string, seatNumber: number, guestId: string): void;
  announcement(): string;
}

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
    tableId: null,
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

const NO_WARNINGS: AssignTableResponse = {
  guest: buildGuest({ tableId: 't-1' }),
  warnings: [],
} as AssignTableResponse;

describe('SeatingPage — accessible (keyboard) fallback', () => {
  const guestsSignal = signal<Guest[]>([]);
  const tablesSignal = signal<Table[]>([]);
  const conflictsSignal = signal<unknown[]>([]);

  let guestsMock: { guests: typeof guestsSignal; list: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let seatingMock: {
    conflicts: typeof conflictsSignal;
    stats: ReturnType<typeof signal>;
    assignTable: ReturnType<typeof vi.fn>;
    unassignTable: ReturnType<typeof vi.fn>;
    loadStats: ReturnType<typeof vi.fn>;
    releaseTable: ReturnType<typeof vi.fn>;
  };
  let toastMock: { show: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let page: SeatingInternals;

  beforeEach(() => {
    guestsSignal.set([]);
    tablesSignal.set([]);
    conflictsSignal.set([]);

    guestsMock = {
      guests: guestsSignal.asReadonly() as typeof guestsSignal,
      list: vi.fn(() => of(guestsSignal())),
      update: vi.fn(() => of(buildGuest())),
    };
    seatingMock = {
      conflicts: conflictsSignal.asReadonly() as typeof conflictsSignal,
      stats: signal(null),
      assignTable: vi.fn(() => of(NO_WARNINGS)),
      unassignTable: vi.fn(() => of(buildGuest())),
      loadStats: vi.fn(() => of({})),
      releaseTable: vi.fn(() => of({ released: 0 })),
    };
    toastMock = { show: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: GuestsService, useValue: guestsMock },
        { provide: TablesService, useValue: { tables: tablesSignal.asReadonly(), list: vi.fn(() => of(tablesSignal())) } },
        { provide: SeatingService, useValue: seatingMock },
        { provide: WeddingService, useValue: { wedding: signal({ id: WEDDING_ID }), loadCurrent: vi.fn(() => of({ id: WEDDING_ID })) } },
        { provide: ToastService, useValue: toastMock },
      ],
    });

    // Construct (injects mocks) but do NOT detectChanges — we drive the methods
    // the template's keyboard handlers call, without rendering child components.
    page = TestBed.createComponent(SeatingPage).componentInstance as unknown as SeatingInternals;
  });

  afterEach(() => vi.clearAllMocks());

  it('przypisanie z menu (ścieżka klawiaturowa) trafia w ten sam assignTable co drag', () => {
    const guest = buildGuest({ id: 'g-1', tableId: null });
    const table = buildTable({ id: 't-1', seatsCount: 8 });
    guestsSignal.set([guest]);
    tablesSignal.set([table]);

    // Keyboard fallback: openGuestMenu (Enter on the card) → pick table → "Przypisz".
    page.openGuestMenu(guest);
    page.assignFromMenu();

    expect(seatingMock.assignTable).toHaveBeenCalledExactlyOnceWith(WEDDING_ID, 'g-1', 't-1');

    // Drag path must reach the identical service call — proving equivalence.
    seatingMock.assignTable.mockClear();
    const dropEvent = {
      item: { data: guest },
      container: { data: table },
    } as unknown as CdkDragDrop<Table>;
    page.dropGuest(dropEvent);

    expect(seatingMock.assignTable).toHaveBeenCalledExactlyOnceWith(WEDDING_ID, 'g-1', 't-1');
  });

  it('przypisanie krzesła z selecta (fallback) utrwala seat_number przez guests.update', () => {
    const guest = buildGuest({ id: 'g-9', tableId: 't-1', seatNumber: null });
    guestsSignal.set([guest]);
    tablesSignal.set([buildTable({ id: 't-1' })]);

    // Keyboard fallback: the per-seat <select aria-label="Przypisz gościa do krzesła N">.
    page.assignSeatById('t-1', 5, 'g-9');

    expect(guestsMock.update).toHaveBeenCalledExactlyOnceWith(WEDDING_ID, 'g-9', { seatNumber: 5 });
  });

  it('ogłasza udane przypisanie do stołu w live-region (FR-029)', () => {
    const guest = buildGuest({ id: 'g-1', tableId: null, firstName: 'Anna', lastName: 'Kowalska' });
    const table = buildTable({ id: 't-1', name: 'Stół 1' });
    guestsSignal.set([guest]);
    tablesSignal.set([table]);

    expect(page.announcement()).toBe('');
    page.openGuestMenu(guest);
    page.assignFromMenu();

    expect(page.announcement()).toContain('Anna Kowalska');
    expect(page.announcement()).toContain('Stół 1');
  });

  it('ogłasza posadzenie na konkretnym krześle (FR-029)', () => {
    const guest = buildGuest({ id: 'g-9', tableId: 't-1', firstName: 'Ewa', lastName: 'Nowak' });
    guestsSignal.set([guest]);
    tablesSignal.set([buildTable({ id: 't-1' })]);

    page.assignSeatById('t-1', 5, 'g-9');

    expect(page.announcement()).toContain('Ewa Nowak');
    expect(page.announcement()).toContain('5');
  });

  it('konflikt zwrócony przy przypisaniu jest komunikowany użytkownikowi (toast z powodem)', () => {
    const guest = buildGuest({ id: 'g-1', tableId: null });
    const table = buildTable({ id: 't-1' });
    guestsSignal.set([guest]);
    tablesSignal.set([table]);
    seatingMock.assignTable.mockReturnValueOnce(
      of({
        guest: buildGuest({ id: 'g-1', tableId: 't-1' }),
        warnings: [{ otherGuestName: 'Jan Kowalski', reason: 'byli małżeństwem' }],
      } as AssignTableResponse),
    );

    page.openGuestMenu(guest);
    page.assignFromMenu();

    expect(toastMock.show).toHaveBeenCalledOnce();
    const arg = toastMock.show.mock.calls[0][0];
    expect(arg.kind).toBe('warning');
    expect(arg.message).toContain('Jan Kowalski');
    expect(arg.message).toContain('byli małżeństwem');
  });
});
