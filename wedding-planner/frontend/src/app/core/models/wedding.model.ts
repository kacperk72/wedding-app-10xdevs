export type WeddingMemberRole = 'partner_a' | 'partner_b';

export interface Wedding {
  id: string;
  partnerAName: string;
  partnerBName: string;
  weddingDate: string;
  ceremonyLocation: string | null;
  createdByUserId: string;
}

export interface CreateWeddingDto {
  partnerAName: string;
  partnerBName: string;
  weddingDate: string;
  ceremonyLocation: string | null;
}

export type UpdateWeddingDto = Partial<CreateWeddingDto>;
