# Recenzja: Odporność generatora skórek AI na kształt odpowiedzi modelu (119)

- **Spec:** ./spec.md · **Weryfikacja:** ./verify.md (GOTOWE Z UWAGAMI)
- **Data:** 2026-08-30
- **Zakres:** commit `3e7893e` — 1 plik kodu (`skinGenerate.ts`, +95/-12), testy (+82),
  lekcja C-51, artefakty specs/119
- **Metoda:** pełne przejście diffa świeżym okiem (diff mały — bez subagenta, C-53)

## Ustalenia

Brak ustaleń blokujących ani wartych poprawki. Sprawdzone punkty ryzyka:

- **Poprawność pętli ponowień:** `wywolania.push` (koszt) PRZED odczytem — nieudane
  podejście jest uczciwie liczone; `continue` przy pierwszej porażce formatu, twardy
  `JobError` dopiero po wyczerpaniu `SKIN_MAX_ATTEMPTS`; ścieżki mieszane (format-fail →
  walidacja-fail i odwrotnie) kończą się właściwym komunikatem (`opisPorazkiFormatu`
  vs `opisPorazki`).
- **Bezpieczeństwo:** tolerancja dotyczy WYŁĄCZNIE opakowania — odzyskany obiekt idzie
  przez tę samą pełną walidację co przed zmianą (`walidujDefinicje`/`validateTokens`);
  powierzchnia sanityzacji bez zmian. `odczytajOdpowiedzJson` odrzuca nie-obiekty
  (tablica/null), więc dalszy kod nie dostanie zaskakującego kształtu.
- **Semantyka diagnostyki:** ucięcie brane z flagi `truncated` transportu (032), nie
  z heurystyk na tekście; komunikaty rozróżniają przyczyny i wskazują panel LLM;
  stary, bezużyteczny „nieprawidłowy format" ma test regresyjny na nieobecność.
- **Tryb prosty:** `wyodrebnijTokeny` (081) wpięty na ścieżkę — semantyka liczników
  (`ostatnieOdrzucone` = przysłane pary) zachowana na wyniku mapowania; normalizacja
  wartości (liczby→napisy) zwiększa akceptację bez luzowania walidacji.
- **Konwencje:** zero zmian schematu/UI/RBAC; komunikaty PL w miejscu zastanego wzorca;
  teksty korygujące dla modelu nie zmieniają treści zadania (spec §5).
- **Testy:** 9 nowych przypadków odtwarza dokładnie kształty, które padały (w tym
  `\n` po płotku zamykającym — bezpośrednia przyczyna zgłoszenia); istniejące testy
  080/081 przechodzą bez zmian oczekiwań; pełny `test:unit` fail 0.

## Werdykt: **APPROVE**

Uwaga (nieblokująca): ponowienie na poziomie pętli dowiedzione śladem kodu i testami
helpera — test z mockiem `chatComplete` byłby nowym wzorcem testowym w repo (świadomie
poza zakresem, verify.md pkt 1). Promocja `develop → master` fast-forwardem, bez taga
(decyzja właściciela 2026-08-29).
