# Zadania: Platforma AI i domknięcie Fazy 1

- **Plan:** ./plan.md (049-platforma-ai-domkniecie-fazy-1)
- **Status:** todo
- **Data:** 2026-08-11

> **Zasada listy zadań:** kolejność **od najłatwiejszego do najtrudniejszego** i **zgodna
> z zależnościami**. `[P]` = można zrównoleglić.
>
> **Zasada nadrzędna (z 046–048):** commit przenoszący zawiera **wyłącznie** przenosiny i przepisane
> importy. Zmiany zachowania — **osobnym** commitem.
>
> **Rytuał po każdym zadaniu**, bez wyjątku:
> `tsc --noEmit` · `check:actions` (**160**) · `check:ai-coverage` (**551**) · `check:cost-badge`
> (**35**) · `check:content-memory` (**35**) · `next lint --dir src` · `check:module-registry` ·
> `check:boundaries` · commit.
> Lint jest w rytuale od 047: `check:boundaries` sprawdza **swoje sondy**, nie kod repozytorium —
> realne naruszenie granicy pokazuje dopiero lint.
>
> **Przed KAŻDĄ przenosiną:** sprawdź, czy w źródle nie ma pary „plik `X.ts` + katalog `X/`"
> (lekcja z 048 — cztery takie kolizje w jednej fali).
>
> **Nigdy `next build` równolegle z klikaczami** — walczą o `.next` (lekcja z 047).
>
> **Każda faza kończy się na czystej linii.** Przy zagrożeniu kontroli zatrzymujemy się na granicy
> fazy z jawnym raportem (spec §5) — to jest wynik, nie porażka.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne, można zrównoleglić

---

## Faza 0 — Punkt odniesienia

- [ ] **T-1** — Zapisać stan startowy jako liczby: `check:actions` = 160, `check:ai-coverage` = 551,
      `check:cost-badge` = 35, `check:content-memory` = 35, `check:module-registry` = 21 modułów,
      `grep -rn "@/modules/" src/platform/` = 0, plików `lib/ai`+`lib/jobs` importujących moduły = 18.
      Dodatkowo **zrzucić katalog asystenta** (liczba akcji i read-tooli per moduł) oraz **wynik
      agregatu kalendarza i migawki pulpitu** dla użytkownika z seeda — to jest materiał porównawczy
      do AC-8/AC-9, którego po przenosinach już się nie odtworzy.
      **Gotowe, gdy:** liczby i zrzuty zapisane jako punkt odniesienia całego przebiegu.

## Faza A — `platform/llm` (czysta przenosina)

- [ ] **T-2** — **`src/lib/llm/` → `src/platform/llm/`.** 9 plików, 64 miejsca importujące, **zero**
      importów modułów (sprawdzone) — najprostszy krok fazy i dowód, że wzorzec działa na tej
      warstwie. `src/lib/llm-client.ts` **zostaje** w `src/lib` (to konsument tras, nie warstwa LLM).
      **Gotowe, gdy:** rytuał przechodzi, `src/lib/llm` nie istnieje. **(AC-1, AC-2)**
- [ ] **T-3** — Domknięcie fazy A: `test:unit` + `next build` na lokalnym Postgresie.
      **Gotowe, gdy:** build exit 0.

## Faza B — Asystent wraca do modułów (zadanie 8)

> Rdzeń przebiegu. Kolejność: najpierw wspólny szkielet, potem egzekutory grupami, potem read-toole,
> **na końcu** przełączenie rejestru — bo to jedyna zmiana zachowania w tej fazie.

- [ ] **T-4** — **Typy wkładu modułu do asystenta w platformie.** `AiActionContribution`,
      `AiReadToolContribution` w `src/platform/ai/` — biorą `userId`/zakres **parametrem**, nie znają
      żadnego modułu. Pole `ai?: () => Promise<…>` w `ModuleDeclaration` (leniwe, jak `sideNav`).
      **Gotowe, gdy:** typy istnieją, `tsc` czysty, żaden moduł jeszcze ich nie używa. **(AC-3)**
