# Vendors Page Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Przebudowa zakładki kontrahentów: 7-stopniowa oś statusów (migracja DB), usunięcie wpisów o brakujących kontrahentach z dashboardu i strony kontrahentów, naprawa layoutu checkboxa harmonogramu płatności, kafelki bez myślników.

**Architecture:** Backend Express + Supabase Postgres (mock-Supabase w testach `node --test`), frontend Angular standalone + signals. Statusy vendora to kolumna `text` z CHECK constraint — zmiana wymaga migracji Supabase (konwencja repo: najpierw `docs/demo-app/04-database.md`, potem migracja, potem `npx supabase db push`, potem kod). Wpisy „Brakuje kontrahenta" generują dwa niezależne miejsca: `attentionItems` w dashboardzie (`routes/weddings.js`) i endpoint `GET /vendors/missing` konsumowany przez panel na stronie kontrahentów — oba usuwamy w całości razem z martwym kodem.

**Tech Stack:** Express, Supabase (Postgres), node:test + mock-supabase harness, Angular 20 (signals, `@if`/`@for`), SCSS.

**Spec:** `docs/superpowers/specs/2026-06-09-vendors-page-rework-design.md`

**Mapowanie statusów (kontrakt całego planu):**

| Wartość enum | Etykieta PL | Badge |
|---|---|---|
| `rozwazany` | rozważany | `badge--neutral` |
| `spotkanie` | spotkanie umówione | `badge--warning` |
| `zarezerwowany` | zarezerwowany | `badge--info` |
| `umowa_podpisana` | umowa podpisana | `badge--success` |
| `zaliczka_wplacona` | zaliczka wpłacona | `badge--success` |
| `oplacony` | opłacony w całości | `badge--success` |
| `zrealizowany` | zrealizowany | `badge--success` |

Remap istniejących danych: `zaplacony` → `oplacony`, `wykonany` → `zrealizowany`.

---

### Task 1: Aktualizacja `04-database.md` (doc-first, konwencja repo)

**Files:**
- Modify: `docs/demo-app/04-database.md:162` (tabela kolumn vendors)
- Modify: `docs/demo-app/04-database.md:665-666` (DDL)

- [ ] **Step 1: Zmień wiersz `status` w tabeli kolumn vendors (linia 162)**

Zamień:

```markdown
| status           | text CHECK (status IN ('rozwazany','spotkanie','zarezerwowany','zaplacony','wykonany')) | NO | `'rozwazany'` | Observed | 5 statusów w chips na górze            |
```

na:

```markdown
| status           | text CHECK (status IN ('rozwazany','spotkanie','zarezerwowany','umowa_podpisana','zaliczka_wplacona','oplacony','zrealizowany')) | NO | `'rozwazany'` | Observed | 7 statusów — pełna oś postępu (migracja `vendor_status_rework`, 2026-06-09: `zaplacony`→`oplacony`, `wykonany`→`zrealizowany`) |
```

- [ ] **Step 2: Zmień DDL (linie 665-666)**

Zamień:

```sql
  status            text NOT NULL DEFAULT 'rozwazany' CHECK (status IN
    ('rozwazany','spotkanie','zarezerwowany','zaplacony','wykonany')),
```

na:

```sql
  status            text NOT NULL DEFAULT 'rozwazany' CHECK (status IN
    ('rozwazany','spotkanie','zarezerwowany','umowa_podpisana','zaliczka_wplacona','oplacony','zrealizowany')),
```

- [ ] **Step 3: Commit**

```bash
git add docs/demo-app/04-database.md
git commit -m "docs(db): vendors.status — 7-stopniowa oś postępu zamiast 5 statusów"
```

---

### Task 2: Migracja `vendor_status_rework`

**Files:**
- Create: `wedding-planner/backend/supabase/migrations/<timestamp>_vendor_status_rework.sql` (timestamp nadaje CLI)

- [ ] **Step 1: Utwórz plik migracji**

Run (w `wedding-planner/backend/`):

```bash
npx supabase migration new vendor_status_rework
```

Expected: nowy pusty plik `supabase/migrations/<timestamp>_vendor_status_rework.sql`.

- [ ] **Step 2: Wpisz SQL do nowego pliku**

