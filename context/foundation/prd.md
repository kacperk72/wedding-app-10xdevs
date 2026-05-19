---
project: "Wedding Planner (Weronika & Kacper)"
version: 1
status: draft
created: 2026-05-19
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: 2026-07-25
  after_hours_only: true
---

# Wedding Planner — Product Requirements

## Vision & Problem Statement

Para planująca polski ślub (Weronika & Kacper, ślub `2026-07-25`) dzieli dziś swój plan między arkusz z listą gości, drugi arkusz z umowami i harmonogramem płatności, wątki czatu, w których pojawiają się odpowiedzi RSVP i preferencje dietetyczne, oraz papierowe notatki na timeline dnia ślubu. Dane istnieją, ale są rozproszone — partnerka A nie widzi w jednym miejscu tego, co właśnie ustaliła partnerka B w czacie, agregat diet potrzebny dla cateringu trzeba liczyć ręcznie, i nie ma jednego sygnału który mówi "w tym tygodniu jest drugą rata dla fotografa, a 12 gości nadal nie odpowiedziało". Z około trzema miesiącami do ślubu kosztem są przegapione terminy i podwojona praca koordynacyjna między dwojgiem partnerów.

Insightem, na którym warto budować, jest eat-your-own-dogfood: dwoje użytkowników to jednocześnie twórcy produktu, więc każda niezgrabna interakcja wychodzi w tym samym tygodniu, w którym jest dowieziona, a feature backlog jest sterowany tym, czego para realnie potrzebuje przed `2026-07-25`, a nie założeniami o generycznym segmencie rynkowym. W połączeniu z domain-koherentnym modelem (goście to jedno wspólne źródło prawdy dla RSVP, rozsadzenia, wyborów dań i budżetu — nie cztery równoległe listy) produkt może dawać parze jeden rankowany sygnał priorytetu na każdą sesję ("to wymaga uwagi teraz") zamiast pięciu rozjechanych list do uzgodnienia.

## User & Persona

Persona pierwotna — para jako jednostka, dwa zlinkowane konta.

- Imiona: Weronika i Kacper. Oboje pracujący w pełnym wymiarze; planowanie odbywa się po pracy i w weekendy.
- Model konta: dwa osobne konta we wspólnym dla ekosystemu single sign-on (założone administracyjnie, bez self-service rejestracji), oba powiązane z jednym rekordem wesela. Mają identyczne uprawnienia nad każdą encją tego wesela.
- Moment sięgnięcia po produkt: wieczór, otwarcie na 30 sekund, chęć dowiedzenia się "co się zmieniło, odkąd ostatnio sprawdzałam, co wymaga mnie w tym tygodniu, co jest do zapłacenia w najbliższych 30 dniach". Nie przeglądanie — sprawdzanie.
- Poza scope'em: brak trzeciej roli (wedding-coordinator, rodzina, świadkowie); brak publicznego landingu ani self-service onboardingu dla innych par. MVP obsługuje dokładnie to jedno wesele.

## Success Criteria

### Primary

- **End-to-end golden flow działa**: jeden z partnerów otwiera aplikację, loguje się przez wspólny single sign-on, ląduje na Dashboardzie, dodaje gościa z preferencją dietetyczną z poziomu strony Goście, widzi aktualizację agregatu (+1 zaproszony, +1 wege) i widzi kafelek "Goście" na Dashboardzie odzwierciedlający zmianę. Drugi partner loguje się z własnego urządzenia i widzi tego samego gościa z identycznymi danymi — to dowód, że "jedno wesele, dwa konta, symetryczne uprawnienia" jest realne.
- **Real-world adoption do 2026-07-25**: para używa aplikacji jako jedynego źródła prawdy — lista gości, kontrahenci, umowy, harmonogram płatności, zadania, rozsadzenie — przez ~9 tygodni dzielących start projektu od daty ślubu, bez fallbacku do arkuszy ani czatu. Jeśli któryś z modułów nie wytrzymuje codziennego użycia (zbyt wolny, brak pola, blokujący bug), to kryterium nie jest spełnione, niezależnie od stanu demo.

### Secondary

