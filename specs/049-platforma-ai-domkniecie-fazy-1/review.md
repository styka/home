# Recenzja: Platforma AI i domknięcie Fazy 1

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-08-11 · **Branch:** `claude/omnia-architecture-skins-qlv2ew`
- **Diff:** `d5700f61..HEAD` — **281 plików, +5672 / −2236**; realnych zmian treści 96 plików
  (reszta to przenosiny rozpoznane przez `git diff -M`)

Recenzja celuje w to, czego `verify.md` nie sprawdza: czy przenosiny czegoś nie przekłamały i czy
cztery zmiany zachowania są zrobione poprawnie.

---

## Ustalenia

### 1. Dokumentacja kontraktu Kalendarza opisywała stan sprzed poprawki — convention

- **Plik:** `worldofmag/src/modules/calendar/contract.ts:8-16` (przed poprawką)
- **Kategoria:** convention

Tabela konsumentów w nagłówku kontraktu nadal wymieniała `getCalendarEvents` i
`collectCalendarEvents` jako to, czego kontrakt dostarcza — mimo że **właśnie ich usunięcie** było
sednem poprawki wydajnościowej. Kontrakt jest w Omnii dokumentem, po którym ludzie orientują się,
co wolno importować; zostawienie tam nieaktualnej listy zaprasza, żeby ktoś ją odtworzył i cofnął
regresję.

**Poprawione w recenzji:** tabela opisuje stan faktyczny, a nagłówek mówi **wprost, dlaczego
agregatu tam nie ma** — razem z liczbą (2775 → 1771 modułów), żeby powód dało się sprawdzić, a nie
tylko przeczytać.

### 2. Cztery zmiany zachowania — sprawdzone po kolei — obserwacja

- **Kategoria:** obserwacja (bez poprawki)

| Zmiana | Dowód, że nie zmieniła wyniku |
|---|---|
| trasy asystenta czytają z katalogu | 56 read-tooli, 16 egzekutorów, 160 akcji per moduł — identyczne z `baseline.json` |
| allowlista zadań z deklaracji | 12 typów, zbiór identyczny; wyłapane odruchowe dopisanie `skins.generate` |
| agregat kalendarza składa wkłady | 38 zdarzeń, listy **identyczne co do znaku** |
| wkład serwerowy poza `module.ts` | graf strony logowania 2775 → 1771 modułów |

Każda jedzie osobnym commitem, żaden nie miesza się z przenosinami.

### 3. Guardy dostępu i własność — nietknięte — obserwacja

Przejrzałem punkty, w których przenosiny najłatwiej byłoby przekłamać. `git diff -M` pokazuje dla
egzekutorów i handlerów **wyłącznie nagłówki importów** — treść guardów, `ownerId`/`ownerTeamId`
i `revalidatePath` bez zmian. Choke point walidacji akcji (`hasContract` + `validateActionParams`)
został w trasie i nie zmienił się co do treści.

Nowa akcja `getCalendarEvents` w `src/actions/calendarAgenda.ts` zachowuje `requireAuth()` **poza**
`unstable_cache` (inaczej Next rzuca) i ten sam klucz per-user oraz tag `calendar:<id>` co poprzednia
— brak przecieku między użytkownikami.

### 4. Agregat wyszedł z modułu — czy to nie regresja własności? — obserwacja

Można spytać, czy przeniesienie `getCalendarEvents` do `src/actions/calendarAgenda.ts` nie łamie
zasady „moduł jest właścicielem swojego kodu". Nie łamie: **agenda nie jest danymi modułu Kalendarz**,
tylko sumą wkładów siedmiu modułów. Kod, który potrzebuje listy wszystkich modułów, z definicji
należy do warstwy kompozycji — tak samo jak `src/lib/ai/catalog.ts` i `src/lib/jobs/registry.ts`.
Moduł zachował to, co faktycznie jego: typy, `MODULE_META`, `isoDay`, `monthRange`, budowę iCal,
widok i czyste składanie.

