# Recenzja: Audyt bezpieczeństwa infrastruktury + raport w aplikacji

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Weryfikacja:** ./verify.md
- **Gałąź:** `claude/security-audit-youtube-o3aiat` · **Data:** 2026-08-25
- **Zakres diffa:** 9 plików kodu (2 nowe) + 1 migracja + artefakty pipeline'u

## 1. Jak recenzowałem

Recenzja celowała w cztery miejsca wskazane jako ryzykowne, a nie w cały diff równomiernie.
Najwięcej uwagi dostał sanitizer — bo to jedyny plik w tej zmianie, który **stoi między cudzym
wejściem a cudzą przeglądarką**, i jedyny, którego poprawności nie da się ocenić przez przeczytanie
(filtr na regeksach albo ma dziurę, albo jej nie ma, i widać to dopiero pod ostrzałem).

Dlatego sanitizer został **zaatakowany zestawem przypadków przeciwnika**, a nie tylko przejrzany.
To ten krok znalazł jedyną realną usterkę tej zmiany.

## 2. Ustalenia

### U-1 — `>` w wartości atrybutu urywał znacznik i wypuszczał tekst atakującego · **NAPRAWIONE**

- **Plik:** `src/modules/shopping/lib/odkazSvg.ts` (regeks przepisujący znaczniki)
- **Kategoria:** correctness / security (robustness)
- **Opis:** część atrybutowa wzorca była `[^>]*?`, więc **pierwszy** `>` kończył znacznik — także
  wtedy, gdy stał wewnątrz cudzysłowu.
- **Scenariusz:** wejście `<path d="M0 0" fill="a>b" onload="alert(1)">` dawało na wyjściu
  `<path d="M0 0">b" onload="alert(1)">`. Reszta wejścia — razem z tym, co atakujący wpisał —
  lądowała w wyniku jako **surowy tekst**.
- **Czy dało się to wykonać:** **nie.** Fragment `onload="alert(1)"` stoi *za* zamykającym `>`, więc
  parser widzi węzeł tekstowy, a nie atrybut; w SVG taki tekst nie jest nawet rysowany. Zgłaszam to
  mimo wszystko, bo filtr, który **wypuszcza niezmienione wejście atakującego**, przestał robić to,
  co obiecuje — a następna zmiana w okolicy zamienia to w lukę.
- **Poprawka (naniesiona):** wzorzec czyta teraz wartość w cudzysłowie jako całość
  (`(?:"[^"]*"|'[^']*'|[^>])*?`), a `bezpiecznaWartosc` odrzuca dodatkowo `>`. Wynik dla wejścia
  wyżej: `<path d="M0 0">`. Doszło **5 testów przypadków przeciwnika** (razem **20/20**).

### U-2 — tekst pozostały po usuniętych znacznikach · **przyjęte świadomie, bez zmiany**

- **Opis:** wejście `<scr<script></script>ipt>alert(1)</scr…` (klasyczne obejście przez sklejenie
  fragmentów) daje na wyjściu sam **tekst** `alert(1)`.
- **Dlaczego to nie jest usterka:** obejście działa tylko na filtrach, które kończą się na usuwaniu
  niebezpiecznych elementów. Tutaj po tym kroku idzie **biała lista** — sklejony `<script>` nie jest
  na niej, więc znika jako znacznik. Zostaje ciąg znaków, który w SVG nie jest wykonywany ani
  rysowany. Usuwanie wszystkich węzłów tekstowych zepsułoby `title`/`desc`, które są dozwolone
  i niosą treść.