- Obrona kursu zaliczona — aplikacja spełnia wszystkie sześć wymagań listowanych w `wedding-planner-koncepcja.md` (mechanizm kontroli dostępu, CRUD, logika biznesowa, artefakty foundation, test end-to-end, CI/CD).
- Funkcje v2 dorzucone między obroną a datą ślubu — co najmniej konfigurator cateringu, ponieważ do tego momentu para potrzebuje już zbierać wybory dań od gości.

### Guardrails

- **Izolacja per wesele**: zalogowana tożsamość należąca do innego wesela (lub do dowolnej innej aplikacji w tym samym ekosystemie single sign-on) musi otrzymać odrzucenie autoryzacyjne — nie pustą listę i nie "not found". Przeciek danych przez granicę wesela jest krytycznym incydentem i blokuje wdrożenie na produkcję.
- **Polski UI 100% od pierwszego commita**: każda widoczna etykieta, status, treść walidacji, każda wartość mocowana w seedach, każdy format daty (`DD.MM.YYYY`), każdy format kwoty (`32 000 zł` ze spacją jako separatorem tysięcy) — po polsku. Brak english-leaków. Easier to write Polish from the start than to migrate enum values and copy later.
- **Regeneracja wbudowanych zadań nie traci stanu pary**: po zmianie daty ślubu, regeneracja wstępnej listy zadań nigdy nie nadpisuje zadań, które para oznaczyła jako ukończone, i nigdy nie tyka zadań, które para utworzyła ręcznie. Wielokrotne uruchomienie regeneracji daje identyczny wynik. Bug w tym = utrata stanu planowania pary; niezaakceptowalne.

## User Stories

### US-01: Para dodaje pierwszego gościa i widzi spójność danych między dwoma kontami

- **Given** dwóch zalogowanych partnerów (Weronika i Kacper), każdy z osobnego urządzenia, oba konta powiązane z tym samym weselem; lista gości jest pusta.
- **When** Weronika klika "Dodaj gościa" na stronie Goście, wpisuje imię "Anna", nazwisko "Kowalska", relację "Rodzina (panna młoda)", dietę "vege", oznacza dziecko = nie i +1 = nie, i potwierdza.
- **Then** gość pojawia się w grupie "Rodzina (panna młoda)"; agregat u góry listy zmienia się z "0 zaproszonych" na "1 zaproszony" i z "0 wege" na "1 wege"; kafelek "Goście" na Dashboardzie pokazuje "1/1 potwierdzonych".

#### Acceptance Criteria

- Kacper, drugi partner, widzi tego samego gościa pod tym samym adresem strony Goście z identycznymi danymi w ciągu kilku sekund od zalogowania się ze swojego urządzenia.
- Jeśli Kacper zmieni status RSVP Anny z "oczekuje" na "potwierdzony", Weronika po odświeżeniu widzi tę zmianę.
- Zalogowana tożsamość należąca do innego wesela (lub do dowolnej innej aplikacji w tym samym ekosystemie single sign-on), próbująca pobrać listę gości tego wesela, otrzymuje odrzucenie autoryzacyjne — nie pustą listę, nie "not found".
- Walidacja formularza renderuje się po polsku ("Imię jest wymagane", "Dieta musi być wybrana"). Brak english-leaku w żadnym etapie flow.
- Wyświetlenie znacznika czasu utworzenia gościa używa formatu `DD.MM.YYYY` (np. `19.05.2026`), nigdy formatu ISO 8601.

## Functional Requirements

### Auth

- FR-001: Para może zalogować się przez wspólny dla ekosystemu single sign-on i wrócić na ekran startowy aplikacji z aktywną sesją. Priority: must-have
- FR-002: System odrzuca każdą operację na danych wesela nie pochodzącą od zaufanej, zalogowanej tożsamości. Priority: must-have
- FR-003: System odrzuca każdą operację (odczyt lub modyfikację) na danych wesela, jeśli zalogowana tożsamość nie należy do żadnego z dwóch partnerów tego wesela. Priority: must-have
- FR-004: Para może się wylogować i utracić dostęp do strefy zalogowanej (powrót na ekran logowania). Priority: must-have

### Dashboard

