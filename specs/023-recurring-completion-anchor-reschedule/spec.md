# Spec: Przeliczenie terminu następnego wystąpienia po edycji daty wykonania (kotwica „od daty wykonania")

- **ID:** 023-recurring-completion-anchor-reschedule
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-22
- **Moduł(y):** Tasks (`/tasks` — zadania cykliczne, edycja daty wykonania)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba
Zadania cykliczne mogą liczyć następny termin **od daty wykonania** (kotwica `COMPLETION` — „od dziś").
Termin następnego wystąpienia liczony jest **w chwili domknięcia** i zapisywany na sztywno. Po 021/022
datę wykonania da się **poprawić po fakcie** (np. gdy odhaczasz z opóźnieniem), a 022 synchronizuje
„datę ostatniego zrobienia" następcy — **ale nie jego termin**. Skutek: dla kotwicy „od daty wykonania"
termin następnego wystąpienia zostaje policzony od **starej** daty i rozjeżdża się z poprawioną (np.
poprawiasz wykonanie o 12 dni wstecz, a następne zadanie dalej „wisi" 12 dni za daleko). To myli
harmonogram, który z definicji miał liczyć się od realnego wykonania.

## 2. Cel i miary sukcesu
- Cel: po poprawieniu daty wykonania domkniętego cyklicznego z kotwicą „od daty wykonania" termin
  aktywnego następcy odpowiada **poprawionej** dacie — chyba że użytkownik świadomie ustawił ten termin
  inaczej.
- Sukces mierzymy:
  - Edycja daty wykonania (o Δ dni) na zadaniu z kotwicą „od daty wykonania" przesuwa termin (i start)
    nietkniętego następcy tak, jakby wykonanie nastąpiło od razu w poprawionej dacie.
  - Ręcznie zmieniony termin następcy oraz termin ustawiony przez „Następne w tej dacie" **nie** są
    nadpisywane.
  - Kotwica „od terminu" (`DUE`) oraz zwykłe (niecykliczne) zadania — bez zmian.

## 3. Historyjki użytkownika
- Jako użytkownik odhaczający zadanie „od daty wykonania" z opóźnieniem chcę poprawić datę wykonania i
  mieć pewność, że następne wystąpienie przeliczy się od tej poprawionej daty.
- Jako użytkownik, który świadomie przesunął termin następnego wystąpienia (albo użył „Następne w tej
  dacie"), nie chcę, by korekta daty wykonania poprzednika nadpisała mój wybór.

## 4. Kryteria akceptacji (testowalne)
- [ ] **AC-1 (przeliczenie dla COMPLETION)** — Given domknięte cykliczne z efektywną kotwicą „od daty
  wykonania", mające **aktywny** (niezrobiony) następny egzemplarz, którego termin jest wciąż tym
  policzonym przy domknięciu, when zmieniam datę wykonania poprzednika, then termin następcy zostaje
  **przeliczony** od nowej daty wykonania (wg reguły cyklu).
- [ ] **AC-2 (przesunięcie startu)** — W sytuacji z AC-1, jeśli następca ma datę „Start", then jego
  „Start" przesuwa się o tę samą różnicę co termin (zachowane wyprzedzenie startu względem terminu).
- [ ] **AC-3 (poszanowanie ręcznych zmian / override)** — Given następca, którego termin został
  **ręcznie zmieniony** albo ustawiony przez „Następne w tej dacie" (różny od policzonego ze starej
  daty), when zmieniam datę wykonania poprzednika, then termin następcy **pozostaje bez zmian** (tylko
  „data ostatniego zrobienia" synchronizuje się jak w 022).
- [ ] **AC-4 (kotwica DUE bez zmian)** — Given domknięte cykliczne z kotwicą „od terminu", when zmieniam
  datę wykonania, then termin następcy **nie** jest przeliczany (pozostaje liczony od terminu; zmienia
  się tylko „data ostatniego zrobienia").
- [ ] **AC-5 (tylko aktywny bezpośredni następca)** — Given następca, który jest już **zrobiony**
  (kolejne wystąpienie ruszyło dalej), when zmieniam datę wykonania poprzednika, then jego termin **nie**
  jest ruszany (nie cofamy przeszłego/domkniętego harmonogramu).
- [ ] **AC-6 (bez regresji)** — Given pojedyncze/masowe domykanie, single-click, kotwica DUE, zwykłe
  zadania, then działają jak dotąd; „data ostatniego zrobienia" (022) nadal synchronizuje się w każdym
  przypadku edycji daty wykonania.

## 5. Zakres
**W zakresie:**
- Przy edycji daty wykonania domkniętego cyklicznego z efektywną kotwicą „od daty wykonania":
  **przeliczenie terminu** aktywnego, nietkniętego następcy od poprawionej daty, wraz z przesunięciem
  jego „Startu".
- Zachowanie synchronizacji „daty ostatniego zrobienia" z 022 we wszystkich przypadkach.

**Poza zakresem (świadomie):**
- Kotwica „od terminu" (`DUE`) — termin następcy z definicji niezależny od daty wykonania.
- Nadpisywanie **ręcznie** przesuniętego terminu następcy lub terminu z „Następne w tej dacie".
- Kaskadowe przeliczanie **dalszych** wystąpień (gdy bezpośredni następca jest już zrobiony) — nie
  cofamy domkniętego łańcucha.
- Jednorazowa kotwica użyta tylko przy domknięciu (`opts.anchor`), a nie zapisana w regule — po fakcie
  nieodtwarzalna; decyzję opieramy o kotwicę **zapisaną w regule** poprzednika.
- Zmiana ogólnej logiki liczenia terminów cyklicznych i UI reguły.

## 6. Wpływ na Omnia
- **Uprawnienie / RBAC:** bez zmian — istniejący `module.tasks`, istniejące guardy dostępu (C-21).
- **Własność danych:** bez zmian; działa na istniejących zadaniach użytkownika/zespołu.
- **Zmiana schematu:** **nie** — używa istniejących pól (`completedAt`, `dueDate`, `startDate`,
  `recurring`, powiązanie `previousTaskId` z 022). Brak migracji.
- **Asystent AI:** nie dotyczy — brak nowej `AIAction`/read-toola (zmiana wewnętrzna istniejącej akcji
  edycji zadania).
- **Kalendarz / powiadomienia / trash:** pośrednio — poprawiony termin następcy propaguje się do agendy
  kalendarza/przypomnień jak każda zmiana terminu (przez istniejący `revalidatePath`); brak nowych
  wpięć.

## 7. Zgodność z konstytucją
- **C-20** — przeliczenie realizowane w istniejącej Server Action edycji zadania z `revalidatePath`.
- **C-21** — działa pod istniejącym guardem dostępu do zadania; następca współdzieli właściciela.
- **C-53 (minimalizm)** — reużywamy istniejącej logiki liczenia następnego terminu i powiązania
  wystąpień z 022; brak nowych modeli/migracji/zależności.
- **C-50/C-51** — build zielony; wpis do `doświadczenia.md` (kotwica „od daty wykonania" wymaga
  przeliczenia terminu następcy przy korekcie daty wykonania; heurystyka „nietknięty termin").

## 8. Otwarte pytania / decyzje właściciela
**Decyzja właściciela (rozstrzygnięta na tym etapie — wariant rekomendowany):**
- „Co ma się stać z terminem następnego wystąpienia przy korekcie daty wykonania (kotwica od daty
  wykonania)?" → **Przelicz, ale szanuj ręczne zmiany**: przelicz termin (i przesuń start) aktywnego
  następcy od poprawionej daty **tylko** jeśli termin jest wciąż tym policzonym przy domknięciu (nie
  był ręcznie zmieniony ani ustawiony przez „Następne w tej dacie"); inaczej zostaw bez zmian.

**Założenia domyślne (C-53):**
- „Nietknięty termin" rozpoznajemy po tym, że aktualny termin następcy odpowiada terminowi policzonemu
  ze **starej** daty wykonania wg reguły (heurystyka jednoznaczna i tania; naturalnie wyłącza przypadki
  ręcznej zmiany i „Następne w tej dacie").
- Granularność i normalizacja daty — spójne z 020/021/022 (dzień).
- Efektywna kotwica brana z reguły zapisanej w zadaniu (`recurring.anchor`); brak kotwicy = „od terminu".

## 9. Ryzyka
- **Ryzyko:** nadpisanie świadomej zmiany terminu następcy. Mitygacja: heurystyka „nietknięty termin"
  (przeliczamy tylko, gdy termin == policzony ze starej daty) — AC-3.
- **Ryzyko:** ruszanie domkniętego/przeszłego harmonogramu. Mitygacja: tylko **aktywny** (nie-DONE)
  bezpośredni następca — AC-5; brak kaskady wstecz.
- **Ryzyko:** rozjazd start/termin. Mitygacja: start przesuwany o tę samą różnicę co termin — AC-2.
- **Ryzyko:** przeliczenie odpalane niepotrzebnie dla DUE/niecyklicznych. Mitygacja: bramka na efektywną
  kotwicę COMPLETION i obecność powiązanego następcy — AC-4/AC-6.
