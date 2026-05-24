export interface MealOption {
  id: string;
  weddingId: string;
  label: string;
  sortOrder: number;
}

export interface CreateMealOptionDto {
  label: string;
  sortOrder?: number;
}

export type UpdateMealOptionDto = Partial<CreateMealOptionDto>;
