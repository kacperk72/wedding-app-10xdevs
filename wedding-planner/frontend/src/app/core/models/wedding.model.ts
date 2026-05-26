export type WeddingMemberRole = 'partner_a' | 'partner_b';

export interface Wedding {
  id: string;
  partnerAName: string;
  partnerBName: string;
  weddingDate: string;
  ceremonyLocation: string | null;
  createdByUserId: string;
  members?: WeddingMember[];
}

export interface WeddingMember {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: WeddingMemberRole;
  linkedAt: string;
}

export interface PartnerInvitation {
  id: string;
  wedding_id?: string;
  weddingId?: string;
  email: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expires_at?: string;
  expiresAt?: string;
  created_at?: string;
  createdAt?: string;
}

export interface WeddingExport {
  exportedAt: string;
  wedding: unknown;
  weddingMembers: unknown[];
  partnerInvitations: PartnerInvitation[];
  guests: unknown[];
  mealOptions: unknown[];
  tables: unknown[];
  vendors: unknown[];
  contracts: unknown[];
  payments: unknown[];
  budgetCategories: unknown[];
  expenses: unknown[];
  tasks: unknown[];
  meetings: unknown[];
}

export interface CreateWeddingDto {
  partnerAName: string;
  partnerBName: string;
  weddingDate: string;
  ceremonyLocation: string | null;
}

export type UpdateWeddingDto = Partial<CreateWeddingDto>;
