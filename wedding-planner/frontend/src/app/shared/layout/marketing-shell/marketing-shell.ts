import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Icon } from '../../ui/icon/icon';

@Component({
  selector: 'app-marketing-shell',
  imports: [Icon, RouterOutlet],
  templateUrl: './marketing-shell.html',
  styleUrl: './marketing-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketingShell {}
