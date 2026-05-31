import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { formatPLN } from '../../core/format/currency.format';
import { formatDDMMYYYY } from '../../core/format/date.format';
import { BudgetCategory, CreateExpenseDto, Expense } from '../../core/models/expense.model';
import { BudgetService } from '../../core/services/budget.service';
import { ToastService } from '../../core/services/toast.service';
import { VendorsService } from '../../core/services/vendors.service';
import { WeddingService } from '../../core/services/wedding.service';
import { PageHeader } from '../../shared/ui/page-header/page-header';

const BUDGET_CATEGORY_LABELS: Record<string, string> = {
  'Stylizacja panny mlodej': 'Stylizacja panny młodej',
  'Stylizacja pana mlodego': 'Stylizacja pana młodego',
  'USC / formalnosci': 'USC / formalności',
  'Transport gosci': 'Transport gości',
  'Hotel dla gosci': 'Hotel dla gości',
  Obraczki: 'Obrączki',
};

@Component({
  selector: 'app-budget-page',
  imports: [FormsModule, PageHeader],
  templateUrl: './budget.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetPage implements OnInit {
  protected readonly budget = inject(BudgetService);
  protected readonly vendors = inject(VendorsService);
  private readonly wedding = inject(WeddingService);
  private readonly toast = inject(ToastService);

  protected readonly isBudgetEditOpen = signal(false);
  protected readonly budgetTotalDraft = signal<number | null>(null);
  protected readonly selectedCategoryId = signal<string | null>(null);
  protected readonly editingExpenseId = signal<string | null>(null);

  protected readonly newExpense = signal<CreateExpenseDto>({
    categoryId: '',
    amount: 0,
    spentOn: this.today(),
    description: '',
    vendorId: null,
  });

  protected readonly editingExpense = signal<CreateExpenseDto>({
    categoryId: '',
    amount: 0,
    spentOn: this.today(),
    description: '',
    vendorId: null,
  });

  protected readonly progress = computed(() => {
    const summary = this.budget.summary();
    if (!summary?.budgetTotal || summary.budgetTotal <= 0) return 0;
    return Math.min(120, Math.round((summary.spent / summary.budgetTotal) * 100));
  });

  protected readonly progressTone = computed<'ok' | 'warning' | 'danger'>(() => {
    const progress = this.progress();
    if (progress > 100) return 'danger';
    if (progress >= 70) return 'warning';
    return 'ok';
  });

  ngOnInit(): void {
    const weddingId = this.wedding.wedding()?.id;
    if (weddingId) {
      this.loadResources(weddingId);
      return;
    }

    this.wedding.loadCurrent().subscribe({
      next: (wedding) => {
        if (wedding) {
          this.loadResources(wedding.id);
          return;
        }
        this.toast.error('Najpierw skonfiguruj wesele.');
      },
      error: () => this.toast.error('Nie udało się pobrać wesela.'),
    });
  }

  protected startBudgetEdit(): void {
    this.budgetTotalDraft.set(this.budget.summary()?.budgetTotal ?? null);
    this.isBudgetEditOpen.set(true);
  }

  protected setBudgetDraft(value: string | number): void {
    if (value === '') {
      this.budgetTotalDraft.set(null);
      return;
    }
    const amount = Number(value);
    this.budgetTotalDraft.set(Number.isFinite(amount) ? amount : null);
  }

  protected saveBudgetTotal(): void {
    const weddingId = this.requireWeddingId();
    const amount = this.budgetTotalDraft();
    if (!weddingId || (amount !== null && amount < 0)) {
      this.toast.error('Budżet musi być liczbą nieujemną.');
      return;
    }

    this.wedding.update(weddingId, { budgetTotal: amount }).subscribe({
      next: () => {
        this.budget.loadSummary(weddingId).subscribe();
        this.isBudgetEditOpen.set(false);
        this.toast.success('Budżet został zapisany.');
      },
      error: () => this.toast.error('Nie udało się zapisać budżetu.'),
    });
  }

  protected updateNewExpense(patch: Partial<CreateExpenseDto>): void {
    this.newExpense.update((current) => ({ ...current, ...patch }));
  }

  protected setNewAmount(value: string | number): void {
    this.updateNewExpense({ amount: this.parseAmount(value) });
  }

  protected addExpense(): void {
    const weddingId = this.requireWeddingId();
    const dto = this.cleanExpense(this.newExpense());
    if (!weddingId || !this.validateExpense(dto)) return;

    this.budget.createExpense(weddingId, dto).subscribe({
      next: () => {
        this.newExpense.set({
          categoryId: this.budget.categories()[0]?.id ?? '',
          amount: 0,
          spentOn: this.today(),
          description: '',
          vendorId: null,
        });
        this.reloadExpenses(weddingId);
        this.toast.success('Wydatek został dodany.');
      },
      error: () => this.toast.error('Nie udało się dodać wydatku.'),
    });
  }

  protected setCategoryFilter(categoryId: string | null): void {
    this.selectedCategoryId.set(categoryId);
    const weddingId = this.requireWeddingId();
    if (weddingId) this.reloadExpenses(weddingId);
  }

  protected startEdit(expense: Expense): void {
    this.editingExpenseId.set(expense.id);
    this.editingExpense.set({
      categoryId: expense.categoryId,
      amount: expense.amount,
      spentOn: expense.spentOn,
      description: expense.description,
      vendorId: expense.vendorId,
    });
  }

  protected updateEditingExpense(patch: Partial<CreateExpenseDto>): void {
    this.editingExpense.update((current) => ({ ...current, ...patch }));
  }

  protected setEditingAmount(value: string | number): void {
    this.updateEditingExpense({ amount: this.parseAmount(value) });
  }

  protected saveExpense(id: string): void {
    const weddingId = this.requireWeddingId();
    const dto = this.cleanExpense(this.editingExpense());
    if (!weddingId || !this.validateExpense(dto)) return;

    this.budget.updateExpense(weddingId, id, dto).subscribe({
      next: () => {
        this.editingExpenseId.set(null);
        this.reloadExpenses(weddingId);
        this.toast.success('Wydatek został zapisany.');
      },
      error: () => this.toast.error('Nie udało się zapisać wydatku.'),
    });
  }

  protected removeExpense(id: string): void {
    const weddingId = this.requireWeddingId();
    if (!weddingId) return;
    if (!window.confirm('Usunąć ten wydatek?')) return;

    this.budget.removeExpense(weddingId, id).subscribe({
      next: () => {
        this.reloadExpenses(weddingId);
        this.toast.success('Wydatek został usunięty.');
      },
      error: () => this.toast.error('Nie udało się usunąć wydatku.'),
    });
  }

  protected categoryName(categoryId: string): string {
    const name = this.budget.categories().find((category) => category.id === categoryId)?.name;
    return name ? this.categoryLabel(name) : '-';
  }

  protected categoryLabel(name: string): string {
    return BUDGET_CATEGORY_LABELS[name] ?? name;
  }

  protected categoryTrack(_index: number, category: BudgetCategory): string {
    return category.id;
  }

  protected money(value: number | null | undefined): string {
    return formatPLN(value);
  }

  protected date(value: string): string {
    return formatDDMMYYYY(value);
  }

  protected barClass(tone: 'ok' | 'warning' | 'danger'): string {
    return {
      ok: '',
      warning: 'progress__bar--warning',
      danger: 'progress__bar--danger',
    }[tone];
  }

  private loadResources(weddingId: string): void {
    forkJoin([
      this.budget.loadSummary(weddingId),
      this.budget.loadCategories(weddingId),
      this.budget.listExpenses(weddingId),
      this.vendors.list(weddingId),
    ]).subscribe({
      next: ([, categories]) => {
        this.newExpense.update((current) => ({
          ...current,
          categoryId: current.categoryId || categories[0]?.id || '',
        }));
      },
      error: () => this.toast.error('Nie udało się pobrać budżetu.'),
    });
  }

  private reloadExpenses(weddingId: string): void {
    this.budget
      .listExpenses(weddingId, { categoryId: this.selectedCategoryId() })
      .subscribe({ error: () => this.toast.error('Nie udało się odświeżyć wydatków.') });
  }

  private requireWeddingId(): string | null {
    const id = this.wedding.wedding()?.id ?? null;
    if (!id) this.toast.error('Najpierw skonfiguruj wesele.');
    return id;
  }

  private cleanExpense(dto: CreateExpenseDto): CreateExpenseDto {
    return {
      categoryId: dto.categoryId,
      amount: Number(dto.amount),
      spentOn: dto.spentOn,
      description: dto.description.trim(),
      vendorId: dto.vendorId || null,
    };
  }

  private validateExpense(dto: CreateExpenseDto): boolean {
    const validDate = Boolean(dto.spentOn && !Number.isNaN(new Date(`${dto.spentOn}T00:00:00`).getTime()));
    const ok = Boolean(dto.categoryId && dto.description && dto.amount > 0 && validDate);
    if (!ok) this.toast.error('Uzupełnij kategorię, datę, kwotę i opis.');
    return ok;
  }

  private parseAmount(value: string | number): number {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : 0;
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
