# Rozdział 42 — Model biznesowy i monetyzacja

## Kontekst

Założenia właściciela (oś tej części):

- **Organizacja życia i rodziny — DARMOWE.** Podstawowe wersje działów branżowych — też darmowe.
- **Przychód:** reklamy LUB opłata „bez reklam”; **plus** płatne funkcje zaawansowane w działach
  pracy/biznesu.
- **Teza:** dawniej aplikacje „do wszystkiego” były drogie i płytkie; **dzięki AI robimy je tanio, ale
  na masową skalę i z głębią dla biznesu**.
- **Budżet startowy: ~10 000 zł.** Trzeba rozegrać etapami, bootstrapując marketing z pierwszych
  przychodów.
- **Skala:** 1–50 → docelowo nawet 100 mln. Brak sukcesu = zamknięcie; sukces = konieczność skalowania.

Dziś **monetyzacja = 0** (świadomie odłożona; „Pro” to tryb techniczny, nie paywall). Ten rozdział to
debata o tym, **jak i kiedy** ją włączyć, nie psując obietnicy „za darmo dla życia”.

## Głos Zespołu A — Strażnicy

**Basia (PO):** „Zgoda na »darmowe dla życia«, ale **granica free/premium musi być jasna od początku
projektowo**, nawet jeśli włączymy płatności później. Inaczej użytkownicy przyzwyczają się, że wszystko
za darmo, i każda późniejsza opłata = bunt. Zdefiniujmy **teraz**, co jest »życiem« (free na zawsze), a
co »pracą/biznesem« (płatne).”

**Łukasz (growth, ostrożny):** „Reklamy **kierowane** zderzają się z RODO (profilowanie, zgody) i z
naszym minimalistycznym, »zaufanym« UX. Reklamy w aplikacji do **zdrowia i finansów** to wizerunkowe
ryzyko. Proponuję: **reklamy kontekstowe, nieinwazyjne, tylko w modułach »lifestyle«**, nigdy w zdrowiu/
finansach; i zawsze opcja »wyłącz reklamy« za drobną opłatę.”

**Katarzyna (analityk):** „Konkurujemy z gigantami (Notion, Todoist, Google, Booksy, Fixly). Nie
wygramy ceną reklam ani pojedynczą funkcją. Naszą przewagą jest **integracja »wszystko w jednym« +
tani AI**. Monetyzacja musi tę przewagę **wzmacniać**, nie rozmieniać na drobne.”

**Anna (security):** „Płatności = nowy reżim: PCI (po stronie bramki), faktury, VAT, zwroty, RODO
płatności. Bez tego nie ruszamy. To nie »dodaj przycisk Zapłać«.”

## Głos Zespołu B — Pionierzy

**Wojtek (PO):** „Model jest **dobry i nowoczesny**: free napędza wzrost, B2B płaci za głębię. Klucz to
**»value metric«** — za co dokładnie płaci biznes? Propozycja: darmowe = nielimitowane podstawy +
limit AI; płatne = **więcej AI, funkcje pro branżowe, współpraca zespołowa, integracje, brak reklam**.
AI jest naturalnym licznikiem: darmowy dostaje X operacji AI/miesiąc, premium więcej.”

**Nina (growth, viral):** „Reklamy to **najgorszy** pierwszy przychód dla takiego produktu — psują
zaufanie i wymagają OGROMNEGO ruchu, by cokolwiek zarobić. Postawmy na **freemium + B2B**: 100 płacących
warsztatów/gastronomii > 100 000 wyświetleń reklam. Reklamy ewentualnie **później**, jako opcja dla
darmowych, z »wyłącz za 9 zł«.”

**Sandra (architekt):** „Technicznie jesteśmy gotowi szybciej, niż się wydaje: mamy RBAC i własność —
**plan = zestaw uprawnień/limitów**. »Pro« jako tryb już istnieje; trzeba dołożyć warstwę
**`Plan`/`Subscription` + bramkowanie funkcji** i licznik AI. To ewolucja, nie rewolucja.”

**Tadeusz (użytkownik, 60):** „Ja **zapłacę** za moduł gastro, jeśli policzy mi food cost i zamówienia
taniej niż dedykowany system za 500 zł/mies. Reklamy by mnie zniechęciły do narzędzia firmowego.”

## Punkty sporne

- **Reklamy vs freemium jako pierwszy przychód.** Konsensus zespołów: **najpierw freemium + B2B
  premium**; reklamy (kontekstowe, opcjonalne, tylko lifestyle) jako **uzupełnienie później**. Decyzja
  należy do właściciela — rekomendacja audytu jednoznaczna.
