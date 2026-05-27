# M6 — Catering konfigurator (Pałac Polanka 2026)

> Plan implementacji modułu cateringowego dla wesela Weroniki i Kacpra (25.07.2026, Pałac Polanka).
> Schemat bazy (9 tabel + 4 triggery enforce-*) jest już w `20260523233000_m1_schema_and_seed.sql` i wypchnięty na zdalny Supabase — nie potrzebujemy nowej migracji.
>
> Źródła: `docs/menu/Ulotka oferta weselna 2026.pdf` (lista pakietów, kursów, dań, dodatków) + `docs/menu/Cennik przyjęć okolicznościowych 2026 r.pdf` (ceny per pakiet).

---

## 1. Cel

Para wprowadza ofertę swojej sali jako edytowalny rekord, wybiera pakiet, konfiguruje menu (z możliwością dodania **własnych dań wegetariańskich** poza katalogiem szefa kuchni, zgodnie z notką "Dania rybne, wegetariańskie ustalane z Szefem Kuchni na tydzień przed przyjęciem weselnym"), zaznacza dodatki, widzi cenę końcową, synchronizuje wybór dań głównych z modułem gości (RSVP) i opcjonalnie zamraża wszystko w umowie.

## 2. Stan obecny vs docelowy

| | Stan obecny | Stan docelowy |
|---|---|---|
| BE | brak routów catering — schema już jest | 4 routy CRUD + 3 endpointy biznesowe |
| FE | `pages/catering/catering.page.ts` to statyczny mock (hardcoded courses/addons) | `CateringService` + `CateringPage` z 3 stanami (empty/list/configure), `OfferEditor`, `PackageConfigurator`, `PriceSummary` |
| Seed | brak danych Pałacu Polanka | idempotentny `npm run seed:catering` ładujący ofertę 2026 dla wskazanego `weddingId` |
| Integracja | meal_options ręcznie z Ustawień | `POST /catering/selection/sync-meal-options` upsertuje meal_options z guest_picks |
| Budżet | wpis manualny | `POST /catering/selection/freeze-into-contract` tworzy umowę z totalem = computed price |

## 3. Dane wejściowe z PDF (autoritatywne dla seedu)

### Pakiety i ceny (z cennika)

| Pakiet | Cena / os | Modyfikowalny? | Liczba kursów |
|---|---|---|---|
| Szefa Kuchni | 315 zł | **NIE** (`is_modifiable = false`) | obiad (3) + 2 kolacje + bufet zimny 8 pozycji + napoje |
| Srebrny | 339 zł | TAK | obiad (3) + 2 kolacje + bufet zimny 9 pozycji + bufet sałatkowy 3 + napoje |
| Złoty | 374 zł | TAK | obiad (3) + 3 kolacje + bufet zimny 10 pozycji + bufet sałatkowy 3 + napoje |
| Diamentowy | 399 zł | TAK | obiad (3) + 4 kolacje + bufet zimny 11 pozycji + bufet sałatkowy 3 + napoje |

### Pakiet Szefa Kuchni — fixed dishes (`selection_mode = 'all_served'`)

| Course | Dish |
|---|---|
| obiad_zupa | Domowy rosół z makaronem, marchewką i natką pietruszki |
| obiad_danie_glowne | Polędwiczka wieprzowa marynowana w tymianku z purée truflowym, marchewką, groszkiem, sosem z palonej cebuli |
| obiad_deser | Szarlotka z lodami waniliowymi, bitą śmietaną i kruszoną bezą |
| kolacja_ciepla (I) | Filet z kurczaka z gnocchi w sosie serowym z gorgonzolą, brokułem w maśle migdałowym |
| kolacja_ciepla (II) | Barszcz z paluchem z ciasta francuskiego lub paszteciekiem |
| bufet_zimny | (choice_limit=8, `couple_picks` z bibliotek 22 pozycji) |
| napoje | (`all_served`, "Kawa, herbata, soki owocowe, woda mineralna - bez limitu") |

