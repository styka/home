# Rozdział 26 — Języki (Languages)

## Kontekst / stan z kodu

- **Rdzeń:** `src/actions/languageDecks.ts`; modele `LanguageDeck`, `Vocabulary`.
- **Algorytm:** **SRS SuperMemo-2** (`src/lib/srs.ts`, testowany) — fiszki z interwałami powtórek.
- **Funkcje:** TTS/wymowa (`src/lib/tts.ts`, Web Speech), tryb pisania, serie nauki; powtórki wpięte w
  kalendarz (`Vocabulary.dueAt`).

## Mocne strony

- **SuperMemo-2 + TTS + tryb pisania** — kompletny, samowystarczalny moduł nauki (poziom Anki).
- **Logika SRS pokryta testami** — solidna podstawa.
- Integracja z kalendarzem (powtórki jako wydarzenia).

## Głos Zespołu A — Strażnicy

**Ewa (QA):** „SRS jest testowany — dobrze. Warto dodać przypadki brzegowe (reset serii, długie przerwy)
i **przypomnienia o powtórkach** (L5) — silnik jest, brakuje podpięcia.”

## Głos Zespołu B — Pionierzy

**Hubert (AI/ML):** „To **żyła złota dla AI**: generowanie fiszek z tekstu/obrazu (mamy `extract`),
przykładowe zdania, korekta wymowy, »rozmowa« z AI w obcym języku. Tania głębia — i naturalna oś premium
(więcej generacji = plan płatny).”

**Nina (growth):** „Nauka języków ma **ogromny rynek i społeczności** — to potencjalny samodzielny
kanał akwizycji (treści SEO »fiszki do…«).”

## Punkty sporne

- **Konkurencja z Duolingo/Anki.** **Konsensus:** nie konkurować frontalnie — **przewaga = część
  ekosystemu »wszystko w jednym« + AI-generowanie**; nie budować osobnej gry.

## Głos użytkowników

**Zofia (16):** „Generowanie fiszek z AI i rozmowa po angielsku — to bym używała codziennie.”

## Konsensus i zalecenia

- **Z-310** *(P1 · S)* — **Przypomnienia o powtórkach SRS** (L5): podpiąć `Vocabulary.dueAt` do
  powiadomień (Rozdz. 34).
- **Z-311** *(P2 · M)* — **AI: generowanie fiszek + przykłady + »rozmowa«** — głębia i oś premium (limit AI).
- **Z-312** *(P1 · S)* — **Testy brzegowe SRS** (reset serii, długie przerwy).
- **Z-313** *(P2 · M)* — **Treści SEO »fiszki do…«** jako kanał akwizycji (pętla treści, Z-531).

## Dobre vs złe praktyki

**Dobre:** SuperMemo-2 testowany, TTS, tryb pisania, integracja z kalendarzem.
**Złe / do poprawy:** brak przypomnień o powtórkach; niewykorzystany potencjał AI-generowania i SEO.
