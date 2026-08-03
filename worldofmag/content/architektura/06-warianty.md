# Rozważone warianty — dlaczego modularny monolit

> Ten rozdział istnieje po to, żeby decyzja dała się **obronić i zakwestionować**. Każdy wariant ma
> uczciwie wypisane zalety, nie tylko wady — inaczej byłby to nie wybór, tylko uzasadnianie z góry
> podjętej tezy.

## Kryteria oceny

| # | Kryterium | Dlaczego to kryterium |
|---|-----------|------------------------|
| K1 | **Integracja międzymodułowa** | To jest produkt: „wszystko, czego użytkownik potrzebuje w życiu" |
| K2 | **Koszt dodania modułu nr 22** | Główna zgłoszona bolączka |
| K3 | **Współdzielenie i współpraca** | Prawie każdy zasób ma się dać udostępnić (korekta z rozdz. 4) |
| K4 | **Zdolność do 100 tys. / milionów** | Wymaganie właściciela |
| K5 | **Koszt wdrożenia** | Zespół = 1 osoba + Claude Code, okno = kilka dni |
| K6 | **Odwracalność** | Zła decyzja architektoniczna kosztuje miesiące |

---

## A — status quo („naprawiamy tylko P0")

**Zalety, uczciwie.** Najtańszy. Zerowe ryzyko regresji. Domyka wszystko, co blokuje ruch. **Gdyby
jedynym celem było „wytrzymać 100 tys. użytkowników", ten wariant by wystarczył.**

**Dlaczego odrzucony.** Nie adresuje K1, K2 ani K3 — a to one były pytaniem właściciela. Koszt
dodania modułu rośnie dalej, współdzielenie zostaje w pięciu niespójnych mechanizmach. Za dwa lata
ta sama decyzja wraca, przy 40 modułach i żywym ruchu, czyli **wielokrotnie drożej**.

| K1 | K2 | K3 | K4 | K5 | K6 |
|----|----|----|----|----|----|
| ❌ | ❌ | ❌ | ✅ | ✅✅ | ✅ |

---

## B — modularny monolit z twardymi granicami ⭐ **WYBRANY**

**Na czym polega.** Jedno wdrożenie, jedna baza, jeden proces budowania — ale moduły przestają być
katalogami i stają się jednostkami z **kontraktem**, **zdarzeniami** i **jedną deklaracją
rejestrującą**. Współdzielenie i kontrola współbieżności stają się **zdolnościami platformy**,
wspólnymi dla wszystkich modułów.

**Zalety.** Adresuje K1, K2 i K3 wprost. Zachowuje tanie wywołania funkcji między modułami — co przy
sprawdzaniu uprawnień do współdzielonego zasobu jest kluczowe (musi być natychmiastowe i tanie).
Koszt wdrożenia to głównie przenoszenie plików (K5) — idealne pod okno zamrożenia. **W pełni
odwracalny** (K6): gdyby granice okazały się przeszkodą, wystarczy usunąć regułę lintu.

**Wady, uczciwie.** Ogromny diff (setki plików). Wymaga dyscypliny — **granica bez egzekwowania
lintem eroduje w tygodnie**. Nie rozwiązuje sam z siebie problemów skali; te są osobną warstwą.

| K1 | K2 | K3 | K4 | K5 | K6 |
|----|----|----|----|----|----|
| ✅✅ | ✅✅ | ✅✅ | ✅ | ✅ | ✅✅ |

---

## C — mikroserwisy

**Zalety, uczciwie.** Niezależne wdrażanie i skalowanie. Awaria jednego modułu nie kładzie reszty.
Różne technologie per moduł. **Przy zespole 50 osób i module o dziesięciokrotnie większym ruchu niż
reszta byłby to sensowny wybór.**

**Dlaczego odrzucony — stanowczo.**

