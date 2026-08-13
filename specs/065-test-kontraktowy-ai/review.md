# Recenzja: asystent nie jest drogą obejścia — zadanie 18

## Ustalenia

### 1. Pierwsza wersja bramki mierzyła zgodność ze stylem, nie bezpieczeństwo
**correctness (bramka)** · **naprawione przed commitem**

Wzorzec szukał `requireAccess`/`ownedWhere` i zgłosił **sześć** modułów. Żaden nie był dziurą:
Nawyki zawężają lokalnym `ownerScope(userId)`, Zakupy `accessibleListWhere(userId)`, Pogoda jawnym
`ownerId: userId`. Bramka znająca **jeden** sposób robienia rzeczy nie mierzy bezpieczeństwa —
mierzy podobieństwo do ulubionego idiomu, a sześć fałszywych alarmów uczy ludzi ją wyłączać.

Wzorzec rozszerzony o realnie występujące mechanizmy. To trzecia bramka w tej sesji, przy której
**pierwsze uruchomienie było diagnozą samej bramki**, a nie kodu (po `check:ownership-scope`
z `.tsx` i `check:grant-mirror` z `purge.ts`).

### 2. `reports` — wygląda na lukę, nią nie jest, i to trzeba było rozstrzygnąć raz
*`src/modules/reports/ai/readTools.ts`* · **security (sprawdzone)** · **udokumentowane**

Narzędzie ignoruje przekazany `userId`. Zawężenie siedzi w `searchReports`, które bierze
użytkownika z **sesji** i filtruje po „mój / systemowy / mojego zespołu". Bezpieczne, dopóki sesja
i `userId` narzędzia to ta sama osoba — a asystent z definicji działa w imieniu zalogowanego.

Wpis w manifeście mówi **gdzie sprawdzić**, gdyby to przestało być prawdą (np. gdyby kiedyś
asystent działał w tle za kogoś). To jest różnica między „sprawdziłem i jest OK" a „zapisałem,
przy jakim założeniu jest OK".

### 3. Bramka odpowiada na „czy widać", test na „czy działa"
**granica narzędzia** · **odnotowane**

Rozdz. 12.2.1 pyta o skutek, nie o obecność kodu. Stąd test zachowania — ale tylko dla Zwierząt
i Zadań, bo **tylko tam** „mam dostęp" i „wolno mi zmieniać" to dwie różne rzeczy. Rozszerzanie go
na moduły z dwoma stanami (moje / nie moje) dołożyłoby czternaście testów sprawdzających to samo
co bramka.

## Werdykt

**APPROVE.** Zadanie 18 domknięte: bramka na wszystkich szesnastu, test zachowania tam, gdzie
scenariusz z dokumentu da się w ogóle odtworzyć.
