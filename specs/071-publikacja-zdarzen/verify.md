# Weryfikacja: 071 — publikacja zdarzeń

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md
- **Data:** 2026-08-15

## 1. Bramki

| Komenda | Wynik |
|---------|-------|
| `check:migrations` · `check:schema-drift` | ✅ (brak migracji — przebieg nie rusza schematu) |
| `check:actions` · `check:ai-coverage` | ✅ 160 / 553 |
| `check:ui-contract` · `check:boundaries` · `check:module-registry` | ✅ |
| `check:pagination` | ✅ 263 — **złapała nowe zapytanie, patrz §4** |
| `check:domain` · `check:events` | ✅ |
| **`check:subscribers` (nowa)** | ✅ 1 subskrybent z zadeklarowaną idempotencją |
| `tsc` · `next lint` | ✅ czysto / **0 błędów** |
| `next build` | ✅ **exit 0** |
| `npm run test:unit` | ✅ **889/889** (przed: 884 → **+5**) |

## 2. Kryteria akceptacji

- **AC-1** ✅ test „dostarczenie": subskrybent dostaje dokładnie to zdarzenie, `deliveredAt` ustawione.
- **AC-2** ✅ **sedno przebiegu.** Test symuluje awarię workera (odkręca `deliveredAt`) i puszcza
  obieg ponownie: **jedno** powiadomienie, **ten sam wiersz** (porównane po `id`).
- **AC-3** ✅ subskrybent rzuca na jednym zdarzeniu → to zdarzenie zostaje niedostarczone, drugie
  przechodzi. Jeden zepsuty subskrybent nie zatrzymuje strumienia.
- **AC-4** ✅ dwa obiegi równolegle na 6 zdarzeniach → **6 wywołań, 6 unikalnych**. Liczone są
  wywołania subskrybenta, nie wiersze — bez `SKIP LOCKED` licznik wyszedłby większy.
- **AC-5** ✅ subskrybent z deklaracji modułu; rezolwer **wstrzykiwany**; korzeń kompozycji własny
  (wzorzec 050), nie pole w `ModuleServerContributions`.
- **AC-6** ✅ bramka `check:subscribers`, cztery kontrole.
- **AC-7** ✅ **pięć sond**, każda z właściwym komunikatem: subskrybent bez wpisu · wpis bez
  subskrybenta · nieznana wartość `idempotencja` · `klucz-unikalny` bez `event.id` · bez `upsert`.
- **AC-8** ✅ **5 mutacji, 5 złapanych** (po dopisaniu jednej asercji — patrz §4).
- **AC-9** ✅ zdarzenie bez subskrybentów oznaczane jako dostarczone.
- **AC-10** ✅ liczniki bez ruchu, testów +5, build zielony.

## 3. Zgodność z konstytucją

C-12 ✅ · C-13 ✅ · C-20/C-21 ✅ (subskrybent bez sesji, działa w przestrzeni ze zdarzenia) ·
**C-35** ✅ mechanizm z prawdziwym subskrybentem · **C-36** ✅ rezolwer wstrzykiwany, moduł nie
sięga po korzeń kompozycji (dlatego worker startuje z layoutu, nie u producenta) ·
C-50/C-51 ✅ · **C-53** ✅ zero nowych zależności, `LISTEN/NOTIFY` odłożone do zadania 23.

## 4. Co ta weryfikacja realnie wniosła

**Dwie rzeczy przeszły przez wszystkie testy i zostały złapane dopiero dalej.**

1. **Sonda bramki nie działała, bo bramka czytała komentarz.** Wzorzec szukający `event.id` trafiał
   w zdanie *opisujące*, że klucz ma z niego pochodzić. Bramka potwierdzała dokumentację, nie kod.
   Poprawka: usuwanie komentarzy przed dopasowaniem.
2. **Test nie sprawdzał, czy sprawca NIE dostaje powiadomienia** o własnym kliknięciu — patrzył
   tylko na skrzynkę drugiej osoby. Mutacja usuwająca warunek `NOT: { userId: actorId }` przechodziła
   na zielono. Dopisana jedna asercja.

**Trzecia rzecz przyszła z zewnątrz i jest dobrą wiadomością:** zapadka paginacji z 068 zatrzymała
build na **moim** nowym zapytaniu (264 > 263). Zapadka pilnuje nie tylko zastanego długu.

## 5. Werdykt

**GOTOWE.** Wszystkie AC spełnione, 21 bramek zielonych, build exit 0, 889/889.
