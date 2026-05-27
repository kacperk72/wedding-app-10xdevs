import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LinkedDish } from '../../../../core/models/catering.model';

@Component({
  selector: 'app-dish-card',
  templateUrl: './dish-card.html',
  styleUrl: './dish-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DishCard {
  readonly dish = input.required<LinkedDish>();
  readonly selected = input.required<boolean>();
  readonly disabled = input(false);
  readonly controlType = input<'checkbox' | 'radio' | 'none'>('checkbox');
  readonly toggled = output<boolean>();
}
