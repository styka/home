# Spec: Odporność generatora skórek AI na kształt odpowiedzi modelu

- **ID:** 117-skin-generate-format-fix
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-30
- **Moduł(y):** Skórki (ustawienia wyglądu) — naprawa błędu w funkcji z 116

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba

Użytkownik generujący skórkę z opisu słownego (Ustawienia → Wygląd, panel „Opisz skórkę
słowami") dostał błąd o formacie („Model zwrócił nieprawidłowy format") zamiast skórki.
Modele językowe notorycznie zwracają poprawną TREŚĆ w niekanonicznym KSZTAŁCIE: opakowaną
w płotki markdown, z dopiskiem przed/po JSON-ie, uciętą po wyczerpaniu budżetu tokenów
(u modeli rozumujących tokeny myślenia liczą się do tego samego budżetu — lekcja 038/081),
albo w luźnej składni. Projekt ma już na to wzorce wypracowane w 080/081 dla trybu
prostego (tolerancyjne czytanie + ponowienie z pokazaniem modelowi jego własnego błędu +
komunikat porażki mówiący, czego zabrakło) — ale ścieżka odczytu odpowiedzi kończy się
twardym parsowaniem, które przy pierwszym niekanonicznym kształcie zbija całą operację
komunikatem bez żadnej informacji diagnostycznej. Tryb zaawansowany (nowy w 116) nie ma
nawet warstwy tolerancyjnego czytania.

## 2. Cel i miary sukcesu

- Cel: generowanie skórki (oba tryby: prosta i zaawansowana) przetwarza każdą odpowiedź
  modelu, z której da się odzyskać poprawną treść, a gdy naprawdę się nie da — kończy się
  komunikatem mówiącym CO zawiodło i co użytkownik/admin może z tym zrobić.
