# Wedding Planner — koncepcja projektu zaliczeniowego

## Pomysł w jednym zdaniu

Aplikacja webowa dla pary młodej, która prowadzi przez cały proces przygotowań do ślubu — od pierwszej rezerwacji sali po układ stołów w dniu wesela — agregując zadania, kontrahentów, umowy, budżet i gości w jednym miejscu, z **fit-seats jako jednym z modułów**.

## Punkt startowy

Projekt **fit-seats** (Angular 21, standalone components, signals, Vitest) — działa jako oddzielna aplikacja do rozsadzania gości. Mamy już:

- Modele: `guest`, `table`
- Serwisy: `guest`, `table`, `persistence`, `print`
- Komponenty: `guest-list`, `hall-view`, `table-select-modal`, `configuration-panel`
- Single-page app, brak auth, brak backendu (persystencja prawdopodobnie lokalna)

**Decyzja:** kod fit-seats zostaje **skopiowany do projektu wedding plannera w `10xdevs`** i wpasowany jako jeden z modułów (lazy-loaded route). Stary fit-seats zostaje jako oddzielne repo w stanie zamrożonym — wszystkie zmiany robimy w nowym mono-repo. Model gości staje się **wspólny dla całej aplikacji** (RSVP → fit-seats → catering → budżet konsumują tę samą encję).

---

## Walidacja pod kątem wymagań kursu 10xDevs

### 1. Mechanizm kontroli dostępu — ✅ MOCNY

- Logowanie pary młodej — **dwa oddzielne, linkowane konta** (każde z partnerów ma własne dane logowania, oboje widzą i edytują to samo wesele).
- Stan wesela jest **prywatny per para** — naturalne uzasadnienie auth, nie udawane.
- Dane wrażliwe: imiona i nazwiska gości, kwoty umów, telefony kontrahentów. **Świadomie nie przechowujemy PESELi ani innych danych identyfikacyjnych** — utrzymujemy minimalny zakres danych osobowych, co ułatwia compliance.
- **W MVP brak ról zewnętrznych** (świadkowie / rodzina) — dostęp tylko dla pary młodej.
- **Konta tworzy admin** w panelu SSO (`https://kubitksso.pl/users`); para młoda nie ma self-service rejestracji. To uproszczenie scope'u (brak flow „verify email", „forgot password" w MVP) i zgodne z faktem, że projekt używa **jednej pary** rzeczywistych narzeczonych.
- **Auth obsługiwane przez nasz własny SSO** (`https://kubitksso.pl`, Node.js + MySQL + JWT/RS256, projekt `SSO/`), wspólny dla wszystkich aplikacji w ekosystemie. Wedding-planner jest tylko jedną z apek podpiętych pod tę bramkę.

### 2. Zarządzanie danymi (CRUD) — ✅ BARDZO MOCNE

Tu nie ma sztuczności — domena dosłownie wymaga CRUD-a w wielu encjach:

- Goście (z RSVP, dietą, +1, dziećmi, relacjami)
- Kontrahenci (DJ, fotograf, dekoratorka, catering, kwiaciarz, ksiądz, USC)
- Zadania z deadline'ami
- Umowy (PDF + metadane: kontrahent, kwota, terminy płatności)
- Pozycje budżetowe (planowane vs faktyczne)
- Stoły i przypisania (z fit-seats)

### 3. Logika biznesowa — ✅ MOCNE, KILKA DOMEN

