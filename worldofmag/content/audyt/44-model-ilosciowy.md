# Rozdział 44 — Pełny model ilościowy (koszty / przychody)

> **Zastrzeżenie:** wszystkie liczby są **orientacyjne i konserwatywne**, w PLN, miesięcznie (o ile nie
> zaznaczono inaczej). Cel: dać ramę decyzyjną i pokazać **dźwignie**, nie udawać precyzji, której na
> tym etapie mieć nie można. Założenia są jawne — należy je kalibrować realnymi danymi po starcie.

## Założenia bazowe

- **Koszt AI to główna zmienna.** Przy taniej rodzinie modeli (Groq) i **limitach + cache** zakładamy
  koszt tokenów: **~1 zł/mies. na aktywnego użytkownika darmowego** (z dziennym limitem i tańszym
  modelem), **~6 zł** na premium (więcej/lepszy model), **~15 zł** na konto B2B (intensywne procesy).
  Bez cache i bez limitów te liczby rosną 3–10× — stąd priorytet Z-130/Z-132.
- **Aktywność:** ~40% zarejestrowanych to MAU (miesięcznie aktywni); koszty liczymy od MAU.
- **Konwersja:** premium **1,5%** MAU, B2B **0,3%** MAU (nisze branżowe płacą więcej, ale jest ich
  mniej). To konserwatywnie — dobry produkt + branże mogą to podnieść.
- **ARPU:** premium **25 zł/mies.**, B2B **80 zł/mies.**, reklamy **~0,8 zł/mies.** na darmowego MAU
  (realny eCPM lifestyle, dopiero przy dużym ruchu i tylko jako dodatek).
- **Infra:** Render/Neon skalują schodkowo; przy skali dochodzą repliki, cache (KV), kolejka, CDN.

## Struktura kosztów wg etapu

| Etap (MAU) | Hosting+DB | AI (tokeny) | Inne (domena/narzędzia/Sentry) | Ludzie | Koszt łączny (rząd) |
|---|---|---|---|---|---|
| 50 | ~0 (free/hobby) | ~50 | ~50 | 0 (właściciel) | **~100 zł** |
| 1 000 | ~150 | ~400 | ~150 | 0 | **~700 zł** |
| 10 000 | ~1 500 | ~4 000 | ~500 | 0–1 część etatu | **~6–10 tys. zł** |
| 100 000 | ~12 000 | ~35 000 | ~3 000 | 2–3 osoby | **~80–120 tys. zł** |
| 1 000 000 | ~120 000 | ~300 000 | ~20 000 | 8–12 osób | **~0,8–1,2 mln zł** |
| 10 000 000 | ~1,0 mln | ~2,2 mln | ~0,2 mln | 30–50 osób | **~7–9 mln zł** |
| 100 000 000 | ~9 mln | ~18 mln | ~2 mln | 120–200 osób | **~70–90 mln zł** |

> AI dominuje koszt. **Każde 30% oszczędności na tokenach** (cache + tańsze modele dla `dispatch` +
> twarde limity darmowych) przesuwa próg rentowności o etap. To najważniejsza dźwignia w całym modelu.

## Unit economics (na 1 użytkownika MAU, miesięcznie)

| Segment | Koszt obsługi | Przychód | Marża/szt. |
|---|---|---|---|
| Darmowy (bez reklam) | ~1,2 zł (AI+infra) | 0 | **−1,2 zł** |
| Darmowy z reklamą | ~1,2 zł | ~0,8 zł | **−0,4 zł** |
| Premium | ~7 zł | 25 zł | **+18 zł** |
| B2B / branżowy | ~18 zł | 80 zł | **+62 zł** |

**Wniosek:** darmowy użytkownik jest **lekko stratny** (nawet z reklamą). Model działa, gdy **marża z
premium/B2B pokrywa darmową bazę**. Przy konwersji 1,5% premium + 0,3% B2B:
- 1 000 MAU → przychód ≈ 15×25 + 3×80 = **615 zł**; koszt ≈ 700 zł → **lekko pod kreską** (oczekiwane na
  tym etapie — to faza inwestycji w bazę).
- 10 000 MAU → przychód ≈ 150×25 + 30×80 + reklamy ≈ 3 750 + 2 400 + ~6 000 = **~12 tys. zł**; koszt
  ≈ 6–10 tys. → **próg rentowności w zasięgu**.
- 100 000 MAU → przychód ≈ 1 500×25 + 300×80 + ~70 tys. reklam ≈ 37,5k + 24k + 70k = **~130 tys. zł**;
  koszt ≈ 80–120 tys. → **dodatnia marża operacyjna**, jeśli koszt AI pod kontrolą.

## Scenariusze wzrostu (uproszczony rachunek miesięczny)

