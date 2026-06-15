# Rozdział 30 — Warsztaty (Workshops)

## Kontekst / stan z kodu

- **Rdzeń:** `src/actions/warsztat.ts`; modele `WarsztatSettings`, `Workshop`, `WorkshopItem`,
  `WorkshopProject`; statyczny katalog sugestii `src/lib/warsztat/catalog.ts` (profile basic/recommended/
  advanced).
- **Dwa tryby (per-user):**
  - **Dom:** rejestr sprzętu (narzędzia/maszyny/materiały/PPE, kondycja, ilość+min-stock, serwis
    `nextServiceAt`), katalog sugestii „dodaj do wyposażenia”.
  - **Pro:** własność zespołowa, przypisanie narzędzi (kto ma / stanowisko), agenda serwisu+braków
    (`/warsztaty/przeglady`), dziennik projektów.

## Mocne strony

- **Dwa tryby (Dom/Pro)** — jak Magazyn, gotowy wzorzec free→B2B.
- **Katalog sugestii wg profilu** — onboarding „od czego zacząć wyposażenie warsztatu”.
- Agenda serwisu + braków (Pro) — realna wartość operacyjna.

## Głos Zespołu A — Strażnicy

**Grzegorz (delivery):** „Katalog jest **statyczny** (`catalog.ts`) — OK na start, ale przy wielu typach
warsztatów (automotive/stolarka/elektronika…) urośnie. Rozważyć dane/konfigurowalność zamiast kodu.”

## Głos Zespołu B — Pionierzy

**Krzysztof (użytkownik, 52, warsztat):** „Pro z przeglądami narzędzi i magazynem części — to bym kupił.
Dołóżmy **zlecenia/klienci** (kto przyniósł, co naprawić, koszt) — wtedy to pełne narzędzie dla małego
warsztatu.”

**Wojtek (PO):** „Warsztat Pro to **szybka komercjalizacja** (Z-492) i pomost do branży motoryzacyjnej
(spięcie z Flotą).”

## Punkty sporne

- **Zlecenia/klienci: tu vs w Usługach.** **Konsensus:** lekka obsługa zleceń w Warsztacie Pro; pełny
  marketplace zleceń to moduł Usługi (Rozdz. 31) — nie dublować.

## Głos użytkowników

**Krzysztof (52):** „Przeglądy narzędzi + części + proste zlecenia = narzędzie dla mojej firmy.”

## Konsensus i zalecenia

- **Z-350** *(P1 · M)* — **Skomercjalizować Warsztat Pro** (Z-492): bramka planu + pakiet.
- **Z-351** *(P2 · M)* — **Lekkie zlecenia/klienci w Pro** (kto/co/koszt) — bez dublowania marketplace.
- **Z-352** *(P2 · M)* — **Katalog sugestii z danych/konfigurowalny** zamiast statycznego kodu (skala typów).
- **Z-353** *(P2 · S)* — **Spięcie z Magazynem** (części) i Flotą (motoryzacja) — ekosystem B2B.

## Dobre vs złe praktyki

**Dobre:** dwa tryby, katalog sugestii, agenda serwisu/braków.
**Złe / do poprawy:** statyczny katalog (skala typów); brak obsługi zleceń/klientów; Pro niezmonetyzowane.
