import { ChangeDetectionStrategy, Component, OnInit, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CateringAddon, CreateAddonDto, PricingUnit } from '../../../../core/models/catering.model';
import { pricingUnitLabel } from '../../../../core/format/catering.labels';

const PRICING_UNITS: PricingUnit[] = ['per_person', 'per_event', 'per_bottle', 'per_hour', 'per_unit'];

@Component({
  selector: 'app-addon-editor-dialog',
  imports: [FormsModule],
  templateUrl: './addon-editor-dialog.html',
  styleUrl: './addon-editor-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddonEditorDialog implements OnInit {
  readonly addon = input<CateringAddon | null>(null);
  readonly saved = output<CreateAddonDto>();
  readonly closed = output<void>();

  protected readonly units = PRICING_UNITS;
  protected readonly unitLabel = pricingUnitLabel;

  protected readonly name = signal('');
  protected readonly description = signal('');
  protected readonly price = signal(0);
  protected readonly pricingUnit = signal<PricingUnit>('per_person');

  protected readonly isEdit = computed(() => this.addon() !== null);

  ngOnInit(): void {
    const addon = this.addon();
    if (!addon) return;
    this.name.set(addon.name);
    this.description.set(addon.description ?? '');
    this.price.set(addon.price);
    this.pricingUnit.set(addon.pricingUnit);
  }

  protected submit(): void {
    const name = this.name().trim();
    if (!name) return;
    this.saved.emit({
      name,
      price: Number(this.price()) || 0,
      pricingUnit: this.pricingUnit(),
      description: this.description().trim() || null,
    });
  }
}
