# Wedding Planner

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

## Szybki start

```bash
# Backend
cd wedding-planner/backend
npm install
npm test

# Frontend
cd ../frontend
npm install
npm start

# Supabase schema
# Uruchom SQL z wedding-planner/backend/supabase/migrations w Supabase SQL Editor
```

## Licencja

Projekt edukacyjny — bez licencji open-source.
