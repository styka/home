# Zadania: Asystent-kompan — rozmowa, dopracowany głos, czysty composer

- **Plan:** ./plan.md (006-assistant-companion-voice-polish)
- **Status:** done
- **Data:** 2026-07-16

> **Zasada listy:** od najłatwiejszego do najtrudniejszego, zgodnie z zależnościami. Feature jest
> **czysto kliencki + prompt** — brak migracji, Server Actions, RBAC i nowej `AIAction` (plan §2–§6).
> Fazy danych/serwera/AI-akcji **odpadają świadomie** (C-53).

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne od poprzedniego, można robić równolegle

## Faza 0 — Dane / schemat
- [x] **T-0** — **Brak zmian w schemacie** (potwierdzenie): żadnej migracji ani edycji `schema.prisma`;
  rozmowa zapisuje się istniejącym `persist`→`AiMessage`. *Gotowe, gdy:* `npm run check:migrations`
  przechodzi bez nowych wpisów.

## Faza 1 — Współdzielony helper (reuse)
- [x] **T-1** `[P]` — Wyjmij detekcję akcji niszczących: przenieś `DESTRUCTIVE_TYPES` z
  `components/home/ActionDrawer.tsx` do współdzielonego `lib/ai/aiAction.ts` jako
  `isDestructiveAction(action)` (+ set typów); zaimportuj w `ActionDrawer` (bez zmiany zachowania).
  *Gotowe, gdy:* `ActionDrawer` używa helpera, `tsc`/`next build` czyste, drawer działa jak dotąd.
  **(fundament AC-9)**

## Faza 2 — Asystent-kompan (prompt agenta) — obszar 1
- [x] **T-2** — `api/llm/home/agent/route.ts`: przeprojektuj system prompt na **kompana** —
  persona (rozmawia naturalnie, dostęp do danych, **domyślnie odpowiada/rozmawia**) + wzmocnione reguły:
  `answer` dla pytań/small-talk/opinii/emocji; `plan` **tylko** przy wyraźnej intencji zmiany; `clarify`
  gdy cel zmiany niejednoznaczny wśród **wielu** kandydatów (lista/projekt/zwierzę); jednoznaczne
  polecenia dalej → `plan` bez zbędnego pytania. Teksty PL. *Gotowe, gdy:* prompt zawiera te reguły,
  build czysty; ręczne scenariusze (patrz T-9) dają oczekiwane kroki. **(AC-1, AC-2, AC-3, AC-4, AC-5)**
- [x] **T-3** `[P]` — `lib/ai/fastPath.ts`: dostrój prompt klasyfikatora, by przy container-scoped
  tworzeniu (np. `tasks:create_task`) zwracał **`complex`**, gdy użytkownik zdaje się chcieć konkretnej,
  lecz **nienazwanej** listy/projektu (oddaj clarify agentowi); jednoznaczne „dodaj X" zostaje „simple".
  *Gotowe, gdy:* zmiana promptu nie psuje prostych dodań (bez regresu), build czysty. **(AC-3, AC-5)**

