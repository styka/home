-- Raport analityczny: luki i rekomendacje rozwoju modułu Zwierzęta → /admin/reports.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Zwierzęta — Analiza luk i rekomendacje (roadmap do bycia #1)',
  'pets-gap-analysis-2026-05-25',
  $pets_gap_2026_05_25$# Zwierzęta — Analiza luk i rekomendacje rozwoju

**Wersja:** 1.0 · **Data:** 2026-05-25 · **Autor:** Claude Code (analiza modułu)
**Cel:** wskazać, czego jeszcze brakuje, aby moduł był najlepszym na świecie
narzędziem do zarządzania zwierzętami — z priorytetami i szacunkiem nakładu.

---

## 1. Streszczenie

Moduł po Fazach 1–3 pokrywa **bardzo szeroki** zakres: profile, zdrowie, leki/
szczepienia, weterynaria, karmienie, rutyny, pomiary, finanse, współdzielenie,
pakiety widoczności, husbandry (terrarium/akwarium z alertami), hodowlę
(pary, klutche, rodowód, kalkulator genetyczny, sprzedaż) oraz sterowanie
głosem/tekstem przez AI. To już więcej niż większość komercyjnych aplikacji.

Aby być **#1**, brakuje przede wszystkim trzech rzeczy o najwyższym wpływie:
**(1) wizualizacje danych** (mamy dane, brak wykresów), **(2) realne
powiadomienia** (mamy agendę w aplikacji, brak push/e-mail/kalendarza) oraz
**(3) inteligentne onboardowanie wg gatunku/rasy** (domyślne zakresy, plany
szczepień i diety). Poniżej pełna analiza z priorytetami **P0/P1/P2** i nakładem
**S/M/L**.

---

## 2. Stan obecny (co już mamy)

| Obszar | Status |
|--------|--------|
| Profile + status + zdjęcie (URL) + preset/widoczność | ✅ |
| Pomiary (waga/długość/BCS) + trend liczbowy | ✅ (bez wykresu) |
| Dziennik zdrowia (schorzenia/alergie/objawy/urazy) | ✅ |
| Leki/szczepienia/odrobaczanie (cykliczne, odhaczanie) | ✅ |
| Wizyty weterynaryjne (koszt, załącznik URL, następna) | ✅ |
| Karmienie (log + harmonogram, tryb „ofiara") | ✅ |
| Rutyny opieki (czyszczenie/spacer/UVB/…) | ✅ |
| Finanse (suma kosztów wizyt) | ✅ (podstawowe) |
| Husbandry: zbiorniki + parametry + alerty + sprzęt | ✅ |
| Hodowla: pary, klutche, rodowód, sprzedaż | ✅ |
| Genetyka: kalkulator morphów (rec./kodom./dom.) | ✅ (per gen) |
| Współdzielenie user/team (VIEWER/EDITOR) | ✅ |
| Kalendarz opieki + hybrydowy silnik dobrostanu (reguły+LLM) | ✅ |
| AI: 14 akcji tekst/głos | ✅ |

---

## 3. Luki i rekomendacje

### P0 — najwyższy wpływ (rekomendowane jako kolejne)

**3.1 Wizualizacje historyczne** — *nakład: M*
Mamy dane (waga, parametry środowiska, koszty), ale pokazujemy tylko listy i
ostatnią wartość. Brakuje wykresów trendu (waga vs czas, parametry akwarium vs
czas, krzywa wzrostu, wydatki w czasie). To natychmiastowy skok wartości i
„wow". Lekka biblioteka wykresów lub własne sparkline SVG (zero zależności).

**3.2 Realne powiadomienia** — *nakład: M–L*
Agenda istnieje tylko w aplikacji. Aplikacja jest PWA (`manifest.json`,
`sw.js`), a moduł Zadania już korzysta z `Notification` — można to wykorzystać.
Dodać: Web Push (przypomnienia o lekach/karmieniu/wymianie UVB/parametrach),
opcjonalnie e-mail i **eksport ICS** do Kalendarza Google/Apple. Konfigurowalny
wyprzedzenie i „odłóż/wykonaj" z powiadomienia.

**3.3 Integracja z resztą WorldOfMag** — *nakład: M*
Zaległe/nadchodzące zadania opieki **nie pojawiają się** na globalnej stronie
głównej, w module Zadania ani w (planowanym) Kalendarzu. Pet-agenda powinna
zasilać dashboard Home i Kalendarz, a niedobory karmy — listę Zakupów.

**3.4 Baza gatunków/ras z domyślami + inteligentny onboarding** — *nakład: M–L*
Przy dodawaniu zwierzęcia AI/baza powinny wstępnie ustawić: bezpieczne zakresy
środowiska, harmonogram szczepień/odrobaczania, sugerowaną dietę i porcje,
typowe rutyny. To realny wyróżnik „best in the world" i ogromne ułatwienie.

### P1 — wysoki wpływ

**3.5 Galeria zdjęć i realne załączniki** — *nakład: M*
Wiele zdjęć per zwierzę (oś czasu wyglądu), realny upload. Integracja **Google
Drive** (folder per użytkownik) — pozostaje w planach zgodnie z ustaleniami.

**3.6 Kontakty weterynaryjne + ubezpieczenie (modele)** — *nakład: M*
Dziś klinika to wolny tekst per wizyta. Model `VetContact` (klinika, telefon,
godziny, adres, mapa) i `Insurance` (polisa, numer, zakres, odnowienie).

**3.7 Karta ratunkowa / tryb opiekuna + tryb zaginięcia** — *nakład: M*
Udostępnialna/drukowalna karta (QR) z najważniejszymi danymi (schorzenia,
alergie, leki, kontakt do weta) dla petsittera. Tryb „zaginięcie": plakat,
ostatnio widziany, dane chipa.

**3.8 Pogłębione AI** — *nakład: M*
- Q&A nad pełną historią zwierzęcia („kiedy Reksio był ostatnio u weta?").
- AI-onboarding: wygenerowanie planu opieki wg gatunku/rasy.
- Wstępny triage objawów (z jasnym disclaimerem, że to nie diagnoza).

**3.9 Aktywność i lifestyle (psy/koty)** — *nakład: M*
Spacery/aktywność (czas, dystans), dziennik treningu i komend, dziennik
zachowania/nastroju, log pielęgnacji, dzienna checklista opieki.

**3.10 Dieta i żywienie + integracja Zakupy** — *nakład: M*
Plany żywieniowe, kalkulator porcji/kalorii wg wagi/gatunku, ewidencja zapasów
karmy z auto-dodawaniem do listy Zakupów przy niskim stanie.

**3.11 Rodowód wielopokoleniowy + COI; łączony morph** — *nakład: M–L*
Wizualne drzewo rodowodu (2–4 pokolenia), współczynnik inbredu (COI),
łączone prawdopodobieństwa wielu genów (obok obecnych per-gen), biblioteka
morphów per gatunek.

**3.12 Adherencja leków z porami dnia** — *nakład: S–M*
Harmonogramy z godzinami i potwierdzeniem podania (np. 2× dziennie), historia
adherencji.

### P2 — uzupełniające / nisze

- **Wyniki badań (lab)**: panele numeryczne z normami i wykresem. *(M)*
- **Akwarystyka+**: kalkulator obsady (bioload), spis roślin/współmieszkańców
  zbiornika, kwarantanna, wymiana wody sterowana azotanami. *(M)*
- **Inkubacja+**: dzienny log temperatury, odliczanie do wyklucia, rezerwacje
  potomstwa z zaliczkami, generowanie umowy/gwarancji zdrowia. *(M)*
- **Eksport i zgodność**: eksport PDF/CSV per zwierzę, portowalność danych
  (RODO), audit log zmian w zespołach. *(M)*
- **Jednostki i lokalizacja**: kg/lb, °C/°F, pełne i18n. *(S–M)*
- **Profil publiczny / link**: ogłoszenie sprzedaży lub plakat zaginięcia. *(S)*
- **Tagi i wyszukiwanie** zwierząt, operacje masowe, grupy gospodarstwa. *(S–M)*
- **Ważenie/karmienie z aparatu** (mobile quick-capture). *(M)*

---

## 4. Proponowany roadmap

| Faza | Zakres | Priorytet |
|------|--------|-----------|
| **4** | Wykresy historyczne (3.1) + integracja Home/Tasks/Kalendarz (3.3) | P0 |
| **5** | Realne powiadomienia: Web Push + ICS + e-mail (3.2) | P0 |
| **6** | Baza gatunków/ras + AI-onboarding planu opieki (3.4, 3.8) | P0/P1 |
| **7** | Galeria + GDrive, kontakty wet./ubezpieczenie, karta ratunkowa (3.5–3.7) | P1 |
| **8** | Aktywność/trening + dieta z integracją Zakupy (3.9–3.10) | P1 |
| **9** | Rodowód wielopokoleniowy + COI + łączony morph (3.11) | P1 |
| **10+** | P2: lab, akwarystyka+, inkubacja+, eksport/RODO, i18n | P2 |

## 5. Szybkie wygrane (mały nakład, duży efekt)
1. Sparkline wagi na karcie zwierzęcia i w profilu (3.1, część).
2. Surfacing agendy zwierząt na globalnym Home (3.3, część).
3. Karta ratunkowa do druku (3.7, część).
4. Eksport ICS pojedynczego terminu (3.2, część).
5. Przypomnienia o urodzinach/„gotcha day" + odnowieniach.

## 6. Dlaczego to czyni nas #1
Konkurencja zwykle specjalizuje się w jednym segmencie (pies/kot **albo** gady
**albo** akwarystyka). My mamy **jeden, konfigurowalny moduł** dla wszystkich
gatunków, z AI sterowanym głosem, husbandry i hodowlą na poziomie pro. Domknięcie
**wizualizacji + powiadomień + onboardingu wg gatunku** daje przewagę, której
trudno dorównać — przy zachowaniu prostego, klawiaturowo-przyjaznego UX.
$pets_gap_2026_05_25$,
  'pets',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
