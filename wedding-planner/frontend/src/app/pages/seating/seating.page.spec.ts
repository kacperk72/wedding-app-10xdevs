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
  dropTable(event: CdkDragDrop<Table[]>): void;
  moveTable(table: Table, direction: -1 | 1): void;
  canReorderTable(drag: { data: Guest | Table }): boolean;
  canEnterPool(drag: { data: Guest | Table }): boolean;
  assignSeatById(tableId: string, seatNumber: number, guestId: string): void;
  announcement(): string;
  viewMode(): 'compact' | 'detailed';
  setViewMode(mode: 'compact' | 'detailed'): void;
  printTarget(): 'couple' | 'venue';
  printLayout(): void;
  printVenueLayout(): void;
  roundSeatsForTable(table: Table): { seatNumber: number; guest: Guest; xPct: number; yPct: number }[];
  dietBadge(guest: Guest): string;
  unseatedGuests(): Guest[];
  guestsForTable(tableId: string): Guest[];
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
  let tablesMock: { tables: typeof tablesSignal; list: ReturnType<typeof vi.fn>; reorder: ReturnType<typeof vi.fn> };
  let page: SeatingInternals;

  beforeEach(() => {
    localStorage.clear();
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
    tablesMock = {
      tables: tablesSignal.asReadonly() as typeof tablesSignal,
      list: vi.fn(() => of(tablesSignal())),
      reorder: vi.fn(() => of([])),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: GuestsService, useValue: guestsMock },
        { provide: TablesService, useValue: tablesMock },
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

  it('przeciągnięcie karty stołu (drop) utrwala nową kolejność przez reorder', () => {
    const t1 = buildTable({ id: 't-1', name: 'Stół 1', sortOrder: 0 });
    const t2 = buildTable({ id: 't-2', name: 'Stół 2', sortOrder: 1 });
    const t3 = buildTable({ id: 't-3', name: 'Stół 3', sortOrder: 2 });
    tablesSignal.set([t1, t2, t3]);

    // Przeciągnij pierwszy stół na pozycję trzecią.
    page.dropTable({ previousIndex: 0, currentIndex: 2 } as CdkDragDrop<Table[]>);

    expect(tablesMock.reorder).toHaveBeenCalledOnce();
    const [weddingId, ordered] = tablesMock.reorder.mock.calls[0];
    expect(weddingId).toBe(WEDDING_ID);
    expect((ordered as Table[]).map((t) => t.id)).toEqual(['t-2', 't-3', 't-1']);
  });

  it('drop na tę samą pozycję nie wywołuje zapisu', () => {
    tablesSignal.set([buildTable({ id: 't-1' }), buildTable({ id: 't-2' })]);

    page.dropTable({ previousIndex: 1, currentIndex: 1 } as CdkDragDrop<Table[]>);

    expect(tablesMock.reorder).not.toHaveBeenCalled();
  });

  it('klawiaturowy fallback (strzałka) przesuwa stół i ogłasza nową pozycję', () => {
    const t1 = buildTable({ id: 't-1', name: 'Stół 1', sortOrder: 0 });
    const t2 = buildTable({ id: 't-2', name: 'Stół 2', sortOrder: 1 });
    tablesSignal.set([t1, t2]);

    // Strzałka w prawo na pierwszym stole → zamiana z drugim.
    page.moveTable(t1, 1);

    expect(tablesMock.reorder).toHaveBeenCalledOnce();
    const [, ordered] = tablesMock.reorder.mock.calls[0];
    expect((ordered as Table[]).map((t) => t.id)).toEqual(['t-2', 't-1']);
    expect(page.announcement()).toContain('Stół 1');
    expect(page.announcement()).toContain('pozycję 2');
  });

  it('strzałka poza zakres (pierwszy stół w lewo) nie robi nic', () => {
    const t1 = buildTable({ id: 't-1', sortOrder: 0 });
    tablesSignal.set([t1, buildTable({ id: 't-2', sortOrder: 1 })]);

    page.moveTable(t1, -1);

    expect(tablesMock.reorder).not.toHaveBeenCalled();
  });

  it('domyślny tryb widoku to kompaktowy', () => {
    expect(page.viewMode()).toBe('compact');
  });

  it('setViewMode przełącza na szczegółowy i utrwala wybór w localStorage', () => {
    page.setViewMode('detailed');

    expect(page.viewMode()).toBe('detailed');
    expect(localStorage.getItem('seating-view-mode')).toBe('detailed');
  });

  it('domyślnym wariantem wydruku jest przegląd dla pary', () => {
    expect(page.printTarget()).toBe('couple');
  });

  it('„Dla sali" przełącza wariant na venue i otwiera dialog druku po flushu', () => {
    vi.useFakeTimers();
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    page.printVenueLayout();

    // Wariant przełącza się synchronicznie; window.print() dopiero po flushu.
    expect(page.printTarget()).toBe('venue');
    expect(printSpy).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(printSpy).toHaveBeenCalledOnce();

    printSpy.mockRestore();
    vi.useRealTimers();
  });

  it('diagram okrągłego stołu pozycjonuje tylko zajęte krzesła po kątach wieńca', () => {
    const table = buildTable({ id: 't-1', seatsCount: 4 });
    const seat1 = buildGuest({ id: 'g-1', tableId: 't-1', seatNumber: 1, lastName: 'Adamska' });
    const seat3 = buildGuest({ id: 'g-3', tableId: 't-1', seatNumber: 3, lastName: 'Zając' });
    const noSeat = buildGuest({ id: 'g-9', tableId: 't-1', seatNumber: null, lastName: 'Bez' });
    guestsSignal.set([seat3, seat1, noSeat]);
    tablesSignal.set([table]);

    const seats = page.roundSeatsForTable(table);

    // Tylko krzesła z gościem (g-9 bez numeru pomijany); pozycje wg numeru krzesła.
    expect(seats.map((s) => s.seatNumber)).toEqual([1, 3]);
    expect(seats.some((s) => s.guest.id === 'g-9')).toBe(false);

    // Krzesło 1 (index 0) leży u góry: kąt -90° → środek w poziomie, minimum w pionie.
    const top = seats.find((s) => s.seatNumber === 1)!;
    expect(top.xPct).toBeCloseTo(50, 5);
    expect(top.yPct).toBeCloseTo(10, 5); // 50 - radius(40)
    // Krzesło 3 (index 2) leży naprzeciw, u dołu.
    const bottom = seats.find((s) => s.seatNumber === 3)!;
    expect(bottom.xPct).toBeCloseTo(50, 5);
    expect(bottom.yPct).toBeCloseTo(90, 5); // 50 + radius(40)
  });

  it('dietBadge daje kod WEGE/WEGAN/DZIECKO, a dla reszty pusty string', () => {
    expect(page.dietBadge(buildGuest({ diet: 'vege' as Diet }))).toBe('WEGE');
    expect(page.dietBadge(buildGuest({ diet: 'vegan' as Diet }))).toBe('WEGAN');
    expect(page.dietBadge(buildGuest({ diet: 'kids' as Diet }))).toBe('DZIECKO');
    expect(page.dietBadge(buildGuest({ diet: 'standard' as Diet }))).toBe('');
    expect(page.dietBadge(buildGuest({ diet: 'gluten_free' as Diet }))).toBe('');
  });

  it('goście z odmową (declined) nie pojawiają się w puli ani przy stołach', () => {
    const declinedUnseated = buildGuest({ id: 'g-d1', tableId: null, rsvpStatus: 'declined' });
    const declinedSeated = buildGuest({ id: 'g-d2', tableId: 't-1', seatNumber: 1, rsvpStatus: 'declined' });
    const confirmedUnseated = buildGuest({ id: 'g-ok1', tableId: null, rsvpStatus: 'confirmed' });
    const confirmedSeated = buildGuest({ id: 'g-ok2', tableId: 't-1', seatNumber: 2, rsvpStatus: 'confirmed' });
    guestsSignal.set([declinedUnseated, declinedSeated, confirmedUnseated, confirmedSeated]);
    tablesSignal.set([buildTable({ id: 't-1', seatsCount: 8 })]);

    // Pula nieposadzonych: bez declined.
    expect(page.unseatedGuests().map((g) => g.id)).toEqual(['g-ok1']);
    // Przy stole: bez declined.
    expect(page.guestsForTable('t-1').map((g) => g.id)).toEqual(['g-ok2']);
  });

  it('predykaty izolują przeciąganie stołu od list gości', () => {
    const table = buildTable({ id: 't-1' });
    const guest = buildGuest({ id: 'g-1' });

    // Siatka stołów przyjmuje tylko kartę stołu; pula gości tylko gościa.
    expect(page.canReorderTable({ data: table })).toBe(true);
    expect(page.canReorderTable({ data: guest })).toBe(false);
    expect(page.canEnterPool({ data: table })).toBe(false);
    expect(page.canEnterPool({ data: guest })).toBe(true);
  });
});
