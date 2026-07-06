import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AddonPick, CateringAddon, CreateAddonDto } from '../../../../core/models/catering.model';
import { formatPLN } from '../../../../core/format/currency.format';
import { pricingUnitLabel } from '../../../../core/format/catering.labels';
import { Icon } from '../../../../shared/ui/icon/icon';
import { AddonEditorDialog } from '../addon-editor-dialog/addon-editor-dialog';

@Component({
  selector: 'app-addons-list',
  imports: [FormsModule, Icon, AddonEditorDialog],
  templateUrl: './addons-list.html',
  styleUrl: './addons-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddonsList {
  readonly addons = input.required<CateringAddon[]>();
  readonly picks = input.required<AddonPick[]>();
  readonly pickChanged = output<{ addon: CateringAddon; quantity: number }>();
  readonly pickRemoved = output<CateringAddon>();
  readonly addonSaved = output<{ addon: CateringAddon | null; dto: CreateAddonDto }>();
  readonly addonDeleted = output<CateringAddon>();

  protected readonly editorOpen = signal(false);
  protected readonly editingAddon = signal<CateringAddon | null>(null);

  protected isPicked(addon: CateringAddon): boolean {
    return this.picks().some((pick) => pick.addonId === addon.id);
  }

  protected quantity(addon: CateringAddon): number {
    return this.picks().find((pick) => pick.addonId === addon.id)?.quantity ?? 1;
  }

  protected money(value: number): string {
    return formatPLN(value);
  }

  protected unitLabel(addon: CateringAddon): string {
    return pricingUnitLabel(addon.pricingUnit);
  }

  protected openAdd(): void {
    this.editingAddon.set(null);
    this.editorOpen.set(true);
  }

  protected openEdit(addon: CateringAddon): void {
    this.editingAddon.set(addon);
    this.editorOpen.set(true);
  }

  protected onSaved(dto: CreateAddonDto): void {
    this.addonSaved.emit({ addon: this.editingAddon(), dto });
    this.editorOpen.set(false);
  }
}
