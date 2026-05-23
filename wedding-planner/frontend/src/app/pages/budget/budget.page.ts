import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PageHeader } from '../../shared/ui/page-header/page-header';

interface BudgetCategory {
  name: string;
  spent: number;
  estimate: number;
  percent: number;
  tone: 'ok' | 'warning' | 'danger';
}

@Component({
  selector: 'app-budget-page',
  imports: [FormsModule, PageHeader],
  templateUrl: './budget.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetPage {
  protected readonly isExpenseDialogOpen = signal(false);
  protected readonly expenseCategory = signal('Sala weselna');
  protected readonly expenseAmount = signal(0);
  protected readonly expenseDescription = signal('');

  protected readonly categories = signal<BudgetCategory[]>(
    [
      { name: 'Sala weselna', spent: 10_000, estimate: 39_100, percent: 26, tone: 'ok' },
      { name: 'Fotograf', spent: 4_500, estimate: 8_500, percent: 53, tone: 'ok' },
      { name: 'Muzyka', spent: 0, estimate: 5_800, percent: 0, tone: 'ok' },
      { name: 'Obrączki', spent: 4_200, estimate: 4_200, percent: 100, tone: 'danger' },
      { name: 'Dekoracje', spent: 2_400, estimate: 3_000, percent: 80, tone: 'warning' },
    ].map((category) => this.withProgress(category)),
  );

  protected readonly spentTotal = computed(() =>
    this.categories().reduce((sum, category) => sum + category.spent, 0),
  );

  protected readonly reservedTotal = computed(() => 44_900);

  protected readonly estimateTotal = computed(() =>
    this.categories().reduce((sum, category) => sum + category.estimate, 0),
  );

  protected setExpenseAmount(value: string | number): void {
    const amount = Number(value);
    this.expenseAmount.set(Number.isFinite(amount) ? amount : 0);
  }

  protected addExpense(): void {
    const amount = Number(this.expenseAmount());
    const categoryName = this.expenseCategory();
    if (!Number.isFinite(amount) || amount <= 0) return;

    this.categories.update((categories) =>
      categories.map((category) =>
        category.name === categoryName
          ? this.withProgress({ ...category, spent: category.spent + amount })
          : category,
      ),
    );
    this.expenseAmount.set(0);
    this.expenseDescription.set('');
    this.isExpenseDialogOpen.set(false);
  }

  protected barClass(tone: BudgetCategory['tone']): string {
    return {
      ok: '',
      warning: 'progress__bar--warning',
      danger: 'progress__bar--danger',
    }[tone];
  }

  protected money(value: number): string {
    return `${Math.round(value).toLocaleString('pl-PL')} zł`;
  }

  private withProgress(category: Omit<BudgetCategory, 'percent' | 'tone'>): BudgetCategory {
    const percent =
      category.estimate > 0
        ? Math.min(100, Math.round((category.spent / category.estimate) * 100))
        : 0;
    const tone: BudgetCategory['tone'] = percent > 90 ? 'danger' : percent >= 70 ? 'warning' : 'ok';
    return { ...category, percent, tone };
  }
}
