-- 106 — PROMPT WZNOWIENIA PRACY + zapamiętanie „widziałem to dziś".
--
-- UWAGA (C-15): DDL poniżej pochodzi z `prisma migrate diff`, ale wzięta jest z niego WYŁĄCZNIE
-- część dotycząca tej zmiany. Wygenerowany diff otwierał się instrukcjami, które skasowałyby
-- indeksy pełnotekstowe Notatek, indeks trigramowy transkrypcji YouTube (dodany dwie migracje temu)
-- oraz tabelę kopii własności. Wszystkie są wypisane w `src/lib/db/schema-drift-allowed.json`.

-- Kiedy użytkownik widział dany prompt (JSON `{ "<klucz>": "YYYY-MM-DD" }` w JEGO strefie).
ALTER TABLE "UserMenuPref" ADD COLUMN "promptyPokazane" TEXT NOT NULL DEFAULT '{}';

CREATE TABLE "PromptWznowienia" (
    "id" TEXT NOT NULL,
    "klucz" TEXT NOT NULL,
    "tytul" TEXT NOT NULL,
    "wstep" TEXT NOT NULL,
    "tresc" TEXT NOT NULL,
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptWznowienia_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PromptWznowienia_klucz_key" ON "PromptWznowienia"("klucz");
CREATE INDEX "PromptWznowienia_aktywny_idx" ON "PromptWznowienia"("aktywny");

-- ─── Treść promptu (C-14: idempotentnie, `DO UPDATE` żeby seed był samopoprawiający) ──────────
INSERT INTO "PromptWznowienia" ("id", "klucz", "tytul", "wstep", "tresc", "aktywny", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'bezpieczenstwo-2026-08',
  'Niedokończona praca: bezpieczeństwo',
  'Sesja z sierpnia 2026 domknęła większość planu bezpieczeństwa, ale trzy rzeczy zostały świadomie na później — a jedna z nich (CSP) wymaga kilku dni zbierania danych, więc im wcześniej ruszy, tym lepiej. Skopiuj poniższy tekst i wklej go do Claude Code w nowej sesji.',
  $tresc$Wznawiamy pracę nad bezpieczeństwem Omnii. Kontekst i ustalenia są w aplikacji:
`/reports/audyt-bezpieczenstwa-2026-08` (audyt) oraz `/reports/plan-domkniecia-bezpieczenstwa`
(plan z podziałem na zadania Claude Code i zadania właściciela).

STAN: punkty 1, 2, 3, 4, 5, 8 i 9 planu są ZROBIONE i na produkcji. Zostały trzy rzeczy.

═══ ZADANIE 1 (główne): Content Security Policy — punkt 7 planu ═══

Rozpoznanie jest już zrobione, NIE powtarzaj go — oto ustalenia:

• Aplikacja NIE wstawia żadnych własnych skryptów osadzonych (wszystkie trafienia `<script`
  w `src/` to parsery wycinające skrypty z POBIERANYCH stron, nie renderowanie). Dzięki temu
  `script-src` może być ostry.
• 309 plików używa stylów pisanych wprost w komponentach → `style-src` MUSI dopuścić style
  osadzone. Przepisanie tego to osobny projekt, nie zadanie bezpieczeństwa. Wstrzyknięcie stylu
  pozwala zniekształcić wygląd, nie wykonać kod — świadomie zostawiamy luźno.
• 20 plików używa `dangerouslySetInnerHTML` (renderowanie tekstu sformatowanego + `<style>`).
• `img-src` musi dopuścić: `data:` (ikony kategorii, kody QR), kafelki map z OpenStreetMap
  (moduł Pogoda) oraz miniatury z serwerów YouTube (moduł YouTube, `i.ytimg.com`).
• `connect-src` może być ostry: wywołania modeli idą przez serwer, nie z przeglądarki.
• `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`.

Sposób wykonania — TRZY ETAPY, nie jeden:
1. Warstwa pośrednia (`src/middleware.ts`, dziś 15 linii, sam NextAuth) losuje przy każdym żądaniu
   jednorazowy znacznik (nonce) i wpisuje go do nagłówka CSP; Next oznacza nim własne skrypty
   startowe. UWAGA: to jest ścieżka krytyczna dla uwierzytelniania — po zmianie ZAWSZE pełny
   przebieg klikaczy, ze szczególną uwagą na `e2e/specs/auth.spec.ts`.
2. Nagłówek w wariancie TYLKO-ZGŁASZAJ (`Content-Security-Policy-Report-Only`) + punkt końcowy
   zbierający zgłoszenia. Punkt końcowy działa BEZ sesji (przeglądarka wysyła zgłoszenia bez
   uwierzytelnienia), więc MUSI mieć ograniczenie liczby żądań — użyj `platform/rateLimit`,
   wzorzec: polityka `kalendarz.feed` dodana w tej samej sesji. Ogranicz też rozmiar ciała żądania
   i liczbę odrębnych wpisów. Zgłoszenia zapisuj zagregowane (dyrektywa + zasób + licznik), bo
   inaczej jeden błędny zasób zapełni tabelę.
3. Po kilku dniach zbierania: domknięcie listy wyjątków NA PODSTAWIE ZEBRANYCH DANYCH (nie domysłu)
   i włączenie trybu blokującego — osobnym wdrożeniem.

Właściciel w etapie 2 ma tylko normalnie korzystać z aplikacji — poproś go, żeby zajrzał do
Pogody z mapą, skanowania kodów i lektora, bo to one dołożą najwięcej wyjątków.

═══ ZADANIE 2: sprawdzić lektora po resecie kredytów ═══

W tej sesji poprawiono rozpoznawanie powodu odmowy: część dostawców (m.in. ElevenLabs) zwraca 401
przy WYCZERPANYCH KREDYTACH, a powód podaje dopiero w treści odpowiedzi — kod czytał sam status
i mówił „odrzucony klucz". Właściciel przez to dwa razy wygenerował nowy klucz na darmo.
Teraz powód jest czytany z treści (`powodZOdpowiedzi` w `src/lib/tts/serverTts.ts`, 9 testów).
Poproś właściciela, żeby sprawdził lektora — powinien zobaczyć komunikat o wyczerpanym limicie,
a po odnowieniu kredytów lektor ma po prostu działać.

═══ ZADANIE 3 (do decyzji właściciela): odłożone ═══

• Punkt 6 planu — osobna zmienna `CONFIG_SECRET` na klucz szyfrujący sekrety. ŚWIADOMIE odłożony.
  UWAGA: samo dopisanie tej zmiennej unieważni wszystkie zaszyfrowane klucze API (zapisane jednym
  kluczem, odczytywane innym). Bezpieczna kolejność kroków jest w raporcie planu, rozdział 6.
  Zapytaj właściciela, czy chce to teraz robić — nie rób tego z własnej inicjatywy.
• Przejście na Next 16. Zamknęłoby 7 pozostałych podatności (0 krytycznych, 6 wysokich, 1 niska)
  — wszystkie wiszą na tym jednym łańcuchu. To zmiana łamiąca w silniku aplikacji: osobne zadanie
  z własnym planem, nie punkt listy bezpieczeństwa.

═══ ZASADY PRACY ═══

Konwencje: `CLAUDE.md` i `.claude/spec-pipeline/constitution.md`. Weryfikacja WYŁĄCZNIE na lokalnym
Postgresie (nigdy przeciw produkcyjnej bazie), pełny `npm run build` przed merge (nie pojedyncze
bramki), praca na gałęzi `claude/*`, merge do `develop`, promocja na `master` fast-forward.
Migracji już zastosowanych nie edytuje się — zmiana treści raportu idzie nową migracją z `UPDATE`.

Gdy skończysz CSP, zaktualizuj rozdział „Stan wykonania" w raporcie planu i WYŁĄCZ ten prompt:
`UPDATE "PromptWznowienia" SET "aktywny" = false WHERE "klucz" = 'bezpieczenstwo-2026-08';`
$tresc$,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("klucz") DO UPDATE SET
  "tytul" = EXCLUDED."tytul",
  "wstep" = EXCLUDED."wstep",
  "tresc" = EXCLUDED."tresc",
  "aktywny" = EXCLUDED."aktywny",
  "updatedAt" = CURRENT_TIMESTAMP;
