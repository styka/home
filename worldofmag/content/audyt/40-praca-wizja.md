# Rozdział 40 — Praca / Work (wizja)

## Kontekst / stan z kodu

- **Status:** **stub** — wpis w sidebarze („wkrótce”, wyłączony), brak strony. Pozycja roadmapy
  („Build out the Work / Praca module”).
- Ten rozdział to **debata o wizji**: czym moduł Praca powinien się stać, skoro dziś go nie ma.

## Mocne strony (potencjał)

- **Rdzeń już istnieje** w innych modułach: Zadania (projekty, Kanban, cykliczność), Notatki, Kalendarz,
  Kontakty, Raporty, Portfel. Praca to w dużej mierze **kompozycja** istniejących klocków + nakładka „tryb
  zawodowy”.

## Głos Zespołu A — Strażnicy

**Basia (PO):** „Nie róbmy »Jira killera«. Praca powinna być **cienką nakładką** na Zadania/Czas/
Dokumenty, a nie nowym wielkim modułem. Zdefiniujmy wąsko: **projekty zawodowe, czas pracy, dokumenty,
faktury** — i to spięte z tym, co mamy.”

**Anna (security):** „Praca = dane firmowe i potencjalnie dane klientów → RODO, role granularne (Z-194),
izolacja (Z-190). To wejście w teren B2B z jego wymogami.”

## Głos Zespołu B — Pionierzy

**Wojtek (PO):** „Praca to **brama do monetyzacji B2B**: time-tracking + projekty + faktury (z Portfela)
+ dokumenty (NM4) + zależności zadań (Z-233). To naturalne miejsce na **płatne funkcje zaawansowane**
(zgodnie z wizją właściciela: »płatne w działach pracy/biznesu«).”

**Hubert (AI/ML):** „AI: »ile czasu zeszło na projekt X«, generowanie raportu/faktury, podsumowanie
tygodnia pracy. Tania wartość, która uzasadnia plan premium.”

## Punkty sporne

- **Nowy moduł vs nakładka na Zadania.** **Konsensus:** **nakładka** (tryb „Praca” na projektach zadań +
  warstwa czasu/dokumentów/faktur), nie osobny silnik. Reużycie > duplikacja.

## Głos użytkowników

**Marek (29, freelancer):** „Time-tracking + projekty + faktury w jednym, spięte z resztą — biorę.”
**Tadeusz (60):** „Dla firmy: projekty, koszty, dokumenty i raport do księgowej.”

## Konsensus i zalecenia

- **Z-450** *(P2 · L)* — **Praca jako nakładka na Zadania** (tryb zawodowy: projekty + czas + dokumenty +
  faktury), nie nowy silnik. Reużyć Zadania/Kalendarz/Portfel/Kontakty/Raporty.
- **Z-451** *(P1 · M)* — **Time-tracking** (start/stop, raport czasu per projekt) — rdzeń wartości B2B.
- **Z-452** *(P2 · M)* — **Faktury z czasu/projektu** (spięcie z Portfelem) — płatna funkcja B2B.
- **Z-453** *(P1 · S)* — **Wspólna warstwa dokumentów** (NM4) — konsoliduje załączniki (umowy/faktury).
- **Z-454** *(P2 · S)* — **Do czasu MVP — jasny stan „wkrótce”** zamiast martwego wpisu.

## Dobre vs złe praktyki

**Dobre (potencjał):** rdzeń (zadania/czas/dokumenty/faktury) już rozproszony w systemie — Praca to kompozycja.
**Złe / do poprawy:** dziś martwy stub; ryzyko przerostu (nie budować „Jiry”), trzymać się cienkiej nakładki.
