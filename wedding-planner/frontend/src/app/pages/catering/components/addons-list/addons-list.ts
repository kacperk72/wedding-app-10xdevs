import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AddonPick, CateringAddon } from '../../../../core/models/catering.model';
import { formatPLN } from '../../../../core/format/currency.format';

@Component({
  selector: 'app-addons-list',
  imports: [FormsModule],
  templateUrl: './addons-list.html',
  styleUrl: './addons-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddonsList {
  readonly addons = input.required<CateringAddon[]>();
  readonly picks = input.required<AddonPick[]>();
  readonly pickChanged = output<{ addon: CateringAddon; quantity: number }>();
  readonly pickRemoved = output<CateringAddon>();

  protected isPicked(addon: CateringAddon): boolean {
    return this.picks().some((pick) => pick.addonId === addon.id);
  }

  protected quantity(addon: CateringAddon): number {
    return this.picks().find((pick) => pick.addonId === addon.id)?.quantity ?? 1;
  }

  protected money(value: number): string {
    return formatPLN(value);
  }
}
