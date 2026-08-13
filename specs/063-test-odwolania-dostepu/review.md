# Recenzja: odwołanie dostępu — zadanie 17

## Ustalenia

### 1. Test, który dziś nie może być czerwony — i to jest jego sens
**process** · **odnotowane**

Cache jest per żądanie, więc AC-1 przechodzi z definicji. Pokusa: „skoro nie może paść, po co go
pisać". Odpowiedź jest w rozdz. 12.2 — zadanie 29 wprowadzi cache międzyżądaniowy i **wtedy** ten
test zacznie mieć zęby. Napisany po tamtej zmianie opisywałby jej zachowanie; napisany teraz jest
wymaganiem, które tamta zmiana musi spełnić.

Warto to zapisać, bo ten sam wzorzec wróci przy zadaniach 26 (rate-limit) i 29.

### 2. Asercja o dacie ważności bez kontroli mocy byłaby pusta
**correctness (test)** · **zaadresowane od razu**

„Nadanie z minioną datą nie daje nic" jest zielone także wtedy, gdy odmowa bierze się z literówki
w typie zasobu albo z niewpiętej deklaracji. Para z przypadkiem „data przyszła → dozwolone"
zamienia to w zdanie o dacie. To trzeci raz w tej sesji, gdy dowód wymagał sprawdzenia **własnej
mocy** — po 056 (fixture bez przestrzeni) i 058 (gałąź awaryjna unieważniająca porównanie).

## Werdykt

**APPROVE.** Test mały, ale zamyka pozycję checklisty i zostawia zapisany warunek dla Fazy 5.
