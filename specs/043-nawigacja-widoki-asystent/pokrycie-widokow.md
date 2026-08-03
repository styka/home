# Pokrycie modułów stanem widoku w adresie (AC-8b)

- **Spec:** ./spec.md · **Plan:** ./plan.md (§5.2) · **Zadania:** ./tasks.md (T-17)
- **Data:** 2026-08-03
- **Podstawa:** przegląd **w kodzie** wszystkich pozycji z `src/lib/modules.tsx` (21 modułów)
  plus panele administracyjne.

> **Po co ten dokument.** AC-8b wymaga, żeby **każdy** moduł mający filtry, zakładki albo
> przełączany układ albo obsługiwał stan widoku w adresie, albo miał **zapisane uzasadnienie**
> pominięcia. To jest ta lista — nie deklaracja intencji, tylko wynik przejrzenia komponentów.

## Kryterium podziału

**Stan widoku** = ustawienie, które opisuje *co i jak widzę* i które ma sens zapisać w ulubionych
(zakładka filtra, wybrany folder/tag, tryb prezentacji, sortowanie, szukajka listy).

**Nie jest stanem widoku** = stan *kroku pracy*: pola formularzy, tryby edytorów, wybór w oknie
dialogowym, postęp sesji nauki. Zapisanie takiego stanu w adresie nic nie daje (po powrocie i tak
zaczyna się od nowa), a zaśmieca adres i historię przeglądarki.

---

## Faza A — mechanizm zweryfikowany (T-13..T-15, klikacze T-16 zielone)

| Moduł | Plik | Stan w adresie | Klucze |
|-------|------|----------------|--------|
| Zadania | `components/tasks/TasksPage.tsx` | zakładka statusu, tagi, grupowanie, układ | `status`, `tags`, `groupBy`, `layout` |
| Zakupy | `components/shopping/ShoppingPage.tsx` | zakładka filtra, sortowanie (kategorie/produkty/sklep) | `filter`, `sort` |
| Notatki | `components/notes/NotesPage.tsx` | filtr, folder, tagi, tryb listy/siatki | `filter`, `group`, `tags`, `view` |

---

## Faza B — pokryte (T-18..T-21)

| Moduł | Plik | Stan w adresie | Klucze | Zadanie |
|-------|------|----------------|--------|---------|
| Zdrowie | `components/health/HealthHomePage.tsx` | zakładka (wszystko/wizyty/badania) | `tab` | T-18 |
| Kalendarz | `components/calendar/CalendarPage.tsx` | filtr modułu | `mod` | T-18 |
| Wiadomości | `components/news/NewsPage.tsx` | zakładka widoku | `widok` → `view` | T-18 |
| Usługi — katalog | `components/services/ServicesCatalogPage.tsx` | szukajka, sortowanie, kategoria | `q`, `sort`, `cat` | T-19 |
| Usługi — moje zlecenia | `components/services/MyRequestsPage.tsx` | zakładka (klient/wykonawca) | `tab` | T-19 |
| Usługi — moderacja | `components/services/ModerationPage.tsx` | zakładka statusu sporu | `tab` | T-19 |
| Pogoda → Pomysły | `components/weather/IdeaLibraryPage.tsx` | filtr stanu pomysłu | `filter` | T-19 |
| Warsztaty — szczegóły | `components/warsztaty/WorkshopDetail.tsx` | zakładka (sprzęt/sugestie/projekty) | `tab` | T-20 |
| Zwierzęta — szczegóły | `components/pets/PetDetailPage.tsx` | zakładka profilu | `tab` | T-20 |
| Magazynowanie | `components/magazynowanie/StorageList.tsx` | szukajka listy | `q` | T-21 |
| Kontakty | `components/contacts/ContactsPage.tsx` | szukajka | `q` | T-21 |
| Raporty | `components/reports/ReportsHomePage.tsx` | szukajka | `q` | T-21 |
| Kuchnia — przepisy | `components/kitchen/recipes/RecipeList.tsx` | szukajka | `q` | T-21 |
| Kuchnia — spiżarnia | `components/kitchen/pantry/PantryList.tsx` | szukajka | `q` | T-21 |

**Szukajki zapisujemy przez `replace: true`** — inaczej każda wpisana litera byłaby osobnym wpisem
w historii i „wstecz" trzeba by naciskać kilkanaście razy.

---

## Pominięte — z uzasadnieniem

### Moduły bez stanu widoku (nie ma czego zapisywać)

| Moduł | Dlaczego pominięty |
|-------|--------------------|
| Strona główna (`/`) | Personalizacja pulpitu (kolejność i widoczność sekcji) jest **trwała, per użytkownik** w `DashboardPref` — mocniejsza niż adres. Filtrów ani zakładek nie ma. |
| Nawyki (`/habits`) | Jeden widok: heatmapa + lista nawyków. Brak filtrów, zakładek i przełącznika układu — sprawdzone w `components/habits/`. |
| Flota (`/flota`) | Lista pojazdów bez filtrów. Jedyny stan (`fuelType`, `sType`) to **pola formularzy** dodawania tankowania i serwisu. |
| Portfel (`/portfel`) | Lista elementów bez filtrów. `kind` i `mode` to pola formularzy (rodzaj nowego elementu, rodzaj wpisu). |
| Nauka języków (`/languages`) | Lista talii bez filtrów. `nativeLang`/`targetLang` to pola formularza nowej talii, a `mode` w `StudySession` to tryb trwającej sesji nauki — stan kroku pracy, nie widoku. |
| Trasy TIR (`/truck`) | Formularz trasy — całość to stan kroku pracy. |
| QA (`/qa`) | Nawigacja po epikach/historiach idzie **ścieżką** (`/qa/[module]`, `/qa/scenariusz/[slug]`), więc widok już jest w adresie. |
| Kalendarz — miesiąc | Miesiąc jest już parametrem trasy/stanem serwerowym; do adresu dokładamy tylko filtr modułu. |

### Stan kroku pracy (świadomie poza adresem)

- Edytor map sklepów (`StoreMapEditor` — `mode`), skaner magazynu (`ScanFlow` — `mode`),
  genetyka zwierząt (`PetBreeding` — `mode`, `zygosity`), sesja nauki (`StudySession`),
  szukajki **wewnątrz szufladek** (`RecipeDrawer`, `SlotEditorSheet`, `TopicPicker`).
- Powód wspólny: to ustawienia trwające tyle, co jedno działanie. Po powrocie pod zapisany adres
  i tak zaczyna się od początku, więc parametr byłby kłamstwem — pokazywałby stan, którego nie ma.

### Panele administracyjne

`/admin/audit` (zakładka), `/admin/jobs` (filtr statusu), `/admin/ai-coverage` (filtr + szukajka),
`/admin/access` (zakładka) — narzędzia wewnętrzne, których nie zapisuje się w ulubionych i które
nie były przedmiotem zgłoszenia. Gdyby okazały się potrzebne, wpięcie to jeden `useViewState`
na komponent — mechanizm jest wspólny i gotowy.

---

## Podsumowanie

- **17 widoków** z realnym stanem widoku → **wszystkie pokryte** (3 w fazie A, 14 w fazie B).
- **8 modułów** bez stanu widoku → pominięte z uzasadnieniem.
- **Żaden moduł z `src/lib/modules.tsx` nie został bez decyzji.** AC-8b spełnione.
