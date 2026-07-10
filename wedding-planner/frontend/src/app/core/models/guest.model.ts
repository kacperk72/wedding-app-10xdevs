export type RsvpStatus = 'pending' | 'confirmed' | 'declined';

export type Diet = 'pending' | 'standard' | 'vege' | 'vegan' | 'gluten_free' | 'kids';

export type Relation =
  | 'rodzina_panny_mlodej'
  | 'rodzina_pana_mlodego'
  | 'przyjaciele_panny_mlodej'
  | 'przyjaciele_pana_mlodego'
  | 'znajomi_z_pracy'
  | 'wspolni_znajomi';

/**
 * Strona wesela wyprowadzona z relacji gościa. Nie ma osobnego pola w schemacie —
 * relacje jednoznacznie wskazują stronę Panny/Pana Młodego, a pozostałe są wspólne.
 */
export type GuestSide = 'bride' | 'groom' | 'shared';

export interface Guest {
  id: string;
  weddingId: string;
  firstName: string;
  lastName: string;
  relation: Relation;
  rsvpStatus: RsvpStatus;
  diet: Diet;
  hasPlusOne: boolean;
  isChild: boolean;
  mealOptionId: string | null;
  tableId: string | null;
  seatNumber: number | null;
  contactPhone: string | null;
  contactEmail: string | null;
  mealOptionLabel?: string | null;
  tableName?: string | null;
}

export interface CreateGuestDto {
  firstName: string;
  lastName: string;
  relation: Relation;
  diet: Diet;
}

export type UpdateGuestDto = Partial<Omit<Guest, 'id' | 'weddingId'>>;

export interface GuestAggregates {
  invited: number;
  confirmed: number;
  pending: number;
  declined: number;
  vegeOrVegan: number;
  children: number;
  noMealPick: number;
}

export interface GuestFilters {
  search: string;
  rsvp: RsvpStatus | 'all';
  diet: Diet | 'all';
  relation: Relation | 'all';
  sort: 'lastName' | 'firstName';
}

export const RELATION_LABELS: Record<Relation, string> = {
  rodzina_panny_mlodej: 'Rodzina Panny Młodej',
  rodzina_pana_mlodego: 'Rodzina Pana Młodego',
  przyjaciele_panny_mlodej: 'Przyjaciele Panny Młodej',
  przyjaciele_pana_mlodego: 'Przyjaciele Pana Młodego',
  znajomi_z_pracy: 'Znajomi z pracy',
  wspolni_znajomi: 'Wspólni znajomi',
};

const RELATION_TO_SIDE: Record<Relation, GuestSide> = {
  rodzina_panny_mlodej: 'bride',
  przyjaciele_panny_mlodej: 'bride',
  rodzina_pana_mlodego: 'groom',
  przyjaciele_pana_mlodego: 'groom',
  znajomi_z_pracy: 'shared',
  wspolni_znajomi: 'shared',
};

export function relationToSide(relation: Relation): GuestSide {
  return RELATION_TO_SIDE[relation];
}

export const SIDE_LABELS: Record<GuestSide, string> = {
  bride: 'Strona Panny Młodej',
  groom: 'Strona Pana Młodego',
  shared: 'Wspólni',
};

export const DIET_LABELS: Record<Diet, string> = {
  pending: 'Nie wybrano',
  standard: 'Standard',
  vege: 'Wegetariańska',
  vegan: 'Wegańska',
  gluten_free: 'Bezglutenowa',
  kids: 'Dziecięca',
};

export const RSVP_LABELS: Record<RsvpStatus, string> = {
  pending: 'Oczekuje',
  confirmed: 'Potwierdzony',
  declined: 'Odmowa',
};
