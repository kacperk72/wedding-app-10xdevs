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

export type VendorStatus =
  | 'rozwazany'
  | 'spotkanie'
  | 'zarezerwowany'
  | 'umowa_podpisana'
  | 'zaliczka_wplacona'
  | 'oplacony'
  | 'zrealizowany';

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
  kosciol: 'Kościół',
  makijaz: 'Makijaż',
  dekoracje: 'Dekoracje',
  slodki_stol_tort: 'Słodki stół + tort',
  ciasta_pozegnalne: 'Ciasta na pożegnanie',
};

export const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  rozwazany: 'rozważany',
  spotkanie: 'spotkanie umówione',
  zarezerwowany: 'zarezerwowany',
  umowa_podpisana: 'umowa podpisana',
  zaliczka_wplacona: 'zaliczka wpłacona',
  oplacony: 'opłacony w całości',
  zrealizowany: 'zrealizowany',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  gotowka: 'Gotówka',
  przelew: 'Przelew',
};