> **Wyjątek dla Szefa Kuchni**: bufet zimny i napoje są jedynymi kursami `couple_picks/all_served` w tym pakiecie — reszta jest sztywna (`is_modifiable = false` w `catering_packages` blokuje też dodawanie własnych dań do tych kursów).

### Pakiety Srebrny/Złoty/Diamentowy — selection_mode per kurs

| Course | selection_mode | choice_limit | Komentarz |
|---|---|---|---|
| obiad_zupa | couple_picks | 1 | wybór 1 z biblioteki 8 zup/kremów |
| obiad_danie_glowne | **guest_picks** | 3 | para wskazuje 3 opcje, każdy gość wybiera swoje przez RSVP |
| obiad_deser | couple_picks | 1 | wybór 1 z biblioteki 6 deserów |
| kolacja_ciepla (n) | couple_picks | 1 | wybór 1 z biblioteki 7 ciepłych kolacji *per kurs* |
| bufet_zimny | couple_picks | 9 / 10 / 11 | wg pakietu, z biblioteki 22 pozycji |
| bufet_salatkowy | couple_picks | 3 | z biblioteki 9 pozycji |
| napoje | all_served | (null) | kawa, herbata, soki, woda |

### Dish library (zaseedowana per offer)

- **5 przystawek** (z PDF: Podkarpacki proziak, Focaccia, Terrina drobiowa, Carpaccio z buraka, Mini burrata)
- **8 zup/kremów** (Domowy rosół, Rosół królewski, Krem grzybowy, Krem warzywny, Krem z kiszonego ogórka, Krem pomidorowy, Krem brokułowy, Krem pomidorowo-paprykowy)
- **5 dań głównych** (Schab nadziewany, Pieczeń wieprzowa, Pieczeń z indyka, Udko z kaczki, Polędwiczka wieprzowa)
- **7 ciepłych kolacji** (Roladka drobiowa, Bitki wołowe, Schab nadziewany grzybami, Żurek, Grzybowe kaszotto, Ziemniaczane gnocchi, Duszona karkówka)
- **4 dania ostatniej kolacji** (Barszcz z paluchem, Boeuf Stroganow, Węgierska zupa gulaszowa, Zupa meksykańska)
- **6 deserów serwowanych** (Ciepła szarlotka, Brownie, Ptyś, Beza Pavlova, Panna Cotta, Sernik czekoladowy)
- **22 pozycje bufetu zimnego** (PDF s. 8)
- **9 sałatek** (PDF s. 8)
- **10 dodatków do dań** (PDF s. 9 – nie kurs, raczej metadane do dania głównego, **out of MVP scope**)
- **8 surówek** (PDF s. 9 – same — out of MVP scope)

Flagi diety (z PDF inferowane):
- `is_vegetarian = true`: Focaccia z humusem, Mini burrata, Carpaccio z buraka, Krem grzybowy, Krem warzywny, Krem pomidorowy, Krem brokułowy, Grzybowe kaszotto, Ziemniaczane gnocchi (pesto pietruszkowe)
- `is_vegan = true`: (żadne z PDF nie kwalifikuje się jednoznacznie — wymóg klienta to **dodawanie własnych** dań wegetariańskich/wegańskich)
- `is_gluten_free = true`: pozostawione default false; klient może edytować

### Dodatki (`catering_addons`)

| Nazwa | Pricing unit | Default cena | Notatka |
|---|---|---|---|
| Pokrowce na krzesła | per_person | 18 zł | PDF nie podaje ceny — typowy rynek 15-25 |
| Korkowe | per_bottle | 25 zł | typowa wartość |
| Wiejski stół | per_event | 1 500 zł | typowy szacunek |
| Słodki stół + tort | per_event | 2 500 zł | typowy szacunek |
| Napoje gazowane | per_person | 12 zł | typowy |
| Przystawka serwowana | per_person | 24 zł | "Dodatkowo płatne" z PDF |
| Ciastkowe | per_event | 600 zł | usługa krojenia/serwowania |

> Ceny dodatków są placeholderami w seedzie — **konieczność edycji ręcznej** w UI (CRUD na addonach). PDF nie podaje cen, więc nie zgadujemy "autoritatywnie".

## 4. Architektura — Backend

