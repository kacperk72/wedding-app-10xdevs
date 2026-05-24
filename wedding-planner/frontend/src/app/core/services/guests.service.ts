import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import {
  CreateGuestDto,
  Guest,
  GuestAggregates,
  GuestFilters,
  Relation,
  UpdateGuestDto,
} from '../models/guest.model';
import { apiUrl } from '../http/api-url';

const DEFAULT_FILTERS: GuestFilters = {
  search: '',
  rsvp: 'all',
  diet: 'all',
  relation: 'all',
  sort: 'lastName',
};

@Injectable({ providedIn: 'root' })
export class GuestsService {
  private readonly http = inject(HttpClient);

  private readonly _guests = signal<Guest[]>([]);
  readonly guests = this._guests.asReadonly();

  private readonly _serverAggregates = signal<GuestAggregates | null>(null);

  private readonly _filters = signal<GuestFilters>(DEFAULT_FILTERS);
  readonly filters = this._filters.asReadonly();

  setFilters(patch: Partial<GuestFilters>): void {
    this._filters.update((f) => ({ ...f, ...patch }));
  }

  readonly aggregates = computed<GuestAggregates>(() => {
    const serverAggregates = this._serverAggregates();
    if (serverAggregates) return serverAggregates;

    const list = this._guests();
    return {
      invited: list.length,
      confirmed: list.filter((g) => g.rsvpStatus === 'confirmed').length,
      pending: list.filter((g) => g.rsvpStatus === 'pending').length,
      declined: list.filter((g) => g.rsvpStatus === 'declined').length,
      vegeOrVegan: list.filter((g) => g.diet === 'vege' || g.diet === 'vegan').length,
      children: list.filter((g) => g.isChild).length,
      noMealPick: list.filter((g) => g.mealOptionId === null).length,
    };
  });

  readonly filteredGuests = computed<Guest[]>(() => {
    const f = this._filters();
    const q = f.search.trim().toLowerCase();
    return this._guests()
      .filter(
        (g) =>
        (f.rsvp === 'all' || g.rsvpStatus === f.rsvp) &&
        (f.diet === 'all' || g.diet === f.diet) &&
        (f.relation === 'all' || g.relation === f.relation) &&
        (q === '' || `${g.firstName} ${g.lastName}`.toLowerCase().includes(q)),
      )
      .sort((a, b) => {
        const first = f.sort === 'firstName' ? a.firstName : a.lastName;
        const second = f.sort === 'firstName' ? b.firstName : b.lastName;
        return first.localeCompare(second, 'pl');
      });
  });

  readonly groupedByRelation = computed<Array<[Relation, Guest[]]>>(() => {
    const groups = new Map<Relation, Guest[]>();
    for (const g of this.filteredGuests()) {
      const arr = groups.get(g.relation) ?? [];
      arr.push(g);
      groups.set(g.relation, arr);
    }
    return Array.from(groups.entries());
  });

  list(weddingId: string): Observable<Guest[]> {
    return this.http
      .get<Guest[]>(apiUrl(`/weddings/${weddingId}/guests`))
      .pipe(
        tap((guests) => {
          this._serverAggregates.set(null);
          this._guests.set(guests);
        }),
      );
  }

  loadAggregates(weddingId: string): Observable<GuestAggregates> {
    return this.http
      .get<GuestAggregates>(apiUrl(`/weddings/${weddingId}/guests/aggregates`))
      .pipe(tap((aggregates) => this._serverAggregates.set(aggregates)));
  }

  create(weddingId: string, dto: CreateGuestDto): Observable<Guest> {
    return this.http
      .post<Guest>(apiUrl(`/weddings/${weddingId}/guests`), dto)
      .pipe(
        tap((created) => {
          this._serverAggregates.set(null);
          this._guests.update((list) => [...list, created]);
        }),
      );
  }

  update(weddingId: string, id: string, patch: UpdateGuestDto): Observable<Guest> {
    return this.http
      .patch<Guest>(apiUrl(`/weddings/${weddingId}/guests/${id}`), patch)
      .pipe(
        tap((updated) =>
          this._guests.update((list) => {
            this._serverAggregates.set(null);
            return list.map((g) => (g.id === id ? updated : g));
          }),
        ),
      );
  }

  remove(weddingId: string, id: string): Observable<void> {
    return this.http
      .delete<void>(apiUrl(`/weddings/${weddingId}/guests/${id}`))
      .pipe(
        tap(() => {
          this._serverAggregates.set(null);
          this._guests.update((list) => list.filter((g) => g.id !== id));
        }),
      );
  }
}