```sql
-- Vendors: pelna os postepu statusow (7 wartosci zamiast 5).
-- Remap: zaplacony -> oplacony, wykonany -> zrealizowany.
-- Inline CHECK z m1 dostal auto-nazwe vendors_status_check.

alter table public.vendors drop constraint if exists vendors_status_check;

update public.vendors set status = 'oplacony' where status = 'zaplacony';
update public.vendors set status = 'zrealizowany' where status = 'wykonany';

alter table public.vendors add constraint vendors_status_check check (
  status in (
    'rozwazany',
    'spotkanie',
    'zarezerwowany',
    'umowa_podpisana',
    'zaliczka_wplacona',
    'oplacony',
    'zrealizowany'
  )
);
```

- [ ] **Step 3: Zweryfikuj nazwę constraintu przed pushem**

Przez Supabase MCP `execute_sql` (albo SQL editor):

```sql
select conname from pg_constraint
where conrelid = 'public.vendors'::regclass and contype = 'c';
```

Expected: dokładnie jeden wynik `vendors_status_check`. Jeśli nazwa inna — popraw ją w `drop constraint` w pliku migracji.

- [ ] **Step 4: Push migracji**

Run (w `wedding-planner/backend/`):

```bash
npx supabase db push
```

Expected: `Applying migration <timestamp>_vendor_status_rework.sql... Finished`. (Konwencja repo: migracja bez pusha to najczęstszy błąd — nie pomijaj. Po pushu na dysku jest 14 migracji.)

- [ ] **Step 5: Zweryfikuj remap na żywej bazie**

Przez `execute_sql`:

```sql
select status, count(*) from public.vendors group by status order by status;
```

Expected: zero wierszy ze statusem `zaplacony` lub `wykonany`.

- [ ] **Step 6: Commit**

```bash
git add wedding-planner/backend/supabase/migrations/
git commit -m "feat(db): migracja vendor_status_rework — 7 statusów vendora + remap danych"
```

---

### Task 3: Backend — nowe statusy + usunięcie `GET /vendors/missing` (TDD)

**Files:**
- Modify: `wedding-planner/backend/src/routes/vendors.js:29-30` (VENDOR_STATUSES, SECURED_STATUSES), `:187-204` (route `/missing`)
- Test: `wedding-planner/backend/test/resource-crud.test.js:285-323`

- [ ] **Step 1: Przepisz test vendorów na nowy enum i brak `/missing`**

W `resource-crud.test.js` zamień cały test `it("creates, updates, lists, and deletes vendors", ...)` (linie 285-323) na:

```js
  it("creates, updates, lists, and deletes vendors", async () => {
    const created = await request(server, "POST", "/api/weddings/wedding-1/vendors", {
      category: "fotograf",
      companyName: "Kadr i Swiatlo",
      contactPerson: "Tomasz",
      phone: "+48 500 300 400",
      email: "foto@example.com",
      status: "zaliczka_wplacona",
      contractAmount: 8500,
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.companyName, "Kadr i Swiatlo");
    assert.equal(created.body.status, "zaliczka_wplacona");
    assert.equal(created.body.hasContract, false);

    const updated = await request(
      server,
      "PATCH",
      `/api/weddings/wedding-1/vendors/${created.body.id}`,
      { status: "umowa_podpisana", notes: "Podpis do potwierdzenia" },
    );
    assert.equal(updated.status, 200);
    assert.equal(updated.body.status, "umowa_podpisana");

    const list = await request(
      server,
      "GET",
      "/api/weddings/wedding-1/vendors?status=umowa_podpisana",
    );
    assert.equal(list.status, 200);
    assert.equal(list.body.length, 1);

    const legacyStatus = await request(server, "POST", "/api/weddings/wedding-1/vendors", {
      category: "dj",
      companyName: "Stary Enum",
      status: "zaplacony",
    });
    assert.equal(legacyStatus.status, 400);

    const missing = await request(server, "GET", "/api/weddings/wedding-1/vendors/missing");
    assert.equal(missing.status, 404);

    const removed = await request(
      server,
      "DELETE",
      `/api/weddings/wedding-1/vendors/${created.body.id}`,
    );
    assert.equal(removed.status, 204);
  });
```

