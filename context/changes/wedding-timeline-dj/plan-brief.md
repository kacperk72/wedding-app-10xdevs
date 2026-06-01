# Zakładka „Harmonogram" (ankieta DJ-a) — Plan Brief

> Full plan: `context/changes/wedding-timeline-dj/plan.md`

## What & Why

Nowa zakładka **„Harmonogram"** w wedding-plannerze, gdzie para wypełnia ankietę otrzymaną od DJ-a:
godzinowy przebieg dnia wesela, pytania logistyczne, preferencje muzyczne i listy utworów — a potem
eksportuje czytelną „Wersję dla DJ-a" do druku/PDF. Dziś para dostaje taką ankietę mailem i wypełnia
ją poza aplikacją; tu robi to w jednym miejscu, z reużyciem danych, które już ma w planerze.

## Starting Point

Wedding-planner ma dojrzały wzorzec zasobów per-wesele (route + mapper + signal-service + strona),
manualne encje (tasks, meetings) jako wzór, RLS deny-all na każdej tabeli (service-role omija) i
nawigację w dwóch miejscach (sidebar + mobile). Harmonogramu jeszcze nie ma — i nie jest na liście
stron w `01-overview.md`, więc to świadome rozszerzenie zakresu na życzenie PO.

## Desired End State

Para otwiera „Harmonogram", widzi pre-fill znanych danych (imiona, miejsce, liczba gości, DJ — read-only),
wypełnia sekcje ankiety (godzinowy przebieg startujący od szablonu DJ-a, logistyka, muzyka, listy
must/do-not-play), zapisuje per sekcja, a przyciskiem „Wersja dla DJ-a" generuje wydruk/PDF całości.

## Key Decisions Made

| Decyzja | Wybór | Dlaczego | Source |
| --- | --- | --- | --- |
| Model danych | Hybryda: 1 wiersz `wedding_timeline` + tabele potomne `timeline_events`, `timeline_songs` | Zdarzenia/utwory to listy (sortowalne, liczalne); reszta to czytelne kolumny; zgodne z wzorcem repo | Plan |
| Zakres sekcji | Wszystkie 15 sekcji ankiety | Para wypełnia raz i wysyła DJ-owi komplet | Plan |
| Lista zdarzeń | Predefiniowany szablon DJ-a + edycja/dodawanie/sortowanie | Szybki start + elastyczność na nietypowe wesela | Plan |
| Deduplikacja | Reuse istniejących danych read-only, tylko brakujące pola w harmonogramie | Brak dryfu i podwójnego wpisywania (single-source) | Plan |
| Eksport | Widok do druku / PDF (`@media print` + `window.print()`) | Zero zależności serwerowych, naturalny format do wysłania | Plan |
| Listy utworów | Wiersze tytuł+wykonawca, dodaj/usuń, limit 50 dla must-play | Czytelne, sortowalne, łatwy limit i eksport | Plan |
| Gatunki | Multi-select 10 chipów + pola tekstowe muzyki per etap | Wiernie wg ankiety, łatwy eksport | Plan |
| Zapis | Per sekcja (PATCH), wszystkie pola opcjonalne | To robocza ankieta wypełniana stopniowo, bez utraty danych | Plan |

## Scope

**In scope:** 3 nowe tabele + migracja; backend `routes/timeline.js` (lazy-create, PATCH skalarny,
CRUD events/songs, seed-template); walidator HH:MM; frontend serwis + strona z sekcjami + reuse danych;
nawigacja (sidebar + mobile) + trasa; eksport druk/PDF; testy `timeline-crud.test.js`; round-trip do
`04-database.md`, `01-overview.md`, `STATUS.md`.

**Out of scope:** integracja z dashboardem; autosave; nadpisywanie danych wesela z harmonogramu;
współdzielony link/konto dla DJ-a; wysyłka maila/mp3; wersjonowanie; objęcie harmonogramu eksportem
JSON wesela (M9).

## Architecture / Approach

Pojedynczy router `timeline.js` montowany pod `/api/weddings/:weddingId/timeline` (auth + membership
guard jak wszędzie). Rekord nadrzędny `wedding_timeline` tworzony leniwie przy `GET`. Front: jedna
strona standalone OnPush z sub-komponentami (lista zdarzeń, listy utworów, chipy gatunków), zapis per
sekcja przez `TimelineService` (signal-cache), plus osobny chrome-less widok eksportu z `@media print`.
Dane już znane czytane z `WeddingService`/guests/vendors i pokazywane read-only.

## Phases at a Glance

| Faza | Co dowozi | Główne ryzyko |
| --- | --- | --- |
| 1. Schemat + migracja | 3 tabele, RLS, indeksy, push, doc `04-database.md` | Pominięty `enable RLS` lub niespushowana migracja (drift) |
| 2. Backend | route + mappery + walidator HH:MM + testy | Lazy-create tworzący duplikat przy współedycji; limit 50 |
| 3. Frontend | serwis + strona + nawigacja + reuse + docs | Duży formularz; spójne łączenie danych z kilku serwisów |
| 4. Eksport DJ | widok druk/PDF + przycisk | Jakość wydruku zależna od przeglądarki, ukrycie chrome |

**Prerequisites:** działający stack wedding-planner (backend + Supabase + front), dostęp do `supabase db push`.
**Estimated effort:** ~3–4 sesje (po jednej na fazę; faza 3 najcięższa).

## Open Risks & Assumptions

- Eksport PDF opiera się o druk przeglądarki — „wystarczająco dobry", nie pixel-perfect.
- Lista 10 kategorii gatunków i etykiety szablonu DJ-a to stałe w kodzie (nie konfigurowalne w MVP).
- Zakładamy, że PO akceptuje rozszerzenie listy stron poza `01-overview.md` (round-trip to potwierdza).
- Czy harmonogram ma wejść do eksportu JSON wesela (M9) — odłożone do osobnej decyzji PO.

## Success Criteria (Summary)

- Para wypełnia i utrwala wszystkie sekcje ankiety, edytuje godzinowy przebieg dnia od szablonu DJ-a.
- Listy must/do-not-play działają, must-play respektuje limit 50.
- „Wersja dla DJ-a" daje kompletny, czytelny wydruk/PDF; dane już znane są reużyte, nie wpisywane ponownie.
