# Recenzja: okno konfliktu — zadanie 16

## Ustalenia

### 1. Degradacja poza providerem to jedyne miejsce, gdzie łatwo o cichą utratę pracy
*`ConflictProvider.tsx` (`konfliktPozaPowloka`)* · **correctness** · **zaprojektowane i przetestowane**

`ConfirmProvider` degraduje do `window.confirm` i to jest tam w porządku — użytkownik i tak
odpowiada. Tu **nie ma** natywnego odpowiednika trzech wyjść, więc trzeba było wybrać wartość.
Wybór „nadpisz" byłby najwygodniejszy i **kasowałby cudzą pracę bez pytania** wszędzie, gdzie
komponent trafi bez powłoki.

Wartość wyprowadzona z hooka do osobnej stałej **wyłącznie po to, żeby dała się przetestować**:
hook wywołany poza renderem rzuca `TypeError` na `useContext`, więc test hooka sprawdzałby Reacta,
a nie regułę. To jest ten sam ruch, co `perRequest` w 052 — wyprowadzenie zachowania granicznego
z miejsca, w którego środowisku nie da się go sprawdzić.

### 2. Odrzucona wersja jako wpis kosza, nie nowy byt
*`src/platform/trash/trash.ts`* · **simplification** · **przyjęte**

Kusiło osobne pojęcie „wersji roboczej". Kosz **już** ma retencję, przywracanie i sprzątanie,
a odrzucona wersja nie różni się od usuniętego rekordu niczym, co by je uzasadniało. Jedyne, co
funkcja dokłada, to prefiks tytułu — i to jest istotne, bo bez niego wersja robocza wygląda
w koszu na skasowany zasób. Test pilnuje prefiksu, bo to **cała** wartość tej nakładki.

### 3. Brak widoku różnic — granica postawiona świadomie
**architektura** · **odnotowane**

Rozdz. 8.5.2 wymienia „zobacz różnice" i „scal ręcznie". Oba wymagają wiedzy o **polach modułu**;
okno platformy jej nie ma i mieć nie powinno (C-36). Rozwiązaniem nie jest mapa pól w platformie,
tylko `podsumowanieZmian` przekazywane przez moduł.

Dopóki żaden moduł go nie przekazuje, okno mówi prawdę („ktoś zmienił ten element") zamiast
udawać, że wie więcej. Zgodnie z C-35 pełny widok różnic dowieziemy **z pierwszym konsumentem**,
a nie na zapas.

## Rzeczy sprawdzone

- **Podwójne wywołanie** — druga prośba przed rozstrzygnięciem pierwszej domyka poprzednią
  `"wroc"`, więc `await` w handlerze zapisu nie wisi. Ten sam problem i to samo rozwiązanie,
  co w `ConfirmProvider`.
- **C-30/C-32** — zero hexów, teksty po polsku, `--on-accent` na kolorowym przycisku.
- **Montaż w powłoce** — raz, obok `ConfirmProvider`; moduły tylko otwierają.

## Werdykt

**APPROVE.**
