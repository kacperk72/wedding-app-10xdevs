# Wedding Planner — setup CI/CD i hostingu

Dokument referencyjny pod implementację. Wszystkie decyzje już podjęte — przy starcie projektu można brać 1:1.

## Stack deployowy w skrócie

| Warstwa | Wybór | Koszt | Uzasadnienie |
|---|---|---|---|
| Frontend SPA (Angular) | Hostinger Business — `wedding-planner-kubitk.pl` | 0 zł dodatkowo | własny pakiet, .htaccess opanowany, FTP dostępny |
| Backend wedding-planner | Node.js + Express na Hostingerze | 0 zł dodatkowo | ten sam pakiet co frontend; backend tylko API + integracja SSO/Supabase |
| Baza wedding-planner | Supabase Postgres | wg planu Supabase | domenowe dane planera, migracje SQL, triggery i funkcje PG |
| Auth gateway | Nasz SSO (`kubitksso.pl`) — projekt `SSO/` | 0 zł dodatkowo | wspólny dla wszystkich apek, JWT RS256 z weryfikacją przez JWKS |
| CI/CD | GitHub Actions | 0 zł (publiczne repo lub 2000 min/mc na prywatnym) | standard, wsparcie FTP-Deploy |
| Domeny | `kubitksso.pl` (SSO), `wedding-planner-kubitk.pl` (planer) | wykupione | osobne domeny; bramka SSO i apka żyją obok siebie |
| SSL | Hostinger free SSL (Let's Encrypt) | 0 zł | auto-renew, wymagane dla cookies SameSite=None |

**Decyzja aktualna (2026-05-23):** SSO zostaje osobną aplikacją z MySQL. Wedding-planner nie trzyma danych domenowych w MySQL; cała baza planera żyje w Supabase Postgres. Backend wedding-plannera weryfikuje token z SSO przez JWKS i używa Supabase service-role jako prywatnego klienta DB.

## Architektura deployu

```
   ┌──────────────────────┐
   │   GitHub repo        │
   │   (main branch)      │
   └──────────┬───────────┘
              │ push
              ▼
   ┌──────────────────────┐
   │   GitHub Actions     │
   │                      │
   │  1. npm ci           │
   │  2. npm test         │
   │  3. ng build (front) │
   │  4. FTP-Deploy front │
   │  5. SSH deploy back  │
   └──────────┬───────────┘
              │ FTP / SSH
              ▼
   ┌─────────────────────────────────────┐
   │  Hostinger — wedding-planner-kubitk.pl
   │                                     │
   │  /public_html/      ← Angular SPA   │
   │  /node_app/  (lub osobny subdomain) │
   │     ← Express API                   │
   │     ← Supabase service-role client  │
   └────────────────┬────────────────────┘
                   │ JWT (Bearer w nagłówku)
                   │ JWKS pull (cache 1h)
                    ▼
   ┌─────────────────────────────────────┐
   │  Hostinger — kubitksso.pl           │
   │     ← SSO Express + Sequelize + MySQL│
   │     ← podpisuje tokeny RS256        │
   │     ← /.well-known/jwks.json        │
   │     ← /login + /api/auth/* + admin  │
   └────────────────┬────────────────────┘
                   │ HTTPS (SSL z Hostingera)
                   │
                   │ Supabase Postgres
                   │ (wedding-planner DB)
                   │
              Para młoda (przeglądarka)
                    ▲
                    │ flow:
                    │  1. wchodzi na wedding-planner-kubitk.pl
                    │  2. SDK widzi brak sesji → redirect kubitksso.pl/login
                    │  3. po zalogowaniu redirect z #sso_code=…
                    │  4. SDK exchange'uje kod, ma access token
                    │  5. odpytuje api wedding-plannera z Bearer
```

Kluczowa obserwacja: **wedding-planner backend nigdy nie weryfikuje hasła**. Hasła obsługuje wyłącznie SSO. Wedding-planner backend tylko sprawdza, że Bearer token jest podpisany przez znaną parę kluczy (pobraną z JWKS) i nie wygasł — czyli „ten user jest tym kim mówi że jest, SSO mu zaufał".

## Hostinger Business — co wykorzystujemy

**Wykorzystujemy:**
- **Node.js application support** — pod backend wedding-plannera (Express)
- FTP/SFTP access — dla GitHub Actions deploya frontu Angularowego
- SSH access — pod deploy backendu (`git pull` + restart Node.js app)
- Free SSL (auto-renew) — wymagane dla cookies SameSite=None używanych przez SSO
- Cloudflare CDN — przyspieszenie SPA
- Daily backups — bezpieczeństwo plików i bazy
- .htaccess (SPA fallback) — pod Angular routing

**Nie wykorzystujemy** (są w pakiecie, ale niepotrzebne):
- PHP/PHP-FPM — backend mamy w Node.js
- MySQL Hostingera dla wedding-plannera — dane planera trzymamy w Supabase Postgres
- Email serwerowy — brak notyfikacji w MVP
- Storage na pliki PDF — umowy trzymamy bez skanów (decyzja z koncepcji)

**Limity, które realnie obowiązują:**
- 50 GB NVMe storage (Angular dist/ ~5-10 MB + node_modules backendu ~150 MB → spokojnie)
- 30 Entry Processes (concurrent requests) → dla pary młodej overkill 10x
- Daily backups → wystarczy

## Domeny — układ katalogów

Plan: dwie osobne domeny, każda z własnym deployem.

```
kubitksso.pl                      ← SSO (osobny projekt, repo SSO/)
└── public_html/
    ├── (Node.js app: backend SSO)
    └── (statics serwowane z public/admin: SSO admin SPA)

wedding-planner-kubitk.pl         ← wedding-planner
└── public_html/
    ├── index.html                ← Angular SPA build
    ├── main-{hash}.js
    ├── styles-{hash}.css
    ├── assets/
    └── .htaccess                 ← SPA fallback
└── (Node.js app: backend wedding-plannera)
    └── /api/* endpointów chronione weryfikacją JWT przez JWKS
```

**Konfiguracja w panelu Hostingera dla `wedding-planner-kubitk.pl`:**
1. Domains → wykupiona już domena → wskaż document root na `public_html/wedding-planner` (lub główny katalog domeny).
2. SSL certificate → wygeneruj (free Let's Encrypt).
3. Node.js → utwórz aplikację Node.js wskazującą na katalog backendu (np. `/wedding-planner-backend/src/server.js`).
4. Supabase → utwórz projekt/bazę dla wedding-planner, uruchom migracje z `wedding-planner/backend/supabase/migrations`.
5. W panelu Hostingera ustaw env vars backendu: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWKS_URL`.
6. Zanotuj FTP credentials z panelu (potrzebne do GitHub Secrets dla deployu frontu).

**Powtórz analogicznie dla `kubitksso.pl`** (jeśli SSO jeszcze nie wdrożony).

## .htaccess (SPA fallback) — gotowy plik

Wrzucić do `public/.htaccess` w projekcie Angular, żeby trafił do `dist/` przy buildzie:

```apache
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]

# Cache: pliki z hashem cache'ujemy długo
<IfModule mod_headers.c>
  <FilesMatch "\.(js|css|woff2|woff|ttf|svg|png|jpg|jpeg|webp)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
  <FilesMatch "index\.html$">
    Header set Cache-Control "no-cache, no-store, must-revalidate"
  </FilesMatch>
</IfModule>

# HTTPS only
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
```

Trzy bloki:
1. SPA fallback — wszystko, co nie jest plikiem ani katalogiem, idzie do `index.html`.
2. Cache headers — `index.html` nie cache'ujemy (żeby nowe deploye były widoczne), pliki z hashem cache'ujemy rok (są niezmienne).
3. Wymuszenie HTTPS.

W `angular.json` dodać `public/` jako asset:
```json
"assets": [
  { "glob": "**/*", "input": "public" }
]
```

## GitHub Actions workflow — gotowy plik

Plik: `.github/workflows/deploy.yml`

```yaml
name: Build, test and deploy

on:
  push:
    branches: [main]
  workflow_dispatch:  # ręczne uruchomienie z UI

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install
        run: npm ci

      - name: Lint
        run: npm run lint --if-present

      - name: Test
        run: npm run test:ci

      - name: Build
        run: npm run build -- --configuration=production

      - name: Deploy frontend to Hostinger via FTP
        uses: SamKirkland/FTP-Deploy-Action@v4.3.5
        with:
          server:     ${{ secrets.HOSTINGER_FTP_HOST }}
          username:   ${{ secrets.HOSTINGER_FTP_USER }}
          password:   ${{ secrets.HOSTINGER_FTP_PASS }}
          local-dir:  ./frontend/dist/wedding-planner/browser/
          server-dir: /public_html/
          dangerous-clean-slate: false

      - name: Deploy backend via SSH (git pull + restart)
        uses: appleboy/ssh-action@v1.0.3
        with:
          host:     ${{ secrets.HOSTINGER_SSH_HOST }}
          username: ${{ secrets.HOSTINGER_SSH_USER }}
          key:      ${{ secrets.HOSTINGER_SSH_KEY }}
          script: |
            cd ~/wedding-planner-backend
            git pull
            npm ci --omit=dev
            # Restart Node.js app przez panel Hostingera lub touch'em pliku restart.txt
            touch tmp/restart.txt
```

**Uwagi:**
- `local-dir` zależy od `outputPath` w `angular.json` — sprawdź po `ng build`, gdzie ląduje output. Domyślnie Angular kładzie do `dist/<name>/browser/`.
- `dangerous-clean-slate: false` jest bezpieczniejsze — FTP-Deploy porównuje pliki przez hash i wgrywa tylko zmienione. Przy pierwszym deployu narzędzie tworzy `.ftp-deploy-sync-state.json` na serwerze — nie usuwać.
- Backend deployuje się przez SSH + git pull (nie FTP), bo musi też zainstalować zależności i zrestartować proces Node.js. Hostinger Node.js Hosting akceptuje `tmp/restart.txt` jako sygnał do restartu.

## GitHub Secrets do skonfigurowania

W Settings → Secrets and variables → Actions → New repository secret:

| Secret | Wartość | Skąd wziąć |
|---|---|---|
| `HOSTINGER_FTP_HOST` | np. `ftp.wedding-planner-kubitk.pl` | panel Hostinger → FTP Accounts |
| `HOSTINGER_FTP_USER` | np. `u253639506.planner` | panel Hostinger → FTP Accounts |
| `HOSTINGER_FTP_PASS` | hasło FTP | panel Hostinger (wygenerować **dedykowane** FTP konto z dostępem tylko do `/public_html/`, nie używać master account) |
| `HOSTINGER_SSH_HOST` | np. `wedding-planner-kubitk.pl` | panel Hostinger → SSH Access |
| `HOSTINGER_SSH_USER` | nazwa użytkownika SSH | panel Hostinger |
| `HOSTINGER_SSH_KEY` | private key (cały plik z `-----BEGIN OPENSSH PRIVATE KEY-----`) | wygenerowany lokalnie `ssh-keygen`, public key wrzucasz do panelu Hostingera |

**Zalecenie bezpieczeństwa:** w panelu Hostingera utworzyć **osobne FTP konto** dla katalogu `/public_html/` domeny `wedding-planner-kubitk.pl` (nie master account). Wtedy nawet wyciek sekretu z GitHuba nie daje dostępu do drugiej domeny (`kubitksso.pl`) ani do innych stronek na tym samym pakiecie.

**Dla SSH klucz** — używaj dedykowanej pary kluczy stworzonej tylko pod ten deploy, nie używaj swojego osobistego klucza SSH.

## Integracja z SSO — frontend (Angular SPA)

W `index.html` doklejamy tag SDK SSO przed `<app-root>`:

```html
<script
  src="https://kubitksso.pl/sdk/sso-sdk.js"
  data-sso-url="https://kubitksso.pl"
  data-app="wedding-planner"
></script>
```

To jeden `<script>`, zero plików do kopiowania, zero zależności npm po stronie auth — SDK żyje na serwerze SSO, jeden update tam = aktualizacja wszędzie.

W Angularze potrzebujesz tylko interceptora doklejającego token i guarda chroniącego trasy. Pełna instrukcja w `SSO/angular-sdk/README.md` — kopiujesz ~15 linii kodu (interceptor + guard) i jest gotowe.

**Rejestracja apki w SSO** (jednorazowo, robi admin w panelu `https://kubitksso.pl/apps`):
- Slug: `wedding-planner`
- Display name: `Wedding Planner`
- Domain: `https://wedding-planner-kubitk.pl` (prod) — **musi się zgadzać z origin**, inaczej SSO odrzuci redirect po loginie

**Tworzenie kont pary młodej** (jednorazowo, panel `https://kubitksso.pl/users`):
- Dwa konta `email` + `password`, role `user`
- Każde przypisane do apki `wedding-planner`
- Linkowanie ich w jedno wesele odbywa się **po stronie wedding-planner backendu** przez tabelę `wedding_members` (`wedding_id`, `user_id`, `role`). Pierwsze logowanie partnera_a robi `POST /api/weddings` → wywołuje PG RPC `create_wedding_with_bootstrap`, która tworzy wesele i wstawia założyciela jako `partner_a`. Partner_b dochodzi przez flow zaproszenia (`POST /api/weddings/:id/invite-partner` → `POST /api/weddings/accept-invite`).

## Integracja z SSO — backend (Express + JWT verification)

Backend wedding-plannera nigdy nie waliduje haseł i nie loguje. Przyjmuje wyłącznie tokeny RS256 podpisane przez SSO i weryfikuje je przez JWKS pobierane raz na godzinę z `https://olive-camel-278313.hostingersite.com/.well-known/jwks.json` — **API host**, nie `kubitksso.pl` (po split deployment SSO klucze publiczne żyją obok `/api/auth/*`, nie obok login UI; ten sam URL jest w `SSO/README.md:128`).

Instalacja (jednorazowo):

```bash
npm install jsonwebtoken jwks-rsa
```

Middleware weryfikujący token (przykład):

```js
// backend/src/middleware/sso-auth.js
const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");

const client = jwksClient({
  jwksUri: process.env.JWKS_URL || "https://olive-camel-278313.hostingersite.com/.well-known/jwks.json",
  cache: true,
  cacheMaxAge: 3600 * 1000, // 1h, zgodnie z Cache-Control z SSO
  rateLimit: true,
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) =>
    callback(err, key && key.getPublicKey()),
  );
}

module.exports = function ssoAuth(req, res, next) {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token" });

  jwt.verify(token, getKey, { algorithms: ["RS256"] }, (err, payload) => {
    if (err) return res.status(401).json({ error: "Invalid token", details: [err.message] });
    req.user = payload; // { userId, email, firstName, lastName, role, isActive, apps }
    next();
  });
};
```

Middleware / helper sprawdzający, że user należy do wesela. Ponieważ backend używa Supabase `service_role` (omija RLS), kontrola dostępu po stronie Express jest obowiązkowa. **RLS jest włączony deny-all na wszystkich 25 tabelach w `public`** (migracja `20260524090000_rls_lockdown`) jako defense-in-depth na wypadek przypadkowego wystawienia `anon`/`authenticated` w Data API — bez polityk każdy taki request kończy się pustym wynikiem. SECURITY DEFINER RPCs (`bootstrap_wedding`, `create_wedding_with_bootstrap`) mają `EXECUTE` odebrany od `PUBLIC` (migracja `20260524093000_revoke_security_definer_from_public`) — wywołać je może tylko `service_role`.

```js
// backend/src/middleware/belongs-to-wedding.js
const { supabase } = require("../config/database");

module.exports = async function belongsToWedding(req, res, next) {
  const weddingId = req.params.weddingId || req.body.weddingId;
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("sso_user_id", String(req.user.userId || req.user.sub))
    .single();

  const { data: member } = await supabase
    .from("wedding_members")
    .select("wedding_id")
    .eq("wedding_id", weddingId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) {
    return res.status(403).json({ error: "Forbidden" });
  }
  req.weddingId = weddingId;
  req.currentUserId = user.id;
  next();
};
```

Każdy endpoint wedding-plannera, który czyta lub modyfikuje dane wesela, leci z parą `[ssoAuth, belongsToWedding]`. To jest aplikacyjna warstwa autoryzacji nad Supabase service-role.

## Lokalny dev — wedding-planner + SSO razem

W trakcie developmentu odpalasz **oba serwery lokalnie**:

```bash
# Terminal 1: SSO
cd SSO/backend
npm run dev          # localhost:3000

# Terminal 2: wedding-planner backend
cd wedding-planner/backend
npm run dev          # localhost:3001 (inny port)

# Terminal 3: wedding-planner frontend
cd wedding-planner/frontend
npm start            # ng serve, localhost:4200
```

W `wedding-planner/backend/.env`:
```env
JWKS_URL=http://localhost:3000/.well-known/jwks.json
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<secret-service-role-key>
PORT=3001
```

W `wedding-planner/frontend/index.html` (dev):
```html
<script
  src="http://localhost:3000/sdk/sso-sdk.js"
  data-sso-url="http://localhost:3000"
  data-app="wedding-planner"
></script>
```

### Hermetyczny seam test-auth (tylko e2e / lokalne testy — NIGDY produkcja)

Backend ma furtkę uwierzytelniania dla testów e2e, sterowaną dwiema zmiennymi:

```env
AUTH_TEST_MODE=1                 # włącza seam; w produkcji MUSI być puste/nieustawione
AUTH_TEST_SECRET=<dowolny-sekret> # wspólny sekret HS256 dla stubu SSO i backendu
```

Gdy `AUTH_TEST_MODE=1` **i** `NODE_ENV != production`, backend akceptuje token
HS256 podpisany `AUTH_TEST_SECRET` zamiast weryfikacji przez JWKS. Obrona
wielowarstwowa: seam aktywuje się tylko poza produkcją, a serwer **odmawia
startu** (`assertTestAuthConfigSafe` rzuca przy boote), jeśli `AUTH_TEST_MODE=1`
trafi pod `NODE_ENV=production`. W panelu env Hostingera obie zmienne zostają
puste. (Patrz `wedding-planner/backend/src/middleware/test-auth.js`.)

**W panelu SSO** (`http://localhost:3000/apps`) zarejestruj apkę z `domain: http://localhost:4200` — wtedy bramka zaakceptuje redirect na localhost:4200.

## Workflow dewelopera

1. `feature/*` branch → praca lokalnie (3 terminale: SSO backend, wedding-planner backend, wedding-planner frontend).
2. PR → main → GitHub Actions automatycznie buduje, testuje, deployuje frontend (FTP) i backend (SSH).
3. Migracje DB: schemat planera idzie przez SQL w `wedding-planner/backend/supabase/migrations`. Na start można uruchomić migrację w Supabase SQL Editor; docelowo przez Supabase CLI w CI.
4. Rollback: frontend/backend przez GitHub/Hostinger deploy, baza przez backupy Supabase i ręcznie przygotowane migracje rollbackowe przy większych zmianach.

## Checklist przed pierwszym deployem

### Po stronie SSO (jeśli jeszcze nie wdrożony)
- [ ] Domena `kubitksso.pl` skonfigurowana w panelu Hostingera, SSL wygenerowany.
- [ ] Node.js application uruchomiona, wskazuje na `SSO/backend/src/server.js`.
- [ ] MySQL baza utworzona, dane w `SSO/backend/.env` na serwerze.
- [ ] Klucze RSA wygenerowane przy pierwszym starcie (`SSO/backend/keys/jwt-private.pem` + public).
- [ ] `https://olive-camel-278313.hostingersite.com/.well-known/jwks.json` zwraca poprawny JWKS (klucze publiczne żyją na API hoście, nie pod kubitksso.pl).
- [ ] `https://kubitksso.pl/login` otwiera ekran logowania.

### Po stronie wedding-planner
- [ ] Domena `wedding-planner-kubitk.pl` w panelu Hostingera, document root = `public_html/`.
- [ ] SSL wygenerowany.
- [ ] FTP konto dedykowane (dostęp ograniczony do `/public_html/`) utworzone.
- [ ] SSH klucz dla deploya backendu wgrany do panelu Hostingera, prywatny w GitHub Secrets.
- [ ] `.htaccess` w `frontend/public/` projektu, asset skonfigurowany w `angular.json`.
- [ ] Node.js application dla backendu wedding-plannera uruchomiona.
- [ ] Supabase project dla wedding-plannera utworzony, migracje uruchomione przez `npx supabase link --project-ref <ref>` + `npx supabase db push` (z katalogu `wedding-planner/backend/`).
- [ ] `npx supabase db advisors` lub MCP `get_advisors` pokazują 0 ERROR (RLS lockdown migracja zaaplikowana).
- [ ] `wedding-planner/backend/.env` / env panel Hostingera ma `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWKS_URL`.
- [ ] Apka `wedding-planner` zarejestrowana w SSO (panel `https://kubitksso.pl/apps`) z domeną `https://wedding-planner-kubitk.pl`.
- [ ] Konta pary młodej utworzone w SSO (panel `https://kubitksso.pl/users`), oboje przypisani do apki `wedding-planner`.
- [ ] Wesele nie wymaga ręcznego SQL — partner_a po pierwszym loginie wywołuje `POST /api/weddings`, które uruchamia `create_wedding_with_bootstrap` RPC; partner_b dołącza przez flow zaproszenia.
- [ ] GitHub Secrets dodane: 3× FTP + 3× SSH.
- [ ] `.github/workflows/deploy.yml` w repo.
- [ ] Pierwszy push na main → workflow zielony → strona działa pod HTTPS.

## Co jeśli coś pójdzie nie tak

| Symptom | Pierwsze podejrzenie |
|---|---|
| 404 na podstronach Angulara (np. `/budzet`) | brak `.htaccess` w deployu lub złe `RewriteRule` |
| Po loginie SSO redirect 400 „Invalid redirect" | apka `wedding-planner` w SSO ma niezgodną domenę — sprawdź panel SSO `/apps` |
| Po loginie redirect, ale `/api/*` zwraca 401 | wedding-planner backend nie pobiera JWKS — sprawdź `JWKS_URL` w `.env` backendu |
| `JsonWebTokenError: invalid signature` w logu backendu | klucze SSO zostały zregenerowane (np. `keys/` skasowany), a wedding-planner ma wycache'owany stary JWKS — restart backendu czyści cache |
| CORS error przy fetch SDK (`/sdk/sso-sdk.js`) | SSO ma już `Access-Control-Allow-Origin: *` na tym katalogu — sprawdź czy Node.js app SSO żyje |
| Mixed content w konsoli | brak HTTPS na którejś z domen — Let's Encrypt darmowo z panelu Hostingera |
| FTP-Deploy fail „550 Permission denied" | FTP konto nie ma uprawnień do katalogu — wygeneruj dedykowane FTP konto |
| SSH deploy fail „Permission denied (publickey)" | klucz publiczny nie wgrany do panelu Hostingera albo źle sformatowany prywatny w Secrets |
| Build pass, ale strona pusta | `local-dir` w workflow nie pasuje do faktycznego output Angulara — sprawdź `dist/` po `ng build` |
| Cookies refresh tokena nie idą cross-origin | SSO i wedding-planner muszą być oba na HTTPS w prod (SameSite=None wymaga Secure) |
| Test pass lokalnie, fail w CI | różna wersja Node, brak `--watch=false`, headless browser nie skonfigurowany |

## Linki referencyjne

- [Hostinger Business plan](https://www.hostinger.com/pricing)
- [Hostinger — Node.js Hosting](https://www.hostinger.com/tutorials/nodejs)
- [Hostinger — SSH Access](https://www.hostinger.com/tutorials/how-to-use-ssh)
- [SamKirkland/FTP-Deploy-Action](https://github.com/marketplace/actions/ftp-deploy)
- [appleboy/ssh-action](https://github.com/appleboy/ssh-action)
- [`jwks-rsa` (npm)](https://www.npmjs.com/package/jwks-rsa) — biblioteka pobierająca klucze publiczne z JWKS endpointu
- Wewnętrzne: `SSO/README.md`, `SSO/angular-sdk/README.md` — instrukcja integracji SDK po stronie frontu
