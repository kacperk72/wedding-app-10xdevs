import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LinkedDish } from '../../../../core/models/catering.model';
import { Icon } from '../../../../shared/ui/icon/icon';

@Component({
  selector: 'app-dish-row',
  imports: [Icon],
  templateUrl: './dish-row.html',
  styleUrl: './dish-row.scss',
  host: {
    class: 'dish-row',
    '[class.dish-row--selected]': 'selected() && controlType() !== "none"',
    '[class.dish-row--disabled]': 'disabled()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DishRow {
  readonly dish = input.required<LinkedDish>();
  readonly selected = input.required<boolean>();
  readonly disabled = input(false);
  readonly controlType = input<'checkbox' | 'radio' | 'none'>('checkbox');
  readonly radioName = input<string>('');
  readonly editable = input(false);

  readonly toggled = output<boolean>();
  readonly editRequested = output<void>();
  readonly unlinkRequested = output<void>();
}
