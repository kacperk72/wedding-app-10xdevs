import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PriceBreakdown } from '../../../../core/models/catering.model';
import { formatPLN } from '../../../../core/format/currency.format';

@Component({
  selector: 'app-price-summary',
  templateUrl: './price-summary.html',
  styleUrl: './price-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceSummary {
  readonly price = input.required<PriceBreakdown | null>();
  readonly syncRequested = output<void>();
  readonly freezeRequested = output<void>();
  readonly printRequested = output<void>();

  protected money(value: number | null | undefined): string {
    return formatPLN(value ?? 0);
  }
}
