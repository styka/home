# Dodatek A.8 — Plany wdrożenia: integracje

Plany realizujące zalecenia z Rozdz. 13.

---

## Plan Z-150 (P1) — Eksport agendy jako feed iCal

**Cel:** kalendarz Omnia w telefonie/Google/Apple, bez weryfikacji Google.
**Kroki:** endpoint `/api/calendar/ical?token=…` (token per user, odwoływalny) zwracający `.ics` z
agregatu (`src/lib/calendar.ts`); generować VEVENT z zadań/posiłków/leków/serwisu; UI z linkiem subskrypcji
w `/calendar`/`/settings`.
**Pliki:** `src/app/api/calendar/ical/route.ts`, helper iCal, UI.
**Kryteria:** subskrypcja w Google/Apple pokazuje wydarzenia; token można odwołać.
**Ryzyka:** token w URL = traktować jak sekret (długi, odwoływalny).

---

## Plan Z-151 (P1) — Odczyt Google Calendar do agendy

**Cel:** wydarzenia Google obok danych Omnia w `/calendar`.
**Kroki:** rozszerzyć OAuth o scope `calendar.readonly` (jak Drive — szyfrowane tokeny); klient
pobierający wydarzenia w zakresie miesiąca; scalić w agregacie kalendarza; cache (plan Z-072).
**Kryteria:** wydarzenia Google widoczne w agendzie; odświeżanie tokenów działa.
**Uwaga:** scope wrażliwy — **wymaga konfiguracji ekranu zgody Google**; oznaczyć zależność.

---

## Plan Z-153 (P1) — Import wyciągów bankowych z CSV

**Cel:** wydatki w Portfelu bez open bankingu.
**Kroki:** UI uploadu CSV w `/portfel`; parser + **mapowanie kolumn** (data/kwota/opis) z podglądem;
zapis do `WalletEntry` (idempotencja po hashu wiersza, jak auto-wydatki `sourceModule/sourceId`).
**Kryteria:** import CSV tworzy wpisy; brak duplikatów przy ponownym imporcie.

---

## Pozostałe (skrót)

- **Z-152 (P2·L)** — zapis dwukierunkowy Google Calendar (scope `calendar.events`) z konfliktami — po
  weryfikacji aplikacji przez Google.
- **Z-154 (P2)** — webhooks wychodzące (nowe zlecenie/płatność/przypomnienie) + Zapier/Make.
- **Z-155 (P2·L)** — publiczne API (REST) z kluczami, rate-limitem, podpisami.
- **Z-156 (P1)** — Gmail tylko pod konkretny przypadek (mail→zadanie/notatka), scope minimalny.
- **Z-157 (P1)** — ujednolicić warstwę integracji (timeout/retry/degradacja/szyfrowane tokeny).
- **Z-158 (P2)** — web-push na żywo (uzupełnienie powiadomień, A.12/Rozdz. 34).

**Kolejność:** Z-150 → Z-153 → Z-151 → Z-157 → reszta. (Wszystko z OAuth Google = zależne od konfiguracji
ekranu zgody — oznaczać.)
