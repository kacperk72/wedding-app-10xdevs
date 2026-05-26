# Database — Wedding Planner

> **TL;DR**: PostgreSQL 17 (Supabase). **25 tabel** główne. Rdzeń modelu: `weddings` jako encja kontekstowa, do której należą goście, kontrahenci, umowy, kategorie budżetu, transakcje, zadania, stoły, konflikty, spotkania, opcje dań **oraz konfigurator oferty cateringu** (9 tabel: oferty, pakiety, kategorie kursów, dania, dodatki + wybór pary z M:N picks). Dwóch partnerów łączy z weselem tabela `wedding_members`; jeden z nich (`weddings.created_by_user_id`) ma uprawnienia do hard-delete wesela, reszta CRUD jest symetryczna. Cała baza jest **inferowana** z UI prototypu Lovable + **rozszerzona** o domenę cateringu na podstawie realnej oferty (PDF Pałac Polanka 2026 jako wzorzec — model jest jednak uniwersalny, każda para wprowadza ofertę swojej sali). **Schemat zaaplikowany** na zdalnym projekcie (`wedding-planner/backend/supabase/migrations/`); RLS deny-all włączone na każdej tabeli `public` — autoryzacja domenowa w Express middleware, nie w politykach (patrz sekcja RLS).

**Engine**: PostgreSQL 15+ (Supabase).
**Konwencje**: UUID PK (`gen_random_uuid()`), `snake_case` kolumny, `created_at` / `updated_at` na każdej tabeli, kwoty w `numeric(12,2)` (PLN), enums przez `text CHECK (… IN (…))` zamiast natywnego `enum` (łatwiejsze migracje).

Confidence labels:
- **Observed** — pole widoczne w UI lub responsie
- **Inferred** — logicznie konieczne, niewidoczne (`password_hash`)
- **Recommended** — best practice, opcjonalne (timestamps, indeksy, soft-delete)

---

## Entity-relationship overview

```
erDiagram
  users ||--o{ wedding_members : has
  users ||--|| weddings : owns
  weddings ||--o{ wedding_members : has
  weddings ||--o{ guests : owns
  weddings ||--o{ vendors : owns
  weddings ||--o{ contracts : owns
  weddings ||--o{ tables : owns
  weddings ||--o{ seating_conflicts : owns
  weddings ||--o{ budget_categories : owns
  weddings ||--o{ expenses : owns
  weddings ||--o{ tasks : owns
  weddings ||--o{ meetings : owns
  weddings ||--o{ meal_options : owns
  weddings ||--o{ partner_invitations : owns
  weddings ||--o{ catering_offers : has
  weddings ||--o| wedding_catering_selection : "selects (1:1)"
  vendors ||--o| contracts : has
  vendors ||--o{ meetings : with
  vendors ||--o{ expenses : tagged_with
  vendors ||--o{ catering_offers : "from venue"
  contracts ||--o{ payments : schedules
  contracts }o--o| wedding_catering_selection : "freezes"
  budget_categories ||--o{ expenses : groups
  guests ||--o| tables : assigned_to
  guests ||--o| meal_options : picks
  guests ||--o{ seating_conflicts : in
  task_templates ||--o{ tasks : seeds
  catering_offers ||--o{ catering_packages : tier
  catering_offers ||--o{ catering_dishes : library
  catering_offers ||--o{ catering_addons : extras
  catering_packages ||--o{ catering_courses : section
  catering_courses ||--o{ catering_course_dishes : "available_in"
  catering_dishes ||--o{ catering_course_dishes : "appears_in"
  wedding_catering_selection }o--|| catering_packages : "chosen_tier"
  wedding_catering_selection ||--o{ wedding_catering_dish_picks : "menu_picks"
  wedding_catering_selection ||--o{ wedding_catering_addon_picks : "addon_picks"
  catering_dishes ||--o{ wedding_catering_dish_picks : "picked"
  catering_addons ||--o{ wedding_catering_addon_picks : "picked"
```

---

## Tables

### `users`

| Column          | Type                       | Null | Default                | Confidence | Notes                                            |
| --------------- | -------------------------- | ---- | ---------------------- | ---------- | ------------------------------------------------ |
| id              | uuid PK                    | NO   | `gen_random_uuid()`    | Observed   | Zwracany w `/api/me`, używany w `partner.id`     |
| email           | citext UNIQUE              | NO   |                        | Observed   | Login + zaproszenie partnera                     |
| password_hash   | text                       | NO   |                        | Inferred   | Wymagany dla loginu                              |
| first_name      | text                       | YES  |                        | Observed   | "Kacper" w karcie partnera                       |
| last_name       | text                       | YES  |                        | Observed   | "Wiśniewski"                                     |
| email_verified  | boolean                    | NO   | `false`                | Inferred   | Zaproszenie partnera idzie e-mailem              |
| created_at      | timestamptz                | NO   | `now()`                | Recommended|                                                  |
| updated_at      | timestamptz                | NO   | `now()`                | Recommended|                                                  |

Indexes: unique na `email` (auto), `created_at` desc dla porządkowania w admin viewach.

### `weddings`

Encja "wesele" — pojedyncze wydarzenie, do którego należą wszyscy goście, kontrahenci itd. Każdy user ma 0 lub 1 aktywne wesele.

| Column                | Type                                            | Null | Default              | Confidence  | Notes                                                  |
| --------------------- | ----------------------------------------------- | ---- | -------------------- | ----------- | ------------------------------------------------------ |
| id                    | uuid PK                                         | NO   | `gen_random_uuid()`  | Inferred    |                                                        |
| partner_a_name        | text                                            | NO   |                      | Observed    | "Weronika" w Ustawieniach                              |
| partner_b_name        | text                                            | NO   |                      | Observed    | "Kacper"                                               |
| wedding_date          | date                                            | NO   |                      | Observed    | "25.07.2026"                                           |
| ceremony_location     | text                                            | YES  |                      | Observed    | "Kościół św. Marcina, Wrocław"                         |
| created_by_user_id    | uuid FK → users(id) ON DELETE RESTRICT          | NO   |                      | Recommended | "Founder" — jedyny user, który może hard-delete całe wesele. Inne uprawnienia są symetryczne między partnerami. |
| created_at            | timestamptz                                     | NO   | `now()`              | Recommended |                                                        |
| updated_at            | timestamptz                                     | NO   | `now()`              | Recommended |                                                        |

Indexes: `wedding_date` (do sortowania w analytics), `created_by_user_id` (RLS lookups).

### `wedding_members`

Łącznik user↔wesele z rolą.

| Column      | Type                                                     | Null | Default | Confidence | Notes                          |
| ----------- | -------------------------------------------------------- | ---- | ------- | ---------- | ------------------------------ |
| wedding_id  | uuid FK → weddings(id) ON DELETE CASCADE                 | NO   |         | Inferred   |                                |
| user_id     | uuid FK → users(id) ON DELETE CASCADE                    | NO   |         | Inferred   |                                |
| role        | text CHECK (role IN ('partner_a','partner_b'))           | NO   |         | Observed   | Inicjały W/K w UI; "Konto połączone" |
| linked_at   | timestamptz                                              | NO   | `now()` | Recommended|                                |

Primary key: `(wedding_id, user_id)`.
Constraint: `UNIQUE(user_id)` — user może być w max 1 weselu.
Constraint: `UNIQUE(wedding_id, role)` — w jednym weselu co najwyżej jeden `partner_a` i jeden `partner_b`.

### `partner_invitations`

| Column              | Type                                                                              | Null | Default              | Confidence  | Notes                                                                  |
| ------------------- | --------------------------------------------------------------------------------- | ---- | -------------------- | ----------- | ---------------------------------------------------------------------- |
| id                  | uuid PK                                                                           | NO   | `gen_random_uuid()`  | Inferred    |                                                                        |
| wedding_id          | uuid FK → weddings(id) ON DELETE CASCADE                                          | NO   |                      | Inferred    |                                                                        |
| invited_by_user_id  | uuid FK → users(id) ON DELETE CASCADE                                             | NO   |                      | Recommended | Kto wysłał zaproszenie (audit trail + RLS source of truth)             |
| email               | citext                                                                            | NO   |                      | Observed    | Pole "e-mail partnera" w Ustawieniach                                  |
| token               | text UNIQUE                                                                       | NO   |                      | Inferred    | Krótki random URL-safe                                                 |
| status              | text CHECK (status IN ('pending','accepted','declined','expired'))                | NO   | `'pending'`          | Recommended | Wyliczany z `accepted_at` + TTL, ale trzymany dla prostszych zapytań    |
| expires_at          | timestamptz                                                                       | NO   |                      | Inferred    | Domyślnie now() + 7d                                                    |
| accepted_at         | timestamptz                                                                       | YES  |                      | Inferred    | Ustawiane przy `POST /accept-invite`                                    |
| created_at          | timestamptz                                                                       | NO   | `now()`              | Recommended |                                                                         |

Constraint: `UNIQUE(wedding_id, email)` — jedna para może mieć tylko jedno aktywne zaproszenie na ten sam adres.
Indexes: `(wedding_id, status)`, `expires_at` (cron unieważniający wygasłe).

### `guests`