### Routes (4 nowe pliki)

#### `routes/catering-offers.js`
- `GET /api/weddings/:weddingId/catering/offers` → lista ofert wesela
- `POST /api/weddings/:weddingId/catering/offers` → utworzenie pustej oferty (`name`, opcjonalny `vendor_id`, `valid_through`, `notes`)
- `GET /api/weddings/:weddingId/catering/offers/:offerId` → pełna struktura (packages + courses + dishes + addons w jednym responsie, łańcuch joinów + dwa SELECTy z `.in()`)
- `PATCH /api/weddings/:weddingId/catering/offers/:offerId` → name/vendor_id/valid_through/notes
- `DELETE /api/weddings/:weddingId/catering/offers/:offerId` → CASCADE usuwa packages/courses/dishes/addons + (przez ON DELETE RESTRICT na selection) blokuje gdy istnieje aktywna selection w tym pakiecie → zwraca 409 z komunikatem.
- Cross-wedding guard: assertWeddingRecordExists na `vendor_id`

#### `routes/catering-packages.js` (nested pod offer)
- `POST /offers/:offerId/packages` → name, price_per_person, is_modifiable, description, sort_order
- `PATCH /packages/:packageId` (na poziomie wedding)
- `DELETE /packages/:packageId`
- `POST /packages/:packageId/courses` → course_type, title, selection_mode, choice_limit (validacja: all_served ↔ choice_limit IS NULL)
- `PATCH /courses/:courseId`
- `DELETE /courses/:courseId`
- `POST /courses/:courseId/dishes` → link existing dish: `{ catering_dish_id, sort_order? }` (trigger `enforce_catering_course_dish_same_offer` waliduje same-offer)
- `DELETE /courses/:courseId/dishes/:dishId` → unlink

#### `routes/catering-dishes.js` (nested pod offer)
- `GET /offers/:offerId/dishes` → biblioteka dań tej oferty
- `POST /offers/:offerId/dishes` → name, description, is_vegetarian, is_vegan, is_gluten_free, allergens[] — **to jest endpoint dla custom vegetarian!**
- `PATCH /dishes/:dishId` → wszystkie pola powyżej
- `DELETE /dishes/:dishId` → cascade usuwa wpis z `catering_course_dishes`

#### `routes/catering-addons.js`
- `GET /offers/:offerId/addons`
- `POST /offers/:offerId/addons` → name, price, pricing_unit, description, sort_order
- `PATCH /addons/:addonId`
- `DELETE /addons/:addonId` → cascade z `wedding_catering_addon_picks`

#### `routes/catering-selection.js` (1:1 per wedding, na poziomie wedding)
- `GET /api/weddings/:weddingId/catering/selection` → bieżąca selection + dish_picks + addon_picks + computed price breakdown
- `PUT /api/weddings/:weddingId/catering/selection` (upsert):
  - body: `{ packageId, guestCountEstimate, notes? }`
  - jeśli istnieje selection na inny `package_id` → kasujemy stare dish_picks i addon_picks (CASCADE poprzez DELETE selection i INSERT na nowo), żeby nie zostawić sierot łączących się z innym pakietem
  - assertWeddingRecordExists na packageId via join offers
- `DELETE /api/weddings/:weddingId/catering/selection` → 204
- `POST /api/weddings/:weddingId/catering/selection/dish-picks` body `{ courseId, dishId }`:
  - waliduje `selection.catering_package_id == course.catering_package_id` (trigger to robi, ale FE chcemy 400 zamiast 500)
  - waliduje `count(picks for this course) < course.choice_limit` (jeśli choice_limit istnieje)
  - INSERT
- `DELETE /api/weddings/:weddingId/catering/selection/dish-picks/:courseId/:dishId` → unlink
- `PUT /api/weddings/:weddingId/catering/selection/addon-picks/:addonId` body `{ quantity }` → upsert
- `DELETE /api/weddings/:weddingId/catering/selection/addon-picks/:addonId`
- `GET /api/weddings/:weddingId/catering/selection/price` → breakdown:
  ```json
  {
    "packagePrice": 374,
    "guestCount": 100,
    "packageSubtotal": 37400,
    "addons": [{ "id": "...", "name": "Pokrowce", "unitPrice": 18, "pricingUnit": "per_person", "multiplier": 100, "quantity": 1, "subtotal": 1800 }],
    "addonsSubtotal": 2300,
    "total": 39700
  }
  ```
  multiplier wg `pricing_unit`: `per_person` → `guest_count`, `per_unit`/`per_bottle`/`per_hour` → `quantity` (default 1), `per_event` → 1.
