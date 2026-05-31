import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-couple-avatar-pair',
  templateUrl: './couple-avatar-pair.html',
  styleUrl: './couple-avatar-pair.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoupleAvatarPair {
  readonly initialA = input.required<string>();
  readonly initialB = input<string>('');
  readonly label = input<string>('');
}