| Column           | Type                                                                  | Null | Default              | Confidence | Notes                                                  |
| ---------------- | --------------------------------------------------------------------- | ---- | -------------------- | ---------- | ------------------------------------------------------ |
| id               | uuid PK                                                               | NO   | `gen_random_uuid()`  | Observed   |                                                        |
| wedding_id       | uuid FK → weddings(id) ON DELETE CASCADE                              | NO   |                      | Inferred   |                                                        |
| first_name       | text                                                                  | NO   |                      | Observed   | "Adam"                                                 |
| last_name        | text                                                                  | NO   |                      | Observed   | "Kwiatkowski"                                          |
| relation         | text CHECK (relation IN ('rodzina_panny_mlodej','rodzina_pana_mlodego','przyjaciele_panny_mlodej','przyjaciele_pana_mlodego','znajomi_z_pracy','wspolni_znajomi')) | NO |  | Observed | Grupy widoczne w tabeli                  |
| rsvp_status      | text CHECK (rsvp_status IN ('pending','confirmed','declined'))        | NO   | `'pending'`          | Observed   | Badge ⏳/✅/❌                                            |
| diet             | text CHECK (diet IN ('pending','standard','vege','vegan','gluten_free'))| NO  | `'pending'`         | Observed   | Modal Dodaj gościa pokazuje "Standard" jako default UX, ale semantycznie nowy gość ma `'pending'` dopóki nie potwierdzi diety. KPI "14 nie wybrało dania" = `diet='pending'`. |
| has_plus_one     | boolean                                                               | NO   | `false`              | Observed   | Ikona 💑 w karcie nieprzypisanego                       |
| is_child         | boolean                                                               | NO   | `false`              | Observed   | "5 dzieci" w agregatach. Pole edytowalne w widoku edycji gościa (poza modalem dodawania, który ma tylko 4 pola). |
| meal_option_id   | uuid FK → meal_options(id) ON DELETE SET NULL                         | YES  |                      | Recommended | Wybór konkretnej opcji menu (osobne od diety — para definiuje listę dań w `meal_options`) |
| table_id         | uuid FK → tables(id) ON DELETE SET NULL                               | YES  |                      | Observed   | Kolumna "Stół" w tabeli                                |
| contact_phone    | text                                                                  | YES  |                      | Inferred   | Z opisu modala (telefon/e-mail) — w aktualnym modalu nie ma |
| contact_email    | text                                                                  | YES  |                      | Inferred   |                                                        |
| created_at       | timestamptz                                                           | NO   | `now()`              | Recommended|                                                        |
| updated_at       | timestamptz                                                           | NO   | `now()`              | Recommended|                                                        |

Indexes: `wedding_id`, `(wedding_id, rsvp_status)`, `(wedding_id, table_id)`, `(wedding_id, relation)`.

### `vendors`

| Column           | Type                                                                       | Null | Default              | Confidence | Notes                                          |
| ---------------- | -------------------------------------------------------------------------- | ---- | -------------------- | ---------- | ---------------------------------------------- |
| id               | uuid PK                                                                    | NO   | `gen_random_uuid()`  | Observed   |                                                |
| wedding_id       | uuid FK → weddings(id) ON DELETE CASCADE                                   | NO   |                      | Inferred   |                                                |
| category         | text CHECK (category IN ('sala','catering','fotograf','dj','dekoratorka','kosciol','makijaz','dekoracje','slodki_stol_tort','ciasta_pozegnalne')) | NO |  | Observed | 10 kategorii w UI (2026-05-26 rework: kwiaciarz→dekoratorka, ksiadz→kosciol, tort→slodki_stol_tort, +ciasta_pozegnalne, −usc; migracja `20260526120000_vendor_categories_rework`) |
| company_name     | text                                                                       | NO   |                      | Observed   | "Pałac Pod Lipami"                             |
| contact_person   | text                                                                       | YES  |                      | Observed   | "Joanna Wójcik"                                |
| phone            | text                                                                       | YES  |                      | Observed   | "+48 600 100 200"                              |
| email            | text                                                                       | YES  |                      | Observed   | "biuro@palacpodlipami.pl"                      |
| status           | text CHECK (status IN ('rozwazany','spotkanie','zarezerwowany','zaplacony','wykonany')) | NO | `'rozwazany'` | Observed | 5 statusów w chips na górze            |
| contract_amount  | numeric(12,2)                                                              | YES  |                      | Observed   | **Planowana / orientacyjna** kwota — widoczna na karcie kontrahenta nawet zanim umowa zostanie podpisana. Po podpisaniu źródłem prawdy staje się `contracts.total_amount` (zwykle ta sama wartość — backend kopiuje przy `POST /contracts`). |
| notes            | text                                                                       | YES  |                      | Recommended| Useful w produkcji, brak w UI                  |
| created_at       | timestamptz                                                                | NO   | `now()`              | Recommended|                                                |
| updated_at       | timestamptz                                                                | NO   | `now()`              | Recommended|                                                |

Indexes: `wedding_id`, `(wedding_id, status)`, `(wedding_id, category)`.

### `contracts`

| Column         | Type                                                            | Null | Default              | Confidence | Notes                                       |
| -------------- | --------------------------------------------------------------- | ---- | -------------------- | ---------- | ------------------------------------------- |
| id             | uuid PK                                                         | NO   | `gen_random_uuid()`  | Observed   |                                             |
| wedding_id     | uuid FK → weddings(id) ON DELETE CASCADE                        | NO   |                      | Inferred   |                                             |
| vendor_id      | uuid FK → vendors(id) ON DELETE CASCADE UNIQUE                  | NO   |                      | Observed   | 1:1 — każdy kontrahent ma 0 lub 1 umowę     |
| total_amount   | numeric(12,2)                                                   | NO   |                      | Observed   | "32 000 zł" w tabeli umów                   |
| signed_date    | date                                                            | YES  |                      | Observed   | "Podpisana 17.10.2025"                      |
| status         | text CHECK (status IN ('pending','in_progress','deposit_paid','paid_in_full')) | NO | `'pending'` | Observed | 'w trakcie', 'zaliczka opłacona', 'opłacone w całości', '—' |
| created_at     | timestamptz                                                     | NO   | `now()`              | Recommended|                                             |
| updated_at     | timestamptz                                                     | NO   | `now()`              | Recommended|                                             |

Indexes: `wedding_id`, `vendor_id` (unique).

### `payments`

| Column        | Type                                                                | Null | Default              | Confidence | Notes                                   |
| ------------- | ------------------------------------------------------------------- | ---- | -------------------- | ---------- | --------------------------------------- |
| id            | uuid PK                                                             | NO   | `gen_random_uuid()`  | Observed   |                                         |
| contract_id   | uuid FK → contracts(id) ON DELETE CASCADE                           | NO   |                      | Inferred   |                                         |
| kind          | text CHECK (kind IN ('zaliczka','rata','final','ofiara'))           | NO   |                      | Observed   | "rata · termin 12.05.2026", "ofiara"    |
| due_date      | date                                                                | NO   |                      | Observed   |                                         |
| amount        | numeric(12,2)                                                       | NO   |                      | Observed   |                                         |
| status        | text CHECK (status IN ('planned','paid','overdue'))                 | NO   | `'planned'`          | Observed   | Kropki w pasku harmonogramu — 3 trzymane wartości (🟢 paid, 🔴 overdue, ⚪/🟣 planned). 🟡 "due_soon" (`due_date` w 30 dniach) wyliczany dynamicznie w queries — patrz uwaga niżej. |
| paid_at       | date                                                                | YES  |                      | Inferred   | Pole wymagane do wyróżnienia "opłacone" |
| method        | text CHECK (method IN ('gotowka','przelew'))                        | NO   | `'przelew'`          | Observed   | Metoda płatności wybierana przy dodawaniu kontrahenta (zaliczka + final). Migracja `20260526120500_payments_method`. |
| created_at    | timestamptz                                                         | NO   | `now()`              | Recommended|                                         |
| updated_at    | timestamptz                                                         | NO   | `now()`              | Recommended|                                         |

Indexes: `contract_id`, `(contract_id, due_date)`, `(due_date)` dla agregatu "Nadchodzące płatności (30 dni)".

> **Uwaga**: status `due_soon` można wyliczać dynamicznie (`due_date BETWEEN now() AND now() + 30 days AND status='planned'`). Trzymanie go w bazie powiela logikę. Rekomendacja: trzymać tylko `planned/paid/overdue`, pozostałe wyliczać w queries lub w widoku `payments_with_computed_status`.

### `budget_categories`

| Column           | Type                                       | Null | Default              | Confidence | Notes                                  |
| ---------------- | ------------------------------------------ | ---- | -------------------- | ---------- | -------------------------------------- |
| id               | uuid PK                                    | NO   | `gen_random_uuid()`  | Observed   |                                        |
| wedding_id       | uuid FK → weddings(id) ON DELETE CASCADE   | NO   |                      | Inferred   |                                        |
| name             | text                                       | NO   |                      | Observed   | "Sala weselna", "Catering", …          |
| planned_amount   | numeric(12,2)                              | NO   | `0`                  | Observed   | "est. 32 000 zł"                       |
| sort_order       | integer                                    | NO   | `0`                  | Recommended| Kolejność wyświetlania                 |
| created_at       | timestamptz                                | NO   | `now()`              | Recommended|                                        |
| updated_at       | timestamptz                                | NO   | `now()`              | Recommended|                                        |

Constraint: `UNIQUE(wedding_id, name)`.
Indexes: `wedding_id`.

15 obserwowanych kategorii do zaseedowania na nowe wesele: Sala weselna, Catering, Fotograf, Kwiaty, Dekoracje, Muzyka / DJ, Stylizacja panny młodej, Stylizacja pana młodego, USC / formalności, Alkohol, Tort, Transport gości, Hotel dla gości, Obrączki, Zaproszenia i papeteria.

### `expenses`