- [ ] **T-5** — **`executors/shared.ts` → `src/lib/ai/executorShared.ts` + wstrzyknięcie Zakupów.**
      Plik jest wspólny dla wszystkich egzekutorów i importuje kontrakt Zakupów (`createList`) —
      po regule konsumentów nie należy do żadnego modułu, więc zostaje w warstwie kompozycji,
      a zależność od Zakupów dostaje **parametrem**.
      **Gotowe, gdy:** żaden egzekutor nie importuje kontraktu przez `shared`. **(AC-3)**
- [ ] **T-6** — **Egzekutory, grupa 1 — moduły bez sprzężeń:** Kontakty, Raporty, Nawyki, Flota.
      `src/lib/ai/executors/<x>Executor.ts` → `src/modules/<x>/ai/executor.ts`; blok tekstu
      z `ACTION_CATALOG_BY_MODULE[<x>]` → `src/modules/<x>/ai/catalog.ts`; `ai/index.ts` + pole `ai`
      w `module.ts`. Rejestr w trasie **jeszcze nie zmieniany** — importuje z nowego miejsca.
      **Gotowe, gdy:** rytuał przechodzi, cztery moduły deklarują swój wkład. **(AC-6)**
- [ ] **T-7** — **Egzekutory, grupa 2:** Notatki, Zdrowie, Nauka języków, Warsztaty, Magazynowanie.
      **(AC-6)**
- [ ] **T-8** — **Egzekutory, grupa 3:** Wiadomości, Pogoda, Zwierzęta (+ `petActions.ts`, który mimo
      lokalizacji w `lib/ai` jest kodem modułu Zwierzęta), Portfel.
      **(AC-6)**
- [ ] **T-9** — **Egzekutory, grupa 4 — najbardziej sprzężone:** Zakupy, Zadania, Kuchnia.
      **(AC-6)**
- [ ] **T-10** — **Rozbicie `agentTools.ts` (1199 linii): część platformowa.** Pętla narzędzi,
      protokół i formatowanie wyników → `src/platform/ai/tools.ts`. Wkłady modułowe zostają na razie
      w pliku — rozdzielamy szkielet od treści, zanim ruszymy treść.
      **Gotowe, gdy:** szkielet nie importuje żadnego modułu. **(AC-2)**
- [ ] **T-11** — **Read-toole, grupa 1:** moduły z grup T-6 i T-7 → `src/modules/<x>/ai/readTools.ts`.
      **(AC-6)**
- [ ] **T-12** — **Read-toole, grupa 2:** moduły z grup T-8 i T-9 + agregat kalendarza.
      **Gotowe, gdy:** `agentTools.ts` nie zawiera już wkładów modułowych. **(AC-6)**
- [ ] **T-13** — **`agentPrompt.ts`: szkielet ↔ katalog.** Nagłówki, protokół, `buildSystemPromptParts`
      → platforma; `ACTION_CATALOG_BY_MODULE` znika, bo jego treść jest już w modułach.
      **Gotowe, gdy:** w `agentPrompt` nie ma nazwy żadnego modułu. **(AC-2, AC-6)**
- [ ] **T-14** — **`buildAiCatalog(modules)` w platformie + korzeń kompozycji.**
      `src/platform/ai/catalog.ts` — czysta funkcja, moduły **parametrem** (wzorzec
      `filterAccessibleFavorites(…, isPathLocked)`). `src/lib/ai/catalog.ts` — składa katalog
      z `MODULES`. Nikt jeszcze z niego nie korzysta.
      **Gotowe, gdy:** katalog złożony z deklaracji ma **dokładnie te same** akcje i read-toole co
      zrzut z T-1 — porównane pozycja po pozycji. **(AC-3, AC-6, AC-8)**
- [ ] **T-15** — **ZMIANA ZACHOWANIA (osobny commit): trasy asystenta czytają z katalogu.**
      `execute/route.ts` — łańcuch 18 `if (module === …)` zastąpiony odpytaniem katalogu;
      `agent/route.ts` — read-toole i prompt z katalogu. Choke point walidacji (`hasContract` +
      `validateActionParams`) **zostaje w trasie** i nie zmienia się co do treści.
      **Gotowe, gdy:** rytuał przechodzi, a ręczne wywołanie kilku akcji asystenta daje ten sam wynik
      co przed zmianą. **(AC-6, AC-8, AC-13)**