- FR-005: Para widzi licznik dni do daty ślubu na Dashboardzie. Priority: must-have
- FR-006: Para widzi cztery kafelki KPI: goście potwierdzeni, budżet wydany, nadchodzące płatności w 30 dniach, zadania w tym tygodniu. Priority: must-have
- FR-007: Para widzi sekcję "Wymaga uwagi" agregującą sygnały biznesowe (opóźnione zadania, zaległe płatności, brakujące dania w RSVP, niepotwierdzeni goście blisko ślubu). Priority: must-have
  > Socrates: Rozważony counter-argument: "sygnał stanie się szumem, gdy parę tygodni przed ślubem WSZYSTKO 'wymaga uwagi' — lista urośnie do kilkunastu pozycji i przestanie filtrować informację". Resolution: zachowane, ale sekcja musi mieć wewnętrzny priorytet (top-N najpilniejszych) lub kategoryzację po typie sygnału. Szczegół projektowy przekierowany do ## Open Questions.
- FR-008: Para widzi sekcję "Nadchodzące spotkania" z najbliższymi terminami spotkań z kontrahentami. Priority: must-have

### Goście / RSVP

- FR-009: Para może dodać gościa (imię, nazwisko, relacja, dieta, oznaczenie +1, oznaczenie dziecka). Priority: must-have
- FR-010: Para może edytować i usunąć gościa. Priority: must-have
- FR-011: Para widzi listę gości pogrupowaną po relacjach z agregatami: zaproszeni, potwierdzeni, oczekujący, odmówieni, na diecie wege, dzieci. Priority: must-have
- FR-012: Para może zmienić status RSVP gościa: oczekuje, potwierdzony, odmowa. Priority: must-have
- FR-013: Para może przypisać gościa do jednej z opcji dań zdefiniowanych dla tego wesela w Ustawieniach. Priority: must-have

### Kontrahenci

- FR-014: Para może dodać, edytować i usunąć kontrahenta w jednej z 10 kategorii (Sala, Catering, Fotograf, DJ, Kwiaciarz, USC, Ksiądz, Makijaż, Dekoracje, Tort) z polami kontaktu i statusem. Priority: must-have
- FR-015: Para widzi karty kontrahentów z filtrem po statusie i kategorii. Priority: must-have
- FR-016: System pokazuje alert "brakujący kontrahent w kategorii X" w odniesieniu do typowego harmonogramu liczonego wstecz od daty ślubu. Priority: must-have
  > Socrates: Rozważony counter-argument: "false positives — 'typowy harmonogram' nie pasuje do twojego planu (ślub bez DJ-a bo gra zespół, bez kwiaciarza bo dekoruje rodzina); alert stałby się hałasem". Resolution: zachowane, ale alert musi być dismissable per kategoria, a stan dismissalu zapisany trwale dla tego wesela. Próg statusu kontrahenta wyciszający alert (np. "co najmniej spotkanie") jest otwartą kwestią — przekierowany do ## Open Questions.

### Umowy

- FR-017: Para może dodać, edytować i usunąć umowę powiązaną z kontrahentem (kwota, harmonogram płatności: zaliczka, raty, rozliczenie końcowe, daty). Priority: must-have
- FR-018: Para widzi tabelę umów z mini-paskiem statusu rat (opłacona, do zapłaty w 30 dniach, po terminie, zaplanowana). Priority: must-have
- FR-019: Para widzi sekcję "Nadchodzące płatności (30 dni)" agregowaną z wszystkich harmonogramów. Priority: must-have
- FR-020: Para może oznaczyć ratę jako opłaconą. Priority: must-have

### Budżet

- FR-021: Para widzi trzy kafelki KPI budżetu: wydane, zarezerwowane z umów, estymowana kwota końcowa. Priority: must-have
- FR-022: Para widzi 15 kategorii wydatków z paskiem postępu vs estymacja oraz flagą przekroczenia, gdy (wydane + zarezerwowane z umów) ≥ planowane. Priority: must-have
  > Socrates: Rozważony counter-argument: "90% jest arbitralne — niektóre kategorie (zaliczka sali) prawidłowo lądują na 100% planu i flag 'uwaga' byłaby false positive". Resolution: zmieniono — flaga uwagi pojawia się wyłącznie, gdy `(wydane + zarezerwowane) ≥ planowane`, bez progu 90%. Eliminuje arbitralność; pokazuje realne przekroczenie, nie pre-ostrzeżenie.
- FR-023: Para może dodać, edytować i usunąć wydatek (kategoria, kwota, data, opis). Priority: must-have

### Zadania