| Column          | Type                                                           | Null | Default              | Confidence  | Notes                                                                  |
| --------------- | -------------------------------------------------------------- | ---- | -------------------- | ----------- | ---------------------------------------------------------------------- |
| id              | uuid PK                                                        | NO   | `gen_random_uuid()`  | Inferred    |                                                                        |
| wedding_id      | uuid FK → weddings(id) ON DELETE CASCADE                       | NO   |                      | Inferred    |                                                                        |
| category_id     | uuid FK → budget_categories(id) ON DELETE CASCADE              | NO   |                      | Inferred    | Wiersz transakcji w rozwiniętej kategorii                              |
| vendor_id       | uuid FK → vendors(id) ON DELETE SET NULL                       | YES  |                      | Recommended | Opcjonalnie — pozwala agregować "ile wydaliśmy u kogo" na karcie vendora. Pominięcie OK dla wydatków poza kontrahentami (np. Obrączki, Alkohol). |
| description     | text                                                           | NO   |                      | Inferred    | "Edytuj wiersz" w prompt-prototyp-ui sugeruje opis                      |
| amount          | numeric(12,2)                                                  | NO   |                      | Observed    | Kwota wydatku                                                          |
| spent_on        | date                                                           | NO   |                      | Inferred    | Data wydatku                                                           |
| created_at      | timestamptz                                                    | NO   | `now()`              | Recommended |                                                                        |
| updated_at      | timestamptz                                                    | NO   | `now()`              | Recommended |                                                                        |

Indexes: `category_id`, `wedding_id`, `(wedding_id, spent_on desc)`, `vendor_id` (dla agregatu per-vendor).

### `tasks`

| Column           | Type                                                                                     | Null | Default              | Confidence | Notes                          |
| ---------------- | ---------------------------------------------------------------------------------------- | ---- | -------------------- | ---------- | ------------------------------ |
| id               | uuid PK                                                                                  | NO   | `gen_random_uuid()`  | Observed   |                                |
| wedding_id       | uuid FK → weddings(id) ON DELETE CASCADE                                                 | NO   |                      | Inferred   |                                |
| title            | text                                                                                     | NO   |                      | Observed   | "Wybór menu z cateringiem"     |
| description      | text                                                                                     | YES  |                      | Inferred   | Pole modala "Dodaj zadanie"    |
| category         | text CHECK (category IN ('stroj','kontrahent','goscie','formalnosci','inne'))            | NO   |                      | Observed   | 5 kategorii widocznych jako badge |
| due_date         | date                                                                                     | NO   |                      | Observed   |                                |
| done             | boolean                                                                                  | NO   | `false`              | Observed   | Checkbox w wierszu             |
| done_at          | timestamptz                                                                              | YES  |                      | Inferred   |                                |
| is_auto          | boolean                                                                                  | NO   | `false`              | Observed   | Badge "auto"                   |
| template_id      | uuid FK → task_templates(id) ON DELETE SET NULL                                          | YES  |                      | Inferred   | Tylko dla `is_auto=true`       |
| created_at       | timestamptz                                                                              | NO   | `now()`              | Recommended|                                |
| updated_at       | timestamptz                                                                              | NO   | `now()`              | Recommended|                                |

Indexes: `wedding_id`, `(wedding_id, done, due_date)`, `(wedding_id, due_date)`.

### `task_templates`

Globalna tabela (poza weselem) — zestaw "checkpointów" do auto-generowania zadań.

| Column                | Type                                                                          | Null | Default | Confidence | Notes                                       |
| --------------------- | ----------------------------------------------------------------------------- | ---- | ------- | ---------- | ------------------------------------------- |
| id                    | uuid PK                                                                       | NO   |         | Inferred   |                                             |
| title                 | text                                                                          | NO   |         | Observed   | "Spotkanie z DJ-em — wybór wykonawcy"       |
| category              | text CHECK (category IN ('stroj','kontrahent','goscie','formalnosci','inne'))| NO   |         | Observed   |                                             |
| days_before_wedding   | integer                                                                       | NO   |         | Observed   | "8 mc przed" → ~240 dni                     |
| sort_order            | integer                                                                       | NO   | `0`     | Recommended|                                             |
| created_at            | timestamptz                                                                   | NO   | `now()` | Recommended|                                             |

### `tables` (rozsadzenie — stoły)

| Column         | Type                                                | Null | Default              | Confidence | Notes                          |
| -------------- | --------------------------------------------------- | ---- | -------------------- | ---------- | ------------------------------ |
| id             | uuid PK                                             | NO   | `gen_random_uuid()`  | Observed   |                                |
| wedding_id     | uuid FK → weddings(id) ON DELETE CASCADE            | NO   |                      | Inferred   |                                |
| name           | text                                                | NO   |                      | Observed   | "Stół 1", "Stół 2", …          |
| seats_count    | integer CHECK (seats_count BETWEEN 1 AND 24)        | NO   | `8`                  | Observed   | "8 miejsc / stół" w toolbarze  |
| sort_order     | integer                                             | NO   | `0`                  | Recommended| Pozycja w gridzie              |
| position_x     | integer                                             | YES  |                      | Recommended| Dla manual layout (free-canvas) |
| position_y     | integer                                             | YES  |                      | Recommended|                                |
| created_at     | timestamptz                                         | NO   | `now()`              | Recommended|                                |
| updated_at     | timestamptz                                         | NO   | `now()`              | Recommended|                                |

Indexes: `wedding_id`, `(wedding_id, sort_order)`.

### `seating_conflicts`

| Column        | Type                                                                       | Null | Default              | Confidence | Notes                          |
| ------------- | -------------------------------------------------------------------------- | ---- | -------------------- | ---------- | ------------------------------ |
| id            | uuid PK                                                                    | NO   | `gen_random_uuid()`  | Observed   |                                |
| wedding_id    | uuid FK → weddings(id) ON DELETE CASCADE                                   | NO   |                      | Inferred   |                                |
| guest_a_id    | uuid FK → guests(id) ON DELETE CASCADE                                     | NO   |                      | Observed   |                                |
| guest_b_id    | uuid FK → guests(id) ON DELETE CASCADE                                     | NO   |                      | Observed   | CHECK guest_a_id <> guest_b_id |
| reason        | text                                                                       | NO   |                      | Observed   | "Były związek", "Konflikt rodzinny", "Nie znoszą się" |
| created_at    | timestamptz                                                                | NO   | `now()`              | Recommended|                                |

Constraint: `CHECK (guest_a_id <> guest_b_id)`, oraz unikalność pary niezależnie od kolejności (po stronie aplikacji albo `LEAST/GREATEST` w unique index).
Indexes: `wedding_id`, `guest_a_id`, `guest_b_id`.

### `meetings` (Nadchodzące spotkania)

Inferowane z sekcji "Nadchodzące spotkania" na Dashboardzie i z auto-tasków typu "Spotkanie z DJ-em".

| Column        | Type                                                                | Null | Default              | Confidence | Notes                                  |
| ------------- | ------------------------------------------------------------------- | ---- | -------------------- | ---------- | -------------------------------------- |
| id            | uuid PK                                                             | NO   | `gen_random_uuid()`  | Inferred   |                                        |
| wedding_id    | uuid FK → weddings(id) ON DELETE CASCADE                            | NO   |                      | Inferred   |                                        |
| vendor_id     | uuid FK → vendors(id) ON DELETE SET NULL                            | YES  |                      | Inferred   | "DJ Kowalski, Kraków" — może też być NULL gdy spotkanie z usługą poza systemem (np. "Próba sukni · Atelier Bianca", gdzie atelier nie jest jeszcze wpisane w `vendors`) |
| title         | text                                                                | NO   |                      | Observed   | "Spotkanie z DJ-em"                    |
| starts_at     | timestamptz                                                         | NO   |                      | Observed   | "07.05.2026 17:00"                     |
| location      | text                                                                | YES  |                      | Observed   | "DJ Kowalski, Kraków"                  |
| notes         | text                                                                | YES  |                      | Recommended| Krótka notka (np. "Wziąć materiały referencyjne") — brak w UI prototypu, ale wartościowe w produkcji |
| created_at    | timestamptz                                                         | NO   | `now()`              | Recommended|                                        |
| updated_at    | timestamptz                                                         | NO   | `now()`              | Recommended|                                        |

Indexes: `(wedding_id, starts_at)`, `vendor_id`.

### `meal_options`

Lista dań do wyboru przez gości — definiowana per-wesele przez parę. Pozwala uniknąć enum'a w bazie i daje elastyczność (jedna para serwuje "Schab/Łosoś/Wegański", inna "Roladę/Pierogi/Tatar").

| Column        | Type                                                                | Null | Default              | Confidence  | Notes                                          |
| ------------- | ------------------------------------------------------------------- | ---- | -------------------- | ----------- | ---------------------------------------------- |
| id            | uuid PK                                                             | NO   | `gen_random_uuid()`  | Recommended |                                                |
| wedding_id    | uuid FK → weddings(id) ON DELETE CASCADE                            | NO   |                      | Recommended |                                                |
| label         | text                                                                | NO   |                      | Recommended | "Schab tradycyjny", "Łosoś z koprem", "Wegański" |
| sort_order    | integer                                                             | NO   | `0`                  | Recommended | Kolejność w dropdown                           |
| created_at    | timestamptz                                                         | NO   | `now()`              | Recommended |                                                |
| updated_at    | timestamptz                                                         | NO   | `now()`              | Recommended |                                                |

Constraint: `UNIQUE(wedding_id, label)`.
Indexes: `(wedding_id, sort_order)`.

