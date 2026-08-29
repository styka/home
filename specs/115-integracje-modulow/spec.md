# Spec: Integracje międzymodułowe — pełna analiza i realizacja

- **ID:** 115-integracje-modulow
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-29
- **Moduł(y):** wszystkie (przekrojowy: Zakupy, Zadania, Notatki, Kuchnia, Zwierzęta, Rośliny,
  Zdrowie, Nawyki, Flota, Portfel, Języki, Wiadomości, Pogoda, Magazynowanie, Warsztaty, Usługi,
  Kontakty, Czat, YouTube, Truck, Kalendarz, Pulpit, Raporty)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Szczegółowa analiza par modułów
> i lista zleceń żyją w towarzyszącym dokumencie **`analiza.md`** (ten sam katalog) — jego rozdział
> „Lista zleceń" jest **wiążącym zakresem** tej funkcji i wejściem dla `plan.md`/`tasks.md`.

## 1. Problem / potrzeba

Omnia jest „ERP-em życia prywatnego": jej wartość rośnie nie z liczby modułów, lecz z tego, że
moduły pracują na WSPÓLNYCH danych. Dziś część integracji istnieje (przepis → lista zakupów,
zbiór → spiżarnia, koszty → Portfel z czterech modułów, wspólny kalendarz), ale nikt nigdy nie
przeszedł systematycznie **każdej pary modułów** i nie zapytał: „co te dwa moduły mogłyby sobie
nawzajem dać?". Skutek: użytkownik ręcznie przepisuje dane między modułami (koszt wizyty do
Portfela, wykonawcę do Kontaktów, artykuł do Notatek), a część oczywistych mostów po prostu nie
istnieje. Właściciel zlecił: przeanalizować każdą parę, wskazać wszystkie ROZSĄDNE integracje
(mniej potrzebne jako opcjonalne), spisać zlecenia i **zrealizować wszystkie**.

## 2. Cel i miary sukcesu

- **Cel:** każda para modułów ma przeanalizowany i rozstrzygnięty status integracji (istnieje /
  nowe zlecenie / świadomie odłożone / świadomie brak — zawsze z uzasadnieniem), a wszystkie
  zlecenia z listy są wdrożone.
- **Sukces mierzymy:**
  - dokument analizy pokrywa **100% par** modułów (24 moduły — każda para rozstrzygnięta),
  - **wszystkie** zlecenia z rozdziału „Lista zleceń" w `analiza.md` są zrealizowane (żadne nie
    pominięte), a odłożone pozycje mają zapisany powód,
  - dane raz wpisane w jednym module nie wymagają ręcznego przepisywania tam, gdzie zlecenie
    zbudowało most (np. koszt wizyty ląduje w Portfelu jednym kliknięciem),
  - analiza jest dostępna dla właściciela w aplikacji (raporty admina).

## 3. Historyjki użytkownika

- Jako użytkownik chcę jednym kliknięciem zaksięgować w Portfelu koszt wizyty lekarskiej,
  weterynaryjnej albo projektu warsztatowego, żeby finanse były kompletne bez przepisywania kwot.
- Jako użytkownik chcę zamienić dowolną pozycję wspólnego kalendarza na zadanie, żeby rzeczy
  wymagające przygotowania trafiały do mojej listy zadań z terminem i linkiem do źródła.
- Jako użytkownik chcę zapisać wykonawcę z marketplace'u oraz lekarza/weterynarza z wizyty jako
  kontakt, żeby mój CRM budował się sam z danych, które już mam.
- Jako użytkownik chcę zamienić notatkę albo wiadomość z czatu na zadanie, żeby ustalenia nie
  ginęły w treści.
- Jako użytkownik chcę zapisać artykuł z Wiadomości albo podsumowanie filmu z YouTube jako
  notatkę, żeby budować własną bazę wiedzy.
- Jako uczący się języka chcę wyciągnąć fiszki z transkrypcji filmu YouTube, żeby słownictwo
  z realnych materiałów trafiało do moich talii.