Uwaga: `GET /vendors/missing` po usunięciu route'a wpada w `GET /:vendorId` z `vendorId = "missing"` — mock-supabase nie znajdzie wiersza, więc oczekujemy 404. Jeśli w praktyce handler listy `GET /` z parametrem zwróci co innego, dostosuj asercję do faktycznego zachowania (404 od `maybeSingle` jest oczekiwane); nie zostawiaj asercji na 200.

- [ ] **Step 2: Uruchom test — ma failować**

Run (w `wedding-planner/backend/`):

```bash
node --test test/resource-crud.test.js
```

Expected: FAIL — `status: "zaliczka_wplacona"` odrzucone 400 (nie ma go w `VENDOR_STATUSES`), `/missing` zwraca 200.

- [ ] **Step 3: Zaimplementuj w `routes/vendors.js`**

Zamień linie 29-30:

```js
const VENDOR_STATUSES = ["rozwazany", "spotkanie", "zarezerwowany", "zaplacony", "wykonany"];
const SECURED_STATUSES = ["zarezerwowany", "zaplacony", "wykonany"];
```

na:

```js
const VENDOR_STATUSES = [
  "rozwazany",
  "spotkanie",
  "zarezerwowany",
  "umowa_podpisana",
  "zaliczka_wplacona",
  "oplacony",
  "zrealizowany",
];
```

Usuń cały blok route'a `/missing` (linie 187-204):

```js
router.get("/missing", async (req, res, next) => {
  ...
});
```

`VENDOR_CATEGORIES` w tym pliku zostaje (używane w walidacji create/patch).

- [ ] **Step 4: Uruchom test — ma przechodzić**

Run: `node --test test/resource-crud.test.js`
Expected: PASS (wszystkie testy pliku — w tym cross-wedding test, który używa `status: "rozwazany"`, nadal ważnego).

Uwaga: jeśli `GET /vendors/missing` nie zwróci 404 — sprawdź faktyczny status w output i popraw asercję z kroku 1 zgodnie z rzeczywistym routingiem; nie zmieniaj implementacji na siłę.

- [ ] **Step 5: Commit**

```bash
git add src/routes/vendors.js test/resource-crud.test.js
git commit -m "feat(vendors): 7-stopniowy enum statusów, usunięty GET /vendors/missing"
```

---

### Task 4: Backend — dashboard bez wpisów „Brakuje kontrahenta" (TDD)

**Files:**
- Modify: `wedding-planner/backend/src/routes/weddings.js:28-40` (VENDOR_CATEGORIES, SECURED_VENDOR_STATUSES), `:115-122` (missingVendorCategories), `:158`, `:174-179`
- Test: `wedding-planner/backend/test/dashboard.test.js:110-111`

- [ ] **Step 1: Zaktualizuj asercje w `dashboard.test.js`**

Zamień linie 110-111:

```js
    assert.equal(response.body.attentionItems.length, 5);
    assert.equal(response.body.attentionItems[0].type, "task");
```

na:

```js
    assert.equal(response.body.attentionItems.length, 2);
    assert.equal(response.body.attentionItems[0].type, "task");
    assert.equal(response.body.attentionItems[1].type, "payment");
    assert.equal(
      response.body.attentionItems.some((item) => item.type === "vendor"),
      false,
    );
```

(Seed ma 1 zaległe zadanie i 1 płatność po terminie; dotąd listę do 5 dopełniały wpisy vendor.)

- [ ] **Step 2: Uruchom test — ma failować**

Run (w `wedding-planner/backend/`): `node --test test/dashboard.test.js`
Expected: FAIL — `attentionItems.length` wynosi 5, nie 2.

- [ ] **Step 3: Zaimplementuj w `routes/weddings.js`**

Usuń (linie 28-40):

```js
const VENDOR_CATEGORIES = [
  "sala",
  "catering",
  "fotograf",
  "dj",
  "dekoratorka",
  "kosciol",
  "makijaz",
  "dekoracje",
  "slodki_stol_tort",
  "ciasta_pozegnalne",
];
const SECURED_VENDOR_STATUSES = ["zarezerwowany", "zaplacony", "wykonany"];
```

Usuń funkcję `missingVendorCategories` (linie 115-122):

```js
function missingVendorCategories(vendors) {
  const secured = new Set(
    vendors
      .filter((vendor) => SECURED_VENDOR_STATUSES.includes(vendor.status))
      .map((vendor) => vendor.category),
  );
  return VENDOR_CATEGORIES.filter((category) => !secured.has(category));
}
```