> **Decyzja produktowa**: opcje są zdefiniowane przez parę, a nie zaszyte w kodzie. Gość wybiera z listy (FK `guests.meal_option_id`) lub zostawia `NULL` ("nie wybrał dania" — KPI pokazuje 14 takich osób). W większości przypadków `meal_options` jest **wypełniane automatycznie** z konfiguratora cateringu — patrz sekcja niżej (`/sync-meal-options`).

### Catering offer (oferta sali / cateringu)

Cała ta podsekcja modeluje **konfigurator oferty cateringowej** — uniwersalny w tym sensie, że każda para wprowadza ofertę swojej sali (nie ma globalnej bazy ofert). Wzorcem przy projektowaniu była realna oferta z PDF (Pałac Polanka 2026: 4 pakiety cenowe, ~50 dań, dodatki płatne), ale schemat pokrywa dowolne podobne oferty.

#### `catering_offers`

Pojedyncza oferta od konkretnej sali / cateringu. Para może mieć kilka ofert do porównania, ale tylko jedną aktywnie wybraną (`wedding_catering_selection.catering_package_id` referuje do pakietu z **jednej** oferty).

| Column          | Type                                                | Null | Default              | Confidence  | Notes                                                       |
| --------------- | --------------------------------------------------- | ---- | -------------------- | ----------- | ----------------------------------------------------------- |
| id              | uuid PK                                             | NO   | `gen_random_uuid()`  | Recommended |                                                             |
| wedding_id      | uuid FK → weddings(id) ON DELETE CASCADE            | NO   |                      | Recommended |                                                             |
| vendor_id       | uuid FK → vendors(id) ON DELETE SET NULL            | YES  |                      | Recommended | Opcjonalny link do `vendors` (kategoria `sala` lub `catering`); pomocny przy autopopulacji `contract_amount` |
| name            | text                                                | NO   |                      | Recommended | "Pałac Polanka 2026", "Restauracja Maja — wiosna 2026"       |
| valid_through   | date                                                | YES  |                      | Recommended | Termin ważności cennika                                      |
| notes           | text                                                | YES  |                      | Recommended | Notatki pary (np. "Cena nie zawiera napojów alkoholowych")   |
| created_at      | timestamptz                                         | NO   | `now()`              | Recommended |                                                             |
| updated_at      | timestamptz                                         | NO   | `now()`              | Recommended |                                                             |

Indexes: `wedding_id`, `vendor_id`.

#### `catering_packages`

Tier cenowy w ramach oferty (np. Szefa Kuchni / Srebrny / Złoty / Diamentowy).

| Column                | Type                                                       | Null | Default              | Confidence  | Notes                                                       |
| --------------------- | ---------------------------------------------------------- | ---- | -------------------- | ----------- | ----------------------------------------------------------- |
| id                    | uuid PK                                                    | NO   | `gen_random_uuid()`  | Recommended |                                                             |
| catering_offer_id     | uuid FK → catering_offers(id) ON DELETE CASCADE            | NO   |                      | Recommended |                                                             |
| name                  | text                                                       | NO   |                      | Recommended | "Pakiet Złoty"                                              |
| price_per_person      | numeric(12,2)                                              | NO   |                      | Recommended | 374.00                                                      |
| is_modifiable         | boolean                                                    | NO   | `true`               | Recommended | `false` dla pakietów typu "menu nie podlega modyfikacjom" (Pakiet Szefa Kuchni). Wtedy `selection_mode` we wszystkich `catering_courses` jest ignorowane na froncie — cały zestaw jest narzucony. |
| description           | text                                                       | YES  |                      | Recommended | Krótki opis sprzedażowy                                     |
| sort_order            | integer                                                    | NO   | `0`                  | Recommended |                                                             |
| created_at            | timestamptz                                                | NO   | `now()`              | Recommended |                                                             |
| updated_at            | timestamptz                                                | NO   | `now()`              | Recommended |                                                             |

Constraint: `UNIQUE(catering_offer_id, name)`.
Indexes: `catering_offer_id`.

#### `catering_courses`

Sekcja w pakiecie (np. "I Kolacja", "Bufet zimny", "Surówki"). Każdy pakiet ma 5-12 sekcji.

| Column                | Type                                                                                                   | Null | Default              | Confidence  | Notes                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------ | ---- | -------------------- | ----------- | ----------------------------------------------------------- |
| id                    | uuid PK                                                                                                | NO   | `gen_random_uuid()`  | Recommended |                                                             |
| catering_package_id   | uuid FK → catering_packages(id) ON DELETE CASCADE                                                      | NO   |                      | Recommended |                                                             |
| course_type           | text CHECK (course_type IN ('obiad_zupa','obiad_danie_glowne','obiad_deser','przystawka','kolacja_ciepla','deser_serwowany','bufet_zimny','bufet_salatkowy','dodatki','surowki','wiejski_stol','slodki_stol','napoje','inne')) | NO   |                      | Recommended | Semantyka sekcji — używana przez UI do ikony/koloru |
| title                 | text                                                                                                   | NO   |                      | Recommended | "I Kolacja", "Bufet zimny (8 pozycji do wyboru)"            |
| selection_mode        | text CHECK (selection_mode IN ('all_served','couple_picks','guest_picks'))                            | NO   | `'couple_picks'`     | Recommended | `all_served`=wszystko z listy serwowane (np. zupa zaszyta); `couple_picks`=para wybiera N pozycji (bufet, serwowane wieloporcjowo); `guest_picks`=każdy gość wybiera 1 (synchronizowane z `meal_options`) |
| choice_limit          | smallint                                                                                               | YES  |                      | Recommended | Wymagane dla `couple_picks` (ile sztuk para wybiera, np. 8 dla bufetu) i `guest_picks` (zwykle 1). NULL dla `all_served`. |
| sort_order            | integer                                                                                                | NO   | `0`                  | Recommended |                                                             |
| created_at            | timestamptz                                                                                            | NO   | `now()`              | Recommended |                                                             |
| updated_at            | timestamptz                                                                                            | NO   | `now()`              | Recommended |                                                             |

Constraint: `CHECK ((selection_mode = 'all_served') = (choice_limit IS NULL))` — `choice_limit` musi istnieć dla pick-modes i być NULL dla all_served.
Indexes: `(catering_package_id, sort_order)`.

#### `catering_dishes`

Biblioteka dań w obrębie oferty. Jedno danie może występować w wielu sekcjach pakietu (np. "Domowy rosół" w Obiad/Zupa Pakietu Srebrnego i Złotego).

| Column            | Type                                                  | Null | Default              | Confidence  | Notes                                                       |
| ----------------- | ----------------------------------------------------- | ---- | -------------------- | ----------- | ----------------------------------------------------------- |
| id                | uuid PK                                               | NO   | `gen_random_uuid()`  | Recommended |                                                             |
| catering_offer_id | uuid FK → catering_offers(id) ON DELETE CASCADE       | NO   |                      | Recommended |                                                             |
| name              | text                                                  | NO   |                      | Recommended | "Domowy rosół z makaronem, marchewką i natką pietruszki"     |
| description       | text                                                  | YES  |                      | Recommended | Dłuższy opis jeśli potrzebny                                 |
| is_vegetarian     | boolean                                               | NO   | `false`              | Recommended | Dla filtrów dietowych                                        |
| is_vegan          | boolean                                               | NO   | `false`              | Recommended |                                                             |
| is_gluten_free    | boolean                                               | NO   | `false`              | Recommended |                                                             |
| allergens         | text[]                                                | YES  |                      | Recommended | Lista alergenów (np. `{'orzechy','laktoza'}`); strukturalnie elastyczne |
| created_at        | timestamptz                                           | NO   | `now()`              | Recommended |                                                             |
| updated_at        | timestamptz                                           | NO   | `now()`              | Recommended |                                                             |

Constraint: `UNIQUE(catering_offer_id, name)`.
Indexes: `catering_offer_id`, GIN index na `allergens` jeśli filtrujemy po alergenach.

#### `catering_course_dishes` (junction)

Które dania są dostępne w której sekcji którego pakietu.

| Column                | Type                                                       | Null | Default | Confidence  | Notes |
| --------------------- | ---------------------------------------------------------- | ---- | ------- | ----------- | ----- |
| catering_course_id    | uuid FK → catering_courses(id) ON DELETE CASCADE           | NO   |         | Recommended |       |
| catering_dish_id      | uuid FK → catering_dishes(id) ON DELETE CASCADE            | NO   |         | Recommended |       |
| sort_order            | integer                                                    | NO   | `0`     | Recommended |       |

Primary key: `(catering_course_id, catering_dish_id)`.
Indexes: `catering_dish_id` (reverse lookup — w jakich sekcjach dane danie się pojawia).

> Walidacja "dish.catering_offer_id == course.package.offer_id" jest po stronie aplikacji albo trigger PG (analogicznie do `seating_conflicts`).

#### `catering_addons`

Płatne dodatki do oferty (Pokrowce, Korkowe, Wiejski stół, Słodki stół, Napoje gazowane).

