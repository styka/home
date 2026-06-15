# Analiza / Audyt stanu projektu Omnia

**Stan na dzień:** 2026-06-14
**Forma:** żywy dokument wersjonowany w repozytorium (`content/audyt/*.md`), renderowany w Panelu Admina (`/admin/audyt`), dostępny wyłącznie dla administratora.

> „Dawniej tworzenie oprogramowania było drogie, więc aplikacje »do wszystkiego« rzadko miały
> zaawansowane opcje. My chcemy złamać tę zasadę — dzięki AI ma być **tanio, ale na masową skalę**.”
> — założenie właściciela projektu, będące osią tego audytu.

---

## Po co ten dokument

To nie jest zwykły raport. To **kompletna, głęboka analiza projektu Omnia** — od warstwy
funkcjonalnej i technicznej, przez bezpieczeństwo, skalowalność i UX, aż po model biznesowy,
monetyzację i marketing — przygotowana tak, by:

1. **Uczciwie ocenić, na jakim realnie etapie jest aplikacja** (bez upiększania).
2. **Wyłuskać dobre i złe praktyki** już obecne w kodzie.
3. **Zaprojektować drogę** od dzisiejszych 1–50 użytkowników do scenariusza nawet **100 000 000**
   użytkowników, gdyby marketing zadziałał.
4. Zostawić **ponumerowane zalecenia** (`Z-NNN`) i **gotowe plany wdrożenia dla Claude Code**, tak
   by kolejne sesje mogły realizować je „z marszu”, generując raport 1:1 z tym dokumentem.

Dokument jest jednocześnie **fundamentem strategicznym**: ma posłużyć do późniejszego profesjonalnego
rozwinięcia planu biznesowego, prognoz kosztów i przychodów oraz kampanii marketingowej.

---

## Metoda: debata dwóch zespołów

Każdy rozdział analityczny powstał jako **symulowana debata dwóch kompletnych zespołów
produktowo-inżynierskich**. Oba są mądre, profesjonalne i nastawione na świetny UX — różnią się
**temperamentem**:

| | Zespół A — **Strażnicy Jakości** | Zespół B — **Pionierzy** |
|---|---|---|
| Filozofia | „Zróbmy to porządnie albo wcale” | „Wypuśćmy, zmierzmy, poprawmy” |
| Mocna strona | wyłapują ryzyka, dług, luki bezpieczeństwa | generują pomysły, tempo, odwagę produktową |
| Słabość | mogą przeoptymalizować i spowolnić | mogą przeoczyć ryzyko i dług |
| Rola w debacie | hamulec bezpieczeństwa | silnik rozwoju |

Pełny skład obu zespołów (z imionami, wiekiem i charakterami) opisuje **Rozdział 4 — Dwa zespoły**.
Każdy zespół ma komplet specjalistów: Product Owner, architekt, senior developer, tester/QA, UX,
grafik, analityk, delivery manager, **security**, **DevOps/SRE**, **DBA/dane**, **AI/ML** oraz
**growth/marketing** — a dodatkowo **po troje użytkowników** w różnym wieku i o różnych charakterach.
Uwzględniono też „obsadę cyklu życia” (support, community, legal/RODO, finanse, sprzedaż B2B), bo
projekt prowadzimy od pierwszego spotkania zespołów aż do **pół roku po wdrożeniu na produkcję**.

### Jednolity szablon rozdziału-debaty

Aby dokument był spójny i porównywalny, każdy rozdział analityczny trzyma ten sam układ:

1. **Kontekst / stan z kodu** — fakty: co realnie jest w repozytorium (pliki, modele, wzorce).
2. **Głos Zespołu A (Strażnicy)** — ryzyka, dług, „co może pójść nie tak”.
3. **Głos Zespołu B (Pionierzy)** — pomysły, śmiałe podejścia, szanse.
4. **Punkty sporne** — bezpośrednia wymiana zdań, tam gdzie zespoły się nie zgadzają.
5. **Głos użytkowników** — krótkie reakcje 2–3 person (różny wiek/charakter).
6. **Konsensus i zalecenia** — ustalenia + ponumerowane `Z-NNN` z priorytetem, nakładem i ryzykiem.
7. **Dobre vs złe praktyki** — wyłuskane na koniec, dla szybkiego skanowania.

---

## Legenda

**Priorytety zaleceń**
- **P0** — krytyczne (bezpieczeństwo, dane, blokada skali lub wymogi prawne).
- **P1** — ważne (jakość, UX, wydajność odczuwalna przez użytkownika).
- **P2** — wartościowe, ale można odłożyć.

**Nakład (szacunkowy, w „sesjach Claude Code”)**
- **S** — mała (jedna sesja), **M** — średnia (kilka sesji), **L** — duża (wieloetapowa, wymaga decyzji właściciela lub infrastruktury).

**Statusy rozdziałów** (widoczne w spisie treści)
- ✅ **gotowy** — napisany w całości.
- ✍️ **roboczy** — szkic, treść uzupełniana.
- ◌ **w przygotowaniu** — struktura ustalona, treść w kolejnej iteracji.

**Identyfikatory zaleceń** — `Z-NNN`, numerowane globalnie i zbierane w **Dodatku A** (lista zaleceń),
gdzie każde ma dedykowany plan wdrożenia.

---

## Jak czytać

- **Czytelnik liniowy** — przejdź po kolei (przyciski *Poprzedni / Następny* na dole każdego
  rozdziału). Pasek u góry pokazuje postęp czytania i ile rozdziałów jest już gotowych.
- **Czytelnik wyrywkowy** — skacz po spisie treści z lewej. Każdy rozdział jest samodzielny.
- **Wykonawca (Claude Code w kolejnej sesji)** — zacznij od **Dodatku A** (lista zaleceń + plany) i
  **Dodatku B** (gotowy prompt). Reszta dokumentu jest kontekstem uzasadniającym każdą decyzję.
- **Tryb czytania** — w prawym górnym rogu przełącznik *ciemny / jasny / sepia* (zapamiętywany).

---

## Ważne zastrzeżenie metodologiczne

Audyt opiera się na **realnym stanie repozytorium na 2026-06-14**: ~130 modeli Prisma, ~196 migracji,
~34 katalogi tras, ~57 plików akcji serwerowych, ~227 komponentów. Dwa raporty z sesji 2026-06-13
(„co zrobione” i „co odłożone”) traktujemy jako **materiał pomocniczy**, a nie oś analizy — pokazują
kierunek i świeży backlog, ale audyt patrzy szerzej i niezależnie.

Liczby biznesowe i prognozy (Część IV) są **modelem orientacyjnym** — świadomie konserwatywnym tam,
gdzie brak twardych danych. Ich celem jest dać ramę do decyzji, nie udawać precyzji, której na tym
etapie mieć nie można.
