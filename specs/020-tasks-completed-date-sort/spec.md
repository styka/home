# Spec: Widoczna „data wykonania" na zadaniach + działające sortowanie sekcji „Zrobione"

- **ID:** 020-tasks-completed-date-sort
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-22
- **Moduł(y):** Tasks (`/tasks`, widok listy zadań)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba
Ikona „Sortuj zrobione po dacie wykonania" w widoku listy zadań **nie daje widocznej różnicy** po
kliknięciu (druga zgłoszona próba). Przyczyna: sekcja „✓ Zrobione / Anulowane" nie pokazuje daty
wykonania zadań, więc nawet poprawne przesortowanie „wygląda tak samo"; a domyślna kolejność bywa
zbliżona do kolejności wg daty. Właściciel chce, żeby efekt sortowania był **jednoznacznie widoczny**,
oraz żeby „data wykonania" była rozumiana jako **data ostatniego wykonania** — tak, by **zadania
cykliczne**, nawet gdy aktualnie nie są zrobione, pokazywały datę **poprzedniego** wykonania.

## 2. Cel i miary sukcesu
- Cel: klik w ikonę sortowania daje natychmiastowy, widoczny efekt, a użytkownik widzi na zadaniach
  **datę ostatniego wykonania**; zadania cykliczne zachowują tę datę między wystąpieniami.
- Sukces mierzymy:
  - Po włączeniu sortowania sekcja „Zrobione" jest rozwinięta, jej zadania pokazują **datę wykonania**
    i są uporządkowane malejąco po tej dacie; nagłówek sekcji sygnalizuje aktywny sort.
  - Aktywne (niezrobione) zadanie cykliczne, które było już wcześniej wykonane, pokazuje **datę
    poprzedniego wykonania**.
  - Różnica po kliknięciu jest widoczna nawet, gdy domyślna kolejność przypadkiem pokrywa się z
    kolejnością wg daty (bo dochodzi widoczna data + sygnalizacja).

## 3. Historyjki użytkownika
- Jako użytkownik chcę, żeby kliknięcie „Sortuj zrobione po dacie wykonania" wyraźnie zmieniło widok
  (kolejność + widoczne daty), żebym wiedział, że zadziałało.
