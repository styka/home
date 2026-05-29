-- Raport implementacji (naprawa kopiowania do schowka na mobile) → /admin/reports oraz /reports.
-- Slug odrębny od 0034/0035 (omnia-implementacja-2026-05-29[...] już zajęte), bo INSERT używa
-- ON CONFLICT (slug) DO NOTHING — ten sam slug zostałby cicho pominięty.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-05-29 (kopiowanie na mobile)',
  'omnia-implementacja-2026-05-29-clipboard-mobile',
  $omnia_clipboard_mobile$# Omnia — Raport implementacji 2026-05-29 (kopiowanie na mobile)

Sesja realizująca 1 zgłoszenie administratora: naprawa kopiowania do schowka na urządzeniach
mobilnych. Zmiana wyłącznie po stronie kodu (bez zmian schematu danych).

---

## Błąd kopiowania na Mobile
**Diagnoza:** Przycisk „Kopiuj prompt dla Claude Code" w panelu admina (`OmniaClipboardButton`)
wołał `navigator.clipboard.writeText()` dopiero PO `await getOmniaTasksForClipboard()` (server
action pobierający listę zadań). Na iOS Safari po `await` przeglądarka traci „transient activation"
pochodzącą z gestu kliknięcia i blokuje zapis do schowka → `NotAllowedError`. Na desktopie ten sam
kod działał, bo tam ograniczenie aktywacji jest łagodniejsze — stąd objaw „działa na komputerze,
błąd na mobile".
**Rozwiązanie:** Zapis startuje teraz synchronicznie w obrębie gestu przez
`navigator.clipboard.write` z `ClipboardItem`, któremu standard pozwala podać `Promise<Blob>` —
przeglądarka czeka na tekst nie tracąc aktywacji użytkownika. To jedyny niezawodny sposób na
skopiowanie danych, które trzeba najpierw asynchronicznie pobrać, na iOS. Dodano fallback na
`writeText` (desktop/Android, gdzie problem nie występuje) oraz na textarea + `execCommand` dla
najstarszych przeglądarek bez wsparcia Promise w `ClipboardItem`. Wynik producenta tekstu jest
cache'owany, więc ewentualny fallback nie pobiera zadań po raz drugi, a wykrywanie „brak otwartych
zadań" zachowano przez sygnał w domknięciu (niezależny od tego, jak przeglądarka opakuje błąd).
**Zmienione pliki:**
- `src/components/admin/OmniaClipboardButton.tsx` — kopiowanie odporne na utratę aktywacji na iOS
  (ClipboardItem + Promise, z fallbackami) oraz zachowane stany UI (loading/copied/empty/error).
- `doświadczenia.md` — lekcja o `clipboard.writeText` po `await` na iOS.

## Podsumowanie
Jedno zgłoszenie, naprawa po stronie front-endu (komponent klienta w panelu admina), bez zmian
schematu DB ani Server Actions. Główny obszar: panel admina / integracja ze schowkiem przeglądarki.
Kluczowa lekcja: na iOS Safari nie wolno wołać `clipboard.writeText` po `await` — tekst wymagający
async pobrania należy przekazać jako `Promise` do `ClipboardItem`. Weryfikacja: `tsc --noEmit` oraz
`next build` — kompilacja czysta. Raport zapisany przez migrację (jak pozostałe raporty w projekcie),
więc trafia do `/reports` na deployu.
$omnia_clipboard_mobile$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
