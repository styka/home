# Dodatek A.4 — Plany wdrożenia: wydajność i skala

Plany realizujące zalecenia z Rozdz. 9.

---

## Plan Z-070 (P0) — Paginacja/keyset dla list ładujących całość

**Cel:** zdjąć liniową degradację i ryzyko OOM/timeoutów przy dużych zbiorach.
**Kroki:**
1. Wytypować akcje `get*` zwracające komplet (zadania, notatki, zakupy, magazyn, usługi).
2. Wprowadzić **keyset pagination** (cursor po `id`/`createdAt` + `take`), nie `OFFSET` (stały koszt przy
   głębokich stronach). Wymaga indeksów (plan Z-030/Z-031).
3. UI: „Załaduj więcej”/strony; zachować filtry/sort.
4. Zacząć od najgorętszych list; reszta przyrostowo.
**Pliki:** `src/actions/*` (sygnatury z `cursor`), komponenty `*Page.tsx`.
**Kryteria:** lista pobiera stronę, nie całość; przewijanie doczytuje; brak regresji filtrów.
**Ryzyka:** zależność od indeksów — najpierw Z-030.

---

## Plan Z-071 (P1) — Wirtualizacja długich list

**Cel:** płynne renderowanie tysięcy wierszy.
**Kroki:** dla list o dużym potencjale (zadania, magazyn, kontakty) użyć wirtualizacji
(`@tanstack/virtual`); renderować tylko widoczne wiersze; spiąć z paginacją (doczytywanie przy dojściu
do końca).
**Kryteria:** lista 5k+ pozycji renderuje płynnie; DOM ograniczony do okna widoku.

---

## Plan Z-072 (P1) — Cache najgorętszych odczytów

**Cel:** odciążyć bazę z powtarzalnych, ciężkich odczytów (pulpit Home, agregat kalendarza).
**Kroki:** owinąć agregaty w `unstable_cache`/warstwę KV z krótkim TTL (30–60 s) i tagami; inwalidować
przy mutacji powiązanych danych (spójnie z `revalidatePath`/`revalidateTag`). Przy skali — zewnętrzny KV
(Redis).
**Pliki:** `src/lib/calendar.ts`, akcje pulpitu, komponenty Home.
**Kryteria:** powtórne wejście na pulpit nie odpytuje bazy w obrębie TTL; dane świeże po mutacji.

---

## Plan Z-073 (P1) — Eliminacja N+1 w agregatorach

**Cel:** jedno-/kilku-zapytaniowe agregaty zamiast pętli.
**Kroki:** przejrzeć `calendar.ts`, `TodaySnapshot`, agregaty Home pod kątem pętli zapytań; zamienić na
`include`/`select`/`Promise.all` zbiorcze; zmierzyć `EXPLAIN` (plan Z-037).
**Kryteria:** brak zapytań w pętli na ścieżkach agregujących.

---

## Plan Z-074 / Z-131 (P1) — Trwała kolejka dla ciężkich operacji AI

**Cel:** ciężkie zadania (OCR, plan tygodnia, eksport RODO) poza żądaniem.
**Kroki:** model `Job { id, type, status, payload, result, ownerId, createdAt }`; akcja kolejkująca;
**worker** (np. endpoint wyzwalany cronem hostingu lub lekki long-poll) przetwarzający `PENDING`; UI ze
statusem zadania. Idempotencja po `type+payloadHash`.
**Pliki:** nowy `src/actions/jobs.ts`, model w `schema.prisma` + migracja, worker (`/api/jobs/run`).
**Kryteria:** OCR/plan tygodnia nie blokują żądania; status widoczny; ponowienie bezpieczne.
**Ryzyka:** brak natywnego crona na free tier → użyć wyzwalacza zewnętrznego/scheduled job hostingu.

---

## Plan Z-075 / Z-094 (P0/P1) — Wyjść z usypiającego free tier

**Cel:** zlikwidować zimny start (~15 s) przed marketingiem.
**Kroki:** przełączyć Render na plan bez usypiania; zweryfikować TTFB; (opcj.) keep-alive ping.
**Kryteria:** brak zimnego startu na pierwszym wejściu; TTFB w normie.
**Uwaga:** **decyzja kosztowa właściciela** — oznaczyć, jeśli odłożona.

---

## Pozostałe (skrót)

- **Z-076 (P2)** — CDN/edge dla statyki i ikon + nagłówki cache.
- **Z-082 (P1)** — progowy plan skalowania (50→100M): tabela „co włączamy na którym progu” (hosting,
  pooling, repliki, kolejka, CDN, KV) — spiąć z Rozdz. 44.
- **Z-083 (P2)** — budżety wydajności (TTFB, rozmiar payloadu list) mierzone w CI/monitoringu.

**Kolejność:** Z-030 (warunek) → Z-070 → Z-073 → Z-072 → Z-074 → Z-075 → reszta.
