import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { Contract } from '../models/contract.model';
import {
  CateringAddon,
  CateringDish,
  CateringOffer,
  CateringSelection,
  CreateAddonDto,
  CreateDishDto,
  CreateOfferDto,
  FreezeContractDto,
  PriceBreakdown,
  SyncMealOptionsResult,
} from '../models/catering.model';
import { apiUrl } from '../http/api-url';
import { ContractsService } from './contracts.service';
import { MealOptionsService } from './meal-options.service';

@Injectable({ providedIn: 'root' })
export class CateringService {
  private readonly http = inject(HttpClient);
  private readonly mealOptions = inject(MealOptionsService);
  private readonly contracts = inject(ContractsService);

  private readonly _offers = signal<CateringOffer[]>([]);
  readonly offers = this._offers.asReadonly();

  private readonly _activeOffer = signal<CateringOffer | null>(null);
  readonly activeOffer = this._activeOffer.asReadonly();

  private readonly _selection = signal<CateringSelection | null>(null);
  readonly selection = this._selection.asReadonly();

  private readonly _priceBreakdown = signal<PriceBreakdown | null>(null);
  readonly priceBreakdown = this._priceBreakdown.asReadonly();

  private readonly _mealOptionsInSync = signal(false);
  readonly mealOptionsInSync = this._mealOptionsInSync.asReadonly();

  loadOffers(weddingId: string): Observable<CateringOffer[]> {
    return this.http
      .get<CateringOffer[]>(apiUrl(`/weddings/${weddingId}/catering/offers`))
      .pipe(tap((offers) => this._offers.set(offers)));
  }

  createOffer(weddingId: string, dto: CreateOfferDto): Observable<CateringOffer> {
    return this.http.post<CateringOffer>(apiUrl(`/weddings/${weddingId}/catering/offers`), dto).pipe(
      tap((offer) => {
        this._offers.update((list) => [offer, ...list]);
        this._activeOffer.set(offer);
      }),
    );
  }

  updateOffer(weddingId: string, id: string, patch: Partial<CreateOfferDto>): Observable<CateringOffer> {
    return this.http.patch<CateringOffer>(apiUrl(`/weddings/${weddingId}/catering/offers/${id}`), patch).pipe(
      tap((offer) => {
        this._offers.update((list) => list.map((item) => (item.id === id ? offer : item)));
        this._activeOffer.update((current) => (current?.id === id ? { ...current, ...offer } : current));
      }),
    );
  }

  deleteOffer(weddingId: string, id: string): Observable<void> {
    return this.http.delete<void>(apiUrl(`/weddings/${weddingId}/catering/offers/${id}`)).pipe(
      tap(() => {
        this._offers.update((list) => list.filter((offer) => offer.id !== id));
        this._activeOffer.update((offer) => (offer?.id === id ? null : offer));
      }),
    );
  }

  loadOffer(weddingId: string, offerId: string): Observable<CateringOffer> {
    return this.http
      .get<CateringOffer>(apiUrl(`/weddings/${weddingId}/catering/offers/${offerId}`))
      .pipe(tap((offer) => this._activeOffer.set(offer)));
  }

  createDish(weddingId: string, offerId: string, dto: CreateDishDto): Observable<CateringDish> {
    return this.http
      .post<CateringDish>(apiUrl(`/weddings/${weddingId}/catering/dishes/offers/${offerId}/dishes`), dto)
      .pipe(tap(() => this.loadOffer(weddingId, offerId).subscribe()));
  }

  updateDish(weddingId: string, offerId: string, dishId: string, patch: Partial<CreateDishDto>): Observable<CateringDish> {
    return this.http
      .patch<CateringDish>(apiUrl(`/weddings/${weddingId}/catering/dishes/${dishId}`), patch)
      .pipe(tap(() => this.loadOffer(weddingId, offerId).subscribe()));
  }

  deleteDish(weddingId: string, offerId: string, dishId: string): Observable<void> {
    return this.http.delete<void>(apiUrl(`/weddings/${weddingId}/catering/dishes/${dishId}`)).pipe(
      tap(() => this.loadOffer(weddingId, offerId).subscribe()),
    );
  }

  linkDishToCourse(weddingId: string, offerId: string, courseId: string, dishId: string): Observable<unknown> {
    return this.http
      .post(apiUrl(`/weddings/${weddingId}/catering/courses/${courseId}/dishes`), {
        cateringDishId: dishId,
      })
      .pipe(tap(() => this.loadOffer(weddingId, offerId).subscribe()));
  }

  unlinkDishFromCourse(weddingId: string, offerId: string, courseId: string, dishId: string): Observable<void> {
    return this.http
      .delete<void>(apiUrl(`/weddings/${weddingId}/catering/courses/${courseId}/dishes/${dishId}`))
      .pipe(tap(() => this.loadOffer(weddingId, offerId).subscribe()));
  }