## Faza 3 — Tryb głosowy: przepływ + karty akcji — obszar 2
> Wszystko w `components/home/AICommandSheet.tsx`; T-4..T-7 sekwencyjnie (ten sam plik).
- [x] **T-4** — **Koniec twardej pauzy na plan.** Usuń stan `review`/auto-otwarcie `ActionDrawer` w
  trybie głosowym. Gdy w trybie głosowym pojawi się tura `plan`: NIE otwieraj drawera, NIE pauzuj;
  zapamiętaj `pendingPlanIdRef`, wypowiedz krótką zapowiedź („Przygotowałem N akcji — są w czacie;
  powiedz „zatwierdź", „odrzuć" albo podaj poprawkę") i wróć do nasłuchu. *Gotowe, gdy:* w trybie
  głosowym plan zostaje kartą w wątku, pętla słucha dalej (bez zasłaniającego drawera). **(AC-7, AC-10 częściowo)**
- [x] **T-5** — **Routing komend głosowych przy aktywnej karcie planu** (`onFinal`): dopasowanie do
  wąskich fraz PL — **potwierdź** („zatwierdź/wykonaj/potwierdzam/zrób to/tak zrób/dobra rób") →
  `handleExecute` na akcjach **nie-niszczących** aktywnej karty (niszczące zostają do dotknięcia;
  Asystent to wypowiada); **odrzuć** („odrzuć/anuluj/nie rób/zostaw to") → oznacz kartę `done`; **inaczej**
  → `handleSend(utterance)` (rozmowa/korekta). Brak aktywnej karty → jak dotąd. *Gotowe, gdy:* komendy
  sterują kartą, korekta/rozmowa przechodzi do agenta, nic niszczącego nie wykona się głosem. **(AC-8, AC-9)**
- [x] **T-6** `[P]` — **`buildHistory()`**: dla tur `plan` wstaw **skrót treści akcji** (np. „(proponowane
  akcje: Dodaj „mleko" do Zakupy; …)") zamiast samego licznika, aby korekta głosem była zrozumiała dla
  agenta. *Gotowe, gdy:* historia niesie treść akcji; korekta „nie, do listy Apteka" daje sensowny replan. **(AC-8)**
- [x] **T-7** — **Nie-zasłaniający wskaźnik trybu głosowego** (AC-10): kompaktowy, subtelnie animowany
  (CSS keyframe, bez bibliotek) element przy przełączniku/nagłówku z krótkim stanem (Słucham/Myślę/Mówię),
  który **nie zakrywa** wątku ani kart akcji; kolory z tokenów CSS. Zastępuje/ulepsza pasek stanu z 005.
  *Gotowe, gdy:* w trybie głosowym widać wskaźnik, a karty akcji pozostają w pełni widoczne/klikalne. **(AC-10)**

## Faza 4 — Karta planu: szybkie akcje w wątku — obszar 2
- [x] **T-8** — W `TurnView` dla `kind==="plan"` dołóż kompaktowy rząd **„Zatwierdź / Popraw / Odrzuć"**
  obok istniejącego „Przejrzyj i wykonaj": „Zatwierdź" → wykonaj nie-niszczące (reuse ścieżki z T-5);
  „Popraw" → `handleRefine`; „Odrzuć" → zamknij kartę. Działa w trybie pisanym i głosowym; „Przejrzyj i
  wykonaj" (pełny `ActionDrawer` z destructive opt-in) bez zmian. Tokeny CSS, PL. *Gotowe, gdy:* kartę
  planu da się potwierdzić/odrzucić/poprawić bez otwierania drawera, a drawer dalej działa. **(AC-7, AC-9)**

## Faza 5 — Redesign composera (mobile-first) — obszar 3
- [x] **T-9** — Przeprojektuj composer w `AICommandSheet.tsx`: układ `[ „+" popover ] · [ SmartTextarea
  (flex-1, min-w-0) ] · [ przełącznik rozmowy głosowej + wskaźnik ] · [ Wyślij/Stop ]`. „+" grupuje
  drugorzędne akcje (Zdjęcie; opcjonalnie Preferencje) — nic nie znika. Kontrolki `flex-shrink-0`,
  wygodne cele dotyku, wyrównanie do dołu, `env(safe-area-inset-bottom)`, tokeny CSS, PL. Popover
  zamykany Esc/klik poza. *Gotowe, gdy:* na wąskim ekranie pole tekstowe jest wyraźnie szersze, kontrolki
  uporządkowane; desktop spójny; wszystkie funkcje dostępne. **(AC-13, AC-14, AC-15)**

## Faza 6 — Bramki i domknięcie
- [x] **T-10** — Bramki (lokalny Postgres, C-13, **do `next build`**, bez `migrate.js`):
  `npm run check:migrations`, `npm run check:actions`, `npx next lint --dir src`, `npx next build` —
  zielone; potwierdź brak regresu ścieżki pisanej (composer/wysyłka/plan/drawer). *Gotowe, gdy:* build
  przechodzi, lint bez nowych błędów.
- [x] **T-11** — Spójność artefaktów (C-54): jeśli implementacja wymusiła zmianę — zaktualizuj
  `spec.md`/`plan.md`; inaczej potwierdź zgodność i status w `tasks.md`.
- [x] **T-12** — Wpis-lekcja do `doświadczenia.md` **jeśli** był nieoczywisty problem (C-51).

## Mapowanie kryteriów akceptacji → zadania
| AC | Zadanie(a) | Weryfikacja |
|----|-----------|-------------|
| AC-1 (pytanie→rozmowa) | T-2 | scenariusz pisany |
| AC-2 (wyraźne polecenie→plan) | T-2 | scenariusz pisany |
| AC-3 (clarify przy wieloznaczności) | T-2, T-3 | scenariusz „dodaj zadanie" przy wielu listach |
| AC-4 (small-talk→rozmowa) | T-2 | scenariusz pisany |
| AC-5 (brak regresu jednoznacznych) | T-2, T-3 | „dodaj mleko do Zakupy"→plan |
| AC-6 (turn-taking po pauzie) | T-4 | ręcznie (Chrome) |
| AC-7 (akcje jako karty, przepływ) | T-4, T-8 | karta w wątku, brak pauzy |
| AC-8 (korekta głosem) | T-5, T-6 | „nie, do listy Apteka"→replan |
| AC-9 (potwierdzenie, nic samo, niszczące ostrożnie) | T-1, T-5, T-8 | zatwierdź→exec nie-niszczących |
| AC-10 (nie-zasłaniający wskaźnik) | T-4, T-7 | wskaźnik widoczny, karty niezasłonięte |
| AC-11 (zapis jako czat) | T-4 (utrzymanie 005) | tury po ponownym otwarciu |
| AC-12 (degradacja bez wsparcia) | T-4/T-7 (utrzymanie 005) | brak przełącznika bez wsparcia |
| AC-13 (szersze pole mobile) | T-9 | wąski ekran (dev tools) |
| AC-14 (wszystkie funkcje dostępne) | T-9 | „+" popover + reszta |
| AC-15 (desktop spójny) | T-9 | widok desktop |

## Ścieżka krytyczna / zależności
- **T-1** (helper niszczących) — fundament dla T-5/T-8 (szybkie „Zatwierdź").
- **T-2/T-3** (prompt) — niezależne od reszty (`[P]` względem UI), można robić równolegle do Fazy 3.
- **T-4 → T-5 → T-8** — sekwencyjnie (przepływ głosowy → routing komend → szybkie akcje karty). **T-6/T-7** `[P]`.
- **T-9** (composer) — po/obok Fazy 3 (ten sam plik; robić po T-4..T-8, by nie kolidować).
- **T-10** (bramki) po całości; T-11/T-12 domykają.

## Notatki / blokady
- Weryfikacja pętli głosowej i wskaźnika — **ręczna** (Chrome desktop); Web Speech nie działa w headless
  CI. Bramka automatyczna to `next build` + brak regresu ścieżki pisanej. Obszar 1 (kompan) sprawdzalny
  scenariuszami pisanymi.