- Jako kierowca chcę po wyznaczeniu trasy w Trucku zobaczyć szacowany koszt paliwa liczony ze
  średniego spalania mojego pojazdu z Floty i móc go zaksięgować.
- Jako użytkownik chcę widzieć prognozę pogody w siatce wspólnego kalendarza (opcjonalnie),
  żeby planować z pogodą przed oczami.
- Jako użytkownik chcę po „Zakończ zakupy" opcjonalnie dorzucić kupione produkty do spiżarni,
  żeby stan spiżarni nadążał za zakupami.
- Jako użytkownik chcę na pulpicie widzieć nawyki na dziś, przeglądy warsztatowe, najbliższe
  urodziny i dzisiejszą pogodę, żeby jeden rzut oka wystarczał.
- Jako profesjonalny hodowca (tryb Pro Roślin) chcę przy wpisie ewidencji oprysku wskazać środek
  z Magazynu, żeby stan schodził automatycznie, a ewidencja miała spójne nazwy.
- Jako właściciel chcę przeczytać całą analizę integracji w raportach admina.

## 4. Kryteria akceptacji (testowalne)

- [ ] **AC-1** — Given dokument `analiza.md`, when policzę rozstrzygnięcia, then każda para z 24
  modułów ma dokładnie jeden status (✔ istnieje / ➕ zlecenie / ◐ odłożone / — brak sensu)
  z uzasadnieniem, a lista zleceń zawiera pełne informacje (cel, uzasadnienie, moduły, operacje,
  opcjonalność, priorytet, kryteria akceptacji per zlecenie).
- [ ] **AC-2** — Given wizyta w Zdrowiu z wpisanym kosztem, when klikam „Zaksięguj w Portfelu",
  then w Portfelu powstaje wydatek z kwotą, datą wizyty i źródłem, a powtórne kliknięcie
  koryguje zamiast dublować.
- [ ] **AC-3** — Given wizyta weterynaryjna z kosztem / sprzedaż zwierzęcia z ceną, when księguję,
  then w Portfelu ląduje odpowiednio wydatek / przychód (idempotentnie po źródle).
- [ ] **AC-4** — Given materiał w Warsztacie poniżej progu min-stock, when używam akcji uzupełnienia,
  then pozycje trafiają na wskazaną listę zakupów z ilością do progu.
- [ ] **AC-5** — Given projekt warsztatowy z wpisanym kosztem, when księguję, then wydatek jest
  w Portfelu (idempotentnie).
- [ ] **AC-6** — Given profil wykonawcy w Usługach / wizyta z lekarzem w Zdrowiu / wizyta wet.
  w Zwierzętach, when klikam „Zapisz w kontaktach", then powstaje kontakt z danymi i tagiem
  roli, a powtórne kliknięcie nie tworzy duplikatu (rozpoznanie po nazwie).
- [ ] **AC-7** — Given kontakt / notatka / wiadomość czatu / pozycja wspólnego kalendarza, when
  używam akcji „Do zadań", then powstaje zadanie z sensownym tytułem, opisem zawierającym
  odnośnik do źródła oraz — dla kalendarza — terminem z pozycji.
- [ ] **AC-8** — Given artykuł w Wiadomościach / film w YouTube, when klikam „Zapisz jako
  notatkę", then powstaje notatka z tytułem, treścią (streszczenie/opis + adres źródła).
- [ ] **AC-9** — Given film YouTube z transkrypcją i istniejąca talia, when uruchamiam „Fiszki
  z filmu", then dostaję propozycje słówek do przejrzenia i po zatwierdzeniu lądują w talii
  (operacja na żądanie, z licznikiem kosztu AI).
- [ ] **AC-10** — Given wyznaczona trasa w Trucku i pojazd we Flocie z historią tankowań, when
  wybieram pojazd, then widzę szacowany koszt paliwa (dystans × średnie spalanie × średnia cena)
  i mogę go zaksięgować w Portfelu.
