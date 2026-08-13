# Spec: domknięcie zadania 13 — deklaracje zasobów we wszystkich modułach

- **ID:** 064-zadanie-13-domkniecie · **Data:** 2026-08-13

## 1. Problem / potrzeba

Zadanie 13 brzmi „deklaracje `resources` w `module.ts` **wszystkich** modułów" i wygląda na
siedemnaście przebiegów po pilocie (052) i Zwierzętach (060). **Pomiar pokazał co innego.**

Guard rozstrzygający dostęp **do pojedynczego rekordu** ma **sześć** modułów:
Zadania, Zwierzęta, Zakupy, Kuchnia (przepis i książka). Pozostałe piętnaście rozstrzyga dostęp
albo **samym zakresem list** (`ownedWhere` — ujednolicone w 057/058), albo sprawdzeniem
`ownerId === user.id` **bez zespołów i bez udostępnień** (Pogoda, Wiadomości, Portfel…). Tam nie ma
czego przenosić: deklaracja wyrażałaby „tylko właściciel", czyli dokładnie to, co platforma robi
domyślnie, a przybyłoby piętnaście plików bez konsumenta (C-35).

**Zadanie 13 domyka więc trzy guardy, nie siedemnaście modułów** — plus **jawną klasyfikację**
wszystkich modułów, żeby pozycja checklisty dała się zamknąć, a nie została otwarta na zawsze
„bo zostało jeszcze piętnaście".

## 2. Kryteria akceptacji

- [ ] **AC-1** — Given `assertListAccess`, `assertRecipeAccess`, `assertCookbookAccess`, then
      rozstrzyga je platforma na podstawie deklaracji modułu.
- [ ] **AC-2** — Given **przepis publiczny**, then obcy go **czyta**, ale **nie edytuje** —
      tak jak dziś. To jedyny w aplikacji dostęp bez żadnej relacji do zasobu.
- [ ] **AC-3** — Given tabela prawdy, then identyczna z punktem odniesienia **poza komórkami
      z §3a**.
- [ ] **AC-4** — Given każdy z 21 modułów, then ma **jawną klasyfikację** (deklaracja / tylko
      właściciel / sam zakres) z powodem; brak klasyfikacji **wywala build**.
- [ ] **AC-5** — Given komplet bramek i build, then przechodzą; liczniki bez spadku.
- [ ] **AC-6** — Given dziennik, then odnotowane domknięcie zadania 13 i **skorygowana skala**.

## 3a. Świadoma zmiana zachowania — dwie komórki

> **Właściciel zespołu bez wiersza `TeamMember`** zyskuje dostęp do listy zakupów i książki
> kucharskiej należących do jego zespołu.

Trzeci raz ta sama komórka (056 dla Zadań, 060 dla Zwierząt) i ta sama przyczyna: rozstrzyganie
czyta przestrzeń, a lustro z 051 wpisuje właściciela zespołu jako `owner` mimo braku członkostwa.
**Przepis publiczny bez ruchu** — 19 pozostałych komórek identycznych.

## 4. Zakres

**W zakresie:** trzy deklaracje (`shopping.list`, `kitchen.recipe`, `kitchen.cookbook`); pojęcie
zasobu **otwartego** w platformie (`publicRole`); klasyfikacja wszystkich modułów + bramka.

**Poza zakresem:** UI udostępniania (zadanie 14); moduły sklasyfikowane jako „tylko właściciel" —
dostaną deklarację dopiero wtedy, gdy dostaną udostępnianie, i **wtedy** będzie po co.

## 5. Zgodność z konstytucją

**C-17** (tabela prawdy przed przełączeniem, zmiana nazwana z góry), **C-35** (komponent/plik
dowozimy z konsumentem — stąd brak piętnastu pustych deklaracji), **C-36**, **C-50**, **C-53**.
