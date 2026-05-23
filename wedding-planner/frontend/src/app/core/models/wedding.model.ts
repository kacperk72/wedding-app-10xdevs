export type WeddingMemberRole = 'partner_a' | 'partner_b';

export interface Wedding {
  id: string;
  partnerAName: string;
  partnerBName: string;
  weddingDate: string;
  ceremonyLocation: string | null;
  createdByUserId: string;
}