- [ ] **AC-11** — Given włączona (domyślnie) opcja prognozy w Pogodzie i domyślna lokalizacja,
  when otwieram wspólny kalendarz, then najbliższe dni pokazują ikonę i temperaturę; po
  wyłączeniu opcji — nie pokazują.
- [ ] **AC-12** — Given lista zakupów z kupionymi pozycjami, when kończę zakupy z zaznaczoną
  opcją „dodaj do spiżarni" (domyślnie odznaczona, wybór zapamiętany), then kupione pozycje
  pojawiają się w spiżarni.
- [ ] **AC-13** — Given pulpit, then sekcje pokazują: nawyki na dziś (pozostałe/odhaczone),
  najbliższe przeglądy warsztatowe, najbliższe urodziny kontaktów i dzisiejszą pogodę — każda
  sekcja podlega personalizacji pulpitu jak pozostałe.
- [ ] **AC-14** — Given przestrzeń Roślin w trybie profesjonalnym i pozycje w Magazynie, when
  wpisuję zabieg oprysku i wybieram środek z Magazynu, then nazwa środka wypełnia się z pozycji,
  a stan magazynu schodzi o podaną ilość (ruch z opisem źródła); bez wyboru — zachowanie jak dziś.
- [ ] **AC-15** — Given raporty admina, then dostępny jest raport z pełną analizą integracji.
- [ ] **AC-16** — Wszystkie akcje mutujące z tej funkcji przechodzą przez Server Actions modułu
  docelowego lub jego kontrakt (żadnych zapisów do cudzych tabel), a `npm run build` (wszystkie
  bramki) przechodzi.

## 5. Zakres

**W zakresie:** komplet zleceń Z-INT-01…Z-INT-19 z rozdziału „Lista zleceń" w `analiza.md`
(hub kalendarz→zadania; koszty Zdrowie/Zwierzęta/Warsztaty/Truck → Portfel; braki Warsztatu →
Zakupy; wykonawca/lekarz/weterynarz → Kontakty; kontakt/notatka/czat → Zadania; artykuł/film →
Notatki; fiszki z transkrypcji; prognoza w kalendarzu; zakupy → spiżarnia; cztery wkłady pulpitu;
środek z Magazynu w ewidencji Roślin; publikacja analizy jako raport).

**Poza zakresem (świadomie):** pozycje rozdziału „Wskazane, ale odłożone" w `analiza.md`
(m.in. bilans żywieniowy Kuchnia↔Zdrowie, wartość Magazynu jako majątek w Portfelu, fiszki
z notatek, transfer Spiżarnia↔Magazyn, integracje zewnętrzne Gmail/Google Calendar — tracker
T-15) oraz pary rozstrzygnięte jako „brak sensu" — każda z zapisanym uzasadnieniem.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** żadnych nowych slugów — każda operacja działa pod uprawnieniem modułu,
  w którego widoku jest wywoływana; zapis do modułu docelowego przez jego kontrakt/akcję z jego
  własnymi guardami.
- **Własność danych:** bez zmian modelu własności; nowe rekordy powstają w przestrzeni zgodnie
  z regułami modułu docelowego. Nowe pola danych (koszt wizyty, koszt projektu) są nullable
  i wstecznie zgodne.
- **Asystent AI:** operacje są przyciskami UI wołającymi istniejące akcje; asystent już potrafi
  tworzyć zadania/notatki/kontakty/wydatki, więc nowych `AIAction` nie dokładamy (manifest
  pokrycia dostaje wpisy z powodem). Jedna operacja LLM (fiszki z transkrypcji) — na żądanie,
  z licznikiem kosztu i limitem jak inne operacje AI.
- **Kalendarz / powiadomienia / trash:** kalendarz zyskuje akcję „Do zadań" i opcjonalny pasek
  prognozy; powiadomienia bez zmian; trash bez zmian (nowe rekordy podlegają regułom modułów
  docelowych).

