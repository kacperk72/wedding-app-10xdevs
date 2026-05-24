import { WeddingMemberRole } from './wedding.model';

export interface WeddingMembership {
  weddingId: string;
  role: WeddingMemberRole;
  linkedAt: string;
}

export interface LinkedPartner {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  linkStatus: 'linked';
}

export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  weddingId: string | null;
  weddingMembership: WeddingMembership | null;
  partner: LinkedPartner | null;
}