### 5. Odporność agendy na błąd wkładu — celowa — obserwacja

`collectFromModules` połyka wyjątek pojedynczego wkładu i zwraca pustą listę dla tego modułu.
To świadome: kalendarz czyta siedem źródeł i padnięcie jednego nie może zamienić sześciu działających
w pustą stronę. Ten sam wzorzec ma trasa pulpitu. **Koszt:** cichy błąd wkładu objawia się brakiem
zdarzeń, nie komunikatem — akceptowalne dla widoku agregującego, ale warte pamiętania.

### Czego NIE zgłaszam

Brak enumów Prisma, brak zaszytych kolorów, teksty PL, zero zmian schematu, zero zmian w UI poza
ścieżkami importu. Nowe pliki `module.server.ts` są jednolite (trzy leniwe loadery, nic więcej).
`AiExecContext` nazywa pola po tym, czym są dla użytkownika, a nie po module — dzięki temu platforma
nie poznaje modułów tylnymi drzwiami.

---

## Bramki po recenzji

| Komenda | Wynik |
|---|---|
| `npm run build` (pełny potok, lokalny Postgres) | ✅ **exit 0**, „Compiled successfully" |
| `next lint --dir src` | ✅ 0 błędów |
| `tsc --noEmit` · `tsc -p tsconfig.test.json` | ✅ oba exit 0 |
| `npm run test:unit` | ✅ **657/657** |
| `check:actions` 160 · `check:ai-coverage` 551 · `check:cost-badge` 35 · `check:content-memory` 35 | ✅ bez spadku |
| `check:module-registry` (6 testów) · `check:boundaries` · `check:ui-contract` · `check:schema-drift` | ✅ |
| Graf kompilacji dev: `/auth/signin` | ✅ **1771 modułów** (przed 049: 2120) |

**Klikacze:** przerwane na 102 ✓ / 15 ✘ zgodnie z decyzją właściciela („nie poświęcaj dużo czasu na
klikacze — rozpiszemy je w przyszłości"). Regresja wydajnościowa, która była powodem pierwszego
werdyktu DO POPRAWY, jest naprawiona i udowodniona **grafem kompilacji** — miarą obiektywną,
niezależną od zmienności środowiska. Pozostałe czerwone to zastany dług sprzed 049.

---

## Werdykt

## **APPROVE Z UWAGAMI**

Faza 1 przebudowy jest domknięta w zakresie, który ten przebieg obejmował: **zadania 4 i 8
z checklisty zrobione**, kalendarzowa połowa zadania 7 też. Pięć równoległych list opisujących moduł
zniknęło, platforma nie importuje ani jednego modułu, a równoważność jest udowodniona pozycja po
pozycji, nie zadeklarowana.

Trzy rzeczy złapały narzędzia, a nie oko — zgubiony wiersz `web_search` (test), odruchowo poszerzona
allowlista zadań (porównanie z punktem odniesienia) i mój własny korzeń kompozycji pod ścieżką
wyglądającą jak kod modułu (bramka rejestru). Czwarta — regresja wydajności — nie została złapana
przez nic i wyszła dopiero z pomiaru czasu; to najważniejsza lekcja tego przebiegu i jest zapisana.

**Uwagi, z którymi to wypuszczamy:**
- **migawka pulpitu odłożona** — jedyne miejsce, w którym dodanie modułu nadal wymaga edycji
  `src/app/page.tsx`; następny przebieg zaczyna od zbudowania dla niej dowodu runtime;
- **zastany dług klikaczy** — świadomie odłożony decyzją właściciela;
- **read-toole asystenta wciąż nie przechodzą przez `requireAccess`** (rozdz. 9.6) — realne
  zagrożenie przy zasobach współdzielonych, wykonalne dopiero po zadaniu 10 z Fazy 2.
