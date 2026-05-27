import { PaymentMethod, VendorCategory } from './vendor.model';

export type ContractStatus = 'pending' | 'in_progress' | 'deposit_paid' | 'paid_in_full';
export type PaymentKind = 'zaliczka' | 'rata' | 'final' | 'ofiara';
export type PaymentStatus = 'planned' | 'paid' | 'overdue';

export interface Payment {
  id: string;
  contractId: string;
  kind: PaymentKind;
  dueDate: string;
  amount: number;
  status: PaymentStatus;
  paidAt: string | null;
  method: PaymentMethod;
  vendorName?: string | null;
  daysUntilDue?: number;
}

export interface Contract {
  id: string;
  weddingId: string;
  vendorId: string;
  vendorName: string | null;
  category: VendorCategory | null;
  totalAmount: number;
  signedDate: string | null;
  status: ContractStatus;
  payments: Payment[];
  paidCount: number;
  totalCount: number;
}

export interface CreateContractDto {
  vendorId: string;
  totalAmount: number;
  signedDate?: string | null;
  status?: ContractStatus;
}

export type UpdateContractDto = Partial<CreateContractDto>;

export interface CreatePaymentDto {
  kind: PaymentKind;
  dueDate: string;
  amount: number;
  status?: PaymentStatus;
  paidAt?: string | null;
  method?: PaymentMethod;
}

export type UpdatePaymentDto = Partial<CreatePaymentDto>;

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  pending: 'do podpisu',
  in_progress: 'w trakcie',
  deposit_paid: 'zaliczka oplacona',
  paid_in_full: 'oplacone',
};

export const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = {
  zaliczka: 'zaliczka',
  rata: 'rata',
  final: 'final',
  ofiara: 'ofiara',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  planned: 'zaplanowana',
  paid: 'opłacona',
  overdue: 'zaległa',
};