- **Gdzie granica free/premium.** Konsensus: **„życie/rodzina” = free na zawsze** (organizacja domu,
  podstawy wszystkich modułów); **„praca/biznes/branża zaawansowana” + nadmiarowe AI + zespoły +
  integracje + brak reklam = premium/B2B**.
- **Kiedy włączyć płatności.** Po: RODO (Z-050/051), warstwie planów, jednej dojrzałej branży (Rozdz.
  43) i kontroli kosztów AI (Rozdz. 12). Nie wcześniej.

## Głos użytkowników

**Krzysztof (52, warsztat):** „Zapłacę za coś, co mi realnie oszczędza czas w firmie. Za organizację
domu — nie, to ma być darmowe.” → potwierdza linię podziału free/premium.

**Agnieszka (38, rodzina):** „Dla rodziny chcę za darmo, ale »wyłącz reklamy za parę złotych« kupię,
żeby dzieci nie widziały reklam.” → opcja „bez reklam” ma popyt nawet w segmencie darmowym.

**Marek (29):** „Zapłacę za AI bez limitów i integracje (kalendarz, API).” → AI i integracje jako
realne wartości premium.

## Tabela: co darmo / co płatne / co B2B

| Obszar | Darmowe (życie/rodzina) | Premium (osoby) | B2B / Pro branżowe |
|---|---|---|---|
| Moduły organizacji życia | ✅ pełne | — | — |
| AI / asystent | ✅ limit dzienny (tańszy model) | ✅ więcej + lepszy model | ✅ pod proces biznesowy |
| Współdzielenie | ✅ rodzina (podstawy) | ✅ zespoły | ✅ role granularne, wielu pracowników |
| Integracje (Calendar/API) | ⚠️ podstawy (iCal) | ✅ pełne | ✅ webhooks/API |
| Reklamy | kontekstowe (opcja „wyłącz”) | brak | brak |
| Działy branżowe (Hodowca, Gastro…) | ✅ wersja podstawowa | — | ✅ funkcje zaawansowane |
| Marketplace Usługi | ✅ podstawy | — | ✅ prowizja/abonament wykonawcy |

## Konsensus i zalecenia

- **Z-470** *(P1 · S)* — **Zdefiniować i udokumentować linię free/premium/B2B** (value metric: AI +
  funkcje branżowe + zespoły + integracje + brak reklam). Decyzja produktowa przed kodem.
- **Z-471** *(P1 · M)* — **Warstwa `Plan`/`Subscription` + bramkowanie funkcji** na bazie istniejącego
  RBAC/własności; „Pro” techniczne → plan handlowy. (Plan wdrożenia: Rozdz. 56.)
- **Z-472** *(P1 · M)* — **Licznik/budżet AI per plan** jako oś monetyzacji (spójne z Z-130/Z-472) —
  darmowy limit, premium więcej.
- **Z-473** *(P1 · L)* — **Integracja bramki płatności + faktury/VAT** (np. Stripe/Przelewy24) z
  Portfelem; reżim PCI po stronie bramki. Warunek jakiejkolwiek opłaty.
- **Z-474** *(P2 · M)* — **Reklamy kontekstowe (opcjonalne, tylko lifestyle, »wyłącz za opłatą«)** —
  dopiero po freemium/B2B; nigdy w zdrowiu/finansach.
- **Z-475** *(P1 · S)* — **Pozycjonowanie wobec gigantów:** komunikować przewagę „wszystko w jednym +
  tani AI + branże dla małych firm”, nie konkurować 1:1 funkcją z Notion/Booksy.
- **Z-476** *(P1 · M)* — **Model marketplace Usługi:** prowizja od transakcji lub abonament wykonawcy
  (osobny od planów osobistych) — to gotowy, samodzielny strumień przychodu.

## Dobre vs złe praktyki

**Dobre:**
- „Pro” jako tryb techniczny już istnieje — warstwa planów to ewolucja RBAC, nie przepisanie.
- Świadome odłożenie monetyzacji do czasu dojrzałości produktu (brak przedwczesnych paywalli).
- Jasna intuicja właściciela: życie za darmo, biznes płaci — spójna z rynkiem.

**Złe / do poprawy:**
- Brak zdefiniowanej linii free/premium grozi „przyzwyczajeniem do darmowego” i buntem przy płatnościach.
- Reklamy kierowane jako pierwszy przychód — kolizja z RODO i zaufaniem; słaby zwrot bez ogromnego ruchu.
- Brak warstwy płatności/faktur — fundament do zbudowania przed jakąkolwiek opłatą.
