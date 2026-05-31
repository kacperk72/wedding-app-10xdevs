# STATUS — wedding-planner

> **Jedyne źródło prawdy o POSTĘPIE.** Spec (co ma być) żyje w `docs/demo-app/`.
> Ten plik mówi tylko **co JEST zrobione** — weryfikowane kodem, nie opowiadane.
> Reguła: moduł = „done" tylko gdy istnieje **route + serwis frontu + test**.
>
> Ostatni audyt zgodności: **2026-05-31** (porównanie deklaracji w `CLAUDE.md` z realnym kodem).
> Testy: backend **100/100** (node:test). **Front nie ma testów jednostkowych** — `npm test` to stub, 0 plików `.spec.ts`, `ng test` (Angular 21) nie jest skonfigurowany. Front weryfikowalny tylko przez `npm run build` + ręczny/Playwright przegląd.
> `CLAUDE.md` zaktualizowany 2026-05-31 (Implementation state, lista migracji, licznik testów, konwencja tasków).

## TL;DR

Aplikacja jest **znacznie dalej** niż twierdzi `CLAUDE.md`. Dokument deklarował
„M5+ not started", a w kodzie istnieją kompletne (route + serwis + strona + testy)
moduły: **budżet, catering, zadania, spotkania, rozmieszczenie gości (seating),
dashboard i eksport**. To był dryf „w drugą stronę" — to docs były nieaktualne, nie kod.

## Stan modułów (zweryfikowany kodem)

| M | Zakres | Stan | Dowód w kodzie |
|---|--------|------|----------------|
| M0 | Scaffold | ✅ done | `wedding-planner/{frontend,backend}` |
| M1 | Schema + RLS + seed | ✅ done | `migrations/20260523233000_*`, `_rls_lockdown`, `_revoke_*` |
| M2 | SSO + bootstrap + invite/accept | ✅ done | `services/users.js`, `bootstrap-wedding.js`, `invite-flow.test.js` |
| M3 | Guests / meal-options / tables + dashboard | ✅ done | `routes/{guests,meal-options,tables}.js`, `pages/{guests,settings,dashboard}` |
| M4 | Vendors / contracts / payments | ✅ done | `routes/{vendors,contracts,payments}.js`, `vendor-with-contract.test.js` |
| M5 | Budżet (planowany vs rzeczywisty, wydatki) | ✅ done | `routes/{budget,expenses}.js`, `budget.service.ts`, `pages/budget`, `budget-crud.test.js` |
| M6 | Catering (oferty/pakiety/dania/dodatki/wybór) | ✅ done | `routes/catering-{offers,packages,dishes,addons,selection}.js`, `pages/catering` (+7 komponentów), `catering-*-crud.test.js` |
| M7 | Zadania + spotkania | ✅ done | `routes/{tasks,meetings}.js`, `pages/tasks`, `tasks-crud.test.js`, `meetings-crud.test.js` |
| M8 | Seating + konflikty + wizualne przypisanie miejsc | ✅ done | `routes/{seating,seating-conflicts}.js`, `pages/seating/{round-table,conflicts-panel}`, `seating-crud.test.js`, migracja `guest_seat_number` |
| M9 | Eksport JSON / hard-delete wesela | ✅ done | `wedding-export.test.js`, `wedding-delete.test.js` |
| M10 | Eksport + dopracowanie + wdrożenie | 🟡 w toku | wdrożenie+SSO ✅ zweryfikowane LIVE; audyt UI zrobiony; bugi polish/demo naprawione lokalnie 2026-05-31 (`npm run build`, backend 100/100 ✅); `.bak` usunięte |

> ⚠️ M5–M9 oznaczone na podstawie inwentarza plików (route+serwis+strona+test obecne).
> **Do potwierdzenia ręcznie:** pełna ścieżka end-to-end każdego modułu w UI.

## ✅ Naprawione: 2 time-bomb testy (2026-05-31)

`dashboard.test.js` i `meetings-crud.test.js` failowały. **Root cause:** oba seedowały
spotkanie na sztywno (`2026-05-30`), a filtr „upcoming" (w `meetings.js /upcoming`
i w `buildDashboard`) trzyma tylko `startsAt >= now`. Po przekroczeniu tej daty
spotkanie wpadało w przeszłość i znikało → dashboard czytał `upcomingMeetings[0]`
(undefined), meetings oczekiwał `length 1` (dostawał 0).