Co najmniej **5 niezależnych decyzji domenowych** do wyboru — można zaimplementować część albo wszystkie. **Wynik logiki to wskaźniki/flagi w UI** (badge'e, kolory, listy „uwaga") — **nie push notifications ani maile**, bo to aplikacja webowa i użytkownik wchodzi sam, kiedy chce sprawdzić stan.

- **Timeline „w tył" od daty ślubu** — system wie, kiedy zwykle rezerwuje się salę (12 mc), DJ-a (8 mc), fotografa (6 mc), próbę dekoracji (1 mc) — generuje wstępny harmonogram zadań na podstawie daty wesela i oznacza w widoku, co jest opóźnione.
- **Budżet z prognozą i wskaźnikami przekroczeń** — porównuje wydane + zarezerwowane vs zaplanowane per kategoria, oznacza w UI kategorie po przekroczeniu progu (np. 90%) i prognozuje finalny koszt na podstawie tempa wydatków.
- **Agregator RSVP** — z indywidualnych odpowiedzi liczy: ile osób, ile dzieci, ile diet wegetariańskich/wegańskich/bezglutenowych, ile noclegów — gotowa karta dla cateringu i hotelu.
- **Lista nadchodzących płatności umów** — z terminów płatności w umowach buduje kolejkę „do zapłaty w najbliższych 7/30 dniach", widoczną na dashboardzie.
- **Walidator kompletności** — „90 dni do ślubu, brakuje: potwierdzenie dekoracji, ostateczna lista gości, próba sukni" — checklist na podstawie reguł domenowych, widoczny jako sekcja w UI.
- **Algorytm fit-seats** (istniejący) — można rozbudować o ograniczenia („nie sadzać X z Y", „rodziców rozdzielić na różne stoły", „dzieci razem z rodzicami").

**Każda z tych pięciu logik daje się opisać w jednym zdaniu** — spełnia kryterium kursu.

### 4. Artefakty z modułów 1-3 (PRD, specyfikacje, kontekst dla AI) — ✅ NATURALNE

Domena ślubna jest gęsta semantycznie — łatwo napisać:

- **PRD:** problem (chaos planowania, narzędzia rozproszone w Excelach i komunikatorach), persona (para młoda, oboje pracujący, planują ślub na 100-150 osób), user stories (jako para chcę widzieć w jednym miejscu, ile mi zostało do wydania w danej kategorii).
- **Specyfikacje:** model danych jest ciekawy (relacje gość ↔ stół ↔ dieta ↔ +1 ↔ rodzina), reguły biznesowe konkretne i mierzalne.
- **Kontekst dla AI:** zwięzły glosariusz terminów (RSVP, +1, świadek, salowy, plus jeden, lista życzeń), konwencje nazewnictwa.

### 5. Test e2e weryfikujący przepływ — ✅ ŁATWE

Naturalne kandydaty na **jeden** test (mocny sygnał z perspektywy użytkownika):

- „Dodaję gościa z dietą wegetariańską, oznaczam RSVP=tak, sadzam przy stole 3 — w widoku cateringu liczba diet wege rośnie o 1, w widoku stołu 3 pojawia się gość."
- Albo: „Dodaję wydatek 5000zł w kategorii 'fotograf' z budżetem 6000zł — kategoria pokazuje 83% wykorzystania, neutralny kolor; dodaję drugi wydatek 800zł — kategoria oznaczona jako przekroczona w UI."

### 6. CI/CD — ✅ STANDARD ANGULAR

GitHub Actions: build (`ng build`) + test (`ng test` z Vitest) + opcjonalnie deploy na Vercel/Netlify lub Firebase Hosting. Standardowy pipeline, nic nietypowego.

---

## Werdykt walidacji

| Wymaganie | Ocena | Komentarz |
|---|---|---|
| Kontrola dostępu | ✅ Mocna | naturalna potrzeba prywatności pary |
| CRUD | ✅ Bardzo mocna | wiele encji, każda potrzebna domenie |
| Logika biznesowa | ✅ Mocna | 5 niezależnych decyzji domenowych |
| Artefakty 1-3 | ✅ Naturalne | bogata domena, łatwy PRD |
| Test e2e | ✅ Łatwy | jasne golden flows |
| CI/CD | ✅ Standard | Angular + Vercel/Firebase |

**Bonus, którego nie ma żaden inny pomysł:** to projekt, którego **realnie używasz**. Eat-your-own-dogfood = najlepszy feedback loop, jaki możesz mieć w projekcie zaliczeniowym.

---

## Proponowane moduły / zakładki

### Pomysły użytkownika (zatwierdzone)

1. **Lista TODO + kalendarz** — zadania z deadline'ami, widok kalendarzowy.
2. **Umowy** — **bez przechowywania plików PDF** (skany trzymasz osobno na dysku). Zapisujemy **dane z umów**: kontrahent, kwota, harmonogram płatności (zaliczka, raty, płatność końcowa), daty.
3. **Budżet** — kategoria, planowane, wydane, terminy płatności.
4. **Dekoracje sali** — odrębna zakładka albo część większego modułu „kontrahenci".

### Propozycje dodatkowe

5. **Goście / RSVP** *(rdzeń produktu, źródło prawdy dla całej aplikacji)*
   - Lista gości z polami: imię + nazwisko, +1, dziecko (tak/nie + wiek), dieta, kontakt, wybór dania (z menu).
   - Status zaproszenia: do wysłania / wysłane / potwierdzone / odmowa.
   - **Wspólny model dla całej apki:** ten sam gość zasila fit-seats (rozsadzanie), menu (wybory dań), budżet (kalkulacja per osoba).
   - **Logika:** agregaty (liczba osób, diety, dzieci, niepotwierdzeni) widoczne na dashboardzie i w widokach cateringu.

6. **Kontrahenci / Dostawcy**
   - DJ, fotograf, kamerzysta, dekoratorka, kwiaciarz, catering, ksiądz, USC, sala, salowy, makijażystka, fryzjer.
   - Status: rozważany / spotkanie / zarezerwowany / zapłacony / wykonany.
   - Linkowane do umów i wpisów budżetu.
   - **Logika:** „brakujący kontrahenci na 90 dni przed ślubem" — wykrywa luki w stosunku do typowego harmonogramu.

7. **Timeline dnia ślubu**
   - Minutowy plan (przyjazd kwiaciarza 12:30, ceremonia 15:00, pierwszy taniec 19:00).
   - **Logika:** detektor konfliktów (fotograf wychodzi 17:00 a tort 18:00 = czerwona flaga w UI).

8. **Menu / Catering**
   - Definiujemy **listę dań głównych** (np. 3 opcje: mięsne / rybne / wegetariańskie) — każdy gość wybiera **jedno** z listy.
   - Definiujemy **kilka kolacji** serwowanych w trakcie wieczoru (np. ciepła kolacja 22:00, druga kolacja 1:00) — to są pozycje wspólne dla wszystkich, planowane przez parę.
   - **Logika:** zlicza wybory per opcję dania głównego (np. „47× mięsne, 23× wege, 15× rybne") + agregat diet specjalnych z RSVP — gotowy raport dla cateringu. Flaga w UI, jeśli ktoś z RSVP=tak nie wybrał jeszcze dania.

9. **Playlista / Muzyka** *(use case: przygotowanie do spotkania z DJ-em)*
   - Główne zastosowanie: przed spotkaniem z DJ-em zbierasz utwory, które pokazują wasz gust muzyczny.
   - Kategorie: **must-play** (pierwszy taniec, oczepiny, ulubione), **do-not-play** (czego nie chcecie), **vibe** (klimat, gust ogólny — to tu wrzucasz fajne kawałki przed spotkaniem), **prośby gości** (v2).
   - Pole na linki (Spotify/YouTube) + notatki („to graj w okolicach 22:00").
   - **Eksport** listy do PDF/CSV pod spotkanie z DJ-em.
   - **Logika:** agregat per kategoria, wyróżnienie pozycji oznaczonych jako kluczowe.

10. **Notatki i inspiracje**
    - Wolne notatki + linki (np. do Pinterest), zdjęcia inspiracji.
    - **Niska wartość logiczna**, ale często potrzebne — zostawić jako prosty CRUD.

11. **Dokumenty USC / kościelne** *(specyfika polska)*
    - Checklist wymaganych zaświadczeń (zaświadczenie z USC, świadectwo bierzmowania, nauki przedmałżeńskie) z deadline'ami.
    - **Logika:** alerty na podstawie daty ślubu (nauki min. X tygodni wcześniej).

12. **Dashboard / Strona główna**
    - „Co dzieje się dziś / w tym tygodniu" — agregat zadań, wskaźników budżetowych, nadchodzących płatności, brakujących wyborów dań.
    - Licznik dni do ślubu.
    - **Logika:** priorytetyzacja — co najpilniejsze, co opóźnione, co zbliża się terminowo.

---

## Rekomendowany MVP — co ciąć

Łatwo to przeskalować w kolosa. Twardy MVP:

**MUST mieć (MVP — wersja na obronę kursu):**
- Logowanie pary (dwa linkowane konta)
- Goście + RSVP (z agregatami)
- Kontrahenci + status
- Umowy (dane: kontrahent, kwoty, harmonogram płatności)
- Budżet z prognozą i wskaźnikami przekroczeń
- Lista TODO z deadline'ami
- Fit-seats jako moduł (kopia z istniejącego projektu, adaptacja)
- Dashboard

**NICE to have (v2 — po obronie, przed ślubem):**
- Timeline dnia ślubu
- Menu/catering (wybory dań przez gości)
- Playlista (kategorie + eksport dla DJ-a)
- Dokumenty USC (checklist z deadline'ami)
- Notatki / inspiracje

**Można pominąć całkiem:**
- Eksporty pod konkretnych dostawców (PDF/CSV) — robisz tylko, jeśli realnie tego potrzebujesz przed ślubem.
- Upload skanów PDF umów — skany trzymasz na dysku/Drive osobno, w apce same dane.

**Argument za tym cutem:** w MVP **logika biznesowa jest skoncentrowana na 4 decyzjach** (timeline w tył od daty ślubu, budżet z prognozą, RSVP-agregacja, lista nadchodzących płatności) + fit-seats. To wystarczy z naddatkiem do kursu, a ty masz realnie używalne narzędzie do dalszego rozwoju przed ślubem.

---

## Kluczowe ryzyka i decyzje

### Ryzyko: scope creep

Wedding planner to z natury bagno funkcji. Każda nowa zakładka kosztuje czas, którego do ślubu **masz tyle ile masz**. Trzymaj listę v2 osobno i nie ruszaj jej przed obroną.

### Decyzja: gdzie trzymać dane? — ROZSTRZYGNIĘTE

**Własny backend Node.js + Express + MySQL na Hostingerze**, identyczny stack co SSO. Auth realizowany przez **nasz SSO** (`https://kubitksso.pl`) — wedding-planner backend nie ma własnego mechanizmu logowania, weryfikuje wyłącznie tokeny RS256 wystawione przez SSO (przez JWKS pod `https://kubitksso.pl/.well-known/jwks.json`).

**Domena planera:** `https://wedding-planner-kubitk.pl` (frontend + backend razem, frontend statyczny, backend Node.js w tym samym pakiecie Hostingera albo na subdomenie `api.wedding-planner-kubitk.pl`).

**Izolacja per para (zamiast Supabase RLS):** każdy chroniony endpoint backendu wedding-planner sprawdza, że `JWT.userId` jest jednym z `partner_a_user_id` / `partner_b_user_id` na tabeli `weddings` zanim zwróci dane czy zaakceptuje zapis. Logika trywialna, spójna z RLS pojęciowo, wymaga tylko 5-linijkowego middlewaru.

**Czemu nie Supabase:** mamy już własny SSO który będzie obsługiwać wszystkie aplikacje w ekosystemie (`https://kubitksso.pl`). Dorzucanie Supabase Auth oznaczałoby drugi system tożsamości i drugi ekran logowania dla pary młodej. Supabase Postgres jako sama baza bez auth/RLS daje mniej niż MySQL na Hostingerze (nie mamy z tego korzyści, a wprowadzamy zewnętrzną zależność).

### Decyzja: jak włączyć fit-seats? — ROZSTRZYGNIĘTE

Kod fit-seats zostaje **skopiowany do projektu wedding plannera w `10xdevs`** i wpasowany jako moduł (lazy-loaded route, np. `/seating`). Stary fit-seats zostaje w stanie zamrożonym jako oddzielne repo — od momentu kopii wszystkie zmiany robimy tylko w nowym mono-repo. Model gości **nie jest dziedziczony** z fit-seats — w nowej apce projektujemy go pod potrzeby całości (RSVP, menu, fit-seats), a kod fit-seats adaptujemy do nowego modelu.

### Decyzja: PDF umów — ROZSTRZYGNIĘTE

**Nie przechowujemy plików PDF w aplikacji.** Skany umów trzymasz osobno (dysk lokalny / Google Drive). W apce tylko **dane wyciągnięte z umów**: kontrahent, kwota, harmonogram płatności, daty. To upraszcza architekturę (brak storage, brak uploadu, brak viewera) i wystarcza do generowania listy nadchodzących płatności i wpięcia do budżetu.

### Decyzja: AI w projekcie

Gdzie AI realnie pomoże, a gdzie jest dopisana na siłę:

**Sensowne:**
- Sugestie zadań na podstawie daty ślubu i już ustawionych kontrahentów (mała pomoc, ale spójna z domeną).
- Generowanie draftu maila/wiadomości do kontrahenta („daj mi ofertę DJ-a na 15 czerwca").

**Sztuczne:**
- AI „doradca ślubny" — gimmick, nie wnosi mierzalnej wartości.

W MVP można AI **całkiem pominąć** — wymagania kursu są spełnione bez niego. AI dorzucasz tylko, jeśli pasuje, nie żeby odhaczyć.

---

## Następne kroki (kolejność)

1. **PRD** — problem, persona, user stories, MVP cut, non-goals, glosariusz.
2. **Model danych** — schema MySQL (Sequelize models) + relacje. Tabela `weddings(partner_a_user_id, partner_b_user_id)` jako root encja; izolacja per para egzekwowana w warstwie aplikacji (middleware `belongsToWedding`).
3. **Architektura** — frontend (Angular SPA + SDK SSO) + backend (Express + Sequelize + MySQL), oba w jednym repo `wedding-planner/`, deploy na `wedding-planner-kubitk.pl`. Auth zewnętrzny przez `kubitksso.pl`.
4. **Plan migracji fit-seats** — mapa zmian (persistence z localStorage → MySQL przez API wedding-plannera, model gości jako shared, auth przez interceptor SSO).
5. **Stub MVP** — Dashboard + Goście + Logowanie (przez SSO) + lazy fit-seats. Reszta iteracyjnie.
6. **CI/CD** — GitHub Actions: build + test + FTP deploy frontu + SSH deploy backendu (szczegóły w `wedding-planner-deployment.md`).
7. **Test e2e** — jeden przepływ z punktu 5 walidacji powyżej.

---

## Timeline projektu

- **Start kursu:** ~25 maja 2026
- **Ślub:** 25 lipca 2026
- **Kolejność deadline'ów:** najpierw obrona kursu, potem ślub. Oba terminy są blisko siebie — między końcem kursu a ślubem jest realnie ~2 miesiące (zakładając standardową długość kursu), w których możesz iteracyjnie dorzucać funkcje z v2 (Timeline dnia, Menu, Playlista, USC) i używać apki w boju.

## Decyzje już rozstrzygnięte

- ✅ Auth: **własny SSO** (`https://kubitksso.pl`, Node.js + MySQL + JWT/RS256). Wedding-planner backend weryfikuje tokeny przez JWKS — nie ma własnego mechanizmu logowania.
- ✅ Backend wedding-planner: **Node.js + Express + Sequelize + MySQL** na Hostingerze (analogicznie do SSO, ten sam stack).
- ✅ Frontend wedding-planner: **Angular 21 + standalone components + signals** (analogicznie do SSO admin SPA).
- ✅ Domena: `https://wedding-planner-kubitk.pl` (osobna od SSO `https://kubitksso.pl`).
- ✅ fit-seats: **kopia do `10xdevs`** + adaptacja do nowego modelu danych. Stare repo zamrożone.
- ✅ Dane osobowe: **tylko imię i nazwisko** gościa, brak PESELi i innych identyfikatorów.
- ✅ Notyfikacje: **brak push/email** — wszystkie sygnały logiki biznesowej widoczne jako wskaźniki/flagi w UI.
- ✅ Zaakceptowane moduły: Goście/RSVP, Kontrahenci, Umowy (bez PDF), Timeline dnia ślubu, Menu, Playlista, Notatki, Dokumenty USC, Dashboard.
- ✅ Auth: **dwa oddzielne, linkowane konta** dla pary młodej (nie jedno wspólne).
- ✅ Tworzenie kont: **admin tworzy je w panelu SSO** (`https://kubitksso.pl/users`). Brak self-service rejestracji w MVP ani v2.
- ✅ Role zewnętrzne (świadkowie / rodzina): **nie**, w MVP dostęp tylko dla pary młodej. Nie planujemy też w v2.
- ✅ Umowy: **bez przechowywania PDF**, tylko dane (kontrahent, kwoty, harmonogram płatności). Skany trzymane osobno na dysku.
- ✅ Umowy w MVP, nie v2 (uproszczone, bo bez storage'u).

## Pytania otwarte do rozstrzygnięcia

Brak — wszystkie pytania zostały rozstrzygnięte. Można ruszać z PRD.
