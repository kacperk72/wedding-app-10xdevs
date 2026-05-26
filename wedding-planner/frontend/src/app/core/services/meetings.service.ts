import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { CreateMeetingDto, Meeting, UpdateMeetingDto } from '../models/meeting.model';
import { apiUrl } from '../http/api-url';

@Injectable({ providedIn: 'root' })
export class MeetingsService {
  private readonly http = inject(HttpClient);

  private readonly _meetings = signal<Meeting[]>([]);
  readonly meetings = this._meetings.asReadonly();

  private readonly _upcoming = signal<Meeting[]>([]);
  readonly upcoming = this._upcoming.asReadonly();

  list(weddingId: string): Observable<Meeting[]> {
    return this.http
      .get<Meeting[]>(apiUrl(`/weddings/${weddingId}/meetings`))
      .pipe(tap((meetings) => this._meetings.set(meetings)));
  }

  loadUpcoming(weddingId: string): Observable<Meeting[]> {
    return this.http
      .get<Meeting[]>(apiUrl(`/weddings/${weddingId}/meetings/upcoming`))
      .pipe(tap((meetings) => this._upcoming.set(meetings)));
  }

  create(weddingId: string, dto: CreateMeetingDto): Observable<Meeting> {
    return this.http.post<Meeting>(apiUrl(`/weddings/${weddingId}/meetings`), dto).pipe(
      tap((created) => {
        this._meetings.update((list) => [...list, created]);
        this._upcoming.update((list) => this.sortUpcoming([...list, created]));
      }),
    );
  }

  update(weddingId: string, id: string, patch: UpdateMeetingDto): Observable<Meeting> {
    return this.http.patch<Meeting>(apiUrl(`/weddings/${weddingId}/meetings/${id}`), patch).pipe(
      tap((updated) => {
        this._meetings.update((list) => list.map((meeting) => (meeting.id === id ? updated : meeting)));
        this._upcoming.update((list) =>
          this.sortUpcoming(list.map((meeting) => (meeting.id === id ? updated : meeting))),
        );
      }),
    );
  }

  remove(weddingId: string, id: string): Observable<void> {
    return this.http.delete<void>(apiUrl(`/weddings/${weddingId}/meetings/${id}`)).pipe(
      tap(() => {
        this._meetings.update((list) => list.filter((meeting) => meeting.id !== id));
        this._upcoming.update((list) => list.filter((meeting) => meeting.id !== id));
      }),
    );
  }

  private sortUpcoming(meetings: Meeting[]): Meeting[] {
    return [...meetings].sort((a, b) => a.meetingDate.localeCompare(b.meetingDate));
  }
}
