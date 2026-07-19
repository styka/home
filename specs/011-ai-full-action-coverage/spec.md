# Spec: Pełne pokrycie akcji użytkownika przez asystenta AI (mechanizm + domykanie luk)

- **ID:** 011-ai-full-action-coverage
- **Status:** in-progress
- **Data:** 2026-07-19
- **Moduł(y):** Asystent AI (home) + wszystkie moduły z akcjami użytkownika

## 1. Problem / potrzeba
Asystent miał „mieć dostęp do wszystkich akcji, jakie użytkownik może wykonać ręcznie". W praktyce nie
miał — np. nie umiał otagować zadania (`updateTaskTags`), bo możliwości AI utrzymywane są ręcznie w 3
miejscach (katalog w prompt'cie, egzekutory, whitelist fast-path), a nic nie pilnowało kompletności
względem Server Actions. Nowe funkcje użytkownika „przeciekały" bez integracji z asystentem.

## 2. Cel i miary sukcesu
- Cel: każda mutująca akcja użytkownika jest ŚWIADOMIE sklasyfikowana względem AI, a nowe akcje nie
  mogą wejść bez tej decyzji; docelowo wszystkie sensowne akcje są wystawione dla asystenta.
- Sukces mierzymy: licznik pokrycia z `scripts/check-ai-coverage.js` (`ai` / `pending` / `excluded`)
  oraz zielony build (bramka pada na nieklasyfikowanej nowej akcji).

## 3. Zakres (ta iteracja — opcja 1 właściciela)
**W zakresie:**
- **Mechanizm (trwały):** `scripts/check-ai-coverage.js` + manifest `src/lib/ai/action-coverage.json`
  (status `ai|pending|excluded` per mutująca Server Action) wpięty w `npm run build`; generowany raport
  luk `docs/ai/pokrycie-akcji.md` (`--report`).
- **Domknięcie pierwszej partii luk (12 akcji):** `set_task_tags`, podzadania + tagi w `create_task`,
  `set_note_tags`, moduł **contacts** dla AI (`list_contacts` + `create/update/delete_contact`),
  `create_budget`/`create_goal`/`contribute_goal` (portfel), `generate_shopping_from_plan` (kuchnia),
  `move_item`/`unarchive_list`/`complete_shopping` (zakupy).
- **Łańcuch akcji:** wzmocniona reguła w prompt'cie agenta (jedno polecenie → wiele kroków, także między
  modułami; referencja po nazwie do elementów tworzonych w tym samym planie). Wykonanie wielu akcji już
  istniało (krok `plan` = tablica `AIAction[]`); doprecyzowano zachowanie modelu.

**Poza zakresem (świadomie, do kolejnych iteracji):** pozostałe ~123 akcje `pending` (patrz
`docs/ai/pokrycie-akcji.md`) — właściciel zapowiedział domykanie ich etapami aż do pełnej integracji.
Trwale wykluczone (`excluded`): RBAC/admin/config/LLM/skiny, ustawienia i tryby, wewnętrzne
(powiadomienia/aktywność/sync/ical), interaktywne (załączniki/zdjęcia/reorder/graf sklepu/CSV/nauka SRS),
zarządzanie zespołami, operacje konta.

## 4. Kryteria akceptacji
- [ ] **AC-1** — `npm run check:ai-coverage` przechodzi; dodanie nowej mutującej Server Action bez wpisu
  w manifeście wywala build.
- [ ] **AC-2** — „otaguj zadanie X tagiem pilne" nadaje tag (dodając do istniejących), „pokaż zadania
  otagowane X" nadal działa (odczyt).
- [ ] **AC-3** — asystent tworzy/edytuje/usuwa kontakt i potrafi wylistować kontakty (`list_contacts`).
- [ ] **AC-4** — asystent tworzy budżet i cel oszczędnościowy oraz dopłaca do celu; generuje listę
  zakupów z jadłospisu; przenosi pozycję między listami; „zakończ zakupy".
- [ ] **AC-5** — jedno polecenie złożone ("utwórz projekt X i dodaj 3 zadania") zwraca jeden plan z
  wieloma akcjami (łańcuch), referując nowo tworzony projekt po nazwie.
- [ ] **AC-6** — build zielony (check:actions, check:ai-coverage, next build).

## 5. Zgodność z konstytucją
- **C-20/C-21** — egzekutory wołają istniejące Server Actions (z ich `revalidatePath` i guardami dostępu).
- **C-23** — każda nowa `AIAction` ma egzekutor (`check:actions` zielone).
- **C-32** — teksty PL. **C-53** — minimalizm (reużycie istniejących akcji i resolverów).
- **Nowa bramka** rozszerza rodzinę `check:*` (duch C-50).

## 6. Uwaga o kontynuacji
`docs/ai/pokrycie-akcji.md` jest roadmapą: kolejne iteracje flipują wpisy `pending → ai` (dopisując
egzekutor + katalog), aż licznik `pending` spadnie do zera dla akcji sensownych konwersacyjnie.
