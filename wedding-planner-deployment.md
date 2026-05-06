# Wedding Planner — setup CI/CD i hostingu

Dokument referencyjny pod implementację. Wszystkie decyzje już podjęte — przy starcie projektu można brać 1:1.

## Stack deployowy w skrócie

| Warstwa | Wybór | Koszt | Uzasadnienie |
|---|---|---|---|
| Frontend (SPA) | Hostinger Business (już posiadane) | 0 zł dodatkowo | własny pakiet, .htaccess opanowany, FTP/SSH dostępny |
| Backend (DB + Auth) | Supabase | 0 zł (free tier) | Postgres + auth + RLS, w stacku 10xDevs |
| CI/CD | GitHub Actions | 0 zł (publiczne repo lub 2000 min/mc na prywatnym) | standard, wsparcie FTP-Deploy |
| Domena | subdomena istniejącej domeny | 0 zł | np. `planner.twojadomena.pl` |
| SSL | Hostinger free SSL | 0 zł | auto-renew, wymagane dla Supabase auth |

**Łączny koszt dodatkowy: 0 zł.** Cała chmura, jakiej dotykamy, to Supabase — używany jak biblioteka, nie jak infrastruktura. Brak konieczności uczenia się AWS/Azure/GCP.

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
   │  3. ng build         │
   │  4. FTP-Deploy dist/ │
   └──────────┬───────────┘
              │ FTP
              ▼
   ┌──────────────────────┐         ┌──────────────────────┐
   │  Hostinger Business  │         │   Supabase           │
   │                      │  HTTPS  │                      │
   │  /public_html/       │ ───────►│   Postgres + Auth    │
   │     planner/         │         │   + RLS              │
   │  (Angular SPA)       │         │                      │
   └──────────────────────┘         └──────────────────────┘
              ▲
              │ HTTPS (SSL z Hostingera)
              │
        Para młoda
```

Kluczowa obserwacja: **Hostinger serwuje tylko statyczne pliki**. Cała logika serwerowa (auth, baza, RLS) siedzi w Supabase, do którego SPA woła z przeglądarki.

## Hostinger Business — co wykorzystujemy

**Wykorzystujemy:**
- FTP/SFTP access — dla GitHub Actions (FTP-Deploy-Action)
- Free SSL (auto-renew) — wymagane dla Supabase auth (cookie SameSite/Secure)
- Cloudflare CDN — przyspieszenie SPA
- Daily backups — bezpieczeństwo plików (na wypadek pomyłki w deployu)
- Subdomeny (nielimitowane) — dedykowana subdomena dla projektu
- .htaccess (SPA fallback) — już opanowane
- Git deployment z panelu — **opcjonalny backup**, gdyby Actions padły

**Nie wykorzystujemy** (są w pakiecie, ale niepotrzebne):
- Node.js application support — backend mamy w Supabase
- MySQL/MariaDB — używamy Postgres w Supabase
- PHP/PHP-FPM — Angular nie korzysta
- Email serwerowy — brak notyfikacji w MVP

**Limity, które realnie obowiązują:**
- 50 GB NVMe storage (Angular dist/ ~5-10 MB → totalny overkill)
- 30 Entry Processes (concurrent requests) → dla pary młodej overkill 10x
- Daily backups → wystarczy

## Subdomena — układ katalogów

Plan: jedna subdomena dedykowana projektowi (nie miesza się z innymi stronkami).

```
public_html/
├── planner/              ← deploy target
│   ├── index.html
│   ├── main-{hash}.js
│   ├── styles-{hash}.css
│   ├── assets/
│   └── .htaccess         ← SPA fallback
├── inna-stronka/
└── ...
```

**Konfiguracja w panelu Hostingera:**
1. Domains → Subdomains → utwórz `planner.twojadomena.pl`.
2. Wskaż document root na `public_html/planner`.
3. SSL certificate → wygeneruj dla subdomeny (free Let's Encrypt z Hostingera).
4. Zanotuj FTP credentials z panelu (potrzebne do GitHub Secrets).

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
        run: npm test -- --watch=false --browsers=ChromeHeadless

      - name: Build
        run: npm run build -- --configuration=production

      - name: Deploy to Hostinger via FTP
        uses: SamKirkland/FTP-Deploy-Action@v4.3.5
        with:
          server:     ${{ secrets.HOSTINGER_FTP_HOST }}
          username:   ${{ secrets.HOSTINGER_FTP_USER }}
          password:   ${{ secrets.HOSTINGER_FTP_PASS }}
          local-dir:  ./dist/wedding-planner/browser/
          server-dir: /public_html/planner/
          dangerous-clean-slate: false  # nie usuwamy starych plików, FTP-Deploy robi inkrementalnie
```

**Uwagi:**
- `local-dir` będzie zależał od nazwy projektu w `angular.json` (sprawdzić po `ng build`, gdzie ląduje output — Angular 17+ kładzie do `dist/<name>/browser/`).
- `dangerous-clean-slate: false` (default) jest bezpieczniejsze — FTP-Deploy porównuje pliki przez hash i wgrywa tylko zmienione. Pierwsze wgranie zajmie minutę, kolejne kilka sekund.
- Przy pierwszym deployu narzędzie tworzy `.ftp-deploy-sync-state.json` na serwerze — nie usuwać.

