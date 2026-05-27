import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName =
  | 'badge-check'
  | 'calendar-days'
  | 'check'
  | 'circle-dollar-sign'
  | 'clipboard-list'
  | 'edit'
  | 'file-text'
  | 'handshake'
  | 'heart'
  | 'home'
  | 'layout-dashboard'
  | 'list-checks'
  | 'plus'
  | 'printer'
  | 'settings'
  | 'sofa'
  | 'sparkles'
  | 'store'
  | 'user-plus'
  | 'users'
  | 'wallet'
  | 'x';

@Component({
  selector: 'app-icon',
  templateUrl: './icon.html',
  styleUrl: './icon.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input<number>(18);
  readonly filled = input<boolean>(false);
}
