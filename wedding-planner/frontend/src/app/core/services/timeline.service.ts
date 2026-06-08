import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, tap } from 'rxjs';
import { apiUrl } from '../http/api-url';

export type CeremonyType = 'koscielny' | 'cywilny';
export type EntranceOrder = 'goscie_pierwsi' | 'para_pierwsza';
export type GlassThrowing = 'nie' | 'zewnatrz' | 'wewnatrz';
export type WishesLocation = 'pod_koscielem' | 'lokal_przed_obiadem' | 'lokal_po_obiedzie';
export type SongKind = 'must' | 'do_not';

export interface TimelineEvent {
  id: string;
  weddingId: string;
  label: string;
  eventTime: string | null;
  sortOrder: number;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface TimelineSong {
  id: string;
  weddingId: string;
  kind: SongKind;
  title: string;
  artist: string | null;
  sortOrder: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface Timeline {
  id: string | null;
  weddingId: string | null;
  ceremonyType: CeremonyType | null;
  ceremonyTime: string | null;
  travelMinutes: number | null;
  venueArrivalTime: string | null;
  entranceOrder: EntranceOrder | null;
  glassThrowing: GlassThrowing | null;
  wishesLocation: WishesLocation | null;
  danceFloorGroundFloor: boolean | null;
  hasChildren: boolean | null;
  gorzkoTolerance: boolean | null;
  venueManagerName: string | null;
  venueManagerPhone: string | null;
  witnesses: string | null;
  brideParents: string | null;
  groomParents: string | null;
  firstDanceTime: string | null;
  firstDanceSong: string | null;
  firstDanceFull: boolean | null;
  parentsThanksEnabled: boolean | null;
  parentsThanksTime: string | null;
  parentsThanksForm: string | null;
  parentsThanksSong: string | null;
  cakeTime: string | null;
  cakeEntrySong: string | null;
  cakeCuttingSong: string | null;
  genrePreferences: string[];
  musicPerStage: Record<string, string>;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  events: TimelineEvent[];
  mustPlay: TimelineSong[];
  doNotPlay: TimelineSong[];
}

export type TimelinePatch = Partial<
  Omit<
    Timeline,
    'id' | 'weddingId' | 'createdAt' | 'updatedAt' | 'events' | 'mustPlay' | 'doNotPlay'
  >
>;

export interface CreateEventDto {
  label: string;
  eventTime?: string | null;
  sortOrder?: number;
  notes?: string | null;
}

export type UpdateEventDto = Partial<CreateEventDto>;

export interface CreateSongDto {
  kind: SongKind;
  title: string;
  artist?: string | null;
  sortOrder?: number;
}

export type UpdateSongDto = Partial<Omit<CreateSongDto, 'kind'>>;

@Injectable({ providedIn: 'root' })
export class TimelineService {
  private readonly http = inject(HttpClient);

  private readonly _timeline = signal<Timeline | null>(null);
  readonly timeline = this._timeline.asReadonly();

  readonly events = computed(() => this._timeline()?.events ?? []);
  readonly mustPlay = computed(() => this._timeline()?.mustPlay ?? []);
  readonly doNotPlay = computed(() => this._timeline()?.doNotPlay ?? []);

  private base(weddingId: string): string {
    return `/weddings/${weddingId}/timeline`;
  }

  load(weddingId: string): Observable<Timeline> {
    return this.http
      .get<Timeline>(apiUrl(this.base(weddingId)))
      .pipe(tap((timeline) => this._timeline.set(timeline)));
  }

  patchFields(weddingId: string, patch: TimelinePatch): Observable<Timeline> {
    return this.http
      .patch<Timeline>(apiUrl(this.base(weddingId)), patch)
      .pipe(tap((timeline) => this._timeline.set(timeline)));
  }

  // --- Zdarzenia (przebieg dnia) -------------------------------------------

  addEvent(weddingId: string, dto: CreateEventDto): Observable<TimelineEvent> {
    return this.http
      .post<TimelineEvent>(apiUrl(`${this.base(weddingId)}/events`), dto)
      .pipe(tap((created) => this.upsertEvents([created])));
  }

  updateEvent(weddingId: string, id: string, patch: UpdateEventDto): Observable<TimelineEvent> {
    return this.http
      .patch<TimelineEvent>(apiUrl(`${this.base(weddingId)}/events/${id}`), patch)
      .pipe(tap((updated) => this.upsertEvents([updated])));
  }

  removeEvent(weddingId: string, id: string): Observable<void> {
    return this.http
      .delete<void>(apiUrl(`${this.base(weddingId)}/events/${id}`))
      .pipe(tap(() => this.patchTimeline((t) => ({ events: t.events.filter((e) => e.id !== id) }))));
  }

  seedTemplate(weddingId: string): Observable<TimelineEvent[]> {
    return this.http
      .post<TimelineEvent[]>(apiUrl(`${this.base(weddingId)}/events/seed-template`), {})
      .pipe(tap((events) => this.patchTimeline(() => ({ events: this.sortEvents(events) }))));
  }

  // Zamiana kolejności dwóch sąsiednich zdarzeń (przyciski ↑/↓ — bez drag-and-drop).
  swapEvents(weddingId: string, a: TimelineEvent, b: TimelineEvent): Observable<TimelineEvent[]> {
    return forkJoin([
      this.http.patch<TimelineEvent>(apiUrl(`${this.base(weddingId)}/events/${a.id}`), {
        sortOrder: b.sortOrder,
      }),
      this.http.patch<TimelineEvent>(apiUrl(`${this.base(weddingId)}/events/${b.id}`), {
        sortOrder: a.sortOrder,
      }),
    ]).pipe(tap((updated) => this.upsertEvents(updated)));
  }

  // --- Utwory (must-play / do-not-play) ------------------------------------

  addSong(weddingId: string, dto: CreateSongDto): Observable<TimelineSong> {
    return this.http
      .post<TimelineSong>(apiUrl(`${this.base(weddingId)}/songs`), dto)
      .pipe(tap((created) => this.upsertSongs([created])));
  }

  updateSong(weddingId: string, id: string, patch: UpdateSongDto): Observable<TimelineSong> {
    return this.http
      .patch<TimelineSong>(apiUrl(`${this.base(weddingId)}/songs/${id}`), patch)
      .pipe(tap((updated) => this.upsertSongs([updated])));
  }

  removeSong(weddingId: string, id: string): Observable<void> {
    return this.http.delete<void>(apiUrl(`${this.base(weddingId)}/songs/${id}`)).pipe(
      tap(() =>
        this.patchTimeline((t) => ({
          mustPlay: t.mustPlay.filter((s) => s.id !== id),
          doNotPlay: t.doNotPlay.filter((s) => s.id !== id),
        })),
      ),
    );
  }

  // --- Pomocnicze ----------------------------------------------------------

  private patchTimeline(patch: (current: Timeline) => Partial<Timeline>): void {
    this._timeline.update((current) => (current ? { ...current, ...patch(current) } : current));
  }

  private upsertEvents(events: TimelineEvent[]): void {
    this.patchTimeline((t) => {
      const byId = new Map(t.events.map((e) => [e.id, e]));
      for (const event of events) byId.set(event.id, event);
      return { events: this.sortEvents([...byId.values()]) };
    });
  }

  private upsertSongs(songs: TimelineSong[]): void {
    this.patchTimeline((t) => {
      const must = new Map(t.mustPlay.map((s) => [s.id, s]));
      const doNot = new Map(t.doNotPlay.map((s) => [s.id, s]));
      for (const song of songs) {
        must.delete(song.id);
        doNot.delete(song.id);
        (song.kind === 'must' ? must : doNot).set(song.id, song);
      }
      return {
        mustPlay: this.sortSongs([...must.values()]),
        doNotPlay: this.sortSongs([...doNot.values()]),
      };
    });
  }

  private sortEvents(events: TimelineEvent[]): TimelineEvent[] {
    return [...events].sort(
      (a, b) => a.sortOrder - b.sortOrder || (a.eventTime ?? '').localeCompare(b.eventTime ?? ''),
    );
  }

  private sortSongs(songs: TimelineSong[]): TimelineSong[] {
    return [...songs].sort((a, b) => a.sortOrder - b.sortOrder);
  }
}