| Column            | Type                                                                                  | Null | Default              | Confidence  | Notes                                                       |
| ----------------- | ------------------------------------------------------------------------------------- | ---- | -------------------- | ----------- | ----------------------------------------------------------- |
| id                | uuid PK                                                                               | NO   | `gen_random_uuid()`  | Recommended |                                                             |
| catering_offer_id | uuid FK → catering_offers(id) ON DELETE CASCADE                                       | NO   |                      | Recommended |                                                             |
| name              | text                                                                                  | NO   |                      | Recommended | "Pokrowce na krzesła"                                        |
| price             | numeric(12,2)                                                                         | NO   |                      | Recommended | Wartość bazowa (do pomnożenia przez quantity albo guest_count) |
| pricing_unit      | text CHECK (pricing_unit IN ('per_person','per_event','per_bottle','per_hour','per_unit')) | NO   | `'per_event'`        | Recommended | Decyduje jak liczyć: per_person × guest_count, per_bottle × ile butelek, per_event = stała kwota |
| description       | text                                                                                  | YES  |                      | Recommended |                                                             |
| sort_order        | integer                                                                               | NO   | `0`                  | Recommended |                                                             |
| created_at        | timestamptz                                                                           | NO   | `now()`              | Recommended |                                                             |
| updated_at        | timestamptz                                                                           | NO   | `now()`              | Recommended |                                                             |

Constraint: `UNIQUE(catering_offer_id, name)`.
Indexes: `catering_offer_id`.

#### `wedding_catering_selection`

Aktywny wybór pary — który pakiet, ile gości w kalkulacji, opcjonalnie linki do wybranych dań i dodatków.

| Column                | Type                                                       | Null | Default              | Confidence  | Notes                                                       |
| --------------------- | ---------------------------------------------------------- | ---- | -------------------- | ----------- | ----------------------------------------------------------- |
| id                    | uuid PK                                                    | NO   | `gen_random_uuid()`  | Recommended |                                                             |
| wedding_id            | uuid FK → weddings(id) ON DELETE CASCADE UNIQUE            | NO   |                      | Recommended | 1:1 — para ma maksymalnie jeden aktywny wybór              |
| catering_package_id   | uuid FK → catering_packages(id) ON DELETE RESTRICT         | NO   |                      | Recommended | Pakiet musi pochodzić z `catering_offers.wedding_id == this.wedding_id` (constraint trigger) |
| guest_count_estimate  | integer CHECK (guest_count_estimate >= 0)                  | NO   |                      | Recommended | Z prototypu KPI: 127 zaproszonych. Tu para wpisuje realny szacunek do mnożenia (np. 100). |
| notes                 | text                                                       | YES  |                      | Recommended |                                                             |
| created_at            | timestamptz                                                | NO   | `now()`              | Recommended |                                                             |
| updated_at            | timestamptz                                                | NO   | `now()`              | Recommended |                                                             |

Indexes: `wedding_id` (unique), `catering_package_id`.

#### `wedding_catering_dish_picks` (junction)

Dla każdej `catering_courses` w wybranym pakiecie — które dania para wybrała (musi się zgadzać z `course.choice_limit`, walidacja w aplikacji).

| Column                          | Type                                                                  | Null | Default | Confidence  | Notes |
| ------------------------------- | --------------------------------------------------------------------- | ---- | ------- | ----------- | ----- |
| wedding_catering_selection_id   | uuid FK → wedding_catering_selection(id) ON DELETE CASCADE            | NO   |         | Recommended |       |
| catering_course_id              | uuid FK → catering_courses(id) ON DELETE CASCADE                      | NO   |         | Recommended |       |
| catering_dish_id                | uuid FK → catering_dishes(id) ON DELETE CASCADE                       | NO   |         | Recommended |       |

Primary key: `(wedding_catering_selection_id, catering_course_id, catering_dish_id)`.
Indexes: `catering_course_id`, `catering_dish_id`.

> Trigger `enforce_catering_pick_consistency()` sprawdza, że (a) `course` należy do tego samego pakietu co `selection.catering_package_id`, (b) `dish` jest w `catering_course_dishes` dla danego course'a.

#### `wedding_catering_addon_picks` (junction)

Wybrane dodatki płatne + ile.

| Column                          | Type                                                                  | Null | Default | Confidence  | Notes                                                       |
| ------------------------------- | --------------------------------------------------------------------- | ---- | ------- | ----------- | ----------------------------------------------------------- |
| wedding_catering_selection_id   | uuid FK → wedding_catering_selection(id) ON DELETE CASCADE            | NO   |         | Recommended |                                                             |
| catering_addon_id               | uuid FK → catering_addons(id) ON DELETE CASCADE                       | NO   |         | Recommended |                                                             |
| quantity                        | integer CHECK (quantity > 0)                                          | NO   | `1`     | Recommended | Dla `pricing_unit='per_bottle'`: 50 butelek; dla `per_event`: zwykle 1 |

Primary key: `(wedding_catering_selection_id, catering_addon_id)`.

#### Powiązanie z `contracts` (umowa z salą)

Po podpisaniu umowy z salą, `wedding_catering_selection` staje się "snapshot" tego, co jest w umowie. Dorzucamy nullable kolumnę:

```sql
ALTER TABLE contracts
  ADD COLUMN wedding_catering_selection_id uuid REFERENCES wedding_catering_selection(id) ON DELETE SET NULL;
```

W ten sposób:
- Dopóki para tylko planuje → `wedding_catering_selection` żyje samodzielnie, brak `contract`.
- Po podpisaniu umowy → backend tworzy `contract` z `total_amount = computed_price(selection)` i ustawia link.
- Późniejsza zmiana wyboru: jeśli kontrakt już istnieje, ostrzeżenie ("Twoja umowa nie odzwierciedla aktualnego wyboru"). Praktycznie obsłużone w backend service.

#### Wyliczenie ceny

Backend wystawia funkcję pomocniczą (TypeScript service lub PG function):

```
total_price(selection) =
    package.price_per_person × selection.guest_count_estimate
  + Σ (addon.price × addon_pick.quantity × multiplier_for_unit)

multiplier_for_unit:
  per_person  → guest_count_estimate
  per_bottle  → 1 (quantity już oznacza liczbę butelek)
  per_event   → 1
  per_hour    → 1
  per_unit    → 1
```

Wynik zasila `budget_categories` ("Catering" / "Sala") jako `reservedFromContracts` po podpisaniu umowy, a w międzyczasie jako "wstępna rezerwacja" widoczna w Budżecie.

---

## Full DDL

