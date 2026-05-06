# Prompt do generatora prototypów UI — Wedding Planner

> Skopiuj poniższy blok do v0.dev / Lovable / Bolt.new / podobnego narzędzia.
> Jeśli narzędzie ma limit długości — można wygenerować ekrany etapami (najpierw nawigacja + Dashboard + Goście, potem reszta).

---

## PROMPT

Zbuduj klikalny prototyp aplikacji webowej **Wedding Planner** dla pary młodej. Cel: zobaczyć układ ekranów i interakcje przed implementacją w Angularze. Kod ma być w **React + Tailwind CSS + shadcn/ui** (lub odpowiedniku Twojego narzędzia). Bez backendu, dane mockowane in-memory.

### Kontekst produktu

Aplikacja prowadzi narzeczonych przez cały proces przygotowań do ślubu — agreguje gości, kontrahentów, umowy, budżet, zadania i układ stołów w jednym miejscu. Użytkownicy: dwoje narzeczonych z dwoma oddzielnymi, linkowanymi kontami — oboje widzą i edytują to samo wesele.

**Data ślubu w mockach:** 25.07.2026 (licznik dni do ślubu liczony od dziś).

### Styl wizualny

- **Estetyka:** nowoczesny, czysty, lekko ciepły — elegancja bez "ślubnego kiczu". Neutralne tła (kremowy/off-white) + jeden akcent kolorystyczny. Zaproponuj jeden z: głęboki burgund (#7B2D3F), butelkowa zieleń (#3F5C3A), terakota (#C8623E) albo dymny granat (#2D3E50). Pastele jako tła kart.
- **Typografia:** szeryfowy do nagłówków (Cormorant Garamond / Playfair Display) + bezszeryfowy do treści (Inter / DM Sans). Hierarchia wyraźna.
- **Layout:** desktop-first z **sidebar po lewej + content po prawej**. Responsywność: na tablecie sidebar zwijany, na mobile bottom-nav.
- **Komponenty:** karty z subtelnym cieniem, zaokrąglone rogi (rounded-2xl), badge'e statusów w pastelowych tłach, tabele z filtrowaniem i sortowaniem, modale dla form, inline edycja gdzie się da.
- **Empty states** z ikoną + jednym zdaniem opisu + CTA.
- **Mikro-animacje** na hover, fade-in dla kart.

### Język interfejsu

**Cały UI po polsku** — etykiety, przyciski, statusy, tooltipy, mock-dane (imiona gości, nazwy firm, kategorie budżetu). Daty w formacie `DD.MM.YYYY`, kwoty w **PLN** z separatorem tysięcy (np. `12 500 zł`).

### Struktura nawigacji

**Sidebar (lewa kolumna):**
1. Dashboard
2. Goście / RSVP
3. Kontrahenci
4. Umowy
5. Budżet
6. Zadania
7. Rozsadzenie gości
8. Ustawienia

**Header (góra):** logo + nazwa pary ("Anna & Marek") + duży licznik **"Do ślubu: 85 dni"** + dwa avatary (oboje partnerów — wskazują, że konto jest połączone) + dropdown wylogowania.

### Ekrany do wygenerowania

#### 1. Logowanie

- Split-screen: lewa kolumna z hero-image i hasłem **"Zaplanujcie ślub razem, w jednym miejscu"** + 3 bullety korzyści. Prawa kolumna z formularzem (email + hasło, link "Zapomniałem hasła", przycisk "Zaloguj się", separator, link "Załóż konto").
- Pod formularzem: link **"Połącz konto z partnerem"** + krótki opis ("Twój partner założy własne konto i wpiszesz jego e-mail, żeby oboje widzieli to samo wesele").

#### 2. Dashboard

- **Hero u góry:** "Do ślubu zostało **85 dni**" wielką szeryfówką + data ślubu (25.07.2026) + nazwiska pary.
- **4 karty wskaźników w rzędzie:**
  - **Goście:** "89 / 127 potwierdzonych" + pasek postępu + małe liczby (oczekuje / odmowa).
  - **Budżet:** "62 400 zł / 85 000 zł" + pasek postępu, **badge ostrzeżenia** jeśli > 90%.
  - **Najbliższe płatności:** "8 200 zł w 30 dni" + liczba pozycji.
  - **Zadania w tym tygodniu:** "5 zadań" + **czerwony badge "2 opóźnione"**.
- **Sekcja "Wymaga uwagi":** lista 4-5 elementów z różnych modułów, każdy z ikoną i CTA. Przykłady mocków:
  - "🎵 Brakuje DJ-a — typowo rezerwowany 8 mc przed ślubem"
  - "🍽️ Catering: 14 gości jeszcze nie wybrało dania głównego"
  - "💰 Płatność dla fotografa za 7 dni: 2 000 zł"
  - "👗 Próba sukni — termin minął 3 dni temu"
- **Sekcja "Nadchodzące zadania"** — pozioma oś czasu na 14 dni z kropkami zadań.

#### 3. Goście / RSVP

- **Pasek agregatów u góry** (sticky): "127 zaproszonych • 89 potwierdzonych • 24 oczekuje • 14 odmów • 23 wege • 8 dzieci • **14 nie wybrało dania**".
- **Tabela gości** z kolumnami: imię i nazwisko, status RSVP (badge: ⏳ oczekuje / ✅ potwierdzony / ❌ odmowa), +1 (ikona), dziecko (ikona + wiek), dieta (badge: 🌱 wege / 🌿 wegan / 🌾 bezglutenowa), wybór dania (dropdown inline), stół (link do seating lub "—"), akcje (edytuj/usuń).
- **Filtry nad tabelą:** status, dieta, +1, dziecko, "ma wybrane danie".
- **Sortowanie** po każdej kolumnie.
- **Przycisk "Dodaj gościa"** w prawym górnym rogu → modal z formularzem (imię, nazwisko, +1, dziecko, dieta, kontakt).
- **Mocki:** ~50 gości, polskie imiona, wymieszane statusy.

#### 4. Kontrahenci

- **Grid 3 kolumn — karty kontrahentów.** Każda karta: ikona kategorii, kategoria (DJ/Fotograf/Catering/Kwiaciarz/Sala/USC/Ksiądz/Makijaż/Dekoracje), nazwa firmy, kontakt (telefon, e-mail), **badge statusu** (rozważany / spotkanie / zarezerwowany / zapłacony / wykonany — różne kolory), kwota umowy (jeśli jest), przyciski "Edytuj" / "Zobacz umowę".
- **Filtrowanie** po statusie i kategorii (chips na górze).
- **Sekcja na górze "⚠️ Brakujący kontrahenci na 85 dni przed ślubem"** — żółta karta z listą luk (np. "Brak zarezerwowanego DJ-a, kwiaciarza").
- **Karta "+ Dodaj kontrahenta"** na końcu siatki.
- **Mocki:** ~10 kontrahentów w różnych statusach.

#### 5. Umowy

- **Tabela:** kontrahent (link do karty kontrahenta), kategoria, kwota całkowita, harmonogram płatności (mini-pasek z kropkami: zaliczka 🟢 / rata 🟢 / rata 🟡 zaplanowana / final ⚪), data podpisania, status (badge: zaliczka opłacona / w trakcie / opłacone w całości).
- **Sekcja na górze "Nadchodzące płatności (30 dni)"** — lista 4-5 pozycji z datą, kontrahentem, kwotą, dni-do-terminu (czerwony jeśli ≤ 7).
- **Brak uploadu PDF** — w formularzu tylko dane (kontrahent, kwota, harmonogram dat płatności jako lista).
- **Mocki:** ~8 umów, łącznie ~25 płatności rozłożonych w czasie.

#### 6. Budżet

- **Sumaryczna karta na górze:** trzy duże liczby obok siebie — **Planowane** (85 000 zł), **Zarezerwowane** (12 800 zł, kwoty z umów do zapłaty), **Wydane** (49 600 zł). Pod spodem **prognoza końcowa** ("Prognozujemy 88 200 zł — 4% nad budżetem", **czerwony badge** jeśli > planu).
- **Lista kategorii** (sala, catering, fotograf, kwiaty, dekoracje, muzyka, stylizacja, USC, alkohol, prezenty, transport, hotel...) — każda kategoria w wierszu: nazwa, planowana kwota, wydana, **pasek postępu z kolorem**: zielony do 70%, żółty 70-90%, czerwony > 90%, szary jeśli przekroczone.
- **Rozwijalny wiersz** kategorii pokazuje listę transakcji (data, opis, kwota, "edytuj").
- **Przyciski:** "Dodaj wydatek" (modal), "Edytuj plan kategorii".
- **Mocki:** ~15 kategorii, kilka przekroczonych dla efektu wizualnego.

#### 7. Zadania

- **Toggle u góry:** "Lista" / "Kalendarz".
- **Widok lista:** trzy sekcje pogrupowane:
  - 🔴 **Opóźnione** (czerwone tło, ~3 zadania)
  - 🟡 **W tym tygodniu** (~5 zadań)
  - ⚪ **W przyszłości** (~17 zadań, scroll)
- Każde zadanie w wierszu: checkbox, tytuł, kategoria (badge), deadline, **badge "auto"** jeśli wygenerowane przez system z timeline'u w tył od daty ślubu (np. "Rezerwacja DJ-a — 8 mc przed").
- **Widok kalendarz:** miesięczny grid, kropki przy dniach z zadaniami, kliknięcie dnia → boczny panel z listą.
- **Przycisk "Dodaj zadanie"** → modal (tytuł, kategoria, deadline, opis).
- **Mocki:** ~25 zadań rozłożonych od dziś do daty ślubu.

#### 8. Rozsadzenie gości (seating)

- **Trzy kolumny:**
  - Lewa (250px): **lista gości nieprzypisanych** — karty z drag-handle, imię + nazwisko + ikony +1/dziecko/dieta. Filtr "tylko potwierdzeni".
  - Środkowa (flex): **plan stołów** — okrągłe stoły rozłożone w przestrzeni, każdy stół z miejscami wokół (kółka), zajęte miejsca z imionami, puste szare. Drag goścć z lewej kolumny → upuść na stół.
  - Prawa (250px, opcjonalna): **panel konfliktów** — lista par, których nie sadzać razem (X z Y), z linią łączącą je w widoku.
- **Pasek narzędzi nad planem:** liczba stołów, miejsca per stół (zmiana globalna), przycisk "Dodaj stół", widok 2D / lista.
- **Statystyki na dole:** "73 / 89 gości rozsadzonych".
- **Mocki:** 12 stołów po 8 miejsc, część gości już rozsadzona.

#### 9. Ustawienia konta

- **Profil pary:** imiona, data ślubu (z licznikiem), miejsce ceremonii.
- **Sekcja "Połączone konto":** e-mail partnera, status połączenia, przycisk "Wyślij zaproszenie ponownie".
- **Sekcja "Bezpieczeństwo":** zmiana hasła, wylogowanie ze wszystkich urządzeń.
- **Sekcja "Eksport danych"** (opcjonalnie): "Pobierz wszystkie dane jako JSON".

### Dane mockowe — wymagania

- **Realistyczne polskie imiona i nazwiska.**
- **Polskie nazwy firm** ("Studio Foto Magia", "DJ Kowalski", "Catering Wesele Marzeń", "Kwiaciarnia Róża").
- **Kwoty w realistycznych przedziałach** (sala: 25-40k zł, catering: 250-450 zł/os, fotograf: 5-12k zł, DJ: 3-6k zł).
- **Daty rozłożone** od dziś do 25.07.2026 — żeby licznik dni i timeline pokazały coś sensownego.
- **Mix statusów** w każdej liście (nie wszystko "zielone") — żeby badge'e i ostrzeżenia były widoczne.

### Czego NIE robić

- **Bez backendu, bez auth, bez bazy** — tylko in-memory mocki.
- **Bez uploadu plików** (umowy = sam formularz danych).
- **Bez powiadomień push / e-mail** — wszystkie sygnały logiki biznesowej widoczne jako badge'e i sekcje "Wymaga uwagi" w UI.
- **Bez ról zewnętrznych** (świadkowie, rodzina) — tylko para młoda.
- **Bez przeładowanych ilustracji 3D / fotografii ślubnych** — utrzymaj minimalizm.

### Cel końcowy

Klikalny prototyp, który pokaże układ wszystkich 9 ekranów i podstawowe interakcje (otwórz modal, przefiltruj listę, przeciągnij gościa, rozwiń kategorię budżetu). Kod **nie musi być produkcyjny** — zostanie ręcznie przepisany na Angular 21 standalone components + signals + Supabase.