**Fix:** daty w obu testach są teraz względne do `now` (`isoDaysFromNow` /
`dateDaysFromNow`) z zachowaniem tych samych offsetów, więc okna overdue/upcoming
nigdy się nie przeterminują. Kod produkcyjny był poprawny — to fixtury gniły.
Pełny suite: **100/100 pass**.

## Audyt polish M10 (2026-05-31)

Spec (`05-implementation-plan.md` → M10) definiuje polish jako: performance (lazy-load,
bundle), accessibility, responsive QA, security headers, observability, smoke test prod.
Eksport ✅ i wdrożenie ✅ już były.

> ⚠️ **Sprostowanie (uczciwość):** w pierwszym podejściu do polish BŁĘDNIE zgłosiłem
> „krytyczny bug" — jakoby `input-text/password/date` renderowały `{{ inputId }}-error`.
> **To była konfabulacja — bug nie istnieje.** Wszystkie trzy komponenty już poprawnie
> renderują `{{ error() }}`. Utworzony „test regresyjny" usunięty (i tak nie ma runnera).

**Statyczny audyt kodu — realne obserwacje:**
- **Pliki `.bak` w repo** — `round-table.html.bak`, `seating.service.spec.ts.bak` →
  ✅ USUNIĘTE.
- Empty states: settings MA (live: „Brak opcji menu"). Do potwierdzenia tylko
  wedding-setup / accept-invite (rzadkie ścieżki, nieobejrzane live).
- Kontrast / focus-visible / responsywność mobile — niezweryfikowane (patrz audyt live).

> Keyboard-fallback dla drag&drop w seatingu (twardy wymóg z `CLAUDE.md`) — ✅ JUŻ JEST
> (`tabindex="0"`, `(keydown.enter)`, `role`/`aria-label` w `seating.page.html` i
> `round-table.html`). Nie wymaga pracy.

## Audyt LIVE przez Playwright (2026-05-31, konto produkcyjne, READ-ONLY)

Zalogowano przez SSO (selektory `input[type=email]`/`input[type=password]` — referencje
a11y PrimeNG nie działały). Przejrzano zalogowaną apkę: dashboard, goście, kontrahenci,
budżet, ustawienia, rozsadzenie, oferta-sali. **Nic nie zmieniono w danych** — tylko
nawigacja + snapshoty. Raportowane jest wyłącznie to, co widać w snapshotach.

**✅ Działa poprawnie:**
- **Login SSO end-to-end** — `/app` → SSO → callback → dashboard z danymi. M10 deployment+SSO ✅.
- Dashboard: realne dane (Kacper & Weronika, „Do ślubu 55 dni", 96/100 gości, 6 zadań,
  „Wymaga uwagi", nadchodzące zadania z datami `31.05.2026`/`25.06.2026` — DD.MM.YYYY ✅).
- 0 błędów w konsoli po zalogowaniu.
- Goście (96): RSVP / dieta / relacja / stół — wszystko po polsku, filtry i KPI działają.
- Budżet: 16 kategorii (humanizowane: „Sala weselna", „Muzyka / DJ"), pusty stan.
- Ustawienia: **jedna** sekcja „Profil pary" (mój wcześniejszy zarzut o duplikacie był
  FAŁSZYWY — wycofany), „Data ślubu 25.07.2026" ✅.
- Oferta sali: czysty pusty stan z CTA. Empty states obecne na każdej stronie.

**Zweryfikowane (zalogowany, desktop 1440 + mobile 375):** dashboard, goście, kontrahenci,
umowy, budżet, zadania, oferta-sali, rozsadzenie, ustawienia. 0 błędów konsoli.

**🐛 BUGI — PEŁNA LISTA z audytu LIVE:**

Status 2026-05-31: **naprawione lokalnie** (patrz sekcja „Naprawione bugi E2E / polish” niżej).

1. **[i18n] Brak polskich znaków w zaszytych labelach — NA WSZYSTKICH stronach.**
   Nawigacja boczna MA diakrytyki, ale nagłówki/treść/przyciski NIE:
   - Dashboard: „Do slubu zostalo", „goscie, kontrahenci, budzet"
   - Goście: „Goscie", „Imie i nazwisko", „Stol", „Odmow", „Nie wybrano"
   - Kontrahenci: „Brakujace kategorie", „Kwota calkowita", „dowiezc dzien slubu"
   - Umowy: „Najblizsze platnosci", „Gotowka", „oplacone", „do podpisu", „Usun"
   - Budżet: „Budzet", „Estymata koncowa", „Pozostalo", „Stylizacja panny mlodej"
   - Ustawienia: „Data slubu", „Polaczone konto", „Uklad sali", „Strefa ostrozna"
   - Waluta wszędzie „zl" zamiast „zł".
   Łamie twardy wymóg `CLAUDE.md`. **Największy objętościowo — główne zadanie polish.**

2. **[i18n] Surowe klucze enum na Kontrahentach.** Pasek „Do potwierdzenia:" pokazuje
   `slodki_stol_tort`, `ciasta_pozegnalne` (snake_case) — choć w dropdownie te same
   kategorie mają ładne etykiety. Brak mapy label w komponencie paska. Punktowy, łatwy.

3. **[format] Surowy/ISO format daty.** Zamiast `DD.MM.YYYY`:
   - Dashboard hero: „Kacper & Weronika - 2026-07-25"
   - Ustawienia: „Data slubu 2026-07-25" + „Polaczono: 2026-05-27T19:10:04.705799+00:00"
     (surowy timestamp z mikrosekundami i strefą — najbrzydszy przypadek)
   - Umowy: płatności „2024-11-06"/„2026-07-25", podpis „2026-05-26"
   Reszta (zadania, banner) poprawnie. Ujednolicić przez pipe daty.

**✅ Zweryfikowane jako POPRAWNE (nie bugi):**
- **Responsywność mobile (375px):** brak poziomego overflow strony (scrollWidth 360 ≤ 375).
  Tabele (~779px) w `.table-wrap` z `overflow-x:auto` → scrollują się, nie psują layoutu.
- **Rozsadzenie:** „Rozsadzono 66/100 · stołów 7 · konfliktów 0 · 5 pełnych". Działa.
  (Wcześniejszy mój zarzut o „96 nieprzypisanych" — błędny, wycofany.)
- **Zadania:** sekcje Opóźnione/W tym tygodniu/W przyszłości/Zrobione; treść użytkownika
  z pełnymi diakrytykami — OK.
- **Umowy:** tabela kontraktów + harmonogram płatności + sync statusu („zaliczka oplacona",
  „1/2 oplacone") — logika działa.
- KPI gości na mobile (100/96) — „0" na screenshocie to był lag malowania; potwierdzone w DOM.

**🚫 Świadomie pominięte:** kontrast WCAG / focus-ring — wymaga axe-core (brak zależności)
lub oceny wzrokowej; subiektywne, niski priorytet wobec i18n.

## Konto DEMO — seed danych + test akcji edycji (2026-05-31)

Konto `demo@wedding-planner.pll` (SSO). Wypełnione przez UI + REST API (cookie-sesja
przez `olive-camel-278313.hostingersite.com`). ⚠️ Po drodze omyłkowo wszedłem najpierw
na konto produkcyjne (sesja przeglądarki) — wycofane bez żadnego zapisu, dane na demo.

**Zaseedowane dane (Maria & Piotr, 25.07.2026, Kościół św. Anny Krosno):**
- 15 gości (10 confirmed / 4 pending / 1 declined; diety: 6 standard, 2 vege, 1 vegan,
  1 gluten_free, 5 pending; 1 dziecko, 1 +1), 12 przy stołach, 1 na konkretnym miejscu.
- 7 kontrahentów; 3 kontrakty z płatnościami (Pałac 39 100, Foto 6 000, DJ 5 000).
- Budżet 60 000 zł, 7 wydatków (18 050 zł), pozostało 41 950 zł.
- 11 zadań (3 zrobione, 8 aktywnych — pokrywają wszystkie sekcje).
- Catering: preset „Pałac Polanka 2026" (4 pakiety, pełne menu).
- Rozsadzenie: 12/15 przy stołach, 0 konfliktów.

**✅ Akcje edycji przetestowane — WSZYSTKIE DZIAŁAJĄ:**
- Utworzenie wesela (setup), dodanie gościa (modal), edycja gościa (modal: dieta, +1).
- Inline w tabeli gości: zmiana stołu (zapis `tableId` ✅).
- Umowa: dodanie (form), płatności, **sync statusu kontraktu** (rata→opłacona ⇒
  kontrakt `paid_in_full` ✅ — logika biznesowa działa).
- Zadanie: dodanie (modal), usunięcie (kosz ✅).
- Rozsadzenie: przypisanie do stołu + **do konkretnego miejsca** (`seat_number`,
  najnowszy feature ✅; menu pokazuje zajętość stołów i wolne miejsca).
- Profil pary: edycja + zapis (dirty-check aktywuje przycisk ✅).
- Budżet: ustawienie kwoty + wydatki. Catering preset.

**🐛 NOWE bugi znalezione podczas testów demo:**
1. **„Konto połączone" zawsze w nagłówku** — pokazuje się mimo `partner.linkStatus="none"`
   (świeże konto bez zaproszonego partnera). Awatar pokazuje 2 inicjały (MP) choć jest
   1 osoba. Powinno być „Zaproś partnera" / brak drugiego inicjału. Mylące.
2. **„Brak wolnych miejsc lub brak stołów" w modalu gościa** — komunikat pod dropdownem
   „Stół" widoczny mimo że istnieje 12 pustych stołów. Błędny warunek wyświetlania.
3. **Przycisk „Zapisz date" w Ustawieniach** — sekcja edytuje imiona + miejsce ceremonii
   + datę, ale przycisk nazwany tylko „Zapisz date" (i bez diakrytyku → „datę"). Zmienić
   na „Zapisz profil".
4. **Usuwanie bez potwierdzenia** — `Usuń zadanie` kasuje jednym klikiem, bez dialogu.
   Akceptowalne dla lekkich akcji, ale ryzykowne (gość/zadanie). Rozważyć confirm.

Bugi i18n (diakrytyki, „zl", daty ISO) potwierdzone też na demo — patrz audyt LIVE wyżej.

## ✅ Naprawione bugi E2E / polish (2026-05-31)

Zweryfikowane: frontend `npm run build` ✅, backend `npm test` ✅ (**100/100**, 23 suite'y).

- **BUG #1 i18n/diakrytyki + `zł`:** poprawiono zaszyte labele, nagłówki, CTA i toasty na stronach dashboard, goście, kontrahenci, umowy, budżet, ustawienia, setup i rozsadzenie; `formatPLN` zwraca `zł`. Dodatkowo poprawiono domyślne nazwy kategorii budżetu i stołów w seedach/migracjach oraz preset cateringu (np. `Złoty`, `Słodki stół + tort`).
- **BUG #2 enumy kontrahentów:** pasek „Do potwierdzenia” mapuje `slodki_stol_tort` / `ciasta_pozegnalne` przez `VENDOR_CATEGORY_LABELS`, więc pokazuje czytelne etykiety.
- **BUG #3 format dat:** dashboard hero, ustawienia (`linkedAt`) i umowy/płatności używają `formatDDMMYYYY`, bez ISO/timestampów w UI.
- **Demo #1 nagłówek partnera:** header pokazuje „Zaproś partnera” i pojedynczy awatar, dopóki nie ma połączonego partnera; „Konto połączone” pojawia się dopiero przy realnym członkostwie partnera.
- **Demo #2 komunikat o wolnych miejscach:** w modalu przypisania stołu komunikat „Brak wolnych miejsc lub brak stołów” renderuje się tylko, gdy lista dostępnych stołów jest pusta.
- **Demo #3 ustawienia:** przycisk zmieniony na „Zapisz profil”, a zapis profilu ma poprawne komunikaty.
- **Demo #4 usuwanie:** dodano potwierdzenia dla usuwania gościa, kontrahenta, umowy, płatności, opcji menu i stołu; zadania już miały confirm.

## Rozjazdy docs ↔ kod (status po audycie 2026-05-31)

1. ✅ **`CLAUDE.md` → „M5+ not started"** — POPRAWIONE. Wpisano realny stan M5–M10.
2. ✅ **`CLAUDE.md` → „36 tests across 11 suites"** — POPRAWIONE na **100 / 23**
   (20 plików testowych; po fixie wszystkie zielone).
3. ✅ **Lista migracji urywała się na `20260524193000`** — POPRAWIONE. Dopisano
   brakujące 6: `vendor_categories_rework`, `payments_method`, `strip_task_auto`,
   `wedding_budget_total`, `drop_budget_planned_amount`, `guest_seat_number`.
4. ✅ **Konwencja „Auto-task timeline"** — POPRAWIONE. Potwierdzono: migracja
   `strip_task_auto` **usunęła** auto-taski (trigger, `task_templates`, kolumny).
   Konwencja przepisana na „tasks manualne". ⚠️ `docs/demo-app/04-database.md`
   w części o auto-taskach pozostaje nieaktualny — do sprzątnięcia przy okazji.
5. **`context/foundation/` jest PUSTE** — brak `roadmap.md`, `lessons.md`, choć
   `CLAUDE.md` (sekcja 10xDevs) wskazuje je jako „source of truth / upstream".
   Łańcuch 10x ma tylko jeden ślad: `context/changes/seating-visual-assignment`.

## Do zrobienia (realne, nie z docs)

- [x] ~~Naprawić 2 failujące testy~~ — zrobione 2026-05-31 (time-bomb daty → względne).
- [x] ~~Naprawić `CLAUDE.md`~~ — zrobione 2026-05-31 (Implementation state, migracje, licznik testów).
- [x] ~~Rozstrzygnąć auto-taski~~ — feature USUNIĘTY migracją `strip_task_auto`; konwencja w `CLAUDE.md` poprawiona (tasks manualne).
- [x] ~~Audyt LIVE~~ — UKOŃCZONY 2026-05-31 (zalogowany, 9 stron, desktop + mobile 375, read-only).
- [x] ~~**BUG #1 (i18n diakrytyki) — NAJWIĘKSZY:** zaszyte nagłówki/labele/przyciski bez ł/ż/ó/ą na wszystkich stronach + waluta „zl".~~ — zrobione 2026-05-31 (UI polish + `zł` + seedy/migracje/preset cateringu).
- [x] ~~**BUG #2 (i18n enumy):** label dla `slodki_stol_tort` / `ciasta_pozegnalne` na pasku „Do potwierdzenia" (Kontrahenci).~~ — zrobione 2026-05-31.
- [x] ~~**BUG #3 (format daty):** ISO `2026-07-25` i surowy timestamp `...+00:00` w dashboard-hero / ustawieniach / umowach → pipe `DD.MM.YYYY`.~~ — zrobione 2026-05-31.
- [x] ~~Demo: „Konto połączone” bez partnera, komunikat o wolnych miejscach, „Zapisz date”, usuwanie bez potwierdzenia.~~ — zrobione 2026-05-31.
- [x] ~~Rozsadzenie~~ — DZIAŁA (66/100), wcześniejszy zarzut wycofany.
- [x] ~~Responsywność mobile~~ — OK (brak overflow strony; tabele scrollują w `.data-table-wrap`).
- [ ] **Świadomie pominięte:** kontrast WCAG / focus-ring — wymaga axe-core lub oceny wzrokowej, niski priorytet.
- [ ] **Front: brak testów jednostkowych** — `npm test` to stub. Jeśli polish ma być weryfikowalny automatem, najpierw skonfigurować runner (roadmap F-01).
- [ ] (opcjonalnie) Założyć `context/foundation/roadmap.md` albo usunąć martwe
      odwołania do niego z `CLAUDE.md`.

## Jak utrzymać ten plik (żeby dryf nie wrócił)

1. **Spec zamrożony.** `docs/demo-app/` zmieniasz tylko gdy zmienia się *zakres/model
   danych* — nigdy „bo coś zrobiłem".
2. **Postęp tylko tutaj.** Skończony moduł → jeden wiersz w tabeli + dowód (plik/test).
3. **Done = dowód.** Nie wpisuj „✅" bez route + serwisu + testu.
4. Szczegóły bieżącej zmiany zostają w `context/changes/<id>/` (10x), ale podsumowanie
   zawsze ląduje w tej tabeli.