```sql
-- Run in this order to satisfy FK dependencies.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- 1) Auth
CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           citext NOT NULL UNIQUE,
  password_hash   text NOT NULL,
  first_name      text,
  last_name       text,
  email_verified  boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 2) Wedding & members
CREATE TABLE weddings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_a_name        text NOT NULL,
  partner_b_name        text NOT NULL,
  wedding_date          date NOT NULL,
  ceremony_location     text,
  created_by_user_id    uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_weddings_wedding_date ON weddings(wedding_date);
CREATE INDEX idx_weddings_created_by_user_id ON weddings(created_by_user_id);

CREATE TABLE wedding_members (
  wedding_id   uuid NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  role         text NOT NULL CHECK (role IN ('partner_a','partner_b')),
  linked_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (wedding_id, user_id),
  UNIQUE (user_id),
  UNIQUE (wedding_id, role)
);

CREATE TABLE partner_invitations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id           uuid NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  invited_by_user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email                citext NOT NULL,
  token                text NOT NULL UNIQUE,
  status               text NOT NULL DEFAULT 'pending' CHECK (status IN
    ('pending','accepted','declined','expired')),
  expires_at           timestamptz NOT NULL,
  accepted_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wedding_id, email)
);
CREATE INDEX idx_partner_invitations_wedding_status ON partner_invitations(wedding_id, status);
CREATE INDEX idx_partner_invitations_expires_at ON partner_invitations(expires_at);

-- 3) Vendors & contracts (vendors before tables because nothing depends on tables yet)
CREATE TABLE vendors (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id        uuid NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  category          text NOT NULL CHECK (category IN
    ('sala','catering','fotograf','dj','dekoratorka','kosciol','makijaz','dekoracje','slodki_stol_tort','ciasta_pozegnalne')),
  company_name      text NOT NULL,
  contact_person    text,
  phone             text,
  email             text,
  status            text NOT NULL DEFAULT 'rozwazany' CHECK (status IN
    ('rozwazany','spotkanie','zarezerwowany','zaplacony','wykonany')),
  contract_amount   numeric(12,2),
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vendors_wedding_id ON vendors(wedding_id);
CREATE INDEX idx_vendors_status ON vendors(wedding_id, status);
CREATE INDEX idx_vendors_category ON vendors(wedding_id, category);

CREATE TABLE contracts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id   uuid NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  vendor_id    uuid NOT NULL UNIQUE REFERENCES vendors(id) ON DELETE CASCADE,
  total_amount numeric(12,2) NOT NULL,
  signed_date  date,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN
    ('pending','in_progress','deposit_paid','paid_in_full')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_contracts_wedding_id ON contracts(wedding_id);

CREATE TABLE payments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id   uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('zaliczka','rata','final','ofiara')),
  due_date      date NOT NULL,
  amount        numeric(12,2) NOT NULL,
  status        text NOT NULL DEFAULT 'planned' CHECK (status IN
    ('planned','paid','overdue')),
  paid_at       date,
  method        text NOT NULL DEFAULT 'przelew' CHECK (method IN ('gotowka','przelew')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_contract_id ON payments(contract_id);
CREATE INDEX idx_payments_due_date ON payments(due_date);

-- 4) Tables (seating) — needed before guests because guests.table_id references it
CREATE TABLE tables (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id    uuid NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  name          text NOT NULL,
  seats_count   integer NOT NULL DEFAULT 8 CHECK (seats_count BETWEEN 1 AND 24),
  sort_order    integer NOT NULL DEFAULT 0,
  position_x    integer,
  position_y    integer,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tables_wedding_id ON tables(wedding_id);

-- 5) Meal options (must come before guests because guests.meal_option_id references it)
CREATE TABLE meal_options (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id    uuid NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  label         text NOT NULL,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wedding_id, label)
);
CREATE INDEX idx_meal_options_wedding_sort ON meal_options(wedding_id, sort_order);

-- 6) Guests
CREATE TABLE guests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id      uuid NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  first_name      text NOT NULL,
  last_name       text NOT NULL,
  relation        text NOT NULL CHECK (relation IN
    ('rodzina_panny_mlodej','rodzina_pana_mlodego',
     'przyjaciele_panny_mlodej','przyjaciele_pana_mlodego',
     'znajomi_z_pracy','wspolni_znajomi')),
  rsvp_status     text NOT NULL DEFAULT 'pending' CHECK (rsvp_status IN
    ('pending','confirmed','declined')),
  diet            text NOT NULL DEFAULT 'pending' CHECK (diet IN
    ('pending','standard','vege','vegan','gluten_free')),
  has_plus_one    boolean NOT NULL DEFAULT false,
  is_child        boolean NOT NULL DEFAULT false,
  meal_option_id  uuid REFERENCES meal_options(id) ON DELETE SET NULL,
  table_id        uuid REFERENCES tables(id) ON DELETE SET NULL,
  contact_phone   text,
  contact_email   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_guests_wedding_id ON guests(wedding_id);
CREATE INDEX idx_guests_rsvp ON guests(wedding_id, rsvp_status);
CREATE INDEX idx_guests_relation ON guests(wedding_id, relation);
CREATE INDEX idx_guests_table ON guests(wedding_id, table_id);
CREATE INDEX idx_guests_meal_option ON guests(meal_option_id) WHERE meal_option_id IS NOT NULL;

-- 7) Seating conflicts
CREATE TABLE seating_conflicts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id    uuid NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  guest_a_id    uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  guest_b_id    uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  reason        text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (guest_a_id <> guest_b_id)
);
CREATE UNIQUE INDEX uq_seating_conflicts_pair
  ON seating_conflicts(wedding_id, LEAST(guest_a_id, guest_b_id), GREATEST(guest_a_id, guest_b_id));

-- 8) Budget
CREATE TABLE budget_categories (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id        uuid NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  name              text NOT NULL,
  planned_amount    numeric(12,2) NOT NULL DEFAULT 0,
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wedding_id, name)
);
CREATE INDEX idx_budget_categories_wedding_id ON budget_categories(wedding_id);

CREATE TABLE expenses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id    uuid NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  category_id   uuid NOT NULL REFERENCES budget_categories(id) ON DELETE CASCADE,
  vendor_id     uuid REFERENCES vendors(id) ON DELETE SET NULL,
  description   text NOT NULL,
  amount        numeric(12,2) NOT NULL,
  spent_on      date NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_category_id ON expenses(category_id);
CREATE INDEX idx_expenses_wedding_recent ON expenses(wedding_id, spent_on DESC);
CREATE INDEX idx_expenses_vendor_id ON expenses(vendor_id) WHERE vendor_id IS NOT NULL;

-- 9) Tasks (with templates)
CREATE TABLE task_templates (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 text NOT NULL,
  category              text NOT NULL CHECK (category IN
    ('stroj','kontrahent','goscie','formalnosci','inne')),
  days_before_wedding   integer NOT NULL,
  sort_order            integer NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id    uuid NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  category      text NOT NULL CHECK (category IN
    ('stroj','kontrahent','goscie','formalnosci','inne')),
  due_date      date NOT NULL,
  done          boolean NOT NULL DEFAULT false,
  done_at       timestamptz,
  is_auto       boolean NOT NULL DEFAULT false,
  template_id   uuid REFERENCES task_templates(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_wedding_id ON tasks(wedding_id);
CREATE INDEX idx_tasks_pending ON tasks(wedding_id, done, due_date);

-- 10) Meetings
CREATE TABLE meetings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id   uuid NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  vendor_id    uuid REFERENCES vendors(id) ON DELETE SET NULL,
  title        text NOT NULL,
  starts_at    timestamptz NOT NULL,
  location     text,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_meetings_wedding_starts ON meetings(wedding_id, starts_at);
CREATE INDEX idx_meetings_vendor_id ON meetings(vendor_id) WHERE vendor_id IS NOT NULL;

-- 11) Catering offer (oferta sali / cateringu)
CREATE TABLE catering_offers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id      uuid NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  vendor_id       uuid REFERENCES vendors(id) ON DELETE SET NULL,
  name            text NOT NULL,
  valid_through   date,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_catering_offers_wedding_id ON catering_offers(wedding_id);
CREATE INDEX idx_catering_offers_vendor_id ON catering_offers(vendor_id) WHERE vendor_id IS NOT NULL;

CREATE TABLE catering_packages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catering_offer_id   uuid NOT NULL REFERENCES catering_offers(id) ON DELETE CASCADE,
  name                text NOT NULL,
  price_per_person    numeric(12,2) NOT NULL,
  is_modifiable       boolean NOT NULL DEFAULT true,
  description         text,
  sort_order          integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (catering_offer_id, name)
);
CREATE INDEX idx_catering_packages_offer_id ON catering_packages(catering_offer_id);

CREATE TABLE catering_courses (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catering_package_id   uuid NOT NULL REFERENCES catering_packages(id) ON DELETE CASCADE,
  course_type           text NOT NULL CHECK (course_type IN
    ('obiad_zupa','obiad_danie_glowne','obiad_deser','przystawka','kolacja_ciepla',
     'deser_serwowany','bufet_zimny','bufet_salatkowy','dodatki','surowki',
     'wiejski_stol','slodki_stol','napoje','inne')),
  title                 text NOT NULL,
  selection_mode        text NOT NULL DEFAULT 'couple_picks' CHECK (selection_mode IN
    ('all_served','couple_picks','guest_picks')),
  choice_limit          smallint,
  sort_order            integer NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CHECK ((selection_mode = 'all_served') = (choice_limit IS NULL)),
  CHECK (choice_limit IS NULL OR choice_limit > 0)
);
CREATE INDEX idx_catering_courses_package_sort ON catering_courses(catering_package_id, sort_order);

CREATE TABLE catering_dishes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catering_offer_id   uuid NOT NULL REFERENCES catering_offers(id) ON DELETE CASCADE,
  name                text NOT NULL,
  description         text,
  is_vegetarian       boolean NOT NULL DEFAULT false,
  is_vegan            boolean NOT NULL DEFAULT false,
  is_gluten_free      boolean NOT NULL DEFAULT false,
  allergens           text[],
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (catering_offer_id, name)
);
CREATE INDEX idx_catering_dishes_offer_id ON catering_dishes(catering_offer_id);
CREATE INDEX idx_catering_dishes_allergens ON catering_dishes USING gin(allergens) WHERE allergens IS NOT NULL;

CREATE TABLE catering_course_dishes (
  catering_course_id   uuid NOT NULL REFERENCES catering_courses(id) ON DELETE CASCADE,
  catering_dish_id     uuid NOT NULL REFERENCES catering_dishes(id) ON DELETE CASCADE,
  sort_order           integer NOT NULL DEFAULT 0,
  PRIMARY KEY (catering_course_id, catering_dish_id)
);
CREATE INDEX idx_catering_course_dishes_dish_id ON catering_course_dishes(catering_dish_id);

CREATE TABLE catering_addons (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catering_offer_id   uuid NOT NULL REFERENCES catering_offers(id) ON DELETE CASCADE,
  name                text NOT NULL,
  price               numeric(12,2) NOT NULL,
  pricing_unit        text NOT NULL DEFAULT 'per_event' CHECK (pricing_unit IN
    ('per_person','per_event','per_bottle','per_hour','per_unit')),
  description         text,
  sort_order          integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (catering_offer_id, name)
);
CREATE INDEX idx_catering_addons_offer_id ON catering_addons(catering_offer_id);

CREATE TABLE wedding_catering_selection (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id            uuid NOT NULL UNIQUE REFERENCES weddings(id) ON DELETE CASCADE,
  catering_package_id   uuid NOT NULL REFERENCES catering_packages(id) ON DELETE RESTRICT,
  guest_count_estimate  integer NOT NULL CHECK (guest_count_estimate >= 0),
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wedding_catering_selection_package ON wedding_catering_selection(catering_package_id);

CREATE TABLE wedding_catering_dish_picks (
  wedding_catering_selection_id   uuid NOT NULL REFERENCES wedding_catering_selection(id) ON DELETE CASCADE,
  catering_course_id              uuid NOT NULL REFERENCES catering_courses(id) ON DELETE CASCADE,
  catering_dish_id                uuid NOT NULL REFERENCES catering_dishes(id) ON DELETE CASCADE,
  PRIMARY KEY (wedding_catering_selection_id, catering_course_id, catering_dish_id)
);
CREATE INDEX idx_wcdp_course ON wedding_catering_dish_picks(catering_course_id);
CREATE INDEX idx_wcdp_dish ON wedding_catering_dish_picks(catering_dish_id);

CREATE TABLE wedding_catering_addon_picks (
  wedding_catering_selection_id   uuid NOT NULL REFERENCES wedding_catering_selection(id) ON DELETE CASCADE,
  catering_addon_id               uuid NOT NULL REFERENCES catering_addons(id) ON DELETE CASCADE,
  quantity                        integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  PRIMARY KEY (wedding_catering_selection_id, catering_addon_id)
);

-- 12) Link contracts → catering selection (snapshot po podpisaniu umowy z salą)
ALTER TABLE contracts
  ADD COLUMN wedding_catering_selection_id uuid REFERENCES wedding_catering_selection(id) ON DELETE SET NULL;
CREATE INDEX idx_contracts_catering_selection ON contracts(wedding_catering_selection_id) WHERE wedding_catering_selection_id IS NOT NULL;
```

