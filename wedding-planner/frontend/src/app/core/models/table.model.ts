export interface Table {
  id: string;
  weddingId: string;
  name: string;
  seatsCount: number;
  sortOrder: number;
  positionX: number | null;
  positionY: number | null;
}

export interface CreateTableDto {
  name: string;
  seatsCount: number;
  sortOrder?: number;
  positionX?: number | null;
  positionY?: number | null;
}

export type UpdateTableDto = Partial<CreateTableDto>;
