import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { formatPLN } from '../../core/format/currency.format';
import {
  ContractBundleInput,
  CreateVendorDto,
  PAYMENT_METHOD_LABELS,
  PaymentMethod,
  VENDOR_CATEGORY_LABELS,
  VENDOR_STATUS_LABELS,
  Vendor,
  VendorCategory,
  VendorStatus,
} from '../../core/models/vendor.model';
import { ToastService } from '../../core/services/toast.service';
import { VendorsService } from '../../core/services/vendors.service';
import { WeddingService } from '../../core/services/wedding.service';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { PageHeader } from '../../shared/ui/page-header/page-header';

const CATEGORIES = Object.keys(VENDOR_CATEGORY_LABELS) as VendorCategory[];
const STATUSES = Object.keys(VENDOR_STATUS_LABELS) as VendorStatus[];
const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];

interface PaymentLegState {
  amount: number;
  dueDate: string;
  method: PaymentMethod;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyLeg(): PaymentLegState {
  return { amount: 0, dueDate: todayIso(), method: 'przelew' };
}

@Component({
  selector: 'app-vendors-page',
  imports: [EmptyState, FormsModule, PageHeader],
  templateUrl: './vendors.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorsPage implements OnInit {
  protected readonly vendorsService = inject(VendorsService);
  private readonly wedding = inject(WeddingService);
  private readonly toast = inject(ToastService);

  protected readonly categoryOptions = CATEGORIES.map((value) => ({
    value,
    label: VENDOR_CATEGORY_LABELS[value],
  }));
  protected readonly statusOptions = STATUSES.map((value) => ({
    value,
    label: VENDOR_STATUS_LABELS[value],
  }));
  protected readonly paymentMethodOptions = PAYMENT_METHODS.map((value) => ({
    value,
    label: PAYMENT_METHOD_LABELS[value],
  }));

  protected readonly newVendor = signal<CreateVendorDto>({
    category: 'dj',
    companyName: '',
    status: 'rozwazany',
  });
  protected readonly newContractEnabled = signal(true);
  protected readonly newTotal = signal<number | null>(null);
  protected readonly newDeposit = signal<PaymentLegState>(emptyLeg());
  protected readonly newFinal = signal<PaymentLegState>(emptyLeg());

  protected readonly newFinalSuggested = computed(() => {
    const total = this.newTotal() ?? 0;
    const deposit = this.newDeposit().amount || 0;
    return Math.max(0, +(total - deposit).toFixed(2));
  });
  protected readonly newSumMismatch = computed(() => {
    if (!this.newContractEnabled()) return false;
    const total = this.newTotal() ?? 0;
    if (total <= 0) return false;
    const sum = (this.newDeposit().amount || 0) + (this.newFinal().amount || 0);
    return Math.abs(sum - total) > 0.01;
  });

  protected readonly editingVendorId = signal<string | null>(null);
  protected readonly editingVendor = signal<CreateVendorDto>({
    category: 'dj',
    companyName: '',
    status: 'rozwazany',
  });

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
      error: () => this.toast.error('Nie udało się pobrać wesela.'),
    });
  }

  protected addVendor(): void {
    const weddingId = this.requireWeddingId();
    const dto = this.cleanVendorDto(this.newVendor());
    if (!weddingId || !dto.companyName) return;

    const total = this.newTotal();
    if (this.newContractEnabled() && total && total > 0) {
      if (this.newSumMismatch()) {
        this.toast.error('Suma zaliczki i kwoty do zapłaty musi równać się kwocie całkowitej.');
        return;
      }
      const bundle = this.buildBundle(total);
      if (!bundle) return;
      dto.contract = bundle;
      dto.contractAmount = total;
    }

    this.vendorsService.create(weddingId, dto).subscribe({
      next: () => {
        this.resetNewForm();
        this.toast.success('Kontrahent został dodany.');
      },
      error: () => this.toast.error('Nie udało się dodać kontrahenta.'),
    });
  }

  protected startEdit(vendor: Vendor): void {
    this.editingVendorId.set(vendor.id);
    this.editingVendor.set({
      category: vendor.category,
      companyName: vendor.companyName,
      contactPerson: vendor.contactPerson,
      phone: vendor.phone,
      email: vendor.email,
      status: vendor.status,
      contractAmount: vendor.contractAmount,
      notes: vendor.notes,
    });
  }

  protected saveVendor(id: string): void {
    const weddingId = this.requireWeddingId();
    const dto = this.cleanVendorDto(this.editingVendor());
    if (!weddingId || !dto.companyName) return;

    this.vendorsService.update(weddingId, id, dto).subscribe({
      next: () => {
        this.editingVendorId.set(null);
        this.toast.success('Kontrahent został zapisany.');
      },
      error: () => this.toast.error('Nie udało się zapisać kontrahenta.'),
    });
  }

  protected removeVendor(id: string): void {
    const weddingId = this.requireWeddingId();
    if (!weddingId) return;
    if (!window.confirm('Usunąć tego kontrahenta?')) return;

    this.vendorsService.remove(weddingId, id).subscribe({
      next: () => {
        this.toast.success('Kontrahent został usunięty.');
      },
      error: () => this.toast.error('Nie udało się usunąć kontrahenta.'),
    });
  }

  protected updateNewVendor(patch: Partial<CreateVendorDto>): void {
    this.newVendor.update((current) => ({ ...current, ...patch }));
  }

  protected updateEditingVendor(patch: Partial<CreateVendorDto>): void {
    this.editingVendor.update((current) => ({ ...current, ...patch }));
  }

  protected updateNewDeposit(patch: Partial<PaymentLegState>): void {
    this.newDeposit.update((current) => ({ ...current, ...patch }));
    if (patch.amount !== undefined) {
      this.newFinal.update((current) => ({ ...current, amount: this.newFinalSuggested() }));
    }
  }

  protected updateNewFinal(patch: Partial<PaymentLegState>): void {
    this.newFinal.update((current) => ({ ...current, ...patch }));
  }

  protected setNewTotal(value: number | null): void {
    this.newTotal.set(value);
    if (value !== null && value > 0) {
      this.newFinal.update((current) => ({ ...current, amount: this.newFinalSuggested() }));
    }
  }

  protected toggleContract(enabled: boolean): void {
    this.newContractEnabled.set(enabled);
  }

  protected categoryLabel(category: VendorCategory): string {
    return VENDOR_CATEGORY_LABELS[category];
  }

  protected statusLabel(status: VendorStatus): string {
    return VENDOR_STATUS_LABELS[status];
  }

  protected statusClass(status: VendorStatus): string {
    return {
      rozwazany: 'badge--neutral',
      spotkanie: 'badge--warning',
      zarezerwowany: 'badge--info',
      umowa_podpisana: 'badge--success',
      zaliczka_wplacona: 'badge--success',
      oplacony: 'badge--success',
      zrealizowany: 'badge--success',
    }[status];
  }

  protected money(value: number | null): string {
    return formatPLN(value);
  }

  private buildBundle(total: number): ContractBundleInput | null {
    const deposit = this.newDeposit();
    const final = this.newFinal();

    const hasDeposit = deposit.amount > 0;
    const hasFinal = final.amount > 0;
    if (!hasDeposit && !hasFinal) {
      this.toast.error('Podaj kwotę zaliczki lub kwotę do zapłaty.');
      return null;
    }
    if (hasDeposit && !deposit.dueDate) {
      this.toast.error('Podaj termin zaliczki.');
      return null;
    }
    if (hasFinal && !final.dueDate) {
      this.toast.error('Podaj termin kwoty do zaplaty.');
      return null;
    }

    return {
      totalAmount: total,
      deposit: hasDeposit ? { ...deposit } : null,
      finalPayment: hasFinal ? { ...final } : null,
    };
  }

  private resetNewForm(): void {
    this.newVendor.set({ category: 'dj', companyName: '', status: 'rozwazany' });
    this.newContractEnabled.set(true);
    this.newTotal.set(null);
    this.newDeposit.set(emptyLeg());
    this.newFinal.set(emptyLeg());
  }

  private loadResources(weddingId: string): void {
    this.vendorsService.list(weddingId).subscribe({
      error: () => this.toast.error('Nie udało się pobrać kontrahentów.'),
    });
  }

  private requireWeddingId(): string | null {
    const id = this.wedding.wedding()?.id ?? null;
    if (!id) this.toast.error('Najpierw skonfiguruj wesele.');
    return id;
  }

  private cleanVendorDto(dto: CreateVendorDto): CreateVendorDto {
    return {
      ...dto,
      companyName: dto.companyName.trim(),
      contactPerson: dto.contactPerson?.trim() || null,
      phone: dto.phone?.trim() || null,
      email: dto.email?.trim() || null,
      notes: dto.notes?.trim() || null,
      contractAmount: dto.contractAmount ?? null,
    };
  }
}