- FR-024: System generuje wstępną listę zadań liczonych wstecz od daty ślubu, na podstawie wbudowanego zestawu typowych zadań ślubnych. Priority: must-have
- FR-025: Para może dodać, edytować i usunąć własne zadanie (deadline, opis, tag). Priority: must-have
- FR-026: Para widzi listę zadań pogrupowaną na "Opóźnione / W tym tygodniu / W przyszłości" oraz alternatywny widok kalendarza. Priority: must-have
- FR-027: System regeneruje wbudowane zadania po zmianie daty ślubu w dwóch trybach: (a) **przesunięcie (merge)** — przesuwa terminy nieukończonych zadań wbudowanych; nie tyka zadań ukończonych ani zadań utworzonych ręcznie; (b) **generowanie od nowa (reset)** — usuwa wszystkie nieukończone zadania wbudowane i tworzy je od nowa z wbudowanego zestawu; nadal nie tyka zadań ukończonych ani utworzonych ręcznie. Priority: must-have
  > Socrates: Rozważony counter-argument: "co jeśli para CHCE pełny reset po dużej zmianie daty (np. lipiec → październik) — przesunięcie zostawia 'zrobione' rzeczy, które mogą już nie być relewantne". Resolution: zmieniono — confirm dialog (FR-034) oferuje dwie jawne opcje (przesunięcie vs generowanie od nowa); domyślny tryb: przesunięcie. Idempotentność dotyczy przesunięcia; tryb generowania od nowa jest jawny i destrukcyjny tylko dla zadań nieukończonych.

### Rozsadzenie

- FR-028: Para może przeciągnąć potwierdzonego gościa z listy "Nieprzypisani" na okrągły stół. Priority: must-have
- FR-029: Para ma keyboard-only alternatywę dla przeciągania (Tab + Enter/Space, focus management). Priority: must-have
  > Socrates: Rozważony counter-argument: "para realnie używa touch i myszy na każdym urządzeniu; nawigacja klawiaturowa to wymóg formalny, nie user-driven feature; ~25% wyższy koszt implementacji modułu rozsadzenia może pożreć czas innych modułów". Resolution: zachowane jako wymóg formalny dostępności (project-level), nie user-driven feature. Koszt akceptowany świadomie. Minimum implementacji: focus management + komunikaty ARIA + Tab/Enter/Space; bez warstwy zaawansowanych skrótów.
- FR-030: Para widzi panel "Konflikty" z parami "nie sadzać razem" (powód: tekst swobodny). Priority: must-have

### Ustawienia

- FR-031: Para może edytować profil wesela (imiona, datę ślubu, miejsce ceremonii). Priority: must-have
- FR-032: Para może dodać, edytować i usunąć pozycje listy "opcji dań" dla swojego wesela — to jest źródło danych dla wyboru dania w edytorze gościa. Priority: must-have
- FR-033: Para może wyeksportować pełny zrzut swoich danych do pliku JSON, z wykluczeniem wrażliwych danych uwierzytelniających i niejawnych identyfikatorów zaproszeń. Priority: nice-to-have
  > Socrates: Rozważony counter-argument: "scope creep — para nigdy nie użyje, platforma hostingu robi codzienny backup, to feature dla 'może kiedyś'". Resolution: zdemoted z must-have do nice-to-have. Implementacja eksportu po stronie systemu może istnieć (rozstrzygnięto w planie implementacji), ale UI dla eksportu nie jest wymagane w MVP. Wraca jako must-have w v2, jeśli pojawi się realna potrzeba.
- FR-034: System pokazuje confirm dialog przy zmianie daty ślubu z dwoma jawnymi opcjami: "Przesuń zadania (zachowaj zrobione i własne)" oraz "Wygeneruj zadania od zera (zachowaj zrobione)". Domyślny tryb: przesunięcie. Priority: must-have

## Non-Functional Requirements

- Polski UI 100% od pierwszego commita. Każdy widoczny w aplikacji string — etykieta, status, wartość listy wyboru renderowana w UI, treść błędu, treść walidacji, każda mocowana wartość seedowa — po polsku. Formaty: data `DD.MM.YYYY` (nie `2026-05-19`); waluta `32 000 zł` ze spacją jako separatorem tysięcy. Outside-observable: ktokolwiek otwierający aplikację bez znajomości tła rozpoznaje produkt jako polskojęzyczny od pierwszego ekranu.

