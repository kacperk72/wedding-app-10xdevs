# Przebudowa zakładki kontrahentów — spec

Data: 2026-06-09
Status: zatwierdzony przez PO (rozmowa 2026-06-09)

## Kontekst

Feedback PO po użyciu zakładki kontrahentów na realnych danych:

1. Sekcja „Wymaga uwagi" zaśmiecona wpisami „Brakuje kontrahenta: X" — niepotrzebne.
2. Checkbox „Dodaj harmonogram płatności (zaliczka + kwota do zapłaty)" rozjechany — label na całą szerokość, checkbox daleko od tekstu.
3. Statusy (`rozwazany / spotkanie / zarezerwowany / zaplacony / wykonany`) nie opisują realnych stanów: większość kontrahentów PO jest „zarezerwowana z wpłaconą zaliczką" lub „z podpisaną umową".
4. Kafelki kontrahentów pokazują myślniki za każde puste pole (kontakt, telefon, e-mail) — wizualny śmietnik.

## Decyzje (zatwierdzone)

- **Statusy: pełna oś postępu** — 7 wartości zamiast 5.
- **Wpisy o brakujących kontrahentach usunięte z obu miejsc** — dashboard i strona kontrahentów.
- **Kafelki: puste pola ukryte** — żadnych myślników; kwota zawsze widoczna.

## Zakres zmian

### 1. Nowe statusy kontrahenta

Wartości enuma (kolumna `vendors.status`, CHECK constraint):

| Wartość | Etykieta PL |
|---|---|
| `rozwazany` | rozważany |
| `spotkanie` | spotkanie umówione |
| `zarezerwowany` | zarezerwowany |
| `umowa_podpisana` | umowa podpisana |
| `zaliczka_wplacona` | zaliczka wpłacona |
| `oplacony` | opłacony w całości |
| `zrealizowany` | zrealizowany |

Mapowanie istniejących danych: `zaplacony` → `oplacony`, `wykonany` → `zrealizowany`; pozostałe bez zmian. Default zostaje `rozwazany`.

Kolejność prac (konwencja repo): aktualizacja `docs/demo-app/04-database.md` → migracja `vendor_status_rework` (drop CHECK, UPDATE danych, nowy CHECK) → `npx supabase db push` → kod.

Dotknięte pliki:
- `wedding-planner/backend/supabase/migrations/<timestamp>_vendor_status_rework.sql` (nowy)
- `wedding-planner/backend/src/routes/vendors.js` — `VENDOR_STATUSES`
- `wedding-planner/frontend/src/app/core/models/vendor.model.ts` — `VendorStatus`, `VENDOR_STATUS_LABELS`
- `wedding-planner/frontend/src/app/pages/vendors/vendors.page.ts` — `statusClass` (mapa badge dla 7 stanów; nowe stany finansowe ~success/info, wczesne ~neutral/warning)

### 2. Usunięcie „brakujących kontrahentów"

- `routes/weddings.js` (dashboard): z `attentionItems` znikają wpisy typu `vendor`; usunięte `missingVendorCategories()`, `SECURED_VENDOR_STATUSES` i `VENDOR_CATEGORIES` jeśli nieużywane gdzie indziej w pliku. Zaległe zadania i płatności po terminie zostają.
- `routes/vendors.js`: endpoint `GET /vendors/missing` usunięty.
- Frontend: panel „Wymaga uwagi / Brakujące kategorie" usunięty z `vendors.page.html`; z `vendors.page.ts` znikają `missingCategoryLabels()`, `refreshMissing()`, wywołanie `missing()` w `loadResources`; z `VendorsService` znika `missing()` i sygnał `missingCategories`.
- Jeśli odpowiedź dashboardu zawiera pole z brakującymi kategoriami konsumowane przez dashboard UI — też usunąć (sprawdzić przy implementacji).

### 3. Naprawa checkboxa harmonogramu płatności

- Label checkboxa w formularzu dodawania (`vendors.page.html:74-82`) przestaje używać `class="field"` + stylów inline; dostaje dedykowaną klasę (np. `.checkbox-field`): `display:flex; align-items:center; gap:8px; width:fit-content` — checkbox i tekst przylegają do siebie, całość klikalna.
- Klasa ląduje w stylach współdzielonych (globalny SCSS), nie inline, żeby była reużywalna.

### 4. Kafelki bez myślników

- Blok `.list` w kafelku renderowany warunkowo: wiersz osoby kontaktowej, telefonu i e-maila tylko gdy wartość istnieje (`@if`).
- Kwota (`contractAmount`) zawsze widoczna, wyróżniona typograficznie.
- Kafelek bez danych kontaktowych = kategoria (eyebrow) + nazwa firmy + badge statusu + kwota. Zero pustych wierszy i `-`.

## Testy

- `wedding-planner/backend/test/resource-crud.test.js`: usunięcie testu `GET /vendors/missing`; aktualizacja statusów używanych w fixture'ach/asercjach do nowego enuma.
- Test dashboardu: asercje `attentionItems` bez wpisów typu `vendor`.
- `test/helpers/mock-supabase.js`: seedy vendorów na nowe statusy, jeśli używają starych.

## Poza zakresem

- Niezależne flagi „umowa podpisana" / „zaliczka wpłacona" na vendorze (odrzucona opcja C — status jest jednowymiarowy).
- Automatyczne wyliczanie statusu z płatności/umów.
- Zmiany w kategoriach kontrahentów.
