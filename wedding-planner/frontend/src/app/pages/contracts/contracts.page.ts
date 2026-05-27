import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { formatPLN } from '../../core/format/currency.format';
import {
  CONTRACT_STATUS_LABELS,
  Contract,
  CreateContractDto,
  CreatePaymentDto,
  PAYMENT_KIND_LABELS,
  PAYMENT_STATUS_LABELS,
  Payment,
  PaymentKind,
  PaymentStatus,
} from '../../core/models/contract.model';
import { PAYMENT_METHOD_LABELS, PaymentMethod, VENDOR_CATEGORY_LABELS } from '../../core/models/vendor.model';
import { ContractsService } from '../../core/services/contracts.service';
import { PaymentsService } from '../../core/services/payments.service';
import { ToastService } from '../../core/services/toast.service';
import { VendorsService } from '../../core/services/vendors.service';
import { WeddingService } from '../../core/services/wedding.service';
import { PageHeader } from '../../shared/ui/page-header/page-header';

const PAYMENT_KINDS = Object.keys(PAYMENT_KIND_LABELS) as PaymentKind[];
const PAYMENT_STATUSES = Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[];

@Component({
  selector: 'app-contracts-page',
  imports: [FormsModule, PageHeader],
  templateUrl: './contracts.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContractsPage implements OnInit {
  protected readonly contractsService = inject(ContractsService);
  protected readonly vendorsService = inject(VendorsService);
  private readonly paymentsService = inject(PaymentsService);
  private readonly wedding = inject(WeddingService);
  private readonly toast = inject(ToastService);

  protected readonly paymentKindOptions = PAYMENT_KINDS.map((value) => ({
    value,
    label: PAYMENT_KIND_LABELS[value],
  }));

  protected readonly paymentStatusOptions = PAYMENT_STATUSES.map((value) => ({
    value,
    label: PAYMENT_STATUS_LABELS[value],
  }));

  protected readonly newContract = signal<CreateContractDto>({
    vendorId: '',
    totalAmount: 0,
    signedDate: null,
  });
  protected readonly newPayments = signal<Record<string, CreatePaymentDto>>({});

  protected readonly upcomingTotal = computed(() =>
    this.contractsService
      .upcomingPayments()
      .reduce((total, payment) => total + payment.amount, 0),
  );

  ngOnInit(): void {
    const weddingId = this.wedding.wedding()?.id;
    if (weddingId) {
      this.loadResources(weddingId);
      return;
    }

    this.wedding.loadCurrent().subscribe({
      next: (wedding) => {
        if (wedding) {
          this.loadResources(wedding.id);
          return;
        }
        this.toast.error('Najpierw skonfiguruj wesele.');
      },
      error: () => this.toast.error('Nie udalo sie pobrac wesela.'),
    });
  }

  protected addContract(): void {
    const weddingId = this.requireWeddingId();
    const dto = this.newContract();
    if (!weddingId || !dto.vendorId || dto.totalAmount < 0) return;

    this.contractsService.create(weddingId, dto).subscribe({
      next: () => {
        this.newContract.set({ vendorId: '', totalAmount: 0, signedDate: null });
        this.reloadContracts(weddingId);
        this.toast.success('Umowa zostala dodana.');
      },
      error: () => this.toast.error('Nie udalo sie dodac umowy.'),
    });
  }

  protected removeContract(id: string): void {
    const weddingId = this.requireWeddingId();
    if (!weddingId) return;

    this.contractsService.remove(weddingId, id).subscribe({
      next: () => {
        this.reloadContracts(weddingId);
        this.toast.success('Umowa zostala usunieta.');
      },
      error: () => this.toast.error('Nie udalo sie usunac umowy.'),
    });
  }

  protected updateNewContract(patch: Partial<CreateContractDto>): void {
    this.newContract.update((current) => ({ ...current, ...patch }));
  }

  protected paymentDraft(contractId: string): CreatePaymentDto {
    return (
      this.newPayments()[contractId] ?? {
        kind: 'rata',
        dueDate: '',
        amount: 0,
        status: 'planned',
      }
    );
  }

  protected updatePaymentDraft(contractId: string, patch: Partial<CreatePaymentDto>): void {
    this.newPayments.update((current) => ({
      ...current,
      [contractId]: { ...this.paymentDraft(contractId), ...patch },
    }));
  }

  protected addPayment(contractId: string): void {
    const weddingId = this.requireWeddingId();
    const dto = this.paymentDraft(contractId);
    if (!weddingId || !dto.dueDate || dto.amount < 0) return;

    this.paymentsService.create(weddingId, contractId, dto).subscribe({
      next: () => {
        this.newPayments.update((current) => {
          const next = { ...current };
          delete next[contractId];
          return next;
        });
        this.reloadContracts(weddingId);
        this.toast.success('Platnosc zostala dodana.');
      },
      error: () => this.toast.error('Nie udalo sie dodac platnosci.'),
    });
  }

  protected setPaymentStatus(contract: Contract, payment: Payment, status: PaymentStatus): void {
    const weddingId = this.requireWeddingId();
    if (!weddingId) return;

    this.paymentsService
      .update(weddingId, contract.id, payment.id, {
        status,
        paidAt: status === 'paid' ? new Date().toISOString().slice(0, 10) : null,
      })
      .subscribe({
        next: () => this.reloadContracts(weddingId),
        error: () => this.toast.error('Nie udalo sie zapisac platnosci.'),
      });
  }

  protected removePayment(contractId: string, paymentId: string): void {
    const weddingId = this.requireWeddingId();
    if (!weddingId) return;

    this.paymentsService.remove(weddingId, contractId, paymentId).subscribe({
      next: () => {
        this.reloadContracts(weddingId);
        this.toast.success('Platnosc zostala usunieta.');
      },
      error: () => this.toast.error('Nie udalo sie usunac platnosci.'),
    });
  }

  protected money(value: number | null | undefined): string {
    return formatPLN(value);
  }

  protected contractStatusLabel(contract: Contract): string {
    return CONTRACT_STATUS_LABELS[contract.status];
  }

  protected contractStatusClass(contract: Contract): string {
    return {
      pending: 'badge--neutral',
      in_progress: 'badge--warning',
      deposit_paid: 'badge--success',
      paid_in_full: 'badge--info',
    }[contract.status];
  }

  protected paymentStatusClass(status: PaymentStatus): string {
    return {
      planned: 'badge--neutral',
      paid: 'badge--success',
      overdue: 'badge--danger',
    }[status];
  }

  protected paymentKindLabel(kind: PaymentKind): string {
    return PAYMENT_KIND_LABELS[kind];
  }

  protected paymentStatusLabel(status: PaymentStatus): string {
    return PAYMENT_STATUS_LABELS[status];
  }

  protected paymentMethodLabel(method: PaymentMethod | undefined): string {
    return method ? PAYMENT_METHOD_LABELS[method] : PAYMENT_METHOD_LABELS.przelew;
  }

  protected categoryLabel(category: string | null): string {
    if (!category) return '-';
    return VENDOR_CATEGORY_LABELS[category as keyof typeof VENDOR_CATEGORY_LABELS] ?? category;
  }

  private loadResources(weddingId: string): void {
    forkJoin([
      this.vendorsService.list(weddingId),
      this.contractsService.list(weddingId),
      this.contractsService.upcomingPaymentsList(weddingId),
    ]).subscribe({
      error: () => this.toast.error('Nie udalo sie pobrac umow.'),
    });
  }

  private reloadContracts(weddingId: string): void {
    forkJoin([
      this.contractsService.list(weddingId),
      this.contractsService.upcomingPaymentsList(weddingId),
    ]).subscribe({
      error: () => this.toast.error('Nie udalo sie odswiezyc umow.'),
    });
  }

  private requireWeddingId(): string | null {
    const id = this.wedding.wedding()?.id ?? null;
    if (!id) this.toast.error('Najpierw skonfiguruj wesele.');
    return id;
  }
}
