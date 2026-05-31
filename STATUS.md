# STATUS — wedding-planner

> **Jedyne źródło prawdy o POSTĘPIE.** Spec (co ma być) żyje w `docs/demo-app/`.
> Ten plik mówi tylko **co JEST zrobione** — weryfikowane kodem, nie opowiadane.
> Reguła: moduł = „done" tylko gdy istnieje **route + serwis frontu + test**.
>
> Testy: backend **100/100** (node:test). Front: **Vitest** skonfigurowany
> (`@angular/build:unit-test`, `ng test`) z seed-suite **15/15** (formattery + `GuestsService`);
> szersze pokrycie w toku. Dodatkowo `npm run build` + ręczny/Playwright przegląd.

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
| M10 | Polish + wdrożenie | 🟡 w toku | wdrożenie+SSO ✅ LIVE; bugi i18n/format/demo naprawione; zostaje WCAG + runner testów frontu |

## Otwarte

- [ ] **Kontrast WCAG / focus-ring** — wymaga axe-core lub oceny wzrokowej, niski priorytet.
- [x] ~~**Front: brak testów jednostkowych**~~ — Vitest skonfigurowany (`@angular/build:unit-test`, `ng test`), seed-suite 15/15 (`currency.format`, `date.format`, `guests.service`). Pozostaje rozszerzyć pokrycie na resztę serwisów i komponenty (F-01 cd.).
- [ ] (opcjonalnie) Założyć `context/foundation/roadmap.md` albo usunąć martwe odwołania do niego z `CLAUDE.md`.
- [ ] `docs/demo-app/04-database.md` — część o auto-taskach nieaktualna (feature usunięty migracją `strip_task_auto`), do sprzątnięcia przy okazji.

## Jak utrzymać ten plik (żeby dryf nie wrócił)

1. **Spec zamrożony.** `docs/demo-app/` zmieniasz tylko gdy zmienia się *zakres/model danych* — nigdy „bo coś zrobiłem".
2. **Postęp tylko tutaj.** Skończony moduł → jeden wiersz w tabeli + dowód (plik/test).
3. **Done = dowód.** Nie wpisuj „✅" bez route + serwisu + testu.
4. **Bez dziennika.** Naprawione bugi i raporty z audytów nie zostają tutaj — szczegóły bieżącej zmiany żyją w `context/changes/<id>/`.