1. **Zabija K1, czyli produkt.** Kalendarz agreguje sześć modułów, asystent AI czyta wszystkie.
   Po rozbiciu każde takie zapytanie staje się serią wywołań sieciowych — wolniejszych o rzędy
   wielkości, zawodnych i wymagających obsługi częściowej awarii („kalendarz działa, ale bez
   zwierząt").
2. **Zabija K3 — i to jest argument, który po korekcie o współdzieleniu stał się mocniejszy.**
   Sprawdzenie „czy użytkownik X może edytować zasób Y" musi być **spójne, natychmiastowe i tanie**.
   Rozproszone po 21 usługach staje się albo wolne (wywołanie sieciowe przy każdym sprawdzeniu),
   albo niespójne (replikacja ACL). Obie opcje są złe.
3. **Dane są w jednej bazie z kluczami obcymi** — 147 modeli splecionych relacjami. Rozbicie oznacza
   albo współdzieloną bazę (mikroserwisy tylko z nazwy), albo rozproszone transakcje.
4. **Zespół to jedna osoba plus Claude Code.** Mikroserwisy to koszt organizacyjny płacony przez
   zespoły, których wąskim gardłem jest komunikacja **między ludźmi**. Tego problemu tu nie ma,
   a płacić trzeba by pełną cenę: 21 potoków wdrożeniowych, 21 zestawów sekretów, 21 miejsc na logi.
5. **Nieodwracalny w praktyce** (K6).

| K1 | K2 | K3 | K4 | K5 | K6 |
|----|----|----|----|----|----|
| ❌❌ | 🟡 | ❌❌ | ✅✅ | ❌❌ | ❌❌ |

---

## D — event sourcing jako model danych

**Zalety, uczciwie.** Pełna historia „kto, co i kiedy zmienił" za darmo. Cofanie dowolnej zmiany.
Nowe widoki bez migracji (nowa projekcja z tego samego dziennika). Audyt idealny. **To są realne
zalety i nie udaję, że ich nie ma** — zwłaszcza przy współdzieleniu, gdzie „kto to zmienił" jest
pytaniem, które padnie.

**Dlaczego odrzucony.**

1. **Żaden z trzech kształtów współbieżności (rozdz. 4.2) go nie wymaga.** Kolekcje rozwiązuje baza,
   pola skalarne — wersjonowanie, wspólny tekst — CRDT. Event sourcing nie jest odpowiedzią na
   **żaden** z nich; jest odpowiedzią na potrzebę audytu i odtwarzalności.
2. **147 modeli i 223 migracje to zbyt duża inwestycja**, żeby ją unieważnić bez zysku dającego się
   nazwać liczbą.
3. **Każda z 545 akcji do przepisania**, plus wszystkie zapytania i cały model uprawnień, który dziś
   opiera się na `where: { ownerId }`, a w świecie projekcji musiałby powstać od nowa w każdej
   projekcji osobno.
4. **Wprowadza spójność ostateczną tam, gdzie dziś jest natychmiastowa** — użytkownik zapisuje
   notatkę i nie widzi jej od razu. Regres UX za cenę miesięcy pracy.

**Ale jeden element bierzemy: outbox.** To **nie jest** event sourcing:

| | Event sourcing | Outbox (nasz wybór) |
|---|---|---|
| Gdzie jest prawda | w dzienniku zdarzeń | **w tabelach, jak dziś** |
| Po co zdarzenia | do odtworzenia stanu | **do powiadomienia, że stan się zmienił** |
| Usunięcie zdarzeń | utrata danych | **nic — to tylko komunikaty** |
| Koszt | miesiące | dni |

**Potrzeba audytu zmian** (kto zmienił zadanie w udostępnionym projekcie) jest realna i zostaje
zaspokojona taniej — dziennikiem zmian dla wskazanych encji (rozdz. 8.7), nie przebudową modelu.

| K1 | K2 | K3 | K4 | K5 | K6 |
|----|----|----|----|----|----|
| 🟡 | 🟡 | 🟡 | ✅ | ❌❌ | ❌❌ |

---

## E — CRDT dla całej aplikacji

**Zalety, uczciwie.** Działa offline. Automatycznie łączy równoległe zmiany. Znosi całą klasę
konfliktów. Efekt „wow".

**Dlaczego odrzucony w tej formie — ale przyjęty warunkowo.**

Rozdział 4.2 pokazuje, że CRDT odpowiada na **kształt C**, czyli ~1 % operacji: wspólny tekst
edytowany jednocześnie. Zastosowanie go do wszystkich 147 modeli oznaczałoby zapłacenie stukrotnie
za rozwiązanie problemu, który dotyczy kilku pól.

**Decyzja: CRDT jest odroczony, ale architektura ma go umożliwiać per pole.**
Konkretnie: `Note.content`, `Task.description`, `HealthEvent.notes` to kandydaci. Wejdzie wtedy, gdy
pojawi się realne zgłoszenie „dwie osoby piszą i sobie nadpisują" — **wewnątrz jednego modułu, bez
ruszania reszty**. To jest test poprawności wybranej architektury i **ona go przechodzi**.

Dodatkowe ograniczenie praktyczne: CRDT wymaga trwałego połączenia, a **środowisko testowe na
darmowym planie Rendera zasypia po 15 minutach** — na `develop` wyglądałoby na permanentnie zepsute.

| K1 | K2 | K3 | K4 | K5 | K6 |
|----|----|----|----|----|----|
| ⚪ | ⚪ | ✅✅ | ⚪ | ❌❌ | 🟡 |

---

## F — przepisanie na inny framework / pełna heksagonalność

**Zalety, uczciwie.** Czystość teoretyczna. Testowalność bez zależności zewnętrznych.

**Dlaczego odrzucony.** Next.js App Router z Server Actions jest dla tego kształtu aplikacji trafny —
usuwa całą warstwę API, którą inaczej trzeba napisać i utrzymać. Pełna heksagonalność przy 147
modelach to setki interfejsów i adapterów, których jedynym odbiorcą jest jedna baza i jeden
framework. **Wariant B bierze z tego podejścia to, co się opłaca** — warstwę `domain/` bez Prismy
i Reacta — i zostawia resztę.

| K1 | K2 | K3 | K4 | K5 | K6 |
|----|----|----|----|----|----|
| ⚪ | 🟡 | ⚪ | ⚪ | ❌❌ | ❌ |

---

## G — rozdzielenie procesów web / worker / cron ✅ **przyjęty jako faza**

Nie mikroserwisy, tylko rozdzielenie **wg charakteru pracy**. Tanie, bo kolejka **już to udźwignie**
dzięki `SKIP LOCKED`. Korzyść realna: ciężkie zadania AI przestają konkurować o CPU z obsługą żądań.

---

## Zestawienie końcowe

| Wariant | K1 | K2 | K3 | K4 | K5 | K6 | Werdykt |
|---------|----|----|----|----|----|----|---------|
| A status quo | ❌ | ❌ | ❌ | ✅ | ✅✅ | ✅ | odrzucony |
| **B modularny monolit** | ✅✅ | ✅✅ | ✅✅ | ✅ | ✅ | ✅✅ | **WYBRANY** |
| C mikroserwisy | ❌❌ | 🟡 | ❌❌ | ✅✅ | ❌❌ | ❌❌ | odrzucony |
| D event sourcing | 🟡 | 🟡 | 🟡 | ✅ | ❌❌ | ❌❌ | odrzucony (outbox przyjęty) |
| E CRDT wszędzie | ⚪ | ⚪ | ✅✅ | ⚪ | ❌❌ | 🟡 | odroczony, per pole |
| F przepisanie | ⚪ | 🟡 | ⚪ | ⚪ | ❌❌ | ❌ | odrzucony (`domain/` przyjęte) |
| G rozdzielenie procesów | ⚪ | ⚪ | ⚪ | ✅✅ | ✅✅ | ✅✅ | **przyjęty (Faza 6)** |

## Zdanie, które podsumowuje wybór

Wybieramy architekturę, w której **granice są tanie, integracja i sprawdzanie uprawnień pozostają
tanie, a błędna decyzja jest odwracalna** — bo przy zespole jednoosobowym i produkcie, który dopiero
szuka rynku, odwracalność jest ważniejsza od teoretycznej doskonałości.
