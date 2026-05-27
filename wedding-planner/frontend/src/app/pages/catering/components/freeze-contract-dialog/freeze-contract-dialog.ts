import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FreezeContractDto, PriceBreakdown } from '../../../../core/models/catering.model';
import { Vendor } from '../../../../core/models/vendor.model';
import { formatPLN } from '../../../../core/format/currency.format';

@Component({
  selector: 'app-freeze-contract-dialog',
  imports: [FormsModule],
  templateUrl: './freeze-contract-dialog.html',
  styleUrl: './freeze-contract-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FreezeContractDialog {
  readonly vendors = input.required<Vendor[]>();
  readonly price = input.required<PriceBreakdown | null>();
  readonly closed = output<void>();
  readonly submitted = output<FreezeContractDto>();

  protected readonly vendorId = signal('');
  protected readonly signedDate = signal(new Date().toISOString().slice(0, 10));
  protected readonly withPayments = signal(true);
  protected readonly depositAmount = signal(10000);
  protected readonly depositDueDate = signal('2026-06-01');
  protected readonly finalDueDate = signal('2026-07-20');

  protected readonly cateringVendors = computed(() =>
    this.vendors().filter((vendor) => vendor.category === 'sala' || vendor.category === 'catering'),
  );

  protected readonly finalAmount = computed(() =>
    Math.max(0, (this.price()?.total ?? 0) - this.depositAmount()),
  );

  protected submit(): void {
    const vendorId = this.vendorId() || this.cateringVendors()[0]?.id;
    if (!vendorId) return;
    this.submitted.emit({
      vendorId,
      signedDate: this.signedDate(),
      deposit: this.withPayments()
        ? { amount: this.depositAmount(), dueDate: this.depositDueDate(), method: 'przelew' }
        : null,
      finalPayment: this.withPayments()
        ? { amount: this.finalAmount(), dueDate: this.finalDueDate(), method: 'przelew' }
        : null,
    });
  }

  protected money(value: number): string {
    return formatPLN(value);
  }
}
