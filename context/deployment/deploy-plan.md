# Plan deployu — Wedding Planner na Hostingerze

Wykonywalna checklista wystawienia aplikacji na prod. Każdy punkt z `[ ]` to czynność do odhaczenia ręcznie — żaden agent ich nie zrobi za ciebie (panele Hostingera, panel SSO, sekrety GitHuba).

> **Sources of truth** (jak coś się rozjeżdża):
> - `wedding-planner-deployment.md` — szczegóły domen, .htaccess, SSO SDK (uwaga: oryginalny plan zakładał deploy backendu przez SSH z GitHub Actions; ostatecznie wybrany został Hostinger Git auto-pull — patrz §0)
> - `context/foundation/infrastructure.md` — risk register, operational story
> - `.github/workflows/deploy.yml` — co realnie się wykonuje przy `git push`

> ⚠️ **Korekta bazy danych (2026-06-08):** ten plan powstał 2026-05-20 i zakładał
> **MySQL na Hostingerze** dla wedding-plannera. To **nieaktualne** — dane planera
> żyją w **Supabase Postgres** (klient `@supabase/supabase-js` `service_role`,
> migracje `npx supabase db push`). Kroki „Create MySQL Database" i env vary `DB_*`
> poniżej zostały zastąpione provisioningiem Supabase i `SUPABASE_URL` /
> `SUPABASE_SERVICE_ROLE_KEY`. MySQL na pakiecie Hostinger należy wyłącznie do SSO.

---

## 0. Założenia (już rozstrzygnięte)

- **Jedno repo** dla całego `10xdevs/`. Brak osobnego pod-repo dla backendu.
- **Mechanizm deployu — różne dla FE i BE**:
  - **Backend**: Hostinger Git auto-pull śledzi `main`, robi `npm install` i restartuje Node.js app automatycznie po każdym pushu. GitHub Actions **nie** dotyka backendu — workflow ma tylko job `frontend`.
  - **Frontend**: GitHub Actions na push do `main` buduje, testuje i wgrywa `dist/` na FTP (Hostinger nie potrafi buildować Angulara).
- **Application root** dla node'a w Hostingerze = `wedding-planner/backend/` (podkatalog wewnątrz sklonowanego monorepo).
- **Hosting**: Hostinger Business, `wedding-planner-kubitk.pl` (front + back na tym samym pakiecie co `kubitksso.pl`).
- **URL-e na dziś**:
  - Frontend: `https://wedding-planner-kubitk.pl` (custom domain, FTP-deploy)
  - Backend: `https://deeppink-mole-431102.hostingersite.com` (auto-przypisana subdomena Hostingera, Git auto-pull)
  - SSO: `https://kubitksso.pl` (sibling repo, osobny deploy)
- **Baza danych**: **Supabase Postgres** (managed, off-host) dla danych wedding-plannera. MySQL na pakiecie Hostinger to baza SSO — wedding-planner jej nie używa.
- **Auth**: zewnętrzny SSO (`kubitksso.pl`). Backend wedding-plannera tylko weryfikuje RS256 JWT przez JWKS — nigdy nie waliduje haseł.
- **CORS**: setup jest **cross-origin** (front i back na różnych domenach). Backend musi mieć `FRONTEND_ORIGIN=https://wedding-planner-kubitk.pl` w env, a frontend musi w kodzie używać absolutnego URL-a backendu (`https://deeppink-mole-431102.hostingersite.com/api/...`). Patrz §5.4.

---

## 1. Status na dziś (2026-05-20)

Co już jest zrobione:

