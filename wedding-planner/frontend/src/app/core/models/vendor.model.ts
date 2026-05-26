export type VendorCategory =
  | 'sala'
  | 'catering'
  | 'fotograf'
  | 'dj'
  | 'dekoratorka'
  | 'kosciol'
  | 'makijaz'
  | 'dekoracje'
  | 'slodki_stol_tort'
  | 'ciasta_pozegnalne';

export type VendorStatus = 'rozwazany' | 'spotkanie' | 'zarezerwowany' | 'zaplacony' | 'wykonany';

export type PaymentMethod = 'gotowka' | 'przelew';

export interface PaymentLegInput {
  amount: number;
  dueDate: string;
  method: PaymentMethod;
}

export interface ContractBundleInput {
  totalAmount: number;
  signedDate?: string | null;
  deposit?: PaymentLegInput | null;
  finalPayment?: PaymentLegInput | null;
}

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
  contract?: ContractBundleInput;
}

export type UpdateVendorDto = Partial<Omit<CreateVendorDto, 'contract'>>;

export const VENDOR_CATEGORY_LABELS: Record<VendorCategory, string> = {
  sala: 'Sala',
  catering: 'Catering',
  fotograf: 'Fotograf',
  dj: 'DJ',
  dekoratorka: 'Dekoratorka',
  kosciol: 'Kosciol',
  makijaz: 'Makijaz',
  dekoracje: 'Dekoracje',
  slodki_stol_tort: 'Slodki stol + tort',
  ciasta_pozegnalne: 'Ciasta na pozegnanie',
};

export const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  rozwazany: 'rozwazany',
  spotkanie: 'spotkanie',
  zarezerwowany: 'zarezerwowany',
  zaplacony: 'zaplacony',
  wykonany: 'wykonany',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  gotowka: 'Gotowka',
  przelew: 'Przelew',
};