## 7. Zgodność z konstytucją

- **C-36** — wszystkie mosty idą przez kontrakty modułów (`@/modules/<x>/contract`); platforma
  nie poznaje żadnego modułu; wkłady pulpitu przez `dashboard.ts` + korzeń kompozycji.
- **C-10/C-11/C-14** — nowe kolumny (koszt wizyty, koszt projektu, przełącznik spiżarni) i seed
  raportu wyłącznie ręcznymi migracjami z kolejnym numerem.
- **C-12** — żadnych enumów; nowe rodzaje jako String + unia TS.
- **C-20/C-21(079)** — mutacje jako Server Actions z `revalidatePath`; własność wg przestrzeni.
- **C-23** — nowe akcje bez ekspozycji AI dostają wpisy w manifeście pokrycia (build to wymusza).
- **C-30–C-35** — UI przez zmienne motywu, `ModuleView`, `confirmDialog`, teksty przez `t()`
  (`messages/pl.json`), komponenty wspólne z pierwszym konsumentem.
- **C-40** — operacja fiszek przez DB-driven routing modeli (typ operacji, nie hardcode).
- **C-50/C-52/C-52a** — build ze wszystkimi bramkami; merge do `develop`; promocja `master`
  wyłącznie `--ff-only` + tag.
- **C-53** — każdy most minimalny: jeden przycisk/jedno pole zamiast nowych podsystemów;
  huby zamiast 276 połączeń punkt-punkt.
- **C-54/C-55** — spójność artefaktów; decyzje właściciela zebrane z góry (poniżej).

## 8. Otwarte pytania / decyzje właściciela

Brak otwartych pytań — właściciel rozstrzygnął w zleceniu, a resztę przyjęto domyślnymi:

- **Decyzja właściciela (2026-08-29):** zakres = „wszystkie rozsądne integracje między wszystkimi
  modułami"; mniej potrzebne mogą być **opcjonalne**; po analizie **zrealizować wszystkie
  zlecenia bez pomijania**; przebieg przez spec-driven pipeline.
- **Założenie (domyślne, C-53):** opcjonalność realizujemy tak jak dotąd w Omnii — operacje
  ZAPISU do innego modułu są zawsze jawnym działaniem użytkownika (przycisk, bez przełącznika),
  a treści AUTOMATYCZNE (prognoza w kalendarzu, spiżarnia po zakupach) mają przełącznik
  w ustawieniach modułu ŹRÓDŁOWEGO — bez nowego, centralnego panelu „Integracje".
- **Założenie:** analiza pokrywa 24 moduły z `src/modules/`; QA i Raporty jako moduły
  narzędziowe mają w macierzy głównie rozstrzygnięcia „hub/brak sensu" z uzasadnieniem.
- **Założenie:** integracje z usługami zewnętrznymi (Gmail, Google Calendar) pozostają poza
  zakresem — czekają na decyzje/klucze właściciela (tracker T-15).

## 9. Ryzyka

- **Rozrost zakresu (19 zleceń)** → każde zlecenie ma minimalny kształt (C-53), wspólne wzorce
  (księgowanie, „zapisz w kontaktach", „do zadań") są realizowane raz i reużywane; realizacja
  w partiach z bramkami builda po każdej partii.
- **Podwójne księgowanie / duplikaty** → wszystkie zapisy do Portfela idempotentne po źródle
  (moduł+identyfikator), kontakty rozpoznawane po nazwie przed utworzeniem.
- **Hałas automatyzacji** → automaty są opt-in (spiżarnia) albo wyłączalne (prognoza), zgodnie
  z decyzją o opcjonalności; operacje AI wyłącznie na żądanie.
- **Sprzeczność z filozofią „jedno źródło prawdy"** → żaden most nie kopiuje danych na stałe
  między modułami poza jawnymi, jednorazowymi operacjami użytkownika; analiza odrzuca
  integracje tworzące „drugi magazyn/drugą księgowość".
