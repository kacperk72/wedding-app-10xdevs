import { PaymentMethod } from './vendor.model';

export type CourseType =
  | 'obiad_zupa'
  | 'obiad_danie_glowne'
  | 'obiad_deser'
  | 'przystawka'
  | 'kolacja_ciepla'
  | 'deser_serwowany'
  | 'bufet_zimny'
  | 'bufet_salatkowy'
  | 'dodatki'
  | 'surowki'
  | 'wiejski_stol'
  | 'slodki_stol'
  | 'napoje'
  | 'inne';

export type SelectionMode = 'all_served' | 'couple_picks' | 'guest_picks';
export type PricingUnit = 'per_person' | 'per_event' | 'per_bottle' | 'per_hour' | 'per_unit';

export interface CateringOffer {
  id: string;
  weddingId: string;
  vendorId: string | null;
  vendorName: string | null;
  name: string;
  validThrough: string | null;
  notes: string | null;
  packagesCount: number;
  dishesCount: number;
  addonsCount: number;
  packages?: CateringPackage[];
  dishes?: CateringDish[];
  addons?: CateringAddon[];
}

export interface CateringPackage {
  id: string;
  offerId: string;
  name: string;
  pricePerPerson: number;
  isModifiable: boolean;
  description: string | null;
  sortOrder: number;
  courses: CateringCourse[];
  dishesCount?: number;
}

export interface CateringCourse {
  id: string;
  packageId: string;
  courseType: CourseType;
  title: string;
  selectionMode: SelectionMode;
  choiceLimit: number | null;
  sortOrder: number;
  dishes: LinkedDish[];
}

export interface LinkedDish {
  id: string;
  dishId: string;
  offerId: string;
  name: string;
  description: string | null;
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  allergens: string[];
  sortOrder: number;
}

export interface CateringDish {
  id: string;
  dishId: string;
  offerId: string;
  name: string;
  description: string | null;
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  allergens: string[];
}

export interface CateringAddon {
  id: string;
  offerId: string;
  name: string;
  price: number;
  pricingUnit: PricingUnit;
  description: string | null;
  sortOrder: number;
}

export interface DishPick {
  courseId: string;
  dishId: string;
  dishName: string | null;
}

export interface AddonPick {
  addonId: string;
  addonName: string | null;
  quantity: number;
  pricingUnit: PricingUnit | null;
  unitPrice: number | null;
}

export interface CateringSelection {
  id: string;
  weddingId: string;
  packageId: string;
  packageName: string | null;
  guestCountEstimate: number;
  notes: string | null;
  dishPicks: DishPick[];
  addonPicks: AddonPick[];
  price?: PriceBreakdown;
}

export interface AddonLine {
  id: string;
  name: string;
  unitPrice: number;
  pricingUnit: PricingUnit;
  multiplier: number;
  quantity: number;
  subtotal: number;
}

export interface PriceBreakdown {
  packagePrice: number;
  guestCount: number;
  packageSubtotal: number;
  addons: AddonLine[];
  addonsSubtotal: number;
  total: number;
}

export interface CreateOfferDto {
  name: string;
  vendorId?: string | null;
  validThrough?: string | null;
  notes?: string | null;
  preset?: 'palac-polanka-2026';
}

export interface CreateAddonDto {
  name: string;
  price: number;
  pricingUnit: PricingUnit;
  description?: string | null;
  sortOrder?: number;
}

export interface CreateDishDto {
  name: string;
  description?: string | null;
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  allergens?: string[];
}

export interface FreezePaymentDto {
  amount: number;
  dueDate: string;
  method: PaymentMethod;
}

export interface FreezeContractDto {
  vendorId: string;
  signedDate?: string | null;
  deposit?: FreezePaymentDto | null;
  finalPayment?: FreezePaymentDto | null;
}

export interface SyncMealOptionsResult {
  created: number;
  updated: number;
  skippedManual: number;
}