- [ ] **T-16** — Domknięcie fazy B: `test:unit` + `next build` + klikacz ścieżki szczęśliwej.
      **Gotowe, gdy:** build exit 0, klikacz 21/21. **(AC-12)**

## Faza C — `platform/ai` (czysta przenosina)

- [ ] **T-17** — **Reszta `src/lib/ai/` → `src/platform/ai/`.** ~23 pliki zdolności platformowych.
      **Nie jadą:** trzy manifesty JSON bramek (to dane kontroli, nie kod platformy) oraz
      `src/lib/ai/catalog.ts` i `executorShared.ts` (warstwa kompozycji — znają moduły).
      **Gotowe, gdy:** `grep -rn "@/modules/" src/platform/` zwraca **zero**. **(AC-1, AC-2)**
- [ ] **T-18** — **Bramki zaszyte na ścieżki — naprawa (przewidziana, nie awaria).**
      `check-action-coverage.js` czytało `src/lib/ai/agentPrompt.ts` i `src/lib/ai/executors/*` —
      oba miejsca zniknęły. `check-ai-coverage`, `check-cost-badge`, `check-content-memory` —
      korzenie skanowania i ścieżki w manifestach.
      **Gotowe, gdy:** cztery liczniki wracają na 160 / 551 / 35 / 35 **bez spadku**. **(AC-10, AC-11)**
- [ ] **T-19** — **`check-action-coverage` pilnuje mocniejszej własności** (rozdz. 9.6): nie „czy ręczna
      lista jest kompletna", lecz „czy **każdy moduł zadeklarował** swoje akcje i czy każda ma
      egzekutor oraz kontrakt". Moduł bez deklaracji przestaje istnieć dla asystenta.
      **Gotowe, gdy:** bramka wywala się na module z akcjami, ale bez pola `ai` — sprawdzone **testem
      negatywnym**. **(AC-6, AC-10)**
- [ ] **T-20** — Domknięcie fazy C: `test:unit` + `next build`.
      **Gotowe, gdy:** build exit 0.

## Faza D — Kolejka zadań

- [ ] **T-21** — **Pole `jobs` w deklaracji + rdzeń kolejki do platformy.**
      `queue`, `worker`, `client`, `types` → `src/platform/jobs/`. Typ `JobHandler` bez wiedzy
      o module.
      **Gotowe, gdy:** rdzeń kolejki nie importuje modułu. **(AC-1, AC-2)**
- [ ] **T-22** — **Handlery modułowe → moduły:** `kitchen.*` (4), `magazyn.*` (4), `pets.insights`,
      `news.refresh`, `stores.generate` (Zakupy) → `src/modules/<x>/jobs/`.
      **Zostają w platformie z powodem:** `user.facts` (przekrojowy — wnioskuje wiedzę o użytkowniku
      z działań we wszystkich modułach) i `imageInput` (wspólny helper wejścia obrazowego).
      **Gotowe, gdy:** rytuał przechodzi. **(AC-7)**
- [ ] **T-23** — **ZMIANA ZACHOWANIA (osobny commit): `JOB_HANDLERS` i `ENQUEUABLE_TYPES` z deklaracji.**
      Allowlista tego, co klient może zakolejkować, przestaje być ręczną mapą.
      **Gotowe, gdy:** zbiór dozwolonych typów jest **identyczny** z dzisiejszym (12 pozycji),
      porównany z zrzutem z T-1. **(AC-7, AC-13)**
- [ ] **T-24** — Domknięcie fazy D: `test:unit` + `next build`.
      **Gotowe, gdy:** build exit 0.

## Faza E — Pulpit i kalendarz z deklaracji (reszta zadania 7)

- [ ] **T-25** — **Pole `dashboard` + wkłady ośmiu modułów.** Kuchnia, Zwierzęta, Flota, Portfel,
      Nauka języków, Zdrowie, Magazynowanie (×2 wkłady) — każdy dostaje `dashboard.ts` zwracający
      swój fragment migawki. Kształt danych **bez zmian**.
      **Gotowe, gdy:** wkłady istnieją, trasa jeszcze ich nie używa. **(AC-4)**