---

## Triggers & functions

### `updated_at` auto-bump

Wszystkie tabele z kolumną `updated_at` korzystają z jednego triggera:

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Apply to every table with updated_at:
CREATE TRIGGER tg_users_updated_at         BEFORE UPDATE ON users         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tg_weddings_updated_at      BEFORE UPDATE ON weddings      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tg_guests_updated_at        BEFORE UPDATE ON guests        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tg_vendors_updated_at       BEFORE UPDATE ON vendors       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tg_contracts_updated_at     BEFORE UPDATE ON contracts     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tg_payments_updated_at      BEFORE UPDATE ON payments      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tg_budget_cats_updated_at   BEFORE UPDATE ON budget_categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tg_expenses_updated_at      BEFORE UPDATE ON expenses      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tg_tasks_updated_at         BEFORE UPDATE ON tasks         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tg_tables_updated_at        BEFORE UPDATE ON tables        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tg_meetings_updated_at      BEFORE UPDATE ON meetings      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tg_meal_options_updated_at  BEFORE UPDATE ON meal_options  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tg_catering_offers_updated_at        BEFORE UPDATE ON catering_offers              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tg_catering_packages_updated_at      BEFORE UPDATE ON catering_packages            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tg_catering_courses_updated_at       BEFORE UPDATE ON catering_courses             FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tg_catering_dishes_updated_at        BEFORE UPDATE ON catering_dishes              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tg_catering_addons_updated_at        BEFORE UPDATE ON catering_addons              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tg_wedding_catering_selection_updated_at BEFORE UPDATE ON wedding_catering_selection FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### Auto-timeline regeneracja

Gdy para zmienia datę ślubu, niedokończone auto-zadania (`is_auto=true AND done=false`) muszą się przesunąć o tyle samo dni, co data ślubu — z zachowaniem `days_before_wedding` z templatu.

```sql
CREATE OR REPLACE FUNCTION shift_auto_tasks_on_wedding_date_change()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  shift_days integer;
BEGIN
  IF NEW.wedding_date IS DISTINCT FROM OLD.wedding_date THEN
    shift_days := NEW.wedding_date - OLD.wedding_date;
    UPDATE tasks
    SET due_date = due_date + shift_days
    WHERE wedding_id = NEW.id
      AND is_auto = true
      AND done = false;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_weddings_shift_auto_tasks
  AFTER UPDATE OF wedding_date ON weddings
  FOR EACH ROW EXECUTE FUNCTION shift_auto_tasks_on_wedding_date_change();
```

> **Uzasadnienie**: ukończonych zadań nie ruszamy (są historią). Manualne zadania (`is_auto=false`) też nie — para mogła je powiązać z konkretnym terminem (np. "Telefon do księdza 11.05"). Endpoint `POST /tasks/regenerate-auto` daje force-mode dla edge case'ów.

### `seating_conflicts` consistency check

Zapewnia, że obu gości pochodzi z tego samego wesela co konflikt:

```sql
CREATE OR REPLACE FUNCTION enforce_seating_conflict_wedding_match()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  wa uuid; wb uuid;
BEGIN
  SELECT wedding_id INTO wa FROM guests WHERE id = NEW.guest_a_id;
  SELECT wedding_id INTO wb FROM guests WHERE id = NEW.guest_b_id;
  IF wa IS NULL OR wb IS NULL OR wa <> NEW.wedding_id OR wb <> NEW.wedding_id THEN
    RAISE EXCEPTION 'seating_conflict guests must belong to the same wedding';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_seating_conflict_check
  BEFORE INSERT OR UPDATE ON seating_conflicts
  FOR EACH ROW EXECUTE FUNCTION enforce_seating_conflict_wedding_match();
```

### `catering_*` consistency checks

Trigger weryfikujący spójność wyborów cateringowych (kursy/dania należą do tego samego pakietu/oferty co wybrany pakiet pary):

```sql
CREATE OR REPLACE FUNCTION enforce_catering_pick_consistency()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  selection_pkg uuid;
  course_pkg    uuid;
  exists_link   boolean;
BEGIN
  SELECT catering_package_id INTO selection_pkg
    FROM wedding_catering_selection WHERE id = NEW.wedding_catering_selection_id;
  SELECT catering_package_id INTO course_pkg
    FROM catering_courses WHERE id = NEW.catering_course_id;

  IF selection_pkg IS NULL OR course_pkg IS NULL OR selection_pkg <> course_pkg THEN
    RAISE EXCEPTION 'catering_course must belong to the same package as the selection';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM catering_course_dishes
     WHERE catering_course_id = NEW.catering_course_id
       AND catering_dish_id = NEW.catering_dish_id
  ) INTO exists_link;

  IF NOT exists_link THEN
    RAISE EXCEPTION 'dish % is not available in course %', NEW.catering_dish_id, NEW.catering_course_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_wcdp_consistency
  BEFORE INSERT OR UPDATE ON wedding_catering_dish_picks
  FOR EACH ROW EXECUTE FUNCTION enforce_catering_pick_consistency();
```

Drugi trigger — cross-offer guard dla `catering_course_dishes` (dish.offer_id == course.package.offer_id):

```sql
CREATE OR REPLACE FUNCTION enforce_catering_course_dish_same_offer()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  course_offer uuid;
  dish_offer   uuid;
BEGIN
  SELECT cp.catering_offer_id INTO course_offer
    FROM catering_courses cc
    JOIN catering_packages cp ON cp.id = cc.catering_package_id
   WHERE cc.id = NEW.catering_course_id;
  SELECT catering_offer_id INTO dish_offer FROM catering_dishes WHERE id = NEW.catering_dish_id;

  IF course_offer IS NULL OR dish_offer IS NULL OR course_offer <> dish_offer THEN
    RAISE EXCEPTION 'catering_course and catering_dish must belong to the same catering_offer';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_catering_course_dish_same_offer
  BEFORE INSERT OR UPDATE ON catering_course_dishes
  FOR EACH ROW EXECUTE FUNCTION enforce_catering_course_dish_same_offer();
```

> Walidacja `count(picks per course) == course.choice_limit` jest **świadomie** po stronie aplikacji, nie triggera — bo trigger BEFORE INSERT widzi tylko bieżący wiersz, nie cały batch. Service layer w backendzie waliduje cały zestaw przy `PATCH /catering/selection/dishes`.

### Wedding bootstrap (seed na nowe wesele)

Po `INSERT INTO weddings` backend (lub dedykowana funkcja PG) seeduje:
1. `wedding_members` (twórca jako `partner_a`).
2. 15 `budget_categories` (lista z sekcji `budget_categories` powyżej).
3. `tasks` z `task_templates` (`is_auto=true`, `due_date = wedding_date - days_before_wedding`).
4. (Opcjonalnie) 12 stołów × 8 miejsc (z prototypu — daje rozpoznawalny start point).
5. **Catering nie jest seedowany** — para sama dodaje ofertę swojej sali (lub kilka do porównania) na ekranie `/app/oferta-sali`. Domyślnie brak `wedding_catering_selection` (NULL). Dopiero gdy para wybierze pakiet i zacznie konfigurować menu, pojawia się rezerwacja w Budżecie.

Implementacja w aplikacji (NestJS service) lub jako PG function `bootstrap_wedding(wedding_id uuid, creator_user_id uuid)`. Druga opcja jest atomowa i bezpieczniejsza pod kątem RLS.

---

## Row-Level Security (Supabase)

**Status:** RLS jest włączone **deny-all** na wszystkich 25 tabelach `public` (migracja `20260524090000_rls_lockdown`). Autoryzacja domenowa (kto należy do którego wesela) żyje **w Express middleware**, nie w politykach PG.

### Dlaczego nie polityki `auth.uid()`?

Oryginał tego dokumentu zakładał Supabase Auth — i polityki `current_user_belongs_to_wedding(wedding_id)` używające `auth.uid()` jako tożsamości użytkownika. W naszej architekturze:

- **Auth jest zewnętrzny** (`kubitksso.pl`, JWT RS256 weryfikowany przez JWKS w backendzie). Supabase nigdy nie widzi sesji użytkownika.
- **Backend rozmawia z Postgresem jako `service_role`**, który omija RLS z definicji.
- `auth.uid()` w naszym kontekście zwraca **NULL** — każda polityka oparta o niego natychmiast zwróciłaby false dla wszystkich.

Polityki opisane w wersji historycznej tego pliku **nie zostały zaimplementowane** i nie zostaną — to jest świadoma decyzja architektoniczna, nie zaległość.

### Co zrobiliśmy zamiast

| Warstwa | Mechanizm | Egzekwowane przez |
|---|---|---|
| **L1 — Authentication** | `Authorization: Bearer <SSO JWT>` weryfikowany przez JWKS | `middleware/jwks-auth.js` |
| **L2 — Authorization (membership)** | Sprawdzenie wpisu w `wedding_members(wedding_id, user_id)` | Express middleware/helper na każdej trasie `/api/weddings/:weddingId/*` (do dorobienia w M2) |
| **L3 — Defense-in-depth (DB)** | RLS deny-all dla `anon`/`authenticated`; `service_role` omija | Migracja `20260524090000_rls_lockdown` |
| **L4 — RPC lockdown** | `EXECUTE` na `bootstrap_wedding` / `create_wedding_with_bootstrap` odebrany od `PUBLIC` | Migracja `20260524093000_revoke_security_definer_from_public` |
| **L5 — Function hardening** | `search_path = public, pg_catalog` zapinane na wszystkich 8 funkcjach | Część migracji `rls_lockdown` |