- Sukces mierzymy:
  - odpowiedzi w znanych, realnych kształtach (płotki markdown, tekst wokół JSON-a,
    luźna składnia, poprawny JSON w nietypowym pojemniku) kończą się wygenerowaną skórką,
    nie błędem formatu;
  - ucięta odpowiedź (wyczerpany budżet wyjścia) nie kończy się enigmatycznym „błędem
    formatu": operacja podejmuje ponowienie, a w razie ostatecznej porażki komunikat
    nazywa przyczynę (odpowiedź ucięta / model nie zwrócił treści) i wskazuje kierunek
    (spróbuj ponownie / sprawdź model operacji „generation" w panelu LLM);
  - żaden dzisiejszy zielony scenariusz nie przestaje działać (regresja 0 dla obu trybów).

## 3. Historyjki użytkownika

- Jako użytkownik opisuję skórkę słowami i dostaję skórkę także wtedy, gdy model
  „opakował" odpowiedź — nie obchodzi mnie format, w jakim model mówi do aplikacji.
- Jako użytkownik, gdy generowanie naprawdę się nie uda, chcę przeczytać, co poszło nie
  tak i czy mam po prostu spróbować jeszcze raz — zamiast zgadywać, czy to moja wina.
- Jako administrator chcę, by komunikat ostatecznej porażki odróżniał „model nie odesłał
  treści" od „odpowiedź ucięta/niekompletna", bo każde z nich naprawia się gdzie indziej
  (przypisanie modelu vs budżet wyjścia).

## 4. Kryteria akceptacji (testowalne)

- [ ] **AC-1** — Given odpowiedź modelu opakowana w płotki markdown (z językiem lub bez)
  albo z tekstem przed/po obiekcie JSON, when generowanie w KTÓRYMKOLWIEK trybie, then
  treść jest odzyskana i przetwarzana dalej (walidacja → podgląd), bez błędu formatu.
- [ ] **AC-2** — Given odpowiedź w luźnej składni akceptowanej przez istniejące w projekcie
  tolerancyjne czytanie JSON-a, when generowanie, then treść jest odzyskana; a odpowiedź
  z mapą tokenów w nietypowym pojemniku (znane kształty z 081) nadal działa w trybie prostym.
- [ ] **AC-3** — Given odpowiedź UCIĘTA w połowie obiektu (wyczerpany budżet wyjścia),
  when generowanie, then operacja nie kończy się na pierwszym podejściu enigmatycznym
  błędem: podejmowane jest ponowienie przewidziane dla tej operacji, a jeśli i ono
  zawiedzie — komunikat nazywa ucięcie/niekompletność jako przyczynę i podpowiada
  kierunek naprawy; nigdy dosłowne „Model zwrócił nieprawidłowy format" bez kontekstu.
- [ ] **AC-4** — Given model odsyła poprawny kształt, ale bez treści dającej się przyjąć,
  when wyczerpią się podejścia, then komunikat rozróżnia (a) brak treści w odpowiedzi od
  (b) treści w całości odrzuconej przez walidację (z wyliczeniem odrzuconych nazw) —
  zgodnie z istniejącym wzorcem diagnostycznym z 080.
- [ ] **AC-5** — Given dotychczasowe zielone scenariusze obu trybów (poprawny JSON,
  odmowa „not-a-theme", walidacja pól), when zmiana wchodzi, then wszystkie istniejące
  testy generatora i skórek przechodzą bez modyfikacji ich oczekiwań.
- [ ] **AC-6** — Given przypadki, które dziś kończą się „Model zwrócił nieprawidłowy
  format" (płotki, tekst wokół, ucięcie), then istnieją testy jednostkowe odtwarzające
  każdy z nich i dowodzące nowego zachowania.

## 5. Zakres

**W zakresie:**
- Tolerancyjne odzyskiwanie treści z odpowiedzi modelu w OBU trybach generatora skórek
  (prosta + zaawansowana), na istniejących wzorcach projektu (080/081).
- Ponowienie z komunikatem korygującym także dla niekanonicznego/uciętego kształtu
  (dziś ponowienie obejmuje tylko odrzucone klucze), w granicach istniejącego limitu
  podejść.
- Rozpoznanie ucięcia odpowiedzi i adekwatny budżet wyjścia dla trybu zaawansowanego
  (definicja jest większa niż mapa tokenów; tokeny myślenia liczą się do budżetu).
- Komunikaty ostatecznej porażki z przyczyną i kierunkiem naprawy (PL), rozróżniające:
  brak treści / treść odrzucona walidacją / odpowiedź ucięta.
- Testy jednostkowe odtwarzające zgłoszone i pokrewne przypadki.

**Poza zakresem (świadomie):**
- Zmiany formatu definicji skórki zaawansowanej, walidacji i kompilacji (116 — bez zmian).
- Zmiany promptów co do TREŚCI zadania (tylko ewentualne doprecyzowanie kształtu
  odpowiedzi, jeśli plan uzna za potrzebne).
- Telemetria/obserwowalność nieudanych generacji ponad istniejące logowanie.
- Inne funkcje AI korzystające z podobnego parsowania (osobna robota, jeśli zgłoszona).

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez zmian — jak 116 (`module.settings`).
- **Własność danych:** bez zmian; żadnych nowych modeli ani migracji.
- **Asystent AI:** nie dotyczy (generator „kliknięciem" poza katalogiem `AIAction`).
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Zgodność z konstytucją

- **C-50** — pełne bramki + build; nowe testy w `test:unit`.
- **C-51** — wpis do `doświadczenia.md` po ustaleniu rzeczywistej przyczyny.
- **C-53** — minimalizm: reużycie istniejących mechanizmów tolerancyjnego czytania
  i wzorca ponowień z 080/081, bez nowych zależności i bez przebudowy generatora.
- **C-40** — bez hardcodowania modelu; budżety per operacja pozostają w kodzie operacji.
- **C-54/C-55** — spójność artefaktów; brak pytań (bugfix jednoznaczny, decyzje
  techniczne wg wzorca istniejącego kodu).

## 8. Otwarte pytania / decyzje właściciela

Brak pytań — zgłoszenie jednoznaczne. Założenia przyjęte domyślnie:
- Zachowujemy istniejący limit podejść (pierwsze + jedno ponowienie) — ponowienie ma być
  mądrzejsze, nie liczniejsze (koszt).
- Odmowa „opis nie niesie wyglądu" pozostaje odpowiedzią, nie awarią (bez ponowienia).
- Komunikaty po polsku, w tonie istniejących (mówią czego zabrakło, nie obwiniają opisu).

## 9. Ryzyka

- **Zbyt tolerancyjne czytanie przyjmie śmieci** → treść po odzyskaniu i tak przechodzi
  pełną walidację pól (116) — tolerancja dotyczy WYŁĄCZNIE opakowania, nie wartości.
- **Ponowienie podwaja koszt** → limit podejść bez zmian; ponowienie tylko gdy pierwsza
  odpowiedź nie dała treści (jak dziś), z lepszym komunikatem korygującym.
- **Regresja trybu prostego** → istniejące testy 080/081 muszą przejść bez zmian oczekiwań
  (AC-5); zmiany wspólne dla obu trybów przechodzą przez jedno miejsce.
