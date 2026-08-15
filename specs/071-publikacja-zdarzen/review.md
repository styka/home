# Recenzja: 071 — publikacja zdarzeń

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-08-15
- **Diff:** 18 plików, +1344 / −12 względem `origin/master`

## Ustalenia

### 1. Test PLATFORMY importował moduł · convention (C-36) · **NAPRAWIONE W RECENZJI**

`src/platform/events/__tests__/dispatch.integration.test.ts` importował
`@/modules/shopping/events`, żeby dowieść idempotencji na prawdziwym subskrybencie. Platformie tego
nie wolno — i to jest **dokładnie ta sama pomyłka co w 069**, gdzie test QA sięgnął po slug Kuchni.
Wtedy ratunkiem była ścieżka względna, tu alias, ale sedno identyczne: **test też jest kodem
platformy i granica go obowiązuje**.

**Poprawka:** dowód idempotencji przeniesiony do `src/modules/shopping/__tests__/`, gdzie import
własnego modułu jest naturalny. W platformie zostaje mechanizm (rozsyłka, izolacja błędu, brak
odbiorcy, równoległość) i komentarz mówiący, gdzie stoi druga połowa dowodu.

### 2. Dwa pliki testowe walczyły o globalny rezolwer · correctness (test) · **NAPRAWIONE W RECENZJI**

Po rozdzieleniu zestaw zaczął być **losowo czerwony** — raz na kilka przebiegów. Przyczyna nie była
oczywista i warto ją nazwać: `setEventSubscriberResolver` ustawia **stan globalny procesu** (słusznie
— w produkcji jest jeden worker na proces), a `node --test` uruchamia pliki **równolegle w jednym
procesie**. Drugi plik nadpisywał rezolwer pierwszemu, a jego obieg zjadał cudze zdarzenia
z niewłaściwym rezolwerem.

Pierwsza próba naprawy (czyszczenie niedostarczonych zdarzeń na wejściu fixture'u) **zamieniła jedną
losową czerwień na drugą** — bo psuła sąsiada dokładnie tak samo.

**Poprawka właściwa:** test modułu **nie używa obiegu**. Woła `subskrybent.handle(rekord)` **dwa
razy wprost** — bo dokładnie to robi worker przy ponowieniu. Dowód jest ten sam, a globalnego stanu
nie ma w ogóle. Test platformy dodatkowo zawęża asercje do **własnych** zdarzeń, zamiast zakładać,
że partia zawiera tylko jego.

Sprawdzone **cztery przebiegi z rzędu**: 5/5 stabilnie. Obie mutacje (`klucz bez id zdarzenia`,
`powiadomienie także dla sprawcy`) nadal czerwienią.

### 3. Bramka potwierdzała komentarz zamiast kodu · correctness (bramka) · **NAPRAWIONE W IMPLEMENTACJI**

Opisane w `verify.md` §4. Warte powtórzenia tutaj, bo dotyczy wszystkich bramek tekstowych w repo:
im staranniej opisujemy kod, tym więcej w pliku zdań zawierających frazy, których bramka szuka.

### 4. Kolejność oznaczania dostarczenia · correctness · **CZYSTO I UDOKUMENTOWANE**

`deliveredAt` po sukcesie, nie przy pobraniu. Tabela skutków w `queue.ts` i w planie; wybór zgodny
z rozdz. 9.4.4. Mutacja „oznaczaj mimo błędu" czerwieni test.

### 5. Start workera · convention · **CZYSTO**

Nie w `instrumentation.ts` (runtime EDGE — Z-131), nie u producenta (moduł nie sięga po korzeń
kompozycji — 049), lecz w `layout.tsx`, idempotentnie. Konsekwencja odnotowana w manifeście:
na środowisku testowym, które usypia, dostarczanie rusza po pierwszym żądaniu.

### 6. Granice i konwencje · **CZYSTO**

`grep "@/modules/"` po `src/platform/events/` → pusto. Moduł nie importuje korzenia kompozycji.
Rezolwer wstrzykiwany bez wartości domyślnej (C-36). Zero enumów Prisma, zero nowych zależności,
komunikaty po polsku. Zapadka paginacji złapała moje własne zapytanie — dopisany `take`.

## Werdykt

**APPROVE Z UWAGAMI.**

Mechanizm robi to, co obiecuje: zdarzenia docierają, ponowienie jest nieszkodliwe, jeden zepsuty
subskrybent nie zatrzymuje strumienia, dwa workery nie wchodzą sobie w drogę. Build **exit 0**,
`test:unit` **889/889**, 21 bramek zielonych.

**Naprawione w recenzji:** import modułu w teście platformy · losowa czerwień z globalnego rezolwera.

**Uwaga przeniesiona dalej:** globalny rezolwer jest poprawny produkcyjnie, ale sprawia, że **każdy
kolejny test dotykający obiegu** będzie miał ten sam problem. Przy zadaniu 23, gdy dojdzie kanał
SSE i testów przybędzie, warto rozważyć przyjmowanie rezolwera parametrem przez `obiegZdarzen` —
z zachowaniem wstrzykniętego jako domyślnego.