- [ ] **T-26** — **ZMIANA ZACHOWANIA (osobny commit): `src/app/page.tsx` składa migawkę z katalogu.**
      Osiem importów kontraktów modułów znika z trasy pulpitu.
      **Gotowe, gdy:** migawka **identyczna** z zrzutem z T-1; `HomePage` dostaje dokładnie to samo.
      **(AC-4, AC-9, AC-13)**
- [ ] **T-27** — **Pole `calendar` + wkłady sześciu modułów.** Zadania, Kuchnia, Zdrowie (+ leki),
      Zwierzęta, Flota, Nauka języków, Usługi — każdy wnosi swoje zdarzenia. **Te same `where`, ten
      sam `select`** co dziś w `collectCalendarEvents` — przenosimy zapytanie, nie przepisujemy go.
      **Gotowe, gdy:** wkłady istnieją, agregat jeszcze ich nie używa. **(AC-5)**
- [ ] **T-28** — **ZMIANA ZACHOWANIA (osobny commit): `collectCalendarEvents` składa wkłady.**
      Moduł Kalendarz przestaje sięgać do tabel sześciu innych modułów.
      **Gotowe, gdy:** agregat zwraca **identyczny** wynik jak zrzut z T-1 — porównany zdarzenie po
      zdarzeniu. **(AC-5, AC-9, AC-13)**
- [ ] **T-29** — Domknięcie fazy E: `test:unit` + `next build` + klikacz ścieżki szczęśliwej.
      **Gotowe, gdy:** build exit 0, klikacz 21/21. **(AC-12)**

## Faza F — Domknięcie Fazy 1

- [ ] **T-30** — **Szósty test `check:module-registry`: moduł opisany poza własnym katalogiem.**
      Żaden egzekutor, read-tool, handler zadania, wkład pulpitu ani kalendarza należący do modułu
      z rejestru nie może mieszkać pod ścieżką platformową ani w warstwie kompozycji.
      **Gotowe, gdy:** bramka zielona na repo i **czerwona po podłożeniu** pliku łamiącego regułę —
      test negatywny, jak przy piątym teście w 048. **(AC-14)**
- [ ] **T-31** — **Pełny zestaw klikaczy** + porównanie z punktem odniesienia.
      **Gotowe, gdy:** klikacz ścieżki szczęśliwej 21/21, a liczba czerwonych w pełnym zestawie
      **nie rośnie** (dziś 14); każda nowa czerwona ma diagnozę. **(AC-12)**
- [ ] **T-32** — **Inwentarz końcowy: co zostało poza platformą i dlaczego.**
      Spis rzeczy świadomie niebędących w `src/platform/` (`user.facts` w platformie mimo nazwy,
      `executorShared`, `catalog` kompozycji, manifesty bramek, `llm-client`) — każda z powodem.
      **Gotowe, gdy:** żadna pozostałość nie jest bez zapisanego uzasadnienia. **(AC-1)**
- [ ] **T-33** — **Dokumentacja:** `CLAUDE.md` (warstwa platformy kompletna, cztery nowe pola
      deklaracji), `constitution.md` (C-36 o `ai`/`calendar`/`dashboard`/`jobs`), rozdz. 15 dziennika
      (wpis 049: stan Fazy 1, co z niej zostało, pierwszy krok Fazy 2), `doświadczenia.md` (C-51).
      **Gotowe, gdy:** dziennik odpowiada na pytanie „czy Faza 1 jest domknięta". **(AC-15)**
