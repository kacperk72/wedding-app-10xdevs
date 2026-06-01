-- Zakładka „Harmonogram" (ankieta DJ-a).
-- Model hybrydowy: rekord 1:1 z weselem (wedding_timeline) na pola skalarne +
-- jsonb (preferencje gatunków, muzyka per etap), oraz dwie tabele potomne:
-- timeline_events (godzinowy przebieg dnia) i timeline_songs (listy must/do-not).
-- Godziny przechowywane jako `time` (bez strefy) — API normalizuje do "HH:MM".
-- RLS deny-all jak na wszystkich tabelach (service_role omija; brak polityk = brak
-- dostępu dla anon/authenticated). Triggery updated_at reużywają set_updated_at().

create table wedding_timeline (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null unique references weddings(id) on delete cascade,

  -- Logistyka (pyt. 1–11 ankiety DJ-a)
  ceremony_type text check (ceremony_type in ('koscielny','cywilny')),
  ceremony_time time,
  travel_minutes smallint check (travel_minutes >= 0),
  venue_arrival_time time,
  entrance_order text check (entrance_order in ('goscie_pierwsi','para_pierwsza')),
  glass_throwing text check (glass_throwing in ('nie','zewnatrz','wewnatrz')),
  wishes_location text check (wishes_location in ('pod_koscielem','lokal_przed_obiadem','lokal_po_obiedzie')),
  dance_floor_ground_floor boolean,
  has_children boolean,
  gorzko_tolerance boolean,

  -- Dane kontaktowe nieobecne w innych encjach
  venue_manager_name text,
  venue_manager_phone text,
  witnesses text,
  bride_parents text,
  groom_parents text,

  -- Pierwszy taniec (pyt. 9)
  first_dance_time time,
  first_dance_song text,
  first_dance_full boolean,

  -- Podziękowania dla rodziców (pyt. 10)
  parents_thanks_enabled boolean,
  parents_thanks_time time,
  parents_thanks_form text,
  parents_thanks_song text,

  -- Tort (pyt. 11)
  cake_time time,
  cake_entry_song text,
  cake_cutting_song text,

  -- Preferencje muzyczne (pyt. 12, 15). music_per_stage trzyma TYLKO etapy nie
  -- pokryte polami dedykowanymi (wejście pary, życzenia, przerwy, rzut welonem,
  -- rzut muszką, taniec „nowej" pary); pozycje pokrywające się są wyprowadzane
  -- z pól dedykowanych w widoku eksportu.
  genre_preferences jsonb not null default '[]',
  music_per_stage jsonb not null default '{}',

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table timeline_events (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings(id) on delete cascade,
  label text not null,
  event_time time,
  sort_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_timeline_events_wedding_id on timeline_events(wedding_id);
create index idx_timeline_events_wedding_sort on timeline_events(wedding_id, sort_order);

create table timeline_songs (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings(id) on delete cascade,
  kind text not null check (kind in ('must','do_not')),
  title text not null,
  artist text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_timeline_songs_wedding_id on timeline_songs(wedding_id);
create index idx_timeline_songs_wedding_kind on timeline_songs(wedding_id, kind);

-- RLS deny-all (spójnie z 20260524090000_rls_lockdown).
alter table public.wedding_timeline enable row level security;
alter table public.timeline_events  enable row level security;
alter table public.timeline_songs   enable row level security;

-- Triggery updated_at reużywają istniejącej funkcji set_updated_at().
create trigger tg_wedding_timeline_updated_at before update on wedding_timeline for each row execute function set_updated_at();
create trigger tg_timeline_events_updated_at  before update on timeline_events  for each row execute function set_updated_at();
create trigger tg_timeline_songs_updated_at   before update on timeline_songs   for each row execute function set_updated_at();
