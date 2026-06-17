import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { Task, TasksService } from './tasks.service';
import { apiUrl } from '../http/api-url';

const WEDDING_ID = 'wed-1';

// Frozen "today" for every test in this file. The bucket logic reads
// `new Date()`, so without a frozen clock these assertions would silently
// rot as the real date moves (the time-bomb the backend suite hit 2026-05-31).
const FROZEN_NOW = new Date('2026-06-17T12:00:00');

let seq = 0;
function buildTask(overrides: Partial<Task> = {}): Task {
  seq += 1;
  return {
    id: `t-${seq}`,
    weddingId: WEDDING_ID,
    title: `Zadanie ${seq}`,
    description: null,
    category: 'inne',
    dueDate: '2026-06-17',
    done: false,
    doneAt: null,
    ...overrides,
  };
}

// Hand-picked fixture relative to FROZEN_NOW (2026-06-17). Expected buckets are
// computed by hand below — never by calling the service's own daysFromToday.
const T_OVERDUE = buildTask({ id: 'overdue', dueDate: '2026-06-10' }); // -7 days
const T_TODAY = buildTask({ id: 'today', dueDate: '2026-06-17' }); //  0 days
const T_DAY7 = buildTask({ id: 'day7', dueDate: '2026-06-24' }); // +7 days (boundary, inclusive)
const T_DAY8 = buildTask({ id: 'day8', dueDate: '2026-06-25' }); // +8 days (just past the week)
const T_DONE = buildTask({ id: 'done', dueDate: '2026-06-12', done: true, doneAt: '2026-06-11T10:00:00Z' });
const T_DONE_EARLIER = buildTask({ id: 'done-earlier', dueDate: '2026-06-05', done: true });

const ACTIVE = [T_DAY8, T_OVERDUE, T_DAY7, T_TODAY]; // deliberately unsorted
const COMPLETED = [T_DONE, T_DONE_EARLIER];

describe('TasksService', () => {
  let service: TasksService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_NOW);
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(TasksService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  function loadFixture(): void {
    service.loadTasks(WEDDING_ID).subscribe();
    const active = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/tasks`));
    expect(active.request.method).toBe('GET');
    const completed = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/tasks?done=true`));
    expect(completed.request.method).toBe('GET');
    active.flush(ACTIVE);
    completed.flush(COMPLETED);
  }

  it('ładuje zadania pod właściwymi (wedding-scoped) URL-ami i scala obie listy do signala', () => {
    loadFixture();
    // 4 active + 2 completed, sorted ascending by dueDate.
    expect(service.tasks().map((t) => t.id)).toEqual([
      'done-earlier', // 2026-06-05
      'overdue', //      2026-06-10
      'done', //         2026-06-12
      'today', //        2026-06-17
      'day7', //         2026-06-24
      'day8', //         2026-06-25
    ]);
  });

  it('zalicza tylko aktywne zadanie z przeszłości do overdueTasks', () => {
    loadFixture();
    expect(service.overdueTasks().map((t) => t.id)).toEqual(['overdue']);
  });

  it('zalicza dzień 0 oraz brzegowy dzień +7 do thisWeekTasks (ale nie +8)', () => {
    loadFixture();
    expect(service.thisWeekTasks().map((t) => t.id)).toEqual(['today', 'day7']);
  });

  it('zalicza dopiero dzień +8 do futureTasks', () => {
    loadFixture();
    expect(service.futureTasks().map((t) => t.id)).toEqual(['day8']);
  });

  it('completedTasks zawiera wyłącznie ukończone, posortowane rosnąco po dacie', () => {
    loadFixture();
    expect(service.completedTasks().map((t) => t.id)).toEqual(['done-earlier', 'done']);
  });

  it('createTask POST-uje pod wedding-scoped URL i dokłada zadanie do signala z zachowaniem sortowania', () => {
    loadFixture();
    const created = buildTask({ id: 'new', dueDate: '2026-06-13' });

    service.createTask(WEDDING_ID, { title: 'Nowe', category: 'inne', dueDate: '2026-06-13' }).subscribe();
    const req = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/tasks`));
    expect(req.request.method).toBe('POST');
    req.flush(created);

    // Inserted between 'done' (06-12) and 'today' (06-17).
    expect(service.tasks().map((t) => t.id)).toEqual([
      'done-earlier',
      'overdue',
      'done',
      'new',
      'today',
      'day7',
      'day8',
    ]);
  });

  it('updateTask PATCH-uje pod wedding-scoped URL i podmienia rekord po id', () => {
    loadFixture();
    const updated = { ...T_OVERDUE, title: 'Zmienione' };

    service.updateTask(WEDDING_ID, 'overdue', { title: 'Zmienione' }).subscribe();
    const req = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/tasks/overdue`));
    expect(req.request.method).toBe('PATCH');
    req.flush(updated);

    expect(service.tasks().find((t) => t.id === 'overdue')?.title).toBe('Zmienione');
  });

  it('removeTask DELETE-uje pod wedding-scoped URL i usuwa rekord z signala', () => {
    loadFixture();

    service.removeTask(WEDDING_ID, 'day8').subscribe();
    const req = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/tasks/day8`));
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(service.tasks().some((t) => t.id === 'day8')).toBe(false);
    expect(service.tasks().length).toBe(5);
  });
});
