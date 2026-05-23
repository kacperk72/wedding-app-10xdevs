import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { WeddingService } from '../../../core/services/wedding.service';
import { formatLongDatePL } from '../../../core/format/date.format';
import { Icon, IconName } from '../../ui/icon/icon';

export interface NavItem {
  label: string;
  routerLink?: string;
  icon: IconName;
  disabled: boolean;
}

@Component({
  selector: 'app-sidebar',
  imports: [Icon, RouterLink, RouterLinkActive],
  templateUrl: './app-sidebar.html',
  styleUrl: './app-sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppSidebar {
  protected readonly wedding = inject(WeddingService);

  protected readonly items: NavItem[] = [
    { label: 'Dashboard', routerLink: '/app', icon: 'layout-dashboard', disabled: false },
    { label: 'Goście / RSVP', routerLink: '/app/goscie', icon: 'users', disabled: false },
    { label: 'Kontrahenci', routerLink: '/app/kontrahenci', icon: 'store', disabled: false },
    { label: 'Umowy', routerLink: '/app/umowy', icon: 'file-text', disabled: false },
    { label: 'Budżet', routerLink: '/app/budzet', icon: 'wallet', disabled: false },
    { label: 'Oferta sali', routerLink: '/app/oferta-sali', icon: 'handshake', disabled: false },
    { label: 'Zadania', routerLink: '/app/zadania', icon: 'list-checks', disabled: false },
    { label: 'Rozsadzenie gości', routerLink: '/app/rozsadzenie', icon: 'sofa', disabled: false },
    { label: 'Ustawienia', routerLink: '/app/ustawienia', icon: 'settings', disabled: false },
  ];

  protected readonly fmtDate = formatLongDatePL;
}