  updatePackage(weddingId: string, offerId: string, packageId: string, patch: unknown): Observable<unknown> {
    return this.http
      .patch(apiUrl(`/weddings/${weddingId}/catering/packages/${packageId}`), patch)
      .pipe(tap(() => this.loadOffer(weddingId, offerId).subscribe()));
  }

  createAddon(weddingId: string, offerId: string, dto: CreateAddonDto): Observable<CateringAddon> {
    return this.http
      .post<CateringAddon>(apiUrl(`/weddings/${weddingId}/catering/offers/${offerId}/addons`), dto)
      .pipe(tap(() => this.loadOffer(weddingId, offerId).subscribe()));
  }

  updateAddon(weddingId: string, offerId: string, addonId: string, patch: Partial<CateringAddon>): Observable<CateringAddon> {
    return this.http
      .patch<CateringAddon>(apiUrl(`/weddings/${weddingId}/catering/addons/${addonId}`), patch)
      .pipe(tap(() => this.loadOffer(weddingId, offerId).subscribe()));
  }

  deleteAddon(weddingId: string, offerId: string, addonId: string): Observable<void> {
    return this.http
      .delete<void>(apiUrl(`/weddings/${weddingId}/catering/addons/${addonId}`))
      .pipe(tap(() => this.loadOffer(weddingId, offerId).subscribe()));
  }

  loadSelection(weddingId: string): Observable<CateringSelection | null> {
    return this.http
      .get<CateringSelection | null>(apiUrl(`/weddings/${weddingId}/catering/selection`))
      .pipe(
        tap((selection) => {
          this._selection.set(selection);
          this._priceBreakdown.set(selection?.price ?? null);
        }),
      );
  }

  upsertSelection(
    weddingId: string,
    packageId: string,
    guestCountEstimate: number,
    notes?: string | null,
  ): Observable<CateringSelection> {
    return this.http
      .put<CateringSelection>(apiUrl(`/weddings/${weddingId}/catering/selection`), {
        packageId,
        guestCountEstimate,
        notes,
      })
      .pipe(
        tap((selection) => {
          this._selection.set(selection);
          this._priceBreakdown.set(selection.price ?? null);
          this._mealOptionsInSync.set(false);
        }),
      );
  }

  addDishPick(weddingId: string, courseId: string, dishId: string): Observable<unknown> {
    return this.http
      .post(apiUrl(`/weddings/${weddingId}/catering/selection/dish-picks`), { courseId, dishId })
      .pipe(tap(() => this.refreshSelection(weddingId)));
  }

  removeDishPick(weddingId: string, courseId: string, dishId: string): Observable<void> {
    return this.http
      .delete<void>(apiUrl(`/weddings/${weddingId}/catering/selection/dish-picks/${courseId}/${dishId}`))
      .pipe(tap(() => this.refreshSelection(weddingId)));
  }

  setAddonPick(weddingId: string, addonId: string, quantity: number): Observable<unknown> {
    return this.http
      .put(apiUrl(`/weddings/${weddingId}/catering/selection/addon-picks/${addonId}`), { quantity })
      .pipe(tap(() => this.refreshSelection(weddingId)));
  }

  removeAddonPick(weddingId: string, addonId: string): Observable<void> {
    return this.http
      .delete<void>(apiUrl(`/weddings/${weddingId}/catering/selection/addon-picks/${addonId}`))
      .pipe(tap(() => this.refreshSelection(weddingId)));
  }

  loadPrice(weddingId: string): Observable<PriceBreakdown> {
    return this.http
      .get<PriceBreakdown>(apiUrl(`/weddings/${weddingId}/catering/selection/price`))
      .pipe(tap((price) => this._priceBreakdown.set(price)));
  }

  syncMealOptions(weddingId: string): Observable<SyncMealOptionsResult> {
    return this.http
      .post<SyncMealOptionsResult>(apiUrl(`/weddings/${weddingId}/catering/selection/sync-meal-options`), {})
      .pipe(
        tap(() => {
          this._mealOptionsInSync.set(true);
          this.mealOptions.list(weddingId).subscribe();
        }),
      );
  }

  freezeIntoContract(
    weddingId: string,
    dto: FreezeContractDto,
  ): Observable<{ contract: Contract; payments: unknown[] }> {
    return this.http
      .post<{ contract: Contract; payments: unknown[] }>(
        apiUrl(`/weddings/${weddingId}/catering/selection/freeze-into-contract`),
        dto,
      )
      .pipe(tap(() => this.contracts.list(weddingId).subscribe()));
  }

  private refreshSelection(weddingId: string): void {
    this.loadSelection(weddingId).subscribe();
  }
}
