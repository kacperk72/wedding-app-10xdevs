import { Guest } from './guest.model';

export interface SeatingConflict {
  id: string;
  weddingId: string;
  guestAId: string;
  guestBId: string;
  guestAName: string | null;
  guestBName: string | null;
  reason: string;
  createdAt: string;
}

export interface SeatingStats {
  seatedCount: number;
  unseatedCount: number;
  tablesUsed: number;
  totalSeats: number;
  conflictsCount: number;
  fullTablesCount: number;
}

export interface ConflictWarning {
  otherGuestId: string;
  otherGuestName: string | null;
  reason: string;
}

export interface AssignTableResponse {
  guest: Guest;
  warnings: ConflictWarning[];
}

export interface CreateConflictDto {
  guestAId: string;
  guestBId: string;
  reason: string;
}

export interface UpdateConflictDto {
  reason: string;
}
