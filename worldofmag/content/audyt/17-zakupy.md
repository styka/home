# Rozdział 17 — Zakupy (Shopping)

## Kontekst / stan z kodu

Najstarszy, najbardziej dopracowany moduł — „flagowiec” UX.

- **Listy i pozycje:** `src/actions/items.ts`, `lists.ts`, `products.ts`, `categories.ts`, `units.ts`;
  modele `ShoppingList`, `Item`, `ItemHistory`, `Product`, `Category`, `Unit`.
- **Inteligentne parsowanie:** `src/lib/parseQuantity.ts` („2 butelki mleka”, „mleko 500ml”, „mleko x2”).
- **Mapy sklepów:** `Store`/`StoreNode`/`StoreEdge` (graf), `src/lib/storeLayout.ts` + `storeRoute.ts`
  (optymalna trasa po sklepie). Edytor grafu w `src/components/shopping/`.
- **Ceny + księgowanie:** `Item.price`; „Zakończ zakupy” księguje sumę w Portfelu (auto-wydatki).
- **Słowniki 3-poziomowe:** kategorie/jednostki/produkty (system/user/team).

## Mocne strony

- **Parsowanie ilości** i kategoryzacja regułowa (`categorize.ts`, ~500 słów) — działa bez LLM.
- **Mapy sklepów z trasowaniem** — wyróżnik, którego nie ma konkurencja listowa.
- **Spięcie z Portfelem** (ceny → wydatek) — realna wartość „przy okazji”.

## Głos Zespołu A — Strażnicy

**Joanna (UX):** „To jest świetne, ale ma dług z czasów początków: **tworzenie listy przez `prompt()`**
(pozycja z roadmapy) — to relikt, brzydki i niedostępny. Zamieńmy na modal (prymityw z planu Z-110).”

**dr inż. Tomasz (architekt):** „Mapy sklepów to złożoność (graf + trasowanie). Trzeba pilnować, by nie
przerosła wartości — większość użytkowników nie zrobi własnej mapy. **Szablony sieci handlowych** (S5)
obniżyłyby próg wejścia.”

## Głos Zespołu B — Pionierzy

**Ola (UX):** „Dodajmy **drag-and-drop** kolejności pozycji (S1, `Item.order` + HTML5 DnD jak w Kanbanie
zadań) — to najczęstsza prośba. I **współdzielony koszyk na żywo** dla rodziny (S4) — »mąż dorzuca w
sklepie«. To killer dla persony rodzinnej.”

**Hubert (AI/ML):** „»Dodaj składniki przepisu do listy« już mamy w Kuchni — rozwińmy: AI sugeruje
brakujące produkty na podstawie historii i spiżarni. »Zbuduj listę na tydzień« jednym poleceniem.”

## Punkty sporne

- **Realtime koszyk (S4): teraz vs później.** Strażnicy: realtime na free tier jest drogi/kruchy →
  **polling** zamiast websocketów. Pionierzy: dla rodziny warto. **Konsensus:** polling (jak
  `DataFreshness`), nie websockety, na tym etapie.

## Głos użytkowników

**Agnieszka (38):** „Wspólna lista z mężem na żywo to dla mnie podstawa.” → S4 (choćby przez polling).
**Helena (68):** „Chcę po prostu dopisać »mleko« i nie walczyć z okienkiem.” → modal zamiast `prompt()`.

## Konsensus i zalecenia

- **Z-220** *(P1 · S)* — **Zamienić `prompt()` tworzenia listy na modal** (prymityw Z-110); a11y + spójność.
- **Z-221** *(P1 · S)* — **Drag-and-drop kolejności pozycji** (`Item.order` + reorder) — najczęstsza prośba.
- **Z-222** *(P2 · M)* — **Współdzielony koszyk „na żywo” przez polling** (nie websockety) dla list rodziny.
- **Z-223** *(P2 · M)* — **Szablony map sieci handlowych** (S5) — obniżenie progu wejścia w mapy sklepów.
- **Z-224** *(P2 · S)* — **„Zarchiwizuj/zamknij listę”** (roadmap „complete shopping”) jako pełny cykl życia.
- **Z-225** *(P2 · M)* — **AI: sugestie brakujących produktów** (historia + spiżarnia) i „lista na tydzień”.

## Dobre vs złe praktyki

**Dobre:** parsowanie ilości, kategoryzacja bez LLM, mapy z trasowaniem, spięcie z Portfelem.
**Złe / do poprawy:** `prompt()` przy tworzeniu listy; brak DnD; brak współdzielenia na żywo; mapy bez
szablonów (wysoki próg wejścia).
