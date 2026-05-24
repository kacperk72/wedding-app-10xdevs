import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { Contract, CreateContractDto, Payment, UpdateContractDto } from '../models/contract.model';
import { apiUrl } from '../http/api-url';

@Injectable({ providedIn: 'root' })
export class ContractsService {
  private readonly http = inject(HttpClient);

  private readonly _contracts = signal<Contract[]>([]);
  readonly contracts = this._contracts.asReadonly();

  private readonly _upcomingPayments = signal<Payment[]>([]);
  readonly upcomingPayments = this._upcomingPayments.asReadonly();

  list(weddingId: string): Observable<Contract[]> {
    return this.http
      .get<Contract[]>(apiUrl(`/weddings/${weddingId}/contracts`))
      .pipe(tap((contracts) => this._contracts.set(contracts)));
  }

  upcomingPaymentsList(weddingId: string): Observable<Payment[]> {
    return this.http
      .get<Payment[]>(apiUrl(`/weddings/${weddingId}/contracts/upcoming-payments`))
      .pipe(tap((payments) => this._upcomingPayments.set(payments)));
  }

  create(weddingId: string, dto: CreateContractDto): Observable<Contract> {
    return this.http.post<Contract>(apiUrl(`/weddings/${weddingId}/contracts`), dto).pipe(
      tap((created) => this._contracts.update((list) => [...list, created])),
    );
  }

  update(weddingId: string, id: string, patch: UpdateContractDto): Observable<Contract> {
    return this.http.patch<Contract>(apiUrl(`/weddings/${weddingId}/contracts/${id}`), patch).pipe(
      tap((updated) =>
        this._contracts.update((list) =>
          list.map((contract) => (contract.id === id ? updated : contract)),
        ),
      ),
    );
  }

  remove(weddingId: string, id: string): Observable<void> {
    return this.http
      .delete<void>(apiUrl(`/weddings/${weddingId}/contracts/${id}`))
      .pipe(tap(() => this._contracts.update((list) => list.filter((c) => c.id !== id))));
  }
}
