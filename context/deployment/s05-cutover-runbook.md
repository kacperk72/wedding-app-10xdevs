# S-05 Production Cutover — Runbook ⭐ (north star)

> **STATUS: CUTOVER OSIĄGNIĘTY (2026-06-16).** Apka żyje na `wedding-planner-kubitk.pl`,
> oboje partnerów loguje się przez SSO, działa na realnych danych pary. Wszystkie
> budowalne/operacyjne kroki odhaczone (sekcje 1–5 ✅). Pozostaje wyłącznie
> **realna adopcja** (codzienne używanie zamiast Excela) — okno obserwacji
> `main_goal: market-feedback`, nie zadanie do zrobienia. Runbook zostaje jako
> referencja i ścieżka odtworzenia / re-seedu.

> **Cel S-05:** oboje partnerów loguje się przez SSO na `https://wedding-planner-kubitk.pl`
> z własnego telefonu, widzi swój **realny** plan ślubu i od tego dnia przestaje
> używać Excela. To milestone **operacyjny**, nie kodowy — większość kroków
> robisz w panelach (SSO admin, Hostinger) i wpisując realne dane.
>
> Źródła prawdy: `context/foundation/roadmap.md` §S-05, `context/deployment/deploy-plan.md`
> (operacyjny detal), `wedding-planner-deployment.md`. Stan zweryfikowany **2026-06-16**.

## 0. Stan infrastruktury — zweryfikowany live 2026-06-16

Wszystko poniżej **już działa**, nie trzeba nic stawiać:

| Komponent | URL | Stan |
|---|---|---|
| Frontend SPA | `https://wedding-planner-kubitk.pl` | ✅ HTTP 200, SSL OK |
| Backend | `https://deeppink-mole-431102.hostingersite.com/api/health` | ✅ `status:ok, supabase:reachable` |
| SSO JWKS | `https://olive-camel-278313.hostingersite.com/.well-known/jwks.json` | ✅ JSON, realne klucze RSA |
| SSO SDK | `https://olive-camel-278313.hostingersite.com/sdk/sso-sdk.js` | ✅ `application/x-javascript` |
| SSO login/admin | `https://kubitksso.pl` | ✅ SPA admina (NIE serwuje JWKS/SDK — to backend olive-camel) |
| CI gate (F-02) | `.github/workflows/deploy.yml` | ✅ zielony 2026-06-16 |
| E2E (F-01) | hermetyczny Playwright | ✅ w CI |

> ⚠️ Pułapka, którą już rozbroiliśmy: `kubitksso.pl/.well-known/jwks.json` i
> `kubitksso.pl/sdk/sso-sdk.js` zwracają **HTML SPA admina** (soft-404). Prawdziwe
> JWKS/SDK są na backendzie SSO `olive-camel-...`. Kod (`backend/.env` `JWKS_URL`,
> `frontend/src/index.html`) używa już poprawnych URL-i.

## 1. SSO — rejestracja apki i konta pary  `[owner: Ty / admin SSO]`  ✅ ZROBIONE (2026-06-16)

Potwierdzone przez PO: logowanie na prod działa, czyli apka jest zarejestrowana w SSO z poprawną domeną i oba konta pary istnieją + są przypisane. Zostawione dla referencji / odtworzenia:

- [x] `https://kubitksso.pl/apps` → apka `wedding-planner`, Domain `https://wedding-planner-kubitk.pl` (exact, bez slasha)
- [x] `https://kubitksso.pl/users` → 2 konta pary, przypisane do apki `wedding-planner`

## 2. Utworzenie wesela — przez apkę (bootstrap M2)  `[owner: para]`

Wesele **nie** powstaje ręcznym SQL — robi je flow aplikacji (`create_wedding_with_bootstrap` RPC).
Login + apka działają na prod (PO, 2026-06-16) — odhacz gdy potwierdzone że wesele + oba członkostwa istnieją:

- [ ] Partner A: zaloguj się przez SSO (konto 1) → **wedding-setup** → utwórz wesele (imiona, data, budżet)
- [ ] Partner A: wyślij zaproszenie partnera B → Partner B akceptuje (tworzy `wedding_members`)
- [ ] Sanity: oboje widzą ten sam dashboard z odliczaniem do daty ślubu