## GitHub Secrets do skonfigurowania

W Settings → Secrets and variables → Actions → New repository secret:

| Secret | Wartość | Skąd wziąć |
|---|---|---|
| `HOSTINGER_FTP_HOST` | np. `ftp.twojadomena.pl` | panel Hostinger → FTP Accounts |
| `HOSTINGER_FTP_USER` | np. `u123456789.planner` | panel Hostinger → FTP Accounts |
| `HOSTINGER_FTP_PASS` | hasło FTP | panel Hostinger (wygenerować dedykowane FTP konto dla planner-a, nie używać master account!) |

**Zalecenie bezpieczeństwa:** w panelu Hostingera utworzyć **osobne FTP konto** dla katalogu `/public_html/planner/` (nie master account). Wtedy nawet wyciek sekretu z GitHuba nie daje dostępu do innych stronek na tym samym pakiecie.

## Supabase setup w skrócie

1. Załóż projekt na supabase.com (free tier).
2. Z panelu skopiuj:
   - `SUPABASE_URL` (np. `https://xxxxx.supabase.co`)
   - `SUPABASE_ANON_KEY` (publiczny klucz, idzie do frontu)
3. W kodzie Angular: użyj `@supabase/supabase-js`, klucze w `environment.ts` (nie w secret — anon key jest publiczny i chroniony przez RLS).
4. Skonfiguruj **RLS policies** dla każdej tabeli — to jest twój główny mechanizm dostępu (np. „SELECT na guests gdzie wedding_id IN (SELECT id FROM weddings WHERE owner_id = auth.uid() OR partner_id = auth.uid())").
5. Migracje SQL trzymaj w `supabase/migrations/` w repo (Supabase CLI).

**Uwaga:** `SUPABASE_ANON_KEY` jest publiczny i poprawnie wystawiać go w buildzie SPA. **RLS jest jedyną linią obrony** — nie bagatelizuj go.

## Lokalny dev — `.env.local` i Supabase local

W trakcie developmentu warto mieć **lokalnego Supabase** zamiast bić w produkcyjny:

```bash
npm install -g supabase
supabase init
supabase start  # odpala lokalnego Postgresa + auth w Dockerze
```

W `environment.ts` (dev): URL/key z `supabase status`. Migracje testujesz lokalnie, potem `supabase db push` na produkcję.

## Workflow dewelopera

1. `feature/*` branch → praca lokalnie z lokalnym Supabase.
2. PR → main → GitHub Actions automatycznie buduje, testuje, deployuje na Hostinger.
3. Migracje DB: ręczny `supabase db push` (świadoma akcja, nie automat — żeby nie zepsuć produkcyjnej bazy).
4. Rollback: w panelu Hostingera są daily backups; w Supabase point-in-time recovery na free tier ograniczony — ostrożnie z migracjami.

## Checklist przed pierwszym deployem

- [ ] Subdomena `planner.twojadomena.pl` utworzona w panelu Hostingera, document root = `public_html/planner`.
- [ ] SSL wygenerowany dla subdomeny.
- [ ] FTP konto dedykowane (z dostępem ograniczonym do `/public_html/planner/`) utworzone.
- [ ] `.htaccess` w `public/` projektu, asset skonfigurowany w `angular.json`.
- [ ] Projekt Supabase założony, klucze skopiowane.
- [ ] RLS włączony na każdej tabeli (CRITICAL).
- [ ] GitHub Secrets dodane: 3× FTP.
- [ ] `.github/workflows/deploy.yml` w repo.
- [ ] Pierwszy push na main → workflow zielony → strona działa pod HTTPS.

## Co jeśli coś pójdzie nie tak

| Symptom | Pierwsze podejrzenie |
|---|---|
| 404 na podstronach (np. `/budzet`) | brak `.htaccess` w deployu lub złe `RewriteRule` |
| Mixed content / CORS w konsoli | brak HTTPS na subdomenie albo zła `SUPABASE_URL` |
| FTP-Deploy fail „550 Permission denied" | FTP konto nie ma uprawnień do katalogu — użyj master account jednorazowo, ale lepiej dedykowane |
| Build pass, ale strona pusta | `local-dir` w workflow nie pasuje do faktycznego output Angulara — sprawdź `dist/` po `ng build` |
| Auth Supabase nie działa | brak HTTPS (cookies SameSite/Secure tego wymagają) |
| Test pass lokalnie, fail w CI | różna wersja Node, brak `--watch=false`, headless browser nie skonfigurowany |

## Linki referencyjne

- [Hostinger Business plan](https://www.hostinger.com/pricing)
- [Hostinger — deploy via Git (oficjalna)](https://www.hostinger.com/support/1583302-how-to-deploy-a-git-repository-in-hostinger/)
- [SamKirkland/FTP-Deploy-Action](https://github.com/marketplace/actions/ftp-deploy)
- [Supabase Angular guide](https://supabase.com/docs/guides/getting-started/quickstarts/angularjs)
- [Supabase RLS policies](https://supabase.com/docs/guides/auth/row-level-security)