W `buildDashboard` usuń linię 158:

```js
  const missingVendors = missingVendorCategories(vendors);
```

oraz blok w `attentionItems` (linie 174-179):

```js
    ...missingVendors.map((category) => ({
      type: "vendor",
      title: `Brakuje kontrahenta: ${category}`,
      meta: "Kategoria nie ma zabezpieczonego statusu",
      route: "/app/kontrahenci",
    })),
```

`vendors` w `Promise.all` i `vendorsById` ZOSTAJĄ — używane przez wpisy płatności i `upcomingMeetings`.

- [ ] **Step 4: Uruchom test — ma przechodzić**

Run: `node --test test/dashboard.test.js`
Expected: PASS.

- [ ] **Step 5: Pełna suita backendu**

Run (w `wedding-planner/backend/`): `npm test`
Expected: wszystkie suity zielone (po Taskach 3-4 nic poza nimi nie dotyka vendorów/dashboardu).

- [ ] **Step 6: Commit**

```bash
git add src/routes/weddings.js test/dashboard.test.js
git commit -m "feat(dashboard): usunięte wpisy o brakujących kontrahentach z attention items"
```

---

### Task 5: Frontend — model statusów + kolory badge

**Files:**
- Modify: `wedding-planner/frontend/src/app/core/models/vendor.model.ts:13`, `:71-77`
- Modify: `wedding-planner/frontend/src/app/pages/vendors/vendors.page.ts:228-236`

- [ ] **Step 1: Zaktualizuj `vendor.model.ts`**

Zamień linię 13:

```ts
export type VendorStatus = 'rozwazany' | 'spotkanie' | 'zarezerwowany' | 'zaplacony' | 'wykonany';
```

na:

```ts
export type VendorStatus =
  | 'rozwazany'
  | 'spotkanie'
  | 'zarezerwowany'
  | 'umowa_podpisana'
  | 'zaliczka_wplacona'
  | 'oplacony'
  | 'zrealizowany';
```

Zamień `VENDOR_STATUS_LABELS` (linie 71-77):

```ts
export const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  rozwazany: 'rozważany',
  spotkanie: 'spotkanie umówione',
  zarezerwowany: 'zarezerwowany',
  umowa_podpisana: 'umowa podpisana',
  zaliczka_wplacona: 'zaliczka wpłacona',
  oplacony: 'opłacony w całości',
  zrealizowany: 'zrealizowany',
};
```

(Kolejność kluczy = kolejność opcji w selectach — `STATUSES` w `vendors.page.ts` powstaje z `Object.keys`.)

- [ ] **Step 2: Zaktualizuj `statusClass` w `vendors.page.ts`**

Zamień metodę (linie 228-236):

```ts
  protected statusClass(status: VendorStatus): string {
    return {
      rozwazany: 'badge--neutral',
      spotkanie: 'badge--warning',
      zarezerwowany: 'badge--info',
      umowa_podpisana: 'badge--success',
      zaliczka_wplacona: 'badge--success',
      oplacony: 'badge--success',
      zrealizowany: 'badge--success',
    }[status];
  }
```

- [ ] **Step 3: Build — weryfikacja typów**

Run (w `wedding-planner/frontend/`):

```bash
npm run build
```

Expected: build zielony. `Record<VendorStatus, string>` wymusza kompletność obu map — brakujący klucz = błąd kompilacji.

- [ ] **Step 4: Commit**

```bash
git add src/app/core/models/vendor.model.ts src/app/pages/vendors/vendors.page.ts
git commit -m "feat(vendors-fe): 7 statusów z polskimi etykietami i kolorami badge"
```

---

### Task 6: Frontend — usunięcie panelu „Brakujące kategorie" i martwego kodu

**Files:**
- Modify: `wedding-planner/frontend/src/app/pages/vendors/vendors.page.html:5-21`
- Modify: `wedding-planner/frontend/src/app/pages/vendors/vendors.page.ts` (importy, `missingCategoryLabels`, `refreshMissing`, `loadResources`, wywołania w add/save/remove)
- Modify: `wedding-planner/frontend/src/app/core/services/vendors.service.ts:14-15`, `:23-27`

- [ ] **Step 1: Usuń panel z `vendors.page.html`**

