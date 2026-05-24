export type RsvpStatus = 'pending' | 'confirmed' | 'declined';

export type Diet = 'pending' | 'standard' | 'vege' | 'vegan' | 'gluten_free';

export type Relation =
  | 'rodzina_panny_mlodej'
  | 'rodzina_pana_mlodego'
  | 'przyjaciele_panny_mlodej'
  | 'przyjaciele_pana_mlodego'
  | 'znajomi_z_pracy'
  | 'wspolni_znajomi';

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
  contactPhone: string | null;
  contactEmail: string | null;
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

export const DIET_LABELS: Record<Diet, string> = {
  pending: 'Nie wybrano',
  standard: 'Standard',
  vege: 'Wegetariańska',
  vegan: 'Wegańska',
  gluten_free: 'Bezglutenowa',
};

export const RSVP_LABELS: Record<RsvpStatus, string> = {
  pending: 'Oczekuje',
  confirmed: 'Potwierdzony',
  declined: 'Odmowa',
};