| MAU | Koszt | Przychód (premium+B2B+reklamy) | Wynik (rząd) |
|---|---|---|---|
| 50 | ~0,1 tys. | ~0 | −0,1 tys. |
| 1 000 | ~0,7 tys. | ~0,6 tys. | ~0 (próg inwestycji) |
| 10 000 | ~8 tys. | ~12 tys. | **+ kilka tys.** |
| 100 000 | ~100 tys. | ~130 tys. | **+ ~30 tys.** |
| 1 000 000 | ~1 mln | ~1,4 mln | **+ ~0,4 mln** |
| 10 000 000 | ~8 mln | ~14 mln | **+ ~6 mln** |
| 100 000 000 | ~80 mln | ~150 mln | **+ ~70 mln** |

> To **scenariusz konserwatywny** (niska konwersja, ostrożne ARPU). Dźwignie w górę: lepsza konwersja
> B2B (branże!), wyższe ARPU premium, tańsze AI. Dźwignie w dół (ryzyka): churn, drogie AI bez cache,
> CAC (koszt pozyskania) wyższy od LTV.

## Budżet startowy 10 000 zł — rozpisany etapami

**Etap 0 — Fundament (mies. 0–3, ~2–3 tys. zł).**
Hosting bez usypiania (Render hobby/standard) + domena + Sentry (free) + narzędzia. Wdrożenie P0 z
audytu (RODO, indeksy, kontrola kosztów AI). Marketing = **organiczny** (treści/SEO z bazy wiedzy,
obecność w 1–2 społecznościach branżowych). **Cel: produkt gotowy na płacących, pierwsza branża MVP.**

**Etap 1 — Pierwsi płacący (mies. 3–6, ~3–4 tys. zł).**
Uruchomienie warstwy planów + płatności. **Mikro-kampanie celowane** (społeczności hodowców/warsztatów/
gastro) ~1,5–2 tys. zł na testy. Pomiar CAC vs LTV. **Cel: 20–50 płacących kont (premium/B2B), dowód, że
ktoś płaci.**

**Etap 2 — Bootstrap z marży (mies. 6+, z przychodów).**
Reinwestujemy **marżę z płacących** w kolejne kampanie i drugą branżę. Reguła: **wydawaj na pozyskanie
tylko do wysokości LTV** (z marginesem). Rezerwa ~1–1,5 tys. zł z budżetu jako bufor.

> Kluczowa zasada bootstrappingu: **najpierw mała grupa płacących z jednej branży finansuje marketing
> kolejnej**. 10 tys. zł nie wystarczy na „duży marketing” — ma wystarczyć na **dowód modelu** i
> uruchomienie samonapędzającej się pętli.

## Próg rentowności i główne dźwignie

- **Najważniejsza dźwignia: koszt AI** — cache (Z-132), tańsze modele dla `dispatch` (Z-134), twarde
  limity darmowych (Z-130). Bez tego darmowa baza jest nie do udźwignięcia przy skali.
- **Druga: konwersja B2B/branże** — jeden płacący warsztat/hodowca finansuje ~60 darmowych rodzin.
  Branże (Rozdz. 43) to motor rentowności, nie reklamy.
- **Trzecia: retencja** — LTV rośnie z retencją; „rodzina/zespół” (Rozdz. 15) podnosi retencję i obniża
  CAC (wirusowość).
- **Reklamy = uzupełnienie, nie fundament** — sensowne dopiero przy setkach tysięcy MAU.

## Konsensus i zalecenia

- **Z-510** *(P0 · S)* — **Wdrożyć pomiar jednostkowej ekonomiki** (koszt AI/infra per MAU, ARPU,
  konwersja, churn, CAC, LTV) zanim ruszy płatny marketing — inaczej skalujemy w ciemno.
- **Z-511** *(P0 · M)* — **Twarde limity i cache AI dla darmowych** (Z-130/132/134) jako **warunek
  rentowności** — to nie optymalizacja, to fundament modelu.
- **Z-512** *(P1 · S)* — **Reguła CAC < LTV** w każdej kampanii; budżet marketingowy = funkcja marży z
  płacących, nie stała kwota.
- **Z-513** *(P1 · S)* — **Priorytet B2B/branże nad reklamami** jako źródło marży finansujące darmową
  bazę (spójne z Rozdz. 42/43).
- **Z-514** *(P2 · M)* — **Model finansowy w arkuszu** (żywy, kalibrowany danymi) z tymi scenariuszami —
  do aktualizacji co miesiąc po starcie.
- **Z-515** *(P1 · S)* — **Bufor i etapowanie 10 tys. zł** wg powyższego planu; nie „przepalić” budżetu
  na marketing przed dowodem, że ktoś płaci.

## Dobre vs złe praktyki

**Dobre:**
- Tani stos (Groq, Open-Meteo, OSM, free tier na start) realnie obniża koszt wejścia.
- Model „darmowe życie / płatny biznes” ma zdrową ekonomikę, **o ile** koszt AI jest kontrolowany.

**Złe / do poprawy:**
- Liczenie na reklamy jako główny przychód — przy realnym eCPM to droga donikąd bez gigantycznego ruchu.
- Skalowanie marketingu przed pomiarem CAC/LTV i przed kontrolą kosztu AI — najszybsza droga do spalenia
  budżetu.
- Brak żywego modelu finansowego — decyzje „na czucie” zamiast na danych.
