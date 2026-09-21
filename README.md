# Wedding Planner

> **Portfolio snapshot — wrzesień 2026.** Stan zamrożony po zakończeniu kursu 10xDevs.
> Produkt jest dalej rozwijany komercyjnie w prywatnym repozytorium, więc to repo nie dostaje już zmian.
> Kod udostępniony wyłącznie do wglądu — wszelkie prawa zastrzeżone, zob. [LICENSE](LICENSE).

> Polskojęzyczna aplikacja webowa dla pary młodej — agreguje w jednym miejscu listę gości z RSVP, kontrahentów, umowy z harmonogramem płatności, budżet, zadania (auto-timeline od daty ślubu), rozsadzenie gości oraz konfigurator menu z oferty sali. Konto jest "połączone" — oboje partnerzy edytują to samo wesele.

Projekt zaliczeniowy kursu **10xDevs**. Punkt startowy: prototyp UI wygenerowany na Lovable ([love-nest-co.lovable.app](https://love-nest-co.lovable.app/)) zreverse-engineerowany do pełnej specyfikacji w `docs/`.

## Status

🚧 **Implementation started** — frontend i backend są zescaffoldowane w `wedding-planner/`; M1 backendu idzie w kierunku Supabase Postgres + zewnętrzne SSO.

- ✅ Reverse engineering UI prototypu (13 screenów, 9 ekranów)
- ✅ Specyfikacja backendu (REST, ~50 endpointów)
- ✅ Schema bazy (23 tabele, RLS, triggery)
- ✅ Konfigurator oferty cateringu (uniwersalny model na bazie realnej oferty Pałac Polanka 2026)
- ✅ Plan implementacji (M0-M10)
- ✅ Scaffolding aplikacji (M0)
- ✅ Migracja Supabase M1 przygotowana lokalnie
- 🟨 SSO + wedding bootstrap (M2) w trakcie
- ⬜ Reszta milestone'ów

## Stack

| Warstwa | Wybór |
| --- | --- |
| Frontend | Angular 20+ (standalone components, signals, SCSS) |
| Backend | Express + Node.js |
| Baza | Supabase Postgres dla danych wedding-plannera |
| Auth | Zewnętrzne SSO (`kubitksso.pl`) + JWT RS256/JWKS; SSO używa własnego MySQL |
| Hosting FE | Hostinger (własny pakiet) |
| Hosting BE | Hostinger Node.js app |
| CI/CD | GitHub Actions |
| Repo | `wedding-planner/frontend` + `wedding-planner/backend` |

## Struktura repo

```
.
├── wedding-planner/
│   ├── frontend/        # Angular SPA
│   └── backend/         # Express API + Supabase client
├── docs/
│   ├── demo-app/        # 5 plików spec + screenshoty
│   └── menu/            # PDFy oferty cateringu (input do schemy)
├── .claude/
│   └── skills/
│       └── app-reverse-engineer/   # custom skill użyty do RE prototypu
├── prompt-prototyp-ui.md           # oryginalny prompt do Lovable
├── wedding-planner-koncepcja.md    # walidacja pod wymagania kursu
└── wedding-planner-deployment.md   # decyzje deployowe
```

## Dokumentacja

Pełna specyfikacja w `docs/demo-app/`:

| Plik | Zawartość |
| --- | --- |
| [`01-overview.md`](docs/demo-app/01-overview.md) | Cel, audytorium, core features, user flows, lista ekranów |
| [`02-frontend.md`](docs/demo-app/02-frontend.md) | Routing, komponenty, formularze, responsywność, design tokens |
| [`03-backend.md`](docs/demo-app/03-backend.md) | SSO/JWKS, REST API, payloady, error handling, rate limiting |
| [`04-database.md`](docs/demo-app/04-database.md) | 23 tabele, DDL, RLS policies, triggery, ER diagram |
| [`05-implementation-plan.md`](docs/demo-app/05-implementation-plan.md) | Sekwencja milestone'ów M0-M10 z checklistami |

## Szybki start (lokalnie)

Lokalnie aplikacja działa w pełni offline względem produkcji: **lokalny Supabase w Dockerze** (te same migracje co na prodzie) i **atrapa SSO** w przeglądarce. Produkcyjne SSO celowo odrzuca powrót na `localhost`, a `backend/.env` wskazuje na produkcyjną bazę — dlatego tryb lokalny ma własne skrypty.

Wymagania: Node 22+, uruchomiony Docker Desktop.

```bash
# 1. Baza — pierwszy start pobiera obrazy (kilka minut), migracje nakładają się same
cd wedding-planner/backend
npm install
npm run db:start

# 2. Backend na lokalnej bazie (port 3000)
npm run dev:local

# 3. Frontend z atrapą SSO (osobny terminal, port 4200)
cd wedding-planner/frontend
npm install
npm run start:local
```

Otwórz `http://localhost:4200` i kliknij „Zaloguj się" — trafiasz do kreatora wesela jako partnerka A. Dopisz `?as=b` do dowolnego adresu, żeby przełączyć się na partnera B (np. do testu zaproszenia; link zaproszenia backend wypisuje w konsoli).

| Polecenie (`backend/`) | Co robi |
| --- | --- |
| `npm run db:start` / `db:stop` | Start / stop lokalnego Supabase |
| `npm run db:reset` | Czysta baza od zera: wszystkie migracje ponownie |
| `npm run db:status` | Adresy i klucze lokalnego stacku (Studio: `http://127.0.0.1:54323`) |

Zabezpieczenia: `dev:local` czyta adres i klucz bazy z `supabase status` i ustawia `LOCAL_DEV=1` — backend odmawia startu, jeśli adres bazy nie jest lokalny. Atrapa SSO żyje tylko w `src/index.local.html` (konfiguracja `local`); build produkcyjny jej nie zawiera. W rogu lokalnej aplikacji widać znacznik „LOKALNIE".

Testy: `npm test` w `backend/`, `npm run test:ci` i `npm run e2e` w `frontend/`.

## Licencja

Wszelkie prawa zastrzeżone — kod udostępniony wyłącznie do wglądu jako portfolio. Szczegóły w [LICENSE](LICENSE).
