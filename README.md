# Wedding Planner

> Polskojęzyczna aplikacja webowa dla pary młodej — agreguje w jednym miejscu listę gości z RSVP, kontrahentów, umowy z harmonogramem płatności, budżet, zadania (auto-timeline od daty ślubu), rozsadzenie gości oraz konfigurator menu z oferty sali. Konto jest "połączone" — oboje partnerzy edytują to samo wesele.

Projekt zaliczeniowy kursu **10xDevs**. Punkt startowy: prototyp UI wygenerowany na Lovable ([love-nest-co.lovable.app](https://love-nest-co.lovable.app/)) zreverse-engineerowany do pełnej specyfikacji w `docs/`.

## Status

🚧 **Pre-implementation** — dokumentacja kompletna, kod w fazie scaffoldingu.

- ✅ Reverse engineering UI prototypu (13 screenów, 9 ekranów)
- ✅ Specyfikacja backendu (REST, ~50 endpointów)
- ✅ Schema bazy (23 tabele, RLS, triggery)
- ✅ Konfigurator oferty cateringu (uniwersalny model na bazie realnej oferty Pałac Polanka 2026)
- ✅ Plan implementacji (M0-M10)
- ⬜ Scaffolding monorepo (M0)
- ⬜ Migracje bazy (M1)
- ⬜ Auth + wedding bootstrap (M2)
- ⬜ Reszta milestone'ów

## Stack

| Warstwa | Wybór |
| --- | --- |
| Frontend | Angular 20+ (standalone components, signals, SCSS) |
| Backend | NestJS (TypeScript strict, class-validator) |
| Baza | PostgreSQL + Supabase (RLS, auth, JWT) |
| Hosting FE | Hostinger (własny pakiet) |
| Hosting BE | Supabase (free tier) |
| CI/CD | GitHub Actions |
| Monorepo | pnpm workspaces |

## Struktura repo

```
.
├── apps/
│   ├── frontend/        # Angular SPA (M0)
│   └── backend/         # NestJS API (M0)
├── packages/
│   └── shared-types/    # DTO + enumy współdzielone (M0)
├── docs/
│   ├── love-nest-co-lovable-app/   # 5 plików spec + screenshoty
│   └── menu/            # PDFy oferty cateringu (input do schemy)
├── .claude/
│   └── skills/
│       └── app-reverse-engineer/   # custom skill użyty do RE prototypu
├── prompt-prototyp-ui.md           # oryginalny prompt do Lovable
├── wedding-planner-koncepcja.md    # walidacja pod wymagania kursu
└── wedding-planner-deployment.md   # decyzje deployowe
```

## Dokumentacja

Pełna specyfikacja w `docs/love-nest-co-lovable-app/`:

| Plik | Zawartość |
| --- | --- |
| [`01-overview.md`](docs/love-nest-co-lovable-app/01-overview.md) | Cel, audytorium, core features, user flows, lista ekranów |
| [`02-frontend.md`](docs/love-nest-co-lovable-app/02-frontend.md) | Routing, ~70 komponentów, formularze, responsywność, design tokens |
| [`03-backend.md`](docs/love-nest-co-lovable-app/03-backend.md) | Auth, REST API, payloady, error handling, rate limiting |
| [`04-database.md`](docs/love-nest-co-lovable-app/04-database.md) | 23 tabele, DDL, RLS policies, triggery, ER diagram |
| [`05-implementation-plan.md`](docs/love-nest-co-lovable-app/05-implementation-plan.md) | Sekwencja milestone'ów M0-M10 z checklistami |

## Szybki start

> Dostępne po M0 (scaffolding monorepo). Na razie repo zawiera samą specyfikację.

```bash
# Instalacja
pnpm install

# Dev (frontend :4200 + backend :3000)
pnpm dev

# Build wszystkich pakietów
pnpm build

# Testy
pnpm test
```

## Licencja

Projekt edukacyjny — bez licencji open-source.
