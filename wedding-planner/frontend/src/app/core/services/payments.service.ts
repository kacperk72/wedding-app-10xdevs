import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreatePaymentDto, Payment, UpdatePaymentDto } from '../models/contract.model';
import { apiUrl } from '../http/api-url';

@Injectable({ providedIn: 'root' })
export class PaymentsService {
  private readonly http = inject(HttpClient);

  create(weddingId: string, contractId: string, dto: CreatePaymentDto): Observable<Payment> {
    return this.http.post<Payment>(
      apiUrl(`/weddings/${weddingId}/contracts/${contractId}/payments`),
      dto,
    );
  }

  update(
    weddingId: string,
    contractId: string,
    paymentId: string,
    patch: UpdatePaymentDto,
  ): Observable<Payment> {
    return this.http.patch<Payment>(
      apiUrl(`/weddings/${weddingId}/contracts/${contractId}/payments/${paymentId}`),
      patch,
    );
  }

  remove(weddingId: string, contractId: string, paymentId: string): Observable<void> {
    return this.http.delete<void>(
      apiUrl(`/weddings/${weddingId}/contracts/${contractId}/payments/${paymentId}`),
    );
  }
}