- `POST /api/weddings/:weddingId/catering/selection/sync-meal-options` (idempotentny):
  - dla każdego `course` z `selection_mode = 'guest_picks'` i wpisami w `dish_picks`:
    - dla każdego picked dish → upsert do `meal_options` (label = dish.name, wedding_id = weddingId)
    - sort_order: kolejność per course / sort_order picksów
  - usuń meal_options nie odpowiadające żadnemu picksowi z tej selection **gdy** label dokładnie matchuje wcześniej zsynchronizowane danie (heurystyka: trzymamy `meal_option.label` jako klucz; jeśli para edytuje label ręcznie po sync — nie kasujemy)
  - **Decyzja**: w MVP **nie kasujemy** żadnych meal_options auto (żeby nie zgubić ręcznych). Zwracamy `{ created, updated, skippedManual }`.
- `POST /api/weddings/:weddingId/catering/selection/freeze-into-contract`:
  - body: `{ vendorId, signedDate, deposit?: { amount, dueDate, method }, finalPayment?: { amount, dueDate, method } }`
  - walidacja: vendor.category in ('sala', 'catering'); jeśli deposit/finalPayment podane → suma == computed total
  - **Atomowość** (sekwencyjny rollback): INSERT contract z `wedding_catering_selection_id` + `total_amount` → opcjonalny INSERT payments (zaliczka, final) → przy błędzie rollback ręcznie (DELETE wstecz)
  - Zwraca `{ contract, payments[] }`

### Mappers (nowe wpisy w `utils/mappers.js`)
- `mapCateringOffer(offer)` (płaski, bez nested)
- `mapCateringOfferFull(offer, packages, courses, dishes, courseDishLinks, addons)` (dla GET single offer)
- `mapCateringPackage(package, courses?, courseDishCounts?)`
- `mapCateringCourse(course, dishes?)`
- `mapCateringDish(dish)`
- `mapCateringAddon(addon)`
- `mapCateringSelection(selection, dishPicks, addonPicks, package?)`
- `mapPriceBreakdown(packagePrice, guestCount, addonsResolved)` (pure compute, no DB)

### Mount w `server.js`

```js
app.use("/api/weddings/:weddingId/catering/offers", requireSsoAuth, cateringOffersRouter);
app.use("/api/weddings/:weddingId/catering/packages", requireSsoAuth, cateringPackagesRouter);
app.use("/api/weddings/:weddingId/catering/courses", requireSsoAuth, cateringPackagesRouter); // share router via path
app.use("/api/weddings/:weddingId/catering/dishes", requireSsoAuth, cateringDishesRouter);
app.use("/api/weddings/:weddingId/catering/addons", requireSsoAuth, cateringAddonsRouter);
app.use("/api/weddings/:weddingId/catering/selection", requireSsoAuth, cateringSelectionRouter);
```
> Decyzja architektoniczna: zamiast głęboko zagnieżdżonych ścieżek (`/offers/:offerId/packages/:packageId/...`) używamy płaskich `/packages/:packageId/...` z wedding-scoped walidacją (`requireWeddingMember` + każdy mutating endpoint sprawdza że package → offer → wedding == weddingId).

## 5. Architektura — Frontend

### Modele (`core/models/catering.model.ts`)

