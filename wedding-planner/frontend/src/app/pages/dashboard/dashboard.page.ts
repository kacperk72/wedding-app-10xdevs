import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { GuestsService } from '../../core/services/guests.service';
import { ToastService } from '../../core/services/toast.service';
import { WeddingService } from '../../core/services/wedding.service';
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
  imports: [Icon],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage implements OnInit {
  protected readonly weddingService = inject(WeddingService);
  private readonly guestsService = inject(GuestsService);
  private readonly toast = inject(ToastService);

  protected readonly wedding = this.weddingService.wedding;
  protected readonly coupleLabel = this.weddingService.coupleLabel;
  protected readonly daysUntilWedding = this.weddingService.daysUntilWedding;

  protected readonly kpis = computed<Kpi[]>(() => {
    const guests = this.guestsService.aggregates();
    const invitedProgress = guests.invited
      ? Math.round((guests.confirmed / guests.invited) * 100)
      : 0;

    return [
      {
        label: 'Goscie',
        value: `${guests.confirmed} / ${guests.invited}`,
        meta: `${guests.pending} oczekuje · ${guests.declined} odmow`,
        progress: invitedProgress,
        tone: guests.pending > 0 ? 'warning' : 'ok',
        icon: 'users',
      },
      {
        label: 'Budzet',
        value: '—',
        meta: 'Dostepne od M5',
        progress: 0,
        tone: 'ok',
        icon: 'wallet',
      },
      {
        label: 'Platnosci',
        value: '—',
        meta: 'Dostepne od M4',
        progress: 0,
        tone: 'ok',
        icon: 'calendar-days',
      },
      {
        label: 'Zadania',
        value: '—',
        meta: 'Dostepne od M7',
        progress: 0,
        tone: 'ok',
        icon: 'list-checks',
      },
    ];
  });

  protected readonly attention = ['—'];
  protected readonly meetings: Array<{ day: string; month: string; title: string; meta: string }> = [];

  ngOnInit(): void {
    const weddingId = this.wedding()?.id;
    if (weddingId) {
      this.loadGuests(weddingId);
      return;
    }

    this.weddingService.loadCurrent().subscribe({
      next: (wedding) => {
        if (wedding) {
          this.loadGuests(wedding.id);
          return;
        }
        this.toast.error('Najpierw skonfiguruj wesele.');
      },
      error: () => this.toast.error('Nie udalo sie pobrac wesela.'),
    });
  }

  protected barClass(tone: Kpi['tone']): string {
    return {
      ok: '',
      warning: 'progress__bar--warning',
      danger: 'progress__bar--danger',
    }[tone];
  }

  private loadGuests(weddingId: string): void {
    this.guestsService.loadAggregates(weddingId).subscribe({
      error: () => this.toast.error('Nie udalo sie pobrac agregatow gosci.'),
    });
  }
}