## 3. Seed realnych danych  `[owner: implementer + para]`  ✅ ZROBIONE (2026-06-16)

Potwierdzone przez PO: apka na prod działa na **realnych danych** pary (nie demo). Poniżej zostaje jako referencja narzędzi importu na przyszłość / re-seed.

### 3a. Goście + stoły — skryptem (import istnieje)

`scripts/import-seating.js` importuje stoły+gości z exportu `wedding-tables` JSON. Wymaga istniejącego wesela (krok 2).

```bash
cd wedding-planner/backend
# wymaga w .env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (prod)
node scripts/import-seating.js --list                         # znajdź wedding-id utworzonego wesela
node scripts/import-seating.js --file "<export.json>" --wedding-id <uuid> --dry-run   # podgląd
node scripts/import-seating.js --file "<export.json>" --wedding-id <uuid>             # właściwy import
```
- Mapuje: `groom→rodzina_pana_mlodego`, `bride→rodzina_panny_mlodej`, `mutual→wspolni_znajomi`
- Wszyscy goście `table_id=null` (rozsadzasz ręcznie w `/app/rozsadzenie`), `diet=pending`
- `--clear` czyści istniejących gości/stoły/konflikty przed importem

### 3b. Kontrahenci / umowy / płatności / zadania — ręcznie w UI

**Brak importu** dla tych encji (świadoma decyzja z roadmapy — pierwsza sesja pary i tak jest exploratory). Wpisujecie ręcznie w aplikacji podczas pierwszej sesji:
- Kontrahenci → strona Kontrahenci
- Umowy + płatności → strona Umowy
- Zadania + spotkania → strona Zadania
- Catering (jeśli dotyczy) → strona Catering (wpiszcie ofertę swojej sali)

## 4. Smoke + pierwszy realny login  `[owner: implementer]`

Zrób **zanim** para zacznie używać na poważnie — wyłapie błędną rejestrację domeny w SSO.

```bash
curl -s https://deeppink-mole-431102.hostingersite.com/api/health    # {"status":"ok","supabase":"reachable",...}
curl -sI https://wedding-planner-kubitk.pl | head -1                  # HTTP/2 200
```
- [ ] Incognito → `https://wedding-planner-kubitk.pl` → klik login → redirect na `kubitksso.pl` → po zalogowaniu wraca na `wedding-planner-kubitk.pl` **bez** generic error
- [ ] DevTools → Network: requesty `/api/*` lecą na `deeppink-mole-...`, zwracają `Access-Control-Allow-Origin: https://wedding-planner-kubitk.pl`, brak fail OPTIONS
- [ ] Dashboard pokazuje realne dane z kroku 3 (goście) + „Wymaga uwagi" z 4 strumieni

## 5. Operacyjne TODO po cutoverze

- [x] **SSL auto-renew** — **zde-ryzykowane 2026-06-16**: obecny cert Let's Encrypt ważny `10 maja → 8 sierpnia 2026`, czyli **już pokrywa dzień ślubu** (~25.07). Auto-renew odpali ~9 lipca. Opcjonalny lekki check 2026-07-18 że renew się odświeżył, ale nawet bez niego cert jest ważny do 8 sierpnia.
- [ ] (opcjonalnie) UptimeRobot na `/api/health` — alert przy 503/timeout
- [ ] (opcjonalnie) tygodniowy `pg_dump`/export Supabase do dnia ślubu jako bezpiecznik

## 6. Rollback

Identyczny jak w `deploy-plan.md` §8: `git revert HEAD && git push origin main` cofa FE (FTP) i BE (Hostinger auto-pull) razem. **Nigdy `git push --force` na `main`** — rozjeżdża checkout Hostingera. Awaryjnie: master SSH z panelu Hostingera (`deploy-plan.md` §8.3).

## Definition of Done (S-05)

- [ ] Apka `wedding-planner` zarejestrowana w SSO z exact domain
- [ ] 2 konta pary istnieją i przypisane do apki
- [ ] Wesele utworzone, oboje partnerów to członkowie (`wedding_members`)
- [ ] Realni goście zaimportowani; kontrahenci/budżet wpisane (choćby częściowo)
- [ ] Oboje zalogowali się z **własnego telefonu** i zobaczyli swój realny plan
- [ ] Smoke zielony; SSL renew check zapisany na 2026-07-18
