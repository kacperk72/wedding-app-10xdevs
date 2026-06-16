# STATUS — wedding-planner

> **Jedyne źródło prawdy o POSTĘPIE.** Spec (co ma być) żyje w `docs/demo-app/`.
> Ten plik mówi tylko **co JEST zrobione** — weryfikowane kodem, nie opowiadane.
> Reguła: moduł = „done" tylko gdy istnieje **route + serwis frontu + test**.
>
> Testy: backend **133/133** (node:test). Front: **Vitest** skonfigurowany
> (`@angular/build:unit-test`, `ng test`) z seed-suite **15/15** (formattery + `GuestsService`);
> szersze pokrycie w toku. Dodatkowo `npm run build` + ręczny/Playwright przegląd.
> CI: `deploy.yml` egzekwuje realne bramki (BE lint+testy, FE lint+unit+build,
> hermetyczny Playwright E2E) + migration-drift guard + post-deploy `/api/health`
> smoke — wszystko zielone na `main` 2026-06-16 (F-02 done).

## Stan modułów

| M | Zakres | Stan | Dowód w kodzie |
|---|--------|------|----------------|
| M0 | Scaffold | ✅ done | `wedding-planner/{frontend,backend}` |
| M1 | Schema + RLS + seed | ✅ done | `migrations/20260523233000_*`, `_rls_lockdown`, `_revoke_*` |
| M2 | SSO + bootstrap + invite/accept | ✅ done | `services/users.js`, `bootstrap-wedding.js`, `invite-flow.test.js` |
| M3 | Guests / meal-options / tables + dashboard | ✅ done | `routes/{guests,meal-options,tables}.js`, `pages/{guests,settings,dashboard}` |
| M4 | Vendors / contracts / payments | ✅ done | `routes/{vendors,contracts,payments}.js`, `vendor-with-contract.test.js` |
| M5 | Budżet (planowany vs rzeczywisty, wydatki) | ✅ done | `routes/{budget,expenses}.js`, `budget.service.ts`, `pages/budget`, `budget-crud.test.js` |
| M6 | Catering (oferty/pakiety/dania/dodatki/wybór) | ✅ done | `routes/catering-{offers,packages,dishes,addons,selection}.js`, `pages/catering`, `catering-*-crud.test.js` |
| M7 | Zadania + spotkania | ✅ done | `routes/{tasks,meetings}.js`, `pages/tasks`, `tasks-crud.test.js`, `meetings-crud.test.js` |
| M8 | Seating + konflikty + wizualne przypisanie miejsc | ✅ done | `routes/{seating,seating-conflicts}.js`, `pages/seating/{round-table,conflicts-panel}`, `seating-crud.test.js` |
| M9 | Eksport JSON / hard-delete wesela | ✅ done | `wedding-export.test.js`, `wedding-delete.test.js` |
| M10 | Polish + wdrożenie | 🟢 ~done | wdrożenie+SSO ✅ LIVE (S-05 cutover osiągnięty 2026-06-16, realne dane); runner testów frontu ✅ (Vitest 15/15 + Playwright E2E w CI); bugi i18n/format/demo naprawione; zostaje tylko WCAG (low-pri) |
| Harmonogram | Ankieta DJ-a (przebieg dnia + muzyka + listy utworów) | 🟡 w toku | `migrations/20260601120000_wedding_timeline`, `routes/timeline.js`, `timeline-crud.test.js`, `core/services/timeline.service.ts`, `pages/harmonogram`; eksport „Wersja dla DJ-a" (Faza 4) jeszcze nie zrobiony |

## Bieżące

- 2026-06-16: **S-05 done — north star OSIĄGNIĘTY.** Cutover potwierdzony przez PO: apka żyje na `wedding-planner-kubitk.pl`, oboje partnerów loguje się przez SSO, działa na **realnych danych** pary. Infrastruktura zweryfikowana live (FE/BE/JWKS/SDK zdrowe; poprawiony błędny URL JWKS w `deploy-plan.md` — prawdziwe JWKS/SDK na `olive-camel-...`, nie `kubitksso.pl`). SSL pokrywa dzień ślubu (cert do 2026-08-08). Runbook + dowody: `context/deployment/s05-cutover-runbook.md`. Zostaje wyłącznie realna adopcja (`main_goal: market-feedback`). Opcjonalny polish: S-02/S-03/S-04.
- 2026-06-16: **F-02 done** — `ci-test-gate-and-smoke` scalony do `main` i zielony run na GitHub Actions. `deploy.yml` realnie bramkuje deploy frontu (BE+FE lint/test/build + E2E + migration-drift + smoke). Falstart: błędny sekret `SUPABASE_DB_PASSWORD` → SASL `28P01`, naprawione resetem hasła DB. Oba foundations (F-01+F-02) done → S-05 (production cutover, north star) odblokowany.
- 2026-06-09: przebudowa zakładki kontrahentów — 7-stopniowa oś statusów (migracja `vendor_status_rework`), usunięte wpisy o brakujących kontrahentach (dashboard + strona kontrahentów + `GET /vendors/missing`), naprawiony checkbox harmonogramu płatności, kafelki bez myślników.

## Otwarte

- [ ] **Kontrast WCAG / focus-ring** — wymaga axe-core lub oceny wzrokowej, niski priorytet.
- [x] ~~**Front: brak testów jednostkowych**~~ — Vitest skonfigurowany (`@angular/build:unit-test`, `ng test`), seed-suite 15/15 (`currency.format`, `date.format`, `guests.service`). Pozostaje rozszerzyć pokrycie na resztę serwisów i komponenty (F-01 cd.).
- [x] ~~Założyć `context/foundation/roadmap.md`~~ — istnieje; zreconciliowany 2026-06-08 (auto-taski sparkowane, north star → S-05 production cutover).
- [x] ~~`docs/demo-app/04-database.md` — część o auto-taskach nieaktualna~~ — posprzątane 2026-06-08 (sekcje auto-task oznaczone „USUNIĘTE 2026-05-26"; DDL/trigger/bootstrap/ER zaktualizowane).
- [x] ~~Dryf stacku (Sequelize+MySQL → Supabase Postgres)~~ — posprzątane 2026-06-08: `tech-stack.md` + `infrastructure.md` poprawione (baner + treść); `context/deployment/deploy-plan.md` operacyjnie poprawiony (Supabase provisioning, `SUPABASE_*` env vary); `wedding-planner-koncepcja.md` + `shape-notes.md` dostały baner-korektę (historyczne, treść zachowana). `wedding-planner-deployment.md`/`CLAUDE.md`/`README.md` były już poprawne (MySQL = SSO).

## Jak utrzymać ten plik (żeby dryf nie wrócił)

1. **Spec zamrożony.** `docs/demo-app/` zmieniasz tylko gdy zmienia się *zakres/model danych* — nigdy „bo coś zrobiłem".
2. **Postęp tylko tutaj.** Skończony moduł → jeden wiersz w tabeli + dowód (plik/test).
3. **Done = dowód.** Nie wpisuj „✅" bez route + serwisu + testu.
4. **Bez dziennika.** Naprawione bugi i raporty z audytów nie zostają tutaj — szczegóły bieżącej zmiany żyją w `context/changes/<id>/`.
