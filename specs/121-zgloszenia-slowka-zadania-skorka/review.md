# Review: Poprawki zgłoszeń administratora — słówka bez limitu, zadanie w dialogu, weryfikacja skórek

- **Spec:** ./spec.md (121-zgloszenia-slowka-zadania-skorka)
- **Data:** 2026-09-02
- **Recenzent:** Claude Code (etap 6; świeże oko: subagent omnia-reviewer na diffie
  `origin/develop...HEAD`, z pominięciem `src/generated/*` i artefaktów specs/)

## Zakres

Diff: 2 moduły (Języki, Zadania) + trasa API + typowany klient + e2e + i18n; zero migracji,
zero zmian RBAC/AI. Sprawdzone i uznane za poprawne (nie-ustalenia): import wnętrza modułu
languages przez trasę API (reguła granic obejmuje `src/modules/**`, trasy Kitchen robią to samo —
ustalony wzorzec, nie naruszenie C-36); `visibleUsage` nadal odcina zużycie nie-adminowi;
skaner `wyluskajObiekty` świadomy escapów i klamer w napisach; stary konsument modalu zgodny
z rozszerzoną sygnaturą `onCreated`; manifesty cost-badge/content-memory aktualne; skrót `a`/`n`
z guardem „nie podczas pisania".

## Ustalenia (od najpoważniejszego; wszystkie NIEBLOKUJĄCE — naniesione w ramach recenzji)

1. **`route.ts` (extract) — correctness (minor), NAPRAWIONE.** Ucięta odpowiedź fragmentu
   z częściowym odzyskiem (albo porażka fragmentu w środku pętli) oddawała niepełną listę bez
   żadnego sygnału — „częściowe udaje poprawne", wbrew lekcji 119/120 i intencji 121.
   Scenariusz: gęsty tekst → lista ponad `maxTokens` → ostatnie słówka fragmentu przepadają
   po cichu. Poprawka: flaga `outputTruncated` w odpowiedzi + nota `odpowiedzNiepelna`
   w `DeckPage` (obok istniejącej `tekstPrzyciety`).
2. **`llm-client.ts` `post()` + `DeckPage.generate()` — correctness (uwaga), NAPRAWIONE.**
   Trasa buduje starannie nazwane komunikaty 502, a transport wyrzucał body i rzucał
   `LLM request failed: <status>`; `generate()` miało `try/finally` bez `catch`, więc porażka
   gasła w ciszy. Poprawka: `post()` czyta `error` z body (fallback na status — nikt w repo nie
   parsuje starego tekstu, sprawdzone grepem), `generate()` łapie wyjątek i pokazuje komunikat
   (`var(--accent-red)`). Zysk obejmuje wszystkich konsumentów typowanego klienta.
3. **`LanguagesHomePage` — convention (minor), ROZSTRZYGNIĘTE komentarzem.** Przepływ „nowa talia
   z tekstem" nie pokazuje not o przycięciu — natychmiast nawiguje do talii, więc nie ma gdzie;
   świadoma decyzja zapisana w kodzie (recenzent dopuszczał tę formę). Błędy ekstrakcji trafiają
   tam do istniejącego `setError` — od poprawki 2 z komunikatem przyczynowym.
4. **`ekstrakcjaSlowek.ts` — correctness (trivial), NAPRAWIONE.** Off-by-one w twardym cięciu:
   fragment bez żadnej granicy miał `maksFragment + 1` znaków (wbrew dokumentacji funkcji).
   Poprawka: granica `maksFragment - 1`; test zaostrzony o asercję długości fragmentów.

Po poprawkach: `tsc` czyste, testy helperów 9/9 (z zaostrzoną asercją), `check:i18n` zielone
(2 nowe klucze), `next lint` zielony, `next build` ponowiony na stanie po poprawkach.

## Werdykt: **APPROVE Z UWAGAMI**

Rdzeń zmiany solidny: fragmentacja nie gubi treści (dowód testem sklejenia), odzysk z uciętego
JSON-a policzony na każdej głębokości, `scalSlowka` niczego nie ucina, pętla nie zbija operacji
przy częściowym sukcesie, a przebudowa Zadań zachowuje semantykę 1:1 ze starym widgetem
(modal 118 z drugim konsumentem — wzorcowe C-35/C-53). Uwagi 1–4 dotyczyły spójności zasady
„bez cichego ucięcia" i zostały naniesione przed merge. Promocja `develop → master`
fast-forwardem, bez taga (decyzja właściciela 2026-08-29).
