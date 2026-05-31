-- Wedding Planner M1 schema + seed.
-- Auth stays in the external SSO/MySQL app. This Supabase project stores only
-- wedding-planner domain data and is accessed by the backend with service_role.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

create table users (
  id uuid primary key default gen_random_uuid(),
  sso_user_id text not null unique,
  email citext not null unique,
  password_hash text,
  first_name text,
  last_name text,
  email_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table weddings (
  id uuid primary key default gen_random_uuid(),
  partner_a_name text not null,
  partner_b_name text not null,
  wedding_date date not null,
  ceremony_location text,
  created_by_user_id uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_weddings_wedding_date on weddings(wedding_date);
create index idx_weddings_created_by_user_id on weddings(created_by_user_id);

create table wedding_members (
  wedding_id uuid not null references weddings(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('partner_a','partner_b')),
  linked_at timestamptz not null default now(),
  primary key (wedding_id, user_id),
  unique (user_id),
  unique (wedding_id, role)
);

create table partner_invitations (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings(id) on delete cascade,
  invited_by_user_id uuid not null references users(id) on delete cascade,
  email citext not null,
  token text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','declined','expired')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (wedding_id, email)
);
create index idx_partner_invitations_wedding_status on partner_invitations(wedding_id, status);
create index idx_partner_invitations_expires_at on partner_invitations(expires_at);

create table vendors (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings(id) on delete cascade,
  category text not null check (category in ('sala','catering','fotograf','dj','kwiaciarz','usc','ksiadz','makijaz','dekoracje','tort')),
  company_name text not null,
  contact_person text,
  phone text,
  email text,
  status text not null default 'rozwazany' check (status in ('rozwazany','spotkanie','zarezerwowany','zaplacony','wykonany')),
  contract_amount numeric(12,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_vendors_wedding_id on vendors(wedding_id);
create index idx_vendors_status on vendors(wedding_id, status);
create index idx_vendors_category on vendors(wedding_id, category);

create table contracts (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings(id) on delete cascade,
  vendor_id uuid not null unique references vendors(id) on delete cascade,
  total_amount numeric(12,2) not null,
  signed_date date,
  status text not null default 'pending' check (status in ('pending','in_progress','deposit_paid','paid_in_full')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_contracts_wedding_id on contracts(wedding_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  kind text not null check (kind in ('zaliczka','rata','final','ofiara')),
  due_date date not null,
  amount numeric(12,2) not null,
  status text not null default 'planned' check (status in ('planned','paid','overdue')),
  paid_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_payments_contract_id on payments(contract_id);
create index idx_payments_due_date on payments(due_date);

create table tables (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings(id) on delete cascade,
  name text not null,
  seats_count integer not null default 8 check (seats_count between 1 and 24),
  sort_order integer not null default 0,
  position_x integer,
  position_y integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (wedding_id, name)
);
create index idx_tables_wedding_id on tables(wedding_id);
create index idx_tables_wedding_sort on tables(wedding_id, sort_order);

create table meal_options (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings(id) on delete cascade,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (wedding_id, label)
);
create index idx_meal_options_wedding_sort on meal_options(wedding_id, sort_order);

create table guests (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  relation text not null check (relation in ('rodzina_panny_mlodej','rodzina_pana_mlodego','przyjaciele_panny_mlodej','przyjaciele_pana_mlodego','znajomi_z_pracy','wspolni_znajomi')),
  rsvp_status text not null default 'pending' check (rsvp_status in ('pending','confirmed','declined')),
  diet text not null default 'pending' check (diet in ('pending','standard','vege','vegan','gluten_free')),
  has_plus_one boolean not null default false,
  is_child boolean not null default false,
  meal_option_id uuid references meal_options(id) on delete set null,
  table_id uuid references tables(id) on delete set null,
  contact_phone text,
  contact_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_guests_wedding_id on guests(wedding_id);
create index idx_guests_rsvp on guests(wedding_id, rsvp_status);
create index idx_guests_relation on guests(wedding_id, relation);
create index idx_guests_table on guests(wedding_id, table_id);
create index idx_guests_meal_option on guests(meal_option_id) where meal_option_id is not null;

create table seating_conflicts (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings(id) on delete cascade,
  guest_a_id uuid not null references guests(id) on delete cascade,
  guest_b_id uuid not null references guests(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  check (guest_a_id <> guest_b_id)
);
create unique index uq_seating_conflicts_pair
  on seating_conflicts(wedding_id, least(guest_a_id, guest_b_id), greatest(guest_a_id, guest_b_id));

create table budget_categories (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings(id) on delete cascade,
  name text not null,
  planned_amount numeric(12,2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (wedding_id, name)
);
create index idx_budget_categories_wedding_id on budget_categories(wedding_id);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings(id) on delete cascade,
  category_id uuid not null references budget_categories(id) on delete cascade,
  vendor_id uuid references vendors(id) on delete set null,
  description text not null,
  amount numeric(12,2) not null,
  spent_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_expenses_category_id on expenses(category_id);
create index idx_expenses_wedding_recent on expenses(wedding_id, spent_on desc);
create index idx_expenses_vendor_id on expenses(vendor_id) where vendor_id is not null;

create table task_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  category text not null check (category in ('stroj','kontrahent','goscie','formalnosci','inne')),
  days_before_wedding integer not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings(id) on delete cascade,
  title text not null,
  description text,
  category text not null check (category in ('stroj','kontrahent','goscie','formalnosci','inne')),
  due_date date not null,
  done boolean not null default false,
  done_at timestamptz,
  is_auto boolean not null default false,
  template_id uuid references task_templates(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_tasks_wedding_id on tasks(wedding_id);
create index idx_tasks_pending on tasks(wedding_id, done, due_date);
create unique index uq_tasks_wedding_template_auto on tasks(wedding_id, template_id) where template_id is not null;

create table meetings (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings(id) on delete cascade,
  vendor_id uuid references vendors(id) on delete set null,
  title text not null,
  starts_at timestamptz not null,
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_meetings_wedding_starts on meetings(wedding_id, starts_at);
create index idx_meetings_vendor_id on meetings(vendor_id) where vendor_id is not null;

create table catering_offers (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings(id) on delete cascade,
  vendor_id uuid references vendors(id) on delete set null,
  name text not null,
  valid_through date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_catering_offers_wedding_id on catering_offers(wedding_id);
create index idx_catering_offers_vendor_id on catering_offers(vendor_id) where vendor_id is not null;

create table catering_packages (
  id uuid primary key default gen_random_uuid(),
  catering_offer_id uuid not null references catering_offers(id) on delete cascade,
  name text not null,
  price_per_person numeric(12,2) not null,
  is_modifiable boolean not null default true,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (catering_offer_id, name)
);
create index idx_catering_packages_offer_id on catering_packages(catering_offer_id);

create table catering_courses (
  id uuid primary key default gen_random_uuid(),
  catering_package_id uuid not null references catering_packages(id) on delete cascade,
  course_type text not null check (course_type in ('obiad_zupa','obiad_danie_glowne','obiad_deser','przystawka','kolacja_ciepla','deser_serwowany','bufet_zimny','bufet_salatkowy','dodatki','surowki','wiejski_stol','slodki_stol','napoje','inne')),
  title text not null,
  selection_mode text not null default 'couple_picks' check (selection_mode in ('all_served','couple_picks','guest_picks')),
  choice_limit smallint,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((selection_mode = 'all_served') = (choice_limit is null)),
  check (choice_limit is null or choice_limit > 0)
);
create index idx_catering_courses_package_sort on catering_courses(catering_package_id, sort_order);

create table catering_dishes (
  id uuid primary key default gen_random_uuid(),
  catering_offer_id uuid not null references catering_offers(id) on delete cascade,
  name text not null,
  description text,
  is_vegetarian boolean not null default false,
  is_vegan boolean not null default false,
  is_gluten_free boolean not null default false,
  allergens text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (catering_offer_id, name)
);
create index idx_catering_dishes_offer_id on catering_dishes(catering_offer_id);
create index idx_catering_dishes_allergens on catering_dishes using gin(allergens) where allergens is not null;

create table catering_course_dishes (
  catering_course_id uuid not null references catering_courses(id) on delete cascade,
  catering_dish_id uuid not null references catering_dishes(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (catering_course_id, catering_dish_id)
);
create index idx_catering_course_dishes_dish_id on catering_course_dishes(catering_dish_id);

create table catering_addons (
  id uuid primary key default gen_random_uuid(),
  catering_offer_id uuid not null references catering_offers(id) on delete cascade,
  name text not null,
  price numeric(12,2) not null,
  pricing_unit text not null default 'per_event' check (pricing_unit in ('per_person','per_event','per_bottle','per_hour','per_unit')),
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (catering_offer_id, name)
);
create index idx_catering_addons_offer_id on catering_addons(catering_offer_id);

create table wedding_catering_selection (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null unique references weddings(id) on delete cascade,
  catering_package_id uuid not null references catering_packages(id) on delete restrict,
  guest_count_estimate integer not null check (guest_count_estimate >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_wedding_catering_selection_package on wedding_catering_selection(catering_package_id);

create table wedding_catering_dish_picks (
  wedding_catering_selection_id uuid not null references wedding_catering_selection(id) on delete cascade,
  catering_course_id uuid not null references catering_courses(id) on delete cascade,
  catering_dish_id uuid not null references catering_dishes(id) on delete cascade,
  primary key (wedding_catering_selection_id, catering_course_id, catering_dish_id)
);
create index idx_wcdp_course on wedding_catering_dish_picks(catering_course_id);
create index idx_wcdp_dish on wedding_catering_dish_picks(catering_dish_id);

create table wedding_catering_addon_picks (
  wedding_catering_selection_id uuid not null references wedding_catering_selection(id) on delete cascade,
  catering_addon_id uuid not null references catering_addons(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  primary key (wedding_catering_selection_id, catering_addon_id)
);

alter table contracts
  add column wedding_catering_selection_id uuid references wedding_catering_selection(id) on delete set null;
create index idx_contracts_catering_selection on contracts(wedding_catering_selection_id)
  where wedding_catering_selection_id is not null;

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger tg_users_updated_at before update on users for each row execute function set_updated_at();
create trigger tg_weddings_updated_at before update on weddings for each row execute function set_updated_at();
create trigger tg_guests_updated_at before update on guests for each row execute function set_updated_at();
create trigger tg_vendors_updated_at before update on vendors for each row execute function set_updated_at();
create trigger tg_contracts_updated_at before update on contracts for each row execute function set_updated_at();
create trigger tg_payments_updated_at before update on payments for each row execute function set_updated_at();
create trigger tg_budget_categories_updated_at before update on budget_categories for each row execute function set_updated_at();
create trigger tg_expenses_updated_at before update on expenses for each row execute function set_updated_at();
create trigger tg_tasks_updated_at before update on tasks for each row execute function set_updated_at();
create trigger tg_tables_updated_at before update on tables for each row execute function set_updated_at();
create trigger tg_meetings_updated_at before update on meetings for each row execute function set_updated_at();
create trigger tg_meal_options_updated_at before update on meal_options for each row execute function set_updated_at();
create trigger tg_catering_offers_updated_at before update on catering_offers for each row execute function set_updated_at();
create trigger tg_catering_packages_updated_at before update on catering_packages for each row execute function set_updated_at();
create trigger tg_catering_courses_updated_at before update on catering_courses for each row execute function set_updated_at();
create trigger tg_catering_dishes_updated_at before update on catering_dishes for each row execute function set_updated_at();
create trigger tg_catering_addons_updated_at before update on catering_addons for each row execute function set_updated_at();
create trigger tg_wedding_catering_selection_updated_at before update on wedding_catering_selection for each row execute function set_updated_at();

create or replace function shift_auto_tasks_on_wedding_date_change()
returns trigger language plpgsql as $$
declare
  shift_days integer;
begin
  if new.wedding_date is distinct from old.wedding_date then
    shift_days := new.wedding_date - old.wedding_date;
    update tasks
    set due_date = due_date + shift_days
    where wedding_id = new.id
      and is_auto = true
      and done = false;
  end if;
  return new;
end;
$$;

create trigger tg_weddings_shift_auto_tasks
  after update of wedding_date on weddings
  for each row execute function shift_auto_tasks_on_wedding_date_change();

create or replace function enforce_seating_conflict_wedding_match()
returns trigger language plpgsql as $$
declare
  wa uuid;
  wb uuid;
begin
  select wedding_id into wa from guests where id = new.guest_a_id;
  select wedding_id into wb from guests where id = new.guest_b_id;
  if wa is null or wb is null or wa <> new.wedding_id or wb <> new.wedding_id then
    raise exception 'seating_conflict guests must belong to the same wedding';
  end if;
  return new;
end;
$$;

create trigger tg_seating_conflict_check
  before insert or update on seating_conflicts
  for each row execute function enforce_seating_conflict_wedding_match();

create or replace function enforce_catering_course_dish_same_offer()
returns trigger language plpgsql as $$
declare
  course_offer uuid;
  dish_offer uuid;
begin
  select cp.catering_offer_id into course_offer
    from catering_courses cc
    join catering_packages cp on cp.id = cc.catering_package_id
   where cc.id = new.catering_course_id;
  select catering_offer_id into dish_offer from catering_dishes where id = new.catering_dish_id;

  if course_offer is null or dish_offer is null or course_offer <> dish_offer then
    raise exception 'catering_course and catering_dish must belong to the same catering_offer';
  end if;
  return new;
end;
$$;

create trigger tg_catering_course_dish_same_offer
  before insert or update on catering_course_dishes
  for each row execute function enforce_catering_course_dish_same_offer();

create or replace function enforce_catering_selection_package_wedding()
returns trigger language plpgsql as $$
declare
  package_wedding uuid;
begin
  select co.wedding_id into package_wedding
    from catering_packages cp
    join catering_offers co on co.id = cp.catering_offer_id
   where cp.id = new.catering_package_id;
  if package_wedding is null or package_wedding <> new.wedding_id then
    raise exception 'catering_package must belong to the selected wedding';
  end if;
  return new;
end;
$$;

create trigger tg_wedding_catering_selection_package_wedding
  before insert or update on wedding_catering_selection
  for each row execute function enforce_catering_selection_package_wedding();

create or replace function enforce_catering_pick_consistency()
returns trigger language plpgsql as $$
declare
  selection_pkg uuid;
  course_pkg uuid;
  exists_link boolean;
begin
  select catering_package_id into selection_pkg
    from wedding_catering_selection
   where id = new.wedding_catering_selection_id;
  select catering_package_id into course_pkg
    from catering_courses
   where id = new.catering_course_id;

  if selection_pkg is null or course_pkg is null or selection_pkg <> course_pkg then
    raise exception 'catering_course must belong to the same package as the selection';
  end if;

  select exists (
    select 1
      from catering_course_dishes
     where catering_course_id = new.catering_course_id
       and catering_dish_id = new.catering_dish_id
  ) into exists_link;

  if not exists_link then
    raise exception 'dish is not available in course';
  end if;
  return new;
end;
$$;

create trigger tg_wcdp_consistency
  before insert or update on wedding_catering_dish_picks
  for each row execute function enforce_catering_pick_consistency();

insert into task_templates (title, category, days_before_wedding, sort_order)
values
  ('Ustal budzet wesela', 'inne', 365, 10),
  ('Zarezerwuj sale weselna', 'kontrahent', 365, 20),
  ('Wybierz fotografa', 'kontrahent', 300, 30),
  ('Spotkanie z DJ-em - wybor wykonawcy', 'kontrahent', 240, 40),
  ('Przygotuj wstepna liste gosci', 'goscie', 210, 50),
  ('Wybierz zaproszenia', 'goscie', 180, 60),
  ('Wyslij zaproszenia', 'goscie', 150, 70),
  ('Dopnij formalnosci USC / kosciol', 'formalnosci', 120, 80),
  ('Wybor menu z cateringiem', 'kontrahent', 90, 90),
  ('Przymiarka sukni i garnituru', 'stroj', 60, 100),
  ('Przygotuj plan rozsadzenia gosci', 'goscie', 30, 110),
  ('Potwierdz ostateczna liczbe gosci', 'goscie', 14, 120),
  ('Finalne rozliczenia z kontrahentami', 'kontrahent', 7, 130)
on conflict (title) do update set
  category = excluded.category,
  days_before_wedding = excluded.days_before_wedding,
  sort_order = excluded.sort_order;

create or replace function bootstrap_wedding(p_wedding_id uuid, p_creator_user_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_wedding_date date;
  v_budget_count integer;
  v_table_count integer;
  v_task_count integer;
begin
  select wedding_date into v_wedding_date from weddings where id = p_wedding_id;
  if v_wedding_date is null then
    raise exception 'wedding not found';
  end if;

  insert into wedding_members (wedding_id, user_id, role)
  values (p_wedding_id, p_creator_user_id, 'partner_a')
  on conflict do nothing;

  insert into budget_categories (wedding_id, name, planned_amount, sort_order)
  values
    (p_wedding_id, 'Sala weselna', 0, 1),
    (p_wedding_id, 'Catering', 0, 2),
    (p_wedding_id, 'Fotograf', 0, 3),
    (p_wedding_id, 'Kwiaty', 0, 4),
    (p_wedding_id, 'Dekoracje', 0, 5),
    (p_wedding_id, 'Muzyka / DJ', 0, 6),
    (p_wedding_id, 'Stylizacja panny młodej', 0, 7),
    (p_wedding_id, 'Stylizacja pana młodego', 0, 8),
    (p_wedding_id, 'USC / formalności', 0, 9),
    (p_wedding_id, 'Alkohol', 0, 10),
    (p_wedding_id, 'Tort', 0, 11),
    (p_wedding_id, 'Transport gości', 0, 12),
    (p_wedding_id, 'Hotel dla gości', 0, 13),
    (p_wedding_id, 'Obrączki', 0, 14),
    (p_wedding_id, 'Zaproszenia i papeteria', 0, 15)
  on conflict (wedding_id, name) do nothing;
  get diagnostics v_budget_count = row_count;

  insert into tables (wedding_id, name, seats_count, sort_order)
  select p_wedding_id, 'Stół ' || n::text, 8, n
    from generate_series(1, 12) as n
  on conflict (wedding_id, name) do nothing;
  get diagnostics v_table_count = row_count;

  insert into tasks (wedding_id, title, category, due_date, done, is_auto, template_id)
  select
    p_wedding_id,
    title,
    category,
    v_wedding_date - days_before_wedding,
    false,
    true,
    id
  from task_templates
  order by sort_order
  on conflict do nothing;
  get diagnostics v_task_count = row_count;

  return jsonb_build_object(
    'budgetCategories', v_budget_count,
    'tables', v_table_count,
    'tasks', v_task_count
  );
end;
$$;

create or replace function create_wedding_with_bootstrap(
  p_creator_user_id uuid,
  p_partner_a_name text,
  p_partner_b_name text,
  p_wedding_date date,
  p_ceremony_location text default null
)
returns jsonb language plpgsql security definer as $$
declare
  v_wedding weddings%rowtype;
  v_bootstrap jsonb;
begin
  if exists (select 1 from wedding_members where user_id = p_creator_user_id) then
    raise exception 'user already belongs to a wedding';
  end if;

  insert into weddings (
    partner_a_name,
    partner_b_name,
    wedding_date,
    ceremony_location,
    created_by_user_id
  )
  values (
    p_partner_a_name,
    p_partner_b_name,
    p_wedding_date,
    p_ceremony_location,
    p_creator_user_id
  )
  returning * into v_wedding;

  v_bootstrap := bootstrap_wedding(v_wedding.id, p_creator_user_id);

  return jsonb_build_object(
    'id', v_wedding.id,
    'partnerAName', v_wedding.partner_a_name,
    'partnerBName', v_wedding.partner_b_name,
    'weddingDate', v_wedding.wedding_date,
    'ceremonyLocation', v_wedding.ceremony_location,
    'createdByUserId', v_wedding.created_by_user_id,
    'bootstrap', v_bootstrap
  );
end;
$$;