(Performance / latency, backward compatibility z istniejącymi danymi pary w arkuszach, oraz disaster recovery poza codzienny backup platformy hostingu nie zostały wybrane jako NFR-y podczas wcześniejszych konsultacji. Patrz `## Open Questions` — każdy z tych braków jest tam wymieniony, aby kolejny etap zdecydował, czy ich nieobecność jest świadoma czy realnym brakiem.)

## Business Logic

**Aplikacja zamienia datę ślubu w ciągle aktualizowany sygnał priorytetu: dla każdej wieczornej sesji mówi parze "co teraz wymaga uwagi", komponując cztery niezależne strumienie domenowe — (a) listę zadań liczoną wstecz od daty ślubu z wbudowanego zestawu typowych zadań ślubnych, (b) harmonogram nadchodzących płatności z umów, (c) lukę kompletności RSVP (goście niepotwierdzeni / bez wybranej diety / bez wybranego dania), (d) przekroczenia budżetowe per kategoria — w jedną rankowaną listę "opóźnione + due w 30 dniach".**

To jest reguła kompozycji, nie pojedyncza decyzja. Wejścia, w terminach widocznych dla użytkownika:

- Data ślubu, wpisana w Ustawieniach przez parę.
- Wbudowany, niezmienny w MVP zestaw typowych zadań ślubnych z relatywnymi przesunięciami od daty ślubu (np. "Rezerwacja sali" — 365 dni przed, "Spotkanie z DJ-em" — 240 dni przed, "Próba sukni" — 30 dni przed).
- Stan każdego kontrahenta (rozważany, spotkanie, zarezerwowany, zapłacony, wykonany) i harmonogram płatności w jego umowie.
- Status RSVP każdego gościa i jego wybór dania.
- Pozycje budżetowe (plan, faktycznie wydane, zarezerwowane z umów).

Wyjście, w terminach UI: sekcja "Wymaga uwagi" na Dashboardzie (FR-007), sekcja "Nadchodzące płatności (30 dni)" na widoku Umowy (FR-019), cztery kafelki KPI na Dashboardzie (FR-006), alert "brakujący kontrahent w kategorii X" na widoku Kontrahenci (FR-016), flaga przekroczenia per kategoria na widoku Budżet (FR-022) — wszystkie projekcje tej samej reguły, prezentowane w różnych kontekstach.

Jak para encounteruje regułę w product flow: otwiera Dashboard po pracy → widzi top-N pozycji "Wymaga uwagi" → klika w jedną → ląduje na detalu (kontrahent / umowa / gość / kategoria budżetu) → rozwiązuje → wraca → lista się aktualizuje. Cała wartość produktu siedzi w fakcie, że ten sygnał jest **jednym miejscem** zamiast pięcioma osobnymi widokami, które para musiałaby codziennie samodzielnie obchodzić.

## Access Control

