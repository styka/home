# Recenzja: Fala poprawek — bugi i UX

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-08-19
- **Diff:** `origin/develop...HEAD` — **81 plików, +4376 / −538**, 14 commitów

---

## Ustalenia

Recenzja skupiona na zmianach, których `verify.md` nie mógł pokryć: warunki brzegowe, kolejność
gałęzi, cykl życia nasłuchiwaczy, kontrola dostępu w nowej akcji i skutki uboczne wspólnego
komponentu wpiętego w pięć miejsc.

### 1. Naruszenie granicy modułów w teście — **naprawione w trakcie weryfikacji**
- **Plik:** `src/modules/shopping/lib/__tests__/pozycjeWsadowe.test.ts:3-4`
- **Kategoria:** convention (C-02, C-36)
- **Opis:** Test importował wnętrze WŁASNEGO modułu przez alias `@/` zamiast ścieżką względną.
- **Skutek:** `next lint` czerwony ⇒ `build` pada. Wyłapane przez bramkę, poprawione (`../limity`,
  `../parseQuantity`), z komentarzem wyjaśniającym regułę. **Bez pozostałości.**

### 2. Zatrzask lektora łapie także awarie przejściowe — **świadomy kompromis**
- **Plik:** `src/lib/tts.ts` (`speakViaServer`, gałąź `catch`)
- **Kategoria:** correctness (kompromis, nie defekt)
- **Scenariusz:** chwilowa awaria sieci w trakcie czytania ⇒ zatrzask zapala się tak samo jak przy
  odmowie dostawcy, więc reszta sesji jest czytana głosem systemowym, mimo że dostawca już działa.
- **Dlaczego zostaje:** stan przed zmianą to **cisza**; stan po zmianie to inny głos plus widoczny
  komunikat. Zatrzask żyje w pamięci strony (nie w bazie) i kasuje go przeładowanie albo zmiana
  głosu/konfiguracji. Rozróżnianie „odmowa trwała" od „przejściowa" wymagałoby licznika prób
  i okna czasowego — czyli więcej stanu niż warta jest różnica (C-53). **Udokumentowane w kodzie.**

### 3. Tryb sekcji przy zerze obserwatorów jest wartością zastępczą
- **Plik:** `src/modules/weather/actions/weather.ts` (`BRAK_OBSERWATOROW`)
- **Kategoria:** convention (kosmetyka)
- **Scenariusz:** użytkownik ustawił sekcję na „zawsze świeże", ale wyłączył wszystkie obserwatory ⇒
  wcześniejsze wyjście zwraca `mode: "onDemand"`, więc przełącznik w pasku pokazałby „na żądanie".
- **Skutek:** wyłącznie wyświetlenie — przy zerze obserwatorów panel i tak pokazuje pustą listę, a
  pasek trybu renderuje się dopiero przy `watchers.length > 0`, więc użytkownik tego nie zobaczy.
  Zostawione świadomie: dociąganie trybu z bazy w gałęzi, która niczego nie liczy, to zapytanie po
  nic.

### 4. Pusty zapisany zestaw nadal daje pusty widok — **poprawne, nie regresja**
- **Plik:** `src/modules/tasks/ui/TasksRouteView.tsx` (gałąź `zestawId`)
- **Kategoria:** correctness (sprawdzone, bez zmiany)
- **Opis:** Reguła „żadne źródło zakresu nie może degradować do zera zasobów" dotyczy zakresu
  **zgubionego**, nie **pustego**. Zestaw bez projektów naprawdę nie ma zadań i pusty widok jest
  wtedy prawdą, a nie usterką. Zweryfikowane, żeby nie pomylić tych dwóch przypadków.

### 5. Wspólna warstwa przy okazji naprawia dziedziczenie `pointer-events`
- **Plik:** `src/modules/tasks/ui/BulkActionBar.tsx`
- **Kategoria:** simplification (obserwacja)
- **Opis:** Panele paska stały wcześniej wewnątrz kontenera `pointer-events-none`. Portal do `body`
  wyprowadza je poza to drzewo, więc znika cała klasa problemów z klikalnością, o którą nikt nie
  pytał. Odnotowane, żeby nie zostało odczytane jako przypadek.

### 6. Wygenerowane pliki doprowadzone do zgodności ze źródłem
- **Plik:** `src/generated/admin-docs.ts`
- **Kategoria:** convention
- **Opis:** `doświadczenia.md` urosło o wpis po ostatnim uruchomieniu `copy-docs.js`, więc
  zbakowana kopia była o jedną lekcję do tyłu. Produkcja i tak przebakowuje ją na starcie builda,
  ale commitowanie nieaktualnego artefaktu wprowadza w błąd. Przebakowane.

---

## Czego recenzja NIE wykazała

Sprawdzone i **czyste**: kontrola dostępu w nowej akcji `addItems` (`assertListAccess` przed
zapisem, sufit `MAX_POZYCJI_WSADOWO`); `revalidatePath` we wszystkich mutacjach Zadań (helper
`odswiezZadania` po naprawie rekurencji, którą wyłapałem przy wprowadzaniu); sprzątanie
nasłuchiwaczy w `AnchoredLayer` (`resize`, `scroll` z `capture`, `keydown`, `pointerdown` — każdy
z `removeEventListener`); brak pętli renderowania mimo `children` w zależnościach efektu (referencja
jest stabilna między własnymi renderami komponentu); zero enumów Prisma (C-12); zero zaszytych
kolorów (C-30); zero literałów tekstowych w komponentach (C-32); brak wycieku klucza API —
potwierdzony asercją negatywną w teście (C-41).

---

## Werdykt

**APPROVE Z UWAGAMI.**

Jedno realne naruszenie (granica modułów w teście) znalezione przez bramkę i naprawione. Pozostałe
ustalenia to świadome kompromisy albo obserwacje — żadne nie blokuje merge. Wszystkie bramki zielone,
`next build` przechodzi, 1109 testów jednostkowych zielonych, 24/24 kryteria akceptacji spełnione
(jedno z zastrzeżeniem opisanym w `verify.md`).

**Uwagi przeniesione do wiadomości właściciela, nie do kodu:**
- AC-19 (generowanie skórki) zweryfikowane na poziomie logiki; zachowania żywego modelu nie dało się
  sprawdzić bez klucza do dostawcy.
- Środowisko klikacza wymaga odtworzenia po skasowaniu przeze mnie lokalnej bazy — praca poza
  zakresem tej fali, z lekcją zapisaną w `doświadczenia.md`.
