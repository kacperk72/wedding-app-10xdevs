# Backend — Wedding Planner

> **TL;DR**: Oryginał to **statyczny prototyp Lovable** — backendu nie ma, jedyny request poza zasobami statycznymi to `POST /~api/analytics` (telemetria Lovable). Cała specyfikacja API w tym pliku jest **inferowana** z UI. Aktualny stos implementacji: **Express + Supabase Postgres + zewnętrzne SSO przez JWKS**. SSO obsługuje hasła i sesję; wedding-planner trzyma tylko dane domenowe.

## Detected style

- **API style**: brak (do zaprojektowania); rekomendowany **REST** w stylu zasobowym, prefix `/api`.
- **Base URL**: `/api` (rekomendowane), z weselem jako encją kontekstową w wielu ścieżkach: `/api/weddings/<id>/<resource>`.
- **Auth**: brak w prototypie; w aplikacji produkcyjnej **zewnętrzne SSO** (`kubitksso.pl`) wydaje JWT RS256, a backend wedding-plannera tylko weryfikuje Bearer token przez JWKS.
- **Versioning**: nie potrzebny w MVP (single client, single backend); ewentualnie `/api/v1/` od początku.
- **Multitenancy**: model "jedno wesele dwa konta" — każdy użytkownik ma 0 lub 1 wesela, wesele ma 1-2 partnerów. Każdy zasób (gość, kontrahent, …) jest "własnością" wesela; backend musi to konsekwentnie egzekwować.

## Recommended stack for rebuild

- **Framework**: **Express** (obecny backend w `wedding-planner/backend`).
- **Język**: JavaScript CommonJS na start; ewentualna migracja do TypeScript później, gdy API się ustabilizuje.
- **Walidacja**: lekkie helpery/DTO per route na start; przy rozroście można dodać `zod`.
- **DB driver**: `@supabase/supabase-js` z service-role key po stronie backendu. Klucz nigdy nie trafia do frontendu.
- **Auth**: middleware JWKS (`middleware/jwks-auth.js`) weryfikuje token SSO. Backend mapuje payload SSO do lokalnego `users.sso_user_id`.
- **Autoryzacja danych**: Express sprawdza członkostwo w `wedding_members` (middleware/helper na każdej trasie `/api/weddings/:weddingId/*`). Supabase RLS **jest włączone deny-all** na wszystkich 25 tabelach `public` (migracja `20260524090000_rls_lockdown`) — `service_role` omija je z definicji, `anon`/`authenticated` nie mają polityk więc każdy request przez nich = 0 wierszy. SECURITY DEFINER RPCs (`bootstrap_wedding`, `create_wedding_with_bootstrap`) mają `EXECUTE` odebrany od `PUBLIC` (migracja `20260524093000_revoke_security_definer_from_public`).

## Authentication

Wedding-planner **nie ma własnego register/login/refresh/logout**. Te endpointy żyją na SSO (`kubitksso.pl`), nie tutaj. Sekcje `Register`/`Login`/`Refresh`/`Logout` poniżej dokumentują **co wystawia SSO** (kontrakt, który frontend konsumuje przez SDK SSO) — są tu dla kompletności, bo i tak są częścią flow użytkownika. Wedding-planner backend **przyjmuje wyłącznie** `Authorization: Bearer <accessToken>` i weryfikuje podpis przez JWKS. Jedyny endpoint w tej sekcji który implementujemy my to `GET /api/me`.

### Register (SSO — endpoint poza wedding-plannerem)

`POST /api/auth/register`

Request:
```json
{
  "email": "anna@wesele.pl",
  "password": "string (min 8)",
  "firstName": "Anna",
  "lastName": "Kowalska"
}
```

