# Recenzja: Pogoda — mapa, obserwatory, propozycje „Co robić?" i widoczne koszty AI

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-07-31
- **Diff:** `origin/develop...HEAD` — 86 plików, +4136 / −494

## Ustalenia

Trzy defekty znalezione i **naprawione w trakcie recenzji** (drobne, bezpieczne poprawki — zgodnie z
zasadami etapu). Żaden nie wymagał zawracania do `/implement`.

### 1. `IdeaDetailSheet.tsx:63` — correctness (UI/mobile) · **naprawione**

Arkusz szczegółów propozycji miał na telefonie `fixed inset-0 z-40` — **dokładnie tyle, ile dolny
pasek zakładek** w `AppShell.tsx:240`. Przy równym `z-index` o kolejności malowania decyduje kolejność
w DOM, a pasek zakładek jest renderowany później (siedzi w powłoce aplikacji, arkusz w treści strony).

**Scenariusz awarii:** użytkownik na telefonie otwiera szczegóły propozycji → dolny pasek zakładek
maluje się na wierzchu i przykrywa stopkę arkusza, czyli przyciski „Generuj ponownie", „Zapisz",
„Dodaj do zadań" i wskaźnik kosztu. Trzy z czterech akcji szczegółów stają się nieklikalne — dokładnie
ta klasa błędu, przed którą ostrzega wpis o warstwowaniu modali w `doświadczenia.md`.

**Poprawka:** `z-50`, tyle samo co `Modal` w tym repo — arkusz zachowuje się jak każde inne okno.

### 2. `LocationMapPicker.tsx:104` — correctness · **naprawione**

`setTimeout(() => map.invalidateSize(), 60)` nie był anulowany w funkcji sprzątającej efektu.

**Scenariusz awarii:** użytkownik otwiera „Wskaż na mapie" i zamyka okno w ciągu 60 ms (albo klika
„Ukryj mapę"). Sprzątanie woła `map.remove()`, Leaflet zeruje kontener, a odmierzony timer i tak
wchodzi w `invalidateSize()` na usuniętej mapie → `TypeError` w konsoli. Nie wywraca strony, ale to
prawdziwy błąd i zaśmiecony log.

**Poprawka:** timer trzymany w zmiennej efektu i czyszczony przez `clearTimeout` w cleanupie.

### 3. `WeatherPage.tsx` (`LocationsModal.savePoint`) — correctness · **naprawione**

Po zapisaniu punktu z mapy wołaliśmy tylko `onPick(l)` (ustawienie współrzędnych + zamknięcie okna),
bez odświeżenia danych serwerowych.

**Scenariusz awarii:** użytkownik zapisuje wieś wskazaną na mapie, dostaje dla niej prognozę — ale gdy
ponownie otworzy okno lokalizacji, **nowej pozycji nie ma na liście** (props `locations` przychodzi z
serwera i nie został odświeżony). Wygląda to jak „zapis nie zadziałał"; pozycja pojawia się dopiero po
przeładowaniu strony. Ścieżka dodawania po nazwie robiła to poprawnie — nowa ścieżka mapowa nie.

**Poprawka:** `run(async () => {})` przed `onPick`, czyli ten sam `router.refresh()`, którego używa
dodawanie po nazwie.

## Obszary sprawdzone bez ustaleń

| Obszar | Co sprawdzone | Wynik |
|---|---|---|
| Kontrola dostępu (C-21) | Wszystkie nowe akcje: `requireAuth()` + jawne `row.ownerId !== user.id`; `getIdeaDetail`/`blockIdea` używają klucza złożonego `ownerId_fingerprint`, więc są zawężone z natury; `addIdeaToTasks` dodatkowo sprawdza `PERMISSIONS.TASKS` | ✅ brak akcji bez guardu |
| `revalidatePath` (C-20) | Każda mutacja pomysłów kończy się rewalidacją właściwych ścieżek; `deleteIdea` dokłada `/trash` | ✅ |
| Migracja ↔ `schema.prisma` | `prisma migrate diff` z lokalnej bazy — `WeatherIdea` **nie pojawia się** w rozjazdach (pozostałe różnice są zastane i dotyczą innych tabel) | ✅ zgodne |
| Enumy Prisma (C-12) | `category`, `state` jako `TEXT`/`String` + union TS w `lib/weather/ideas.ts` | ✅ |
| `AIAction` bez egzekutora (C-23) | Nie dodano żadnej `AIAction`; `check:actions` bez zmian (160 akcji) | ✅ nie dotyczy |
| XSS w markdown | Szczegóły propozycji (treść z modelu) idą przez `markdownToHtml`, ten sam renderer co raporty/przepisy, z `escapeOutsideCodeBlocks` na `&` i `<`; brak nowej powierzchni | ✅ |
| Wyciek kluczy (C-41) | Nowy kod nie dotyka kluczy; wskaźnik kosztu pokazuje modele i tokeny, nigdy sekretów | ✅ |
| Kolory (C-30) | Zero hexów w nowym kodzie. Znacznik mapy przez `divIcon` z `var(--accent-blue)`/`var(--on-accent)` — właśnie po to, żeby nie wnosić własnej palety | ✅ |
| Martwy kod (C-53) | `describeDay` usunięty razem ze swoim UI (`grep` po `src/` bez trafień) — nie został „na wszelki wypadek" | ✅ |
| Nowe zależności (C-53) | Jedna: `leaflet` (+ typy). Bez `react-leaflet`. Ładowana `next/dynamic` z `ssr:false`, więc nie obciąża wejścia na `/pogoda` (13,8 kB) | ✅ uzasadniona |
| Wyścig w `category-icons` | Pierwsza wersja trzymała wynik wywołania w zmiennej **modułowej** — dwa równoległe żądania nadpisywałyby sobie zużycie. Poprawione jeszcze w implementacji: helper zwraca wynik, stan jest lokalny dla żądania | ✅ |

## Uwaga (nie blokuje)

**Dwie trasy zmieniły sposób odpowiadania.** `api/llm/tasks/search` i `api/llm/tasks/suggest`
przekazywały wcześniej treść modelu do klienta **surowo** (`new Response(cleaned)`), a teraz muszą ją
sparsować, żeby dokleić koszt. Kształt danych jest ten sam, ale gałąź niepoprawnego JSON-a zwraca
teraz `{"matches":[]}` / `{}` zamiast surowego tekstu — zachowanie równoważne (klient i tak parsował
odpowiedź jako JSON), więc odnotowuję to jako świadomą zmianę, nie defekt.

## Werdykt

**APPROVE Z UWAGAMI.**

Zmiana realizuje wszystkie sześć zgłoszeń właściciela, trzyma się konwencji repo i przechodzi komplet
bramek. Trzy znalezione defekty — z których jeden (przykryta stopka arkusza na telefonie) realnie
blokowałby korzystanie z nowej funkcji — zostały naprawione w trakcie recenzji. Uwaga o dwóch trasach
zadań jest informacyjna.

Bramki po poprawkach recenzji: `check:actions` ✅ · `check:ai-coverage` ✅ · `check:cost-badge` ✅ ·
`check:migrations` ✅ · `next lint` ✅ (16 ostrzeżeń, bez zmiany wobec stanu wyjściowego) ·
`next build` ✅ „Compiled successfully" · `tsc --noEmit` ✅.