- **Uwierzytelnianie** jest delegowane do wspólnego dla ekosystemu serwisu single sign-on. Sama aplikacja wedding-planner nigdy nie widzi hasła ani nie zarządza cyklem życia sesji użytkownika. Wszystkie flow logowania, wylogowania, obsługi haseł, resetowania hasła i weryfikacji adresu e-mail żyją w serwisie single sign-on, a nie w wedding-planner.
- **Autoryzacja per wesele** jest egzekwowana na każdej operacji, która czyta lub modyfikuje dane wesela: zalogowana tożsamość musi należeć do jednego z dwóch partnerów tego wesela. Każda inna tożsamość — w tym zalogowany użytkownik innego wesela lub zalogowany użytkownik innej aplikacji w tym samym ekosystemie single sign-on — otrzymuje odrzucenie autoryzacyjne.
- **Provisioning kont** jest administracyjny. Dwa konta (Weroniki i Kacpra) zakłada administrator w panelu wspólnego single sign-on. W samej aplikacji wedding-planner nie istnieje flow self-service rejestracji, resetu hasła ani weryfikacji adresu e-mail — te flow są własnością serwisu single sign-on.
- **Role w obrębie wesela**: płaskie i w pełni symetryczne. Oboje partnerzy mają identyczne uprawnienia nad każdą encją wesela — goście, kontrahenci, umowy, płatności, wydatki, zadania, przypisania do stołów, ustawienia. Nie istnieje żadna akcja zarezerwowana tylko dla "założyciela"; wcześniejsza propozycja, by hard-delete całego wesela był ograniczony do założyciela, została usunięta podczas shapingu (brak realnego use case'u kasowania całego rekordu wesela post-factum).

## Non-Goals

Jawne scope-avoids dla 3-tygodniowego MVP:

- **Konfigurator cateringu** — cały subsystem pakietów cateringowych, wyboru dań w ramach `choice_limit`, dodatków płatnych, kalkulacji ceny i freeze-to-contract. Wraca w v2 (między obroną kursu a `2026-07-25`), ponieważ do tego momentu para potrzebuje już zbierać wybory dań od gości.
- **Storage skanów PDF umów / upload plików** — brak uploadu, brak viewera, brak storage'u plików. Aplikacja przechowuje wyłącznie dane wyciągnięte z umów (kontrahent, kwoty, harmonogram płatności). Skany pary trzymane są osobno.
- **Powiadomienia push / e-mail / SMS** — żaden kanał zewnętrzny. Wszystkie sygnały biznesowe widoczne wyłącznie wewnątrz aplikacji jako badge'e, flagi i sekcje "Wymaga uwagi". Para wchodzi do aplikacji wtedy, gdy chce sprawdzić stan, a nie reaguje na alerty wypchnięte przez kanał zewnętrzny.
- **AI features** — brak integracji z modelami językowymi, brak sugestii zadań przez AI, brak generowania draftu wiadomości do kontrahenta. Wymagania funkcjonalne są spełnione bez AI; dorzucenie AI ma sens tylko w v2+ i tylko jeśli wniesie mierzalną wartość użytkową.
- **Self-service signup, password reset, e-mail verification w wedding-planner** — żaden z tych flow nie istnieje wewnątrz wedding-planner. Konta zakłada administrator w panelu wspólnego single sign-on. Wedding-planner nigdy nie obsługuje cyklu życia konta.
- **Multi-tenant — wiele wesel obsługiwanych przez jeden deploy** — MVP serwuje dokładnie jedno wesele (Weroniki i Kacpra). Wsparcie dla wielu wesel = v3+ i świadomie poza scope MVP oraz v2.
- **Offline-first / PWA** — aplikacja wymaga aktywnego połączenia. Brak instalacji jako aplikacja, brak cache'u offline. Może wrócić w v3+, jeśli pojawi się use case.
- **Pełny audyt WCAG-AA poza dostępem klawiaturowym w Rozsadzeniu** — kolor i kontrast, screen-reader support, alt-teksty na poziomie sensownych defaultów, bez formalnego audytu. Jedynie Rozsadzenie ma keyboard-only alternatywę jako wymóg formalny dostępności (FR-029).

## Open Questions

1. **Priorytetyzacja wewnątrz sekcji "Wymaga uwagi" (FR-007)** — pod koniec przygotowań sekcja urośnie do kilkunastu pozycji; jak ją rankować (top-N najpilniejszych? per kategoria sygnału? per liczba dni do deadlinu?). Owner: PO. By: przed implementacją Dashboardu.
2. **Próg statusu kontrahenta wyciszający alert "brakujący w kategorii" (FR-016)** — który status karty kontrahenta (rozważany / spotkanie / zarezerwowany / zapłacony / wykonany) wyłącza alert "brakujący w kategorii X"? Wstępna propozycja: status ≥ spotkanie. Owner: PO. By: przed implementacją Kontrahentów.
3. **Brak NFR-ów dla performance / latency** — Dashboard wykonuje cztery niezależne agregacje i komponuje sekcję "Wymaga uwagi" z czterech źródeł. Brak NFR-u oznacza zero budżetu projektowego na optymalizację. Świadoma decyzja czy luka? Owner: PO. By: przed kolejnym etapem chain'a.
4. **Backward compatibility z istniejącymi danymi pary w arkuszach (import gości)** — para ma już listę ~150 gości w arkuszu; brak importu w MVP oznacza ręczne przepisanie. Świadoma decyzja czy luka? Owner: PO. By: przed sprintem implementującym moduł Goście/RSVP.
5. **Disaster recovery poza codzienny backup platformy hostingu** — eksport JSON jest nice-to-have (FR-033). Jeśli codzienny backup platformy zawiedzie tydzień przed datą ślubu, jaki jest plan B? Owner: PO. By: przed wdrożeniem produkcyjnym.
