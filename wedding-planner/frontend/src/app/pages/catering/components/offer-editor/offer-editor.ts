import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CateringAddon, CateringDish, CateringOffer, CateringPackage } from '../../../../core/models/catering.model';
import { formatPLN } from '../../../../core/format/currency.format';

@Component({
  selector: 'app-offer-editor',
  imports: [FormsModule],
  templateUrl: './offer-editor.html',
  styleUrl: './offer-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfferEditor {
  readonly offer = input.required<CateringOffer>();
  readonly closed = output<void>();
  readonly packageUpdated = output<{ pkg: CateringPackage; pricePerPerson: number }>();
  readonly dishRemoved = output<CateringDish>();
  readonly addonUpdated = output<{ addon: CateringAddon; price: number }>();

  protected readonly tab = signal<'packages' | 'courses' | 'dishes' | 'addons'>('packages');

  protected money(value: number): string {
    return formatPLN(value);
  }
}
