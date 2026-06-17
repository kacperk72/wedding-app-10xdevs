import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { MeetingsService } from './meetings.service';
import { apiUrl } from '../http/api-url';
import { Meeting } from '../models/meeting.model';

const WEDDING_ID = 'wed-1';

function buildMeeting(overrides: Partial<Meeting> = {}): Meeting {
  return {
    id: 'mt-1',
    weddingId: WEDDING_ID,
    title: 'Spotkanie',
    meetingDate: '2026-07-15',
    vendorId: null,
    vendorName: null,
    notes: null,
    ...overrides,
  };
}

describe('MeetingsService', () => {
  let service: MeetingsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(MeetingsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list pobiera pod wedding-scoped URL i wypełnia signal meetings', () => {
    service.list(WEDDING_ID).subscribe();
    const req = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/meetings`));
    expect(req.request.method).toBe('GET');
    req.flush([buildMeeting({ id: 'mt-1' })]);
    expect(service.meetings().map((m) => m.id)).toEqual(['mt-1']);
  });

  it('loadUpcoming pobiera z osobnego wedding-scoped URL i wypełnia signal upcoming', () => {
    service.loadUpcoming(WEDDING_ID).subscribe();
    const req = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/meetings/upcoming`));
    expect(req.request.method).toBe('GET');
    req.flush([buildMeeting({ id: 'mt-1' })]);
    expect(service.upcoming().map((m) => m.id)).toEqual(['mt-1']);
  });

  it('create dokłada do obu signali i utrzymuje upcoming posortowane rosnąco po dacie', () => {
    service.loadUpcoming(WEDDING_ID).subscribe();
    httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/meetings/upcoming`)).flush([
      buildMeeting({ id: 'early', meetingDate: '2026-07-10' }),
      buildMeeting({ id: 'late', meetingDate: '2026-07-20' }),
    ]);

    service
      .create(WEDDING_ID, { title: 'Środek', meetingDate: '2026-07-15' })
      .subscribe();
    const req = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/meetings`));
    expect(req.request.method).toBe('POST');
    req.flush(buildMeeting({ id: 'mid', meetingDate: '2026-07-15' }));

    // Inserted between early (07-10) and late (07-20), upcoming re-sorted.
    expect(service.upcoming().map((m) => m.id)).toEqual(['early', 'mid', 'late']);
    expect(service.meetings().map((m) => m.id)).toEqual(['mid']);
  });

  it('remove usuwa rekord z obu signali', () => {
    service.loadUpcoming(WEDDING_ID).subscribe();
    httpMock
      .expectOne(apiUrl(`/weddings/${WEDDING_ID}/meetings/upcoming`))
      .flush([buildMeeting({ id: 'mt-1' }), buildMeeting({ id: 'mt-2' })]);

    service.remove(WEDDING_ID, 'mt-1').subscribe();
    const req = httpMock.expectOne(apiUrl(`/weddings/${WEDDING_ID}/meetings/mt-1`));
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(service.upcoming().map((m) => m.id)).toEqual(['mt-2']);
  });
});