- Jako użytkownik chcę widzieć, **kiedy** ukończyłem dane zadanie, przeglądając sekcję „Zrobione".
- Jako użytkownik zadań cyklicznych chcę widzieć **datę ostatniego wykonania** na aktywnym powtarzalnym
  zadaniu, żeby wiedzieć, kiedy ostatnio je zrobiłem (np. „ostatnio: 10 lip").

## 4. Kryteria akceptacji (testowalne)
- [ ] **AC-1** — Given lista zadań (filtr „Wszystkie") z ukończonymi zadaniami o różnych datach
  wykonania, when użytkownik klika „Sortuj zrobione po dacie wykonania", then sekcja „Zrobione" jest
  rozwinięta, jej zadania są posortowane **malejąco po dacie wykonania** (najnowsze na górze), a na
  każdym z nich widać **datę wykonania**.
- [ ] **AC-2** — Given aktywny sort, when użytkownik klika ikonę ponownie, then sort wraca do
  domyślnego (kolejność sprzed sortu), a sygnalizacja aktywności znika. Stan aktywny przycisku jest
  czytelny w obu trybach.
- [ ] **AC-3** — Given nagłówek sekcji „Zrobione" przy aktywnym sortowaniu, then wskazuje aktywny sort
  (np. „✓ Zrobione / Anulowane — wg daty wykonania").
- [ ] **AC-4 (cykliczne)** — Given zadanie cykliczne, które zostało wykonane (utworzyło kolejne
  wystąpienie), when patrzę na **aktywne** (niezrobione) kolejne wystąpienie, then widzę **datę
  poprzedniego wykonania** (data ostatniego wykonania), mimo że to zadanie nie jest jeszcze zrobione.
- [ ] **AC-5 (trwałość)** — Given wykonanie zadania cyklicznego, then „data ostatniego wykonania" jest
  **zapamiętana** (przetrwa odświeżenie / kolejne wystąpienia), a nie liczona ulotnie.
- [ ] **AC-6 (bez regresji)** — Given zwykłe (niecykliczne) zadania i pozostałe widoki/filtry, then
  zachowują się jak dotąd; data wykonania pokazywana jest sensownie (dla zrobionych — data ukończenia).
- [ ] **AC-7 (scenariusz testowy)** — Dostarczony jest **manualny scenariusz testowy** (kroki +
  oczekiwany rezultat) pozwalający właścicielowi zweryfikować AC-1..AC-5 ręcznie.

## 5. Zakres
**W zakresie:**
- Pokazanie **daty ostatniego wykonania** na zadaniach: w sekcji „Zrobione" (dla ukończonych) oraz na
  **aktywnych zadaniach cyklicznych**, które były wcześniej wykonane.
- Działające, **widoczne** sortowanie sekcji „Zrobione" malejąco po dacie wykonania + sygnalizacja
  aktywnego sortu (nagłówek + stan przycisku) + auto-rozwinięcie sekcji.
- **Zapamiętanie** daty ostatniego wykonania dla zadań cyklicznych (przenoszona na kolejne wystąpienie).
- Dostarczenie **manualnego scenariusza testowego** na koniec.

**Poza zakresem (świadomie):**
- Zmiana ogólnej logiki liczenia terminów cyklicznych i modelu „nowe wystąpienie = nowy rekord".
- Nowe opcje sortowania inne niż „po dacie wykonania"; sortowanie sekcji innych niż „Zrobione".
- Backfill daty ostatniego wykonania dla **historycznych** zadań cyklicznych utworzonych przed tą
  zmianą (nie da się jej wiarygodnie odtworzyć — pojawi się od następnego wykonania).
- Pokazywanie sekcji „Zrobione" poza filtrem „Wszystkie" (tam zostaje jak dziś).

## 6. Wpływ na Omnia
- **Uprawnienie / RBAC:** bez zmian — istniejący `module.tasks`.
- **Własność danych:** bez zmian w modelu współwłasności; dotyczy istniejących zadań użytkownika/zespołu.
- **Zmiana schematu:** **TAK** — potrzebne trwałe pole „data ostatniego wykonania" na zadaniu
  (nullable), ustawiane przy przetaczaniu zadania cyklicznego. Wymaga ręcznej migracji (C-10/C-11),
  bez enumów (C-12). Szczegóły w `plan.md`.
- **Asystent AI:** nie dotyczy — brak nowej `AIAction`/read-toola (to widok + drobne pole).
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Zgodność z konstytucją
- **C-10/C-11/C-12** — nowe pole = ręczna migracja z sekwencyjnym numerem; typ zwykły (DateTime?),
  żadnych enumów.
- **C-20** — jeśli zmieni się zapis przy wykonaniu zadania cyklicznego, robimy to w Server Action z
  `revalidatePath` (jak dotąd).
- **C-30/C-32** — znaczniki daty i nagłówek: kolory ze zmiennych CSS, teksty po polsku.
- **C-50** — build zielony (weryfikacja do `next build`, lokalny Postgres — C-13).
- **C-51** — wpis do `doświadczenia.md`: dlaczego poprzednia poprawka „nie dawała różnicy" i jak
  „data ostatniego wykonania" (z nowym polem) to domyka.

## 8. Otwarte pytania / decyzje właściciela
**Zadane i rozstrzygnięte na `/specify` (C-55):**
- „Jak uczynić sort jednoznacznie widocznym?" → **Wariant A** (pokaż datę wykonania na zadaniach przy
  sortowaniu + auto-rozwinięcie + nagłówek), **z doprecyzowaniem właściciela**: data ma być **datą
  ostatniego wykonania**, więc **zadania cykliczne — nawet aktywne/niezrobione — pokazują datę
  poprzedniego wykonania**. To wymusza trwałe pole „data ostatniego wykonania" (pkt 6).

**Założenia domyślne (C-53):**
- Format daty: krótki, lokalny (pl-PL), np. „✓ 15 lip" (z godziną, gdy sensowne) — dobór w `plan.md`.
- Znacznik „data ostatniego wykonania" na aktywnym zadaniu cyklicznym jest **dyskretny** (wyszarzony),
  żeby nie zaśmiecać widoku.

## 9. Ryzyka
- **Ryzyko:** rozrost zakresu (nowe pole + migracja) ponad prostą naprawę UI. Mitygacja: pole jest
  minimalne (jedna nullable kolumna), reszta to widok; trzymamy się minimalizmu.
- **Ryzyko:** „brak różnicy" utrzyma się, jeśli w danym projekcie nie ma ukończonych zadań albo ich
  daty są null. Mitygacja: widoczna data + nagłówek + auto-rozwinięcie dają sygnał nawet przy
  identycznej kolejności; dla braku ukończonych — to oczekiwane (nie ma czego sortować), co ujmiemy w
  scenariuszu testowym.
- **Ryzyko:** stare zadania cykliczne bez zapamiętanej daty. Mitygacja: świadomie poza zakresem
  (backfill) — data pojawi się od następnego wykonania; zaznaczone w scenariuszu.
