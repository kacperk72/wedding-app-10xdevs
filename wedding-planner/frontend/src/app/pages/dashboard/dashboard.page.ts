import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeader } from '../../shared/ui/page-header/page-header';
import { Icon, IconName } from '../../shared/ui/icon/icon';

interface Kpi {
  label: string;
  value: string;
  meta: string;
  progress: number;
  tone: 'ok' | 'warning' | 'danger';
  icon: IconName;
}

@Component({
  selector: 'app-dashboard-page',
  imports: [Icon, PageHeader],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  protected readonly kpis: Kpi[] = [
    {
      label: 'Goście',
      value: '87 / 120',
      meta: '24 oczekuje · 9 odmów',
      progress: 72,
      tone: 'ok',
      icon: 'users',
    },
    {
      label: 'Budżet',
      value: '65 000 zł',
      meta: '83% estymacji końcowej',
      progress: 83,
      tone: 'warning',
      icon: 'wallet',
    },
    {
      label: 'Płatności',
      value: '15 200 zł',
      meta: '3 pozycje w 30 dni',
      progress: 44,
      tone: 'warning',
      icon: 'calendar-days',
    },
    {
      label: 'Zadania',
      value: '8',
      meta: '2 opóźnione',
      progress: 68,
      tone: 'danger',
      icon: 'list-checks',
    },
  ];

  protected readonly attention = [
    'Potwierdzić repertuar z DJ-em',
    'Zamknąć listę noclegów',
    'Wpłacić zaliczkę dla Sound Garden',
  ];

  protected readonly meetings = [
    { day: '28', month: 'MAJ', title: 'Spotkanie z DJ-em', meta: '18:00 · online' },
    { day: '04', month: 'CZE', title: 'Degustacja menu', meta: '17:30 · Pałac Polanka' },
    { day: '10', month: 'CZE', title: 'Przymiarka sukni', meta: '12:00 · atelier' },
  ];

  protected barClass(tone: Kpi['tone']): string {
    return {
      ok: '',
      warning: 'progress__bar--warning',
      danger: 'progress__bar--danger',
    }[tone];
  }
}
