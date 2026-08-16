# Plan techniczny: Kanał czasu rzeczywistego

- **Spec:** ./spec.md (072-kanal-sse) · **Data:** 2026-08-15

## 1. Podejście

Trzy warstwy, każda mała: **szyna w procesie** (kto na co nasłuchuje), **trasa strumienia** (SSE za
sesją), **klient** (wznawianie + `router.refresh()`). Worker zdarzeń z 071 dostaje jedną linijkę:
po udanym dostarczeniu **rozgłasza** zdarzenie na szynę.

Bez zmian w schemacie i bez migracji.

## 2. `src/platform/events/bus.ts` — szyna w procesie

```ts
type Sluchacz = (kanal: string, dane: { type: string; workspaceId: string }) => void;
export function subskrybuj(kanaly: string[], s: Sluchacz): () => void;   // zwraca odsubskrybowanie
export function rozglos(kanaly: string[], dane): void;
```

Zwykła mapa `kanał → Set<słuchacz>`, guard singletona jak w workerach (przeładowanie modułów w dev).
**Odsubskrybowanie zwracane z `subskrybuj`** — bez tego każda zamknięta karta zostawia słuchacza
i po dobie serwer rozgłasza do martwych połączeń.

**Ograniczenie nazwane w kodzie:** szyna żyje w **jednym procesie**. Przy wielu instancjach karta
dostaje sygnał tylko ze swojej — dlatego 5-minutowa siatka z §5 zostaje na stałe, a nie „na razie".

## 3. `src/app/api/events/route.ts` — strumień

`runtime = "nodejs"`, `dynamic = "force-dynamic"`. Sesja przez `auth()`; brak → **401**.

**Kanały liczone na serwerze z kontekstu dostępu** (`getAccessContext`): `user:<id>` plus
`ws:<id>` dla każdej przestrzeni użytkownika. **Nigdy z parametru żądania** — inaczej wpisanie
cudzego identyfikatora byłoby podsłuchem (C-21).

`ReadableStream` z:
- komentarzem otwierającym (`:ok`) — część proxy trzyma odpowiedź w buforze do pierwszego bajtu;
- **pulsem co 25 s** (`: puls`) — proxy i Render zamykają bezczynne połączenia;
- `cancel()` → odsubskrybowanie i zatrzymanie pulsu.

Ładunek celowo **ubogi**: `{ type, workspaceId }`. Klient ma się odświeżyć, a nie renderować
z ładunku — dane zawsze przychodzą z serwera przez `router.refresh()`. To zamyka drogę do wycieku
treści cudzego zasobu kanałem.

## 4. Publikacja z workera (071)

W `dispatch.ts`, po oznaczeniu dostarczenia: `rozglos(["ws:"+workspaceId, ...], {type, workspaceId})`.
**Po sukcesie, nie przed** — z tego samego powodu co `deliveredAt`.

## 5. Klient — `src/components/shell/DataFreshness.tsx` (zadanie 24)

| Było | Jest |
|---|---|
| `setInterval` **45 s** | `EventSource` na `/api/events` |
| — | awaryjne odpytywanie **5 min** (rozdz. 11.1.4) |
| `visibilitychange`/`focus`/`pageshow` | **zostaje** — tanie i ratuje po zerwanym strumieniu |
| `MIN_GAP_MS` 3 s | zostaje |

**Awaryjne 5 minut zostaje NA STAŁE**, nie „dopóki SSE nie działa". Pokrywa trzy rzeczy naraz:
brak `EventSource`, zerwany strumień i **wiele instancji** (§2).

Wznawianie: `EventSource` wznawia sam, ale przy trwałej awarii (401, brak trasy) robi to w kółko —
więc po kilku nieudanych próbach **zamykamy** i zostajemy na odpytywaniu. Odstęp narastający.

## 6. Bramka `scripts/check-realtime.js`

1. **Trasa strumienia nie czyta kanałów z żądania** — `req.nextUrl.searchParams`/`params` w pliku
   trasy = błąd. To jest niezmiennik bezpieczeństwa, nie styl.
2. **Trasa ma sesję** — `auth()` obecne.
3. **`DataFreshness` nie odpytuje częściej niż co 5 minut** — wyłuskany literał interwału musi być
   ≥ 300000. Bez tego ktoś „na chwilę" zejdzie z powrotem do 45 s i nikt nie zauważy.
4. **Szyna zwraca odsubskrybowanie** — `subskrybuj` musi zwracać funkcję.

Sonda negatywna osobno dla każdej.

## 7. Testy

`bus.test.ts` (bez bazy): rozgłoszenie trafia do właściwego kanału · **nie trafia do cudzego** ·
odsubskrybowanie realnie usuwa słuchacza (drugie rozgłoszenie go nie budzi) · dwóch słuchaczy tego
samego kanału dostaje obaj.

Trasy SSE nie testujemy integracyjnie — wymagałaby sesji i strumienia, a repo nie ma na to wzorca
(ta sama granica co w 071). Niezmienniki trasy pilnuje bramka; to jest zapisane, nie przemilczane.

## 8. Pliki

`platform/events/bus.ts` + test · `app/api/events/route.ts` · `platform/events/dispatch.ts` (edycja)
· `components/shell/DataFreshness.tsx` (edycja) · `scripts/check-realtime.js` + `package.json` ·
`docs/devops/kanal-czasu-rzeczywistego.md` · dziennik + `doświadczenia.md`.

## 9. Ryzyka i wycofanie

- **Wyciek słuchaczy** → `cancel()` + test odsubskrybowania.
- **Proxy tnie strumień** → puls 25 s + siatka 5 min.
- **Wiele instancji** → nazwane, siatka 5 min pokrywa.
- **Rollback:** usunięcie `EventSource` z klienta wraca do odpytywania; trasa może zostać nieużywana.

## 10. Konstytucja

C-13 ✅ · C-21 ✅ (kanały z sesji — pilnuje bramka) · C-30..C-32 ✅ (bez UI, teksty PL) ·
C-35 ✅ (kanał + konsument w jednym przebiegu) · C-36 ✅ (szyna w platformie, nie zna modułów) ·
C-50/C-51 ✅ · C-53 ✅ (zero zależności).