- [ ] **T-34** — **Odpowiedź KODEM na pytanie kontrolne z rozdz. 14** („ile miejsc trzeba dotknąć,
      żeby dodać moduł?"). Odpowiedzią jest bramka z T-30 plus zliczenie: ile plików poza katalogiem
      modułu trzeba dotknąć, dodając moduł z pełnym wyposażeniem (menu, nawigacja, AI, pulpit,
      kalendarz, zadania w tle).
      **Gotowe, gdy:** liczba zapisana w dzienniku i **wynosi 1** (sama deklaracja w korzeniu
      kompozycji) albo ma wypisany powód, dlaczego nie. **(AC-14, AC-15)**
- [ ] **T-35** — **Bramki końcowe:** komplet + `next build` przeciw lokalnemu Postgresowi (C-13).
      **Gotowe, gdy:** wszystko zielone, cztery liczniki bez spadku. **(AC-10)**

---

## Mapowanie kryteriów akceptacji

| AC | Zadania |
|---|---|
| AC-1 — zdolności platformowe w platformie | T-2, T-17, T-21, T-32 |
| AC-2 — zero importów modułów z platformy | T-2, T-10, T-13, T-17, T-21 |
| AC-3 — wiedza modułowa parametrem **wymaganym** | T-4, T-5, T-14 |
| AC-4 — pulpit z deklaracji | T-25, T-26 |
| AC-5 — kalendarz z deklaracji | T-27, T-28 |
| AC-6 — katalog asystenta z deklaracji | T-6…T-9, T-11…T-15, T-19 |
| AC-7 — zadania w tle z deklaracji | T-21, T-22, T-23 |
| AC-8 — asystent odpowiada tak samo | T-1 (zrzut), T-14, T-15 |
| AC-9 — pulpit i kalendarz bez zmian | T-1 (zrzut), T-26, T-28 |
| AC-10 — cztery liczniki bez spadku | T-18, T-19, T-35 |
| AC-11 — bramkę naprawiamy, nie obchodzimy | T-18 |
| AC-12 — klikacze | T-16, T-29, T-31 |
| AC-13 — przenosiny oddzielone od zachowania | T-15, T-23, T-26, T-28 |
| AC-14 — bramka odpowiada na „ile miejsc" | T-30, T-34 |
| AC-15 — dziennik | T-33, T-34 |

## Ścieżka krytyczna

```
T-1 → T-2 → [Faza B: T-4 → T-5 → T-6…T-9 → T-10 → T-11 → T-12 → T-13 → T-14 → T-15]
     → T-17 (możliwe DOPIERO po T-15) → T-18 → T-19
     → T-21 → T-22 → T-23
     → T-25 → T-26 → T-27 → T-28
     → T-30 → T-34
```

**Co blokuje co:**
- **T-17 jest zablokowane przez całą fazę B** — `lib/ai` nie pojedzie do platformy, dopóki jego pliki
  importują moduły. To jest jedyna twarda zależność w tym przebiegu i powód, dla którego kolejność
  faz jest odwrotna do intuicyjnej.
- **T-18 jest zablokowane przez T-17** — bramki naprawiamy dopiero, gdy ścieżki są docelowe;
  naprawianie ich w połowie przenosin oznaczałoby robienie tego dwa razy.
- **T-15, T-23, T-26, T-28** to cztery zmiany zachowania i **żadna nie może dzielić commitu**
  z przenosinami (AC-13).
- **T-1 blokuje AC-8 i AC-9** — bez zrzutu sprzed zmian nie ma z czym porównać asystenta, pulpitu
  i kalendarza; po przenosinach tego materiału już się nie odtworzy.

**Zadania równoległe:** brak sensownych `[P]` — kolejne grupy egzekutorów dotykają tego samego
`agentPrompt.ts` i rejestru w trasie, więc zrównoleglenie kupiłoby konflikty zamiast czasu.

## Notatki / blokady

- **Read-toole a `requireAccess`:** rozdz. 9.6 wymaga, żeby read-toole asystenta przechodziły przez
  `requireAccess`, a nie przez `where: { ownerId }` — inaczej asystent stanie się drogą obejścia
  uprawnień do zasobów współdzielonych. **To jest realne zagrożenie bezpieczeństwa**, ale
  `requireAccess` powstaje dopiero w zadaniu 10 (Faza 2). Świadomie **poza zakresem** tego przebiegu
  i odnotowane w specu §5, żeby nie zginęło przy przejściu do Fazy 2.
- **Odstępstwo od rozdz. 9.3:** pola deklaracji są **leniwe** (funkcja zwracająca `import()`), a nie
  statyczne jak w dokumencie. Powód jest twardy: `MODULES` importuje `ModuleSidebar`, komponent
  kliencki, a egzekutory i handlery to kod serwerowy.
