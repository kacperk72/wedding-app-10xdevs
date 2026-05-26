import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { formatPLN } from '../../core/format/currency.format';
import { AttentionItem } from '../../core/models/dashboard.model';
import { DashboardService } from '../../core/services/dashboard.service';
import { ToastService } from '../../core/services/toast.service';
import { WeddingService } from '../../core/services/wedding.service';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
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
  imports: [EmptyState, Icon],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage implements OnInit {
  protected readonly weddingService = inject(WeddingService);
  private readonly dashboardService = inject(DashboardService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly wedding = this.weddingService.wedding;
  protected readonly coupleLabel = this.weddingService.coupleLabel;
  protected readonly daysUntilWedding = this.weddingService.daysUntilWedding;
  protected readonly dashboard = this.dashboardService.dashboard;

  protected readonly kpis = computed<Kpi[]>(() => {
    const dashboard = this.dashboard();
    const guests = dashboard?.kpis.guests ?? { invited: 0, confirmed: 0, pending: 0, declined: 0 };
    const budget = dashboard?.kpis.budget ?? { plannedTotal: 0, spentTotal: 0 };
    const payments = dashboard?.kpis.payments ?? {
      upcomingCount: 0,
      upcomingAmount: 0,
      overdueCount: 0,
      overdueAmount: 0,
    };
    const tasks = dashboard?.kpis.tasks ?? { activeCount: 0, overdueCount: 0 };
    const invitedProgress = guests.invited
      ? Math.round((guests.confirmed / guests.invited) * 100)
      : 0;
    const budgetProgress = budget.plannedTotal
      ? Math.min(100, Math.round((budget.spentTotal / budget.plannedTotal) * 100))
      : 0;

    return [
      {
        label: 'Goscie',
        value: `${guests.confirmed} / ${guests.invited}`,
        meta: `${guests.pending} oczekuje - ${guests.declined} odmow`,
        progress: invitedProgress,
        tone: guests.pending > 0 ? 'warning' : 'ok',
        icon: 'users',
      },
      {
        label: 'Budzet',
        value: formatPLN(budget.spentTotal),
        meta: `Plan: ${formatPLN(budget.plannedTotal)}`,
        progress: budgetProgress,
        tone: budget.spentTotal > budget.plannedTotal && budget.plannedTotal > 0 ? 'danger' : 'ok',
        icon: 'wallet',
      },
      {
        label: 'Platnosci',
        value: payments.upcomingCount.toString(),
        meta: `${formatPLN(payments.upcomingAmount)} w 30 dni - ${payments.overdueCount} po terminie`,
        progress: payments.upcomingCount ? 100 : 0,
        tone: payments.overdueCount ? 'danger' : 'ok',
        icon: 'calendar-days',
      },
      {
        label: 'Zadania',
        value: tasks.activeCount.toString(),
        meta: `${tasks.overdueCount} opoznionych`,
        progress: tasks.activeCount ? Math.max(10, 100 - tasks.overdueCount * 20) : 0,
        tone: tasks.overdueCount ? 'danger' : 'ok',
        icon: 'list-checks',
      },
    ];
  });

  protected readonly attention = computed(() => this.dashboard()?.attentionItems ?? []);
  protected readonly meetings = computed(() => this.dashboard()?.upcomingMeetings ?? []);

  ngOnInit(): void {
    const weddingId = this.wedding()?.id;
    if (weddingId) {
      this.loadDashboard(weddingId);
      return;
    }

    this.weddingService.loadCurrent().subscribe({
      next: (wedding) => {
        if (wedding) {
          this.loadDashboard(wedding.id);
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

  protected openAttention(item: AttentionItem): void {
    this.router.navigateByUrl(item.route);
  }

  protected formatMeetingDate(input: string): string {
    return new Intl.DateTimeFormat('pl-PL', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(input));
  }

  private loadDashboard(weddingId: string): void {
    this.dashboardService.load(weddingId).subscribe({
      error: () => this.toast.error('Nie udalo sie pobrac dashboardu.'),
    });
  }
}