Response (201):
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": { "id": "uuid", "email": "anna@wesele.pl", "firstName": "Anna", "lastName": "Kowalska", "weddingId": null }
}
```

Po rejestracji użytkownik nie ma jeszcze wesela. Tworzy je dopiero przy pierwszej wizycie w `/app` (lub przez kreator) — patrz `POST /api/weddings`.

### Login

`POST /api/auth/login`

Request:
```json
{ "email": "anna@wesele.pl", "password": "..." }
```

Response (200): jak rejestracja.
Response (401): `{ "message": "Nieprawidłowy e-mail lub hasło" }`.

### Refresh

`POST /api/auth/refresh`

Body: `{ "refreshToken": "eyJ..." }` — albo z httpOnly cookie.
Response (200): nowa para tokenów; stary refresh unieważniony (rotacja).

### Logout

`POST /api/auth/logout` — unieważnia bieżący refresh token.

### Me

`GET /api/me`

Response (200):
```json
{
  "id": "uuid",
  "email": "anna@wesele.pl",
  "firstName": "Anna",
  "lastName": "Kowalska",
  "weddingId": "uuid|null",
  "partner": {
    "id": "uuid",
    "firstName": "Marek",
    "lastName": "Kowalski",
    "email": "marek@wesele.pl",
    "linkStatus": "linked"
  } | null
}
```

### Token usage

- `Authorization: Bearer <accessToken>` na każde żądanie z prefiksem `/api` poza `/auth/*`.
- Refresh token w **HttpOnly + Secure + SameSite=Strict** cookie; access token w pamięci frontendu (signal `AuthService.user`).

## Endpoints

Każde poniżej (poza `/auth/*` i `/me`) wymaga aktywnego JWT i przynależności użytkownika do wesela `:weddingId`.

### Implementation status

> **Aktualizacja 2026-05-26:** zaimplementowane i pokryte testami: `GET /api/weddings/:id/dashboard`, `/api/weddings/:weddingId/meetings` CRUD + `/upcoming`, `GET /api/weddings/:id/export`, founder-only `DELETE /api/weddings/:id`, cache headers na `/api`. Backend `npm test`: 51/51.

| Sekcja | Status | Komentarz |
|---|---|---|
| `/api/me` | ✅ | Z `weddingMembership` (role + linkedAt). 3 testy: bez membership / partner_a sam / oboje |
| `Wedding` (POST/GET/PATCH/invite/accept) | ✅ | Wszystkie 5 endpointów. POST i accept-invite robione przez PG RPCs zwracające jsonb `{status, error}` lub success payload. Rate limity: `invite-partner` 5/min, `accept-invite` 10/min |
| `Guests` (POST/GET/PATCH/DELETE) | ✅ | Filtry `rsvp`/`diet`/`relation`/`search`, sortowanie. Cross-wedding FK guard na `mealOptionId`/`tableId` |
| `Guests` `/aggregates` | ✅ | PG RPC `guest_aggregates(p_wedding_id)` zwracający 7 KPI; mounted **przed** routami parametrycznymi w `routes/guests.js`; Dashboard wywołuje przez `GuestsService.loadAggregates` |
| `Meal options` (CRUD) | ✅ | Nested pod `/api/weddings/:weddingId/meal-options` |
| `Tables` (CRUD) | ✅ | **Wyciągnięte z M8 wcześniej** (potrzebne do edytora gościa). Walidacja `seatsCount 1..24` |
| `Vendors` (CRUD) | ✅ | `routes/vendors.js`; 10 kategorii / 5 statusów; `GET /missing` zwraca kategorie bez secured-status vendor'a (`zarezerwowany`/`zaplacony`/`wykonany`); `has_contract` flag dodawany przez `attachContractFlags()` z perf-correct `.in("vendor_id", ids)` |
| `Contracts` (CRUD + `/upcoming-payments`) | ✅ | `routes/contracts.js`; list zwraca contract'y z vendor + payments inline; `loadContracts()` używa `.in("contract_id", ids)` (nie pulluje payments globalnie) |
| `Payments` (CRUD nested pod contract) | ✅ | `routes/payments.js`; każda mutacja wywołuje `syncContractStatus()` która przelicza i ustawia `contracts.status` na `pending`/`in_progress`/`deposit_paid`/`paid_in_full` |
| `Budget`, `Tasks`, `Seating`, `Catering`, `Dashboard`, `Settings/Export` | ❌ | M5-M10 — niezaimplementowane |

**Konwencja dla nowych zasobów:** nested router `express.Router({ mergeParams: true })` mounted pod `/api/weddings/:weddingId/<resource>`, `router.use(requireWeddingMember())` u góry, mapper w `utils/mappers.js`, `assertWeddingRecordExists()` na każdym FK przecinającym wesela.

**Cross-table joins:** **zawsze** filtruj przez `.in("fk_column", ids)` zamiast `select *` (nawet z `service_role` które omija RLS). Default `select *` pulluje globalnie i odfiltrowuje w JS — wolne i conceptually wrong. Dwa bugi tego kształtu istniały w pierwszej iteracji M4 (vendors `attachContractFlags`, contracts `loadContracts` payments) i zostały naprawione.

**RPC pattern dla operacji wielo-tabelowych:** zamiast 5-step Express transaction → jedna PG function `SECURITY DEFINER` zwracająca `jsonb_build_object('status', 4xx, 'error', '...')` przy biznesowych konfliktach lub success payload przy OK. Express handler keys off `data.error`. Atomowość + spójne mapowanie statusów. Przykłady: `accept_partner_invite`, `create_wedding_with_bootstrap`, `guest_aggregates` (migracje `20260524120000`, `20260524123000`, `20260524190000`).

**Lockdown SECURITY DEFINER RPCs:** Supabase auto-grantuje `EXECUTE` dla `anon`/`authenticated` na każdą nową funkcję w `public` (PostgREST używa tych grantów dla `/rest/v1/rpc/*`). `revoke execute ... from public` **nie tyka** explicit-grantów na konkretnych rolach — trzeba dodatkowo `revoke execute ... from anon, authenticated`. Migracja `20260524193000_revoke_rpc_execute_from_client_roles` robi to retroaktywnie dla wszystkich 4 SECURITY DEFINER RPCs (`bootstrap_wedding`, `create_wedding_with_bootstrap`, `accept_partner_invite`, `guest_aggregates`). Każda nowa SECURITY DEFINER RPC w przyszłości musi pamiętać o tych dwóch revokes.

### Wedding (encja kontekstowa)

#### `POST /api/weddings`
Utwórz wesele dla bieżącego użytkownika. Każdy user może mieć tylko 1 aktywne wesele.

Request:
```json
{
  "partnerAName": "Weronika",
  "partnerBName": "Kacper",
  "weddingDate": "2026-07-25",
  "ceremonyLocation": "Kościół św. Marcina, Wrocław"
}
```
Response (201): obiekt wesela; bieżący user staje się jego "partnerA".

#### `GET /api/weddings/:id`
Zwraca wesele wraz z licznikiem dni (`daysUntilWedding`).

Response (200):
```json
{
  "id": "uuid",
  "partnerAName": "Weronika",
  "partnerBName": "Kacper",
  "weddingDate": "2026-07-25",
  "ceremonyLocation": "Kościół św. Marcina, Wrocław",
  "createdByUserId": "uuid",
  "daysUntilWedding": 81,
  "members": [
    { "userId": "uuid", "role": "partner_a", "linkedAt": "..." },
    { "userId": "uuid", "role": "partner_b", "linkedAt": "..." }
  ]
}
```

> Frontend rozpoznaje "kto jest founderem" przez `createdByUserId === currentUser.id`. Tylko founder widzi przycisk "Usuń wesele" w Ustawieniach (poza prototypem).

#### `PATCH /api/weddings/:id`
Aktualizuj profil pary (z formularza Ustawień).

Request: dowolny podzbiór pól z `POST`.

#### `POST /api/weddings/:id/invite-partner`
Wyślij e-mail z zaproszeniem partnera.

Request: `{ "email": "kacper.wisniewski@mail.pl" }`
Side effect: zapisuje pending invitation (token, TTL 7 dni) i wysyła e-mail (SMTP / Resend / Postmark — do wyboru).

#### `POST /api/weddings/accept-invite`

**Wymaga JWT** (partner_b musi się zalogować przez SSO **przed** akceptacją linka — frontend `AcceptInvitePage` przekierowuje na SSO login jeśli brak sesji, potem wraca z tokenem z URL).

Body: `{ "token": "<32-byte hex z URL>" }`.

Side effect: wywołuje atomową PG RPC `accept_partner_invite(p_token, p_user_id)` — `SELECT ... FOR UPDATE` na invitation, walidacja statusu/expiry, insert do `wedding_members` jako `partner_b`, oznaczenie invitation jako `accepted`. Race na drugim koncie zaakceptowanym pierwszy wygrywa, drugi dostaje 409 przez `unique_violation` handler.

Response (200): `{ "weddingId", "weddingMembership": { weddingId, role, linkedAt } }`. Błędy: 400 invalid/expired token, 409 user już ma wesele lub partner_b już zlinkowany, 429 rate-limit (10/min).

### Guests

Bazowy URL: `/api/weddings/:weddingId/guests`

| Method | Path                                | Opis                                          |
| ------ | ----------------------------------- | --------------------------------------------- |
| GET    | `/`                                 | Lista gości; query: `relation`, `status`, `diet`, `search` |
| GET    | `/aggregates`                       | KPI dla pasek agregatów na ekranie Goście     |
| GET    | `/:id`                              | Szczegóły jednego gościa                      |
| POST   | `/`                                 | Dodaj gościa (z modala)                       |
| PATCH  | `/:id`                              | Edytuj gościa                                 |
| DELETE | `/:id`                              | Usuń gościa                                   |

`GET /aggregates` (200):
```json
{
  "invited": 127,
  "confirmed": 35,
  "pending": 10,
  "declined": 5,
  "vegetarian": 18,
  "children": 5,
  "missingMealChoice": 14
}
```

Mapowanie do bazy:
- `invited` = `COUNT(*)`
- `confirmed/pending/declined` = `COUNT(*) GROUP BY rsvp_status`
- `vegetarian` = `COUNT(*) WHERE diet IN ('vege','vegan')`
- `children` = `COUNT(*) WHERE is_child = true`
- `missingMealChoice` = `COUNT(*) WHERE meal_option_id IS NULL` (lub: WHERE diet = 'pending' — zależy czy KPI mówi "nie wybrało dania" czy "nie wybrało diety"; w UI to "14 nie wybrało dania" → patrzymy na `meal_option_id`)

`POST /` (z modala — minimalny payload, 4 pola):
```json
{
  "firstName": "Adam",
  "lastName": "Kwiatkowski",
  "relation": "rodzina_panny_mlodej",
  "diet": "vege"
}
```

Backend domyśla pozostałe pola: `rsvpStatus='pending'`, `hasPlusOne=false`, `isChild=false`, `mealOptionId=null`, `tableId=null`. Edycja tych pól idzie przez `PATCH /:id` (po dodaniu gościa, na ekranie szczegółów).

`PATCH /:id` payload (przykład inline-editu w tabeli):
```json
{
  "rsvpStatus": "confirmed",
  "mealOptionId": "uuid-of-salmon-option",
  "tableId": "uuid-of-table-3",
  "isChild": true,
  "hasPlusOne": false
}
```

Gość response (200) zawiera dodatkowo:
- `tableId` + `tableName` (denormalizacja dla UI)
- `mealOptionId` + `mealOptionLabel` (denormalizacja dla UI)

### Vendors (Kontrahenci)

Bazowy URL: `/api/weddings/:weddingId/vendors`

| Method | Path        | Opis                                                                |
| ------ | ----------- | ------------------------------------------------------------------- |
| GET    | `/`         | Lista kontrahentów; query: `status`, `category`                     |
| GET    | `/missing`  | Brakujące kategorie (alert na ekranie); zwraca listę kategorii bez `zarezerwowany`/`zapłacony`/`wykonany` |
| POST   | `/`         | Dodaj kontrahenta                                                   |
| PATCH  | `/:id`      | Edytuj                                                              |
| DELETE | `/:id`      | Usuń                                                                |

`Vendor` response:
```json
{
  "id": "uuid",
  "category": "FOTOGRAF",
  "companyName": "Studio Foto Magia",
  "contactPerson": "Tomasz Nowak",
  "phone": "+48 601 222 333",
  "email": "kontakt@fotomagia.pl",
  "status": "ZAREZERWOWANY",
  "contractAmount": 8500.00,
  "hasContract": true
}
```

### Contracts (Umowy) + Payments

Bazowy URL: `/api/weddings/:weddingId/contracts`

| Method | Path                        | Opis                                                  |
| ------ | --------------------------- | ----------------------------------------------------- |
| GET    | `/`                         | Lista umów (z włączonymi paymentami); query: `status` |
| GET    | `/upcoming-payments`        | Płatności w 30 dni (sekcja na górze Umów + Dashboard) |
| POST   | `/`                         | Dodaj umowę                                           |
| PATCH  | `/:id`                      | Edytuj                                                |
| DELETE | `/:id`                      | Usuń                                                  |
| POST   | `/:id/payments`             | Dodaj ratę                                            |
| PATCH  | `/:id/payments/:paymentId`  | Edytuj ratę (status, kwota, termin)                   |
| DELETE | `/:id/payments/:paymentId`  | Usuń ratę                                             |

`Contract` response:
```json
{
  "id": "uuid",
  "vendorId": "uuid",
  "vendorName": "Pałac Pod Lipami",
  "category": "SALA",
  "totalAmount": 32000.00,
  "signedDate": "2025-10-17",
  "status": "IN_PROGRESS",
  "payments": [
    { "id": "uuid", "kind": "ZALICZKA", "dueDate": "2025-10-17", "amount": 8000, "paidAt": "2025-10-17", "status": "PAID" },
    { "id": "uuid", "kind": "RATA", "dueDate": "2026-04-04", "amount": 14400, "paidAt": "2026-04-03", "status": "PAID" },
    { "id": "uuid", "kind": "FINAL", "dueDate": "2026-06-04", "amount": 9600, "paidAt": null, "status": "PLANNED" }
  ],
  "paidCount": 2,
  "totalCount": 3
}
```

`GET /upcoming-payments` (200): tablica obiektów z `vendorName`, `kind`, `dueDate`, `amount`, `daysUntilDue`.

### Budget

Bazowy URL: `/api/weddings/:weddingId/budget`

| Method | Path                                   | Opis                                                              |
| ------ | -------------------------------------- | ----------------------------------------------------------------- |
| GET    | `/summary`                             | 3 KPI: spent, reserved (z umów), estimatedFinal                   |
| GET    | `/categories`                          | Lista 15 kategorii z `plannedAmount`, `spentAmount`, `progressPct`|
| PATCH  | `/categories/:id`                      | Edytuj plan (kwotę estymowaną) jednej kategorii                   |
| GET    | `/categories/:id/transactions`         | Transakcje (rozwinięcie wiersza)                                  |
| POST   | `/expenses`                            | Dodaj wydatek                                                     |
| PATCH  | `/expenses/:id`                        | Edytuj                                                            |
| DELETE | `/expenses/:id`                        | Usuń                                                              |

`GET /summary` (200):
```json
{
  "spent": 55505.00,
  "reservedFromContracts": 46075.00,
  "estimatedFinal": 113700.00,
  "totalToDate": 101580.00
}
```

### Tasks

Bazowy URL: `/api/weddings/:weddingId/tasks`

| Method | Path             | Opis                                                                       |
| ------ | ---------------- | -------------------------------------------------------------------------- |
| GET    | `/`              | Lista zadań; query: `category`, `done` (bool); domyślnie pogrupowane logicznie |
| POST   | `/`              | Dodaj zadanie własne                                                       |
| PATCH  | `/:id`           | Edytuj (np. zaznacz `done: true`, zmienić deadline)                        |
| DELETE | `/:id`           | Usuń                                                                       |
| POST   | `/regenerate-auto` | Regeneruje auto-tasks na podstawie daty ślubu (idempotentny, ostrożnie z istniejącymi) |

`Task`:
```json
{
  "id": "uuid",
  "title": "Wybór menu z cateringiem",
  "category": "KONTRAHENT",
  "dueDate": "2026-04-28",
  "done": false,
  "isAuto": false,
  "templateId": null,
  "createdAt": "..."
}
```

Zasady auto-timeline (z prompt-prototyp-ui.md i obserwowanego UI):
- Backend trzyma listę `task_templates` z polem `daysBeforeWedding` i `category`.
- Przy tworzeniu wesela auto-generuje `tasks` z `dueDate = weddingDate - daysBeforeWedding`, `isAuto: true`, `templateId` ustawione.
- Edycja daty ślubu → opcjonalna regeneracja przesuniętych auto-tasks (z potwierdzeniem usera).

### Seating (Rozsadzenie)

Bazowy URL: `/api/weddings/:weddingId/seating`

| Method | Path                          | Opis                                                  |
| ------ | ----------------------------- | ----------------------------------------------------- |
| GET    | `/tables`                     | Lista stołów ze sprzężonymi gośćmi                    |
| POST   | `/tables`                     | Dodaj stół (`name`, `seatsCount`)                     |
| PATCH  | `/tables/:id`                 | Edytuj (zmiana nazwy, liczby miejsc, pozycji)         |
| DELETE | `/tables/:id`                 | Usuń stół (przesuwa gości do "nieprzypisanych")       |
| POST   | `/tables/:id/assign`          | Przypisz gościa: `{ guestId }` — drag-and-drop hook   |
| DELETE | `/tables/:id/assign/:guestId` | Usuń przypisanie                                      |
| GET    | `/conflicts`                  | Lista konfliktów                                      |
| POST   | `/conflicts`                  | Dodaj konflikt: `{ guestAId, guestBId, reason }`      |
| DELETE | `/conflicts/:id`              | Usuń                                                  |
| GET    | `/stats`                      | `{ assigned: 25, total: 35 }`                          |

### Dashboard

Backend wystawia 1 endpoint zbiorczy, żeby front nie odpalał 5 osobnych:

#### `GET /api/weddings/:weddingId/dashboard`

```json
{
  "daysUntilWedding": 81,
  "kpi": {
    "guests": { "confirmed": 35, "total": 127, "pending": 10, "declined": 5 },
    "budget": { "spent": 55505, "estimatedTotal": 109500, "progressPct": 51 },
    "upcomingPayments": { "totalAmount": 23050, "itemsCount": 4, "windowDays": 30 },
    "tasksThisWeek": { "count": 5, "overdue": 3 }
  },
  "attentionItems": [
    { "id": "uuid", "type": "TASK", "title": "Wybór menu z cateringiem", "subtitle": "Opóźnione o 7 dni", "dueDate": "2026-04-28", "ctaPath": "/app/zadania" }
  ],
  "upcomingMeetings": [
    { "id": "uuid", "title": "Spotkanie z DJ-em", "datetime": "2026-05-07T17:00", "location": "DJ Kowalski, Kraków" }
  ]
}
```

`attentionItems` agreguje: opóźnione/pilne taski + brakujących kontrahentów + płatności po terminie. Logika `type` enumem.

### Catering offer (oferta sali / cateringu)

Konfigurator ofert cateringowych — para definiuje (lub porównuje) oferty od różnych sal, wybiera pakiet, klika dania w ramach `choice_limit`, dorzuca dodatki. Wynik (z guest_count) zasila Budżet jako rezerwacja oraz może być "zamrożony" w `contracts.total_amount` po podpisaniu umowy.

#### Offers (oferty)

Bazowy URL: `/api/weddings/:weddingId/catering/offers`

| Method | Path     | Opis                                                              |
| ------ | -------- | ----------------------------------------------------------------- |
| GET    | `/`      | Lista ofert dla wesela (zwykle 1-3 do porównania)                 |
| GET    | `/:id`   | Pełen pakiet danych: oferty + packages + courses + dishes + addons (idealne dla ekranu konfiguratora — eager load) |
| POST   | `/`      | Dodaj ofertę: `{ "name": "Pałac Polanka 2026", "vendorId": "uuid?", "validThrough": "2026-12-31?", "notes": "..." }` |
| PATCH  | `/:id`   | Edytuj nagłówek oferty                                            |
| DELETE | `/:id`   | Usuń ofertę (cascade na packages/courses/dishes/addons)           |

`GET /:id` response (200) — kompletny dump:
```json
{
  "id": "uuid",
  "name": "Pałac Polanka 2026",
  "vendorId": "uuid|null",
  "validThrough": "2026-12-31",
  "packages": [
    {
      "id": "uuid",
      "name": "Pakiet Złoty",
      "pricePerPerson": 374.00,
      "isModifiable": true,
      "courses": [
        {
          "id": "uuid",
          "courseType": "obiad_zupa",
          "title": "Zupa",
          "selectionMode": "couple_picks",
          "choiceLimit": 1,
          "availableDishes": [
            { "id": "uuid", "name": "Domowy rosół z makaronem...", "isVegetarian": false, "isVegan": false, "isGlutenFree": false }
          ]
        }
      ]
    }
  ],
  "addons": [
    { "id": "uuid", "name": "Pokrowce na krzesła", "price": 8.00, "pricingUnit": "per_person" },
    { "id": "uuid", "name": "Wiejski stół (zimny + ciepły)", "price": 1500.00, "pricingUnit": "per_event" }
  ]
}
```

#### Packages, Courses, Dishes, Addons (CRUD biblioteki)

Wszystkie pod `/api/weddings/:weddingId/catering/offers/:offerId/...`:

| Method | Path                                                          | Opis                                                              |
| ------ | ------------------------------------------------------------- | ----------------------------------------------------------------- |
| POST   | `/packages`                                                   | Dodaj pakiet: `{ "name", "pricePerPerson", "isModifiable", "description?", "sortOrder?" }` |
| PATCH  | `/packages/:packageId`                                        | Edytuj                                                            |
| DELETE | `/packages/:packageId`                                        | Usuń (zabronione, jeśli `wedding_catering_selection.catering_package_id` wskazuje na ten pakiet — `ON DELETE RESTRICT`) |
| POST   | `/packages/:packageId/courses`                                | Dodaj sekcję: `{ "courseType", "title", "selectionMode", "choiceLimit?", "sortOrder?" }` |
| PATCH  | `/packages/:packageId/courses/:courseId`                      | Edytuj                                                            |
| DELETE | `/packages/:packageId/courses/:courseId`                      | Usuń                                                              |
| POST   | `/packages/:packageId/courses/:courseId/dishes`               | Bulk-link dań: `{ "dishIds": ["uuid", ...] }` (idempotentne — UPSERT na junction) |
| DELETE | `/packages/:packageId/courses/:courseId/dishes/:dishId`       | Odlinkuj danie z sekcji                                           |
| POST   | `/dishes`                                                     | Dodaj danie: `{ "name", "description?", "isVegetarian?", "isVegan?", "isGlutenFree?", "allergens?": ["orzechy"] }` |
| PATCH  | `/dishes/:dishId`                                             | Edytuj                                                            |
| DELETE | `/dishes/:dishId`                                             | Usuń (cascade z `catering_course_dishes` i z `wedding_catering_dish_picks`) |
| POST   | `/addons`                                                     | Dodaj dodatek: `{ "name", "price", "pricingUnit", "description?" }` |
| PATCH  | `/addons/:addonId`                                            | Edytuj                                                            |
| DELETE | `/addons/:addonId`                                            | Usuń                                                              |

#### Selection (wybór pary)

Bazowy URL: `/api/weddings/:weddingId/catering/selection`

| Method | Path                  | Opis                                                                    |
| ------ | --------------------- | ----------------------------------------------------------------------- |
| GET    | `/`                   | Aktualny wybór pary (lub 404 jeśli jeszcze nic nie wybrali)             |
| PUT    | `/`                   | Ustaw / zaktualizuj wybór: `{ "cateringPackageId", "guestCountEstimate", "notes?" }`. Idempotentne — upsert. |
| DELETE | `/`                   | Anuluj wybór (czyści też wszystkie picks)                               |
| PUT    | `/dishes`             | Zastąp wszystkie dish picks: `{ "picks": [{ "courseId", "dishIds": [] }, ...] }`. Backend waliduje `count == course.choiceLimit` per course. |
| PATCH  | `/dishes/:courseId`   | Aktualizuj picks dla pojedynczej sekcji: `{ "dishIds": [...] }`         |
| PUT    | `/addons`             | Zastąp wszystkie addon picks: `{ "picks": [{ "addonId", "quantity" }, ...] }` |
| GET    | `/price`              | Computed total price (zobacz response niżej)                            |
| POST   | `/sync-meal-options`  | Sync dishes wybranych w sekcjach `selection_mode='guest_picks'` do `meal_options`. Idempotentne. Zwraca `{ created: N, updated: N, deleted: N }`. |
| POST   | `/freeze-into-contract` | Tworzy `contracts` z `total_amount = computed_price` i ustawia link `wedding_catering_selection_id`. Body: `{ "vendorId": "uuid", "signedDate": "...", "payments": [...] }` |

`GET /price` response:
```json
{
  "guestCountEstimate": 100,
  "package": { "id": "uuid", "name": "Pakiet Złoty", "pricePerPerson": 374.00 },
  "packageSubtotal": 37400.00,
  "addons": [
    { "id": "uuid", "name": "Pokrowce na krzesła", "pricingUnit": "per_person", "unitPrice": 8.00, "quantity": 100, "subtotal": 800.00 },
    { "id": "uuid", "name": "Wiejski stół", "pricingUnit": "per_event", "unitPrice": 1500.00, "quantity": 1, "subtotal": 1500.00 }
  ],
  "addonsSubtotal": 2300.00,
  "totalPrice": 39700.00
}
```

### Meal options (Menu)

Lista dań do wyboru przez gości — para definiuje per-wesele. Brak ekranu w prototypie, ale dodajemy CRUD w Ustawieniach (sekcja "Menu na wesele") razem z resztą profilu.

Bazowy URL: `/api/weddings/:weddingId/meal-options`

| Method | Path     | Opis                                              |
| ------ | -------- | ------------------------------------------------- |
| GET    | `/`      | Lista opcji posortowana po `sortOrder`            |
| POST   | `/`      | Dodaj opcję: `{ "label": "Schab tradycyjny" }`    |
| PATCH  | `/:id`   | Edytuj label / sortOrder                          |
| DELETE | `/:id`   | Usuń (gość z `mealOptionId=ten` dostaje NULL)     |

`MealOption` response:
```json
{ "id": "uuid", "label": "Schab tradycyjny", "sortOrder": 1 }
```

> **Uwaga**: brak tej listy w prototypie powoduje, że KPI "14 nie wybrało dania" nie ma jak być wypełnione w demo. Pierwsze użycie w realnej apce: para dodaje 3-5 opcji w Ustawieniach **lub** wypełnia ją automatycznie z konfiguratora cateringu (`POST /catering/selection/sync-meal-options`) — wtedy nie trzeba wpisywać ręcznie. CRUD endpoint pozostaje, bo niektóre pary korzystają z innego cateringu niż obsługiwany w konfiguratorze, lub chcą custom opcje.

### Settings / Data export

| Method | Path                          | Opis                                              |
| ------ | ----------------------------- | ------------------------------------------------- |
| POST   | SSO `/api/auth/change-password` | Zmiana hasła należy do SSO, nie do wedding-plannera |
| POST   | SSO `/api/auth/logout-all`      | Unieważnia sesje/tokeny w SSO                     |
| GET    | `/api/weddings/:id/export`    | Pełny dump JSON wesela (gości, kontrahentów, umów, płatności, budżetu, wydatków, zadań, stołów, konfliktów, spotkań, meal_options). Bez `password_hash` i `partner_invitations.token`. |
| DELETE | `/api/weddings/:id`           | Hard-delete całego wesela. **Tylko dla `created_by_user_id`**. Cascade usuwa wszystkie dziecięce zasoby. |

## Errors

Standard Express JSON shape:

```json
{
  "error": "Validation failed",
  "details": ["email must be valid"]
}
```

Statusy używane: `400` walidacja, `401` brak/zły token, `403` próba dostępu do cudzego wesela, `404` zasób nie istnieje, `409` konflikt (np. już istnieje wesele dla usera), `422` zasób w stanie zabraniającym akcji, `500` reszta.

## Rate limiting / security headers

- **SSO auth endpointy** (`/auth/login`, `/auth/register`, `/auth/refresh`) limituje aplikacja SSO.
- Endpointy wedding-plannera: 100/min/user/IP.
- Helmet + CORS allowlist (frontend origin).
- HSTS, CSP nagłówki — Helmet + konfiguracja reverse proxy/Hostingera.

## Real-time / async

W MVP **brak** — w prototypie nie zaobserwowano websocketów ani SSE. Aktualizacje między dwoma partnerami następują na refresh strony / po nowym fetchu.

Naturalne rozszerzenie po MVP: WebSocket (`/ws/wedding/<id>`) z eventami `guest.updated`, `payment.created`, `task.completed` itp. — wtedy partner widzi zmiany live. Można dodać po feedbacku userów; nie wymagane na start.

## Resolved decisions (po przeglądzie screenów)

Domknięte podczas iteracji 2 (po przeglądzie 13 screenów). Patrz `04-database.md` → "Resolved decisions" dla pełnej listy. W skrócie po stronie API:

- **Auto-timeline templates** zaszyte w bazie (seed `task_templates`); user nie edytuje ich w UI.
- **Symetryczne uprawnienia** dla partnerów (CRUD wszystko); asymetryczny tylko `DELETE /weddings/:id` (tylko `created_by_user_id`).
- **Partner invitation flow**: 7-dniowy TTL, `status` jawny w bazie (`pending/accepted/declined/expired`), `POST /weddings/:id/invite-partner` można wywołać wielokrotnie (re-send), constraint `UNIQUE(wedding_id, email)`.
- **Eksport JSON** — pełny dump wesela (oboje partnerzy widzą całość), bez secrets (`password_hash`, `token`).
- **Meetings** to oddzielna encja od tasks — endpoint `/meetings` (do dodania w przyszłości; w MVP feed na dashboardzie czyta `meetings` table, dodawanie w UI poza scope MVP).
- **Meal options** — nowy endpoint `/api/weddings/:id/meal-options` (CRUD); `guest.mealChoice` zmienia się na `mealOptionId` (FK).
- **Catering konfigurator** — duża nowa sekcja endpointów (`/catering/offers/...`, `/catering/selection`). Para CRUD-uje ofertę (z PDFa od sali), wybiera pakiet, klika dania w `choice_limit`, dorzuca dodatki. Backend wystawia computed price i `sync-meal-options` (auto-zasilanie RSVP). Po podpisaniu umowy `freeze-into-contract` tworzy `contracts` z snapshotem.