Usuń sekcję (linie 6-21) — `<div class="page-stack">` na linii 5 zostaje:

```html
  <section class="surface panel">
    <div class="panel__header">
      <div>
        <p class="panel__eyebrow">Wymaga uwagi</p>
        <h2>Brakujące kategorie</h2>
      </div>
      <span class="badge badge--warning">{{ vendorsService.missingCategories().length }} kategorii</span>
    </div>
    <p class="muted">
      @if (vendorsService.missingCategories().length) {
        Do potwierdzenia: {{ missingCategoryLabels() }}.
      } @else {
        Najważniejsze kategorie są zabezpieczone.
      }
    </p>
  </section>
```

- [ ] **Step 2: Wyczyść `vendors.page.ts`**

1. Usuń metodę `missingCategoryLabels()` (linie 217-222) i metodę `refreshMissing()` (linie 282-286).
2. W `addVendor()`, `saveVendor()`, `removeVendor()` usuń linie `this.refreshMissing(weddingId);` (po jednej w każdym callbacku `next`).
3. Zamień `loadResources` (linie 276-280):

```ts
  private loadResources(weddingId: string): void {
    this.vendorsService.list(weddingId).subscribe({
      error: () => this.toast.error('Nie udało się pobrać kontrahentów.'),
    });
  }
```

4. Usuń `import { forkJoin } from 'rxjs';` (linia 3 — po zmianie nieużywany).

- [ ] **Step 3: Wyczyść `vendors.service.ts`**

Usuń sygnał (linie 14-15):

```ts
  private readonly _missingCategories = signal<string[]>([]);
  readonly missingCategories = this._missingCategories.asReadonly();
```

i metodę `missing()` (linie 23-27):

```ts
  missing(weddingId: string): Observable<string[]> {
    return this.http
      .get<string[]>(apiUrl(`/weddings/${weddingId}/vendors/missing`))
      .pipe(tap((categories) => this._missingCategories.set(categories)));
  }
```

- [ ] **Step 4: Build**

Run (w `wedding-planner/frontend/`): `npm run build`
Expected: zielony. Gdyby coś jeszcze odwoływało się do `missingCategories`/`missing()` — kompilator to wskaże; usuń te odwołania (per spec to martwy kod).

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/vendors/ src/app/core/services/vendors.service.ts
git commit -m "feat(vendors-fe): usunięty panel brakujących kategorii i martwy kod missing()"
```

---

### Task 7: Frontend — klasa `.checkbox-field` i naprawa checkboxa

**Files:**
- Modify: `wedding-planner/frontend/src/styles/_app-pages.scss` (po bloku `.field textarea`, ~linia 266)
- Modify: `wedding-planner/frontend/src/app/pages/vendors/vendors.page.html:74-82`

Przyczyna buga: label używa klasy `.field` + style inline, a globalny selektor `.field input { width: 100% }` rozciąga checkbox na całą szerokość wiersza — stąd tekst „daleko od checkboxa".

- [ ] **Step 1: Dodaj klasę do `_app-pages.scss`**

Po bloku `.field textarea { ... }` (kończy się ~linia 266) dodaj:

```scss
.checkbox-field {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: fit-content;
  cursor: pointer;
}

.checkbox-field input[type='checkbox'] {
  width: 18px;
  height: 18px;
  margin: 0;
  flex: none;
  accent-color: var(--color-accent);
}
```

- [ ] **Step 2: Podmień label w `vendors.page.html`**

Zamień (linie 74-82):

```html
      <label class="field" style="grid-column: 1 / -1; flex-direction: row; align-items: center; gap: 8px">
        <input
          type="checkbox"
          name="newContractEnabled"
          [ngModel]="newContractEnabled()"
          (ngModelChange)="toggleContract($event)"
        />
        <span>Dodaj harmonogram płatności (zaliczka + kwota do zapłaty)</span>
      </label>
```

na:

```html
      <label class="checkbox-field">
        <input
          type="checkbox"
          name="newContractEnabled"
          [ngModel]="newContractEnabled()"
          (ngModelChange)="toggleContract($event)"
        />
        <span>Dodaj harmonogram płatności (zaliczka + kwota do zapłaty)</span>
      </label>
