import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { CreateVendorDto, UpdateVendorDto, Vendor } from '../models/vendor.model';
import { apiUrl } from '../http/api-url';

@Injectable({ providedIn: 'root' })
export class VendorsService {
  private readonly http = inject(HttpClient);

  private readonly _vendors = signal<Vendor[]>([]);
  readonly vendors = this._vendors.asReadonly();

  private readonly _missingCategories = signal<string[]>([]);
  readonly missingCategories = this._missingCategories.asReadonly();

  list(weddingId: string): Observable<Vendor[]> {
    return this.http
      .get<Vendor[]>(apiUrl(`/weddings/${weddingId}/vendors`))
      .pipe(tap((vendors) => this._vendors.set(vendors)));
  }

  missing(weddingId: string): Observable<string[]> {
    return this.http
      .get<string[]>(apiUrl(`/weddings/${weddingId}/vendors/missing`))
      .pipe(tap((categories) => this._missingCategories.set(categories)));
  }

  create(weddingId: string, dto: CreateVendorDto): Observable<Vendor> {
    return this.http
      .post<Vendor>(apiUrl(`/weddings/${weddingId}/vendors`), dto)
      .pipe(tap((created) => this._vendors.update((list) => [...list, created])));
  }

  update(weddingId: string, id: string, patch: UpdateVendorDto): Observable<Vendor> {
    return this.http.patch<Vendor>(apiUrl(`/weddings/${weddingId}/vendors/${id}`), patch).pipe(
      tap((updated) =>
        this._vendors.update((list) =>
          list.map((vendor) => (vendor.id === id ? updated : vendor)),
        ),
      ),
    );
  }

  remove(weddingId: string, id: string): Observable<void> {
    return this.http
      .delete<void>(apiUrl(`/weddings/${weddingId}/vendors/${id}`))
      .pipe(tap(() => this._vendors.update((list) => list.filter((vendor) => vendor.id !== id))));
  }
}
