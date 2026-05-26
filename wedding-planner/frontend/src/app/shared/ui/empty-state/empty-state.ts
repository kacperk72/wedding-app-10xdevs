import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon, IconName } from '../icon/icon';

@Component({
  selector: 'app-empty-state',
  imports: [Icon],
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyState {
  readonly icon = input<IconName>('sparkles');
  readonly title = input.required<string>();
  readonly description = input<string>('');
  readonly ctaLabel = input<string>('');
  readonly cta = output<void>();
}