- **Zabezpieczone testem** („w wyniku nie powinno zostać ŻADNEGO znacznika"), żeby przyszła zmiana
  białej listy nie odwróciła tego po cichu.

### U-3 — ikony zapisane jako `data:image/svg+xml` przestają się wyświetlać · **świadomy koszt**

- **Plik:** `src/modules/shopping/ui/IconDisplay.tsx`
- **Kategoria:** convention / zmiana zachowania
- **Opis:** gałąź `data:` została zawężona do rastrów, więc ikona zapisana wcześniej jako
  `data:image/svg+xml` renderuje się teraz jako **nic** (`return null`).
- **Skutek:** to ta sama treść co w gałęzi znacznikowej, tylko innym wejściem — gdyby ją przepuścić,
  omijałaby cały sanitizer. Zniknięcie ikony jest widoczne i naprawialne (wystarczy wybrać ikonę
  ponownie); przepuszczony ładunek nie jest widoczny wcale.
- **Sprawdzone:** w migracjach ani w danych z seeda **nie ma** takich ikon; jedyne wystąpienia
  `data:image/svg+xml` w repozytorium to ikony aplikacji generowane po stronie serwera
  (`icon.tsx`, `apple-touch-icon`), które nie przechodzą przez ten komponent.

### U-4 — pokrycie sinków · **sprawdzone, kompletne**

Zweryfikowałem, że nie zostało miejsce renderujące treść ikony z pominięciem odkażania. Trzy
komponenty wstrzykiwały ją wprost (`IconDisplay` + dwie **osobne kopie** pomocniczego `SvgIcon`
w `CategoryGroup.tsx` i `CategoryManager.tsx`) — wszystkie trzy są odkażone. Pozostali odbiorcy
(`IconLibrary`, `CategoryIconPicker`, `CategoryIconsManager`) renderują **przez `IconDisplay`**, więc
są pokryci automatycznie. Po zmianie `grep` po wzorcu wstrzyknięcia w module Shopping zwraca wyłącznie
wywołania z `odkazSvg(...)`.

### U-5 — nagłówki nie odbierają aplikacji żadnej używanej zdolności · **potwierdzone**

Główne ryzyko AC-7. `Permissions-Policy` nadaje `(self)` kamerze, mikrofonowi i geolokalizacji —
trzem zdolnościom, których aplikacja **realnie używa** (skanowanie kodów kreskowych, dyktowanie
głosem, Pogoda). Reszta nagłówków ma przewidywalny zasięg: aplikacja nie jest nigdzie osadzana
w ramce, więc `DENY` nic nie psuje. HSTS wychodzi **tylko** przy `NODE_ENV=production` i **bez**
zgłoszenia do listy `preload` — jedyny element tej zmiany, który byłby trudny do cofnięcia, został
świadomie pominięty. Potwierdzone porównaniem wyjścia `headers()` w obu środowiskach.

### U-6 — migracja · **zgodna z C-14 i C-41**

Jeden `INSERT` z `ON CONFLICT ("slug") DO NOTHING`, zero DDL (`grep -E "^(DROP|ALTER|CREATE)"`
pusty), dollar-quoting tagiem nieobecnym w treści, slug globalnie unikalny. Idempotencja sprawdzona
**wykonaniem pliku po raz drugi** (1 wiersz przed, 1 po). Przeczytałem treść raportu pod kątem C-41:
**nie ma w niej żadnej wartości sekretu, adresu bazy ani fragmentu klucza** — opisane są wyłącznie
mechanizmy, a rzeczy niepotwierdzalne z repozytorium noszą znacznik *[do potwierdzenia]*.

### U-7 — strażnik sekretu nie psuje budowania ani klikaczy · **potwierdzone uruchomieniem**

Strażnik siedzi w `register()`, które uruchamia się przy starcie serwera, nie podczas budowania.
Sprawdzone w obie strony: `next build` z **usuniętą** zmienną kończy się `✓ Compiled successfully`,
a `next start` bez niej pada z czytelnym komunikatem po polsku. Klikacze wystartowały serwer bez
przeszkód, a w ich logu widać ostrzeżenie `konfiguracja.brak_config_secret` — czyli strażnik
faktycznie się wykonuje. Stała wartości zastępczej mieszka w **osobnym pliku bez zależności**, bo
`instrumentation.ts` jest pakowany także dla środowiska brzegowego, gdzie import `session.ts`
wciągnąłby NextAuth i Prismę (ta droga wywracała już build — notatka Z-131).

## 3. Czego świadomie nie ruszałem

**Aktualizacja podatnych zależności** (3 krytyczne / 8 wysokich, w tym `@auth/core` — biblioteka
logowania). Zgadzam się z decyzją zapisaną w specyfikacji: naprawa nie jest zmianą łamiącą, ale bump
biblioteki uwierzytelniania **musi być osobnym commitem**, żeby ewentualne zepsucie logowania dało
się odróżnić od zmiany nagłówków. W raporcie stoi jako rekomendacja numer jeden, z uzasadnieniem.

## 4. Konwencje

| Reguła | Ocena |
|---|---|
| C-01 | ✅ całość w `worldofmag/` |
| C-02 / C-36 | ✅ `odkazSvg` w module swoich konsumentów, importowany **ścieżką względną**; bramka granic zielona |
| C-12 | ✅ nie dotyczy — zero nowych kolumn |
| C-14 / C-15 | ✅ patrz U-6 |
| C-20..C-25 | ✅ nie dotyczy — brak nowych akcji, RBAC i kosza |
| C-30..C-32 | ✅ brak nowych kolorów i tekstów; wygląd ikon niezmieniony (test „zwykła ikona przechodzi bez zmian") |
| C-41 | ✅ patrz U-6 |
| C-51 | ✅ dwa wpisy w `doświadczenia.md`, oba o rzeczach, których bramki nie łapią |
| C-53 | ✅ zero nowych zależności; sanitizer to jedna czysta funkcja (~160 linii z komentarzem), nie biblioteka |
| C-54 | ✅ poszerzenia zakresu odnotowane w `plan.md`, nie obeszte w kodzie |

## 5. Werdykt

## ✅ APPROVE Z UWAGAMI

Zmiana robi to, co obiecuje, i jest wąska. Jedna realna usterka (U-1) została znaleziona w recenzji
i **naprawiona wraz z pięcioma testami**; pozostałe ustalenia to świadome koszty z uzasadnieniem
(U-2, U-3) albo potwierdzenia (U-4..U-7).

**Uwagi przechodzące dalej — do osobnych zadań, nie blokujące:**

1. **Zaktualizować podatne zależności**, zaczynając od biblioteki logowania (rekomendacja nr 1 raportu).
2. **Ograniczyć liczbę żądań do feedu kalendarza** — token w adresie bez limitu prób (U-07 raportu).
3. **Zaplanować politykę bezpieczeństwa treści** jako osobny przebieg (U-06 raportu).
4. Po wdrożeniu **zajrzeć w nagłówki prawdziwej odpowiedzi** produkcyjnej — tutaj sprawdzono je
   z konfiguracji, bo wdrożenia jeszcze nie było.