```ts
type CourseType = 'obiad_zupa' | 'obiad_danie_glowne' | 'obiad_deser' | 'przystawka' | 'kolacja_ciepla' | 'deser_serwowany' | 'bufet_zimny' | 'bufet_salatkowy' | 'dodatki' | 'surowki' | 'wiejski_stol' | 'slodki_stol' | 'napoje' | 'inne';
type SelectionMode = 'all_served' | 'couple_picks' | 'guest_picks';
type PricingUnit = 'per_person' | 'per_event' | 'per_bottle' | 'per_hour' | 'per_unit';

interface CateringOffer { id, weddingId, vendorId, vendorName, name, validThrough, notes }
interface CateringPackage { id, offerId, name, pricePerPerson, isModifiable, description, sortOrder }
interface CateringCourse { id, packageId, courseType, title, selectionMode, choiceLimit, sortOrder, dishes: LinkedDish[] }
interface LinkedDish { id, dishId, name, isVegetarian, isVegan, isGlutenFree, allergens, sortOrder }
interface CateringDish { id, offerId, name, description, isVegetarian, isVegan, isGlutenFree, allergens }
interface CateringAddon { id, offerId, name, price, pricingUnit, description, sortOrder }
interface CateringSelection {
  id, weddingId, packageId, packageName, guestCountEstimate, notes,
  dishPicks: { courseId, dishId, dishName }[],
  addonPicks: { addonId, addonName, quantity, pricingUnit, unitPrice }[],
}
interface PriceBreakdown { packagePrice, guestCount, packageSubtotal, addons: AddonLine[], addonsSubtotal, total }
```

### `CateringService` (signal-based)

```ts
_offers, _activeOffer (z packages+courses+dishes+addons), _selection, _priceBreakdown, _mealOptionsInSync
```

Metody:
- `loadOffers/createOffer/updateOffer/deleteOffer`
- `loadOffer(offerId)` — pełna struktura
- `createPackage / updatePackage / deletePackage`
- `createCourse / updateCourse / deleteCourse`
- `linkDishToCourse / unlinkDishFromCourse`
- `createDish / updateDish / deleteDish` — w tym custom vegetarian!
- `createAddon / updateAddon / deleteAddon`
- `loadSelection / upsertSelection / deleteSelection`
- `addDishPick / removeDishPick`
- `setAddonPick / removeAddonPick`
- `loadPrice` (refresh po każdej mutacji)
- `syncMealOptions(weddingId)` → po sukcesie `MealOptionsService.list(weddingId)`
- `freezeIntoContract(weddingId, dto)` → po sukcesie `ContractsService.list(weddingId)` + `PaymentsService` refresh

### `CateringPage` — 3 stany

#### Stan 1: empty (`offers().length === 0`)
- Ilustracja + tekst "Wprowadź ofertę swojej sali, aby zacząć planować menu"
- CTA "Dodaj ofertę" → otwiera dialog z nazwą (default: "Pałac Polanka 2026") + vendor combobox (filter category in sala/catering, opcjonalny) + przycisk "Załaduj Pałac Polanka 2026" (idempotentny seed via API call do `POST /offers` z body `{ name, preset: 'palac-polanka-2026' }`)
  - **Decyzja**: preset robi BE, nie FE. BE rozpoznaje `preset` i ładuje seed (4 pakiety, ~50 dań, 7 addonów). Jeśli preset nieznany → 400.

#### Stan 2: list (`offers().length > 0` && `!selection.activeOffer`)
- Lista ofert (zwykle 1, ale schema dopuszcza wiele) z licznikami: "4 pakiety · 50 dań · 7 dodatków"
- CTA per oferta: "Konfiguruj menu" (przechodzi do Stan 3) | "Edytuj ofertę" (OfferEditor) | "Usuń"
- Górny CTA "Dodaj nową ofertę"

