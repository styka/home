# Rozdział 32 — Kontakty / CRM

## Kontekst / stan z kodu

- **Rdzeń:** `src/actions/contacts.ts`; model `Contact` (per-user, tagi jako JSON, własność 3-poziomowa).
- **Zakres:** świadomie **lekki, minimalny** CRM (kontakty z tagami) — `dojrzałość 2` w macierzy (Rozdz. 3).

## Mocne strony

- **Prostota** — nie próbuje być Salesforce; spełnia rolę „książki adresowej z tagami”.
- Własność 3-poziomowa (gotowość do współdzielenia w zespole/rodzinie).

## Głos Zespołu A — Strażnicy

**Basia (PO):** „Świadomy minimalizm jest OK — **nie rozbudowujmy na siłę**. CRM rozbudowuje się
*pod konkretną potrzebę* (np. marketplace, branża usługowa), nie »bo wypada«.”

**Anna (security):** „Kontakty = dane osobowe osób trzecich. Eksport/usunięcie (RODO) musi je obejmować;
tagi jako JSON — pilnować, by nie trzymać tam wrażliwych danych bez podstawy.”

## Głos Zespołu B — Pionierzy

**Wojtek (PO):** „Kontakty to **warstwa spajająca**: klient w Usługach, kupujący w sprzedaży zwierząt,
dostawca w Magazynie — to wszystko »kontakty«. Połączmy je: jeden kontakt, wiele ról/relacji. Wtedy CRM
staje się **kręgosłupem B2B**, a nie wyspą.”

**Hubert (AI/ML):** „AI: »ostatnio rozmawiałeś z X miesiąc temu«, wzbogacanie kontaktu, podsumowanie
historii interakcji (z czatu Usług). Tania wartość relacyjna.”

## Punkty sporne

- **Rozbudowa: teraz vs pod potrzebę.** **Konsensus:** rozbudowywać **pod konkretny przypadek** (najpierw
  spięcie z Usługami/sprzedażą), nie spekulacyjnie.

## Głos użytkowników

**Tadeusz (60):** „Jako firma chcę widzieć klientów i historię — najlepiej spiętą z usługami.”

## Konsensus i zalecenia

- **Z-370** *(P1 · S)* — **Objąć Kontakty eksportem/usunięciem RODO** (Z-050/Z-051) — dane osób trzecich.
- **Z-371** *(P2 · M)* — **Spiąć Kontakty z Usługami/sprzedażą** (jeden kontakt, wiele ról) — kręgosłup B2B.
- **Z-372** *(P2 · M)* — **AI relacyjne** (historia interakcji, przypomnienia kontaktu) — pod potrzebę.
- **Z-373** *(P2 · S)* — **Współdzielenie kontaktów w zespole/rodzinie** (wykorzystać własność 3-poziomową).

## Dobre vs złe praktyki

**Dobre:** świadomy minimalizm, własność 3-poziomowa.
**Złe / do poprawy:** wyspowość (niespięty z Usługami/sprzedażą); RODO osób trzecich do potwierdzenia.