### Co dokładnie zawiera `rls_lockdown`

```sql
-- 25× alter table <name> enable row level security;
-- (zero polityk == deny-all dla każdego nie-service_role)

-- Tylko service_role może wywołać RPCs domenowe
revoke execute on function public.bootstrap_wedding(uuid, uuid) from public;
revoke execute on function public.create_wedding_with_bootstrap(uuid, text, text, date, text) from public;

-- Pinned search_path na funkcjach (chroni SECURITY DEFINER przed hijack'iem)
alter function public.set_updated_at()                                              set search_path = public, pg_catalog;
alter function public.shift_auto_tasks_on_wedding_date_change()                     set search_path = public, pg_catalog;
alter function public.enforce_seating_conflict_wedding_match()                      set search_path = public, pg_catalog;
alter function public.enforce_catering_course_dish_same_offer()                     set search_path = public, pg_catalog;
alter function public.enforce_catering_selection_package_wedding()                  set search_path = public, pg_catalog;
alter function public.enforce_catering_pick_consistency()                           set search_path = public, pg_catalog;
alter function public.bootstrap_wedding(uuid, uuid)                                 set search_path = public, pg_catalog;
alter function public.create_wedding_with_bootstrap(uuid, text, text, date, text)   set search_path = public, pg_catalog;
```

Stan po migracji potwierdzony przez `supabase get_advisors`: **0 ERROR, 1 WARN** (`citext` w `public` — zaakceptowane MVP, przeniesienie wymaga drop'a kolumny `users.email`).

### Specjalna reguła: hard-delete wesela

Decyzja produktowa: hard-delete całego wesela tylko przez "founder'a" (`weddings.created_by_user_id`). **Implementacja w Express service** (`services/weddings.js` przy `DELETE /api/weddings/:id`):

```js
if (wedding.created_by_user_id !== req.currentUserId) {
  throw new ForbiddenError('Tylko założyciel wesela może je skasować.');
}
```

NIE w polityce RLS — bo i tak service_role je omija, a Express ma czytelniejszy error message niż "0 rows affected".

### Kiedy warto byłoby wrócić do fine-grained RLS

Gdyby kiedyś:
- Frontend dostał bezpośredni dostęp do Supabase (z publishable key), albo
- Wystawić Edge Functions wywoływane przez `anon`/`authenticated`,

— wtedy potrzebowalibyśmy zmapować SSO `sub` na PG sesję. Wzorzec to:
1. Supabase Auth hook (lub middleware proxy) który wymienia SSO JWT na własny PG token,
2. Funkcja `current_app_user()` czytająca `current_setting('request.jwt.claims', true)::json->>'sub'` zamiast `auth.uid()`,
3. Polityki zaprojektowane tak jak w wersji historycznej tego dokumentu (membership check przez `wedding_members`).

W MVP nie ma takiej potrzeby — całe API idzie przez Express, jedna ścieżka, jeden punkt egzekwowania autoryzacji.

---

## Resolved decisions (po przeglądzie screenów)

Domknięte założenia z poprzedniej iteracji — wszystkie z labelem **Recommended** w schemacie. Para/PO może je zmienić, ale dopóki nie zmieni — implementacja idzie z poniższymi:

1. **Modal "Dodaj gościa" ma tylko 4 pola** (Imię/Nazwisko/Relacja/Dieta). Pola `is_child`, `has_plus_one`, `meal_option_id`, `contact_phone`, `contact_email` są edytowane na ekranie szczegółów / edycji gościa (poza prototypem).
2. **Diet enum ma 5 wartości** (`pending/standard/vege/vegan/gluten_free`); `'pending'` to default i odpowiada KPI "14 nie wybrało dania". UI dropdown w modalu pokazuje "Standard" dla wygody pierwszego użytkownika, ale backend trzyma `'pending'` dopóki gość świadomie nie wybierze.
3. **Meal options** — para definiuje listę dań w `meal_options` (osobna tabela, CRUD w Ustawieniach → "Menu na wesele"). Gość ma `meal_option_id` jako FK. NULL = "nie wybrał".
4. **Hard-delete** dla wszystkich zasobów wesela. Soft-delete pomijamy w MVP. Cascade delete całego wesela tylko przez `created_by_user_id`.
5. **Symetryczne uprawnienia** między partnerami (CRUD wszystko). Asymetryczny tylko hard-delete całego wesela (`weddings.created_by_user_id`).
6. **Conflict reason** — `text` (free-form), nie enum. Każda para ma swoje powody.
7. **Auto-timeline regeneracja** — trigger `tg_weddings_shift_auto_tasks` przesuwa nieskończone auto-zadania o delta dni przy zmianie `wedding_date`. Ukończonych i manualnych nie rusza. Endpoint `POST /tasks/regenerate-auto` daje force-mode.
8. **Spotkania** są **niezależnymi encjami** od zadań. Zadanie "Spotkanie z DJ-em" (auto-task) i wpis w `meetings` to dwie różne rzeczy: pierwsze to checkpoint w timeline, drugie to konkretny umówiony termin. Można w przyszłości dodać `meetings.task_id` (link), ale w MVP nie łączymy.
9. **JSON export** — pełny dump wesela (gości, kontrahentów, umów, płatności, budżetu, wydatków, zadań, stołów, konfliktów, spotkań, meal_options). Bez `users.password_hash`, `partner_invitations.token`. RODO: każdy partner widzi pełen stan wesela, do którego należy.
10. **Konwencje walut**: wszędzie PLN, brak `currency` column. Jeśli kiedyś trzeba — migracja `ALTER TABLE … ADD COLUMN currency text NOT NULL DEFAULT 'PLN'`.
11. **`vendors.contract_amount` vs `contracts.total_amount`**: pierwsza to "planowana / orientacyjna", widoczna od momentu dodania kontrahenta. Druga to "podpisana", obowiązkowa przy `INSERT INTO contracts`. Backend kopiuje wartość przy tworzeniu kontraktu, ale są to niezależne kolumny (po podpisaniu mogą się rozjechać — np. dopłata).
12. **Catering offers** są **per-wedding** (każda para wprowadza swoją). Nie projektujemy globalnej "biblioteki ofert" w MVP — to upraszcza RLS i model. Po MVP można dodać `is_template` flag i widoczność publiczną dla szablonów ofert.
13. **`selection_mode` na `catering_courses`** — 3 wartości pokrywają wszystkie obserwowane przypadki:
    - `all_served` — całość listy serwowana wszystkim (np. zupa zaszyta w pakiecie Szefa Kuchni; lub bufet, gdzie "wszystko" jest dostępne dla wszystkich gości).
    - `couple_picks` — para wybiera N z M (typowy bufet "8 z 20", surówki "3 z 9", danie główne "1 z 5").
    - `guest_picks` — każdy gość wybiera 1 z N (synchronizowane z `meal_options` i polem `guests.meal_option_id`).
14. **Sync `wedding_catering_dish_picks` → `meal_options`**: dla `course.selection_mode='guest_picks'` backend automatycznie tworzy/aktualizuje wpisy w `meal_options` (1:1 z dish_picks). Realizacja: endpoint `POST /api/weddings/:id/catering/sync-meal-options` (idempotentny). Trigger PG byłby zbyt cross-table; lepszy jawny call.
15. **Cena cateringu w budżecie**: po `INSERT/UPDATE` na `wedding_catering_selection` lub jego picks, backend recompuje `total_price()` i aktualizuje `budget_categories` "Catering / Sala" jako `reservedFromContracts`-podobny agregat. Jeśli istnieje `contracts.wedding_catering_selection_id` (umowa podpisana), wartość promuje się do `contracts.total_amount`.

## Otwarte pytania (do potwierdzenia z PO przed implementacją)

1. **Skala** — prototyp pokazuje 127 zaproszonych. Indeksy są zaprojektowane dla rzędu setek/niskich tysięcy. Jeśli realny target to >2000 gości na wesele (rzadkie, ale zdarza się np. weselach branżowych), warto wcześniej dodać `LIMIT/OFFSET` lub cursor pagination w `GET /guests`.
2. **Eksport JSON — czy szyfrować ZIP?** Pliki z danymi gości to RODO-dane. Decyzja: hasło opcjonalne (param w endpointzie). Domyślnie plain JSON — powołane na "to mój dysk, mój problem".
3. **Powiadomienia** (push/email) — UI ich nie pokazuje, ale `tasks` ma `due_date` i `payments` ma `due_date`. Jeśli dodać scheduler/cron job → osobna tabela `notification_log` (poza MVP).
4. **Meeting → vendor cascade**: jeśli usuniemy vendora, co z `meetings.vendor_id`? Obecnie `ON DELETE SET NULL`. Alternatywa: `ON DELETE CASCADE` — usunięcie kontrahenta zabija umówione spotkania. Domyślnie zostawiam `SET NULL` (spotkanie samo w sobie ma wartość historyczną, nawet bez kontrahenta).
5. **Multi-tenancy auth**: single Supabase project + RLS przez `wedding_members` (znacznie tańsze i wystarczające, projekt zaprojektowany pod to). Pomijamy "Supabase Project per wesele".
