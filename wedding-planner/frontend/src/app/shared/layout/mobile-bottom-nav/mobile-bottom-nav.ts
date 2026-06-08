import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Icon, IconName } from '../../ui/icon/icon';

interface MobileNavItem {
  label: string;
  routerLink?: string;
  icon: IconName;
  disabled: boolean;
}

@Component({
  selector: 'app-mobile-bottom-nav',
  imports: [Icon, RouterLink, RouterLinkActive],
  templateUrl: './mobile-bottom-nav.html',
  styleUrl: './mobile-bottom-nav.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileBottomNav {
  protected readonly items: MobileNavItem[] = [
    { label: 'Dashboard', routerLink: '/app', icon: 'layout-dashboard', disabled: false },
    { label: 'Goście', routerLink: '/app/goscie', icon: 'users', disabled: false },
    { label: 'Kontrahenci', routerLink: '/app/kontrahenci', icon: 'store', disabled: false },
    { label: 'Umowy', routerLink: '/app/umowy', icon: 'file-text', disabled: false },
    { label: 'Budżet', routerLink: '/app/budzet', icon: 'wallet', disabled: false },
    { label: 'Oferta', routerLink: '/app/oferta-sali', icon: 'handshake', disabled: false },
    { label: 'Zadania', routerLink: '/app/zadania', icon: 'list-checks', disabled: false },
    { label: 'Harmonogram', routerLink: '/app/harmonogram', icon: 'calendar-days', disabled: false },
    { label: 'Stoły', routerLink: '/app/rozsadzenie', icon: 'sofa', disabled: false },
    { label: 'Ustawienia', routerLink: '/app/ustawienia', icon: 'settings', disabled: false },
  ];
}
