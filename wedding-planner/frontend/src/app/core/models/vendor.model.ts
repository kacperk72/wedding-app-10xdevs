export type VendorCategory =
  | 'sala'
  | 'catering'
  | 'fotograf'
  | 'dj'
  | 'kwiaciarz'
  | 'usc'
  | 'ksiadz'
  | 'makijaz'
  | 'dekoracje'
  | 'tort';

export type VendorStatus = 'rozwazany' | 'spotkanie' | 'zarezerwowany' | 'zaplacony' | 'wykonany';

export interface Vendor {
  id: string;
  weddingId: string;
  category: VendorCategory;
  companyName: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  status: VendorStatus;
  contractAmount: number | null;
  notes: string | null;
  hasContract: boolean;
}

export interface CreateVendorDto {
  category: VendorCategory;
  companyName: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: VendorStatus;
  contractAmount?: number | null;
  notes?: string | null;
}

export type UpdateVendorDto = Partial<CreateVendorDto>;

export const VENDOR_CATEGORY_LABELS: Record<VendorCategory, string> = {
  sala: 'Sala',
  catering: 'Catering',
  fotograf: 'Fotograf',
  dj: 'DJ',
  kwiaciarz: 'Kwiaciarz',
  usc: 'USC',
  ksiadz: 'Ksiadz',
  makijaz: 'Makijaz',
  dekoracje: 'Dekoracje',
  tort: 'Tort',
};

export const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  rozwazany: 'rozwazany',
  spotkanie: 'spotkanie',
  zarezerwowany: 'zarezerwowany',
  zaplacony: 'zaplacony',
  wykonany: 'wykonany',
};