#### Stan 3: configure (`selection.activeOffer` + bieżąca selection)
- **Header**: nazwa oferty + przycisk "Edytuj ofertę" (modal OfferEditor)
- **PackageTabs**: 4 zakładki (Szefa Kuchni / Srebrny / Złoty / Diamentowy) — przy zmiany tabu = upsert selection na nowy package (z confirm dialogiem "Twoje wybory dla bieżącego pakietu zostaną usunięte. Kontynuować?")
- **GuestCountStepper**: input z `+`/`-`, default = liczba `confirmed` gości z `GuestsService.aggregates`, ale ręcznie edytowalny
- **PackageInfoCard**: cena per osoba + opis pakietu + readonly flag "Pakiet nie podlega modyfikacjom" jeśli `is_modifiable = false`
- **Po kursie (CourseSection)** dla każdego course w bieżącym pakiecie:
  - tytuł + hint ("Każdy gość wybiera 1" / "Para wybiera 3 z 8" / "Bez wyboru, podawane wszystkim")
  - lista dań (DishCard) z biblioteki dla tego kursu (course_dishes joined)
    - checkbox/radio wg `selection_mode`:
      - `all_served`: wyłączone, wszystkie zaznaczone
      - `couple_picks` z `choice_limit = 1`: radio
      - `couple_picks` z `choice_limit > 1`: checkbox z licznikiem "Wybrano X / N"
      - `guest_picks`: checkbox (para wskazuje opcje, których goście będą wybierać przez RSVP)
    - ikony diety (🌱 vege / 🌿 vegan / 🌾 GF) + tooltip alergenów (jeśli `is_vegetarian=true` → 🌱)
  - **Sekcja "Dodaj własne danie"** (widoczna gdy `package.is_modifiable = true`):
    - Inline form: nazwa + flagi (vege/vegan/GF) + opcjonalny opis → `createDish` + auto-link do bieżącego kursu (`linkDishToCourse`)
    - **TO JEST UX dla custom vegetarian** — para może dla "Obiad / danie główne" w Złotym dodać "Kotlety z ciecierzycy z purée selerowym" jako `is_vegetarian=true, is_vegan=true` i automatycznie pojawia się on jako opcja dla gości
- **AddonsList**: checkbox na każdy addon + quantity stepper (gdy `pricing_unit != 'per_event'`). Edytuje `addon-picks`.
- **PriceSummary** (sticky desktop right column / sticky bottom mobile):
  - Pakiet × goście = subtotal
  - Lista zaznaczonych dodatków z multiplierem
  - Total bold
  - Dwa CTA:
    - **"Synchronizuj z RSVP"** → `syncMealOptions` → toast "Utworzono N opcji dań dla gości"
    - **"Zamroź w umowie"** → otwiera `FreezeContractDialog`
- **FreezeContractDialog**:
  - Vendor combobox filtrujący `category in (sala, catering)` (z `VendorsService`)
  - `signedDate` (date input, default = today)
  - Toggle "Dodaj harmonogram płatności" → dwa wiersze (zaliczka + final), suma musi == total, metoda = `gotówka`/`przelew`
  - Submit → `freezeIntoContract` → toast "Umowa utworzona" + redirect do `/app/umowy` (lub inline navigate)

### OfferEditor (modal/dialog, dostępny ze Stan 2 i Stan 3)

4 zakładki:

1. **Pakiety** — tabela 4 wierszy (nazwa, cena, is_modifiable, sort_order, akcje). Inline edit + "Dodaj pakiet".
2. **Kursy** — wybór pakietu z dropdownu + tabela kursów (course_type, title, selection_mode, choice_limit, sort_order, akcje). Drag-handle do sort_order (opcjonalnie w MVP — można pominąć i użyć number input).
3. **Dania** — biblioteka tej oferty: tabela (name, flagi, allergens, opis, akcje). "Dodaj danie" + inline edit. Filter po flagach.
4. **Dodatki** — tabela addons (name, price, pricing_unit, description, akcje). Inline edit + "Dodaj dodatek".

Zakładka 2 ma drugi panel "Dania w kursie": po wyborze kursu → lista linked dishes z `+ Dodaj` (multi-select z biblioteki) i `× Usuń`.

### Routes + AppSidebar

`app.routes.ts`: trasa `/app/oferta-sali` już istnieje (`pages/catering`).
`AppSidebar`: link "Oferta sali" już istnieje, między Budżetem a Zadaniami.

## 6. Workflow użytkownika (happy path dla Weroniki i Kacpra)

