import {
  CeremonyType,
  EntranceOrder,
  GlassThrowing,
  WishesLocation,
} from '../../core/services/timeline.service';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export const CEREMONY_TYPE_OPTIONS: SelectOption<CeremonyType>[] = [
  { value: 'koscielny', label: 'Kościelny' },
  { value: 'cywilny', label: 'Cywilny' },
];

export const ENTRANCE_ORDER_OPTIONS: SelectOption<EntranceOrder>[] = [
  { value: 'goscie_pierwsi', label: 'Goście wchodzą pierwsi' },
  { value: 'para_pierwsza', label: 'Para wchodzi pierwsza' },
];

export const GLASS_THROWING_OPTIONS: SelectOption<GlassThrowing>[] = [
  { value: 'nie', label: 'Nie' },
  { value: 'zewnatrz', label: 'Tak — na zewnątrz' },
  { value: 'wewnatrz', label: 'Tak — wewnątrz' },
];

export const WISHES_LOCATION_OPTIONS: SelectOption<WishesLocation>[] = [
  { value: 'pod_koscielem', label: 'Pod kościołem / USC' },
  { value: 'lokal_przed_obiadem', label: 'W lokalu — przed obiadem' },
  { value: 'lokal_po_obiedzie', label: 'W lokalu — po obiedzie' },
];

// Multi-select preferencji muzycznych — stałe 10 kategorii (brak globalnego katalogu).
export const GENRE_CATEGORIES: SelectOption<string>[] = [
  { value: 'disco_polo', label: 'Disco polo' },
  { value: 'pop_pl', label: 'Polski pop' },
  { value: 'pop_zagr', label: 'Zagraniczny pop' },
  { value: 'rock', label: 'Rock' },
  { value: 'lata_80_90', label: 'Lata 80. i 90.' },
  { value: 'dance_club', label: 'Dance / club' },
  { value: 'biesiadne', label: 'Biesiadne / weselne klasyki' },
  { value: 'latino', label: 'Latino' },
  { value: 'hip_hop', label: 'Hip-hop / rap' },
  { value: 'oldies', label: 'Złote przeboje / oldies' },
];

// Muzyka per etap — TYLKO etapy nieobsługiwane polami dedykowanymi (patrz plan §F4):
// pierwszy taniec, tort i podziękowania mają osobne pola i nie są tu powielane.
export const MUSIC_STAGES: SelectOption<string>[] = [
  { value: 'wejscie_pary', label: 'Wejście pary na salę' },
  { value: 'skladanie_zyczen', label: 'Składanie życzeń' },
  { value: 'przerwy_obiad', label: 'Przerwy / obiad' },
  { value: 'rzut_welonem', label: 'Rzut welonem / wstążkami' },
  { value: 'rzut_muszka', label: 'Rzut muszką / skrzynką' },
  { value: 'taniec_nowej_pary', label: 'Taniec „nowej" pary' },
];

export const GENRE_LABELS: Record<string, string> = Object.fromEntries(
  GENRE_CATEGORIES.map((g) => [g.value, g.label]),
);

export const STAGE_LABELS: Record<string, string> = Object.fromEntries(
  MUSIC_STAGES.map((s) => [s.value, s.label]),
);

export const CEREMONY_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  CEREMONY_TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

export const ENTRANCE_ORDER_LABELS: Record<string, string> = Object.fromEntries(
  ENTRANCE_ORDER_OPTIONS.map((o) => [o.value, o.label]),
);

export const GLASS_THROWING_LABELS: Record<string, string> = Object.fromEntries(
  GLASS_THROWING_OPTIONS.map((o) => [o.value, o.label]),
);

export const WISHES_LOCATION_LABELS: Record<string, string> = Object.fromEntries(
  WISHES_LOCATION_OPTIONS.map((o) => [o.value, o.label]),
);

export const MUST_PLAY_LIMIT = 50;