```

(Formularz edycji nie ma checkboxa — wzorzec występuje tylko tutaj. Sprawdź dla pewności: `grep -n "type=\"checkbox\"" src/app/pages/vendors/vendors.page.html` — oczekiwane 1 trafienie.)

- [ ] **Step 3: Build**

Run (w `wedding-planner/frontend/`): `npm run build`
Expected: zielony.

- [ ] **Step 4: Commit**

```bash
git add src/styles/_app-pages.scss src/app/pages/vendors/vendors.page.html
git commit -m "fix(vendors-fe): checkbox harmonogramu płatności przylega do etykiety (.checkbox-field)"
```

---

### Task 8: Frontend — kafelki bez myślników

**Files:**
- Modify: `wedding-planner/frontend/src/app/pages/vendors/vendors.page.html` (blok `.list` w kafelku, linie 242-251 sprzed edycji — po Tasku 6 numeracja niżej; szukaj `vendor.contactPerson || '-'`)

- [ ] **Step 1: Podmień blok danych w kafelku**

Zamień:

```html
          <div class="list">
            <div>
              <p class="list-item__title">{{ vendor.contactPerson || '-' }}</p>
              <p class="list-item__meta">{{ vendor.phone || '-' }}</p>
            </div>
            <div>
              <p class="list-item__meta">{{ vendor.email || '-' }}</p>
              <p class="list-item__title">{{ money(vendor.contractAmount) }}</p>
            </div>
          </div>
```

na:

```html
          <div class="list">
            @if (vendor.contactPerson || vendor.phone || vendor.email) {
              <div>
                @if (vendor.contactPerson) {
                  <p class="list-item__title">{{ vendor.contactPerson }}</p>
                }
                @if (vendor.phone) {
                  <p class="list-item__meta">{{ vendor.phone }}</p>
                }
                @if (vendor.email) {
                  <p class="list-item__meta">{{ vendor.email }}</p>
                }
              </div>
            }
            @if (vendor.contractAmount !== null) {
              <div>
                <p class="list-item__title">{{ money(vendor.contractAmount) }}</p>
              </div>
            }
          </div>
```

Uwaga do spec: „kwota zawsze widoczna" dotyczy wyróżnienia, nie pustej wartości — `formatPLN(null)` zwraca `"- zł"`, czyli kolejny myślnik, więc przy braku kwoty wiersz też znika (zasada „zero myślników" wygrywa).

- [ ] **Step 2: Build**

Run (w `wedding-planner/frontend/`): `npm run build`
Expected: zielony.

- [ ] **Step 3: Weryfikacja wizualna (dev server)**

Run (w `wedding-planner/frontend/`): `npm run start`, otwórz `/app/kontrahenci`.
Sprawdź: (1) brak panelu „Brakujące kategorie" na górze, (2) checkbox przylega do tekstu, (3) kafelek vendora bez kontaktu pokazuje tylko kategorię + firmę + badge + kwotę — zero `-`, (4) select statusu ma 7 polskich opcji.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/vendors/vendors.page.html
git commit -m "feat(vendors-fe): kafelki ukrywają puste pola kontaktowe zamiast myślników"
```

---

### Task 9: Finał — pełna weryfikacja + STATUS.md

**Files:**
- Modify: `STATUS.md` (korzeń repo — wpis o przebudowie zakładki kontrahentów)

- [ ] **Step 1: Pełna suita backendu**

Run (w `wedding-planner/backend/`): `npm test`
Expected: 100% zielone (liczba testów bez zmian — 1 test przepisany, 0 usuniętych plików).

- [ ] **Step 2: Build frontendu**

Run (w `wedding-planner/frontend/`): `npm run build`
Expected: zielony.

- [ ] **Step 3: Dopisz wpis do STATUS.md**

W sekcji bieżącego stanu dopisz (dopasuj się do istniejącego formatu pliku):

```markdown
- 2026-06-09: przebudowa zakładki kontrahentów — 7-stopniowa oś statusów (migracja `vendor_status_rework`), usunięte wpisy o brakujących kontrahentach (dashboard + strona kontrahentów + `GET /vendors/missing`), naprawiony checkbox harmonogramu płatności, kafelki bez myślników.
```

- [ ] **Step 4: Commit**

```bash
git add STATUS.md
git commit -m "docs(status): przebudowa zakładki kontrahentów (statusy, attention, UI)"
```