1. Wchodzą na `/app/oferta-sali` → widzą empty state → klikają "Załaduj Pałac Polanka 2026"
2. BE seed creates: 1 offer "Pałac Polanka 2026" + 4 packages + ~50 dishes + 7 addons + ~25 courses
3. Auto-przejście do Stan 3 z `package = Złoty` (default najpopularniejszy) + `guestCount = 100`
4. Konfigurują:
   - Obiad/zupa: wybierają "Krem grzybowy z makaronem grandine"
   - Obiad/danie główne (guest_picks): zaznaczają 3 opcje — "Pieczeń z indyka", "Udko z kaczki", "Polędwiczka wieprzowa"
   - **Dodają własne danie wegetariańskie**: "Roladka z bakłażana z ricottą i szpinakiem" z flagą `is_vegetarian=true`, auto-link do "Obiad / danie główne"
   - Bufet zimny: zaznaczają 10 pozycji (limit 10 dla Złotego)
   - Sałatki: 3 pozycje
   - 3 kolacje: po 1 daniu każda
   - Dodatki: Pokrowce + Wiejski stół
5. PriceSummary pokazuje: `374 × 100 + 18 × 100 + 1500 = 41 200 zł`
6. Klikają "Synchronizuj z RSVP" → toast "Utworzono 4 opcje dań" — w `/app/goscie` pojawiają się 4 opcje w dropdownie meal_option
7. Klikają "Zamroź w umowie" → wybierają vendor "Pałac Polanka" (lub dodają inline), zaliczka 10 000 zł / przelew / 2026-06-01, final 31 200 zł / przelew / 2026-07-20 → submit
8. Redirect do `/app/umowy` → widzą nową umowę z 2 płatnościami i statusem `pending` → po opłaceniu zaliczki status → `deposit_paid`

## 7. Seed Pałac Polanka 2026

**Decyzja**: seed jako `POST /catering/offers` z body `{ name, preset: 'palac-polanka-2026' }`. BE rozpoznaje preset, ładuje hardcoded fixture z `seed/palac-polanka-2026.js`:

```
backend/src/seed/
├── palac-polanka-2026.js  (eksportuje { packages, dishes, courses, links, addons })
└── README.md              (jak dodać kolejny preset)
```

Idempotentność: jeśli oferta o nazwie "Pałac Polanka 2026" już istnieje dla tego wesela → 409 (couple musi usunąć starą najpierw). **Nie robimy upsert ID-by-ID** — komplikacja niewarta zachodu w MVP.

Fixture zawiera dokładną listę z sekcji 3. tego dokumentu. Ceny addonów są placeholderami (komentarz w fixture: "Adjust after vendor confirmation").

## 8. Testy

`test/catering-offers-crud.test.js`:
- POST offer empty (bez preset)
- POST offer z presetem `palac-polanka-2026` → tworzy 4 packages + ~50 dishes + ~25 courses + 7 addons; weryfikujemy że odpowiednia ilość rekordów w db
- POST offer z presetem `unknown` → 400
- GET single offer → struktura zagnieżdżona
- DELETE offer z aktywną selection → 409
- Cross-wedding vendor reject

`test/catering-selection.test.js`:
- PUT selection (upsert) na nowy pakiet → kasuje picks ze starego
- POST dish-pick przekraczający choice_limit → 400 "course choice limit reached"
- POST dish-pick z dish z innej oferty → 400 (trigger lub manualna walidacja)
- POST dish-pick na course z `selection_mode='all_served'` → 400 "course does not accept picks"
- GET price z `per_event`/`per_person`/`per_bottle` addonami → poprawny breakdown
- POST sync-meal-options idempotentny: drugi call nie tworzy duplikatów
- POST freeze-into-contract z zaliczką+final → tworzy contract + 2 payments, suma OK
- POST freeze-into-contract z vendor.category='fotograf' → 400
- POST freeze-into-contract z deposit+final sumującą się do != total → 400

`test/catering-dishes-crud.test.js`:
- POST dish z flagami → zwraca poprawne flagi
- DELETE dish unlink z course_dishes
- Cross-wedding offer reject

## 9. Acceptance criteria

Pełne kryteria (do weryfikacji po implementacji):