- [x] Frontend Angular 21 zescaffoldowany w `wedding-planner/frontend/`
- [x] Backend Express + Supabase JS (`service_role`) + JWKS middleware zescaffoldowany w `wedding-planner/backend/` (`npm audit` → 0 podatności)
- [x] `wedding-planner/frontend/src/index.html` zawiera tag `<script>` ładujący `https://kubitksso.pl/sdk/sso-sdk.js`
- [x] `.github/workflows/deploy.yml` — tylko job `frontend` (backend zdjęty po decyzji o Hostinger auto-pull)
- [x] Root `.gitignore` rozszerzony (Node, env, dist, OS)
- [x] `infrastructure.md` zarchiwizowany w `context/foundation/`
- [x] **Backend wdrożony** na `https://deeppink-mole-431102.hostingersite.com` — Hostinger Node.js app z auto-deploy z `main`
- [x] `GET /api/health` zwraca poprawny JSON. _(Uwaga 2026-06-08: stan z 2026-05-20 mówił „503 degraded — baza nieskonfigurowana"; od tego czasu DB Supabase jest podpięta, a sonda `isReachable()` została naprawiona — pytała o usuniętą tabelę `task_templates`, teraz pyta o `weddings` — więc health zwraca `200 ok`.)_

Czego brakuje (poniżej):

- [ ] Konto FTP + GitHub Secrets dla deployu frontu
- [ ] Projekt Supabase utworzony, schema zapushowana (`npx supabase db push`), `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` w env vars Node.js app
- [ ] Rejestracja apki `wedding-planner` w SSO + konta użytkowników
- [ ] Pierwszy deploy frontu (push do `main` → FTP → SPA na `wedding-planner-kubitk.pl`)
- [ ] End-to-end smoke test (SPA ładuje, `curl /api/health` zwraca `db: reachable`)

---

## 2. Hostinger — panel konfiguracji

### 2.1 Konto FTP (dla deployu frontu)

- [ ] Hostinger → **Files / FTP Accounts** → **Create FTP Account**
  - [ ] Username: dowolny (np. `wedding-planner-deploy`)
  - [ ] Folder: `/public_html/` (lub root domeny `wedding-planner-kubitk.pl`, jeśli ta domena ma własny `public_html`)
  - [ ] Password: wygeneruj silne, zapisz w password managerze
  - [ ] **NIE używaj master FTP** — wyciek w GitHub Secrets dałby dostęp do wszystkich domen na pakiecie
- [ ] Zapisz: `HOSTINGER_FTP_HOST`, `HOSTINGER_FTP_USER`, `HOSTINGER_FTP_PASS`

### 2.2 Baza danych — Supabase Postgres

> Zastępuje pierwotny krok „Create MySQL Database" (nieaktualny — patrz baner na górze).
> Wedding-planner **nie** tworzy bazy MySQL na Hostingerze.

- [ ] [supabase.com](https://supabase.com) → **New project** (region najbliżej, np. `eu-central`)
  - [ ] Zapisz hasło bazy w password managerze
- [ ] Z **Project Settings → API** skopiuj `Project URL` (→ `SUPABASE_URL`) i klucz **`service_role`** (→ `SUPABASE_SERVICE_ROLE_KEY`, **sekret** — nigdy do frontu)
- [ ] Z `wedding-planner/backend/` zapushuj schemę: `npx supabase db push` (15 migracji, RLS deny-all)
- [ ] Po wpisaniu wartości w env vars Node.js app (§2.4) `/api/health` zwróci `200 ok` (`db: reachable`)

### 2.3 Node.js Application (backend) — JUŻ WDROŻONE

Aktualny stan (z wdrożenia 2026-05-20):

- [x] Hostinger → **Advanced / Node.js** → Application utworzona
  - [x] **Node.js version**: 22 LTS
  - [x] **Application mode**: Production
  - [x] **Application root**: `wedding-planner/backend` (podkatalog wewnątrz sklonowanego monorepo)
  - [x] **Application URL**: `deeppink-mole-431102.hostingersite.com` (auto-przypisana subdomena Hostingera)
  - [x] **Application startup file**: `src/server.js`
  - [x] **Source / Git Repository**: URL repo `10xdevs`
  - [x] **Branch**: `main`
  - [x] **Auto-deployment**: **WŁĄCZONE** (Hostinger ciągnie po każdym pushu, robi `npm install`, restartuje)

Co ewentualnie do zmiany w przyszłości (nie blocker):

- [ ] Decyzja: czy backend ma żyć pod własną subdomeną `api.wedding-planner-kubitk.pl` zamiast auto-przypisanego `deeppink-mole-...`? Plusy: ładny URL, łatwiejszy do zapamiętania, kontrola DNS. Minusy: dorobić CNAME, zaktualizować `FRONTEND_ORIGIN` i frontowy API base URL.
- [ ] Alternatywa: front + back na tej samej domenie (`wedding-planner-kubitk.pl` z reverse-proxy z `/api/*` do node'a). To wymaga `.htaccess` ProxyPass / ModRewrite + zmiany Application URL — chowa CORS pod same-origin. **Plan na M2 albo M3, nie teraz.**

### 2.4 Zmienne środowiskowe dla Node.js App

W panelu Node.js app → **Environment variables**:

- [x] `NODE_ENV=production` *(ustawione przez Hostinger przy starcie aplikacji)*
- [x] `PORT` — *Hostinger wstrzykuje to automatycznie, nie ustawiaj ręcznie*
- [ ] `FRONTEND_ORIGIN=https://wedding-planner-kubitk.pl` ← **krytyczne dla CORS, ustaw zanim frontend wyląduje na prod**
- [ ] `SUPABASE_URL=<Project URL z §2.2>`
- [ ] `SUPABASE_SERVICE_ROLE_KEY=<service_role key z §2.2>` ← **sekret**, bypassuje RLS; nigdy do bundla frontu
- [ ] `JWKS_URL=https://olive-camel-278313.hostingersite.com/.well-known/jwks.json` ← **korekta 2026-06-16**: JWKS serwuje **backend SSO** (`olive-camel-...`), NIE `kubitksso.pl` (ten zwraca SPA admina = soft-404 HTML, więc weryfikacja JWT by padła). Lokalny `.env` ma już poprawny URL. Zweryfikuj że Hostinger Node env też.
- [ ] `JWT_ISSUER=<patrz §5.3 — zostaw puste jeśli SSO nie ustawia>` *(lokalny `.env` ma puste — SSO nie ustawia `iss`)*

Po dodaniu/zmianie env vars zrestartuj aplikację (panel Node.js → Restart).

### 2.5 SSL / domena / .htaccess (frontend)

- [ ] Hostinger → **Hosting / Domains** → upewnij się że `wedding-planner-kubitk.pl` ma podpięty **free SSL** (Let's Encrypt) z auto-renew
- [ ] Frontend build podczas deployu (workflow) wgra `.htaccess` z `dist/wedding-planner/browser/` — upewnij się że w projekcie Angular `.htaccess` jest jako asset w `angular.json` (treść w `wedding-planner-deployment.md` § .htaccess)

---

## 3. ~~Klucz SSH~~ → zdjęte z planu

Pierwotny plan deployu backendu szedł przez GitHub Actions + SSH (`appleboy/ssh-action` w workflowie). Po wdrożeniu zdecydowane: Hostinger Git auto-pull załatwia restart sam, workflow ma tylko frontend. Sekcja zdjęta.

**Konsekwencja**: nie generujemy klucza `wedding-planner-deploy`, nie wgrywamy publicznego do Hostingera, nie zapisujemy prywatnego w sekretach. Jeśli kiedyś backend dostanie testy i będziemy chcieli je bramkować przed deployem — wróć tu i odtwórz sekcję 3 z historii repo.

Awaryjnie nadal masz dostęp SSH do hosta przez master credentials Hostingera (panel → SSH Access). Używaj wyłącznie do rollbacków i debugu, nigdy z CI.

---

## 4. GitHub — Secrets (tylko FTP, nie SSH)

W repo na GitHubie → **Settings → Secrets and variables → Actions → New repository secret**:

- [ ] `HOSTINGER_FTP_HOST` — z punktu 2.1 (np. `ftp.wedding-planner-kubitk.pl`)
- [ ] `HOSTINGER_FTP_USER` — z punktu 2.1
- [ ] `HOSTINGER_FTP_PASS` — z punktu 2.1

Sekretów SSH (`HOSTINGER_SSH_HOST`, `_USER`, `_KEY`) nie konfigurujesz — backend nie używa GitHub Actions, więc Secrets dla SSH nie są potrzebne.

---

## 5. SSO — rejestracja apki + konta użytkowników

### 5.1 Rejestracja apki w SSO admin panel

- [ ] Otwórz `https://kubitksso.pl/apps` (zaloguj się jako admin SSO)
- [ ] **Create new app**:
  - [ ] **Slug / Name**: `wedding-planner` *(exact match — backend będzie szukał tej wartości w claim `apps[]` z JWT)*
  - [ ] **Display name**: `Wedding Planner`
  - [ ] **Domain**: `https://wedding-planner-kubitk.pl` *(exact match — SSO odrzuca redirecty z innym origin; UWAGA: bez końcowego slasha, dokładnie ten string. Backend pod `deeppink-mole-...` nie wpisuj — SSO weryfikuje origin frontu, nie backendu)*

### 5.2 Konta dla pary młodej

- [ ] Otwórz `https://kubitksso.pl/users` → **Create user**
- [ ] Konto 1: email + hasło dla Kacpra
  - [ ] Rola: `user`
  - [ ] Przypisana apka: `wedding-planner`
- [ ] Konto 2: email + hasło dla Weroniki
  - [ ] Rola: `user`
  - [ ] Przypisana apka: `wedding-planner`
- [ ] Zapisz `userId` obu kont (z panelu albo z bazy SSO) — będą potrzebne w M1 do ręcznego insertu w `weddings(partner_a_user_id, partner_b_user_id)`

### 5.3 Otwarte pytania (zweryfikuj zanim frontend wyląduje na prod)

- [ ] **`JWT_ISSUER`**: zaloguj się przez SSO, zdekoduj access_token (np. na `jwt.io`), sprawdź claim `iss`. Jeśli jest ustawiony — wpisz tę samą wartość w `JWT_ISSUER` w Hostinger env (punkt 2.4). Jeśli puste / brak claima — zostaw `JWT_ISSUER` w Hostingerze niewypełnione.
- [ ] **SDK URL liveness** (korekta 2026-06-16): SDK serwuje **backend SSO** `olive-camel-...`, nie `kubitksso.pl`. `index.html` już ładuje go z `https://olive-camel-278313.hostingersite.com/sdk/sso-sdk.js` (`data-login-url=https://kubitksso.pl`, `data-api-url=https://olive-camel-...`). Sanity: `curl -sI https://olive-camel-278313.hostingersite.com/sdk/sso-sdk.js` → `200` + `content-type: application/x-javascript`.
- [ ] **JWKS liveness**: `curl -s https://olive-camel-278313.hostingersite.com/.well-known/jwks.json` → JSON `{"keys":[...]}` (NIE HTML). Zweryfikowane zielone 2026-06-16.

### 5.4 CORS — sanity check (cross-origin setup)

Front (`wedding-planner-kubitk.pl`) i back (`deeppink-mole-431102.hostingersite.com`) żyją na różnych originach. Trzy rzeczy które muszą się zgrać:

- [ ] **Backend**: `FRONTEND_ORIGIN=https://wedding-planner-kubitk.pl` w env (punkt 2.4). Aktualny `cors.js` robi exact-match allowlist na origin requestu.
- [ ] **Frontend**: HTTP calls do backendu muszą używać absolutnego URL-a. W jakimś `environment.ts` (Angular env file) zdefiniuj `apiBaseUrl: 'https://deeppink-mole-431102.hostingersite.com'`. Brak — wszystkie `httpClient.get('/api/...')` polecą do `wedding-planner-kubitk.pl/api/...` i dostaną 404 z FTP-owego `.htaccess`.
- [ ] **SSO SDK**: niewrażliwe na cross-origin między FE i BE. SDK doklejnia tokeny do nagłówków HTTP, a token waliduje backend przez JWKS — z dowolnego origin.

Test po wdrożeniu frontu: w devtools Network sprawdź że requesty do `/api/*` lecą na `deeppink-mole-...`, zwracają `Access-Control-Allow-Origin: https://wedding-planner-kubitk.pl`, nie ma `OPTIONS` failures.

---

## 6. Pierwszy deploy frontu

Backend już śmiga (§1). Brakuje wystawienia frontu.

### 6.1 Pre-flight (lokalnie)

- [ ] `cd wedding-planner/frontend && npm start` — Angular renderuje stronę na `:4200`, w konsoli brak błędów
- [ ] DevTools → Network: tag `<script>` z `sso-sdk.js` ładuje się z 200 (lub akceptowalny 404 lokalnie jeśli DNS jeszcze nie przepiął)
- [ ] Wszystkie punkty z §2.1, §2.5, §4, §5 odhaczone

### 6.2 Push

- [ ] `git add` zmiany od bootstrap chain (jeśli jeszcze nie zacommitowane)
- [ ] `git commit -m "M0 - frontend deploy via GH Actions"`
- [ ] `git push origin main`

### 6.3 Obserwuj GitHub Actions

- [ ] Otwórz repo → **Actions** → najnowszy run "Build, test and deploy frontend"
- [ ] Job **frontend**: `npm ci` → `lint` (skip jeśli brak) → `test` → `ng build` → `FTP-Deploy` — wszystkie ✅
- [ ] Łączny czas pierwszego runa: 2–3 min (kolejne szybsze dzięki npm cache)

### 6.4 Backend deploy — automatyczny (Hostinger)

Nic nie robisz w workflowie. Hostinger:
- [x] Wykrywa push do `main`
- [x] Robi `git pull` w `~/<ścieżka>/repository`
- [x] Robi `npm install` w Application root (`wedding-planner/backend/`)
- [x] Restartuje Node.js app
- [ ] Sprawdź w panelu Hostingera → Node.js app → **Activity log** czy ostatni push przeszedł bez błędów. Jeśli `npm install` się wykrzaczył (np. wymyślona zależność), backend wisi na starej wersji do następnego pushu.

---

## 7. Prod smoke test

Po zielonym workflowie:

- [ ] Otwórz `https://wedding-planner-kubitk.pl` w przeglądarce w trybie incognito
  - [ ] Strona Angulara renderuje się
  - [ ] Kłódka SSL widoczna, brak ostrzeżeń
  - [ ] DevTools → Console: brak czerwonych błędów
  - [ ] DevTools → Network: `sso-sdk.js` ładuje się z kodem 200
- [ ] `curl https://deeppink-mole-431102.hostingersite.com/api/health`
  - [ ] Status 200 (jeśli `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` ustawione w §2.4)
  - [ ] Odpowiedź: `{"status":"ok","db":"reachable","uptime":...,"time":...}`
  - [ ] Jeśli `db:"unreachable"` → wróć do §2.4, najczęstszy winowajca to literówka w `SUPABASE_URL` albo wklejony klucz `anon` zamiast `service_role` (lub niezapushowana schema — `npx supabase db push`)
- [ ] Panel Node.js app w Hostingerze → logi: nie powinno być stack trace'ów

Stan na 2026-05-20: backend zwraca `503 degraded` bo §2.2 i §2.4 jeszcze nie odhaczone — to oczekiwane.

---

## 8. Rollback (jak coś się sypnie po deployu)

### 8.1 Rollback frontu

- [ ] Lokalnie: `git revert HEAD && git push origin main`
- [ ] GitHub Actions ponownie odpala workflow, FTP-Deploy wgrywa poprzednią wersję frontu w ~2 min

### 8.2 Rollback backendu

Skoro Hostinger ciągnie z `main`, rollback = revert commitu na `main`. Po pushu Hostinger automatycznie przeciąga + restartuje.

- [ ] `git revert HEAD && git push origin main` (ten sam revert co dla frontu — backend wraca razem)
- [ ] Sprawdź panel Hostingera → Node.js app → **Activity log** czy auto-pull się odpalił po reverten
- [ ] Jeśli nie odpalił (Hostinger czasem opóźnia webhook) → panel Node.js → **Manual deploy** / **Pull from Git** button

### 8.3 Awaryjnie — direct SSH (gdy auto-pull się sypie)

- [ ] Master SSH login z Hostinger panelu:
  ```bash
  ssh -p <port> <user>@<host>
  cd ~/domains/wedding-planner-kubitk.pl/repository  # lub gdziekolwiek Hostinger sklonował
  git log --oneline -5
  git reset --hard <poprzedni-sha>
  cd wedding-planner/backend
  npm ci --omit=dev
  touch tmp/restart.txt
  ```
- [ ] **NIGDY** nie rób `git push --force` na `main`. Cofnięcie historii rozjeżdża stan Hostingera, który ma swój checkout.

---

## 9. Po MVP — nie teraz, ale warto pamiętać

- [ ] Backend na `api.wedding-planner-kubitk.pl` (CNAME + Application URL) zamiast `deeppink-mole-...` — ładniejszy URL, łatwiejszy do zakomunikowania
- [ ] Backend pod tym samym originem co frontend przez reverse-proxy `.htaccess` (front i back na `wedding-planner-kubitk.pl`, `/api/*` ProxyPass do node'a) — wycina CORS, simpler debugging
- [ ] Druga subdomena `staging.wedding-planner-kubitk.pl` + drugi projekt Supabase + osobny workflow trigger na branchu `staging`
- [ ] Uptime monitoring (UptimeRobot, free tier) na `https://deeppink-mole-431102.hostingersite.com/api/health` — alert mail przy 503/timeout
- [ ] Backup bazy Supabase (`pg_dump` / eksport z dashboardu) raz w tygodniu na lokalny dysk (do dnia ślubu) — Supabase ma własne backupy, ale lokalna kopia to bezpiecznik
- [ ] Backend testy (jest + supertest) — wtedy wróć do mechanizmu GitHub Actions SSH dla bramki "testy zielone zanim deploy", zamień Hostinger auto-pull na manualny pull triggerowany z workflowa

---

## 10. Co NIE wchodzi w ten plan

Świadomie pominięte (oddzielne plany lub iteracje):

- Migracje schematu (23 tabele) — to **M1**, następny plan
- Frontend SSO interceptor + guard — brak protected route do testowania, ląduje razem z pierwszym US
- Frontend `environment.ts` z `apiBaseUrl` — wpadnie jak pierwszy `httpClient.get` się pojawi (M1 / M2)
- Update root `CLAUDE.md` / `README.md` — osobny cleanup pass z `/10x-rule-review`
- Rozwiązanie drift `wedding_members → partner_a/b_user_id` w `04-database.md` — lądy z M1
- Konfiguracja Cloudflare CDN dla frontu — Hostinger Business ma to w pakiecie, włączysz w panelu osobno
