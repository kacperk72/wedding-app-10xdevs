export interface Expense {
  id: string;
  weddingId: string;
  categoryId: string;
  vendorId: string | null;
  vendorName: string | null;
  description: string;
  amount: number;
  spentOn: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BudgetCategory {
  id: string;
  weddingId: string;
  name: string;
  sortOrder: number;
}

export interface BudgetSummary {
  budgetTotal: number | null;
  spent: number;
  remaining: number | null;
  expensesCount: number;
}

export interface CreateExpenseDto {
  categoryId: string;
  amount: number;
  spentOn: string;
  description: string;
  vendorId?: string | null;
}

export type UpdateExpenseDto = Partial<CreateExpenseDto>;