- [ ] `npm test` w backend → wszystkie testy zielone (M5+M7+M8+M9 + nowe M6: ~20-25 nowych testów → ~95-100 total)
- [ ] `npx tsc --noEmit` w frontend → clean
- [ ] `npm run build` w frontend → clean
- [ ] Manualny smoke test dla naszego wesela:
  - [ ] Empty state → "Załaduj Pałac Polanka 2026" → widzę 4 pakiety
  - [ ] Wybór Złotego → cena = 374 × X = poprawna kalkulacja
  - [ ] Dodaj własne danie wegetariańskie do "Obiad / danie główne" → pojawia się w liście picków, ma ikonę 🌱
  - [ ] guestCountEstimate stepper aktualizuje cenę real-time
  - [ ] Sync meal options → w `/app/goscie` dropdown zawiera nowe opcje
  - [ ] Freeze contract → w `/app/umowy` nowa umowa z poprawnym total + 2 płatnościami; payment status synchronizuje status umowy
  - [ ] Edycja oferty (OfferEditor) → mogę zmienić cenę Złotego z 374 na 380 → PriceSummary aktualizuje się
  - [ ] Pakiet Szefa Kuchni: próba zaznaczenia dania głównego innego niż "Polędwiczka wieprzowa" → niemożliwe (radio disabled, fixed)
- [ ] Polski UI wszędzie, `formatPLN`, OnPush, signals, standalone, `@if`/`@for`
- [ ] Brak ruszania: budget/tasks/seating/dashboard/contracts/vendors poza dodaniem wpisu w `ContractsService.list` po freeze

## 10. Otwarte pytania (do potwierdzenia z PO przed implementacją)

- [ ] **Dodatki — ceny placeholder vs zostawić puste?** Decyzja: placeholder 0 zł z hintem "Ustaw cenę" w UI — para musi świadomie wprowadzić wartości po rozmowie z managerem Pałacu.
- [ ] **Wiele ofert per wesele** — schema dopuszcza, ale UX zakłada że typowo 1. Decyzja: schema bez zmian, UI obsługuje listę ale w empty state seedujemy tylko jedną. Para może dodać kolejną manualnie.
- [ ] **Selection ↔ Package transition (zmiana pakietu)** — czy ostrzegać przed utratą picksów? Decyzja: **confirm dialog**, bo strata pracy. Po confirm: kasujemy picks ze starego pakietu (CASCADE przez DELETE selection + INSERT new).
- [ ] **Sort_order dishes w course** — drag-handle czy number input? Decyzja MVP: **number input** (mniej skomplikowane, można dopisać DnD w M10 polish).

---

## Plan plików do utworzenia

### Backend
```
src/routes/
├── catering-offers.js       (CRUD offer + preset loader)
├── catering-packages.js     (packages + courses + course_dishes link)
├── catering-dishes.js       (dish library CRUD)
├── catering-addons.js       (addon CRUD)
└── catering-selection.js    (selection + picks + price + sync + freeze)

src/seed/
├── palac-polanka-2026.js    (fixture eksportujący structure)
└── presets.js               (registry { 'palac-polanka-2026': require('./palac-polanka-2026') })

src/utils/mappers.js         (rozszerzenie o mapCatering*)
src/server.js                (mount 5 nowych routów)
```

### Frontend
```
src/app/core/models/
└── catering.model.ts         (typy)

src/app/core/services/
└── catering.service.ts       (signal-based, jak BudgetService)

src/app/pages/catering/
├── catering.page.ts           (rebuild — 3 stany)
├── catering.page.html
├── catering.page.scss
├── components/
│   ├── offer-editor/          (modal 4-tab)
│   ├── package-tabs/
│   ├── course-section/        (z DishCard list + "Dodaj własne danie" form)
│   ├── dish-card/
│   ├── addons-list/
│   ├── price-summary/
│   └── freeze-contract-dialog/
```

### Testy
```
backend/test/
├── catering-offers-crud.test.js
├── catering-selection.test.js
└── catering-dishes-crud.test.js
```

### Dokumentacja
- Po implementacji: update `docs/demo-app/05-implementation-plan.md` § M6 z `[x]` zamiast `[ ]` na ukończonych pozycjach + status update w CLAUDE.md "M6 complete".
